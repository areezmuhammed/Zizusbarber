# Privacy operations

UK GDPR erasure and retention for customer bookings. SQL in `supabase/migrations/014_privacy.sql`, tests in
`supabase/tests/privacy.sql`. Public wording: `/privacy` and `/cookies` (see `docs/launch-checklist.md` for the
legal review still needed).

## Personal data held

`bookings.customer_name`, `bookings.phone`, `bookings.email`. Nothing else holds customer PII: `booking_changes`
holds times only; `notifications` holds kinds/statuses, plus a provider `error` text that could echo a number,
so erasure clears it. Owner accounts live in Supabase Auth and are not covered here.

## Erasure: "Delete my data" (customer booking page)

`/booking/<token>` -> server action `deleteMyData` -> `anonymise_customer_by_token(p_token uuid)`
(SECURITY DEFINER, `search_path = ''`, executable by anon/authenticated).

For EVERY booking with the same phone as the token's booking:
- `customer_name = 'Deleted customer'`, `email = ''`, `phone = 'deleted-<8 random hex>'` (random per row: not
  reversible and the rows cannot be linked back together; `phone` is NOT NULL so it is never blanked);
- upcoming `pending`/`confirmed` bookings are cancelled with `cancelled_by = 'customer'`, so no shop-cancel
  notice is sent (and the placeholder phone is not E.164, so nothing could be sent anyway);
- `cancel_token` is rotated, so every old manage link answers 404;
- the rows themselves stay, so the diary and takings stay correct.

Returns `{"ok":true,"anonymised":n}`; an unknown token returns `{"ok":false,"reason":"not_found"}` and reveals nothing.

**Trade-off:** anyone holding a booking link can erase that phone number's bookings. Accepted: the link is a bearer
credential sent only to the customer (it can already cancel the booking), and erasure loses no diary data.

Requests by phone or email instead (no link): the owner can do the same in the SQL editor:
```sql
select anonymise_customer_by_token(cancel_token) from bookings where phone = '+447...' limit 1;
```

## Retention: 2 years

`anonymise_old_bookings(p_older_than interval default '2 years')` anonymises (same fields, token rotated) every
booking that ENDED more than the interval ago and is not anonymised yet; returns the count. Executable by the
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
