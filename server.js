import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const SHEET_ID = '1QQPZUBKFX3tMf0NXGyfF3zsvvX5HpcZfIbBSRiBQH_4';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

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
    console.log('OPENAI FULL:', JSON.stringify(data).slice(0, 500));
    if (!response.ok) console.log('OPENAI ERROR:', JSON.stringify(data.error));
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
        generationConfig: { maxOutputTokens: 4000, temperature: 0.2 }
      })
    });
    const data = await response.json();
    if (data.error) console.log('GEMINI API ERROR:', JSON.stringify(data.error));
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
    console.log('MISTRAL RAW:', data.choices?.[0]?.message?.content?.slice(0, 200));
    if (!response.ok) console.log('MISTRAL ERROR:', JSON.stringify(data.error));
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sheets', async (req, res) => {
  try {
    const { articleName, scores } = req.body;
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const row = [
      articleName,
      '',
      scores.chatgpt_j8 ?? '',
      scores.chatgpt_j9 ?? '',
      scores.mistral_j8 ?? '',
      scores.mistral_j9 ?? '',
      scores.gemini_j8 ?? '',
      scores.gemini_j9 ?? '',
    ];

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Лист1!A:A',
    });
    const rows = getRes.data.values || [];
    const nextRow = rows.length + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Лист1!A${nextRow}:H${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    res.json({ success: true });
  } catch (e) {
    console.log('SHEETS ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')));

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
