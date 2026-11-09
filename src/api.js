// Local-first: all data lives in this browser's localStorage. Same api(path, method, body) contract
// as the old FastAPI backend (main.py), so the components didn't change.
const T = "tracker_templates";
const R = "tracker_records";

// Social contact types, ordered by depth / group size (charts keep this order). "nikdo" is exclusive.
export const SOCIAL_KINDS = ["nikdo", "krátce", "online", "1:1", "malá skupina", "velká skupina"];

// Default templates for a new user; a few starter goals so the Overview isn't empty on day one.
// Types added later are appended to existing users' lists too (templates()), switched off.
const SEED = [
  ["sleep", "Spánek", { quality: true, hours: true, times: false, goals: { sleep_hours: { value: 7 } } }, true],
  ["sport", "Sport", { sports: [], duration: false, goals: { week_activities: { value: 3 } } }, true],
  ["food", "Jídlo", { quality: true, calories: true, alcohol: false, caffeine: false, sugar: false, sugary_drinks: false, fast_food: false, nicotine: false, meal_times: false }, true],
  ["water", "Pitný režim", { goals: { liters: { value: 2 } } }, true],
  ["emotions", "Emoce", { emotions: ["radost", "smutek", "strach", "hněv", "překvapení", "znechucení"] }, true],
  ["steps", "Kroky", {}, false],
  ["fasting", "Půst", { full_day: true, hours: 16 }, false],
  ["medication", "Suplementy a léky", { items: [] }, false],
  ["screen_time", "Screen time", {}, false],
  ["reading", "Čtení", { minutes: true, pages: false }, false],
  ["gratitude", "Deník vděčnosti", {}, false],
  ["meditation", "Meditace", {}, false],
  ["stress", "Stres", {}, false],
  ["mind", "Hlava", { clarity: true, energy: true, frustration: true }, false],
  ["nap", "Power nap", { grogginess: true }, false],
  ["social", "Sociální kontakt", { kinds: SOCIAL_KINDS, battery: true }, false],
].map(([type, name, config_json, is_active], i) => ({ id: i + 1, name, type, config_json, is_active }));

const load = (key) => JSON.parse(localStorage.getItem(key) ?? "null");
const store = (key, v) => localStorage.setItem(key, JSON.stringify(v));
const isoDay = (d) => d.toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time, like App.jsx

// Old data formats -> current, in place. Keyed on which keys exist, so running it twice changes nothing.
// - Food used to rate alcohol / caffeine / sugar 1–5 (no zero); now counts 0–5+. Old 1 meant "none": n -> n - 1.
// - Sport intensity 1–5 became RPE 1–10 (Borg CR10): n -> 2n.
const FOOD_COUNTS = [["alcohol", "drinks"], ["caffeine", "coffee"], ["sugar", "sweets"]];
export function migrate(records, templates) {
  const typeOf = Object.fromEntries(templates.map((t) => [t.id, t.type]));
  let changed = false;
  for (const r of records)
    for (const res of r.results ?? []) {
      const d = res.result_data_json;
      if (!d) continue;
      if (typeOf[res.template_id] === "food")
        for (const [old, key] of FOOD_COUNTS)
          if (typeof d[old] === "number") {
            if (d[key] == null) d[key] = Math.max(0, d[old] - 1);
            delete d[old];
            changed = true;
          }
      if (typeOf[res.template_id] === "sport")
        for (const s of d.sports ?? [])
          if (typeof s.intensity === "number") {
            if (s.rpe == null) s.rpe = Math.min(10, s.intensity * 2);
            delete s.intensity;
            changed = true;
          }
    }
  return changed;
}

function templates() {
  let t = load(T);
  if (!t?.length) store(T, (t = SEED));
  // Food v3: quality 1–5 + calories, the vices (alcohol, caffeine, sweets, sugary drinks, fast food, nicotine) and the
  // last meal time. Portions / first meal / after-meal flags are retired; their saved data stays and still shows.
  // Once per list (keyed on the missing "nicotine" flag).
  const food = t.find((x) => x.type === "food" && !("nicotine" in x.config_json));
  if (food) {
    const c = food.config_json;
    for (const k of ["veg", "protein", "processed", "overate", "slump", "last_meal"]) delete c[k];
    Object.assign(c, { quality: true, alcohol: true, caffeine: true, sugar: true, sugary_drinks: true, fast_food: true, nicotine: true, meal_times: true });
    store(T, t);
  }
  // New template types reach existing users switched off, so they show up in Nastavení -> Šablony.
  const missing = SEED.filter((s) => !t.some((x) => x.type === s.type));
  if (missing.length) {
    let id = Math.max(0, ...t.map((x) => x.id));
    store(T, (t = [...t, ...missing.map((s) => ({ ...s, id: ++id, is_active: false }))]));
  }
  return t;
}

/** Days in a row with a record, ending today, or yesterday if today isn't filled yet (the streak still holds). */
export function streak(dates, today = new Date()) {
  const set = new Set(dates);
  const day = new Date(today);
  if (!set.has(isoDay(day))) day.setDate(day.getDate() - 1);
  let n = 0;
  while (set.has(isoDay(day))) {
    n++;
    day.setDate(day.getDate() - 1);
  }
  return n;
}

function saveRecord(records, record, body) {
  const known = new Set(templates().map((t) => t.id));
  for (const r of body.results ?? []) if (!known.has(r.template_id)) throw new Error(`Šablona ${r.template_id} neexistuje`);
  const now = new Date().toISOString();
  Object.assign(record, {
    mood_score: body.mood_score,
    note: body.note?.trim() || undefined, // empty note isn't stored
    updated_at: now,
    results: (body.results ?? []).map((r) => ({ template_id: r.template_id, result_data_json: r.data })),
  });
  store(R, records);
  return record;
}

export async function api(path, method = "GET", body) {
  const [, res, id] = path.split("/");
  const records = load(R) ?? [];
  if (migrate(records, templates())) store(R, records);
  if (res === "templates") {
    const list = templates();
    if (method === "GET") return list;
    if (method === "POST") {
      // Custom template. Numeric id (max + 1): import and PUT /templates/:id rely on integer ids.
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const c = body?.config_json;
      if (!name || name.length > 40) throw new Error("Název musí mít 1–40 znaků");
      if (!c || !CUSTOM_KINDS.includes(c.kind) || typeof c.icon !== "string") throw new Error("Neplatný typ šablony");
      const t = { id: Math.max(0, ...list.map((x) => x.id)) + 1, name, type: "custom", config_json: c, is_active: true };
      store(T, [...list, t]);
      return t;
    }
    const t = list.find((x) => x.id === Number(id));
    if (!t) throw new Error("Šablona nenalezena");
    Object.assign(t, { is_active: body.is_active, config_json: body.config_json });
    store(T, list);
    return t;
  }
  if (res === "records") {
    if (method === "GET") return [...records].sort((a, b) => b.date.localeCompare(a.date));
    if (method === "POST") {
      // One record per day: a second save of the same day overwrites it. Past days can be backfilled, future ones not.
      const date = body.date ?? isoDay(new Date());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > isoDay(new Date())) throw new Error("Neplatné datum");
      let record = records.find((r) => r.date === date);
      if (!record) {
        record = { id: Math.max(0, ...records.map((r) => r.id)) + 1, date, created_at: new Date().toISOString() };
        records.push(record);
      }
      return saveRecord(records, record, body);
    }
    const record = records.find((r) => r.id === Number(id));
    if (!record) throw new Error("Záznam nenalezen");
    return saveRecord(records, record, body);
  }
  if (res === "streak") return { streak: streak(records.map((r) => r.date)) };
  throw new Error(`Neznámá cesta: ${method} ${path}`);
}

export const CUSTOM_KINDS = ["bool", "number", "rating"]; // custom templates: yes/no, a number, a 1–10 scale
export const addTemplate = (data) => api("/templates", "POST", data);

export const exportData = async () => ({ tracker_templates: templates(), tracker_records: load(R) ?? [] });

// Trust boundary: a bad file must not overwrite the data.
export async function importData(data) {
  const t = data?.tracker_templates;
  const r = data?.tracker_records;
  if (!Array.isArray(t) || !t.length || !t.every((x) => Number.isInteger(x?.id) && typeof x.type === "string" && x.config_json))
    throw new Error("soubor neobsahuje platné šablony");
  if (!Array.isArray(r) || !r.every((x) => Number.isInteger(x?.id) && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && Array.isArray(x.results)))
    throw new Error("soubor neobsahuje platné záznamy");
  migrate(r, t);
  store(T, t);
  store(R, r);
}
