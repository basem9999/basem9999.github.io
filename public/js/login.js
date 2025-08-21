import { fetchUserData } from "./graphql.js";

document.addEventListener("DOMContentLoaded", () => {
  // --- Guard: if already logged in, redirect to home immediately ---
  const existingToken = localStorage.getItem("authToken");
  if (existingToken) {
    // User already has a token — go to home.
    window.location.href = "/home.html";
    return;
  }

  const form          = document.querySelector("form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  const errorDiv = document.createElement("div");
  errorDiv.className = "error-box";
  errorDiv.setAttribute("role", "alert");
  errorDiv.setAttribute("aria-live", "polite");
  errorDiv.style.display = "none";

  // Put the error box as the last child of the glass container
  const glass = document.querySelector(".glass-container");
  // keep error inside the card and allow it to stretch with the card
  glass.appendChild(errorDiv);

  // Auto-login button (base64 encoded credentials provided by user)
  const loginAsBtn = document.getElementById("login-as-bajaafar");
  const encodedAutoCreds = "YmFzZW1qYWFmYXI1QGdtYWlsLmNvbToyMTE5NTEzQmFzZW0jIw==";

  loginAsBtn.addEventListener("click", () => {
    try {
      const decoded = atob(encodedAutoCreds);
      const parts = decoded.split(":");
      if (parts.length < 2) throw new Error("Invalid encoded credentials");
      const u = parts.shift();
      const p = parts.join(":"); // in case password contains colons
      usernameInput.value = u;
      passwordInput.value = p;
      // submit the form programmatically (triggers same submit handler)
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
      else form.requestSubmit?.();
    } catch (e) {
      console.error("Auto-login failed:", e);
      errorDiv.textContent = "Auto-login failed.";
      errorDiv.style.display = "block";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    // clear previous error and hide
    errorDiv.textContent = "";
    errorDiv.style.display = "none";

    // If someone bypassed the initial redirect (F12), remove the interfering token
    // BEFORE attempting to sign in.
    try {
      localStorage.removeItem("ig precent");
    } catch (remErr) {
      // ignore — removal failure shouldn't block login
      console.warn("Could not remove 'ig precent' from localStorage:", remErr);
    }

    const username    = usernameInput.value.trim();
    const password    = passwordInput.value.trim();
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
      // 1) Send Basic-Auth sign-in request
      const credentials = btoa(`${username}:${password}`);
      const res = await fetch("https://learn.reboot01.com/api/auth/signin", {
        method:  "POST",
        headers: { "Authorization": `Basic ${credentials}` }
      });

      if (!res.ok) {
        throw new Error("User does not exist or password incorrect");
      }

      // 2) Parse the body → might be a JSON string literal or JSON object
      let bodyText = await res.text();
      let parsed;
      try { parsed = JSON.parse(bodyText); } catch { parsed = bodyText; }

      // 3) Extract the JWT
      let token;
      if (typeof parsed === "string") {
        // endpoint returned raw JWT or JSON string literal
        token = parsed;
      } else if (parsed && typeof parsed === "object") {
        // endpoint returned { token: "..."} or similar
        token = parsed.token || parsed.accessToken || parsed.jwt || parsed.data?.token || parsed.data?.accessToken;
      }

      // 4) If we still don’t have a token, throw
      if (!token) {
        console.error("full signin response:", parsed);
        throw new Error("Could not find a token in the response");
      }

      // 5) Clean, store, and use
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