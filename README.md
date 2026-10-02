# LinkGuard

URL safety scanner powered by 70+ threat-intelligence engines. Paste any link before clicking it — LinkGuard checks for malware, phishing, scams, and suspicious redirects in seconds.

## Stack
- **Frontend** — React 18 + Vite 6, no UI library, mobile-first
- **Backend** — Express 4 proxy (keeps API key server-side)

## Setup

```bash
cp .env.example .env          # add your API key
npm install
npm run dev                   # starts both Vite (5173) and Express (3001)
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VT_API_KEY` | Yes | Threat intelligence API key |
| `GOOGLE_WEBRISK_API_KEY` | No | Optional fallback when VirusTotal is rate-limited or temporarily unavailable |
| `FRONTEND_ORIGIN` | Prod only | Your deployed frontend URL (sets CORS) |

## Features
- Single & bulk URL scanning
- QR code scanning (BarcodeDetector API)
- Short URL expander
- Scan history (localStorage)
- Result caching (24h localStorage)
- Shareable result links (server-side 1hr cache)
- Export JSON report
- Animated risk gauge, tab badges, card border tints
- Dark / light theme (OS default auto-detected)
- iOS PWA-ready (safe-area insets, home screen installable)

## Render keep-awake check

The repository includes a GitHub Actions workflow that calls the lightweight `/api/health` endpoint every 14 minutes. This helps prevent the Render free web service from sleeping without calling VirusTotal, Google Web Risk, or any scan endpoint. GitHub Actions schedules can be delayed, so the first request after a longer idle period may still take a little longer while Render wakes up.

## Security notes
- API key is never exposed to the frontend
- Optional Google Web Risk fallback handles VirusTotal quota or temporary outages
- SSRF protection on `/api/expand` (blocks private IPs, non-http(s) schemes)
- Rate limited: 10 req/min per IP
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- Body size limits enforced on all endpoints
