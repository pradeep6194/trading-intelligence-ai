(() => {
  const sidebar=document.querySelector(".sidebar"),main=document.querySelector(".main");
  if(!sidebar||!main||document.getElementById("setupDesk"))return;
  const nav=document.createElement("button");nav.className="nav";nav.dataset.page="setupDesk";nav.innerHTML="⚙ <span>Setup & Health</span>";
  sidebar.insertBefore(nav,sidebar.querySelector(".sidebar-bottom"));
  const page=document.createElement("section");page.className="page";page.id="setupDesk";
  page.innerHTML='<div class="section-head"><div><div class="eyebrow gold">CONNECTION DIAGNOSTICS</div><h3>Setup & Health Center</h3><p class="muted">Check the free deployment stack before starting your 90-day paper experiment.</p></div><button class="btn btn-gold" id="setupRun">Run all checks</button></div>'+
  '<div class="setup-grid">'+
  '<article class="panel setup-card"><div class="setup-card-head"><b>Render dashboard</b><span id="stRender" class="tag">CHECKING</span></div><p id="stRenderText" class="muted">Checking web server…</p></article>'+
  '<article class="panel setup-card"><div class="setup-card-head"><b>Supabase persistence</b><span id="stSupabase" class="tag">CHECKING</span></div><p id="stSupabaseText" class="muted">Checking database credentials and table…</p></article>'+
  '<article class="panel setup-card"><div class="setup-card-head"><b>Upstox market data</b><span id="stUpstox" class="tag">CHECKING</span></div><p id="stUpstoxText" class="muted">Checking read-only token…</p></article>'+
  '<article class="panel setup-card"><div class="setup-card-head"><b>GitHub Actions worker</b><span id="stGithub" class="tag">CHECKING</span></div><p id="stGithubText" class="muted">Checking latest scheduled workflow…</p></article>'+
  '</div>'+
  '<article class="panel"><h3>One-time secret checklist</h3><p class="muted">Add each secret in both GitHub Actions and Render Environment. This page never displays or requests your secret values.</p><div class="setup-checklist"><div><b>SUPABASE_URL</b><small>Project URL ending in .supabase.co</small></div><div><b>SUPABASE_SERVICE_ROLE_KEY</b><small>Private server-side key; never expose in browser code</small></div><div><b>UPSTOX_ANALYTICS_TOKEN</b><small>Read-only market-data token, not an order token</small></div></div><div class="setup-links"><a class="btn btn-outline" target="_blank" rel="noopener" href="https://github.com/pradeep6194/trading-intelligence-ai/settings/secrets/actions">GitHub Actions secrets ↗</a><a class="btn btn-outline" target="_blank" rel="noopener" href="https://dashboard.render.com/">Render Environment ↗</a><a class="btn btn-outline" target="_blank" rel="noopener" href="https://supabase.com/dashboard/project/ssbtkzxsiqppuwckdrrm">Supabase ↗</a></div></article>'+
  '<article class="panel"><div class="panel-head"><div><h3>90-day paper experiment</h3><p class="muted">Starts only after Render can read Supabase and Upstox accepts the token.</p></div><span id="stExperiment" class="tag">CHECKING</span></div><div class="setup-actions"><button class="btn btn-gold" id="setupStart" disabled>Start 90-day experiment</button><button class="btn btn-outline" id="setupPause">Pause experiment</button><button class="btn btn-outline" id="setupReport">Open experiment report</button></div><div class="notice" id="setupMessage">Run diagnostics to see what is missing. GitHub Actions secrets must also be configured separately.</div></article>'+
  '<p class="muted tiny">GitHub scheduled jobs may be delayed. A green check confirms an API connection at the time of testing, not uninterrupted service or trading profitability. Paper mode only; no broker orders.</p>';
  const footer=main.querySelector("footer");if(footer)main.insertBefore(page,footer);else main.appendChild(page);
  const $=id=>document.getElementById(id);
  const set=(id,ok,configured,detail)=>{$(id).textContent=!configured?"MISSING":ok?"CONNECTED":"CHECK";$(id).className="tag "+(ok?"setup-ok":configured?"setup-warn":"setup-bad");$(id+"Text").textContent=detail;};
  let checksReady=false;
  function navigate(){document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="setupDesk"));document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n===nav));$("pageTitle").textContent="Setup & Health";window.scrollTo(0,0);runChecks();}
  nav.addEventListener("click",navigate);
  async function githubCheck(){
    try{
      const r=await fetch("https://api.github.com/repos/pradeep6194/trading-intelligence-ai/actions/workflows/paper-trading.yml/runs?per_page=1",{headers:{Accept:"application/vnd.github+json"}});
      if(!r.ok)throw Error("GitHub workflow status unavailable ("+r.status+").");
      const d=await r.json(),run=d.workflow_runs?.[0];
      if(!run){$("stGithub").textContent="NO RUN YET";$("stGithub").className="tag setup-warn";$("stGithubText").textContent="No worker run found yet. Add the three GitHub secrets, then use Actions → 90-day paper trading worker → Run workflow.";return;}
      const ok=run.conclusion==="success",running=run.status!=="completed";
      $("stGithub").textContent=running?"RUNNING":ok?"LAST RUN PASSED":"LAST RUN FAILED";
      $("stGithub").className="tag "+(ok||running?"setup-ok":"setup-warn");
      $("stGithubText").textContent="Latest run: "+run.status+(run.conclusion?" / "+run.conclusion:"")+". "+new Date(run.updated_at).toLocaleString()+" · Open Actions to inspect logs and missing secrets.";
    }catch(e){$("stGithub").textContent="UNKNOWN";$("stGithub").className="tag setup-warn";$("stGithubText").textContent=e.message+" Open GitHub Actions directly to inspect runs.";}
  }
  async function runChecks(){
    $("setupRun").disabled=true;$("setupMessage").textContent="Testing Render, Supabase, Upstox and GitHub Actions…";
    try{
      const r=await fetch("/api/setup/checks"),d=await r.json();
      if(!r.ok)throw Error(d.error||"Diagnostics endpoint unavailable.");
      const c=d.checks;
      set("stRender",c.render.ok,c.render.configured,c.render.detail);
      set("stSupabase",c.supabase.ok,c.supabase.configured,c.supabase.detail);
      set("stUpstox",c.upstox.ok,c.upstox.configured,c.upstox.detail);
      checksReady=Boolean(d.ready);$("setupStart").disabled=!checksReady;
      $("setupMessage").textContent=checksReady?"Render can reach Supabase and Upstox. Before starting, ensure the same three secrets are also saved in GitHub Actions.": "Setup is incomplete. Follow the missing or failed checks above, then run diagnostics again.";
    }catch(e){checksReady=false;$("setupStart").disabled=true;$("setupMessage").textContent=e.message;}
    await githubCheck();await experimentStatus();$("setupRun").disabled=false;
  }
  async function experimentStatus(){
    try{const r=await fetch("/api/autopilot/status"),d=await r.json();if(!r.ok)throw Error(d.error||"Could not load experiment state.");$("stExperiment").textContent=d.active?"ACTIVE":d.startedAt?"PAUSED":"NOT STARTED";$("stExperiment").className="tag "+(d.active?"setup-ok":"setup-warn");if(d.lastError)$("setupMessage").textContent="Last worker error: "+d.lastError;}
    catch(e){$("stExperiment").textContent="UNAVAILABLE";$("stExperiment").className="tag setup-bad";}
  }
  $("setupRun").addEventListener("click",runChecks);
  $("setupStart").addEventListener("click",async()=>{if(!checksReady)return;$("setupStart").disabled=true;$("setupMessage").textContent="Starting 90-day paper experiment…";try{const r=await fetch("/api/autopilot/start",{method:"POST"}),d=await r.json();if(!r.ok)throw Error(d.error||"Start failed");$("setupMessage").textContent="Experiment activated. Now verify GitHub Actions secrets and run the worker once manually.";await experimentStatus();}catch(e){$("setupMessage").textContent=e.message;}finally{$("setupStart").disabled=!checksReady;}});
  $("setupPause").addEventListener("click",async()=>{try{const r=await fetch("/api/autopilot/stop",{method:"POST"}),d=await r.json();if(!r.ok)throw Error(d.error||"Pause failed");$("setupMessage").textContent="Paper experiment paused.";await experimentStatus();}catch(e){$("setupMessage").textContent=e.message;}});
  $("setupReport").addEventListener("click",()=>{const n=document.querySelector('[data-page="optionsDesk"]');if(n)n.click();});
  runChecks();
})();
