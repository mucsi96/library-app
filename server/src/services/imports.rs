use super::{
    Error, Result, catalog,
    openai::{self, Extraction, OpenAI},
    storage::{self, Storage},
};
use crate::{models::jobs, settings::Settings};
use chrono::{TimeDelta, Utc};
use sea_orm::{
    ActiveValue::Set, Condition, DatabaseBackend, FromQueryResult, IntoActiveModel, QueryOrder,
    Statement, TransactionTrait, entity::prelude::*,
};
use std::time::Duration;

#[derive(Clone)]
pub struct Imports {
    pub db: DatabaseConnection,
    pub settings: Settings,
    pub storage: Storage,
    ai: OpenAI,
}

impl Imports {
    pub async fn new(db: DatabaseConnection, settings: Settings) -> Result<Self> {
        Ok(Self {
            db,
            storage: Storage::new(&settings.storage_directory).await?,
            ai: OpenAI::new(settings.openai.clone())?,
            settings,
        })
    }

    pub fn spawn(&self) {
        let service = self.clone();
        tokio::spawn(async move {
            loop {
                if let Err(error) = service.poll().await {
                    tracing::error!(%error, "Import worker failed");
                }
                tokio::time::sleep(Duration::from_millis(service.settings.import.poll_ms)).await;
            }
        });
        let service = self.clone();
        tokio::spawn(async move {
            loop {
                if let Err(error) = service.sweep().await {
                    tracing::error!(%error, "Import sweep failed");
                }
                tokio::time::sleep(Duration::from_secs(service.settings.import.sweep_seconds))
                    .await;
            }
        });
    }

    pub async fn enqueue(
        &self,
        front: (Vec<u8>, String),
        back: (Vec<u8>, String),
        library: Option<String>,
    ) -> Result<jobs::Model> {
        let library = catalog::library_name(&self.db, library).await?;
        let reference = Uuid::new_v4();
        let front_photo = format!("imports/{reference}-front.{}", storage::extension(&front.1));
        let back_photo = format!("imports/{reference}-back.{}", storage::extension(&back.1));
        self.storage.write(&front_photo, &front.0).await?;
        if let Err(error) = self.storage.write(&back_photo, &back.0).await {
            self.storage.delete(&front_photo).await?;
            return Err(error);
        }
        let now = Utc::now().fixed_offset();
        let result = jobs::ActiveModel {
            reference: Set(reference),
            status: Set("QUEUED".into()),
            front_photo: Set(front_photo.clone()),
            back_photo: Set(back_photo.clone()),
            library: Set(library),
            attempts: Set(0),
            next_attempt_at: Set(now),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&self.db)
        .await;
        if result.is_err() {
            self.storage.delete(&front_photo).await?;
            self.storage.delete(&back_photo).await?;
        }
        Ok(result?)
    }

    pub async fn visible(&self) -> Result<Vec<jobs::Model>> {
        let since =
            Utc::now() - TimeDelta::seconds(self.settings.import.completed_visibility_seconds);
        Ok(jobs::Entity::find()
            .filter(
                Condition::any()
                    .add(jobs::Column::Status.ne("COMPLETED"))
                    .add(jobs::Column::UpdatedAt.gt(since.fixed_offset())),
            )
            .order_by_asc(jobs::Column::CreatedAt)
            .all(&self.db)
            .await?)
    }

    pub async fn require(&self, reference: Uuid) -> Result<jobs::Model> {
        jobs::Entity::find()
            .filter(jobs::Column::Reference.eq(reference))
            .one(&self.db)
            .await?
            .ok_or_else(Error::missing)
    }

    pub async fn resume(&self, reference: Uuid, isbn: Option<String>) -> Result<jobs::Model> {
        let tx = self.db.begin().await?;
        use sea_orm::QuerySelect;
        let job = jobs::Entity::find()
            .filter(jobs::Column::Reference.eq(reference))
            .lock_exclusive()
            .one(&tx)
            .await?
            .ok_or_else(Error::missing)?;
        let expected = if isbn.is_some() {
            "NEEDS_ISBN"
        } else {
            "FAILED"
        };
        if job.status != expected {
            return Err(Error::conflict(
                "This import cannot be resumed in its current state.",
            ));
        }
        let mut job = job.into_active_model();
        if let Some(isbn) = isbn {
            job.isbn = Set(Some(openai::isbn13(&isbn).ok_or_else(|| {
                Error::bad("Not a valid ISBN. Check the digits and try again.")
            })?));
        }
        job.status = Set("QUEUED".into());
        job.attempts = Set(0);
        job.error_detail = Set(None);
        job.next_attempt_at = Set(Utc::now().fixed_offset());
        job.updated_at = Set(Utc::now().fixed_offset());
        let job = job.update(&tx).await?;
        tx.commit().await?;
        Ok(job)
    }

    pub async fn dismiss(&self, reference: Uuid) -> Result<()> {
        let job = self.require(reference).await?;
        if !matches!(job.status.as_str(), "FAILED" | "NEEDS_ISBN") {
            return Err(Error::conflict(
                "Only failed or ISBN-waiting imports can be dismissed.",
            ));
        }
        self.delete_photos(&job).await?;
        jobs::Entity::delete_by_id(job.id).exec(&self.db).await?;
        Ok(())
    }

    async fn delete_photos(&self, job: &jobs::Model) -> Result<()> {
        self.storage.delete(&job.front_photo).await?;
        self.storage.delete(&job.back_photo).await
    }

    async fn poll(&self) -> Result<()> {
        let tx = self.db.begin().await?;
        let job = jobs::Model::find_by_statement(Statement::from_string(DatabaseBackend::Postgres,
            "SELECT * FROM library.import_jobs WHERE status='QUEUED' AND next_attempt_at <= now() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED"))
            .one(&tx).await?;
        let Some(job) = job else {
            return Ok(());
        };
        let slot = tx.execute_raw(Statement::from_sql_and_values(DatabaseBackend::Postgres,
            "UPDATE library.ai_pacer SET next_call_allowed_at=now() + interval '1 millisecond' * $1 WHERE id=1 AND next_call_allowed_at <= now()", [self.settings.import.min_job_interval_ms.into()])).await?;
        if slot.rows_affected() == 0 {
            return Ok(());
        }
        let mut claimed = job.clone().into_active_model();
        claimed.status = Set("EXTRACTING".into());
        claimed.updated_at = Set(Utc::now().fixed_offset());
        claimed.update(&tx).await?;
        tx.commit().await?;
        if let Err(error) = self.process(&job).await {
            tracing::warn!(reference = %job.reference, %error, "Import failed");
            let current = self.require(job.reference).await?;
            let attempts = current.attempts + 1;
            let mut current = current.into_active_model();
            let transient = matches!(&error, Error::Provider(e) if e.transient())
                || matches!(&error, Error::Io(_));
            if transient && attempts < self.settings.import.max_attempts {
                let base = self
                    .settings
                    .import
                    .retry_base_ms
                    .saturating_mul(1_i64 << (attempts - 1).min(16));
                let capped = base.min(self.settings.import.retry_max_ms);
                let jitter = (Uuid::new_v4().as_u128() % ((capped / 5 + 1) as u128)) as i64;
                let delay = match &error {
                    Error::Provider(e) => e.retry_after_ms(),
                    _ => None,
                }
                .unwrap_or(capped + jitter);
                current.status = Set("QUEUED".into());
                current.next_attempt_at =
                    Set((Utc::now() + TimeDelta::milliseconds(delay)).fixed_offset());
            } else {
                current.status = Set("FAILED".into());
                current.error_detail = Set(Some(if transient { "The AI service was busy and the import kept failing. Tap retry to try again." } else { "The photos could not be processed. Retake them and try again." }.into()));
            }
            current.attempts = Set(attempts);
            current.updated_at = Set(Utc::now().fixed_offset());
            current.update(&self.db).await?;
        }
        Ok(())
    }

    async fn process(&self, job: &jobs::Model) -> Result<()> {
        let front = self.storage.read(&job.front_photo).await?;
        let extracted = if job.isbn.is_some() {
            Extraction {
                isbn: job.isbn.clone(),
                title: job.title.clone(),
                author: job.author.clone(),
                media_type: job.media_type.clone(),
            }
        } else {
            let back = self.storage.read(&job.back_photo).await?;
            self.ai
                .extract(
                    &front,
                    storage::content_type(&job.front_photo),
                    &back,
                    storage::content_type(&job.back_photo),
                )
                .await?
        };
        let isbn = extracted.isbn.as_deref().and_then(openai::isbn13);
        let mut updated = job.clone().into_active_model();
        updated.title = Set(extracted.title.clone());
        updated.author = Set(extracted.author.clone());
        updated.media_type = Set(extracted.media_type.clone());
        updated.updated_at = Set(Utc::now().fixed_offset());
        let Some(isbn) = isbn else {
            updated.status = Set("NEEDS_ISBN".into());
            updated.error_detail = Set(Some(
                "No valid ISBN found on the photos. Enter the ISBN to finish the import.".into(),
            ));
            updated.update(&self.db).await?;
            return Ok(());
        };
        updated.isbn = Set(Some(isbn.clone()));
        updated.status = Set("GENERATING_COVER".into());
        updated.update(&self.db).await?;
        let thumbnail = format!("thumbnails/{isbn}.jpg");
        if !self.storage.exists(&thumbnail).await? {
            let cover = self
                .ai
                .cover(front, storage::content_type(&job.front_photo))
                .await?;
            self.storage.write(&thumbnail, &cover).await?;
        }
        let title = extracted.title.ok_or_else(|| Error::bad("Missing title"))?;
        let media = extracted
            .media_type
            .ok_or_else(|| Error::bad("Missing media type"))?;
        let due_date = job
            .library
            .as_ref()
            .map(|_| catalog::due_date(self.settings.loan_period_days));
        let own = job.library.is_none();
        let tx = self.db.begin().await?;
        // A single SQL upsert preserves progress even if replicas finish the same ISBN together.
        let row = tx.query_one_raw(Statement::from_sql_and_values(DatabaseBackend::Postgres,
            "INSERT INTO library.loan_items (isbn,media_type,title,author,library,due_date,status) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (isbn) DO UPDATE SET media_type=EXCLUDED.media_type,title=EXCLUDED.title,author=EXCLUDED.author,library=EXCLUDED.library,due_date=EXCLUDED.due_date,status=CASE WHEN loan_items.status='READ_RETURNED' THEN 'READ' WHEN EXCLUDED.library IS NULL AND loan_items.status IN ('LOANED','UNREAD_RETURNED') THEN 'NOT_STARTED' WHEN EXCLUDED.library IS NOT NULL AND loan_items.status IN ('NOT_STARTED','UNREAD_RETURNED') THEN 'LOANED' ELSE loan_items.status END RETURNING id",
            [isbn.into(), media.into(), title.into(), extracted.author.into(), job.library.clone().into(), due_date.into(), if own { "NOT_STARTED" } else { "LOANED" }.into()])).await?.ok_or_else(Error::missing)?;
        let id: i64 = row.try_get("", "id")?;
        let mut complete = jobs::ActiveModel {
            id: Set(job.id),
            ..Default::default()
        };
        complete.loan_item_id = Set(Some(id));
        complete.status = Set("COMPLETED".into());
        complete.error_detail = Set(None);
        complete.updated_at = Set(Utc::now().fixed_offset());
        complete.update(&tx).await?;
        tx.commit().await?;
        self.delete_photos(job).await?;
        Ok(())
    }

    async fn sweep(&self) -> Result<()> {
        self.db.execute_raw(Statement::from_sql_and_values(DatabaseBackend::Postgres,
            "UPDATE library.import_jobs SET status='QUEUED',next_attempt_at=now(),updated_at=now() WHERE status IN ('EXTRACTING','GENERATING_COVER') AND updated_at < now() - interval '1 second' * $1", [self.settings.import.stale_seconds.into()])).await?;
        let expired = jobs::Entity::find()
            .filter(jobs::Column::Status.is_in(["COMPLETED", "FAILED", "NEEDS_ISBN"]))
            .filter(
                jobs::Column::UpdatedAt.lt((Utc::now()
                    - TimeDelta::seconds(self.settings.import.retention_seconds))
                .fixed_offset()),
            )
            .all(&self.db)
            .await?;
        for job in expired {
            self.delete_photos(&job).await?;
            jobs::Entity::delete_by_id(job.id).exec(&self.db).await?;
        }
        Ok(())
    }
}
