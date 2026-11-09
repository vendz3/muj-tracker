// Local-first: all data lives in this browser's localStorage. Same api(path, method, body) contract
// as the old FastAPI backend (main.py), so the components didn't change.
const T = "tracker_templates";
const R = "tracker_records";

// Mirrors DEFAULT_TEMPLATES in main.py, with the config defaults the backend used to fill in.
const SEED = [
  ["sleep", "Spánek", { quality: true, hours: false }, true],
  ["sport", "Sport", { sports: [], duration: false }, true],
  ["food", "Jídlo", { calories: true, quality: true, alcohol: false, caffeine: false, sugar: false }, true],
  ["water", "Pitný režim", {}, true],
  ["emotions", "Emoce", { emotions: ["radost", "smutek", "strach", "hněv", "překvapení", "znechucení"] }, true],
  ["steps", "Kroky", {}, false],
  ["fasting", "Půst", { full_day: true, hours: 16 }, false],
  ["medication", "Suplementy a léky", { items: [] }, false],
  ["screen_time", "Screen time", {}, false],
  ["reading", "Čtení", { minutes: true, pages: false }, false],
  ["gratitude", "Deník vděčnosti", {}, false],
  ["meditation", "Meditace", {}, false],
  ["stress", "Stres", {}, false],
].map(([type, name, config_json, is_active], i) => ({ id: i + 1, name, type, config_json, is_active }));

const load = (key) => JSON.parse(localStorage.getItem(key) ?? "null");
const store = (key, v) => localStorage.setItem(key, JSON.stringify(v));
const isoDay = (d) => d.toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time, like App.jsx

function templates() {
  let t = load(T);
  if (!t?.length) store(T, (t = SEED));
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
    updated_at: now,
    results: (body.results ?? []).map((r) => ({ template_id: r.template_id, result_data_json: r.data })),
  });
  store(R, records);
  return record;
}

export async function api(path, method = "GET", body) {
  const [, res, id] = path.split("/");
  const records = load(R) ?? [];
  if (res === "templates") {
    const list = templates();
    if (method === "GET") return list;
    const t = list.find((x) => x.id === Number(id));
    if (!t) throw new Error("Šablona nenalezena");
    Object.assign(t, { is_active: body.is_active, config_json: body.config_json });
    store(T, list);
    return t;
  }
  if (res === "records") {
    if (method === "GET") return [...records].sort((a, b) => b.date.localeCompare(a.date));
    if (method === "POST") {
      // One record per day: a second save today overwrites it.
      const date = isoDay(new Date());
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

export const exportData = async () => ({ tracker_templates: templates(), tracker_records: load(R) ?? [] });

// Trust boundary: a bad file must not overwrite the data.
export async function importData(data) {
  const t = data?.tracker_templates;
  const r = data?.tracker_records;
  if (!Array.isArray(t) || !t.length || !t.every((x) => Number.isInteger(x?.id) && typeof x.type === "string" && x.config_json))
    throw new Error("soubor neobsahuje platné šablony");
  if (!Array.isArray(r) || !r.every((x) => Number.isInteger(x?.id) && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && Array.isArray(x.results)))
    throw new Error("soubor neobsahuje platné záznamy");
  store(T, t);
  store(R, r);
}
