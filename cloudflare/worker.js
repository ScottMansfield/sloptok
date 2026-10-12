// sloptok-proxy: Cloudflare Worker in front of Cloud Run (replaces the GCP HTTPS LB).
const ORIGIN = "https://sloptok-tgn4jp474q-uc.a.run.app";
const APEX = "sloptok.dev";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === "www." + APEX) {
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }
    const target = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-Host", url.hostname);
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
    const init = { method: request.method, headers, redirect: "manual" };
    if (!["GET", "HEAD"].includes(request.method)) init.body = request.body;
    return fetch(target.toString(), init);
  },
};
