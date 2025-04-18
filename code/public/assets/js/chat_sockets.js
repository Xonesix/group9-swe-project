const socket = io();

socket.on("connect", () => {
  const params = new URLSearchParams(window.location.search);
  const teamId = params.get("uuid");
  joinTeam(teamId);
});

// Function to join a team chat
function joinTeam(teamId) {
  // Emit joinTeam event with the teamId
  socket.emit("joinTeam", { teamId });

  // Optional: Listen for confirmation
  socket.on("joinedTeam", ({ teamId }) => {
    console.log(`Successfully joined team ${teamId}`);
  });
}

// Listen for new messages
socket.on("newMessage", (message) => {
  // message object contains: { sender, text, date }

  displayNewMessage(message);
});

// Listen for errors
socket.on("error", (error) => {
  console.error("Socket error:", error.message);
  // Display error to user if needed
});

function displayNewMessage(msg) {
  const template = document.getElementById("message-card-template");
  const parent = document.querySelector(".messages");
  const clone = document.importNode(template.content, true);

  console.log(JSON.stringify(msg));

  //clone.querySelector(".messenger-username").textContent = msg.sender.username;
  clone.querySelector(".messenger-email").textContent = msg.sender.email;
  clone.querySelector(".message-content").textContent = msg.text;

  // Format the date
  console.log(`RAW DATE: ${msg.date.created_at}`);
  const date = new Date(`${msg.date.created_at}`);

  const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  clone.querySelector(".date-created").textContent = formattedDate;

  parent.appendChild(clone);
  messageContainerScrollBottom();
}
