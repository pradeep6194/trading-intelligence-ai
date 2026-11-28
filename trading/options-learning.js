const numeric = value => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const average = values => {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
};
const pctChange = (a, b) => Number.isFinite(a) && Number.isFinite(b) && a !== 0 ? ((b - a) / Math.abs(a)) * 100 : null;
function pearson(pairs) {
  const clean = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (clean.length < 10) return { status: "insufficient_observations", observations: clean.length, value: null };
  const mx = average(clean.map(p => p[0])), my = average(clean.map(p => p[1]));
  const numerator = clean.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
  const dx = clean.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  const dy = clean.reduce((s, [, y]) => s + (y - my) ** 2, 0);
  if (!dx || !dy) return { status: "zero_variance", observations: clean.length, value: null };
  return { status: "available", observations: clean.length, value: Number((numerator / Math.sqrt(dx * dy)).toFixed(4)) };
}

/**
 * Descriptive analysis of archived option-chain snapshots. Correlations use
 * consecutive percentage/point changes within each contract, never pooled
 * absolute levels, and are not predictive or causal estimates.
 */
export function analyseOptionGreekSnapshots(rows, { windowDays = 30, now = new Date() } = {}) {
  if (!Array.isArray(rows)) throw new TypeError("Option snapshot rows must be an array.");
  const cutoff = now.getTime() - windowDays * 86400000;
  const valid = rows.map(row => ({ ...row, _time: Date.parse(row.snapshot_at) }))
    .filter(row => Number.isFinite(row._time) && row._time >= cutoff && row.instrument_key)
    .sort((a, b) => a._time - b._time);
  if (!valid.length) return {
    status: "no_archived_snapshots", windowDays, snapshots: 0, contracts: 0,
    correlations: { ivChangePremiumChange: pearson([]), spotChangePremiumChange: pearson([]) },
    note: "No verified archived option snapshots were found in the requested window."
  };

  const grouped = new Map();
  for (const row of valid) {
    const list = grouped.get(row.instrument_key) || [];
    list.push(row); grouped.set(row.instrument_key, list);
  }
  const ivPremiumPairs = [], spotPremiumPairs = [], contracts = [];
  for (const [instrumentKey, history] of grouped) {
    const first = history[0], last = history[history.length - 1];
    const ivChanges = [], premiumChanges = [], spotChanges = [], oiChanges = [], volumeChanges = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1], cur = history[i];
      const iv0 = numeric(prev.iv), iv1 = numeric(cur.iv);
      const ltp0 = numeric(prev.ltp), ltp1 = numeric(cur.ltp);
      const spot0 = numeric(prev.spot), spot1 = numeric(cur.spot);
      const oi0 = numeric(prev.oi), oi1 = numeric(cur.oi);
      const vol0 = numeric(prev.volume), vol1 = numeric(cur.volume);
      if (iv0 !== null && iv1 !== null) ivChanges.push(iv1 - iv0);
      const premiumPct = pctChange(ltp0, ltp1);
      const spotPct = pctChange(spot0, spot1);
      if (premiumPct !== null) premiumChanges.push(premiumPct);
      if (spotPct !== null) spotChanges.push(spotPct);
      if (iv0 !== null && iv1 !== null && premiumPct !== null) ivPremiumPairs.push([iv1 - iv0, premiumPct]);
      if (spotPct !== null && premiumPct !== null) spotPremiumPairs.push([spotPct, premiumPct]);
      const oiPct = pctChange(oi0, oi1);
      if (oiPct !== null) oiChanges.push(oiPct);
      if (vol0 !== null && vol1 !== null) volumeChanges.push(vol1 - vol0);
    }
    const latest = history[history.length - 1];
    const spread = numeric(latest.ask) !== null && numeric(latest.bid) !== null && numeric(latest.ltp) > 0
      ? ((numeric(latest.ask) - numeric(latest.bid)) / numeric(latest.ltp)) * 100 : null;
    contracts.push({
      instrumentKey, underlyingKey: latest.underlying_key || null, expiryDate: latest.expiry_date || null,
      optionType: latest.option_type || null, strike: numeric(latest.strike),
      observations: history.length, firstSnapshotAt: first.snapshot_at, lastSnapshotAt: latest.snapshot_at,
      iv: { first: numeric(first.iv), latest: numeric(latest.iv), changePoints: numeric(first.iv) !== null && numeric(latest.iv) !== null ? Number((numeric(latest.iv) - numeric(first.iv)).toFixed(4)) : null, averageStepChangePoints: average(ivChanges) },
      premium: { first: numeric(first.ltp), latest: numeric(latest.ltp), changePct: pctChange(numeric(first.ltp), numeric(latest.ltp)), averageStepChangePct: average(premiumChanges) },
      spot: { first: numeric(first.spot), latest: numeric(latest.spot), changePct: pctChange(numeric(first.spot), numeric(latest.spot)), averageStepChangePct: average(spotChanges) },
      oi: { first: numeric(first.oi), latest: numeric(latest.oi), changePct: pctChange(numeric(first.oi), numeric(latest.oi)), averageStepChangePct: average(oiChanges) },
      volume: { first: numeric(first.volume), latest: numeric(latest.volume), netChange: numeric(first.volume) !== null && numeric(latest.volume) !== null ? numeric(latest.volume) - numeric(first.volume) : null, averageStepChange: average(volumeChanges) },
      latestGreeks: { delta: numeric(latest.delta), gamma: numeric(latest.gamma), theta: numeric(latest.theta), vega: numeric(latest.vega) },
      latestBidAskSpreadPctOfPremium: spread === null ? null : Number(spread.toFixed(4))
    });
  }
  const pairCount = ivPremiumPairs.length + spotPremiumPairs.length;
  return {
    status: valid.length >= 2 ? "available" : "insufficient_snapshots",
    windowDays, snapshots: valid.length, contracts: contracts.length,
    changePairs: { ivPremium: ivPremiumPairs.length, spotPremium: spotPremiumPairs.length },
    correlations: {
      ivChangePremiumChange: pearson(ivPremiumPairs),
      spotChangePremiumChange: pearson(spotPremiumPairs)
    },
    greeksCoverage: Object.fromEntries(["delta", "gamma", "theta", "vega"].map(key => [key, contracts.filter(c => c.latestGreeks[key] !== null).length])),
    contracts: contracts.sort((a, b) => b.observations - a.observations),
    interpretation: "Pearson correlations are descriptive associations between consecutive within-contract changes; they do not establish causation or predict future returns. IV change is expressed in percentage points."
  };
}
