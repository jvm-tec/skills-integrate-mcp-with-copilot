document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");
  const userMenuButton = document.getElementById("user-menu-button");
  const userMenu = document.getElementById("user-menu");
  const authStatus = document.getElementById("auth-status");
  const loginButton = document.getElementById("login-button");
  const logoutButton = document.getElementById("logout-button");
  const loginDialog = document.getElementById("login-dialog");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const passwordInput = document.getElementById("password");
  let isTeacher = false;

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function showMessage(element, text, className) {
    element.textContent = text;
    element.className = className;
    element.classList.remove("hidden");
    setTimeout(() => element.classList.add("hidden"), 5000);
  }

  function updateAuthControls(username = null) {
    isTeacher = username !== null;
    authStatus.textContent = isTeacher
      ? `Signed in as ${username}`
      : "Not signed in";
    loginButton.classList.toggle("hidden", isTeacher);
    logoutButton.classList.toggle("hidden", !isTeacher);
    signupContainer.hidden = !isTeacher;
  }

  async function loadAuthStatus() {
    const response = await fetch("/auth/status");
    if (!response.ok) {
      throw new Error(`Authentication status request failed (${response.status})`);
    }
    const result = await response.json();
    updateAuthControls(result.authenticated ? result.username : null);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      if (!response.ok) {
        throw new Error(`Activity request failed (${response.status})`);
      }
      const activities = await response.json();

      activitiesList.innerHTML = "";
      while (activitySelect.options.length > 1) {
        activitySelect.remove(1);
      }

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = makeElement("div", "activity-card");
        const spotsLeft =
          details.max_participants - details.participants.length;

        activityCard.appendChild(makeElement("h4", "", name));
        activityCard.appendChild(makeElement("p", "", details.description));
        const schedule = makeElement("p");
        schedule.appendChild(makeElement("strong", "", "Schedule: "));
        schedule.append(document.createTextNode(details.schedule));
        activityCard.appendChild(schedule);
        const availability = makeElement("p");
        availability.appendChild(makeElement("strong", "", "Availability: "));
        availability.append(
          document.createTextNode(`${spotsLeft} spots left`)
        );
        activityCard.appendChild(availability);

        const participantsContainer = makeElement(
          "div",
          "participants-container"
        );
        if (details.participants.length > 0) {
          const participantsSection = makeElement("div", "participants-section");
          participantsSection.appendChild(makeElement("h5", "", "Participants:"));
          const participantsList = makeElement("ul", "participants-list");
          details.participants.forEach((email) => {
            const participant = makeElement("li");
            participant.appendChild(
              makeElement("span", "participant-email", email)
            );
            if (isTeacher) {
              const unregisterButton = makeElement(
                "button",
                "delete-btn",
                "Remove"
              );
              unregisterButton.type = "button";
              unregisterButton.setAttribute(
                "aria-label",
                `Unregister ${email} from ${name}`
              );
              unregisterButton.dataset.activity = name;
              unregisterButton.dataset.email = email;
              unregisterButton.addEventListener("click", handleUnregister);
              participant.appendChild(unregisterButton);
            }
            participantsList.appendChild(participant);
          });
          participantsSection.appendChild(participantsList);
          participantsContainer.appendChild(participantsSection);
        } else {
          participantsContainer.appendChild(
            makeElement("p", "", "No participants yet")
          );
        }
        activityCard.appendChild(participantsContainer);
        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.currentTarget;
    const activity = button.dataset.activity;
    const email = button.dataset.email;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        await fetchActivities();
      } else {
        showMessage(
          messageDiv,
          result.detail || "An error occurred",
          "error"
        );
      }
    } catch (error) {
      showMessage(
        messageDiv,
        "Failed to unregister. Please try again.",
        "error"
      );
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        signupForm.reset();
        await fetchActivities();
      } else {
        showMessage(
          messageDiv,
          result.detail || "An error occurred",
          "error"
        );
      }
    } catch (error) {
      showMessage(
        messageDiv,
        "Failed to sign up. Please try again.",
        "error"
      );
      console.error("Error signing up:", error);
    }
  });

  userMenuButton.addEventListener("click", () => {
    const isExpanded =
      userMenuButton.getAttribute("aria-expanded") === "true";
    userMenuButton.setAttribute("aria-expanded", String(!isExpanded));
    userMenu.classList.toggle("hidden", isExpanded);
  });

  loginButton.addEventListener("click", () => {
    userMenu.classList.add("hidden");
    userMenuButton.setAttribute("aria-expanded", "false");
    loginMessage.classList.add("hidden");
    loginDialog.showModal();
  });

  document
    .getElementById("close-login-button")
    .addEventListener("click", () => loginDialog.close());

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginMessage.classList.add("hidden");
    const formData = new FormData(loginForm);

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        loginMessage.textContent = result.detail || "Unable to log in";
        loginMessage.className = "error";
        return;
      }

      updateAuthControls(result.username);
      loginForm.reset();
      loginDialog.close();
      await fetchActivities();
      showMessage(messageDiv, "Teacher signed in", "success");
    } catch (error) {
      loginMessage.textContent = "Failed to log in. Please try again.";
      loginMessage.className = "error";
      console.error("Error logging in:", error);
    } finally {
      passwordInput.value = "";
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Logout request failed (${response.status})`);
      }
      updateAuthControls();
      await fetchActivities();
      userMenu.classList.add("hidden");
      userMenuButton.setAttribute("aria-expanded", "false");
      showMessage(messageDiv, "Teacher signed out", "success");
    } catch (error) {
      showMessage(messageDiv, "Failed to log out. Please try again.", "error");
      console.error("Error logging out:", error);
    }
  });

  async function initialize() {
    try {
      await loadAuthStatus();
    } catch (error) {
      updateAuthControls();
      console.error("Error checking teacher session:", error);
    }
    await fetchActivities();
  }

  initialize();
});
