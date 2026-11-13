/**
 * DriveChat push relay — a Cloudflare Worker (free plan is plenty).
 *
 * Browsers aren't allowed to talk to Google's / Apple's push services directly,
 * so this tiny relay forwards a notification that the SENDER's browser already
 * encrypted for the recipient's device (RFC 8291). The relay can't read it:
 * it only adds the app's VAPID signature and passes it on.
 *
 * Setup: paste this whole file into a new Worker (Workers & Pages → Create → Hello World
 * → Edit code), fill the 3 constants below (or set them as Worker secrets/vars with
 * the same names), Deploy, then put the Worker URL in CONFIG.pushRelay in index.html.
 */
const VAPID_PUBLIC_KEY = '';      // base64url public key  (same value as CONFIG.vapidPublicKey)
const VAPID_PRIVATE_JWK = '';     // JSON string of the private key JWK — keep this secret
const ALLOWED_ORIGIN = '';        // your site, e.g. https://drivechat-7nzd.onrender.com

const CONTACT = 'mailto:noreply@drivechat.app';
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)mozilla\.com$/, /(^|\.)mozaws\.net$/, /(^|\.)notify\.windows\.com$/];

const enc = new TextEncoder();
const b64u = buf => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
let signingKey = null; const jwtCache = new Map();

async function vapidJwt(aud, cfg) {
  const hit = jwtCache.get(aud); const now = Math.floor(Date.now() / 1000);
  if (hit && hit.exp - now > 3600) return hit.jwt;
  signingKey ||= await crypto.subtle.importKey('jwk', JSON.parse(cfg.priv), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const exp = now + 12 * 3600;
  const unsigned = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))) + '.' + b64u(enc.encode(JSON.stringify({ aud, exp, sub: CONTACT })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, enc.encode(unsigned));
  const jwt = unsigned + '.' + b64u(sig);
  jwtCache.set(aud, { jwt, exp }); return jwt;
}

export default {
  async fetch(req, env = {}) {
    const cfg = { pub: env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY, priv: env.VAPID_PRIVATE_JWK || VAPID_PRIVATE_JWK, origin: (env.ALLOWED_ORIGIN || ALLOWED_ORIGIN).replace(/\/$/, '') };
    const origin = req.headers.get('Origin') || '';
    const okOrigin = !cfg.origin || origin === cfg.origin;
    const cors = { 'Access-Control-Allow-Origin': cfg.origin || '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method === 'GET') return json({ ok: !!(cfg.pub && cfg.priv), service: 'DriveChat push relay', vapidPublicKey: cfg.pub });
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    if (!okOrigin) return json({ error: 'origin not allowed' }, 403);
    if (!cfg.pub || !cfg.priv) return json({ error: 'relay not configured' }, 500);
    let p; try { p = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    let url; try { url = new URL(p.endpoint); } catch { return json({ error: 'bad endpoint' }, 400); }
    if (url.protocol !== 'https:' || !PUSH_HOSTS.some(r => r.test(url.hostname))) return json({ error: 'endpoint host not allowed' }, 400);
    if (typeof p.body !== 'string' || p.body.length > 6000) return json({ error: 'bad body' }, 400);
    const body = Uint8Array.from(atob(p.body), c => c.charCodeAt(0));
    const headers = {
      'TTL': String(Math.min(Math.max(+p.ttl || 0, 0), 2419200)),
      'Urgency': ['very-low', 'low', 'normal', 'high'].includes(p.urgency) ? p.urgency : 'normal',
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
      'Authorization': `vapid t=${await vapidJwt(url.origin, cfg)}, k=${cfg.pub}`
    };
    if (typeof p.topic === 'string' && /^[\w-]{1,32}$/.test(p.topic)) headers.Topic = p.topic;
    const r = await fetch(url.href, { method: 'POST', headers, body });
    return json({ status: r.status }, r.ok ? 200 : (r.status === 404 || r.status === 410) ? 410 : 502);
  }
};
