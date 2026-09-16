const NS = "http://www.w3.org/2000/svg";
const fmtInt = (n) => n.toLocaleString("ko-KR");
const fmtPct = (n) => `${(n * 100).toFixed(1)}%`;

let dashboardData = null;

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

const tooltipEl = document.getElementById("tooltip");

function showTooltip(clientX, clientY, title, rows) {
  clear(tooltipEl);
  const titleEl = document.createElement("div");
  titleEl.className = "title";
  titleEl.textContent = title;
  tooltipEl.appendChild(titleEl);
  rows.forEach(({ label, value, color }) => {
    const row = document.createElement("div");
    row.className = "row";
    if (color) {
      const key = document.createElement("span");
      key.className = "key";
      key.style.background = color;
      row.appendChild(key);
    }
    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value;
    row.appendChild(labelSpan);
    row.appendChild(valueEl);
    tooltipEl.appendChild(row);
  });
  tooltipEl.style.display = "block";
  const pad = 14;
  let left = clientX + pad;
  let top = clientY + pad;
  const rect = tooltipEl.getBoundingClientRect();
  if (left + rect.width > window.innerWidth) left = clientX - rect.width - pad;
  if (top + rect.height > window.innerHeight) top = clientY - rect.height - pad;
  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
}

function hideTooltip() {
  tooltipEl.style.display = "none";
}

function buildLegend(container, items) {
  const legend = document.createElement("div");
  legend.className = "legend";
  items.forEach(({ label, color, line }) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch" + (line ? " line" : "");
    swatch.style.background = color;
    item.appendChild(swatch);
    const text = document.createElement("span");
    text.textContent = label;
    item.appendChild(text);
    legend.appendChild(item);
  });
  container.appendChild(legend);
}

function niceMax(value) {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) {
    if (value <= s * magnitude) return s * magnitude;
  }
  return 10 * magnitude;
}

// ---- Line chart (shared single axis, crosshair + tooltip) ----
function lineChart(container, { xLabels, series, width = 640, height = 220 }) {
  clear(container);
  const marginL = 44, marginR = 12, marginT = 12, marginB = 26;
  const plotW = width - marginL - marginR;
  const plotH = height - marginT - marginB;
  const maxVal = niceMax(Math.max(1, ...series.flatMap((s) => s.points)));
  const n = xLabels.length;
  const xAt = (i) => marginL + (n <= 1 ? 0 : (plotW * i) / (n - 1));
  const yAt = (v) => marginT + plotH - (plotH * v) / maxVal;

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height });
  container.appendChild(svg);

  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const v = (maxVal / ticks) * t;
    const y = yAt(v);
    svg.appendChild(svgEl("line", { x1: marginL, x2: width - marginR, y1: y, y2: y, class: "gridline" }));
    const label = svgEl("text", { x: marginL - 8, y: y + 3, "text-anchor": "end", class: "axis-label" });
    label.textContent = fmtInt(Math.round(v));
    svg.appendChild(label);
  }
  svg.appendChild(svgEl("line", { x1: marginL, x2: width - marginR, y1: marginT + plotH, y2: marginT + plotH, class: "baseline" }));

  const step = Math.max(1, Math.ceil(n / 8));
  xLabels.forEach((lab, i) => {
    if (i % step !== 0 && i !== n - 1) return;
    const label = svgEl("text", { x: xAt(i), y: height - 6, "text-anchor": "middle", class: "axis-label" });
    label.textContent = lab;
    svg.appendChild(label);
  });

  series.forEach((s) => {
    const d = s.points.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(v)}`).join(" ");
    const path = svgEl("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" });
    svg.appendChild(path);
  });

  const crosshair = svgEl("line", { y1: marginT, y2: marginT + plotH, class: "gridline", style: "display:none" });
  svg.appendChild(crosshair);
  const dots = series.map((s) => {
    const dot = svgEl("circle", { r: 4, fill: s.color, stroke: "var(--surface)", "stroke-width": 2, style: "display:none" });
    svg.appendChild(dot);
    return dot;
  });

  const hit = svgEl("rect", { x: marginL, y: marginT, width: plotW, height: plotH, fill: "transparent" });
  svg.appendChild(hit);

  function onMove(evt) {
    const rect = svg.getBoundingClientRect();
    const scale = width / rect.width;
    const localX = (evt.clientX - rect.left) * scale;
    let idx = Math.round(((localX - marginL) / plotW) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    const x = xAt(idx);
    crosshair.setAttribute("x1", x);
    crosshair.setAttribute("x2", x);
    crosshair.style.display = "block";
    series.forEach((s, i) => {
      dots[i].setAttribute("cx", x);
      dots[i].setAttribute("cy", yAt(s.points[idx]));
      dots[i].style.display = "block";
    });
    showTooltip(
      evt.clientX,
      evt.clientY,
      xLabels[idx],
      series.map((s) => ({ label: s.name, value: fmtInt(s.points[idx]), color: s.color }))
    );
  }
  hit.addEventListener("pointermove", onMove);
  hit.addEventListener("pointerleave", () => {
    crosshair.style.display = "none";
    dots.forEach((d) => (d.style.display = "none"));
    hideTooltip();
  });

  buildLegend(container, series.map((s) => ({ label: s.name, color: s.color, line: true })));
}

// ---- Horizontal bar chart ----
function hBarChart(container, { items, width = 560, barHeight = 22, gap = 10, valueFormat = fmtInt }) {
  clear(container);
  const marginL = 96, marginR = 46, marginT = 6;
  const plotW = width - marginL - marginR;
  const maxVal = niceMax(Math.max(1, ...items.map((it) => it.value)));
  const height = marginT + items.length * (barHeight + gap);

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height });
  container.appendChild(svg);

  items.forEach((it, i) => {
    const y = marginT + i * (barHeight + gap);
    const w = Math.max(2, (plotW * it.value) / maxVal);
    const label = svgEl("text", { x: marginL - 10, y: y + barHeight / 2 + 4, "text-anchor": "end", class: "axis-label" });
    label.textContent = it.label;
    svg.appendChild(label);

    const barGroup = svgEl("g");
    const rect = svgEl("rect", {
      x: marginL, y, width: w, height: barHeight, rx: 4, ry: 4,
      style: `fill:${it.color}`,
    });
    barGroup.appendChild(rect);

    const showInside = w > 46;
    const valText = svgEl("text", {
      x: showInside ? marginL + w - 8 : marginL + w + 8,
      y: y + barHeight / 2 + 4,
      "text-anchor": showInside ? "end" : "start",
      class: "value-label",
    });
    if (showInside) valText.setAttribute("style", "fill:#fff");
    valText.textContent = valueFormat(it.value);
    barGroup.appendChild(valText);

    const hit = svgEl("rect", { x: marginL, y, width: plotW, height: barHeight, fill: "transparent" });
    hit.addEventListener("pointermove", (evt) => {
      showTooltip(evt.clientX, evt.clientY, it.label, [{ label: it.tooltipLabel || "값", value: valueFormat(it.value), color: it.color }]);
      rect.setAttribute("opacity", "0.85");
    });
    hit.addEventListener("pointerleave", () => {
      hideTooltip();
      rect.setAttribute("opacity", "1");
    });
    barGroup.appendChild(hit);
    svg.appendChild(barGroup);
  });
}

// ---- 100% stacked bar (visit type by month) ----
function stackedPercentBar(container, { categories, series, width = 560, height = 220 }) {
  clear(container);
  const marginL = 40, marginR = 12, marginT = 10, marginB = 26;
  const plotW = width - marginL - marginR;
  const plotH = height - marginT - marginB;
  const n = categories.length;
  const bandW = plotW / n;
  const barW = Math.min(40, bandW * 0.6);
  const gapPx = 2;

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height });
  container.appendChild(svg);

  [0, 0.25, 0.5, 0.75, 1].forEach((f) => {
    const y = marginT + plotH * (1 - f);
    svg.appendChild(svgEl("line", { x1: marginL, x2: width - marginR, y1: y, y2: y, class: "gridline" }));
    const label = svgEl("text", { x: marginL - 8, y: y + 3, "text-anchor": "end", class: "axis-label" });
    label.textContent = `${Math.round(f * 100)}%`;
    svg.appendChild(label);
  });

  categories.forEach((cat, i) => {
    const cx = marginL + bandW * i + bandW / 2;
    const total = series.reduce((sum, s) => sum + (s.valuesByCategory[cat] || 0), 0) || 1;
    let yCursor = marginT + plotH;
    series.forEach((s) => {
      const v = s.valuesByCategory[cat] || 0;
      const segH = Math.max(0, (plotH * v) / total - gapPx);
      const y = yCursor - segH;
      const rect = svgEl("rect", { x: cx - barW / 2, y, width: barW, height: segH, style: `fill:${s.color}` });
      svg.appendChild(rect);
      const hit = svgEl("rect", { x: cx - barW / 2, y, width: barW, height: segH + gapPx, fill: "transparent" });
      hit.addEventListener("pointermove", (evt) => {
        showTooltip(evt.clientX, evt.clientY, cat, [{ label: s.name, value: `${fmtInt(v)}건 (${fmtPct(v / total)})`, color: s.color }]);
      });
      hit.addEventListener("pointerleave", hideTooltip);
      svg.appendChild(hit);
      yCursor = y - gapPx;
    });
    const label = svgEl("text", { x: cx, y: height - 6, "text-anchor": "middle", class: "axis-label" });
    label.textContent = cat.slice(5);
    svg.appendChild(label);
  });

  buildLegend(container, series.map((s) => ({ label: s.name, color: s.color })));
}

// ---- Heatmap grid ----
function heatmapGrid(container, { rows, cols, valueAt, width = 560 }) {
  clear(container);
  const marginL = 34, marginT = 16, cellGap = 3;
  const cellW = (width - marginL) / cols.length - cellGap;
  const cellH = 24;
  const height = marginT + rows.length * (cellH + cellGap);
  const maxVal = Math.max(1, ...rows.flatMap((r) => cols.map((c) => valueAt(r, c))));

  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height });
  container.appendChild(svg);

  cols.forEach((c, ci) => {
    if (ci % 2 !== 0) return;
    const label = svgEl("text", { x: marginL + ci * (cellW + cellGap) + cellW / 2, y: 10, "text-anchor": "middle", class: "axis-label" });
    label.textContent = `${c}시`;
    svg.appendChild(label);
  });

  rows.forEach((r, ri) => {
    const y = marginT + ri * (cellH + cellGap);
    const label = svgEl("text", { x: marginL - 8, y: y + cellH / 2 + 4, "text-anchor": "end", class: "axis-label" });
    label.textContent = r;
    svg.appendChild(label);

    cols.forEach((c, ci) => {
      const x = marginL + ci * (cellW + cellGap);
      const v = valueAt(r, c);
      const alpha = v === 0 ? 0.06 : 0.12 + 0.85 * (v / maxVal);
      const rect = svgEl("rect", {
        x, y, width: cellW, height: cellH, rx: 3,
        style: `fill:rgba(var(--series-1-rgb),${alpha.toFixed(3)})`,
      });
      svg.appendChild(rect);
      rect.addEventListener("pointermove", (evt) => {
        showTooltip(evt.clientX, evt.clientY, `${r}요일 ${c}시`, [{ label: "예약 건수", value: fmtInt(v) }]);
      });
      rect.addEventListener("pointerleave", hideTooltip);
    });
  });
}

function statTile(container, label, value) {
  const tile = document.createElement("div");
  tile.className = "stat-tile";
  const l = document.createElement("div");
  l.className = "label";
  l.textContent = label;
  const v = document.createElement("div");
  v.className = "value";
  v.textContent = value;
  tile.appendChild(l);
  tile.appendChild(v);
  container.appendChild(tile);
}

// ---------------------------------------------------------------

const CHANNEL_COLOR = { 위챗: "var(--series-1)", 라인: "var(--series-2)", 미니: "var(--series-3)", 미상: "var(--series-muted)" };
const STATUS_ORDER = ["예약완료", "기타", "시술문의", "예약문의", "가격문의", "변경/취소", "그 외"];
const STATUS_COLOR = {
  예약완료: "var(--series-1)", 기타: "var(--series-2)", 시술문의: "var(--series-3)",
  예약문의: "var(--series-4)", 가격문의: "var(--series-5)", "변경/취소": "var(--series-6)", "그 외": "var(--series-7)",
};
const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

const STAGE_ORDER = ["답변없음", "협찬거절", "협의중", "예약완료", "방문완료", "업로드완료", "기타"];
const STAGE_COLOR = {
  답변없음: "var(--series-muted)", 협찬거절: "var(--series-8)", 협의중: "var(--series-4)",
  예약완료: "var(--series-5)", 방문완료: "var(--series-2)", 업로드완료: "var(--series-1)", 기타: "var(--series-7)",
};
const FOLLOWER_TIER_ORDER = ["1만 미만", "1만~5만", "5만~10만", "10만 이상", "미상"];
const UPLOADED_STAGE = "업로드완료";
const DEAD_STAGES = new Set(["답변없음", "협찬거절"]);

const EXPERIENCE_STATUS_ORDER = ["방문완료", "예약완료", "예약요청", "취소", "미표시"];
const EXPERIENCE_STATUS_COLOR = {
  방문완료: "var(--series-1)", 예약완료: "var(--series-3)", 예약요청: "var(--series-4)",
  취소: "var(--series-8)", 미표시: "var(--series-muted)",
};

const VIRAL_PLATFORM_ORDER = ["샤오홍슈", "스레드"];
const VIRAL_PLATFORM_COLOR = { 샤오홍슈: "var(--series-1)", 스레드: "var(--series-2)" };

function isoWeekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // 0=Mon
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function sum(arr, fn) {
  return arr.reduce((acc, x) => acc + fn(x), 0);
}

function groupSum(arr, keyFn, valFn = (x) => x.count) {
  const map = new Map();
  arr.forEach((x) => {
    const k = keyFn(x);
    map.set(k, (map.get(k) || 0) + valFn(x));
  });
  return map;
}

async function main() {
  const res = await fetch("data/summary.json");
  dashboardData = await res.json();
  const data = dashboardData;
  console.log(`summary.json generated at ${data.generatedAt}, source rows ${data.sourceRowCount}, used rows ${data.usedRowCount}`);

  const months = [...new Set(data.daily.map((d) => d.date.slice(0, 7)))].sort();
  const monthFromSel = document.getElementById("monthFrom");
  const monthToSel = document.getElementById("monthTo");
  const channelSel = document.getElementById("channelFilter");

  months.forEach((m) => {
    monthFromSel.appendChild(new Option(m, m));
    monthToSel.appendChild(new Option(m, m));
  });
  monthFromSel.value = months[0];
  monthToSel.value = months[months.length - 1];

  ["전체", "위챗", "라인", "미니"].forEach((c) => channelSel.appendChild(new Option(c, c)));

  const influencerCountrySel = document.getElementById("influencerCountry");
  const countryTotals = groupSum(data.influencerFunnel, (r) => r.country);
  const countries = [...countryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  influencerCountrySel.appendChild(new Option("전체", "전체"));
  countries.forEach((c) => influencerCountrySel.appendChild(new Option(c, c)));

  function activateTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === tabId));
  }
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activateTab(btn.dataset.tab);
      history.replaceState(null, "", `#${btn.dataset.tab}`);
    });
  });
  if (location.hash.slice(1)) activateTab(location.hash.slice(1));

  function render() {
    const mFrom = monthFromSel.value;
    const mTo = monthToSel.value;
    const channel = channelSel.value;
    const inRange = (d) => d.date.slice(0, 7) >= mFrom && d.date.slice(0, 7) <= mTo;

    const monthFiltered = data.daily.filter(inRange);
    const filtered = monthFiltered.filter((d) => channel === "전체" || d.channel === channel);

    renderKPIs(monthFiltered, filtered);
    renderTrend(filtered);
    renderChannel(monthFiltered);
    renderVisitType(filtered);
    renderStatus(filtered);
    renderStaffMatrix(data.staffMonthly.filter((r) => r.month >= mFrom && r.month <= mTo));
    renderProcedures(data.procedureMonthly.filter((r) => r.month >= mFrom && r.month <= mTo));
    renderSlots(data.bookingSlots);
    renderInfluencer(influencerCountrySel.value);
    renderContentPerformance();
    renderMegaRoi();
    renderExperience();
    renderViralPosting();
    renderGreaterChina();
  }

  function renderViralPosting() {
    const uploads = data.viralPostingUploads;
    const engagement = data.viralPostingEngagement;

    const xhsEng = engagement.filter((r) => r.platform === "샤오홍슈");
    const threadsEng = engagement.filter((r) => r.platform === "스레드");
    const xhsLikesSum = sum(xhsEng, (r) => r.likesSum);
    const xhsLikesCount = sum(xhsEng, (r) => r.likesCount);
    const xhsCommentsSum = sum(xhsEng, (r) => r.commentsSum);
    const xhsCommentsCount = sum(xhsEng, (r) => r.commentsCount);
    const threadsLikesSum = sum(threadsEng, (r) => r.likesSum);
    const threadsLikesCount = sum(threadsEng, (r) => r.likesCount);
    const threadsCommentsSum = sum(threadsEng, (r) => r.commentsSum);
    const threadsCommentsCount = sum(threadsEng, (r) => r.commentsCount);
    const threadsViewsSum = sum(threadsEng, (r) => r.viewsSum);
    const threadsViewsCount = sum(threadsEng, (r) => r.viewsCount);

    const kpiRow = document.getElementById("viralKpiRow");
    clear(kpiRow);
    const total = sum(uploads, (r) => r.count);
    const deleted = sum(uploads, (r) => r.deletedCount);
    statTile(kpiRow, "총 포스팅 건수", fmtInt(total));
    statTile(kpiRow, "삭제된 게시물 수", fmtInt(deleted));
    statTile(kpiRow, "스레드 평균 좋아요 (참여 기록된 것 중)", threadsLikesCount ? (threadsLikesSum / threadsLikesCount).toFixed(1) : "-");
    statTile(kpiRow, "스레드 평균 조회수 (참여 기록된 것 중)", threadsViewsCount ? fmtInt(Math.round(threadsViewsSum / threadsViewsCount)) : "-");

    const months = [...new Set(uploads.map((r) => r.month))].sort();
    const byMonthPlatform = groupSum(uploads, (r) => `${r.month}|${r.platform}`);
    const series = VIRAL_PLATFORM_ORDER.map((p) => ({
      name: p,
      color: VIRAL_PLATFORM_COLOR[p],
      points: months.map((m) => byMonthPlatform.get(`${m}|${p}`) || 0),
    }));
    lineChart(document.getElementById("viralTrendChart"), { xLabels: months, series, width: 1080, height: 220 });

    const byPlatform = groupSum(uploads, (r) => r.platform);
    const platformItems = VIRAL_PLATFORM_ORDER.filter((p) => byPlatform.has(p)).map((p) => ({
      label: p, value: byPlatform.get(p) || 0, color: VIRAL_PLATFORM_COLOR[p], tooltipLabel: "포스팅 건수",
    }));
    hBarChart(document.getElementById("viralPlatformChart"), { items: platformItems, width: 500 });

    const deletedByPlatform = groupSum(uploads, (r) => r.platform, (r) => r.deletedCount);
    const deletedItems = VIRAL_PLATFORM_ORDER.filter((p) => byPlatform.has(p)).map((p) => ({
      label: p, value: deletedByPlatform.get(p) || 0, color: VIRAL_PLATFORM_COLOR[p], tooltipLabel: "삭제 건수",
    }));
    hBarChart(document.getElementById("viralDeletedChart"), { items: deletedItems, width: 500 });

    // 참고용 부분 표본: 샤오홍슈는 좋아요·댓글 기록 자체가 드묾(전체 대비 소수) — 스레드는 대부분 기록됨
    document.getElementById("viralEngagementSubtitle").textContent =
      `샤오홍슈는 좋아요·댓글 기록이 드뭅니다(표본 ${fmtInt(xhsLikesCount)}/${fmtInt(xhsCommentsCount)}건, 전체 ${fmtInt(byPlatform.get("샤오홍슈") || 0)}건 중) — 참고용 수치입니다. ` +
      `스레드는 좋아요·댓글·조회수 대부분이 기록되어 있습니다(표본 ${fmtInt(threadsLikesCount)}/${fmtInt(threadsCommentsCount)}/${fmtInt(threadsViewsCount)}건, 전체 ${fmtInt(byPlatform.get("스레드") || 0)}건 중).`;

    const engRow = document.getElementById("viralEngagementRow");
    clear(engRow);
    statTile(engRow, `샤오홍슈 평균 좋아요 (표본 ${fmtInt(xhsLikesCount)}건)`, xhsLikesCount ? (xhsLikesSum / xhsLikesCount).toFixed(1) : "-");
    statTile(engRow, `샤오홍슈 평균 댓글 (표본 ${fmtInt(xhsCommentsCount)}건)`, xhsCommentsCount ? (xhsCommentsSum / xhsCommentsCount).toFixed(1) : "-");
    statTile(engRow, `스레드 평균 좋아요 (표본 ${fmtInt(threadsLikesCount)}건)`, threadsLikesCount ? (threadsLikesSum / threadsLikesCount).toFixed(1) : "-");
    statTile(engRow, `스레드 평균 댓글 (표본 ${fmtInt(threadsCommentsCount)}건)`, threadsCommentsCount ? (threadsCommentsSum / threadsCommentsCount).toFixed(1) : "-");
    statTile(engRow, `스레드 평균 조회수 (표본 ${fmtInt(threadsViewsCount)}건)`, threadsViewsCount ? fmtInt(Math.round(threadsViewsSum / threadsViewsCount)) : "-");
  }

  function renderExperience() {
    const bookings = data.experienceBookings;

    const kpiRow = document.getElementById("experienceKpiRow");
    clear(kpiRow);
    const total = sum(bookings, (r) => r.count);
    const countries = new Set(bookings.map((r) => r.country)).size;
    const byStatus = groupSum(bookings, (r) => r.status);
    statTile(kpiRow, "총 예약 건수", fmtInt(total));
    statTile(kpiRow, "국가 수", fmtInt(countries));
    statTile(kpiRow, "방문완료 표시 건수", fmtInt(byStatus.get("방문완료") || 0));
    statTile(kpiRow, "취소 표시 건수", fmtInt(byStatus.get("취소") || 0));

    const months = [...new Set(bookings.map((r) => r.month))].sort();
    const byMonth = groupSum(bookings, (r) => r.month);
    lineChart(document.getElementById("experienceTrendChart"), {
      xLabels: months,
      series: [{ name: "예약 건수", color: "var(--series-1)", points: months.map((m) => byMonth.get(m) || 0) }],
      width: 1080,
      height: 200,
    });

    const byCountry = groupSum(bookings, (r) => r.country);
    const sortedCountries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]);
    const top = sortedCountries.slice(0, 8);
    const otherTotal = sortedCountries.slice(8).reduce((s, [, v]) => s + v, 0);
    const countryItems = top.map(([label, value]) => ({ label, value, color: "var(--series-1)" }));
    if (otherTotal > 0) countryItems.push({ label: "그 외", value: otherTotal, color: "var(--series-muted)" });
    hBarChart(document.getElementById("experienceCountryChart"), { items: countryItems, width: 500 });

    const statusItems = EXPERIENCE_STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => ({
      label: s, value: byStatus.get(s) || 0, color: EXPERIENCE_STATUS_COLOR[s],
    }));
    hBarChart(document.getElementById("experienceStatusChart"), { items: statusItems, width: 500 });

    const hours = [...new Set(data.experienceSlots.map((r) => r.hour))].sort((a, b) => a - b);
    const valueAt = (weekday, hour) => {
      const row = data.experienceSlots.find((r) => r.weekday === weekday && r.hour === hour);
      return row ? row.count : 0;
    };
    heatmapGrid(document.getElementById("experienceSlotHeatmap"), { rows: WEEKDAYS, cols: hours, valueAt, width: 1080 });
  }

  const CONTENT_COMPLETED_STATUSES = new Set(["완료", "업로드 완료"]);

  function renderContentPerformance() {
    const uploads = data.contentUploads;
    const engagement = data.contentEngagement;

    const kpiRow = document.getElementById("contentKpiRow");
    clear(kpiRow);
    const total = sum(uploads, (r) => r.count);
    const countries = new Set(uploads.map((r) => r.country));
    const platforms = new Set(uploads.map((r) => r.platform));
    const completedCount = sum(uploads.filter((r) => CONTENT_COMPLETED_STATUSES.has(r.status)), (r) => r.count);
    statTile(kpiRow, "총 업로드 건수", fmtInt(total));
    statTile(kpiRow, "국가 수", fmtInt(countries.size));
    statTile(kpiRow, "플랫폼 수", fmtInt(platforms.size));
    statTile(kpiRow, "완료율", fmtPct(total ? completedCount / total : 0));

    const months = [...new Set(uploads.map((r) => r.month))].sort();
    const totalByMonth = groupSum(uploads, (r) => r.month);
    const completedByMonth = groupSum(uploads.filter((r) => CONTENT_COMPLETED_STATUSES.has(r.status)), (r) => r.month);
    lineChart(document.getElementById("contentTrendChart"), {
      xLabels: months,
      series: [
        { name: "총 업로드", color: "var(--series-1)", points: months.map((m) => totalByMonth.get(m) || 0) },
        { name: "완료", color: "var(--series-2)", points: months.map((m) => completedByMonth.get(m) || 0) },
      ],
      width: 1080,
      height: 220,
    });

    const byCountry = groupSum(uploads, (r) => r.country);
    const countryItems = [...byCountry.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: "var(--series-1)", tooltipLabel: "업로드 건수" }));
    hBarChart(document.getElementById("contentCountryChart"), { items: countryItems, width: 500 });

    const byPlatform = groupSum(uploads, (r) => r.platform);
    const platformItems = [...byPlatform.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: "var(--series-1)", tooltipLabel: "업로드 건수" }));
    hBarChart(document.getElementById("contentPlatformChart"), { items: platformItems, width: 500 });

    const byStaff = groupSum(data.contentStaff, (r) => r.staff);
    const staffItems = [...byStaff.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: "var(--series-1)", tooltipLabel: "업로드 건수" }));
    hBarChart(document.getElementById("contentStaffChart"), { items: staffItems, width: 500 });

    const byTarget = groupSum(data.contentTargets, (r) => r.target);
    const targetItems = [...byTarget.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: "var(--series-1)", tooltipLabel: "업로드 건수" }));
    hBarChart(document.getElementById("contentTargetChart"), { items: targetItems, width: 500 });

    // 참고용 부분 표본: 좋아요·조회수가 둘 다 기록된 게시물만 대상으로 비율 산출
    const pairedLikes = groupSum(engagement, (r) => r.platform, (r) => r.pairedLikesSum);
    const pairedViews = groupSum(engagement, (r) => r.platform, (r) => r.pairedViewsSum);
    const pairedCount = groupSum(engagement, (r) => r.platform, (r) => r.pairedCount);
    const engItems = [...pairedCount.entries()]
      .filter(([, c]) => c >= 3)
      .map(([p, c]) => ({
        label: p,
        value: pairedViews.get(p) ? pairedLikes.get(p) / pairedViews.get(p) : 0,
        color: "var(--series-1)",
        tooltipLabel: `좋아요/조회수 (표본 ${c}건)`,
      }))
      .sort((a, b) => b.value - a.value);
    const totalPaired = sum([...pairedCount.values()], (v) => v);
    document.getElementById("contentEngagementSubtitle").textContent =
      `좋아요·조회수가 모두 기록된 게시물만 대상 (전체 ${fmtInt(total)}건 중 ${fmtInt(totalPaired)}건 표본) — 전수 조사가 아닌 참고용 수치입니다.`;
    hBarChart(document.getElementById("contentEngagementChart"), { items: engItems, valueFormat: fmtPct, width: 700 });
  }

  function renderMegaRoi() {
    const rows = data.megaRoi;
    const cpvFmt = (v) => v.toFixed(3);

    const kpiRow = document.getElementById("megaRoiKpiRow");
    clear(kpiRow);
    const totalCount = sum(rows, (r) => r.count);
    const roiSum = sum(rows, (r) => r.roiSum);
    const roiCount = sum(rows, (r) => r.roiCount);
    const cpvSum = sum(rows, (r) => r.cpvSum);
    const cpvCount = sum(rows, (r) => r.cpvCount);
    const estSum = sum(rows, (r) => r.estimateSum);
    const estCount = sum(rows, (r) => r.estimateCount);
    statTile(kpiRow, "총 진행 건수", fmtInt(totalCount));
    statTile(kpiRow, "평균 ROI달성률", fmtPct(roiCount ? roiSum / roiCount : 0));
    statTile(kpiRow, "평균 CPV(예측)", cpvCount ? cpvFmt(cpvSum / cpvCount) : "-");
    statTile(kpiRow, "평균 견적 (만원)", fmtInt(Math.round(estCount ? estSum / estCount : 0)));

    const staffRoiSum = groupSum(rows, (r) => r.staff, (r) => r.roiSum);
    const staffRoiCount = groupSum(rows, (r) => r.staff, (r) => r.roiCount);
    const staffTotalCount = groupSum(rows, (r) => r.staff, (r) => r.count);
    const staffItems = [...staffTotalCount.entries()]
      .filter(([s, c]) => c >= 3 && staffRoiCount.get(s))
      .map(([s]) => ({
        label: s, value: staffRoiSum.get(s) / staffRoiCount.get(s), color: "var(--series-1)", tooltipLabel: "평균 ROI달성률",
      }))
      .sort((a, b) => b.value - a.value);
    hBarChart(document.getElementById("megaRoiStaffChart"), { items: staffItems, valueFormat: fmtPct, width: 500 });

    const platformRoiSum = groupSum(rows, (r) => r.platform, (r) => r.roiSum);
    const platformRoiCount = groupSum(rows, (r) => r.platform, (r) => r.roiCount);
    const platformItems = [...platformRoiCount.entries()]
      .filter(([, c]) => c > 0)
      .map(([p, c]) => ({ label: p, value: platformRoiSum.get(p) / c, color: "var(--series-1)", tooltipLabel: "평균 ROI달성률" }))
      .sort((a, b) => b.value - a.value);
    hBarChart(document.getElementById("megaRoiPlatformChart"), { items: platformItems, valueFormat: fmtPct, width: 500 });

    const tierCpvSum = groupSum(rows, (r) => r.followerTier, (r) => r.cpvSum);
    const tierCpvCount = groupSum(rows, (r) => r.followerTier, (r) => r.cpvCount);
    const tierItems = FOLLOWER_TIER_ORDER.filter((t) => tierCpvCount.get(t)).map((t) => ({
      label: t, value: tierCpvSum.get(t) / tierCpvCount.get(t), color: "var(--series-1)", tooltipLabel: "평균 CPV(예측)",
    }));
    hBarChart(document.getElementById("megaRoiTierChart"), { items: tierItems, valueFormat: cpvFmt, width: 1080 });
  }

  function renderInfluencer(country) {
    const filtered = data.influencerFunnel.filter((r) => country === "전체" || r.country === country);

    const kpiRow = document.getElementById("influencerKpiRow");
    clear(kpiRow);
    const total = sum(filtered, (r) => r.count);
    const uploaded = sum(filtered.filter((r) => r.stage === UPLOADED_STAGE), (r) => r.count);
    const dead = sum(filtered.filter((r) => DEAD_STAGES.has(r.stage)), (r) => r.count);
    const inTalks = sum(filtered.filter((r) => r.stage === "협의중"), (r) => r.count);
    statTile(kpiRow, "총 컨택 건수", fmtInt(total));
    statTile(kpiRow, "업로드 전환율", fmtPct(total ? uploaded / total : 0));
    statTile(kpiRow, "응답률 (무응답·거절 제외)", fmtPct(total ? 1 - dead / total : 0));
    statTile(kpiRow, "협의중 비율", fmtPct(total ? inTalks / total : 0));

    const byStage = groupSum(filtered, (r) => r.stage);
    hBarChart(document.getElementById("influencerFunnelChart"), {
      items: STAGE_ORDER.filter((s) => byStage.has(s)).map((s) => ({
        label: s, value: byStage.get(s) || 0, color: STAGE_COLOR[s], tooltipLabel: "건수",
      })),
      width: 1080,
    });

    const staffTotal = groupSum(filtered, (r) => r.staff);
    const staffUploaded = groupSum(filtered.filter((r) => r.stage === UPLOADED_STAGE), (r) => r.staff);
    const staffItems = [...staffTotal.entries()]
      .filter(([, v]) => v >= 3)
      .map(([s, v]) => ({ label: s, value: (staffUploaded.get(s) || 0) / v, color: "var(--series-1)", tooltipLabel: "전환율" }))
      .sort((a, b) => b.value - a.value);
    hBarChart(document.getElementById("influencerStaffChart"), { items: staffItems, valueFormat: fmtPct, width: 500 });

    const tierTotal = groupSum(filtered, (r) => r.followerTier);
    const tierUploaded = groupSum(filtered.filter((r) => r.stage === UPLOADED_STAGE), (r) => r.followerTier);
    const tierItems = FOLLOWER_TIER_ORDER.filter((t) => tierTotal.has(t)).map((t) => ({
      label: t, value: (tierUploaded.get(t) || 0) / tierTotal.get(t), color: "var(--series-1)", tooltipLabel: "전환율",
    }));
    hBarChart(document.getElementById("influencerTierChart"), { items: tierItems, valueFormat: fmtPct, width: 500 });
  }

  function renderKPIs(monthFiltered, filtered) {
    const kpiRow = document.getElementById("kpiRow");
    clear(kpiRow);
    const total = sum(filtered, (d) => d.count);
    const booked = sum(filtered.filter((d) => d.status === "예약완료"), (d) => d.count);
    const firstVisit = sum(filtered.filter((d) => d.visitType === "초진"), (d) => d.count);
    const returnVisit = sum(filtered.filter((d) => d.visitType === "재진"), (d) => d.count);
    const visitTotal = firstVisit + returnVisit || 1;
    const activeChannels = new Set(monthFiltered.filter((d) => d.channel !== "미상").map((d) => d.channel)).size;

    statTile(kpiRow, "총 문의 건수", fmtInt(total));
    statTile(kpiRow, "예약 전환율", fmtPct(total ? booked / total : 0));
    statTile(kpiRow, "초진 비율", fmtPct(firstVisit / visitTotal));
    statTile(kpiRow, "활성 채널 수", fmtInt(activeChannels));
  }

  function renderTrend(filtered) {
    const byWeek = new Map();
    filtered.forEach((d) => {
      const wk = isoWeekStart(d.date);
      if (!byWeek.has(wk)) byWeek.set(wk, { total: 0, booked: 0 });
      const bucket = byWeek.get(wk);
      bucket.total += d.count;
      if (d.status === "예약완료") bucket.booked += d.count;
    });
    const weeks = [...byWeek.keys()].sort();
    lineChart(document.getElementById("trendChart"), {
      xLabels: weeks.map((w) => w.slice(5)),
      series: [
        { name: "문의량", color: "var(--series-1)", points: weeks.map((w) => byWeek.get(w).total) },
        { name: "예약완료", color: "var(--series-2)", points: weeks.map((w) => byWeek.get(w).booked) },
      ],
      width: 1100,
      height: 240,
    });
  }

  function renderChannel(monthFiltered) {
    const channels = ["위챗", "라인", "미니"];
    const byChannel = groupSum(monthFiltered, (d) => d.channel);
    const bookedByChannel = groupSum(monthFiltered.filter((d) => d.status === "예약완료"), (d) => d.channel);

    hBarChart(document.getElementById("channelVolumeChart"), {
      items: channels.map((c) => ({ label: c, value: byChannel.get(c) || 0, color: CHANNEL_COLOR[c], tooltipLabel: "문의 건수" })),
      width: 500,
    });
    hBarChart(document.getElementById("channelRateChart"), {
      items: channels.map((c) => {
        const total = byChannel.get(c) || 0;
        const booked = bookedByChannel.get(c) || 0;
        return { label: c, value: total ? booked / total : 0, color: CHANNEL_COLOR[c], tooltipLabel: "전환율" };
      }),
      valueFormat: fmtPct,
      width: 500,
    });
  }

  function renderVisitType(filtered) {
    const months = [...new Set(filtered.map((d) => d.date.slice(0, 7)))].sort();
    const byMonthType = groupSum(filtered.filter((d) => d.visitType === "초진" || d.visitType === "재진"), (d) => `${d.date.slice(0, 7)}|${d.visitType}`);
    const series = ["초진", "재진"].map((vt, i) => ({
      name: vt,
      color: i === 0 ? "var(--series-1)" : "var(--series-2)",
      valuesByCategory: Object.fromEntries(months.map((m) => [m, byMonthType.get(`${m}|${vt}`) || 0])),
    }));
    stackedPercentBar(document.getElementById("visitTypeChart"), { categories: months, series, width: 500 });
  }

  function renderStatus(filtered) {
    const byStatus = groupSum(filtered, (d) => d.status);
    const known = STATUS_ORDER.slice(0, 6);
    let otherTotal = 0;
    byStatus.forEach((v, k) => {
      if (!known.includes(k)) otherTotal += v;
    });
    const items = known
      .map((k) => ({ label: k, value: byStatus.get(k) || 0, color: STATUS_COLOR[k] }))
      .concat([{ label: "그 외", value: otherTotal, color: STATUS_COLOR["그 외"] }])
      .sort((a, b) => b.value - a.value);
    hBarChart(document.getElementById("statusChart"), { items, width: 500 });
  }

  function renderStaffMatrix(rows) {
    const staff = [...new Set(rows.map((r) => r.staff))].sort();
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const totalByKey = groupSum(rows, (r) => `${r.staff}|${r.month}`);
    const bookedByKey = groupSum(rows.filter((r) => r.booked), (r) => `${r.staff}|${r.month}`);
    const maxVal = Math.max(1, ...staff.flatMap((s) => months.map((m) => totalByKey.get(`${s}|${m}`) || 0)));

    const container = document.getElementById("staffMatrix");
    clear(container);
    const table = document.createElement("table");
    table.className = "matrix";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.appendChild(document.createElement("th"));
    months.forEach((m) => {
      const th = document.createElement("th");
      th.textContent = m;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    staff.forEach((s) => {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      nameTd.textContent = s;
      tr.appendChild(nameTd);
      months.forEach((m) => {
        const total = totalByKey.get(`${s}|${m}`) || 0;
        const booked = bookedByKey.get(`${s}|${m}`) || 0;
        const td = document.createElement("td");
        td.className = "cell";
        const alpha = total === 0 ? 0 : 0.1 + 0.8 * (total / maxVal);
        td.style.background = `rgba(var(--series-1-rgb),${alpha.toFixed(3)})`;
        const countSpan = document.createElement("span");
        countSpan.textContent = total ? fmtInt(total) : "-";
        td.appendChild(countSpan);
        if (total) {
          const rateSpan = document.createElement("span");
          rateSpan.className = "rate";
          rateSpan.textContent = fmtPct(booked / total);
          td.appendChild(rateSpan);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function renderProcedures(rows) {
    const byProc = groupSum(rows, (r) => r.procedure);
    const items = [...byProc.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value, color: "var(--series-1)" }));
    hBarChart(document.getElementById("procedureChart"), { items, width: 500 });
  }

  function renderSlots(rows) {
    const hours = [...new Set(rows.map((r) => r.hour))].sort((a, b) => a - b);
    const valueAt = (weekday, hour) => {
      const row = rows.find((r) => r.weekday === weekday && r.hour === hour);
      return row ? row.count : 0;
    };
    heatmapGrid(document.getElementById("slotHeatmap"), { rows: WEEKDAYS, cols: hours, valueAt, width: 500 });
  }

  monthFromSel.addEventListener("change", render);
  monthToSel.addEventListener("change", render);
  channelSel.addEventListener("change", render);
  influencerCountrySel.addEventListener("change", render);
  window.addEventListener("resize", render);

  render();
}

main().catch((err) => {
  console.error(err);
  document.querySelector(".app").insertAdjacentHTML(
    "beforeend",
    `<p style="color:var(--series-8)">데이터 로드 실패: ${err.message}</p>`
  );
});

  // ---- Greater China Revenue Attribution ----
  function renderGreaterChina() {
    if (!dashboardData || !dashboardData.greaterChinaRevenue) {
      clear(document.getElementById("greaterChinaKpiRow"));
      document.getElementById("greaterChinaFunnelChart").innerHTML = "<p>데이터 없음</p>";
      return;
    }

    const gc = dashboardData.greaterChinaRevenue;
    const formatKRW = (val) => {
      if (val >= 1e9) return "₩" + (val / 1e9).toFixed(2) + "B";
      if (val >= 1e6) return "₩" + (val / 1e6).toFixed(2) + "M";
      return "₩" + val.toLocaleString();
    };

    // KPI Cards
    const kpiData = [
      { label: "성숙 방문 고객수", value: gc.matureVisitCustomers, format: (v) => v.toLocaleString() },
      { label: "결제 고객", value: gc.paidCustomers, format: (v) => v.toLocaleString() },
      { label: "내원 → 결제", value: gc.visitToPaidConversion, format: (v) => (v * 100).toFixed(1) + "%" },
      { label: "귀인 수익", value: gc.attributedRevenue, format: formatKRW },
      { label: "고객당 수익", value: gc.revenuePerPaidCustomer, format: formatKRW },
      { label: "결제 귀인 성공률", value: gc.attributionCoverage, format: (v) => (v * 100).toFixed(1) + "%" },
    ];

    const kpiRow = document.getElementById("greaterChinaKpiRow");
    clear(kpiRow);
    kpiData.forEach((kpi) => {
      const card = document.createElement("div");
      card.className = "kpi-card";
      card.innerHTML = `<div class="kpi-label">${kpi.label}</div><div class="kpi-value">${kpi.format(kpi.value)}</div>`;
      kpiRow.appendChild(card);
    });

    // Funnel chart
    renderGreaterChinaFunnel();

    // Revenue Reconciliation
    renderGreaterChinaReconciliation();

    // Nationality table
    renderGreaterChinaNationality();

    // Channel revenue
    renderGreaterChinaChannel();

    // Open cohort info
    renderGreaterChinaOpenCohort();

    // Methodology
    renderGreaterChinaMethodology();
  }

  function renderGreaterChinaFunnel() {
    if (!dashboardData || !dashboardData.greaterChinaRevenue) return;
    const gc = dashboardData.greaterChinaRevenue;
    const container = document.getElementById("greaterChinaFunnelChart");
    clear(container);

    const formatKRW = (val) => {
      if (val >= 1e9) return (val / 1e9).toFixed(2) + "B";
      if (val >= 1e6) return (val / 1e6).toFixed(2) + "M";
      return val.toLocaleString();
    };

    const width = 600;
    const svg = svgEl("svg", { viewBox: `0 0 ${width} 180`, width: "100%", height: "180px" });

    const steps = [
      { label: "성숙 방문 고객", value: gc.matureVisitCustomers, x: 50 },
      { label: "결제 고객", value: gc.paidCustomers, x: 300 },
      { label: "귀인 수익", value: `₩${formatKRW(gc.attributedRevenue)}`, x: 550 },
    ];

    steps.forEach((step, i) => {
      // Box
      const boxW = 80, boxH = 60;
      const rect = svgEl("rect", {
        x: step.x - boxW / 2,
        y: 20,
        width: boxW,
        height: boxH,
        fill: "var(--series-" + ((i % 7) + 1) + ")",
        rx: "4",
        opacity: "0.2",
        stroke: "var(--series-" + ((i % 7) + 1) + ")",
        "stroke-width": "2",
      });
      svg.appendChild(rect);

      // Label
      const label = svgEl("text", {
        x: step.x,
        y: 25,
        "text-anchor": "middle",
        "font-size": "12",
        fill: "var(--text-muted)",
      });
      label.textContent = step.label;
      svg.appendChild(label);

      // Value
      const value = svgEl("text", {
        x: step.x,
        y: 65,
        "text-anchor": "middle",
        "font-size": "18",
        fill: "var(--text)",
        "font-weight": "600",
      });
      value.textContent = typeof step.value === "number" ? step.value.toLocaleString() : step.value;
      svg.appendChild(value);

      // Arrow
      if (i < steps.length - 1) {
        const nextX = steps[i + 1].x;
        const line = svgEl("line", {
          x1: step.x + 50,
          y1: 50,
          x2: nextX - 50,
          y2: 50,
          stroke: "var(--text-muted)",
          "stroke-width": "2",
          "marker-end": "url(#arrowhead)",
        });
        svg.appendChild(line);
      }
    });

    // Arrow marker
    const defs = svgEl("defs", {});
    const marker = svgEl("marker", {
      id: "arrowhead",
      markerWidth: "10",
      markerHeight: "10",
      refX: "9",
      refY: "3",
      orient: "auto",
    });
    const polygon = svgEl("polygon", { points: "0 0, 10 3, 0 6", fill: "var(--text-muted)" });
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Conversion rate annotation
    const conv = svgEl("text", {
      x: 175,
      y: 120,
      "text-anchor": "middle",
      "font-size": "14",
      fill: "var(--series-3)",
      "font-weight": "600",
    });
    conv.textContent = (gc.visitToPaidConversion * 100).toFixed(1) + "%";
    svg.appendChild(conv);

    container.appendChild(svg);
  }

  function renderGreaterChinaReconciliation() {
    if (!dashboardData || !dashboardData.greaterChinaRevenue) return;
    const gc = dashboardData.greaterChinaRevenue;
    const recon = gc._reconciliation || {};
    const container = document.getElementById("greaterChinaRevenueReconciliationChart");
    clear(container);

    const total = recon.totalApprovedRevenue || 0;
    const mature = recon.matureAttributedRevenue || 0;
    const open = recon.openAttributedRevenue || 0;
    const unattr = recon.unattributedRevenue || 0;

    const formatKRW = (val) => {
      if (val >= 1e9) return (val / 1e9).toFixed(1) + "B";
      if (val >= 1e6) return (val / 1e6).toFixed(1) + "M";
      return val.toLocaleString();
    };

    const width = 600, height = 100;
    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height: height + "px" });

    // Stacked bar
    const barY = 30, barH = 40;
    const matureW = (mature / total) * 400;
    const openW = (open / total) * 400;
    const unattW = (unattr / total) * 400;

    // Mature
    const mBar = svgEl("rect", {
      x: 80,
      y: barY,
      width: matureW,
      height: barH,
      fill: "var(--series-1)",
    });
    svg.appendChild(mBar);

    // Open
    const oBar = svgEl("rect", {
      x: 80 + matureW,
      y: barY,
      width: openW,
      height: barH,
      fill: "var(--series-2)",
    });
    svg.appendChild(oBar);

    // Unattributed
    const uBar = svgEl("rect", {
      x: 80 + matureW + openW,
      y: barY,
      width: unattW,
      height: barH,
      fill: "var(--series-8)",
    });
    svg.appendChild(uBar);

    // Labels
    const labelY = barY + barH + 20;
    [
      { label: `성숙\n${formatKRW(mature)}\n(${(mature / total * 100).toFixed(1)}%)`, x: 80 + matureW / 2 },
      { label: `진행 중\n${formatKRW(open)}\n(${(open / total * 100).toFixed(1)}%)`, x: 80 + matureW + openW / 2 },
      { label: `귀인 불가\n${formatKRW(unattr)}\n(${(unattr / total * 100).toFixed(1)}%)`, x: 80 + matureW + openW + unattW / 2 },
    ].forEach((item) => {
      const text = svgEl("text", {
        x: item.x,
        y: labelY,
        "text-anchor": "middle",
        "font-size": "11",
        fill: "var(--text-muted)",
      });
      text.textContent = item.label;
      svg.appendChild(text);
    });

    container.appendChild(svg);
  }

  function renderGreaterChinaNationality() {
    if (!dashboardData || !dashboardData.greaterChinaRevenue) return;
    const natData = dashboardData.greaterChinaRevenue.nationalityRevenue || [];
    const container = document.getElementById("greaterChinaNationalityTable");
    clear(container);

    const formatKRW = (val) => {
      if (val >= 1e9) return "₩" + (val / 1e9).toFixed(2) + "B";
      if (val >= 1e6) return "₩" + (val / 1e6).toFixed(2) + "M";
      return "₩" + val.toLocaleString();
    };

    const table = document.createElement("table");
    table.className = "data-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>국가/지역</th>
          <th>방문 이벤트</th>
          <th>결제</th>
          <th>전환율</th>
          <th>수익</th>
          <th>고객당</th>
        </tr>
      </thead>
      <tbody>
        ${natData.map((n) => `
          <tr>
            <td>${n.country}</td>
            <td>${n.visits.toLocaleString()}</td>
            <td>${n.paidCustomers.toLocaleString()}</td>
            <td>${(n.visitToPaidConversion * 100).toFixed(1)}%</td>
            <td>${formatKRW(n.revenue)}</td>
            <td>${formatKRW(n.revenuePerPaidCustomer)}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
    container.appendChild(table);

    const note = document.createElement("p");
    note.style.fontSize = "0.85em";
    note.style.color = "var(--text-muted)";
    note.style.marginTop = "12px";
    note.textContent = "동일 고객의 복수 방문은 각각의 방문 이벤트로 집계됩니다.";
    container.appendChild(note);
  }

  function renderGreaterChinaChannel() {
    if (!dashboardData || !dashboardData.greaterChinaRevenue) return;
    const chData = (dashboardData.greaterChinaRevenue.channelRevenue || []).slice(0, 8);
    const container = document.getElementById("greaterChinaChannelTable");
    clear(container);

    const formatKRW = (val) => {
      if (val >= 1e9) return "₩" + (val / 1e9).toFixed(2) + "B";
      if (val >= 1e6) return "₩" + (val / 1e6).toFixed(2) + "M";
      return "₩" + val.toLocaleString();
    };

    const table = document.createElement("table");
    table.className = "data-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>채널</th>
          <th>방문 이벤트</th>
          <th>결제</th>
          <th>전환율</th>
          <th>수익</th>
          <th>고객당</th>
        </tr>
      </thead>
      <tbody>
        ${chData.map((c) => `
          <tr>
            <td>${c.channel}</td>
            <td>${c.visits.toLocaleString()}</td>
            <td>${c.paidCustomers.toLocaleString()}</td>
            <td>${c.visits ? ((c.paidCustomers / c.visits) * 100).toFixed(1) : "0"}%</td>
            <td>${formatKRW(c.revenue)}</td>
            <td>${c.paidCustomers ? formatKRW(c.revenue / c.paidCustomers) : "₩0"}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
    container.appendChild(table);

    const note = document.createElement("p");
    note.style.fontSize = "0.85em";
    note.style.color = "var(--text-muted)";
    note.style.marginTop = "12px";
    note.textContent = "동일 고객의 복수 방문은 각각의 방문 이벤트로 집계됩니다.";
    container.appendChild(note);
  }

  function renderGreaterChinaOpenCohort() {
    if (!dashboardData || !dashboardData.greaterChinaRevenue) return;
    const gc = dashboardData.greaterChinaRevenue;
    const container = document.getElementById("greaterChinaOpenCohortInfo");
    clear(container);

    const div = document.createElement("div");
    div.innerHTML = `
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div>
          <div style="font-size:12px;color:var(--text-muted)">진행 중인 고객수</div>
          <div style="font-size:24px;font-weight:600;color:var(--series-2)">${gc.openVisitCustomers.toLocaleString()}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-muted)">현재까지 결제 고객</div>
          <div style="font-size:24px;font-weight:600;color:var(--series-3)">${gc.openPaidCustomers.toLocaleString()}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">잠정치 · 30일 관찰 진행 중</div>
        </div>
      </div>
      <p style="font-size:0.85em;color:var(--text-muted);margin-top:12px">
        2026-08-16 이후 방문 고객으로, 30일 관찰 기간이 아직 진행 중입니다.
        이 고객들의 최종 전환율은 향후 데이터 업데이트 시 확정됩니다.
      </p>
    `;
    container.appendChild(div);
  }

  function renderGreaterChinaMethodology() {
    const container = document.getElementById("greaterChinaMethodology");
    clear(container);

    const div = document.createElement("div");
    div.innerHTML = `
      <strong>범위:</strong> 중국, 대만, 홍콩, 마카오<br/>
      <strong>방문:</strong> 예약상태 = "귀가" 또는 "내원"인 고객<br/>
      <strong>결제:</strong> 결제상태 = "승인"인 기록만 포함<br/>
      <strong>귀인 윈도우:</strong> 방문일로부터 이후 0~30일 내 발생한 결제<br/>
      <strong>다중 방문:</strong> 결제는 결제일 이전 가장 가까운 qualifying 방문에 귀인<br/>
      <strong>성숙 코호트:</strong> 방문일 ≤ 2026-08-15 (30일 관찰 기간 완료)<br/>
      <strong>PII:</strong> 개인정보 미포함 (집계 지표만 표시)<br/>
    `;
    container.appendChild(div);
  }
