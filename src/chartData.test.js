// Self-check: node src/chartData.test.js
import { lastDays, templateCharts } from "./chartData.js";
const assert = (c, m) => { if (!c) throw new Error(m); };

const today = new Date(2026, 10, 9);
const records = [{ id: 1, date: "2026-11-09", mood_score: 3, results: [{ template_id: 1, result_data_json: { liters: 2 } }] }];
const water = (is_active) => [{ id: 1, type: "water", name: "Pitný režim", is_active, config_json: { goals: { liters: { value: 2 } } } }];
const days = lastDays(records, today);
assert(templateCharts(days, water(true)).length === 1, "active template has a card");
assert(templateCharts(days, water(false)).length === 0, "switched-off template is hidden");
assert(records[0].results.length === 1, "data untouched");
console.log("chartData ok");

// Sub-metric switched off (food caffeine): no series, no goal; calories still charted; saved data untouched.
const foodRec = [{ id: 2, date: "2026-11-09", mood_score: 3, results: [{ template_id: 3, result_data_json: { calories: 2100, coffee: 3 } }] }];
const food = (caffeine) => [{ id: 3, type: "food", name: "Jídlo", is_active: true, config_json: { calories: true, caffeine, goals: { coffee: { value: 2 }, calories: { value: 2200, tolerance: 200 } } } }];
const keys = (c) => c.groups.flatMap((g) => g.series.map((s) => s.key));
const [on] = templateCharts(lastDays(foodRec, today), food(true));
const [off] = templateCharts(lastDays(foodRec, today), food(false));
assert(keys(on).includes("coffee") && on.goals.some((g) => g.key === "coffee"), "caffeine on: series + goal");
assert(!keys(off).includes("coffee") && !off.goals.some((g) => g.key === "coffee") && keys(off).includes("calories"), "caffeine off: hidden, calories stay");
assert(foodRec[0].results[0].result_data_json.coffee === 3, "caffeine data untouched");

// Insights skip a rule whose sub-metric is switched off.
const { insights } = await import("./insights.js");
const days30 = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 10, 9 - i);
  return { id: 100 + i, date: d.toLocaleDateString("sv-SE"), mood_score: i % 2 ? 2 : 5, results: [{ template_id: 3, result_data_json: { coffee: i % 2 ? 4 : 0 } }] };
});
assert(insights(days30, food(true), today).some((x) => x.id === "coffee3"), "coffee insight when tracked");
assert(!insights(days30, food(false), today).some((x) => x.id === "coffee3"), "no coffee insight when switched off");
console.log("sub-metric flags ok");
