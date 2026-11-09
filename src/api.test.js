// Self-check: node src/api.test.js
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)) };
const { api, streak, exportData, importData, migrate } = await import("./api.js");
const assert = (c, m) => { if (!c) throw new Error(m); };

const today = new Date(2026, 10, 9);
assert(streak([], today) === 0, "empty");
assert(streak(["2026-11-09", "2026-11-08", "2026-11-06"], today) === 2, "ends today");
assert(streak(["2026-11-08", "2026-11-07"], today) === 2, "yesterday still holds");
assert(streak(["2026-11-07"], today) === 0, "broken");

assert((await api("/templates")).length === 16, "seed");
const seed = await api("/templates");
assert(seed[0].config_json.goals.sleep_hours.value === 7 && seed[3].config_json.goals.liters.value === 2, "seed goals");
const a = await api("/records", "POST", { mood_score: 3, results: [{ template_id: 1, data: { sleep_quality: 4 } }] });
const b = await api("/records", "POST", { mood_score: 5, results: [] });
assert(a.id === b.id && (await api("/records")).length === 1, "upsert today");
assert((await api("/streak")).streak === 1, "streak 1");
await api(`/records/${a.id}`, "PUT", { mood_score: 2, results: [] });
assert((await api("/records"))[0].mood_score === 2, "update");
await api("/templates/2", "PUT", { is_active: false, config_json: {} });
assert(!(await api("/templates"))[1].is_active, "template update");

const iso = (d) => d.toLocaleDateString("sv-SE");
const yesterday = iso(new Date(Date.now() - 864e5)), tomorrow = iso(new Date(Date.now() + 864e5));
const y = await api("/records", "POST", { date: yesterday, mood_score: 4, note: "  výlet ", results: [] });
assert(y.date === yesterday && y.note === "výlet" && (await api("/records")).length === 2, "backfill yesterday with note");
assert((await api(`/records/${y.id}`, "PUT", { mood_score: 4, note: "   ", results: [] })).note === undefined, "blank note dropped");
for (const date of [tomorrow, "2026-1-1"]) {
  let bad = false;
  await api("/records", "POST", { date, mood_score: 3, results: [] }).catch(() => (bad = true));
  assert(bad, `rejects date ${date}`);
}
assert((await api("/streak")).streak === 2, "streak counts backfilled day");

const backup = JSON.parse(JSON.stringify(await exportData()));
let threw = false;
await importData({ tracker_templates: "x" }).catch(() => (threw = true));
assert(threw && (await api("/records")).length === 2, "bad import rejected, data kept");
await importData(backup);
assert(JSON.stringify(await exportData()) === JSON.stringify(backup), "roundtrip");
const { demoData } = await import("./demo.js");
await importData(demoData());
assert((await api("/records")).length === 30 && (await api("/streak")).streak === 30, "demo data imports, streak 30");
console.log("api self-check OK");

// Food 1–5 ratings -> counts (old n -> n - 1), on import and on read; a second pass changes nothing.
const old = demoData();
old.tracker_records[0].results.find((x) => x.template_id === 3).result_data_json = { quality: 4, alcohol: 1, caffeine: 3, sugar: 5 };
await importData(old);
const food0 = (await api("/records"))[0].results.find((x) => x.template_id === 3).result_data_json;
assert(JSON.stringify(food0) === JSON.stringify({ quality: 4, drinks: 0, coffee: 2, sweets: 4 }), "food migrated on import");
const recs = JSON.parse(JSON.stringify(await api("/records")));
assert(!migrate(recs, await api("/templates")), "migration is idempotent");
console.log("food migration OK");

// Sport intensity 1–5 -> RPE 1–10 (×2), idempotent.
const sp = demoData();
sp.tracker_records[0].results.find((x) => x.template_id === 2).result_data_json = { sports: [{ name: "Běh", intensity: 3, minutes: 40 }] };
await importData(sp);
const run = (await api("/records"))[0].results.find((x) => x.template_id === 2).result_data_json.sports[0];
assert(run.rpe === 6 && !("intensity" in run), "intensity -> rpe");
assert(!migrate(JSON.parse(JSON.stringify(await api("/records"))), await api("/templates")), "rpe migration idempotent");

// An existing user with the 13 original templates gets the new types appended, switched off, unique ids.
const old13 = (await exportData()).tracker_templates.filter((t) => !["mind", "nap", "social"].includes(t.type));
await importData({ tracker_templates: old13, tracker_records: [] });
const now = await api("/templates");
assert(now.length === 16 && new Set(now.map((t) => t.id)).size === 16 && now.slice(13).every((t) => !t.is_active), "new types appended");
console.log("rpe migration + template append OK");

// Food v3 config upgrade: quality + calories + all vices + last meal time on, retired flags removed, once.
const oldFood = (await exportData()).tracker_templates.map((t) => (t.type === "food" ? { ...t, config_json: { calories: true, quality: false, veg: true, slump: true } } : t));
await importData({ tracker_templates: oldFood, tracker_records: [] });
const fc = (await api("/templates")).find((t) => t.type === "food").config_json;
assert(fc.quality && fc.calories && fc.alcohol && fc.caffeine && fc.sugar && fc.sugary_drinks && fc.fast_food && fc.nicotine && fc.meal_times && !("veg" in fc) && !("slump" in fc), "food v3 flags");
await api(`/templates/${(await api("/templates")).find((t) => t.type === "food").id}`, "PUT", { is_active: true, config_json: { ...fc, nicotine: false } });
assert((await api("/templates")).find((t) => t.type === "food").config_json.nicotine === false, "upgrade runs once, user choice kept");
console.log("food v3 upgrade OK");
