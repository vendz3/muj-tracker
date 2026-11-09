import { Check, ChevronRight, Minus, X } from "lucide-react";
import { Ring } from "./Charts.jsx";
import { GOOD, WEEK, goalReport, lastDays, templateCharts, weekSummary } from "./chartData.js";
import { goalText, meets } from "./goals.js";
import { MIN_N, insights } from "./insights.js";
import { MOOD_LABELS, MOODS } from "./RecordEntryModal.jsx";
import { card, cardDesc, cardTitle, primary, secondary } from "./ui.js";

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
  if (level === "good" && !done) return null; // green dots already say it; pills only where attention is needed
  const [text, cls] = done ? ["✓ Splněno", LEVEL.good[1]] : LEVEL[level];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider whitespace-nowrap uppercase ${cls}`}>{text}</span>;
}

const caption = "text-xs font-medium uppercase tracking-wider text-neutral-500";

// Hero "Dnešek": the day's mood and today's goals as badges, or one clear call to write the day.
function TodayCard({ today, items, onEdit }) {
  const iso = new Date().toLocaleDateString("sv-SE");
  const date = local(iso).toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" });
  if (!today)
    return (
      <section className={`${card} p-4`}>
        <h2 className={cardTitle}>
          Dnešek <span className="font-normal text-neutral-500">· {date}</span>
        </h2>
        <p className="text-sm text-neutral-400">Ještě nemáš zapsáno. Pár ťuknutí a máš hotovo.</p>
        <button type="button" onClick={() => onEdit({ date: iso })} className={`${primary} mt-3 w-full text-base`}>
          Zapsat dnešek
        </button>
      </section>
    );
  // Daily goals: today's value vs the goal (unfilled = dash); weekly goals: progress so far.
  const badges = items.map(({ info, rows }) => {
    if (info.period === "week") {
      const done = info.status.total >= info.goal.value;
      return { key: info.label, ok: done ? true : null, text: `${info.label} ${num(info.status.total)}/${num(info.goal.value)}` };
    }
    const v = rows.find((r) => r.date === iso)?.[info.rowKey];
    return { key: info.label, ok: v == null ? null : meets(v, info.goal, info.dir), text: info.label };
  });
  const Icon = { true: Check, false: X, null: Minus };
  const tone = { true: "text-accent2-text", false: "text-red-400", null: "text-neutral-500" };
  return (
    <section className={`${card} p-4`}>
      <div className="flex items-center gap-4">
        <span className="text-5xl leading-none" aria-hidden="true">
          {MOODS[today.mood_score - 1]}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={cardTitle}>
            Dnešek <span className="font-normal text-neutral-500">· {date}</span>
          </h2>
          <p className="text-sm text-neutral-300">Nálada: {MOOD_LABELS[today.mood_score - 1].toLowerCase()}</p>
        </div>
        <button type="button" onClick={() => onEdit(today)} className={`${secondary} shrink-0`}>
          Upravit
        </button>
      </div>
      {badges.length > 0 && (
        <>
        <p className={`mt-3 mb-1.5 ${caption}`}>Dnešní cíle</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Dnešní cíle">
          {badges.map((b) => {
            const I = Icon[b.ok];
            return (
              <li key={b.key} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-neutral-300">
                <I size={12} className={tone[b.ok]} aria-hidden="true" />
                <span className="sr-only">{b.ok == null ? "nevyplněno: " : b.ok ? "splněno: " : "nesplněno: "}</span>
                {b.text}
              </li>
            );
          })}
        </ul>
        </>
      )}
    </section>
  );
}

// "Tvé vzorce": what lines up with better or worse mood (insights.js). Arrow + word carry the direction, not color alone.
function PatternsCard({ records, templates }) {
  const found = insights(records, templates);
  if (found.length)
    return (
      <details className={`${card} group`}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <h2 className={`${cardTitle} mb-0 flex-1`}>Tvé vzorce</h2>
          <span className="text-xs text-neutral-500">{found.length} zjištění</span>
          <ChevronRight size={18} className="text-neutral-500 transition-transform group-open:rotate-90" aria-hidden="true" />
        </summary>
        <p className={`mb-2 ${cardDesc}`}>Co souvisí s lepší a horší náladou · posledních 90 dní</p>
        <ul className="space-y-2">
            {found.map((x) => (
              <li key={x.id} className="flex gap-2 text-sm text-neutral-200">
                <span className={`font-semibold ${x.diff > 0 ? "text-accent2-text" : "text-red-400"}`} aria-hidden="true">
                  {x.diff > 0 ? "↑" : "↓"}
                </span>
                <span>{x.text}</span>
              </li>
            ))}
          </ul>
        <p className="mt-2 text-xs text-neutral-500">Souvislost, ne důkaz příčiny.</p>
      </details>
    );
  return (
    <section className={card}>
      <h2 className={cardTitle}>Tvé vzorce</h2>
      <p className="text-sm text-neutral-400">
        Vzorce se ukážou, až budeš mít aspoň {MIN_N} dní s danou věcí i bez ní. Zatím {records.length} {records.length === 1 ? "záznam" : records.length >= 2 && records.length <= 4 ? "záznamy" : "záznamů"}.
        {records.length < 10 && <span className="block text-xs text-neutral-500">Chceš to vidět hned? Načti ukázková data v Nastavení → Záloha.</span>}
      </p>
    </section>
  );
}

function last7Dates() {
  const now = new Date();
  return Array.from({ length: WEEK }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WEEK - 1 - i)).toLocaleDateString("sv-SE"));
}

// Mood of the last 7 days ending today; each day opens in the entry form (quick way to fill a missed day).
function MoodWeek({ dates, byDate, onEdit }) {
  return (
    <ul className="grid grid-cols-7 gap-1">
      {dates.map((date, i) => {
        const r = byDate[date];
        const isToday = i === dates.length - 1;
        const text = r ? `nálada ${MOOD_LABELS[r.mood_score - 1].toLowerCase()}` : "nevyplněno, doplnit";
        return (
          <li key={date}>
            <button
              type="button"
              onClick={() => onEdit(r ?? { date })}
              aria-label={`${isToday ? "Dnes, " : ""}${dayLabel(date)}: ${text}`}
              className={`flex min-h-14 w-full flex-col items-center justify-center rounded-xl border border-line bg-neutral-950 py-1 transition motion-safe:active:scale-95 hover:bg-neutral-800 ${isToday ? "border-accent-500/60" : ""}`}
            >
              <span className={`text-[11px] capitalize ${isToday ? "font-semibold text-neutral-200" : "text-neutral-500"}`} aria-hidden="true">
                {isToday ? "dnes" : weekday(date)}
              </span>
              <span className={r ? "text-xl" : "text-xl text-neutral-600"} aria-hidden="true">
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
function SummaryCard({ records, report, dates, onEdit }) {
  const byDate = Object.fromEntries(records.map((r) => [r.date, r]));
  const mood = weekSummary(
    lastDays(records).map(({ date, record }) => ({ date, mood: record?.mood_score ?? null })),
    "mood",
  );
  const filled = dates.filter((d) => byDate[d]).length;
  const { score, trend, good, total } = report;
  const thin = filled < 4; // a score from 1–3 days is noise, not a signal: show it neutral
  // Headline: the goal that moved up most vs last week, else the best-met one.
  const rated = report.items.filter((i) => i.rate != null);
  const up = rated.filter((i) => i.prev != null && i.rate - i.prev > 0.005).sort((a, b) => b.rate - b.prev - (a.rate - a.prev))[0];
  const top = [...rated].sort((a, b) => b.rate - a.rate)[0];
  const headline = thin ? "Zatím málo dat" : up ? `Největší posun: ${up.info.label} ↑` : top ? `Nejvíc ti jde: ${top.info.label}` : `Plnění cílů za ${WEEK} dní`;
  return (
    <section className={card}>
      <h2 className={cardTitle}>Tvůj týden</h2>
      <p className={`mb-3 ${cardDesc}`}>Posledních {WEEK} dní: jak plníš cíle a jaká byla nálada</p>
      {score != null && (
        <div className="mb-3 flex items-center gap-4">
          <div className="relative size-24 shrink-0" role="img" aria-label={`Plnění cílů ${pct(score)}`}>
            <svg viewBox="0 0 150 150" className="size-full" aria-hidden="true">
              <Ring r={66} frac={score} width={16} color={thin ? "var(--color-neutral-600)" : score >= GOOD ? "var(--color-accent2)" : "var(--color-accent-500)"} />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center leading-tight" aria-hidden="true">
              <span className="text-lg font-semibold tabular-nums text-neutral-50">{pct(score)}</span>
              <span className="text-[10px] tracking-wider text-neutral-500 uppercase">cílů</span>
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-base leading-tight font-semibold text-neutral-100">
              {headline}
            </p>
            <p className="text-sm text-neutral-300">
              {good} z {total} {total === 1 ? "cíle" : "cílů"} se daří
            </p>
            <p className="text-xs text-neutral-400">
              vyplněno {filled}/{WEEK} dní
              {trend != null && !thin && ` · ${change(trend, pct, 0.005)} vs minulý týden`}
            </p>
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
        {score == null && (
          <span className="text-neutral-400">
            Vyplněno <b className="font-semibold text-neutral-100">{filled}</b>/{WEEK}
          </span>
        )}
      </div>
      <MoodWeek dates={dates} byDate={byDate} onEdit={onEdit} />
      <p className={`mt-1.5 ${cardDesc}`}>Nálada po dnech · ťukni na den a doplníš ho</p>
    </section>
  );
}

// Daily goal: one dot per day. Filled = met, ring = missed, small dot = not filled in (shape, not only color).
function DayGoalRow({ item: { info, rows, level }, dates }) {
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
      <ul className="mt-1.5 grid grid-cols-7 gap-1">
        {dates.map((date) => {
          const r = rows.find((x) => x.date === date) ?? { date };
          const v = r[info.rowKey];
          const ok = v != null && meets(v, info.goal, info.dir);
          const text = `${dayLabel(r.date)}: ${v == null ? "nevyplněno" : `${num(v)}${u}, ${ok ? "splněno" : "nesplněno"}`}`;
          return (
            <li key={date} title={text} className="flex h-4 items-center justify-center">
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

function GoalsCard({ items, dates, onNavigate }) {
  if (!items.length)
    return (
      <div className={card}>
        <h2 className={cardTitle}>Cíle</h2>
        <p className="text-sm text-neutral-400">Nastav si cíle a tady hned uvidíš, jak se ti daří.</p>
        <button type="button" onClick={() => onNavigate("goals")} className="mt-3 min-h-11 rounded-xl border border-line bg-neutral-900 px-4 text-sm font-medium text-neutral-200 hover:bg-neutral-800">
          Nastavit cíle
        </button>
      </div>
    );
  return (
    <section className={card}>
      <h2 className={cardTitle}>Cíle</h2>
      <p className={cardDesc}>Plnění za posledních {WEEK} dní · nahoře ty, které potřebují pozornost</p>
      {/* Legend for the day dots in DayGoalRow (same shapes). */}
      <p className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 ${cardDesc}`} aria-hidden="true">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-accent2" /> splněno</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full ring-2 ring-neutral-600 ring-inset" /> nesplněno</span>
        <span className="flex items-center gap-1"><span className="size-1 rounded-full bg-neutral-700" /> nevyplněno</span>
      </p>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={`${item.info.rowKey}-${item.info.key}-${item.info.label}`} className="py-3 last:pb-0">
            {item.info.period === "week" ? <WeekGoalRow item={item} /> : <DayGoalRow item={item} dates={dates} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Overview({ records, templates, today, onNavigate, onEdit }) {
  const report = goalReport(templateCharts(lastDays(records), templates).filter((c) => c.goals?.length));
  // What needs attention first: lowest rate on top, goals without data last.
  const items = [...report.items].sort((a, b) => (a.rate ?? 2) - (b.rate ?? 2));
  const dates = last7Dates();
  return (
    <div className="space-y-3">
      <TodayCard today={today} items={report.items} onEdit={onEdit} />
      <PatternsCard records={records} templates={templates} />
      <SummaryCard records={records} report={report} dates={dates} onEdit={onEdit} />
      <GoalsCard items={items} dates={dates} onNavigate={onNavigate} />
      {records.length > 1 && (
        <button
          type="button"
          onClick={() => onNavigate("charts")}
          className="mx-auto flex min-h-11 items-center gap-1 rounded-xl px-4 text-sm font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
        >
          Podrobnosti v Grafech <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
