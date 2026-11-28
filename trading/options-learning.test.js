import test from "node:test";
import assert from "node:assert/strict";
import { analyseOptionGreekSnapshots } from "./options-learning.js";

const now = new Date("2026-11-28T12:00:00Z");
const rows = Array.from({ length: 12 }, (_, i) => ({
  snapshot_at: new Date(now.getTime() - (11 - i) * 3600000).toISOString(),
  underlying_key: "NSE_INDEX|Nifty 50", expiry_date: "2026-12-03",
  instrument_key: "NFO:NIFTY26DEC25000CE", option_type: "CE", strike: 25000,
  spot: 25000 + i * 10, ltp: 100 + i * 5, bid: 104 + i * 5, ask: 106 + i * 5,
  volume: 1000 + i * 100, oi: 5000 + i * 200, iv: 12 + i * 0.5,
  delta: 0.5 + i * 0.01, gamma: 0.02, theta: -4, vega: 8
}));

test("analyses 30-day changes, Greeks and correlations without fabricated observations", () => {
  const result = analyseOptionGreekSnapshots(rows, { windowDays: 30, now });
  assert.equal(result.status, "available");
  assert.equal(result.snapshots, 12);
  assert.equal(result.contracts, 1);
  assert.equal(result.contracts[0].iv.changePoints, 5.5);
  assert.equal(result.contracts[0].premium.changePct, 55);
  assert.equal(result.contracts[0].latestGreeks.delta, 0.61);
  assert.equal(result.correlations.ivChangePremiumChange.status, "available");
  assert.equal(result.correlations.spotChangePremiumChange.status, "available");
});

test("reports empty archive as unavailable rather than inventing data", () => {
  const result = analyseOptionGreekSnapshots([], { windowDays: 30, now });
  assert.equal(result.status, "no_archived_snapshots");
  assert.equal(result.snapshots, 0);
  assert.equal(result.correlations.ivChangePremiumChange.value, null);
});

test("excludes snapshots outside requested window", () => {
  const old = [{ ...rows[0], snapshot_at: "2026-09-01T00:00:00Z" }];
  const result = analyseOptionGreekSnapshots(old, { windowDays: 30, now });
  assert.equal(result.status, "no_archived_snapshots");
});
