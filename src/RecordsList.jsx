import { MOODS } from "./RecordEntryModal.jsx";
import { card } from "./ui.js";

export const fmtDate = (iso) => new Date(iso).toLocaleDateString("cs-CZ");
const fmtWeekday = (iso) => new Date(iso).toLocaleDateString("cs-CZ", { weekday: "long" });

const num = (n) => n.toLocaleString("cs-CZ");
const join = (parts) => parts.filter(Boolean).join(", ");

// One-line summary of a day's template results, e.g. "Spánek 4, 7,5 h · fotbal 4 (60 min) · 2100 kcal, alkohol 2 · 1,5 l vody".
function summary(record, templatesById) {
  return record.results
    .map(({ template_id, result_data_json: d }) => {
      const type = templatesById[template_id]?.type;
      if (type === "sleep") return "Spánek " + join([d.sleep_quality, d.sleep_hours != null && `${num(d.sleep_hours)} h`]);
      if (type === "sport")
        return d.sports.length
          ? d.sports.map((s) => `${s.name} ${s.intensity}` + (s.minutes != null ? ` (${s.minutes} min)` : "")).join(", ")
          : "bez sportu";
      if (type === "food")
        return join([
          d.calories != null && `${num(d.calories)} kcal`,
          d.quality != null && `kvalita jídla ${d.quality}`,
          d.alcohol != null && `alkohol ${d.alcohol}`,
          d.caffeine != null && `kofein ${d.caffeine}`,
          d.sugar != null && `cukr ${d.sugar}`,
        ]);
      if (type === "water") return `${num(d.liters)} l vody`;
      if (type === "emotions") return d.emotions.join(", ");
      if (type === "steps") return `${num(d.steps)} kroků`;
      if (type === "fasting") return join([d.fasted != null && (d.fasted ? "půst" : "bez půstu"), d.hours != null && `${num(d.hours)} h půstu`]);
      if (type === "medication") return d.taken.join(", ");
      if (type === "screen_time") return `${num(d.minutes)} min u obrazovky`;
      if (type === "reading") return "čtení " + join([d.minutes != null && `${d.minutes} min`, d.pages != null && `${d.pages} str.`]);
      if (type === "gratitude") return `vděčnost: ${d.items.join(", ")}`;
      if (type === "meditation") return `meditace ${d.minutes} min`;
      if (type === "stress") return `stres ${d.stress}`;
      return null;
    })
    .filter(Boolean)
    .join(" · ");
}

export default function RecordsList({ records, templates, onEdit }) {
  const templatesById = Object.fromEntries(templates.map((t) => [t.id, t]));
  if (records.length === 0) return <p className="text-neutral-400">Zatím žádné záznamy. Začni tlačítkem + dole.</p>;
  return (
    <ul className="space-y-3">
      {records.map((r) => (
        <li key={r.id} className={`${card} flex items-center gap-4`}>
          <span className="text-4xl" aria-label={`Nálada ${r.mood_score} z 5`}>
            {MOODS[r.mood_score - 1]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{fmtDate(r.date)}</p>
            <p className="text-sm text-neutral-500 capitalize">{fmtWeekday(r.date)}</p>
            {r.results.length > 0 && <p className="mt-1 truncate text-sm text-neutral-400">{summary(r, templatesById)}</p>}
          </div>
          <button
            type="button"
            onClick={() => onEdit(r)}
            aria-label={`Upravit záznam ${fmtDate(r.date)}`}
            className="min-h-11 shrink-0 rounded-xl bg-neutral-800 px-4 text-sm font-medium text-violet-300 transition hover:bg-neutral-700 active:scale-95"
          >
            Upravit
          </button>
        </li>
      ))}
    </ul>
  );
}
