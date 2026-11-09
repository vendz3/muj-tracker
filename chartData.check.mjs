// Self-check of dashboard chart data shaping. Run: node chartData.check.mjs (from frontend/)
import assert from "node:assert/strict";
import { METRICS, activities, clockStats, emotionGrid, entryOrder, fmtClock, goalReport, lastDays, toClock, trainingLoad, templateCharts, napScatter, weekDays, weekSummary, weeklyTicks, withRollingAvg } from "./src/chartData.js";
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
  rec("2026-11-07", [[1, { sleep_quality: 4, sleep_hours: 7.5 }], [2, { sports: [{ name: "běh", rpe: 2, minutes: 30 }, { name: "fotbal", rpe: 4 }] }], [3, { calories: 2100 }]]),
  rec("2026-11-06", []), // day with no template filled at all
  // 2026-11-05 missing entirely -> gap
  rec("2026-11-04", [[2, { sports: [] }], [3, { quality: 3, drinks: 0 }], [5, { x: 1 }]]),
  rec("2026-09-01", [[1, { sleep_quality: 1 }]]), // outside the 30-day window
];

const days = lastDays(records, new Date(2026, 10, 7, 12));
assert.deepEqual(days.map((d) => d.date), ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
assert.equal(days[1].record, null);

const cards = Object.fromEntries(templateCharts(days, T).map((c) => [c.template.type, c]));
assert.deepEqual(Object.keys(cards), ["sleep", "food", "sport"]);

const col = (type, scale, key) => cards[type].groups.find((g) => g.scale === scale).rows.map((r) => r[key]);
// Sleep only filled on the 7th: nulls elsewhere (gaps), no throw on the empty / missing days.
assert.deepEqual(col("sleep", "score", "sleep_quality"), [null, null, null, 4]);
assert.deepEqual(col("sleep", "value", "sleep_hours"), [null, null, null, 7.5]);
// Sport with minutes: stacked series per sport in settings order; "bez sportu" = 0, no result = gap;
// RPE rides along for the tooltip; an untimed sport adds 0 and, with no minutes at all, is hidden.
const sport = cards.sport.groups.find((g) => g.scale === "value");
assert.deepEqual(sport.series.map((s) => s.label), ["běh"]);
assert.deepEqual(sport.rows.map((r) => r.s1), [0, null, null, 30]);
assert.equal(sport.rows[3].s1i, 2);
assert.equal(sport.series[0].format(30, sport.rows[3]), "30 min · RPE 2");
assert.deepEqual(cards.sport.groups.map((g) => g.scale), ["value"]); // no fragmented RPE line
assert.deepEqual(cards.sport.summary, { value: 30, delta: null, mode: "sum", unit: "min" });
// Food: partial days (only calories / no calories) -> null for the missing metric; never-tracked metrics hidden.
assert.deepEqual(cards.food.groups.map((g) => g.scale), ["score", "value", "treat"]);
assert.deepEqual(cards.food.groups.find((g) => g.scale === "treat").series.map((s) => s.key), ["drinks"]); // 0 drinks is data, stays visible
assert.deepEqual(col("food", "treat", "drinks"), [0, null, null, null]);
assert.equal(METRICS.food.find((m) => m.key === "drinks").format(5), "5+");
assert.deepEqual(col("food", "value", "calories"), [null, null, null, 2100]);

assert.deepEqual(lastDays([], new Date()), []);

// 4 named sports + "ostatní": 2 keep their color, the rest fold into gray "Ostatní" (max 3 series).
const many = [rec("2026-11-07", [[9, { sports: ["a", "b", "c", "d", "ostatní"].map((name, i) => ({ name, rpe: 3, minutes: 10 * (i + 1) })) }]])];
const fold = templateCharts(lastDays(many, new Date(2026, 10, 7, 12)), [{ id: 9, type: "sport", config_json: { sports: ["b", "a"], duration: true } }])[0].groups[0];
assert.deepEqual(fold.series.map((s) => s.label), ["b", "a", "Ostatní"]);
assert.deepEqual([fold.rows[0].s0, fold.rows[0].s1, fold.rows[0].so, fold.rows[0]._minutes], [20, 10, 30 + 40 + 50, 150]);
assert.equal(fold.rows[0].soi, null); // several sports in one segment -> no single RPE

// Activities mode: duration off (even if old days have minutes) or no minutes at all -> count per sport,
// so an untimed activity is still visible; whole numbers; headline "N aktivit / 7 dní".
const mixed = [
  rec("2026-11-07", [[9, { sports: [{ name: "a", rpe: 4 }] }]]), // untimed today
  rec("2026-11-06", [[9, { sports: [{ name: "a", rpe: 2, minutes: 40 }, { name: "b", rpe: 3, minutes: 20 }] }]]),
];
const today = new Date(2026, 10, 7, 12);
const count = templateCharts(lastDays(mixed, today), [{ id: 9, type: "sport", config_json: { sports: ["a", "b"], duration: false } }])[0];
const cg = count.groups[0];
assert.deepEqual(cg.series.map((s) => [s.label, s.mode, s.integer]), [["a", "count", true], ["b", "count", true]]);
assert.deepEqual(cg.rows.map((r) => [r.s0, r.s1, r._count, r._minutes]), [[1, 1, 2, null], [1, 0, 1, null]]);
assert.equal(cg.series[0].format(1, cg.rows[1]), "RPE 4");
assert.deepEqual([count.summary.value, count.summary.mode, count.summary.unit(3)], [3, "sum", "aktivity"]);
// Same data with duration on -> minutes; the untimed activity adds 0 min.
const mins = templateCharts(lastDays(mixed, today), [{ id: 9, type: "sport", config_json: { sports: ["a", "b"], duration: true } }])[0];
assert.deepEqual(mins.groups[0].rows.map((r) => r._minutes), [60, 0]);
assert.equal(mins.summary.unit, "min");
assert.deepEqual([1, 2, 4, 5, 0].map(activities), ["aktivita", "aktivity", "aktivity", "aktivit", "aktivit"]);
assert.deepEqual(METRICS.food.filter((m) => m.better === "low").map((m) => m.key), ["drinks", "coffee", "sweets", "sugary_drinks", "fast_food", "nicotine"]);

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
  : t.type === "food" ? { ...t, config_json: { alcohol: true, goals: { alcohol: { value: 1 }, drinks: { value: 0 } } } } : t);
const gc = Object.fromEntries(templateCharts(days, withGoals).map((c) => [c.template.type, c]));
const [wMin, wAct] = gc.sport.weekGoals;
assert.deepEqual([wMin.key, wMin.status], ["week_minutes", { total: 30, of: 2, ok: true }]); // 0 ("bez sportu") + 30 ≥ 25
assert.deepEqual([wAct.key, wAct.status], ["week_activities", { total: 2, of: 2, ok: false }]); // 0 + 2 activities < 3
assert.equal(gc.sport.summary.goalInfo, undefined); // weekly goals never draw a line over daily bars
assert.equal(gc.sport.groups[0].goalInfo, undefined);
assert.deepEqual(gc.sleep.weekGoals, []);
// Food counts have daily max goals: "Alkohol ≤ 0" = alcohol-free days (0 drinks on the 4th meets it).
// An old goal on the retired 1–5 "alcohol" key is ignored.
assert.deepEqual(gc.food.groups.find((g) => g.scale === "treat").series[0].goalInfo.status, { met: 1, of: 1, ok: true });
assert.ok(!gc.food.goals.some((g) => g.key === "alcohol"));
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
assert.deepEqual([ec.template.type, ec.groups.length, !!ec.presence], ["emotions", 0, true]);
console.log("OK");

// Weekly goals count the last 7 rows (rolling), not the calendar week.
const wk = (vs) => vs.map((v, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, v }));
assert.deepEqual(goalStatus(wk([1, 1, null, 1, null, null, null, 1, 1]), "v", { value: 3 }, "min", 7, "week"), { total: 3, of: 3, ok: true }); // first two rows fall out
assert.deepEqual(goalStatus(wk([1, 1, 1, null, null, null, null, null, null]), "v", { value: 3 }, "min", 7, "week"), { total: 1, of: 1, ok: false });
console.log("OK week");

// goalReport: rate, level, score and the previous 7 days for the trend.
const daily = { key: "d", dir: "min", goal: { value: 2 }, rowKey: "d", status: { met: 4, of: 5 } };
const weekly = { key: "w", dir: "min", goal: { value: 3 }, rowKey: "w", period: "week", status: { total: 2, of: 2 } };
const prevRows = [...Array(7)].map(() => ({ d: 1, w: null })); // previous week: daily all missed, weekly no data
const rep = goalReport([{ rows: [...prevRows, ...Array(7).fill({ d: 2 })], goals: [daily, weekly] }]);
assert.deepEqual(rep.items.map((i) => [i.level, Math.round(i.rate * 100)]), [["good", 80], ["mid", 67]]);
assert.equal(Math.round(rep.score * 100), 73);
assert.equal(rep.good, 1);
assert.equal(Math.round(rep.trend * 100), 80); // only the daily goal had data the week before: 0 -> 0,8
assert.equal(goalReport([{ rows: [], goals: [{ ...daily, status: { met: 0, of: 0 } }] }]).score, null);
console.log("OK goalReport");

// Every new numeric template gets a card with a headline (SUMMARY entry) instead of crashing.
for (const [type, key] of [["steps", "steps"], ["screen_time", "minutes"], ["reading", "minutes"], ["meditation", "minutes"], ["stress", "stress"]]) {
  const t = { id: 1, type, name: type, config_json: {} };
  const ds = ["2026-11-07", "2026-11-08"].map((date) => ({ date, record: { results: [{ template_id: 1, result_data_json: { [key]: 3 } }] } }));
  const [c] = templateCharts(ds, [t]);
  assert.equal(c.summary.value, 3, type); // daily average
}
assert.deepEqual(templateCharts([{ date: "2026-11-08", record: { results: [{ template_id: 1, result_data_json: { items: ["a"] } }] } }], [{ id: 1, type: "gratitude", config_json: {} }]), []);
console.log("OK new templates");

{
const today = new Date(2026, 10, 11); // Wed 11. 11. 2026
const recs = [{ date: "2026-11-02", results: [] }, { date: "2026-11-10", results: [] }];
const w = weekDays(recs, 0, today);
assert(w.length === 7 && w[0].date === "2026-11-05" && w[6].date === "2026-11-11", "last 7 days ending today");
assert(w[5].record === recs[1] && w[6].record === null, "records by date");
assert(weekDays(recs, -1, today)[0].date === "2026-10-29" && weekDays(recs, -1, today)[6].date === "2026-11-04", "the 7 days before");
// 7-day rolling average: needs 3 filled values, skips gaps.
const ma = withRollingAvg([1, 5, null, 3, 4, null, null, null, null, null].map((v) => ({ v })), ["v"]).map((r) => r.v_ma);
assert.deepEqual(ma.slice(0, 5), [null, null, null, 3, 3.25]);
assert.equal(ma[9], null); // rows 3..9 hold only 3 and 4: two values < 3

const order = entryOrder([{ id: 13, type: "stress" }, { id: 2, type: "sport" }, { id: 1, type: "sleep" }]).map((t) => t.id);
assert(order.join() === "13,1,2", "stress first, then by id");

// Meditation: a day without it counts as 0, so 10 min on 1 of 7 days -> Ø 10/7.
const med = { id: 12, type: "meditation", config_json: {} };
const mrecs = [...Array(7)].map((_, i) => ({ date: `2026-11-${String(i + 5).padStart(2, "0")}`, results: i === 6 ? [{ template_id: 12, result_data_json: { minutes: 10 } }] : [] }));
const card = templateCharts(lastDays(mrecs, new Date(2026, 10, 11)), [med])[0];
assert(Math.abs(card.summary.value - 10 / 7) < 1e-9, `meditation avg over all days, got ${card.summary.value}`);

// Steps: average line over the charted days (filled ones).
const st = { id: 6, type: "steps", config_json: {} };
const srecs = [["2026-11-10", 4000], ["2026-11-11", 8000]].map(([date, steps]) => ({ date, results: [{ template_id: 6, result_data_json: { steps } }] }));
assert(templateCharts(lastDays(srecs, today), [st])[0].groups[0].series[0].avg === 6000, "steps avg line");
}
console.log("OK week view, order, averages");

// Reading: only reading days get written down, so a recorded day without it counts as 0 (3 of 7, not 3 of 3);
// a day with no record at all stays unfilled.
const rd = { id: 10, type: "reading", config_json: { minutes: true, goals: { minutes: { value: 20 } } } };
const rrecs = [...Array(7)].map((_, i) => ({ date: `2026-11-${String(i + 3).padStart(2, "0")}`, results: i % 2 ? [{ template_id: 10, result_data_json: { minutes: 30 } }] : [] }));
const rc = templateCharts(lastDays(rrecs, new Date(2026, 10, 9)), [rd])[0]; // today = 9.11., the last of the 7 recorded days
assert.deepEqual(rc.goals[0].status, { met: 3, of: 7, ok: false });
assert.equal(templateCharts(lastDays([rrecs[1]], new Date(2026, 10, 5)), [rd])[0].rows.at(-1).minutes, null); // 5.11. has no record
console.log("OK reading zero-fill");

// Clock: bedtime after midnight wraps to 24+, so 23:30 and 00:30 are an hour apart; mean ± sd over 7 days.
assert.equal(toClock("00:30", true), 24.5);
assert.equal(toClock("23:30", true), 23.5);
assert.equal(toClock("07:15"), 7.25);
assert.equal(fmtClock(24.5), "0:30");
assert.equal(fmtClock(23 + 40 / 60), "23:40");
const cs = clockStats([{ b: 23 }, { b: 24 }, { b: null }], "b");
assert.deepEqual([cs.mean, cs.sd], [23.5, 0.5]);
const SL = { id: 1, type: "sleep", config_json: { times: true } };
const slc = templateCharts(lastDays([rec("2026-11-07", [[1, { bedtime: "00:15", waketime: "07:00" }]])], today), [SL])[0];
assert.deepEqual(slc.groups.map((g) => [g.scale, g.series.map((s) => s.key)]), [["clock", ["bedtime", "waketime"]]]);
assert.equal(slc.rows.at(-1).bedtime, 24.25);

// Training load: sRPE = rpe × minutes; ACWR only with >= 28 days, zone in words.
const SP = { id: 2, type: "sport", config_json: { duration: true } };
const load28 = [...Array(28)].map((_, i) => {
  const d = new Date(2026, 10, 9 - 27 + i).toLocaleDateString("sv-SE");
  return rec(d, [[2, { sports: i % 2 ? [{ name: "běh", rpe: 5, minutes: 40 }] : [] }]]); // every other day 200
});
const tl = trainingLoad(lastDays(load28, new Date(2026, 10, 9)), SP);
assert.deepEqual([tl.acute, tl.chronic, tl.zone], [800, 700, "optimální"]); // last 7: 4 sessions; 14 sessions / 4 -> ACWR 1,14
assert.equal(trainingLoad(lastDays(load28.slice(-10), new Date(2026, 10, 9)), SP).acwr, null);
assert.equal(templateCharts(lastDays(load28, new Date(2026, 10, 9)), [SP])[0].load.acute, 800);

// Social: presence grid in settings order (not by frequency), "nikdo" is a filled day without contact.
const SO = { id: 16, type: "social", config_json: { kinds: ["nikdo", "krátce", "1:1", "velká skupina"], battery: true } };
const soc = [
  rec("2026-11-07", [[16, { kinds: ["velká skupina"], battery: 4 }]]),
  rec("2026-11-06", [[16, { kinds: ["nikdo"] }]]),
  rec("2026-11-05", [[16, { kinds: ["velká skupina", "1:1"], battery: 2 }]]),
];
const sc = templateCharts(lastDays(soc, today), [SO])[0];
assert.deepEqual(sc.presence.rows.map((r) => r.name), ["nikdo", "1:1", "velká skupina"]);
assert.deepEqual([sc.presence.filledWeek, sc.presence.contactWeek], [3, 2]);
assert.deepEqual(sc.groups.map((g) => g.scale), ["score"]); // battery line
const scNoBattery = templateCharts(lastDays([soc[1]], today), [SO])[0];
assert.ok(scNoBattery.presence && scNoBattery.groups.length === 0, "grid-only card when no battery");

// Nap: a recorded day without a nap is 0 minutes, a day without a record stays unfilled.
const NP = { id: 15, type: "nap", config_json: { grogginess: true } };
const np = templateCharts(lastDays([rec("2026-11-05", [[15, { minutes: 20, grogginess: 2 }]]), rec("2026-11-07", [])], today), [NP])[0];
assert.deepEqual(np.rows.map((r) => r.minutes), [20, null, 0]);
console.log("OK clock, load, social, nap");

// Fasting: yes/no per day as a one-row grid; no bars of a constant 16 h.
const FA = { id: 7, type: "fasting", config_json: { full_day: false, hours: 16 } };
const fa = templateCharts(lastDays([rec("2026-11-05", [[7, { fasted: true, hours: 16 }]]), rec("2026-11-06", [[7, { fasted: false }]]), rec("2026-11-07", [])], today), [FA])[0];
assert.deepEqual(fa.presence.rows.map((r) => [r.name, r.cells]), [["půst", [true, false, false]]]); // 7.: recorded, no fast
assert.equal(fa.presence.filledWeek, 3);
assert.deepEqual(fa.groups, []);
// Nap: groups follow the metric order -> minutes first.
assert.deepEqual(np.groups.map((g) => g.scale), ["value"]); // grogginess moved to the scatter
assert.deepEqual(np.scatter.points, [{ minutes: 20, grogginess: 2, n: 1 }]);
// Weekly x ticks end on the last row, 7 days apart.
const wt = weeklyTicks([...Array(30)].map((_, i) => ({ date: `d${i}` })));
assert.deepEqual(wt, ["d1", "d8", "d15", "d22", "d29"]);
console.log("OK fasting grid, nap order, weekly ticks");
// A window with only non-fasting days: grid without rows, no crash.
const faNo = templateCharts(lastDays([rec("2026-11-06", [[7, { fasted: false }]])], today), [FA])[0];
assert.deepEqual([faNo.presence.rows, faNo.presence.filledWeek, faNo.presence.top], [[], 1, null]);
console.log("OK fasting without fasts");

// Nap scatter: duplicates merge, days without a nap or grogginess are skipped, short vs long need >= 2 each.
const ns = napScatter([{ minutes: 20, grogginess: 3 }, { minutes: 20, grogginess: 3 }, { minutes: 15, grogginess: 1 }, { minutes: 40, grogginess: 5 }, { minutes: 30 }, {}, null]);
assert.deepEqual(ns.points, [{ minutes: 20, grogginess: 3, n: 2 }, { minutes: 15, grogginess: 1, n: 1 }, { minutes: 40, grogginess: 5, n: 1 }]);
assert.deepEqual([ns.total, ns.short.n, Math.round(ns.short.avg * 100) / 100, ns.long], [4, 3, 2.33, null]);
console.log("OK nap scatter");

// One shared order: sections in the order of the day; unknown types in "Ostatní"; empty sections dropped.
const { groupTemplates, SECTIONS } = await import("./src/sections.js");
const all = ["gratitude", "screen_time", "meditation", "reading", "social", "steps", "sport", "nap", "fasting", "water", "food", "medication", "sleep", "emotions", "mind", "stress", "brand_new"].map((type, i) => ({ id: i + 1, type }));
assert.deepEqual(entryOrder(all).map((t) => t.type), ["stress", "mind", "emotions", "sleep", "medication", "food", "water", "fasting", "nap", "sport", "steps", "social", "reading", "meditation", "screen_time", "gratitude", "brand_new"]);
assert.deepEqual(groupTemplates(all).map((g) => g.title), [...SECTIONS.map((s) => s.title), "Ostatní"]);
assert.deepEqual(groupTemplates([{ id: 1, type: "sleep" }]).map((g) => g.title), ["Noc a ráno"]);
console.log("OK sections");

// Food v3: quality + calories + six vices + last meal; hours before sleep from the next day's bedtime.
const FD = { id: 3, type: "food", config_json: { meal_times: true } };
const SLP = { id: 1, type: "sleep", config_json: { times: true } };
const frecs = [
  rec("2026-11-05", [[3, { last_meal: "19:30", nicotine: 0, fast_food: 1 }]]),
  rec("2026-11-06", [[1, { bedtime: "23:30" }], [3, { last_meal: "20:00", meal_gap_h: 2 }]]),
  rec("2026-11-07", [[1, { bedtime: "00:30" }], [3, { last_meal: "20:00" }]]),
];
const fdc = templateCharts(lastDays(frecs, today), [FD, SLP]).find((c) => c.template.type === "food");
assert.deepEqual(fdc.rows.map((r) => r.meal_gap_h), [4, 2, null]); // 19:30 -> 23:30 next night; typed 2 kept; no next day
assert.deepEqual(fdc.groups.find((g) => g.scale === "treat").series.map((s) => s.key), ["fast_food", "nicotine"]); // 0 nicotine is data
assert.equal(fdc.presence, undefined); // after-meal grid retired
assert.ok(!METRICS.food.some((m) => ["veg", "protein", "processed", "first_meal", "eating_window"].includes(m.key)));
console.log("OK food v3");
