import { analyseHistoricalMarket, buildNightLearningReport } from "../trading/night-learning.js";
import { buildBookLearningPlan } from "../trading/book-learning.js";
import { analyseAdvancedHistoricalMarket, compareStrategyResults } from "../trading/advanced-historical-learning.js";

const token=process.env.UPSTOX_ANALYTICS_TOKEN;
const supabaseUrl=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!supabaseUrl||!serviceKey)throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
const headers={apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"};
async function read(){const r=await fetch(supabaseUrl+"/rest/v1/trading_state?id=eq.1&select=payload",{headers});if(!r.ok)throw new Error("Supabase read failed: "+r.status);const rows=await r.json();return rows[0]?.payload||{version:1,autopilot:{}};}
async function write(payload){const r=await fetch(supabaseUrl+"/rest/v1/trading_state?on_conflict=id",{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id:1,payload,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error("Supabase write failed: "+r.status+" "+(await r.text()).slice(0,250));}
async function fetchDaily(key){if(!token)throw new Error("UPSTOX_ANALYTICS_TOKEN unavailable; research library only.");const end=new Date();const to=end.toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});const start=new Date(end);start.setFullYear(start.getFullYear()-10);const from=start.toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});const url=new URL("https://api.upstox.com/v3/historical-candle/"+encodeURIComponent(key)+"/days/1/"+to+"/"+from);const r=await fetch(url,{headers:{Accept:"application/json",Authorization:"Bearer "+token}});const d=await r.json();if(!r.ok)throw new Error(d?.errors?.[0]?.message||"Upstox historical API "+r.status);return d?.data?.candles||[];}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const isoDate=d=>d.toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});
async function fetchOneMinuteHistory(key){
 if(!token)throw new Error("UPSTOX_ANALYTICS_TOKEN unavailable.");
 const now=new Date(),endDate=isoDate(now),startDate="2022-01-01",rows=[],seen=new Set();
 let cursor=new Date("2022-01-01T00:00:00Z"),requests=0;
 while(isoDate(cursor)<=endDate){
  const from=isoDate(cursor),monthEnd=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,0,12));
  const to=isoDate(monthEnd)<endDate?isoDate(monthEnd):endDate;
  const url=new URL("https://api.upstox.com/v3/historical-candle/"+encodeURIComponent(key)+"/minutes/1/"+to+"/"+from);
  const response=await fetch(url,{headers:{Accept:"application/json",Authorization:"Bearer "+token}});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.errors?.[0]?.message||"Upstox 1-minute API "+response.status+" for "+from);
  for(const candle of data?.data?.candles||[]){const ts=candle?.[0];if(ts&&!seen.has(ts)){seen.add(ts);rows.push(candle);}}
  requests++;
  cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1));
  if(isoDate(cursor)<=endDate)await sleep(150);
 }
 rows.sort((a,b)=>Date.parse(a[0])-Date.parse(b[0]));
 return {rows,requests,from:startDate,to:endDate};
}

const payload=await read();payload.autopilot||={};const markets={};
const previousMinuteStudies=payload.autopilot.nightLearning?.minuteStudies||{};
const lastMinuteRun=Number(payload.autopilot.nightLearningMinuteRun||0);
const minuteRefreshDue=!lastMinuteRun||Date.now()-lastMinuteRun>=24*60*60*1000;
const minuteStudies=minuteRefreshDue?{}:previousMinuteStudies;
for(const key of ["NSE_INDEX|Nifty 50","NSE_INDEX|Nifty Bank"]){try{const candles=await fetchDaily(key);markets[key]=analyseHistoricalMarket(candles);markets[key].advanced=analyseAdvancedHistoricalMarket(candles);markets[key].advanced.comparison=compareStrategyResults(markets[key].advanced);markets[key].source="Upstox V3 historical daily candles";}catch(e){markets[key]={status:"unavailable",error:String(e.message).slice(0,220),findings:[],backtests:[],limitations:["No verified historical data returned; no synthetic values used."]};}
 if(minuteRefreshDue){try{const {rows,requests,from,to}=await fetchOneMinuteHistory(key);const {analyseOneMinuteMarket}=await import("../trading/one-minute-learning.js");minuteStudies[key]=analyseOneMinuteMarket(rows);minuteStudies[key].download={provider:"Upstox V3",unit:"minutes",interval:1,from,to,requests,downloadedCandles:rows.length};}catch(e){minuteStudies[key]={status:"unavailable",timeframe:"1m",error:String(e.message).slice(0,240),limitations:["No verified one-minute history returned; no synthetic values used."]};}}}

const report=buildNightLearningReport({markets});report.bookLearning=buildBookLearningPlan();report.minuteStudies=minuteStudies;payload.autopilot.nightLearning=report;if(minuteRefreshDue&&Object.values(minuteStudies).every(v=>v.status==="available"))payload.autopilot.nightLearningMinuteRun=Date.now();payload.autopilot.nightLearningLastRun=Date.now();await write(payload);
console.log("Night Learning report saved:",JSON.stringify({status:report.status,markets:Object.fromEntries(Object.entries(markets).map(([k,v])=>[k,{status:v.status,candles:v.candleCount,backtests:v.backtests?.length||0,advancedStrategies:Object.keys(v.advanced?.strategies||{}).length,rankedStrategies:v.advanced?.comparison?.ranked?.length||0,comparisonStatus:v.advanced?.comparison?.status||"unavailable"}])),minuteStudies:Object.fromEntries(Object.entries(minuteStudies).map(([k,v])=>[k,{status:v.status,candles:v.candleCount,requests:v.download?.requests,strategies:Object.keys(v.strategies||{}).length}]))}));
