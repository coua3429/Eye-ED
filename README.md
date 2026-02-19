# Eye Emergency DST (static web app)

## What this is
A lightweight, static launcher + decision-tree wizard for eye emergency algorithms.
It stores favourites, recents, and ticked red flags locally on the device.

## Run locally
From this folder:
- `python3 -m http.server 8000`
Then open: http://localhost:8000

## Deploy (GitHub Pages)
1. Create a new GitHub repo.
2. Upload *all* files in this folder to the repo root.
3. In GitHub: Settings → Pages → Deploy from branch → `main` / root.
4. Visit your Pages URL.

## Deploy (Cloudflare Pages)
- Framework preset: None
- Build command: (blank)
- Output directory: `/`

## Algorithms
- `data/index.json` controls launcher order/titles and file paths.
- `data/algorithms/*.json` are the algorithm files.
- Placeholder JSONs exist for the algorithms you haven’t built yet (search for "TODO").

## Disclaimer
Reference aid only. Not a substitute for local guidance, senior input, or clinical judgement.
