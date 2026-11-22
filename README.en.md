# Image Workbench

A browser-only AI image workbench for text-to-image, image-to-image, batch generation, prompt templates, and manga storyboards. Images, history, settings, and API keys stay in local IndexedDB; bring your own OpenAI-compatible key (BYOK).

Local demo: run `npm run dev` and open `http://localhost:5173/?demo=1`. After GitHub Pages is enabled, the same demo is available at `https://mxy2316868975javascript.github.io/workbench-image/?demo=1`.

[中文](README.md) · [Quick start](#quick-start) · [Third-party notices](THIRD_PARTY_NOTICES.md)

> Independent open-source project. Not affiliated with or endorsed by OpenAI.

## Features

- Streaming generation over the OpenAI-compatible image API, with SSE parsing and a progress estimator.
- Batch generation (1–10 images) with configurable concurrency and cancellation/retry.
- Image-to-image via `/images/edits` with up to 4 reference images.
- Local history grouped by task, batch delete, prompt reuse, and a zoomable lightbox.
- Draft autosave and submit preflight (endpoint, key, model, reference images, storage).
- Built-in prompt templates and runtime-loaded style libraries; see the notices for sources and licenses.
- Manga workspace: character sheets, AI script, storyboard, per-panel generation.
- Backup/restore of tasks, images, custom templates, manga projects, and settings (API keys excluded).
- Dark/light themes, collapsible sidebars, narrow-screen layout.

## Quick start

Requires Node.js >= 20.19 (22 LTS recommended).

```bash
npm ci
cp .env.example .env.local   # optional: endpoint/model; do not put real keys here
npm run dev                  # http://localhost:5173
```

Open `?demo=1` for a read-only demo with sample images; it never calls a real endpoint. The GitHub Pages URL becomes available after Pages is enabled and the workflow runs.

## Configuration

- `VITE_DEFAULT_BASE_URL`, `VITE_DEFAULT_MODEL`, `VITE_TEXT_BASE_URL`, `VITE_TEXT_MODEL`: defaults for the generation and manga text endpoints.
- `VITE_DEFAULT_API_KEY`, `VITE_TEXT_API_KEY`: **development only**. `VITE_*` values are inlined into the frontend bundle, so production builds fail if a secret-like `VITE_*` is non-empty. Put real keys in the in-app Settings panel instead.
- `RELAY_TARGET`: upstream for the local HTTP/2 image relay used by dev/preview. The relay only accepts loopback requests and never stores data.
- `RELAY_TARGET_TEXT`: optional second upstream for the text relay (`/api/relay-text`). Use it when the image and manga text endpoints are different; both upstreams must support HTTP/2.

## Data & privacy

No account, backend database, or telemetry. Prompts and reference images are sent only to the model endpoint you configure. Some template libraries fetch text from GitHub Raw / jsDelivr on first use; they do not upload your prompts or images. API keys are stored unencrypted in IndexedDB; use scoped, revocable keys.

## Development

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

## Keywords

AI image generation, text-to-image, image-to-image, gpt-image, prompt templates, prompt engineering, local-first, privacy-first, browser-only, bring your own key (BYOK), IndexedDB, manga; AI 生图, 文生图, 图生图, 提示词模板, 本地优先, 数据隐私.

## License

[MIT](LICENSE) © 2026 Lemon. Third-party content is covered by [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), not the MIT license.
