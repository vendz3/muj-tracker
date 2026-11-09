// Demo data: 30 days ending `today`, in the export format of api.js (exportData/importData).
const SPORTS = ["Běh", "Posilovna", "Kolo", "Florbal"];
const EMOTIONS = ["radost", "smutek", "strach", "hněv", "překvapení", "znechucení"];
const MEDS = ["Vitamín D", "Magnesium", "Omega-3"];
const GRATITUDE = ["Dobrá káva", "Procházka venku", "Telefonát s rodinou", "Hotová práce", "Hezké počasí", "Dobrá kniha", "Trénink s partou", "Klidný večer"];

const TEMPLATES = [
  ["sleep", "Spánek", { quality: true, hours: true, goals: { sleep_hours: { value: 7.5 } } }],
  ["sport", "Sport", { sports: SPORTS, duration: true, goals: { week_minutes: { value: 150 }, week_activities: { value: 3 } } }],
  ["food", "Jídlo", { calories: true, quality: true, alcohol: true, caffeine: true, sugar: true, goals: { calories: { value: 2300, tolerance: 200 }, drinks: { value: 0 } } }],
  ["water", "Pitný režim", { goals: { liters: { value: 2 } } }],
  ["emotions", "Emoce", { emotions: EMOTIONS }],
  ["steps", "Kroky", {}],
  ["fasting", "Půst", { full_day: false, hours: 16 }],
  ["medication", "Suplementy a léky", { items: MEDS }],
  ["screen_time", "Screen time", {}],
  ["reading", "Čtení", { minutes: true, pages: true, goals: { minutes: { value: 20 } } }],
  ["gratitude", "Deník vděčnosti", {}],
  ["meditation", "Meditace", { goals: { minutes: { value: 10 } } }],
  ["stress", "Stres", {}],
];

export function demoData(today = new Date()) {
  let seed = 42; // fixed seed: the same pattern every time, only the dates move
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
  const res = (template_id, result_data_json) => ({ template_id, result_data_json });

  const records = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i, 20);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    // A hidden "good day" factor drives correlated values so the charts show patterns.
    const g = rnd() * 2 - 1 + (weekend ? 0.3 : 0) + (i < 10 ? 0.2 : 0);
    const sleepH = Math.round((7 + g * 1.1 + (rnd() - 0.5)) * 2) / 2;
    const didSport = rnd() < 0.45 + g * 0.2;
    const mood = clamp(3 + g * 1.4 + (sleepH - 7) * 0.3 + (didSport ? 0.4 : 0) + (rnd() - 0.5) * 0.6, 1, 5);
    const results = [
      res(1, { sleep_quality: clamp(3 + g * 1.5 + (rnd() - 0.5), 1, 5), sleep_hours: sleepH }),
      res(2, { sports: didSport ? [{ name: pick(SPORTS), intensity: clamp(3 + rnd() * 2, 1, 5), minutes: clamp(30 + rnd() * 60, 1, 1440) }] : [] }),
      res(3, { calories: clamp(2300 + (rnd() - 0.5) * 800 - g * 150, 0, 20000), quality: clamp(3 + g + (rnd() - 0.5), 1, 5), drinks: weekend ? clamp(rnd() * 3.5, 0, 5) : rnd() < 0.15 ? 1 : 0, coffee: clamp(1 + rnd() * 2.5 - g * 0.5, 0, 5), sweets: clamp(rnd() * 2.5 - g * 0.5, 0, 5) }),
      res(4, { liters: Math.round((1.8 + g * 0.4 + rnd() * 0.6) * 10) / 10 }),
      res(5, { emotions: mood >= 4 ? ["radost", ...(rnd() < 0.3 ? ["překvapení"] : [])] : mood <= 2 ? [pick(["smutek", "hněv", "strach"])] : [pick(["radost", "překvapení", "smutek"])] }),
      res(6, { steps: clamp(7000 + g * 2500 + (didSport ? 3000 : 0) + (rnd() - 0.5) * 3000, 0, 200000) }),
      res(9, { minutes: clamp(180 - g * 60 + (rnd() - 0.5) * 60, 0, 1440) }),
      res(13, { stress: clamp(3 - g * 1.5 + (rnd() - 0.5), 1, 5) }),
    ];
    if (rnd() < 0.4) results.push(res(7, { fasted: true, hours: 16 }));
    results.push(res(8, { taken: rnd() < 0.8 ? MEDS.slice(0, 2) : MEDS }));
    if (rnd() < 0.6) results.push(res(10, { minutes: clamp(15 + rnd() * 30, 1, 1440), pages: clamp(10 + rnd() * 30, 1, 5000) }));
    if (rnd() < 0.5) results.push(res(11, { items: [...new Set([pick(GRATITUDE), pick(GRATITUDE)])] }));
    if (rnd() < 0.5 + g * 0.2) results.push(res(12, { minutes: clamp(8 + rnd() * 12, 1, 1440) }));
    const ts = d.toISOString();
    records.push({ id: 30 - i, date: d.toLocaleDateString("sv-SE"), mood_score: mood, created_at: ts, updated_at: ts, results });
  }

  return {
    tracker_templates: TEMPLATES.map(([type, name, config_json], i) => ({ id: i + 1, name, type, config_json, is_active: true })),
    tracker_records: records.reverse(),
  };
}
