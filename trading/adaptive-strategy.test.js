import test from "node:test";
import assert from "node:assert/strict";
import { learnFromClosedTrades, scoreAdaptiveCandidate, selectAdaptiveCandidate } from "./adaptive-strategy.js";

test("closed paper outcomes are learned exactly once",()=>{
 const t={id:"t1",status:"stopped",pnl:-100,strategyId:"momentum_confirmation",marketRegime:"high_momentum"};
 const p=learnFromClosedTrades({},[t]);
 assert.equal(p.stats["momentum_confirmation|high_momentum"].losses,1);
 assert.equal(learnFromClosedTrades(p,[t]).lastLearning.newTrades,0);
});
test("small samples are shrunk and cannot overwhelm scanner score",()=>{
 const c={side:"CE",changePct:4,iv:20,volume:5000,oi:50000,spreadPct:1,volatilityScore:82};
 const p=learnFromClosedTrades({},[{id:"a",status:"stopped",pnl:-50,strategyId:"momentum_confirmation",marketRegime:"high_momentum"}]);
 const scored=scoreAdaptiveCandidate(c,p,{spotChangePct:0.5});
 assert.ok(Math.abs(scored.experience.adjustment)<=0.5);
 assert.equal(scored.experience.status,"exploring");
});
test("selector retains hard liquidity and scanner gates",()=>{
 const good={side:"CE",changePct:4,iv:20,volume:5000,oi:50000,spreadPct:1,volatilityScore:80,underlyingKey:"NSE_INDEX|Nifty 50"};
 const bad={...good,spreadPct:5};
 const r=selectAdaptiveCandidate([good,bad],{},{spotChangePct:0.4});
 assert.equal(r.ranked.length,1);
 assert.equal(r.candidate.strategyId,"momentum_confirmation");
});
