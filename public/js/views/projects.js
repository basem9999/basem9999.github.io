import { get, formatDate, calculateXp } from "../home.js";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function lastSegment(p) {
  if (!p || typeof p !== "string") return "(unknown)";
  const parts = p.split("/").filter(Boolean);
  return parts.length ? parts.pop() : p;
}

function renderListItems(transactions, totalXP) {
  const maxAmount = Math.max(1, ...transactions.map(t => Number(t.amount) || 0));

  return transactions.map((t, i) => {
    const rawAmt = Number(t.amount) || 0;
    const amtFormatted = calculateXp(rawAmt);
    const pctOfTotal = totalXP > 0 ? Math.round((rawAmt / totalXP) * 100) : 0;
    const widthPct = Math.round((rawAmt / maxAmount) * 100);
    const when = t.createdAt ? formatDate(t.createdAt) : "";
    const path = t.path || "(unknown)";
    const name = lastSegment(path);

    return `
      <li class="xp-item" aria-label="transaction-${i}" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div style="font-size:13px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: calc(100% - 120px);">
            <strong title="${escapeHtml(path)}">${i+1}. ${escapeHtml(name)}</strong>
            <div class="muted" style="font-size:11px; margin-top:6px;">${when}</div>
          </div>
          <div style="text-align:right; min-width:100px;">
            <div style="font-weight:600">${amtFormatted}</div>
            <div class="muted" style="font-size:11px;">${pctOfTotal}% <span style="opacity:0.8">(${rawAmt})</span></div>
          </div>
        </div>

        <div class="xp-bar-wrap" style="margin-top:8px; background:rgba(255,255,255,0.06); height:10px; border-radius:6px; overflow:hidden;">
          <div class="xp-bar" style="height:100%; width:${widthPct}%; border-radius:6px; background: linear-gradient(90deg,#7af,#47f);"></div>
        </div>
      </li>
    `;
  }).join("");
}

export function renderProjects(cachedData) {
  document.getElementById("card-title").textContent = "Top 10 Projects";

  const user = get(() => cachedData.data.user && cachedData.data.user[0], null);
  let transactions = Array.isArray(user?.topTransactions) ? user.topTransactions : [];

  // keep only top 10
  transactions = transactions.slice(0, 10);

  if (!Array.isArray(transactions) || transactions.length === 0) {
    document.getElementById("card-content").innerHTML = `<p class="muted">No XP transactions found.</p>`;
    return;
  }

  let totalXP = get(() => user.transactions_aggregate.aggregate.sum.amount, null);
  if (totalXP == null) {
    totalXP = transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  } else {
    totalXP = Number(totalXP) || 0;
  }

  const totalXPFormatted = calculateXp(totalXP);
  const itemsHtml = renderListItems(transactions, totalXP);

  // Use a flexible container so it fills the card and scrolls if needed
  document.getElementById("card-content").innerHTML = `
    <div class="xp-list-container">
      <ul class="xp-list">
        ${itemsHtml}
      </ul>
    </div>
  `;
}

export function renderStats(cachedData) {
  document.getElementById("card-title").textContent = "Last 10 Transactions";

  const user = get(() => cachedData.data.user && cachedData.data.user[0], null);
  let transactions = Array.isArray(user?.transactions) ? user.transactions.slice() : [];

  if (!Array.isArray(transactions) || transactions.length === 0) {
    document.getElementById("card-content").innerHTML = `<p class="muted">No recent transactions found.</p>`;
    return;
  }

  // sort by createdAt (newest first) when possible, then take 10
  transactions.sort((a, b) => {
    const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  transactions = transactions.slice(0, 10);

  let totalXP = get(() => user.transactions_aggregate.aggregate.sum.amount, null);
  if (totalXP == null) {
    totalXP = transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  } else {
    totalXP = Number(totalXP) || 0;
  }

  const totalXPFormatted = calculateXp(totalXP);
  const itemsHtml = renderListItems(transactions, totalXP);

  document.getElementById("card-content").innerHTML = `
    <div class="xp-list-container">
      <ul class="xp-list">
        ${itemsHtml}
      </ul>
    </div>
  `;
}

    // /root/home.html
    // /root/index.html
    // /root/public/js/home.js
    // /root/public/js/login.js
    // /root/public/graphql/user.graphql
    // /root/public/js/views/welcome.js
    // /root/public/js/graphql.js
    // /root/public/css/home.css