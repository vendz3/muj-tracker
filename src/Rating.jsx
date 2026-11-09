// captions: optional words under the labels (mood: "Hrozná" … "Skvělá"), so the emoji never stands alone.
// options: other values than the 1–5 scale (food counts 0–5+); labels / captions follow their order.
const SCALE = [1, 2, 3, 4, 5];
export default function Rating({ value, onChange, labels, captions, label, options }) {
  const values = options ?? SCALE;
  return (
    <div role="group" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
      {values.map((n, i) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-pressed={value === n}
          aria-label={options ? `${label} ${labels?.[i] ?? n}` : `${label} ${n} z 5${captions ? `, ${captions[i]}` : ""}`}
          className={`min-h-12 rounded-xl border-2 font-semibold transition active:scale-95 ${labels && !options ? "text-3xl" : "text-lg"} ${
            value === n
              ? "border-accent-500 bg-accent-500/20 text-neutral-50"
              : "border-neutral-800 bg-neutral-800 text-neutral-300 hover:border-neutral-600"
          }`}
        >
          {labels ? labels[i] : n}
          {captions && <span className="block text-[11px] leading-tight font-medium text-neutral-400">{captions[i]}</span>}
        </button>
      ))}
    </div>
  );
}
