# Trading Intelligence AI — Upstox V3 Live Stream build

Mobile-first trading education and paper-trading app. This version adds an Upstox Market Data Feed V3 WebSocket client, Protobuf decoding, automatic reconnect, and server-to-browser live updates via Server-Sent Events (SSE).

## What is included
- Existing mobile-first dashboard, classroom, paper trading, risk coach and journal.
- Upstox OAuth authorization-code flow.
- Upstox V3 WebSocket authorization endpoint and persistent socket connection while the server process is running.
- Official V3 message schema in `proto/MarketDataFeedV3.proto` and Protobuf decoding.
- LTPC subscription for NIFTY 50, BANK NIFTY and India VIX by default.
- Automatic reconnect with exponential backoff and live connection status.
- SSE endpoint `/api/stream` pushes decoded ticks to the browser without refreshing the page.
- No real-money order placement.

## Render deployment (phone-friendly)
1. Extract this ZIP on your phone or computer.
2. Upload the **contents of the `trading-intelligence-ai` folder** to the root of your GitHub repository. The root must contain `package.json`, `server.js`, `public/` and `proto/`.
3. In Render, open your existing Web Service → Settings → Build & Deploy.
4. Set **Build Command** to `npm install` (not `bun install`).
5. Set **Start Command** to `npm start` (or `node server.js`). Save changes.
6. In Render → Environment, add:
   - `UPSTOX_CLIENT_ID` = your Upstox API Key
   - `UPSTOX_CLIENT_SECRET` = your Upstox API Secret
   - `UPSTOX_REDIRECT_URI` = `https://YOUR-RENDER-SERVICE.onrender.com/auth/callback`
7. In Upstox Developer portal, edit your app's Redirect URL to exactly the same HTTPS callback URL. Save it.
8. In Render, choose Manual Deploy → Deploy latest commit. Wait until logs show the service is live.
9. Open your Render app URL, tap **Connect Upstox**, sign in, and authorize.
10. Open Live Markets. It should show a stream status. During market hours, NIFTY/BANK NIFTY/VIX update when Upstox sends ticks. No price changes outside market activity is normal.

## Important notes
- Do not paste API Secret or access tokens into ChatGPT, GitHub source files, or frontend code. Store secrets only in Render Environment.
- Upstox standard access tokens are time-limited and generally need fresh authorization; if the stream stops after token expiry or a server restart, tap Connect Upstox again.
- Render free instances can sleep after inactivity. The first request may be delayed while the service wakes.
- A WebSocket stream only changes when the exchange/feed emits updates. It is not guaranteed to change every second; closed markets and illiquid instruments may remain unchanged.
- The app keeps the access token in server memory only. A Render restart clears it. This starter is for private testing, not production multi-user deployment.
- Default subscription is LTPC only. Crude Oil and option contracts are not included because their exact instrument keys must be selected from the current Upstox instrument master.
- The classroom remains a rule-based educational tutor, not a generative AI model. Paper trades remain in browser localStorage. No live orders are submitted.

## Local run
Node.js 18+:
```bash
cp .env.example .env
# Fill credentials and localhost redirect URI in .env
npm install
npm start
```
Open `http://localhost:3000`.

## Official references
- https://upstox.com/developer/api-documentation/v3/get-market-data-feed/
- https://upstox.com/developer/api-documentation/get-market-data-feed-authorize-v3/
- https://github.com/upstox/upstox-php/blob/master/examples/websocket/market_data/v3/protobuf/MarketDataFeedV3.proto
