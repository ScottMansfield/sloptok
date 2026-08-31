# SlopTok

A joke TikTok-shaped feed of AI-generated video slop, personalized and generated on the fly.

This repo is the app. Visuals should feel like a vertical short-video feed without copying TikTok chrome.

## v0 dumpster-glam slot machine

Wordmark SLOPTOK. Vertical swipe (wheel, keys, pull-lever). Not a TikTok clone: no For You / Following tabs, no spinning music disc, no copied chrome. Cabinet + marquee + lottery ticket instead.

### Architecture

The fal credential lives in the server env only. The browser never sees it. A tiny Next.js App Router server sits in front of fal and uses the queue API (submit, poll status, fetch result). No blocking subscribe on the request path. Scroll never waits on text-to-video.

Default generator: minimax/h3/text-to-video, duration 5, resolution 768P, aspect_ratio 9:16, prompt_expansion_mode fast. Measured about 9s.

Optional garnish: fal-ai/ltx-2.3/text-to-video/fast, duration 6, resolution 1080p, aspect_ratio 9:16, fps 25, generate_audio true. Measured about 32s.

Fallback: fal-ai/flux/schnell still at 768x1344 plus ffmpeg Ken Burns zoompan to a 6s 9:16 mp4.

Prefetch 2 clips ahead. If T2V is not ready, serve fallback.

### Cached clip pool

A pool of 20 clips (`SLOP_POOL_SIZE`) wraps the infinite feed. Fill it once (~20 H3 jobs, about $6), then scrolling is free. While someone is watching, at most one new clip generates every `SLOP_REFRESH_MS` (default 30 minutes), replacing the oldest slot. Force a replacement with `npm run refill` (dev server must be up) or `POST /api/pool/refresh`. Manifest and mp4s live in `data/clips` and are gitignored.

### How to run

Need Node 20+ and ffmpeg on PATH. Copy `.env.example` to `.env` and set `FAL_KEY`. Then:

```
npm install
npm test
npm run dev
```

`npm run slop` submits one H3 job and prints the mp4 URL. `npm run slop:ltx` is the garnish model. `npm run refill` replaces one pool slot.

### Tests

npm test covers the queue client, prefetch/fallback machine, and the 20-clip pool with a fake fal. No network.
