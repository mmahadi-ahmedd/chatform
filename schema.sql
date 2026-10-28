create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  description text not null default '',
  slug text not null unique,
  published boolean not null default false,
  welcome_message text not null default 'Hi there! 👋 Got a minute to answer a few quick questions?',
  completion_message text not null default 'Thanks! Your response has been recorded. 🎉',
  primary_color text not null default '#4f46e5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists forms_user_idx on forms(user_id);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  position int not null,
  type text not null check (type in ('text','email','choice','yesno')),
  label text not null,
  required boolean not null default true,
  options jsonb not null default '[]'::jsonb
);
create index if not exists questions_form_idx on questions(form_id, position);

create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  answers jsonb not null,
  submitted_at timestamptz not null default now()
);
create index if not exists responses_form_idx on responses(form_id, submitted_at desc);

-- =====================================================================
-- Task 2 upgrade (idempotent: safe to run again on an existing database)
-- =====================================================================

-- Roles, suspension, activity
alter table users add column if not exists role text not null default 'user';
alter table users add column if not exists suspended boolean not null default false;
alter table users add column if not exists last_login_at timestamptz;
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('user','admin'));

-- Chatbot design + integrations (webhook secret is stored encrypted, never in plain text)
alter table forms add column if not exists avatar text not null default '💬';
alter table forms add column if not exists position text not null default 'right';
alter table forms add column if not exists notify_enabled boolean not null default false;
alter table forms add column if not exists notify_email text not null default '';
alter table forms add column if not exists webhook_url text not null default '';
alter table forms add column if not exists webhook_secret_enc text not null default '';
alter table forms drop constraint if exists forms_position_check;
alter table forms add constraint forms_position_check check (position in ('left','right'));

-- New question types, per-type config, conditional logic
alter table questions drop constraint if exists questions_type_check;
alter table questions add constraint questions_type_check
  check (type in ('text','email','choice','yesno','dropdown','rating','date','file'));
alter table questions add column if not exists config jsonb not null default '{}'::jsonb;
alter table questions add column if not exists logic jsonb;

-- Spam protection: hashed IP (never the raw address)
alter table responses add column if not exists ip_hash text;
create index if not exists responses_dedupe_idx on responses(form_id, ip_hash, submitted_at desc);

-- File uploads (small files stored in Postgres, served only to the form owner)
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  filename text not null,
  mime text not null,
  size int not null,
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists uploads_form_idx on uploads(form_id);

-- Rate limiting (fixed windows, works on serverless)
create table if not exists rate_limits (
  key text not null,
  window_start bigint not null,
  count int not null default 0,
  expires_at bigint not null,
  primary key (key, window_start)
);
create index if not exists rate_limits_expires_idx on rate_limits(expires_at);

-- Analytics events (view / start); completions come from the responses table
create table if not exists form_events (
  id bigserial primary key,
  form_id uuid not null references forms(id) on delete cascade,
  type text not null check (type in ('view','start')),
  sid text not null,
  created_at timestamptz not null default now(),
  unique (form_id, sid, type)
);
create index if not exists form_events_form_idx on form_events(form_id, created_at);

-- Delivery log for email + webhook notifications
create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  response_id uuid references responses(id) on delete cascade,
  kind text not null check (kind in ('email','webhook')),
  status text not null check (status in ('success','failed','skipped')),
  attempts int not null default 1,
  status_code int,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deliveries_form_idx on deliveries(form_id, created_at desc);

-- Platform activity + error reports (admin dashboard)
create table if not exists activity_log (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_created_idx on activity_log(created_at desc);

create table if not exists error_log (
  id bigserial primary key,
  source text not null,
  message text not null,
  stack text,
  created_at timestamptz not null default now()
);
create index if not exists error_log_created_idx on error_log(created_at desc);

-- Reusable design settings
create table if not exists design_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  primary_color text not null,
  avatar text not null default '💬',
  position text not null default 'right',
  welcome_message text not null,
  completion_message text not null,
  created_at timestamptz not null default now()
);
create index if not exists design_presets_user_idx on design_presets(user_id);
