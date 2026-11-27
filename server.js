import express from "express";
import dotenv from "dotenv";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";
import protobuf from "protobufjs";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.UPSTOX_CLIENT_ID;
const CLIENT_SECRET = process.env.UPSTOX_CLIENT_SECRET;
const REDIRECT_URI = process.env.UPSTOX_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const INSTRUMENTS = (process.env.UPSTOX_INSTRUMENT_KEYS || "NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,NSE_INDEX|India VIX").split(",").map(x => x.trim()).filter(Boolean);
let accessToken = null, oauthState = null, feedSocket = null, reconnectTimer = null, reconnectAttempt = 0;
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
app.get("/api/health", (_req, res) => res.json({ ok: true, app: "Trading Intelligence AI", stream: feedStatus }));
app.listen(PORT, () => console.log(`Trading Intelligence AI running on port ${PORT}`));
