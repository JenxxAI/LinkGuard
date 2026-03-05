import express from 'express';
import { config } from 'dotenv';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

config();

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');

// CORS — only allow requests from the local Vite frontend (or FRONTEND_ORIGIN in prod)
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin }));

// Rate limit — max 10 scan requests per minute per IP to protect the daily quota
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, slow down.' } },
});
app.use('/api', limiter);

app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.json({ limit: '256kb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'interest-cohort=()');
  next();
});

const VT_BASE = 'https://www.virustotal.com/api/v3';
const API_KEY = process.env.VT_API_KEY;

if (!API_KEY) {
  console.error('ERROR: VT_API_KEY is not set in .env');
  process.exit(1);
}

// POST /api/urls — submit a URL for scanning
app.post('/api/urls', async (req, res) => {
  const url = req.body?.url?.trim();
  if (!url) return res.status(400).json({ error: { message: 'Missing url field.' } });
  try {
    const body = new URLSearchParams();
    body.append('url', url);
    const r = await fetch(`${VT_BASE}/urls`, {
      method: 'POST',
      headers: { 'x-apikey': API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = r.status === 429
        ? 'Scan limit reached — our analysis engine allows a limited number of requests per day. Please try again later.'
        : `Analysis service returned an error (HTTP ${r.status}).`;
      return res.status(r.status).json({ error: { message: msg } });
    }
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

// GET /api/analyses/:id — poll analysis result
app.get('/api/analyses/:id', async (req, res) => {
  // Validate: VT analysis IDs are base64url strings, typically ~40–80 chars
  if (!/^[A-Za-z0-9_=-]{8,128}$/.test(req.params.id)) {
    return res.status(400).json({ error: { message: 'Invalid analysis ID.' } });
  }
  try {
    const r = await fetch(`${VT_BASE}/analyses/${req.params.id}`, {
      headers: { 'x-apikey': API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

// GET /api/expand?url=... — follow redirects to reveal where short URLs lead
// SSRF protection: only allow http/https to public addresses
const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1|localhost)/i;
app.get('/api/expand', async (req, res) => {
  const url = req.query.url?.trim();
  if (!url) return res.status(400).json({ error: 'Missing url' });
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http/https URLs are supported.' });
  }
  if (PRIVATE_IP_RE.test(parsed.hostname)) {
    return res.status(400).json({ error: 'Private/internal addresses are not allowed.' });
  }
  try {
    const r = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'LinkGuard/1.0' },
    });
    // Guard against redirects that land on private/internal addresses
    try {
      const finalHostname = new URL(r.url).hostname;
      if (PRIVATE_IP_RE.test(finalHostname)) return res.json({ resolved: url });
    } catch {}
    res.json({ resolved: r.url });
  } catch {
    res.json({ resolved: url });
  }
});

// ── Share result cache (in-memory, 1-hour TTL) ────────────────────────
const shareCache = new Map();
const SHARE_TTL = 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of shareCache) {
    if (now - val.ts > SHARE_TTL) shareCache.delete(key);
  }
}, 10 * 60 * 1000).unref();

// POST /api/share — store scan result, return short key (no quota cost on retrieval)
const SHARE_MAX_BYTES = 128 * 1024; // 128 KB cap per entry
app.post('/api/share', (req, res) => {
  const { result, url } = req.body || {};
  if (!result || !url || typeof url !== 'string' || url.length > 2048) {
    return res.status(400).json({ error: 'Invalid payload.' });
  }
  // Guard against oversized result objects
  let size = 0;
  try { size = JSON.stringify(result).length; } catch { return res.status(400).json({ error: 'Invalid payload.' }); }
  if (size > SHARE_MAX_BYTES) return res.status(413).json({ error: 'Result too large to share.' });
  if (shareCache.size >= 500) return res.status(503).json({ error: 'Cache full.' });
  const key = Math.random().toString(36).slice(2, 10);
  shareCache.set(key, { result, url, ts: Date.now() });
  res.json({ key });
});

// GET /api/share/:key — retrieve cached result (no quota cost)
app.get('/api/share/:key', (req, res) => {
  const entry = shareCache.get(req.params.key);
  if (!entry || Date.now() - entry.ts > SHARE_TTL) {
    return res.status(404).json({ error: 'Not found or expired.' });
  }
  res.json({ result: entry.result, url: entry.url });
});

// ── Serve the built frontend (production) ────────────────────────────
// In dev the Vite dev server handles the frontend; in production we serve
// the pre-built dist/ folder from this same Express process.
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  // SPA fallback — let React Router (if ever added) or index.html handle the route
  app.get('*', (_req, res) => res.sendFile(join(DIST, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LinkGuard API server running on :${PORT}`));
