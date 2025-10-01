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

// Parent Lock functions
export interface ParentLock {
  is_locked: boolean;
  password_hash: string;
  lock_message: string;
}

export const getParentLock = () => invoke<ParentLock>("get_parent_lock");
export const setParentLock = (password: string, lockMessage: string) => invoke<void>("set_parent_lock", { args: { password, lock_message: lockMessage } });
export const unlockParentLock = (password: string) => invoke<boolean>("unlock_parent_lock", { password });
export const checkParentLock = () => invoke<boolean>("check_parent_lock");

// Kid-Safe Settings functions
export interface KidSafeSettings {
  enabled: boolean;
  content_filter: boolean;
  educational_mode: boolean;
  max_response_length: number;
  allowed_topics: string[];
  blocked_words: string[];
  age_appropriate_level: number;
  require_parental_approval: boolean;
}

export const getKidSafeSettings = () => invoke<KidSafeSettings>("get_kidsafe_settings");
export const setKidSafeSettings = (settings: KidSafeSettings) => invoke<void>("set_kidsafe_settings", { args: { settings } });
export const checkKidSafeContent = (prompt: string) => invoke<boolean>("check_kidsafe_content", { prompt });

// Network Settings functions
export interface NetworkSettings {
  outbound_connections_enabled: boolean;
  ollama_connections_enabled: boolean;
  model_downloads_enabled: boolean;
  update_checks_enabled: boolean;
}

export const getNetworkSettings = () => invoke<NetworkSettings>("get_network_settings");
export const setNetworkSettings = (settings: NetworkSettings) => invoke<void>("set_network_settings", { args: { settings } });
export const checkNetworkPermission = (permissionType: string) => invoke<boolean>("check_network_permission", { permission_type: permissionType });

// Auto-updater commands
export const checkForUpdates = () => invoke<{ updateAvailable: boolean; version?: string }>("check_for_updates");
export const downloadUpdate = () => invoke<void>("download_update");
export const installUpdate = () => invoke<void>("install_update");
