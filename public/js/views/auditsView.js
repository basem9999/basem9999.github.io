import { formatNumber, formatPercent, get} from "../home.js";

export function renderPieChart(cachedData, getHelper) {
  const cardTitle = document.getElementById("card-title");
  const cardContent = document.getElementById("card-content");
  if (!cardTitle || !cardContent) return;

  cardTitle.textContent = "Audits Overview";

  // defensive read from cachedData
  const user = get(() => cachedData.data.user && cachedData.data.user[0], null);
  const totalUp = Number(get(() => user.totalUp, 0)) || 0;
  const totalDown = Number(get(() => user.totalDown, 0)) || 0;
  const total = totalUp + totalDown;

  // compute ratio
  const ratio = totalDown === 0 ? null : totalUp / totalDown;
  const ratioText = ratio == null ? "—" : (Math.round(ratio * 10) / 10).toFixed(1);

  cardContent.innerHTML = `
    <div style="text-align:center; padding-top:6px;">
      <div class="muted" style="font-size:14px; font-weight:600;">
        Audit ratio : <span style="font-size:20px; font-weight:700;">${ratioText}</span>
      </div>
    </div>
    <div id="pie-chart" style="display:flex;justify-content:center;align-items:center;padding-top:8px;"></div>
  `;

  // remove any previous chart
  d3.select("#pie-chart").selectAll("*").remove();

  if (total === 0) {
    d3.select("#pie-chart")
      .append("div")
      .attr("role", "status")
      .style("color", "rgba(255,255,255,0.9)")
      .text("No audit data to display.");
    return;
  }

  const data = [
    { label: "Audits Done", value: totalUp },
    { label: "Audits Received", value: totalDown }
  ];

  const width = 200;
  const height = 200;
  const radius = Math.min(width, height) / 2;

  const svg = d3.select("#pie-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .style("max-width", "180px")
    .style("width", "100%")
    .style("height", "auto")
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  const color = d3.scaleOrdinal()
    .domain(data.map(d => d.label))
    .range(["#00a7f5ff", "#da2e81ff"]);

  const pie = d3.pie().value(d => d.value).sort(null);
  const arc = d3.arc().innerRadius(0).outerRadius(radius - 10);
  const arcLabel = d3.arc().innerRadius(radius * 0.6).outerRadius(radius * 0.6);

  const slices = svg.selectAll("path.slice")
    .data(pie(data))
    .enter()
    .append("path")
    .attr("class", "slice")
    .attr("d", arc)
    .attr("fill", d => color(d.data.label))
    .attr("stroke", "white")
    .style("stroke-width", "4px")
    .each(function(d) { this._current = d; });

  slices.append("title")
    .text(d => `${d.data.label}: ${formatNumber(d.data.value)} (${formatPercent(d.data.value, total)})`);

  slices.transition()
    .duration(600)
    .attrTween("d", function(d) {
      const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
      return t => arc(i(t));
    });

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