-- My Tasks v9 authentication + private per-user data setup
-- Run this ONCE in Supabase -> SQL Editor BEFORE opening public registration.

begin;

grant usage on schema public to authenticated, service_role;

-- 1) Secure tasks by user.
alter table public.tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists tasks_user_id_idx on public.tasks(user_id);

alter table public.tasks enable row level security;

-- Remove every old tasks policy, including the previous public anon policy.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname='public' and tablename='tasks'
  loop
    execute format('drop policy if exists %I on public.tasks', p.policyname);
  end loop;
end $$;

revoke all on table public.tasks from anon, authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.tasks to service_role;

create policy "Users can view own tasks"
on public.tasks for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own tasks"
on public.tasks for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own tasks"
on public.tasks for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own tasks"
on public.tasks for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- 2) Per-user notification settings.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reminder_notifications boolean not null default true,
  due_today_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

-- Remove old policies if script is re-run.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname='public' and tablename='user_settings'
  loop
    execute format('drop policy if exists %I on public.user_settings', p.policyname);
  end loop;
end $$;

revoke all on table public.user_settings from anon, authenticated;
grant select, insert, update, delete on table public.user_settings to authenticated;
grant select, insert, update, delete on table public.user_settings to service_role;

create policy "Users can view own settings"
on public.user_settings for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own settings"
on public.user_settings for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own settings"
on public.user_settings for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own settings"
on public.user_settings for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- 3) Lock the legacy global settings table away from browser users.
-- Keep it temporarily so your existing settings can be copied during migration.
do $$
begin
  if to_regclass('public.app_settings') is not null then
    execute 'revoke all on table public.app_settings from anon, authenticated';
    execute 'grant select on table public.app_settings to service_role';
  end if;
end $$;

commit;
