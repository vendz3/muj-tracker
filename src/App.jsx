import { ChevronLeft, ChevronRight, DatabaseBackup, Flame, LayoutTemplate, Palette, Settings, Target } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Backup from "./Backup.jsx";
import BottomNav from "./BottomNav.jsx";
import Dashboard from "./Charts.jsx";
import GoalsSettings from "./GoalsSettings.jsx";
import Overview from "./Overview.jsx";
import RecordsList from "./RecordsList.jsx";
import Templates from "./Templates.jsx";
import ThemePicker from "./ThemePicker.jsx";
import { applyTheme, getTheme, storedThemeId } from "./themes.js";
import RecordEntryModal from "./RecordEntryModal.jsx";
import { card } from "./ui.js";

const todayIso = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time
const dayBefore = (iso) => {
  const d = new Date(`${iso}T00:00`);
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv-SE");
};

// Settings sub-pages: [screen, title, icon, description]
const SETTINGS_MENU = [
  ["templates", "Šablony", LayoutTemplate, "Tělo, produktivita, duševní zdraví"],
  ["goals", "Cíle", Target, "Denní a týdenní mety"],
  ["theme", "Motiv", Palette, "Barvy aplikace"],
  ["backup", "Záloha", DatabaseBackup, "Export a import dat"],
];

export default function App() {
  const [screen, setScreen] = useState("overview"); // overview | charts | records | settings | templates | goals | theme | backup
  const [themeId, setThemeId] = useState(() => getTheme(storedThemeId()).id); // applied in main.jsx before render
  const [records, setRecords] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [streak, setStreak] = useState(0);
  const [editing, setEditing] = useState(null); // null | record being edited | { date } for a new day
  const [error, setError] = useState("");

  async function load() {
    try {
      const [r, t, s] = await Promise.all([api("/records"), api("/templates"), api("/streak")]);
      setRecords(r);
      setTemplates(t);
      setStreak(s.streak);
      setError("");
    } catch {
      setError("Nepodařilo se načíst data.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const closeEditor = useCallback(() => setEditing(null), []); // stable, so the modal's Escape listener isn't re-bound every render
  const today = records.find((r) => r.date === todayIso());
  const sub = SETTINGS_MENU.find(([key]) => key === screen);
  const main = screen === "overview" || screen === "charts" || screen === "records"; // tabs of the bottom bar
  const yesterday = editing && records.find((r) => r.date === dayBefore(editing.date));

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-md px-4 pt-6 pb-32">
      {!main ? (
        <header className="mb-4 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScreen(sub ? "settings" : "overview")}
            aria-label={sub ? "Zpět do nastavení" : "Zpět na přehled"}
            className="-ml-2 flex size-11 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
          >
            <ChevronLeft size={28} aria-hidden="true" />
          </button>
          <h1 className="text-3xl font-bold tracking-tight">{sub ? sub[1] : "Nastavení"}</h1>
        </header>
      ) : (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{screen === "overview" ? "Life Journal" : screen === "charts" ? "Grafy" : "Historie"}</h1>
          <span className="flex items-center gap-1">
            {screen === "overview" && !error && (
              // Days in a row with a record; lit while the streak is alive.
              <span
                aria-label={`Série: ${streak} ${streak === 1 ? "den" : streak >= 2 && streak <= 4 ? "dny" : "dní"} v řadě`}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-lg font-bold ${streak ? "bg-accent2/15 text-accent2-text" : "bg-neutral-800 text-neutral-500"}`}
              >
                <Flame size={22} aria-hidden="true" fill={streak ? "currentColor" : "none"} />
                {streak}
              </span>
            )}
            <button
              type="button"
              onClick={() => setScreen("settings")}
              aria-label="Nastavení"
              className="-mr-2 flex size-11 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
            >
              <Settings size={24} aria-hidden="true" />
            </button>
          </span>
        </header>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-red-400">
          {error}
        </p>
      )}

      {screen === "overview" && !error && <Overview records={records} templates={templates} today={today} onNavigate={setScreen} onEdit={setEditing} />}
      {screen === "charts" && !error && <Dashboard records={records} templates={templates} />}

      {screen === "settings" && (
        <ul className="space-y-3">
          {SETTINGS_MENU.map(([key, title, Icon, desc]) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => setScreen(key)}
                className={`${card} flex w-full items-center gap-4 text-left transition hover:bg-neutral-800 active:scale-[0.98]`}
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent-500/15 text-accent-300">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-neutral-500">{desc}</span>
                </span>
                <ChevronRight size={20} className="text-neutral-600" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {screen === "templates" && <Templates templates={templates} onChange={load} />}
      {screen === "goals" && <GoalsSettings templates={templates} onChange={load} />}
      {screen === "backup" && <Backup />}
      {screen === "theme" && <ThemePicker value={themeId} onChange={(id) => setThemeId(applyTheme(id).id)} />}
      {screen === "records" && !error && <RecordsList records={records} templates={templates} onEdit={setEditing} />}

      <BottomNav
        section={main ? screen : null}
        onNavigate={setScreen}
        onAdd={() => setEditing(today ?? { date: todayIso() })}
        addDisabled={!!error}
      />

      {editing && (
        <RecordEntryModal
          key={editing.id ?? `new-${editing.date}`}
          templates={templates}
          record={editing.id ? editing : undefined}
          date={editing.date}
          yesterday={yesterday}
          // Picking a day that already has a record opens it for editing, so it is never silently overwritten.
          onDateChange={(d) => setEditing(records.find((r) => r.date === d) ?? { date: d })}
          onCancel={closeEditor}
          onDone={() => {
            setEditing(null);
            // Saved from the list -> stay in the list; saved from + -> back to the goals overview.
            if (screen !== "records") setScreen("overview");
            load();
          }}
        />
      )}
    </main>
  );
}
