"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { DateTime } from "luxon";
import { ChevronLeft } from "lucide-react";
import { book, getTimes } from "@/app/book/actions";
import { limitNotice, validateDetails, type Details } from "@/lib/booking-form";
import { formatPrice } from "@/lib/format";
import type { Service } from "@/lib/shop-data";
import { shopConfig } from "../../shop.config";

const ZONE = "Europe/London";
const TITLES = ["Choose a service", "Pick a day and time", "Your details", "Check and confirm"];
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit" });
const showTime = (iso: string) => timeFmt.format(new Date(iso));
const day = (date: string) => DateTime.fromISO(date, { zone: ZONE, locale: "en-GB" });

const target = "min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const field =
  "mt-1.5 block min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base aria-invalid:border-destructive focus-visible:outline-2 focus-visible:outline-primary";

export function BookingSheet({ services, days }: { services: Service[]; days: string[] }) {
  const [step, setStep] = useState(0);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [times, setTimes] = useState<string[] | null>(null);
  const [timesFailed, setTimesFailed] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>({ name: "", phone: "", email: "" });
  const [errors, setErrors] = useState<ReturnType<typeof validateDetails>>({});
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Move focus to the new step's heading, but not on first load.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step]);

  // A failed fetch shows a retry here instead of throwing to the error page.
  async function fetchTimes(serviceId: string, d: string) {
    try {
      setTimes(await getTimes(serviceId, d));
    } catch {
      setTimesFailed(true);
    }
  }

  function loadTimes(svc: Service, d: string) {
    setDate(d);
    setStart(null);
    setTimes(null);
    setTimesFailed(false);
    startTransition(() => fetchTimes(svc.id, d));
  }

  function go(next: number) {
    setNotice("");
    setStep(next);
  }

  function chooseService(s: Service) {
    setService(s);
    setStart(null);
    if (date) loadTimes(s, date);
    go(1);
  }

  function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateDetails(details);
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    go(3);
  }

  function confirm() {
    if (!service || !start || !date) return;
    startTransition(async () => {
      const res = await book({ serviceId: service.id, start, ...details });
      // Only reached on failure; success redirects.
      if (res.error === "too_many" || res.error === "busy") {
        setNotice(limitNotice(res.error, shopConfig.phone));
        return;
      }
      if (res.error === "details") {
        const errs = validateDetails(details);
        go(2);
        setErrors(errs);
        if (!Object.keys(errs).length) setNotice("Those details could not be booked. Check them and try again.");
        return;
      }
      setStart(null);
      setStep(1);
      setNotice(
        res.error === "taken" ? "That slot was just taken. Pick another time." : "That time can no longer be booked. Pick another time.",
      );
      setTimes(null);
      setTimesFailed(false);
      await fetchTimes(service.id, date);
    });
  }

  return (
    <div className="flex flex-1 flex-col sm:items-center sm:justify-center sm:p-6">
      <section
        aria-labelledby="step-h"
        className="mt-auto flex w-full flex-col rounded-t-3xl border-t border-border bg-card sm:mt-0 sm:max-w-lg sm:rounded-3xl sm:border"
      >
        <header className="flex items-center gap-1 px-3 pt-3">
          {step > 0 ? (
            <button type="button" onClick={() => go(step - 1)} className={`${target} flex min-w-11 items-center justify-center rounded-full`}>
              <ChevronLeft className="size-5" aria-hidden />
              <span className="sr-only">Back</span>
            </button>
          ) : (
            <span className="min-w-11" />
          )}
          <p className="flex-1 text-center text-sm text-muted-foreground">Step {step + 1} of 4</p>
          <span className="min-w-11" />
        </header>
        <h1
          id="step-h"
          ref={heading}
          tabIndex={-1}
          className="px-5 pt-1 pb-4 text-center font-heading text-3xl font-semibold outline-none"
        >
          {TITLES[step]}
        </h1>

        {/* Always in the DOM (only visually hidden) so screen readers announce changes */}
        <p aria-live="assertive" className={notice ? "px-5 text-sm font-medium text-destructive" : "sr-only"}>
          {notice}
        </p>

        <div key={step} className="px-5 pb-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          {step === 0 && (
            <ul aria-label="Services">
              {services.map((s) => (
                <li key={s.id} className="border-b border-border first:border-t">
                  <button
                    type="button"
                    aria-label={`${s.name}, ${formatPrice(s.price_pence)}, ${s.duration_min} min`}
                    aria-pressed={service?.id === s.id}
                    onClick={() => chooseService(s)}
                    className={`${target} flex w-full items-baseline gap-3 py-4 text-left aria-pressed:text-primary`}
                  >
                    <span className="flex-1 text-[1.0625rem]">{s.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{s.duration_min} min</span>
                    <span className="w-12 text-right font-mono text-lg text-primary">{formatPrice(s.price_pence)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {step === 1 && service && (
            <>
              <div role="group" aria-label="Days" className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-2">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={date === d}
                    aria-label={day(d).toFormat("cccc d LLLL")}
                    onClick={() => loadTimes(service, d)}
                    className={`${target} flex min-w-16 shrink-0 snap-start flex-col items-center rounded-2xl border border-border px-3 py-2 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground`}
                  >
                    <span className="text-xs">{day(d).toFormat("ccc")}</span>
                    <span className="font-heading text-2xl leading-tight font-semibold">{day(d).toFormat("d")}</span>
                    <span className="text-xs">{day(d).toFormat("LLL")}</span>
                  </button>
                ))}
              </div>
              {!date && <p className="mt-6 text-center text-muted-foreground">Choose a day to see free times.</p>}
              {date && times === null && !timesFailed && (
                <p className="mt-6 text-center text-muted-foreground">Finding free times…</p>
              )}
              {date && timesFailed && (
                <div role="alert" className="mt-6 grid justify-items-center gap-2 text-center">
                  <p className="text-muted-foreground">We could not load free times.</p>
                  <button
                    type="button"
                    onClick={() => loadTimes(service, date)}
                    className={`${target} min-h-12 rounded-full border border-border px-6 font-medium`}
                  >
                    Try again
                  </button>
                </div>
              )}
              {date && times?.length === 0 && (
                <p className="mt-6 text-center text-muted-foreground">No free times on this day. Try another.</p>
              )}
              {date && !!times?.length && (
                <div role="group" aria-label="Available times" className="mt-5 grid grid-cols-4 gap-2" aria-busy={pending}>
                  {times.map((t) => (
                    <button
                      key={t}
                      type="button"
                      data-start={t}
                      aria-pressed={start === t}
                      onClick={() => {
                        setStart(t);
                        go(2);
                      }}
                      className={`${target} rounded-lg border border-border font-mono text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground`}
                    >
                      {showTime(t)}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-4 text-center text-xs text-muted-foreground">Times are UK local time.</p>
            </>
          )}

          {step === 2 && (
            <form noValidate onSubmit={submitDetails} className="space-y-4">
              {(
                [
                  ["name", "Name", "text", "name", undefined],
                  ["phone", "Phone", "tel", "tel", "tel"],
                  ["email", "Email (optional)", "email", "email", "email"],
                ] as const
              ).map(([key, label, type, autoComplete, inputMode]) => (
                <div key={key}>
                  <label htmlFor={`f-${key}`} className="text-sm font-medium">
                    {label}
                  </label>
                  <input
                    id={`f-${key}`}
                    type={type}
                    autoComplete={autoComplete}
                    inputMode={inputMode}
                    value={details[key]}
                    onChange={(e) => setDetails({ ...details, [key]: e.target.value })}
                    aria-invalid={!!errors[key]}
                    aria-describedby={errors[key] ? `e-${key}` : undefined}
                    className={field}
                  />
                  {errors[key] && (
                    <p id={`e-${key}`} className="mt-1 text-sm text-destructive">
                      {errors[key]}
                    </p>
                  )}
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                We use your name, phone and email only to manage your appointment. See our{" "}
                <a href="/privacy" target="_blank" className="text-primary underline underline-offset-4">
                  Privacy notice
                </a>
                .
              </p>
              <button type="submit" className={`${target} min-h-12 w-full rounded-full bg-primary font-medium text-primary-foreground`}>
                Continue
              </button>
            </form>
          )}

          {step === 3 && service && start && (
            <>
              <dl className="divide-y divide-border border-y border-border">
                {[
                  ["Service", service.name],
                  ["When", `${day(date!).toFormat("cccc d LLLL")}, ${showTime(start)}`],
                  ["Name", details.name.trim()],
                  ["Phone", details.phone.trim()],
                  ...(details.email.trim() ? [["Email", details.email.trim()]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right break-all">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-muted-foreground">Pay in the shop. You can cancel from your booking page.</p>
              <button
                type="button"
                onClick={confirm}
                disabled={pending}
                className={`${target} mt-5 min-h-12 w-full rounded-full bg-primary font-medium text-primary-foreground disabled:opacity-60`}
              >
                {pending ? "Booking…" : "Confirm booking"}
              </button>
            </>
          )}
        </div>

        {service && (
          <aside
            aria-label="Your booking"
            className="sticky bottom-0 mt-auto rounded-t-2xl border-t border-primary/50 bg-background/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:rounded-b-3xl"
          >
            <div className="flex items-baseline gap-3">
              <span className="flex-1 truncate">{service.name}</span>
              <span className="font-mono text-sm text-muted-foreground">{service.duration_min} min</span>
              <span className="font-mono text-lg text-primary">{formatPrice(service.price_pence)}</span>
            </div>
            {date && (
              <p className="text-sm text-muted-foreground">
                {day(date).toFormat("ccc d LLL")}
                {start && `, ${showTime(start)}`}
              </p>
            )}
          </aside>
        )}
      </section>
    </div>
  );
}
