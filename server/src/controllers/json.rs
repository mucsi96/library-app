use crate::services::Error;
use axum::{
    Json,
    extract::{FromRequest, Request, rejection::JsonRejection},
};
use serde::de::DeserializeOwned;

// Preserve the API's 400 contract for malformed or invalid typed payloads.
pub struct Payload<T>(pub T);

impl<S, T> FromRequest<S> for Payload<T>
where
    S: Send + Sync,
    T: DeserializeOwned,
{
    type Rejection = Error;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        Json::<T>::from_request(request, state)
            .await
            .map(|Json(value)| Self(value))
            .map_err(|error: JsonRejection| Error::bad(&error.body_text()))
    }
}
