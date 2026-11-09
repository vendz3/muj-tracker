import { Download, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { exportData, importData } from "./api.js";
import { card, primary, secondary } from "./ui.js";

const LAST_BACKUP = "lj-last-backup"; // per browser, so it's not part of the export
const STALE_DAYS = 14;
const daysWord = (n) => (n === 1 ? "dnem" : "dny");

export default function Backup() {
  const [error, setError] = useState("");
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem(LAST_BACKUP));
  const file = useRef(null);

  async function onExport() {
    try {
      const blob = new Blob([JSON.stringify(await exportData(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: "backup.json" }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const now = new Date().toISOString();
      localStorage.setItem(LAST_BACKUP, now);
      setLastBackup(now);
    } catch (e) {
      setError(`Export selhal: ${e.message}`);
    }
  }

  function onImport(e) {
    const f = e.target.files?.[0];
    e.target.value = ""; // picking the same file again still fires onChange
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (!confirm("Obnovení ze zálohy přepíše všechno, co tu teď máš. Pokračovat?")) return;
        await importData(data);
        location.reload(); // App reloads records/templates on start
      } catch (err) {
        setError(`Obnovení selhalo: ${err.message}`);
      }
    };
    reader.onerror = () => setError("Obnovení selhalo: soubor nejde přečíst");
    reader.readAsText(f);
  }

  async function onDemo() {
    if (!confirm("Ukázková data přepíšou všechno, co tu teď máš. Pokračovat?")) return;
    try {
      const { demoData } = await import("./demo.js"); // lazy: not in the main bundle
      await importData(demoData());
      location.reload();
    } catch (err) {
      setError(`Ukázková data se nenačetla: ${err.message}`);
    }
  }

  const age = lastBackup && Math.floor((Date.now() - new Date(lastBackup)) / 864e5);
  const stale = !lastBackup || age > STALE_DAYS;
  return (
    <div className="space-y-3">
      <section className={`${card} space-y-3`}>
        <p className="text-neutral-400">
          Tvoje data žijí jen v tomhle prohlížeči. Když ho vyčistíš, jsou pryč – proto si zálohu stahuj pravidelně.
        </p>
        <p className="text-sm text-neutral-300">
          {lastBackup
            ? `Poslední záloha: ${new Date(lastBackup).toLocaleDateString("cs-CZ")} (${age === 0 ? "dnes" : `před ${age} ${daysWord(age)}`})`
            : "Zatím žádná záloha"}
        </p>
        {stale && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {lastBackup ? `Záloha je starší než ${STALE_DAYS} dní – stáhni si čerstvou.` : "Zatím nemáš žádnou zálohu. Jeden klik a máš klid."}
          </p>
        )}
        <button type="button" onClick={onExport} className={`${primary} flex w-full items-center justify-center gap-2`}>
          <Download size={20} aria-hidden="true" /> Stáhnout zálohu
        </button>
        <button type="button" onClick={() => file.current.click()} className={`${secondary} flex w-full items-center justify-center gap-2`}>
          <Upload size={20} aria-hidden="true" /> Obnovit ze zálohy
        </button>
        <button type="button" onClick={onDemo} className={`${secondary} flex w-full items-center justify-center gap-2`}>
          <Sparkles size={20} aria-hidden="true" /> Vyzkoušet na ukázkových datech
        </button>
        <input ref={file} type="file" accept="application/json,.json" onChange={onImport} className="hidden" aria-hidden="true" tabIndex={-1} />
      </section>
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
