import { MOOD_LABELS, MOODS } from "./RecordEntryModal.jsx";
import { card } from "./ui.js";

export const fmtDate = (iso) => new Date(iso).toLocaleDateString("cs-CZ");
const fmtWeekday = (iso) => new Date(iso).toLocaleDateString("cs-CZ", { weekday: "long" });

const num = (n) => n.toLocaleString("cs-CZ");
const join = (parts) => parts.filter(Boolean).join(", ");
// Food counts 0–5+: "bez alkoholu", "káva 3×", "sladké 5+×".
const count = (n, word, none) => n != null && (n === 0 ? none : `${word} ${n >= 5 ? "5+" : n}×`);

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
          count(d.drinks, "alkohol", "bez alkoholu"),
          count(d.coffee, "káva", "bez kávy"),
          count(d.sweets, "sladké", "bez sladkého"),
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
          <span className="text-4xl" aria-label={`Nálada ${r.mood_score} z 5, ${MOOD_LABELS[r.mood_score - 1]}`}>
            {MOODS[r.mood_score - 1]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{fmtDate(r.date)}</p>
            <p className="text-sm text-neutral-500 capitalize">{fmtWeekday(r.date)}</p>
            {r.results.length > 0 && <p className="mt-1 truncate text-sm text-neutral-400">{summary(r, templatesById)}</p>}
            {r.note && <p className="mt-1 line-clamp-2 text-sm text-neutral-400 italic">{r.note}</p>}
          </div>
          <button
            type="button"
            onClick={() => onEdit(r)}
            aria-label={`Upravit záznam ${fmtDate(r.date)}`}
            className="min-h-11 shrink-0 rounded-xl bg-neutral-800 px-4 text-sm font-medium text-accent-300 transition hover:bg-neutral-700 active:scale-95"
          >
            Upravit
          </button>
        </li>
      ))}
    </ul>
  );
}
