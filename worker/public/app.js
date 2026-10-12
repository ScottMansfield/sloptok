// Static SlopTok feed: loads /feed.json once, shuffles randomly per visit, renders lazily.
const $ = (id) => document.getElementById(id);
const vp = $("viewport");
let clips = [], index = 0, muted = true, lock = false;
const RENDER_AHEAD = 3;

$("bulbs").innerHTML = Array.from({ length: 14 }, (_, i) => `<span class="${i % 2 ? "bulb on" : "bulb"}"></span>`).join("");

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function slide(clip, cdn) {
  const s = document.createElement("section");
  s.className = "slide";
  s.innerHTML = `<div class="payline"></div>
    <video class="reel" playsinline loop muted preload="metadata" src="${esc(cdn)}/clips/${encodeURIComponent(clip.file)}"></video>
    <div class="chrome-caption"><span class="handle">${esc(clip.handle)}</span><span class="cap">${esc(clip.caption)}</span></div>`;
  return s;
}

let cdn = "https://cdn.sloptok.dev";
function ensureRendered(upto) {
  while (vp.children.length <= Math.min(upto, clips.length - 1)) vp.appendChild(slide(clips[vp.children.length], cdn));
}

function activate(i) {
  index = Math.max(0, Math.min(i, clips.length - 1));
  ensureRendered(index + RENDER_AHEAD);
  [...vp.children].forEach((el, k) => {
    const v = el.querySelector("video");
    if (!v) return;
    v.muted = muted;
    if (k === index) v.play().catch(() => {});
    else v.pause();
    if (k === index + 1) v.preload = "auto";
  });
  const c = clips[index];
  $("handle").textContent = c?.handle || "@loading.slop";
  $("caption").textContent = c?.caption || "";
  $("status").textContent = c ? "HOT SLOP" : "WARMING UP";
  $("status").className = `pill ${c ? "ready" : "pending"}`;
}

function go(i) {
  if (i >= clips.length) i = 0; // wrap around, reshuffled
  if (i === 0 && index === clips.length - 1) { shuffle(clips); vp.innerHTML = ""; ensureRendered(RENDER_AHEAD); vp.scrollTop = 0; activate(0); return; }
  ensureRendered(i + RENDER_AHEAD);
  vp.children[Math.max(0, i)]?.scrollIntoView({ behavior: "smooth", block: "start" });
  activate(i);
}

vp.addEventListener("scroll", () => {
  const i = Math.round(vp.scrollTop / vp.clientHeight);
  if (i !== index) activate(i);
}, { passive: true });
vp.addEventListener("wheel", (e) => {
  if (lock || Math.abs(e.deltaY) < 24) return;
  lock = true;
  go(index + (e.deltaY > 0 ? 1 : -1));
  setTimeout(() => (lock = false), 520);
}, { passive: true });
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "j") go(index + 1);
  if (e.key === "ArrowUp" || e.key === "k") go(index - 1);
  if (e.key === "m") toggleMute();
});
function toggleMute() {
  muted = !muted;
  $("mute").firstChild.textContent = muted ? "MUTE" : "LOUD";
  activate(index);
}
$("mute").onclick = toggleMute;
$("pull").onclick = () => go(index + 1);
$("toss").onclick = () => go(index + 1);

fetch("/feed.json").then((r) => r.json()).then((d) => {
  cdn = (d.cdn || cdn).replace(/\/$/, "");
  clips = shuffle(d.clips || []);
  ensureRendered(RENDER_AHEAD);
  activate(0);
}).catch(() => { $("caption").textContent = "the slop machine jammed. refresh?"; });
