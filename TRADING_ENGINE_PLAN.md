# Trading Intelligence AI — Trading Engine Phase 1

## Scope
This branch adds an explainable hybrid signal engine and paper-only risk/execution layer for NIFTY, BANKNIFTY and MCX Crude Oil.

## Safety boundary
- Paper trading only. No broker order-placement endpoint is included.
- OHLCV features: EMA 9/21, VWAP, RSI 14, ATR 14, swing levels, liquidity sweeps, simple FVG and break-of-structure checks.
- Optional PCR and call/put OI-change context can add limited score weight.
- Generic paper units are used, not exchange lot sizes. Exact MCX crude and option contracts must be resolved from the current broker instrument master before contract simulation or live integration.
- Paper state is in server memory and resets on restart. This is a development MVP, not production persistence.

## API
- GET /api/trading/status
- POST /api/trading/analyze
- POST /api/trading/paper/auto
- POST /api/trading/paper/mark

Analyze request requires 30–2000 valid candles:
{"market":"NIFTY","candles":[{"open":100,"high":102,"low":99,"close":101,"volume":1200}],"optionsData":{"pcr":1.1,"callOiChange":-2,"putOiChange":3}}

## Starter risk controls
- 0.5% paper capital risk per trade.
- 1% daily realized-loss lock.
- Maximum 3 entries per day.
- One open position per market.
- 10x maximum gross notional exposure cap in the generic paper simulator; actual derivatives margin and lot sizing are not modelled yet.
- 1.5 ATR stop and 2R target.
These are configurable starter assumptions, not personalized financial advice or guarantees.

## Run
npm install
npm test
npm start

## Roadmap
1. Current instrument-master lookup for NIFTY/BANKNIFTY options and MCX crude futures.
2. Time-aligned Upstox candles and options-chain ingestion.
3. Persistent database, idempotent ledger, backtesting and replay.
4. Walk-forward validation with brokerage, taxes, slippage and latency.
5. Separately gated live execution only after testing, broker permission review, reconciliation, monitoring and hard kill switch.
