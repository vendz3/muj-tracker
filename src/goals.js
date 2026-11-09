// Goals per template metric (stored in config_json.goals as { [key]: { value, tolerance? } }).
// Direction is fixed per metric: "min" = at least, "max" = at most, "range" = value ± tolerance.
// Limits mirror GOAL_LIMITS in main.py. def: the value a goal starts with when switched on for the first time.
const g = (key, dir, label, unit, min, max, step, extra = {}) => ({ key, dir, label, unit, min, max, step, ...extra });

export const GOALS = {
  sleep: [
    g("sleep_hours", "min", "Čas spánku", "h", 0, 24, 0.5, { flag: "hours", def: 7 }),
  ],
  // Weekly totals over the last 7 days (period "week"): shown as progress meters, not as a line over daily bars.
  sport: [
    g("week_minutes", "min", "Pohyb", "min", 1, 10080, 10, { flag: "duration", rowKey: "_minutes", per: "týdně", period: "week", def: 150 }),
    g("week_activities", "min", "Aktivity", "", 1, 100, 1, { rowKey: "_count", per: "× týdně", period: "week", def: 3 }),
  ],
  food: [
    g("calories", "range", "Kalorie", "kcal", 0, 20000, 50, { flag: "calories", defaultTolerance: 200, def: 2200 }),
    // Counts per day; goal 0 = "ani jednou". nouns: Czech forms for 1 / 2–4 / 5+ ("2 šálky", "5 šálků").
    g("drinks", "max", "Alkohol", "", 0, 50, 1, { flag: "alcohol", per: "denně", def: 0, nouns: ["drink", "drinky", "drinků"] }),
    g("coffee", "max", "Kofein", "", 0, 50, 1, { flag: "caffeine", per: "denně", def: 2, nouns: ["šálek", "šálky", "šálků"] }),
    g("sweets", "max", "Sladkosti", "", 0, 50, 1, { flag: "sugar", per: "denně", def: 1, nouns: ["porce", "porce", "porcí"] }),
    g("sugary_drinks", "max", "Slazené nápoje", "", 0, 50, 1, { flag: "sugary_drinks", per: "denně", def: 0, nouns: ["nápoj", "nápoje", "nápojů"] }),
    g("fast_food", "max", "Fast food", "", 0, 50, 1, { flag: "fast_food", per: "denně", def: 0, nouns: ["porce", "porce", "porcí"] }),
    g("nicotine", "max", "Nikotin", "", 0, 50, 1, { flag: "nicotine", per: "denně", def: 0, nouns: ["dávka", "dávky", "dávek"] }),
  ],
  water: [g("liters", "min", "Pitný režim", "l", 0, 20, 0.25, { per: "denně", def: 2 })],
  reading: [
    g("minutes", "min", "Čtení", "min", 1, 1440, 5, { flag: "minutes", per: "denně", def: 20 }),
    g("pages", "min", "Stránky", "str.", 1, 5000, 1, { flag: "pages", per: "denně", def: 10 }),
  ],
  meditation: [g("minutes", "min", "Meditace", "min", 1, 1440, 1, { per: "denně", def: 10 })],
  screen_time: [g("minutes", "max", "Screen time", "min", 1, 1440, 5, { per: "denně", def: 120 })],
};

// Custom templates (type "custom"): one metric "value", its goal shape derived from config_json (kind, dir, better, unit).
function customGoals(t) {
  const c = t.config_json;
  const base = { key: "value", label: t.name, per: "denně" };
  if (c.kind === "bool") return [{ ...base, dir: "min", unit: "", min: 1, max: 1, step: 1, def: 1, bool: true }];
  if (c.kind === "rating") return [{ ...base, dir: c.better === "low" ? "max" : "min", unit: "", min: 1, max: 10, step: 1, def: c.better === "low" ? 3 : 7 }];
  return [{ ...base, dir: c.dir === "max" ? "max" : "min", unit: c.unit ?? "", min: 0, max: 1000000, step: 0.01, def: 1 }];
}
export const goalsOf = (t) => (t.type === "custom" ? customGoals(t) : GOALS[t.type] ?? []);

export const DIR_WORD = { min: "aspoň", max: "nejvýš", range: "" };

const num = (n) => n.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });

export function meets(v, goal, dir) {
  if (dir === "min") return v >= goal.value;
  if (dir === "max") return v <= goal.value;
  return Math.abs(v - goal.value) <= (goal.tolerance ?? 0);
}

// Unit for n: plural noun for counts ("1 šálek", "2 šálky", "5 šálků"; decimals take the 2–4 form), else meta.unit.
export function unitFor(meta, n) {
  if (!meta.nouns) return meta.unit;
  return meta.nouns[n === 1 ? 0 : !Number.isInteger(n) || (n >= 2 && n <= 4) ? 1 : 2];
}

// Goal in words: "aspoň 7 h", "nejvýš 2 šálky denně", "ani jednou", "2 000–2 400 kcal". meta: GOALS entry (dir, unit, nouns, per).
export function goalText(goal, meta) {
  const per = meta.per ? ` ${meta.per}` : "";
  if (meta.bool) return "každý den";
  if (meta.dir === "max" && goal.value === 0) return "ani jednou";
  if (meta.dir === "range") {
    const t = goal.tolerance ?? 0;
    const u = meta.unit ? ` ${meta.unit}` : "";
    return `${t ? `${num(Math.max(0, goal.value - t))}–${num(goal.value + t)}` : num(goal.value)}${u}${per}`;
  }
  const u = unitFor(meta, goal.value);
  return `${DIR_WORD[meta.dir]} ${num(goal.value)}${u ? ` ${u}` : ""}${per}`;
}

// Daily goal: how many of the filled days among the last `days` rows met it (unfilled days don't count).
// Weekly goal (period "week"): the total of the last `days` rows (rolling 7 days, same window as daily goals).
export function goalStatus(rows, rowKey, goal, dir, days = 7, period = "day") {
  if (period === "week") {
    const vals = rows.slice(-days).map((r) => r[rowKey]).filter((v) => v != null);
    const total = vals.reduce((a, b) => a + b, 0);
    return { total, of: vals.length, ok: vals.length > 0 && meets(total, goal, dir) };
  }
  const vals = rows.slice(-days).map((r) => r[rowKey]).filter((v) => v != null);
  const met = vals.filter((v) => meets(v, goal, dir)).length;
  return { met, of: vals.length, ok: vals.length > 0 && met * 2 >= vals.length };
}

// XP for one day: +1 per template with data, +1 per daily goal met (weekly goals aren't per day).
// results: [{ template_id, data }], byId: { [template id]: template }.
const hasData = (data) => Object.values(data ?? {}).some((v) => v != null && !(Array.isArray(v) && !v.length)); // sport always sends sports: []
export function dayXP(results, byId) {
  let xp = 0;
  for (const { template_id, data } of results) {
    const t = byId[template_id];
    if (!t || !hasData(data)) continue;
    xp += 1;
    for (const m of goalsOf(t)) {
      const goal = t.config_json.goals?.[m.key];
      const v = typeof data[m.key] === "boolean" ? Number(data[m.key]) : data[m.key]; // custom yes/no: yes = 1
      if (goal && m.period !== "week" && typeof v === "number" && meets(v, goal, m.dir)) xp += 1;
    }
  }
  return xp;
}

export function calculateTotalXP(records, templates) {
  const byId = Object.fromEntries(templates.map((t) => [t.id, t]));
  let xp = 0;
  for (const r of records) xp += dayXP(r.results.map((x) => ({ template_id: x.template_id, data: x.result_data_json })), byId);
  return xp;
}

// Highest y the goal needs visible, so the axis never cuts the goal line off.
export const goalTop = (goal) => goal.value + (goal.tolerance ?? 0);
