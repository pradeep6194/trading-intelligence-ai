const finite = value => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function buildOptionGreekSnapshotRows(chain, underlyingKey, expiry, snapshotAt = new Date().toISOString()) {
  if (!Array.isArray(chain)) throw new TypeError("Option chain must be an array.");
  const rows = [];
  for (const strikeRow of chain) {
    for (const [side, field] of [["CE", "call_options"], ["PE", "put_options"]]) {
      const option = strikeRow?.[field];
      const instrumentKey = option?.instrument_key;
      if (!instrumentKey) continue;
      const market = option.market_data || {};
      const greeks = option.option_greeks || {};
      rows.push({
        snapshot_at: snapshotAt,
        underlying_key: underlyingKey,
        expiry,
        instrument_key: instrumentKey,
        option_type: side,
        strike: finite(strikeRow.strike_price),
        spot: finite(strikeRow.underlying_spot_price),
        ltp: finite(market.ltp),
        bid: finite(market.bid_price),
        ask: finite(market.ask_price),
        volume: finite(market.volume),
        oi: finite(market.oi),
        iv: finite(greeks.iv),
        delta: finite(greeks.delta),
        gamma: finite(greeks.gamma),
        theta: finite(greeks.theta),
        vega: finite(greeks.vega),
        raw: { market_data: market, option_greeks: greeks }
      });
    }
  }
  return rows.filter(row => row.strike !== null);
}

export async function persistOptionGreekSnapshots(rows, { supabaseUrl, serviceKey, fetchImpl = fetch }) {
  if (!Array.isArray(rows) || rows.length === 0) return { saved: 0 };
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase URL and service-role key are required.");
  const base = supabaseUrl.replace(/\/$/, "");
  let saved = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const response = await fetchImpl(base + "/rest/v1/option_greek_snapshots?on_conflict=snapshot_at,instrument_key", {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(chunk)
    });
    if (!response.ok) throw new Error("Option Greeks archive write failed (" + response.status + "): " + (await response.text()).slice(0, 300));
    saved += chunk.length;
  }
  return { saved };
}
