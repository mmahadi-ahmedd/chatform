#!/usr/bin/env bash
# Paste-able: commits Task 2 in logical steps. Run from the repo root in Git Bash.
set -u
c() { msg="$1"; shift; git add -A -- "$@" 2>/dev/null; git commit -q -m "$msg" || true; }
c "db: schema upgrade for roles, question config/logic, uploads, events, deliveries, logs" schema.sql scripts/setup-db.mjs
c "lib: core helpers (crypto, env, logger, rate limit, http, safe url)" src/lib/crypto.ts src/lib/env.ts src/lib/logger.ts src/lib/ratelimit.ts src/lib/http.ts src/lib/safeurl.ts src/lib/uuid.ts
c "lib: question types, logic engine and server-side validation" src/lib/types.ts src/lib/logic.ts src/lib/validate.ts src/lib/formschema.ts
c "lib: auth, guards and form persistence" src/lib/auth.ts src/lib/guard.ts src/lib/adminGuard.ts src/lib/admin.ts src/lib/forms.ts src/lib/client.ts
c "feat: templates, CSV export and analytics queries" src/lib/templates.ts src/lib/csv.ts src/lib/analytics.ts src/lib/files.ts
c "feat: email and webhook delivery with retries and delivery log" src/lib/mail.ts src/lib/deliver.ts
c "security: CSRF middleware and response headers" src/middleware.ts next.config.mjs
c "api: auth, forms, duplicate, presets and admin endpoints" src/app/api
c "ui: chatbot v2 with all question types, progress and restart" src/components/ChatBot.tsx src/components/PublicChat.tsx src/components/DemoWidget.tsx src/app/f src/app/widget
c "widget: embed.js v2 floating/inline modes" public/embed.js
c "ui: form editor, design panel, preview, share" src/components/FormEditor.tsx src/components/editor
c "ui: dashboard search/sort/filter, toasts, charts" src/components/Dashboard.tsx src/components/Toasts.tsx src/components/Charts.tsx src/app/dashboard src/app/globals.css src/app/layout.tsx tailwind.config.ts
c "ui: admin dashboard" src/components/AdminShell.tsx src/components/UsersTable.tsx src/components/AuthForm.tsx src/app/admin src/app/login src/app/signup src/app/page.tsx
c "scripts: make-admin and integration test runner" scripts package.json package-lock.json
c "test: unit tests" tests/unit tests/setup.ts vitest.config.ts
c "test: integration helpers and auth tests" tests/integration/helpers.ts tests/integration/auth.test.ts
c "test: forms, validation and upload tests" tests/integration/forms.test.ts
c "test: cross-user isolation and RBAC tests" tests/integration/security.test.ts
c "test: analytics, integrations, admin and embed tests" tests/integration
c "docs: env example" .env.example
c "docs: README and test results" README.md TEST_RESULTS.md
git add -A && git commit -q -m "chore: final touches" || true
git log --oneline | head -25
echo "Now run: git push"
