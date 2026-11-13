// Branded invite email (HTML + plain text). Table layout + inline styles so it renders in Gmail, Outlook and Apple Mail.
export function inviteEmail({ name, photo, link, appUrl }) {
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
