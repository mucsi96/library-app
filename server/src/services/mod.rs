pub mod catalog;
pub mod imports;
pub mod openai;
pub mod storage;

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{1}")]
    Request(StatusCode, String),
    #[error(transparent)]
    Database(#[from] sea_orm::DbErr),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Provider(#[from] openai::Error),
}
pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    pub fn bad(detail: &str) -> Self {
        Self::Request(StatusCode::BAD_REQUEST, detail.into())
    }
    pub fn missing() -> Self {
        Self::Request(StatusCode::NOT_FOUND, "Not found".into())
    }
    pub fn conflict(detail: &str) -> Self {
        Self::Request(StatusCode::CONFLICT, detail.into())
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let (status, detail) = match self {
            Self::Request(status, detail) => (status, detail),
            error => {
                tracing::error!(%error, "Request failed");
                (StatusCode::INTERNAL_SERVER_ERROR, "Request failed".into())
            }
        };
        (
            status,
            Json(serde_json::json!({"status": status.as_u16(), "detail": detail})),
        )
            .into_response()
    }
}
