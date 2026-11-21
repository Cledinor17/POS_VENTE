# POS go-live checklist — 21 Nov 2026

These fixes preserve the existing POS modules and accounting rules. They are NOT
automatically deployed by opening/merging a pull request. Always test against
a staging copy or a recent backup before updating the live VPS.

## Included in this patch

- Cache the **already visited** POS shell (not login or API) so a cashier can
  reload the same POS URL during a temporary outage.
- Recover a recent authenticated identity, *that user's* authorized branches,
  open cash session and POS settings only if the network is unavailable.
  Snapshots expire after 12 hours. Never save approval passwords.
- Preserve offline sales in IndexedDB; the server checks permissions, stock,
  currencies, ownership and session state on resynchronization.
- Reject explicit unknown/inactive branch IDs rather than silently booking
  a sale in Main.
- Frontend and Laravel CI/test workflows; no production database migration
  was added by this patch.

## Required first-time online setup on EACH cashier device

1. Sign in with the real cashier account while connected to the API.
2. Choose the correct business and branch.
3. Open the cash session online; visit the POS page and load the product
   catalog and currency settings while connected.
4. Confirm the Service Worker is active and the POS route was opened online.
   Test with the browser devtools offline setting. A first-ever visit without
   Internet is NOT supported.
5. Make one test offline sale with a low-risk sample SKU. The provisional
   receipt number begins with OFFLINE-. **That is not a confirmed invoice.**
6. Reconnect and reconcile the queued sale with the server invoice, stock,
   payment and receipt number before closing that cashier session.

## Important limitations

- A browser cannot see another offline device's queue. Do not close a cashier
  session from another device until all terminals have synchronized.
- Cached permissions and cash-session state are provisional, not current
  authorization. A revoked user, closed session or missing stock can cause
  the server to reject the queued sale. Review the Pending Sales screen.
- A cached branch, user or POS configuration expires after 12 hours; reconnect
  and refresh it before resuming operation.
- IndexedDB is local to the browser/profile. Do not clear site data or switch
  browser profiles with unsynced sales; keep a backup procedure for terminals.
- Cash register sessions still must be opened online; offline first login and
  offline initial register opening are intentionally unsupported.
- Offline rates/catalog can become stale; reconcile discrepancies with the
  manager instead of silently altering payments.

## Run tests before merging

Frontend: `npm ci && npm test && npm run lint && npm run build`.
Backend: `composer install && php artisan test --compact` (isolated test DB).
CI workflows are added to both pull requests; inspect actual green checks.

## Production deployment (after checks pass)

1. Confirm the API is reachable from the cashier network. Decide the correct
   live API host (e.g. `https://posapi.haytinumeric.com`), then make
   `NEXT_PUBLIC_API_BASE_URL`, Nginx, CORS and WebSocket settings consistent.
   The existing deployment examples mention another host; do not copy them
   blindly into production.
2. Back up the live database, storage, application configurations and env
   files; verify an off-server copy and a restore in an isolated environment.
3. Deploy backend and frontend from reviewed commits together. Check
   `php artisan migrate:status`; this patch does NOT require a new migration.
   Do not use `migrate:fresh` on the production database.
4. Install dependencies/build Next.js and restart the relevant PHP-FPM,
   Next.js, queue and Reverb services under the existing process manager.
   Check scheduler, off-server backups, TLS and monitoring.
5. Validate online and offline flows on an actual cashier device, including
   physical 58/80 mm printing, a scanner, multi-currency calculations,
   branch stock, duplicate retries, pending queue and cashier closeout.
6. Keep the prior release ready for rollback. Do not delete IndexedDB
   while offline sales are pending.

This is an engineering readiness checklist, not evidence that production was
deployed, that all tests passed, or that physical peripherals worked.
