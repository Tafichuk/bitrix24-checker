import { useState, useCallback } from "react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "pl", label: "Polish" },
  { code: "fr", label: "French" },
  { code: "it", label: "Italian" },
];

const MODELS = [
  { id: "chatgpt", label: "ChatGPT", sublabel: "gpt-4o", color: "#10a37f", bg: "#e6f7f3", textColor: "#0a5c44" },
  { id: "gemini", label: "Gemini", sublabel: "gemini-1.5-pro", color: "#4285F4", bg: "#e8f0fe", textColor: "#1a56c4" },
  { id: "mistral", label: "Mistral", sublabel: "mistral-large", color: "#FF7000", bg: "#fff0e6", textColor: "#a34500" },
];

const PROMPT_JUDGE8 = `Ты — американский нативный редактор help-desk статей (информационный текст, НЕ маркетинг).
Оцени английский текст по двум осям от 1 до 5:
A) нативность/переводность
B) plain language (простота)
Не меняй продуктовые термины.
Дай ТОЛЬКО это (никаких пояснений):
FINAL_SCORE: X/5  (считается как среднее арифметическое от NATIVE_SCORE и PLAIN_SCORE)
NATIVE_SCORE: X/5
PLAIN_SCORE: X/5`;

const PROMPT_JUDGE9 = `Ты — американский нативный редактор help-desk статей (информационный текст, НЕ маркетинг).
Оцени английский текст по двум осям от 1 до 5:
A) нативность/переводность
B) plain language (простота)
Список критериев Plain language
1. Use simple, common words instead of complex or formal ones.
2. Prefer a single word instead of a phrase when both mean the same thing.
3. Avoid phrasal verbs, except common UI terms such as set up, log in, and sign in.
4. Avoid unnecessary modifiers and filler words (for example, actually, very, really, totally, just, basically).
5. Write short sentences. Express only one idea per sentence.
6. Use active voice.
7. Prefer strong verbs instead of nominalizations (for example, use decide instead of make a decision).
8. Place the main result or action at the beginning of the sentence (front-load key information).
9. Write short paragraphs (typically 3–8 sentences). Cover only one topic per paragraph.
10. Use standard sentence structures and consistent phrasing for common actions and instructions.
11. Make text easy to scan.
12. Use lists when they improve readability.
13. Write instructions as clear actions.
14. Use modifiers correctly and avoid stacking too many nouns as modifiers.
15. Clarify abbreviations when they first appear.
16. Use pronouns so the reference is clear.
Список критериев нативности
1. Simple and natural English — The text uses simple, common vocabulary and natural English phrasing. It does not reflect translated or Russian sentence structure.
2. Clear and concise sentences — Sentences are short (about 10–20 words), easy to read, and each expresses one clear idea.
3. Direct and active language — Sentences mostly use active voice and express actions with verbs rather than abstract nouns.
4. Concise wording — The text avoids filler phrases, redundancy, and unnecessary words.
5. Clear structure and consistent terminology — Information is structured clearly (for example, using lists when appropriate), and the same terms are used consistently for the same UI elements or concepts.
Не меняй продуктовые термины.
Дай ТОЛЬКО это (никаких пояснений):
FINAL_SCORE: X/5  (считается как среднее арифметическое от NATIVE_SCORE и PLAIN_SCORE)
NATIVE_SCORE: X/5
PLAIN_SCORE: X/5`;

function parseScores(text) {
  if (!text) return null;

  const clean = text.replace(/\*\*/g, '').replace(/\n+/g, ' ');

  const final = clean.match(/FINAL_SCORE:\s*(\d+(?:\.\d+)?)\s*\/\s*5/i);
  const native = clean.match(/NATIVE_SCORE:\s*(\d+(?:\.\d+)?)\s*\/\s*5/i);
  const plain = clean.match(/PLAIN_SCORE:\s*(\d+(?:\.\d+)?)\s*\/\s*5/i);

  if (!final || !native || !plain) {
    const numbers = clean.match(/(\d+(?:\.\d+)?)\s*\/\s*5/gi);
    if (numbers && numbers.length >= 3) {
      const vals = numbers.map(n => parseFloat(n));
      return { final: vals[0], native: vals[1], plain: vals[2] };
    }
    return null;
  }

  return {
    final: parseFloat(final[1]),
    native: parseFloat(native[1]),
    plain: parseFloat(plain[1]),
  };
}

async function callChatGPT(systemPrompt, text) {
  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ]
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(systemPrompt, text) {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: systemPrompt, text })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  return data.text || '';
}

async function callMistral(systemPrompt, text) {
  const res = await fetch('/api/mistral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      max_tokens: 100,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ]
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function ScoreBar({ label, value, max = 5 }) {
  const pct = value != null ? (value / max) * 100 : 0;
  const color = value == null ? "#D3D1C7" : value >= 4 ? "#1D9E75" : value >= 3 ? "#BA7517" : "#E24B4A";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "#6b7280" }}>{label}</span>
        <span style={{ fontWeight: 600, color }}>{value != null ? `${value}/5` : "—"}</span>
      </div>
      <div style={{ height: 6, background: "#f3f4f6", borderRadius: 99 }}>
        <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function ResultCard({ model, judgeLabel, result, loading, error }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: "14px 16px",
      minHeight: 100,
      display: "flex",
      flexDirection: "column",
      gap: 8
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: model.bg, color: model.textColor }}>
            {model.label}
          </span>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{judgeLabel}</span>
        </div>
        {loading && (
          <div style={{ width: 14, height: 14, border: "2px solid #e5e7eb", borderTopColor: model.color, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        )}
      </div>

      {error && <div style={{ fontSize: 12, color: "#dc2626" }}>⚠ {error}</div>}

      {result && !error && (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <span style={{
            fontSize: 36, fontWeight: 700,
            color: result.final >= 4 ? "#1D9E75" : result.final >= 3 ? "#BA7517" : "#E24B4A"
          }}>{result.final}</span>
          <span style={{ fontSize: 16, color: "#9ca3af" }}>/5</span>
        </div>
      )}

      {!loading && !result && !error && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#9ca3af" }}>
          Waiting...
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("en");
  const [results, setResults] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [running, setRunning] = useState(false);

  const callers = { chatgpt: callChatGPT, gemini: callGemini, mistral: callMistral };

  const analyze = useCallback(async () => {
    if (!text.trim()) return;
    setResults({});
    setRunning(true);

    const lang = LANGUAGES.find(l => l.code === language)?.label || "English";
    const userText = `Language being evaluated: ${lang}\n\n${text}`;

    const tasks = MODELS.flatMap(m => [
      { key: `${m.id}_j8`, modelId: m.id, prompt: PROMPT_JUDGE8 },
      { key: `${m.id}_j9`, modelId: m.id, prompt: PROMPT_JUDGE9 },
    ]);

    const initLoading = {};
    tasks.forEach(t => { initLoading[t.key] = true; });
    setLoadingMap(initLoading);

    await Promise.all(tasks.map(async ({ key, modelId, prompt }) => {
      try {
        const raw = await callers[modelId](prompt, userText);
        const scores = parseScores(raw);
        if (!scores) throw new Error("Could not parse scores");
        setResults(prev => ({ ...prev, [key]: { data: scores } }));
      } catch (e) {
        setResults(prev => ({ ...prev, [key]: { error: e.message } }));
      } finally {
        setLoadingMap(prev => ({ ...prev, [key]: false }));
      }
    }));

    setRunning(false);
  }, [text, language]);

  const allScores = Object.values(results).filter(r => r.data?.final != null).map(r => r.data.final);
  const avg = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2) : null;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "2rem 1rem", fontFamily: "sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px", color: "#111827" }}>
          Bitrix24 Localization Checker
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          ChatGPT · Gemini · Mistral — Судья 8 + Судья 9 — 6 оценок параллельно
        </p>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" }}>Language of translation:</label>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            style={{ fontSize: 14, padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", color: "#111827", cursor: "pointer" }}
          >
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        <label style={{ fontSize: 13, color: "#6b7280", display: "block", marginBottom: 8 }}>
          Translated article text
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste the localized Bitrix24 article text here..."
          rows={8}
          style={{
            width: "100%", fontSize: 14, lineHeight: 1.6, boxSizing: "border-box",
            resize: "vertical", padding: "8px 10px", border: "1px solid #e5e7eb",
            borderRadius: 8, fontFamily: "sans-serif", color: "#111827"
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: 12, gap: 16 }}>
          {avg && (
            <span style={{ fontSize: 14, color: "#6b7280" }}>
              Avg: <strong style={{ fontSize: 20, color: "#111827" }}>{avg}</strong>/5
            </span>
          )}
          <button
            onClick={analyze}
            disabled={running || !text.trim()}
            style={{
              padding: "9px 26px", fontSize: 14, fontWeight: 600, borderRadius: 8,
              cursor: running || !text.trim() ? "not-allowed" : "pointer",
              opacity: running || !text.trim() ? 0.45 : 1,
              background: "#111827", color: "#fff", border: "none", transition: "opacity 0.2s"
            }}
          >
            {running ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </div>

      {(Object.keys(results).length > 0 || running) && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
            {MODELS.map(m => (
              <div key={m.id} style={{ textAlign: "center", fontSize: 13, fontWeight: 600, padding: "5px 0", borderRadius: 8, background: m.bg, color: m.textColor }}>
                {m.label}
              </div>
            ))}
          </div>

          {[{ key: "j8", label: "Судья 8" }, { key: "j9", label: "Судья 9" }].map(({ key, label }) => (
            <div key={key}>
              <div style={{ fontSize: 11, color: "#6b7280", margin: "12px 0 8px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {label}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
                {MODELS.map(m => {
                  const rkey = `${m.id}_${key}`;
                  const r = results[rkey];
                  return (
                    <ResultCard
                      key={rkey}
                      model={m}
                      judgeLabel={label}
                      result={r?.data}
                      loading={!!loadingMap[rkey]}
                      error={r?.error}
                    />
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
