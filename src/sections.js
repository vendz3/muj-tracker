// One order for everything (day entry, charts, Overview goals, settings): how the day is recalled in the evening.
// The overall feeling comes first (before details colour it) and is the outcome the charts below try to explain.
export const SECTIONS = [
  { title: "Jak ti dnes bylo", types: ["stress", "mind", "emotions"] }, // mood itself sits on top of this section
  { title: "Noc a ráno", types: ["sleep", "medication"] },
  { title: "Během dne", types: ["food", "water", "fasting", "nap", "sport", "steps"] },
  { title: "Mysl a lidé", types: ["social", "reading", "meditation", "screen_time"] },
  { title: "Závěr dne", types: ["gratitude"] },
];
const OTHER = "Ostatní"; // a type not listed above still shows up, at the end
const KNOWN = SECTIONS.flatMap((s) => s.types);

export const sectionTitle = (type) => SECTIONS.find((s) => s.types.includes(type))?.title ?? OTHER;

// Templates -> [{ title, templates }] in section order; within a section by `types`, then id. Empty sections dropped.
export function groupTemplates(templates) {
  const byOrder = (a, b) => KNOWN.indexOf(a.type) - KNOWN.indexOf(b.type) || a.id - b.id;
  return [...SECTIONS.map((s) => s.title), OTHER]
    .map((title) => ({ title, templates: templates.filter((t) => sectionTitle(t.type) === title).sort(byOrder) }))
    .filter((g) => g.templates.length);
}

export const entryOrder = (templates) => groupTemplates(templates).flatMap((g) => g.templates);
