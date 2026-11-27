(()=>{"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=(v,d=2)=>v==null?"—":Number(v).toLocaleString("en-IN",{maximumFractionDigits:d});
function render(d){
 $("learnState").textContent=d.active?"BACKGROUND LEARNING ACTIVE":"EXPERIMENT PAUSED";
 $("learnScans").textContent=num(d.scanCount,0);
 $("learnUniverse").textContent=num(d.watchlistCount,0)+" underlyings in rotating NSE F&O universe";
 $("learnLast").textContent=d.lastScanAt?new Date(d.lastScanAt).toLocaleString("en-IN"):"No completed scan yet";
 $("learnTrades").textContent=num(d.tradeCount,0);
 $("learnPnl").textContent="₹"+num(d.realizedPnl);
 $("learnWin").textContent=d.winRate==null?"—":num(d.winRate,1)+"%";
 const rows=d.observations||[];
 const evaluated=rows.filter(x=>x.forwardOutcome&&x.forwardOutcome.hypothesisOutcome!=="not_directional");
 const aligned=evaluated.filter(x=>x.forwardOutcome.hypothesisOutcome==="aligned").length;
 const hitRate=evaluated.length?aligned/evaluated.length*100:null;
 const latest=rows.find(x=>x.analysis);
 const suite=d.integratedIntelligence||latest?.intelligence||null;
 $("learnSuiteDecision").innerHTML=suite?'<div class="learn-suite-decision"><b>'+esc(suite.decision.bias.toUpperCase())+' · '+esc(suite.decision.confidence)+'</b><p>'+esc(suite.decision.reason)+'</p><small>'+suite.dataQuality.availableModules+'/10 modules have usable or partial evidence · Live orders disabled</small></div>':"No integrated snapshot yet. It will populate after the next successful background scan.";
 const research=d.latestResearch||null;
 $("learnResearchFeeds").innerHTML=research?Object.entries(research.feedStatus||{}).map(([key,status])=>'<div class="learn-suite-module"><div><b>'+esc(({institutional:"FII / DII institutional flow",breadth:"Market breadth",news:"Verified instrument news",ohlcv:"OHLCV market structure"})[key]||key)+'</b><span class="learn-status">'+esc(status.replaceAll("_"," "))+'</span></div><p>'+esc(key==="institutional"?"Daily/monthly provider-reported flow; not intraday order flow.":key==="breadth"?"Advance/decline from "+(research.breadth?.sampleSize||0)+" returned instruments.":key==="news"?(research.news?.length||0)+" recent provider-linked headlines.":"Multi-timeframe candles for NIFTY and BANK NIFTY.")+'</p></div>').join("")+
 '<small class="learn-note">Last collection: '+(research.at?new Date(research.at).toLocaleString("en-IN"):"—")+' · Source: '+esc(research.provider||"—")+'</small>'+
 Object.entries(research.structures||{}).map(([key,frames])=>'<div class="learn-suite-module"><b>'+esc(key)+'</b><p>'+Object.entries(frames).map(([tf,x])=>esc(tf+": "+x.status+(x.status==="available"?" · "+x.bias+" · "+x.events.length+" BOS/CHoCH":""))).join(" | ")+'</p></div>').join("")
 :"No live research collection yet. Start the 90-day paper experiment and wait for the next successful market-hours worker cycle.";
 if(research){
   const sectors=Object.entries(research.sectorBreadth||{}); const breadth=research.breadth||{};
   $("learnResearchFeeds").innerHTML += '<div class="learn-research-detail"><b>NSE cash breadth coverage</b><p>'+num(breadth.advances,0)+' advances · '+num(breadth.declines,0)+' declines · '+num(breadth.unchanged,0)+' unchanged · '+num(breadth.sampleSize,0)+' quotes</p><small>Requested equity universe: '+num(breadth.coverage?.requestedEquities,0)+' · Successful quote batches: '+num(breadth.coverage?.successfulQuoteChunks,0)+'/'+num(breadth.coverage?.totalQuoteChunks,0)+'</small></div>'+
   '<div class="learn-research-detail"><b>Sector breadth</b>'+(sectors.length?sectors.map(([name,x])=>'<p>'+esc(name)+': '+esc(x.bias)+' · '+x.advances+' advances / '+x.declines+' declines</p>').join(""):'<p>Sector quote data unavailable.</p>')+'</div>'+
   '<div class="learn-research-detail"><b>Chronological backtest · NIFTY / BANK NIFTY</b>'+Object.entries(research.backtests||{}).map(([key,x])=>'<p>'+esc(key)+' · '+esc(x.status||"unknown")+'<br>Train: '+num(x.train?.trades,0)+' trades, '+num(x.train?.winRatePct,1)+'% wins, '+num(x.train?.netReturnPct,2)+'% net<br>Out-of-sample: '+num(x.outOfSample?.trades,0)+' trades, '+num(x.outOfSample?.winRatePct,1)+'% wins, expectancy '+num(x.outOfSample?.expectancyPct,3)+'%, max DD '+num(x.outOfSample?.maxDrawdownPct,2)+'%</p><small>'+esc(x.method||"Historical data unavailable")+'</small>').join("")+'</div>'+
   '<div class="learn-research-detail"><b>Official NSE announcements</b><p>'+num(research.exchangeAnnouncements?.length,0)+' announcements returned for today’s NSE query.</p></div>';
 }
 $("learnResearchNews").innerHTML=research?.news?.length?'<h4>Recent verified news</h4>'+research.news.slice(0,8).map(n=>'<article class="learn-event"><b>'+esc(n.headline)+'</b><p>'+esc(n.summary)+'</p><small>'+esc(n.instrumentKey)+' · '+new Date(n.publishedAt).toLocaleString("en-IN")+' · '+esc(n.source)+'</small><p><a href="'+esc(n.url)+'" target="_blank" rel="noopener">Open source article ↗</a></p></article>').join(""):"No verified news items in latest feed response.";
 $("learnSuiteModules").innerHTML=suite?suite.modules.map(m=>'<div class="learn-suite-module"><div><b>'+esc(m.name)+'</b><span class="learn-status">'+esc(m.status.replaceAll("_"," "))+'</span></div><p>'+esc(m.summary)+'</p>'+(m.evidence.length?'<small>'+m.evidence.map(esc).join(" · ")+'</small>':'')+(m.limitations.length?'<small class="learn-note">'+m.limitations.map(esc).join(" · ")+'</small>':'')+'</div>').join(""):"";
 $("learnModelSummary").innerHTML=latest?'<div class="learn-model-grid"><div><small>Latest regime</small><b>'+esc(latest.analysis.regime)+'</b></div><div><small>Directional bias</small><b>'+esc(latest.analysis.directionalBias)+'</b></div><div><small>Confidence</small><b>'+esc(latest.analysis.confidence)+'</b></div><div><small>Hypothesis checks</small><b>'+evaluated.length+'</b></div><div><small>Aligned outcomes</small><b>'+(hitRate==null?"—":num(hitRate,1)+"%")+'</b></div></div><p>'+esc(latest.analysis.hypothesis)+'</p><small class="learn-note">Next-scan directional alignment only; not trade win rate or validated predictive accuracy.</small>':"Waiting for the first structured market observation.";
 $("learnFeed").innerHTML=rows.length?rows.map(x=>{
  const ev=x.evidence||{}, drivers=x.drivers||[], a=x.analysis||{}, outcome=x.forwardOutcome||null;
  return '<article class="learn-event"><div class="learn-event-top"><b>'+esc(x.underlyingKey||x.symbol||"NSE instrument")+'</b><time>'+new Date(x.at||0).toLocaleString("en-IN")+'</time></div>'+
  (a.regime?'<div class="learn-regime">'+esc(a.regime)+' · '+esc(a.directionalBias||"neutral")+' · '+esc(a.confidence||"low")+'</div>':'')+
  '<p>'+esc(x.summary||x.text||"Scan recorded.")+'</p>'+
  (a.hypothesis?'<p><b>Hypothesis:</b> '+esc(a.hypothesis)+'</p>':'')+
  (outcome?'<div class="learn-drivers"><span>Next scan: '+esc(outcome.hypothesisOutcome)+'</span><span>Spot move: '+num(outcome.forwardMovePct,3)+'%</span></div>':'')+
  (drivers.length?'<div class="learn-drivers">'+drivers.map(v=>'<span>'+esc(v)+'</span>').join("")+'</div>':'')+
  '<div class="learn-metrics"><span>Spot '+num(ev.spot)+'</span><span>Spot Δ / 5m '+(ev.spotChangePct==null?"—":num(ev.spotChangePct)+"%")+'</span>'+
  '<span>PCR '+num(ev.pcr,2)+'</span><span>PCR Δ '+(ev.pcrChange==null?"—":num(ev.pcrChange,2))+'</span>'+
  '<span>Call OI Δ '+(ev.callOiChangePct==null?"—":num(ev.callOiChangePct)+"%")+'</span><span>Put OI Δ '+(ev.putOiChangePct==null?"—":num(ev.putOiChangePct)+"%")+'</span>'+
  '<span>Top premium Δ '+(x.changePct==null?"—":num(x.changePct)+"%")+'</span><span>IV '+num(x.iv,1)+'</span>'+
  '<span>Volume '+num(x.volume,0)+'</span><span>Score '+num(x.score,0)+'/100</span></div>'+
  '<small class="learn-note">'+esc(a.caution||"Evidence-based interpretation; not proof of a news catalyst or causation.")+'</small></article>';
 }).join(""):'<div class="history-empty">No learning observations yet. Start the 90-day paper experiment to populate this page during NSE market hours.</div>';
 $("learnTradesList").innerHTML=(d.recentTrades||[]).length?d.recentTrades.slice(0,20).map(t=>'<div class="learn-trade"><b>'+esc(t.symbol)+'</b><span>'+esc(t.status)+'</span><span>₹'+num(t.pnl||0)+'</span><small>'+esc((t.reasons||[]).join(" · ")||t.outcomeReason||"No trade rationale recorded")+'</small></div>').join(""):"No paper-trade outcomes yet. The system needs completed observations and trades before it can measure which setups worked.";
 $("learnError").textContent=d.lastError?"Last worker error: "+d.lastError:"";
}
async function refresh(){try{const r=await fetch("/api/autopilot/status");const d=await r.json();if(!r.ok)throw Error(d.error||"Learning data unavailable");render(d);}catch(e){$("learnError").textContent=e.message;}}
$("learnRefresh")?.addEventListener("click",refresh);refresh();setInterval(()=>{if(document.getElementById("learning")?.classList.contains("active"))refresh();},30000);
})();