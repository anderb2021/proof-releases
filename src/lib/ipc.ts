import { invoke } from "@tauri-apps/api/core";

export const ollamaHealth = () => invoke<boolean>("ollama_health");
export const ollamaEnsure = () => invoke<void>("ollama_ensure");
export const listModels = () => invoke<Array<{ model: string }>>("models_list");
export const pullModel = (model: string) => invoke<void>("model_pull", { args: { model } });
export const deleteModel = (model: string) => invoke<void>("model_delete", { args: { model } });
export const generateText = (model: string, prompt: string, temperature?: number, numCtx?: number, system?: string) =>
  invoke<string>("generate_text", { args: { model, prompt, temperature, num_ctx: numCtx, system } });

export const generateStream = (params: { model: string; prompt: string; temperature?: number; num_ctx?: number; system?: string }) =>
  invoke<void>("generate_stream", { args: params });

export const getSettings = () => invoke<{ default_model: string; temperature: number; context_length: number; system?: string }>("get_settings");
export const saveSettings = (settings: { default_model: string; temperature: number; context_length: number; system?: string }) =>
  invoke<void>("save_settings", { settings });

export type ChatMessage = { role: string; content: string; timestamp: number };
export type ChatSession = { id: string; title: string; created_at: number; messages: ChatMessage[] };
export const saveSession = (session: ChatSession) => invoke<void>("save_session", { session });
export const listSessions = () => invoke<ChatSession[]>("list_sessions");
export const loadSession = (id: string) => invoke<ChatSession>("load_session", { id });

// Auto-updater commands
export const checkForUpdates = () => invoke<{ updateAvailable: boolean; version?: string }>("check_for_updates");
export const downloadUpdate = () => invoke<void>("download_update");
export const installUpdate = () => invoke<void>("install_update");
