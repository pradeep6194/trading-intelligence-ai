import test from "node:test";
import assert from "node:assert/strict";
import { analyseMarket } from "./engine.js";
const sample=(n=60)=>Array.from({length:n},(_,i)=>{const c=100+i*.8;return {timestamp:i,open:c-.2,high:c+.5,low:c-.5,close:c,volume:1000+i*10};});
test("rejects unsupported market",()=>assert.throws(()=>analyseMarket({market:"SENSEX",candles:sample()})));
test("rejects fewer than 30 candles",()=>assert.throws(()=>analyseMarket({market:"NIFTY",candles:sample(10)})));
test("returns indicators and explainable scores",()=>{const x=analyseMarket({market:"NIFTY",candles:sample()});assert.equal(x.market,"NIFTY");assert.ok(["bullish","bearish","no_trade"].includes(x.signal));assert.ok(x.indicators.atr14>0);assert.ok(x.scores.bullish>=0&&x.scores.bullish<=100);});
