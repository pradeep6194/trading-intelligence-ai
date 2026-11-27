(()=> {
const $=s=>document.querySelector(s);
const fmt=n=>"₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback;}catch{return fallback;}};
const logs=()=>readJson("tia-psychology-logs",[]);
const backtest=()=>readJson("tia-last-backtest",null);
const todayKey=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const isToday=entry=>new Date(entry.createdAt).toDateString()===new Date().toDateString();
const moodNames={calm:"Calm and focused",fomo:"FOMO",revenge:"Revenge urge",fear:"Fear / hesitation",angry:"Angry / frustrated",overconfident:"Overconfident",tired:"Tired / distracted"};
const mistakeNames={none:"None",fomo:"FOMO / chased price",revenge:"Revenge trading",overtrading:"Overtrading",forced:"Forced mediocre setup","early-exit":"Cut winner early","stop-move":"Moved / widened stop",oversize:"Oversized position",hesitation:"Hesitated / skipped setup",other:"Other"};
function renderBacktestGate(){
 const b=backtest(),title=$("#psyBacktestTitle"),status=$("#psyBacktestStatus");
 if(!title||!status)return;
 if(!b||!Array.isArray(b.strategies)){title.textContent="No recent backtest saved";status.textContent="Run Backtesting Lab once after this update. The coach will read the latest cost-aware results from this browser.";return;}
 const names={ema:"EMA crossover",confluence:"EMA + VWAP + RSI",sweep:"Liquidity sweep"};
 const selected=b.strategies.find(x=>x.key===b.selected)||b.strategies[0];
 const rows=b.strategies.map(x=>x.name+": "+fmt(x.netPnl)+" net / "+x.trades+" trades").join(" · ");
 title.textContent=selected.name+" · "+fmt(selected.netPnl)+" net after charges";
 let msg="Latest test: "+b.instrument+" · "+b.unit+" "+b.interval+" · "+b.from+" to "+b.to+". "+rows+". ";
 if(selected.netPnl<=0)msg+="STOP: selected setup is negative after modeled charges. Keep it in research/paper mode; psychology cannot turn a negative edge positive.";
 else if(selected.trades<30)msg+="The selected result is positive in this sample but has fewer than 30 closed trades. Treat it as inconclusive and keep paper-testing.";
 else msg+="Positive in-sample result only. This does not establish an edge: run an untouched out-of-sample period and use realistic broker costs/slippage before considering real risk.";
 status.textContent=msg;
}
function updateMetrics(){
 const all=logs().sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
 const total=all.length,followed=all.filter(x=>x.followed==="yes").length,breaks=total-followed;
 const latest=all.slice().reverse();let streak=0;for(const x of latest){if(x.outcome==="loss")streak++;else break;}
 const today=all.filter(isToday),todayPnl=today.reduce((s,x)=>s+x.netPnl,0);
 const byMistake={};all.filter(x=>x.mistake&&x.mistake!=="none").forEach(x=>byMistake[x.mistake]=(byMistake[x.mistake]||0)+1);
 const common=Object.entries(byMistake).sort((a,b)=>b[1]-a[1])[0];
 $("#psyAdherence").textContent=total?(followed/total*100).toFixed(1)+"%":"—";
 $("#psyBreaks").textContent=breaks;
 $("#psyStreak").textContent=streak;
 $("#psyTodayPnl").textContent=fmt(todayPnl);
 $("#psyPattern").textContent=common?"Most logged error: "+mistakeNames[common[0]]+" ("+common[1]+" times). Review the trigger in your notes before the next session.":total?"No repeated mistake category logged yet. Keep recording specific triggers.":"Save post-trade reviews to identify recurring errors and emotional triggers.";
 const history=$("#psyHistory");
 history.innerHTML=latest.slice(0,12).map(x=>'<div class="psy-log-row"><span>'+new Date(x.createdAt).toLocaleString("en-IN")+'<small>'+x.outcome.toUpperCase()+'</small></span><span>'+fmt(x.netPnl)+'<small>Realised P&amp;L</small></span><span>'+(x.followed==="yes"?"Plan followed":"Rule broken")+'<small>'+esc(x.emotion)+'</small></span><span>'+mistakeNames[x.mistake]+'<small>'+esc(x.notes||"No notes")+'</small></span></div>').join("")||"No psychology reviews saved yet.";
 const maxDaily=Number($("#psyDailyLimit")?.value||0);
 const pauseAfter=Number($("#psyLossPause")?.value||2);
 if(maxDaily>0&&todayPnl<=-maxDaily)$("#psyPattern").textContent+=" Daily loss limit reached in this local journal: pause trading and review.";
 if(pauseAfter>0&&streak>=pauseAfter)$("#psyPattern").textContent+=" Consecutive-loss pause threshold reached: stop, reset and review before another session.";
}
function esc(v){return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function readiness(){
 const b=backtest(),strategy=b?.strategies?.find(x=>x.key===b.selected)||b?.strategies?.[0];
 const mood=$("#psyMood").value,risk=Number($("#psyRisk").value),limit=Number($("#psyDailyLimit").value),pause=Number($("#psyLossPause").value);
 const checks=["psyC1","psyC2","psyC3","psyC4","psyC5","psyC6"].every(id=>$("#"+id).checked);
 const all=logs().sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)),today=all.filter(isToday),todayPnl=today.reduce((s,x)=>s+x.netPnl,0);
 let streak=0;for(const x of all.slice().reverse()){if(x.outcome==="loss")streak++;else break;}
 const result=$("#psyReadiness");result.className="psy-result";
 if(!b||!strategy){result.classList.add("bad");result.textContent="NOT READY: pehle Backtesting Lab mein test run karein. Is browser mein cost-aware result save hona zaroori hai.";return;}
 if(strategy.netPnl<=0){result.classList.add("bad");result.textContent="HOLD — PAPER / RESEARCH ONLY. Latest "+strategy.name+" result charges ke baad "+fmt(strategy.netPnl)+" hai. Better psychology is negative expectancy ko positive nahi banati. Rules aur edge ko research karein; real-money entry avoid karein.";return;}
 if(strategy.trades<30){result.classList.add("warn");result.textContent="NOT VALIDATED: result positive hai, lekin sample sirf "+strategy.trades+" trades ka hai. More paper trades aur out-of-sample validation chahiye.";return;}
 if(mood!=="calm"){result.classList.add("bad");result.textContent="PAUSE: current state '"+moodNames[mood]+"' hai. Emotional state neutral hone tak trade skip karein.";return;}
 if(!Number.isFinite(risk)||risk<=0||!Number.isFinite(limit)||limit<=0){result.classList.add("bad");result.textContent="NOT READY: per-trade planned loss aur daily loss limit dono rupees mein define karein.";return;}
 if(risk>limit){result.classList.add("bad");result.textContent="NOT READY: planned loss daily loss limit se bada hai. Quantity ya setup risk reduce karein; stop ko widen na karein.";return;}
 if(todayPnl<=-limit){result.classList.add("bad");result.textContent="STOP FOR TODAY: local journal ke hisaab se daily loss limit hit ho chuki hai ("+fmt(todayPnl)+").";return;}
 if(Number.isInteger(pause)&&pause>0&&streak>=pause){result.classList.add("bad");result.textContent="COOLDOWN: "+streak+" consecutive losses recorded hain. Session pause karein aur trigger/review likhein.";return;}
 if(!checks){result.classList.add("warn");result.textContent="CHECKLIST INCOMPLETE: saare 6 process checks complete karein. Kisi checkbox ko sirf green result paane ke liye tick na karein.";return;}
 result.classList.add("good");result.textContent="PROCESS CHECKLIST COMPLETE — only consider the next planned PAPER trade. Latest backtest is positive in-sample only; this app has not verified out-of-sample robustness or actual execution costs. No live trade approval.";
}
function saveReview(e){
 e.preventDefault();
 const outcome=$("#psyOutcome").value,input=Number($("#psyPnl").value);
 if(!Number.isFinite(input))return alert("Valid realised P&L enter karein.");
 const pnl=outcome==="win"?Math.abs(input):outcome==="loss"?-Math.abs(input):0;
 const followed=$("#psyFollowed").value,mistake=$("#psyMistake").value,emotion=$("#psyEmotion").value,notes=$("#psyNotes").value.trim();
 const arr=logs();arr.push({createdAt:new Date().toISOString(),outcome,netPnl:pnl,followed,mistake,emotion,notes});
 try{localStorage.setItem("tia-psychology-logs",JSON.stringify(arr.slice(-500)));}
 catch{return alert("Browser storage full. Old records export/clear karne ki zaroorat ho sakti hai.");}
 $("#psyPnl").value="0";$("#psyNotes").value="";
 updateMetrics();
 const result=$("#psyReadiness");result.className="psy-result warn";
 result.textContent=outcome==="loss"&&followed==="yes"?"Logged. A rule-following loss can be sound execution; review the process, not just the outcome.":followed==="no"?"Logged as a process error even if the trade made money. Identify the trigger and one corrective action.":"Logged. Review whether the plan was followed and what can be repeated.";
}
const form=$("#psyReviewForm");if(form)form.addEventListener("submit",saveReview);
const check=$("#psyCheckBtn");if(check)check.addEventListener("click",readiness);
["psyDailyLimit","psyLossPause"].forEach(id=>{const el=$("#"+id);if(el)el.addEventListener("input",updateMetrics);});
renderBacktestGate();updateMetrics();
})();