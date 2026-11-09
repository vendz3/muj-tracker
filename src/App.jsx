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

// Settings sub-pages: [screen, title, icon, description in the menu, intro under the page title]
const SETTINGS_MENU = [
  ["templates", "Šablony", LayoutTemplate, "Co všechno chceš sledovat", "Zapni, co chceš každý den zapisovat. Ťukni na název a nastavíš podrobnosti."],
  ["goals", "Cíle", Target, "Kam to chceš dotáhnout", "Zapni cíle, které chceš plnit. Na Přehledu pak uvidíš, jak se ti daří."],
  ["theme", "Motiv", Palette, "Jak má appka vypadat", "Vyber barvy celé aplikace. Změna platí hned."],
  ["backup", "Záloha", DatabaseBackup, "Ať o nic nepřijdeš", ""],
];
// Intro under the title of the main screens (the overview speaks for itself).
const INTRO = { charts: "Jak se tvoje hodnoty vyvíjejí v čase.", records: "Všechny zapsané dny, nejnovější nahoře.", settings: "Co sleduješ, tvoje cíle, vzhled a záloha dat." };

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
    <main className="relative mx-auto min-h-screen w-full max-w-md px-4 pt-4 pb-28">
      {!main ? (
        <header className="mb-4 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScreen(sub ? "settings" : "overview")}
            aria-label={sub ? "Zpět do nastavení" : "Zpět na přehled"}
            className="-ml-2 flex size-11 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{sub ? sub[1] : "Nastavení"}</h1>
            {(sub ? sub[4] : INTRO.settings) && <p className="text-xs text-neutral-500">{sub ? sub[4] : INTRO.settings}</p>}
          </div>
        </header>
      ) : (
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{screen === "overview" ? "Life Journal" : screen === "charts" ? "Grafy" : "Historie"}</h1>
            {INTRO[screen] && <p className="text-xs text-neutral-500">{INTRO[screen]}</p>}
          </div>
          <span className="flex items-center gap-1">
            {screen === "overview" && !error && (
              // Days in a row with a record; lit while the streak is alive.
              <span
                aria-label={`Série: ${streak} ${streak === 1 ? "den" : streak >= 2 && streak <= 4 ? "dny" : "dní"} v řadě`}
                className={`flex items-center gap-1 rounded-full border border-line px-3 py-1 text-sm font-semibold tabular-nums ${streak ? "text-accent2-text" : "text-neutral-500"}`}
              >
                <Flame size={16} aria-hidden="true" fill={streak ? "currentColor" : "none"} />
                {streak}
              </span>
            )}
            <button
              type="button"
              onClick={() => setScreen("settings")}
              aria-label="Nastavení"
              className="-mr-2 flex size-11 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 hover:text-neutral-50"
            >
              <Settings size={20} aria-hidden="true" />
            </button>
          </span>
        </header>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {screen === "overview" && !error && <Overview records={records} templates={templates} today={today} onNavigate={setScreen} onEdit={setEditing} />}
      {screen === "charts" && !error && <Dashboard records={records} templates={templates} />}

      {screen === "settings" && (
        <ul className="space-y-2">
          {SETTINGS_MENU.map(([key, title, Icon, desc]) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => setScreen(key)}
                className={`${card} flex w-full items-center gap-3 text-left transition-colors hover:bg-neutral-800`}
              >
                <span className="flex size-9 items-center justify-center rounded-xl border border-line bg-neutral-800 text-neutral-300">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-neutral-500">{desc}</span>
                </span>
                <ChevronRight size={16} className="text-neutral-600" aria-hidden="true" />
              </button>
            </li>
          ))}
          <li className="pt-2 text-center text-xs text-neutral-600">Verze {__BUILD__}</li>
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
