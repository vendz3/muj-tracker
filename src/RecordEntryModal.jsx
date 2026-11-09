import { Copy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Rating from "./Rating.jsx";
import { api } from "./api.js";
import { entryOrder } from "./chartData.js";
import { GOALS, goalText } from "./goals.js";
import { card, checkRow, checkbox, input, primary } from "./ui.js";

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
export const sleptHours = (bed, wake) => (bed && wake ? Math.round(((clockH(wake) - clockH(bed) + 24) % 24) * 4) / 4 : null);
const FIELDS = {
  sleep: [
    { key: "sleep_quality", flag: "quality", kind: "rating", label: "Kvalita spánku" },
    { key: "bedtime", flag: "times", kind: "time", label: "Usnul(a) jsem", hint: "včera večer" },
    { key: "waketime", flag: "times", kind: "time", label: "Vstal(a) jsem" },
    { key: "sleep_hours", flag: "hours", kind: "number", label: "Čas spánku (hodiny)", step: 0.5, max: 24, slider: [12, 0.5], placeholder: "např. 7,5" },
  ],
  food: [
    { key: "calories", flag: "calories", kind: "number", label: "Kalorie (kcal)", step: 1, max: 20000, slider: [5000, 50], placeholder: "např. 2100" },
    { key: "quality", flag: "quality", kind: "rating", label: "Kvalita jídla" },
    { key: "drinks", flag: "alcohol", kind: "count", label: "Alkohol (drinky)", hint: "1 drink = pivo 0,5 l · víno 2 dl · panák 4 cl" },
    { key: "coffee", flag: "caffeine", kind: "count", label: "Kofein (šálky)", hint: "káva, energy drink, silný čaj" },
    { key: "sweets", flag: "sugar", kind: "count", label: "Sladkosti (porce)", hint: "sušenka, zákusek, slazený nápoj" },
    { key: "meal_gap_h", flag: "last_meal", kind: "number", label: "Poslední jídlo před spaním (hodiny)", hint: "0 = těsně před spaním", step: 0.5, max: 12, slider: [8, 0.5], placeholder: "např. 3" },
  ],
  mind: [
    { key: "clarity", flag: "clarity", kind: "rating", label: "Mentální jasnost", hint: "1 = mlha, 5 = křišťálově jasno" },
    { key: "energy", flag: "energy", kind: "rating", label: "Odpolední energie (14–16 h)", hint: "1 = padám, 5 = plný(á) energie" },
    { key: "frustration", flag: "frustration", kind: "rating", label: "Frustrace / podrážděnost", hint: "1 = klid, 5 = všechno mě štve" },
  ],
  // needs: shown (and saved) only when that field is filled; grogginess means nothing without a nap.
  nap: [
    { key: "minutes", kind: "number", label: "Délka napu (minuty)", hint: "nespal(a) jsi? nech prázdné", step: 1, min: 1, max: 180, slider: [90, 5], placeholder: "např. 20" },
    { key: "grogginess", flag: "grogginess", needs: "minutes", kind: "rating", label: "Rozespalost po probuzení", hint: "1 = svěží, 5 = jako po narkóze" },
  ],
  water: [{ key: "liters", kind: "number", label: "Vypito (litry)", step: 0.25, max: 20, slider: [5, 0.25], placeholder: "např. 1,5" }],
  steps: [{ key: "steps", kind: "number", label: "Počet kroků", step: 1, max: 200000, slider: [30000, 500], placeholder: "např. 8000" }],
  // Hours come from the fasting type set in settings (see fastingHours), so the day is one tap.
  fasting: [{ key: "fasted", kind: "bool", label: "Držel(a) jsi dnes půst?", hint: (c) => (c.full_day ? "celodenní" : `${String(c.hours).replace(".", ",")} h`) }],
  screen_time: [{ key: "minutes", kind: "number", label: "Čas u obrazovky (minuty)", step: 1, max: 1440, slider: [600, 15], placeholder: "např. 120" }],
  reading: [
    { key: "minutes", flag: "minutes", kind: "number", label: "Čtení (minuty)", step: 1, min: 1, max: 1440, slider: [180, 5], placeholder: "např. 30" },
    { key: "pages", flag: "pages", kind: "number", label: "Přečteno (stránky)", step: 1, min: 1, max: 5000, slider: [200, 5], placeholder: "např. 20" },
  ],
  meditation: [{ key: "minutes", kind: "number", label: "Meditace (minuty)", step: 1, min: 1, max: 1440, slider: [60, 1], placeholder: "např. 10" }],
  stress: [{ key: "stress", kind: "rating", label: "Míra stresu", labels: ["😌", "🙂", "😐", "😟", "😫"], hint: "od klidu po hodně stresu" }],
};
const PROMPTS = { sleep: "Jak ses vyspal(a)?", water: "Kolik jsi dnes vypil(a)?" };
// Pick-from-list templates: tap the options set in settings. [config list, data key, prompt, text when the list is empty]
const PICKS = {
  emotions: { config: "emotions", data: "emotions", prompt: "Jaké emoce jsi dnes cítil(a)? Zaškrtni všechny, které přišly." },
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

// Number box for exact typing + a slider under it for a quick thumb drag; both edit the same value.
// slider = [max, step]: a practical range, smaller than the validation max (bigger numbers can still be typed).
// An empty value ("") leaves the slider at its minimum but saves nothing until it is moved.
function NumberField({ id, label, name, value, onChange, min = 0, max, step, slider, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-neutral-400">
        {label}
      </label>
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
        className={`${input} w-full`}
      />
      {slider && (
        <input
          type="range"
          aria-label={`${name ?? label}, posuvník`}
          min={min}
          max={slider[0]}
          step={slider[1]}
          value={value === "" ? min : Math.min(Number(value), slider[0])}
          onChange={(e) => onChange(e.target.value)}
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

  // Stress right after mood (entryOrder): both are "how was the day" at a glance. The dashboard uses the same order.
  const sections = [{ id: "mood", type: "mood", name: "Nálada" }, ...entryOrder(active)];
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
      leave(onDone);
    } catch (e) {
      setError(`Uložení selhalo: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  function body(current) {
    if (current.type === "mood")
      return (
        <>
          <p className="mb-3 text-neutral-400">Jak se dnes cítíš?</p>
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
          <p className="mb-3 text-neutral-400">{pick.prompt}</p>
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
          <p className="text-neutral-400">Za jaké tři věci jsi dnes vděčný(á)?</p>
          {v.map((text, i) => (
            <label key={i} className="block">
              <span className="mb-1 block text-sm text-neutral-500">Věc {i + 1}</span>
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
          <p className="mb-3 text-neutral-400">S kým jsi dnes byl(a) v kontaktu? Zaškrtni všechno, co platí.</p>
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
              <p className="mb-1 text-neutral-400">
                Sociální baterie <span className="text-sm text-neutral-500">(dodalo ti to energii, nebo ji vzalo?)</span>
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
          <p className="mb-3 text-neutral-400">Co jsi dnes dělal(a)? {goalHint(current)}</p>
          <div className="space-y-2">
            {names.map((name) => (
              <div key={name}>
                <label className={checkRow}>
                  <input type="checkbox" className={checkbox} checked={name in v} onChange={() => toggle(name)} />
                  <span className="first-letter:uppercase">{name}</span>
                </label>
                {name in v && (
                  <div className="mt-2 mb-3 space-y-2 pl-2">
                    <p className="text-sm text-neutral-500">
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
                        slider={[240, 5]}
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
        <div className="space-y-4">
          {PROMPTS[current.type] && <p className="text-neutral-400">{PROMPTS[current.type]}</p>}
          {fields.map((f) =>
            f.kind === "bool" ? (
              <div key={f.key}>
                <p className="mb-1 text-neutral-400">
                  {f.label} {f.hint && <span className="text-sm text-neutral-500">({f.hint(current.config_json)})</span>}
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
                      className={`min-h-12 rounded-xl border-2 font-semibold transition active:scale-95 ${
                        v[f.key] === val ? "border-accent-500 bg-accent-500/20 text-neutral-50" : "border-neutral-800 bg-neutral-800 text-neutral-300 hover:border-neutral-600"
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ) : f.kind === "time" ? (
              <label key={f.key} className="block">
                <span className="mb-1 block text-neutral-400">
                  {f.label} {f.hint && <span className="text-sm text-neutral-500">({f.hint})</span>}
                </span>
                <input type="time" value={v[f.key]} onChange={(e) => setField(f.key, e.target.value)} className={`${input} w-full`} />
              </label>
            ) : f.kind === "text" ? (
              <label key={f.key} className="block">
                <span className="mb-1 block text-neutral-400">{f.label}</span>
                <input maxLength={f.max} placeholder={f.placeholder} value={v[f.key]} onChange={(e) => setField(f.key, e.target.value)} className={`${input} w-full`} />
              </label>
            ) : f.kind === "rating" || f.kind === "count" ? (
              <div key={f.key}>
                <p className="mb-1 text-neutral-400">
                  {f.label} {f.hint && <span className="text-sm text-neutral-500">({f.hint})</span>}
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
                    {f.label} {f.hint && <span className="text-sm text-neutral-500">({f.hint})</span>} {goalHint(current, f.key)}
                  </>
                }
                value={v[f.key]}
                onChange={(val) => setField(f.key, val)}
                min={f.min}
                max={f.max}
                step={f.step}
                slider={f.slider}
                // Both sleep times given: show what saving will compute when hours stay empty.
                placeholder={f.key === "sleep_hours" && autoHours ? `vypočteno: ${String(autoHours).replace(".", ",")} h` : f.placeholder}
              />
            ),
          )}
          {fields.length === 0 && <p className="text-neutral-400">V nastavení u této šablony nesleduješ nic. Zapni si aspoň jednu metriku.</p>}
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
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-neutral-950 motion-safe:animate-slide-up"
    >
      <div className="mx-auto min-h-full w-full max-w-md">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-950/95 px-4 py-2 backdrop-blur">
          <h2 id="entry-title" className="text-xl font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => history.back()}
            aria-label="Zavřít bez uložení"
            autoFocus
            className="-mr-2 flex size-12 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
          >
            <X size={26} aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-col gap-6 px-4 pt-4 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))]">
          <section className={card}>
            <label htmlFor="entry-date" className="mb-2 block text-lg font-semibold">
              Den
            </label>
            <input id="entry-date" type="date" max={today} value={date} onChange={(e) => changeDate(e.target.value)} className={`${input} w-full`} />
          </section>
          {sections.map((t) => (
            <section key={t.id} aria-labelledby={`entry-${t.id}`} className={card}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 id={`entry-${t.id}`} className="text-lg font-semibold">
                  {t.name}
                </h3>
                {/* Routine days: copy yesterday's answer for this section (gratitude is meant to be fresh each day). */}
                {prevById[t.id] && t.type !== "gratitude" && (
                  <button
                    type="button"
                    onClick={() => set(t.id, initialState([t], prevById)[t.id])}
                    className="-my-2 flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-accent-300 hover:bg-neutral-800"
                  >
                    <Copy size={16} aria-hidden="true" /> Stejně jako včera
                  </button>
                )}
              </div>
              {body(t)}
            </section>
          ))}

          <section className={card}>
            <label htmlFor="entry-note" className="mb-2 block text-lg font-semibold">
              Poznámka ke dni <span className="text-sm font-normal text-neutral-500">(nepovinné)</span>
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
            <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-red-400">
              {error}
            </p>
          )}
          <div>
            <button type="button" className={`${primary} w-full text-lg`} onClick={save} disabled={!mood || saving}>
              {saving ? "Ukládám…" : "Uložit záznam"}
            </button>
            {!mood && <p className="mt-2 text-center text-sm text-neutral-500">Nejdřív vyber náladu nahoře.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
