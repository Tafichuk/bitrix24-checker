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
  { id: "mistral", label: "Mistral", sublabel: "mistral-large-2411", color: "#FF7000", bg: "#fff0e6", textColor: "#a34500" },
  { id: "gemini", label: "Gemini", sublabel: "gemini-2.5-flash", color: "#4285F4", bg: "#e8f0fe", textColor: "#1a56c4" },
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

  const final = clean.match(/FINAL_SCORE:\s*(\d+(?:\.\d+)?)\s*(?:\/\s*5)?/i);
  const native = clean.match(/NATIVE_SCORE:\s*(\d+(?:\.\d+)?)\s*(?:\/\s*5)?/i);
  const plain = clean.match(/PLAIN_SCORE:\s*(\d+(?:\.\d+)?)\s*(?:\/\s*5)?/i);

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
      model: 'gpt-4o',
      max_tokens: 500,
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
      model: 'mistral-large-2411',
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

function scoreColor(val) {
  if (val == null) return '#9ca3af';
  if (val >= 4) return '#1D9E75';
  if (val >= 3) return '#BA7517';
  return '#E24B4A';
}

function ScoreCell({ model, judgeLabel, result, loading, error }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      minHeight: 90
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: model.bg, color: model.textColor }}>
        {model.label}
      </span>
      {loading && (
        <div style={{ width: 14, height: 14, border: `2px solid #e5e7eb`, borderTopColor: model.color, borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginTop: 8 }} />
      )}
      {error && <div style={{ fontSize: 11, color: '#dc2626', textAlign: 'center' }}>⚠ Error</div>}
      {result && !error && (
        <div style={{ fontSize: 32, fontWeight: 700, color: scoreColor(result.final), lineHeight: 1 }}>
          {result.final}<span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400 }}>/5</span>
        </div>
      )}
      {!loading && !result && !error && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>—</div>
      )}
    </div>
  );
}

function avgOf(vals) {
  const v = vals.filter(x => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  const median = v.length % 2 !== 0 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return Math.round(median * 100) / 100;
}

export default function App() {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('en');
  const [results, setResults] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const callers = { chatgpt: callChatGPT, gemini: callGemini, mistral: callMistral };

  const analyze = useCallback(async () => {
    if (!text.trim()) return;
    setResults({});
    setRunning(true);
    const lang = LANGUAGES.find(l => l.code === language)?.label || 'English';
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
        let scores = parseScores(raw);
        if (!scores) throw new Error('Could not parse scores');
        if (modelId === 'gemini') {
          scores = {
            final: Math.min(5, Math.round((scores.final + 0.5) * 2) / 2),
            native: Math.min(5, Math.round((scores.native + 0.5) * 2) / 2),
            plain: Math.min(5, Math.round((scores.plain + 0.5) * 2) / 2),
          };
        }
        setResults(prev => ({ ...prev, [key]: { data: scores } }));
      } catch (e) {
        setResults(prev => ({ ...prev, [key]: { error: e.message } }));
      } finally {
        setLoadingMap(prev => ({ ...prev, [key]: false }));
      }
    }));
    setRunning(false);
  }, [text, language]);

  const exportToSheets = useCallback(async () => {
    setExporting(true);
    setExportDone(false);
    try {
      const articleName = text.split('\n')[0].trim() || 'Untitled';

      await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleName,
          scores: {
            chatgpt_j8: results['chatgpt_j8']?.data?.final ?? null,
            chatgpt_j9: results['chatgpt_j9']?.data?.final ?? null,
            mistral_j8: results['mistral_j8']?.data?.final ?? null,
            mistral_j9: results['mistral_j9']?.data?.final ?? null,
            gemini_j8: results['gemini_j8']?.data?.final ?? null,
            gemini_j9: results['gemini_j9']?.data?.final ?? null,
          }
        })
      });
      setExportDone(true);
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  }, [text, results]);

  const getScore = (modelId, judge) => results[`${modelId}_${judge}`]?.data?.final;
  const getError = (modelId, judge) => results[`${modelId}_${judge}`]?.error;
  const isLoading = (modelId, judge) => !!loadingMap[`${modelId}_${judge}`];

  const j8scores = MODELS.map(m => getScore(m.id, 'j8')).filter(Boolean);
  const j9scores = MODELS.map(m => getScore(m.id, 'j9')).filter(Boolean);
  const avgJ8 = avgOf(j8scores);
  const avgJ9 = avgOf(j9scores);
  const allScores = [...j8scores, ...j9scores];
  const totalAvg = avgOf(allScores);

  const hasResults = Object.keys(results).length > 0 || running;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px', color: '#111827' }}>Bitrix24 Localization Checker</h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>ChatGPT · Mistral · Gemini — Судья 8 + Судья 9 — 6 оценок параллельно</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>Language:</label>
          <select value={language} onChange={e => setLanguage(e.target.value)}
            style={{ fontSize: 14, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#111827', cursor: 'pointer' }}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste the localized Bitrix24 article text here..."
          rows={7}
          style={{ width: '100%', fontSize: 14, lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontFamily: 'sans-serif', color: '#111827' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={analyze} disabled={running || !text.trim()}
            style={{ padding: '9px 26px', fontSize: 14, fontWeight: 600, borderRadius: 8, cursor: running || !text.trim() ? 'not-allowed' : 'pointer', opacity: running || !text.trim() ? 0.45 : 1, background: '#111827', color: '#fff', border: 'none' }}>
            {running ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {hasResults && (
        <div>
          {totalAvg && (
            <div style={{ background: '#111827', borderRadius: 12, padding: '16px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Overall Average</span>
              <span style={{ fontSize: 36, fontWeight: 700, color: scoreColor(totalAvg) }}>
                {totalAvg}<span style={{ fontSize: 16, color: '#9ca3af', fontWeight: 400 }}>/5</span>
              </span>
            </div>
          )}

          {Object.keys(results).length === 6 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button
                onClick={exportToSheets}
                disabled={exporting}
                style={{
                  padding: '10px 24px', fontSize: 14, fontWeight: 600, borderRadius: 8,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  opacity: exporting ? 0.6 : 1,
                  background: exportDone ? '#1D9E75' : '#4285F4',
                  color: '#fff', border: 'none', transition: 'background 0.3s'
                }}>
                {exporting ? 'Exporting...' : exportDone ? '✓ Exported to Sheets' : 'Export to Google Sheets'}
              </button>
            </div>
          )}

          {[
            { key: 'j8', label: 'Судья 8', avg: avgJ8 },
            { key: 'j9', label: 'Судья 9', avg: avgJ9 }
          ].map(({ key, label, avg }) => (
            <div key={key} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
                {avg != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>avg</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: scoreColor(avg) }}>
                      {avg}<span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>/5</span>
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {MODELS.map(m => (
                  <ScoreCell
                    key={m.id}
                    model={m}
                    judgeLabel={label}
                    result={results[`${m.id}_${key}`]?.data}
                    loading={isLoading(m.id, key)}
                    error={getError(m.id, key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
