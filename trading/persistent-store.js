import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const dataFile = path.join(dataDir, "trading-intelligence.json");
const defaults = () => ({ version: 1, optionsPaper: null, autopilot: null });

export function readPersistentStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return { ...defaults(), ...parsed };
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Persistent store read failed:", error.message);
    return defaults();
  }
}

export function writePersistentStore(next) {
  fs.mkdirSync(dataDir, { recursive: true });
  const temp = dataFile + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(next), { mode: 0o600 });
  fs.renameSync(temp, dataFile);
  return next;
}

export function updatePersistentStore(mutator) {
  const current = readPersistentStore();
  const next = mutator(current) || current;
  return writePersistentStore(next);
}
