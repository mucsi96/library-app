use crate::settings::OpenAi;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Deserialize;
use serde_json::json;
use std::time::Duration;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Transport(#[from] reqwest::Error),
    #[error("AI service returned {status}")]
    Status {
        status: u16,
        retry_after_ms: Option<i64>,
    },
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Base64(#[from] base64::DecodeError),
    #[error("AI response is missing content")]
    Empty,
}

impl Error {
    pub fn transient(&self) -> bool {
        matches!(self, Self::Transport(_))
            || matches!(self, Self::Status { status, .. } if *status == 429 || *status >= 500)
    }
    pub fn retry_after_ms(&self) -> Option<i64> {
        match self {
            Self::Status { retry_after_ms, .. } => *retry_after_ms,
            _ => None,
        }
    }
}

#[derive(Clone)]
pub struct OpenAI {
    client: reqwest::Client,
    settings: OpenAi,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Extraction {
    pub isbn: Option<String>,
    pub title: Option<String>,
    pub author: Option<String>,
    pub media_type: Option<String>,
}

#[derive(Deserialize)]
struct Completion {
    choices: Vec<Choice>,
}
#[derive(Deserialize)]
struct Choice {
    message: Message,
}
#[derive(Deserialize)]
struct Message {
    content: String,
}
#[derive(Deserialize)]
struct Images {
    data: Vec<Image>,
}
#[derive(Deserialize)]
struct Image {
    b64_json: String,
}

impl OpenAI {
    pub fn new(settings: OpenAi) -> Result<Self, Error> {
        Ok(Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(settings.timeout_seconds))
                .redirect(reqwest::redirect::Policy::none())
                .build()?,
            settings,
        })
    }
    async fn send(&self, request: reqwest::RequestBuilder) -> Result<reqwest::Response, Error> {
        let response = request.bearer_auth(&self.settings.api_key).send().await?;
        if !response.status().is_success() {
            let retry_after_ms = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<i64>().ok())
                .filter(|v| *v >= 0)
                .and_then(|v| v.checked_mul(1000));
            return Err(Error::Status {
                status: response.status().as_u16(),
                retry_after_ms,
            });
        }
        Ok(response)
    }
    pub async fn extract(
        &self,
        front: &[u8],
        front_type: &str,
        back: &[u8],
        back_type: &str,
    ) -> Result<Extraction, Error> {
        let photo = |data, mime| json!({"type":"image_url", "image_url":{"url":format!("data:{mime};base64,{}", STANDARD.encode(data))}});
        let request = self.client.post(format!("{}/chat/completions", self.settings.base_url.trim_end_matches('/'))).json(&json!({
            "model": self.settings.model,
            "messages": [
                {"role":"system", "content":"You extract bibliographic data from front and back photos of a book, CD or DVD. Read the ISBN near the barcode on the back. Return JSON with isbn, title, author and mediaType (BOOK, CD or DVD). Return null for anything not clearly readable."},
                {"role":"user", "content":[{"type":"text", "text":"Here are the front and back photos of the item."},photo(front, front_type),photo(back, back_type)]}
            ],
            "response_format":{"type":"json_object"}
        }));
        let completion: Completion = self.send(request).await?.json().await?;
        Ok(serde_json::from_str(
            &completion
                .choices
                .first()
                .ok_or(Error::Empty)?
                .message
                .content,
        )?)
    }
    pub async fn cover(&self, data: Vec<u8>, mime: &str) -> Result<Vec<u8>, Error> {
        let form = reqwest::multipart::Form::new()
            .part("image", reqwest::multipart::Part::bytes(data).file_name("front").mime_str(mime)?)
            .text("prompt", "Recreate this cover as a clean product image. Remove all library markings: stickers, labels, barcodes and stamps. Keep the original artwork, title and typography unchanged.")
            .text("model", "gpt-image-2").text("size", "auto").text("n", "1").text("output_format", "jpeg").text("output_compression", "75");
        let images: Images = self
            .send(
                self.client
                    .post(format!(
                        "{}/images/edits",
                        self.settings.base_url.trim_end_matches('/')
                    ))
                    .multipart(form),
            )
            .await?
            .json()
            .await?;
        Ok(STANDARD.decode(&images.data.first().ok_or(Error::Empty)?.b64_json)?)
    }
}

pub fn isbn13(raw: &str) -> Option<String> {
    let digits: String = raw
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .collect();
    let check = |s: &str| {
        (10 - s
            .bytes()
            .enumerate()
            .map(|(i, b)| u32::from(b - b'0') * if i % 2 == 0 { 1 } else { 3 })
            .sum::<u32>()
            % 10)
            % 10
    };
    let digits = if digits.is_ascii()
        && digits.len() == 10
        && digits[..9].bytes().all(|c| c.is_ascii_digit())
        && matches!(digits.as_bytes()[9], b'0'..=b'9' | b'X' | b'x')
    {
        let base = format!("978{}", &digits[..9]);
        format!("{base}{}", check(&base))
    } else {
        digits
    };
    if digits.len() == 13
        && digits.bytes().all(|c| c.is_ascii_digit())
        && (digits.starts_with("978") || digits.starts_with("979"))
        && u32::from(digits.as_bytes()[12] - b'0') == check(&digits[..12])
    {
        Some(digits)
    } else {
        None
    }
}
