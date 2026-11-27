(()=> {
const $=s=>document.querySelector(s),fmt=n=>Number(n).toLocaleString("en-IN",{maximumFractionDigits:2});
const ema=(a,p)=>{const k=2/(p+1);let v=a[0];return a.map((x,i)=>{if(i)v=x*k+v*(1-k);return v;});};
const rsi=a=>{const o=Array(a.length).fill(null),p=14;if(a.length<=p)return o;let g=0,l=0;for(let i=1;i<=p;i++){const d=a[i]-a[i-1];g+=Math.max(0,d);l+=Math.max(0,-d);}g/=p;l/=p;o[p]=l?100-100/(1+g/l):100;for(let i=p+1;i<a.length;i++){const d=a[i]-a[i-1];g=(g*13+Math.max(0,d))/14;l=(l*13+Math.max(0,-d))/14;o[i]=l?100-100/(1+g/l):100;}return o;};
const vwap=c=>{let day="",pv=0,v=0;return c.map(x=>{const d=String(x[0]).slice(0,10);if(d!==day){day=d;pv=0;v=0;}const vol=Math.max(0,+x[5]||0);pv+=((+x[2]+ +x[3]+ +x[4])/3)*vol;v+=vol;return v?pv/v:null;});};
const median=a=>{const x=a.filter(Number.isFinite).slice().sort((a,b)=>a-b);return x.length?x[Math.floor(x.length/2)]:0;};
function classify(c,slowE,atr){const pct=c.map((x,i)=>atr[i]/Math.max(+x[4],1)*100),base=median(pct.slice(-Math.min(100,pct.length)));return c.map((x,i)=>{const slope=i>=5?(slowE[i]-slowE[i-5])/Math.max(+x[4],1):0;const trend=slope>0.00015?"Uptrend":slope< -0.00015?"Downtrend":"Range";const vol=pct[i]>base*1.25?"High vol":"Normal vol";return {trend,vol,regime:trend+" / "+vol};});}
function atrCalc(c){const tr=c.map((x,i)=>i?Math.max(+x[2]- +x[3],Math.abs(+x[2]- +c[i-1][4]),Math.abs(+x[3]- +c[i-1][4])):+x[2]- +x[3]);let v=tr.slice(1,15).reduce((a,b)=>a+b,0)/14;return tr.map((x,i)=>{if(i<14)return null;if(i===14)return v;v=(v*13+x)/14;return v;});}
function stats(tr){const wins=tr.filter(t=>t.net>0),loss=tr.filter(t=>t.net<0),gp=wins.reduce((s,t)=>s+t.net,0),gl=Math.abs(loss.reduce((s,t)=>s+t.net,0));let eq=0,peak=0,dd=0;tr.forEach(t=>{eq+=t.net;peak=Math.max(peak,eq);dd=Math.max(dd,peak-eq);});return {n:tr.length,net:eq,win:tr.length?wins.length/tr.length*100:0,pf:gl?gp/gl:gp?Infinity:0,dd,avg:tr.length?eq/tr.length:0,avgWin:wins.length?gp/wins.length:0,avgLoss:loss.length?-gl/loss.length:0};}
function simulate(c,fast,slow,cost,dir,strategy,rl,rs,lb,regimes){const close=c.map(x=>+x[4]),ef=ema(close,fast),es=ema(close,slow),rv=rsi(close),vw=vwap(c),tr=[];let pos=0,entry=0,entryRegime="";const start=Math.max(slow,lb,14,6);
for(let i=start;i<c.length-1;i++){let sig=0;if(strategy==="ema"){if(ef[i-1]<=es[i-1]&&ef[i]>es[i])sig=1;else if(ef[i-1]>=es[i-1]&&ef[i]<es[i]&&dir==="both")sig=-1;}else if(strategy==="confluence"){if(vw[i]!=null&&close[i]>vw[i]&&ef[i]>es[i]&&rv[i]>=rl)sig=1;else if(dir==="both"&&vw[i]!=null&&close[i]<vw[i]&&ef[i]<es[i]&&rv[i]<=rs)sig=-1;}else{let lo=Infinity,hi=-Infinity;for(let j=i-lb;j<i;j++){lo=Math.min(lo,+c[j][3]);hi=Math.max(hi,+c[j][2]);}if(+c[i][3]<lo&&close[i]>lo)sig=1;else if(+c[i][2]>hi&&close[i]<hi&&dir==="both")sig=-1;}
const desired=sig||pos;if(desired!==pos){const next=c[i+1],px=+next[1];if(pos){const gross=(px-entry)*pos,fees=(Math.abs(px)+Math.abs(entry))*cost/10000;tr.push({side:pos>0?"LONG":"SHORT",entry,exit:px,gross,fees,net:gross-fees,regime:entryRegime});}if(desired){pos=desired;entry=px;entryRegime=regimes[i+1].regime;}else pos=0;}}
if(pos){const px=+c[c.length-1][4],gross=(px-entry)*pos,fees=(Math.abs(px)+Math.abs(entry))*cost/10000;tr.push({side:pos>0?"LONG":"SHORT",entry,exit:px,gross,fees,net:gross-fees,regime:entryRegime});}return tr;}
function chart(a){const c=$("#btChart");if(!c)return;const w=c.clientWidth||600,h=220,d=window.devicePixelRatio||1;c.width=w*d;c.height=h*d;const g=c.getContext("2d");g.scale(d,d);g.clearRect(0,0,w,h);if(!a.length)return;let lo=Math.min(0,...a),hi=Math.max(0,...a);if(lo===hi)hi=lo+1;const y=x=>h-14-(x-lo)/(hi-lo)*(h-28);g.strokeStyle="#53647c";g.beginPath();g.moveTo(8,y(0));g.lineTo(w-8,y(0));g.stroke();g.strokeStyle="#e6bd72";g.lineWidth=2;g.beginPath();a.forEach((x,i)=>i?g.lineTo(8+i*(w-16)/(a.length-1),y(x)):g.moveTo(8,y(x)));g.stroke();}
function row(s,label){return "<tr><td>"+label+"</td><td>"+s.n+"</td><td>"+fmt(s.net)+"</td><td>"+(s.n?s.win.toFixed(1)+"%":"—")+"</td><td>"+(s.pf===Infinity?"∞":s.n?s.pf.toFixed(2):"—")+"</td><td>"+fmt(s.dd)+"</td><td>"+fmt(s.avg)+"</td></tr>";}
async function run(){
const msg=$("#btMessage"); if(!msg)return;
const get=id=>{const el=document.getElementById(id);if(!el)throw Error("Backtesting field missing: "+id+". App refresh karein.");return el.value;};
msg.textContent="Upstox historical candles fetch ho rahe hain…";
try{
const from=get("btFrom"),to=get("btTo"),fast=Number(get("btFast")),slow=Number(get("btSlow"));
const cost=Number(get("btFixedCost")),qty=Number(get("btQty")),dir=get("btDirection"),selected=get("btStrategy");
const rl=Number(get("btRsiLong")),rs=Number(get("btRsiShort")),lb=Number(get("btLookback"));
if(!from||!to||from>to)throw Error("Valid From aur To dates select karein.");
if(!Number.isInteger(fast)||fast<2||!Number.isInteger(slow)||slow<=fast)throw Error("Slow EMA, Fast EMA se bada hona chahiye.");
if(!Number.isFinite(cost)||cost<0)throw Error("Charges ₹0 ya usse zyada hone chahiye.");
if(!Number.isInteger(qty)||qty<1)throw Error("Quantity / units kam se kam 1 honi chahiye.");
if(!["both","long"].includes(dir))throw Error("Trade direction invalid hai.");
if(!["ema","confluence","sweep"].includes(selected))throw Error("Strategy selection invalid hai.");
if(!(rl>rs&&rl<=60&&rs>=40&&rs<=99))throw Error("RSI thresholds check karein: long threshold short se bada hona chahiye.");
if(!Number.isInteger(lb)||lb<3||lb>50)throw Error("Sweep lookback 3 se 50 ke beech hona chahiye.");
const [unit,interval]=get("btInterval").split("|");
const q=new URLSearchParams({instrument_key:get("btInstrument"),unit,interval,range:"custom",from_date:from,to_date:to});
const res=await fetch("/api/candles?"+q),body=await res.json();
if(!res.ok)throw Error(body.error||"Historical data request failed.");
const candles=(body.data?.candles||[]).slice().reverse().filter(x=>x.length>=6&&[1,2,3,4].every(i=>Number.isFinite(+x[i])));
if(candles.length<Math.max(slow+8,lb+8,30))throw Error("Enough candles nahi hain. Date range badhayein.");
const close=candles.map(x=>+x[4]),slowE=ema(close,slow),atr=atrCalc(candles),regimes=classify(candles,slowE,atr);
const names={ema:"EMA crossover",confluence:"EMA + VWAP + RSI",sweep:"Liquidity sweep"};
const all={};Object.keys(names).forEach(k=>all[k]=simulate(candles,fast,slow,cost,dir,k,rl,rs,lb,regimes,qty));
const trades=all[selected],s=stats(trades),curve=[0];let equity=0;trades.forEach(t=>{equity+=t.net;curve.push(equity);});
const set=(id,v)=>{const el=$("#"+id);if(el)el.textContent=v;};
set("btNet","₹"+fmt(s.net));set("btWin",s.n?s.win.toFixed(1)+"%":"—");set("btTrades",s.n);
set("btPf",s.n?(s.pf===Infinity?"∞":s.pf.toFixed(2)):"—");set("btDd","₹"+fmt(s.dd));set("btAvg",s.n?"₹"+fmt(s.avg):"—");
set("btAvgWin",s.n?"₹"+fmt(s.avgWin):"—");set("btAvgLoss",s.n?"₹"+fmt(s.avgLoss):"—");set("btExpectancy",s.n?"₹"+fmt(s.avg):"—");
set("btCharges","₹"+fmt(trades.reduce((a,t)=>a+t.fees,0)));
$("#btRows").innerHTML=trades.slice().reverse().map((t,i)=>"<tr><td>"+(trades.length-i)+"</td><td>"+t.side+"</td><td>"+fmt(t.entry)+"</td><td>"+fmt(t.exit)+"</td><td>₹"+fmt(t.gross)+"</td><td>₹"+fmt(t.fees)+"</td><td>₹"+fmt(t.net)+"</td></tr>").join("")||'<tr><td colspan="7">No completed trades.</td></tr>';
set("btCountLabel",s.n+" CLOSED TRADES");chart(curve);
$("#btCompareRows").innerHTML=Object.keys(names).map(k=>row(stats(all[k]),names[k])).join("");
const groups={};trades.forEach(t=>(groups[t.regime]??=[]).push(t));
$("#btRegimeRows").innerHTML=Object.keys(groups).sort().map(k=>row(stats(groups[k]),k)).join("")||'<tr><td colspan="7">No regime-tagged trades for this setup.</td></tr>';
const best=Object.keys(names).map(k=>({name:names[k],s:stats(all[k])})).filter(x=>x.s.n>=5).sort((a,b)=>b.s.avg-a.s.avg)[0];
const counts=regimes.reduce((a,x)=>(a[x.regime]=(a[x.regime]||0)+1,a),{}),dominant=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
set("btInsight","Candles: "+candles.length+". Most common regime: "+(dominant?dominant[0]:"not available")+". "+(best?"At least 5 trades wale strategies mein best historical expectancy: "+best.name+" (₹"+fmt(best.s.avg)+"/trade, "+best.s.n+" trades).":"Kisi strategy ke 5 closed trades bhi nahi; ranking avoid karein.")+" Regime labels descriptive hain, predictive nahi.");
msg.textContent="Verified Upstox historical candles · "+candles.length+" candles · "+from+" to "+to+". "+names[selected]+": "+s.n+" closed trades. Gross P&L = price points × quantity; ₹"+cost+" flat estimated charges deducted once per completed round-trip trade. Net result INR. Slippage/taxes may vary.";
}catch(e){
msg.textContent=e.message;
["btNet","btWin","btTrades","btPf","btDd","btAvg","btAvgWin","btAvgLoss","btExpectancy","btCharges"].forEach(id=>{const el=$("#"+id);if(el)el.textContent="—";});
const rows=$("#btRows");if(rows)rows.innerHTML='<tr><td colspan="7">'+String(e.message).replace(/[<>]/g,"")+'</td></tr>';
["btCompareRows","btRegimeRows"].forEach(id=>{const el=$("#"+id);if(el)el.innerHTML="";});
const insight=$("#btInsight");if(insight)insight.textContent="Run a valid historical backtest to generate observations.";
chart([]);
}}
function simulate(c,fast,slow,cost,dir,strategy,rl,rs,lb,regimes,qty){
const close=c.map(x=>+x[4]),ef=ema(close,fast),es=ema(close,slow),rv=rsi(close),vw=vwap(c),tr=[];
let pos=0,entry=0,entryRegime="";
const start=Math.max(slow,lb,14,6);
for(let i=start;i<c.length-1;i++){
let desired=pos;
if(strategy==="ema"){
 if(ef[i-1]<=es[i-1]&&ef[i]>es[i])desired=1;
 else if(ef[i-1]>=es[i-1]&&ef[i]<es[i])desired=dir==="both"?-1:0;
}else if(strategy==="confluence"){
 if(vw[i]!=null&&close[i]>vw[i]&&ef[i]>es[i]&&rv[i]>=rl)desired=1;
 else if(vw[i]!=null&&close[i]<vw[i]&&ef[i]<es[i]&&rv[i]<=rs)desired=dir==="both"?-1:0;
}else{
 let lo=Infinity,hi=-Infinity;for(let j=i-lb;j<i;j++){lo=Math.min(lo,+c[j][3]);hi=Math.max(hi,+c[j][2]);}
 if(+c[i][3]<lo&&close[i]>lo)desired=1;
 else if(+c[i][2]>hi&&close[i]<hi)desired=dir==="both"?-1:0;
}
if(desired!==pos){
 const next=c[i+1],px=+next[1];
 if(pos){const points=(px-entry)*pos,gross=points*qty;tr.push({side:pos>0?"LONG":"SHORT",entry,exit:px,gross,fees:cost,net:gross-cost,regime:entryRegime});}
 if(desired){pos=desired;entry=px;entryRegime=regimes[i+1].regime;}else pos=0;
}}
if(pos){const px=+c[c.length-1][4],points=(px-entry)*pos,gross=points*qty;tr.push({side:pos>0?"LONG":"SHORT",entry,exit:px,gross,fees:cost,net:gross-cost,regime:entryRegime});}
return tr;
}
const b=$("#runBacktest");if(b)b.onclick=run;
})();