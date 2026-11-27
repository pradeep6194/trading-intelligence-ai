import test from "node:test";
import assert from "node:assert/strict";
import { evaluateIntelligenceSuite } from "./intelligence-suite.js";
test("returns ten connected research modules and no live action",()=>{
 const r=evaluateIntelligenceSuite({spot:22000,spotChangePct:.3,pcr:1.2,putOiChangePct:1,callOiChangePct:-.8,premiumChangePct:4,iv:20,volume:3000,spreadPct:2});
 assert.equal(r.modules.length,10); assert.equal(r.decision.bias,"bullish"); assert.equal(r.decision.liveTradingEnabled,false);
 assert.equal(r.modules.find(x=>x.id==="news_events").status,"unavailable");
});
test("does not fabricate direction or missing news data",()=>{
 const r=evaluateIntelligenceSuite({});
 assert.equal(r.decision.bias,"neutral"); assert.equal(r.decision.paperAction,"observe_only");
 assert.equal(r.modules.find(x=>x.id==="institutional").status,"unavailable");
});
test("labels adaptive alignment separately from trade win rate",()=>{
 const r=evaluateIntelligenceSuite({observations:[{forwardOutcome:{hypothesisOutcome:"aligned"}},{forwardOutcome:{hypothesisOutcome:"not_aligned"}}]});
 assert.match(r.modules.find(x=>x.id==="adaptive_learning").summary,/50.0%/);
});
