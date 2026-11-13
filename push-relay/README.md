# Push relay: notifications when DriveChat is closed

DriveChat has no server, so on its own it can only notify you while the app is open. Messenger-style notifications for messages and incoming calls, delivered while the app is closed or the phone is locked, need this tiny relay. It runs free on Cloudflare Workers and takes about 3 minutes to set up once.

**Privacy.** Each notification is encrypted in the sender's browser for the recipient's device (the Web Push standard, RFC 8291). The relay can't read who is messaging or what they wrote. It only adds the app's signature, which Google and Apple require, and passes the notification on.

## Setup
1. Sign up free at <https://dash.cloudflare.com>.
2. Go to **Workers & Pages → Create → Create Worker**. Name it `drivechat-push`, then click **Deploy**.
3. Click **Edit code**, delete everything there, and paste in the **ready-made `worker-ready.js`** you were given. It already contains your keys.
   - If you're starting from `worker.js` in this folder instead, fill in the three constants at the top first.
4. Click **Deploy**. Open the Worker's URL (e.g. `https://drivechat-push.yourname.workers.dev`) in your browser. You should see `"ok": true`.
5. In `index.html`, set:
   ```js
   pushRelay: 'https://drivechat-push.yourname.workers.dev',
   ```
   Commit the change; Render redeploys automatically.
6. Each person taps **Turn on notifications** in DriveChat.

## Keep the private key secret
`worker-ready.js` contains your VAPID **private** key. Paste it only into Cloudflare, and never commit it to GitHub. The `worker.js` in this repo has no keys in it.

If the key ever leaks, generate a new key pair. Update `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_JWK` in the Worker and `CONFIG.vapidPublicKey` in `index.html`. Users' devices re-subscribe automatically.

## What works where
| Device | Messages & calls while DriveChat is closed |
|---|---|
| Android (Chrome, Edge, Samsung Internet) | ✅ Works whether or not the app is installed |
| Windows / Mac / Linux (Chrome, Edge, Firefox) | ✅ Works while the browser is running. Chrome on Windows and Mac keeps running in the background by default. |
| iPhone / iPad (iOS 16.4 or later) | ✅ Only after **Add to Home Screen**. Open DriveChat from the Home Screen icon, then turn on notifications. |

An incoming call shows a notification with **Answer** and **Decline** that stays on screen until you respond. The notification plays your phone's notification sound once and vibrates in a long pattern, rather than ringing continuously like a native phone call. Web apps aren't allowed to use the full-screen call ringer.
