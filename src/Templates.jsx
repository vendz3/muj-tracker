import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { api } from "./api.js";
import { groupTemplates } from "./sections.js";
import { GOALS, goalText } from "./goals.js";
import { card, checkRow, checkbox, input, primary } from "./ui.js";

// Optional metrics per template type: [config key, label]. The day entry shows a field only if its flag is on.
const FLAGS = {
  sleep: [
    ["quality", "Sledovat kvalitu (1–5)"],
    ["hours", "Sledovat, kolik hodin spíš"],
    ["times", "Sledovat, kdy usínáš a vstáváš"],
  ],
  sport: [["duration", "Sledovat délku tréninku (minuty)"]],
  reading: [
    ["minutes", "Sledovat minuty čtení"],
    ["pages", "Sledovat stránky"],
  ],
  food: [
    ["quality", "Sledovat, jak zdravě jíš (1–5)"],
    ["calories", "Sledovat kalorie"],
    ["alcohol", "Sledovat alkohol"],
    ["caffeine", "Sledovat kofein"],
    ["sugar", "Sledovat sladkosti"],
    ["sugary_drinks", "Sledovat slazené pití"],
    ["fast_food", "Sledovat fast food"],
    ["nicotine", "Sledovat nikotin"],
    ["meal_times", "Sledovat poslední sousto (čas)"],
  ],
  mind: [
    ["clarity", "Sledovat jasnou hlavu (1–5)"],
    ["energy", "Sledovat odpolední energii (1–5)"],
    ["frustration", "Sledovat podrážděnost (1–5)"],
  ],
  nap: [["grogginess", "Sledovat rozespalost po napu (1–5)"]],
  social: [["battery", "Sledovat sociální baterii (1–5)"]],
};


// Editable option lists in config (chips with ×, input + "Přidat"): which field, and its texts.
const LISTS = {
  sport: { field: "sports", title: "Sporty na výběr", none: "Zatím žádné sporty.", inputLabel: "Nový sport", placeholder: "např. florbal" },
  emotions: { field: "emotions", title: "Emoce na výběr", none: "Zatím žádné emoce.", inputLabel: "Nová emoce", placeholder: "např. klid" },
  social: { field: "kinds", title: "Typy kontaktu (seřaď od samoty po velkou partu)", none: "Zatím žádné typy.", inputLabel: "Nový typ kontaktu", placeholder: "např. rodina" },
  medication: { field: "items", title: "Co bereš (při zápisu jen odklikneš)", none: "Zatím nic. Přidej svoje suplementy a léky.", inputLabel: "Nový suplement nebo lék", placeholder: "např. vitamín D" },
};

// Fasting type is set once here, so the daily entry is a single yes/no tap.
function FastingSettings({ config, onChange }) {
  const [hours, setHours] = useState(config.hours);
  const option = (fullDay, text) => (
    <label className={checkRow}>
      <input type="radio" name="fasting-mode" className={checkbox} checked={config.full_day === fullDay} onChange={() => onChange({ ...config, full_day: fullDay })} />
      {text}
    </label>
  );
  function commit() {
    const h = Number(hours);
    if (h >= 1 && h <= 72 && h !== config.hours) onChange({ ...config, hours: h });
    else setHours(config.hours); // invalid -> back to the saved value
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Jaký půst držíš?</p>
      {option(true, "Celodenní")}
      {option(false, "Několikahodinový")}
      {!config.full_day && (
        <label className="flex items-center gap-2 pl-4 text-sm text-neutral-400">
          Délka
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={72}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className={`${input} w-24 px-3`}
          />
          h
        </label>
      )}
    </div>
  );
}

function ListEditor({ items, title, none, inputLabel, placeholder, onChange }) {
  const [draft, setDraft] = useState("");
  function add(e) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    if (!items.includes(name)) onChange([...items, name]);
    setDraft("");
  }
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 && <small className="text-neutral-500">{none}</small>}
        {items.map((s) => (
          <span key={s} className="flex items-center rounded-full border border-line bg-neutral-800 pl-4 text-sm text-neutral-200">
            {s}
            <button
              type="button"
              aria-label={`Odebrat ${s}`}
              onClick={() => onChange(items.filter((x) => x !== s))}
              className="size-11 rounded-full text-base text-neutral-500 hover:text-neutral-50"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={add}>
        <input aria-label={inputLabel} placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} className={`${input} min-w-0 flex-1`} />
        <button type="submit" className={primary}>
          Přidat
        </button>
      </form>
    </>
  );
}

// On/off switch (templates, goals). Stops the click so a surrounding clickable row doesn't toggle too.
export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label}: ${checked ? "zapnuto" : "vypnuto"}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className="flex h-12 w-16 shrink-0 items-center justify-center transition motion-safe:active:scale-95"
    >
      <span className={`relative h-8 w-14 rounded-full transition-colors ${checked ? "bg-accent-600" : "bg-neutral-700"}`}>
        <span className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : ""}`} />
      </span>
    </button>
  );
}

export default function Templates({ templates, onChange }) {
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null); // one expanded template at a time keeps the list short

  async function update(t, patch) {
    try {
      await api(`/templates/${t.id}`, "PUT", {
        is_active: patch.is_active ?? t.is_active,
        config_json: patch.config_json ?? t.config_json,
      });
      setError("");
      onChange();
    } catch (e) {
      setError(`Uložení nastavení selhalo: ${e.message}`);
    }
  }

  // Goals are set in Nastavení -> Cíle; here only shown read-only.
  function goalLine(t, meta) {
    const goal = t.config_json.goals?.[meta.key];
    return goal && (
      <p key={meta.key} className="pl-4 text-sm text-neutral-500">
        Aktuální cíl: {goalText(goal, meta.dir, meta.unit)}
        {meta.per ? ` ${meta.per}` : ""}
      </p>
    );
  }

  return (
    <section className="space-y-3">
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {/* Same sections and order as the day entry and the charts (sections.js); unknown types land in "Ostatní". */}
      {groupTemplates(templates).map(({ title: heading, templates: group }) => {
        return group.length > 0 && (
          <div key={heading} className="space-y-3 pt-2 first:pt-0">
            <h2 className="px-1 text-xs font-medium tracking-wider text-neutral-500 uppercase">{heading}</h2>
      {group.map((t) => {
        const open = openId === t.id;
        const flags = FLAGS[t.type] ?? [];
        const goals = GOALS[t.type] ?? [];
        return (
          <div key={t.id} className={card}>
            {/* Whole header toggles the panel; the switch stops propagation so it only flips is_active. */}
            <div className="flex cursor-pointer items-center gap-2" onClick={() => setOpenId(open ? null : t.id)}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`template-${t.id}`}
                className="flex min-h-12 flex-1 items-center gap-2 text-left"
              >
                <ChevronDown
                  size={22}
                  aria-hidden="true"
                  className={`shrink-0 text-neutral-500 transition-transform duration-200 ${open ? "rotate-180 text-accent-400" : ""}`}
                />
                <span className={`text-sm font-semibold ${t.is_active ? "" : "text-neutral-500"}`}>{t.name}</span>
              </button>
              <Switch checked={t.is_active} label={t.name} onChange={(on) => update(t, { is_active: on })} />
            </div>

            {/* grid-rows 0fr -> 1fr animates height without measuring; inert keeps hidden controls out of tab order. */}
            <div
              id={`template-${t.id}`}
              inert={!open}
              className={`grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className="mt-3 space-y-3 rounded-xl border border-line bg-neutral-950 p-3">
                  {LISTS[t.type] && (
                    <ListEditor
                      {...LISTS[t.type]}
                      items={t.config_json[LISTS[t.type].field]}
                      onChange={(list) => update(t, { config_json: { ...t.config_json, [LISTS[t.type].field]: list } })}
                    />
                  )}

                  {t.type === "fasting" && <FastingSettings config={t.config_json} onChange={(config_json) => update(t, { config_json })} />}

                  {flags.map(([key, label]) => {
                    const meta = goals.find((g) => g.flag === key);
                    return (
                      <div key={key} className="space-y-2">
                        <label className={checkRow}>
                          <input
                            type="checkbox"
                            className={checkbox}
                            checked={t.config_json[key]}
                            onChange={(e) => update(t, { config_json: { ...t.config_json, [key]: e.target.checked } })}
                          />
                          {label}
                        </label>
                        
                        {meta && t.config_json[key] && goalLine(t, meta)}
                      </div>
                    );
                  })}

                  {goals.filter((g) => !g.flag).map((meta) => goalLine(t, meta))}

                  {!LISTS[t.type] && t.type !== "fasting" && flags.length === 0 && !goals.some((g) => t.config_json.goals?.[g.key]) && (
                    <p className="text-sm text-neutral-500">Tady není co nastavovat – stačí zapnout.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
          </div>
        );
      })}
    </section>
  );
}
