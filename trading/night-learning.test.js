import test from "node:test";
import assert from "node:assert/strict";
import { analyseHistoricalMarket, buildNightLearningReport, RESEARCH_LIBRARY } from "./night-learning.js";

function candles(n=180){const rows=[];let p=100;for(let i=0;i<n;i++){p+=Math.sin(i/7)*1.4+0.12;rows.push([new Date(Date.UTC(2025,0,1+i)).toISOString(),p-0.3,p+1,p-1,p,1000,0]);}return rows;}
test("historical analysis requires real minimum history",()=>{const r=analyseHistoricalMarket(candles(20));assert.equal(r.status,"insufficient_history");});
test("historical analysis produces separate chronological train and OOS diagnostics",()=>{const r=analyseHistoricalMarket(candles());assert.equal(r.status,"available");assert.ok(r.backtests[0].train);assert.ok(r.backtests[0].outOfSample);assert.match(r.backtests[0].entry,/Next daily close/);});
test("night report exposes attributed external research library and guardrails",()=>{const r=buildNightLearningReport({markets:{}});assert.ok(RESEARCH_LIBRARY.length>=6);assert.equal(r.status,"research_library_only");assert.ok(r.guardrails.length>=3);});

import { analyseAdvancedHistoricalMarket, compareStrategyResults } from "./advanced-historical-learning.js";
test("advanced learning engine has three strategies and regime-aware walk-forward tests",()=>{const r=analyseAdvancedHistoricalMarket(candles(260));assert.equal(r.status,"available");assert.equal(Object.keys(r.strategies).length,3);assert.ok(r.walkForward.noRandomShuffle);});

test("strategy comparison withholds ranking below evidence thresholds",()=>{const r=compareStrategyResults({strategies:{sma_trend:{outOfSample:{trades:2,expectancyPct:4,profitFactor:2,maxDrawdownPct:2},validation:{trades:1,expectancyPct:2}}}});assert.equal(r.ranked.length,0);assert.equal(r.weak[0].status,"not_rankable");});
test("strategy comparison ranks only sufficiently sampled strategies with positive validation and OOS metrics",()=>{const r=compareStrategyResults({strategies:{good:{name:"Good",validation:{trades:12,expectancyPct:0.2},outOfSample:{trades:25,expectancyPct:0.3,profitFactor:1.5,maxDrawdownPct:8}},weak:{validation:{trades:12,expectancyPct:-0.1},outOfSample:{trades:30,expectancyPct:-0.2,profitFactor:0.8,maxDrawdownPct:18}}}});assert.equal(r.ranked.length,1);assert.equal(r.ranked[0].id,"good");assert.equal(r.ranked[0].rank,1);assert.ok(r.weak[0].reasons.includes("non_positive_oos_expectancy"));});

test("historical simulations expose trade-level fills, cost assumptions and a buy-and-hold benchmark",()=>{
  const r=analyseAdvancedHistoricalMarket(candles(900));
  assert.equal(r.status,"available");
  assert.equal(r.timeframe,"1D");
  assert.ok(r.costAssumption.roundTripPct>0);
  assert.ok(r.buyHoldBenchmark && Number.isFinite(r.buyHoldBenchmark.netReturnPct));
  const s=r.strategies.sma_trend;
  assert.ok(s && s.train && s.validation && s.outOfSample);
  assert.ok(Array.isArray(s.trades));
  if(s.trades.length){const t=s.trades.at(-1);assert.ok(t.entryAt&&t.exitAt);assert.ok(Number.isFinite(t.entryPrice));assert.ok(Number.isFinite(t.exitPrice));assert.ok(Number.isFinite(t.netPct));}
});
