use crate::{
    models::{items, jobs, libraries},
    services::{Error, Result, catalog, imports::Imports, storage},
};
mod json;
use axum::{
    Extension, Json,
    extract::{Multipart, Path},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use json::Payload;
use loco_rs::controller::Routes;
use sea_orm::{EntityTrait, QueryOrder};
use serde::Deserialize;
use uuid::Uuid;

pub fn routes() -> Routes {
    Routes::new()
        .prefix("/api")
        .get("/items", list_items)
        .post("/items/import", enqueue)
        .add("/items/{id}/status", axum::routing::put(set_status))
        .add("/items/{id}/library", axum::routing::put(set_library))
        .add("/items/due-date", axum::routing::put(set_due_date))
        .get("/libraries", list_libraries)
        .post("/libraries", create_library)
        .add("/libraries/{id}", axum::routing::delete(delete_library))
        .get("/import-jobs", list_jobs)
        .get("/import-jobs/{reference}/photo", photo)
        .post("/import-jobs/{reference}/retry", retry)
        .post("/import-jobs/{reference}/isbn", submit_isbn)
        .add("/import-jobs/{reference}", axum::routing::delete(dismiss))
        .get("/thumbnails/{isbn}", thumbnail)
}

async fn list_items(Extension(s): Extension<Imports>) -> Result<Json<Vec<items::Model>>> {
    Ok(Json(catalog::items(&s.db).await?))
}
async fn list_libraries(Extension(s): Extension<Imports>) -> Result<Json<Vec<libraries::Model>>> {
    Ok(Json(
        libraries::Entity::find()
            .order_by_asc(libraries::Column::Name)
            .all(&s.db)
            .await?,
    ))
}
#[derive(Deserialize)]
struct Name {
    name: String,
}
async fn create_library(
    Extension(s): Extension<Imports>,
    Payload(body): Payload<Name>,
) -> Result<impl IntoResponse> {
    Ok((
        StatusCode::CREATED,
        Json(catalog::create_library(&s.db, body.name).await?),
    ))
}
async fn delete_library(
    Extension(s): Extension<Imports>,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    if libraries::Entity::delete_by_id(id)
        .exec(&s.db)
        .await?
        .rows_affected
        == 0
    {
        return Err(Error::missing());
    }
    Ok(StatusCode::NO_CONTENT)
}
#[derive(Deserialize)]
struct Status {
    status: items::Status,
}
async fn set_status(
    Extension(s): Extension<Imports>,
    Path(id): Path<i64>,
    Payload(body): Payload<Status>,
) -> Result<Json<items::Model>> {
    Ok(Json(catalog::set_status(&s.db, id, body.status).await?))
}
#[derive(Deserialize)]
struct Library {
    library: Option<String>,
}
async fn set_library(
    Extension(s): Extension<Imports>,
    Path(id): Path<i64>,
    Payload(body): Payload<Library>,
) -> Result<Json<items::Model>> {
    Ok(Json(
        catalog::set_library(&s.db, id, body.library, s.settings.loan_period_days).await?,
    ))
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DueDate {
    ids: Vec<i64>,
    due_date: chrono::NaiveDate,
}
async fn set_due_date(
    Extension(s): Extension<Imports>,
    Payload(body): Payload<DueDate>,
) -> Result<Json<Vec<items::Model>>> {
    Ok(Json(
        catalog::set_due_date(&s.db, body.ids, body.due_date).await?,
    ))
}
async fn list_jobs(Extension(s): Extension<Imports>) -> Result<Json<Vec<jobs::Model>>> {
    Ok(Json(s.visible().await?))
}
async fn retry(
    Extension(s): Extension<Imports>,
    Path(reference): Path<Uuid>,
) -> Result<Json<jobs::Model>> {
    Ok(Json(s.resume(reference, None).await?))
}
#[derive(Deserialize)]
struct Isbn {
    isbn: String,
}
async fn submit_isbn(
    Extension(s): Extension<Imports>,
    Path(reference): Path<Uuid>,
    Payload(body): Payload<Isbn>,
) -> Result<Json<jobs::Model>> {
    Ok(Json(s.resume(reference, Some(body.isbn)).await?))
}
async fn dismiss(
    Extension(s): Extension<Imports>,
    Path(reference): Path<Uuid>,
) -> Result<StatusCode> {
    s.dismiss(reference).await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn photo(Extension(s): Extension<Imports>, Path(reference): Path<Uuid>) -> Result<Response> {
    let job = s.require(reference).await?;
    Ok((
        [
            (
                header::CONTENT_TYPE,
                storage::content_type(&job.front_photo),
            ),
            (header::CACHE_CONTROL, "private, max-age=300"),
        ],
        s.storage.read(&job.front_photo).await?,
    )
        .into_response())
}
async fn thumbnail(Extension(s): Extension<Imports>, Path(isbn): Path<String>) -> Result<Response> {
    if isbn.len() != 13 || !isbn.bytes().all(|c| c.is_ascii_digit()) {
        return Err(Error::missing());
    }
    Ok((
        [
            (header::CONTENT_TYPE, "image/jpeg"),
            (header::CACHE_CONTROL, "public, max-age=31536000, immutable"),
        ],
        s.storage.read(&format!("thumbnails/{isbn}.jpg")).await?,
    )
        .into_response())
}
async fn enqueue(
    Extension(s): Extension<Imports>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse> {
    let mut front = None;
    let mut back = None;
    let mut library = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| Error::bad("Invalid multipart upload"))?
    {
        let name = field.name().unwrap_or_default().to_owned();
        let mime = field.content_type().unwrap_or("image/jpeg").to_owned();
        let data = field
            .bytes()
            .await
            .map_err(|_| Error::bad("Invalid multipart upload"))?;
        if data.len() > 15 * 1024 * 1024 {
            return Err(Error::Request(
                StatusCode::PAYLOAD_TOO_LARGE,
                "Photo exceeds 15MB".into(),
            ));
        }
        match name.as_str() {
            "front" => front = Some((data.to_vec(), mime)),
            "back" => back = Some((data.to_vec(), mime)),
            "library" => {
                library = Some(
                    String::from_utf8(data.to_vec()).map_err(|_| Error::bad("Invalid library"))?,
                )
            }
            _ => return Err(Error::bad("Unknown upload field")),
        }
    }
    Ok((
        StatusCode::ACCEPTED,
        Json(
            s.enqueue(
                front.ok_or_else(|| Error::bad("Front photo required"))?,
                back.ok_or_else(|| Error::bad("Back photo required"))?,
                library,
            )
            .await?,
        ),
    ))
}
