import { Check, Copy, X } from "lucide-react";
import { fmtHM, shiftClock } from "./chartData.js";
import { Fragment, useEffect, useRef, useState } from "react";
import Rating from "./Rating.jsx";
import { api } from "./api.js";
import { SECTIONS, groupTemplates } from "./sections.js";
import { GOALS, goalText } from "./goals.js";
import { card, checkRow, checkbox, input, primary, secondary } from "./ui.js";

export const MOODS = ["😞", "🙁", "😐", "🙂", "😄"];
export const MOOD_LABELS = ["Hrozná", "Špatná", "Neutrální", "Dobrá", "Skvělá"];
const OTHER = "ostatní";

// Flat templates: one form field per data key. `flag` = config key that switches the field on (none = always shown).
// Food counts: 0 is a real answer ("none"), unfilled stays null. shortcut: 5 means "5 or more", add a number field if ever needed.
const COUNTS = [0, 1, 2, 3, 4, 5];
const COUNT_LABELS = ["0", "1", "2", "3", "4", "5+"];
// Borg CR10 words for RPE 1–10 (index = value).
const RPE_WORDS = ["", "velmi lehké", "lehké", "mírné", "trochu těžké", "těžké", "těžké", "velmi těžké", "velmi těžké", "skoro maximum", "maximum"];
const RPE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// The day's record describes the night you woke up from, so bedtime is usually "yesterday evening".
const clockH = (s) => {
  const [h, m] = s.split(":").map(Number);
  return h + m / 60;
};
export const sleptHours = (bed, wake) => (bed && wake ? Math.round((Math.round(((clockH(wake) - clockH(bed) + 24) % 24) * 60) / 60) * 1000) / 1000 : null);
const FIELDS = {
  sleep: [
    { key: "sleep_quality", flag: "quality", kind: "rating", label: "Kvalita spánku", hint: "1 = převaloval(a) jsem se, 5 = spal(a) jsem jako dřevo" },
    { key: "bedtime", flag: "times", kind: "time", label: "Usnul(a) jsem", hint: "včera večer", range: ["20:00", 480], base: "23:00", nudge: 5 },
    { key: "waketime", flag: "times", kind: "time", label: "Vstal(a) jsem", range: ["04:00", 480], base: "07:00", nudge: 5 },
    { key: "sleep_hours", flag: "hours", kind: "number", label: "Naspáno", hm: true, max: 24, slider: [12, 5], base: 7.5, nudge: 5 },
  ],
  // group: small heading inside the card when it changes. Fields with a retired flag ("retired") only show on old
  // days that hold a value, so nothing saved is lost (shownFields).
  food: [
    { key: "quality", flag: "quality", group: "Talíř", kind: "rating", label: "Jak zdravě jsi jedl(a)?", hint: "1 = samé rychlovky, 5 = jak z učebnice" },
    { key: "calories", flag: "calories", group: "Talíř", kind: "number", label: "Kalorie", hint: "kcal za celý den", step: 1, max: 20000, slider: [4000, 10], nudge: 10, base: 2000, placeholder: "např. 2100" },
    { key: "veg", flag: "retired", group: "Talíř", kind: "count", label: "Zelenina a ovoce (porce)" },
    { key: "protein", flag: "retired", group: "Talíř", kind: "count", label: "Jídla s bílkovinou" },
    { key: "processed", flag: "retired", group: "Talíř", kind: "count", label: "Průmyslově zpracované (porce)" },
    { key: "drinks", flag: "alcohol", group: "Hříšky a povzbuzováky", kind: "count", label: "Alkohol", hint: "drinky · pivo 0,5 l = víno 2 dl = panák" },
    { key: "coffee", flag: "caffeine", group: "Hříšky a povzbuzováky", kind: "count", label: "Kofein", hint: "šálky · káva, energiťák, silný čaj" },
    { key: "sweets", flag: "sugar", group: "Hříšky a povzbuzováky", kind: "count", label: "Sladkosti", hint: "porce · sušenka, zákusek, čokoláda" },
    { key: "sugary_drinks", flag: "sugary_drinks", group: "Hříšky a povzbuzováky", kind: "count", label: "Slazené pití", hint: "sklenice · limo, džus, sladký energiťák" },
    { key: "fast_food", flag: "fast_food", group: "Hříšky a povzbuzováky", kind: "count", label: "Fast food", hint: "porce · burger, pizza, kebab, smažák" },
    { key: "nicotine", flag: "nicotine", group: "Hříšky a povzbuzováky", kind: "count", label: "Nikotin", hint: "dávky · cigareta, vape, sáček" },
    { key: "last_meal", flag: "meal_times", group: "Večer", kind: "time", label: "Poslední sousto", hint: "spočítáme, kolik hodin před spaním", range: ["15:00", 540], base: "19:00", now: true, nudge: 5 },
    { key: "first_meal", flag: "retired", group: "Večer", kind: "time", label: "První jídlo" },
    { key: "meal_gap_h", flag: "retired", group: "Večer", kind: "number", label: "Poslední jídlo před spaním (hodiny)", step: 0.5, max: 12, slider: [8, 0.5] },
    { key: "overate", flag: "retired", group: "Večer", kind: "bool", label: "Přejedl(a) jsem se" },
    { key: "slump", flag: "retired", group: "Večer", kind: "bool", label: "Útlum po jídle" },
  ],
  mind: [
    { key: "clarity", flag: "clarity", kind: "rating", label: "Jasná hlava", hint: "1 = mlha, 5 = křišťálově jasno" },
    { key: "energy", flag: "energy", kind: "rating", label: "Odpolední energie (14–16 h)", hint: "1 = padám, 5 = plný(á) energie" },
    { key: "frustration", flag: "frustration", kind: "rating", label: "Podrážděnost", hint: "1 = klídek, 5 = všechno mě štve" },
  ],
  // needs: shown (and saved) only when that field is filled; grogginess means nothing without a nap.
  nap: [
    { key: "minutes", kind: "number", label: "Jak dlouho jsi spal(a)?", hint: "minuty · bez napu nech prázdné", step: 1, min: 1, max: 180, slider: [90, 1], nudge: 1, base: 20, placeholder: "např. 20" },
    { key: "grogginess", flag: "grogginess", needs: "minutes", kind: "rating", label: "Rozespalost po probuzení", hint: "1 = svěží, 5 = jako po narkóze" },
  ],
  water: [{ key: "liters", kind: "number", label: "Vypito", hint: "litry · voda, čaj, cokoli bez cukru", step: 0.05, max: 20, slider: [5, 0.1], nudge: 0.1, base: 1.5, placeholder: "např. 1,5" }],
  steps: [{ key: "steps", kind: "number", label: "Kroky", hint: "najdeš v mobilu nebo hodinkách", step: 1, max: 200000, slider: [30000, 100], nudge: 100, base: 6000, placeholder: "např. 8000" }],
  // Hours come from the fasting type set in settings (see fastingHours), so the day is one tap.
  fasting: [{ key: "fasted", kind: "bool", label: "Držel(a) jsi dnes půst?", hint: (c) => (c.full_day ? "celodenní" : `${String(c.hours).replace(".", ",")} h`) }],
  screen_time: [{ key: "minutes", kind: "number", label: "Čas u obrazovky", hint: "minuty · telefon ti to řekne v nastavení", step: 1, max: 1440, slider: [600, 5], base: 120, nudge: 5, placeholder: "např. 120" }],
  reading: [
    { key: "minutes", flag: "minutes", kind: "number", label: "Čtení", hint: "minuty", step: 1, min: 1, max: 1440, slider: [180, 1], base: 20, nudge: 1, placeholder: "např. 30" },
    { key: "pages", flag: "pages", kind: "number", label: "Přečteno", hint: "stránky", step: 1, min: 1, max: 5000, slider: [200, 1], nudge: 1, base: 20, placeholder: "např. 20" },
  ],
  meditation: [{ key: "minutes", kind: "number", label: "Meditace", hint: "minuty", step: 1, min: 1, max: 1440, slider: [60, 1], base: 10, nudge: 1, placeholder: "např. 10" }],
  stress: [{ key: "stress", kind: "rating", label: "Jak moc ve stresu?", labels: ["😌", "🙂", "😐", "😟", "😫"], hint: "od pohody po bod varu" }],
};
const PROMPTS = { sleep: "Jak ses vyspal(a)?", food: "Jak se ti dneska jedlo?", water: "Kolik jsi dnes vypil(a)?" };
// Pick-from-list templates: tap the options set in settings. [config list, data key, prompt, text when the list is empty]
const PICKS = {
  emotions: { config: "emotions", data: "emotions", prompt: "Co se v tobě dnes ozvalo? Klidně víc věcí najednou." },
  medication: { config: "items", data: "taken", prompt: "Co sis dnes vzal(a)?", none: "Zatím nemáš co vybrat. Přidej si suplementy a léky v Nastavení → Šablony." },
};
// Social contact: kinds from settings ("nikdo" excludes the rest) + optional "social battery" after real contact.
const NOBODY = "nikdo";
export const BATTERY = ["Vysálo mě", "Spíš vysálo", "Neutrální", "Spíš nabilo", "Nabilo mě"];
// Fasting yes -> hours: kept from the saved day if it was already a fast (history doesn't change with settings), else from settings.
const fastingHours = (t, saved) => (saved?.fasted && saved.hours != null ? saved.hours : t.config_json.full_day ? 24 : t.config_json.hours);
const GRATITUDE = 3; // gratitude journal: exactly three separate "things I'm grateful for"

// Field shown if tracked now OR already filled in the edited day (else saving would drop it).
const shownFields = (t, saved) => (FIELDS[t.type] ?? []).filter((f) => !f.flag || t.config_json[f.flag] || saved?.[f.key] != null);
const showMinutes = (t, saved) => t.config_json.duration || (saved?.sports ?? []).some((s) => s.minutes != null);
// "Cíl: ≥ 7 h" for every goal set on template t (optionally only the one for metric `key`).
function goalHint(t, key) {
  const parts = (GOALS[t.type] ?? [])
    .filter((m) => (key === undefined || m.key === key) && t.config_json.goals?.[m.key])
    .map((m) => goalText(t.config_json.goals[m.key], m.dir, m.unit) + (m.per && m.period === "week" ? ` ${m.per}` : ""));
  return parts.length ? <span className="block text-sm text-neutral-500">Cíl: {parts.join(" · ")}</span> : null;
}
// iOS Safari draws native date / time fields wider than the card (and centred); flatten them so w-full holds.
const dateTime = "block min-w-0 appearance-none [&::-webkit-date-and-time-value]:text-left";
const empty = (f) => (f.kind === "number" || f.kind === "text" || f.kind === "time" ? "" : null);
const filled = (v, f) => v[f.needs] != null && v[f.needs] !== "";
const toValue = (f, v) => (f.kind === "number" ? Number(v) : f.kind === "text" ? v.trim() : v);

// Turn saved result JSON into editable form state (prefill when editing a day).
function initialState(templates, saved) {
  const state = {};
  for (const t of templates) {
    const d = saved[t.id] ?? {};
    if (t.type === "sport")
      state[t.id] = Object.fromEntries((d.sports ?? []).map((s) => [s.name, { rpe: s.rpe, minutes: s.minutes ?? "" }]));
    else if (t.type === "social") state[t.id] = { kinds: d.kinds ?? [], battery: d.battery ?? null };
    else if (PICKS[t.type]) state[t.id] = d[PICKS[t.type].data] ?? [];
    else if (t.type === "gratitude") state[t.id] = Array.from({ length: GRATITUDE }, (_, i) => d.items?.[i] ?? "");
    else state[t.id] = Object.fromEntries((FIELDS[t.type] ?? []).map((f) => [f.key, d[f.key] ?? empty(f)]));
  }
  return state;
}

// Form state -> API payload; unfilled fields are skipped, a template with nothing filled is skipped, sport is always sent.
function toResults(templates, state, savedById) {
  const results = [];
  for (const t of templates) {
    const v = state[t.id];
    if (t.type === "sport") {
      const minutes = showMinutes(t, savedById[t.id]);
      const sports = Object.entries(v).map(([name, s]) => ({
        name,
        rpe: s.rpe,
        ...(minutes && s.minutes !== "" && { minutes: Number(s.minutes) }),
      }));
      results.push({ template_id: t.id, data: { sports } });
      continue;
    }
    if (PICKS[t.type]) {
      if (v.length) results.push({ template_id: t.id, data: { [PICKS[t.type].data]: v } }); // none ticked = not filled
      continue;
    }
    if (t.type === "social") {
      const keepBattery = v.battery != null && !v.kinds.includes(NOBODY) && (t.config_json.battery || savedById[t.id]?.battery != null);
      if (v.kinds.length) results.push({ template_id: t.id, data: { kinds: v.kinds, ...(keepBattery && { battery: v.battery }) } });
      continue;
    }
    if (t.type === "gratitude") {
      const items = v.map((s) => s.trim()).filter(Boolean);
      if (items.length) results.push({ template_id: t.id, data: { items } });
      continue;
    }
    const data = {};
    for (const f of shownFields(t, savedById[t.id])) {
      if (v[f.key] === empty(f) || (f.needs && !filled(v, f))) continue;
      const value = toValue(f, v[f.key]);
      if (value !== "") data[f.key] = value; // whitespace-only text counts as empty
    }
    if (t.type === "fasting" && data.fasted) data.hours = fastingHours(t, savedById[t.id]);
    // Both times given, hours left empty -> computed, so nobody has to do the math.
    if (t.type === "sleep" && data.sleep_hours == null && t.config_json.hours && sleptHours(data.bedtime, data.waketime))
      data.sleep_hours = sleptHours(data.bedtime, data.waketime);
    if (Object.keys(data).length) results.push({ template_id: t.id, data });
  }
  return results;
}

const comma = (n) => String(n).replace(".", ",");
// Now, rounded down to 5 min ("Teď" for the last meal, typed in right after dinner).
const nowRounded = () => {
  const d = new Date();
  return shiftClock("00:00", Math.floor((d.getHours() * 60 + d.getMinutes()) / 5) * 5);
};
const stepBtn =
  "flex min-h-11 min-w-14 shrink-0 items-center justify-center rounded-xl border border-line bg-neutral-900 text-sm font-medium tabular-nums text-neutral-300 transition hover:bg-neutral-800 motion-safe:active:scale-95";
const centered = "block min-w-0 appearance-none text-center text-lg tabular-nums [&::-webkit-date-and-time-value]:text-center";

// Time of day on a slider: range = [start "HH:MM", length in minutes], 5-min steps, wraps past midnight
// (bedtime 20:00 -> 04:00). A value outside the range sits at the nearer end of the track.
const minutesOf = (s) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
function TimeSlider({ name, value, range: [from, span], onChange }) {
  const off = value ? (minutesOf(value) - minutesOf(from) + 1440) % 1440 : 0;
  return (
    <input
      type="range"
      aria-label={`${name}, posuvník`}
      aria-valuetext={value || "nevyplněno"}
      min={0}
      max={span}
      step={5}
      value={off > span ? (off - span < 1440 - off ? span : 0) : off}
      onChange={(e) => onChange(shiftClock(from, Number(e.target.value)))}
      className={`mt-1 h-12 w-full cursor-pointer accent-accent-500 ${value ? "" : "opacity-40"}`}
    />
  );
}

// Times and durations: typical values one tap away (tap the chosen one again to clear), ± to fine-tune, and the
// native input in the middle for exact typing. shift(dir) returns the value one nudge up (1) or down (-1).
function Stepper({ name, value, onChange, presets, shift, nudgeText, format = String, now, children }) {
  const on = (p) => value !== "" && value != null && String(value) === String(p);
  const chip = (key, text, active, onClick) => (
    <button
      key={key}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-xl border text-xs font-medium tabular-nums transition motion-safe:active:scale-95 ${
        active ? "border-accent-500 bg-accent-500/10 text-neutral-50" : "border-line bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
      }`}
    >
      {text}
    </button>
  );
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onChange(shift(-1))} aria-label={`${name}: −${nudgeText}`} className={stepBtn}>
          −{nudgeText}
        </button>
        <div className="min-w-0 flex-1">{children}</div>
        <button type="button" onClick={() => onChange(shift(1))} aria-label={`${name}: +${nudgeText}`} className={stepBtn}>
          +{nudgeText}
        </button>
      </div>
      {(presets || now) && (
        <div role="group" aria-label={`${name}: rychlá volba`} className="grid grid-cols-6 gap-1.5">
          {presets?.map((p) => chip(p, format(p), on(p), () => onChange(on(p) ? "" : p)))}
          {now && chip("now", "Teď", false, now)}
        </div>
      )}
    </div>
  );
}

// Hours + minutes boxes for a decimal-hours value (sleep): 8,733 <-> 8 h 44 min. Both empty = unfilled.
function HoursMinutes({ id, name, value, onChange, auto }) {
  const total = value === "" || value == null ? null : Math.round(Number(value) * 60);
  const h = total == null ? "" : Math.floor(total / 60);
  const m = total == null ? "" : total % 60;
  const set = (H, M) => (H === "" && M === "" ? onChange("") : onChange(Math.round(((Number(H) || 0) + (Number(M) || 0) / 60) * 1000) / 1000));
  const autoMin = auto ? Math.round(auto * 60) : null;
  const box = (props) => <input type="number" inputMode="numeric" min={0} className={`${input} ${centered} w-full px-1`} {...props} />;
  return (
    <div className="flex items-center gap-1 text-sm text-neutral-500">
      {box({ id, max: 24, value: h, placeholder: autoMin != null ? String(Math.floor(autoMin / 60)) : "7", "aria-label": `${name}: hodiny`, onChange: (e) => set(e.target.value, m) })}
      <span aria-hidden="true">h</span>
      {box({ max: 59, value: m, placeholder: autoMin != null ? String(autoMin % 60) : "30", "aria-label": `${name}: minuty`, onChange: (e) => set(h, e.target.value) })}
      <span aria-hidden="true">min</span>
    </div>
  );
}

// Number box for exact typing, with ± (nudge) for fine steps, optional presets (times of day / durations, see
// Stepper) and an optional slider for a quick thumb drag.
// slider = [max, step]: a practical range, smaller than the validation max (bigger numbers can still be typed).
// An empty value ("") leaves the slider at its minimum but saves nothing until it is moved.
// start: where ± begins on an empty field (yesterday's value, else `base`, else the middle preset).
// hm: value is decimal hours entered as hours + minutes; nudge is then in minutes.
function NumberField({ id, label, name, value, onChange, min = 0, max, step, slider, placeholder, presets, nudge, start, base, hm, auto }) {
  const box = hm ? (
    <HoursMinutes id={id} name={name ?? label} value={value} onChange={onChange} auto={auto} />
  ) : (
    <input
      id={id}
      type="number"
      inputMode={step < 1 ? "decimal" : "numeric"}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${input} w-full ${nudge ? centered : ""}`}
    />
  );
  const shift = (dir) => {
    const from = value === "" || value == null ? Number(start ?? base ?? presets?.[Math.floor(presets.length / 2)] ?? min) : Number(value);
    const next = hm ? (Math.round(from * 60) + dir * nudge) / 60 : from + dir * nudge;
    return Math.min(max ?? Infinity, Math.max(min, Math.round(next * 1000) / 1000));
  };
  const fmt = hm ? (p) => `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}` : comma; // 7.5 -> "7:30"
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      {nudge ? (
        <Stepper name={name ?? label} value={value} onChange={onChange} presets={presets} shift={shift} nudgeText={hm ? `${nudge} min` : comma(nudge)} format={fmt}>
          {box}
        </Stepper>
      ) : (
        box
      )}
      {auto && (value === "" || value == null) && <p className="mt-1 text-xs text-neutral-500">Necháš-li prázdné, dopočítám z časů: {fmtHM(auto)}</p>}
      {slider && !presets && (
        <input
          type="range"
          aria-label={`${name ?? label}, posuvník`}
          // hm: the track is in minutes (slider = [max hours, step minutes]), the value stays decimal hours.
          min={hm ? 0 : min}
          max={hm ? slider[0] * 60 : slider[0]}
          step={slider[1]}
          value={value === "" || value == null ? min : hm ? Math.min(Math.round(Number(value) * 60), slider[0] * 60) : Math.min(Number(value), slider[0])}
          onChange={(e) => onChange(hm ? Math.round((Number(e.target.value) / 60) * 1000) / 1000 : e.target.value)}
          // Unfilled: dimmed, so the thumb at the minimum doesn't read as a saved minimum.
          className={`mt-1 h-12 w-full cursor-pointer accent-accent-500 ${value === "" ? "opacity-40" : ""}`}
        />
      )}
    </div>
  );
}

// Full-screen day entry: mood and every active template on one scrolling page, one save at the end.
// `record` = existing DailyRecord to edit (PUT), or undefined for a new day (POST).
export default function RecordEntryModal({ templates, record, date, yesterday, onDateChange, onDone, onCancel }) {
  const savedById = Object.fromEntries((record?.results ?? []).map((r) => [r.template_id, r.result_data_json]));
  const prevById = Object.fromEntries((yesterday?.results ?? []).map((r) => [r.template_id, r.result_data_json])); // "Stejně jako včera"
  // Active templates plus ones disabled since but holding data for this day, so saving doesn't delete it.
  // A template added after that day has no saved result and starts empty.
  const [active] = useState(() => templates.filter((t) => t.is_active || t.id in savedById));
  const [mood, setMood] = useState(record?.mood_score ?? null);
  const [state, setState] = useState(() => initialState(active, savedById));
  const [note, setNote] = useState(record?.note ?? "");
  // Unsaved changes = form differs from how it opened; read by the history listener through a ref.
  const [initial] = useState(() => JSON.stringify([mood, state, note]));
  const dirty = useRef(false);
  dirty.current = JSON.stringify([mood, state, note]) !== initial;
  const after = useRef(null); // set for a deliberate exit (save, date switch): popstate then skips the confirm
  const today = new Date().toLocaleDateString("sv-SE");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false); // success toast shows briefly before the modal closes
  const [copied, setCopied] = useState(false);
  // "Zkopírovat včerejšek": every template yesterday filled, except gratitude (meant to be fresh each day); mood and note stay.
  const copyable = active.filter((t) => t.id in prevById && t.type !== "gratitude");
  const copyYesterday = () => {
    setState((s) => ({ ...s, ...initialState(copyable, prevById) }));
    setCopied(true);
  };

  // Sections in the shared order (sections.js), mood on top of the first one ("Jak ti dnes bylo"). Charts use the same.
  const MOOD = { id: "mood", type: "mood", name: "Nálada" };
  const grouped = groupTemplates(active);
  const groups = grouped[0]?.title === SECTIONS[0].title
    ? [{ ...grouped[0], templates: [MOOD, ...grouped[0].templates] }, ...grouped.slice(1)]
    : [{ title: SECTIONS[0].title, templates: [MOOD] }, ...grouped];
  const set = (id, value) => setState((s) => ({ ...s, [id]: value }));

  // The modal owns one history entry: X, Escape and the system Back button all leave through popstate,
  // which asks before dropping unsaved changes. The page behind must not scroll under the modal.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    history.pushState({ entry: true }, "");
    const onPop = () => {
      if (after.current) after.current();
      else if (!dirty.current || confirm("Zahodit změny?")) onCancel();
      else history.pushState({ entry: true }, ""); // stay: restore the entry Back just consumed
    };
    const onKey = (e) => e.key === "Escape" && history.back();
    const onUnload = (e) => dirty.current && e.preventDefault(); // reload / closing the tab
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [onCancel]);

  const leave = (fn) => {
    after.current = fn;
    history.back();
  };
  function changeDate(d) {
    if (!d || d > today || d === date) return; // empty while typing, or a future day
    if (dirty.current && !confirm("Zahodit změny?")) return;
    leave(() => onDateChange(d));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = { date, mood_score: mood, note, results: toResults(active, state, savedById) };
      await (record ? api(`/records/${record.id}`, "PUT", payload) : api("/records", "POST", payload));
      setSaved(true); // saving stays true until the modal closes, so a second tap can't save twice
      navigator.vibrate?.(10);
      setTimeout(() => leave(onDone), 800);
    } catch (e) {
      setError(`Uložení selhalo: ${e.message}`);
      setSaving(false);
    }
  }

  function body(current) {
    if (current.type === "mood")
      return (
        <>
          <p className="mb-3 text-sm text-neutral-400">Jak se dnes cítíš?</p>
          <Rating label="Nálada" labels={MOODS} captions={MOOD_LABELS} value={mood} onChange={setMood} reverse />
        </>
      );
    const v = state[current.id];
    const saved = savedById[current.id];
    if (PICKS[current.type]) {
      const pick = PICKS[current.type];
      const options = current.config_json[pick.config] ?? [];
      // Items saved for this day stay on offer even if removed from settings since.
      const names = [...options, ...v.filter((e) => !options.includes(e))];
      const toggle = (name) => set(current.id, v.includes(name) ? v.filter((e) => e !== name) : [...v, name]);
      return (
        <>
          <p className="mb-3 text-sm text-neutral-400">{pick.prompt}</p>
          {names.length === 0 && <p className="text-neutral-500">{pick.none}</p>}
          <div className="space-y-2">
            {names.map((name) => (
              <label key={name} className={checkRow}>
                <input type="checkbox" className={checkbox} checked={v.includes(name)} onChange={() => toggle(name)} />
                <span className="first-letter:uppercase">{name}</span>
              </label>
            ))}
          </div>
        </>
      );
    }
    if (current.type === "gratitude")
      return (
        <div className="space-y-3">
          <p className="text-sm text-neutral-400">Za jaké tři věci jsi dnes vděčný(á)?</p>
          {v.map((text, i) => (
            <label key={i} className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">Věc {i + 1}</span>
              <input
                maxLength={200}
                value={text}
                onChange={(e) => set(current.id, v.map((x, j) => (j === i ? e.target.value : x)))}
                className={`${input} w-full`}
              />
            </label>
          ))}
        </div>
      );
    if (current.type === "social") {
      const options = current.config_json.kinds ?? [];
      const names = [...options, ...v.kinds.filter((k) => !options.includes(k))]; // kinds saved that day stay on offer
      const toggle = (k) => {
        const kinds = v.kinds.includes(k) ? v.kinds.filter((x) => x !== k) : k === NOBODY ? [NOBODY] : [...v.kinds.filter((x) => x !== NOBODY), k];
        set(current.id, { ...v, kinds });
      };
      const contact = v.kinds.some((k) => k !== NOBODY);
      return (
        <>
          <p className="mb-3 text-sm text-neutral-400">S kým jsi dnes byl(a) v kontaktu? Zaškrtni všechno, co platí.</p>
          <div className="space-y-2">
            {names.map((k) => (
              <label key={k} className={checkRow}>
                <input type="checkbox" className={checkbox} checked={v.kinds.includes(k)} onChange={() => toggle(k)} />
                <span>{k}</span>
              </label>
            ))}
          </div>
          {contact && (current.config_json.battery || saved?.battery != null) && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
                Sociální baterie <span className="font-normal normal-case tracking-normal text-neutral-500">(dodalo ti to energii, nebo ji vzalo?)</span>
              </p>
              <Rating label="Sociální baterie" captions={BATTERY} value={v.battery} onChange={(n) => set(current.id, { ...v, battery: n })} />
            </div>
          )}
        </>
      );
    }
    if (current.type === "sport") {
      const names = [...current.config_json.sports, OTHER];
      // Keep sports saved for this day even if they were removed from settings since.
      for (const n of Object.keys(v)) if (!names.includes(n)) names.splice(-1, 0, n);
      const minutes = showMinutes(current, saved);
      const toggle = (name) => {
        const next = { ...v };
        if (name in next) delete next[name];
        else next[name] = { rpe: 5, minutes: "" };
        set(current.id, next);
      };
      const setSport = (name, patch) => set(current.id, { ...v, [name]: { ...v[name], ...patch } });
      return (
        <>
          <p className="mb-3 text-sm text-neutral-400">Jak ses dnes hýbal(a)? {goalHint(current)}</p>
          <div className="space-y-2">
            {names.map((name) => (
              <div key={name}>
                <label className={checkRow}>
                  <input type="checkbox" className={checkbox} checked={name in v} onChange={() => toggle(name)} />
                  <span className="first-letter:uppercase">{name}</span>
                </label>
                {name in v && (
                  <div className="mt-2 mb-3 space-y-2 pl-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                      Námaha (RPE 1–10){v[name].rpe != null && <span className="text-neutral-300"> · {RPE_WORDS[v[name].rpe]}</span>}
                    </p>
                    <Rating label={`Námaha ${name}`} options={RPE} cols={5} value={v[name].rpe} onChange={(n) => setSport(name, { rpe: n })} />
                    {minutes && (
                      <NumberField
                        id={`entry-sport-${name}`}
                        label={`Trvání ${name} (minuty)`}
                        value={v[name].minutes}
                        onChange={(m) => setSport(name, { minutes: m })}
                        min={1}
                        max={1440}
                        step={1}
                        slider={[240, 1]}
                        base={45}
                        nudge={5}
                        start={prevById[current.id]?.sports?.find((s) => s.name === name)?.minutes}
                        placeholder="např. 60"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      );
    }
    if (FIELDS[current.type]) {
      const fields = shownFields(current, saved).filter((f) => !f.needs || filled(v, f));
      const setField = (key, value) => set(current.id, { ...v, [key]: value });
      const autoHours = current.type === "sleep" && sleptHours(v.bedtime, v.waketime);
      return (
        <div className="space-y-3">
          {PROMPTS[current.type] && <p className="text-sm text-neutral-400">{PROMPTS[current.type]}</p>}
          {fields.map((f, i) => [
            f.group && f.group !== fields[i - 1]?.group && (
              <h4 key={`g-${f.group}`} className={`text-xs font-medium tracking-wider text-neutral-500 uppercase ${i ? "pt-3" : ""}`}>
                {f.group}
              </h4>
            ),
            f.kind === "bool" ? (
              <div key={f.key}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {f.label} {f.hint && <span className="font-normal normal-case tracking-normal text-neutral-500">({f.hint(current.config_json)})</span>}
                </p>
                <div role="group" aria-label={f.label} className="grid grid-cols-2 gap-2">
                  {[
                    [true, "Ano"],
                    [false, "Ne"],
                  ].map(([val, text]) => (
                    <button
                      key={text}
                      type="button"
                      aria-pressed={v[f.key] === val}
                      // Tap the chosen answer again to clear it (field becomes unfilled).
                      onClick={() => setField(f.key, v[f.key] === val ? null : val)}
                      className={`min-h-11 rounded-xl border text-sm font-medium transition motion-safe:active:scale-95 ${
                        v[f.key] === val ? "border-accent-500 bg-accent-500/10 text-neutral-50" : "border-line bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ) : f.kind === "time" ? (
              <div key={f.key}>
                <label htmlFor={`entry-${current.id}-${f.key}`} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {f.label} {f.hint && <span className="font-normal normal-case tracking-normal text-neutral-500">({f.hint})</span>}
                </label>
                {f.range ? (
                  <>
                    <Stepper
                      name={f.label}
                      value={v[f.key]}
                      onChange={(val) => setField(f.key, val)}
                      nudgeText={f.nudge}
                      shift={(dir) => shiftClock(v[f.key] || prevById[current.id]?.[f.key] || f.base, dir * f.nudge)}
                      now={f.now && (() => setField(f.key, nowRounded()))}
                    >
                      <input id={`entry-${current.id}-${f.key}`} type="time" value={v[f.key]} onChange={(e) => setField(f.key, e.target.value)} className={`${input} ${centered} w-full`} />
                    </Stepper>
                    <TimeSlider name={f.label} value={v[f.key]} range={f.range} onChange={(val) => setField(f.key, val)} />
                  </>
                ) : (
                  <input id={`entry-${current.id}-${f.key}`} type="time" value={v[f.key]} onChange={(e) => setField(f.key, e.target.value)} className={`${input} ${dateTime} w-full`} />
                )}
              </div>
            ) : f.kind === "text" ? (
              <label key={f.key} className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">{f.label}</span>
                <input maxLength={f.max} placeholder={f.placeholder} value={v[f.key]} onChange={(e) => setField(f.key, e.target.value)} className={`${input} w-full`} />
              </label>
            ) : f.kind === "rating" || f.kind === "count" ? (
              <div key={f.key}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {f.label} {f.hint && <span className="font-normal normal-case tracking-normal text-neutral-500">({f.hint})</span>}
                </p>
                {goalHint(current, f.key)}
                {f.kind === "count" ? (
                  // Tap the chosen count again to clear it (unfilled, not 0).
                  <Rating label={f.label} options={COUNTS} labels={COUNT_LABELS} value={v[f.key]} onChange={(n) => setField(f.key, v[f.key] === n ? null : n)} />
                ) : (
                  <Rating label={f.label} labels={f.labels} value={v[f.key]} onChange={(n) => setField(f.key, n)} />
                )}
              </div>
            ) : (
              <NumberField
                key={f.key}
                id={`entry-${current.id}-${f.key}`}
                name={f.label}
                label={
                  <>
                    {f.label} {f.hint && <span className="font-normal normal-case tracking-normal text-neutral-500">({f.hint})</span>} {goalHint(current, f.key)}
                  </>
                }
                value={v[f.key]}
                onChange={(val) => setField(f.key, val)}
                min={f.min}
                max={f.max}
                step={f.step}
                slider={f.slider}
                presets={f.presets}
                nudge={f.nudge}
                start={prevById[current.id]?.[f.key]}
                base={f.base}
                hm={f.hm}
                // Both sleep times given: show what saving will compute when hours stay empty.
                auto={f.key === "sleep_hours" ? autoHours || null : null}
                placeholder={f.placeholder}
              />
            ),
          ])}
          {fields.length === 0 && <p className="text-neutral-400">Tady zatím nic nesleduješ. Zapni si něco v Nastavení → Šablony.</p>}
        </div>
      );
    }
    return <p>Neznámá šablona: {current.type}</p>;
  }

  const title = record ? `Úprava ${new Date(record.date).toLocaleDateString("cs-CZ")}` : "Záznam dne";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-title"
      // Vertical scrolling only: overflow-y alone makes overflow-x "auto" too, and iOS Safari then lets a slightly
      // diagonal thumb scroll rubber-band the form sideways. pan-y keeps the gesture vertical (sliders still drag).
      className="fixed inset-0 z-50 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain bg-neutral-950 motion-safe:animate-slide-up"
    >
      <div className="mx-auto min-h-full w-full max-w-md">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-neutral-950/95 px-4 py-1.5 backdrop-blur">
          <h2 id="entry-title" className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => history.back()}
            aria-label="Zavřít bez uložení"
            autoFocus
            className="-mr-2 flex size-11 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
          {copyable.length > 0 && (
            <button type="button" onClick={copyYesterday} className={`${secondary} flex w-full items-center justify-center gap-2`}>
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? "Zkopírováno ze včerejška" : "Zkopírovat včerejšek"}
            </button>
          )}
          <section className={card}>
            <label htmlFor="entry-date" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              Den
            </label>
            <input id="entry-date" type="date" max={today} value={date} onChange={(e) => changeDate(e.target.value)} className={`${input} ${dateTime} w-full`} />
          </section>
          {groups.map((g) => (
            <Fragment key={g.title}>
            <h2 className="-mb-1 px-1 pt-3 text-xs font-medium tracking-wider text-neutral-500 uppercase">{g.title}</h2>
            {g.templates.map((t) => (
            <section key={t.id} aria-labelledby={`entry-${t.id}`} className={card}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 id={`entry-${t.id}`} className="text-base font-semibold">
                  {t.name}
                </h3>
                {/* Routine days: copy yesterday's answer for this section (gratitude is meant to be fresh each day). */}
                {prevById[t.id] && t.type !== "gratitude" && (
                  <button
                    type="button"
                    onClick={() => set(t.id, initialState([t], prevById)[t.id])}
                    className="-my-2 flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
                  >
                    <Copy size={14} aria-hidden="true" /> Stejně jako včera
                  </button>
                )}
              </div>
              {body(t)}
            </section>
            ))}
            </Fragment>
          ))}

          <section className={card}>
            <label htmlFor="entry-note" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
              Poznámka ke dni <span className="font-normal normal-case tracking-normal text-neutral-500">(nepovinné)</span>
            </label>
            <textarea
              id="entry-note"
              rows={3}
              maxLength={1000}
              placeholder="Co se dnes dělo?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${input} w-full py-3`}
            />
          </section>

          {error && (
            <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
        {/* Save stays under the thumb: pinned to the bottom of the scrolling dialog. */}
        <div className="sticky bottom-0 z-10 border-t border-line bg-neutral-950/95 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          {!mood && <p className="mb-1.5 text-center text-xs text-neutral-500">Nejdřív vyber náladu nahoře.</p>}
          <button type="button" className={`${primary} flex w-full items-center justify-center gap-2`} onClick={save} disabled={!mood || saving}>
            {saved ? (
              <>
                <Check size={16} aria-hidden="true" /> Uloženo
              </>
            ) : saving ? (
              "Ukládám…"
            ) : (
              "Uložit záznam"
            )}
          </button>
        </div>
      </div>
      {/* Live region exists from the start so screen readers announce the toast when it appears. */}
      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.5rem)] z-20 flex justify-center">
        {saved && (
          <p className="flex items-center gap-2 rounded-xl border border-line bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-100 shadow-sm motion-safe:animate-toast-in">
            <Check size={16} className="text-accent2-text" aria-hidden="true" /> Záznam uložen
          </p>
        )}
      </div>
    </div>
  );
}
