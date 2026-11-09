# Privacy operations

UK GDPR erasure and retention for customer bookings. SQL in `supabase/migrations/014_privacy.sql`, tests in
`supabase/tests/privacy.sql`. Public wording: `/privacy` and `/cookies` (see `docs/launch-checklist.md` for the
legal review still needed).

## Personal data held

`bookings.customer_name`, `bookings.phone`, `bookings.email`. Also scrubbed on erasure/retention:
`booking_changes.reason` (owner free text that may name the customer, set to NULL) and `notifications.error`
(provider text that could echo a number). `booking_changes` times and `notifications` kinds/statuses stay. Owner accounts live in Supabase Auth and are not covered here.

## Erasure: "Delete my data" (customer booking page)

`/booking/<token>` -> server action `deleteMyData` -> `anonymise_customer_by_token(p_token uuid)`
(SECURITY DEFINER, `search_path = ''`, executable by anon/authenticated).

For EVERY booking with the same phone as the token's booking:
- `customer_name = 'Deleted customer'`, `email = ''`, `phone = 'deleted-<8 random hex>'` (random per row: not
  reversible and the rows cannot be linked back together; `phone` is NOT NULL so it is never blanked);
- upcoming `pending`/`confirmed` bookings are cancelled with `cancelled_by = 'customer'`, so no shop-cancel
  notice is sent (and the placeholder phone is not E.164, so nothing could be sent anyway);
- `cancel_token` is rotated, so every old manage link answers 404;
- `booking_changes.reason` set to NULL for those bookings (migration 015);
- the rows themselves stay, so the diary and takings stay correct.

**Not erased:** copies already held by our processors. Sent SMS (body includes the manage link, recipient number)
stay in Twilio's message logs (kept until deleted; Twilio redacts/deletes on request or via its API) and sent
emails stay in Resend's logs (kept for a limited period per Resend's plan/retention settings). For a full erasure
request, also delete the customer's messages in the Twilio console and Resend dashboard, and check each provider's
current retention terms before launch (docs/launch-checklist.md).

Returns `{"ok":true,"anonymised":n}`; an unknown token returns `{"ok":false,"reason":"not_found"}` and reveals nothing.

**Trade-off:** anyone holding a booking link can erase that phone number's bookings. Accepted: the link is a bearer
credential sent only to the customer (it can already cancel the booking), and erasure loses no diary data.

Requests by phone or email instead (no link): the owner can do the same in the SQL editor:
```sql
select anonymise_customer_by_token(cancel_token) from bookings where phone = '+447...' limit 1;
```

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

## Backups

Anonymised data still exists in database backups until they expire (Supabase Pro keeps daily backups for 7 days).
Say so if a customer asks; do not restore an old backup without re-running erasures made since.
