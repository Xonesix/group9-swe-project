class NavBar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  async connectedCallback() {
    this.shadowRoot.innerHTML = `
        <div class="navigation-menu">
            <h1 class="logo">LOGO</h1>
            <div class="nav-link">
              <a href="/dashboard">Teams</a>
            </div>
            <div class="nav-link">
              <a href="/notifications">Notifications</a>
            </div>
            <div class="account">
              <p class="account-name">Loading...</p>
            </div>
        </div>
        <style>
          .logo { text-align: center; }
          .navigation-menu {
            color: white;
            background-color: var(--dark-gray);
            width: fit-content;
            max-width: 300px;
            height: 100vh;
            padding-inline: 0.5rem;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          .nav-link {
            width: 150px;
            height: 70px;
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 10px;
            transition: all linear 0.2s;
          }
          .nav-link:hover {
            background-color: rgb(45, 45, 45);
          }
          .nav-link > a {
            text-decoration: none;
            color: white;
          }
          .account {
            margin-top: auto;
            margin-bottom: 0.5rem;
          }
        </style>
      `;

    // Fetch user email
    const accountName = this.shadowRoot.querySelector(".account-name");

    try {
      const response = await fetch("/api/protected/email", { method: "GET" });

      if (!response.ok) {
        accountName.textContent = "Something went wrong";
        return;
      }

      const result = await response.json();
      accountName.textContent = result.email;
    } catch (error) {
      console.error(error);
      accountName.textContent = "Error loading account";
    }
  }
}

customElements.define("navigation-bar", NavBar);
