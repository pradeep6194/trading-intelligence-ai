import { buildOptionGreekSnapshotRows, persistOptionGreekSnapshots } from "../trading/options-archive.js";

const token=process.env.UPSTOX_ANALYTICS_TOKEN;
const supabaseUrl=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!token||!supabaseUrl||!serviceKey)throw new Error("Missing UPSTOX_ANALYTICS_TOKEN, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

function indiaClock(){
 const parts=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
 const value=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return {weekday:value.weekday,minutes:Number(value.hour)*60+Number(value.minute)};
}
function indiaDate(){
 return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
async function upstox(url){
 const response=await fetch(url,{headers:{Accept:"application/json",Authorization:"Bearer "+token}});
 const body=await response.json();
 if(!response.ok)throw new Error(body?.errors?.[0]?.message||body?.message||"Upstox API HTTP "+response.status);
 return body?.data||[];
}
async function archiveUnderlying(underlyingKey){
 const contractUrl=new URL("https://api.upstox.com/v2/option/contract");
 contractUrl.searchParams.set("instrument_key",underlyingKey);
 const contracts=await upstox(contractUrl);
 const today=indiaDate();
 const expiries=[...new Set(contracts.map(x=>x.expiry).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&x>=today))].sort();
 if(!expiries.length)throw new Error("No upcoming expiry returned by option contract API.");
 const expiry=expiries[0];
 const chainUrl=new URL("https://api.upstox.com/v2/option/chain");
 chainUrl.searchParams.set("instrument_key",underlyingKey);
 chainUrl.searchParams.set("expiry_date",expiry);
 const chain=await upstox(chainUrl);
 if(!chain.length)throw new Error("Option chain returned zero strike rows.");
 const snapshotAt=new Date().toISOString();
 const rows=buildOptionGreekSnapshotRows(chain,underlyingKey,expiry,snapshotAt);
 if(!rows.length)throw new Error("Option chain had no CE/PE instruments with valid strikes.");
 const result=await persistOptionGreekSnapshots(rows,{supabaseUrl,serviceKey});
 return {underlyingKey,expiry,strikeRows:chain.length,snapshotRows:rows.length,saved:result.saved,snapshotAt};
}

const clock=indiaClock();
if(["Sat","Sun"].includes(clock.weekday)||clock.minutes<555||clock.minutes>930){
 console.log("Options archive skipped: NSE market closed; no synthetic snapshots written.",JSON.stringify(clock));
 process.exit(0);
}
const results=[],errors=[];
for(const key of ["NSE_INDEX|Nifty 50","NSE_INDEX|Nifty Bank"]){
 try{results.push(await archiveUnderlying(key));}
 catch(error){errors.push({underlyingKey:key,error:String(error.message).slice(0,240)});}
}
console.log("Options archive cycle:",JSON.stringify({at:new Date().toISOString(),status:results.length===2?"success":results.length?"partial":"failed",results,errors}));
if(!results.length)throw new Error("No option snapshots were archived for either benchmark: "+JSON.stringify(errors));
