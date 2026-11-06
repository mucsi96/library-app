use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Settings {
    pub oidc: Oidc,
    pub openai: OpenAi,
    pub storage_directory: String,
    pub loan_period_days: i64,
    pub import: Import,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Oidc {
    pub issuer: String,
    pub audience: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OpenAi {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub timeout_seconds: u64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Import {
    pub poll_ms: u64,
    pub min_job_interval_ms: i64,
    pub max_attempts: i32,
    pub retry_base_ms: i64,
    pub retry_max_ms: i64,
    pub stale_seconds: i64,
    pub completed_visibility_seconds: i64,
    pub retention_seconds: i64,
    pub sweep_seconds: u64,
}

impl Settings {
    pub fn validate(&self) -> anyhow::Result<()> {
        anyhow::ensure!(
            [
                &self.oidc.issuer,
                &self.oidc.audience,
                &self.openai.api_key,
                &self.openai.model,
                &self.storage_directory
            ]
            .iter()
            .all(|s| !s.trim().is_empty()),
            "Settings must not be empty"
        );
        anyhow::ensure!(
            self.loan_period_days > 0
                && self.openai.timeout_seconds > 0
                && self.import.poll_ms > 0
                && self.import.min_job_interval_ms > 0
                && self.import.max_attempts > 0
                && self.import.retry_base_ms > 0
                && self.import.retry_max_ms >= self.import.retry_base_ms
                && self.import.stale_seconds > 0
                && self.import.sweep_seconds > 0
                && self.import.retention_seconds > 0
                && self.import.completed_visibility_seconds > 0,
            "Timing settings must be positive"
        );
        crate::middleware::auth::validate_endpoint(&self.oidc.issuer)?;
        crate::middleware::auth::validate_endpoint(&self.openai.base_url)?;
        Ok(())
    }
}
