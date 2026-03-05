import express from 'express';
import { config } from 'dotenv';

config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const VT_BASE = 'https://www.virustotal.com/api/v3';
const API_KEY = process.env.VT_API_KEY;

if (!API_KEY) {
  console.error('ERROR: VT_API_KEY is not set in .env');
  process.exit(1);
}

// POST /api/urls — submit a URL for scanning
app.post('/api/urls', async (req, res) => {
  try {
    const body = new URLSearchParams();
    body.append('url', req.body.url);
    const r = await fetch(`${VT_BASE}/urls`, {
      method: 'POST',
      headers: { 'x-apikey': API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

// GET /api/analyses/:id — poll analysis result
app.get('/api/analyses/:id', async (req, res) => {
  try {
    const r = await fetch(`${VT_BASE}/analyses/${req.params.id}`, {
      headers: { 'x-apikey': API_KEY },
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LinkGuard API server running on :${PORT}`));
