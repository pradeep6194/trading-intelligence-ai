(()=>{
 const $=s=>document.querySelector(s);
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2});
 const time=n=>n?new Date(n).toLocaleString("en-IN",{dateStyle:"short",timeStyle:"short"}):"—";
 let busy=false;
 function setBusy(v){busy=v;["#apStart","#apStop","#apRefresh"].forEach(id=>{const b=$(id);if(b)b.disabled=v;});}
 function render(d){
  const active=!!d.active;
  $("#apStatus").textContent=active?"ACTIVE · PAPER ONLY":"STOPPED";
  $("#apStatus").classList.toggle("ap-live",active);
  $("#apStart").disabled=busy||active;$("#apStop").disabled=busy||!active;
  $("#apWorkerAt").textContent=time(d.lastWorkerAt);
  $("#apLastScan").textContent=time(d.lastScanAt);
  $("#apScans").textContent=Number(d.scanCount||0).toLocaleString("en-IN");
  $("#apTrades").textContent=d.tradeCount??0;$("#apClosed").textContent=d.closedTrades??0;
  $("#apPnl").textContent=money(d.realizedPnl);$("#apWin").textContent=d.winRate==null?"—":d.winRate+"%";
  const learned=d.adaptivePolicy?.lastLearning?.totalLearned??d.lastWorkerResult?.learnedTrades??0;
  $("#apLearned").textContent=learned;
  const decision=d.adaptiveDecision||{};
  $("#apStrategy").textContent=decision.selectedStrategy?decision.selectedStrategy+" · "+(decision.selectedRegime||"regime unknown"):"No eligible candidate selected";
  $("#apReason").textContent=decision.reason||"The worker has not published an adaptive decision yet. A scan can legitimately select no trade when filters or risk gates fail.";
  const rows=d.recentTrades||[];
  $("#apTradeList").innerHTML=rows.length?rows.slice(0,8).map(t=>'<div class="ap-trade-row"><b>'+esc(t.symbol||t.underlyingKey||"Option trade")+'</b><span>'+esc(t.status||"—")+'</span><span>'+money(t.pnl)+'</span><small>'+esc(t.strategyId||"Strategy not tagged")+' · '+esc(t.marketRegime||"Regime unavailable")+' · '+time(t.openedAt)+'</small></div>').join(""):'<div class="history-empty">No autopilot trades recorded yet. The worker may wait for a valid setup.</div>';
  $("#apError").textContent=d.lastError?"Worker error: "+d.lastError:"";
 }
 async function refresh(){
  try{const r=await fetch("/api/autopilot/status",{cache:"no-store"}),d=await r.json();if(!r.ok)throw Error(d.error||"Status unavailable");render(d);}
  catch(e){$("#apError").textContent=e.message;}
 }
 async function command(action){
  setBusy(true);$("#apError").textContent=action==="start"?"Enabling scheduled paper scans…":"Stopping future paper scans…";
  try{const r=await fetch("/api/autopilot/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}),d=await r.json();if(!r.ok)throw Error(d.error||"Request failed");render(d);$("#apError").textContent=action==="start"?"Autopilot enabled. Worker runs on its GitHub Actions schedule during NSE market hours.":"Autopilot stopped. No new worker scans will start while inactive.";}
  catch(e){$("#apError").textContent=e.message;}
  finally{setBusy(false);refresh();}
 }
 $("#apStart")?.addEventListener("click",()=>command("start"));
 $("#apStop")?.addEventListener("click",()=>command("stop"));
 $("#apRefresh")?.addEventListener("click",refresh);
 refresh();setInterval(()=>{if(document.visibilityState==="visible")refresh();},30000);
})();