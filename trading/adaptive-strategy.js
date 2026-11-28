// Experience-driven paper strategy policy. Learns only from closed, attributable paper trades.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const keyOf=(strategyId,regime)=>strategyId+"|"+regime;
export function classifySetup(candidate, market={}) {
  const change=Number(candidate.changePct||0), move=Number(market.spotChangePct||0);
  const aligned=(candidate.side==="CE"&&move>0)||(candidate.side==="PE"&&move<0);
  const regime=Math.abs(move)<0.10?"mixed":Math.abs(move)>=0.35?"high_momentum": "moderate_momentum";
  const strategyId=aligned?"momentum_confirmation":Math.abs(change)>=5?"premium_expansion":"liquidity_first";
  return {strategyId,regime,features:{side:candidate.side,spotChangePct:move,premiumChangePct:change,iv:candidate.iv??null,volume:candidate.volume,oi:candidate.oi,spreadPct:candidate.spreadPct}};
}
export function learnFromClosedTrades(policy={},trades=[]) {
  const next=structuredClone(policy||{});next.version=1;next.stats||={};next.learnedTradeIds||=[];
  let learned=0;
  for(const trade of trades){
    if(!trade||trade.status==="open"||!Number.isFinite(Number(trade.pnl))||!trade.strategyId||!trade.id||next.learnedTradeIds.includes(trade.id))continue;
    const key=keyOf(trade.strategyId,trade.marketRegime||"mixed"),s=next.stats[key]||{trades:0,wins:0,losses:0,netPnl:0,avgPnl:0};
    const pnl=Number(trade.pnl);s.trades++;if(pnl>0)s.wins++;else if(pnl<0)s.losses++;s.netPnl=Number((s.netPnl+pnl).toFixed(2));s.avgPnl=Number((s.netPnl/s.trades).toFixed(2));s.lastOutcome=pnl>0?"win":pnl<0?"loss":"breakeven";s.updatedAt=Date.now();next.stats[key]=s;
    next.learnedTradeIds.push(trade.id);learned++;
  }
  if(next.learnedTradeIds.length>3000)next.learnedTradeIds=next.learnedTradeIds.slice(-3000);
  next.lastLearning={at:Date.now(),newTrades:learned,totalLearned:next.learnedTradeIds.length};
  return next;
}
export function scoreAdaptiveCandidate(candidate,policy={},market={}) {
  const setup=classifySetup(candidate,market),s=policy?.stats?.[keyOf(setup.strategyId,setup.regime)];
  const n=s?.trades||0,winRate=n?s.wins/n:0.5;\n  const historicalAdjustment=Number(policy?.historicalEvidence?.adjustments?.[setup.strategyId]||0);
  // Shrink small samples toward neutral; never allow past P&L to override liquidity/risk gates.
  const evidenceWeight=Math.min(1,n/20),experienceAdjustment=clamp((winRate-0.5)*20*evidenceWeight,-5,5);
  const base=Number(candidate.volatilityScore||0);
  return {...candidate,...setup,adaptiveScore:Number((base+experienceAdjustment+historicalAdjustment).toFixed(2)),\n    historicalAdjustment,
    experience:{trades:n,winRatePct:n?Number((winRate*100).toFixed(1)):null,netPnl:s?.netPnl??0,adjustment:Number(experienceAdjustment.toFixed(2)),status:n<20?"exploring":"experience_adjusted"}};
}
export function selectAdaptiveCandidate(candidates=[],policy={},market={}) {
  const ranked=candidates.map(c=>scoreAdaptiveCandidate(c,policy,market))
    .filter(c=>c.volatilityScore>=70&&c.changePct>=3&&c.spreadPct<=3.5&&c.volume>=1000&&c.oi>=10000)
    .sort((a,b)=>b.adaptiveScore-a.adaptiveScore);
  return {candidate:ranked[0]||null,ranked:ranked.slice(0,10),policyVersion:1,
    reason:ranked.length?"Selected by current scanner quality plus experience adjustment; small samples remain near neutral.":"No candidate passed existing liquidity and risk gates."};
}
export function summarizeAdaptivePolicy(policy={}) {
  return Object.entries(policy.stats||{}).map(([key,s])=>({key,trades:s.trades,wins:s.wins,losses:s.losses,winRatePct:s.trades?Number((s.wins/s.trades*100).toFixed(1)):null,netPnl:s.netPnl,avgPnl:s.avgPnl})).sort((a,b)=>b.trades-a.trades);
}
