import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { api } from "./api.js";
import { GOALS, goalText } from "./goals.js";
import { card, checkRow, checkbox, input, primary } from "./ui.js";

// Optional metrics per template type: [config key, label]. The day entry shows a field only if its flag is on.
const FLAGS = {
  sleep: [
    ["quality", "Sledovat kvalitu (1–5)"],
    ["hours", "Sledovat čas (hodiny)"],
    ["times", "Sledovat čas usnutí a vstávání"],
  ],
  sport: [["duration", "Sledovat trvání (minuty)"]],
  reading: [
    ["minutes", "Sledovat čas (minuty)"],
    ["pages", "Sledovat stránky"],
  ],
  food: [
    ["calories", "Sledovat kalorie"],
    ["quality", "Sledovat kvalitu (1–5)"],
    ["alcohol", "Sledovat alkohol (drinky)"],
    ["caffeine", "Sledovat kofein (šálky)"],
    ["sugar", "Sledovat sladkosti (porce)"],
    ["last_meal", "Sledovat poslední jídlo před spaním"],
  ],
  mind: [
    ["clarity", "Sledovat mentální jasnost (1–5)"],
    ["energy", "Sledovat odpolední energii (1–5)"],
    ["frustration", "Sledovat frustraci (1–5)"],
  ],
  nap: [["grogginess", "Sledovat rozespalost po napu (1–5)"]],
  social: [["battery", "Sledovat sociální baterii (1–5)"]],
};

// Settings sections: [heading, template types]. A type not listed lands in "Ostatní" so it never disappears.
const CATEGORIES = [
  ["Zdraví a tělo", ["sleep", "nap", "sport", "food", "water", "steps", "fasting", "medication"]],
  ["Produktivita", ["screen_time", "reading"]],
  ["Duševní zdraví", ["mind", "emotions", "social", "gratitude", "meditation", "stress"]],
];
const KNOWN = CATEGORIES.flatMap(([, types]) => types);

// Editable option lists in config (chips with ×, input + "Přidat"): which field, and its texts.
const LISTS = {
  sport: { field: "sports", title: "Sporty na výběr", none: "Zatím žádné sporty.", inputLabel: "Nový sport", placeholder: "např. florbal" },
  emotions: { field: "emotions", title: "Emoce na výběr", none: "Zatím žádné emoce.", inputLabel: "Nová emoce", placeholder: "např. klid" },
  social: { field: "kinds", title: "Typy kontaktu (pořadí = od žádného po největší skupinu)", none: "Zatím žádné typy.", inputLabel: "Nový typ kontaktu", placeholder: "např. rodina" },
  medication: { field: "items", title: "Co bereš (při zápisu jen klikneš)", none: "Zatím nic. Přidej svoje suplementy a léky.", inputLabel: "Nový suplement nebo lék", placeholder: "např. vitamín D" },
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
      <p className="text-sm text-neutral-400">Jaký půst držíš?</p>
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
      <p className="text-sm text-neutral-400">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 && <small className="text-neutral-500">{none}</small>}
        {items.map((s) => (
          <span key={s} className="flex items-center rounded-full bg-accent-500/15 pl-4 text-accent-200">
            {s}
            <button
              type="button"
              aria-label={`Odebrat ${s}`}
              onClick={() => onChange(items.filter((x) => x !== s))}
              className="size-11 rounded-full text-lg text-accent-300 hover:text-neutral-50"
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
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-red-400">
          {error}
        </p>
      )}
      {[...CATEGORIES, ["Ostatní", templates.map((t) => t.type).filter((x) => !KNOWN.includes(x))]].map(([heading, types]) => {
        const group = templates.filter((t) => types.includes(t.type));
        return group.length > 0 && (
          <div key={heading} className="space-y-3 pt-2 first:pt-0">
            <h2 className="px-1 text-sm font-semibold tracking-wide text-neutral-500 uppercase">{heading}</h2>
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
                <span className={`text-lg font-semibold ${t.is_active ? "" : "text-neutral-500"}`}>{t.name}</span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={t.is_active}
                aria-label={`${t.name}: ${t.is_active ? "zapnuto" : "vypnuto"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  update(t, { is_active: !t.is_active });
                }}
                className="flex h-12 w-16 shrink-0 items-center justify-center"
              >
                <span className={`relative h-8 w-14 rounded-full transition-colors ${t.is_active ? "bg-accent-600" : "bg-neutral-700"}`}>
                  <span
                    className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform ${t.is_active ? "translate-x-6" : ""}`}
                  />
                </span>
              </button>
            </div>

            {/* grid-rows 0fr -> 1fr animates height without measuring; inert keeps hidden controls out of tab order. */}
            <div
              id={`template-${t.id}`}
              inert={!open}
              className={`grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className="mt-3 space-y-3 rounded-xl bg-neutral-950/60 p-3 ring-1 ring-neutral-50/5">
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
                    <p className="text-sm text-neutral-500">Tato šablona nemá další nastavení.</p>
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
