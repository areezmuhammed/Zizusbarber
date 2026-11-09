import { expect, it, vi } from "vitest";
import { consoleEmail, consoleSms, missingProviderEnv, providersFromEnv, resendEmail, twilioSms } from "./providers";

// Fake fetch only: no request ever leaves the machine.
const fake = (status = 200) => vi.fn<typeof fetch>(async () => new Response("err body", { status }));

it("Resend: POST /emails with bearer key, from, to, subject, text", async () => {
  const f = fake();
  await resendEmail("re_test", "Shop <a@b.test>", f).send({ to: "c@d.test", subject: "S", text: "T" });
  const [url, init] = f.mock.calls[0];
  expect(url).toBe("https://api.resend.com/emails");
  expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
  expect(JSON.parse(init!.body as string)).toEqual({ from: "Shop <a@b.test>", to: ["c@d.test"], subject: "S", text: "T" });
});

it("Twilio: form POST to the account's Messages with basic auth", async () => {
  const f = fake(201);
  await twilioSms("AC1", "tok", "+447000000000", f).send({ to: "+447700900123", text: "hi" });
  const [url, init] = f.mock.calls[0];
  expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
  expect((init!.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("AC1:tok")}`);
  expect(Object.fromEntries(init!.body as URLSearchParams)).toEqual({ To: "+447700900123", From: "+447000000000", Body: "hi" });
});

it("a non-2xx response throws so the row is marked failed", async () => {
  await expect(resendEmail("k", "f", fake(500)).send({ to: "a", subject: "b", text: "c" })).rejects.toThrow("resend 500: err body");
  await expect(twilioSms("s", "t", "f", fake(400)).send({ to: "a", text: "b" })).rejects.toThrow("twilio 400");
});

it("console providers never log the manage token or a full phone/email", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const text = "Manage: https://zizusbarbers.com/booking/11c374c0-bbd1-4e8b-945b-6d9afdb5ff55 ok";
  await consoleSms.send({ to: "+447700900123", text });
  await consoleEmail.send({ to: "ann.smith@example.com", subject: "S", text });
  const out = log.mock.calls.map((c) => String(c[0])).join("\n");
  log.mockRestore();
  expect(out).not.toMatch(/11c374c0|7700900|ann\.smith/);
  expect(out).toContain("/booking/<token> ok");
  expect(out).toContain("to=***123");
  expect(out).toContain("to=***@example.com");
});

it("missingProviderEnv lists every unset or blank required variable", () => {
  const full = { SITE_URL: "u", RESEND_API_KEY: "k", EMAIL_FROM: "f", TWILIO_ACCOUNT_SID: "s", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+44" };
  expect(missingProviderEnv(full)).toEqual([]);
  expect(missingProviderEnv({ ...full, TWILIO_AUTH_TOKEN: " ", EMAIL_FROM: undefined })).toEqual(["EMAIL_FROM", "TWILIO_AUTH_TOKEN"]);
  expect(missingProviderEnv({})).toHaveLength(6);
});

it("falls back to console (dry run) when env is missing", () => {
  expect(providersFromEnv({})).toEqual({ email: consoleEmail, sms: consoleSms });
  const p = providersFromEnv({ RESEND_API_KEY: "k", EMAIL_FROM: "f", TWILIO_ACCOUNT_SID: "s", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+44" });
  expect(p.email).not.toBe(consoleEmail);
  expect(p.sms).not.toBe(consoleSms);
});
