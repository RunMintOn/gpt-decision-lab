# GPT Decision Lab

A dependency-free static website that combines two interactive tools:

1. **Model & reasoning-effort selector** — compares ability, benchmark cost, output tokens, and latency across GPT model/effort configurations.
2. **Context & cache cost simulator** — models per-request and cumulative API-equivalent cost under ideal prefix reuse and fixed full-cache rebuild disasters.

## Run locally

Open `index.html` directly, or run a small static server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Deploy

The folder is fully static. Upload the folder to GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any ordinary web server.

- Build command: none
- Output directory: repository root
- Entry file: `index.html`

## Main files

- `index.html`, `app.js`, `styles.css`, `data.js`, `i18n.js` — model selector
- `context-cost.html`, `context-cost.js`, `context-cost.css`, `context-i18n.js` — context/cache simulator
- `site.css` — shared navigation and site shell
- `data/` — corrected benchmark JSON/CSV and source manifest

## Data notes

The model selector reconstructs Cost, Output Tokens, and Latency from supplied official benchmark SVG geometry. The context simulator uses current GPT-5.6 API price tables embedded in `context-cost.js`; verify prices before long-lived public deployment.
