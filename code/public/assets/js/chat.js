window.onload = async () => {
  try {
    await hydrateParticipants();
  } catch (error) {
    console.error(`Error: ${error}`);
  }
};

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
