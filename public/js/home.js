// /public/js/home.js
import { fetchUserData } from "./graphql.js";
import { renderWelcome } from "./views/welcome.js";

let cachedData = null; // store the fetched GraphQL response

// helper: safe access
const get = (fn, fallback = undefined) => {
  try { const v = fn(); return v ?? fallback; } catch { return fallback; }
};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

function formatPercent(value, total) {
  if (total === 0) return "0%";
  return Math.round((value / total) * 100) + "%";
}

// simple number formatter with thousands separators
function formatNumber(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat().format(v);
}

/**
 * Renders the audit ratio into the existing card (card-title + card-content).
 * It will:
 *  - inject a small header and a <div id="pie-chart"> container into the card content,
 *  - draw the D3 pie chart,
 *  - handle zero-data gracefully.
 */
function renderPieChart() {
  // set card title
  const cardTitle = document.getElementById("card-title");
  const cardContent = document.getElementById("card-content");
  if (!cardTitle || !cardContent) return;

  cardTitle.textContent = "Audit Ratio";

  // read user data defensively from cachedData
  const user = get(() => cachedData.data.user && cachedData.data.user[0], null);
  const totalUp = Number(get(() => user.totalUp, 0)) || 0;
  const totalDown = Number(get(() => user.totalDown, 0)) || 0;
  const total = totalUp + totalDown;

  // inject the small title + pie container into the card content
  cardContent.innerHTML = `
    <p class="muted" id="total-audits-title">Audits Done: ${formatNumber(totalUp)} | Audits Received: ${formatNumber(totalDown)}</p>
    <div id="pie-chart" style="display:flex;justify-content:center;align-items:center;padding-top:8px;"></div>
  `;

  // clear old chart (defensive)
  d3.select("#pie-chart").selectAll("*").remove();

  if (total === 0) {
    // nothing to show
    d3.select("#pie-chart")
      .append("div")
      .attr("role", "status")
      .style("color", "rgba(255,255,255,0.9)")
      .text("No audit data to display.");
    return;
  }

  // Prepare numeric data
  const data = [
    { label: "Audits Done", value: totalUp },
    { label: "Audits Received", value: totalDown }
  ];

  // Chart size
  const width = 200;
  const height = 200;
  const radius = Math.min(width, height) / 2;

  // Create svg and group centered
  const svg = d3.select("#pie-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .style("max-width", "180px")   // fits nicely inside glass-container
    .style("width", "100%")
    .style("height", "auto")
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  // Color scale
  const color = d3.scaleOrdinal()
    .domain(data.map(d => d.label))
    .range(["#0061F5", "#DA2E40"]);

  // Pie & arc generators
  const pie = d3.pie().value(d => d.value).sort(null);
  const arc = d3.arc().innerRadius(0).outerRadius(radius - 10);
  const arcLabel = d3.arc().innerRadius(radius * 0.6).outerRadius(radius * 0.6);

  // Bind data & draw slices
  const slices = svg.selectAll("path.slice")
    .data(pie(data))
    .enter()
    .append("path")
    .attr("class", "slice")
    .attr("d", arc)
    .attr("fill", d => color(d.data.label))
    .attr("stroke", "white")
    .style("stroke-width", "4px")
    .each(function(d) { this._current = d; }); // store for future transitions

  // Accessibility: titles for screen readers + hover
  slices.append("title")
    .text(d => `${d.data.label}: ${formatNumber(d.data.value)} (${formatPercent(d.data.value, total)})`);

  // Animate slices (simple tween)
  slices.transition()
    .duration(600)
    .attrTween("d", function(d) {
      const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
      return t => arc(i(t));
    });

  // Add labels (centered on slice)
  svg.selectAll("text.slice-label")
    .data(pie(data))
    .enter()
    .append("text")
    .attr("class", "slice-label")
    .attr("transform", d => `translate(${arcLabel.centroid(d)})`)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "white")
    .text(d => `${d.data.label} (${formatPercent(d.data.value, total)})`);
}


// convert total XP to human-friendly unit (XP, KB, MB)
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

function renderXP() {
  document.getElementById("card-title").textContent = "Top 10 Projects";

  // read user (defensive)
  const user = get(() => cachedData.data.user && cachedData.data.user[0], null);
  const transactions = Array.isArray(user?.topTransactions) ? user.topTransactions : [];

  if (!Array.isArray(transactions) || transactions.length === 0) {
    document.getElementById("card-content").innerHTML = `<p class="muted">No XP transactions found.</p>`;
    return;
  }

  // total XP from aggregate if available, otherwise sum the transactions we have
  let totalXP = get(() => user.transactions_aggregate.aggregate.sum.amount, null);
  if (totalXP == null) {
    totalXP = transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  } else {
    totalXP = Number(totalXP) || 0;
  }

  // format total XP using calculateXp
  const totalXPFormatted = calculateXp(totalXP);

  // ensure we have a non-zero max for bar scaling (use top transaction amount as max)
  const maxAmount = Math.max(1, ...transactions.map(t => Number(t.amount) || 0));

  // helper to get last path segment (handles trailing slashes and empty parts)
  const lastSegment = (p) => {
    if (!p || typeof p !== "string") return "(unknown)";
    const parts = p.split("/").filter(Boolean);
    return parts.length ? parts.pop() : p;
  };

  // build list items (now showing formatted amt per project)
  const items = transactions.map((t, i) => {
    const rawAmt = Number(t.amount) || 0;
    const amt = rawAmt; // keep numeric for calculations
    const amtFormatted = calculateXp(amt); // <--- formatted string (e.g. "143.55 KB")
    const pctOfTotal = totalXP > 0 ? Math.round((amt / totalXP) * 100) : 0;
    const widthPct = Math.round((amt / maxAmount) * 100); // for bar relative to top item
    const when = t.createdAt ? formatDate(t.createdAt) : "";
    const path = t.path || "(unknown)";
    const name = lastSegment(path);

    return `
      <li style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:13px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:170px;">
            <strong title="${path}">${i+1}. ${escapeHtml(name)}</strong>
            <div class="muted" style="font-size:11px; margin-top:4px;">${when}</div>
          </div>
          <div style="text-align:right; min-width:90px;">
            <div style="font-weight:600">${amtFormatted}</div>
            <div class="muted" style="font-size:11px;">${pctOfTotal}% <span style="opacity:0.8">(${amt})</span></div>
          </div>
        </div>
        <div style="margin-top:6px; background:rgba(255,255,255,0.06); height:8px; border-radius:6px; overflow:hidden;">
          <div style="height:8px; width:${widthPct}%; border-radius:6px; background:linear-gradient(90deg,#7af,#47f);"></div>
        </div>
      </li>
    `;
  }).join("");

  // wrap items in a scrollable container so it stretches but doesn't overflow the glass card
  document.getElementById("card-content").innerHTML = `
    <p class="muted">Total XP: <strong>${totalXPFormatted}</strong> <span class="muted" style="font-size:12px;">(${totalXP})</span></p>
    <div style="max-height:170px; overflow:auto; padding-right:6px; margin-top:6px;">
      <ul style="list-style:none;padding:0;margin:0;">
        ${items}
      </ul>
    </div>
  `;
}


// small helper to avoid injecting raw html from path into title (prevent accidental markup)
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getTopSkillsFromCached(n = 6) {
  const user = get(() => cachedData.data.user && cachedData.data.user[0], null);

  // possible places your data might live:
  let tx = Array.isArray(user?.topSkills) ? user.topSkills
         : Array.isArray(user?.topTransactions) ? user.topTransactions
         : Array.isArray(user?.transactions) ? user.transactions
         : [];

  // ensure we only use transactions whose type starts with skill_
  tx = tx.filter(t => typeof t?.type === "string" && t.type.startsWith("skill_"));

  // group by skill suffix (skill_python -> python), keep maximum amount per skill
  const skillMap = new Map();
  tx.forEach(t => {
    const rawType = t.type;
    const suffix = rawType.split("_").slice(1).join("_") || rawType; // anything after the first underscore
    const amt = Number(t.amount) || 0;
    const prev = skillMap.get(suffix);
    if (prev == null || amt > prev) skillMap.set(suffix, amt);
  });

  // convert to array and sort by amount desc
  const arr = Array.from(skillMap.entries()).map(([skill, amount]) => ({
    type: `skill_${skill}`,
    amount
  }));

  arr.sort((a, b) => b.amount - a.amount);
  return arr.slice(0, n);
}

/**
 * Renders the Top Skills view (title + list + spider chart)
 * inside the single card content area.
 */
function renderSkillsView() {
  const cardTitle = document.getElementById("card-title");
  const cardContent = document.getElementById("card-content");
  if (!cardTitle || !cardContent) return;

  cardTitle.textContent = "Top Skills";

  // get the top skills (JS-side filtering/sorting)
  const skills = getTopSkillsFromCached(6); // take up to 6 skills for the spider chart

  // produce html: short description + spider-chart container only
  cardContent.innerHTML = `
    <p class="muted">Your top skills (by amount)</p>
    <div id="spider-chart" style="margin-top:10px; display:flex; justify-content:center; align-items:center;"></div>
  `;

  // draw radar / spider chart with D3
  renderSpiderChart(skills);
}

/**
 * Draws a radar/spider chart for an array of skills:
 * skills: [{ type: "skill_python", amount: 42 }, ...]
 */
// compact spider chart: smaller svg, scaled-down polygon and points
function renderSpiderChart(skills) {
  // clear previous chart
  const container = d3.select("#spider-chart");
  container.selectAll("*").remove();

  if (!Array.isArray(skills) || skills.length === 0) {
    container.append("div").attr("class", "muted").text("No skill data to display.");
    return;
  }

  const data = skills.map((skill, i) => ({
    axis: skill.type.split("_").slice(1).join("_") || skill.type,
    value: Number(skill.amount) || 0,
    index: i
  }));

  // compact sizing to fit the card without scrolling
  const width = 180;   // smaller than before
  const height = 180;
  const baseRadius = Math.min(width, height) / 2;
  const scaleFactor = 0.78; // <1 to shrink the plotted polygon relative to the full radius
  const radius = baseRadius * scaleFactor;

  const levels = 4; // fewer levels for compact chart
  const maxValue = Math.max(1, ...data.map(d => d.value));

  // create SVG with viewBox so it scales responsively
  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("max-width", `${width}px`)
    .style("width", "100%")
    .style("height", "auto")
    .append("g")
    .attr("transform", `translate(${width/2}, ${height/2})`);

  // angle & radius scales
  const angleScale = d3.scaleLinear()
    .domain([0, data.length])
    .range([0, 2 * Math.PI]);

  // radiusScale maps 0..maxValue => 0..radius (already shrunk by scaleFactor)
  const radiusScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, radius]);

  // draw concentric levels (lighter stroke)
  for (let lvl = 1; lvl <= levels; lvl++) {
    const r = (radius / levels) * lvl;
    svg.append("circle")
      .attr("r", r)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.06)")
      .attr("stroke-width", 0.5);
  }

  // axis lines & labels (smaller font)
  data.forEach((d, i) => {
    const angle = angleScale(i) - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    svg.append("line")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", x).attr("y2", y)
      .attr("stroke", "rgba(255,255,255,0.06)")
      .attr("stroke-width", 0.5);

    // place label slightly further out but use smaller text
    const labelOffset = 8;
    svg.append("text")
      .attr("x", Math.cos(angle) * (radius + labelOffset))
      .attr("y", Math.sin(angle) * (radius + labelOffset))
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .style("font-size", "10px")
      .style("fill", "white")
      .text(d.axis);
  });

  // radar line generator (uses radiusScale which already respects scaleFactor)
  const radarLine = d3.line()
    .x(d => {
      const angle = angleScale(d.index) - Math.PI / 2;
      return Math.cos(angle) * radiusScale(d.value);
    })
    .y(d => {
      const angle = angleScale(d.index) - Math.PI / 2;
      return Math.sin(angle) * radiusScale(d.value);
    })
    .curve(d3.curveLinearClosed);

  // draw filled polygon (thinner stroke + slightly lower opacity to look compact)
  svg.append("path")
    .datum(data)
    .attr("d", radarLine)
    .attr("fill", "#0061F5")
    .attr("fill-opacity", 0.12)
    .attr("stroke", "#0061F5")
    .attr("stroke-width", 1.2);

  // draw smaller data points
  data.forEach(d => {
    const angle = angleScale(d.index) - Math.PI / 2;
    const x = Math.cos(angle) * radiusScale(d.value);
    const y = Math.sin(angle) * radiusScale(d.value);

    svg.append("circle")
      .attr("cx", x).attr("cy", y)
      .attr("r", 2)                      // smaller radius
      .attr("fill", "#0061F5")
      .attr("stroke", "white")
      .attr("stroke-width", 0.7);
  });
}

function renderStats() {
  document.getElementById("card-title").textContent = "Last 10 Transactions ";

  // defensive read of user object
  const user = get(() => cachedData.data.user && cachedData.data.user[0], null);
  // use latest transactions (your merged query returns the latest ones as `transactions`)
  const transactions = Array.isArray(user?.transactions) ? user.transactions : [];

  if (!Array.isArray(transactions) || transactions.length === 0) {
    document.getElementById("card-content").innerHTML = `<p class="muted">No recent transactions found.</p>`;
    return;
  }

  // total XP from aggregate if available, otherwise sum the transactions we have
  let totalXP = get(() => user.transactions_aggregate.aggregate.sum.amount, null);
  if (totalXP == null) {
    totalXP = transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  } else {
    totalXP = Number(totalXP) || 0;
  }

  // format total XP using calculateXp
  const totalXPFormatted = calculateXp(totalXP);

  // ensure we have a non-zero max for bar scaling (use largest transaction amount as max)
  const maxAmount = Math.max(1, ...transactions.map(t => Number(t.amount) || 0));

  // helper to get last path segment (handles trailing slashes and empty parts)
  const lastSegment = (p) => {
    if (!p || typeof p !== "string") return "(unknown)";
    const parts = p.split("/").filter(Boolean);
    return parts.length ? parts.pop() : p;
  };

  // build list items
  const items = transactions.map((t, i) => {
    const rawAmt = Number(t.amount) || 0;
    const amtFormatted = calculateXp(rawAmt); // formatted like "143.55 KB"
    const pctOfTotal = totalXP > 0 ? Math.round((rawAmt / totalXP) * 100) : 0;
    const widthPct = Math.round((rawAmt / maxAmount) * 100);
    const when = t.createdAt ? formatDate(t.createdAt) : "";
    const path = t.path || "(unknown)";
    const name = lastSegment(path);

    return `
      <li style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:13px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:170px;">
            <strong title="${path}">${i+1}. ${escapeHtml(name)}</strong>
            <div class="muted" style="font-size:11px; margin-top:4px;">${when}</div>
          </div>
          <div style="text-align:right; min-width:90px;">
            <div style="font-weight:600">${amtFormatted}</div>
            <div class="muted" style="font-size:11px;">${pctOfTotal}% <span style="opacity:0.8">(${rawAmt})</span></div>
          </div>
        </div>
        <div style="margin-top:6px; background:rgba(255,255,255,0.06); height:8px; border-radius:6px; overflow:hidden;">
          <div style="height:8px; width:${widthPct}%; border-radius:6px; background:linear-gradient(90deg,#7af,#47f);"></div>
        </div>
      </li>
    `;
  }).join("");

  document.getElementById("card-content").innerHTML = `
    <p class="muted">Total XP: <strong>${totalXPFormatted}</strong> <span class="muted" style="font-size:12px;">(${totalXP})</span></p>
    <div style="max-height:170px; overflow:auto; padding-right:6px; margin-top:6px;">
      <ul style="list-style:none;padding:0;margin:0;">
        ${items}
      </ul>
    </div>
  `;
}


function renderView(name) {
  switch (name) {
    case "welcome": renderWelcome(cachedData, get); break;
    case "activity": renderPieChart(); break;
    case "xp": renderXP(); break;
    case "projects": renderSkillsView(); break;
    case "stats": renderStats(); break;
    default: renderWelcome(cachedData, get); break;
  }
}

function setupButtons() {
  const buttons = Array.from(document.querySelectorAll(".card-btn"));
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      // toggle active class
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const view = btn.dataset.view || "welcome";
      renderView(view);
    });
  });
  // make sure initial active view is rendered
  const active = document.querySelector(".card-btn.active") || buttons[0];
  if (active) renderView(active.dataset.view || "welcome");
}

function signOutAndRedirect(reason) {
  try { localStorage.removeItem("authToken"); } catch (e) { console.warn(e); }
  try { localStorage.removeItem("ig precent"); } catch (e) { console.warn(e); }
  console.warn("Signing out due to:", reason);
  // optionally show a short message to user before redirect
  // (avoid long delays — redirect immediately so they cannot view protected UI)
  window.location.href = "/index.html";
}

async function init() {
  // 1. token check
  const token = localStorage.getItem("authToken");
  if (!token) {
    window.location.href = "/index.html";
    return;
  }

  // 2. fetch user data (fetchUserData reads token from localStorage if not provided)
  try {
    cachedData = await fetchUserData(token);
  } catch (err) {
    console.error("Could not fetch user data:", err);

    // Normalize error message for detection
    const msg = String(err?.message || err);

    // If server indicates the JWT is expired / invalid, sign out and redirect
    // covers messages like: "Could not verify JWT: JWTExpired" or anything with "expired" / "jwt"
    if (/jwt.*expired/i.test(msg) || /jwtexpired/i.test(msg) || /could not verify jwt/i.test(msg) || /expired/i.test(msg)) {
      // Give the user a short alert (optional) then sign out
      try {
        // small UX touch: let them know session expired
        // If you prefer no alert, remove the next line.
        alert("Session expired — you will be signed out and returned to the login page.");
      } catch (ignore) {}
      signOutAndRedirect(msg);
      return;
    }

    // For other errors, don't redirect — show an empty dataset so UI doesn't break
    cachedData = { data: {} };
  }

  // 3. Setup button behavior and initial render
  setupButtons();

  // 4. Logout setup (guard in case element is missing)
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("authToken");
      localStorage.removeItem("ig precent");
      window.location.href = "/index.html";
    });
  }
}



// run
document.addEventListener("DOMContentLoaded", init);
