// Shared Tailwind classes; every tap target is at least 48px (min-h-12) high.
export const card = "rounded-2xl bg-neutral-900 p-4 ring-1 ring-line";
export const input =
  "min-h-12 rounded-xl border border-neutral-700 bg-neutral-800 px-4 text-base text-neutral-50 placeholder:text-neutral-500 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/40";
export const checkRow =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-neutral-800 px-4 has-[:checked]:bg-accent-500/15 has-[:checked]:ring-1 has-[:checked]:ring-accent-500/50";
export const checkbox = "size-6 shrink-0 cursor-pointer accent-accent-500";
export const btn =
  "min-h-12 rounded-xl px-5 font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";
// --accent-fill / --accent-glow exist only in themes that define them (gradient + hover glow); elsewhere they're no-ops.
const accentFx = "bg-(image:--accent-fill) hover:shadow-[0_8px_24px_-6px_var(--accent-glow,#0000)]";
export const primary = `${btn} bg-accent-600 text-on-accent hover:bg-accent-500 ${accentFx}`;
export const secondary = `${btn} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`;
