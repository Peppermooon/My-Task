import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const supabaseSecretKey = secretKeys["default"];
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID")!;
    const oneSignalApiKey = Deno.env.get("ONESIGNAL_API_KEY")!;

    if (!supabaseSecretKey) throw new Error("Supabase secret key is missing.");

    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    const currentTime = `${part("hour")}:${part("minute")}:${part("second")}`;

    const { data: settingsRows, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id,reminder_notifications,due_today_notifications");
    if (settingsError) throw settingsError;

    const settingsByUser = new Map<string, { reminder: boolean; dueToday: boolean }>();
    for (const s of settingsRows ?? []) {
      settingsByUser.set(String(s.user_id), {
        reminder: s.reminder_notifications !== false,
        dueToday: s.due_today_notifications !== false,
      });
    }

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*")
      .not("user_id", "is", null);

    if (error) return Response.json({ stage: "loading_tasks", error }, { status: 500 });

    const results: unknown[] = [];

    async function sendPush(userId: string, title: string, message: string) {
      const response = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${oneSignalApiKey}`,
        },
        body: JSON.stringify({
          app_id: oneSignalAppId,
          target_channel: "push",
          include_aliases: { external_id: [userId] },
          headings: { en: title },
          contents: { en: message },
          web_url: "https://peppermooon.github.io/My-Task/",
        }),
      });
      const body = await response.json();
      const sent = response.ok && typeof body.id === "string" && body.id.length > 0;
      const noRecipient = JSON.stringify(body).toLowerCase().includes("not subscribed") ||
        JSON.stringify(body).toLowerCase().includes("no subscribed");
      return { sent, noRecipient, body };
    }

    for (const task of tasks ?? []) {
      if (["Completed", "Cancelled"].includes(task.status)) continue;
      const userId = String(task.user_id);
      const prefs = settingsByUser.get(userId) ?? { reminder: true, dueToday: true };

      const reminderDue =
        task.reminder_sent === false &&
        task.reminder_date &&
        (task.reminder_date < today ||
          (task.reminder_date === today && (!task.reminder_time || task.reminder_time <= currentTime)));

      if (reminderDue) {
        if (!prefs.reminder) {
          await supabase.from("tasks").update({ reminder_sent: true }).eq("id", task.id);
          results.push({ type: "reminder", task: task.task_name, user_id: userId, sent: false, suppressed: true });
        } else {
          const push = await sendPush(userId, "Task Reminder", task.task_name);
          if (push.sent || push.noRecipient) {
            await supabase.from("tasks").update({ reminder_sent: true }).eq("id", task.id);
          }
          results.push({ type: "reminder", task: task.task_name, user_id: userId, sent: push.sent, onesignal: push.body });
        }
      }

      const dueTodayDue =
        task.due_today_sent === false &&
        task.deadline_date === today &&
        currentTime >= "08:00:00";

      if (dueTodayDue) {
        if (!prefs.dueToday) {
          await supabase.from("tasks").update({ due_today_sent: true }).eq("id", task.id);
          results.push({ type: "due_today", task: task.task_name, user_id: userId, sent: false, suppressed: true });
        } else {
          const push = await sendPush(userId, "Due Today", `${task.task_name} is due today.`);
          if (push.sent || push.noRecipient) {
            await supabase.from("tasks").update({ due_today_sent: true }).eq("id", task.id);
          }
          results.push({ type: "due_today", task: task.task_name, user_id: userId, sent: push.sent, onesignal: push.body });
        }
      }
    }

    return Response.json({ current_date: today, current_time: currentTime, results });
  } catch (error) {
    return Response.json({
      stage: "unexpected_error",
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    }, { status: 500 });
  }
});
