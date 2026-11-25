import { shopConfig } from "../../shop.config";

// One-event iCalendar file. UTC "Z" times are unambiguous, so no VTIMEZONE block is needed (UK clock changes included).
export type CalendarEvent = {
  uid: string;
  start: string;
  end: string;
  summary: string;
  description: string;
  /** Higher = newer copy of the same uid, so a calendar app updates the event instead of adding another. */
  sequence?: number;
  cancelled?: boolean;
};

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[;,]/g, "\\$&").replace(/\r\n|\r|\n/g, "\\n");

// RFC 5545 3.1: lines over 75 octets are folded as CRLF + one space; split on code points, never inside a UTF-8 sequence.
const fold = (line: string) => {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let len = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) { out.push(cur); cur = ""; len = 0; } // continuation lines spend 1 octet on the space
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join("\r\n ");
};

export function calendarEvent(e: CalendarEvent, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zizus Barbers//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(now.toISOString())}`,
    ...(e.sequence === undefined ? [] : [`SEQUENCE:${e.sequence}`]),
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(e.end)}`,
    `SUMMARY:${esc(e.summary)}`,
    `LOCATION:${esc(`${shopConfig.name}, ${shopConfig.address}`)}`,
    `DESCRIPTION:${esc(e.description)}`,
    ...(e.cancelled ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export type OwnerBooking = { id: string; name: string; phone: string; service: string; start: string; end: string; cancelled: boolean };

// The owner's copy: one uid per booking (never the customer's secret token), and the download time as SEQUENCE, so a
// file downloaded after a time change always outranks the earlier one.
export function buildOwnerIcs(b: OwnerBooking, now = new Date()): string {
  return calendarEvent(
    {
      uid: `booking-${b.id}@zizusbarbers.com`,
      start: b.start,
      end: b.end,
      summary: `${b.service}: ${b.name}`,
      description: `${b.name}, ${b.phone}. Booked through ${shopConfig.name}.`,
      sequence: Math.floor(now.getTime() / 1000),
      cancelled: b.cancelled,
    },
    now,
  );
}
