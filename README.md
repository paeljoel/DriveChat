# DriveChat v2: open sign-up, end-to-end encrypted, with calls

DriveChat is a Messenger/Viber-style app in a single `index.html` file. Each user's messages live in their own Google Drive, and there is no server.

| | v1 | **v2** |
|---|---|---|
| Who can sign in | Only test users you listed (max 100) | **Anyone with a Google account** |
| Google review needed | Yes (full Drive access is a "restricted" permission) | **No.** The app uses only `drive.file`, which Google classes as non-sensitive. |
| Access to the user's Drive | The whole Drive | **Only the files DriveChat creates** |
| Encryption | None | **End-to-end** (messages, files, voice notes, read receipts, typing, call setup) |
| Voice/video calls | None | **1:1 voice and video calls** (WebRTC, peer-to-peer) |

## One-time owner setup (about 5 minutes, done once by you)
This step can't be skipped. Every app that uses Google sign-in needs its own Client ID, and only the owner of a Google Cloud project can create one. After this, **your users configure nothing**.

1. Go to <https://console.cloud.google.com/>, create a project, then **APIs & Services → Library** and enable **Google Drive API**.
2. Open **Google Auth Platform** (the OAuth consent screen):
   - **Branding:** set the app name and support email.
   - **Audience:** choose External, then click **Publish app** so the status reads *In production*.
   - Because DriveChat only asks for `drive.file`, Google doesn't require a review and there's no test-user limit.
3. **Clients → Create client → Web application.** Under *Authorized JavaScript origins*, add your site, for example `https://yourname.github.io`.
4. **Credentials → Create credentials → API key.** Restrict it as follows:
   - *API restrictions:* Google Drive API only.
   - *Website restrictions:* your site.
5. Paste both values at the top of the script in `index.html`:
   ```js
   const CONFIG = {
     clientId: '1234-abc.apps.googleusercontent.com',
     apiKey:   'AIza...',
   ```
6. Host the file anywhere static: GitHub Pages, Netlify, Vercel, or Cloudflare Pages. Google sign-in doesn't work from `file://`; for local testing, run `python3 -m http.server 8080`.

## What your users do
1. Open the site, sign in with Google, and choose a **backup password**. The password protects their encryption key, so they can read their chats on other devices.
2. Tap **Add people**, then copy their invite link and send it to a friend through WhatsApp, SMS, email or anywhere else. They can also send the invite by email from inside the app.
3. The friend opens the link and signs in. Both sides are then connected and can chat, send files and voice notes, make groups, and call.

## How it works
```
Alice's Google Drive                         Bob's Google Drive
└── DriveChat/  (private)                    └── DriveChat/  (private)
    ├── identity   ← key, locked with her        ├── identity
    │                backup password             ├── state
    ├── state      ← contacts and group keys,    └── outbox/  (link-readable)
    │                encrypted                       ├── profile
    └── outbox/  (link-readable, all ciphertext)     ├── status
        ├── profile   name, photo, public key        └── <chat-id> …
        ├── status    online status; read receipts
        │             and typing are encrypted
        ├── <chat-id> one encrypted file per message or reaction
        └── a         encrypted attachments
```
- **Who writes where.** Each person writes only to their own outbox. Friends read it with the public API key, which `drive.file` allows without seeing anything else in the person's Drive.
- **Encryption.** Each person has a P-256 key pair. Every 1:1 chat gets a shared AES-256-GCM key, agreed between the two key pairs (ECDH) and never sent anywhere. Groups get a random AES key, sent to each member through their encrypted 1:1 chat.
- **Security codes.** Each 1:1 chat's info panel shows a **security code**. If both people see the same code, nobody is intercepting the chat.
- **Calls.** The call setup messages travel through Drive, encrypted. After that, audio and video go directly between the two browsers, encrypted with DTLS-SRTP. Ringing starts about 2–6 seconds after you press call.
- **Syncing.** The app checks the chat you have open about every 2 seconds and other contacts every 5–8 seconds, and slows down when the tab is in the background.

## Limits
- **Some calls won't connect.** On strict corporate or mobile networks (roughly 1 in 10 connections), browsers can't find a direct path. Adding a TURN server to `CONFIG.iceServers` fixes this. Free and paid TURN services exist; you'd sign up for one.
- **Work and school accounts may be blocked.** Their admins often disable link sharing, which DriveChat needs. Personal Gmail accounts work.
- **Some details are visible to anyone who has a person's invite link.** That includes the person's name, email, photo, and when they posted (but nothing they wrote). Message contents, files, read receipts and typing stay encrypted.
- **Lost passwords can't be recovered.** If someone loses their backup password and all their logged-in devices, they can start over with new keys, but their old messages become unreadable.
- **Usage limits are shared.** The API key's free request allowance covers all your users together. That's comfortable for dozens of simultaneously active users. For more, request a free quota increase in Cloud Console.
- **Group membership changes don't change the key.** Removing someone from a group doesn't rotate its key, so they could still decrypt new group messages if they kept reading the files. For true removal, start a new group.
- **One part is untested on real Google.** When a friend opens your link, the app tries to connect you automatically by creating a file with an ID your link carries. Everything was tested against a simulated Drive with Google's permission rules, not against Google itself. If Google rejects that step, the app falls back to sending you a Google share email with their link, and either of you can also paste the other's link under **Add people**.
