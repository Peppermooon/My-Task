-- Run this AFTER you create/sign in to YOUR account.
-- Supabase -> Authentication -> Users -> copy your User UID.
-- Replace every YOUR_USER_UUID below with that exact UUID.
-- This assigns only the old unowned rows; it never takes another user's tasks.

begin;

update public.tasks
set user_id = 'YOUR_USER_UUID'::uuid
where user_id is null;

-- First ensure your per-user settings row exists with safe defaults.
insert into public.user_settings (user_id, reminder_notifications, due_today_notifications)
values ('YOUR_USER_UUID'::uuid, true, true)
on conflict (user_id) do nothing;

-- If the old global settings table exists, copy your previous notification choices.
do $$
begin
  if to_regclass('public.app_settings') is not null then
    execute format($q$
      update public.user_settings u
      set reminder_notifications = a.reminder_notifications,
          due_today_notifications = a.due_today_notifications,
          updated_at = now()
      from public.app_settings a
      where u.user_id = %L::uuid and a.id = 'default'
    $q$, 'YOUR_USER_UUID');
  end if;
end $$;

commit;

-- Verification: your legacy tasks should now be owned by your UUID, never NULL.
select user_id, count(*) as task_count
from public.tasks
group by user_id
order by task_count desc;
