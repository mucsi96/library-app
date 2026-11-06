use chrono::{Days, Utc};
use sea_orm::{
    ActiveValue::Set, IntoActiveModel, QueryOrder, QuerySelect, TransactionTrait,
    entity::prelude::*,
};
use unicode_normalization::{UnicodeNormalization, char::is_combining_mark};

use super::{Error, Result};
use crate::models::{items, libraries};

pub async fn library_name(db: &impl ConnectionTrait, id: Option<String>) -> Result<Option<String>> {
    match id {
        None => Ok(None),
        Some(id) => Ok(Some(
            libraries::Entity::find_by_id(id)
                .one(db)
                .await?
                .ok_or_else(|| Error::bad("Unknown library"))?
                .name,
        )),
    }
}

pub async fn create_library(db: &DatabaseConnection, name: String) -> Result<libraries::Model> {
    let name = name.trim().to_owned();
    let normalized = name
        .nfkd()
        .filter(|c| !is_combining_mark(*c))
        .collect::<String>()
        .to_lowercase();
    let id = normalized
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if id.is_empty() {
        return Err(Error::bad(
            "A library name needs at least one letter or digit.",
        ));
    }
    let model = libraries::ActiveModel {
        id: Set(id),
        name: Set(name),
    };
    model.insert(db).await.map_err(|error| {
        if error
            .sql_err()
            .is_some_and(|e| matches!(e, sea_orm::SqlErr::UniqueConstraintViolation(_)))
        {
            Error::conflict("A library with this name already exists.")
        } else {
            error.into()
        }
    })
}

pub async fn items(db: &DatabaseConnection) -> Result<Vec<items::Model>> {
    Ok(items::Entity::find()
        .order_by_asc(items::Column::DueDate)
        .order_by_asc(items::Column::Title)
        .all(db)
        .await?)
}

pub async fn set_status(
    db: &DatabaseConnection,
    id: i64,
    status: items::Status,
) -> Result<items::Model> {
    let item = items::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(Error::missing)?;
    let mut item = item.into_active_model();
    item.status = Set(status);
    Ok(item.update(db).await?)
}

pub async fn set_library(
    db: &DatabaseConnection,
    id: i64,
    library: Option<String>,
    days: i64,
) -> Result<items::Model> {
    let tx = db.begin().await?;
    let item = items::Entity::find_by_id(id)
        .lock_exclusive()
        .one(&tx)
        .await?
        .ok_or_else(Error::missing)?;
    let name = library_name(&tx, library).await?;
    let due_date = if name.is_none() {
        None
    } else if item.library.is_none() {
        Some(due_date(days))
    } else {
        item.due_date
    };
    let status = if name.is_none() || item.library.is_none() {
        item.status.clone().on_shelf(name.is_none())
    } else {
        item.status.clone()
    };
    let mut item = item.into_active_model();
    item.library = Set(name);
    item.due_date = Set(due_date);
    item.status = Set(status);
    let item = item.update(&tx).await?;
    tx.commit().await?;
    Ok(item)
}

pub fn due_date(days: i64) -> chrono::NaiveDate {
    Utc::now().date_naive() + Days::new(days as u64)
}

pub async fn set_due_date(
    db: &DatabaseConnection,
    ids: Vec<i64>,
    date: chrono::NaiveDate,
) -> Result<Vec<items::Model>> {
    if ids.is_empty() {
        return Err(Error::bad("Select at least one item"));
    }
    let ids = ids.into_iter().collect::<std::collections::BTreeSet<_>>();
    let tx = db.begin().await?;
    let items = items::Entity::find()
        .filter(items::Column::Id.is_in(ids.iter().copied()))
        .order_by_asc(items::Column::Id)
        .lock_exclusive()
        .all(&tx)
        .await?;
    if items.len() != ids.len() {
        return Err(Error::missing());
    }
    if items.iter().any(|item| item.library.is_none()) {
        return Err(Error::bad("Own items have no due date"));
    }
    let mut result = Vec::with_capacity(items.len());
    for item in items {
        let mut item = item.into_active_model();
        item.due_date = Set(Some(date));
        result.push(item.update(&tx).await?);
    }
    tx.commit().await?;
    Ok(result)
}
