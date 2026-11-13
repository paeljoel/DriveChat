/**
 * DriveChat push relay — a Cloudflare Worker (free plan is plenty).
 *
 * Browsers aren't allowed to talk to Google's / Apple's push services directly,
 * so this tiny relay forwards a notification that the SENDER's browser already
 * encrypted for the recipient's device (RFC 8291). The relay can't read it:
 * it only adds the app's VAPID signature and passes it on.
 *
 * Optional: branded invite emails with an "Accept invite" button. Needs your own domain and a
 * free Resend account (resend.com). Add two Worker variables: RESEND_API_KEY (secret) and
 * EMAIL_FROM (e.g. "DriveChat <invite@yourdomain.com>"). Without them the app opens the
 * sender's own mail app instead.
 *
 * Contacts: when a friend opens your invite link, their app leaves a note here so YOUR app adds
 * them automatically. Needs a KV namespace bound to this Worker as HS (see README).
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
const hits = new Map();   // simple per-IP rate limit for invite emails
function limited(ip, max = 12, windowMs = 3600e3) { const now = Date.now(); const a = (hits.get(ip) || []).filter(t => now - t < windowMs); a.push(now); hits.set(ip, a); return a.length > max; }
// Branded invite email (HTML + plain text). Table layout + inline styles so it renders in Gmail, Outlook and Apple Mail.
function inviteEmail({ name, photo, link, appUrl }) {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const first = esc(name.split(' ')[0]);
  const initials = esc(name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?');
  const avatar = photo
    ? `<img src="${esc(photo)}" width="72" height="72" alt="" style="display:block;width:72px;height:72px;border-radius:36px;border:3px solid #ffffff;">`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="72" height="72" align="center" valign="middle" style="width:72px;height:72px;border-radius:36px;background:#f97316;border:3px solid #ffffff;color:#ffffff;font:700 26px -apple-system,Segoe UI,Roboto,Arial,sans-serif;">${initials}</td></tr></table>`;
  const feature = (emoji, title, text) => `<tr><td width="40" valign="top" style="padding:8px 0;font-size:20px;line-height:24px;">${emoji}</td><td valign="top" style="padding:8px 0;font:14px/20px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#4a4a5a;"><b style="color:#16161d;">${title}</b><br>${text}</td></tr>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(name)} invited you to DriveChat</title></head>
<body style="margin:0;padding:0;background:#f1effc;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(name)} wants to chat with you privately. Tap to accept.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1effc;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
    <tr><td align="center" style="padding:0 0 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:10px;"><img src="${esc(appUrl)}icon-192.png" width="36" height="36" alt="" style="display:block;border-radius:10px;"></td>
        <td style="font:800 20px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#16161d;letter-spacing:-0.3px;">DriveChat</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 40px rgba(60,40,160,0.12);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="background:#7360f2;background-image:linear-gradient(135deg,#5b48e0,#7360f2 50%,#9a6cf5);padding:36px 24px 30px;">
          ${avatar}
          <div style="font:800 24px/30px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;margin-top:14px;letter-spacing:-0.4px;">${esc(name)}</div>
          <div style="font:16px/22px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e9e4ff;margin-top:4px;">invited you to chat on DriveChat</div>
        </td></tr>
        <tr><td style="padding:30px 32px 8px;font:16px/24px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2b38;">
          Hi! ${first} wants to message and call you on <b>DriveChat</b>, a private messenger where your chats are end-to-end encrypted and stored in your own Google Drive.
        </td></tr>
        <tr><td align="center" style="padding:22px 32px 8px;">
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${esc(link)}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="50%" fillcolor="#7360f2" stroke="f"><center style="color:#ffffff;font-family:Arial;font-size:17px;font-weight:bold;">Accept invite</center></v:roundrect><![endif]-->
          <!--[if !mso]><!--><a href="${esc(link)}" style="display:inline-block;background:#7360f2;background-image:linear-gradient(135deg,#6a55ee,#8b63f3);color:#ffffff;text-decoration:none;font:700 17px/52px -apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:0 44px;border-radius:26px;box-shadow:0 8px 20px rgba(115,96,242,0.35);">Accept invite &rarr;</a><!--<![endif]-->
        </td></tr>
        <tr><td align="center" style="padding:6px 32px 20px;font:13px/18px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#8a8a99;">Free · Sign in with Google · Takes 30 seconds</td></tr>
        <tr><td style="padding:4px 32px 26px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #eeeef3;">
            <tr><td style="height:12px;"></td></tr>
            ${feature('🔒', 'End-to-end encrypted', 'Only you and the people you chat with can read your messages.')}
            ${feature('📞', 'Voice &amp; video calls', 'Clear calls straight between your devices.')}
            ${feature('📁', 'Your data, your Drive', 'Messages live in your own Google Drive, not on our servers.')}
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:22px 20px 0;font:12px/18px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#8a8a99;">
      Button not working? Copy this link into your browser:<br><a href="${esc(link)}" style="color:#7360f2;word-break:break-all;">${esc(link)}</a><br><br>
      You got this email because ${esc(name)} invited you. If you don't know them, you can ignore it.
    </td></tr>
  </table>
</td></tr></table></body></html>`;
  const text = `${name} invited you to chat on DriveChat.\n\nDriveChat is a private messenger: end-to-end encrypted messages and calls, stored in your own Google Drive.\n\nAccept the invite:\n${link}\n\nYou got this email because ${name} invited you. If you don't know them, you can ignore it.`;
  return { subject: `${name} invited you to chat on DriveChat`, html, text };
}


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
    const emailOn = !!(env.RESEND_API_KEY && env.EMAIL_FROM);
    if (req.method === 'GET' && new URL(req.url).pathname === '/hs') return handshake(req, env, json, okOrigin);
    if (req.method === 'GET') return json({ ok: !!(cfg.pub && cfg.priv), service: 'DriveChat push relay', vapidPublicKey: cfg.pub, email: emailOn, hs: !!env.HS });
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    if (!okOrigin) return json({ error: 'origin not allowed' }, 403);
    if (new URL(req.url).pathname === '/hs') return handshake(req, env, json, okOrigin);
    if (new URL(req.url).pathname === '/invite') return sendInvite(req, env, cfg, json, emailOn);
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

async function sendInvite(req, env, cfg, json, emailOn) {
  if (!emailOn) return json({ error: 'email not configured' }, 501);
  if (limited(req.headers.get('CF-Connecting-IP') || 'x')) return json({ error: 'too many invites, try later' }, 429);
  let p; try { p = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const to = String(p.to || '').trim().toLowerCase();
  if (!/^[^@\s<>"]+@[^@\s<>"]+\.[a-z]{2,}$/.test(to)) return json({ error: 'bad email' }, 400);
  const appUrl = (cfg.origin || '') + '/';
  const link = String(p.link || '');
  if (!cfg.origin || !link.startsWith(appUrl + '#add=') || link.length > 300) return json({ error: 'bad link' }, 400);
  const name = String(p.name || 'A friend').replace(/[<>"\r\n]/g, '').slice(0, 60) || 'A friend';
  const photo = /^https:\/\/lh\d\.googleusercontent\.com\/[\w\-\/=.]+$/.test(p.photo || '') ? p.photo : '';
  const m = inviteEmail({ name, photo, link, appUrl });
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject: m.subject, html: m.html, text: m.text, ...(p.replyTo && /^[^@\s]+@[^@\s]+$/.test(p.replyTo) ? { reply_to: p.replyTo } : {}) }) });
  return r.ok ? json({ ok: true }) : json({ error: 'email service error ' + r.status }, 502);
}

/* Invite handshake: "these DriveChat folders want to connect with ID r". One small key per ID,
   read with get() (100k/day free) — never list() (only 1k/day free). Folder IDs only, kept 30 days. */
async function handshake(req, env, json, okOrigin) {
  if (!env.HS) return json({ error: 'kv not configured' }, 501);
  if (!okOrigin) return json({ error: 'origin not allowed' }, 403);
  const ID = /^[\w-]{16,64}$/;
  if (req.method === 'GET') {
    const rs = [...new Set((new URL(req.url).searchParams.get('r') || '').split(',').filter(r => ID.test(r)))].slice(0, 10);
    const out = new Set();
    await Promise.all(rs.map(async r => { const v = await env.HS.get('h:' + r, { type: 'json', cacheTtl: 60 }); for (const o of v || []) out.add(o); }));
    return json({ o: [...out] });
  }
  if (limited('hs:' + (req.headers.get('CF-Connecting-IP') || 'x'), 60)) return json({ error: 'slow down' }, 429);
  let p; try { p = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!ID.test(p.r || '') || !/^[\w-]{10,64}$/.test(p.o || '')) return json({ error: 'bad ids' }, 400);
  const cur = (await env.HS.get('h:' + p.r, { type: 'json' })) || [];
  if (!cur.includes(p.o)) await env.HS.put('h:' + p.r, JSON.stringify([...cur.slice(-199), p.o]), { expirationTtl: 30 * 86400 });   // write only when new
  return json({ ok: true });
}
