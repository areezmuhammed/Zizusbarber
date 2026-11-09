// Email (Resend) and SMS (Twilio) adapters. Secrets come only from the environment, never from code.
// No imports: shared with the Deno Edge Function. Without credentials the console stand-ins log instead of
// sending and are marked dryRun, so runNotifications records 'skipped' rather than pretending it sent.

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
type Mail = { to: string; subject: string; text: string };
type Text = { to: string; text: string };

async function check(res: Response, who: string) {
  if (!res.ok) throw new Error(`${who} ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export const resendEmail = (apiKey: string, from: string, f: Fetch = fetch) => ({
  async send(m: Mail) {
    const res = await f("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text }),
    });
    await check(res, "resend");
  },
});

export const twilioSms = (sid: string, token: string, from: string, f: Fetch = fetch) => ({
  async send(m: Text) {
    const res = await f(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: m.to, From: from, Body: m.text }),
    });
    await check(res, "twilio");
  },
});

// Logs never hold the manage-link token (a bearer credential) or a full phone/email.
export const redact = (s: string) => s.replace(/\/booking\/[0-9a-f-]{36}/gi, "/booking/<token>");
export const maskTo = (to: string) => (to.includes("@") ? `***${to.slice(to.indexOf("@"))}` : `***${to.slice(-3)}`);

export const consoleEmail = {
  dryRun: true,
  async send(m: Mail) { console.log(`[notify:email] to=${maskTo(m.to)} subject=${m.subject}\n${redact(m.text)}`); },
};
export const consoleSms = {
  dryRun: true,
  async send(m: Text) { console.log(`[notify:sms] to=${maskTo(m.to)} ${redact(m.text)}`); },
};

const REQUIRED = ["SITE_URL", "RESEND_API_KEY", "EMAIL_FROM", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"];
// Production (Edge Function) fails closed on any of these missing, before claiming a single row.
export const missingProviderEnv = (env: Env) => REQUIRED.filter((k) => !env[k]?.trim());

export function providersFromEnv(env: Env) {
  const email = env.RESEND_API_KEY && env.EMAIL_FROM ? resendEmail(env.RESEND_API_KEY, env.EMAIL_FROM) : consoleEmail;
  const sms = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM
    ? twilioSms(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM)
    : consoleSms;
  return { email, sms };
}
