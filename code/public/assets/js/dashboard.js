const account_name = document.querySelector(".account-name");

window.onload = async () => {
  try {
    await hydrateEmail();
    await hydrateTeams();
  } catch (error) {
    console.error(`Error: ${error}`);
  }
};

// Create Team Form Display

const formDisplay = document.querySelector(".add-team");
const createButton = document.querySelector(".create-team");
const cancelButton = document.querySelector(".cancel-button");
createButton.addEventListener("click", (event) => {
  formDisplay.classList.add("active");
});
cancelButton.addEventListener("click", (e) => {
  formDisplay.classList.remove("active");
});

// Team form submission
const form = document.getElementById("create-team-form");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(form);

    const data = Object.fromEntries(formData.entries());
    console.log(data);
    const response = await fetch("/api/protected/create-team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (response.ok) {
      document.querySelector(".team-card-holder").replaceChildren();
      await hydrateTeams();
      formDisplay.classList.remove("active");
    } else {
      throw Error("Somethign went wrong with server");
    }
  } catch (error) {
    console.error(`Something went wrong when submitting form: ${error}`);
  }
});

// Hydrate Dashboard
async function hydrateEmail() {
  try {
    const response = await fetch("/api/protected/email", {
      method: "GET",
    });

    if (!response.ok) {
      account_name.textContent = "something went wrong";
      //  window.location.href = "/login";
    }

    const result = await response.json();
    account_name.textContent = result.email;
  } catch (error) {}
}
// Hydrate TEams
async function hydrateTeams() {
  const template = document.getElementById("team-card-template");

  try {
    const response = await fetch("/api/protected/get-teams", {
      method: "GET",
    });
    const result = await response.json();
    if (!result.success) {
      throw Error("Couldn't Fetch Teams");
    }
    const teams = result.teams;
    for (const team of teams) {
      const clone = document.importNode(template.content, true);
      clone.querySelector(".team-name").textContent = team.name;
      clone.querySelector(".chat-button").href = `/chat?uuid=${team.id}`;
      document.querySelector(".team-card-holder").appendChild(clone);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}
