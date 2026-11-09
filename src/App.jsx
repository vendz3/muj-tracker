import { ChevronLeft, ChevronRight, CalendarDays, DatabaseBackup, Flame, LayoutTemplate, Palette, Target } from "lucide-react";
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

// Settings sub-pages: [screen, title, icon, description]
const SETTINGS_MENU = [
  ["templates", "Šablony", LayoutTemplate, "Tělo, produktivita, duševní zdraví"],
  ["goals", "Cíle", Target, "Denní a týdenní mety"],
  ["records", "Záznamy", CalendarDays, "Historie dnů a jejich úpravy"],
  ["theme", "Motiv", Palette, "Barvy aplikace"],
  ["backup", "Záloha", DatabaseBackup, "Export a import dat"],
];

export default function App() {
  const [screen, setScreen] = useState("overview"); // overview | charts | settings | templates | goals | records | theme | backup
  const [themeId, setThemeId] = useState(() => getTheme(storedThemeId()).id); // applied in main.jsx before render
  const [records, setRecords] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [streak, setStreak] = useState(0);
  const [editing, setEditing] = useState(null); // null | "new" | record being edited
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

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-md px-4 pt-6 pb-32">
      {sub ? (
        <header className="mb-4 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScreen("settings")}
            aria-label="Zpět do nastavení"
            className="-ml-2 flex size-11 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
          >
            <ChevronLeft size={28} aria-hidden="true" />
          </button>
          <h1 className="text-3xl font-bold tracking-tight">{sub[1]}</h1>
        </header>
      ) : (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{screen === "overview" ? "Life Journal" : screen === "charts" ? "Grafy" : "Nastavení"}</h1>
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
        </header>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-red-400">
          {error}
        </p>
      )}

      {screen === "overview" && !error && <Overview records={records} templates={templates} onNavigate={setScreen} />}
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
                <span className="flex size-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
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
        section={screen === "overview" || screen === "charts" ? screen : "settings"}
        onNavigate={setScreen}
        onAdd={() => setEditing(today ?? "new")}
        addDisabled={!!error}
      />

      {editing && (
        <RecordEntryModal
          key={editing === "new" ? "new" : editing.id}
          templates={templates}
          record={editing === "new" ? undefined : editing}
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
