import { CalendarDays, ChartLine, House, Plus } from "lucide-react";

const item = (active) =>
  `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
    active ? "text-accent-400" : "text-neutral-500 hover:text-neutral-200"
  }`;

const Tab = ({ id, Icon, label, section, onNavigate }) => (
  <button type="button" className={item(section === id)} aria-current={section === id} onClick={() => onNavigate(id)}>
    <Icon size={20} aria-hidden="true" />
    {label}
  </button>
);

// `section` is "overview", "charts" or "records" (none active in settings); the + button opens the day entry.
export default function BottomNav({ section, onNavigate, onAdd, addDisabled }) {
  const tab = { section, onNavigate };
  return (
    <nav
      aria-label="Hlavní navigace"
      className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-md items-end border-t border-line bg-neutral-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <Tab id="overview" Icon={House} label="Přehled" {...tab} />
      <Tab id="charts" Icon={ChartLine} label="Grafy" {...tab} />
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={onAdd}
          disabled={addDisabled}
          aria-label="Záznam dne"
          className="-mt-7 mb-1 flex size-16 items-center justify-center rounded-full bg-accent-600 bg-(image:--accent-fill) text-on-accent shadow-md shadow-shade ring-4 ring-neutral-950 transition hover:bg-accent-500 motion-safe:active:scale-90 disabled:opacity-40"
        >
          <Plus size={32} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
      <Tab id="records" Icon={CalendarDays} label="Historie" {...tab} />
    </nav>
  );
}
