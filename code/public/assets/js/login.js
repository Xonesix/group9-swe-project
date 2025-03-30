const button = document.querySelector(".submit-button");
const form = document.getElementById("login-form");
const errorMessage = document.querySelector(".sub-message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  console.log(data);

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error("Invalid Username or Password");
      errorMessage.style.display = "block";
      throw new Error("Failed to submit");
    }

    const result = await response.json();
    console.log("Success:", result);
    if (response.ok) {
      window.location.href = "/dashboard";
    }
  } catch (error) {
    console.error("Error:", error);
  }
});
