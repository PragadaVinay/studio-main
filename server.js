require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SAMBANOVA_API_KEY = process.env.SAMBANOVA_API_KEY;
const SAMBANOVA_MODEL = process.env.SAMBANOVA_MODEL || 'Meta-Llama-3.1-8B-Instruct';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const fallbackOptions = (from, to) => ({
  route: { from, to, currency: 'INR', year: 2026 },
  modes: [
    {
      mode: 'flight',
      categories: [
        {
          name: 'Budget',
          description: 'Basic seat-only fares on low-cost carriers with limited baggage.',
          priceRangeINR: '₹3,200 - ₹7,500',
          providers: ['IndiGo', 'Akasa Air', 'SpiceJet']
        },
        {
          name: 'Standard',
          description: 'Balanced fare with cabin baggage and improved timings.',
          priceRangeINR: '₹7,500 - ₹14,500',
          providers: ['Air India', 'Vistara', 'IndiGo']
        },
        {
          name: 'Premium',
          description: 'Flexible tickets, premium seats, and lounge access on select routes.',
          priceRangeINR: '₹14,500 - ₹34,000',
          providers: ['Air India', 'Vistara', 'Emirates (domestic connections)']
        }
      ]
    },
    {
      mode: 'train',
      categories: [
        {
          name: 'Budget',
          description: 'Sleeper or 2S seating for economical intercity travel.',
          priceRangeINR: '₹220 - ₹950',
          providers: ['Indian Railways', 'IRCTC']
        },
        {
          name: 'Standard',
          description: '3AC / Chair Car options with better comfort and reliability.',
          priceRangeINR: '₹850 - ₹2,400',
          providers: ['Indian Railways', 'Vande Bharat services']
        },
        {
          name: 'Premium',
          description: 'Executive Chair Car / 1AC with top comfort and faster routes.',
          priceRangeINR: '₹2,300 - ₹6,800',
          providers: ['Vande Bharat', 'Rajdhani', 'Tejas Express']
        }
      ]
    },
    {
      mode: 'bus',
      categories: [
        {
          name: 'Budget',
          description: 'State transport and non-AC private buses.',
          priceRangeINR: '₹180 - ₹850',
          providers: ['KSRTC', 'UPSRTC', 'State RTCs']
        },
        {
          name: 'Standard',
          description: 'AC seater/sleeper with regular rest stops and app booking.',
          priceRangeINR: '₹700 - ₹1,900',
          providers: ['RedBus partners', 'IntrCity SmartBus', 'SRS Travels']
        },
        {
          name: 'Premium',
          description: 'Premium sleeper/coaches with wider seats, tracking and amenities.',
          priceRangeINR: '₹1,800 - ₹4,600',
          providers: ['Orange Travels', 'VRL Travels', 'Zingbus']
        }
      ]
    }
  ]
});

function parseAITransport(rawText, from, to) {
  try {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found');
    const parsed = JSON.parse(rawText.slice(start, end + 1));
    if (!parsed.modes || !Array.isArray(parsed.modes)) throw new Error('Invalid schema');
    return parsed;
  } catch {
    return fallbackOptions(from, to);
  }
}

app.post('/api/transport-options', async (req, res) => {
  const { from, to } = req.body || {};
  if (!from || !to) {
    return res.status(400).json({ error: 'Both from and to fields are required.' });
  }

  if (!SAMBANOVA_API_KEY) {
    return res.json({ source: 'fallback', data: fallbackOptions(from, to) });
  }

  const prompt = `You are a travel intelligence system for India route planning. Return ONLY minified JSON with schema:
{"route":{"from":"string","to":"string","currency":"INR","year":2026},"modes":[{"mode":"flight|train|bus","categories":[{"name":"Budget|Standard|Premium","description":"string","priceRangeINR":"₹x - ₹y","providers":["string"]}]}],"suggestions":[{"name":"string","reason":"string"}]}
Generate realistic 2026+ pricing in Indian Rupees for route ${from} to ${to}. Always include flight, train, bus with 2-3 categories each and 2-4 provider examples each. Keep concise.`;

  try {
    const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SAMBANOVA_API_KEY}`
      },
      body: JSON.stringify({
        model: SAMBANOVA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 900
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: 'SambaNova request failed', details: text, data: fallbackOptions(from, to) });
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content || '';
    const parsed = parseAITransport(content, from, to);
    res.json({ source: 'sambanova', data: parsed });
  } catch (error) {
    res.status(500).json({
      error: 'Unable to fetch transport options from SambaNova',
      details: error.message,
      data: fallbackOptions(from, to)
    });
  }
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
