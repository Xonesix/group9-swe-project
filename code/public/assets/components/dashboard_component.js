class NavBar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  async connectedCallback() {
    this.shadowRoot.innerHTML = `
        <div class="navigation-menu">
            <h1 class="logo">LOGO</h1>
            <div class="nav-link ">
              <div class="icon-holder">
                <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4.5 17H4a1 1 0 0 1-1-1 3 3 0 0 1 3-3h1m0-3.05A2.5 2.5 0 1 1 9 5.5M19.5 17h.5a1 1 0 0 0 1-1 3 3 0 0 0-3-3h-1m0-3.05a2.5 2.5 0 1 0-2-4.45m.5 13.5h-7a1 1 0 0 1-1-1 3 3 0 0 1 3-3h3a3 3 0 0 1 3 3 1 1 0 0 1-1 1Zm-1-9.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/>
</svg>

              </div>
              <a href="/dashboard">Teams</a>
            </div>
            <div class="nav-link">
            <div class="icon-holder"><svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5.365V3m0 2.365a5.338 5.338 0 0 1 5.133 5.368v1.8c0 2.386 1.867 2.982 1.867 4.175 0 .593 0 1.292-.538 1.292H5.538C5 18 5 17.301 5 16.708c0-1.193 1.867-1.789 1.867-4.175v-1.8A5.338 5.338 0 0 1 12 5.365ZM8.733 18c.094.852.306 1.54.944 2.112a3.48 3.48 0 0 0 4.646 0c.638-.572 1.236-1.26 1.33-2.112h-6.92Z"/>
</svg>
</div>
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
            background-color:rgb(11, 11, 11);
            width: fit-content;
            max-width: 300px;
            height: 100vh;
            padding-inline: 0.5rem;
            display: flex;
            
            flex-direction: column;
            align-items:center;
            gap: 1rem;
          }
          .nav-link {
            width: 150px;
            height: 70px;
            display: flex;
            padding-inline: 1.5rem;
            gap:0rem;
            justify-content: flex-start;
            align-items: center;
            border-radius: 10px;
            transition: all linear 0.2s;
          }
          .nav-link:hover {
            background-color: rgb(45, 45, 45);
          }
          .nav-link > a {
            text-decoration: none;
            color: inherit;
          }
          .nav-link.active
          {
            background-color:rgb(233, 233, 233);
            color:black;
            font-weight:600;

          }  
          .account {
            margin-top: auto;
            margin-bottom: 1.5rem;
            position: relative;
          }
          .account::before {
            content: '';
            height: 2px;
            width: 100%;
            
            position: absolute;
            top:0;
            left:0;
            background-color:rgb(29, 29, 29);
            transform: scale(110%);
            z-index:4;
          }
          .icon-holder
          {
            width:24px;
            height:24px;
            padding:10px;
            border-radius:4px;
          }
          .icon-holder > svg { color:inherit;}
        </style>
      `;

    // Fetch user email
    const accountName = this.shadowRoot.querySelector(".account-name");

    try {
      const response = await fetch("/api/protected/email", { method: "GET" });

      if (!response.ok) {
        accountName.textContent = "Something went wrong";
        window.location.replace("/login");

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
