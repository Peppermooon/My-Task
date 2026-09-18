import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const supabaseSecretKey = secretKeys["default"];
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID")!;
    const oneSignalApiKey = Deno.env.get("ONESIGNAL_API_KEY")!;
    const oneSignalSubscriptionId = Deno.env.get("ONESIGNAL_SUBSCRIPTION_ID")!;

    if (!supabaseSecretKey) throw new Error("Supabase secret key is missing.");

    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const nowParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const part = (type: string) => nowParts.find((p) => p.type === type)?.value ?? "";
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    const currentTime = `${part("hour")}:${part("minute")}:${part("second")}`;

    // Defaults stay ON if settings cannot be read for any reason.
    let reminderEnabled = true;
    let dueTodayEnabled = true;
    const { data: settings } = await supabase
      .from("app_settings")
      .select("reminder_notifications,due_today_notifications")
      .eq("id", "default")
      .maybeSingle();
    if (settings) {
      reminderEnabled = settings.reminder_notifications !== false;
      dueTodayEnabled = settings.due_today_notifications !== false;
    }

    const { data: tasks, error } = await supabase.from("tasks").select("*");
    if (error) {
      return Response.json({ stage: "loading_tasks", error }, { status: 500 });
    }

    const results = [];

    async function sendPush(title: string, message: string) {
      const response = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${oneSignalApiKey}`,
        },
        body: JSON.stringify({
          app_id: oneSignalAppId,
          target_channel: "push",
          include_subscription_ids: [oneSignalSubscriptionId],
          headings: { en: title },
          contents: { en: message },
          web_url: "https://peppermooon.github.io/My-Task/",
        }),
      });
      const body = await response.json();
      const sent = response.ok && typeof body.id === "string" && body.id.length > 0;
      return { sent, body };
    }

    for (const task of tasks ?? []) {
      if (["Completed", "Cancelled"].includes(task.status)) continue;

      const normalReminderDue =
        reminderEnabled &&
        task.reminder_sent === false &&
        task.reminder_date &&
        (task.reminder_date < today ||
          (task.reminder_date === today &&
            (!task.reminder_time || task.reminder_time <= currentTime)));

      if (normalReminderDue) {
        const push = await sendPush("Task Reminder", task.task_name);
        if (push.sent) {
          await supabase.from("tasks").update({ reminder_sent: true }).eq("id", task.id);
        }
        results.push({ type: "reminder", task: task.task_name, sent: push.sent, onesignal: push.body });
      }

      const dueTodayNotificationDue =
        dueTodayEnabled &&
        task.due_today_sent === false &&
        task.deadline_date === today &&
        currentTime >= "08:00:00";

      if (dueTodayNotificationDue) {
        const push = await sendPush("Due Today", `${task.task_name} is due today.`);
        if (push.sent) {
          await supabase.from("tasks").update({ due_today_sent: true }).eq("id", task.id);
        }
        results.push({ type: "due_today", task: task.task_name, sent: push.sent, onesignal: push.body });
      }
    }

    return Response.json({
      current_date: today,
      current_time: currentTime,
      notification_settings: {
        reminder_notifications: reminderEnabled,
        due_today_notifications: dueTodayEnabled,
      },
      results,
    });
  } catch (error) {
    return Response.json({
      stage: "unexpected_error",
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    }, { status: 500 });
  }
});
