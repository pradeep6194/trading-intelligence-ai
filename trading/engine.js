// Deterministic, explainable signal engine. This module never sends broker orders.
const MARKETS = new Set(["NIFTY", "BANKNIFTY", "CRUDE_OIL"]);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mean = xs => xs.length ? xs.reduce((a,b) => a+b, 0) / xs.length : null;

function validateCandles(rows) {
  if (!Array.isArray(rows) || rows.length < 30 || rows.length > 2000) throw new Error("Provide 30 to 2000 OHLCV candles");
  return rows.map((x,i) => {
    const c = { timestamp:x.timestamp ?? i, open:Number(x.open), high:Number(x.high), low:Number(x.low), close:Number(x.close), volume:Number(x.volume ?? 0) };
    if (![c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite) || c.high < Math.max(c.open,c.close) || c.low > Math.min(c.open,c.close) || c.high < c.low || c.volume < 0) throw new Error("Invalid OHLCV row " + i);
    return c;
  });
}
function ema(xs,p) { if(xs.length<p)return null; const k=2/(p+1); let v=mean(xs.slice(0,p)); for(const x of xs.slice(p))v=x*k+v*(1-k); return v; }
function rsi(xs,p=14) {
  if(xs.length<=p)return null; let g=0,l=0;
  for(let i=1;i<=p;i++){const d=xs[i]-xs[i-1];if(d>0)g+=d;else l-=d;}
  let ag=g/p,al=l/p;
  for(let i=p+1;i<xs.length;i++){const d=xs[i]-xs[i-1];ag=(ag*(p-1)+Math.max(0,d))/p;al=(al*(p-1)+Math.max(0,-d))/p;}
  return al===0?100:100-100/(1+ag/al);
}
function atr(cs,p=14) {
  const tr=cs.slice(1).map((c,i)=>Math.max(c.high-c.low,Math.abs(c.high-cs[i].close),Math.abs(c.low-cs[i].close)));
  return tr.length<p?null:mean(tr.slice(-p));
}
function vwap(cs) { let pv=0,v=0; for(const c of cs){pv+=((c.high+c.low+c.close)/3)*c.volume;v+=c.volume;} return v?pv/v:null; }

export function analyseMarket(input) {
  if(!MARKETS.has(input?.market))throw new Error("market must be NIFTY, BANKNIFTY or CRUDE_OIL");
  const cs=validateCandles(input.candles), last=cs.at(-1), prev=cs.at(-2), closes=cs.map(c=>c.close);
  const e9=ema(closes,9),e21=ema(closes,21),rv=rsi(closes),av=atr(cs),vw=vwap(cs);
  const lookback=cs.slice(-22,-2), sh=Math.max(...lookback.map(c=>c.high)), sl=Math.min(...lookback.map(c=>c.low));
  const structure={
    bullishSweep:last.low<sl&&last.close>sl, bearishSweep:last.high>sh&&last.close<sh,
    bullishBos:last.close>sh, bearishBos:last.close<sl,
    bullishFvg:last.low>cs.at(-3).high, bearishFvg:last.high<cs.at(-3).low,
    bullishCandle:last.close>last.open&&last.close>=prev.close,
    bearishCandle:last.close<last.open&&last.close<=prev.close,
    swingHigh:sh,swingLow:sl
  };
  const scores={bullish:0,bearish:0,reasons:{bullish:[],bearish:[]}};
  const add=(s,n,r)=>{scores[s]+=n;scores.reasons[s].push(r);};
  if(e9!==null&&e21!==null)(e9>e21?add("bullish",12,"EMA 9 above EMA 21"):add("bearish",12,"EMA 9 below EMA 21"));
  if(vw!==null)(last.close>vw?add("bullish",12,"Price above VWAP"):add("bearish",12,"Price below VWAP"));
  if(rv!==null&&rv>=52&&rv<=70)add("bullish",8,"RSI momentum supports buyers");
  if(rv!==null&&rv<=48&&rv>=30)add("bearish",8,"RSI momentum supports sellers");
  if(structure.bullishSweep)add("bullish",18,"Sell-side liquidity sweep and reclaim");
  if(structure.bearishSweep)add("bearish",18,"Buy-side liquidity sweep and rejection");
  if(structure.bullishBos)add("bullish",14,"Bullish break of structure");
  if(structure.bearishBos)add("bearish",14,"Bearish break of structure");
  if(structure.bullishFvg)add("bullish",8,"Bullish fair value gap");
  if(structure.bearishFvg)add("bearish",8,"Bearish fair value gap");
  if(structure.bullishCandle)add("bullish",8,"Bullish candle confirmation");
  if(structure.bearishCandle)add("bearish",8,"Bearish candle confirmation");
  const o=input.optionsData||{},pcr=Number(o.pcr),co=Number(o.callOiChange),po=Number(o.putOiChange);
  if(Number.isFinite(pcr)&&pcr>1.15)add("bullish",6,"Options PCR bullish bias");
  if(Number.isFinite(pcr)&&pcr<0.85)add("bearish",6,"Options PCR bearish bias");
  if(Number.isFinite(co)&&Number.isFinite(po)){if(po>0&&co<0)add("bullish",6,"Options OI supports bullish positioning");if(co>0&&po<0)add("bearish",6,"Options OI supports bearish positioning");}
  scores.bullish=clamp(scores.bullish,0,100);scores.bearish=clamp(scores.bearish,0,100);
  const side=scores.bullish>scores.bearish?"bullish":scores.bearish>scores.bullish?"bearish":"neutral";
  const confidence=Math.max(scores.bullish,scores.bearish),diff=Math.abs(scores.bullish-scores.bearish);
  const signal=confidence>=65&&diff>=18&&av>0?side:"no_trade",dist=av?av*1.5:null;
  return {market:input.market,timestamp:Date.now(),signal,confidence,lastPrice:last.close,
    indicators:{ema9:e9,ema21:e21,rsi14:rv,atr14:av,vwap:vw},structure,scores,
    plan:signal==="no_trade"?null:{direction:signal,entry:last.close,stopLoss:side==="bullish"?last.close-dist:last.close+dist,target:side==="bullish"?last.close+2*dist:last.close-2*dist,stopDistance:dist,riskReward:2},
    warnings:["Paper/educational signal only; not a prediction or guarantee.","Options-chain inputs must be timestamp-aligned with candles.","Underlying signal is not an options contract selection."]};
}

const state={capital:Number(process.env.PAPER_CAPITAL||100000),riskPct:0.5,dailyLossPct:1,maxTradesPerDay:3,trades:[],open:[],day:new Date().toISOString().slice(0,10),locked:false};
function rollDay(){const d=new Date().toISOString().slice(0,10);if(d!==state.day){state.day=d;state.locked=false;}}
export function paperStatus(){
  rollDay();const today=state.trades.filter(t=>t.day===state.day),pnl=today.reduce((s,t)=>s+t.pnl,0);
  return {mode:"paper",liveOrdersEnabled:false,capital:state.capital,riskPct:state.riskPct,dailyLossLimit:state.capital*state.dailyLossPct/100,realizedPnlToday:pnl,tradesToday:today.length,openPositions:state.open,locked:state.locked,history:state.trades.slice(-500)};
}
export function autoPaperTrade(a){
  rollDay();const st=paperStatus();
  if(a.signal==="no_trade"||!a.plan)return {executed:false,reason:"NO_TRADE: setup below threshold",analysis:a,status:st};
  if(state.locked)return {executed:false,reason:"Daily risk lock active",analysis:a,status:st};
  if(st.tradesToday>=state.maxTradesPerDay)return {executed:false,reason:"Maximum daily entries reached",analysis:a,status:st};
  if(state.open.some(p=>p.market===a.market))return {executed:false,reason:"Position already open for this market",analysis:a,status:st};
  const riskCash=state.capital*state.riskPct/100,qty=Math.floor(riskCash/a.plan.stopDistance);
  if(!Number.isFinite(qty)||qty<1)return {executed:false,reason:"Calculated quantity below one unit",analysis:a,status:st};
  if(qty*a.plan.entry>state.capital*10)return {executed:false,reason:"Position notional exceeds 10x paper capital exposure cap",analysis:a,status:st};
  const p={id:"PAPER-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),day:state.day,market:a.market,direction:a.signal,entry:a.plan.entry,stopLoss:a.plan.stopLoss,target:a.plan.target,quantity:qty,riskCash:qty*a.plan.stopDistance,openedAt:Date.now(),source:"technical_lab",strategyId:a.strategyId||a.strategy?.id||("technical_lab_"+a.signal),marketRegime:a.regime||a.marketRegime||"mixed",timeframe:a.timeframe||a.interval||"unknown",entryReason:a.reason||a.explanation||null};
  state.open.push(p);state.trades.push({...p,pnl:0,status:"open"});return {executed:true,order:p,status:paperStatus()};
}
export function markPaperPosition(market,price){
  rollDay();if(!MARKETS.has(market)||!Number.isFinite(Number(price))||Number(price)<=0)throw new Error("Valid market and positive price required");
  const p=state.open.find(x=>x.market===market);if(!p)return {closed:false,reason:"No open paper position",status:paperStatus()};
  const px=Number(price),stop=p.direction==="bullish"?px<=p.stopLoss:px>=p.stopLoss,target=p.direction==="bullish"?px>=p.target:px<=p.target;
  if(!stop&&!target)return {closed:false,unrealizedPnl:(px-p.entry)*p.quantity*(p.direction==="bullish"?1:-1),status:paperStatus()};
  const exit=stop?p.stopLoss:p.target,pnl=(exit-p.entry)*p.quantity*(p.direction==="bullish"?1:-1);
  state.open=state.open.filter(x=>x.id!==p.id);const t=state.trades.find(x=>x.id===p.id);Object.assign(t,{exit,pnl,status:stop?"stopped":"target_hit",closedAt:Date.now()});
  if(paperStatus().realizedPnlToday<=-(state.capital*state.dailyLossPct/100))state.locked=true;
  return {closed:true,trade:t,status:paperStatus()};
}
