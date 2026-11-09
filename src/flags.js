// Sub-metrics: data key -> the config flag that switches it on (Nastavení -> Šablony). A key not listed is always tracked.
// One source for the day entry, charts, Overview goals and insights; switching off only hides, saved data stays.
// "retired": old food fields, never shown again (their saved values are kept).
export const FLAG = {
  sleep: { sleep_quality: "quality", sleep_hours: "hours", bedtime: "times", waketime: "times" },
  food: {
    quality: "quality", calories: "calories", drinks: "alcohol", coffee: "caffeine", sweets: "sugar", sugary_drinks: "sugary_drinks",
    fast_food: "fast_food", nicotine: "nicotine", last_meal: "meal_times", meal_gap_h: "meal_times",
    veg: "retired", protein: "retired", processed: "retired", first_meal: "retired", overate: "retired", slump: "retired",
  },
  mind: { clarity: "clarity", energy: "energy", frustration: "frustration" },
  nap: { grogginess: "grogginess" },
  social: { battery: "battery" },
  reading: { minutes: "minutes", pages: "pages" },
};
export const tracked = (t, key) => {
  const f = FLAG[t.type]?.[key];
  return !f || !!t.config_json[f];
};
