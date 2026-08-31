"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CACHE = new Map();

function feedKey(clip, fallback) {
  if (clip && (clip.feedIndex != null || clip.index != null)) {
    return clip.feedIndex ?? clip.index;
  }
  return fallback;
}

async function loadWindow(index, garnish) {
  const res = await fetch(`/api/feed?index=${index}&garnish=${garnish}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("feed failed");
  const data = await res.json();
  for (const clip of data.clips) {
    const fi = clip.feedIndex ?? clip.index;
    CACHE.set(fi, { ...clip, feedIndex: fi, index: fi });
  }
  return data;
}

function mergeClip(next) {
  for (const [k, prev] of CACHE) {
    if (prev.id === next.id) {
      const fi = prev.feedIndex ?? prev.index ?? k;
      CACHE.set(k, { ...next, feedIndex: fi, index: fi, slot: next.slot ?? prev.slot });
    }
  }
  return next;
}

export default function Feed() {
  const [index, setIndex] = useState(0);
  const [clips, setClips] = useState([]);
  const [garnish, setGarnish] = useState("h3");
  const [muted, setMuted] = useState(true);
  const [booted, setBooted] = useState(false);
  const scroller = useRef(null);
  const lock = useRef(false);

  const snapshot = useCallback(() => {
    const max = Math.max(index + 2, ...CACHE.keys(), 2);
    const list = [];
    for (let i = 0; i <= max; i++) {
      if (CACHE.has(i)) list.push(CACHE.get(i));
    }
    setClips(list);
  }, [index]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadWindow(0, garnish);
        if (!cancelled) {
          snapshot();
          setBooted(true);
        }
      } catch {
        if (!cancelled) setBooted(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [garnish, snapshot]);

  useEffect(() => {
    loadWindow(index, garnish).then(() => snapshot()).catch(() => {});
  }, [index, garnish, snapshot]);

  useEffect(() => {
    const current = CACHE.get(index);
    if (!current?.upgrading) return undefined;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/clip/${current.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = await res.json();
        mergeClip(next);
        snapshot();
      } catch {
        /* ignore poll errors */
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [index, clips, snapshot]);

  const go = useCallback(
    (next) => {
      const n = Math.max(0, next);
      setIndex(n);
      const node = scroller.current;
      if (!node) return;
      const slide = node.children[n];
      if (slide) slide.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [],
  );

  useEffect(() => {
    const node = scroller.current;
    if (!node) return undefined;
    const onScroll = () => {
      const i = Math.round(node.scrollTop / node.clientHeight);
      if (i !== index && i >= 0) setIndex(i);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [index]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowDown" || e.key === "j") go(index + 1);
      if (e.key === "ArrowUp" || e.key === "k") go(index - 1);
      if (e.key === "m") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return undefined;
    const onWheel = (e) => {
      if (lock.current) return;
      if (Math.abs(e.deltaY) < 24) return;
      lock.current = true;
      go(index + (e.deltaY > 0 ? 1 : -1));
      setTimeout(() => {
        lock.current = false;
      }, 520);
    };
    node.addEventListener("wheel", onWheel, { passive: true });
    return () => node.removeEventListener("wheel", onWheel);
  }, [go, index]);

  const current = CACHE.get(index);

  return (
    <div className="shell">
      <header className="marquee">
        <div className="bulbs" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className={i % 2 ? "bulb on" : "bulb"} />
          ))}
        </div>
        <h1 className="wordmark">SLOPTOK</h1>
        <p className="tag">DUMPSTER-GLAM SLOT MACHINE OF SLOP</p>
      </header>

      <div className="cabinet">
        <div className="rails" aria-hidden="true" />
        <div className="viewport" ref={scroller}>
          {(clips.length ? clips : [{ index: 0, feedIndex: 0, id: "boot", status: "pending" }]).map((clip) => {
            const fi = feedKey(clip, 0);
            return (
              <Slide
                key={`feed-${fi}`}
                clip={clip}
                active={fi === index}
                muted={muted}
                onUpgrade={(next) => {
                  mergeClip(next);
                  snapshot();
                }}
              />
            );
          })}
        </div>
        <aside className="lever-col">
          <button className="act lever" onClick={() => go(index + 1)} title="spin next">
            <span>PULL</span>
          </button>
          <button className="act coin" onClick={() => setMuted((m) => !m)} title="sound">
            <span>{muted ? "MUTE" : "LOUD"}</span>
          </button>
          <button
            className={`act shout ${garnish === "ltx" ? "hot" : ""}`}
            onClick={() => setGarnish((g) => (g === "ltx" ? "h3" : "ltx"))}
            title="optional LTX 1080 garnish"
          >
            <span>{garnish === "ltx" ? "LTX" : "H3"}</span>
          </button>
          <button className="act toss" onClick={() => go(index + 1)} title="next slop">
            <span>TOSS</span>
          </button>
        </aside>
      </div>

      <footer className="ticket">
        <div>
          <strong>{current?.handle || "@loading.slop"}</strong>
          <p>{current?.caption || "cranking the dumpster handle\u2026"}</p>
        </div>
        <div className="pills">
          <span className={`pill ${current?.status || "pending"}`}>
            {labelFor(current)}
          </span>
          <span className="pill ghost">SPIN \u25b2\u25bc</span>
        </div>
      </footer>
    </div>
  );
}

function labelFor(clip) {
  if (!clip) return "WARMING UP";
  if (clip.status === "ready" && clip.model === "ltx") return "1080 GARNISH";
  if (clip.status === "ready") return "HOT SLOP";
  if (clip.status === "fallback") return "KEN BURNS HOLD";
  if (clip.upgrading) return "COOKING";
  return "SPINNING";
}

function Slide({ clip, active, muted, onUpgrade }) {
  const videoRef = useRef(null);
  const [src, setSrc] = useState(clip.videoUrl);
  const pending = useRef(null);

  useEffect(() => {
    if (!clip.videoUrl) return;
    if (!src) {
      setSrc(clip.videoUrl);
      return;
    }
    if (clip.videoUrl !== src) {
      pending.current = clip.videoUrl;
    }
  }, [clip.videoUrl, src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active, src]);

  const onEnded = () => {
    if (pending.current) {
      setSrc(pending.current);
      pending.current = null;
    } else if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <section className="slide">
      <div className="payline" />
      {src ? (
        <video
          ref={videoRef}
          className="reel"
          src={src}
          poster={clip.posterUrl || undefined}
          muted={muted}
          playsInline
          loop={!pending.current}
          autoPlay={active}
          onEnded={onEnded}
        />
      ) : clip.posterUrl ? (
        <img className="reel kenstill" src={clip.posterUrl} alt="" />
      ) : (
        <div className="reel placeholder">
          <div className="slots">
            <i />
            <i />
            <i />
          </div>
          <p>JACKPOT PENDING</p>
        </div>
      )}
      <div className="chrome-caption">
        <span className="handle">{clip.handle || " "}</span>
        <span className="cap">{clip.caption || " "}</span>
      </div>
    </section>
  );
}
