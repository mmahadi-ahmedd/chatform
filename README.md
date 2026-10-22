# 💬 ChatForm

Build chat-style forms, embed a floating chatbot widget on any website, collect responses and manage them from a dashboard.

**Stack:** Next.js 14 (App Router) · React · TypeScript · Tailwind CSS · Next.js API routes · PostgreSQL (works with Supabase) · Git/GitHub

## Features
- Responsive landing page (hero, features, how it works, live widget demo, footer)
- Email/password auth (bcrypt + signed httpOnly JWT cookie)
- Dashboard: total forms / published / responses, create, edit, delete, publish/unpublish
- Form builder: text, email, multiple choice, yes/no · edit, reorder, delete · required toggle · live chat preview
- Chatbot widget: one question at a time, buttons for choices, validation (client + server), welcome/completion messages, custom color
- Public form link: `/f/<slug>` · Embeddable floating widget: one `<script>` tag
- Responses stored in PostgreSQL with timestamps, viewable in the dashboard

## Quick start

```bash
git clone <your-repo-url> && cd chatform
npm install
cp .env.example .env.local     # then fill in the values
npm run db:setup               # creates the tables
npm run dev                    # https://chatform-five.vercel.app/
```

### Environment variables
| Name | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `DATABASE_SSL` | `true` for Supabase / hosted Postgres |
| `AUTH_SECRET` | Long random string (`openssl rand -base64 32`) |

### Using Supabase
1. Create a project at https://supabase.com
2. Project Settings → Database → copy the **connection string** (use the *Transaction pooler* URI for Vercel)
3. Put it in `DATABASE_URL`, set `DATABASE_SSL=true`
4. Run `npm run db:setup` (or paste `schema.sql` into the Supabase SQL editor)

## Deploy to Vercel
1. Push the repo to GitHub, import it at https://vercel.com/new
2. Add the three environment variables above
3. Deploy. Make sure the schema has been created in your database (`npm run db:setup` locally with the production `DATABASE_URL`)

## How to use
1. Sign up → **New form** → add questions → **Save & publish**
2. Open the **Share & embed** tab: copy the public link or the snippet
3. Paste the snippet before `</body>` on any website:
   ```html
   <script src="https://YOUR-APP-URL/embed.js" data-form="FORM_SLUG" async></script>
   ```
   Optional attributes: `data-position="left"`, `data-color="#ff6600"` (fallback color).
4. Answers appear in the form's **Responses** tab.

## Project structure
```
schema.sql                 database tables
scripts/setup-db.mjs       applies schema.sql
public/embed.js            the embeddable widget loader (floating button + iframe)
src/app/                   pages: landing, login, signup, dashboard, /f/[slug], /widget/[slug]
src/app/api/               auth, forms CRUD, public form + response submission
src/components/            ChatBot (chat UI), FormEditor, Dashboard, ...
src/lib/                   db, auth, validation (shared by browser and server)
```

## How the widget works
`embed.js` adds a floating button and an iframe pointing to `/widget/<slug>` on your app, so styles never clash with the host website. On phones (≤480px) the chat opens full screen.

## Notes / limitations (MVP)
- Editing a form replaces its questions; older responses keep a snapshot of the question text.
- No rate limiting on public submissions yet (add one before heavy production use).
- No email verification or password reset.
