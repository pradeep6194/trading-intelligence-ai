// Advanced historical learning v2. Research-only long/flat daily-candle simulations.
import { normaliseCandles } from "./research-feeds.js";

const mean=(a)=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sma=(a,i,n)=>i+1<n?null:mean(a.slice(i-n+1,i+1));
function rsi(a,i,n=14){if(i<n)return null;let up=0,down=0;for(let j=i-n+1;j<=i;j++){const d=a[j]-a[j-1];if(d>0)up+=d;else down-=d;}return down===0?100:100-100/(1+up/down);}
function regime(c,i){const c20=sma(c.map(x=>x.close),i,20),c50=sma(c.map(x=>x.close),i,50);if(c20==null||c50==null)return "unclassified";const vol=[];for(let j=Math.max(1,i-19);j<=i;j++)vol.push((c[j].close/c[j-1].close-1)*100);const m=mean(vol),v=mean(vol.map(x=>(x-m)**2))||0,ann=Math.sqrt(v*252);if(ann>=30)return "high_volatility";if(c20>c50&&c[i].close>c20)return "uptrend";if(c20<c50&&c[i].close<c20)return "downtrend";return "sideways";}
function metrics(trades){let equity=1,peak=1,dd=0,g=0,l=0,w=0;for(const t of trades){const r=t.netPct/100;equity*=1+r;peak=Math.max(peak,equity);dd=Math.max(dd,(peak-equity)/peak*100);if(r>0){w++;g+=r;}else l+=Math.abs(r);}return {trades:trades.length,winRatePct:trades.length?+(w/trades.length*100).toFixed(1):null,expectancyPct:trades.length?+(trades.reduce((s,t)=>s+t.netPct,0)/trades.length).toFixed(3):null,netReturnPct:+((equity-1)*100).toFixed(2),profitFactor:l?+(g/l).toFixed(2):null,maxDrawdownPct:+dd.toFixed(2)};}
function signalAt(c,closes,i,strategy){if(i<50)return false;if(strategy==="sma_trend")return sma(closes,i,20)>sma(closes,i,50);if(strategy==="rsi_reversion"){const x=rsi(closes,i);return x!==null&&x<30;}if(strategy==="donchian_breakout"){const prior=c.slice(i-20,i);return c[i].close>Math.max(...prior.map(x=>x.high));}return false;}
function simulate(c,strategy,costBps){const closes=c.map(x=>x.close),out=[];let entry=null;for(let i=50;i<c.length-1;i++){const want=signalAt(c,closes,i,strategy);if(entry&&!want){const exit=c[i+1].open;out.push({entryAt:entry.at,exitAt:c[i+1].timestamp,netPct:+(((exit/entry.price-1)*100-2*costBps/100).toFixed(4)),regime:entry.regime});entry=null;}else if(!entry&&want){entry={price:c[i+1].open,at:c[i+1].timestamp,regime:regime(c,i)};}}return out;}
export function analyseAdvancedHistoricalMarket(rows,options={}){const c=normaliseCandles(rows),minimum=options.minimumCandles||120,costBps=options.costBpsPerSide??10;if(c.length<minimum)return {status:"insufficient_history",candleCount:c.length,strategies:[],regimes:{},walkForward:null,limitations:["At least "+minimum+" valid daily candles are required."]};const strategies=["sma_trend","rsi_reversion","donchian_breakout"],all={};for(const name of strategies){const trades=simulate(c,name,costBps),a=Math.floor(trades.length*.6),b=Math.floor(trades.length*.8);all[name]={name,train:metrics(trades.slice(0,a)),validation:metrics(trades.slice(a,b)),outOfSample:metrics(trades.slice(b)),status:trades.slice(b).length>=20?"research_ready":"insufficient_oos_trades",sampleCounts:{train:a,validation:b-a,outOfSample:trades.length-b},assumptions:{entry:"Next daily candle open after confirmed signal",exit:"Next daily candle open after signal turns false",roundTripCostPct:2*costBps/100,position:"Long/flat only"},limitations:["Daily cash-index proxy only; not an options backtest.","No intraday stop/target, market impact, dividends or full Indian statutory charges.","RSI oversold entry waits for RSI below 30; exit when condition ceases.","No parameter optimization; all thresholds fixed before testing."]};}const counts={};for(let i=50;i<c.length;i++){const x=regime(c,i);counts[x]=(counts[x]||0)+1;}return {status:"available",candleCount:c.length,from:c[0].timestamp,to:c.at(-1).timestamp,timeframe:"1D",strategies:all,regimes:counts,walkForward:{method:"Chronological trade split: first 60% train, next 20% validation, final 20% untouched out-of-sample.",noRandomShuffle:true},limitations:["Regime labels are heuristic classifications, not forecasts.","A strategy is not considered research-ready until it has at least 20 out-of-sample trades.","A high historical return is not evidence of future profitability; compare expectancy, drawdown, costs and multiple regimes.","This module does not alter trade signals, paper-trading rules or execute orders."]};}


// Evidence-gated comparison: ranking is withheld until validation and untouched OOS samples are large enough.
export function compareStrategyResults(advanced, options={}) {
  const minimumOos=options.minimumOosTrades??20;
  const minimumValidation=options.minimumValidationTrades??10;
  const maxDrawdown=options.maximumDrawdownPct??15;
  const rows=Object.entries(advanced?.strategies||{}).map(([id,s])=>{
    const o=s.outOfSample||{},v=s.validation||{};
    const reasons=[];
    if((o.trades||0)<minimumOos) reasons.push("insufficient_oos_sample");
    if((v.trades||0)<minimumValidation) reasons.push("insufficient_validation_sample");
    if(!(Number.isFinite(o.expectancyPct)&&o.expectancyPct>0)) reasons.push("non_positive_oos_expectancy");
    if(!(Number.isFinite(v.expectancyPct)&&v.expectancyPct>0)) reasons.push("validation_not_positive");
    if(!(Number.isFinite(o.profitFactor)&&o.profitFactor>=1.2)) reasons.push("profit_factor_below_1_2_or_unavailable");
    if(!(Number.isFinite(o.maxDrawdownPct)&&o.maxDrawdownPct<=maxDrawdown)) reasons.push("drawdown_above_limit_or_unavailable");
    const eligible=reasons.length===0;
    const score=eligible?Number((o.expectancyPct*10+Math.min(o.profitFactor,3)*10-Math.min(o.maxDrawdownPct,maxDrawdown)*0.5).toFixed(2)):null;
    return {id,name:s.name||id,status:eligible?"eligible_for_research_watchlist":"not_rankable",eligible,score,reasons,validation:{trades:v.trades??0,expectancyPct:v.expectancyPct??null},outOfSample:{trades:o.trades??0,winRatePct:o.winRatePct??null,expectancyPct:o.expectancyPct??null,profitFactor:o.profitFactor??null,maxDrawdownPct:o.maxDrawdownPct??null}};
  });
  const ranked=rows.filter(x=>x.eligible).sort((a,b)=>b.score-a.score).map((x,i)=>({...x,rank:i+1}));
  const weak=rows.filter(x=>!x.eligible).map(x=>({...x,flags:x.reasons}));
  return {status:ranked.length?"ranked_with_sufficient_evidence":"no_strategy_meets_evidence_gate",minimums:{outOfSampleTrades:minimumOos,validationTrades:minimumValidation,minimumProfitFactor:1.2,maximumDrawdownPct:maxDrawdown,positiveValidationAndOosExpectancy:true},ranked,weak,all:rows,guardrails:["Ranking is research-only and uses untouched out-of-sample plus validation metrics.","Strategies below sample thresholds are not ranked, even if their observed returns look strong.","No strategy is automatically promoted into paper or live execution."]};
}
