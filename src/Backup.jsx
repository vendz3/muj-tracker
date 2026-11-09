import { Download, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { exportData, importData } from "./api.js";
import { card, primary, secondary } from "./ui.js";

export default function Backup() {
  const [error, setError] = useState("");
  const file = useRef(null);

  async function onExport() {
    try {
      const blob = new Blob([JSON.stringify(await exportData(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: "backup.json" }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        if (!confirm("Import přepíše všechna současná data v tomto prohlížeči. Pokračovat?")) return;
        await importData(data);
        location.reload(); // App reloads records/templates on start
      } catch (err) {
        setError(`Import selhal: ${err.message}`);
      }
    };
    reader.onerror = () => setError("Import selhal: soubor nejde přečíst");
    reader.readAsText(f);
  }

  async function onDemo() {
    if (!confirm("Demo data přepíšou všechna současná data v tomto prohlížeči. Pokračovat?")) return;
    try {
      const { demoData } = await import("./demo.js"); // lazy: not in the main bundle
      await importData(demoData());
      location.reload();
    } catch (err) {
      setError(`Načtení demo dat selhalo: ${err.message}`);
    }
  }

  return (
    <div className="space-y-4">
      <section className={`${card} space-y-3`}>
        <p className="text-neutral-400">
          Data jsou uložená jen v tomto prohlížeči (localStorage). Smazáním dat prohlížeče o ně přijdeš, proto si pravidelně stahuj zálohu.
        </p>
        <button type="button" onClick={onExport} className={`${primary} flex w-full items-center justify-center gap-2`}>
          <Download size={20} aria-hidden="true" /> Exportovat do JSON
        </button>
        <button type="button" onClick={() => file.current.click()} className={`${secondary} flex w-full items-center justify-center gap-2`}>
          <Upload size={20} aria-hidden="true" /> Importovat z JSON
        </button>
        <button type="button" onClick={onDemo} className={`${secondary} flex w-full items-center justify-center gap-2`}>
          <Sparkles size={20} aria-hidden="true" /> Načíst demo data
        </button>
        <input ref={file} type="file" accept="application/json,.json" onChange={onImport} className="hidden" aria-hidden="true" tabIndex={-1} />
      </section>
      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
