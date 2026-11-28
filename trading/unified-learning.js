// One attribution contract for every paper-trade surface and historical research source.
const closedStatus=t=>t&&t.status!=="open"&&t.status!=="planned"&&Number.isFinite(Number(t.pnl))&&t.id;
const sourceOf=t=>t.source||t.origin||"app_paper";
export function collectAttributableTrades(payload={}){
 const a=payload.autopilot||{},groups=[
  ...(a.trades||[]).map(t=>({...t,source:t.source||"autopilot"})),
  ...((payload.optionsPaper?.trades)||[]).map(t=>({...t,source:t.source||(t.strategyId?"autopilot_options":"manual_options")})),
  ...((payload.appTradeJournal)||[]).map(t=>({...t,source:t.source||"app_paper"}))
 ];
 const seen=new Map();
 for(const t of groups){if(!closedStatus(t))continue;const key=String(t.sourceTradeId||t.id).split(":").at(-1);const prior=seen.get(key);
  if(!prior||(!prior.strategyId&&t.strategyId))seen.set(key,{...t,source:sourceOf(t),sourceTradeId:key});
 }
 return [...seen.values()].map(t=>({...t,id:String(t.id).split(":").at(-1),strategyId:t.strategyId||inferStrategy(t),marketRegime:t.marketRegime||t.regime||"mixed",timeframe:t.timeframe||"unknown",market:t.market||t.underlyingKey||t.symbol||"unknown",attribution:{source:sourceOf(t),timeframe:t.timeframe||"unknown",market:t.market||t.underlyingKey||"unknown",strategyId:t.strategyId||inferStrategy(t),entryReason:t.entryReason||t.reasons?.join("; ")||null,exitReason:t.outcomeReason||t.exitReason||null}}));
}
function inferStrategy(t){return t.strategyId||t.strategy||t.analysis?.strategyId||"unclassified";}
export function buildHistoricalEvidence(nightLearning={}){
 const rows=[];
 for(const [market,study] of Object.entries(nightLearning.minuteStudies||{})){
  for(const [id,s] of Object.entries(study?.strategies||{}))rows.push({id,market,timeframe:"1m",status:s.status,validation:s.validation||{},outOfSample:s.outOfSample||{},sampleCounts:s.sampleCounts||{outOfSample:s.outOfSample?.trades||0}});
 }
 for(const [market,study] of Object.entries(nightLearning.marketStudies||{})){
  for(const [id,s] of Object.entries(study?.advanced?.strategies||{}))rows.push({id,market,timeframe:"1D",status:s.status,validation:s.validation||{},outOfSample:s.outOfSample||{},sampleCounts:s.sampleCounts||{outOfSample:s.outOfSample?.trades||0}});
 }
 const eligible=rows.filter(r=>r.status==="research_ready"&&(r.sampleCounts.outOfSample||0)>=20&&(r.validation.trades||0)>=10&&Number(r.validation.expectancyPct)>0&&Number(r.outOfSample.expectancyPct)>0&&Number(r.outOfSample.maxDrawdownPct)<=20);
 const byFamily={momentum_confirmation:[],premium_expansion:[],liquidity_first:[]};
 for(const r of rows){const family=/ema_9_21|sma_trend|donchian_breakout/.test(r.id)?"momentum_confirmation":/opening_range_breakout/.test(r.id)?"liquidity_first":/rsi_reversion/.test(r.id)?"premium_expansion":null;if(family)byFamily[family].push(r);}
 const adjustments={};
 for(const [family,list] of Object.entries(byFamily)){const good=list.filter(x=>eligible.includes(x));adjustments[family]=good.length?Math.min(2,good.length):0;}
 return {at:Date.now(),source:"historical_index_proxy",adjustments,studies:rows.map(r=>({strategyId:r.id,market:r.market,timeframe:r.timeframe,status:r.status,validationTrades:r.validation.trades||0,oosTrades:r.outOfSample.trades||0,validationExpectancyPct:r.validation.expectancyPct??null,oosExpectancyPct:r.outOfSample.expectancyPct??null,oosMaxDrawdownPct:r.outOfSample.maxDrawdownPct??null,eligible:eligible.includes(r)})),limitations:["1m/1D historical results are index-price proxies, not options execution P&L.","Historical evidence is a small ranking prior only; it never counts as a closed paper trade.","Only validation plus out-of-sample evidence meeting sample and drawdown gates contributes."]};
}
export function buildUnifiedLearningInput(payload={}){
 const trades=collectAttributableTrades(payload),historical=buildHistoricalEvidence(payload.autopilot?.nightLearning||{});
 return {trades,historical,coverage:{closedPaperTrades:trades.length,bySource:Object.fromEntries([...new Set(trades.map(t=>t.source))].map(source=>[source,trades.filter(t=>t.source===source).length])),historicalStudies:historical.studies.length,eligibleHistoricalStudies:historical.studies.filter(s=>s.eligible).length}};
}
