import { readPersistentStore, updatePersistentStore } from "./persistent-store.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const savedState = readPersistentStore().optionsPaper;
const state = savedState ? { ...savedState } : {
  capital: Number(process.env.OPTIONS_PAPER_CAPITAL || 200000),
  riskPct: 0.5,
  dailyLossPct: 2,
  maxTradesPerDay: 5,
  trades: [],
  open: [],
  day: new Date().toISOString().slice(0, 10),
  locked: false
};
function persistState() {
  updatePersistentStore(store => { store.optionsPaper = state; return store; });
}
function rollDay() {
  const d = new Date().toISOString().slice(0, 10);
  if (d !== state.day) { state.day = d; state.locked = false; }
}
function todayTrades() { rollDay(); return state.trades.filter(t => t.day === state.day); }
export function rankOptionChain(chainRows, contractRows, filters = {}) {
  if (!Array.isArray(chainRows) || !chainRows.length) throw new Error("Option chain is empty for this expiry.");
  const contracts = new Map((contractRows || []).map(c => [c.instrument_key, c]));
  const minVolume = Number(filters.minVolume ?? 100);
  const minOi = Number(filters.minOi ?? 500);
  const maxSpreadPct = Number(filters.maxSpreadPct ?? 8);
  const maxDistancePct = Number(filters.maxDistancePct ?? 5);
  const candidates = [];
  for (const row of chainRows) {
    for (const side of ["CE", "PE"]) {
      const opt = side === "CE" ? row.call_options : row.put_options;
      if (!opt?.instrument_key) continue;
      const md = opt.market_data || {}, gr = opt.option_greeks || {};
      const meta = contracts.get(opt.instrument_key) || {};
      const ltp = Number(md.ltp), close = Number(md.close_price), bid = Number(md.bid_price), ask = Number(md.ask_price);
      const volume = Number(md.volume || 0), oi = Number(md.oi || 0), iv = Number(gr.iv);
      const lotSize = Number(meta.lot_size || meta.minimum_lot || 0);
      const spot = Number(row.underlying_spot_price), strike = Number(row.strike_price);
      if (![ltp,close,bid,ask,volume,oi,spot,strike].every(Number.isFinite) || ltp <= 0 || close <= 0 || bid <= 0 || ask < bid || ask <= 0 || lotSize <= 0) continue;
      const spreadPct = ((ask - bid) / ((ask + bid) / 2)) * 100;
      const distancePct = Math.abs(strike - spot) / spot * 100;
      const changePct = ((ltp - close) / close) * 100;
      if (volume < minVolume || oi < minOi || spreadPct > maxSpreadPct || distancePct > maxDistancePct || ltp < 5) continue;
      candidates.push({
        instrumentKey: opt.instrument_key, symbol: meta.trading_symbol || meta.name || (row.underlying_key + " " + strike + " " + side),
        underlyingKey: row.underlying_key, expiry: row.expiry || meta.expiry, side, strike, spot, ltp, close, bid, ask,
        volume, oi, prevOi: Number(md.prev_oi || 0), iv: Number.isFinite(iv) ? iv : null,
        delta: Number.isFinite(Number(gr.delta)) ? Number(gr.delta) : null,
        theta: Number.isFinite(Number(gr.theta)) ? Number(gr.theta) : null,
        vega: Number.isFinite(Number(gr.vega)) ? Number(gr.vega) : null,
        lotSize, spreadPct, distancePct, changePct
      });
    }
  }
  if (!candidates.length) return { candidates: [], rejected: true, reason: "No contracts passed liquidity filters. Relax filters or choose another expiry." };
  const maxVol = Math.max(...candidates.map(c => c.volume), 1);
  const maxOiVal = Math.max(...candidates.map(c => c.oi), 1);
  const maxIv = Math.max(...candidates.map(c => c.iv || 0), 1);
  for (const c of candidates) {
    const moveScore = clamp(Math.abs(c.changePct) / 12, 0, 1) * 35;
    const ivScore = clamp((c.iv || 0) / maxIv, 0, 1) * 20;
    const volumeScore = clamp(Math.log1p(c.volume) / Math.log1p(maxVol), 0, 1) * 20;
    const oiScore = clamp(Math.log1p(c.oi) / Math.log1p(maxOiVal), 0, 1) * 10;
    const spreadScore = clamp(1 - c.spreadPct / maxSpreadPct, 0, 1) * 10;
    const atmScore = clamp(1 - c.distancePct / maxDistancePct, 0, 1) * 5;
    c.volatilityScore = Math.round(moveScore + ivScore + volumeScore + oiScore + spreadScore + atmScore);
    c.quality = c.spreadPct <= 3 && c.volume >= minVolume * 3 && c.oi >= minOi * 3 ? "Good" : "Watch";
  }
  candidates.sort((a,b) => b.volatilityScore - a.volatilityScore || Math.abs(b.changePct) - Math.abs(a.changePct));
  return { candidates: candidates.slice(0, 30), rejected: false, method: "Rank score combines absolute day move (35), IV (20), volume (20), OI (10), spread quality (10) and ATM proximity (5). It is a relative scanner score, not a forecast or true realized-volatility estimate." };
}
export function optionsPaperStatus() {
  const today = todayTrades();
  const realized = today.filter(t => t.status !== "open").reduce((s,t) => s + t.pnl, 0);
  const wins = today.filter(t => t.status !== "open" && t.pnl > 0).length;
  const closed = today.filter(t => t.status !== "open");
  return {
    mode: "paper", liveOrdersEnabled: false, capital: state.capital, riskPct: state.riskPct,
    realizedPnl: Number(realized.toFixed(2)), tradesToday: today.length, winsToday: wins,
    winRate: closed.length ? Number((wins / closed.length * 100).toFixed(1)) : null,
    locked: state.locked, openPositions: state.open,
    history: state.trades.slice(-50).reverse()
  };
}
export function openOptionsPaper(candidate) {
  const status = optionsPaperStatus();
  if (!candidate || !candidate.instrumentKey || !["CE","PE"].includes(candidate.side)) throw new Error("Select a valid scanned option contract.");
  if (state.locked) return { opened: false, reason: "Daily options risk lock is active.", status };
  if (status.tradesToday >= state.maxTradesPerDay) return { opened: false, reason: "Maximum five paper entries per day reached.", status };
  if (state.open.some(p => p.instrumentKey === candidate.instrumentKey)) return { opened: false, reason: "This contract already has an open paper position.", status };
  if (state.open.length >= 2) return { opened: false, reason: "Maximum two simultaneous option paper positions allowed.", status };
  const entry = Number(candidate.ask), lotSize = Number(candidate.lotSize);
  if (!(entry > 0 && lotSize > 0)) throw new Error("Live ask price or lot size is missing.");
  const stop = Number((entry * 0.75).toFixed(2)), target = Number((entry * 1.5).toFixed(2));
  const riskPerLot = (entry - stop) * lotSize;
  const riskBudget = state.capital * state.riskPct / 100;
  const lots = Math.floor(riskBudget / riskPerLot);
  if (lots < 1) return { opened: false, reason: "One lot exceeds the 0.5% paper risk budget. Increase virtual capital or select a lower-premium contract.", status };
  const position = {
    id: "OPT-PAPER-" + Date.now() + "-" + Math.random().toString(36).slice(2,7),
    day: state.day, instrumentKey: candidate.instrumentKey, symbol: candidate.symbol, underlyingKey: candidate.underlyingKey,
    expiry: candidate.expiry, side: candidate.side, strike: candidate.strike, lotSize, lots, quantity: lotSize * lots,
    entry, stop, target, lastPrice: entry, riskCash: Number((riskPerLot * lots).toFixed(2)),
    openedAt: Date.now(), status: "open", pnl: 0
  };
  state.open.push(position); state.trades.push(position); persistState();
  return { opened: true, position, status: optionsPaperStatus() };
}
export function markOptionsPaper(instrumentKey, bidPrice) {
  const p = state.open.find(x => x.instrumentKey === instrumentKey);
  if (!p) return { updated: false, reason: "No open paper position for this contract.", status: optionsPaperStatus() };
  const bid = Number(bidPrice);
  if (!Number.isFinite(bid) || bid <= 0) throw new Error("A valid live bid price is required to mark a long option.");
  p.lastPrice = bid;
  const stopHit = bid <= p.stop, targetHit = bid >= p.target;
  const unrealized = Number(((bid - p.entry) * p.quantity).toFixed(2));
  if (!stopHit && !targetHit) { p.unrealizedPnl = unrealized; persistState(); return { updated: true, closed: false, unrealizedPnl: unrealized, status: optionsPaperStatus() }; }
  const exit = stopHit ? p.stop : p.target;
  const pnl = Number(((exit - p.entry) * p.quantity).toFixed(2));
  Object.assign(p, { exit, pnl, status: stopHit ? "stopped" : "target_hit", closedAt: Date.now() });
  state.open = state.open.filter(x => x.id !== p.id);
  const realized = todayTrades().filter(t => t.status !== "open").reduce((s,t) => s + t.pnl, 0);
  if (realized <= -(state.capital * state.dailyLossPct / 100)) state.locked = true;
  persistState();
  return { updated: true, closed: true, trade: p, status: optionsPaperStatus() };
}
export function closeOptionsPaper(instrumentKey, bidPrice) {
  const p = state.open.find(x => x.instrumentKey === instrumentKey);
  if (!p) return { closed: false, reason: "No open paper position.", status: optionsPaperStatus() };
  const bid = Number(bidPrice);
  if (!Number.isFinite(bid) || bid <= 0) throw new Error("A valid bid price is required.");
  const pnl = Number(((bid - p.entry) * p.quantity).toFixed(2));
  Object.assign(p, { exit: bid, pnl, status: "manual_exit", closedAt: Date.now() });
  state.open = state.open.filter(x => x.id !== p.id);
  const realized = todayTrades().filter(t => t.status !== "open").reduce((s,t) => s + t.pnl, 0);
  if (realized <= -(state.capital * state.dailyLossPct / 100)) state.locked = true;
  persistState();
  return { closed: true, trade: p, status: optionsPaperStatus() };
}
