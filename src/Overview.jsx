import { WeekGoal } from "./Charts.jsx";
import { WEEK, lastDays, templateCharts } from "./chartData.js";
import { goalText, meets } from "./goals.js";
import { card } from "./ui.js";

const num = (n) => n.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
const dayLabel = (iso) => new Date(iso).toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" });
const weekday = (iso) => new Date(iso).toLocaleDateString("cs-CZ", { weekday: "short" });

// Daily goal: one cell per day of the last WEEK days. ✓ met, ✗ missed, · not filled in (symbol + words, never color alone).
function DayGoal({ info, rows }) {
  const { met, of } = info.status;
  const u = info.unit ? ` ${info.unit}` : "";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-neutral-300">
          {info.label} <span className="text-neutral-500">cíl {goalText(info.goal, info.dir, info.unit)}</span>
        </span>
        <span className="text-neutral-400">{of ? `${met}/${of} dní` : "zatím bez dat"}</span>
      </div>
      <ul className="mt-1 grid grid-cols-7 gap-1">
        {rows.slice(-WEEK).map((r) => {
          const v = r[info.rowKey];
          const ok = v != null && meets(v, info.goal, info.dir);
          const text = v == null ? "nevyplněno" : `${num(v)}${u} · ${ok ? "splněno" : "nesplněno"}`;
          return (
            <li key={r.date} title={`${dayLabel(r.date)} · ${text}`} className="flex flex-col items-center rounded-lg bg-neutral-800/60 py-1">
              <span className="text-[11px] text-neutral-500 capitalize">{weekday(r.date)}</span>
              <span className={`font-semibold ${v == null ? "text-neutral-600" : ok ? "text-accent2-text" : "text-neutral-400"}`} aria-hidden="true">
                {v == null ? "·" : ok ? "✓" : "✗"}
              </span>
              <span className="sr-only">{`${dayLabel(r.date)}: ${text}`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Overview({ records, templates, onNavigate }) {
  const cards = templateCharts(lastDays(records), templates).filter((c) => c.goals?.length);
  if (!cards.length)
    return (
      <div className={card}>
        <p className="text-neutral-400">Zatím nemáš nastavené cíle (nebo k nim chybí záznamy).</p>
        <button type="button" onClick={() => onNavigate("goals")} className="mt-3 min-h-11 rounded-xl bg-neutral-800 px-4 text-sm font-medium text-violet-300 hover:bg-neutral-700">
          Nastavit cíle
        </button>
      </div>
    );
  return (
    <div className="space-y-4">
      {cards.map(({ template, rows, goals }) => (
        <section key={template.id} className={card}>
          <h2 className="mb-2 font-semibold text-neutral-300">{template.name}</h2>
          <div className="space-y-3">
            {goals.map((info) => (info.period === "week" ? <WeekGoal key={info.key} info={info} /> : <DayGoal key={info.key} info={info} rows={rows} />))}
          </div>
        </section>
      ))}
      <p className="px-1 text-xs text-neutral-600">Posledních {WEEK} dní. Týdenní cíle se počítají od pondělí.</p>
    </div>
  );
}
