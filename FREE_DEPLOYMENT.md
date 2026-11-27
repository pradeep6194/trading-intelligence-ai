# Free GitHub Actions + Supabase paper-trading deployment

This deployment removes the need for a paid Render instance or Render Persistent Disk. GitHub Actions runs short scheduled jobs; Supabase stores the experiment state; Render Free serves the dashboard. No broker orders are ever placed.

## 1. Create the Supabase database
1. Create a free Supabase project at https://supabase.com/dashboard.
2. Open SQL Editor and run the SQL in `supabase/schema.sql`.
3. In Project Settings → API, copy the Project URL and the **service_role** key. Never put the service-role key in browser code or commit it to GitHub.

## 2. Add GitHub Actions secrets
In GitHub repository → Settings → Secrets and variables → Actions, create:
- `UPSTOX_ANALYTICS_TOKEN`: Upstox long-lived read-only Analytics Token.
- `SUPABASE_URL`: Supabase Project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service_role key.

The scheduled worker runs every five minutes on weekdays in a UTC window that covers NSE market hours. GitHub may delay scheduled workflows; it is not a tick-by-tick feed.

## 3. Add Render environment variables
In Render → Web Service → Environment, add:
- `SUPABASE_URL`: same Project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: same service_role key.
- `UPSTOX_ANALYTICS_TOKEN`: same read-only token (needed for the interactive option scanner).

Do not add a disk or upgrade Render. Redeploy the latest main branch after the PR is merged.

## 4. Start the experiment
Open the deployed app → Option Scanner → 90-day autonomous paper experiment → Start / Resume 90 days.
The start action writes the active flag and start time to Supabase. GitHub Actions then reads that state and scans independently of the Render process and your phone.

## 5. Verify
- GitHub → Actions → “90-day paper trading worker”: run manually using workflow_dispatch, then inspect logs.
- Supabase → Table Editor → trading_state: row id=1 should contain payload.autopilot.lastWorkerAt, scans and trades.
- App → Option Scanner: refresh the 90-day experiment report; scan count and trades should match the Supabase journal.

## Free-tier constraints
- GitHub Actions scheduled workflows can be delayed, disabled by inactivity, or throttled; do not assume exact five-minute execution.
- Supabase Free includes limited database/storage/egress and may pause projects after inactivity. Keep the project active and check current dashboard quotas.
- Render Free may sleep; only the dashboard sleeps. The GitHub worker continues independently.
- The worker scans ten NSE F&O underlyings per successful run, rotating across the current Upstox instrument master. Failed or delayed runs mean fewer symbols are scanned.
- GitHub Actions runner filesystem is temporary. All durable experiment state is synchronized to Supabase after each worker cycle.
- This is paper trading only. Simulated fills, API latency, slippage, brokerage and taxes mean results are not live-trading performance or a profit guarantee.
