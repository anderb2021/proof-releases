import { useEffect, useState } from "react";
import { ollamaHealth, ollamaEnsure, listModels, pullModel, generateText, getSettings, saveSettings, generateStream, listSessions, saveSession, loadSession } from "./lib/ipc";

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
      <div style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>
        {answer}
      </div>
    </div>
  );
}