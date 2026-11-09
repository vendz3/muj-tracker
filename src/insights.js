// "Tvé vzorce": how one habit lines up with mood. Days split into yes / no for each rule, mood averaged per group.
// Only shown with >= MIN_N days in both groups and a gap >= MIN_DIFF, so small samples don't read as findings.
// It's a correlation, never claimed as cause (the UI says so).
export const MIN_N = 5;
const MIN_DIFF = 0.3;
const WINDOW = 90; // days back
const MAX = 4;

// when: sentence start; a "kdy" clause carries its comma ("Ve dnech, kdy sportuješ, máš…").
// test(data) -> true | false | null (null = not tracked that day, left out of both groups).
// absentNo: a recorded day without this template's result counts as "no" (nobody logs 0 minutes of reading).
// lag: 1 = the habit's day vs the mood of the next day (alcohol hits the morning after).
const RULES = [
  { id: "sleep7", type: "sleep", when: "Ve dnech, kdy spíš aspoň 7 h,", test: (d) => (d.sleep_hours == null ? null : d.sleep_hours >= 7) },
  { id: "sport", type: "sport", when: "Ve dnech, kdy sportuješ,", test: (d) => (d.sports?.length ?? 0) > 0 },
  { id: "alcohol", type: "food", when: "Den po alkoholu", lag: 1, test: (d) => (d.drinks == null ? null : d.drinks > 0) },
  { id: "coffee3", type: "food", when: "Ve dnech se 3 a více kávami", test: (d) => (d.coffee == null ? null : d.coffee >= 3) },
  { id: "sweets", type: "food", when: "Ve dnech se sladkostmi", test: (d) => (d.sweets == null ? null : d.sweets > 0) },
  { id: "fastfood", type: "food", when: "Ve dnech s fast foodem", test: (d) => (d.fast_food == null ? null : d.fast_food > 0) },
  { id: "water2", type: "water", when: "Ve dnech, kdy vypiješ aspoň 2 l,", test: (d) => (d.liters == null ? null : d.liters >= 2) },
  { id: "steps8k", type: "steps", when: "Ve dnech s 8 000+ kroky", test: (d) => (d.steps == null ? null : d.steps >= 8000) },
  { id: "screen3h", type: "screen_time", when: "Ve dnech se 3+ h u obrazovky", test: (d) => (d.minutes == null ? null : d.minutes >= 180) },
  { id: "reading", type: "reading", when: "Ve dnech, kdy čteš,", absentNo: true, test: (d) => (d.minutes ?? 0) > 0 || (d.pages ?? 0) > 0 },
  { id: "meditation", type: "meditation", when: "Ve dnech, kdy medituješ,", absentNo: true, test: (d) => (d.minutes ?? 0) > 0 },
  { id: "stress", type: "stress", when: "Ve dnech s vysokým stresem", test: (d) => (d.stress == null ? null : d.stress >= 4) },
  { id: "social", type: "social", when: "Ve dnech, kdy jsi s lidmi,", test: (d) => (d.kinds?.length ? d.kinds.some((k) => k !== "nikdo") : null) },
];

const iso = (d) => d.toLocaleDateString("sv-SE");
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const one = (n) => n.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nextDay = (date) => {
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() + 1);
  return iso(d);
};

export function insights(records, templates, today = new Date()) {
  const start = new Date(today);
  start.setDate(start.getDate() - (WINDOW - 1));
  const recent = records.filter((r) => r.date >= iso(start) && r.date <= iso(today));
  const moodOn = Object.fromEntries(recent.map((r) => [r.date, r.mood_score]));
  const out = [];
  for (const rule of RULES) {
    const ids = new Set(templates.filter((t) => t.type === rule.type && t.is_active).map((t) => t.id));
    if (!ids.size) continue;
    const groups = { yes: [], no: [] };
    for (const r of recent) {
      const d = r.results.find((x) => ids.has(x.template_id))?.result_data_json;
      const hit = d ? rule.test(d) : rule.absentNo ? false : null;
      const mood = rule.lag ? moodOn[nextDay(r.date)] : r.mood_score;
      if (hit == null || mood == null) continue;
      groups[hit ? "yes" : "no"].push(mood);
    }
    const [nYes, nNo] = [groups.yes.length, groups.no.length];
    if (nYes < MIN_N || nNo < MIN_N) continue;
    const diff = avg(groups.yes) - avg(groups.no);
    if (Math.abs(diff) < MIN_DIFF) continue;
    const text = `${rule.when} máš náladu v průměru o ${one(Math.abs(diff))} ${diff > 0 ? "vyšší" : "nižší"} (${nYes} vs. ${nNo} dní).`;
    out.push({ id: rule.id, text, diff, nYes, nNo });
  }
  return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, MAX);
}
