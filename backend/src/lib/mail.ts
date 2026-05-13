import { Resend } from 'resend';
import { env } from './env.js';
import { logger } from './logger.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface MagicLinkEmailInput {
  to: string;
  url: string;
}

/**
 * Send a magic-link email. In dev with no RESEND_API_KEY set, we log the
 * URL to stdout instead so the developer can click through without an SMTP
 * round-trip (and without burning Resend's free-tier quota).
 */
export async function sendMagicLinkEmail({ to, url }: MagicLinkEmailInput): Promise<void> {
  // Dev affordance — always echo the link to the log so you don't need to
  // dig through an inbox for every test sign-in.
  if (env.NODE_ENV === 'development') {
    logger.info({ to, url }, 'mail: magic link (dev echo)');
  }

  if (!resend) {
    logger.warn(
      { to },
      'mail: RESEND_API_KEY not set — magic link only logged, not emailed',
    );
    return;
  }

  const { data, error } = await resend.emails.send({
    from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
    to,
    subject: 'Your Wiscord sign-in link',
    html: magicLinkHtml(url),
    text: magicLinkText(url),
  });

  if (error) {
    logger.error({ to, err: error }, 'mail: resend send failed');
    throw new Error(error.message ?? 'Email send failed');
  }
  logger.info({ to, id: data?.id }, 'mail: magic link sent');
}

function magicLinkText(url: string): string {
  return [
    'Sign in to Wiscord',
    '',
    'Tap the link below to finish signing in. This link expires in 15 minutes and can only be used once.',
    '',
    url,
    '',
    "If you didn't request this email, you can safely ignore it.",
    '',
    `© ${new Date().getFullYear()} Wiscord`,
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function magicLinkHtml(url: string): string {
  const safeUrl = escapeHtml(url);
  const year = new Date().getFullYear();
  const origin = env.FRONTEND_ORIGIN.replace(/\/$/, '');
  const logoUrl = 'https://cdn.capacms.com/files/logo_(1)_1778665669768_6a71d37efd86.png';
  const homeUrl = `${origin}/`;
  const fontStack = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  const monoStack = `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;

  const brandHtml = `<img src="${escapeHtml(logoUrl)}" alt="Wiscord" width="168" height="50" style="display:block;width:168px;height:auto;max-width:168px;border:0;outline:none;text-decoration:none;color:#ffffff;font-family:${fontStack};font-size:24px;font-weight:700;letter-spacing:-0.01em;" />`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
    <title>Sign in to Wiscord</title>
    <style>
      :root { color-scheme: dark; supported-color-schemes: dark; }
      body, .wc-canvas { background-color: #1E1F22 !important; }
      .wc-card { background-color: #2B2D31 !important; }
      .wc-inset { background-color: #1E1F22 !important; }
      .wc-button-bg { background-color: #5865F2 !important; }
      .wc-divider { background-color: #3F4147 !important; }
      .wc-text-white { color: #ffffff !important; }
      .wc-text-ink { color: #DBDEE1 !important; }
      .wc-text-muted { color: #949BA4 !important; }
      .wc-text-faint { color: #6D7079 !important; }
      .wc-text-fainter { color: #5C5F66 !important; }
      a.wc-link { color: #5865F2 !important; text-decoration: none !important; }
      a.wc-cta { color: #ffffff !important; text-decoration: none !important; }
      a.wc-url-line { color: #DBDEE1 !important; text-decoration: none !important; }
      a.wc-brand { color: #ffffff !important; text-decoration: none !important; }
      .wc-cta:hover, .wc-cta:focus, .wc-cta:active { text-decoration: none !important; }
      [data-ogsc] .wc-text-white { color: #ffffff !important; }
      [data-ogsc] .wc-text-ink { color: #DBDEE1 !important; }
      [data-ogsc] .wc-text-muted { color: #949BA4 !important; }
      [data-ogsc] .wc-text-faint { color: #6D7079 !important; }
      [data-ogsc] .wc-text-fainter { color: #5C5F66 !important; }
      [data-ogsc] a.wc-cta { color: #ffffff !important; text-decoration: none !important; }
      [data-ogsc] a.wc-url-line { color: #DBDEE1 !important; text-decoration: none !important; }
      [data-ogsc] a.wc-brand { color: #ffffff !important; text-decoration: none !important; }
      [data-ogsb] body, [data-ogsb] .wc-canvas { background-color: #1E1F22 !important; }
      [data-ogsb] .wc-card { background-color: #2B2D31 !important; }
      [data-ogsb] .wc-inset { background-color: #1E1F22 !important; }
      [data-ogsb] .wc-button-bg { background-color: #5865F2 !important; }
      [data-ogsb] .wc-divider { background-color: #3F4147 !important; }
      u + .body .wc-canvas { background-color: #1E1F22 !important; }
      u + .body .wc-card { background-color: #2B2D31 !important; }
    </style>
  </head>
  <body class="body" style="margin:0;padding:0;background-color:#1E1F22;">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
      Your Wiscord sign-in link — expires in 15 minutes.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1E1F22" class="wc-canvas" style="background-color:#1E1F22;">
      <tr>
        <td align="center" style="padding:48px 16px 56px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td align="center" style="padding:0 0 32px 0;">
                <a href="${escapeHtml(homeUrl)}" target="_blank" rel="noopener" class="wc-brand" style="text-decoration:none;display:inline-block;color:#ffffff;border:0;">
                  ${brandHtml}
                </a>
              </td>
            </tr>
            <tr>
              <td bgcolor="#2B2D31" class="wc-card" style="background-color:#2B2D31;border-radius:8px;padding:48px 48px 40px 48px;">
                <h1 class="wc-text-white" style="margin:0 0 20px 0;font-family:${fontStack};font-size:22px;line-height:1.3;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Hey there,</h1>
                <p class="wc-text-ink" style="margin:0 0 18px 0;font-family:${fontStack};font-size:15px;line-height:1.6;color:#DBDEE1;">
                  Here&rsquo;s your sign-in link for <span class="wc-text-white" style="color:#ffffff;font-weight:600;">Wiscord</span>. Tap the button below to finish signing in &mdash; it expires in <span class="wc-text-white" style="color:#ffffff;font-weight:600;">15 minutes</span> and can only be used once.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 28px 0;">
                  <tr>
                    <td width="150" height="37" align="center" valign="middle" bgcolor="#5865F2" class="wc-button-bg" style="background-color:#5865F2;border-radius:10px;width:150px;height:37px;line-height:37px;font-family:${fontStack};font-size:14px;font-weight:600;color:#ffffff;text-align:center;">
                      <a href="${safeUrl}" target="_blank" rel="noopener" class="wc-cta" style="display:block;width:150px;height:37px;color:#ffffff;text-decoration:none;font-family:${fontStack};font-size:14px;font-weight:600;line-height:37px;text-align:center;white-space:nowrap;">
                        Sign in&nbsp;&rarr;
                      </a>
                    </td>
                  </tr>
                </table>
                <p class="wc-text-muted" style="margin:0 0 10px 0;font-family:${fontStack};font-size:13px;line-height:1.6;color:#949BA4;">
                  Trouble with the button? Paste this URL into your browser:
                </p>
                <div class="wc-inset" style="margin:0 0 28px 0;padding:12px 14px;background-color:#1E1F22;border:1px solid #3F4147;border-radius:6px;font-family:${monoStack};font-size:12px;line-height:1.5;color:#DBDEE1;word-break:break-all;">
                  <a href="${safeUrl}" target="_blank" rel="noopener" class="wc-url-line" style="color:#DBDEE1;text-decoration:none;">${safeUrl}</a>
                </div>
                <p class="wc-text-ink" style="margin:0 0 24px 0;font-family:${fontStack};font-size:14px;line-height:1.6;color:#DBDEE1;">
                  If this wasn&rsquo;t you, you can safely ignore this email &mdash; no one will be signed in without tapping the link above.
                </p>
                <p class="wc-text-ink" style="margin:0 0 4px 0;font-family:${fontStack};font-size:14px;line-height:1.6;color:#DBDEE1;">
                  Stay focused,
                </p>
                <p class="wc-text-ink" style="margin:0;font-family:${fontStack};font-size:14px;line-height:1.6;color:#DBDEE1;">
                  The Wiscord team
                </p>
                <div class="wc-divider" style="height:1px;background-color:#3F4147;line-height:1px;font-size:0;margin:32px 0 24px 0;">&nbsp;</div>
                <p class="wc-text-muted" style="margin:0;font-family:${fontStack};font-size:12px;line-height:1.6;color:#949BA4;">
                  Need help? Just reply to this email &mdash; a real human will get back to you.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" class="wc-text-faint" style="padding:28px 24px 0 24px;font-family:${fontStack};font-size:12px;line-height:1.7;color:#6D7079;">
                Sent by <span class="wc-text-muted" style="color:#949BA4;">Wiscord</span> &middot; A calmer place to study together
              </td>
            </tr>
            <tr>
              <td align="center" class="wc-text-fainter" style="padding:6px 24px 0 24px;font-family:${fontStack};font-size:11px;line-height:1.7;color:#5C5F66;">
                © ${year} Wiscord
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
