// Pure data shaping for dashboard charts (no React), so it can be checked with plain node.
import { GOALS, goalStatus } from "./goals.js";
import { entryOrder } from "./sections.js";
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
// scale "count" = whole number per day where 0 is real data (food 0–5+, 5 = "5 or more"): small bar rows, sum per week.
// scale "treat" = the same counts for alcohol / caffeine / sweets, as their own block ("Pochutiny") under the food.
const count = (key, label, color, better = "low", scale = "count") => ({ key, label, color, unit: "", scale, integer: true, better, format: (v) => (v >= 5 ? "5+" : String(v)), get: (d) => d[key] });
const treat = (key, label, color) => count(key, label, color, "low", "treat");

// scale "clock" = time of day as decimal hours (line, own axis), stored as "HH:MM". wrap: times before noon are
// "after midnight" (bedtime 00:30 -> 24.5), so 23:30 and 00:30 sit next to each other.
export const toClock = (s, wrap = false) => {
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  return h + m / 60 + (wrap && h < 12 ? 24 : 0);
};
export const fmtClock = (v) => {
  const m = Math.round(v * 60) % (24 * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};
const clock = (key, label, color, wrap) => ({ key, label, color, unit: "", scale: "clock", format: fmtClock, get: (d) => toClock(d[key], wrap) });

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export const METRICS = {
  sleep: [score("sleep_quality", "Kvalita", A1), clock("bedtime", "Usnutí", A3, true), clock("waketime", "Vstávání", A4), value("sleep_hours", "Spánek", "h", A2)],
  sport: [], // drawn by sportSeries(): stacked minutes or activities per sport
  // better: which end of the 1–5 scale is the good one (shown as "méně = lépe" where it isn't the usual high).
  food: [
    { ...score("quality", "Kvalita", A1), better: "high" },
    value("calories", "Příjem", "kcal", A1),
    treat("drinks", "Alkohol", A4),
    treat("coffee", "Kofein", A1),
    treat("sweets", "Sladkosti", A3),
    treat("sugary_drinks", "Slazené nápoje", A2),
    treat("fast_food", "Fast food", A4),
    treat("nicotine", "Nikotin", A1),
    clock("last_meal", "Poslední jídlo", A2),
    // Own scale "hours": hours before sleep (computed from the next day's bedtime in templateCharts) must not share
    // the kcal axis.
    { ...value("meal_gap_h", "Jídlo před spaním", "h", A2), scale: "hours" },
  ],
  mind: [
    { ...score("clarity", "Jasnost", A1), better: "high" },
    { ...score("energy", "Energie", A2), better: "high" },
    { ...score("frustration", "Frustrace", A3), better: "low" },
  ],
  // Grogginess exists only on nap days: drawn against nap length (napScatter), not over time.
  nap: [{ ...value("minutes", "Nap", "min", A1), zeroFill: true }],
  social: [score("battery", "Sociální baterie", A1)],
  water: [value("liters", "Vypito", "l", A1)],
  // avgLine: dotted average line in the chart; zeroFill: a recorded day without the metric counts as 0 (not done),
  // a day with no record at all stays unfilled.
  steps: [{ ...value("steps", "Kroky", "kroků", A1), avgLine: true }],
  fasting: [], // drawn as a presence grid (PRESENCE.fasting)
  screen_time: [{ ...value("minutes", "Čas u obrazovky", "min", A1), avgLine: true }],
  // shortcut: pages aren't charted (another unit on the same axis); they show in Záznamy. Chart them if asked.
  reading: [{ ...value("minutes", "Čtení", "min", A1), zeroFill: true }], // only reading days get written down
  meditation: [{ ...value("minutes", "Meditace", "min", A1), zeroFill: true }], // modal saves only >= 1 min
  stress: [{ ...score("stress", "Stres", A3), better: "low" }], // warm "caution" hue, not the reward accent
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
  screen_time: [["minutes", "avg", "min"]],
  // Daily goals (goals.js) compare per day, so the headline is the daily average too.
  reading: [["minutes", "avg", "min"]],
  meditation: [["minutes", "avg", "min"]],
  stress: [["stress", "avg", ""]],
  mind: [["clarity", "avg", ""], ["energy", "avg", ""], ["frustration", "avg", ""]],
  nap: [["minutes", "avg", "min"]],
  social: [["battery", "avg", ""]], // the card shows contact days instead (presence aside)
};

// Bedtime / wake time over the last 7 rows: mean and standard deviation (rhythm consistency, "±25 min").
export function clockStats(rows, key, days = WEEK) {
  const xs = rows.slice(-days).map((r) => r[key]).filter((v) => v != null);
  if (!xs.length) return null;
  const mean = sum(xs) / xs.length;
  return { mean, sd: Math.sqrt(sum(xs.map((x) => (x - mean) ** 2)) / xs.length) };
}

// Training load (session RPE): per day Σ rpe × minutes. Acute = last 7 days, chronic = last 28 days / 4,
// ACWR = acute / chronic, only with >= 28 days of data. Zones per the usual sports-science bands.
export const ACWR_ZONES = [[0.8, "nízká zátěž"], [1.3, "optimální"], [1.5, "zvýšená"], [Infinity, "riziko přetížení"]];
export function trainingLoad(days, t) {
  const loads = days.map(({ record }) => {
    const sports = record?.results.find((r) => r.template_id === t.id)?.result_data_json?.sports;
    return sports ? sum(sports.filter((s) => s.minutes != null && s.rpe != null).map((s) => s.rpe * s.minutes)) : null;
  });
  if (!loads.some((v) => v > 0)) return null;
  const total = (n) => sum(loads.slice(-n).map((v) => v ?? 0));
  const acute = total(WEEK);
  const chronic = days.length >= 28 ? total(28) / 4 : null;
  const acwr = chronic ? acute / chronic : null;
  return { acute, chronic, acwr, zone: acwr == null ? null : ACWR_ZONES.find(([max]) => acwr < max)[1] };
}

const iso = (d) => d.toLocaleDateString("sv-SE"); // YYYY-MM-DD local

// Card order = the shared section order (sections.js), same as the day entry and settings.
export { entryOrder } from "./sections.js";

// 7 days ending today (offset 0), or the 7-day windows before it (offset -1, -2…): rolling like the rest of the app,
// so the sport week is never empty on a Monday.
export function weekDays(records, offset = 0, today = new Date()) {
  const byDate = Object.fromEntries(records.map((r) => [r.date, r]));
  const end = today.getDate() + 7 * offset;
  return Array.from({ length: 7 }, (_, i) => {
    const date = iso(new Date(today.getFullYear(), today.getMonth(), end - 6 + i));
    return { date, record: byDate[date] ?? null };
  });
}

// Nap length × grogginess: does a longer nap leave you groggy? Same (minutes, grogginess) pairs merge into one
// point with n; short (<= NAP_SHORT min, the usual no-inertia length) vs longer naps compared once each has >= 2.
export const NAP_SHORT = 25;
export function napScatter(data) {
  const naps = data.filter((d) => d?.minutes > 0 && d.grogginess != null);
  const byPair = {};
  for (const { minutes, grogginess } of naps) {
    const k = `${minutes}/${grogginess}`;
    byPair[k] = { minutes, grogginess, n: (byPair[k]?.n ?? 0) + 1 };
  }
  const group = (xs) => (xs.length >= 2 ? { avg: sum(xs.map((d) => d.grogginess)) / xs.length, n: xs.length } : null);
  return {
    points: Object.values(byPair),
    total: naps.length,
    short: group(naps.filter((d) => d.minutes <= NAP_SHORT)),
    long: group(naps.filter((d) => d.minutes > NAP_SHORT)),
  };
}

// Hours between the last meal and falling asleep. The bedtime of that night lives in the NEXT day's sleep record
// (a day's sleep is the night you woke up from). Kept: a gap typed in by hand (old input). Outside 0–14 h -> null.
export function fillMealGap(rows, data, days, templates) {
  const sleepIds = new Set(templates.filter((t) => t.type === "sleep").map((t) => t.id));
  rows.forEach((row, i) => {
    if (row.meal_gap_h != null || !data[i]?.last_meal) return;
    const bed = days[i + 1]?.record?.results.find((r) => sleepIds.has(r.template_id))?.result_data_json?.bedtime;
    const gap = bed ? toClock(bed, true) - toClock(data[i].last_meal) : null;
    row.meal_gap_h = gap != null && gap >= 0 && gap <= 14 ? Math.round(gap * 4) / 4 : null;
  });
}

// X-axis ticks every 7 days ending with the last row, so every chart in a card shows the same dates.
export const weeklyTicks = (rows) => rows.filter((_, i) => (rows.length - 1 - i) % WEEK === 0).map((r) => r.date);

// Adds `${key}_ma` = average of the last `n` rows' values (needs >= minN filled), the readable trend under noisy
// daily 1–5 scores. Rows are copied, the input is not touched.
export function withRollingAvg(rows, keys, n = WEEK, minN = 3) {
  return rows.map((r, i) => {
    const out = { ...r };
    for (const k of keys) {
      const xs = rows.slice(Math.max(0, i - n + 1), i + 1).map((x) => x[k]).filter((v) => v != null);
      out[`${k}_ma`] = xs.length >= minN ? sum(xs) / xs.length : null;
    }
    return out;
  });
}

// Every calendar day from the first record in the window to today, so a missing day is a gap, not a jump.
export function lastDays(records, today = new Date()) {
  const start = new Date(today);
  start.setDate(start.getDate() - (DAYS - 1));
  const byDate = Object.fromEntries(records.map((r) => [r.date, r]));
  const first = records.map((r) => r.date).filter((d) => d >= iso(start)).sort()[0];
  if (!first) return [];
  const days = [];
  for (const d = new Date(`${first}T00:00`); iso(d) <= iso(today); d.setDate(d.getDate() + 1)) days.push({ date: iso(d), record: byDate[iso(d)] ?? null });
  return days;
}

// Average or total of `key` over the last WEEK rows, and the change vs the WEEK before.
// Nulls (unfilled days) are skipped; no data -> null; delta needs a full previous week.
export function weekSummary(rows, key, mode = "avg", days = WEEK) {
  const agg = (part) => {
    const xs = part.map((r) => r[key]).filter((v) => v != null);
    return xs.length ? (mode === "sum" ? sum(xs) : sum(xs) / xs.length) : null;
  };
  const value = agg(rows.slice(-days));
  if (value == null) return null;
  const prev = rows.length >= 2 * days ? agg(rows.slice(-2 * days, -days)) : null;
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
    const intensity = row[`${key}i`] != null ? `RPE ${row[`${key}i`]}` : "";
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
      row[`${k}i`] = count[k] === 1 ? s.rpe : null; // RPE only when one sport sits in the segment
    }
    return { ...row, _minutes: mode === "minutes" ? sum(series.map((s) => row[s.key])) : null };
  });
  return { series, rows };
}

// Emotions: categories without a scale -> presence grid. One row per emotion felt in the window, ordered by
// how often (ties keep settings order); cells: true = felt, false = day filled without it, null = not filled.
// Social contact uses the same grid, keyed "kinds", rows in settings order (depth / group size), not by frequency.
// Fasting is a yes/no day (the hours are fixed in settings), so it is a one-row grid too, not bars of a constant.
// get: result -> list of names present that day (null = not filled); key: config list giving the row order.
// zeroFill: a recorded day without the result counts as "none" (like reading: only fasting days get noted).
const PRESENCE = {
  emotions: { key: "emotions", get: (d) => d.emotions, byFrequency: true },
  social: { key: "kinds", get: (d) => d.kinds, byFrequency: false },
  fasting: { key: "fasting", get: (d) => (d.fasted == null ? null : d.fasted ? ["půst"] : []), byFrequency: false, zeroFill: true },
};
export const emotionGrid = (days, t) => presenceGrid(days, t);
export function presenceGrid(days, t) {
  const { key, get, byFrequency, zeroFill } = PRESENCE[t.type];
  const data = days.map(({ record }) => {
    const d = record?.results.find((r) => r.template_id === t.id)?.result_data_json;
    return (d && get(d)) ?? (zeroFill && record ? [] : null);
  });
  if (!data.some(Boolean)) return null;
  const order = PRESENCE[t.type].order ?? t.config_json?.[key] ?? [];
  const total = {};
  for (const list of data) for (const e of list ?? []) total[e] = (total[e] ?? 0) + 1;
  const rank = (e) => (order.includes(e) ? order.indexOf(e) : order.length);
  const names = Object.keys(total).sort((a, b) => (byFrequency ? total[b] - total[a] : 0) || rank(a) - rank(b));
  const week = (e) => data.slice(-WEEK).filter((list) => list?.includes(e)).length;
  const rows = names.map((name) => ({ name, total: total[name], week: week(name), cells: data.map((list) => (list ? list.includes(name) : null)) }));
  const top = [...rows].sort((a, b) => b.week - a.week || b.total - a.total)[0];
  const contactWeek = data.slice(-WEEK).filter((list) => list?.some((k) => k !== "nikdo")).length; // social: days with real contact
  return { dates: days.map((d) => d.date), rows, top: top?.week ? top.name : null, filledWeek: data.slice(-WEEK).filter(Boolean).length, contactWeek };
}

// Overview goal evaluation over templateCharts() cards: rate 0–1 per goal (daily: met / filled days, weekly:
// total / target), a visible level, the average as the week's score, and the trend vs the 7 days before
// (average change over goals that have data in both windows, so a newly added goal doesn't skew it).
export const GOOD = 0.8, MID = 0.5;
const rateOf = (s, info) => (!s.of ? null : info.period === "week" ? Math.min(1, s.total / info.goal.value) : s.met / s.of);
const avg = (xs) => (xs.length ? sum(xs) / xs.length : null);
export function goalReport(cards) {
  const items = cards.flatMap(({ rows, goals = [] }) =>
    goals.map((info) => {
      const rate = rateOf(info.status, info);
      const prev = rateOf(goalStatus(rows.slice(0, -WEEK), info.rowKey, info.goal, info.dir, WEEK, info.period), info);
      return { info, rows, rate, prev, level: rate == null ? null : rate >= GOOD ? "good" : rate >= MID ? "mid" : "bad" };
    }),
  );
  const rated = items.filter((i) => i.rate != null);
  const both = rated.filter((i) => i.prev != null);
  return { items, score: avg(rated.map((i) => i.rate)), trend: avg(both.map((i) => i.rate - i.prev)), good: rated.filter((i) => i.level === "good").length, total: rated.length };
}

// Raw API records -> one card per template that has data: { template, groups: [{ scale, series, rows }], summary }.
// A day without the template's result (or without a metric) yields null -> gap in the line.
export function templateCharts(days, templates) {
  const cards = [];
  for (const t of entryOrder(templates)) {
    const presence = PRESENCE[t.type] ? presenceGrid(days, t) : null;
    if (t.type === "emotions") {
      if (presence) cards.push({ template: t, presence, groups: [], weekGoals: [] });
      continue;
    }
    if (!METRICS[t.type]) continue;
    const data = days.map(({ record }) => record?.results.find((r) => r.template_id === t.id)?.result_data_json);
    const sport = t.type === "sport" ? sportSeries(t, data) : null;
    const metrics = sport ? sport.series : METRICS[t.type];
    const rows = days.map(({ date, record }, i) => ({
      date,
      ...(sport ? sport.rows[i] : Object.fromEntries(metrics.map((m) => [m.key, (data[i] ? m.get(data[i]) : null) ?? (m.zeroFill && record ? 0 : null)]))),
      // Activities that day (sport entries), for the weekly activity goal; "bez sportu" = 0.
      ...(t.type === "sport" && { _count: data[i] ? (data[i].sports?.length ?? 0) : null }),
    }));
    if (t.type === "food") fillMealGap(rows, data, days, templates);
    // Hide a metric with nothing to show (never tracked, or only zeros; for counts a 0 is data, e.g. no alcohol).
    // Copies, so per-card fields (goalInfo, avg) never leak into the shared METRICS objects.
    const series = metrics.filter((m) => rows.some((r) => (m.integer && !m.stack ? r[m.key] != null : r[m.key] > 0))).map((m) => ({ ...m }));
    for (const s of series) if (s.avgLine) s.avg = weekSummary(rows, s.key, "avg", rows.length)?.value;
    // Groups in the order their metrics are listed (nap: minutes first, grogginess under them).
    const groups = [...new Set(metrics.map((m) => m.scale))]
      .map((scale) => ({ scale, series: series.filter((m) => m.scale === scale), rows }))
      .filter((g) => g.series.length);
    if (!groups.length && !presence) continue; // social: the presence grid alone is enough for a card
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
    const pick = SUMMARY[t.type]?.find(([key]) => rows.some((r) => r[key] != null));
    const summary = pick && weekSummary(rows, pick[0], pick[1]);
    cards.push({ template: t, groups, weekGoals, rows, ...(presence && { presence }), ...(t.type === "sport" && { load: trainingLoad(days, t) }), ...(t.type === "nap" && { scatter: napScatter(data) }), goals: [...Object.values(goals), ...weekGoals], summary: summary && { ...summary, mode: pick[1], unit: pick[2], ...(goals[pick[0]] && { goalInfo: goals[pick[0]] }) } });
  }
  return cards;
}
