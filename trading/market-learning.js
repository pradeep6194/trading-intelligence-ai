// Evidence-first market learning. This module describes observed conditions; it does not claim causation or forecast certainty.
const n = value => Number.isFinite(Number(value)) ? Number(value) : null;
const pct = value => value == null ? null : Number(value.toFixed(3));

export function classifyMarketEvidence(input = {}) {
  const spotChangePct = n(input.spotChangePct);
  const pcr = n(input.pcr);
  const pcrChange = n(input.pcrChange);
  const callOiChangePct = n(input.callOiChangePct);
  const putOiChangePct = n(input.putOiChangePct);
  const premiumChangePct = n(input.premiumChangePct);
  const iv = n(input.iv);
  const volume = n(input.volume);
  const spreadPct = n(input.spreadPct);
  const drivers = [];
  let regime = "mixed / insufficient evidence";
  let directionalBias = "neutral";
  let confidence = "low";

  if (spotChangePct !== null && Math.abs(spotChangePct) >= 0.10) {
    directionalBias = spotChangePct > 0 ? "bullish" : "bearish";
    regime = spotChangePct > 0 ? "positive price momentum" : "negative price momentum";
    drivers.push({ factor: "spot momentum", observation: `Underlying moved ${spotChangePct > 0 ? "+" : ""}${spotChangePct}% since the previous scan.`, supports: directionalBias });
  }
  if (pcr !== null && pcr > 0) {
    const interpretation = pcr >= 1.2 ? "put OI exceeds call OI" : pcr <= 0.8 ? "call OI exceeds put OI" : "put/call OI is relatively balanced";
    drivers.push({ factor: "put-call OI ratio", observation: `PCR is ${pcr.toFixed(2)}; ${interpretation}. This is positioning context, not confirmed support or resistance.`, supports: "context" });
  }
  if (pcrChange !== null && Math.abs(pcrChange) >= 0.05) drivers.push({ factor: "PCR change", observation: `PCR changed ${pcrChange > 0 ? "up" : "down"} by ${Math.abs(pcrChange).toFixed(2)} since the previous scan.`, supports: "context" });
  if (callOiChangePct !== null && Math.abs(callOiChangePct) >= 0.5) drivers.push({ factor: "call OI change", observation: `Aggregate call OI changed ${callOiChangePct > 0 ? "+" : ""}${callOiChangePct}% versus the previous scan.`, supports: "context" });
  if (putOiChangePct !== null && Math.abs(putOiChangePct) >= 0.5) drivers.push({ factor: "put OI change", observation: `Aggregate put OI changed ${putOiChangePct > 0 ? "+" : ""}${putOiChangePct}% versus the previous scan.`, supports: "context" });
  if (premiumChangePct !== null) drivers.push({ factor: "leading option premium", observation: `Top liquid contract premium changed ${premiumChangePct > 0 ? "+" : ""}${premiumChangePct}% on the day.`, supports: premiumChangePct >= 3 ? "momentum" : "context" });
  if (iv !== null) drivers.push({ factor: "implied volatility", observation: `Leading contract IV is ${iv.toFixed(1)}%.`, supports: "risk context" });
  if (volume !== null && spreadPct !== null) drivers.push({ factor: "liquidity", observation: `Leading contract volume is ${Math.round(volume)} with a ${spreadPct}% bid-ask spread.`, supports: spreadPct <= 3.5 && volume >= 1000 ? "liquid" : "caution" });

  const priceAndOiAgree = spotChangePct !== null && ((spotChangePct > 0 && putOiChangePct > 0 && callOiChangePct < 0) || (spotChangePct < 0 && callOiChangePct > 0 && putOiChangePct < 0));
  if (priceAndOiAgree) confidence = "moderate";
  if (directionalBias === "neutral" || (spreadPct !== null && spreadPct > 3.5)) confidence = "low";

  const opportunity = premiumChangePct !== null && premiumChangePct >= 3 && volume !== null && volume >= 1000 && spreadPct !== null && spreadPct <= 3.5
    ? "liquid option momentum watch"
    : "no qualified option-momentum watch";
  const hypothesis = directionalBias === "neutral"
    ? "Wait for price direction and positioning evidence to align; no directional hypothesis is justified by this snapshot."
    : `Hypothesis: ${directionalBias} price momentum may persist if the next observations confirm it. Invalidate if price reverses or positioning evidence diverges.`;
  return {
    regime, directionalBias, confidence, opportunity, hypothesis,
    drivers, evidenceQuality: spotChangePct === null ? "first observation; no prior-scan comparison" : "compared with previous scan",
    caution: "Observed correlations and option positioning do not establish the cause of a move. News catalysts require a separately verified source."
  };
}

export function resolveForwardOutcome(observation, nextSpot) {
  const priorSpot = n(observation?.evidence?.spot ?? observation?.spot);
  const currentSpot = n(nextSpot);
  if (!(priorSpot > 0) || !(currentSpot > 0)) return null;
  const movePct = pct((currentSpot - priorSpot) / priorSpot * 100);
  const bias = observation?.analysis?.directionalBias || "neutral";
  const aligned = bias === "bullish" ? movePct > 0 : bias === "bearish" ? movePct < 0 : null;
  return { evaluatedAt: Date.now(), nextSpot: currentSpot, forwardMovePct: movePct, hypothesisOutcome: aligned === null ? "not_directional" : aligned ? "aligned" : "not_aligned" };
}
