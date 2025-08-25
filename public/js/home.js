import { fetchUserData } from "./graphql.js";
import { renderWelcome } from "./views/welcome.js";
import { renderPieChart } from "./views/Audits.js";
import { renderProjects, renderStats } from "./views/projects.js";
import { renderSkillsView } from "./views/topSkills.js";

let cachedData = null;

// Safe accessor for nested properties: call get(() => obj.a.b, fallback)
export const get = (fn, fallback = undefined) => {
  try { const v = fn(); return v ?? fallback; } catch { return fallback; }
};

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

export function formatPercent(value, total) {
  if (total === 0) return "0%";
  return Math.round((value / total) * 100) + "%";
}

export function formatNumber(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat().format(v);
}

export function calculateXp(totalXP) {
  const n = Number(totalXP) || 0;
  if (n < 1024) return `${n} XP`;
  if (n < 1024 * 1024) {
    const kb = n / 1024;
    return `${kb.toFixed(2)} KB`;
  }
  const mb = n / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function renderView(name) {
  switch (name) {
    case "welcome": renderWelcome(cachedData, get); break;
    case "activity": renderPieChart(cachedData); break;
    case "xp": renderProjects(cachedData); break;
    case "projects": renderSkillsView(cachedData); break;
    case "stats": renderStats(cachedData); break;
    default: renderWelcome(cachedData, get); break;
  }
}

function setupButtons() {
  const buttons = Array.from(document.querySelectorAll(".card-btn"));
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const view = btn.dataset.view || "welcome";
      renderView(view);
    });
  });

  const active = document.querySelector(".card-btn.active") || buttons[0];
  if (active) renderView(active.dataset.view || "welcome");
}

function signOutAndRedirect(reason) {
  try { localStorage.removeItem("authToken"); } catch (e) { console.warn(e); }
  try { localStorage.removeItem("ig precent"); } catch (e) { console.warn(e); }
  console.warn("Signing out due to:", reason);
  window.location.href = "/index.html";
}

async function init() {
  // check token presence, otherwise send user to login
  const token = localStorage.getItem("authToken");
  if (!token) {
    window.location.href = "/index.html";
    return;
  }

  // fetch user data; handle expired/invalid JWT specially
  try {
    cachedData = await fetchUserData(token);
  } catch (err) {
    console.error("Could not fetch user data:", err);

    const msg = String(err?.message || err);

    if (/jwt.*expired/i.test(msg) || /jwtexpired/i.test(msg) || /could not verify jwt/i.test(msg) || /expired/i.test(msg)) {
      try { alert("Session expired — you will be signed out and returned to the login page."); } catch (ignore) {}
      signOutAndRedirect(msg);
      return;
    }

    cachedData = { data: {} };
  }

  setupButtons();

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("authToken");
      localStorage.removeItem("ig precent");
      window.location.href = "/index.html";
    });
  }
}
document.addEventListener("DOMContentLoaded", init);