import {
  Bike, Book, Brain, Code, Coffee, Dumbbell, Gauge, Hash, Heart, Languages, Leaf, Monitor, Moon, Music, Pencil, Pill, Smile, Sun, ToggleLeft, Wallet, X, Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addTemplate } from "./api.js";
import { Switch } from "./Templates.jsx";
import { input, primary, secondary } from "./ui.js";

// Icons a custom template can pick; stored by name in config_json.icon.
export const CUSTOM_ICONS = { Book, Coffee, Dumbbell, Zap, Monitor, Brain, Pill, Sun, Moon, Heart, Music, Pencil, Leaf, Bike, Code, Languages, Wallet, Smile };
export function TemplateIcon({ t, size = 18 }) {
  const I = t.type === "custom" && CUSTOM_ICONS[t.config_json.icon];
  return I ? <I size={size} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-neutral-400" /> : null;
}

const KINDS = [
  ["bool", "Ano / Ne", ToggleLeft, "splněný zvyk"],
  ["number", "Číslo", Hash, "přesná hodnota"],
  ["rating", "Škála 1–10", Gauge, "subjektivní úroveň"],
];
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500";
const choice = (on) =>
  `rounded-xl border transition motion-safe:active:scale-95 ${on ? "border-accent-500 bg-accent-500/10 text-neutral-50" : "border-line bg-neutral-900 text-neutral-400 hover:bg-neutral-800"}`;

// "+ Nová šablona": name, icon, kind, optional goal. Native <dialog>: Escape, focus trap and backdrop for free.
export default function NewTemplateModal({ onSaved, onCancel }) {
  const ref = useRef(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Book");
  const [kind, setKind] = useState("bool");
  const [unit, setUnit] = useState("");
  const [better, setBetter] = useState("high");
  const [dir, setDir] = useState("min");
  const [goalOn, setGoalOn] = useState(false);
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ref.current.showModal();
  }, []);

  async function save(e) {
    e.preventDefault();
    const value = kind === "bool" ? 1 : Number(goal);
    if (goalOn && kind !== "bool" && (goal === "" || !(kind === "rating" ? value >= 1 && value <= 10 : value >= 0)))
      return setError(kind === "rating" ? "Cíl škály musí být 1–10." : "Zadej cíl jako nezáporné číslo.");
    const config_json = {
      icon,
      kind,
      ...(kind === "number" && { unit: unit.trim(), dir }),
      ...(kind === "rating" && { better }),
      goals: goalOn ? { value: { value } } : {},
    };
    setSaving(true);
    try {
      await addTemplate({ name, config_json });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      aria-labelledby="new-template-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-neutral-900 p-0 text-neutral-100 backdrop:bg-black/60"
    >
      <form onSubmit={save} className="max-h-[85dvh] space-y-5 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <h2 id="new-template-title" className="text-base font-semibold">
            Nová šablona
          </h2>
          <button type="button" onClick={() => ref.current.close()} aria-label="Zavřít" className="-mr-2 flex size-11 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div>
          <label htmlFor="tpl-name" className={label}>
            Název
          </label>
          <input id="tpl-name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Studená sprcha" className={`${input} w-full`} />
        </div>

        <div>
          <p className={label}>Ikona</p>
          <div role="group" aria-label="Ikona" className="grid grid-cols-6 gap-1.5">
            {Object.entries(CUSTOM_ICONS).map(([key, I]) => (
              <button key={key} type="button" aria-label={key} aria-pressed={icon === key} onClick={() => setIcon(key)} className={`${choice(icon === key)} flex aspect-square items-center justify-center`}>
                <I size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={label}>Typ měření</p>
          <div role="group" aria-label="Typ měření" className="grid grid-cols-3 gap-1.5">
            {KINDS.map(([key, text, I, desc]) => (
              <button key={key} type="button" aria-pressed={kind === key} onClick={() => setKind(key)} className={`${choice(kind === key)} flex flex-col items-center gap-1 px-1 py-2.5`}>
                <I size={18} strokeWidth={1.75} aria-hidden="true" />
                <span className="text-sm font-medium">{text}</span>
                <span className="text-[11px] leading-tight text-neutral-500">{desc}</span>
              </button>
            ))}
          </div>
          {kind === "number" && (
            <input aria-label="Jednotka" maxLength={12} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Jednotka (volitelné), např. str." className={`${input} mt-2 w-full`} />
          )}
          {kind === "rating" && (
            <div role="group" aria-label="Lepší je" className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
              {[["high", "Lepší je vyšší"], ["low", "Lepší je nižší"]].map(([k, t]) => (
                <button key={k} type="button" aria-pressed={better === k} onClick={() => setBetter(k)} className={`${choice(better === k)} min-h-11`}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className={`${label} mb-0`}>Cíl</p>
            <Switch checked={goalOn} label="Cíl" onChange={setGoalOn} />
          </div>
          {goalOn && kind === "bool" && <p className="text-sm text-neutral-400">Každý den ano.</p>}
          {goalOn && kind !== "bool" && (
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              {kind === "number" ? (
                <select aria-label="Směr cíle" value={dir} onChange={(e) => setDir(e.target.value)} className={`${input} px-3`}>
                  <option value="min">aspoň</option>
                  <option value="max">nejvýš</option>
                </select>
              ) : (
                <span>{better === "high" ? "aspoň" : "nejvýš"}</span>
              )}
              <input
                type="number"
                inputMode="decimal"
                aria-label="Hodnota cíle"
                min={kind === "rating" ? 1 : 0}
                max={kind === "rating" ? 10 : undefined}
                step="any"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className={`${input} w-24 px-3`}
              />
              <span>{kind === "number" ? unit : "z 10"} denně</span>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => ref.current.close()} className={secondary}>
            Zrušit
          </button>
          <button type="submit" disabled={saving || !name.trim()} className={primary}>
            Uložit šablonu
          </button>
        </div>
      </form>
    </dialog>
  );
}
