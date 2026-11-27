// Integrated ten-discipline research layer. Missing feeds stay explicitly unavailable.
const num=v=>v==null||v===""||!Number.isFinite(Number(v))?null:Number(v);
const module=(id,name,status,score,summary,evidence=[],limitations=[])=>({id,name,status,score,summary,evidence,limitations});
export function evaluateIntelligenceSuite(input={}) {
  const spot=num(input.spot), move=num(input.spotChangePct), pcr=num(input.pcr);
  const callOi=num(input.callOiChangePct), putOi=num(input.putOiChangePct);
  const premium=num(input.premiumChangePct), iv=num(input.iv), volume=num(input.volume), spread=num(input.spreadPct);
  const observations=Array.isArray(input.observations)?input.observations:[];
  const trades=Array.isArray(input.trades)?input.trades:[];
  const closed=trades.filter(t=>t.status!=="open"&&num(t.pnl)!==null);
  const wins=closed.filter(t=>Number(t.pnl)>0).length;
  const losses=closed.filter(t=>Number(t.pnl)<0).length;
  const directional=observations.filter(o=>o.forwardOutcome&&o.forwardOutcome.hypothesisOutcome!=="not_directional");
  const aligned=directional.filter(o=>o.forwardOutcome.hypothesisOutcome==="aligned").length;
  const research=input.research||{};
  const ohlcv=research.structure||null;
  const structureEvidence=[...(ohlcv?.evidence||[])];
  if(ohlcv?.status==="available") structureEvidence.push("Liquidity sweeps: "+(ohlcv.liquiditySweeps?.length||0)+"; order-block candidates: "+(ohlcv.orderBlocks?.length||0)+"; FVG zones: "+(ohlcv.fairValueGaps?.length||0)+".");
  if(move!==null) structureEvidence.push("Spot movement since previous worker observation: "+move+"%.");
  const structureStatus=ohlcv?.status==="available"?"available":move===null?"unavailable":"partial";
  const structure=module("market_structure","Market structure intelligence",structureStatus,null,
    ohlcv?.status==="available"?"OHLCV structure: "+ohlcv.bias+"; "+ohlcv.events.length+" BOS/CHoCH events detected.":move===null?"No comparable spot or candle evidence.":(move>0?"Positive":"Negative")+" short-interval spot momentum only.",
    structureEvidence,[...(ohlcv?.limitations||[]),...(ohlcv?[]:["Multi-timeframe OHLCV candles are not available in this snapshot."])]);
  const optionEvidence=[];
  if(pcr!==null) optionEvidence.push("PCR "+pcr.toFixed(2));
  if(callOi!==null) optionEvidence.push("Call OI change "+callOi+"%");
  if(putOi!==null) optionEvidence.push("Put OI change "+putOi+"%");
  if(premium!==null) optionEvidence.push("Leading option premium change "+premium+"%");
  if(iv!==null) optionEvidence.push("IV "+iv+"%");
  if(volume!==null) optionEvidence.push("Volume "+volume);
  if(spread!==null) optionEvidence.push("Spread "+spread+"%");
  const options=module("options","Options intelligence",optionEvidence.length?"available":"unavailable",null,
    optionEvidence.length?"Option-chain positioning, premium and liquidity evidence captured.":"No option-chain evidence available.",optionEvidence);
  const inst=research.institutional||null;
  const institutional=module("institutional","Institutional activity intelligence",inst?.status||"unavailable",null,
    inst?.status==="available"?"FII/DII reported activity loaded; latest records "+(inst.fii?.length||0)+" FII and "+(inst.dii?.length||0)+" DII.":"Institutional activity feed unavailable.",
    [...(inst?.fii||[]).slice(0,3).map(x=>"FII "+x.segment+" net ₹"+x.netAmount),...(inst?.dii||[]).slice(0,2).map(x=>"DII "+x.segment+" net ₹"+x.netAmount)],
    inst?.limitations||["Do not interpret aggregate option OI as confirmed institutional activity."]);
  const br=research.breadth||null;\n  const sectors=research.sectorBreadth||{};\n  const sectorEvidence=Object.entries(sectors).map(([name,x])=>name+": "+x.bias+" ("+x.advances+"/"+x.declines+")");
  const breadth=module("market_wide","Market-wide intelligence",br?.status||"unavailable",null,
    br?.status==="available"?"Sampled breadth "+br.bias+": "+br.advances+" advances / "+br.declines+" declines from "+br.sampleSize+" instruments.":"Market breadth quote sample unavailable.",
    br?.status==="available"?["A/D ratio "+(br.advanceDeclineRatio??"undefined"),"Breadth differential "+br.breadthPct+"%"]:[],
    [...(br?.limitations||["No quote rows available."]),...(br?.coverage?.successfulQuoteChunks<br?.coverage?.totalQuoteChunks?["Only "+br.coverage.successfulQuoteChunks+"/"+br.coverage.totalQuoteChunks+" quote chunks succeeded."]:[])]);
  const newsItems=research.news||[];
  const exchangeNews=research.exchangeAnnouncements||[];
  const news=module("news_events","News and event intelligence",newsItems.length||exchangeNews.length?"available":"unavailable",null,
    newsItems.length||exchangeNews.length?(newsItems.length+" Upstox news items; "+exchangeNews.length+" NSE exchange announcements returned."):"No verified instrument news or official exchange announcements returned.",
    [...exchangeNews.slice(0,3).map(x=>String(x.symbol||x.sm_name||"NSE filing")+": "+String(x.desc||x.subject||"Announcement")),...newsItems.slice(0,3).map(x=>x.headline+" ("+x.instrumentKey+")")],
    ["Upstox news covers the past seven days and requested instruments only.","NSE announcements are accepted only from the official NSE endpoint; access may be restricted.","Headlines and filings are not treated as confirmed causal catalysts."]);
  const backtests=research.backtests||{};
  const testEvidence=Object.entries(backtests).map(([key,x])=>key+" OOS: "+(x.outOfSample?.trades??0)+" trades, win rate "+(x.outOfSample?.winRatePct??"—")+"%, expectancy "+(x.outOfSample?.expectancyPct??"—")+"%, max DD "+(x.outOfSample?.maxDrawdownPct??"—")+"%.");
  const patternReady=Object.values(backtests).some(x=>x.status==="research_ready");
  const pattern=module("pattern_discovery","Historical pattern discovery",patternReady?"research_ready":"insufficient_history",null,
    patternReady?"Chronological train/test benchmark backtests are available; results are research diagnostics, not proof of edge.":"Waiting for sufficient historical candles and at least ten out-of-sample signals.",
    ["Stored observations available: "+observations.length,...testEvidence],Object.values(backtests).flatMap(x=>x.limitations||["Backtest not available."]));
  const riskEvidence=["Closed paper trades: "+closed.length,"Wins: "+wins,"Losses: "+losses];
  const risk=module("risk","Risk intelligence", "available",null,
    closed.length?"Paper-trade outcomes are being tracked; detailed portfolio exposure and drawdown require position/equity history.":"Risk controls remain enforced by the existing paper execution engine.",
    riskEvidence,["No portfolio-wide VaR, correlation exposure or realized drawdown estimate is calculated by this research layer."]);
  const adaptive=module("adaptive_learning","Adaptive learning intelligence",directional.length?"available":"collecting",null,
    directional.length?("Next-observation directional alignment: "+aligned+"/"+directional.length+" ("+(aligned/directional.length*100).toFixed(1)+"%). This is not a trade win rate."):"Collecting forward-labelled observations.",
    ["Forward-labelled hypotheses: "+directional.length,"Aligned next observations: "+aligned],
    ["This is a simple next-scan label, not calibrated probability or proof of a trading edge."]);
  const recentLosses=closed.slice(-5).filter(t=>Number(t.pnl)<0).length;
  const psychology=module("psychology","Trading psychology intelligence",closed.length?"partial":"collecting",null,
    recentLosses>=3?"Three or more losses in the last five closed paper trades: review discipline and setup quality.":"Paper-trade behaviour is monitored; no emotional state is inferred.",
    ["Recent five-trade losses: "+recentLosses],["Psychological state cannot be diagnosed from P&L alone; this is a process-risk prompt."]);
  const explain=module("explainability","Explainable trade intelligence","available",null,
    "Evidence, unavailable feeds, limitations and paper-trade rationale are attached to the shared research snapshot.",
    ["Market bias: "+(move===null?"unknown":move>0?"bullish momentum":"bearish momentum"),"Option evidence fields: "+optionEvidence.length]);
  const modules=[structure,options,institutional,breadth,news,pattern,risk,adaptive,psychology,explain];
  const votes=[];
  if(move!==null&&Math.abs(move)>=0.1) votes.push({source:"spot_momentum",bias:move>0?"bullish":"bearish",weight:1});
  if(move!==null&&putOi!==null&&callOi!==null&&Math.abs(move)>=0.1) {
    const agrees=(move>0&&putOi>0&&callOi<0)||(move<0&&callOi>0&&putOi<0);
    if(agrees) votes.push({source:"price_and_oi_alignment",bias:move>0?"bullish":"bearish",weight:0.5});
  }
  const total=votes.reduce((s,v)=>s+v.weight,0);
  const bullish=votes.filter(v=>v.bias==="bullish").reduce((s,v)=>s+v.weight,0);
  const bearish=votes.filter(v=>v.bias==="bearish").reduce((s,v)=>s+v.weight,0);
  const bias=total===0||bullish===bearish?"neutral":bullish>bearish?"bullish":"bearish";
  const confidence=total===0?"insufficient":votes.length>1?"low-to-moderate":"low";
  const decision={
    bias,confidence,voteCount:votes.length,votes,
    paperAction:"observe_only",
    reason: bias==="neutral"?"Insufficient aligned independent evidence; no directional paper decision from the integrated layer.":"Directional hypothesis only; the existing paper strategy and risk gates remain authoritative.",
    liveTradingEnabled:false
  };
  return {version:3,at:Date.now(),research,modules,decision,
    dataQuality:{availableModules:modules.filter(m=>m.status==="available"||m.status==="partial"||m.status==="research_ready").length,
      totalModules:10,unavailableModules:modules.filter(m=>m.status==="unavailable").map(m=>m.id)},
    guardrails:["No live orders.","Missing data is labelled unavailable, never imputed.","A module score is not a probability.","Existing paper-trading risk rules remain authoritative."]};
}
