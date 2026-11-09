// Self-check: node src/api.test.js
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)) };
const { api, streak, exportData, importData } = await import("./api.js");
const assert = (c, m) => { if (!c) throw new Error(m); };

const today = new Date(2026, 10, 9);
assert(streak([], today) === 0, "empty");
assert(streak(["2026-11-09", "2026-11-08", "2026-11-06"], today) === 2, "ends today");
assert(streak(["2026-11-08", "2026-11-07"], today) === 2, "yesterday still holds");
assert(streak(["2026-11-07"], today) === 0, "broken");

assert((await api("/templates")).length === 13, "seed");
const a = await api("/records", "POST", { mood_score: 3, results: [{ template_id: 1, data: { sleep_quality: 4 } }] });
const b = await api("/records", "POST", { mood_score: 5, results: [] });
assert(a.id === b.id && (await api("/records")).length === 1, "upsert today");
assert((await api("/streak")).streak === 1, "streak 1");
await api(`/records/${a.id}`, "PUT", { mood_score: 2, results: [] });
assert((await api("/records"))[0].mood_score === 2, "update");
await api("/templates/2", "PUT", { is_active: false, config_json: {} });
assert(!(await api("/templates"))[1].is_active, "template update");

const backup = JSON.parse(JSON.stringify(await exportData()));
let threw = false;
await importData({ tracker_templates: "x" }).catch(() => (threw = true));
assert(threw && (await api("/records")).length === 1, "bad import rejected, data kept");
await importData(backup);
assert(JSON.stringify(await exportData()) === JSON.stringify(backup), "roundtrip");
const { demoData } = await import("./demo.js");
await importData(demoData());
assert((await api("/records")).length === 30 && (await api("/streak")).streak === 30, "demo data imports, streak 30");
console.log("api self-check OK");
