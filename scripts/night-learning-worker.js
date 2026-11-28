import { analyseHistoricalMarket, buildNightLearningReport } from "../trading/night-learning.js";
import { buildBookLearningPlan } from "../trading/book-learning.js";
import { analyseAdvancedHistoricalMarket, compareStrategyResults } from "../trading/advanced-historical-learning.js";
import { analyseOptionGreekSnapshots } from "../trading/options-learning.js";

const token=process.env.UPSTOX_ANALYTICS_TOKEN;
const supabaseUrl=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!supabaseUrl||!serviceKey)throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
const headers={apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"};
async function read(){const r=await fetch(supabaseUrl+"/rest/v1/trading_state?id=eq.1&select=payload",{headers});if(!r.ok)throw new Error("Supabase read failed: "+r.status);const rows=await r.json();return rows[0]?.payload||{version:1,autopilot:{}};}
async function write(payload){const r=await fetch(supabaseUrl+"/rest/v1/trading_state?on_conflict=id",{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id:1,payload,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error("Supabase write failed: "+r.status+" "+(await r.text()).slice(0,250));}
const isoDate=d=>d.toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});
const addDays=(date,n)=>{const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function getCandles(url,label){const response=await fetch(url,{headers:{Accept:"application/json",Authorization:"Bearer "+token}});let data={};try{data=await response.json();}catch{}if(!response.ok)throw new Error(data?.errors?.[0]?.message||label+" API "+response.status);return data?.data?.candles||[];}

// Upstox V3 documents up to a decade for daily candles. Fetch in one-year slices
// as well, so a provider-side per-response cap cannot silently reduce history to ~1 year.
async function fetchDaily(key){
 if(!token)throw new Error("UPSTOX_ANALYTICS_TOKEN unavailable; research library only.");
 const endDate=isoDate(new Date()),startDate=endDate.slice(0,4)*1-10+"-"+endDate.slice(5);
 const rows=[],seen=new Set();let cursor=startDate,requests=0;
 while(cursor<=endDate){
  const tentative=new Date(cursor+"T12:00:00Z");tentative.setUTCFullYear(tentative.getUTCFullYear()+1);
  const to=addDays(tentative.toISOString().slice(0,10),-1)<endDate?addDays(tentative.toISOString().slice(0,10),-1):endDate;
  const url=new URL("https://api.upstox.com/v3/historical-candle/"+encodeURIComponent(key)+"/days/1/"+to+"/"+cursor);
  for(const candle of await getCandles(url,"Upstox daily historical")){const ts=candle?.[0];if(ts&&!seen.has(ts)){seen.add(ts);rows.push(candle);}}
  requests++;cursor=addDays(to,1);if(cursor<=endDate)await sleep(150);
 }
 rows.sort((a,b)=>Date.parse(a[0])-Date.parse(b[0]));
 return {rows,requests,from:rows[0]?.[0]||null,to:rows.at(-1)?.[0]||null,requestedFrom:startDate,requestedTo:endDate};
}
async function fetchOneMinuteHistory(key){
 if(!token)throw new Error("UPSTOX_ANALYTICS_TOKEN unavailable.");
 const endDate=isoDate(new Date()),startDate="2022-01-01",rows=[],seen=new Set();
 let cursor=new Date("2022-01-01T12:00:00Z"),requests=0;
 while(isoDate(cursor)<=endDate){
  const from=isoDate(cursor),monthEnd=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,0,12));
  const to=isoDate(monthEnd)<endDate?isoDate(monthEnd):endDate;
  const url=new URL("https://api.upstox.com/v3/historical-candle/"+encodeURIComponent(key)+"/minutes/1/"+to+"/"+from);
  for(const candle of await getCandles(url,"Upstox 1-minute historical")){const ts=candle?.[0];if(ts&&!seen.has(ts)){seen.add(ts);rows.push(candle);}}
  requests++;cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1,12));
  if(isoDate(cursor)<=endDate)await sleep(150);
 }
 rows.sort((a,b)=>Date.parse(a[0])-Date.parse(b[0]));
 return {rows,requests,from:rows[0]?.[0]||null,to:rows.at(-1)?.[0]||null,requestedFrom:startDate,requestedTo:endDate};
}

async function fetchOptionSnapshots(days=30) {
 const since=new Date(Date.now()-days*86400000).toISOString();
 const columns="snapshot_at,underlying_key,expiry_date,instrument_key,option_type,strike,spot,ltp,bid,ask,volume,oi,iv,delta,gamma,theta,vega";
 const all=[];let offset=0;const pageSize=1000;
 while(true){
  const url=supabaseUrl+"/rest/v1/option_greek_snapshots?select="+columns+"&snapshot_at=gte."+encodeURIComponent(since)+"&order=instrument_key.asc,snapshot_at.asc&limit="+pageSize+"&offset="+offset;
  const response=await fetch(url,{headers:{...headers,Prefer:"count=none"}});
  if(!response.ok)throw new Error("Option snapshot read failed ("+response.status+"): "+(await response.text()).slice(0,220));
  const page=await response.json();if(!Array.isArray(page))throw new Error("Unexpected option snapshot response.");
  all.push(...page);if(page.length<pageSize)break;offset+=pageSize;
 }
 return {rows:all,since};
}

const payload=await read();payload.autopilot||={};const markets={};
const previousMinuteStudies=payload.autopilot.nightLearning?.minuteStudies||{};
const lastMinuteRun=Number(payload.autopilot.nightLearningMinuteRun||0);
const minuteRefreshDue=!lastMinuteRun||Date.now()-lastMinuteRun>=24*60*60*1000;
const minuteStudies=minuteRefreshDue?{}:previousMinuteStudies;
const dataCoverage={daily:{},minute:{refreshed:minuteRefreshDue,markets:{}}};
for(const key of ["NSE_INDEX|Nifty 50","NSE_INDEX|Nifty Bank"]){
 try{
  const daily=await fetchDaily(key),candles=daily.rows;
  markets[key]=analyseHistoricalMarket(candles);
  markets[key].advanced=analyseAdvancedHistoricalMarket(candles);
  markets[key].advanced.comparison=compareStrategyResults(markets[key].advanced);
  markets[key].source="Upstox V3 historical daily candles";
  markets[key].download={provider:"Upstox V3",unit:"days",interval:1,requestedFrom:daily.requestedFrom,requestedTo:daily.requestedTo,actualFrom:daily.from,actualTo:daily.to,requests:daily.requests,downloadedCandles:candles.length};
  dataCoverage.daily[key]={status:"available",requests:daily.requests,downloadedCandles:candles.length,from:daily.from,to:daily.to};
 }catch(e){markets[key]={status:"unavailable",error:String(e.message).slice(0,220),findings:[],backtests:[],limitations:["No verified historical data returned; no synthetic values used."]};dataCoverage.daily[key]={status:"unavailable",error:String(e.message).slice(0,220)};}
 if(minuteRefreshDue){
  try{
   const minute=await fetchOneMinuteHistory(key),{analyseOneMinuteMarket}=await import("../trading/one-minute-learning.js");
   minuteStudies[key]=analyseOneMinuteMarket(minute.rows);
   minuteStudies[key].download={provider:"Upstox V3",unit:"minutes",interval:1,requestedFrom:minute.requestedFrom,requestedTo:minute.requestedTo,actualFrom:minute.from,actualTo:minute.to,requests:minute.requests,downloadedCandles:minute.rows.length};
   dataCoverage.minute.markets[key]={status:"available",requests:minute.requests,downloadedCandles:minute.rows.length,from:minute.from,to:minute.to};
  }catch(e){minuteStudies[key]={status:"unavailable",timeframe:"1m",error:String(e.message).slice(0,240),limitations:["No verified one-minute history returned; no synthetic values used."]};dataCoverage.minute.markets[key]={status:"unavailable",error:String(e.message).slice(0,240)};}
 }else dataCoverage.minute.markets[key]={status:"cached",downloadedCandles:minuteStudies[key]?.candleCount||0};
}
const report=buildNightLearningReport({markets});report.bookLearning=buildBookLearningPlan();report.minuteStudies=minuteStudies;report.dataCoverage=dataCoverage;
try{
 const archived=await fetchOptionSnapshots(30);
 report.optionsLearning=analyseOptionGreekSnapshots(archived.rows,{windowDays:30});
 report.optionsLearning.source={table:"public.option_greek_snapshots",from:archived.since,to:new Date().toISOString(),rowsRead:archived.rows.length};
}catch(error){
 report.optionsLearning={status:"unavailable",windowDays:30,snapshots:0,contracts:0,error:String(error.message).slice(0,240),limitations:["Archived option snapshot analysis unavailable; no synthetic values used."]};
}
payload.autopilot.nightLearning=report;
if(minuteRefreshDue&&Object.values(dataCoverage.minute.markets).every(v=>v.status==="available"))payload.autopilot.nightLearningMinuteRun=Date.now();
payload.autopilot.nightLearningLastRun=Date.now();await write(payload);
console.log("Night Learning report saved:",JSON.stringify({status:report.status,dataCoverage,markets:Object.fromEntries(Object.entries(markets).map(([k,v])=>[k,{status:v.status,candles:v.candleCount,backtests:v.backtests?.length||0,advancedStrategies:Object.keys(v.advanced?.strategies||{}).length,rankedStrategies:v.advanced?.comparison?.ranked?.length||0,comparisonStatus:v.advanced?.comparison?.status||"unavailable"}])),minuteStudies:Object.fromEntries(Object.entries(minuteStudies).map(([k,v])=>[k,{status:v.status,candles:v.candleCount,requests:v.download?.requests,strategies:Object.keys(v.strategies||{}).length}])),optionsLearning:{status:report.optionsLearning.status,snapshots:report.optionsLearning.snapshots,contracts:report.optionsLearning.contracts,correlations:report.optionsLearning.correlations}}));
