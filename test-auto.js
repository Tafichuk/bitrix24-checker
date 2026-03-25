import fetch from 'node-fetch';

const ARTICLES = [
  { name: 'Contacts', url: 'https://helpdesk.bitrix24.com/open/25198874/' },
  { name: 'Search document text on Drive', url: 'https://helpdesk.bitrix24.com/open/19003038/' },
  { name: 'New task form', url: 'https://helpdesk.bitrix24.com/open/25844487/' },
  { name: 'Tasks in flows', url: 'https://helpdesk.bitrix24.com/open/25915379/' },
  { name: 'CRM element', url: 'https://helpdesk.bitrix24.com/open/25909195/' },
  { name: 'Restrict access by IP', url: 'https://helpdesk.bitrix24.com/open/19468156/' },
  { name: 'Employee widget', url: 'https://helpdesk.bitrix24.com/open/25821875/' },
  { name: 'August updates', url: 'https://helpdesk.bitrix24.com/open/25916275/' },
  { name: 'TEST PROMPT', url: 'https://helpdesk.bitrix24.com/open/25916403/' },
  { name: 'Change or dismiss admin', url: 'https://helpdesk.bitrix24.com/open/25896015/' },
  { name: 'MCP in Bitrix24 1', url: 'https://helpdesk.bitrix24.com/open/25846367/' },
  { name: 'MCP in Bitrix24 2', url: 'https://helpdesk.bitrix24.com/open/25917975/' },
];

const BASE_URL = 'https://bitrix24-checker-production.up.railway.app';

const PROMPT8 = `Ты — американский нативный редактор help-desk статей (информационный текст, НЕ маркетинг).
Оцени английский текст по двум осям от 1 до 5:
A) нативность/переводность
B) plain language (простота)
Не меняй продуктовые термины.
Дай ТОЛЬКО это (никаких пояснений):
FINAL_SCORE: X/5  (считается как среднее арифметическое от NATIVE_SCORE и PLAIN_SCORE)
NATIVE_SCORE: X/5
PLAIN_SCORE: X/5`;

const PROMPT9 = `Ты — американский нативный редактор help-desk статей (информационный текст, НЕ маркетинг).
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

async function fetchArticleText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const briefMatch = text.match(/In brief(.+?)(?:Was this|$)/i);
  if (briefMatch) return briefMatch[1].trim().slice(0, 3000);
  return text.slice(0, 3000);
}

function parseScore(text) {
  if (!text) return null;
  const clean = text.replace(/\*\*/g, '').replace(/\n+/g, ' ');
  const final = clean.match(/FINAL_SCORE:\s*(\d+(?:\.\d+)?)/i);
  return final ? parseFloat(final[1]) : null;
}

async function callOpenAI(text, prompt) {
  const res = await fetch(`${BASE_URL}/api/openai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.4',
      max_tokens: 200,
      temperature: 0,
      seed: 42,
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: text }]
    })
  });
  const data = await res.json();
  return parseScore(data.choices?.[0]?.message?.content || '');
}

async function callMistral(text, prompt) {
  const res = await fetch(`${BASE_URL}/api/mistral`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral-large-2512',
      max_tokens: 200,
      temperature: 0,
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: text }]
    })
  });
  const data = await res.json();
  return parseScore(data.choices?.[0]?.message?.content || '');
}

async function callClaude(text, prompt) {
  const res = await fetch(`${BASE_URL}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, text })
  });
  const data = await res.json();
  return parseScore(data.result || '');
}

function verdict(scores) {
  const cld8 = scores.cld8 != null ? scores.cld8 + 0.5 : null;
  const cld9 = scores.cld9 != null ? scores.cld9 + 0.5 : null;

  const j8 = [scores.gpt8, scores.mis8, cld8].filter(x => x != null);
  const j9 = [scores.gpt9, scores.mis9, cld9].filter(x => x != null);

  const avg8 = j8.length ? j8.reduce((a, b) => a + b, 0) / j8.length : 0;
  const avg9 = j9.length ? j9.reduce((a, b) => a + b, 0) / j9.length : 0;

  return {
    v8: avg8 >= 4 ? 'PASS' : 'REWRITE',
    v9: avg9 >= 4 ? 'PASS' : 'REWRITE'
  };
}

console.log('\n📊 BITRIX24 AUTO TEST');
console.log('='.repeat(95));
console.log(`${'Article'.padEnd(30)} | GPT8 | GPT9 | MIS8 | MIS9 | CLD8 | CLD9 | Verdict8 | Verdict9`);
console.log('-'.repeat(95));

for (const article of ARTICLES) {
  process.stdout.write(`⏳ ${article.name}...`);
  try {
    const text = await fetchArticleText(article.url);
    const [gpt8, gpt9, mis8, mis9, cld8, cld9] = await Promise.all([
      callOpenAI(text, PROMPT8),
      callOpenAI(text, PROMPT9),
      callMistral(text, PROMPT8),
      callMistral(text, PROMPT9),
      callClaude(text, PROMPT8),
      callClaude(text, PROMPT9),
    ]);
    const scores = { gpt8, gpt9, mis8, mis9, cld8, cld9 };
    const v = verdict(scores);
    process.stdout.write('\r');
    console.log([
      article.name.slice(0, 29).padEnd(30),
      String(gpt8 ?? '-').padStart(4),
      String(gpt9 ?? '-').padStart(4),
      String(mis8 ?? '-').padStart(4),
      String(mis9 ?? '-').padStart(4),
      String(gem8 ?? '-').padStart(4),
      String(gem9 ?? '-').padStart(4),
      v.v8.padEnd(8),
      v.v9
    ].join(' | '));
    await new Promise(r => setTimeout(r, 3000));
  } catch (e) {
    process.stdout.write('\r');
    console.log(`❌ ${article.name}: ${e.message}`);
  }
}

console.log('='.repeat(95));
console.log('✅ Done!');
