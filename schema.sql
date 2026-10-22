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
