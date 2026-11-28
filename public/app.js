const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const DEFAULT_STATE={cash:50000,realised:0,trades:[]};
function loadState(){
 try{
  const raw=localStorage.getItem("tia-state");
  if(!raw)return {...DEFAULT_STATE};
  const parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=="object"||!Array.isArray(parsed.trades))return {...DEFAULT_STATE};
  return {cash:Number.isFinite(Number(parsed.cash))?Number(parsed.cash):50000,realised:Number.isFinite(Number(parsed.realised))?Number(parsed.realised):0,trades:parsed.trades.filter(t=>t&&typeof t==="object")};
 }catch(error){console.warn("Saved paper state could not be read; using a safe empty state.",error);return {...DEFAULT_STATE};}
}
let state=loadState();
function save(){localStorage.setItem("tia-state",JSON.stringify(state));renderAccount()}
function renderAccount(){const cash=state.cash??50000;$("#cash").textContent=money(cash);$("#positions").textContent="0";$("#pnl").textContent=money(state.realised);$("#paperCash").textContent=money(cash);$("#paperEquity").innerHTML=money(cash+state.realised)+'<span>Virtual equity (realised P&L only)</span>';$("#tradeCount").textContent=state.trades.length;renderTrades()}
function renderTrades(){const rows=state.trades.slice().reverse();const html=rows.map(t=>`<div class="trade-row"><span>${esc(t.symbol)} · ${t.date}</span><span>${t.side}</span><span>${t.qty} × ${money(t.entry)}</span><span>Risk ${money(t.risk)}</span></div>`).join("");$("#tradeHistory").innerHTML=rows.length?'<div class="trade-row head"><span>INSTRUMENT</span><span>SIDE</span><span>SIZE</span><span>PLANNED RISK</span></div>'+html:'<div class="history-empty">No practice trades yet. Record your first simulated trade.</div>';$("#journalList").innerHTML=rows.length?html:'<div class="history-empty">Your recorded paper trades will appear here.</div>'}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
const titles={overview:"Overview",classroom:"AI Classroom",markets:"Live Markets",paper:"Paper Trading",risk:"Risk Coach",journal:"Trade Journal",options:"Options Intelligence",analysis:"Technical Lab",backtest:"Backtesting Lab",psychology:"Psychology Coach",learning:"Market Learning"};
function go(page){$$(".page").forEach(x=>x.classList.toggle("active",x.id===page));$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===page));$("#pageTitle").textContent=titles[page]||"Overview";window.scrollTo(0,0)}
$$("[data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));$$("[data-goto]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.goto)));
$$(".learn-card").forEach(b=>b.addEventListener("click",()=>{go("classroom");ask("Teach me "+b.dataset.topic+" from beginner to practical level, with a NIFTY example and a short quiz.")}));
$("#connectBtn").onclick=()=>location.href="/auth/upstox";
let liveEvents=null;
const latestMarket={};
const marketMap={"NSE_INDEX|Nifty 50":{"price":"mNifty","change":"mNiftyChange","name":"NIFTY 50"},"NSE_INDEX|Nifty Bank":{"price":"mBank","change":"mBankChange","name":"BANK NIFTY"},"NSE_INDEX|India VIX":{"price":"mVix","change":null,"name":"INDIA VIX"}};
function setStreamLabel(label){const el=$("#marketStamp");if(el)el.textContent=label;}
function renderTick(t){latestMarket[t.key]=t;const item=marketMap[t.key];if(!item)return;const price=$("#"+item.price);if(price)price.textContent=Number(t.ltp).toLocaleString("en-IN",{maximumFractionDigits:2});const overviewId={"mNifty":"nifty","mBank":"bank","mVix":"vix"}[item.price];if(overviewId)$("#"+overviewId).textContent=Number(t.ltp).toLocaleString("en-IN",{maximumFractionDigits:2});if(item.change){const ch=$("#"+item.change);if(ch&&t.cp){const diff=t.ltp-t.cp;ch.textContent=`${diff>=0?"+":""}${diff.toFixed(2)} (${(diff/t.cp*100).toFixed(2)}%)`;ch.style.color=diff>=0?"var(--green)":"var(--red)";}}}
function connectLiveEvents(){if(liveEvents)liveEvents.close();liveEvents=new EventSource("/api/stream");liveEvents.addEventListener("status",e=>{const d=JSON.parse(e.data);const labels={authorizing:"Authorizing V3 feed…",connecting:"Connecting WebSocket…",subscribing:"Subscribing…",live:"LIVE · Upstox V3 stream",reconnecting:"Reconnecting stream…",error:"Stream error · see Render logs",disconnected:"Stream disconnected"};setStreamLabel(labels[d.status]||d.status);$("#connText").textContent=d.status==="live"?"Upstox live data":"Upstox connected · "+(labels[d.status]||d.status);});liveEvents.addEventListener("snapshot",e=>{const d=JSON.parse(e.data);(d.ticks||[]).forEach(renderTick)});liveEvents.addEventListener("ticks",e=>{const d=JSON.parse(e.data);(d.ticks||[]).forEach(renderTick);setStreamLabel("LIVE · Last tick "+new Date(d.lastTickAt).toLocaleTimeString("en-IN"));});liveEvents.onerror=()=>setStreamLabel("Live stream connection interrupted · retrying");}
async function status(){try{const r=await fetch("/api/status");const d=await r.json();$("#connText").textContent=d.connected?"Upstox connected":"Demo mode active";$("#connDot").style.background=d.connected?"var(--green)":"var(--gold)";$("#connectBtn").textContent=d.connected?"Upstox connected":"Connect Upstox";if(d.connected)connectLiveEvents();else{if(liveEvents){liveEvents.close();liveEvents=null;}setStreamLabel("Demo prices · illustrative only");}}catch{}}
async function refreshQuotes(){try{const r=await fetch("/api/quotes?keys="+encodeURIComponent("NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,NSE_INDEX|India VIX"));if(!r.ok)throw Error("No live connection");const d=await r.json();for(const [key,v] of Object.entries(d.data||{})){const k=v.instrument_key||v.instrumentKey||key;const tick={key:k,ltp:Number(v.last_price||v.lastPrice||0),cp:Number(v.close_price||v.closePrice||0)};renderTick(tick);}setStreamLabel("Snapshot refreshed · waiting for WebSocket ticks");}catch(e){setStreamLabel("Demo prices · illustrative only");}}
$("#refreshQuotes").onclick=refreshQuotes;
const lessons={
"market structure":"Market Structure का मतलब है chart पर swing highs और swing lows का क्रम। Uptrend में सामान्यतः Higher High (HH) और Higher Low (HL) बनते हैं। Downtrend में Lower High (LH) और Lower Low (LL) बनते हैं। BOS तब माना जाता है जब price पिछले confirmed swing level को trend की दिशा में तोड़ता है। CHoCH संभावित trend change का शुरुआती संकेत है, पक्का reversal नहीं। NIFTY के 5-minute chart पर पहले confirmed swing high और swing low mark करें; candle close के बिना wick को breakout न मानें।",
"liquidity":"Liquidity उन price levels के आसपास जमा हो सकती है जहाँ traders के stop-loss और pending orders होते हैं, जैसे previous day high/low और equal highs/lows। Liquidity sweep में price उस level के पार जाकर वापस range में आ सकता है। केवल wick देखकर reversal trade न लें। Context, strong displacement, structure shift और साफ invalidation level का इंतज़ार करें।",
"options":"Options Greeks premium की sensitivity समझाते हैं, भविष्य की गारंटी नहीं देते। Delta बताता है कि underlying में छोटे बदलाव पर option premium कितना बदल सकता है। Gamma, Delta के बदलाव की दर है। Theta समय बीतने से premium पर असर बताता है। Vega implied volatility बदलने पर premium की sensitivity बताता है। Short options में expiry, gap और तेज volatility के दौरान बड़ा नुकसान हो सकता है। किसी भी trade से पहले defined-risk strategy और maximum loss समझें।",
"position":"Cash instrument के लिए प्रति unit planned risk = entry और stop-loss का absolute अंतर। Risk budget = capital × risk percentage। Quantity = floor(risk budget ÷ प्रति unit risk)। उदाहरण: ₹50,000 capital का 0.5% = ₹250 risk budget। Entry ₹250 और stop ₹245 हो तो प्रति share risk ₹5 है; गणित के अनुसार quantity 50 shares होगी, charges और slippage से पहले। Futures और options में lot size, margin, gap risk और contract multiplier भी जाँचना ज़रूरी है।"
};
function coachAnswer(q){const s=q.toLowerCase();let key=s.includes("liquid")||s.includes("sweep")?"liquidity":s.includes("option")||s.includes("greek")||s.includes("theta")||s.includes("vega")?"options":s.includes("risk")||s.includes("size")||s.includes("quantity")||s.includes("stop")?"position":"market structure";const live=Object.values(latestMarket).map(t=>t.key+": "+Number(t.ltp).toLocaleString("en-IN")).join(" | ");const context=live?("\n\nLive feed se latest tick: "+live+"."):("\n\nAbhi live tick available nahi hai; main market direction ka daava nahi karunga.");return lessons[key]+context+"\n\nHindi mein yaad rakhein: context → confirmation → invalidation → risk. Yeh shiksha hai, buy/sell call nahi.";}
function addBubble(who,text){const div=document.createElement("div");div.className="bubble "+(who==="Coach"?"coach":"");div.innerHTML=`<b>${who}</b><p>${esc(text).replace(/\n/g,"<br>")}</p>`;$("#chat").appendChild(div);$("#chat").scrollTop=$("#chat").scrollHeight}
function ask(q){if(!q.trim())return;addBubble("You",q);addBubble("Coach",coachAnswer(q));}
$("#askForm").onsubmit=e=>{e.preventDefault();const q=$("#question").value;$("#question").value="";ask(q)};
$$("[data-prompt]").forEach(b=>b.onclick=()=>ask(b.dataset.prompt));
$("#chartUpload").onchange=e=>{const f=e.target.files[0];if(f)$("#uploadName").textContent="Selected: "+f.name+" · Screenshot is ready for a future vision-analysis integration. No image analysis is performed in this starter."};
function riskCalc(){const cap=Number($("#riskCapital").value)||0,pct=Number($("#riskPct").value)||0,en=Number($("#riskEntry").value),st=Number($("#riskStop").value),budget=cap*pct/100;$("#maxLoss").textContent=money(budget);const dist=Math.abs(en-st);$("#suggestQty").textContent=en>0&&st>0&&dist>0?Math.floor(budget/dist)+" units":"Enter valid entry and stop"}["riskCapital","riskPct","riskEntry","riskStop"].forEach(id=>$("#"+id).addEventListener("input",riskCalc));riskCalc();
function preview(){const en=Number($("#entry").value),st=Number($("#stop").value),qty=Number($("#qty").value)||0;const r=Math.abs(en-st)*qty;$("#riskPreview").textContent=en>0&&st>0&&en!==st?`Planned risk: ${money(r)} (${(r/50000*100).toFixed(2)}% of starting capital). Verify quantity, tick size and instrument lot rules.`:"Enter entry and stop to calculate planned risk."}["entry","stop","qty"].forEach(id=>$("#"+id).addEventListener("input",preview));
$("#tradeForm").onsubmit=e=>{e.preventDefault();const symbol=$("#symbol").value.trim(),side=$("#side").value,qty=Number($("#qty").value),entry=Number($("#entry").value),stop=Number($("#stop").value),target=Number($("#target").value);if(!symbol||qty<1||entry<=0||stop<=0||entry===stop)return alert("Enter valid instrument, quantity, entry and a different stop price.");const risk=Math.abs(entry-stop)*qty;if(risk>state.cash)return alert("Planned risk exceeds your available virtual cash. Reduce quantity or review your stop.");state.trades.push({id:"practice-"+Date.now(),source:"manual_practice",status:"planned",strategyId:"unclassified",timeframe:"unspecified",symbol,side,qty,entry,stop,target,risk,date:new Date().toLocaleDateString("en-IN")});save();syncLearningTrades();e.target.reset();$("#symbol").value="NIFTY 50";$("#qty").value=1;preview();alert("Paper trade plan recorded. No broker order was placed.")};
$("#clearTrades").onclick=()=>{if(confirm("Reset all paper trades and restore ₹50,000 virtual cash?")){state={cash:50000,realised:0,trades:[]};save()}};
async function syncLearningTrades(){try{const trades=state.trades.map((t,i)=>({...t,id:t.id||["practice",t.symbol,t.date,t.entry,t.qty,i].join("-"),source:"manual_practice",status:t.status||"planned",strategyId:t.strategyId||"unclassified",timeframe:t.timeframe||"unspecified"}));await fetch("/api/learning/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trades})});}catch(e){console.warn("Learning sync unavailable:",e.message);}}
renderAccount();status();if(new URLSearchParams(location.search).has("connected"))syncLearningTrades();history.replaceState({}, "", "/");syncLearningTrades();setInterval(syncLearningTrades,60000);


function fmtNum(v){return Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2})}
function fmtOi(v){return Number(v||0).toLocaleString("en-IN",{notation:"compact",maximumFractionDigits:2})}
function optionCell(v){return v===undefined||v===null?"—":fmtNum(v)}
async function loadOptionChain(){
 const msg=$("#optionMessage"),body=$("#optionRows");msg.textContent="Upstox se option-chain data load ho raha hai…";body.innerHTML='<tr><td colspan="11" class="history-empty">Loading…</td></tr>';
 try{
  const params=new URLSearchParams({instrument_key:$("#optionUnderlying").value,expiry_date:$("#optionExpiry").value});
  const r=await fetch("/api/option-chain?"+params);const payload=await r.json();if(!r.ok)throw Error(payload.error||"Option chain request failed");
  const rows=payload.data||[];if(!rows.length)throw Error("Selected expiry ke liye data nahi mila.");
  const callOi=rows.reduce((a,x)=>a+Number(x.call_options?.market_data?.oi||0),0),putOi=rows.reduce((a,x)=>a+Number(x.put_options?.market_data?.oi||0),0);
  const callWall=rows.reduce((a,x)=>Number(x.call_options?.market_data?.oi||0)>Number(a?.call_options?.market_data?.oi||0)?x:a,rows[0]);
  const putWall=rows.reduce((a,x)=>Number(x.put_options?.market_data?.oi||0)>Number(a?.put_options?.market_data?.oi||0)?x:a,rows[0]);
  $("#ocSpot").textContent=fmtNum(rows[0].underlying_spot_price);$("#ocPcr").textContent=callOi?(putOi/callOi).toFixed(2):"—";$("#ocCallWall").textContent=callWall.strike_price;$("#ocPutWall").textContent=putWall.strike_price;$("#ocExpiryLabel").textContent=rows[0].expiry||"SELECTED EXPIRY";
  body.innerHTML=rows.map(x=>{const cm=x.call_options?.market_data||{},cg=x.call_options?.option_greeks||{},pm=x.put_options?.market_data||{},pg=x.put_options?.option_greeks||{};return '<tr><td>'+optionCell(cm.ltp)+'</td><td>'+fmtOi(cm.oi)+'</td><td>'+fmtOi(Number(cm.oi||0)-Number(cm.prev_oi||0))+'</td><td>'+optionCell(cg.iv)+'</td><td>'+optionCell(cg.delta)+'</td><td class="strike-cell">'+fmtNum(x.strike_price)+'</td><td>'+optionCell(pg.delta)+'</td><td>'+optionCell(pg.iv)+'</td><td>'+fmtOi(Number(pm.oi||0)-Number(pm.prev_oi||0))+'</td><td>'+fmtOi(pm.oi)+'</td><td>'+optionCell(pm.ltp)+'</td></tr>'}).join("");
  msg.textContent="Upstox response received · "+$("#optionUnderlying").selectedOptions[0].text+" · Expiry "+rows[0].expiry+".";
 }catch(e){msg.textContent=e.message;body.innerHTML='<tr><td colspan="11" class="history-empty">'+esc(e.message)+'</td></tr>'}
}
if($("#loadOptionChain"))$("#loadOptionChain").onclick=loadOptionChain;

// Technical Lab: calculations use only returned Upstox candles.
const taFmt=v=>Number.isFinite(v)?Number(v).toLocaleString("en-IN",{maximumFractionDigits:2}):"—";
function ema(values,period){const k=2/(period+1);let e=values[0];return values.map((v,i)=>{if(i)e=v*k+e*(1-k);return e;});}
function rsi(values,period=14){if(values.length<=period)return NaN;let gains=0,losses=0;for(let i=1;i<=period;i++){const d=values[i]-values[i-1];gains+=Math.max(d,0);losses+=Math.max(-d,0);}let ag=gains/period,al=losses/period;for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];ag=(ag*(period-1)+Math.max(d,0))/period;al=(al*(period-1)+Math.max(-d,0))/period;}return al===0?100:100-100/(1+ag/al);}
function atr(candles,period=14){if(candles.length<=period)return NaN;const trs=candles.slice(1).map((c,i)=>Math.max(c[2]-c[3],Math.abs(c[2]-candles[i][4]),Math.abs(c[3]-candles[i][4])));let v=trs.slice(0,period).reduce((a,b)=>a+b,0)/period;for(let i=period;i<trs.length;i++)v=(v*(period-1)+trs[i])/period;return v;}
function drawTa(candles,emas){const c=$("#taChart");if(!c)return;const w=c.clientWidth||600,h=220,dpr=window.devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;const x=c.getContext("2d");x.scale(dpr,dpr);x.clearRect(0,0,w,h);const vals=candles.map(z=>z[4]).concat(emas),lo=Math.min(...vals),hi=Math.max(...vals),pad=(hi-lo)*.08||1;const y=v=>h-12-(v-(lo-pad))/(hi-lo+2*pad)*(h-24);x.strokeStyle="#53647c";x.lineWidth=1;x.beginPath();candles.forEach((z,i)=>{const xx=8+i*(w-16)/Math.max(1,candles.length-1);x.moveTo(xx,y(z[3]));x.lineTo(xx,y(z[2]));x.moveTo(xx,y(z[1]));x.lineTo(xx,y(z[4]));});x.stroke();x.strokeStyle="#e6bd72";x.lineWidth=2;x.beginPath();emas.forEach((v,i)=>{const xx=8+i*(w-16)/Math.max(1,emas.length-1);i?x.lineTo(xx,y(v)):x.moveTo(xx,y(v));});x.stroke();}
async function runTechnicalAnalysis(){const msg=$("#taMessage");msg.textContent="Upstox se candles fetch ho rahe hain…";try{const [unit,interval]=$("#taInterval").value.split("|"),range=$("#taRange").value;const params=new URLSearchParams({instrument_key:$("#taInstrument").value,unit,interval,range});const r=await fetch("/api/candles?"+params);const d=await r.json();if(!r.ok)throw Error(d.error||"Candle request failed");const candles=(d.data?.candles||[]).slice().reverse();if(candles.length<15)throw Error("Indicators ke liye kam se kam 15 candles chahiye; is timeframe mein data kam hai.");const close=candles.map(z=>Number(z[4])),last=candles[candles.length-1],em=ema(close,20),rv=rsi(close),av=atr(candles),vol=candles.reduce((a,z)=>a+Number(z[5]||0),0),vwapDen=candles.reduce((a,z)=>a+Number(z[5]||0),0),vwap=vwapDen?candles.reduce((a,z)=>a+((Number(z[2])+Number(z[3])+Number(z[4]))/3)*Number(z[5]||0),0)/vwapDen:NaN;$("#taClose").textContent=taFmt(last[4]);$("#taVwap").textContent=taFmt(vwap);$("#taEma").textContent=taFmt(em.at(-1));$("#taRsi").textContent=taFmt(rv);$("#taAtr").textContent=taFmt(av);$("#taVolume").textContent=taFmt(vol);$("#taOi").textContent=taFmt(last[6]);$("#taCount").textContent=candles.length;drawTa(candles,em);let bias="Mixed / wait for confirmation",ex="Price, VWAP aur EMA ka context ek hi direction mein nahi hai. Isse neutral observation samjhein, trade signal nahi.";if(last[4]>vwap&&last[4]>em.at(-1)){bias="Price VWAP aur EMA 20 ke upar";ex="Is sample mein price intraday VWAP aur EMA 20 dono ke upar hai. Yeh positive price context hai, lekin breakout confirmation aur risk level alag se verify karein.";}else if(last[4]<vwap&&last[4]<em.at(-1)){bias="Price VWAP aur EMA 20 ke neeche";ex="Is sample mein price intraday VWAP aur EMA 20 dono ke neeche hai. Yeh weak price context hai, lekin short trade ka automatic signal nahi.";}$("#taBias").textContent=bias;$("#taExplain").textContent=ex+" RSI "+taFmt(rv)+" aur ATR "+taFmt(av)+" ko volatility/momentum context ke roop mein dekhein.";$("#taRules").innerHTML="<li>RSI 70 se upar overbought zone aur 30 se neeche oversold zone ka traditional reference hai; reversal guaranteed nahi.</li><li>VWAP session volume-weighted average price hai; yeh intraday context deta hai.</li><li>EMA 20 recent prices ko zyada weight deta hai; sideways market mein lag ho sakta hai.</li><li>ATR "+taFmt(av)+" recent candle volatility ka estimate hai, direction nahi.</li>";msg.textContent="Verified Upstox candle response · "+candles.length+" candles · "+$("#taInstrument").selectedOptions[0].text+" · "+unit+" "+interval+"."; }catch(e){msg.textContent=e.message;$("#taBias").textContent="Data unavailable";$("#taExplain").textContent="Live candle data ke bina market bias nahi diya jayega.";}}
if($("#runAnalysis"))$("#runAnalysis").onclick=runTechnicalAnalysis;

const btFmt=n=>Number(n).toLocaleString("en-IN",{maximumFractionDigits:2});
function btEma(values,p){const k=2/(p+1);let v=values[0];return values.map((x,i)=>{if(i)v=x*k+v*(1-k);return v;});}
function drawBt(values){const c=$("#btChart");if(!c)return;const w=c.clientWidth||600,h=220,dpr=window.devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;const g=c.getContext("2d");g.scale(dpr,dpr);g.clearRect(0,0,w,h);if(!values.length)return;let lo=Math.min(0,...values),hi=Math.max(0,...values);if(hi===lo)hi=lo+1;const y=v=>h-14-(v-lo)/(hi-lo)*(h-28);g.strokeStyle="#53647c";g.lineWidth=1;g.beginPath();g.moveTo(8,y(0));g.lineTo(w-8,y(0));g.stroke();g.strokeStyle="#e6bd72";g.lineWidth=2;g.beginPath();values.forEach((v,i)=>{const x=8+i*(w-16)/Math.max(1,values.length-1);i?g.lineTo(x,y(v)):g.moveTo(x,y(v));});g.stroke();}
async function runBacktest(){
 const msg=$("#btMessage");if(msg)msg.textContent="Upstox se historical candles fetch ho rahe hain…";
 try{
  const read=id=>{const el=document.getElementById(id);if(!el)throw Error("Backtesting form field missing: "+id+". Page refresh karein.");return el.value;};
  const from=read("btFrom"),to=read("btTo"),fast=Number(read("btFast")),slow=Number(read("btSlow"));
  const qty=Number(read("btQty")),fixedCost=Number(read("btFixedCost")),direction=read("btDirection");
  if(!from||!to||from>to)throw Error("Valid From aur To dates select karein.");
  if(fast<2||slow<=fast)throw Error("Slow EMA, Fast EMA se bada hona chahiye.");
  if(!Number.isFinite(qty)||qty<1||!Number.isInteger(qty))throw Error("Quantity / units kam se kam 1 aur whole number honi chahiye.");
  if(!Number.isFinite(fixedCost)||fixedCost<0)throw Error("Per-trade charges zero ya usse zyada hone chahiye.");
  const [unit,interval]=read("btInterval").split("|");
  const params=new URLSearchParams({instrument_key:read("btInstrument"),unit,interval,range:"custom",from_date:from,to_date:to});
  const response=await fetch("/api/candles?"+params),payload=await response.json();if(!response.ok)throw Error(payload.error||"Historical candle request failed.");
  const raw=payload.data?.candles||[],candles=raw.slice().reverse().filter(x=>x.length>=5&&Number.isFinite(Number(x[1]))&&Number.isFinite(Number(x[4])));
  if(candles.length<slow+3)throw Error("Is date range mein enough candles nahi hain. Range badhayein ya slower EMA kam karein.");
  const close=candles.map(x=>Number(x[4])),ef=btEma(close,fast),es=btEma(close,slow),trades=[];
  let pos=0,entry=0,entryTime="";
  for(let i=1;i<candles.length-1;i++){
   const crossUp=ef[i-1]<=es[i-1]&&ef[i]>es[i],crossDown=ef[i-1]>=es[i-1]&&ef[i]<es[i];
   let desired=pos;if(crossUp)desired=1;else if(crossDown)desired=direction==="both"?-1:0;
   if(direction==="long"&&crossDown)desired=0;
   if(desired!==pos){
    const px=Number(candles[i+1][1]),time=candles[i+1][0];
    if(pos!==0){const grossPoints=(px-entry)*pos,grossRupees=grossPoints*qty,charges=fixedCost,netRupees=grossRupees-charges;trades.push({side:pos>0?"LONG":"SHORT",entry,exit:px,entryTime,exitTime:time,grossPoints,grossRupees,charges,netRupees});}
    if(desired!==0){pos=desired;entry=px;entryTime=time;}else pos=0;
   }
  }
  if(pos!==0){const last=candles[candles.length-1],px=Number(last[4]),grossPoints=(px-entry)*pos,grossRupees=grossPoints*qty,charges=fixedCost,netRupees=grossRupees-charges;trades.push({side:pos>0?"LONG":"SHORT",entry,exit:px,entryTime,exitTime:last[0],grossPoints,grossRupees,charges,netRupees});}
  const wins=trades.filter(t=>t.netRupees>0),losses=trades.filter(t=>t.netRupees<0);
  const netWins=wins.reduce((s,t)=>s+t.netRupees,0),netLosses=Math.abs(losses.reduce((s,t)=>s+t.netRupees,0));
  const totalNet=trades.reduce((s,t)=>s+t.netRupees,0),totalCharges=trades.reduce((s,t)=>s+t.charges,0);
  let equity=0,peak=0,maxDd=0;const curve=[0];trades.forEach(t=>{equity+=t.netRupees;curve.push(equity);peak=Math.max(peak,equity);maxDd=Math.max(maxDd,peak-equity);});
  const avgWin=wins.length?netWins/wins.length:0,avgLoss=losses.length?losses.reduce((s,t)=>s+t.netRupees,0)/losses.length:0;
  $("#btNet").textContent=money(totalNet);$("#btWin").textContent=trades.length?(wins.length/trades.length*100).toFixed(1)+"%":"—";
  $("#btTrades").textContent=trades.length;$("#btPf").textContent=netLosses?(netWins/netLosses).toFixed(2):netWins?"∞":"—";
  $("#btDd").textContent=money(maxDd);$("#btAvg").textContent=trades.length?money(totalNet/trades.length):"—";
  if($("#btCharges"))$("#btCharges").textContent=money(totalCharges);
  if($("#btAvgWin"))$("#btAvgWin").textContent=wins.length?money(avgWin):"—";
  if($("#btAvgLoss"))$("#btAvgLoss").textContent=losses.length?money(avgLoss):"—";
  if($("#btExpectancy"))$("#btExpectancy").textContent=trades.length?money(totalNet/trades.length):"—";
  $("#btRows").innerHTML=trades.slice().reverse().map((t,i)=>"<tr><td>"+(trades.length-i)+"</td><td>"+t.side+"</td><td>"+btFmt(t.entry)+"</td><td>"+btFmt(t.exit)+"</td><td>"+money(t.grossRupees)+"</td><td>"+money(t.charges)+"</td><td>"+money(t.netRupees)+"</td></tr>").join("")||'<tr><td colspan="7" class="history-empty">No completed trades for these rules and dates.</td></tr>';
  $("#btCountLabel").textContent=trades.length+" CLOSED TRADES";drawBt(curve);
  msg.textContent="Verified Upstox historical candles · "+candles.length+" candles · "+from+" to "+to+". Rupee P&L uses "+qty+" unit(s); ₹"+fixedCost+" estimated round-trip charges per completed trade. Taxes/slippage may vary.";
 }catch(e){
  if(msg)msg.textContent=e.message+" ["+(e.stack||"").split("\
")[1]?.trim()+"]";$("#btRows").innerHTML='<tr><td colspan="7" class="history-empty">'+esc(e.message)+'</td></tr>';
  ["btNet","btWin","btTrades","btPf","btDd","btAvg","btAvgWin","btAvgLoss","btExpectancy","btCharges"].forEach(id=>{if($("#"+id))$("#"+id).textContent="—";});drawBt([]);
 }
}
if($("#runBacktest")){
 const today=new Date(),prior=new Date(today.getTime()-30*86400000),iso=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
 $("#btTo").value=iso(today);$("#btFrom").value=iso(prior);$("#runBacktest").onclick=runBacktest;
}
