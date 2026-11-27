import express from "express";
import dotenv from "dotenv";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.UPSTOX_CLIENT_ID;
const CLIENT_SECRET = process.env.UPSTOX_CLIENT_SECRET;
const REDIRECT_URI = process.env.UPSTOX_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
let accessToken = null;
let oauthState = null;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/status", (_req, res) => {
  res.json({ connected: Boolean(accessToken), provider: "Upstox", mode: accessToken ? "connected" : "paper/demo" });
});

app.get("/auth/upstox", (_req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) return res.status(400).send("Add UPSTOX_CLIENT_ID and UPSTOX_CLIENT_SECRET to .env first.");
  oauthState = crypto.randomBytes(18).toString("hex");
  const u = new URL("https://api.upstox.com/v2/login/authorization/dialog");
  u.search = new URLSearchParams({ response_type: "code", client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, state: oauthState }).toString();
  res.redirect(u.toString());
});

app.get("/auth/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Upstox login failed: ${String(error)}`);
  if (!code || !state || state !== oauthState) return res.status(400).send("Invalid OAuth callback/state. Please retry connection.");
  try {
    const body = new URLSearchParams({
      code: String(code), client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI, grant_type: "authorization_code"
    });
    const response = await fetch("https://api.upstox.com/v2/login/authorization/token", {
      method: "POST", headers: { accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body
    });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error(data.errors?.[0]?.message || "Token exchange failed");
    accessToken = data.access_token;
    oauthState = null;
    res.redirect("/?connected=1");
  } catch (e) {
    res.status(502).send(`Could not complete Upstox token exchange: ${e.message}`);
  }
});

app.get("/api/quotes", async (req, res) => {
  if (!accessToken) return res.status(401).json({ error: "Upstox not connected", demoAvailable: true });
  const keys = String(req.query.keys || "NSE_INDEX|Nifty 50").split(",").slice(0, 10);
  try {
    const url = new URL("https://api.upstox.com/v3/market-quote/quotes");
    url.searchParams.set("instrument_key", keys.join(","));
    const response = await fetch(url, { headers: { accept: "application/json", Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/option-chain", async (req, res) => {
  if (!accessToken) return res.status(401).json({ error: "Upstox not connected" });
  const instrumentKey = req.query.instrument_key;
  const expiryDate = req.query.expiry_date;
  if (!instrumentKey || !expiryDate) return res.status(400).json({ error: "instrument_key and expiry_date are required" });
  try {
    const url = new URL("https://api.upstox.com/v2/option/chain");
    url.searchParams.set("instrument_key", instrumentKey);
    url.searchParams.set("expiry_date", expiryDate);
    const response = await fetch(url, { headers: { accept: "application/json", Authorization: `Bearer ${accessToken}` } });
    res.status(response.status).json(await response.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "Trading Intelligence AI" }));
app.listen(PORT, () => console.log(`Trading Intelligence AI running at http://localhost:${PORT}`));
