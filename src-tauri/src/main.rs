mod ollama;

use ollama::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use futures_util::StreamExt;
use tauri::{Emitter, Manager};

#[tauri::command]
async fn ollama_health() -> bool { is_running().await }

#[tauri::command]
async fn ollama_ensure() -> Result<(), String> { ensure_started().await.map_err(|e| e.to_string()) }

#[tauri::command]
async fn models_list() -> Result<Vec<Tag>, String> {
    ensure_started().await.map_err(|e| e.to_string())?;
    list_models().await.map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
struct PullArgs { model: String }

#[tauri::command]
async fn model_pull(args: PullArgs) -> Result<(), String> {
    ensure_started().await.map_err(|e| e.to_string())?;
    pull_model(&args.model).await.map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
struct DeleteArgs { model: String }

#[tauri::command]
async fn model_delete(args: DeleteArgs) -> Result<(), String> {
    delete_model(&args.model).await.map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
struct GenerateArgs {
    model: String,
    prompt: String,
    temperature: Option<f32>,
    num_ctx: Option<u32>,
    system: Option<String>,
}

#[tauri::command]
async fn generate_text(args: GenerateArgs) -> Result<String, String> {
    ensure_started().await.map_err(|e| e.to_string())?;
    let body = serde_json::json!({
        "model": args.model,
        "prompt": args.prompt,
        "stream": false,
        "temperature": args.temperature,
        "num_ctx": args.num_ctx,
        "system": args.system
    });
    let resp = reqwest::Client::new()
        .post("http://127.0.0.1:11434/api/generate")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(resp.get("response").and_then(|r| r.as_str()).unwrap_or("").to_string())
}

#[tauri::command]
async fn generate_stream(window: tauri::Window, args: GenerateArgs) -> Result<(), String> {
    ensure_started().await.map_err(|e| e.to_string())?;
    let body = serde_json::json!({
        "model": args.model,
        "prompt": args.prompt,
        "stream": true,
        "temperature": args.temperature,
        "num_ctx": args.num_ctx,
        "system": args.system
    });
    println!("Streaming request: {}", serde_json::to_string_pretty(&body).unwrap_or_default());
    
    let resp = reqwest::Client::new()
        .post("http://127.0.0.1:11434/api/generate")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;

    let mut stream = resp.bytes_stream();
    let mut buffer = Vec::new();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| e.to_string())?;
        buffer.extend_from_slice(&bytes);
        println!("Received {} bytes", bytes.len());
        
        // split by newlines for JSONL
        while let Some(pos) = buffer.iter().position(|b| *b == b'\n') {
            let line = buffer.drain(..=pos).collect::<Vec<u8>>();
            let line = String::from_utf8_lossy(&line);
            let line = line.trim();
            if line.is_empty() { continue; }
            println!("Processing line: {}", line);
            
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(done) = val.get("done").and_then(|d| d.as_bool()) {
                    if done {
                        println!("Stream done, emitting done event");
                        let _ = window.emit("llm-done", serde_json::json!({"done": true}));
                        continue;
                    }
                }
                if let Some(token) = val.get("response").and_then(|r| r.as_str()) {
                    println!("Emitting token: {}", token);
                    let _ = window.emit("llm-token", serde_json::json!({"token": token}));
                }
            } else {
                println!("Failed to parse JSON: {}", line);
            }
        }
    }
    println!("Stream ended");
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
struct Settings {
    default_model: String,
    temperature: f32,
    context_length: u32,
    #[serde(default)]
    system: String,
}

fn get_config_path() -> Result<PathBuf, String> {
    let mut config_dir = dirs::config_dir().ok_or("Could not find config directory")?;
    config_dir.push("proof");
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    Ok(config_dir.join("settings.json"))
}

#[tauri::command]
async fn get_settings() -> Result<Settings, String> {
    let config_path = get_config_path()?;
    if config_path.exists() {
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(Settings {
            default_model: "llama3.2:1b".to_string(),
            temperature: 0.7,
            context_length: 4096,
            system: String::new(),
        })
    }
}

#[tauri::command]
async fn save_settings(settings: Settings) -> Result<(), String> {
    let config_path = get_config_path()?;
    println!("Saving settings to: {:?}", config_path);
    let content = serde_json::to_string_pretty(&settings).map_err(|e| format!("JSON serialization error: {}", e))?;
    println!("Settings content: {}", content);
    fs::write(&config_path, content).map_err(|e| format!("File write error: {}", e))?;
    println!("Settings saved successfully");
    Ok(())
}

// ---- Simple conversation history ----
#[derive(Debug, Serialize, Deserialize, Clone)]
struct ChatMessage { role: String, content: String, timestamp: i64 }

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ChatSession { id: String, title: String, created_at: i64, messages: Vec<ChatMessage> }

fn sessions_dir() -> Result<PathBuf, String> {
    let mut dir = dirs::config_dir().ok_or("Could not find config directory")?;
    dir.push("proof");
    dir.push("sessions");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
async fn save_session(session: ChatSession) -> Result<(), String> {
    let dir = sessions_dir()?;
    let path = dir.join(format!("{}.json", session.id));
    let content = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_sessions() -> Result<Vec<ChatSession>, String> {
    let dir = sessions_dir()?;
    let mut out = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                if let Ok(sess) = serde_json::from_str::<ChatSession>(&content) {
                    out.push(sess);
                }
            }
        }
    }
    out.sort_by_key(|s| s.created_at);
    out.reverse();
    Ok(out)
}

#[tauri::command]
async fn load_session(id: String) -> Result<ChatSession, String> {
    let dir = sessions_dir()?;
    let path = dir.join(format!("{}.json", id));
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str::<ChatSession>(&content).map_err(|e| e.to_string())
}


#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ollama_health,
            ollama_ensure,
            models_list,
            model_pull,
            model_delete,
            generate_text,
            generate_stream,
            get_settings,
            save_settings,
            save_session,
            list_sessions,
            load_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}