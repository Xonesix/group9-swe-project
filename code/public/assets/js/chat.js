const inviteMenuButton = document.querySelector(".menu-bar > button");
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
