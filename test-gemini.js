import fetch from 'node-fetch';

const key = 'AIzaSyDKnUCN7d0EObVuM02RPvjtvtyQQHjLtnk';

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    system_instruction: { parts: [{ text: 'Reply only with: FINAL_SCORE: 4/5\nNATIVE_SCORE: 4/5\nPLAIN_SCORE: 4/5' }] },
    contents: [{ parts: [{ text: 'test' }] }],
    generationConfig: { maxOutputTokens: 500, temperature: 0.1 }
  })
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
