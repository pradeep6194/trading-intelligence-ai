import test from "node:test";
import assert from "node:assert/strict";
import { classifyMarketEvidence, resolveForwardOutcome } from "./market-learning.js";

test("classifies bullish momentum from observed price move", () => {
  const a = classifyMarketEvidence({ spotChangePct: 0.24, pcr: 1.25, putOiChangePct: 1.2, callOiChangePct: -0.8, premiumChangePct: 4, volume: 2500, spreadPct: 2.1, iv: 22 });
  assert.equal(a.directionalBias, "bullish");
  assert.equal(a.confidence, "moderate");
  assert.equal(a.opportunity, "liquid option momentum watch");
  assert.ok(a.drivers.length >= 4);
});

test("does not invent a direction on first observation", () => {
  const a = classifyMarketEvidence({ pcr: 1.05, iv: 18 });
  assert.equal(a.directionalBias, "neutral");
  assert.equal(a.confidence, "low");
  assert.match(a.hypothesis, /no directional hypothesis/);
});

test("evaluates next scan against stored hypothesis", () => {
  const result = resolveForwardOutcome({ spot: 100, analysis: { directionalBias: "bullish" } }, 101);
  assert.equal(result.hypothesisOutcome, "aligned");
  assert.equal(result.forwardMovePct, 1);
});
