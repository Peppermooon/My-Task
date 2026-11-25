-- My Tasks: Continuous Follow-up Reminders
-- Run this ONCE in Supabase -> SQL Editor before deploying the updated website/function.
-- Safe to run again: all columns/indexes are added only if missing.

begin;

alter table public.tasks
  add column if not exists continuous_reminders_enabled boolean not null default false,
  add column if not exists continuous_reminder_interval_days integer,
  add column if not exists continuous_reminder_time time without time zone,
  add column if not exists continuous_reminder_next_date date;

-- Restrict repeat intervals to the choices offered by the app.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_continuous_reminder_interval_check'
  ) then
    alter table public.tasks
      add constraint tasks_continuous_reminder_interval_check
      check (continuous_reminder_interval_days is null
        or continuous_reminder_interval_days in (1, 2, 3, 5, 7));
  end if;
end $$;

create index if not exists tasks_continuous_reminders_due_idx
  on public.tasks (continuous_reminder_next_date, continuous_reminder_time)
  where continuous_reminders_enabled = true;

alter table public.user_settings
  add column if not exists continuous_reminder_notifications boolean not null default true;

commit;

-- Verification: should show the four task columns and the new user setting column.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'tasks' and column_name like 'continuous_reminder%')
    or (table_name = 'user_settings' and column_name = 'continuous_reminder_notifications'))
order by table_name, ordinal_position;
