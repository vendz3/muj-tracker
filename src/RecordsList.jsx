import { BATTERY, MOOD_LABELS, MoodIcon } from "./RecordEntryModal.jsx";
import { fmtHM } from "./chartData.js";
import { card } from "./ui.js";

export const fmtDate = (iso) => new Date(iso).toLocaleDateString("cs-CZ");
const fmtWeekday = (iso) => new Date(iso).toLocaleDateString("cs-CZ", { weekday: "long" });

const num = (n) => n.toLocaleString("cs-CZ");
const join = (parts) => parts.filter(Boolean).join(", ");
// Food counts 0–5+: "bez alkoholu", "kofein 3×", "sladkosti 5+×".
const count = (n, word, none) => n != null && (n === 0 ? none : `${word} ${n >= 5 ? "5+" : n}×`);

// One-line summary of a day's template results, e.g. "Spánek 4, 7,5 h · fotbal 4 (60 min) · 2100 kcal, alkohol 2 · 1,5 l vody".
function summary(record, templatesById) {
  return record.results
    .map(({ template_id, result_data_json: d }) => {
      const type = templatesById[template_id]?.type;
      if (type === "sleep")
        return "Spánek " + join([d.sleep_quality, d.sleep_hours != null && fmtHM(d.sleep_hours), d.bedtime && `usnutí ${d.bedtime}`, d.waketime && `vstávání ${d.waketime}`]);
      if (type === "sport")
        return d.sports.length
          ? d.sports.map((s) => `${s.name} RPE ${s.rpe}` + (s.minutes != null ? ` (${s.minutes} min)` : "")).join(", ")
          : "bez sportu";
      if (type === "food")
        return join([
          d.calories != null && `${num(d.calories)} kcal`,
          count(d.veg, "zelenina", "bez zeleniny"),
          count(d.protein, "bílkovina", "bez bílkoviny"),
          count(d.processed, "zpracované", "bez zpracovaného"),
          d.quality != null && `zdravě ${d.quality}/5`,
          count(d.drinks, "alkohol", "bez alkoholu"),
          count(d.coffee, "kofein", "bez kofeinu"),
          count(d.sweets, "sladkosti", "bez sladkostí"),
          count(d.sugary_drinks, "slazené pití", "bez slazeného pití"),
          count(d.fast_food, "fast food", "bez fast foodu"),
          count(d.nicotine, "nikotin", "bez nikotinu"),
          d.meal_gap_h != null && `jídlo ${num(d.meal_gap_h)} h před spaním`,
          d.first_meal && `první jídlo ${d.first_meal}`,
          d.last_meal && `dojedeno ${d.last_meal}`,
          d.overate && "přejedení",
          d.slump && "útlum po jídle",
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
      if (type === "mind") return join([d.clarity != null && `jasnost ${d.clarity}`, d.energy != null && `energie ${d.energy}`, d.frustration != null && `frustrace ${d.frustration}`]);
      if (type === "nap") return `nap ${d.minutes} min` + (d.grogginess != null ? `, rozespalost ${d.grogginess}` : "");
      if (type === "social") return d.kinds.join(", ") + (d.battery != null ? ` · baterie: ${BATTERY[d.battery - 1].toLowerCase()}` : "");
      return null;
    })
    .filter(Boolean)
    .join(" · ");
}

export default function RecordsList({ records, templates, onEdit }) {
  const templatesById = Object.fromEntries(templates.map((t) => [t.id, t]));
  if (records.length === 0) return <p className="text-neutral-400">Tvůj deník je zatím prázdný. Začni tlačítkem + dole.</p>;
  return (
    <ul className="space-y-2">
      {records.map((r) => (
        <li key={r.id} className={`${card} flex items-center gap-3`}>
          <span role="img" className="shrink-0" aria-label={`Nálada ${r.mood_score} z 5, ${MOOD_LABELS[r.mood_score - 1]}`}>
            <MoodIcon score={r.mood_score} size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{fmtDate(r.date)}</p>
            <p className="text-xs text-neutral-500 capitalize">{fmtWeekday(r.date)}</p>
            {r.results.length > 0 && <p className="mt-1 truncate text-sm text-neutral-400">{summary(r, templatesById)}</p>}
            {r.note && <p className="mt-1 line-clamp-2 text-sm text-neutral-400 italic">{r.note}</p>}
          </div>
          <button
            type="button"
            onClick={() => onEdit(r)}
            aria-label={`Upravit záznam ${fmtDate(r.date)}`}
            className="min-h-11 shrink-0 rounded-xl border border-line px-3 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-50"
          >
            Upravit
          </button>
        </li>
      ))}
    </ul>
  );
}
