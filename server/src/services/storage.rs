use super::{Error, Result};
use std::path::{Component, Path, PathBuf};

#[derive(Clone)]
pub struct Storage(PathBuf);

impl Storage {
    pub async fn new(root: &str) -> Result<Self> {
        tokio::fs::create_dir_all(root).await?;
        Ok(Self(tokio::fs::canonicalize(root).await?))
    }
    fn path(&self, name: &str) -> Result<PathBuf> {
        if !Path::new(name)
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
        {
            return Err(Error::bad("Invalid storage path"));
        }
        Ok(self.0.join(name))
    }
    pub async fn read(&self, name: &str) -> Result<Vec<u8>> {
        tokio::fs::read(self.path(name)?).await.map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                Error::missing()
            } else {
                e.into()
            }
        })
    }
    pub async fn exists(&self, name: &str) -> Result<bool> {
        Ok(tokio::fs::try_exists(self.path(name)?).await?)
    }
    pub async fn write(&self, name: &str, data: &[u8]) -> Result<()> {
        let path = self.path(name)?;
        tokio::fs::create_dir_all(path.parent().expect("storage parent")).await?;
        let temporary = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
        tokio::fs::write(&temporary, data).await?;
        tokio::fs::rename(temporary, path).await?;
        Ok(())
    }
    pub async fn delete(&self, name: &str) -> Result<()> {
        match tokio::fs::remove_file(self.path(name)?).await {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.into()),
        }
    }
}

pub fn content_type(path: &str) -> &'static str {
    match Path::new(path).extension().and_then(|s| s.to_str()) {
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("heic") => "image/heic",
        _ => "image/jpeg",
    }
}

pub fn extension(content_type: &str) -> &'static str {
    match content_type {
        "image/png" => "png",
        "image/webp" => "webp",
        "image/heic" => "heic",
        _ => "jpg",
    }
}
