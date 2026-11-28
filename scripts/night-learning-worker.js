import { analyseHistoricalMarket, buildNightLearningReport } from "../trading/night-learning.js";

const token=process.env.UPSTOX_ANALYTICS_TOKEN;
const supabaseUrl=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!supabaseUrl||!serviceKey)throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
const headers={apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"};
async function read(){const r=await fetch(supabaseUrl+"/rest/v1/trading_state?id=eq.1&select=payload",{headers});if(!r.ok)throw new Error("Supabase read failed: "+r.status);const rows=await r.json();return rows[0]?.payload||{version:1,autopilot:{}};}
async function write(payload){const r=await fetch(supabaseUrl+"/rest/v1/trading_state?on_conflict=id",{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id:1,payload,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error("Supabase write failed: "+r.status+" "+(await r.text()).slice(0,250));}
async function fetchDaily(key){if(!token)throw new Error("UPSTOX_ANALYTICS_TOKEN unavailable; research library only.");const to=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});const from=new Date(Date.now()-365*86400000).toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});const url=new URL("https://api.upstox.com/v3/historical-candle/"+encodeURIComponent(key)+"/days/1/"+to+"/"+from);const r=await fetch(url,{headers:{Accept:"application/json",Authorization:"Bearer "+token}});const d=await r.json();if(!r.ok)throw new Error(d?.errors?.[0]?.message||"Upstox historical API "+r.status);return d?.data?.candles||[];}
const payload=await read();payload.autopilot||={};const markets={};
for(const key of ["NSE_INDEX|Nifty 50","NSE_INDEX|Nifty Bank"]){try{const candles=await fetchDaily(key);markets[key]=analyseHistoricalMarket(candles);markets[key].source="Upstox V3 historical daily candles";}catch(e){markets[key]={status:"unavailable",error:String(e.message).slice(0,220),findings:[],backtests:[],limitations:["No verified historical data returned; no synthetic values used."]};}}
const report=buildNightLearningReport({markets});payload.autopilot.nightLearning=report;payload.autopilot.nightLearningLastRun=Date.now();await write(payload);
console.log("Night Learning report saved:",JSON.stringify({status:report.status,markets:Object.fromEntries(Object.entries(markets).map(([k,v])=>[k,{status:v.status,candles:v.candleCount,backtests:v.backtests?.length||0}]))}));
