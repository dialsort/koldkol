interface SendOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev fallback: print to console so you can click the link without a mail service
    console.log("\n─── [EMAIL DEV] ─────────────────────────────────");
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    // Extract plain URL from html for easy copy-paste
    const match = html.match(/href="([^"]+)"/);
    if (match) console.log(`Link:    ${match[1]}`);
    console.log("─────────────────────────────────────────────────\n");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "KoldKol <noreply@koldkol.com>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

export function verificationEmailHtml(verifyUrl: string, accountName: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#dc2626,#e11d48);padding:32px 40px;text-align:center">
            <div style="display:inline-flex;align-items:center;gap:10px">
              <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);display:inline-flex;align-items:center;justify-content:center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="white" stroke-width="2"/><circle cx="8" cy="8" r="2.5" fill="white"/></svg>
              </div>
              <span style="color:white;font-size:20px;font-weight:700;letter-spacing:-0.3px">KoldKol</span>
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111">Confirmez votre adresse email</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6">
              Bonjour,<br>Votre compte <strong>${accountName}</strong> est presque prêt.
              Cliquez sur le bouton ci-dessous pour vérifier votre adresse et accéder à votre espace.
            </p>
            <a href="${verifyUrl}" style="display:inline-block;background:#dc2626;color:white;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px">
              Vérifier mon email
            </a>
            <p style="margin:24px 0 0;font-size:13px;color:#888">
              Ce lien expire dans <strong>24 heures</strong>. Si vous n'avez pas créé de compte, ignorez cet email.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f0f0f0">
            <p style="margin:0;font-size:12px;color:#aaa">
              KoldKol · Données hébergées en France · CNIL conforme
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#bbb">
        Ou copiez ce lien : <a href="${verifyUrl}" style="color:#dc2626">${verifyUrl}</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
