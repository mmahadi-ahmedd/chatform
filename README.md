# 💬 ChatForm

Build conversational forms, share them as a link, or embed them as a chat widget with one line of code.
Next.js 14 (App Router) · TypeScript · Tailwind · PostgreSQL.

**Live demo:** https://chatform-five.vercel.app · **Repo:** https://github.com/mmahadi-ahmedd/chatform

## Features

**Form builder** – 8 question types (text, email, multiple choice, dropdown, yes/no, rating, date, file upload) · conditional logic ("show only if…") · 5 starter templates · duplicate forms · live preview · per-question validation (length, regex, rating scale, date range) · custom welcome and success messages · autosave and draft recovery.

**Widget** – floating or inline · colour, avatar, left/right position, welcome message · progress bar · restart · full-screen on mobile · works on any external site.

**Analytics** – views, starts, completions, completion and abandonment rates, per-question stats, daily chart, date filter, CSV export.

**Notifications** – email on each response (Resend) and signed webhooks, with a delivery log, automatic retry and a manual Retry button.

**Dashboard** – search, sort and filter forms and responses; loading, empty, success and error states; keyboard and screen-reader friendly; saved design presets.

**Admin** – platform stats, user search, suspend/reactivate, activity log and error log. Role-based access.

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in DATABASE_URL and AUTH_SECRET
npm run db:setup                # creates / upgrades all tables (safe to re-run)
npm run dev                     # http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (Supabase: transaction pooler URI) |
| `DATABASE_SSL` | for hosted DB | `true` for Supabase |
| `AUTH_SECRET` | yes | signs login cookies (`openssl rand -base64 32`) |
| `ADMIN_EMAILS` | no | comma-separated emails that become administrators |
| `RESEND_API_KEY`, `MAIL_FROM` | no | enable email notifications; without a key deliveries show "skipped" |
| `APP_URL` | no | public URL used in notification emails |
| `ENCRYPTION_KEY` | no | encrypts webhook secrets (falls back to a key derived from `AUTH_SECRET`) |
| `ALLOW_PRIVATE_WEBHOOKS` | tests only | **never** set in production; disables the SSRF guard |

### Upgrading an existing database
Run `npm run db:setup` once against the production database. It is idempotent and keeps all Task 1 data.

### Creating an admin
Either set `ADMIN_EMAILS=you@example.com` (promoted at next login) or run `npm run make-admin -- you@example.com`. Admin pages are at `/admin`.

## Deploy to Vercel
Add the env vars above in Project → Settings → Environment Variables, run `npm run db:setup` against Supabase, then redeploy.

## Embedding

```html
<script src="https://chatform-five.vercel.app/embed.js" data-form="YOUR_SLUG" async></script>
```

| Attribute | Values | Default |
|---|---|---|
| `data-mode` | `floating`, `inline` | `floating` |
| `data-position` | `left`, `right` | the form's setting |
| `data-target` | CSS selector (inline mode) | script's position |
| `data-height` | px (inline mode) | `560` |
| `data-open` | `true` opens on load | `false` |
| `data-teaser` | text for the bubble | welcome message |

## Webhooks
Each POST is JSON (`event: "response.created"`) with headers `X-ChatForm-Event`, `-Delivery`, `-Timestamp`, `-Signature`.
Verify: `signature === "sha256=" + HMAC_SHA256(secret, timestamp + "." + rawBody)` (hex). The secret (`whsec_…`) is shown once. Reject old timestamps to prevent replays.
Failed deliveries are retried once automatically; use **Retry** in the Integrations tab for more.

## Security
- bcrypt (cost 12) passwords; JWT session in an HttpOnly, SameSite=Lax cookie (Secure in production); generic login errors.
- Every owner endpoint checks ownership in SQL and returns **404** for other people's data.
- Admin pages return 404 for non-admins; admins can't suspend themselves or other admins; suspended users are signed out immediately.
- Server-side validation (zod + per-question rules, hidden-question answers discarded, ReDoS-safe patterns).
- Rate limits (Postgres-backed): signup, login (per IP and per account), submissions, uploads, events.
- Spam: honeypot field, duplicate-submission blocking, hashed IPs.
- CSRF origin checks, security headers, framing allowed only for the widget page.
- Webhooks: HTTPS only, no credentials in URL, private/loopback IPs blocked, redirects not followed, 5 s timeout, secrets AES-256-GCM encrypted.
- Uploads: 2 MB, type allow-list + magic-byte check, owner-only download as attachment.
- CSV export guards against spreadsheet formula injection.

## Tests

```bash
npm test                # 39 unit tests
npm run build && npm run test:integration   # 49 integration tests (needs a local Postgres + DATABASE_URL)
npm run test:all
```
Integration tests boot the production build, mock webhook/email servers, and cover auth, RBAC, cross-user isolation, validation, logic, uploads, analytics, CSV, integrations, admin and embedding. See `TEST_RESULTS.md`.

## Project structure
```
src/app            pages and API routes (api/forms, api/public, api/admin …)
src/components     ChatBot, FormEditor (+ editor/ tabs), Dashboard, admin UI
src/lib            auth, validation, logic, analytics, deliver, ratelimit, crypto …
public/embed.js    the embeddable widget loader
schema.sql         tables + idempotent upgrades
scripts/           setup-db, make-admin, test-integration
tests/             unit/ and integration/
```

## Limitations
- Email needs a Resend API key (no key → logged as skipped).
- Uploads are stored in Postgres (2 MB cap) and Vercel limits request bodies to 4.5 MB; use object storage for heavier use.
- Rate limits fail open if the database is unreachable, so the form keeps working.
- Analytics days are UTC.
