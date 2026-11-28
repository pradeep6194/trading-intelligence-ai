import test from "node:test";
import assert from "node:assert/strict";
import { buildOptionGreekSnapshotRows, persistOptionGreekSnapshots } from "./options-archive.js";

test("maps CE and PE chain data including all Greeks", () => {
  const chain = [{
    strike_price: 22000, underlying_spot_price: 22010,
    call_options: { instrument_key: "CE_KEY", market_data: { ltp: 120, bid_price: 119, ask_price: 121, volume: 100, oi: 200 }, option_greeks: { iv: 15, delta: 0.5, gamma: 0.01, theta: -2, vega: 4 } },
    put_options: { instrument_key: "PE_KEY", market_data: { ltp: 110 }, option_greeks: { iv: 16, delta: -0.5, gamma: 0.02, theta: -1, vega: 3 } }
  }];
  const rows = buildOptionGreekSnapshotRows(chain, "NSE_INDEX|Nifty 50", "2026-12-03", "2026-11-28T10:00:00.000Z");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].option_type, "CE");
  assert.equal(rows[0].gamma, 0.01);
  assert.equal(rows[1].option_type, "PE");
  assert.equal(rows[1].delta, -0.5);
  assert.equal(rows[1].oi, null);
});

test("rejects non-arrays and filters rows without a valid strike", () => {
  assert.throws(() => buildOptionGreekSnapshotRows(null, "key", "2026-12-03"), /array/);
  assert.deepEqual(buildOptionGreekSnapshotRows([{ call_options: { instrument_key: "X" } }], "key", "2026-12-03"), []);
});

test("persists in idempotent chunks and reports saved row count", async () => {
  const calls = [];
  const result = await persistOptionGreekSnapshots([{ a: 1 }, { a: 2 }], {
    supabaseUrl: "https://example.supabase.co/", serviceKey: "secret",
    fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true }; }
  });
  assert.equal(result.saved, 2);
  assert.match(calls[0].url, /on_conflict=snapshot_at,instrument_key/);
  assert.equal(JSON.parse(calls[0].options.body).length, 2);
});
