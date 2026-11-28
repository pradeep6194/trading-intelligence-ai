import test from "node:test";
import assert from "node:assert/strict";
import { SUCCESSFUL_ALGORITHMIC_TRADING, buildBookLearningPlan, evaluateBookResearchGate } from "./book-learning.js";

test("curriculum preserves all 16 book chapters in order", () => {
  assert.equal(SUCCESSFUL_ALGORITHMIC_TRADING.chapters.length, 16);
  assert.deepEqual(SUCCESSFUL_ALGORITHMIC_TRADING.chapters.map(x => x.chapter), Array.from({length:16}, (_,i)=>i+1));
});
test("learning plan defaults to no completed chapters and paper-only operation", () => {
  const p = buildBookLearningPlan();
  assert.deepEqual(p.completedChapters, []);
  assert.equal(p.nextChapter, 1);
  assert.ok(p.operationalRules.some(x => x.includes("must not create live orders")));
});
test("research gate rejects incomplete evidence", () => {
  const r = evaluateBookResearchGate({});
  assert.equal(r.passed, false);
  assert.equal(r.executionPermission, "none");
});
test("research gate only passes a fully evidenced candidate for paper review", () => {
  const r = evaluateBookResearchGate({hypothesis:"Test a defined breakout rule",dataSource:"Upstox",dataRange:"2023-01 to 2026-01",dataQualityPassed:true,noLookahead:true,costsModelled:true,chronologicalSplit:true,outOfSampleTrades:50,robustnessPassed:true,riskReviewed:true});
  assert.equal(r.status, "research_gate_passed_for_paper_review");
  assert.match(r.nextStep, /paper-only/);
  assert.equal(r.executionPermission, "none");
});
