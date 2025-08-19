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
  errorDiv.setAttribute("role", "alert");      // accessibility
  errorDiv.setAttribute("aria-live", "polite"); // announce politely
  errorDiv.style.display = "none";              // hidden until first error
  form.appendChild(errorDiv);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorDiv.textContent = "";

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
      return;
    }
    if (username.includes("@") && !emailPattern.test(username)) {
      errorDiv.textContent = "Error: Email not valid, syntax error";
      return;
    }
    if (!password) {
      errorDiv.textContent = "Password is required.";
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
    }
  });
});
