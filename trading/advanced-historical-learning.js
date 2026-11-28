// Book-derived, research-only daily NIFTY/BANKNIFTY simulations.
// Signals use completed candle i; fills occur at the next candle open.
// This is a cash-index proxy, not an options/futures execution backtest.
import { normaliseCandles } from "./research-feeds.js";

const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const sma = (a, i, n) => i + 1 < n ? null : mean(a.slice(i - n + 1, i + 1));
function rsi(a, i, n = 14) {
  if (i < n) return null;
  let up = 0, down = 0;
  for (let j = i - n + 1; j <= i; j++) { const d = a[j] - a[j - 1]; if (d > 0) up += d; else down -= d; }
  return down === 0 ? 100 : 100 - (100 / (1 + up / down));
}
function regime(c, i) {
  const closes = c.map(x => x.close), c20 = sma(closes, i, 20), c50 = sma(closes, i, 50);
  if (c20 == null || c50 == null) return "unclassified";
  const rets = [];
  for (let j = Math.max(1, i - 19); j <= i; j++) rets.push((c[j].close / c[j - 1].close - 1) * 100);
  const m = mean(rets), variance = mean(rets.map(x => (x - m) ** 2)) || 0, annualVol = Math.sqrt(variance * 252);
  if (annualVol >= 30) return "high_volatility";
  if (c20 > c50 && c[i].close > c20) return "uptrend";
  if (c20 < c50 && c[i].close < c20) return "downtrend";
  return "sideways";
}
function signalAt(c, closes, i, strategy) {
  if (i < 50) return false;
  if (strategy === "sma_trend") return sma(closes, i, 20) > sma(closes, i, 50);
  if (strategy === "rsi_reversion") { const value = rsi(closes, i); return value !== null && value < 30; }
  if (strategy === "donchian_breakout") return c[i].close > Math.max(...c.slice(i - 20, i).map(x => x.high));
  return false;
}
function simulate(c, strategy, costBps) {
  const closes = c.map(x => x.close), trades = [];
  let entry = null;
  for (let i = 50; i < c.length - 1; i++) {
    const want = signalAt(c, closes, i, strategy);
    if (entry && !want) {
      const fill = c[i + 1], grossPct = (fill.open / entry.price - 1) * 100;
      trades.push({
        entryAt: entry.at, exitAt: fill.timestamp, entryPrice: entry.price, exitPrice: fill.open,
        grossPct: +grossPct.toFixed(4), costPct: +(2 * costBps / 100).toFixed(4),
        netPct: +(grossPct - 2 * costBps / 100).toFixed(4), regime: entry.regime,
        holdingDays: Math.max(1, Math.round((Date.parse(fill.timestamp) - Date.parse(entry.at)) / 86400000))
      });
      entry = null;
    } else if (!entry && want) {
      entry = { price: c[i + 1].open, at: c[i + 1].timestamp, regime: regime(c, i) };
    }
  }
  return trades;
}
function metrics(trades) {
  let equity = 1, peak = 1, maxDrawdownPct = 0, grossProfit = 0, grossLoss = 0;
  const wins = trades.filter(t => t.netPct > 0), losses = trades.filter(t => t.netPct <= 0);
  for (const t of trades) {
    equity *= 1 + t.netPct / 100; peak = Math.max(peak, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, (peak - equity) / peak * 100);
    if (t.netPct > 0) grossProfit += t.netPct; else grossLoss += Math.abs(t.netPct);
  }
  return {
    trades: trades.length, winRatePct: trades.length ? +(wins.length / trades.length * 100).toFixed(1) : null,
    expectancyPct: trades.length ? +(trades.reduce((s, t) => s + t.netPct, 0) / trades.length).toFixed(3) : null,
    netReturnPct: +((equity - 1) * 100).toFixed(2),
    profitFactor: grossLoss ? +(grossProfit / grossLoss).toFixed(2) : (grossProfit ? null : 0),
    maxDrawdownPct: +maxDrawdownPct.toFixed(2),
    averageWinPct: wins.length ? +(wins.reduce((s, t) => s + t.netPct, 0) / wins.length).toFixed(3) : null,
    averageLossPct: losses.length ? +(losses.reduce((s, t) => s + t.netPct, 0) / losses.length).toFixed(3) : null,
    averageHoldingDays: trades.length ? +(trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length).toFixed(1) : null
  };
}
function benchmark(c) {
  const first = c[0]?.close, last = c.at(-1)?.close;
  if (!(first > 0 && last > 0)) return null;
  let peak = first, dd = 0;
  for (const bar of c) { peak = Math.max(peak, bar.close); dd = Math.max(dd, (peak - bar.close) / peak * 100); }
  return { label: "Buy-and-hold NIFTY cash-index proxy", netReturnPct: +((last / first - 1) * 100).toFixed(2), maxDrawdownPct: +dd.toFixed(2), from: c[0].timestamp, to: c.at(-1).timestamp };
}

export function analyseAdvancedHistoricalMarket(rows, options = {}) {
  const c = normaliseCandles(rows), minimum = options.minimumCandles || 120, costBps = options.costBpsPerSide ?? 10;
  if (c.length < minimum) return { status: "insufficient_history", candleCount: c.length, strategies: {}, regimes: {}, walkForward: null, limitations: ["At least " + minimum + " valid daily candles are required."] };
  const strategyIds = ["sma_trend", "rsi_reversion", "donchian_breakout"], strategies = {};
  for (const id of strategyIds) {
    const trades = simulate(c, id, costBps), trainEnd = Math.floor(trades.length * 0.6), validationEnd = Math.floor(trades.length * 0.8);
    const train = trades.slice(0, trainEnd), validation = trades.slice(trainEnd, validationEnd), outOfSample = trades.slice(validationEnd);
    strategies[id] = {
      name: ({ sma_trend: "20/50 SMA trend following", rsi_reversion: "14-day RSI oversold reversion", donchian_breakout: "20-day Donchian breakout" })[id],
      train: metrics(train), validation: metrics(validation), outOfSample: metrics(outOfSample),
      sampleCounts: { train: train.length, validation: validation.length, outOfSample: outOfSample.length },
      trades: trades.slice(-30),
      status: outOfSample.length >= 20 ? "research_ready" : "insufficient_oos_trades",
      assumptions: { signal: "Confirmed using daily close; no future candle values", entry: "Next daily candle open after confirmed signal", exit: "Next daily candle open after signal turns false", roundTripCostPct: +(2 * costBps / 100).toFixed(3), position: "Long/flat; one index unit; compounding trade returns" },
      limitations: ["Cash-index proxy only; not an options or futures contract backtest.", "Cost is a configurable flat proxy and does not reproduce full brokerage, STT, GST, exchange fees, spread and market-specific slippage.", "No intraday stop/target, dividends, market impact or queue/fill simulation."]
    };
  }
  const counts = {};
  for (let i = 50; i < c.length; i++) { const label = regime(c, i); counts[label] = (counts[label] || 0) + 1; }
  return {
    status: "available", candleCount: c.length, from: c[0].timestamp, to: c.at(-1).timestamp, timeframe: "1D",
    costAssumption: { basisPointsPerSide: costBps, roundTripPct: +(2 * costBps / 100).toFixed(3), note: "Illustrative friction proxy, not a broker contract-note charge calculation." },
    buyHoldBenchmark: benchmark(c), strategies, regimes: counts,
    walkForward: { method: "Chronological trade split: first 60% train, next 20% validation, final 20% untouched out-of-sample.", noRandomShuffle: true },
    limitations: ["A historical simulation is not a forecast or proof of a durable edge.", "The final OOS segment is not used for parameter selection.", "Daily cash-index results cannot be interpreted as NIFTY options-selling returns.", "No strategy is promoted automatically to live or paper execution."]
  };
}

// Evidence gate: strategy rankings are withheld until samples and risk checks are adequate.
export function compareStrategyResults(advanced, options = {}) {
  const minimumOos = options.minimumOosTrades ?? 20, minimumValidation = options.minimumValidationTrades ?? 10, maxDrawdown = options.maximumDrawdownPct ?? 15;
  const rows = Object.entries(advanced?.strategies || {}).map(([id, s]) => {
    const o = s.outOfSample || {}, v = s.validation || {}, reasons = [];
    if ((o.trades || 0) < minimumOos) reasons.push("insufficient_oos_sample");
    if ((v.trades || 0) < minimumValidation) reasons.push("insufficient_validation_sample");
    if (!(Number.isFinite(o.expectancyPct) && o.expectancyPct > 0)) reasons.push("non_positive_oos_expectancy");
    if (!(Number.isFinite(v.expectancyPct) && v.expectancyPct > 0)) reasons.push("validation_not_positive");
    if (!(Number.isFinite(o.profitFactor) && o.profitFactor >= 1.2)) reasons.push("profit_factor_below_1_2_or_unavailable");
    if (!(Number.isFinite(o.maxDrawdownPct) && o.maxDrawdownPct <= maxDrawdown)) reasons.push("drawdown_above_limit_or_unavailable");
    const eligible = reasons.length === 0;
    const score = eligible ? Number((o.expectancyPct * 10 + Math.min(o.profitFactor, 3) * 10 - Math.min(o.maxDrawdownPct, maxDrawdown) * 0.5).toFixed(2)) : null;
    return { id, name: s.name || id, status: eligible ? "eligible_for_research_watchlist" : "not_rankable", eligible, score, reasons, validation: { trades: v.trades ?? 0, expectancyPct: v.expectancyPct ?? null }, outOfSample: { trades: o.trades ?? 0, winRatePct: o.winRatePct ?? null, expectancyPct: o.expectancyPct ?? null, profitFactor: o.profitFactor ?? null, maxDrawdownPct: o.maxDrawdownPct ?? null } };
  });
  const ranked = rows.filter(x => x.eligible).sort((a, b) => b.score - a.score).map((x, i) => ({ ...x, rank: i + 1 }));
  return { status: ranked.length ? "ranked_with_sufficient_evidence" : "no_strategy_meets_evidence_gate", minimums: { outOfSampleTrades: minimumOos, validationTrades: minimumValidation, minimumProfitFactor: 1.2, maximumDrawdownPct: maxDrawdown, positiveValidationAndOosExpectancy: true }, ranked, weak: rows.filter(x => !x.eligible).map(x => ({ ...x, flags: x.reasons })), all: rows, guardrails: ["Ranking is research-only and uses untouched out-of-sample plus validation metrics.", "Strategies below sample thresholds are not ranked, even if observed returns look strong.", "No strategy is automatically promoted into paper or live execution."] };
}
