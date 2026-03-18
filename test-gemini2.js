const key = process.env.GEMINI_KEY;

const prompt = `Ты — американский нативный редактор help-desk статей (информационный текст, НЕ маркетинг).
Оцени английский текст по двум осям от 1 до 5:
A) нативность/переводность
B) plain language (простота)
Не меняй продуктовые термины.
Дай ТОЛЬКО это (никаких пояснений):
FINAL_SCORE: X/5  (считается как среднее арифметическое от NATIVE_SCORE и PLAIN_SCORE)
NATIVE_SCORE: X/5
PLAIN_SCORE: X/5`;

const text = 'Contacts is CRM items for people. You can group them by types.';

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    system_instruction: { parts: [{ text: prompt }] },
    contents: [{ parts: [{ text }] }],
    generationConfig: { maxOutputTokens: 2000, temperature: 0.1 }
  })
});

const data = await res.json();
const parts = data.candidates?.[0]?.content?.parts || [];
const raw = parts.map(p => p.text || '').join('');
console.log('PARTS COUNT:', parts.length);
console.log('PART TYPES:', parts.map(p => p.thought ? 'thought' : 'text'));
console.log('RAW OUTPUT:', JSON.stringify(raw));
