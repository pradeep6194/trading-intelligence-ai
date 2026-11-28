(() => {
 const $ = id => document.getElementById(id);
 const fmt = ts => ts ? new Date(ts).toLocaleString("en-IN",{dateStyle:"short",timeStyle:"short"}) : "Not run yet";
 const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function request(url, options={}) {
  const response = await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data = await response.json();
  if(!response.ok) throw new Error(data.error || ("Request failed ("+response.status+")"));
  return data;
 }
 function render(d) {
  $("autoPilotState").textContent = d.active ? "ACTIVE · PAPER ONLY" : "PAUSED";
  $("autoPilotLastRun").textContent = fmt(d.lastWorkerAt);
  $("autoPilotLearned").textContent = String(d.learnedTradeCount || 0);
  $("autoPilotOpen").textContent = String(d.openTradeCount || 0);
  const decision=d.adaptiveDecision;
  $("autoPilotDecision").innerHTML = decision
   ? "<b>Latest AI decision:</b> "+esc(decision.selectedStrategy || "No eligible setup")+" · "+esc(decision.selectedRegime || "regime unavailable")+"<br>"+esc(decision.reason || "No decision rationale")+
     (decision.ranked?.length ? "<br><small>Top candidates: "+decision.ranked.slice(0,3).map(x=>esc(x.symbol)+" ("+esc(x.strategyId)+", "+esc(x.adaptiveScore)+")").join(" · ")+"</small>" : "")
   : "Waiting for the first adaptive decision.";
  const entries=Object.entries(d.adaptiveStats||{});
  $("autoPilotStrategies").innerHTML=entries.length ? entries.sort((a,b)=>(b[1].trades||0)-(a[1].trades||0)).map(([key,s])=>
   '<div class="learn-trade"><b>'+esc(key.replace("|"," · "))+'</b><span>'+esc(s.trades)+' trades</span><span>'+esc(s.wins)+' wins / '+esc(s.losses)+' losses</span><small>Win rate '+(s.trades?(s.wins/s.trades*100).toFixed(1):"—")+'% · Net P&amp;L ₹'+esc(Number(s.netPnl||0).toFixed(2))+' · Avg ₹'+esc(Number(s.avgPnl||0).toFixed(2))+'</small></div>'
  ).join("") : '<div class="history-empty">No closed, attributable trades have been learned yet. The first learning update occurs after a strategy-tagged paper trade closes.</div>';
  $("autoPilotStart").disabled=Boolean(d.active);
  $("autoPilotStop").disabled=!d.active;
  $("autoPilotMessage").textContent=d.lastError ? "Worker error: "+d.lastError : (d.lastWorkerResult ? "Last cycle: "+(d.lastWorkerResult.scannedUnderlyings||0)+" underlyings scanned · "+(d.lastWorkerResult.candidateCount||0)+" eligible candidates · "+(d.lastWorkerResult.adaptiveStrategy||"no trade opened") : "Worker has not completed a cycle yet. GitHub Actions runs the paper worker every 5 minutes during its scheduled weekday window.");
 }
 async function refresh() {
  try { const d=await request("/api/autopilot/status"); render(d); }
  catch(e) { $("autoPilotMessage").textContent=e.message; }
 }
 $("autoPilotStart")?.addEventListener("click",async()=>{
  $("autoPilotMessage").textContent="Starting…";
  try { await request("/api/autopilot/start",{method:"POST"}); await refresh(); }
  catch(e) { $("autoPilotMessage").textContent="Cannot start: "+e.message+". Check Render Environment and the setup checks."; }
 });
 $("autoPilotStop")?.addEventListener("click",async()=>{
  $("autoPilotMessage").textContent="Pausing…";
  try { await request("/api/autopilot/stop",{method:"POST"}); await refresh(); }
  catch(e) { $("autoPilotMessage").textContent=e.message; }
 });
 $("autoPilotRefresh")?.addEventListener("click",refresh);
 if($("autoPilotPanel")) { refresh(); setInterval(()=>{if(document.getElementById("paper")?.classList.contains("active"))refresh();},30000); }
})();