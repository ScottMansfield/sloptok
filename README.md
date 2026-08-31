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

Prefetch 2 clips ahead while the pool is filling. If T2V is not ready, serve fallback.

### Cached clip pool

The feed is infinite to the user. The clip library grows over time: refill adds, nothing is deleted. SLOP_POOL_SIZE is the first-fill target (default 20), not a max.

- First session fills slots 0..(targetFill-1) with the existing prefetch of 2.
- While filling (slots.size < targetFill), wrap is feedIndex % targetFill so prefetch does not mint slot 20+.
- After the library has at least targetFill clips, wrap is feedIndex % slots.size, so a 21st clip enters rotation.
- Pool state is persisted in data/clips/manifest.json (committed) so a server restart does not regenerate ready clips.
- Generated mp4s and Ken Burns jpg/mp4 fallbacks are stored under data/clips/ and tracked in git so playback does not depend on CDN expiry.
- An empty example lives at data/clips/manifest.example.json.
- Occasional refill: at most one new generation at a time, appending a new slot. Old clips stay forever.
- Interval SLOP_REFRESH_MS defaults to 1800000 (30 minutes) while the feed is being used, and only after the first fill is complete.

- Force one append via the pool refresh route or the refill script.
- Fallback is used while a slot is still cooking, and remains playable if generation fails.
- Recycled views of an already-ready slot do not kick fallback or generation again.

Cost: SLOP_POOL_SIZE is the first-fill target (about 6 USD for 20 H3), then pennies per appended clip.

Each serialized clip has feedIndex (the unbounded scroll position), slot (stable library index), and id unique per slot so the client can swipe forever without duplicate React keys.

### How to run

Need Node 20+ and ffmpeg on PATH. Copy .env.example to .env and fill the placeholder. Then install, test, and start:
Install JS deps, run the unit tests, then start the Next dev server on port 3000. The slop script submits one default H3 queue job and prints the mp4 URL; pass --ltx for the garnish model.

Toggle H3 / LTX on the chrome column for the 1080 garnish on newly created clips. Fallback plays while H3 cooks; the clip upgrades when the queue job completes.

### Tests

Unit tests cover the queue client and the prefetch/fallback/pool state machine with a fake provider. No network.
After 20 slots are filled, a high feed index does not start more generation; index 20 serves slot 0; refresh appends one clip without deleting old ones.

### Source map

- lib/feed-machine.js -- pool + wrap-around feed + prefetch + fallback + upgrade + refresh
- lib/fal-queue.js -- queue submit / status / result / poll
- lib/kenburns.js -- ffmpeg zoompan args (768x1344, 6s, 25fps)
- lib/models.js -- H3 default, LTX garnish, Flux fallback
- lib/prompts.js -- gas-station conspiracies and fake unboxings
- lib/store.js -- live machine, manifest persist, local video download
- app/api -- tiny server in front of the provider; pool refresh route
- app/Feed.js -- vertical player, keyed by feedIndex
- scripts/slop.js -- smoke submit
- scripts/refill.js -- force-append one clip on the running server
