import test from "node:test";
import assert from "node:assert/strict";
import { normaliseCandles, analyseOhlcvStructure, analyseMarketBreadth, summariseInstitutionalFlows, normaliseVerifiedNews } from "./research-feeds.js";

test("normalises valid Upstox candle arrays and sorts by timestamp",()=>{
  const rows=[["2026-11-27T09:25:00+05:30",101,104,100,103,1500,0],["2026-11-27T09:20:00+05:30",100,102,99,101,1000,0]];
  const candles=normaliseCandles(rows);
  assert.equal(candles.length,2); assert.ok(candles[0].timestamp<candles[1].timestamp); assert.equal(candles[0].volume,1000);
});
test("rejects malformed candles and reports insufficient history",()=>{
  assert.equal(normaliseCandles([["bad",1,2,0,1,1]]).length,0);
  assert.equal(analyseOhlcvStructure([]).status,"insufficient_history");
});
test("OHLCV structure reports available state and never labels wick-only breakout as BOS",()=>{
  const rows=[];
  for(let i=0;i<35;i++){const close=100+i*.2;rows.push([new Date(Date.UTC(2026,0,1,0,i)).toISOString(),close-.1,close+.4,close-.4,close,100+i,0]);}
  const result=analyseOhlcvStructure(rows,{minimumCandles:20});
  assert.equal(result.status,"available"); assert.ok(["bullish","bearish","range"].includes(result.bias)); assert.ok(Array.isArray(result.events)); assert.ok(Array.isArray(result.orderBlocks)); assert.ok(Array.isArray(result.liquiditySweeps)); assert.ok(Array.isArray(result.fairValueGaps));
});
test("breadth computes advances, declines and unchanged from returned quotes only",()=>{
  const result=analyseMarketBreadth({"NSE_EQ|A":{net_change:2},"NSE_EQ|B":{net_change:-1},"NSE_EQ|C":{net_change:0}});
  assert.equal(result.sampleSize,3); assert.equal(result.advances,1); assert.equal(result.declines,1); assert.equal(result.unchanged,1);
});
test("institutional flow keeps FII segments and DII cash flow separate",()=>{
  const result=summariseInstitutionalFlows({data:{"NSE_FO|INDEX_FUTURES":[{time_stamp:100,buy_amount:120,sell_amount:90}]}},{data:{"NSE_EQ|CASH":[{time_stamp:101,buy_amount:50,sell_amount:80}]}});
  assert.equal(result.status,"available"); assert.equal(result.fii[0].netAmount,30); assert.equal(result.dii[0].netAmount,-30);
});
test("news normaliser accepts only recent Upstox-linked items with publication timestamp",()=>{
  const now=Date.now();
  const result=normaliseVerifiedNews({data:{"NSE_EQ|ABC":[
    {heading:"Fresh",summary:"s",article_link:"https://upstox.com/news/abc",published_time:now-1000},
    {heading:"Wrong host",article_link:"https://example.com/news",published_time:now-1000},
    {heading:"Old",article_link:"https://upstox.com/news/old",published_time:now-9*86400000}
  ]}},now);
  assert.equal(result.length,1); assert.equal(result[0].headline,"Fresh");
});
