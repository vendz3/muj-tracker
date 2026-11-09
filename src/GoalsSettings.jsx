import { useRef, useState } from "react";
import { api } from "./api.js";
import { DIR_WORD, GOALS, goalText, unitFor } from "./goals.js";
import { Switch } from "./Templates.jsx";
import { card, cardTitle, input } from "./ui.js";

// One goal field ("Cíl: aspoň [7] h"; calories: "Cíl [2200] ± [200] kcal"). Saves on blur / Enter,
// not per keystroke; empty value removes the goal. Local state, so a save doesn't steal focus.
function GoalInput({ meta, goal, off, onSave, onToggle, onInvalid }) {
  const [value, setValue] = useState(goal?.value ?? "");
  const [tol, setTol] = useState(goal?.tolerance ?? meta.defaultTolerance ?? "");
  const range = meta.dir === "range";
  const valueRef = useRef(null);
  const tolRef = useRef(null);

  // Read the inputs themselves: on a fast type-and-leave the state may not have re-rendered yet.
  function commit() {
    const raw = valueRef.current.value;
    const rawTol = tolRef.current?.value ?? "";
    if (raw === "") return goal && onSave(null);
    const v = Number(raw);
    const t = Number(rawTol === "" ? meta.defaultTolerance : rawTol);
    if (!(v >= meta.min && v <= meta.max)) return onInvalid(`Cíl „${meta.label}“ musí být mezi ${meta.min} a ${meta.max}.`);
    if (range && !(t >= 0 && t <= 5000)) return onInvalid("Tolerance musí být mezi 0 a 5000.");
    const next = range ? { value: v, tolerance: t } : { value: v };
    if (goal?.value !== next.value || goal?.tolerance !== next.tolerance) onSave(next);
  }

  const field = (ref, val, set, aria, width, placeholder) => (
    <input
      ref={ref}
      type="number"
      inputMode="decimal"
      step={meta.step}
      min={0}
      aria-label={aria}
      placeholder={placeholder}
      value={val}
      onChange={(e) => set(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={`${input} ${width} px-3`}
    />
  );
  const word = DIR_WORD[meta.dir];
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-xs font-medium uppercase tracking-wider ${goal ? "text-neutral-400" : "text-neutral-600"}`}>{meta.label}</p>
          {!goal && <p className="text-xs text-neutral-600">vypnuto{off ? ` · naposledy ${goalText(off, meta)}` : ""}</p>}
        </div>
        <Switch checked={!!goal} label={`Cíl ${meta.label}`} onChange={onToggle} />
      </div>
      {goal && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-400">
        <span>Cíl{word ? `: ${word}` : ""}</span>
        {field(valueRef, value, setValue, `Cíl ${meta.label}`, "w-24", "–")}
        {range && (
          <>
            <span>±</span>
            {field(tolRef, tol, setTol, `Tolerance cíle ${meta.label}`, "w-20", String(meta.defaultTolerance))}
          </>
        )}
        <span>
          {unitFor(meta, Number(value) || 0)}
          {meta.per ? ` ${meta.per}` : ""}
        </span>
        </div>
      )}
    </div>
  );
}

// Goals only for active templates and their tracked metrics; stored in config_json.goals.
export default function GoalsSettings({ templates, onChange }) {
  const [error, setError] = useState("");

  // Switched-off goals move to config_json.goalsOff, so everything that reads `goals` ignores them and the value
  // comes back when switched on again (first time: the metric's default).
  async function saveGoal(t, key, goal, toggle) {
    const goals = { ...(t.config_json.goals ?? {}) };
    const goalsOff = { ...(t.config_json.goalsOff ?? {}) };
    if (toggle === "on") {
      const meta = GOALS[t.type].find((m) => m.key === key);
      goals[key] = goalsOff[key] ?? (meta.dir === "range" ? { value: meta.def, tolerance: meta.defaultTolerance } : { value: meta.def });
      delete goalsOff[key];
    } else if (toggle === "off") {
      goalsOff[key] = goals[key];
      delete goals[key];
    } else if (goal) goals[key] = goal;
    else delete goals[key]; // emptied field = off, nothing to keep
    try {
      await api(`/templates/${t.id}`, "PUT", { is_active: t.is_active, config_json: { ...t.config_json, goals, goalsOff } });
      setError("");
      onChange();
    } catch (e) {
      setError(`Uložení cíle selhalo: ${e.message}`);
    }
  }

  const rows = templates
    .filter((t) => t.is_active)
    .map((t) => [t, (GOALS[t.type] ?? []).filter((m) => !m.flag || t.config_json[m.flag])])
    .filter(([, metas]) => metas.length);

  return (
    <section className="space-y-3">
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {rows.length === 0 && <p className="text-neutral-500">Zatím nemáš co měřit. Zapni si v Šablonách třeba spánek nebo pitný režim.</p>}
      {rows.map(([t, metas]) => (
        <div key={t.id} className={`${card} space-y-3`}>
          <h2 className={cardTitle}>{t.name}</h2>
          {metas.map((meta) => (
            <GoalInput
              key={meta.key}
              meta={meta}
              goal={t.config_json.goals?.[meta.key]}
              off={t.config_json.goalsOff?.[meta.key]}
              onSave={(g) => saveGoal(t, meta.key, g)}
              onToggle={(on) => saveGoal(t, meta.key, null, on ? "on" : "off")}
              onInvalid={setError}
            />
          ))}
        </div>
      ))}
    </section>
  );
}
