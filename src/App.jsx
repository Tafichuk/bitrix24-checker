import { useState, useCallback } from "react";

const MODELS = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    sublabel: "gpt-4o",
    color: "#10a37f",
    bg: "#e6f7f3",
    textColor: "#0a5c44",
    keyPlaceholder: "sk-..."
  },
  {
    id: "gemini",
    label: "Gemini",
    sublabel: "gemini-1.5-pro",
    color: "#4285F4",
    bg: "#e8f0fe",
    textColor: "#1a56c4",
    keyPlaceholder: "AIza..."
  },
  {
    id: "mistral",
    label: "Mistral",
    sublabel: "mistral-large",
    color: "#FF7000",
    bg: "#fff0e6",
    textColor: "#a34500",
    keyPlaceholder: "..."
  }
];

const DEFAULT_PROMPT1 = `You are a native English language expert evaluating the naturalness of a localized Bitrix24 help article.

Evaluate the text for:
1. Natural English phrasing and idioms
2. Appropriate technical terminology usage
3. Sentence flow and readability
4. Whether it sounds originally written in English or translated

Respond ONLY with a raw JSON object, no markdown, no backticks:
{"score": <1-10>, "verdict": "<one sentence>", "issues": ["<issue1>", "<issue2>"], "strengths": ["<strength1>"]}`;

const DEFAULT_PROMPT2 = `You are a B2B SaaS content quality reviewer specializing in business software documentation.

Evaluate this Bitrix24 article for:
1. Professional tone appropriate for business software
2. Clarity and precision of technical instructions
3. Consistency with SaaS help center writing style
4. Whether it would confuse native English-speaking business users

Respond ONLY with a raw JSON object, no markdown, no backticks:
{"score": <1-10>, "verdict": "<one sentence>", "issues": ["<issue1>", "<issue2>"], "strengths": ["<strength1>"]}`;

async function callChatGPT(apiKey, systemPrompt, text) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Evaluate this localized Bitrix24 article text:\n\n${text}` }
      ]
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

async function callGemini(apiKey, systemPrompt, text) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: `Evaluate this localized Bitrix24 article text:\n\n${text}` }] }],
      generationConfig: { maxOutputTokens: 800 }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

async function callMistral(apiKey, systemPrompt, text) {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "mistral-large-latest",
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Evaluate this localized Bitrix24 article text:\n\n${text}` }
      ]
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

function ScoreRing({ score }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const filled = score != null ? (score / 10) * circ : 0;
  const color = score != null ? (score >= 8 ? "#1D9E75" : score >= 5 ? "#BA7517" : "#E24B4A") : "#B4B2A9";
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" style={{ flexShrink: 0 }}>
      <circle cx="34" cy="34" r={r} fill="none" stroke="#D3D1C7" strokeWidth="5" />
      <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 34 34)"
        style={{ transition: "stroke-dasharray 0.7s ease" }}
      />
      <text x="34" y="39" textAnchor="middle" fontSize="17" fontWeight="600" fill={score != null ? color : "#888780"}>
        {score != null ? score : "–"}
      </text>
    </svg>
  );
}

function Spinner({ color }) {
  return (
    <div style={{
      width: 14, height: 14,
      border: "2px solid #e0e0e0",
      borderTopColor: color,
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      flexShrink: 0
    }} />
  );
}

function ResultCard({ model, promptIdx, result, loading, error }) {
  const r = result;
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: "14px 16px",
      minHeight: 160,
      display: "flex",
      flexDirection: "column",
      gap: 10
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 6, background: model.bg, color: model.textColor }}>
            {model.label}
          </span>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Prompt {promptIdx + 1}</span>
        </div>
        {loading && <Spinner color={model.color} />}
      </div>

      {error && <div style={{ fontSize: 12, color: "#dc2626", lineHeight: 1.5 }}>⚠ {error}</div>}

      {r && !error && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <ScoreRing score={r.score} />
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "#111827" }}>{r.verdict}</div>
          </div>
          {r.issues?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Issues</div>
              {r.issues.map((iss, i) => (
                <div key={i} style={{ fontSize: 12, color: "#a32d2d", display: "flex", gap: 6, marginBottom: 3, alignItems: "flex-start" }}>
                  <span>●</span><span>{iss}</span>
                </div>
              ))}
            </div>
          )}
          {r.strengths?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Strengths</div>
              {r.strengths.map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: "#0F6E56", display: "flex", gap: 6, marginBottom: 3, alignItems: "flex-start" }}>
                  <span>●</span><span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !r && !error && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#9ca3af" }}>
          Waiting...
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [text, setText] = useState("");
  const [prompt1, setPrompt1] = useState(DEFAULT_PROMPT1);
  const [prompt2, setPrompt2] = useState(DEFAULT_PROMPT2);
  const [keys, setKeys] = useState({ chatgpt: "", gemini: "", mistral: "" });
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [running, setRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showPrompts, setShowPrompts] = useState(false);

  const setKey = (id, val) => setKeys(prev => ({ ...prev, [id]: val }));

  const missingKeys = MODELS.filter(m => !keys[m.id]?.trim()).map(m => m.label);

  const analyze = useCallback(async () => {
    if (!text.trim() || missingKeys.length) return;
    setResults({});
    setRunning(true);

    const callers = { chatgpt: callChatGPT, gemini: callGemini, mistral: callMistral };
    const prompts = [prompt1, prompt2];

    const tasks = MODELS.flatMap(m => prompts.map((p, pi) => ({
      key: `${m.id}_p${pi}`, modelId: m.id, prompt: p, pi
    })));

    const initLoad = {};
    tasks.forEach(t => { initLoad[t.key] = true; });
    setLoading(initLoad);

    await Promise.all(tasks.map(async ({ key, modelId, prompt }) => {
      try {
        const result = await callers[modelId](keys[modelId], prompt, text);
        setResults(prev => ({ ...prev, [key]: { data: result } }));
      } catch (e) {
        setResults(prev => ({ ...prev, [key]: { error: e.message } }));
      } finally {
        setLoading(prev => ({ ...prev, [key]: false }));
      }
    }));

    setRunning(false);
  }, [text, prompt1, prompt2, keys]);

  const scores = Object.values(results).filter(r => r.data?.score != null).map(r => r.data.score);
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "2rem 1rem" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 4px", color: "#111827" }}>Bitrix24 Localization Checker</h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          ChatGPT · Gemini · Mistral — 2 prompts each — 6 evaluations in parallel
        </p>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showSettings ? 14 : 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>API Keys</span>
          <button onClick={() => setShowSettings(p => !p)}
            style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>
            {showSettings ? "▲ Hide" : "▼ Show"}
          </button>
        </div>
        {showSettings && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {MODELS.map(m => (
              <div key={m.id}>
                <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 6 }}>
                  <span style={{ fontWeight: 500, color: m.textColor }}>{m.label}</span> — {m.sublabel}
                </label>
                <input
                  type="password"
                  value={keys[m.id]}
                  onChange={e => setKey(m.id, e.target.value)}
                  placeholder={m.keyPlaceholder}
                  style={{ width: "100%", fontSize: 13, boxSizing: "border-box", padding: "7px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontFamily: "monospace" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1rem" }}>
        <label style={{ fontSize: 13, color: "#6b7280", display: "block", marginBottom: 8 }}>Translated article text (English)</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste the localized Bitrix24 article text here..."
          rows={7}
          style={{ width: "100%", fontSize: 14, lineHeight: 1.6, boxSizing: "border-box", resize: "vertical", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontFamily: "sans-serif" }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <button onClick={() => setShowPrompts(p => !p)}
            style={{ fontSize: 13, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {showPrompts ? "▲ Hide" : "▼ Edit"} prompts
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {avg && <span style={{ fontSize: 13, color: "#6b7280" }}>Avg: <strong style={{ fontSize: 16, color: "#111827" }}>{avg}</strong>/10</span>}
            {missingKeys.length > 0 && !running && <span style={{ fontSize: 12, color: "#dc2626" }}>Missing keys: {missingKeys.join(", ")}</span>}
            <button
              onClick={analyze}
              disabled={running || !text.trim() || missingKeys.length > 0}
              style={{
                padding: "8px 22px", fontSize: 14, fontWeight: 500, borderRadius: 8,
                cursor: (running || !text.trim() || missingKeys.length > 0) ? "not-allowed" : "pointer",
                opacity: (running || !text.trim() || missingKeys.length > 0) ? 0.45 : 1,
                background: "#111827", color: "#fff", border: "none", transition: "opacity 0.2s"
              }}>
              {running ? "Analyzing..." : "Analyze"}
            </button>
          </div>
        </div>
      </div>

      {showPrompts && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1rem" }}>
          {[{ label: "Prompt 1 — Nativeness", val: prompt1, set: setPrompt1 },
            { label: "Prompt 2 — B2B Quality", val: prompt2, set: setPrompt2 }].map(({ label, val, set }, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem 1.25rem" }}>
              <label style={{ fontSize: 13, color: "#6b7280", display: "block", marginBottom: 8 }}>{label}</label>
              <textarea value={val} onChange={e => set(e.target.value)} rows={11}
                style={{ width: "100%", fontSize: 12, fontFamily: "monospace", lineHeight: 1.55, boxSizing: "border-box", resize: "vertical", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8 }} />
            </div>
          ))}
        </div>
      )}

      {(Object.keys(results).length > 0 || running) && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
            {MODELS.map(m => (
              <div key={m.id} style={{ textAlign: "center", fontSize: 13, fontWeight: 500, padding: "5px 0", borderRadius: 8, background: m.bg, color: m.textColor }}>
                {m.label}
              </div>
            ))}
          </div>
          {[0, 1].map(pi => (
            <div key={pi}>
              <div style={{ fontSize: 11, color: "#6b7280", margin: "12px 0 8px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Prompt {pi + 1}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
                {MODELS.map(m => {
                  const key = `${m.id}_p${pi}`;
                  const r = results[key];
                  return (
                    <ResultCard key={key} model={m} promptIdx={pi}
                      result={r?.data} loading={!!loading[key]} error={r?.error} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
