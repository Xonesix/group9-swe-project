window.onload = async () => {
  participantViewCancelButton();
  messageSendHandler();
  leaveTeamButton();

  try {
    await hydrateMessages();
    await hydrateParticipants();
    messageContainerScrollBottom();
  } catch (error) {
    console.error(`Error: ${error}`);
  }
};
function messageContainerScrollBottom() {
  const messageContainer = document.querySelector(".messages");
  messageContainer.scrollTop = messageContainer.scrollHeight;
}
function participantViewCancelButton() {
  const cancelButton = document.querySelector(".x-button");
  const viewButton = document.querySelector(".view-participants-button");
  const parent = document.querySelector(".view-participants-container");
  viewButton.addEventListener("click", (e) => {
    parent.classList.add("active");
  });
  cancelButton.addEventListener("click", (e) => {
    parent.classList.remove("active");
  });
}

function leaveTeamButton() {
  const button = document.querySelector(".leave-team-button");

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      const params = new URLSearchParams(window.location.search);
      const value = params.get("uuid");
      const response = await fetch("/api/protected/leave-team", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId: value,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        serverMessage(
          true,
          "Left team successfully! ... Redirecting",
          "/dashboard"
        );
        console.log("team left successfuly");
      } else {
        console.error(`Something went wrong: ${response.message} `);
        serverMessage(false, "Could not leave team");
      }
    } catch (error) {
      console.error(`Something went wrong leaving team ${error}`);
      serverMessage(false, "Could not leave team");
    }
  });
}

function serverMessage(success, text, redirect = null) {
  const serverMessageContainer = document.querySelector(
    ".server-message-container"
  );
  const serverMessageText = serverMessageContainer.querySelector(
    ".server-message-content"
  );
  serverMessageContainer.classList.remove("success");
  serverMessageContainer.classList.remove("failure");
  serverMessageContainer.classList.remove("active");
  serverMessageContainer.classList.remove("fade-out");

  if (success) {
    serverMessageContainer.classList.add("success");
  } else {
    serverMessageContainer.classList.add("failure");
  }
  serverMessageText.textContent = text;

  serverMessageContainer.classList.add("active");
  setTimeout(() => {
    // Code to execute after waiting
    serverMessageContainer.classList.add("fade-out");
    setTimeout(() => {
      serverMessageContainer.classList.remove("active");
    }, 1000);

    if (redirect) {
      window.location.replace(redirect);
    }
  }, 5000); // 5000 milliseconds = 5 seconds
}

function messageSendHandler() {
  const form = document.getElementById("message-send-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const form_data = new FormData(form);
      const data = Object.fromEntries(form_data.entries());
      const params = new URLSearchParams(window.location.search);
      const value = params.get("uuid");
      const response = await fetch("/api/protected/send-message-in-team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId: value,
          content: data.content,
        }),
      });
      console.log(data);
      const result = await response.json();
      if (response.ok) {
        console.log("Message sent successfully");
        form.reset();

        // AYE MAKE SURE THIS USES WEB SOCKETS NEXT
      } else console.error(`${result.message}`);
    } catch (error) {
      console.error(`Something went wrong sending message ${error}`);
    }
  });
}

const inviteMenuButton = document.querySelector(".invite-button");
const inviteFormContainer = document.querySelector(".invite-form-container");
inviteMenuButton.addEventListener("click", (e) => {
  inviteFormContainer.classList.add("active");
});

const cancelButton = document.querySelector(".send-invite-button.cancel");

cancelButton.addEventListener("click", (e) => {
  inviteFormContainer.classList.remove("active");
});

const inviteForm = document.getElementById("invite-form");
const errorText = document.querySelector(".error-text");
inviteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(inviteForm);
    const data = Object.fromEntries(formData.entries());
    console.log(data);
    const params = new URLSearchParams(window.location.search);
    const value = params.get("uuid");
    console.log(`URL PARAM ${value}`);
    const response = await fetch("/api/protected/send-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invitee_email: data.email,
        teamId: value,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      errorText.style.display = "block";
      errorText.style.color = "red";

      errorText.textContent = result.message;

      // ERROR TEXT CONTENT
    } else {
      errorText.style.display = "block";
      errorText.style.color = "green";
      errorText.textContent = "Invite Sent Successfully";
    }
  } catch (error) {
    console.error(`Something went wrong inviting ${error}`);
  }
});

// Fetching Participants
async function hydrateParticipants() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("uuid");
  console.log(`URL PARAM ${value}`);
  const response = await fetch("/api/protected/get-participants-in-team", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      teamId: value,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    console.error(result.message);
    return;
  }
  const template = document.getElementById("participant-card-template");
  const parent = document.querySelector(".participant-card-container");
  for (const participant of result.participants) {
    const clone = document.importNode(template.content, true);
    clone.querySelector(".participant-email").textContent = participant.email;
    parent.appendChild(clone);
  }
}
// Fetching Messages
async function hydrateMessages() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("uuid");
  const response = await fetch("/api/protected/view-messages-in-team", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      teamId: value,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    console.error(result.message);
    return;
  }
  const template = document.getElementById("message-card-template");
  const parent = document.querySelector(".messages");
  console.log(result.messages);
  for (const msg of result.messages) {
    const clone = document.importNode(template.content, true);
    clone.querySelector(".messenger-email").textContent = msg.email;
    clone.querySelector(".message-content").textContent = msg.content;

    // Format the date
    const date = new Date(msg.created_at);
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    clone.querySelector(".date-created").textContent = formattedDate;

    parent.appendChild(clone);
  }
}
