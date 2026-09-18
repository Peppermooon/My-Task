-- Run once in Supabase -> SQL Editor.
-- Stores global settings for this personal app.

create table if not exists public.app_settings (
  id text primary key,
  reminder_notifications boolean not null default true,
  due_today_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, reminder_notifications, due_today_notifications)
values ('default', true, true)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

grant select, insert, update on table public.app_settings to anon;
grant select, insert, update on table public.app_settings to service_role;

drop policy if exists "Allow public settings read" on public.app_settings;
create policy "Allow public settings read"
on public.app_settings for select to anon
using (true);

drop policy if exists "Allow public settings update" on public.app_settings;
create policy "Allow public settings update"
on public.app_settings for update to anon
using (id = 'default')
with check (id = 'default');

drop policy if exists "Allow public settings insert" on public.app_settings;
create policy "Allow public settings insert"
on public.app_settings for insert to anon
with check (id = 'default');
