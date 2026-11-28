import test from "node:test";
import assert from "node:assert/strict";
import { analyseHistoricalMarket, buildNightLearningReport, RESEARCH_LIBRARY } from "./night-learning.js";

function candles(n=180){const rows=[];let p=100;for(let i=0;i<n;i++){p+=Math.sin(i/7)*1.4+0.12;rows.push([new Date(Date.UTC(2025,0,1+i)).toISOString(),p-0.3,p+1,p-1,p,1000,0]);}return rows;}
test("historical analysis requires real minimum history",()=>{const r=analyseHistoricalMarket(candles(20));assert.equal(r.status,"insufficient_history");});
test("historical analysis produces separate chronological train and OOS diagnostics",()=>{const r=analyseHistoricalMarket(candles());assert.equal(r.status,"available");assert.ok(r.backtests[0].train);assert.ok(r.backtests[0].outOfSample);assert.match(r.backtests[0].entry,/Next daily close/);});
test("night report exposes attributed external research library and guardrails",()=>{const r=buildNightLearningReport({markets:{}});assert.ok(RESEARCH_LIBRARY.length>=6);assert.equal(r.status,"research_library_only");assert.ok(r.guardrails.length>=3);});
