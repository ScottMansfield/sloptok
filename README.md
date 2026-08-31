# SlopTok

A joke TikTok-shaped feed of AI-generated video slop, personalized and generated on the fly.

This repo is the app. Visuals should feel like a vertical short-video feed without copying TikTok chrome.

## v0 dumpster-glam slot machine

Wordmark SLOPTOK. Vertical swipe (wheel, keys, pull-lever). Not a TikTok clone: no For You / Following tabs, no spinning music disc, no copied chrome. Cabinet + marquee + lottery ticket instead.

### Architecture

The fal credential lives in the server env only (`FAL_KEY`). The browser never sees it. A tiny Next.js App Router server sits in front of fal and uses the queue API:

- POST https://queue.fal.run/{model} with Authorization: Key $FAL_KEY
- poll .../requests/{id}/status
- GET .../requests/{id} for the result

No blocking subscribe on the request path. Scroll never waits on text-to-video.

Default generator: `minimax/h3/text-to-video` (duration 5, resolution 768P, aspect_ratio 9:16, prompt_expansion_mode fast). Measured about 9s.

Optional garnish: `fal-ai/ltx-2.3/text-to-video/fast` (duration 6, resolution 1080p, aspect_ratio 9:16, fps 25, generate_audio true). Measured about 32s.

Fallback: `fal-ai/flux/schnell` still at 768x1344 plus ffmpeg Ken Burns zoompan to a 6s 9:16 mp4.

Prefetch 2 clips ahead. If T2V is not ready, serve fallback.

### How to run

Need Node 20+ and ffmpeg on PATH.

1. Copy `.env.example` to `.env` and set `FAL_KEY=`
2. `npm install`
3. `npm test`
4. `npm run slop` — submits one default H3 queue job and prints the mp4 URL
5. `npm run slop:ltx` — same for LTX Fast garnish
6. `npm run dev` — open http://localhost:3000

Toggle H3 / LTX on the chrome column for the 1080 garnish on newly created clips. Fallback plays while H3 cooks; the clip upgrades when the queue job completes.

### Tests

`npm test` covers the queue submit/poll client and the prefetch/fallback state machine with a fake fal. No network.

### Source map

- lib/feed-machine.js — prefetch + fallback + upgrade state machine
- lib/fal-queue.js — queue submit / status / result / poll
- lib/kenburns.js — ffmpeg zoompan args (768x1344, 6s, 25fps)
- lib/models.js — H3 default, LTX garnish, Flux fallback
- lib/prompts.js — gas-station conspiracies and fake unboxings
- app/api — tiny server in front of fal
- app/Feed.js — vertical player
- scripts/slop.js — smoke submit
