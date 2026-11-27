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


## 90-day autonomous paper experiment (read-only market data)
- The Options Paper Desk can run a server-side NSE F&O scan every five minutes during weekday NSE market hours, even when the browser is closed. The worker downloads Upstox’s daily NSE instrument master and discovers current NSE F&O option underlyings (stock and index). It rotates through batches of 20 underlyings per scan cycle so the complete universe is covered over successive cycles. A fallback shortlist is used only if the instrument master cannot be loaded.
- The worker uses a conservative momentum/liquidity gate before opening a simulated long CE/PE position. It never submits broker orders. It records scans, entry reasons, exits, P&L and simple measured summaries. These are rule-based observations, not self-modifying AI or a claim of predictive learning.
- Configure `UPSTOX_ANALYTICS_TOKEN` in the Render service environment. Upstox Analytics Tokens are long-lived and read-only, and support market-data APIs including option chain and WebSocket. They do not permit trading orders. The ordinary OAuth access token expires at 3:30 AM the following day and cannot be kept alive by merely storing it.
- Set `DATA_DIR=/var/data` and attach a Render Persistent Disk mounted at `/var/data` to preserve the experiment database across deploys/restarts. Without a persistent disk (or an external database), the local JSON store is ephemeral and data can be lost.
- Use a paid, always-on Render Web Service for unattended operation. Render free web services spin down after 15 minutes without inbound traffic; while asleep, this in-process scanner cannot run. A browser being closed is fine only while the backend service remains running.
- Optional environment variables: `PAPER_AUTOPILOT_ENABLED=false` to prevent automatic startup; `PAPER_SCAN_INTERVAL_MS=300000` (minimum 60000); `PAPER_SCAN_BATCH_SIZE=20`; `PAPER_SCAN_UNDERLYINGS` as a comma-separated override list of Upstox underlying instrument keys.
- The 90-day clock begins on first activation. The default scan is a curated shortlist, not every NSE F&O stock; NSE holidays are not independently calendar-filtered. Check data freshness and Upstox API limits before widening the list.
- The paper engine uses simulated entries at ask and marks/exits at bid. Real-world slippage, exchange charges and taxes can differ. The experiment is research, not financial advice or a promise of profit.
