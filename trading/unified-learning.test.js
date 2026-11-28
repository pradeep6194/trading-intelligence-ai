import test from "node:test";
import assert from "node:assert/strict";
import {collectAttributableTrades,buildHistoricalEvidence,buildUnifiedLearningInput} from "./unified-learning.js";
test("collects closed outcomes from autopilot, manual options and app journal; excludes open and plans",()=>{
 const x=collectAttributableTrades({autopilot:{trades:[{id:"a",status:"target_hit",pnl:100,strategyId:"momentum_confirmation"}]},optionsPaper:{trades:[{id:"b",status:"stopped",pnl:-30}]},appTradeJournal:[{id:"c",status:"closed",pnl:20},{id:"d",status:"open",pnl:0},{id:"e",status:"planned"}]});
 assert.deepEqual(x.map(t=>t.id).sort(),["a","b","c"]);assert.equal(x.find(t=>t.id==="b").source,"manual_options");assert.equal(x.find(t=>t.id==="c").strategyId,"unclassified");
});
test("deduplicates same trade across autopilot and options store, retaining attribution",()=>{
 const x=collectAttributableTrades({autopilot:{trades:[{id:"same",status:"target_hit",pnl:50,strategyId:"liquidity_first"}]},optionsPaper:{trades:[{id:"same",status:"target_hit",pnl:50}]}});
 assert.equal(x.length,1);assert.equal(x[0].strategyId,"liquidity_first");
});
test("historical prior requires validation and OOS gates and stays separate from realised trades",()=>{
 const night={minuteStudies:{NIFTY:{strategies:{ema_9_21:{status:"research_ready",validation:{trades:12,expectancyPct:0.1},outOfSample:{trades:30,expectancyPct:0.2,maxDrawdownPct:10}}}}},marketStudies:{}};
 const h=buildHistoricalEvidence(night);assert.equal(h.adjustments.momentum_confirmation,1);assert.equal(h.studies[0].eligible,true);
 assert.equal(buildUnifiedLearningInput({autopilot:{nightLearning:night}}).coverage.closedPaperTrades,0);
});
test("negative OOS or inadequate sample cannot contribute historical prior",()=>{
 const h=buildHistoricalEvidence({minuteStudies:{N:{strategies:{ema_9_21:{status:"research_ready",validation:{trades:15,expectancyPct:0.2},outOfSample:{trades:50,expectancyPct:-0.1,maxDrawdownPct:5}}}}}});
 assert.equal(h.adjustments.momentum_confirmation,0);
});
