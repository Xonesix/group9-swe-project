const account_name = document.querySelector(".account-name");

window.onload = async () => {
  try {
    //await hydrateEmail();
    await hydrateTeams();
  } catch (error) {
    console.error(`Error: ${error}`);
  }
};

// Create Team Form Display

const formDisplay = document.querySelector(".add-team");
const createButton = document.querySelector(".create-team");
const cancelButton = document.querySelector(".cancel-button");

// Show form when create team button is clicked
createButton.addEventListener("click", (event) => {
  formDisplay.classList.add("active");
});

// Hide form when cancel button is clicked
cancelButton.addEventListener("click", (e) => {
  formDisplay.classList.remove("active");
});

// Team form submission
const form = document.getElementById("create-team-form");

// Add event listener to form submission (when user clicks submit on create team dialog)
form.addEventListener("submit", async (event) => {

  event.preventDefault();

  try {
    
    // Get the form data from the form element
    const formData = new FormData(form);

    // Convert formData into an Object
    const data = Object.fromEntries(formData.entries());

    console.log(data);

    // Send the form data to the server using fetch (and wait for a server response)
    const response = await fetch("/api/protected/create-team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    // Check if the response is ok (status code 200-299)
    if (response.ok) {
      // Replace the team card holder with a new one to refresh the teams
      document.querySelector(".team-card-holder").replaceChildren();
      await hydrateTeams();
      // Hide the form popup
      formDisplay.classList.remove("active");
    } else {
      throw Error("Somethign went wrong with server");
    }

  } catch (error) {
    console.error(`Something went wrong when submitting form: ${error}`);
  }

});

// // Hydrate Dashboard
// async function hydrateEmail() {
//   try {
//     const response = await fetch("/api/protected/email", {
//       method: "GET",
//     });

//     if (!response.ok) {
//       account_name.textContent = "something went wrong";
//       // window.location.href = "/login";
//     }

//     const result = await response.json();
//     account_name.textContent = result.email;
//   } catch (error) {}
// }
// Hydrate Teams
// Pretty sure this function just fetches the teams from the server and populates the team cards on the dashboard -Hudson
async function hydrateTeams() {

  const template = document.getElementById("team-card-template");

  try {

    // Fetch teams from the server
    const response = await fetch("/api/protected/get-teams", {
      method: "GET",
    });
    // Check if the response is ok (status code 200-299) (await until response is received)
    const result = await response.json();

    // Check if the response was successful (if not, throw an error)
    if (!result.success) {
      throw Error("Couldn't Fetch Teams");
    }

    // Populate the wrapper with the team cards
    const teams = result.teams;

    // Check if there are any teams in the response
    if(teams.length === 0) {
      console.log("No teams to display.");
      document.querySelector(".team-container").innerHTML = '<h3 class="dashboard-error-msg">No teams</h3>';
      return;
    }

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
