MY TASKS - SETTINGS UPDATE

1) Upload the web app files to GitHub as usual.
2) In Supabase SQL Editor, run settings_setup.sql once.
3) In Edge Functions -> send-task-reminders -> Edit, replace all code with send-task-reminders.ts and Deploy.
4) Keep the existing cron job. No cron changes are needed.

Settings page features:
- Task Reminder notifications ON/OFF (stored in Supabase)
- Due Today notifications ON/OFF (stored in Supabase)
- Light, Dark, Slate, Ocean, Forest and Warm themes
- None, Aurora and Mist backgrounds
- Optional custom wallpaper stored locally on that device

Themes/wallpaper are device-local. Notification switches sync through Supabase and control the backend Edge Function.
