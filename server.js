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
      body: JSON.stringify({ ...req.body, seed: 42, max_completion_tokens: req.body.max_tokens, max_tokens: undefined, temperature: undefined })
    });
    const data = await response.json();
    console.log('OPENAI FULL:', JSON.stringify(data).slice(0, 500));
    if (!response.ok) console.log('OPENAI ERROR:', JSON.stringify(data.error));
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/claude', async (req, res) => {
  const { prompt, text } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log('CLAUDE KEY:', apiKey ? `present (${apiKey.slice(0, 10)}...)` : 'MISSING');
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: `${prompt}\n\n${text}` }]
        })
      });
      console.log('CLAUDE STATUS:', response.status);
      const data = await response.json();
      if (!response.ok) {
        const isOverloaded = response.status === 529 || data?.error?.type === 'overloaded_error';
        const isRateLimit  = response.status === 429;
        if ((isOverloaded || isRateLimit) && attempt < maxAttempts) {
          const wait = 15000 * attempt;
          console.log(`CLAUDE overloaded, retry ${attempt}/${maxAttempts - 1} in ${wait / 1000}s`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        console.error('CLAUDE ERROR RESPONSE:', JSON.stringify(data));
        res.status(response.status).json({ error: data });
        return;
      }
      console.log('CLAUDE RAW', JSON.stringify(data));
      const result = data.content?.[0]?.text ?? '';
      res.json({ result });
      return;
    } catch (e) {
      console.error('CLAUDE EXCEPTION', e);
      res.status(500).json({ error: e.message });
      return;
    }
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

    // ARCHIVED: Judge8 — chatgpt_j8, mistral_j8, claude_j8 removed from row
    const row = [
      articleName,
      '',
      scores.chatgpt_j9 ?? '',
      scores.mistral_j9 ?? '',
      scores.claude_j9 ?? '',
    ];

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Автотест!A:A',
    });
    const rows = getRes.data.values || [];
    const nextRow = rows.length + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Автотест!A${nextRow}:E${nextRow}`,
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
