import test from "node:test";
import assert from "node:assert/strict";
import { rankOptionChain, openOptionsPaper, markOptionsPaper, optionsPaperStatus } from "./options-paper.js";

test("ranks liquid option contracts and filters wide spreads", () => {
  const rows = [{
    expiry: "2026-12-03", underlying_key: "NSE_INDEX|Nifty 50", underlying_spot_price: 26000,
    strike_price: 26000,
    call_options: { instrument_key: "NSE_FO|1001", market_data: { ltp: 110, close_price: 100, bid_price: 109, ask_price: 111, volume: 50000, oi: 80000, prev_oi: 70000 }, option_greeks: { iv: 18, delta: 0.5, theta: -2, vega: 4 } },
    put_options: { instrument_key: "NSE_FO|1002", market_data: { ltp: 40, close_price: 38, bid_price: 30, ask_price: 40, volume: 100, oi: 500, prev_oi: 400 }, option_greeks: { iv: 22, delta: -0.3 } }
  }];
  const contracts = [{ instrument_key: "NSE_FO|1001", lot_size: 65, trading_symbol: "NIFTY 26000 CE", expiry: "2026-12-03" }, { instrument_key: "NSE_FO|1002", lot_size: 65, trading_symbol: "NIFTY 26000 PE", expiry: "2026-12-03" }];
  const result = rankOptionChain(rows, contracts);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].side, "CE");
  assert.ok(result.candidates[0].volatilityScore > 50);
});

test("opens a lot-sized paper option and closes it at target", () => {
  const candidate = { instrumentKey: "NSE_FO|TEST1", symbol: "TEST 100 CE", underlyingKey: "NSE_INDEX|Nifty 50", expiry: "2026-12-03", side: "CE", strike: 100, ask: 10.2, bid: 10, lotSize: 50 };
  const opened = openOptionsPaper(candidate);
  assert.equal(opened.opened, true);
  assert.equal(opened.position.quantity, opened.position.lots * 50);
  const closed = markOptionsPaper(candidate.instrumentKey, 15.5);
  assert.equal(closed.closed, true);
  assert.equal(closed.trade.status, "target_hit");
  assert.ok(closed.trade.pnl > 0);
  assert.equal(optionsPaperStatus().openPositions.length, 0);
});
