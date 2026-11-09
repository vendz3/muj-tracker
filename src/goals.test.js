// Self-check: node src/goals.test.js
import { calculateTotalXP, dayXP } from "./goals.js";
const assert = (c, m) => { if (!c) throw new Error(m); };

const byId = {
  1: { id: 1, type: "water", config_json: { goals: { liters: { value: 2 } } } },
  2: { id: 2, type: "sleep", config_json: {} },
  3: { id: 3, type: "sport", config_json: { goals: { week_activities: { value: 3 } } } },
};
assert(dayXP([{ template_id: 1, data: { liters: 2.5 } }, { template_id: 2, data: { sleep_quality: 4 } }], byId) === 3, "2 templates + 1 goal");
assert(dayXP([{ template_id: 1, data: { liters: 1 } }], byId) === 1, "goal missed");
assert(dayXP([{ template_id: 3, data: { sports: [] } }], byId) === 0, "empty sport");
assert(dayXP([{ template_id: 3, data: { sports: [{ name: "běh", rpe: 5 }] } }], byId) === 1, "weekly goal not per day");
assert(dayXP([{ template_id: 99, data: { x: 1 } }], byId) === 0, "deleted template");
const records = [{ results: [{ template_id: 1, result_data_json: { liters: 3 } }] }, { results: [] }];
assert(calculateTotalXP(records, Object.values(byId)) === 2, "total");
console.log("goals ok");

// Custom templates: yes/no, number and 1–10 scale goals.
import { goalsOf, goalText } from "./goals.js";
const custom = {
  20: { id: 20, type: "custom", name: "Sprcha", config_json: { kind: "bool", goals: { value: { value: 1 } } } },
  21: { id: 21, type: "custom", name: "Stránky", config_json: { kind: "number", unit: "str.", dir: "min", goals: { value: { value: 10 } } } },
  22: { id: 22, type: "custom", name: "Bolest", config_json: { kind: "rating", better: "low", goals: { value: { value: 3 } } } },
};
assert(dayXP([{ template_id: 20, data: { value: true } }], custom) === 2, "bool yes meets goal");
assert(dayXP([{ template_id: 20, data: { value: false } }], custom) === 1, "bool no: filled, goal missed");
assert(dayXP([{ template_id: 21, data: { value: 12 } }], custom) === 2 && dayXP([{ template_id: 21, data: { value: 5 } }], custom) === 1, "number goal");
assert(dayXP([{ template_id: 22, data: { value: 2 } }], custom) === 2 && dayXP([{ template_id: 22, data: { value: 8 } }], custom) === 1, "rating lower is better");
assert(goalText({ value: 1 }, goalsOf(custom[20])[0]) === "každý den" && goalText({ value: 10 }, goalsOf(custom[21])[0]) === "aspoň 10 str. denně", "goal words");
console.log("custom goals ok");
