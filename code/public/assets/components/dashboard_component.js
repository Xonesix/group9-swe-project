class NavBar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  async connectedCallback() {
    // This is our navigation sidebar
    this.shadowRoot.innerHTML = `
      <link ref="stylesheet" href="/assets/css/dashboard_component.css" rel="stylesheet" />
      <div class="navigation-menu">
        <div class="logo">Disteams<br /><span>Plz come up with better name</span></div>
        <div class="nav-links">
          <a class="nav-link" href="/dashboard">
            <div class="icon-holder">
              <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4.5 17H4a1 1 0 0 1-1-1 3 3 0 0 1 3-3h1m0-3.05A2.5 2.5 0 1 1 9 5.5M19.5 17h.5a1 1 0 0 0 1-1 3 3 0 0 0-3-3h-1m0-3.05a2.5 2.5 0 1 0-2-4.45m.5 13.5h-7a1 1 0 0 1-1-1 3 3 0 0 1 3-3h3a3 3 0 0 1 3 3 1 1 0 0 1-1 1Zm-1-9.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/>
              </svg>
            </div>
            <span>Teams</span>
          </a>
          <a class="nav-link" href="/notifications">
            <div class="icon-holder">
              <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5.365V3m0 2.365a5.338 5.338 0 0 1 5.133 5.368v1.8c0 2.386 1.867 2.982 1.867 4.175 0 .593 0 1.292-.538 1.292H5.538C5 18 5 17.301 5 16.708c0-1.193 1.867-1.789 1.867-4.175v-1.8A5.338 5.338 0 0 1 12 5.365ZM8.733 18c.094.852.306 1.54.944 2.112a3.48 3.48 0 0 0 4.646 0c.638-.572 1.236-1.26 1.33-2.112h-6.92Z"/>
              </svg>
            </div>
            <span>Notifications</span>
          </a>
        </div>
        <div class="account">
          <div class="unfocus-box inactive"></div>
            <div class="account-popup">
              <div class="wrapper">
                <div class="popup-header">
                  <img src="/assets/images/default-profile.jpg" alt="Profile Image" class="profile-img" />
                  <p id="profile-name-text">null</p>
                  <p id="profile-email-text">...</p>
                </div>
                <div class="popup-body">
                    <a href="#settings">Settings</a>
                    <a href="/logout">Logout</a>
                </div>
              </div>
            </div>
            <p class="account-name">Loading...</p>
          </div>
        </div>
      </div>
    `;

    try {
      const response = await fetch("/api/protected/email", { method: "GET" });

      // Fetch account name element
      const accountName = this.shadowRoot.querySelector(".account-name");

      if (!response.ok) {
        accountName.textContent = "Something went wrong";
        // UNCOMMENT ON PROD
        // window.location.replace("/login");
        return;
      }

      // Response is ok here

      const result = await response.json();

      // username with @
      let username = "";
      if(result.username)
        username = '@' + result.username;
      else
        username = "Name Unset";

      accountName.textContent = username;

      this.shadowRoot.getElementById("profile-name-text").textContent = username;

      this.shadowRoot.getElementById("profile-email-text").textContent = result.email;
    } catch (error) {
      console.error(error);
      accountName.textContent = "Error loading account";
    }

    let profileBox = this.shadowRoot.querySelector(".account-popup");
    let unfocusBox = this.shadowRoot.querySelector(".unfocus-box");

    this.shadowRoot.querySelector(".account-name").addEventListener("click", function (e) {
      profileBox.classList.add("active");
      unfocusBox.classList.remove("inactive");
    });

    this.shadowRoot.querySelector(".unfocus-box").addEventListener("click", function (e) {
      profileBox.classList.remove("active");
      unfocusBox.classList.add("inactive");
    });

  }
}

customElements.define("navigation-bar", NavBar);
