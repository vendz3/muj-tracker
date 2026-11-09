// captions: optional words under the labels (mood: "Hrozná" … "Skvělá"), so the emoji never stands alone.
// options: other values than the 1–5 scale (food counts 0–5+); labels / captions follow their order.
// reverse: show the best value first (mood: 😄 on the left) without changing the stored values.
const SCALE = [1, 2, 3, 4, 5];
// cols: buttons per row (RPE 1–10 in 2 rows of 5 keeps every tap target >= 48 px on a phone).
export default function Rating({ value, onChange, labels, captions, label, options, reverse = false, cols }) {
  const values = options ?? SCALE;
  const shown = reverse ? [...values].reverse() : values;
  return (
    <div role="group" aria-label={label} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols ?? values.length}, minmax(0, 1fr))` }}>
      {shown.map((n) => {
        const i = values.indexOf(n); // labels / captions are indexed by value, not by screen position
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            aria-label={options ? `${label} ${labels?.[i] ?? n}` : `${label} ${n} z 5${captions ? `, ${captions[i]}` : ""}`}
            className={`min-h-11 rounded-xl border font-medium tabular-nums transition motion-safe:active:scale-95 ${labels && !options ? "text-2xl" : "text-sm"} ${
              value === n
                ? "border-accent-500 bg-accent-500/10 text-neutral-50"
                : "border-line bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            {labels ? labels[i] : n}
            {captions && <span className="block text-[10px] leading-tight font-medium tracking-wide text-neutral-500 uppercase">{captions[i]}</span>}
          </button>
        );
      })}
    </div>
  );
}
