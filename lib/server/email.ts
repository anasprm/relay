/**
 * Transactional email helper.
 *
 * Resend is used through its HTTPS API so no extra package is required.
 * When `RESEND_API_KEY` is missing (local development, previews, or an early
 * deployment) the reset link is written to stdout instead. That keeps the
 * request successful and makes the flow testable without an email provider.
 */

interface PasswordResetEmailInput {
  to: string;
  username: string;
  resetUrl: string;
}

export interface PasswordResetEmailResult {
  delivered: boolean;
  provider: "resend" | "development";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Use `process.stdout` rather than `console.log` because the production build
 * strips all `console.*` calls in `next.config.ts`.
 */
function logDevelopmentResetLink(input: PasswordResetEmailInput): void {
  const line = "-".repeat(64);
  process.stdout.write(
    [
      "",
      line,
      "[DEV] Password reset link generated",
      `User:  ${input.username} <${input.to}>`,
      `Reset: ${input.resetUrl}`,
      "Set RESEND_API_KEY and EMAIL_FROM to deliver this by email.",
      line,
      "",
    ].join("\n"),
  );
}

function buildHtml(input: PasswordResetEmailInput): string {
  const username = escapeHtml(input.username);
  const resetUrl = escapeHtml(input.resetUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0c;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111114;border:1px solid #2a2a2c;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0 0 6px;color:#25d366;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Relay Messenger</p>
                <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.3;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;">
                <p style="margin:0 0 16px;color:#d7d7db;font-size:15px;line-height:1.6;">Hi ${username},</p>
                <p style="margin:0 0 24px;color:#a9a9b0;font-size:14px;line-height:1.7;">
                  We received a request to reset the password for your Relay account.
                  Click the button below to choose a new one.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${resetUrl}" style="display:inline-block;background:#25d366;color:#050505;font-size:15px;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:10px;">
                    Reset password
                  </a>
                </p>
                <p style="margin:0 0 10px;color:#77777f;font-size:12px;line-height:1.6;">
                  This link expires in 1 hour and can only be used once. If you did not request a reset, you can safely ignore this email.
                </p>
                <p style="margin:0 0 24px;color:#77777f;font-size:12px;line-height:1.6;word-break:break-all;">
                  Button not working? Paste this link into your browser:<br />
                  <a href="${resetUrl}" style="color:#6ee7b7;">${resetUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #2a2a2c;padding:16px 28px;color:#5f5f66;font-size:11px;">
                Relay Messenger — secure, private conversations.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
): Promise<PasswordResetEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    "Relay Messenger <onboarding@resend.dev>";

  if (!apiKey) {
    logDevelopmentResetLink(input);
    return { delivered: false, provider: "development" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: "Reset your Relay Messenger password",
        html: buildHtml(input),
        text: [
          `Hi ${input.username},`,
          "",
          "We received a request to reset your Relay password.",
          `Reset it here (expires in 1 hour): ${input.resetUrl}`,
          "",
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      process.stderr.write(
        `[email] Resend rejected the reset email (${response.status}): ${details}\n`,
      );
      // Never make the reset request fail just because email delivery did.
      logDevelopmentResetLink(input);
      return { delivered: false, provider: "development" };
    }

    return { delivered: true, provider: "resend" };
  } catch (error) {
    process.stderr.write(
      `[email] Resend request failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    logDevelopmentResetLink(input);
    return { delivered: false, provider: "development" };
  }
}
