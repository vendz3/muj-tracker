// Pure data shaping for dashboard charts (no React), so it can be checked with plain node.
import { GOALS, goalStatus } from "./goals.js";
export const DAYS = 30; // charts show the last 30 calendar days
export const WEEK = 7; // card summaries: last 7 days vs the 7 before

// Series colors are roles in order of use within one chart: a1 accent, a2 accent2, a3/a4 their 40% tints
// (Charts.jsx maps them to the theme's CSS variables). Fixed per metric, so hiding one never repaints the others.
const A1 = "a1", A2 = "a2", A3 = "a3", A4 = "a4";
const OTHER_GRAY = "gray"; // "Ostatní" is context, not an identity: neutral gray
const SPORT_COLORS = [A1, A2, A3];

// scale "score" = 1–5 rating (line), "value" = absolute amount (bar). The two never share an axis:
// a template with both gets two stacked charts instead of a dual-axis chart.
const score = (key, label, color, get = (d) => d[key]) => ({ key, label, color, scale: "score", get });
const value = (key, label, unit, color, get = (d) => d[key]) => ({ key, label, unit, color, scale: "value", get });

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export const METRICS = {
  sleep: [score("sleep_quality", "Kvalita", A1), value("sleep_hours", "Spánek", "h", A2)],
  sport: [], // drawn by sportSeries(): stacked minutes or activities per sport
  // better: which end of the 1–5 scale is the good one (shown as "méně = lépe" where it isn't the usual high).
  food: [
    { ...score("quality", "Kvalita", A1), better: "high" },
    { ...score("alcohol", "Alkohol", A2), better: "low" },
    { ...score("caffeine", "Kofein", A3), better: "low" },
    { ...score("sugar", "Cukr", A4), better: "low" },
    value("calories", "Příjem", "kcal", A1),
  ],
  water: [value("liters", "Vypito", "l", A1)],
  steps: [value("steps", "Kroky", "kroků", A1)],
  fasting: [value("hours", "Půst", "h", A1)],
  screen_time: [value("minutes", "Čas u obrazovky", "min", A1)],
  // shortcut: pages aren't charted (another unit on the same axis); they show in Záznamy. Chart them if asked.
  reading: [value("minutes", "Čtení", "min", A1)],
  meditation: [value("minutes", "Meditace", "min", A1)],
  stress: [{ ...score("stress", "Stres", A2), better: "low" }],
};

// Czech plural for counted activities: 1 aktivita, 2–4 aktivity, 0 / 5+ aktivit.
export const activities = (n) => (n === 1 ? "aktivita" : n >= 2 && n <= 4 ? "aktivity" : "aktivit");

// Card headline: first metric of the type that has data. [row key, "avg" | "sum", unit (text or n => text)]
const SUMMARY = {
  sleep: [["sleep_quality", "avg", ""], ["sleep_hours", "avg", "h"]],
  sport: [["_minutes", "sum", "min"], ["_count", "sum", activities]], // _minutes only exists in minutes mode
  food: [["calories", "avg", "kcal"], ["quality", "avg", ""]],
  water: [["liters", "avg", "l"]],
  steps: [["steps", "avg", "kroků"]],
  fasting: [["hours", "avg", "h"]],
  screen_time: [["minutes", "avg", "min"]],
  // Daily goals (goals.js) compare per day, so the headline is the daily average too.
  reading: [["minutes", "avg", "min"]],
  meditation: [["minutes", "avg", "min"]],
  stress: [["stress", "avg", ""]],
};

// Every calendar day from the first record in the window to today, so a missing day is a gap, not a jump.
export function lastDays(records, today = new Date()) {
  const start = new Date(today);
  start.setDate(start.getDate() - (DAYS - 1));
  const iso = (d) => d.toLocaleDateString("sv-SE"); // YYYY-MM-DD local
  const byDate = Object.fromEntries(records.map((r) => [r.date, r]));
  const first = records.map((r) => r.date).filter((d) => d >= iso(start)).sort()[0];
  if (!first) return [];
  const days = [];
  for (const d = new Date(`${first}T00:00`); iso(d) <= iso(today); d.setDate(d.getDate() + 1)) days.push({ date: iso(d), record: byDate[iso(d)] ?? null });
  return days;
}

// Average or total of `key` over the last WEEK rows, and the change vs the WEEK before.
// Nulls (unfilled days) are skipped; no data -> null; delta needs a full previous week.
export function weekSummary(rows, key, mode = "avg") {
  const agg = (part) => {
    const xs = part.map((r) => r[key]).filter((v) => v != null);
    return xs.length ? (mode === "sum" ? sum(xs) : sum(xs) / xs.length) : null;
  };
  const value = agg(rows.slice(-WEEK));
  if (value == null) return null;
  const prev = rows.length >= 2 * WEEK ? agg(rows.slice(-2 * WEEK, -WEEK)) : null;
  return { value, delta: prev == null ? null : value - prev };
}

// Sport -> one stacked series per sport. Minutes when duration is tracked (and recorded), otherwise the
// number of activities, so an untimed activity is never invisible. Sports keep the order from settings
// (stable colors); past 3 series the rest, and the wizard's "ostatní", fold into gray "Ostatní".
function sportSeries(t, data) {
  const entries = data.flatMap((d) => d?.sports ?? []);
  if (!entries.length) return null;
  const mode = t.config_json?.duration && entries.some((s) => s.minutes != null) ? "minutes" : "count";
  const amount = (s) => (mode === "minutes" ? (s.minutes ?? 0) : 1);
  const totals = {}; // every sport in the data gets a series slot, timed or not, so each entry maps somewhere
  for (const s of entries) totals[s.name] = (totals[s.name] ?? 0) + amount(s);
  const order = t.config_json?.sports ?? [];
  const rank = (n) => (order.includes(n) ? order.indexOf(n) : order.length + 1e6 - totals[n]);
  const named = Object.keys(totals).filter((n) => n !== "ostatní").sort((a, b) => rank(a) - rank(b));
  const hasRest = "ostatní" in totals || named.length > 3;
  const kept = named.slice(0, hasRest ? 2 : 3);
  const group = (name) => (kept.includes(name) ? `s${kept.indexOf(name)}` : "so");
  const fmt = (key) => (v, row) => {
    const intensity = row[`${key}i`] != null ? `intenzita ${row[`${key}i`]}` : "";
    if (mode === "minutes") return `${v} min` + (intensity && ` · ${intensity}`);
    return v === 1 && intensity ? intensity : `${v}×` + (intensity && ` · ${intensity}`);
  };
  const base = { unit: mode === "minutes" ? "min" : "", scale: "value", stack: true, mode, integer: mode === "count" };
  const series = kept.map((name, i) => ({ ...base, key: `s${i}`, label: name, color: SPORT_COLORS[i] }));
  if (hasRest) series.push({ ...base, key: "so", label: "Ostatní", color: OTHER_GRAY });
  for (const s of series) s.format = fmt(s.key);
  const rows = data.map((d) => {
    const row = Object.fromEntries(series.map((s) => [s.key, d ? 0 : null])); // no result -> gap; "bez sportu" -> 0
    if (!d) return { ...row, _minutes: null };
    const count = {};
    for (const s of d.sports) {
      const k = group(s.name);
      row[k] += amount(s);
      count[k] = (count[k] ?? 0) + 1;
      row[`${k}i`] = count[k] === 1 ? s.intensity : null; // intensity only when one sport sits in the segment
    }
    return { ...row, _minutes: mode === "minutes" ? sum(series.map((s) => row[s.key])) : null };
  });
  return { series, rows };
}

// Emotions: categories without a scale -> presence grid. One row per emotion felt in the window, ordered by
// how often (ties keep settings order); cells: true = felt, false = day filled without it, null = not filled.
export function emotionGrid(days, t) {
  const data = days.map(({ record }) => record?.results.find((r) => r.template_id === t.id)?.result_data_json?.emotions ?? null);
  if (!data.some(Boolean)) return null;
  const order = t.config_json?.emotions ?? [];
  const total = {};
  for (const list of data) for (const e of list ?? []) total[e] = (total[e] ?? 0) + 1;
  const rank = (e) => (order.includes(e) ? order.indexOf(e) : order.length);
  const names = Object.keys(total).sort((a, b) => total[b] - total[a] || rank(a) - rank(b));
  const week = (e) => data.slice(-WEEK).filter((list) => list?.includes(e)).length;
  const rows = names.map((name) => ({ name, total: total[name], week: week(name), cells: data.map((list) => (list ? list.includes(name) : null)) }));
  const top = [...rows].sort((a, b) => b.week - a.week || b.total - a.total)[0];
  return { dates: days.map((d) => d.date), rows, top: top.week ? top.name : null, filledWeek: data.slice(-WEEK).filter(Boolean).length };
}

// Raw API records -> one card per template that has data: { template, groups: [{ scale, series, rows }], summary }.
// A day without the template's result (or without a metric) yields null -> gap in the line.
export function templateCharts(days, templates) {
  const cards = [];
  for (const t of [...templates].sort((a, b) => a.id - b.id)) {
    if (t.type === "emotions") {
      const grid = emotionGrid(days, t);
      if (grid) cards.push({ template: t, emotions: grid, groups: [], weekGoals: [] });
      continue;
    }
    if (!METRICS[t.type]) continue;
    const data = days.map(({ record }) => record?.results.find((r) => r.template_id === t.id)?.result_data_json);
    const sport = t.type === "sport" ? sportSeries(t, data) : null;
    const metrics = sport ? sport.series : METRICS[t.type];
    const rows = days.map(({ date }, i) => ({
      date,
      ...(sport ? sport.rows[i] : Object.fromEntries(metrics.map((m) => [m.key, data[i] ? (m.get(data[i]) ?? null) : null]))),
      // Activities that day (sport entries), for the weekly activity goal; "bez sportu" = 0.
      ...(t.type === "sport" && { _count: data[i] ? (data[i].sports?.length ?? 0) : null }),
    }));
    // Hide a metric with nothing to show (never tracked, or only zeros).
    const series = metrics.filter((m) => rows.some((r) => r[m.key] > 0));
    const groups = ["score", "value"]
      .map((scale) => ({ scale, series: series.filter((m) => m.scale === scale), rows }))
      .filter((g) => g.series.length);
    if (!groups.length) continue;
    // Goals set in settings, keyed by the chart row that holds the metric; skipped if that row has no data.
    // Daily goals go on charts and next to averages; weekly ones become progress meters (weekGoals).
    const goals = {};
    const weekGoals = [];
    for (const meta of GOALS[t.type] ?? []) {
      const goal = t.config_json?.goals?.[meta.key];
      const rowKey = meta.rowKey ?? meta.key;
      if (!goal || !rows.some((r) => r[rowKey] != null)) continue;
      const info = { ...meta, goal, rowKey, status: goalStatus(rows, rowKey, goal, meta.dir, WEEK, meta.period) };
      if (meta.period === "week") weekGoals.push(info);
      else goals[rowKey] = info;
    }
    for (const s of series) s.goalInfo = goals[s.key];
    for (const g of groups) g.goalInfo = g.series.some((s) => s.stack) ? goals._minutes : g.series.length === 1 ? g.series[0].goalInfo : undefined;
    const pick = SUMMARY[t.type].find(([key]) => rows.some((r) => r[key] != null));
    const summary = pick && weekSummary(rows, pick[0], pick[1]);
    cards.push({ template: t, groups, weekGoals, rows, goals: [...Object.values(goals), ...weekGoals], summary: summary && { ...summary, mode: pick[1], unit: pick[2], ...(goals[pick[0]] && { goalInfo: goals[pick[0]] }) } });
  }
  return cards;
}
