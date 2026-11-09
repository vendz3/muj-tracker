import { Check } from "lucide-react";
import { THEMES } from "./themes.js";
import { card } from "./ui.js";

// Theme cards as a radio group: name, one-line description, palette preview, check on the chosen one.
// Each card previews itself in its own colors, whatever theme is active.
export default function ThemePicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Motiv aplikace" className="space-y-3">
      {THEMES.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(t.id)}
            className={`${card} flex min-h-12 w-full items-center gap-4 text-left transition active:scale-[0.98] ${
              selected ? "ring-2 ring-violet-500" : "hover:bg-neutral-800"
            }`}
          >
            <span
              className="flex h-14 w-16 shrink-0 flex-col justify-between rounded-xl p-2 ring-1 ring-neutral-50/10"
              style={{ background: t.bg }}
              aria-hidden="true"
            >
              <span className="h-2 w-10 rounded-full" style={{ background: t.text }} />
              <span className="flex gap-1">
                <span className="size-3 rounded-full" style={{ background: t.accent }} />
                <span className="size-3 rounded-full" style={{ background: t.accent2 }} />
                <span className="size-3 rounded-full ring-1 ring-black/10" style={{ background: t.card }} />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t.name}</span>
              <span className="block text-sm text-neutral-500">{t.description}</span>
            </span>
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full ${selected ? "bg-violet-600 text-on-accent" : "ring-2 ring-neutral-700"}`}
              aria-hidden="true"
            >
              {selected && <Check size={18} strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
