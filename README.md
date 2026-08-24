# GPT Decision Lab

A dependency-free static website that combines two interactive tools:

1. **Model & reasoning-effort selector** — compares ability, benchmark cost, output tokens, and latency across GPT model/effort configurations.
2. **Context economics** — models per-request and cumulative API-equivalent cost under ideal prefix reuse and fixed full-cache rebuild disasters, and now includes a **Continue vs Compact / Restart** decision module.

## Context-economics model

The baseline cache regime is called **ideal prefix reuse**, not “100% cache hit”: unchanged history remains reusable, new material is uncached, and no catastrophic full-prefix miss occurs.

The Continue-vs-Restart module treats the number of future model calls as a first-class variable. It compares:

- continuing with the current prompt;
- paying a one-time restore/rebuild cost and resuming from a smaller working-set baseline;
- optional restart friction represented as equivalent extra model calls.

The site includes an observed pure-autonomous-development preset derived from a real post-compaction workflow: approximately 45K prompt tokens at call 58, approximately 137.7K at call 129, no user intervention during the segment, and about 1.31K net prompt growth per model-call interval between the observed endpoints.

See `docs/real-world-workload-traces.md` for the source notes and modeling terminology.

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
- `continue-restart.js`, `continue-restart.css` — Continue vs Compact / Restart economics module
- `site.css` — shared navigation and site shell
- `data/` — corrected benchmark JSON/CSV and source manifest
- `docs/real-world-workload-traces.md` — real workload calibration notes

## Data notes

The model selector reconstructs Cost, Output Tokens, and Latency from supplied official benchmark SVG geometry. Both tools include a site-wide **price version** switch (default: after the 2026-07-30 price change, which cut GPT-5.6 Luna −80% and Terra −20%; Sol unchanged) with a legacy option for the pre-adjustment rates. The switch is remembered in the browser (`gpdl:price`). Verify the embedded tables before long-lived public deployment.
