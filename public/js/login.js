import { fetchUserData } from "./graphql.js";

document.addEventListener("DOMContentLoaded", () => {
  // If already logged in, go straight to home.
  const existingToken = localStorage.getItem("authToken");
  if (existingToken) {
    window.location.href = "/home.html";
    return;
  }

  const form = document.querySelector("form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  // Create a reusable error box inside the glass card
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-box";
  errorDiv.setAttribute("role", "alert");
  errorDiv.setAttribute("aria-live", "polite");
  errorDiv.style.display = "none";

  const glass = document.querySelector(".glass-container");
  glass.appendChild(errorDiv);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // reset previous error
    errorDiv.textContent = "";
    errorDiv.style.display = "none";

    // Remove a legacy localStorage key if present (non-blocking)
    try {
      localStorage.removeItem("ig precent");
    } catch (remErr) {
      console.warn("Could not remove 'ig precent' from localStorage:", remErr);
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!username) {
      errorDiv.textContent = "Error: Email not valid, syntax error";
      errorDiv.style.display = "block";
      return;
    }
    if (username.includes("@") && !emailPattern.test(username)) {
      errorDiv.textContent = "Error: Email not valid, syntax error";
      errorDiv.style.display = "block";
      return;
    }
    if (!password) {
      errorDiv.textContent = "Password is required.";
      errorDiv.style.display = "block";
      return;
    }

    try {
      // 1) Sign in with Basic Auth
      const credentials = btoa(`${username}:${password}`);
      const res = await fetch("https://learn.reboot01.com/api/auth/signin", {
        method: "POST",
        headers: { "Authorization": `Basic ${credentials}` }
      });

      if (!res.ok) {throw new Error("User does not exist or password incorrect");}

      // 2) Parse response (could be raw token or JSON)
      let bodyText = await res.text();
      let parsed;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        parsed = bodyText;
      }

      // 3) Extract token from common shapes
      let token;
      if (typeof parsed === "string") {
        token = parsed;
      } else if (parsed && typeof parsed === "object") {
        token = parsed.token || parsed.accessToken || parsed.jwt || parsed.data?.token || parsed.data?.accessToken;
      }

      if (!token) {
        console.error("full signin response:", parsed);
        throw new Error("Could not find a token in the response");
      }

      // 4) Save token and load user data
      token = token.replace(/^\uFEFF/, "").trim();
      localStorage.setItem("authToken", token);

      await fetchUserData(token);
      window.location.href = "/home.html";
    } catch (err) {
      console.error(err);
      errorDiv.textContent = err.message;
      errorDiv.style.display = "block";
    }
  });
});
