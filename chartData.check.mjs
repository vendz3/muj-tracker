// Self-check of dashboard chart data shaping. Run: node chartData.check.mjs (from frontend/)
import assert from "node:assert/strict";
import { METRICS, activities, emotionGrid, lastDays, templateCharts, weekSummary } from "./src/chartData.js";
import { goalStatus, goalText, meets } from "./src/goals.js";

const T = [
  { id: 1, type: "sleep" },
  { id: 2, type: "sport", config_json: { sports: ["fotbal", "běh"], duration: true } },
  { id: 3, type: "food" },
  { id: 4, type: "water" }, // never filled -> no card
  { id: 5, type: "unknown" }, // unknown type -> ignored, no crash
];
const rec = (date, results) => ({ date, mood_score: 3, results: results.map(([template_id, result_data_json]) => ({ template_id, result_data_json })) });
const records = [
  rec("2026-11-07", [[1, { sleep_quality: 4, sleep_hours: 7.5 }], [2, { sports: [{ name: "běh", intensity: 2, minutes: 30 }, { name: "fotbal", intensity: 4 }] }], [3, { calories: 2100 }]]),
  rec("2026-11-06", []), // day with no template filled at all
  // 2026-11-05 missing entirely -> gap
  rec("2026-11-04", [[2, { sports: [] }], [3, { quality: 3, alcohol: 2 }], [5, { x: 1 }]]),
  rec("2026-09-01", [[1, { sleep_quality: 1 }]]), // outside the 30-day window
];

const days = lastDays(records, new Date(2026, 10, 7, 12));
assert.deepEqual(days.map((d) => d.date), ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
assert.equal(days[1].record, null);

const cards = Object.fromEntries(templateCharts(days, T).map((c) => [c.template.type, c]));
assert.deepEqual(Object.keys(cards), ["sleep", "sport", "food"]);

const col = (type, scale, key) => cards[type].groups.find((g) => g.scale === scale).rows.map((r) => r[key]);
// Sleep only filled on the 7th: nulls elsewhere (gaps), no throw on the empty / missing days.
assert.deepEqual(col("sleep", "score", "sleep_quality"), [null, null, null, 4]);
assert.deepEqual(col("sleep", "value", "sleep_hours"), [null, null, null, 7.5]);
// Sport with minutes: stacked series per sport in settings order; "bez sportu" = 0, no result = gap;
// intensity rides along for the tooltip; an untimed sport adds 0 and, with no minutes at all, is hidden.
const sport = cards.sport.groups.find((g) => g.scale === "value");
assert.deepEqual(sport.series.map((s) => s.label), ["běh"]);
assert.deepEqual(sport.rows.map((r) => r.s1), [0, null, null, 30]);
assert.equal(sport.rows[3].s1i, 2);
assert.equal(sport.series[0].format(30, sport.rows[3]), "30 min · intenzita 2");
assert.deepEqual(cards.sport.groups.map((g) => g.scale), ["value"]); // no fragmented intensity line
assert.deepEqual(cards.sport.summary, { value: 30, delta: null, mode: "sum", unit: "min" });
// Food: partial days (only calories / no calories) -> null for the missing metric; never-tracked metrics hidden.
assert.deepEqual(cards.food.groups.find((g) => g.scale === "score").series.map((s) => s.key), ["quality", "alcohol"]);
assert.deepEqual(col("food", "score", "alcohol"), [2, null, null, null]);
assert.deepEqual(col("food", "value", "calories"), [null, null, null, 2100]);

assert.deepEqual(lastDays([], new Date()), []);

// 4 named sports + "ostatní": 2 keep their color, the rest fold into gray "Ostatní" (max 3 series).
const many = [rec("2026-11-07", [[9, { sports: ["a", "b", "c", "d", "ostatní"].map((name, i) => ({ name, intensity: 3, minutes: 10 * (i + 1) })) }]])];
const fold = templateCharts(lastDays(many, new Date(2026, 10, 7, 12)), [{ id: 9, type: "sport", config_json: { sports: ["b", "a"], duration: true } }])[0].groups[0];
assert.deepEqual(fold.series.map((s) => s.label), ["b", "a", "Ostatní"]);
assert.deepEqual([fold.rows[0].s0, fold.rows[0].s1, fold.rows[0].so, fold.rows[0]._minutes], [20, 10, 30 + 40 + 50, 150]);
assert.equal(fold.rows[0].soi, null); // several sports in one segment -> no single intensity

// Activities mode: duration off (even if old days have minutes) or no minutes at all -> count per sport,
// so an untimed activity is still visible; whole numbers; headline "N aktivit / 7 dní".
const mixed = [
  rec("2026-11-07", [[9, { sports: [{ name: "a", intensity: 4 }] }]]), // untimed today
  rec("2026-11-06", [[9, { sports: [{ name: "a", intensity: 2, minutes: 40 }, { name: "b", intensity: 3, minutes: 20 }] }]]),
];
const today = new Date(2026, 10, 7, 12);
const count = templateCharts(lastDays(mixed, today), [{ id: 9, type: "sport", config_json: { sports: ["a", "b"], duration: false } }])[0];
const cg = count.groups[0];
assert.deepEqual(cg.series.map((s) => [s.label, s.mode, s.integer]), [["a", "count", true], ["b", "count", true]]);
assert.deepEqual(cg.rows.map((r) => [r.s0, r.s1, r._count, r._minutes]), [[1, 1, 2, null], [1, 0, 1, null]]);
assert.equal(cg.series[0].format(1, cg.rows[1]), "intenzita 4");
assert.deepEqual([count.summary.value, count.summary.mode, count.summary.unit(3)], [3, "sum", "aktivity"]);
// Same data with duration on -> minutes; the untimed activity adds 0 min.
const mins = templateCharts(lastDays(mixed, today), [{ id: 9, type: "sport", config_json: { sports: ["a", "b"], duration: true } }])[0];
assert.deepEqual(mins.groups[0].rows.map((r) => r._minutes), [60, 0]);
assert.equal(mins.summary.unit, "min");
assert.deepEqual([1, 2, 4, 5, 0].map(activities), ["aktivita", "aktivity", "aktivity", "aktivit", "aktivit"]);
assert.deepEqual(METRICS.food.filter((m) => m.better === "low").map((m) => m.key), ["alcohol", "caffeine", "sugar"]);

// weekSummary: avg/sum over the last 7 rows, nulls skipped, delta only with a full previous week.
const r = (vals) => vals.map((v) => ({ v }));
assert.deepEqual(weekSummary(r([1, 1, 1, 1, 1, 1, 1, 2, null, 4, null, null, null, null]), "v"), { value: 3, delta: 2 });
assert.deepEqual(weekSummary(r([5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 1]), "v", "sum"), { value: 7, delta: -28 });
assert.deepEqual(weekSummary(r([2, 4]), "v"), { value: 3, delta: null });
assert.equal(weekSummary(r([1, 2, 3, 4, 5, 6, 7, null, null, null, null, null, null, null]), "v"), null);
// Goals: three directions, range edges inclusive, unfilled days ignored.
assert.equal(meets(7, { value: 7 }, "min"), true);
assert.equal(meets(6.5, { value: 7 }, "min"), false);
assert.equal(meets(2, { value: 2 }, "max"), true);
assert.equal(meets(3, { value: 2 }, "max"), false);
assert.equal(meets(2000, { value: 2200, tolerance: 200 }, "range"), true);
assert.equal(meets(2401, { value: 2200, tolerance: 200 }, "range"), false);
assert.equal(goalText({ value: 2200, tolerance: 200 }, "range", "kcal"), "2 200 ± 200 kcal");
assert.equal(goalText({ value: 7.5 }, "min", "h"), "≥ 7,5 h");
assert.deepEqual(goalStatus(r([9, 1, 3, null, 2, null, 1, 3]), "v", { value: 2 }, "max"), { met: 3, of: 5, ok: true }); // last 7: 1,3,2,1,3
assert.deepEqual(goalStatus(r([null, null]), "v", { value: 2 }, "max"), { met: 0, of: 0, ok: false });

// Goals reach the cards. Sport goals are weekly: totals of minutes / activities, as meters, not chart lines.
const withGoals = T.map((t) =>
  t.type === "sport" ? { ...t, config_json: { ...t.config_json, goals: { week_minutes: { value: 25 }, week_activities: { value: 3 } } } }
  : t.type === "food" ? { ...t, config_json: { goals: { alcohol: { value: 1 } } } } : t);
const gc = Object.fromEntries(templateCharts(days, withGoals).map((c) => [c.template.type, c]));
const [wMin, wAct] = gc.sport.weekGoals;
assert.deepEqual([wMin.key, wMin.status], ["week_minutes", { total: 30, of: 2, ok: true }]); // 0 ("bez sportu") + 30 ≥ 25
assert.deepEqual([wAct.key, wAct.status], ["week_activities", { total: 2, of: 2, ok: false }]); // 0 + 2 activities < 3
assert.equal(gc.sport.summary.goalInfo, undefined); // weekly goals never draw a line over daily bars
assert.equal(gc.sport.groups[0].goalInfo, undefined);
assert.deepEqual(gc.sleep.weekGoals, []);
// 1–5 ratings have no goals any more: an old stored alcohol goal is ignored, not drawn.
assert.equal(gc.food.groups.find((g) => g.scale === "score").series.find((s) => s.key === "alcohol").goalInfo, undefined);
assert.equal(gc.sleep.summary.goalInfo, undefined);
// Emotions: presence grid. true = felt, false = filled without it, null = not filled; rows by frequency,
// emotions never felt hidden, one outside current settings still shown; top = most frequent in the last 7 days.
const E = { id: 6, type: "emotions", config_json: { emotions: ["radost", "smutek", "strach"] } };
const emo = [
  rec("2026-11-07", [[6, { emotions: ["strach", "radost"] }]]),
  rec("2026-11-06", [[1, { sleep_quality: 3 }]]), // day logged, emotions not filled
  rec("2026-11-05", [[6, { emotions: ["strach", "úzkost"] }]]), // "úzkost" was removed from settings since
  rec("2026-11-04", [[6, { emotions: ["radost"] }]]),
];
const eg = emotionGrid(lastDays(emo, today), E);
assert.deepEqual(eg.rows.map((r) => [r.name, r.total, r.week]), [["radost", 2, 2], ["strach", 2, 2], ["úzkost", 1, 1]]);
assert.deepEqual(eg.rows[0].cells, [true, false, null, true]);
assert.equal(eg.top, "radost"); // tie with strach -> settings order
assert.equal(eg.filledWeek, 3);
assert.ok(!eg.rows.some((r) => r.name === "smutek"));
assert.equal(emotionGrid(lastDays([rec("2026-11-07", [[1, { sleep_quality: 3 }]])], today), E), null);
const ec = templateCharts(lastDays(emo, today), [E])[0];
assert.deepEqual([ec.template.type, ec.groups.length, !!ec.emotions], ["emotions", 0, true]);
console.log("OK");

// Weekly goals count the calendar week Mon–Sun of the last row: Sunday sees Mon..Sun, Monday starts from zero.
const wk = (dates) => dates.map((date) => ({ date, v: 1 }));
assert.deepEqual(goalStatus(wk(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-08"]), "v", { value: 3 }, "min", 7, "week"), { total: 3, of: 3, ok: true }); // Sun 1.11. is last week
assert.deepEqual(goalStatus(wk(["2026-11-07", "2026-11-08", "2026-11-09"]), "v", { value: 3 }, "min", 7, "week"), { total: 1, of: 1, ok: false }); // Mon 9.11.: new week
console.log("OK week");

// Every new numeric template gets a card with a headline (SUMMARY entry) instead of crashing.
for (const [type, key] of [["steps", "steps"], ["fasting", "hours"], ["screen_time", "minutes"], ["reading", "minutes"], ["meditation", "minutes"], ["stress", "stress"]]) {
  const t = { id: 1, type, name: type, config_json: {} };
  const ds = ["2026-11-07", "2026-11-08"].map((date) => ({ date, record: { results: [{ template_id: 1, result_data_json: { [key]: 3 } }] } }));
  const [c] = templateCharts(ds, [t]);
  assert.equal(c.summary.value, 3, type); // daily average
}
assert.deepEqual(templateCharts([{ date: "2026-11-08", record: { results: [{ template_id: 1, result_data_json: { items: ["a"] } }] } }], [{ id: 1, type: "gratitude", config_json: {} }]), []);
console.log("OK new templates");
