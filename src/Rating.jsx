export default function Rating({ value, onChange, labels, label }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-pressed={value === n}
          aria-label={`${label} ${n} z 5`}
          className={`min-h-12 rounded-xl border-2 font-semibold transition active:scale-95 ${labels ? "text-3xl" : "text-lg"} ${
            value === n
              ? "border-violet-500 bg-violet-500/20 text-neutral-50"
              : "border-neutral-800 bg-neutral-800 text-neutral-300 hover:border-neutral-600"
          }`}
        >
          {labels ? labels[n - 1] : n}
        </button>
      ))}
    </div>
  );
}
