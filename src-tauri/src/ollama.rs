use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use thiserror::Error;
use tokio::{time::{sleep, Duration}};

const OLLAMA_URL: &str = "http://127.0.0.1:11434";

#[derive(Debug, Error)]
pub enum OllamaError {
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("process spawn failed")]
    SpawnFailed,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Tag {
    pub model: String,
    pub size: Option<u64>,
}

pub async fn is_running() -> bool {
    reqwest::Client::new()
        .get(format!("{}/api/tags", OLLAMA_URL))
        .timeout(Duration::from_secs(2))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

pub async fn ensure_started() -> Result<(), OllamaError> {
    if is_running().await {
        return Ok(());
    }
    let spawned = Command::new("ollama")
        .arg("serve")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .is_ok();
    if !spawned {
        return Err(OllamaError::SpawnFailed);
    }
    for _ in 0..10 {
        if is_running().await { return Ok(()); }
        sleep(Duration::from_millis(500)).await;
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateRequest {
    pub model: String,
    pub prompt: String,
    #[serde(default)]
    pub stream: bool,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub num_ctx: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateChunk {
    pub model: String,
    pub created_at: String,
    pub response: String,
    pub done: bool,
}

pub async fn list_models() -> Result<Vec<Tag>, OllamaError> {
    let resp = reqwest::Client::new()
        .get(format!("{}/api/tags", OLLAMA_URL))
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    let mut out = Vec::new();
    if let Some(models) = resp.get("models").and_then(|m| m.as_array()) {
        for m in models {
            if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                out.push(Tag { model: name.to_string(), size: None });
            }
        }
    }
    Ok(out)
}

pub async fn pull_model(model: &str) -> Result<(), OllamaError> {
    let _ = reqwest::Client::new()
        .post(format!("{}/api/pull", OLLAMA_URL))
        .json(&serde_json::json!({ "model": model }))
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}

pub async fn delete_model(model: &str) -> Result<(), OllamaError> {
    let _ = reqwest::Client::new()
        .delete(format!("{}/api/delete", OLLAMA_URL))
        .json(&serde_json::json!({ "model": model }))
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}
