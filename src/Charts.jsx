import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MOODS } from "./RecordEntryModal.jsx";
import { DAYS, WEEK, activities, clockStats, fmtClock, lastDays, templateCharts, weekDays, weekSummary } from "./chartData.js";
import { goalText, goalTop } from "./goals.js";
import { card } from "./ui.js";

// Chart colors = CSS variables of the active theme (themes.js themeVars), so switching themes repaints the
// charts with no re-render. Tints mix into the card color, not transparency, so stacked bars never show through.
const tint = (v) => `color-mix(in srgb, var(${v}) 40%, var(--color-neutral-900))`;
// --chart-n is set per card from the theme's palette (cycleVars); themes without one leave it invalid -> fallback.
const C = {
  a1: "var(--chart-1, var(--color-accent-500))", a2: "var(--chart-2, var(--color-accent2))",
  a3: `var(--chart-3, ${tint("--color-accent-500")})`, a4: `var(--chart-4, ${tint("--color-accent2")})`,
  gray: "var(--color-neutral-600)", mood: "var(--color-accent-400)",
  surface: "var(--color-neutral-900)", grid: "var(--color-neutral-800)", axis: "var(--color-neutral-700)",
  tick: "var(--color-neutral-500)", cursor: "var(--color-neutral-700)", goalInk: "var(--color-neutral-400)",
};
const useColors = () => C;
// Card i gets the palette shifted by i, so every card leads with a different color.
const cycleVars = (i) => Object.fromEntries([1, 2, 3, 4].map((n) => [`--chart-${n}`, `var(--color-cycle-${((i + n - 1) % 6) + 1})`]));
const paint = (c, role) => c[role] ?? role;
const num = (n) => n.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
const axisNum = (n) => (n >= 1000 ? `${num(n / 1000)}k` : num(n)); // "2 400" would not fit the narrow axis
const shortDate = (iso) => new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
const weekTick = (iso) => new Date(iso).toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric" }); // "po 3."
const longDate = (iso) => new Date(iso).toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric", year: "numeric" });

function ChartTooltip({ active, payload, label, series }) {
  const c = useColors();
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  // Stacked sport segments at 0 are sports not done that day: list only what happened.
  const items = series.filter((s) => row[s.key] != null && !(s.stack && row[s.key] === 0));
  return (
    <div className="rounded-xl bg-neutral-800/95 px-3 py-2 text-sm shadow-md ring-1 ring-neutral-50/10 backdrop-blur">
      <p className="mb-1 text-neutral-400 capitalize">{longDate(label)}</p>
      {items.length === 0 && <p className="text-neutral-500">{row._minutes === 0 ? "Bez sportu" : "Nevyplněno"}</p>}
      {items.map((s) => {
        const v = payload[0].payload[s.key];
        return (
          <p key={s.key} className="flex items-center gap-2 text-neutral-100">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: paint(c, s.color) }} aria-hidden="true" />
            {s.label}: <b className="font-semibold">{s.format ? s.format(v, payload[0].payload) : `${num(v)}${s.unit ? ` ${s.unit}` : ""}`}</b>
          </p>
        );
      })}
    </div>
  );
}

// Round the axis top up to 1/2/2,5/3/4/5/6 × 10^k so 4 equal steps land on readable numbers (0,5 l; 500 kcal…).
const niceMax = (max) => {
  if (!(max > 0)) return 1;
  const step = max / 4, pow = 10 ** Math.floor(Math.log10(step));
  return 4 * pow * [1, 2, 2.5, 3, 4, 5, 6, 10].find((m) => m * pow >= step);
};

// Goal ink (dashed line / band) = a strong neutral of the theme, so it never reads as a gridline or a data series.
// Reached goals use the theme's secondary accent (rewards), always with ✓ and words, never color alone.
const GOAL_INK = "var(--color-neutral-400)";

// Legend key for the goal mark in the chart: dashed line, or a light band for a range goal.
function GoalSwatch({ dir }) {
  return dir === "range" ? (
    <span className="mr-1 inline-block h-2.5 w-3.5 rounded-sm border-y border-dashed align-[-1px]" style={{ borderColor: GOAL_INK, background: "color-mix(in srgb, var(--color-neutral-50) 12%, transparent)" }} aria-hidden="true" />
  ) : (
    <span className="mr-1 inline-block w-3.5 border-t border-dashed align-middle" style={{ borderColor: GOAL_INK }} aria-hidden="true" />
  );
}

// "- - cíl ≤ 2 · 5/7 dní ✓" - how the last 7 days did against the goal. The swatch ties it to the chart mark.
function GoalStatus({ info, short = false }) {
  if (!info) return null;
  const { met, of, ok } = info.status;
  const target = `cíl ${goalText(info.goal, info.dir, info.unit)}${info.per && !short ? ` ${info.per}` : ""}`;
  if (!of)
    return (
      <span className="text-neutral-500">
        <GoalSwatch dir={info.dir} />
        {target} · zatím bez dat
      </span>
    );
  return (
    <span className="text-neutral-400">
      <GoalSwatch dir={info.dir} />
      {target} · {short ? `${met}/${of}` : `splněno ${met} z ${of} dní`}{" "}
      <span className={`font-semibold ${ok ? "text-accent2-text" : "text-neutral-400"}`}>
        {ok ? "✓" : "✗"}
        <span className="sr-only">{ok ? " daří se" : " zatím ne"}</span>
      </span>
    </span>
  );
}

// One chart for one scale group. Lines for 1–5 scores (gaps where null), bars for amounts.
// compact: small-multiple row (no legend, x-axis only when showXAxis, 1–5 axis reduced to 1/3/5).
// goal: goalInfo from chartData (line for at least / at most, band for a range).
// week: 7-day chart, every day labelled with its weekday. series[0].avg: dotted average line (one-series charts).
export function TemplateChart({ rows, series, scale, height = 160, label, compact = false, showXAxis = true, goal, week = false }) {
  const isScore = scale === "score";
  const isClock = scale === "clock"; // time of day: a line on its own axis fitted to the data
  const isLine = isScore || isClock;
  const c = useColors();
  const tick = { fill: c.tick, fontSize: 11 };
  const g = goal?.goal;
  const avg = series.length === 1 ? series[0].avg : null;
  // Counts (sport activities): whole-number axis 0, 1, 2… sized to the tallest stacked day.
  const intTop = series.some((s) => s.integer) ? Math.max(2, ...rows.map((r) => series.reduce((a, s) => a + (r[s.key] ?? 0), 0))) : null;
  return (
    <div role="img" aria-label={label} style={{ height }} className="w-full">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: compact ? 6 : 8, right: 4, bottom: showXAxis ? 0 : 6, left: -24 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={week ? weekTick : shortDate} tick={tick} stroke={c.axis} minTickGap={week ? 0 : 16} interval={week ? 0 : "preserveEnd"} hide={!showXAxis} />
          <YAxis
            domain={isScore ? [1, 5] : isClock ? [(min) => Math.floor(min * 2) / 2 - 0.5, (max) => Math.ceil(max * 2) / 2 + 0.5] : intTop ? [0, intTop] : [0, (max) => niceMax(Math.max(max, g ? goalTop(g) : 0))]} // keep the goal on screen
            tickCount={5}
            ticks={isScore ? (compact ? [1, 3, 5] : [1, 2, 3, 4, 5]) : intTop ? (compact ? [0, intTop] : [...Array(intTop + 1).keys()]) : undefined}
            interval={compact ? 0 : "preserveEnd"} // short rows: recharts would drop the 1/3 labels as "overlapping"
            allowDecimals={!isScore}
            tick={tick}
            stroke={c.axis}
            width={52}
            tickFormatter={isScore ? undefined : isClock ? fmtClock : axisNum}
          />
          <Tooltip content={<ChartTooltip series={series} />} cursor={isLine ? { stroke: c.cursor } : { fill: c.cursor, fillOpacity: 0.15 }} />
          {series.length > 1 && !compact && (
            <Legend
              verticalAlign="top"
              height={28}
              iconType="circle"
              iconSize={8}
              itemSorter={null} // keep metric order, not alphabetical
              formatter={(v) => <span className="text-xs text-neutral-300">{v}</span>}
            />
          )}
          {g && goal.dir === "range" && (
            <ReferenceArea y1={Math.max(0, g.value - g.tolerance)} y2={g.value + g.tolerance} fill={c.goalInk} fillOpacity={0.12} stroke="none" />
          )}
          {/* Average: faint dotted line under the bars, quieter than the dashed goal line. */}
          {avg != null && <ReferenceLine y={avg} stroke={c.tick} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="1 3" />}
          {series.map((s) =>
            isLine ? (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="linear" // daily 1–5 scores: straight segments, no invented in-between values
                stroke={paint(c, s.color)}
                strokeWidth={2}
                connectNulls={false}
                dot={{ r: 4, fill: paint(c, s.color), stroke: c.surface, strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ) : (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={paint(c, s.color)}
                stackId={s.stack ? "stack" : undefined}
                // Stacked segments: 2px gap in the card color between them; square ends (radius would notch the joins).
                stroke={s.stack ? c.surface : undefined}
                strokeWidth={s.stack ? 2 : 0}
                radius={s.stack ? 0 : [4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            ),
          )}
          {g && goal.dir !== "range" && (
            <ReferenceLine y={g.value} stroke={c.goalInk} strokeWidth={1} strokeDasharray="4 3" />
          )}
          {/* Range edges drawn over the bars, so the band still reads where bars cover it. */}
          {g && goal.dir === "range" &&
            [g.value - g.tolerance, g.value + g.tolerance].map((y) => (
              <ReferenceLine key={y} y={Math.max(0, y)} stroke={c.goalInk} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 3" />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const MOOD = [{ key: "mood", label: "Nálada", color: "mood", scale: "score", format: (v) => `${MOODS[v - 1]} ${v}` }];

// Big number + change vs the previous week. Arrow and sign are text, so the trend never relies on color.
const statNum = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString("cs-CZ") : num(v));
function Summary({ summary }) {
  if (!summary) return null;
  const { value, delta, mode, unit } = summary;
  const unitFor = (n) => (typeof unit === "function" ? unit(Math.round(Math.abs(n))) : unit);
  const u = unitFor(value) ? ` ${unitFor(value)}` : "";
  const du = delta != null && unitFor(delta) ? ` ${unitFor(delta)}` : "";
  const flat = delta != null && Math.abs(delta) < (Math.abs(value) >= 100 ? 1 : 0.05);
  const trend =
    delta == null ? `za ${WEEK} dní` : flat ? "→ beze změny" : `${delta > 0 ? "↑ +" : "↓ −"}${statNum(Math.abs(delta))}${du} vs. předchozích ${WEEK}`;
  return (
    <div className="text-right">
      <p className="text-lg leading-tight font-semibold text-neutral-100">
        {mode === "avg" ? "Ø " : ""}
        {statNum(value)}
        {u}
        {mode === "sum" && <span className="text-sm font-normal text-neutral-400"> / {WEEK} dní</span>}
      </p>
      <p className="text-xs text-neutral-500">{trend}</p>
      {summary.goalInfo && (
        <p className="text-xs">
          <GoalStatus info={summary.goalInfo} />
        </p>
      )}
    </div>
  );
}

// Weekly goal (sport): progress meter "235 / 150 min týdně" with what's left, so the gap is concrete.
export function WeekGoal({ info }) {
  const { total, ok } = info.status;
  const target = info.goal.value;
  const u = info.unit ? ` ${info.unit}` : "";
  const left = target - total;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-neutral-300">{info.label}</span>
        <span className="text-neutral-400">
          <b className="font-semibold text-neutral-100">{statNum(total)}</b> / {statNum(target)}
          {u} {info.per}
          {" · "}
          {ok ? (
            <span className="font-semibold text-accent2-text">
              ✓ splněno
            </span>
          ) : (
            `ještě ${statNum(left)}${u}`
          )}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${info.label}: ${statNum(total)} z ${statNum(target)}${u} tento týden`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={total}
        className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-800"
      >
        <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.min(100, (total / target) * 100)}%`, background: ok ? "var(--color-accent2)" : "var(--color-accent-500)" }} />
      </div>
    </div>
  );
}

function CardHeader({ title, summary, aside }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-3">
      <h2 className="font-semibold text-neutral-300">{title}</h2>
      {aside ?? <Summary summary={summary} />}
    </div>
  );
}

const dayLabel = (iso) => new Date(iso).toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" });

// Emotions = presence grid: a row per emotion, a column per day. Filled dot = felt that day, faint dot = day
// filled in without it, empty = not filled in. One accent color: the row name carries identity.
// words: legend for [felt, filled without it] (emotions vs social contact).
function EmotionGrid({ grid, title, words = ["cítil(a)", "vyplněno bez ní"] }) {
  const n = grid.dates.length;
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  const ticks = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <div role="img" aria-label={`${title}: ${grid.rows.map((r) => `${r.name} ${r.total}×`).join(", ")} za posledních ${DAYS} dní`}>
      <div className="mb-1 flex text-[11px] text-neutral-500">
        <span className="w-24 shrink-0" />
        <span className="flex-1" />
        <span className="w-9 shrink-0 text-right">{WEEK} dní</span>
      </div>
      <div className="space-y-1.5">
        {grid.rows.map((r) => (
          <div key={r.name} className="flex items-center">
            <span className="w-24 shrink-0 truncate pr-2 text-sm text-neutral-200 capitalize">{r.name}</span>
            <span className="grid flex-1 items-center" style={cols}>
              {r.cells.map((felt, i) => (
                <span key={grid.dates[i]} className="flex h-5 items-center justify-center" title={`${r.name} · ${dayLabel(grid.dates[i])}${felt == null ? " · nevyplněno" : felt ? "" : " · ne"}`}>
                  {/* Dot scales with the column (14 days ≈ 12 px, 30 days ≈ 5 px) and always leaves a gap to its neighbour. */}
                  {felt != null && <span className={felt ? "aspect-square w-[70%] max-w-3 rounded-full bg-accent-500" : "size-1 rounded-full bg-neutral-700"} />}
                </span>
              ))}
            </span>
            <span className="w-9 shrink-0 text-right text-sm font-semibold text-neutral-100">{r.week}×</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex text-[11px] text-neutral-500">
        <span className="w-24 shrink-0" />
        <span className="grid flex-1" style={cols}>
          {ticks.map((i) => (
            <span key={i} className="whitespace-nowrap" style={{ gridColumnStart: i + 1, justifySelf: i === 0 ? "start" : i === n - 1 ? "end" : "center" }}>
              {shortDate(grid.dates[i])}
            </span>
          ))}
        </span>
        <span className="w-9 shrink-0" />
      </div>
      <p className="mt-2 flex items-center gap-3 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-accent-500" /> {words[0]}
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1 rounded-full bg-neutral-700" /> {words[1]}
        </span>
        <span>prázdné = nevyplněno</span>
      </p>
    </div>
  );
}

// Social: days with real contact (anything but "nikdo") out of the filled ones.
function ContactDays({ grid }) {
  return (
    <div className="text-right">
      <p className="text-lg leading-tight font-semibold text-neutral-100">
        {grid.contactWeek}/{grid.filledWeek}
      </p>
      <p className="text-xs text-neutral-500">dní s kontaktem za {WEEK} dní</p>
    </div>
  );
}

// Training load (sRPE) and the acute:chronic ratio; the zone is always a word, never color alone.
function LoadLine({ load, timed }) {
  if (!timed) return <p className="mb-2 text-xs text-neutral-500">Zátěž (RPE × minuty) se spočítá, když zapneš sledování trvání.</p>;
  if (!load) return null;
  return (
    <p className="mb-2 text-xs text-neutral-400">
      Zátěž {WEEK} dní <b className="font-semibold text-neutral-100">{statNum(load.acute)}</b>
      {" · "}
      {load.acwr == null ? (
        "poměr akutní/chronická po 28 dnech dat"
      ) : (
        <>
          akutní/chronická <b className="font-semibold text-neutral-100">{num(load.acwr)}</b> – {load.zone}
        </>
      )}
    </p>
  );
}

function EmotionTop({ grid }) {
  return (
    <div className="text-right">
      <p className="text-lg leading-tight font-semibold text-neutral-100 capitalize">{grid.top ?? "–"}</p>
      <p className="text-xs text-neutral-500">{grid.top ? `nejčastěji za ${WEEK} dní` : `za ${WEEK} dní bez záznamu`}</p>
    </div>
  );
}

// Several 1–5 scores: one small chart per metric, stacked and aligned on the same days, instead of
// crossing lines in one chart. The row label names the metric and its weekly average.
// scale "count" (food 0–5+): same rows as bars, with the 7-day total instead of the average.
// scale "clock" (bedtime / wake): average time and its spread, the rhythm's consistency ("Ø 23:40 · ±25 min").
function ScoreRows({ rows, series, title, scale = "score" }) {
  const counts = scale === "count";
  const clockText = (key) => {
    const st = clockStats(rows, key);
    return st && `Ø ${fmtClock(st.mean)} · ±${Math.round(st.sd * 60)} min`;
  };
  const c = useColors();
  return (
    <div className="space-y-1">
      {series.map((s, i) => {
        const last = i === series.length - 1;
        const stat = weekSummary(rows, s.key, counts ? "sum" : "avg")?.value;
        return (
          <div key={s.key} className="flex items-start gap-2">
            <div className="w-24 shrink-0 pt-1">
              <p className="flex items-center gap-1.5 text-sm text-neutral-200">
                <span className="size-2 shrink-0 rounded-full" style={{ background: paint(c, s.color) }} aria-hidden="true" />
                {s.label}
              </p>
              <p className="text-xs text-neutral-500">
                {scale === "clock" ? (clockText(s.key) ?? "–") : stat == null ? "–" : counts ? `${num(stat)} za ${WEEK} dní` : `Ø ${num(stat)}`}
                {s.better === "low" && <span className="block text-[11px] text-neutral-600">méně = lépe</span>}
              </p>
              {s.goalInfo && (
                <p className="text-xs leading-tight">
                  <GoalStatus info={s.goalInfo} short />
                </p>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <TemplateChart
                rows={rows}
                series={[s]}
                scale={scale}
                compact
                showXAxis={last}
                height={last ? 82 : 58}
                goal={s.goalInfo}
                label={`${title}: ${s.label} za posledních ${DAYS} dní`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Legend for the average line: dotted swatch + "Ø 8 240 kroků".
function AvgNote({ series: s }) {
  return (
    <span className="text-neutral-500">
      <span className="mr-1 inline-block w-3.5 border-t border-dotted align-middle" style={{ borderColor: C.tick }} aria-hidden="true" />Ø {statNum(s.avg)} {s.unit}
    </span>
  );
}

// Weekly goal meters + one chart per scale group.
function CardBody({ chart: { template, groups, summary, weekGoals }, week = false }) {
  return (
    <>
    {weekGoals.length > 0 && (
      <div className="mb-3 space-y-2">
        {weekGoals.map((info) => (
          <WeekGoal key={info.key} info={info} />
        ))}
      </div>
    )}
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.scale}>
          {(g.scale === "score" && g.series.length > 1) || g.scale === "count" || g.scale === "clock" ? (
            <>
              <p className="mb-1 text-xs text-neutral-500">{{ count: "Počet za den", clock: "Čas (rozptyl za 7 dní = pravidelnost)" }[g.scale] ?? "Hodnocení 1–5"}</p>
              <ScoreRows rows={g.rows} series={g.series} title={template.name} scale={g.scale} />
            </>
          ) : (
            <>
              {/* One-series charts carry no legend, so the subtitle names the metric and its unit. */}
              <p className="mb-1 text-xs text-neutral-500">
                {subtitle(g)}
                {g.goalInfo && g.goalInfo !== summary?.goalInfo && (
                  <>
                    {" · "}
                    <GoalStatus info={g.goalInfo} />
                  </>
                )}
                {g.series.length === 1 && g.series[0].avg != null && (
                  <>
                    {" · "}
                    <AvgNote series={g.series[0]} />
                  </>
                )}
              </p>
              <TemplateChart
                rows={g.rows}
                series={g.series}
                scale={g.scale}
                height={g.series.length > 1 ? 168 : 140}
                goal={g.goalInfo}
                week={week}
                label={`${template.name}: ${g.series.map((s) => s.label).join(", ")}${week ? " za týden" : ` za posledních ${DAYS} dní`}`}
              />
            </>
          )}
        </div>
      ))}
    </div>
    </>
  );
}

const WEEK_NAME = { 0: "Tento týden", [-1]: "Minulý týden" };

// One ring: gray track + arc filled to `frac` (0–1), starting at 12 o'clock.
export function Ring({ r, frac, color, width }) {
  const len = 2 * Math.PI * r;
  return (
    <g transform="rotate(-90 75 75)">
      <circle cx={75} cy={75} r={r} fill="none" stroke="var(--color-neutral-800)" strokeWidth={width} />
      {frac > 0 && (
        <circle cx={75} cy={75} r={r} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${Math.min(1, frac) * len} ${len}`} />
      )}
    </g>
  );
}

// Sport month = activity rings: outer ring = total vs the weekly goal scaled to the window (full ring without
// a goal), one inner ring per sport = its share of the total. Numbers live in the legend, not in color.
function SportRings({ group, goals }) {
  const c = useColors();
  const { series, rows } = group;
  const minutes = series[0].mode === "minutes";
  const unit = (n) => (minutes ? "min" : activities(n));
  const per = series.map((s) => ({ ...s, total: rows.reduce((a, r) => a + (r[s.key] ?? 0), 0) }));
  const all = per.reduce((a, s) => a + s.total, 0);
  const weekGoal = goals?.[minutes ? "week_minutes" : "week_activities"]?.value;
  const target = weekGoal ? Math.round((weekGoal * rows.length) / 7) : null;
  const ok = target != null && all >= target;
  const width = 11, step = 14; // up to 5 rings (total + 3 sports + Ostatní) fit in 150 px
  const pct = (n) => (all ? Math.round((n / all) * 100) : 0);
  const aria = `Sport za posledních ${rows.length} dní: celkem ${statNum(all)} ${unit(all)}${target ? `, cíl ${statNum(target)}` : ""}; ${per.map((s) => `${s.label} ${statNum(s.total)} ${unit(s.total)}`).join(", ")}`;
  return (
    <div className="flex items-center gap-4" role="img" aria-label={aria}>
      <svg viewBox="0 0 150 150" className="size-36 shrink-0" aria-hidden="true">
        <Ring r={75 - width / 2} frac={target ? all / target : all ? 1 : 0} color={ok ? "var(--color-accent2)" : "var(--color-accent-500)"} width={width} />
        {per.map((s, i) => (
          <Ring key={s.key} r={75 - width / 2 - step * (i + 1)} frac={all ? s.total / all : 0} color={paint(c, s.color)} width={width} />
        ))}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
        <p className="text-xs text-neutral-500">Posledních {rows.length} dní</p>
        <p className="text-neutral-300">
          Celkem <b className="text-lg font-semibold text-neutral-100">{statNum(all)}</b> {unit(all)}
          {target && (
            <span className="block text-xs text-neutral-400">
              cíl {statNum(target)} {unit(target)}{" "}
              <span className={`font-semibold ${ok ? "text-accent2-text" : ""}`}>{ok ? "✓ splněno" : `· ještě ${statNum(target - all)}`}</span>
            </span>
          )}
        </p>
        {per.map((s) => (
          <p key={s.key} className="flex items-center gap-2 text-neutral-200">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: paint(c, s.color) }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate capitalize">{s.label}</span>
            <b className="font-semibold">{statNum(s.total)}</b>
            <span className="whitespace-nowrap text-xs text-neutral-500">
              {unit(s.total)} · {pct(s.total)} %
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

// Sport: Týden (Mon–Sun, arrows or swipe between weeks, every day labelled) | Měsíc (activity rings, SportRings).
function SportCard({ month, records }) {
  const [view, setView] = useState("week");
  const [offset, setOffset] = useState(0);
  const touchX = useRef(null);
  const days = weekDays(records, offset);
  const first = records.reduce((m, r) => (r.date < m ? r.date : m), records[0].date);
  const canBack = days[0].date > first;
  const go = (d) => (d < 0 ? canBack && setOffset(offset - 1) : offset < 0 && setOffset(offset + 1));
  const chart = view === "week" ? templateCharts(days, [month.template])[0] : month;
  const seg = (v, text) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => setView(v)}
      className={`min-h-12 rounded-lg px-4 text-sm font-semibold transition ${view === v ? "bg-neutral-700 text-neutral-50" : "text-neutral-400 hover:text-neutral-200"}`}
    >
      {text}
    </button>
  );
  const arrow = (d, Icon, aria, disabled) => (
    <button type="button" onClick={() => go(d)} disabled={disabled} aria-label={aria} className="flex size-12 items-center justify-center rounded-xl text-neutral-300 hover:bg-neutral-800 disabled:opacity-30">
      <Icon size={20} aria-hidden="true" />
    </button>
  );
  return (
    <div
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX);
        if (view === "week" && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); // swipe left = newer week
      }}
    >
      <CardHeader title={month.template.name} summary={chart?.summary} />
      <LoadLine load={month.load} timed={month.template.config_json?.duration} />
      <div className="mb-2 inline-flex rounded-xl bg-neutral-800 p-0.5" role="group" aria-label="Období grafu">
        {seg("week", "Týden")}
        {seg("month", "Měsíc")}
      </div>
      {view === "week" && (
        <div className="mb-2 flex items-center justify-between">
          {arrow(-1, ChevronLeft, "Předchozí týden", !canBack)}
          <p className="text-center text-sm text-neutral-300" aria-live="polite">
            {WEEK_NAME[offset] && <span className="block text-xs text-neutral-500">{WEEK_NAME[offset]}</span>}
            {shortDate(days[0].date)} – {shortDate(days[6].date)}
          </p>
          {arrow(1, ChevronRight, "Další týden", offset === 0)}
        </div>
      )}
      {view === "month" ? (
        <SportRings group={month.groups[0]} goals={month.template.config_json?.goals} />
      ) : chart ? (
        <CardBody chart={chart} week />
      ) : (
        <p className="py-8 text-center text-sm text-neutral-500">V tomto týdnu bez záznamu sportu</p>
      )}
    </div>
  );
}

const subtitle = (g) =>
  g.scale === "score"
    ? `${g.series[0].label} (1–5)`
    : g.series.some((s) => s.stack)
      ? g.series[0].mode === "count"
        ? "Aktivity podle sportu"
        : "Minuty podle sportu"
      : `${g.series[0].label} (${g.series[0].unit})`;

export default function Dashboard({ records, templates }) {
  const days = lastDays(records);
  const moodRows = days.map(({ date, record }) => ({ date, mood: record?.mood_score ?? null }));
  const charts = templateCharts(days, templates);
  if (records.length < 2) return <p className="text-neutral-400">Grafy se zobrazí, až budeš mít aspoň 2 záznamy.</p>;
  const moodSummary = weekSummary(moodRows, "mood");
  return (
    <div className="space-y-4">
      <section className={card}>
        <CardHeader title="Vývoj nálady" summary={moodSummary && { ...moodSummary, mode: "avg", unit: "" }} />
        <TemplateChart rows={moodRows} series={MOOD} scale="score" height={220} label={`Graf nálady za posledních ${DAYS} dní`} />
      </section>
      {charts.map((chart, i) => (
        <section key={chart.template.id} className={card} style={cycleVars(i)}>
          {chart.template.type === "sport" ? (
            <SportCard month={chart} records={records} />
          ) : (
            <>
              <CardHeader
                title={chart.template.name}
                summary={chart.summary}
                aside={chart.presence && (chart.template.type === "social" ? <ContactDays grid={chart.presence} /> : <EmotionTop grid={chart.presence} />)}
              />
              {chart.presence && (
                <EmotionGrid grid={chart.presence} title={chart.template.name} words={chart.template.type === "social" ? ["ano", "vyplněno bez něj"] : undefined} />
              )}
              <CardBody chart={chart} />
            </>
          )}
        </section>
      ))}
      <p className="px-1 text-xs text-neutral-600">
        Posledních {DAYS} dní, souhrny za {WEEK} dní. Přesná čísla najdeš v Nastavení → Záznamy.
      </p>
    </div>
  );
}
