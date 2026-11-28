// Night Learning Engine: evidence-led research from historical candles and a curated external source library.
// External source summaries are original concise notes, not copied book/article text.
import { normaliseCandles } from "./research-feeds.js";

export const RESEARCH_LIBRARY = [
  { id:"trading-in-the-zone", title:"Trading in the Zone", author:"Mark Douglas", type:"book", topics:["probabilistic thinking","process consistency","uncertainty"], principles:["Treat each trade as one outcome in a series; evaluate the process over a meaningful sample.","Define risk before entry and accept that any individual setup can fail."], url:"https://www.markdouglas.com/" },
  { id:"mental-game-of-trading", title:"The Mental Game of Trading", author:"Jared Tendler", type:"book", topics:["emotional control","mistake analysis","tilt"], principles:["Classify recurring decision errors before choosing a corrective routine.","Separate technical errors from emotional execution errors."], url:"https://www.jaredtendler.com/" },
  { id:"best-loser-wins", title:"Best Loser Wins", author:"Tom Hougaard", type:"book", topics:["loss acceptance","risk","execution"], principles:["A losing trade is not automatically a bad trade; judge rule adherence separately from outcome.","Avoid widening risk to avoid taking a planned loss."], url:"https://www.tomhougaard.dk/" },
  { id:"trading-psychology-2", title:"Trading Psychology 2.0", author:"Brett N. Steenbarger", type:"book", topics:["performance review","journaling","continuous improvement"], principles:["Use structured review and measurable process goals to improve execution.","Convert recurring observations into testable practice routines."], url:"https://www.brettsteenbarger.com/" },
  { id:"nse-investor-education", title:"NSE Investor Education", author:"National Stock Exchange of India", type:"official_education", topics:["market mechanics","derivatives","risk"], principles:["Understand contract specifications and derivatives risk before trading.","Use exchange-published information as the primary reference for market rules."], url:"https://www.nseindia.com/learn" },
  { id:"sebi-investor", title:"SEBI Investor Education", author:"Securities and Exchange Board of India", type:"official_education", topics:["risk disclosure","investor protection","market conduct"], principles:["Treat derivatives as high-risk instruments and understand the possibility of substantial losses.","Verify regulatory and product information from official disclosures."], url:"https://investor.sebi.gov.in/" },
  { id:"cme-education", title:"CME Group Education", author:"CME Group", type:"market_education", topics:["futures","volatility","risk management"], principles:["Position sizing should be tied to predefined risk, not conviction alone.","Backtests should account for execution costs and avoid look-ahead bias."], url:"https://www.cmegroup.com/education.html" }
];

const finite = v => Number.isFinite(Number(v)) ? Number(v) : null;
function rsi(values, period=14) {
  if(values.length<=period) return null;
  let gains=0, losses=0;
  for(let i=values.length-period;i<values.length;i++){const d=values[i]-values[i-1];if(d>0)gains+=d;else losses-=d;}
  if(losses===0) return 100;
  return 100-(100/(1+gains/losses));
}
function sma(values, end, period) { if(end+1<period)return null;let sum=0;for(let i=end-period+1;i<=end;i++)sum+=values[i];return sum/period; }

export function analyseHistoricalMarket(rows, options={}) {
  const candles=normaliseCandles(rows);
  const min=options.minimumCandles||80;
  if(candles.length<min)return {status:"insufficient_history",candleCount:candles.length,findings:[],backtests:[],limitations:["At least "+min+" daily candles are required; no synthetic data is substituted."]};
  const closes=candles.map(x=>x.close), returns=[];
  for(let i=1;i<closes.length;i++)returns.push((closes[i]/closes[i-1]-1)*100);
  const recent=returns.slice(-20), avg=recent.reduce((a,b)=>a+b,0)/(recent.length||1);
  const variance=recent.reduce((a,b)=>a+(b-avg)**2,0)/(recent.length||1);
  const last=candles.length-1, lastRsi=rsi(closes);
  const trend20=closes[last]>sma(closes,last,20)?"above":"below";
  const trend50=closes[last]>sma(closes,last,50)?"above":"below";
  const findings=[
    {label:"20-day trend",value:trend20+" 20-day average"},
    {label:"50-day trend",value:trend50+" 50-day average"},
    {label:"14-day RSI",value:lastRsi===null?"unavailable":Number(lastRsi.toFixed(1))},
    {label:"20-day realised volatility",value:Number(Math.sqrt(variance*252).toFixed(2))+"% annualised (daily close-to-close estimate)"},
    {label:"20-day average daily return",value:Number(avg.toFixed(3))+"%"}
  ];
  // Conservative close-to-close SMA crossover diagnostic. Signal at close t, enter next close t+1.
  const trades=[]; let position=null;
  for(let i=50;i<closes.length-1;i++){
    const fast=sma(closes,i,20), slow=sma(closes,i,50);
    const prevFast=sma(closes,i-1,20), prevSlow=sma(closes,i-1,50);
    const signal=fast>slow&&prevFast<=prevSlow?"long":fast<slow&&prevFast>=prevSlow?"flat":null;
    if(position&&signal==="flat"){const exit=closes[i+1],gross=(exit/position.entry-1)*100;trades.push({entryAt:candles[position.index+1].timestamp,exitAt:candles[i+1].timestamp,returnPct:gross-0.20});position=null;}
    if(!position&&signal==="long")position={entry:closes[i+1],index:i};
  }
  const split=Math.floor(trades.length*.7), train=trades.slice(0,split), test=trades.slice(split);
  const metrics=items=>{const wins=items.filter(x=>x.returnPct>0),sum=items.reduce((a,x)=>a+x.returnPct,0);return {trades:items.length,winRatePct:items.length?Number((wins.length/items.length*100).toFixed(1)):null,meanReturnPct:items.length?Number((sum/items.length).toFixed(3)):null,totalReturnPct:Number(sum.toFixed(2))};};
  const backtests=[{name:"20/50-day SMA crossover (long/flat)",train:metrics(train),outOfSample:metrics(test),status:test.length>=5?"diagnostic_available":"insufficient_oos_trades",assumedRoundTripCostPct:0.2,entry:"Next daily close after signal close",exit:"Next daily close after bearish cross",limitations:["Simple benchmark, not an options strategy.","Assumed 0.20% round-trip cost; actual brokerage, taxes, spread and slippage vary.","No overlapping positions, dividends or intraday execution simulation.","Chronological split is trade-based; small samples are not statistically reliable."]}];
  return {status:"available",candleCount:candles.length,from:candles[0].timestamp,to:candles.at(-1).timestamp,findings,backtests,limitations:["Historical price behaviour is descriptive, not a forecast.","No look-ahead entry: signals are formed at close and entered at the next close.","This diagnostic does not establish a profitable edge."]};
}

export function buildNightLearningReport(input={}) {
  const markets=input.markets||{};
  const available=Object.entries(markets).filter(([,v])=>v?.status==="available");
  const researchTopics=[...new Set(RESEARCH_LIBRARY.flatMap(x=>x.topics))];
  return {version:1,generatedAt:Date.now(),status:available.length?"research_complete":"research_library_only",
    sources:RESEARCH_LIBRARY.map(({id,title,author,type,url,topics})=>({id,title,author,type,url,topics})),
    marketStudies:markets,
    learningQueue:["Accumulate more daily history before interpreting small-sample backtests.","Compare trend-following and mean-reversion hypotheses out of sample.","Add options-chain historical data only when a verifiable source is available.","Review paper-trade execution errors separately from strategy outcomes."],
    topicCoverage:researchTopics,
    guardrails:["External library is a curated reading guide, not a live web crawl or full-text ingestion.","Book and education principles are concise original summaries; consult linked sources for full material.","Historical diagnostics are research-only and cannot change live or paper entry rules automatically.","No live orders; no claimed predictive accuracy without sufficient out-of-sample evidence."]
  };
}
