// Real-feed normalisation and deterministic research features. No synthetic market values.
const finite = value => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);

export function normaliseCandles(rows = []) {
  return rows.map(row => {
    if (!Array.isArray(row) || row.length < 6) return null;
    const [timestamp, open, high, low, close, volume, oi] = row;
    const candle = { timestamp: typeof timestamp === "number" ? timestamp : Date.parse(timestamp), open: finite(open), high: finite(high), low: finite(low), close: finite(close), volume: finite(volume), oi: finite(oi) };
    if (!Number.isFinite(candle.timestamp) || [candle.open,candle.high,candle.low,candle.close].some(v => v === null) || candle.high < candle.low) return null;
    return candle;
  }).filter(Boolean).sort((a,b) => a.timestamp-b.timestamp);
}

function pivots(candles, left = 2, right = 2) {
  const highs = [], lows = [];
  for (let i=left; i<candles.length-right; i++) {
    const window = candles.slice(i-left, i+right+1);
    if (window.every((c,j) => j===left || candles[i].high > c.high)) highs.push({ index:i, price:candles[i].high, timestamp:candles[i].timestamp });
    if (window.every((c,j) => j===left || candles[i].low < c.low)) lows.push({ index:i, price:candles[i].low, timestamp:candles[i].timestamp });
  }
  return { highs, lows };
}

export function analyseOhlcvStructure(rows, options = {}) {
  const candles = normaliseCandles(rows);
  const minimum = options.minimumCandles || 20;
  if (candles.length < minimum) return { status:"insufficient_history", candleCount:candles.length, timeframe:options.timeframe || null, bias:"unknown", events:[], levels:{}, evidence:[], limitations:["At least "+minimum+" valid candles are required for swing structure."] };
  const {highs,lows}=pivots(candles, options.pivotLeft || 2, options.pivotRight || 2);
  const last=candles.at(-1), priorHigh=highs.filter(x=>x.index<candles.length-1).at(-1), priorLow=lows.filter(x=>x.index<candles.length-1).at(-1);
  const previousHigh=highs.filter(x=>x.index<(priorHigh?.index ?? 0)).at(-1), previousLow=lows.filter(x=>x.index<(priorLow?.index ?? 0)).at(-1);
  const events=[];
  let bias="range";
  if (priorHigh && priorLow && previousHigh && previousLow) {
    if(priorHigh.price>previousHigh.price && priorLow.price>previousLow.price) bias="bullish";
    else if(priorHigh.price<previousHigh.price && priorLow.price<previousLow.price) bias="bearish";
  }
  if(priorHigh && last.close>priorHigh.price) events.push({type:"BOS",direction:"bullish",level:priorHigh.price,confirmedBy:"candle_close"});
  if(priorLow && last.close<priorLow.price) events.push({type:"BOS",direction:"bearish",level:priorLow.price,confirmedBy:"candle_close"});
  if(events.some(e=>e.direction==="bullish") && bias==="bearish") events.push({type:"CHoCH",direction:"bullish",level:priorHigh.price,confirmedBy:"candle_close"});
  if(events.some(e=>e.direction==="bearish") && bias==="bullish") events.push({type:"CHoCH",direction:"bearish",level:priorLow.price,confirmedBy:"candle_close"});
  const sweeps=[];
  if(priorHigh && last.high>priorHigh.price && last.close<=priorHigh.price) sweeps.push({type:"buy_side_liquidity_sweep",level:priorHigh.price,wickHigh:last.high,close:last.close,timestamp:last.timestamp});
  if(priorLow && last.low<priorLow.price && last.close>=priorLow.price) sweeps.push({type:"sell_side_liquidity_sweep",level:priorLow.price,wickLow:last.low,close:last.close,timestamp:last.timestamp});
  const orderBlocks=[];
  for(const event of events.filter(x=>x.type==="BOS")){
    const start=Math.max(0,candles.length-12);
    for(let i=candles.length-2;i>=start;i--){
      const c=candles[i], opposing=event.direction==="bullish"?c.close<c.open:c.close>c.open;
      if(opposing){orderBlocks.push({type:event.direction==="bullish"?"bullish_order_block_candidate":"bearish_order_block_candidate",low:c.low,high:c.high,sourceTimestamp:c.timestamp,confirmedBy:"subsequent_close_break"});break;}
    }
  }
  const gaps=[];
  for(let i=2;i<candles.length;i++){
    const a=candles[i-2], c=candles[i];
    if(c.low>a.high) gaps.push({type:"bullish_FVG",low:a.high,high:c.low,timestamp:c.timestamp});
    if(c.high<a.low) gaps.push({type:"bearish_FVG",low:c.high,high:a.low,timestamp:c.timestamp});
  }
  const avgVolume=candles.slice(-21,-1).reduce((s,c)=>s+(c.volume||0),0)/Math.max(1,candles.slice(-21,-1).length);
  const volumeRatio=avgVolume>0&&last.volume!=null?Number((last.volume/avgVolume).toFixed(2)):null;
  return {status:"available",candleCount:candles.length,timeframe:options.timeframe||null,lastCandleAt:last.timestamp,bias,
    events,liquiditySweeps:sweeps,orderBlocks:orderBlocks.slice(-5),levels:{lastSwingHigh:priorHigh?.price??null,lastSwingLow:priorLow?.price??null},
    fairValueGaps:gaps.slice(-8),volumeRatio,volumeConfirmed:volumeRatio==null?null:volumeRatio>=1.5,
    evidence:["Structure derived from "+candles.length+" OHLCV candles.","Swing pivots use "+(options.pivotLeft||2)+" bars left and "+(options.pivotRight||2)+" bars right.","BOS/CHoCH require a candle close beyond the latest confirmed swing."],
    limitations:["FVG is a three-candle price-gap heuristic, not proof of institutional order flow.","Order blocks are last-opposing-candle candidates before a close-confirmed break; sweeps require wick-through and close-back-inside. Both are heuristics, not proof of institutional orders.","Latest unfinished candle may change until its interval closes."]};
}

export function analyseMarketBreadth(quotes = {}) {
  const rows=Object.entries(quotes).map(([key,q])=>({key,change:finite(q?.net_change ?? q?.netChange ?? (finite(q?.last_price)!=null&&finite(q?.ohlc?.close)!=null?finite(q.last_price)-finite(q.ohlc.close):null))})).filter(x=>x.change!==null);
  const advances=rows.filter(x=>x.change>0).length, declines=rows.filter(x=>x.change<0).length, unchanged=rows.length-advances-declines;
  const ratio=declines?Number((advances/declines).toFixed(2)):advances?null:0;
  return {status:rows.length?"available":"unavailable",sampleSize:rows.length,advances,declines,unchanged,advanceDeclineRatio:ratio,
    breadthPct:rows.length?Number(((advances-declines)/rows.length*100).toFixed(2)):null,
    bias:advances>declines?"positive":declines>advances?"negative":"neutral",
    limitations:rows.length?["Breadth is calculated only from the instruments successfully returned by the quote API; it is not automatically the complete NSE cash universe."]:["No quote rows were available."]};
}

export function summariseInstitutionalFlows(fiiPayload, diiPayload) {
  const latest = payload => Object.entries(payload?.data||{}).flatMap(([segment,items])=>(items||[]).map(item=>({segment,...item}))).sort((a,b)=>Number(b.time_stamp)-Number(a.time_stamp));
  const fii=latest(fiiPayload), dii=latest(diiPayload);
  const net=items=>items.map(x=>({...x,netAmount:finite(x.buy_amount)!=null&&finite(x.sell_amount)!=null?Number((Number(x.buy_amount)-Number(x.sell_amount)).toFixed(2)):null}));
  return {status:fii.length||dii.length?"available":"unavailable",fii:net(fii),dii:net(dii),
    latestFiiAt:fii[0]?.time_stamp??null,latestDiiAt:dii[0]?.time_stamp??null,
    limitations:["FII derivatives segment totals and cash-market flows are different datasets; do not combine unlike segments.","Daily institutional data is not an intraday order-flow feed.","FII/DII activity is reported activity, not a directional forecast."]};
}

export function normaliseVerifiedNews(payload, now = Date.now()) {
  const items=Object.entries(payload?.data||{}).flatMap(([instrumentKey,rows])=>(rows||[]).map(item=>({
    instrumentKey,headline:String(item.heading||"").trim(),summary:String(item.summary||"").trim(),
    url:String(item.article_link||""),publishedAt:Number(item.published_time)||null,
    source:"Upstox News API",verifiedSource: /^https:\/\/upstox\.com\//.test(String(item.article_link||"")),
  }))).filter(x=>x.headline&&x.publishedAt&&x.publishedAt<=now&&x.publishedAt>=now-7*86400000&&x.verifiedSource);
  const seen=new Set();
  return items.filter(x=>{const key=x.url||x.headline;if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>b.publishedAt-a.publishedAt);
}
