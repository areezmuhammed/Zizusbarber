# Privacy operations

UK GDPR erasure and retention for customer bookings. SQL in `supabase/migrations/014_privacy.sql` (erasure
replaced in `016_hardening.sql`), tests in
`supabase/tests/privacy.sql`. Public wording: `/privacy` and `/cookies` (see `docs/launch-checklist.md` for the
legal review still needed).

## Personal data held

`bookings.customer_name`, `bookings.phone`, `bookings.email`. Also scrubbed on erasure/retention:
`booking_changes.reason` (owner free text that may name the customer, set to NULL) and `notifications.error`
(provider text that could echo a number). `booking_changes` times and `notifications` kinds/statuses stay. Owner accounts live in Supabase Auth and are not covered here.

## Erasure: "Delete my data" (customer booking page)

`/booking/<token>` -> server action `deleteMyData` -> `anonymise_customer_by_token(p_token uuid)`
(SECURITY DEFINER, `search_path = ''`, executable by anon/authenticated). Final definition:
`supabase/migrations/016_hardening.sql`.

For ONLY the booking the token belongs to:
- `customer_name = 'Deleted customer'`, `email = ''`, `phone = 'deleted-<8 random hex>'` (random: not reversible
  and not linkable; `phone` is NOT NULL so it is never blanked);
- if it is upcoming (`pending`/`confirmed`, starts in the future) it is cancelled with `cancelled_by = 'customer'`,
  so no shop-cancel notice is sent (and the placeholder phone is not a UK number, so nothing could be sent anyway);
- `cancel_token` is rotated, so the old manage link answers 404;
- `booking_changes.reason` set to NULL and `notifications.error` cleared for that booking;
- the row itself stays, so the diary and takings stay correct.

Other bookings with the same phone are NOT touched. Phones are not verified, so before 016 a stranger could book
any slot with a victim's number and then "Delete my data" on their own link to wipe and silently cancel the
victim's bookings. Erasing everything held about a person is therefore an owner job after verification (below).

Returns `{"ok":true,"anonymised":1}`; an unknown token returns `{"ok":false,"reason":"not_found"}` and reveals nothing.

**Not erased:** copies already held by our processors. Sent SMS (body includes the manage link, recipient number)
stay in Twilio's message logs (kept until deleted; Twilio redacts/deletes on request or via its API) and sent
emails stay in Resend's logs (kept for a limited period per Resend's plan/retention settings). For a full erasure
request, also delete the customer's messages in the Twilio console and Resend dashboard, and check each provider's
current retention terms before launch (docs/launch-checklist.md).

**Request logs:** Vercel request logs (and any CDN or proxy logs in front of the site) record request paths,
including `/booking/<token>`. A token links to one customer's booking, so treat these logs as personal data:
they are kept for the Vercel plan's log retention period (short on Hobby/Pro unless a log drain is added) and
any log drain must have its own retention set. Analytics never loads on `/booking/*`, `/admin/*` or `/auth/*`.

## Erasure: whole customer (owner, after verification)

When someone asks (by phone, email or in the shop) to delete everything held about them:

1. Verify it is them: call them back on the phone number the bookings were made with. Do not act on an email or
   a message from another number alone.
2. In the Supabase SQL editor, look first (read only; replace the number, stored form `+44...`):
   ```sql
   select id, customer_name, start_at, status from bookings where phone = '+447...' order by start_at;
   ```
3. Erase. The block below is a dry run by default (`v_apply := false` rolls back); change it to `true` only when
   the list from step 2 is the right person:
   ```sql
   do $$
   declare
     v_phone text := '+447...';   -- the verified number
     v_apply boolean := false;    -- dry run: set true to keep the changes
     n int := 0;
     t uuid;
   begin
     for t in select cancel_token from public.bookings where phone = v_phone loop
       perform public.anonymise_customer_by_token(t);
       n := n + 1;
     end loop;
     raise notice '% booking(s) anonymised for %', n, v_phone;
     if not v_apply then raise exception 'dry run: rolled back (set v_apply := true to keep)'; end if;
   end $$;
   ```
   Each booking gets the same treatment as "Delete my data" (upcoming ones are cancelled as `customer`, so no
   shop-cancel message is sent: tell the customer yourself that those appointments are cancelled).
4. Delete their messages in Twilio and Resend (see "Not erased" above). Reply within one month.

## Stopping reminders (objection)

`bookings.reminders_off` (migration 015). When true the notify job sends no `reminder_24h` / `reminder_2h` for
that booking; the confirmation, change and shop-cancel notices still go (they are about the booking itself).
- Customer: **Stop reminder messages** on `/booking/<token>` -> `set_reminders_off_by_token(p_token uuid)`
  (SECURITY DEFINER, anon/authenticated, unknown token -> `not_found`). Per booking.
- Owner, in the app: open the booking in the day view and press **Stop reminders** (toggle; press again to turn
  them back on).
- Owner, for every booking of one customer (e.g. they asked by phone):
  ```sql
  update bookings set reminders_off = true where phone = '+447...' and start_at > now();
  ```
  Bookings made later start with reminders on again; repeat if needed.

## Retention: 2 years

`anonymise_old_bookings(p_older_than interval default '2 years')` anonymises (same fields, token rotated) every
booking that ENDED more than the interval ago (any status) and is not anonymised yet, scrubbing its
`booking_changes.reason` too; returns the count. Executable by the
service role only (revoked from public, anon and authenticated). Keep the default in step with
`shopConfig.privacy.retentionYears`, which the privacy notice shows.

Scheduled by the migration (pg_cron, enabled in `012_notify_cron.sql`); no secrets involved:
```sql
select cron.schedule('anonymise-old-bookings', '15 3 * * *', $job$select public.anonymise_old_bookings()$job$);
```
Check it: `select * from cron.job where jobname = 'anonymise-old-bookings';` and
`select * from cron.job_run_details where command like '%anonymise_old_bookings%' order by start_time desc limit 5;`.
Run by hand: `select anonymise_old_bookings();` (or `anonymise_old_bookings('3 years')`).
Stop it: `select cron.unschedule('anonymise-old-bookings');`.

## Anti-abuse log (`public_booking_log`)

`017_booking_abuse_limits.sql` adds `public_booking_log`: md5 of the phone plus a timestamp, written only for public (non-owner)
bookings, RLS locked (no anon/authenticated access) and purged inside `create_booking` once older than 24 hours. It
drives the per-phone and shop-wide caps. "Delete my data" does not remove it, by design: erasing it would let an
attacker erase-and-rebook to dodge the cap. It holds an unsalted md5 of the phone, which is pseudonymised personal data
(UK mobile numbers are enumerable, so do not call it irreversible) and is described that way in the privacy notice
(legitimate interests: preventing misuse). Purged at three points: opportunistically inside `create_booking`, and by the
hourly pg_cron job `purge-public-booking-log` (`018_purge_booking_log.sql`, `public.purge_public_booking_log()`,
service role only). Check: `select * from cron.job where jobname = 'purge-public-booking-log';`. Clear by hand with
`delete from public_booking_log;`.

## Backups

Anonymised data still exists in database backups until they expire (Supabase Pro keeps daily backups for 7 days).
Say so if a customer asks; do not restore an old backup without re-running erasures made since.
