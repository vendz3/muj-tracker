import { ChartLine, House, Plus, Settings } from "lucide-react";

const item = (active) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition ${
    active ? "text-violet-400" : "text-neutral-500 hover:text-neutral-200"
  }`;

const Tab = ({ id, Icon, label, section, onNavigate }) => (
  <button type="button" className={item(section === id)} aria-current={section === id} onClick={() => onNavigate(id)}>
    <Icon size={24} aria-hidden="true" />
    {label}
  </button>
);

// `section` is "overview", "charts" or "settings"; the + button opens the day wizard.
export default function BottomNav({ section, onNavigate, onAdd, addDisabled }) {
  const tab = { section, onNavigate };
  return (
    <nav
      aria-label="Hlavní navigace"
      className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-md items-end border-t border-line bg-neutral-900/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <Tab id="overview" Icon={House} label="Přehled" {...tab} />
      <Tab id="charts" Icon={ChartLine} label="Grafy" {...tab} />
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={onAdd}
          disabled={addDisabled}
          aria-label="Záznam dne"
          className="-mt-7 mb-1 flex size-16 items-center justify-center rounded-full bg-violet-600 bg-(image:--accent-fill) text-on-accent shadow-md shadow-shade ring-4 ring-neutral-950 transition hover:bg-violet-500 active:scale-90 disabled:opacity-40"
        >
          <Plus size={32} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
      <Tab id="settings" Icon={Settings} label="Nastavení" {...tab} />
    </nav>
  );
}
