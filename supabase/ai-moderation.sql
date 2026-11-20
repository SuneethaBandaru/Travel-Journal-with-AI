-- AI comment moderation: run this ONCE in Supabase → SQL Editor → New query → Run
-- Adds columns where the moderation agents store their decision for every comment.

alter table public.comments
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'hidden')),
  add column if not exists moderation_category text,
  add column if not exists moderation_reason text,
  add column if not exists moderated_by text;

create index if not exists comments_moderation_status_idx on public.comments (moderation_status);
