import { get } from "../home.js";

export function getTopSkillsFromCached(cachedData, n = 6) {
  const user = get(() => cachedData.data.user && cachedData.data.user[0], null);

  let tx = Array.isArray(user?.topSkills) ? user.topSkills
         : Array.isArray(user?.topTransactions) ? user.topTransactions
         : Array.isArray(user?.transactions) ? user.transactions
         : [];

  tx = tx.filter(t => typeof t?.type === "string" && t.type.startsWith("skill_"));

  const skillMap = new Map();
  tx.forEach(t => {
    const rawType = t.type;
    const suffix = rawType.split("_").slice(1).join("_") || rawType;
    const amt = Number(t.amount) || 0;
    const prev = skillMap.get(suffix);
    if (prev == null || amt > prev) skillMap.set(suffix, amt);
  });

  const arr = Array.from(skillMap.entries()).map(([skill, amount]) => ({
    type: `skill_${skill}`,
    amount
  }));

  arr.sort((a, b) => b.amount - a.amount);
  return arr.slice(0, n);
}

export function renderSkillsView(cachedData) {
  const cardTitle = document.getElementById("card-title");
  const cardContent = document.getElementById("card-content");
  if (!cardTitle || !cardContent) return;

  cardTitle.textContent = "Top Skills";

  const skills = getTopSkillsFromCached(cachedData, 6);

  cardContent.innerHTML = `
    <div id="spider-chart" style="margin-top:10px; display:flex; justify-content:center; align-items:center;"></div>
  `;

  renderSpiderChart(skills);
}

function renderSpiderChart(skills) {
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

  const width = 220;
  const height = 220;
  const baseRadius = Math.min(width, height) / 2;
  const scaleFactor = 0.78;
  const radius = baseRadius * scaleFactor;

  const levels = 4;
  const maxValue = Math.max(1, ...data.map(d => d.value));

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("max-width", `${width}px`)
    .style("width", "100%")
    .style("height", "auto")
    .append("g")
    .attr("transform", `translate(${width/2}, ${height/2})`);

  const angleScale = d3.scaleLinear()
    .domain([0, data.length])
    .range([0, 2 * Math.PI]);

  const radiusScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, radius]);

  // concentric circles
  for (let lvl = 1; lvl <= levels; lvl++) {
    const r = (radius / levels) * lvl;
    svg.append("circle")
      .attr("r", r)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.06)")
      .attr("stroke-width", 0.5);
  }

  data.forEach((d, i) => {
    const angle = angleScale(i) - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    svg.append("line")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", x).attr("y2", y)
      .attr("stroke", "rgba(255,255,255,0.06)")
      .attr("stroke-width", 0.5);

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

  svg.append("path")
    .datum(data)
    .attr("d", radarLine)
    .attr("fill", "#0061F5")
    .attr("fill-opacity", 0.12)
    .attr("stroke", "#0061F5")
    .attr("stroke-width", 1.2);

  data.forEach(d => {
    const angle = angleScale(d.index) - Math.PI / 2;
    const x = Math.cos(angle) * radiusScale(d.value);
    const y = Math.sin(angle) * radiusScale(d.value);

    svg.append("circle")
      .attr("cx", x).attr("cy", y)
      .attr("r", 2)
      .attr("fill", "#0061F5")
      .attr("stroke", "white")
      .attr("stroke-width", 0.7);
  });
}
