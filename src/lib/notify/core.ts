// Customer notifications (Task 15): what is due, the message text, and one run that sends it.
// No imports on purpose: Vitest, the Node script and the Deno Edge Function all load this one file.
// Transactional only (PECR): no marketing, and no customer-supplied text (name) is ever put in a message.

export type Kind = "confirmation" | "reminder_24h" | "reminder_2h" | "changed" | "cancelled_by_shop";
export type Channel = "email" | "sms";
export type Status = "pending" | "sent" | "failed" | "skipped";
export const MAX_ATTEMPTS = 3;

export type Sent = { kind: Kind; change_id: string | null; status: Status; attempts: number };
export type Change = { id: string; old_start: string; new_start: string; new_end: string; at: string };
export type Booking = {
  id: string; status: string; start_at: string; end_at: string; created_at: string;
  phone: string; email: string; cancel_token: string; cancelled_by: string | null;
  service_name: string; changes: Change[]; notifications: Sent[];
};
export type Due = { booking: Booking; kind: Kind; changeId: string | null; channel: Channel };
export type Shop = { name: string; phone: string; siteUrl: string };
export type Message = { smsText: string; emailSubject: string; emailText: string };

const H = 3_600_000;

// All decisions are on UTC instants, so they are right across clock changes; only the text shows London time.
// confirmation: within 24h of creation, email (SMS if no email).
// reminder_24h: [start-24h, start-2h), SMS. reminder_2h: [start-2h, start), email (SMS if no email).
// A reminder is only due if the booking existed before its window opened (a late booking gets just the confirmation);
// for the 2h reminder, 30 min before it opened, and never in the same run as the confirmation.
// changed: the latest booking_changes row not yet notified, SMS. cancelled_by_shop: SMS. Nothing once start has passed.
export function dueNotifications(rows: Booking[], now: Date): Due[] {
  const t = now.getTime();
  const out: Due[] = [];
  for (const b of rows) {
    const start = Date.parse(b.start_at);
    const created = Date.parse(b.created_at);
    if (!(start > t)) continue;
    const pref: Channel = b.email.trim() ? "email" : "sms";
    const add = (kind: Kind, channel: Channel, changeId: string | null = null) => {
      const prev = b.notifications.find((n) => n.kind === kind && n.change_id === changeId);
      if (prev && !(prev.status === "failed" && prev.attempts < MAX_ATTEMPTS)) return;
      out.push({ booking: b, kind, changeId, channel });
    };
    if (b.status === "cancelled") {
      if (b.cancelled_by === "shop") add("cancelled_by_shop", "sms");
      continue;
    }
    if (b.status !== "confirmed" && b.status !== "pending") continue;
    const before = out.length;
    if (t - created < 24 * H) add("confirmation", pref);
    const confirmingNow = out.length > before;
    if (start - 24 * H <= t && t < start - 2 * H && created < start - 24 * H) add("reminder_24h", "sms");
    // a confirmation in this run, or one sent at most ~30 min before the window opened, already covers the 2h reminder
    if (start - 2 * H <= t && created < start - 2.5 * H && !confirmingNow) add("reminder_2h", pref);
    const last = [...b.changes].sort((x, y) => Date.parse(x.at) - Date.parse(y.at)).at(-1);
    if (last) add("changed", "sms", last.id);
  }
  return out;
}

const parts = (iso: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
// e.g. "Tue 4 Nov, 14:20" in Europe/London
export const londonTime = (iso: string) => {
  const p = parts(iso);
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute}`;
};
const hhmm = (iso: string) => londonTime(iso).slice(-5);

export function render(
  kind: Kind,
  b: Pick<Booking, "start_at" | "end_at" | "cancel_token" | "service_name">,
  shop: Shop,
): Message {
  const when = londonTime(b.start_at);
  const svc = b.service_name.replace(/\s+/g, " ").trim();
  const link = `${shop.siteUrl}/booking/${b.cancel_token}`;
  const n = shop.name;
  const footer = `View, add to calendar or cancel: ${link}\nQuestions? Call ${shop.phone}.`;
  switch (kind) {
    case "confirmation":
      return {
        smsText: `${n}: booked ${svc}, ${when}. Manage/cancel: ${link}`,
        emailSubject: `Booking confirmed: ${when}`,
        emailText: `Your booking at ${n} is confirmed.\n\nService: ${svc}\nWhen: ${when}\n\n${footer}\n`,
      };
    case "reminder_24h":
    case "reminder_2h":
      return {
        smsText: `${n} reminder: ${svc}, ${when}. Manage/cancel: ${link}`,
        emailSubject: `Reminder: ${svc}, ${when}`,
        emailText: `A reminder of your booking at ${n}.\n\nService: ${svc}\nWhen: ${when}\n\n${footer}\n`,
      };
    case "changed":
      return {
        smsText: `${n}: your booking is now ${when}-${hhmm(b.end_at)}. Problem? Call ${shop.phone}. ${link}`,
        emailSubject: `Your booking time has changed: ${when}`,
        emailText:
          `The shop has had to change your booking at ${n}.\n\nService: ${svc}\nNow: ${when}-${hhmm(b.end_at)}\n\n` +
          `If this time doesn't work for you, call ${shop.phone} or cancel here: ${link}\n`,
      };
    case "cancelled_by_shop":
      return {
        smsText: `${n}: sorry, we had to cancel your ${svc} on ${when}. Call ${shop.phone} or rebook: ${shop.siteUrl}/book`,
        emailSubject: `Booking cancelled: ${when}`,
        emailText:
          `Sorry, ${n} has had to cancel your booking.\n\nService: ${svc}\nWas: ${when}\n\n` +
          `Call ${shop.phone} or book another time: ${shop.siteUrl}/book\n`,
      };
  }
}

export type EmailProvider = { dryRun?: boolean; send(m: { to: string; subject: string; text: string }): Promise<void> };
export type SmsProvider = { dryRun?: boolean; send(m: { to: string; text: string }): Promise<void> };
export interface NotifyDb {
  candidates(now: Date): Promise<Booking[]>;
  claim(d: Due): Promise<string | null>; // notification id, or null when already claimed/sent/capped
  finish(id: string, status: Exclude<Status, "pending">, error: string | null): Promise<void>;
}
export type Summary = { sent: number; failed: number; skipped: number };

const E164 = /^\+[1-9]\d{7,14}$/;

// Each row is claimed (inserted) BEFORE sending, so a rerun or a parallel run can never send it twice.
// A crash between send and finish leaves it 'pending': at most once, never twice.
export async function runNotifications(o: { db: NotifyDb; email: EmailProvider; sms: SmsProvider; now: Date; shop: Shop }): Promise<Summary> {
  const sum: Summary = { sent: 0, failed: 0, skipped: 0 };
  for (const d of dueNotifications(await o.db.candidates(o.now), o.now)) {
    let id: string | null = null;
    let status: Exclude<Status, "pending"> = "sent";
    let error: string | null = null;
    try {
      id = await o.db.claim(d);
      if (!id) continue;
      const m = render(d.kind, d.booking, o.shop);
      const p = d.channel === "email" ? o.email : o.sms;
      if (d.channel === "sms" && !E164.test(d.booking.phone)) {
        status = "skipped";
        error = "phone is not E.164";
      } else {
        if (d.channel === "email") await o.email.send({ to: d.booking.email, subject: m.emailSubject, text: m.emailText });
        else await o.sms.send({ to: d.booking.phone, text: m.smsText });
        if (p.dryRun) [status, error] = ["skipped", "no provider credentials: logged only"];
      }
    } catch (e) {
      if (!id) { sum.failed++; continue; } // claim itself failed: nothing was sent
      [status, error] = ["failed", String(e)];
    }
    sum[status]++;
    await o.db.finish(id, status, error).catch(() => {}); // left 'pending' on failure: never resent
  }
  return sum;
}

// Structural: supabase-js client created with the service role key (bypasses RLS).
type Client = {
  from(t: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc(fn: string, args: object): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export function supabaseNotifyDb(db: Client): NotifyDb {
  return {
    async candidates(now) {
      // shortcut: loads every future booking each run; fine for one chair, page it if this grows to thousands
      const { data, error } = await db
        .from("bookings")
        .select(
          "id,status,start_at,end_at,created_at,phone,email,cancel_token,cancelled_by,services(name)," +
            "booking_changes(id,old_start,new_start,new_end,at),notifications(kind,change_id,status,attempts)",
        )
        .gt("start_at", now.toISOString())
        .in("status", ["pending", "confirmed", "cancelled"]);
      if (error) throw new Error(error.message);
      return (data as (Booking & { services: { name: string }; booking_changes: Change[] })[]).map(
        ({ services, booking_changes, ...b }) => ({ ...b, service_name: services.name, changes: booking_changes }),
      );
    },
    async claim(d) {
      const { data, error } = await db.rpc("claim_notification", {
        p_booking: d.booking.id, p_kind: d.kind, p_change: d.changeId, p_channel: d.channel,
      });
      if (error) throw new Error(error.message);
      return (data as string | null) ?? null;
    },
    async finish(id, status, err) {
      const { error } = await db
        .from("notifications")
        .update({ status, error: err, sent_at: status === "sent" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
