import { calculateXp } from "../home.js";

export function renderWelcome(cachedData, getHelper) {
  const get = getHelper ?? ((fn, fallback = undefined) => {
    try { const v = fn(); return v ?? fallback; } catch { return fallback; }
  });

  const rawUser = get(() => cachedData.data.user, null);
  const user = Array.isArray(rawUser) ? rawUser[0] : rawUser;

  const username = user?.login || "User";
  const id = user?.id ?? "N/A";
  const email = user?.email || "N/A";
  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";

  let xpAmount = get(() => Number(user.transactions_aggregate.aggregate.sum.amount), null);
  if (xpAmount == null) {
    const transactions = Array.isArray(user?.transactions) ? user.transactions : [];
    xpAmount = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }

  const xpFormatted = calculateXp(xpAmount);
  document.getElementById("card-title").textContent = "Hello There!";
  document.getElementById("card-content").innerHTML = `
    <p id="welcome-message">Welcome, <strong>${username}</strong>!</p>
    <p id="user-id" class="muted">ID: ${id}</p>
    <p id="user-name" class="muted">Name: <strong>${(firstName + ' ' + lastName).trim() || 'N/A'}</strong></p>
    <p id="user-email" class="muted">Email: ${email}</p>
    <p id="user-xp" class="muted">XP amount: <strong>${xpFormatted}</strong> <span class="muted" style="font-size:12px;">(for all events)</span></p>

    <!-- informational box styled the same as the login error-box -->
    <div class="error-box" role="note" aria-live="polite" style="display:block; margin-top:12px;">
      Tip: Use the buttons to explore different views of your progress.
    </div>
  `;
}
