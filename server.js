import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

app.post('/api/openai', async (req, res) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_KEY}` },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, text } = req.body;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: prompt }] },
        contents: [{ parts: [{ text: text }] }],
        generationConfig: { maxOutputTokens: 2000, temperature: 0 }
      })
    });
    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const raw = parts.map(p => p.text || '').join('');
    console.log('GEMINI RAW:', JSON.stringify(raw));
    res.json({ text: raw });
  } catch (e) {
    console.log('GEMINI EXCEPTION:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/mistral', async (req, res) => {
  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.MISTRAL_KEY}` },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('*', (req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')));

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
