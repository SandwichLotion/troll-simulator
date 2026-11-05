/*
 * Troll Simulator auth worker (Cloudflare Workers).
 * Swaps a TikTok Login Kit authorization code for the player's TikTok profile, then returns a
 * signed session token. TikTok's access and refresh tokens are never sent to the browser or stored.
 *
 * Vars:    ALLOWED_ORIGIN (comma-separated site origins), REDIRECT_URI, TIKTOK_CLIENT_KEY
 * Secrets: TIKTOK_CLIENT_SECRET, SESSION_SECRET
 */
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const INFO_URL = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url";
const SESSION_SECONDS = 30 * 24 * 3600;
const enc = new TextEncoder();

const b64u = (buf) => {
  let s = "";
  for (const x of new Uint8Array(buf)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64u = (str) => {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
};
const hmacKey = (secret, usage) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage);

export async function signSession(payload, secret) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, ["sign"]), enc.encode(body));
  return body + "." + b64u(sig);
}

export async function verifySession(token, secret) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret, ["verify"]), fromB64u(parts[1]), enc.encode(parts[0]));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64u(parts[0])));
    return p && p.exp > Math.floor(Date.now() / 1000) ? p : null;
  } catch {
    return null;
  }
}

const clean = (v) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40);
const safeUrl = (v) => (typeof v === "string" && v.startsWith("https://") && v.length < 1000 ? v : "");

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = okOrigin
      ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Max-Age": "86400", Vary: "Origin" }
      : { Vary: "Origin" };
    const json = (o, status = 200) =>
      new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors } });

    if (url.pathname === "/health") return json({ ok: true });
    if (!okOrigin) return json({ error: "origin_not_allowed" }, 403);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET || !env.SESSION_SECRET || !env.REDIRECT_URI) return json({ error: "server_not_configured" }, 500);

    if (url.pathname === "/auth/tiktok" && req.method === "POST") {
      let b;
      try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
      const code = b && typeof b.code === "string" ? b.code : "";
      if (!code || code.length > 2048 || b.redirect_uri !== env.REDIRECT_URI) return json({ error: "bad_request" }, 400);

      let tok;
      try {
        const r = await fetch(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
          body: new URLSearchParams({
            client_key: env.TIKTOK_CLIENT_KEY,
            client_secret: env.TIKTOK_CLIENT_SECRET,
            code,
            grant_type: "authorization_code",
            redirect_uri: env.REDIRECT_URI,
          }),
        });
        tok = await r.json();
        if (!r.ok || !tok || !tok.access_token) throw new Error("token");
      } catch {
        return json({ error: "tiktok_auth_failed" }, 401);
      }

      let u = {};
      try {
        const r = await fetch(INFO_URL, { headers: { Authorization: "Bearer " + tok.access_token } });
        const j = await r.json();
        u = (j && j.data && (j.data.user || j.data)) || {};
      } catch { /* profile is optional; open_id from the token response is enough */ }

      const id = String(tok.open_id || u.open_id || "");
      if (!id) return json({ error: "tiktok_auth_failed" }, 401);
      const now = Math.floor(Date.now() / 1000);
      const user = { id, name: clean(u.display_name) || "TikTok user", avatar: safeUrl(u.avatar_url), exp: now + SESSION_SECONDS };
      const session = await signSession({ sub: id, name: user.name, avatar: user.avatar, iat: now, exp: user.exp }, env.SESSION_SECRET);
      return json({ session, user });
    }

    if (url.pathname === "/me" && req.method === "GET") {
      const m = (req.headers.get("Authorization") || "").match(/^Bearer (.+)$/);
      const p = m ? await verifySession(m[1], env.SESSION_SECRET) : null;
      return p ? json({ user: { id: p.sub, name: p.name, avatar: p.avatar, exp: p.exp } }) : json({ error: "unauthorized" }, 401);
    }

    return json({ error: "not_found" }, 404);
  },
};
