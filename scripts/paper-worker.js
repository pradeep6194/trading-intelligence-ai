import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const token = process.env.UPSTOX_ANALYTICS_TOKEN;
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!token || !supabaseUrl || !serviceKey) throw new Error("Missing UPSTOX_ANALYTICS_TOKEN, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" };
async function dbRead() {
  const r = await fetch(supabaseUrl + "/rest/v1/trading_state?id=eq.1&select=payload", { headers });
  if (!r.ok) throw new Error("Supabase read failed (" + r.status + "): " + (await r.text()).slice(0, 300));
  const rows = await r.json();
  return rows[0]?.payload || { version: 1, optionsPaper: null, autopilot: null };
}
async function dbWrite(payload) {
  const r = await fetch(supabaseUrl + "/rest/v1/trading_state?on_conflict=id", {
    method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: 1, payload, updated_at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error("Supabase write failed (" + r.status + "): " + (await r.text()).slice(0, 300));
}
async function upstox(url) {
  const r = await fetch(url, { headers: { Accept: "application/json", Authorization: "Bearer " + token } });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.errors?.[0]?.message || d?.message || "Upstox API " + r.status);
  return d;
}
function marketClock() {
  const p = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const o = Object.fromEntries(p.map(x => [x.type, x.value]));
  return { weekday: o.weekday, minutes: Number(o.hour) * 60 + Number(o.minute) };
}
function indiaDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function validKey(k) { return /^(NSE_INDEX\|[A-Za-z0-9 .&-]+|NSE_EQ\|[A-Z0-9]+)$/.test(String(k || "")); }
async function discoverUniverse() {
  const r = await fetch("https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz");
  if (!r.ok) throw new Error("Could not download NSE instrument master: " + r.status);
  const rows = JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf8"));
  const keys = new Set(["NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank"]);
  for (const x of rows) if (x.segment === "NSE_FO" && ["CE", "PE"].includes(x.instrument_type) && ["EQUITY", "INDEX"].includes(x.underlying_type) && validKey(x.underlying_key)) keys.add(x.underlying_key);
  return [...keys];
}
async function scanUnderlying(key, rankOptionChain) {
  const cUrl = new URL("https://api.upstox.com/v2/option/contract"); cUrl.searchParams.set("instrument_key", key);
  const contracts = (await upstox(cUrl)).data || [];
  const today = indiaDate();
  const expiries = [...new Set(contracts.map(x => x.expiry).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= today))].sort();
  if (!expiries.length) throw new Error("No upcoming option expiry.");
  const expiry = expiries[0];
  const oUrl = new URL("https://api.upstox.com/v2/option/chain"); oUrl.searchParams.set("instrument_key", key); oUrl.searchParams.set("expiry_date", expiry);
  const chain = (await upstox(oUrl)).data || [];
  const ranked = rankOptionChain(chain, contracts.filter(x => x.expiry === expiry), { minVolume: 1000, minOi: 10000, maxSpreadPct: 3.5, maxDistancePct: 5 });
  const oiTotals = side => chain.reduce((sum, row) => {
    const md = row[side + "_options"]?.market_data || {};
    return { oi: sum.oi + Number(md.oi || 0), previousOi: sum.previousOi + Number(md.prev_oi || 0) };
  }, { oi: 0, previousOi: 0 });
  const calls = oiTotals("call"), puts = oiTotals("put");
  const callOi = calls.oi, putOi = puts.oi;
  const callOiChange = callOi - calls.previousOi, putOiChange = putOi - puts.previousOi;
  const spot = Number(chain[0]?.underlying_spot_price || 0);
  const pcr = Number(chain[0]?.pcr || (callOi > 0 ? putOi / callOi : 0));
  return { expiry, spot, pcr, callOi, putOi, callOiChange, putOiChange, ...ranked };
}
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "trading-intelligence-"));
process.env.DATA_DIR = dataDir;
const dataFile = path.join(dataDir, "trading-intelligence.json");
let payload = await dbRead();
if (!payload.autopilot?.active) {
  console.log("Experiment is paused or not started; no market scan executed.");
  process.exit(0);
}
const startedAt = payload.autopilot.startedAt;
if (!startedAt) throw new Error("Experiment is active but has no start timestamp.");
if (Date.now() >= startedAt + 90 * 24 * 60 * 60 * 1000) {
  payload.autopilot.active = false;
  payload.autopilot.completedAt = Date.now();
  await dbWrite(payload);
  console.log("90-day experiment completed.");
  process.exit(0);
}
const clock = marketClock();
if (["Sat", "Sun"].includes(clock.weekday) || clock.minutes < 555 || clock.minutes > 930) {
  console.log("Outside NSE market hours; no scan executed.");
  process.exit(0);
}
fs.writeFileSync(dataFile, JSON.stringify(payload), { mode: 0o600 });
const { rankOptionChain, openOptionsPaper, markOptionsPaper, closeOptionsPaper } = await import("../trading/options-paper.js");
const { recordScan, recordAutopilotTrade, updateAutopilotTrade, recordAutopilotError, hasEnteredUnderlyingToday, markUnderlyingEnteredToday } = await import("../trading/autopilot.js");
const { classifyMarketEvidence, resolveForwardOutcome } = await import("../trading/market-learning.js");
try {
  const universe = await discoverUniverse();
  const batchSize = Math.max(1, Number(process.env.PAPER_SCAN_BATCH_SIZE || 10));
  // Re-scan the two benchmark indices on every cycle; rotate the stock F&O universe in the remaining slots.
  const benchmarks = ["NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank"].filter(k => universe.includes(k));
  const stocks = universe.filter(k => !benchmarks.includes(k));
  const stockSlots = Math.max(0, batchSize - benchmarks.length);
  const start = stocks.length ? Number(payload.autopilot.scanCursor || 0) % stocks.length : 0;
  const rotating = Array.from({ length: Math.min(stockSlots, stocks.length) }, (_, i) => stocks[(start + i) % stocks.length]);
  const batch = [...benchmarks, ...rotating];
  payload.autopilot.scanCursor = stocks.length ? (start + rotating.length) % stocks.length : 0;
  payload.autopilot.universeCount = universe.length;
  fs.writeFileSync(dataFile, JSON.stringify(payload), { mode: 0o600 });
  const day = indiaDate(), best = [];
  for (const underlyingKey of batch) {
    try {
      const result = await scanUnderlying(underlyingKey, rankOptionChain);
      const top = result.candidates[0] || null;
      const stored = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      stored.autopilot ||= {};
      stored.autopilot.marketSnapshots ||= {};
      const previous = stored.autopilot.marketSnapshots[underlyingKey];
      const spotChangePct = previous?.spot > 0 && result.spot > 0 ? Number(((result.spot - previous.spot) / previous.spot * 100).toFixed(3)) : null;
      const pcrChange = previous?.pcr > 0 ? Number((result.pcr - previous.pcr).toFixed(3)) : null;
      const callOiChangePct = previous?.callOi > 0 ? Number((result.callOiChange / previous.callOi * 100).toFixed(2)) : null;
      const putOiChangePct = previous?.putOi > 0 ? Number((result.putOiChange / previous.putOi * 100).toFixed(2)) : null;
      const analysis = classifyMarketEvidence({
        spotChangePct, pcr: result.pcr, pcrChange, callOiChangePct, putOiChangePct,
        premiumChangePct: top?.changePct ?? null, iv: top?.iv ?? null,
        volume: top?.volume ?? null, spreadPct: top?.spreadPct ?? null
      });
      const drivers = analysis.drivers.map(item => item.observation);
      const priorObservation = (stored.autopilot.observations || []).slice().reverse()
        .find(item => item.underlyingKey === underlyingKey && item.analysis && !item.forwardOutcome && item.evidence?.spot > 0);
      if (priorObservation) {
        const outcome = resolveForwardOutcome(priorObservation, result.spot);
        if (outcome) priorObservation.forwardOutcome = outcome;
      }
      fs.writeFileSync(dataFile, JSON.stringify(stored), { mode: 0o600 });
      const observation = {
        at: Date.now(), underlyingKey, symbol: top?.symbol || null, score: top?.volatilityScore ?? null,
        changePct: top?.changePct ?? null, iv: top?.iv ?? null, volume: top?.volume ?? null,
        oi: top?.oi ?? null, spreadPct: top?.spreadPct ?? null, regime,
        spot: result.spot, pcr: result.pcr, callOi: result.callOi, putOi: result.putOi,
        evidence: { spot: result.spot, spotChangePct, pcr: result.pcr, pcrChange, callOi: result.callOi, putOi: result.putOi, callOiChange: result.callOiChange, putOiChange: result.putOiChange, callOiChangePct, putOiChangePct },
        analysis, drivers, summary: top
          ? underlyingKey + ": leading " + top.side + " contract " + top.symbol + " scored " + top.volatilityScore + "/100. Observed premium change " + top.changePct + "%."
          : underlyingKey + ": no option contract passed the configured liquidity filters.",
        text: top ? top.symbol + " · " + drivers.join("; ") : "No liquid candidate for " + underlyingKey + "."
      };
      recordScan({ at: observation.at, underlyingKey, expiry: result.expiry, candidateCount: result.candidates.length,
        top: top ? { symbol: top.symbol, side: top.side, score: top.volatilityScore, changePct: top.changePct, spreadPct: top.spreadPct } : null, observation });
      const afterScan = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      afterScan.autopilot ||= {};
      afterScan.autopilot.marketSnapshots ||= {};
      afterScan.autopilot.marketSnapshots[underlyingKey] = { at: observation.at, spot: result.spot, pcr: result.pcr, callOi: result.callOi, putOi: result.putOi };
      fs.writeFileSync(dataFile, JSON.stringify(afterScan), { mode: 0o600 });
      if (top) best.push(top);
    } catch (error) {
      recordScan({ at: Date.now(), underlyingKey, error: error.message, candidateCount: 0 });
    }
  }
  best.sort((a,b) => b.volatilityScore - a.volatilityScore);
  const candidate = best.find(x => x.volatilityScore >= 70 && x.changePct >= 3 && x.spreadPct <= 3.5 && x.volume >= 1000 && x.oi >= 10000 && !hasEnteredUnderlyingToday(x.underlyingKey, day));
  if (candidate) {
    const opened = openOptionsPaper(candidate);
    if (opened.opened) {
      markUnderlyingEnteredToday(candidate.underlyingKey, day);
      recordAutopilotTrade({
        id: opened.position.id, openedAt: opened.position.openedAt, status: "open",
        underlyingKey: candidate.underlyingKey, symbol: candidate.symbol, side: candidate.side,
        entry: opened.position.entry, quantity: opened.position.quantity, lots: opened.position.lots,
        stop: opened.position.stop, target: opened.position.target, score: candidate.volatilityScore,
        changePct: candidate.changePct, iv: candidate.iv, volume: candidate.volume, oi: candidate.oi, spreadPct: candidate.spreadPct,
        reasons: ["Relative volatility score >= 70", "Option premium day change >= +3%", "Volume and OI filters passed", "Bid-ask spread <= 3.5%", "One entry per underlying per Indian market day"]
      });
    }
  }
  // Refresh existing positions against current option-chain bids; close at the stop/target or near market close.
  for (const position of [...(JSON.parse(fs.readFileSync(dataFile, "utf8")).optionsPaper?.open || [])]) {
    try {
      const url = new URL("https://api.upstox.com/v2/option/chain"); url.searchParams.set("instrument_key", position.underlyingKey); url.searchParams.set("expiry_date", position.expiry);
      const rows = (await upstox(url)).data || [];
      let bid = null;
      for (const row of rows) for (const side of ["call_options", "put_options"]) if (row[side]?.instrument_key === position.instrumentKey) bid = Number(row[side].market_data?.bid_price);
      if (!(bid > 0)) continue;
      const exitNow = clock.minutes >= 920;
      const result = exitNow ? closeOptionsPaper(position.instrumentKey, bid) : markOptionsPaper(position.instrumentKey, bid);
      if (result.closed && result.trade) updateAutopilotTrade(result.trade.id, {
        status: exitNow ? "end_of_day_exit" : result.trade.status, exit: result.trade.exit, pnl: result.trade.pnl, closedAt: result.trade.closedAt,
        outcomeReason: exitNow ? "Closed near NSE market close using the latest available bid." : result.trade.status === "stopped" ? "Live bid touched the 25% premium stop." : "Live bid touched the 50% premium target."
      });
    } catch (error) { console.error("Position refresh failed:", position.symbol, error.message); }
  }
  payload = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  payload.autopilot.lastError = null;
  payload.autopilot.lastWorkerAt = Date.now();
  payload.autopilot.lastWorkerResult = { scannedUnderlyings: batch.length, universeCount: universe.length, candidateCount: best.length, openedTrade: Boolean(candidate) };
  await dbWrite(payload);
  console.log("Paper scan completed:", JSON.stringify(payload.autopilot.lastWorkerResult));
} catch (error) {
  recordAutopilotError(error.message);
  payload = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  payload.autopilot.lastError = String(error.message).slice(0, 500);
  payload.autopilot.lastWorkerAt = Date.now();
  await dbWrite(payload);
  throw error;
}
