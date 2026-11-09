import { ChevronRight } from "lucide-react";
import { Ring } from "./Charts.jsx";
import { GOOD, WEEK, goalReport, lastDays, templateCharts, weekSummary } from "./chartData.js";
import { goalText, meets } from "./goals.js";
import { MOOD_LABELS, MOODS } from "./RecordEntryModal.jsx";
import { card, primary } from "./ui.js";

// Overview = the last 7 days at a glance (rolling window, same for every goal). Details live in Grafy.
const num = (n) => n.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
const local = (iso) => new Date(`${iso}T00:00`);
const dayLabel = (iso) => local(iso).toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" });
const weekday = (iso) => local(iso).toLocaleDateString("cs-CZ", { weekday: "short" });
const pct = (r) => `${Math.round(r * 100)} %`;
// "↑ +12 %" / "↓ −0,4" / "→ beze změny"; arrow and sign are text, never color alone.
const change = (d, fmt, eps) => (Math.abs(d) < eps ? "→ beze změny" : `${d > 0 ? "↑ +" : "↓ −"}${fmt(Math.abs(d))}`);

const LEVEL = {
  good: ["Daří se", "bg-accent2/15 text-accent2-text"],
  mid: ["Napůl", "bg-neutral-800 text-neutral-300"],
  bad: ["Nedaří se", "bg-red-500/10 text-red-400"],
};
function Level({ level, done }) {
  if (!level) return <span className="text-xs text-neutral-500">zatím bez dat</span>;
  const [text, cls] = done ? ["✓ Splněno", LEVEL.good[1]] : LEVEL[level];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>{text}</span>;
}

function last7Dates() {
  const now = new Date();
  return Array.from({ length: WEEK }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WEEK - 1 - i)).toLocaleDateString("sv-SE"));
}

// Mood of the last 7 days ending today; each day opens in the entry form (quick way to fill a missed day).
function MoodWeek({ dates, byDate, onEdit }) {
  return (
    <ul className="grid grid-cols-7 gap-1">
      {dates.map((date) => {
        const r = byDate[date];
        const text = r ? `nálada ${MOOD_LABELS[r.mood_score - 1].toLowerCase()}` : "nevyplněno, doplnit";
        return (
          <li key={date}>
            <button
              type="button"
              onClick={() => onEdit(r ?? { date })}
              aria-label={`${dayLabel(date)}: ${text}`}
              className="flex min-h-16 w-full flex-col items-center justify-center rounded-lg bg-neutral-800/60 py-1 transition hover:bg-neutral-800 active:scale-95"
            >
              <span className="text-[11px] text-neutral-500 capitalize" aria-hidden="true">
                {weekday(date)}
              </span>
              <span className={r ? "text-2xl" : "text-2xl text-neutral-600"} aria-hidden="true">
                {r ? MOODS[r.mood_score - 1] : "·"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Hero: goal score ring + trend, then mood average, filled days and the 7-day mood strip.
function SummaryCard({ records, report, onEdit }) {
  const dates = last7Dates();
  const byDate = Object.fromEntries(records.map((r) => [r.date, r]));
  const mood = weekSummary(
    lastDays(records).map(({ date, record }) => ({ date, mood: record?.mood_score ?? null })),
    "mood",
  );
  const filled = dates.filter((d) => byDate[d]).length;
  const { score, trend, good, total } = report;
  return (
    <section className={card}>
      <h2 className="mb-3 font-semibold text-neutral-300">Posledních {WEEK} dní</h2>
      {score != null && (
        <div className="mb-4 flex items-center gap-4">
          <div className="relative size-24 shrink-0" role="img" aria-label={`Plnění cílů ${pct(score)}`}>
            <svg viewBox="0 0 150 150" className="size-full" aria-hidden="true">
              <Ring r={66} frac={score} width={16} color={score >= GOOD ? "var(--color-accent2)" : "var(--color-accent-500)"} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-neutral-50" aria-hidden="true">
              {pct(score)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-lg leading-tight font-semibold text-neutral-100">Cíle {pct(score)}</p>
            <p className="text-sm text-neutral-300">
              {good} z {total} {total === 1 ? "cíle" : "cílů"} se daří
            </p>
            <p className="text-xs text-neutral-500">{trend == null ? `za posledních ${WEEK} dní` : `${change(trend, pct, 0.005)} vs. předchozích ${WEEK} dní`}</p>
          </div>
        </div>
      )}
      <div className={`mb-2 flex items-baseline justify-between gap-2 text-sm ${score != null ? "border-t border-line pt-3" : ""}`}>
        <span className="text-neutral-300">
          {mood ? (
            <>
              Ø nálada <span aria-hidden="true">{MOODS[Math.round(mood.value) - 1]}</span> <b className="font-semibold text-neutral-100">{num(mood.value)}</b>
              {mood.delta != null && <span className="text-xs text-neutral-500"> {change(mood.delta, num, 0.05)}</span>}
            </>
          ) : (
            "Zatím žádné záznamy"
          )}
        </span>
        <span className="text-neutral-400">
          Vyplněno <b className="font-semibold text-neutral-100">{filled}</b>/{WEEK}
        </span>
      </div>
      <MoodWeek dates={dates} byDate={byDate} onEdit={onEdit} />
    </section>
  );
}

// Daily goal: one dot per day. Filled = met, ring = missed, small dot = not filled in (shape, not only color).
function DayGoalRow({ item: { info, rows, level } }) {
  const { met, of } = info.status;
  const u = info.unit ? ` ${info.unit}` : "";
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-sm text-neutral-200">
          {info.label} <span className="text-xs whitespace-nowrap text-neutral-500">{goalText(info.goal, info.dir, info.unit)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-neutral-400">
          {of > 0 && `${met}/${of}`} <Level level={level} />
        </span>
      </div>
      <ul className="mt-1.5 flex gap-1.5">
        {rows.slice(-WEEK).map((r) => {
          const v = r[info.rowKey];
          const ok = v != null && meets(v, info.goal, info.dir);
          const text = `${dayLabel(r.date)}: ${v == null ? "nevyplněno" : `${num(v)}${u}, ${ok ? "splněno" : "nesplněno"}`}`;
          return (
            <li key={r.date} title={text} className="flex size-4 items-center justify-center">
              <span className={v == null ? "size-1 rounded-full bg-neutral-700" : ok ? "size-3.5 rounded-full bg-accent2" : "size-3.5 rounded-full ring-2 ring-neutral-600 ring-inset"} />
              <span className="sr-only">{text}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// Weekly goal (sport): progress bar with what's left.
function WeekGoalRow({ item: { info, rate, level } }) {
  const { total } = info.status;
  const target = info.goal.value;
  const u = info.unit ? ` ${info.unit}` : "";
  const done = total >= target;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-sm text-neutral-200">
          {info.label}{" "}
          <span className="text-xs whitespace-nowrap text-neutral-500">
            {goalText(info.goal, info.dir, info.unit)} {info.per}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-neutral-400">
          {`${num(total)}/${num(target)}${u}`}
          {!done && level && ` · zbývá ${num(target - total)}`} <Level level={level} done={done} />
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${info.label}: ${num(total)} z ${num(target)}${u} za ${WEEK} dní`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={total}
        className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800"
      >
        <div className="h-full rounded-full" style={{ width: `${(rate ?? 0) * 100}%`, background: done ? "var(--color-accent2)" : "var(--color-accent-500)" }} />
      </div>
    </>
  );
}

function GoalsCard({ items, onNavigate }) {
  if (!items.length)
    return (
      <div className={card}>
        <p className="text-neutral-400">Plnění cílů se ukáže tady, jakmile budeš mít nastavené cíle a k nim první záznamy.</p>
        <button type="button" onClick={() => onNavigate("goals")} className="mt-3 min-h-11 rounded-xl bg-neutral-800 px-4 text-sm font-medium text-accent-300 hover:bg-neutral-700">
          Nastavit cíle
        </button>
      </div>
    );
  return (
    <section className={card}>
      <h2 className="mb-1 font-semibold text-neutral-300">Cíle</h2>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={`${item.info.rowKey}-${item.info.key}-${item.info.label}`} className="py-3 last:pb-0">
            {item.info.period === "week" ? <WeekGoalRow item={item} /> : <DayGoalRow item={item} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Overview({ records, templates, today, onNavigate, onEdit }) {
  const report = goalReport(templateCharts(lastDays(records), templates).filter((c) => c.goals?.length));
  return (
    <div className="space-y-4">
      {!today && (
        <button type="button" onClick={() => onEdit({ date: new Date().toLocaleDateString("sv-SE") })} className={`${primary} w-full text-lg`}>
          Zapsat dnešek
        </button>
      )}
      <SummaryCard records={records} report={report} onEdit={onEdit} />
      <GoalsCard items={report.items} onNavigate={onNavigate} />
      {records.length > 1 && (
        <button
          type="button"
          onClick={() => onNavigate("charts")}
          className="mx-auto flex min-h-11 items-center gap-1 rounded-xl px-4 text-sm font-medium text-accent-300 hover:bg-neutral-800"
        >
          Podrobnosti v Grafech <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
