import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trading-intelligence-"));
process.env.DATA_DIR = dataDir;
const store = await import("./persistent-store.js");
const journal = await import("./autopilot.js");

test("persistent store survives module reloads and keeps experiment journal", async () => {
  store.updatePersistentStore(s => { s.optionsPaper = { capital: 200000, trades: [{ id: "T1" }] }; return s; });
  journal.startAutopilot();
  journal.recordScan({ at: Date.now(), underlyingKey: "NSE_INDEX|Nifty 50", candidateCount: 0, observation: { text: "No valid setup." } });
  journal.recordAutopilotTrade({ id: "T1", status: "open", side: "CE", pnl: 0 });
  journal.updateAutopilotTrade("T1", { status: "target_hit", pnl: 1250 });
  const reloaded = store.readPersistentStore();
  assert.equal(reloaded.optionsPaper.trades[0].id, "T1");
  assert.equal(journal.getAutopilotStatus().tradeCount, 1);
  assert.equal(journal.getAutopilotStatus().realizedPnl, 1250);
  assert.equal(journal.getAutopilotStatus().observations[0].text, "No valid setup.");
});

test("persistent file is written with restrictive permissions", () => {
  const file = path.join(dataDir, "trading-intelligence.json");
  assert.equal(fs.existsSync(file), true);
  assert.equal(fs.statSync(file).mode & 0o077, 0);
});
