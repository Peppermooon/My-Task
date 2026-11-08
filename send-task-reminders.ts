async function sendPush(
  userId: string,
  title: string,
  message: string,
  priority: string,
) {
  const notificationTitle =
    priority === "Critical"
      ? "Critical Task Reminder"
      : priority === "High"
        ? "High Priority Task Reminder"
        : title;

  const response = await fetch(
    "https://api.onesignal.com/notifications",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${oneSignalApiKey}`,
      },
      body: JSON.stringify({
        app_id: oneSignalAppId,
        target_channel: "push",
        include_aliases: { external_id: [userId] },
        headings: { en: notificationTitle },
        contents: { en: message },

        chrome_web_icon: priority === "Critical"
          ? "https://peppermooon.github.io/My-Task/icons/notification-critical.png"
          : priority === "High"
            ? "https://peppermooon.github.io/My-Task/icons/notification-high.png"
            : undefined,

        web_url: "https://peppermooon.github.io/My-Task/",
      }),
    },
  );

  const body = await response.json();

  const sent =
    response.ok &&
    typeof body.id === "string" &&
    body.id.length > 0;

  const noRecipient =
    JSON.stringify(body).toLowerCase().includes("not subscribed") ||
    JSON.stringify(body).toLowerCase().includes("no subscribed");

  return { sent, noRecipient, body };
}
