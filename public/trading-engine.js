(() => {
  const sidebar = document.querySelector(".sidebar");
  const main = document.querySelector(".main");
  if (!sidebar || !main || document.getElementById("engineDesk")) return;
  const nav = document.createElement("button");
  nav.className = "nav";
  nav.dataset.page = "engineDesk";
  nav.innerHTML = "⚙ <span>AI Engine</span>";
  const footer = main.querySelector("footer");
  sidebar.insertBefore(nav, sidebar.querySelector(".sidebar-bottom"));
  const page = document.createElement("section");
  page.className = "page";
  page.id = "engineDesk";
  page.innerHTML = `
    <div class="section-head"><div><div class="eyebrow gold">HYBRID SMC · VWAP · PRICE ACTION · OPTIONS CONTEXT</div><h3>Trading Intelligence Engine</h3><p class="muted">Analyse real candles, inspect every reason, then optionally create a simulated paper trade. No live broker orders.</p></div><span class="tag">PAPER ONLY</span></div>
    <div class="engine-grid">
      <article class="panel">
        <h3>Market input</h3>
        <div class="engine-form">
          <label>Market<select id="engMarket"><option value="NIFTY">NIFTY</option><option value="BANKNIFTY">BANK NIFTY</option><option value="CRUDE_OIL">CRUDE OIL (manual candles)</option></select></label>
          <label>Timeframe<select id="engTf"><option value="minutes|5">5 minutes</option><option value="minutes|15">15 minutes</option><option value="minutes|30">30 minutes</option><option value="hours|1">1 hour</option></select></label>
          <label>Options PCR (optional)<input id="engPcr" type="number" min="0" step=".01" placeholder="e.g. 1.05"></label>
          <label>Call OI change (optional)<input id="engCallOi" type="number" step="any" placeholder="Net change"></label>
          <label>Put OI change (optional)<input id="engPutOi" type="number" step="any" placeholder="Net change"></label>
        </div>
        <div id="engManualWrap" class="hidden"><label class="engine-manual">CRUDE OIL OHLCV JSON <textarea id="engManual" rows="5" placeholder='[{"open":...,"high":...,"low":...,"close":...,"volume":...}]'></textarea></label><small class="muted">Paste 30–2000 candles in oldest-to-newest order. Each row needs open, high, low, close and volume.</small></div>
        <div class="engine-actions"><button class="btn btn-gold" id="engAnalyse">Analyse candles</button><button class="btn btn-outline" id="engAuto" disabled>Execute paper trade</button></div>
        <div class="notice" id="engMessage">Connect Upstox to fetch NIFTY/BANK NIFTY candles. CRUDE OIL currently requires manual OHLCV input.</div>
      </article>
      <article class="panel"><div class="panel-head"><h3>Paper risk controls</h3><span class="tag">SERVER STATUS</span></div><div class="engine-stats">
        <div><small>Virtual capital</small><b id="engCapital">—</b></div><div><small>Risk / trade</small><b id="engRisk">—</b></div><div><small>Today's realised P&amp;L</small><b id="engPnl">—</b></div><div><small>Trades today</small><b id="engTrades">—</b></div><div><small>Open positions</small><b id="engOpen">—</b></div><div><small>Risk lock</small><b id="engLock">—</b></div>
      </div><p class="muted tiny">Engine limits: 0.5% paper risk per trade, 1% daily realised-loss lock, maximum 3 trades/day and one open position per market. State is currently in server memory.</p></article>
    </div>
    <article class="panel engine-result"><div class="panel-head"><div><div class="eyebrow">EXPLAINABLE SIGNAL</div><h3 id="engSignal">No analysis yet</h3></div><span class="tag" id="engScore">—</span></div><div class="engine-stats"><div><small>Last price</small><b id="engPrice">—</b></div><div><small>EMA 9 / 21</small><b id="engEma">—</b></div><div><small>VWAP</small><b id="engVwap">—</b></div><div><small>RSI 14</small><b id="engRsi">—</b></div><div><small>ATR 14</small><b id="engAtr">—</b></div></div>
      <div class="engine-plan" id="engPlan">Entry, stop and target appear only when a setup clears the engine threshold.</div>
      <div class="engine-reasons"><div><b>Bullish evidence</b><ul id="engBull"><li>Waiting for analysis</li></ul></div><div><b>Bearish evidence</b><ul id="engBear"><li>Waiting for analysis</li></ul></div></div>
      <p class="muted tiny" id="engWarnings">Signals are heuristic scores, not calibrated probabilities or guarantees.</p>
    </article>
    <article class="panel"><div class="panel-head"><h3>Open paper positions</h3><button class="text-btn" id="engRefresh">Refresh status</button></div><div id="engPositions" class="history-empty">No open positions.</div>
      <div class="engine-mark"><label>Mark price<input id="engMarkPrice" type="number" min=".01" step="any" placeholder="Observed market price"></label><button class="btn btn-outline" id="engMark">Update / close paper position</button></div>
    </article>
    <div class="notice">Important: this screen does not place real orders. Current sizing is generic units, not exchange lot-aware sizing; crude live feed, persistent storage, costs, slippage, expiry/contract selection and validated backtests are not yet connected. Do not use its signals as live trade instructions.</div>`;
  if (footer) main.insertBefore(page, footer); else main.appendChild(page);
  const title = document.getElementById("pageTitle");
  function goEngine() {
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "engineDesk"));
    document.querySelectorAll(".nav").forEach(n => n.classList.toggle("active", n === nav));
    if (title) title.textContent = "AI Trading Engine";
    window.scrollTo(0, 0);
    refreshStatus();
  }
  nav.addEventListener("click", goEngine);
  document.querySelectorAll("[data-goto='engineDesk']").forEach(b => b.addEventListener("click", goEngine));
  const $ = id => document.getElementById(id);
  const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString("en-IN",{maximumFractionDigits:2}) : "—";
  let lastAnalysis = null, lastAnalysisInput = null;
  $("engMarket").addEventListener("change", () => $("engManualWrap").classList.toggle("hidden", $("engMarket").value !== "CRUDE_OIL"));
  async function refreshStatus() {
    try {
      const r = await fetch("/api/trading/status"), d = await r.json();
      $("engCapital").textContent = "₹" + fmt(d.capital);
      $("engRisk").textContent = fmt(d.riskPct) + "%";
      $("engPnl").textContent = "₹" + fmt(d.realizedPnlToday);
      $("engTrades").textContent = d.tradesToday + " / 3";
      $("engOpen").textContent = d.openPositions?.length ?? 0;
      $("engLock").textContent = d.locked ? "LOCKED" : "Clear";
      $("engPositions").innerHTML = d.openPositions?.length ? d.openPositions.map(p => `<div class="engine-position"><b>${p.market} · ${p.direction.toUpperCase()}</b><span>Entry ${fmt(p.entry)} · SL ${fmt(p.stopLoss)} · Target ${fmt(p.target)} · Qty ${p.quantity}</span></div>`).join("") : "No open positions.";
    } catch (e) { $("engMessage").textContent = "Status fetch failed: " + e.message; }
  }
  $("engAnalyse").addEventListener("click", async () => {
    const market = $("engMarket").value, [unit, interval] = $("engTf").value.split("|");
    $("engMessage").textContent = "Preparing candles…"; $("engAuto").disabled = true; lastAnalysis = null;
    try {
      let candles;
      if (market === "CRUDE_OIL") candles = JSON.parse($("engManual").value);
      else {
        const instrument_key = market === "NIFTY" ? "NSE_INDEX|Nifty 50" : "NSE_INDEX|Nifty Bank";
        const q = new URLSearchParams({instrument_key,unit,interval,range:"7d"});
        const response = await fetch("/api/candles?" + q), payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Upstox candle request failed");
        candles = (payload.data?.candles || []).slice().reverse().map(c => ({timestamp:c[0],open:Number(c[1]),high:Number(c[2]),low:Number(c[3]),close:Number(c[4]),volume:Number(c[5]||0)}));
      }
      const optionsData = {};
      [["pcr","engPcr"],["callOiChange","engCallOi"],["putOiChange","engPutOi"]].forEach(([key,id]) => { const raw=$(id).value.trim(); if(raw!==""){ const value=Number(raw); if(Number.isFinite(value)) optionsData[key]=value; }});
      const body = {market,candles,optionsData};
      lastAnalysisInput = body;
      const response = await fetch("/api/trading/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Analysis failed");
      lastAnalysis = data;
      $("engSignal").textContent = data.signal === "no_trade" ? "NO TRADE · WAIT" : data.signal.toUpperCase() + " SETUP";
      $("engScore").textContent = "Heuristic score " + data.confidence + "/100";
      $("engPrice").textContent = fmt(data.lastPrice);
      $("engEma").textContent = fmt(data.indicators.ema9) + " / " + fmt(data.indicators.ema21);
      $("engVwap").textContent = fmt(data.indicators.vwap); $("engRsi").textContent = fmt(data.indicators.rsi14); $("engAtr").textContent = fmt(data.indicators.atr14);
      $("engPlan").textContent = data.plan ? `Entry ${fmt(data.plan.entry)} · Stop ${fmt(data.plan.stopLoss)} · Target ${fmt(data.plan.target)} · R:R ${data.plan.riskReward}:1` : "No trade plan: signal threshold or directional agreement not met.";
      $("engBull").innerHTML = data.scores.reasons.bullish.map(x => "<li>"+x+"</li>").join("") || "<li>No bullish evidence</li>";
      $("engBear").innerHTML = data.scores.reasons.bearish.map(x => "<li>"+x+"</li>").join("") || "<li>No bearish evidence</li>";
      $("engWarnings").textContent = data.warnings.join(" ");
      $("engMessage").textContent = "Analysis complete using " + candles.length + " candles. The score is not a probability.";
      $("engAuto").disabled = data.signal === "no_trade";
    } catch (e) { $("engMessage").textContent = e.message; }
  });
  $("engAuto").addEventListener("click", async () => {
    if (!lastAnalysis) return;
    $("engMessage").textContent = "Creating paper trade after server risk checks…";
    try {
      const r = await fetch("/api/trading/paper/auto",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(lastAnalysisInput)});
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Paper order rejected");
      $("engMessage").textContent = d.executed ? "Paper trade opened. No broker order was sent." : "Paper trade blocked: " + d.reason;
      await refreshStatus();
    } catch(e) { $("engMessage").textContent = e.message; }
  });
  $("engRefresh").addEventListener("click", refreshStatus);
  $("engMark").addEventListener("click", async () => {
    const market=$("engMarket").value, price=Number($("engMarkPrice").value);
    if (!Number.isFinite(price)||price<=0) { $("engMessage").textContent="Enter a valid observed mark price."; return; }
    try { const r=await fetch("/api/trading/paper/mark",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({market,price})});const d=await r.json();if(!r.ok)throw Error(d.error||"Mark failed");$("engMessage").textContent=d.closed?"Paper position closed by stop/target rule.":d.reason||"Position updated; stop/target not reached.";await refreshStatus(); }
    catch(e){$("engMessage").textContent=e.message;}
  });
  refreshStatus();
})();