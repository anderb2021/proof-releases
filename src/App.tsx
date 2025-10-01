import { useEffect, useState } from "react";
import { ollamaHealth, ollamaEnsure, listModels, pullModel, generateText, getSettings, saveSettings, generateStream, listSessions, saveSession, loadSession, getParentLock, setParentLock, unlockParentLock, checkParentLock, getKidSafeSettings, setKidSafeSettings, KidSafeSettings, getNetworkSettings, setNetworkSettings, NetworkSettings } from "./lib/ipc";

export default function App() {
  const [ready, setReady] = useState(false);
  const [models, setModels] = useState<Array<{ model: string }>>([]);
  const [model, setModel] = useState("llama3.2:1b");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    default_model: "llama3.2:1b",
    temperature: 0.7,
    context_length: 4096,
    system: ""
  });
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; created_at: number }>>([]);
  
  // Parent Lock state
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showSetLockDialog, setShowSetLockDialog] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [setPassword, setSetPassword] = useState("");
  const [newLockMessage, setNewLockMessage] = useState("This app is locked by a parent.");
  
  // Kid-Safe Settings state
  const [kidSafeSettings, setKidSafeSettingsState] = useState<KidSafeSettings>({
    enabled: false,
    content_filter: true,
    educational_mode: true,
    max_response_length: 1000,
    allowed_topics: [],
    blocked_words: [],
    age_appropriate_level: 3,
    require_parental_approval: false,
  });
  const [showKidSafeDialog, setShowKidSafeDialog] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newBlockedWord, setNewBlockedWord] = useState("");
  
  // Network Settings state
  const [networkSettings, setNetworkSettingsState] = useState<NetworkSettings>({
    outbound_connections_enabled: true,
    ollama_connections_enabled: true,
    model_downloads_enabled: true,
    update_checks_enabled: true,
  });
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);

  useEffect(() => {
    (async () => {
      await ollamaEnsure();
      setReady(await ollamaHealth());
      const m = await listModels();
      setModels(m);
      const s = await getSettings();
      setSettings({ ...s, system: s.system ?? "" });
      setModel(s.default_model);
      if (m.length && !m.find(x => x.model === s.default_model)) setModel(m[0].model);
      try {
        const ss = await listSessions();
        setSessions(ss.map(({ id, title, created_at }) => ({ id, title, created_at })));
      } catch {}
      
      // Check parent lock status
      try {
        const lockStatus = await checkParentLock();
        if (lockStatus) {
          const lockInfo = await getParentLock();
          setIsLocked(true);
          setLockMessage(lockInfo.lock_message);
          setShowLockDialog(true);
        }
      } catch {}
      
      // Load kid-safe settings
      try {
        const settings = await getKidSafeSettings();
        setKidSafeSettingsState(settings);
      } catch {}
      
      // Load network settings
      try {
        const networkSettings = await getNetworkSettings();
        setNetworkSettingsState(networkSettings);
      } catch {}
    })();
  }, []);

  const onPull = async () => {
    setBusy(true);
    try {
      await pullModel(model);
      const m = await listModels();
      setModels(m);
    } finally {
      setBusy(false);
    }
  };

  const onSend = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setAnswer("");
    try {
      const out = await generateText(model, prompt, settings.temperature, settings.context_length, settings.system);
      setAnswer(out);
    } finally {
      setBusy(false);
    }
  };

  const onStream = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setAnswer("");
    try {
      // subscribe to events
      const { listen } = await import("@tauri-apps/api/event");
      const offToken = await listen("llm-token", (e: any) => {
        console.log("Token received:", e.payload?.token);
        setAnswer(prev => prev + (e.payload?.token ?? ""));
      });
      const offDone = await listen("llm-done", () => {
        console.log("Stream done");
        setBusy(false);
        offToken();
        offDone();
      });
      
      console.log("Starting stream...");
      await generateStream({ model, prompt, temperature: settings.temperature, num_ctx: settings.context_length, system: settings.system });
      console.log("Stream command completed");
    } catch (err) {
      console.error("Stream error:", err);
      setBusy(false);
    }
  };

  const onSaveSettings = async () => {
    console.log("Saving settings:", settings);
    try {
      await saveSettings(settings);
      console.log("Settings saved successfully");
      setShowSettings(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings: " + error);
    }
  };

  // Parent Lock functions
  const onUnlock = async () => {
    try {
      const success = await unlockParentLock(unlockPassword);
      if (success) {
        setIsLocked(false);
        setShowLockDialog(false);
        setUnlockPassword("");
        alert("App unlocked successfully!");
      } else {
        alert("Incorrect password. Please try again.");
      }
    } catch (error) {
      console.error("Failed to unlock:", error);
      alert("Failed to unlock: " + error);
    }
  };

  const onSetLock = async () => {
    if (!setPassword.trim()) {
      alert("Please enter a password.");
      return;
    }
    try {
      await setParentLock(setPassword, newLockMessage);
      setIsLocked(true);
      setLockMessage(newLockMessage);
      setShowSetLockDialog(false);
      setSetPassword("");
      alert("App locked successfully!");
    } catch (error) {
      console.error("Failed to set lock:", error);
      alert("Failed to set lock: " + error);
    }
  };

  // Kid-Safe Settings functions
  const onSaveKidSafeSettings = async () => {
    try {
      await setKidSafeSettings(kidSafeSettings);
      setShowKidSafeDialog(false);
      alert("Kid-safe settings saved successfully!");
    } catch (error) {
      console.error("Failed to save kid-safe settings:", error);
      alert("Failed to save kid-safe settings: " + error);
    }
  };

  const addTopic = () => {
    if (newTopic.trim() && !kidSafeSettings.allowed_topics.includes(newTopic.trim())) {
      setKidSafeSettingsState({
        ...kidSafeSettings,
        allowed_topics: [...kidSafeSettings.allowed_topics, newTopic.trim()]
      });
      setNewTopic("");
    }
  };

  const removeTopic = (topic: string) => {
    setKidSafeSettingsState({
      ...kidSafeSettings,
      allowed_topics: kidSafeSettings.allowed_topics.filter(t => t !== topic)
    });
  };

  const addBlockedWord = () => {
    if (newBlockedWord.trim() && !kidSafeSettings.blocked_words.includes(newBlockedWord.trim())) {
      setKidSafeSettingsState({
        ...kidSafeSettings,
        blocked_words: [...kidSafeSettings.blocked_words, newBlockedWord.trim()]
      });
      setNewBlockedWord("");
    }
  };

  const removeBlockedWord = (word: string) => {
    setKidSafeSettingsState({
      ...kidSafeSettings,
      blocked_words: kidSafeSettings.blocked_words.filter(w => w !== word)
    });
  };

  // Network Settings functions
  const onSaveNetworkSettings = async () => {
    try {
      await setNetworkSettings(networkSettings);
      setShowNetworkDialog(false);
      alert("Network settings saved successfully!");
    } catch (error) {
      console.error("Failed to save network settings:", error);
      alert("Failed to save network settings: " + error);
    }
  };

  const toggleOutboundConnections = () => {
    const newValue = !networkSettings.outbound_connections_enabled;
    setNetworkSettingsState({
      ...networkSettings,
      outbound_connections_enabled: newValue,
      // When disabling outbound connections, disable all other network features
      ollama_connections_enabled: newValue,
      model_downloads_enabled: newValue,
      update_checks_enabled: newValue,
    });
  };

  // Show lock screen if app is locked
  if (isLocked && !showLockDialog) {
    return (
      <div style={{ 
        padding: 16, 
        fontFamily: "system-ui, sans-serif", 
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#f8f9fa"
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2>App Locked</h2>
        <p style={{ marginBottom: 24, color: "#6c757d" }}>{lockMessage}</p>
        <button 
          onClick={() => setShowLockDialog(true)} 
          style={{ 
            padding: "12px 24px", 
            backgroundColor: "#51cf66", 
            color: "white", 
            border: "none", 
            borderRadius: 6,
            fontSize: 16,
            cursor: "pointer"
          }}
        >
          🔓 Unlock App
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Proof — Local LLM</h2>
        <button onClick={() => setShowSettings(!showSettings)} style={{ padding: "8px 16px" }}>
          ⚙️ Settings
        </button>
      </div>
      
      {showSettings && (
        <div style={{ 
          border: "1px solid #ccc", 
          borderRadius: 8, 
          padding: 16, 
          marginBottom: 16,
          backgroundColor: "#f9f9f9"
        }}>
          <h3>Settings</h3>
          <div style={{ marginBottom: 12 }}>
            <label>Default Model:</label>
            <select 
              value={settings.default_model} 
              onChange={e => setSettings({...settings, default_model: e.target.value})}
              style={{ marginLeft: 8, padding: "4px 8px" }}
            >
              {models.map(m => (
                <option key={m.model} value={m.model}>{m.model}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Temperature: {settings.temperature.toFixed(1)}</label>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.1" 
              value={settings.temperature}
              onChange={e => setSettings({...settings, temperature: parseFloat(e.target.value)})}
              style={{ width: "200px", marginLeft: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Context Length: {settings.context_length}</label>
            <input 
              type="range" 
              min="512" 
              max="8192" 
              step="512" 
              value={settings.context_length}
              onChange={e => setSettings({...settings, context_length: parseInt(e.target.value)})}
              style={{ width: "200px", marginLeft: 8 }}
            />
          </div>
          <button onClick={onSaveSettings} style={{ padding: "8px 16px", marginRight: 8 }}>Save</button>
          <button onClick={() => setShowSettings(false)} style={{ padding: "8px 16px" }}>Cancel</button>
        </div>
      )}

      <div>Status: {ready ? "Ollama ready" : "Starting Ollama..."}</div>
      <div style={{ marginTop: 12 }}>
        <label>Model:&nbsp;</label>
        <select value={model} onChange={e => setModel(e.target.value)}>
          {models.map(m => (
            <option key={m.model} value={m.model}>{m.model}</option>
          ))}
          {!models.find(m => m.model === "llama3.2:1b") && (
            <option value="llama3.2:1b">llama3.2:1b (pull to install)</option>
          )}
        </select>
        <button disabled={busy} onClick={onPull} style={{ marginLeft: 8 }}>Pull</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <textarea rows={5} style={{ width: "100%" }} placeholder="Type a prompt..."
          value={prompt} onChange={e => setPrompt(e.target.value)} />
      </div>
      <div style={{ marginTop: 8 }}>
        <button disabled={busy} onClick={onSend}>Send (non-stream)</button>
        <button disabled={busy} onClick={onStream} style={{ marginLeft: 8 }}>Send (stream)</button>
      </div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <input placeholder="Session title" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} style={{ padding: 6, flex: 1 }} />
        <button onClick={async () => {
          const id = Date.now().toString();
          const title = sessionTitle || (prompt.slice(0, 32) || "Session");
          const now = Math.floor(Date.now() / 1000);
          try {
            await saveSession({ id, title, created_at: now, messages: [
              ...(prompt ? [{ role: "user", content: prompt, timestamp: now }] : []),
              ...(answer ? [{ role: "assistant", content: answer, timestamp: now }] : [])
            ]});
            const ss = await listSessions();
            setSessions(ss.map(({ id, title, created_at }) => ({ id, title, created_at })));
            setSessionTitle("");
          } catch (err) { console.error(err); }
        }}>Save Session</button>
      </div>
      {sessions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Sessions</h3>
          <ul style={{ paddingLeft: 18 }}>
            {sessions.map(s => (
              <li key={s.id} style={{ marginBottom: 6 }}>
                <button onClick={async () => {
                  try {
                    const data = await loadSession(s.id);
                    const last = data.messages[data.messages.length - 1];
                    const first = data.messages.find(m => m.role === "user");
                    setPrompt(first?.content || "");
                    setAnswer(last?.role === "assistant" ? last.content : "");
                  } catch (err) { console.error(err); }
                }} style={{ marginRight: 8 }}>Load</button>
                <span>{new Date(s.created_at * 1000).toLocaleString()} — {s.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Parent Lock Controls */}
      <div style={{ marginTop: 24, borderTop: "1px solid #eee", paddingTop: 16 }}>
        <h3>Parent Controls</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setShowSetLockDialog(true)} style={{ padding: "8px 16px", backgroundColor: "#ff6b6b", color: "white", border: "none", borderRadius: 4 }}>
            🔒 Lock App
          </button>
          {isLocked && (
            <button onClick={() => setShowLockDialog(true)} style={{ padding: "8px 16px", backgroundColor: "#51cf66", color: "white", border: "none", borderRadius: 4 }}>
              🔓 Unlock App
            </button>
          )}
          <button onClick={() => setShowKidSafeDialog(true)} style={{ padding: "8px 16px", backgroundColor: "#4dabf7", color: "white", border: "none", borderRadius: 4 }}>
            🛡️ Kid-Safe Settings
          </button>
          <button onClick={() => setShowNetworkDialog(true)} style={{ padding: "8px 16px", backgroundColor: "#9775fa", color: "white", border: "none", borderRadius: 4 }}>
            🌐 Network Settings
          </button>
        </div>
        {kidSafeSettings.enabled && (
          <div style={{ padding: 12, backgroundColor: "#e3f2fd", borderRadius: 6, marginBottom: 16 }}>
            <strong>🛡️ Kid-Safe Mode Active</strong>
            <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
              Content filtering: {kidSafeSettings.content_filter ? "ON" : "OFF"} | 
              Educational mode: {kidSafeSettings.educational_mode ? "ON" : "OFF"} | 
              Age level: {kidSafeSettings.age_appropriate_level}/5
            </div>
          </div>
        )}
        {!networkSettings.outbound_connections_enabled && (
          <div style={{ padding: 12, backgroundColor: "#fff3cd", borderRadius: 6, marginBottom: 16 }}>
            <strong>🌐 Network Disabled</strong>
            <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
              All outbound connections are disabled. Ollama and model downloads are not available.
            </div>
          </div>
        )}
      </div>

      {/* Lock Dialog */}
      {showLockDialog && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: 24,
            borderRadius: 8,
            maxWidth: 400,
            width: "90%"
          }}>
            <h2>🔒 App Locked</h2>
            <p style={{ marginBottom: 16 }}>{lockMessage}</p>
            <div style={{ marginBottom: 16 }}>
              <input
                type="password"
                placeholder="Enter password to unlock"
                value={unlockPassword}
                onChange={e => setUnlockPassword(e.target.value)}
                style={{ width: "100%", padding: 8, marginBottom: 8 }}
                onKeyPress={e => e.key === "Enter" && onUnlock()}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onUnlock} style={{ padding: "8px 16px", backgroundColor: "#51cf66", color: "white", border: "none", borderRadius: 4 }}>
                Unlock
              </button>
              <button onClick={() => setShowLockDialog(false)} style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: 4 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Lock Dialog */}
      {showSetLockDialog && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: 24,
            borderRadius: 8,
            maxWidth: 400,
            width: "90%"
          }}>
            <h2>🔒 Lock App</h2>
            <div style={{ marginBottom: 16 }}>
              <label>Password:</label>
        <input
                type="password"
                placeholder="Enter password"
                value={setPassword}
                onChange={e => setSetPassword(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Lock Message:</label>
              <textarea
                placeholder="Message to show when locked"
                value={newLockMessage}
                onChange={e => setNewLockMessage(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4, height: 60 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onSetLock} style={{ padding: "8px 16px", backgroundColor: "#ff6b6b", color: "white", border: "none", borderRadius: 4 }}>
                Lock App
              </button>
              <button onClick={() => setShowSetLockDialog(false)} style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: 4 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kid-Safe Settings Dialog */}
      {showKidSafeDialog && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: 24,
            borderRadius: 8,
            maxWidth: 600,
            width: "90%",
            maxHeight: "90vh",
            overflowY: "auto"
          }}>
            <h2>🛡️ Kid-Safe Settings</h2>
            
            {/* Enable/Disable */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={kidSafeSettings.enabled}
                  onChange={e => setKidSafeSettingsState({...kidSafeSettings, enabled: e.target.checked})}
                />
                Enable Kid-Safe Mode
              </label>
            </div>

            {/* Content Filter */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={kidSafeSettings.content_filter}
                  onChange={e => setKidSafeSettingsState({...kidSafeSettings, content_filter: e.target.checked})}
                />
                Enable Content Filtering
              </label>
            </div>

            {/* Educational Mode */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={kidSafeSettings.educational_mode}
                  onChange={e => setKidSafeSettingsState({...kidSafeSettings, educational_mode: e.target.checked})}
                />
                Educational Mode (focus on learning topics)
              </label>
            </div>

            {/* Age Appropriate Level */}
            <div style={{ marginBottom: 16 }}>
              <label>Age Appropriate Level (1-5):</label>
              <input
                type="range"
                min="1"
                max="5"
                value={kidSafeSettings.age_appropriate_level}
                onChange={e => setKidSafeSettingsState({...kidSafeSettings, age_appropriate_level: parseInt(e.target.value)})}
                style={{ width: "100%", marginTop: 4 }}
              />
              <div style={{ textAlign: "center", fontSize: 14, color: "#666" }}>
                Level {kidSafeSettings.age_appropriate_level}/5
              </div>
            </div>

            {/* Max Response Length */}
            <div style={{ marginBottom: 16 }}>
              <label>Max Response Length:</label>
              <input
                type="number"
                value={kidSafeSettings.max_response_length}
                onChange={e => setKidSafeSettingsState({...kidSafeSettings, max_response_length: parseInt(e.target.value)})}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </div>

            {/* Allowed Topics */}
            <div style={{ marginBottom: 16 }}>
              <label>Allowed Topics:</label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                  type="text"
                  placeholder="Add allowed topic"
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                  style={{ flex: 1, padding: 8 }}
                  onKeyPress={e => e.key === "Enter" && addTopic()}
                />
                <button onClick={addTopic} style={{ padding: "8px 16px", backgroundColor: "#51cf66", color: "white", border: "none", borderRadius: 4 }}>
                  Add
                </button>
              </div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {kidSafeSettings.allowed_topics.map(topic => (
                  <span key={topic} style={{ 
                    backgroundColor: "#e3f2fd", 
                    padding: "4px 8px", 
                    borderRadius: 4, 
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}>
                    {topic}
                    <button onClick={() => removeTopic(topic)} style={{ background: "none", border: "none", cursor: "pointer" }}>×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Blocked Words */}
            <div style={{ marginBottom: 16 }}>
              <label>Blocked Words:</label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                  type="text"
                  placeholder="Add blocked word"
                  value={newBlockedWord}
                  onChange={e => setNewBlockedWord(e.target.value)}
                  style={{ flex: 1, padding: 8 }}
                  onKeyPress={e => e.key === "Enter" && addBlockedWord()}
                />
                <button onClick={addBlockedWord} style={{ padding: "8px 16px", backgroundColor: "#ff6b6b", color: "white", border: "none", borderRadius: 4 }}>
                  Add
                </button>
              </div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {kidSafeSettings.blocked_words.map(word => (
                  <span key={word} style={{ 
                    backgroundColor: "#ffebee", 
                    padding: "4px 8px", 
                    borderRadius: 4, 
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}>
                    {word}
                    <button onClick={() => removeBlockedWord(word)} style={{ background: "none", border: "none", cursor: "pointer" }}>×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Parental Approval */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={kidSafeSettings.require_parental_approval}
                  onChange={e => setKidSafeSettingsState({...kidSafeSettings, require_parental_approval: e.target.checked})}
                />
                Require Parental Approval for AI Responses
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onSaveKidSafeSettings} style={{ padding: "8px 16px", backgroundColor: "#4dabf7", color: "white", border: "none", borderRadius: 4 }}>
                Save Settings
              </button>
              <button onClick={() => setShowKidSafeDialog(false)} style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: 4 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Network Settings Dialog */}
      {showNetworkDialog && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            padding: 24,
            borderRadius: 8,
            maxWidth: 500,
            width: "90%",
            maxHeight: "90vh",
            overflowY: "auto"
          }}>
            <h2>🌐 Network Settings</h2>
            
            {/* Master Outbound Toggle */}
            <div style={{ marginBottom: 24, padding: 16, backgroundColor: "#f8f9fa", borderRadius: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, fontWeight: "bold" }}>
                <input
                  type="checkbox"
                  checked={networkSettings.outbound_connections_enabled}
                  onChange={toggleOutboundConnections}
                  style={{ transform: "scale(1.2)" }}
                />
                🌐 Enable All Outbound Connections
              </label>
              <div style={{ fontSize: 14, color: "#666", marginTop: 8, marginLeft: 24 }}>
                Master switch that controls all network access. When disabled, all internet connections are blocked.
              </div>
            </div>

            {/* Individual Network Settings */}
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>Individual Network Permissions</h3>
              
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={networkSettings.ollama_connections_enabled}
                    onChange={e => setNetworkSettingsState({...networkSettings, ollama_connections_enabled: e.target.checked})}
                    disabled={!networkSettings.outbound_connections_enabled}
                  />
                  Ollama Connections (AI model communication)
                </label>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={networkSettings.model_downloads_enabled}
                    onChange={e => setNetworkSettingsState({...networkSettings, model_downloads_enabled: e.target.checked})}
                    disabled={!networkSettings.outbound_connections_enabled}
                  />
                  Model Downloads (Download AI models)
                </label>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={networkSettings.update_checks_enabled}
                    onChange={e => setNetworkSettingsState({...networkSettings, update_checks_enabled: e.target.checked})}
                    disabled={!networkSettings.outbound_connections_enabled}
                  />
                  Update Checks (Check for app updates)
                </label>
              </div>
            </div>

            {/* Warning Message */}
            {!networkSettings.outbound_connections_enabled && (
              <div style={{ 
                padding: 12, 
                backgroundColor: "#fff3cd", 
                border: "1px solid #ffeaa7", 
                borderRadius: 6, 
                marginBottom: 16 
              }}>
                <strong>⚠️ Network Disabled</strong>
                <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
                  With outbound connections disabled, the app will work in offline mode only. 
                  Ollama communication and model downloads will not be available.
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onSaveNetworkSettings} style={{ padding: "8px 16px", backgroundColor: "#9775fa", color: "white", border: "none", borderRadius: 4 }}>
                Save Settings
              </button>
              <button onClick={() => setShowNetworkDialog(false)} style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: 4 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>
        {answer}
      </div>
    </div>
  );
}