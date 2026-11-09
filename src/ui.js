// Shared Tailwind classes; every tap target is at least 44px (min-h-11) high.
// Look: soft (rounded-xl, cards rounded-2xl), flat (1px theme borders instead of shadows), accent only where it means something.
export const card = "rounded-2xl border border-line bg-neutral-900 p-3";
export const input =
  "min-h-11 rounded-xl border border-line bg-neutral-950 px-3 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";
export const checkRow =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-neutral-900 px-3 text-sm hover:bg-neutral-800 has-[:checked]:border-accent-500/60 has-[:checked]:bg-accent-500/10 transition motion-safe:active:scale-[0.99]";
// Card heading: a clear title plus one line saying what the card shows and how to read it.
export const cardTitle = "text-base font-semibold text-neutral-100";
export const cardDesc = "text-xs text-neutral-500";
export const checkbox = "size-5 shrink-0 cursor-pointer accent-accent-500";
export const btn = "min-h-11 rounded-xl px-4 text-sm font-medium transition motion-safe:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";
// --accent-fill / --accent-glow exist only in themes that define them (gradient + hover glow); elsewhere they're no-ops.
const accentFx = "bg-(image:--accent-fill) hover:shadow-[0_8px_24px_-6px_var(--accent-glow,#0000)]";
export const primary = `${btn} bg-accent-600 text-on-accent hover:bg-accent-500 ${accentFx}`;
export const secondary = `${btn} border border-line bg-neutral-900 text-neutral-200 hover:bg-neutral-800`;
