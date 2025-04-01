const template = document.getElementById("notification-card-template");
const parent = document.getElementById("notification-parent");
window.onload = async () => {
  await hydrateNotifications();
  hydrateButtons();
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
      const inviteId = notification.id;
      if (notification.status !== "pending") {
        continue;
      }
      const clone = document.importNode(template.content, true);
      clone.querySelector(
        ".notification-title"
      ).textContent = `You've been invited to ${teamName}`;
      clone.querySelector(".inviter").textContent = `Invited by: ${email}`;
      clone.querySelector(".notification-card").dataset.id = inviteId;

      parent.appendChild(clone);
    }
  } catch (error) {
    console.error(error);
  }
}

function hydrateButtons() {
  const accept_buttons = document.querySelectorAll(".accept.button");
  const decline_buttons = document.querySelectorAll(".decline.button");
  for (const button of accept_buttons) {
    button.addEventListener("click", async function () {
      const parentDiv = this.closest(".notification-card");
      const invite_id = parentDiv.dataset.id;

      console.log(`Accepted ${invite_id}`);
      const result = await handleInvite(invite_id, "accept");
      if (result) {
        console.log("success accepting");
        parentDiv.remove();
      } else console.error("error accepting");
    });
  }
  for (const button of decline_buttons) {
    button.addEventListener("click", async function () {
      const parentDiv = this.closest(".notification-card");
      const invite_id = parentDiv.dataset.id;
      const result = await handleInvite(invite_id, "reject");
      console.log(`Declined ${invite_id}`);
      if (result) {
        console.log("success rejecting");
        parentDiv.remove();
      } else console.error("error rejecting");
    });
  }
}

async function handleInvite(inv_id, act) {
  try {
    const response = await fetch("/api/protected/handle-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invite_id: inv_id,
        action: act,
      }),
    });
    const result = await response.json();
    if (response.ok) {
      console.log(result.message);
      return true;
    } else {
      console.error(result.message);
      return false;
    }
  } catch (error) {
    console.error(error);
    return false;
  }
}
