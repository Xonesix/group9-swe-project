const template = document.getElementById("notification-card-template");
const parent = document.getElementById("notification-parent");
window.onload = async () => {
  hydrateNotifications();
};
async function hydrateNotifications() {
  try {
    const response = await fetch("/api/protected/get-notifications", {
      method: "GET",
    });
    if (!response.ok) {
      console.error("Something went wrong retrieving notifications");
      return;
    }
    const result = await response.json();

    const notifications = result.notifications;

    for (let notification of notifications) {
      console.log(notification);
      const teamName = notification.team_name;
      const email = notification.inviter_email;
      if (notification.status !== "pending") {
        continue;
      }
      const clone = document.importNode(template.content, true);
      clone.querySelector(
        ".notification-title"
      ).textContent = `You've been invited to ${teamName}`;
      clone.querySelector(".inviter").textContent = `Invited by: ${email}`;

      parent.appendChild(clone);
    }
  } catch (error) {
    console.error(error);
  }
}
