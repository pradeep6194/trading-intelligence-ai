import { readPersistentStore, updatePersistentStore } from "./persistent-store.js";

const DAY = 24 * 60 * 60 * 1000;
export function getAutopilotStatus() {
  const store = readPersistentStore();
  const a = store.autopilot || { active: false, scans: [], trades: [], startedAt: null };
  const elapsed = a.startedAt ? Math.max(0, Date.now() - a.startedAt) : 0;
  const closed = (a.trades || []).filter(t => t.status !== "open");
  const wins = closed.filter(t => Number(t.pnl) > 0);
  const pnl = closed.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  const days = a.startedAt ? Math.min(90, Math.floor(elapsed / DAY) + 1) : 0;
  return {
    active: Boolean(a.active), startedAt: a.startedAt, endsAt: a.startedAt ? a.startedAt + 90 * DAY : null,
    calendarDaysElapsed: days, calendarDaysRemaining: Math.max(0, 90 - days),
    scanCount: (a.scans || []).length, lastScanAt: a.lastScanAt || null, lastError: a.lastError || null,
    tradeCount: (a.trades || []).length, closedTrades: closed.length, winRate: closed.length ? Number((wins.length / closed.length * 100).toFixed(1)) : null,
    realizedPnl: Number(pnl.toFixed(2)), observations: (a.observations || []).slice(-20).reverse(),
    recentScans: (a.scans || []).slice(-10).reverse(), recentTrades: (a.trades || []).slice(-50).reverse()
  };
}
export function updateAutopilot(mutator) {
  return updatePersistentStore(store => {
    const a = store.autopilot || { active: false, startedAt: null, lastScanAt: null, lastError: null, scans: [], trades: [], observations: [], enteredToday: {} };
    mutator(a);
    store.autopilot = a;
    return store;
  });
}
export function startAutopilot() {
  updateAutopilot(a => { if (!a.startedAt) a.startedAt = Date.now(); a.active = true; a.lastError = null; });
  return getAutopilotStatus();
}
export function stopAutopilot() {
  updateAutopilot(a => { a.active = false; });
  return getAutopilotStatus();
}
export function recordScan(scan) {
  updateAutopilot(a => {
    if (!a.startedAt) a.startedAt = Date.now();
    a.lastScanAt = scan.at; a.lastError = null;
    a.scans.push(scan); if (a.scans.length > 5000) a.scans.splice(0, a.scans.length - 5000);
    if (scan.observation) { a.observations.push(scan.observation); if (a.observations.length > 1000) a.observations.shift(); }
  });
}
export function recordAutopilotTrade(trade) {
  updateAutopilot(a => { a.trades.push(trade); if (a.trades.length > 2000) a.trades.shift(); });
}
export function recordAutopilotError(message) {
  updateAutopilot(a => { a.lastError = String(message).slice(0, 500); });
}
export function hasEnteredUnderlyingToday(underlyingKey, day) {
  const a = readPersistentStore().autopilot || {};
  return Boolean(a.enteredToday?.[day]?.includes(underlyingKey));
}
export function markUnderlyingEnteredToday(underlyingKey, day) {
  updateAutopilot(a => {
    a.enteredToday ||= {};
    a.enteredToday[day] ||= [];
    if (!a.enteredToday[day].includes(underlyingKey)) a.enteredToday[day].push(underlyingKey);
    for (const key of Object.keys(a.enteredToday)) if (key !== day) delete a.enteredToday[key];
  });
}
