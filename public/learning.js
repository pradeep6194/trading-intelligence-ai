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
 $("learnFeed").innerHTML=rows.length?rows.map(x=>{
  const ev=x.evidence||{}, drivers=x.drivers||[];
  return '<article class="learn-event"><div class="learn-event-top"><b>'+esc(x.underlyingKey||x.symbol||"NSE instrument")+'</b><time>'+new Date(x.at||0).toLocaleString("en-IN")+'</time></div>'+
  '<p>'+esc(x.summary||x.text||"Scan recorded.")+'</p>'+
  (drivers.length?'<div class="learn-drivers">'+drivers.map(v=>'<span>'+esc(v)+'</span>').join("")+'</div>':'')+
  '<div class="learn-metrics">'+
  '<span>Spot '+num(ev.spot)+'</span><span>Spot Δ '+(ev.spotChangePct==null?"—":num(ev.spotChangePct)+"%")+'</span>'+
  '<span>PCR '+num(ev.pcr,2)+'</span><span>Call OI '+num(ev.callOi,0)+'</span><span>Put OI '+num(ev.putOi,0)+'</span>'+
  '<span>Top premium Δ '+(x.changePct==null?"—":num(x.changePct)+"%")+'</span><span>IV '+num(x.iv,1)+'</span>'+
  '<span>Volume '+num(x.volume,0)+'</span><span>Score '+num(x.score,0)+'/100</span></div>'+
  '<small class="learn-note">Observed market evidence, not proof of a causal news event or a guaranteed prediction.</small></article>';
 }).join(""):'<div class="history-empty">No learning observations yet. Start the 90-day paper experiment and the cloud worker will populate this page during NSE market hours.</div>';
 $("learnTradesList").innerHTML=(d.recentTrades||[]).length?d.recentTrades.slice(0,20).map(t=>'<div class="learn-trade"><b>'+esc(t.symbol)+'</b><span>'+esc(t.status)+'</span><span>₹'+num(t.pnl||0)+'</span><small>'+esc((t.reasons||[]).join(" · ")||t.outcomeReason||"No trade rationale recorded")+'</small></div>').join(""):"No paper-trade outcomes yet. The system needs completed observations and trades before it can measure which setups worked.";
 $("learnError").textContent=d.lastError?"Last worker error: "+d.lastError:"";
}
async function refresh(){try{const r=await fetch("/api/autopilot/status");const d=await r.json();if(!r.ok)throw Error(d.error||"Learning data unavailable");render(d);}catch(e){$("learnError").textContent=e.message;}}
$("learnRefresh")?.addEventListener("click",refresh);refresh();setInterval(()=>{if(document.getElementById("learning")?.classList.contains("active"))refresh();},30000);
})();