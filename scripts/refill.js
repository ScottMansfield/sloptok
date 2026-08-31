const base = process.env.SLOP_URL || "http://localhost:3000";
const url = `${base.replace(/\/$/, "")}/api/pool/refresh`;

const res = await fetch(url, { method: "POST" });
const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error("refill: non-json response");
  process.exit(1);
}
if (!res.ok) {
  console.error("refill failed", res.status, data.reason || data.error || "");
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, slot: data.slot, id: data.id }));
