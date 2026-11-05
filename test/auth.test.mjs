import assert from "node:assert/strict";
import worker, { signSession, verifySession } from "../lib/auth.js";

const ORIGIN = "https://auth.test";
const env = { ALLOWED_ORIGIN: "https://other.example", REDIRECT_URI: ORIGIN + "/", TIKTOK_CLIENT_KEY: "ck", TIKTOK_CLIENT_SECRET: "cs", SESSION_SECRET: "s3cret-for-tests" };
const call = (path, init = {}, e = env) => worker.fetch(new Request("https://auth.test" + path, init), e);
const post = (body, headers = {}) => ({ method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

let tiktokCalls = [];
globalThis.fetch = async (url, init = {}) => {
  tiktokCalls.push({ url: String(url), init });
  if (String(url).startsWith("https://open.tiktokapis.com/v2/oauth/token/")) {
    const p = new URLSearchParams(init.body);
    return p.get("code") === "good-code" ? Response.json({ access_token: "at", open_id: "open123", refresh_token: "rt" }) : Response.json({ error: "invalid_grant" }, { status: 400 });
  }
  if (String(url).startsWith("https://open.tiktokapis.com/v2/user/info/")) {
    return Response.json({ data: { user: { open_id: "open123", display_name: "Cool\u0007 Name 🧌", avatar_url: "https://p16.tiktokcdn.com/a.jpeg" } }, error: { code: "ok" } });
  }
  throw new Error("unexpected fetch " + url);
};

// health and CORS
assert.equal((await call("/health")).status, 200);
const pre = await call("/auth/tiktok", { method: "OPTIONS", headers: { Origin: ORIGIN } });
assert.equal(pre.status, 204);
assert.equal(pre.headers.get("Access-Control-Allow-Origin"), ORIGIN);
assert.equal((await call("/auth/tiktok", post({ code: "good-code", redirect_uri: env.REDIRECT_URI }, { Origin: "https://evil.example" }))).status, 403);
assert.equal((await call("/auth/tiktok", { method: "POST", body: "{}" })).status, 403, "no Origin header");
assert.equal((await call("/auth/tiktok", post({ code: "good-code", redirect_uri: env.REDIRECT_URI }, { Origin: "https://other.example" }))).status, 200, "ALLOWED_ORIGIN extra origin");
const cfg = await (await call("/auth/config")).json();
assert.deepEqual(cfg, { tiktokClientKey: "ck", redirectUri: env.REDIRECT_URI });
assert.equal((await call("/auth/config", {}, { ...env, TIKTOK_CLIENT_KEY: "" })).status, 404);
assert.ok(!JSON.stringify(cfg).includes("cs"), "config never exposes the secret");

// bad requests
assert.equal((await call("/auth/tiktok", post({ code: "good-code", redirect_uri: "https://evil.example/" }))).status, 400, "redirect_uri must match");
assert.equal((await call("/auth/tiktok", post({ redirect_uri: env.REDIRECT_URI }))).status, 400);
assert.equal((await call("/auth/tiktok", { method: "POST", headers: { Origin: ORIGIN }, body: "not json" })).status, 400);
assert.equal((await call("/auth/tiktok", post({ code: "x".repeat(3000), redirect_uri: env.REDIRECT_URI }))).status, 400);
assert.equal((await call("/auth/tiktok", post({ code: "good-code", redirect_uri: env.REDIRECT_URI }), { ...env, TIKTOK_CLIENT_SECRET: "" })).status, 500);

// failed exchange
assert.equal((await call("/auth/tiktok", post({ code: "bad-code", redirect_uri: env.REDIRECT_URI }))).status, 401);

// success
tiktokCalls = [];
const ok = await call("/auth/tiktok", post({ code: "good-code", redirect_uri: env.REDIRECT_URI }));
assert.equal(ok.status, 200);
const body = await ok.json();
assert.equal(body.user.id, "open123");
assert.equal(body.user.name, "Cool Name 🧌", "control characters stripped");
assert.equal(body.user.avatar, "https://p16.tiktokcdn.com/a.jpeg");
assert.ok(!JSON.stringify(body).includes("\"at\"") && !JSON.stringify(body).includes("rt"), "TikTok tokens never returned");
const form = new URLSearchParams(tiktokCalls[0].init.body);
assert.equal(form.get("grant_type"), "authorization_code");
assert.equal(form.get("client_secret"), "cs");
assert.equal(form.get("redirect_uri"), env.REDIRECT_URI);
assert.match(tiktokCalls[1].url, /fields=open_id,display_name,avatar_url/);
assert.equal(tiktokCalls[1].init.headers.Authorization, "Bearer at");

// session: /me
const me = await call("/me", { headers: { Origin: ORIGIN, Authorization: "Bearer " + body.session } });
assert.equal(me.status, 200);
assert.equal((await me.json()).user.name, "Cool Name 🧌");
assert.equal((await call("/me", { headers: { Origin: ORIGIN } })).status, 401);
const bare = await call("/me", { headers: { Authorization: "Bearer " + body.session } });
assert.equal(bare.status, 200, "same-origin GET has no Origin header");
assert.equal((await call("/me")).status, 401);
const tampered = body.session.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
assert.equal((await call("/me", { headers: { Origin: ORIGIN, Authorization: "Bearer " + tampered } })).status, 401, "tampered signature");
const [pl] = body.session.split(".");
assert.equal((await call("/me", { headers: { Origin: ORIGIN, Authorization: "Bearer " + pl + "." + "AAAA" } })).status, 401);
assert.equal(await verifySession(body.session, "other-secret"), null, "wrong secret");
const expired = await signSession({ sub: "x", name: "x", avatar: "", exp: Math.floor(Date.now() / 1000) - 5 }, env.SESSION_SECRET);
assert.equal(await verifySession(expired, env.SESSION_SECRET), null, "expired");

// profile lookup failing still signs in with the open_id
globalThis.fetch = async (url) => String(url).includes("oauth/token") ? Response.json({ access_token: "at", open_id: "o9" }) : Promise.reject(new Error("down"));
const r2 = await (await call("/auth/tiktok", post({ code: "c", redirect_uri: env.REDIRECT_URI }))).json();
assert.equal(r2.user.name, "TikTok user");
assert.equal((await call("/nope", { headers: { Origin: ORIGIN } })).status, 404);

console.log("worker tests passed");
