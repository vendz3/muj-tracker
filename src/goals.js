// Goals per template metric (stored in config_json.goals as { [key]: { value, tolerance? } }).
// Direction is fixed per metric: "min" = at least, "max" = at most, "range" = value ± tolerance.
// Limits mirror GOAL_LIMITS in main.py.
const g = (key, dir, label, unit, min, max, step, extra = {}) => ({ key, dir, label, unit, min, max, step, ...extra });

export const GOALS = {
  sleep: [
    g("sleep_hours", "min", "Čas spánku", "h", 0, 24, 0.5, { flag: "hours" }),
  ],
  // Weekly totals over the last 7 days (period "week"): shown as progress meters, not as a line over daily bars.
  sport: [
    g("week_minutes", "min", "Pohyb", "min", 1, 10080, 10, { flag: "duration", rowKey: "_minutes", per: "týdně", period: "week" }),
    g("week_activities", "min", "Aktivity", "", 1, 100, 1, { rowKey: "_count", per: "× týdně", period: "week" }),
  ],
  food: [
    g("calories", "range", "Kalorie", "kcal", 0, 20000, 50, { flag: "calories", defaultTolerance: 200 }),
  ],
  water: [g("liters", "min", "Pitný režim", "l", 0, 20, 0.25, { per: "denně" })],
  reading: [
    g("minutes", "min", "Čtení", "min", 1, 1440, 5, { flag: "minutes", per: "denně" }),
    g("pages", "min", "Stránky", "str.", 1, 5000, 1, { flag: "pages", per: "denně" }),
  ],
  meditation: [g("minutes", "min", "Meditace", "min", 1, 1440, 1, { per: "denně" })],
};

export const DIR_WORD = { min: "aspoň", max: "nejvýš", range: "" };

const num = (n) => n.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });

export function meets(v, goal, dir) {
  if (dir === "min") return v >= goal.value;
  if (dir === "max") return v <= goal.value;
  return Math.abs(v - goal.value) <= (goal.tolerance ?? 0);
}

// "≥ 7 h", "≤ 2", "2 200 ± 200 kcal"
export function goalText(goal, dir, unit) {
  const u = unit ? ` ${unit}` : "";
  if (dir === "range") return `${num(goal.value)} ± ${num(goal.tolerance ?? 0)}${u}`;
  return `${dir === "min" ? "≥" : "≤"} ${num(goal.value)}${u}`;
}

// ISO date (YYYY-MM-DD) of the Monday of the week containing `iso`, in local time.
function mondayOf(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toLocaleDateString("sv-SE");
}

// Daily goal: how many of the filled days among the last `days` rows met it (unfilled days don't count).
// Weekly goal (period "week"): the total of the calendar week (Mon–Sun) of the last row, so it restarts every Monday.
export function goalStatus(rows, rowKey, goal, dir, days = 7, period = "day") {
  if (period === "week") {
    const vals = rows.filter((r) => r.date >= mondayOf(rows.at(-1)?.date)).map((r) => r[rowKey]).filter((v) => v != null);
    const total = vals.reduce((a, b) => a + b, 0);
    return { total, of: vals.length, ok: vals.length > 0 && meets(total, goal, dir) };
  }
  const vals = rows.slice(-days).map((r) => r[rowKey]).filter((v) => v != null);
  const met = vals.filter((v) => meets(v, goal, dir)).length;
  return { met, of: vals.length, ok: vals.length > 0 && met * 2 >= vals.length };
}

// Highest y the goal needs visible, so the axis never cuts the goal line off.
export const goalTop = (goal) => goal.value + (goal.tolerance ?? 0);
