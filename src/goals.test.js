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
