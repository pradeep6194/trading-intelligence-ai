import express from "express";
import dotenv from "dotenv";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";
import protobuf from "protobufjs";
import { gunzipSync } from "node:zlib";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.UPSTOX_CLIENT_ID;
const CLIENT_SECRET = process.env.UPSTOX_CLIENT_SECRET;
const REDIRECT_URI = process.env.UPSTOX_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const INSTRUMENTS = (process.env.UPSTOX_INSTRUMENT_KEYS || "NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,NSE_INDEX|India VIX").split(",").map(x => x.trim()).filter(Boolean);
let accessToken = process.env.UPSTOX_ANALYTICS_TOKEN || null, oauthState = null, feedSocket = null, reconnectTimer = null, reconnectAttempt = 0;
let protoRoot = null, feedStatus = "disconnected", lastTickAt = null, lastError = null;
const latest = {};
const sseClients = new Set();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
function sseWrite(res, event, payload) { res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`); }
function broadcast(event, payload) { for (const client of sseClients) { try { sseWrite(client, event, payload); } catch { sseClients.delete(client); } } }
function setFeedStatus(status, error = null) { feedStatus = status; lastError = error; broadcast("status", { status, connected: Boolean(accessToken), lastTickAt, lastError }); }
function findLtpc(feed) { if (feed?.ltpc) return feed.ltpc; const full = feed?.fullFeed; if (full?.indexFF?.ltpc) return full.indexFF.ltpc; if (full?.marketFF?.ltpc) return full.marketFF.ltpc; if (feed?.firstLevelWithGreeks?.ltpc) return feed.firstLevelWithGreeks.ltpc; return null; }
function handleBinaryMessage(data) {
  try {
    const FeedResponse = protoRoot.lookupType("com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse");
    const decoded = FeedResponse.decode(data);
    const obj = FeedResponse.toObject(decoded, { longs: String, enums: String, defaults: false });
    const updates = [];
    for (const [key, feed] of Object.entries(obj.feeds || {})) {
      const ltpc = findLtpc(feed); if (!ltpc || typeof ltpc.ltp !== "number") continue;
      const tick = { key, ltp: ltpc.ltp, cp: ltpc.cp ?? null, ltt: ltpc.ltt ?? null, receivedAt: Date.now() };
      latest[key] = tick; updates.push(tick);
    }
    if (updates.length) { lastTickAt = Date.now(); if (feedStatus !== "live") setFeedStatus("live"); broadcast("ticks", { ticks: updates, lastTickAt }); }
    if (obj.type === "market_info") broadcast("market_info", obj.marketInfo || {});
  } catch (err) { console.error("Protobuf decode error:", err.message); setFeedStatus("error", "Could not decode Upstox feed message. Check V3 proto schema."); }
}
async function startMarketStream() {
  if (!accessToken) return;
  if (feedSocket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(feedSocket.readyState)) return;
  clearTimeout(reconnectTimer);
  try {
    if (!protoRoot) protoRoot = await protobuf.load(path.join(__dirname, "proto", "MarketDataFeedV3.proto"));
    setFeedStatus("authorizing");
    const auth = await fetch("https://api.upstox.com/v3/feed/market-data-feed/authorize", { headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` } });
    const authData = await auth.json(); const socketUrl = authData?.data?.authorized_redirect_uri;
    if (!auth.ok || !socketUrl) throw new Error(authData?.errors?.[0]?.message || "V3 feed authorization failed");
    setFeedStatus("connecting");
    const socket = new WebSocket(socketUrl, { followRedirects: true, headers: { Authorization: `Bearer ${accessToken}`, Accept: "*/*" } });
    feedSocket = socket;
    socket.on("open", () => {
      reconnectAttempt = 0; setFeedStatus("subscribing");
      const sub = { guid: crypto.randomUUID(), method: "sub", data: { mode: "ltpc", instrumentKeys: INSTRUMENTS } };
      socket.send(Buffer.from(JSON.stringify(sub)));
      console.log("Upstox V3 WebSocket connected; subscribed:", INSTRUMENTS.join(", "));
    });
    socket.on("message", (data, isBinary) => { if (isBinary) handleBinaryMessage(data); });
    socket.on("error", err => { console.error("Upstox WebSocket error:", err.message); lastError = err.message; });
    socket.on("close", (code, reason) => { if (feedSocket === socket) feedSocket = null; console.warn("Upstox WebSocket closed:", code, reason.toString()); if (accessToken) scheduleReconnect(); });
  } catch (err) { console.error("Could not start Upstox stream:", err.message); setFeedStatus("error", err.message); scheduleReconnect(); }
}
function scheduleReconnect() {
  if (!accessToken || reconnectTimer) return;
  reconnectAttempt++; const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(reconnectAttempt, 5)));
  setFeedStatus("reconnecting", lastError);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; startMarketStream(); }, delay);
}
function stopMarketStream() { clearTimeout(reconnectTimer); reconnectTimer = null; if (feedSocket) { const s = feedSocket; feedSocket = null; try { s.close(1000, "server stop"); } catch {} } setFeedStatus("disconnected"); }

app.get("/api/status", (_req, res) => res.json({ connected: Boolean(accessToken), provider: "Upstox", mode: accessToken ? "connected" : "paper/demo", stream: { status: feedStatus, lastTickAt, lastError, instruments: INSTRUMENTS } }));
app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache, no-transform"); res.setHeader("Connection", "keep-alive"); res.flushHeaders?.(); sseClients.add(res);
  sseWrite(res, "status", { status: feedStatus, connected: Boolean(accessToken), lastTickAt, lastError });
  sseWrite(res, "snapshot", { ticks: Object.values(latest), lastTickAt });
  const keepAlive = setInterval(() => { try { res.write(": keep-alive\n\n"); } catch {} }, 25000);
  req.on("close", () => { clearInterval(keepAlive); sseClients.delete(res); });
});
app.get("/auth/upstox", (_req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) return res.status(400).send("Render Environment mein UPSTOX_CLIENT_ID aur UPSTOX_CLIENT_SECRET add karein.");
  oauthState = crypto.randomBytes(18).toString("hex"); const u = new URL("https://api.upstox.com/v2/login/authorization/dialog");
  u.search = new URLSearchParams({ response_type: "code", client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, state: oauthState }).toString(); res.redirect(u.toString());
});
app.get("/auth/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Upstox login failed: ${String(error)}`);
  if (!code || !state || state !== oauthState) return res.status(400).send("OAuth state mismatch. App par wapas jaakar Connect Upstox dobara karein.");
  try {
    const body = new URLSearchParams({ code: String(code), client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" });
    const response = await fetch("https://api.upstox.com/v2/login/authorization/token", { method: "POST", headers: { accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body });
    const data = await response.json(); if (!response.ok || !data.access_token) throw new Error(data.errors?.[0]?.message || "Token exchange failed");
    accessToken = data.access_token; oauthState = null; stopMarketStream(); await startMarketStream(); res.redirect("/?connected=1");
  } catch (e) { res.status(502).send(`Upstox token/stream setup failed: ${e.message}`); }
});
app.get("/api/quotes", async (req, res) => {
  if (!accessToken) return res.status(401).json({ error: "Upstox not connected", demoAvailable: true });
  const keys = String(req.query.keys || INSTRUMENTS.join(",")).split(",").slice(0, 20);
  try { const url = new URL("https://api.upstox.com/v3/market-quote/quotes"); url.searchParams.set("instrument_key", keys.join(",")); const response = await fetch(url, { headers: { accept: "application/json", Authorization: `Bearer ${accessToken}` } }); res.status(response.status).json(await response.json()); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/option-chain", async (req, res) => {
  if (!accessToken) return res.status(401).json({ error: "Upstox not connected. Connect Upstox first." });
  const allowed = new Set(["NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank"]);
  const instrumentKey = String(req.query.instrument_key || "NSE_INDEX|Nifty 50");
  const expiryDate = String(req.query.expiry_date || "current_week");
  const validExpiry = /^(current_week|next_week|far_week|current_month|next_month|far_month|\d{4}-\d{2}-\d{2})$/.test(expiryDate);
  if (!allowed.has(instrumentKey)) return res.status(400).json({ error: "Only NIFTY 50 and BANK NIFTY are supported by this option-chain endpoint." });
  if (!validExpiry) return res.status(400).json({ error: "Expiry must be YYYY-MM-DD or a supported relative keyword." });
  try {
    const url = new URL("https://api.upstox.com/v2/option/chain");
    url.searchParams.set("instrument_key", instrumentKey);
    url.searchParams.set("expiry_date", expiryDate);
    const response = await fetch(url, { headers: { accept: "application/json", Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/candles", async (req, res) => {
  if (!accessToken) return res.status(401).json({ error: "Upstox connect karein; demo candles nahi dikhaye ja rahe." });
  const instrumentKey=String(req.query.instrument_key||"NSE_INDEX|Nifty 50");
  const allowed=new Set(["NSE_INDEX|Nifty 50","NSE_INDEX|Nifty Bank","NSE_INDEX|India VIX"]);
  const unit=String(req.query.unit||"minutes"), interval=String(req.query.interval||"5");
  if(!allowed.has(instrumentKey)) return res.status(400).json({error:"Is build mein NIFTY, BANK NIFTY aur INDIA VIX supported hain."});
  if(!((unit==="minutes" && /^(1|2|3|5|10|15|30)$/.test(interval)) || (unit==="hours" && /^(1|2|3|4|5)$/.test(interval)) || (unit==="days" && interval==="1"))) return res.status(400).json({error:"Unsupported candle timeframe."});
  try {
    const range=String(req.query.range||"today");
    const isoDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||"")) && !Number.isNaN(Date.parse(String(v)+"T00:00:00Z"));
    const customFrom=String(req.query.from_date||"");
    const customTo=String(req.query.to_date||"");
    if(range==="custom" && (!isoDate(customFrom)||!isoDate(customTo)||customFrom>customTo)) return res.status(400).json({error:"Valid from_date aur to_date (YYYY-MM-DD) select karein."});
    const spanDays=(Date.parse(customTo)-Date.parse(customFrom))/86400000;
    const maxDays=unit==="minutes"?(Number(interval)<=15?31:92):unit==="hours"?92:3660;
    if(range==="custom" && spanDays>maxDays) return res.status(400).json({error:"Selected timeframe ke liye date range maximum "+maxDays+" days hai. Upstox V3 historical API limit follow karein."});
    const intraday=range==="today";
    const toDate=range==="custom"?customTo:String(req.query.to_date||new Date().toISOString().slice(0,10));
    const fromDate=range==="custom"?customFrom:String(req.query.from_date||new Date(Date.now()-7*86400000).toISOString().slice(0,10));
    const url=intraday
      ? new URL("https://api.upstox.com/v3/historical-candle/intraday/"+encodeURIComponent(instrumentKey)+"/"+unit+"/"+interval)
      : new URL("https://api.upstox.com/v3/historical-candle/"+encodeURIComponent(instrumentKey)+"/"+unit+"/"+interval+"/"+toDate+"/"+fromDate);
    const response=await fetch(url,{headers:{accept:"application/json",Authorization:"Bearer "+accessToken}});
    const data=await response.json();res.status(response.status).json(data);
  } catch(e){res.status(502).json({error:e.message});}
});

import { analyseMarket, autoPaperTrade, markPaperPosition, paperStatus } from "./trading/engine.js";
import { rankOptionChain, openOptionsPaper, markOptionsPaper, closeOptionsPaper, optionsPaperStatus } from "./trading/options-paper.js";
import { getAutopilotStatus, startAutopilot, stopAutopilot, recordScan, recordAutopilotTrade, updateAutopilotTrade, recordAutopilotError, hasEnteredUnderlyingToday, markUnderlyingEnteredToday } from "./trading/autopilot.js";

async function upstoxJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json", Authorization: "Bearer " + accessToken } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.errors?.[0]?.message || data?.message || ("Upstox API returned " + response.status));
  return data;
}
function validateUnderlyingKey(key) {
  return /^(NSE_INDEX\|[A-Za-z0-9 .&-]+|NSE_EQ\|[A-Z0-9]+)$/.test(String(key || ""));
}
async function getRankedOptionScan(underlyingKey, requestedExpiry, filters = {}) {
  if (!accessToken) throw new Error("Connect Upstox before scanning option chains.");
  if (!validateUnderlyingKey(underlyingKey)) throw new Error("Select an NSE index or NSE equity underlying.");
  const contractUrl = new URL("https://api.upstox.com/v2/option/contract");
  contractUrl.searchParams.set("instrument_key", underlyingKey);
  const contractPayload = await upstoxJson(contractUrl);
  const contracts = contractPayload.data || [];
  const today = new Date().toISOString().slice(0,10);
  const expiries = [...new Set(contracts.map(c => c.expiry).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= today))].sort();
  const expiry = requestedExpiry || expiries[0];
  if (!expiry || !expiries.includes(expiry)) throw new Error("No valid upcoming expiry found. Select a listed expiry.");
  const chainUrl = new URL("https://api.upstox.com/v2/option/chain");
  chainUrl.searchParams.set("instrument_key", underlyingKey);
  chainUrl.searchParams.set("expiry_date", expiry);
  const chainPayload = await upstoxJson(chainUrl);
  const rows = chainPayload.data || [];
  const ranked = rankOptionChain(rows, contracts.filter(c => c.expiry === expiry), filters);
  return { underlyingKey, expiry, expiries, spot: Number(rows[0]?.underlying_spot_price || 0), pcr: rows[0]?.pcr ?? null, ...ranked, scannedAt: Date.now() };
}

const DEFAULT_PAPER_UNDERLYINGS = [
  "NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank",
  "NSE_EQ|RELIANCE", "NSE_EQ|HDFCBANK", "NSE_EQ|ICICIBANK", "NSE_EQ|SBIN",
  "NSE_EQ|INFY", "NSE_EQ|TCS", "NSE_EQ|AXISBANK", "NSE_EQ|LT",
  "NSE_EQ|BHARTIARTL", "NSE_EQ|TATAMOTORS"
];
const customPaperUniverse = process.env.PAPER_SCAN_UNDERLYINGS;
let PAPER_UNDERLYINGS = (customPaperUniverse || DEFAULT_PAPER_UNDERLYINGS.join(",")).split(",").map(x => x.trim()).filter(validateUnderlyingKey);
let paperUniverseLoaded = Boolean(customPaperUniverse), scanCursor = 0;
const PAPER_BATCH_SIZE = Math.max(1, Number(process.env.PAPER_SCAN_BATCH_SIZE || 20));
async function loadPaperUniverse() {
  if (paperUniverseLoaded) return;
  try {
    const response = await fetch("https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz");
    if (!response.ok) throw new Error("Upstox NSE instrument master returned " + response.status);
    const compressed = Buffer.from(await response.arrayBuffer());
    const instruments = JSON.parse(gunzipSync(compressed).toString("utf8"));
    const keys = new Set();
    for (const item of instruments) {
      if (item.segment === "NSE_FO" && ["CE", "PE"].includes(item.instrument_type) &&
          ["EQUITY", "INDEX"].includes(item.underlying_type) && validateUnderlyingKey(item.underlying_key)) keys.add(item.underlying_key);
    }
    if (keys.size) PAPER_UNDERLYINGS = [...new Set([...DEFAULT_PAPER_UNDERLYINGS.slice(0, 2), ...keys])];
    paperUniverseLoaded = true;
    console.log("Loaded NSE F&O option underlyings:", PAPER_UNDERLYINGS.length);
  } catch (error) {
    paperUniverseLoaded = true;
    console.error("Could not load full NSE F&O universe; using fallback shortlist:", error.message);
  }
}
const PAPER_SCAN_INTERVAL_MS = Math.max(60000, Number(process.env.PAPER_SCAN_INTERVAL_MS || 300000));
let autopilotBusy = false;

function indiaMarketClock() {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { weekday: v.weekday, hour: Number(v.hour), minute: Number(v.minute) };
}
function isIndiaMarketSession() {
  const t = indiaMarketClock(), mins = t.hour * 60 + t.minute;
  return !["Sat", "Sun"].includes(t.weekday) && mins >= 555 && mins <= 925;
}
function indiaDateKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
async function refreshAutopilotPositions() {
  for (const position of optionsPaperStatus().openPositions) {
    try {
      const url = new URL("https://api.upstox.com/v2/option/chain");
      url.searchParams.set("instrument_key", position.underlyingKey);
      url.searchParams.set("expiry_date", position.expiry);
      const payload = await upstoxJson(url);
      let bid = null;
      for (const row of payload.data || []) for (const side of ["call_options", "put_options"]) {
        const opt = row[side];
        if (opt?.instrument_key === position.instrumentKey) bid = Number(opt.market_data?.bid_price);
      }
      if (bid > 0) {
        const result = markOptionsPaper(position.instrumentKey, bid);
        if (result.closed && result.trade) updateAutopilotTrade(result.trade.id, { status: result.trade.status, exit: result.trade.exit, pnl: result.trade.pnl, closedAt: result.trade.closedAt, outcomeReason: result.trade.status === "stopped" ? "Live bid touched the 25% premium stop." : "Live bid touched the 50% premium target." });
      }
    } catch (error) { console.error("Autopilot position refresh failed:", error.message); }
  }
}
async function runAutopilotCycle() {
  if (autopilotBusy || !getAutopilotStatus().active) return;
  if (!accessToken) { recordAutopilotError("Set UPSTOX_ANALYTICS_TOKEN in the server environment to enable unattended read-only market data."); return; }
  if (!isIndiaMarketSession()) return;
  const experiment = getAutopilotStatus();
  if (experiment.calendarDaysElapsed >= 90 && experiment.startedAt && Date.now() >= experiment.endsAt) { stopAutopilot(); return; }
  autopilotBusy = true;
  try {
    await refreshAutopilotPositions();
    await loadPaperUniverse();
    const day = indiaDateKey(), filters = { minVolume: 1000, minOi: 10000, maxSpreadPct: 3.5, maxDistancePct: 5 };
    const batch = PAPER_UNDERLYINGS.length <= PAPER_BATCH_SIZE ? PAPER_UNDERLYINGS : Array.from({ length: PAPER_BATCH_SIZE }, (_, i) => PAPER_UNDERLYINGS[(scanCursor + i) % PAPER_UNDERLYINGS.length]);
    scanCursor = (scanCursor + batch.length) % Math.max(1, PAPER_UNDERLYINGS.length);
    const best = [];
    for (const underlyingKey of batch) {
      try {
        const scan = await getRankedOptionScan(underlyingKey, undefined, filters);
        const top = scan.candidates[0] || null;
        const observation = top ? {
          text: top.changePct >= 3 ? top.symbol + " showed positive premium momentum with relative score " + top.volatilityScore + "/100." : "No strong positive premium-momentum candidate in " + underlyingKey + " at this scan.",
          underlyingKey, symbol: top.symbol, score: top.volatilityScore, changePct: top.changePct,
          iv: top.iv, volume: top.volume, oi: top.oi, spreadPct: top.spreadPct
        } : { text: "No contract passed liquidity filters for " + underlyingKey + ".", underlyingKey };
        recordScan({ at: Date.now(), underlyingKey, expiry: scan.expiry, candidateCount: scan.candidates.length, top: top ? { symbol: top.symbol, side: top.side, score: top.volatilityScore, changePct: top.changePct, spreadPct: top.spreadPct } : null, observation });
        if (top) best.push(top);
      } catch (error) {
        recordScan({ at: Date.now(), underlyingKey, error: error.message, candidateCount: 0 });
      }
    }
    best.sort((a,b) => b.volatilityScore - a.volatilityScore);
    const candidate = best.find(c => c.volatilityScore >= 70 && c.changePct >= 3 && c.spreadPct <= 3.5 && c.volume >= 1000 && c.oi >= 10000 && !hasEnteredUnderlyingToday(c.underlyingKey, day));
    if (candidate) {
      const result = openOptionsPaper(candidate);
      if (result.opened) {
        markUnderlyingEnteredToday(candidate.underlyingKey, day);
        recordAutopilotTrade({
          id: result.position.id, openedAt: result.position.openedAt, status: "open",
          underlyingKey: candidate.underlyingKey, symbol: candidate.symbol, side: candidate.side,
          entry: result.position.entry, quantity: result.position.quantity, lots: result.position.lots,
          stop: result.position.stop, target: result.position.target, score: candidate.volatilityScore,
          changePct: candidate.changePct, iv: candidate.iv, volume: candidate.volume, oi: candidate.oi,
          spreadPct: candidate.spreadPct,
          reasons: ["Relative volatility score >= 70", "Option premium day change >= +3%", "Volume and OI filters passed", "Bid-ask spread <= 3.5%", "One entry per underlying per Indian market day"]
        });
      }
    }
  } catch (error) {
    recordAutopilotError(error.message);
    console.error("90-day paper cycle failed:", error.message);
  } finally { autopilotBusy = false; }
}
async function readSupabaseExperiment() {
  const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render Environment.");
  const r = await fetch(base + "/rest/v1/trading_state?id=eq.1&select=payload", { headers: { apikey: key, Authorization: "Bearer " + key } });
  if (!r.ok) throw new Error("Supabase read failed (" + r.status + "). Check table setup and service-role key.");
  const rows = await r.json();
  return { base, key, payload: rows[0]?.payload || { version: 1, optionsPaper: null, autopilot: null } };
}
async function writeSupabaseExperiment(base, key, payload) {
  const r = await fetch(base + "/rest/v1/trading_state?on_conflict=id", {
    method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: 1, payload, updated_at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error("Supabase write failed (" + r.status + "): " + (await r.text()).slice(0, 300));
}
function summarizeExperiment(a = {}) {
  const trades = a.trades || [], closed = trades.filter(t => t.status !== "open");
  const wins = closed.filter(t => Number(t.pnl) > 0);
  const pnl = closed.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  const groups = new Map();
  for (const t of closed) {
    const side = t.side || "unknown", g = groups.get(side) || { side, trades: 0, wins: 0, pnl: 0 };
    g.trades++; if (Number(t.pnl) > 0) g.wins++; g.pnl += Number(t.pnl || 0); groups.set(side, g);
  }
  const elapsed = a.startedAt ? Math.max(0, Date.now() - a.startedAt) : 0;
  const days = a.startedAt ? Math.min(90, Math.floor(elapsed / 86400000) + 1) : 0;
  return {
    active: Boolean(a.active), startedAt: a.startedAt || null, endsAt: a.startedAt ? a.startedAt + 90 * 86400000 : null,
    calendarDaysElapsed: days, calendarDaysRemaining: Math.max(0, 90 - days),
    scanCount: (a.scans || []).length, lastScanAt: a.lastScanAt || null, lastError: a.lastError || null,
    lastWorkerAt: a.lastWorkerAt || null, lastWorkerResult: a.lastWorkerResult || null,
    tradeCount: trades.length, closedTrades: closed.length,
    winRate: closed.length ? Number((wins.length / closed.length * 100).toFixed(1)) : null,
    realizedPnl: Number(pnl.toFixed(2)),
    learningSummary: [...groups.values()].map(g => ({ ...g, winRate: Number((g.wins / g.trades * 100).toFixed(1)), averagePnl: Number((g.pnl / g.trades).toFixed(2)), pnl: Number(g.pnl.toFixed(2)) })),
    observations: (a.observations || []).slice(-20).reverse(),
    recentScans: (a.scans || []).slice(-10).reverse(), recentTrades: trades.slice(-50).reverse()
  };
}
app.get("/api/autopilot/status", async (_req, res) => {
  try {
    const db = await readSupabaseExperiment(), a = db.payload.autopilot || {};
    res.json({ ...summarizeExperiment(a), authMode: process.env.UPSTOX_ANALYTICS_TOKEN ? "analytics_token" : "disconnected", storage: "supabase", worker: "github-actions", watchlistCount: a.universeCount || 0, batchSize: 10, scanIntervalMs: 300000 });
  } catch (e) { res.status(503).json({ error: e.message, storage: "not_configured" }); }
});
app.post("/api/autopilot/start", async (_req, res) => {
  try {
    if (!process.env.UPSTOX_ANALYTICS_TOKEN) return res.status(401).json({ error: "Add UPSTOX_ANALYTICS_TOKEN to GitHub Actions secrets and Render Environment. Use the read-only Analytics Token." });
    const db = await readSupabaseExperiment();
    const a = db.payload.autopilot || { scans: [], trades: [], observations: [], enteredToday: {} };
    if (!a.startedAt) a.startedAt = Date.now();
    if (Date.now() >= a.startedAt + 90 * 86400000) return res.status(409).json({ error: "This 90-day experiment has ended. Start a new experiment by resetting its Supabase row." });
    a.active = true; a.lastError = null; db.payload.autopilot = a;
    await writeSupabaseExperiment(db.base, db.key, db.payload);
    res.json({ ...summarizeExperiment(a), active: true, authMode: "analytics_token", storage: "supabase", worker: "github-actions" });
  } catch (e) { res.status(503).json({ error: e.message }); }
});
app.post("/api/autopilot/stop", async (_req, res) => {
  try {
    const db = await readSupabaseExperiment(), a = db.payload.autopilot || { scans: [], trades: [], observations: [] };
    a.active = false; db.payload.autopilot = a; await writeSupabaseExperiment(db.base, db.key, db.payload);
    res.json({ ...summarizeExperiment(a), active: false, authMode: process.env.UPSTOX_ANALYTICS_TOKEN ? "analytics_token" : "disconnected", storage: "supabase", worker: "github-actions" });
  } catch (e) { res.status(503).json({ error: e.message }); }
});

app.get("/api/options/search", async (req, res) => {
  if (!accessToken) return res.status(401).json({ error: "Connect Upstox first." });
  const query = String(req.query.q || "").trim().slice(0,50);
  if (query.length < 2) return res.status(400).json({ error: "Enter at least two letters of a stock/index symbol." });
  try {
    const url = new URL("https://api.upstox.com/v2/instruments/search");
    url.searchParams.set("query", query); url.searchParams.set("exchanges", "NSE"); url.searchParams.set("segments", "FO");
    url.searchParams.set("instrument_types", "CE,PE"); url.searchParams.set("expiry", "current_month");
    url.searchParams.set("page_number", "1"); url.searchParams.set("records", "30");
    const payload = await upstoxJson(url);
    const unique = new Map();
    for (const item of payload.data || []) if (item.underlying_key && validateUnderlyingKey(item.underlying_key)) {
      unique.set(item.underlying_key, { instrumentKey: item.underlying_key, symbol: item.underlying_symbol || item.trading_symbol, name: item.name, underlyingType: item.underlying_type });
    }
    res.json({ results: [...unique.values()] });
  } catch (e) { res.status(502).json({ error: e.message }); }
});
app.get("/api/options/scan", async (req, res) => {
  try {
    const filters = { minVolume: Number(req.query.min_volume || 100), minOi: Number(req.query.min_oi || 500), maxSpreadPct: Number(req.query.max_spread_pct || 8), maxDistancePct: Number(req.query.max_distance_pct || 5) };
    const result = await getRankedOptionScan(String(req.query.instrument_key || ""), String(req.query.expiry_date || "") || undefined, filters);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get("/api/options/paper/status", (_req, res) => res.json(optionsPaperStatus()));
app.post("/api/options/paper/enter", async (req, res) => {
  try {
    const filters = req.body?.filters || {};
    const scan = await getRankedOptionScan(String(req.body?.underlyingKey || ""), String(req.body?.expiry || ""), filters);
    const candidate = scan.candidates.find(c => c.instrumentKey === req.body?.instrumentKey);
    if (!candidate) return res.status(409).json({ error: "Selected contract is no longer in the fresh scan. Scan again." });
    res.json(openOptionsPaper(candidate));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/options/paper/refresh", async (_req, res) => {
  const status = optionsPaperStatus();
  const updates = [];
  for (const position of status.openPositions) {
    try {
      const url = new URL("https://api.upstox.com/v2/option/chain");
      url.searchParams.set("instrument_key", position.underlyingKey);
      url.searchParams.set("expiry_date", position.expiry);
      const payload = await upstoxJson(url);
      let liveBid = null;
      for (const row of payload.data || []) {
        for (const side of ["call_options", "put_options"]) {
          const opt = row[side];
          if (opt?.instrument_key === position.instrumentKey) liveBid = Number(opt.market_data?.bid_price);
        }
      }
      if (liveBid > 0) updates.push(markOptionsPaper(position.instrumentKey, liveBid));
      else updates.push({ updated: false, instrumentKey: position.instrumentKey, error: "Live bid unavailable in option chain." });
    } catch (e) { updates.push({ updated: false, instrumentKey: position.instrumentKey, error: e.message }); }
  }
  res.json({ updates, status: optionsPaperStatus() });
});
app.post("/api/options/paper/close", (req, res) => {
  try { res.json(closeOptionsPaper(String(req.body?.instrumentKey || ""), Number(req.body?.bidPrice))); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Paper-only trading API. No broker order placement is exposed.
app.get("/api/trading/status", (_req, res) => res.json(paperStatus()));
app.post("/api/trading/analyze", (req, res) => {
  try { res.json(analyseMarket(req.body || {})); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
app.post("/api/trading/paper/auto", (req, res) => {
  try { res.json(autoPaperTrade(analyseMarket(req.body || {}))); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
app.post("/api/trading/paper/mark", (req, res) => {
  try { res.json(markPaperPosition(req.body?.market, req.body?.price)); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "Trading Intelligence AI", stream: feedStatus }));
// Scheduled paper scans run in GitHub Actions; this Render process only serves the dashboard.
app.listen(PORT, () => console.log("Trading Intelligence AI running on port " + PORT));
