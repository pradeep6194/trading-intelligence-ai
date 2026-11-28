// Structured curriculum derived from the chapter structure of Successful Algorithmic Trading.
// Original summaries and implementation requirements; this is not a reproduction of the book.
export const SUCCESSFUL_ALGORITHMIC_TRADING = {
  id: "successful-algorithmic-trading",
  title: "Successful Algorithmic Trading",
  author: "Michael L. Halls-Moore",
  source: "User-provided 208-page PDF",
  chapters: [
    { part: "I. Introducing Algorithmic Trading", chapter: 1, title: "Introduction to the Book", topics: ["system development lifecycle", "research-to-execution workflow"], application: "Treat every strategy as a complete research, risk, execution and monitoring system." },
    { part: "I. Introducing Algorithmic Trading", chapter: 2, title: "What Is Algorithmic Trading?", topics: ["systematic trading", "scientific method", "retail trader constraints"], application: "Convert observations into falsifiable hypotheses; do not add indicators without a testable reason." },
    { part: "II. Trading Systems", chapter: 3, title: "Successful Backtesting", topics: ["optimisation bias", "look-ahead bias", "survivorship bias", "cognitive bias", "orders", "transaction costs", "slippage", "market impact"], application: "Reject contaminated tests; model realistic fills and costs; record assumptions." },
    { part: "II. Trading Systems", chapter: 4, title: "Automated Execution", topics: ["research backtesters", "event-driven backtesters", "latency", "execution platforms"], application: "Separate research simulation from execution; use event-driven replay for realistic order lifecycle testing." },
    { part: "II. Trading Systems", chapter: 5, title: "Sourcing Strategy Ideas", topics: ["trading preferences", "strategy sourcing", "evaluation", "historical data"], application: "Maintain a hypothesis backlog with rationale, evidence, data requirements and rejection criteria." },
    { part: "III. Data Platform Development", chapter: 6, title: "Software Installation", topics: ["Python environment", "scientific libraries", "development environment"], application: "Use reproducible dependencies, versioned code and automated tests; adapt the book's legacy Python examples to the current stack." },
    { part: "III. Data Platform Development", chapter: 7, title: "Financial Data Storage", topics: ["securities master", "datasets", "storage formats", "historical data structure", "data accuracy", "automation"], application: "Store timestamped, versioned candles and instrument metadata with source and quality provenance." },
    { part: "III. Data Platform Development", chapter: 8, title: "Processing Financial Data", topics: ["market and instrument classification", "data frequency", "data sources", "cleaning", "continuous futures"], application: "Validate OHLCV, timestamps, missing bars, corporate actions, expiry and futures-roll treatment before research." },
    { part: "IV. Modelling", chapter: 9, title: "Statistical Learning", topics: ["prediction vs inference", "parametric vs non-parametric", "supervised vs unsupervised", "regression", "classification"], application: "Choose models for a defined target; compare simple baselines before complex models." },
    { part: "IV. Modelling", chapter: 10, title: "Time Series Analysis", topics: ["mean reversion", "ADF test", "stationarity", "Hurst exponent", "cointegration"], application: "Test whether a series or spread has the assumed statistical properties before deploying mean-reversion logic." },
    { part: "IV. Modelling", chapter: 11, title: "Forecasting", topics: ["hit rate", "confusion matrix", "factor choice", "logistic regression", "discriminant analysis", "SVM", "decision trees", "random forests", "PCA"], application: "Evaluate directional forecasts with out-of-sample metrics and class-aware diagnostics; do not equate hit rate with profitability." },
    { part: "V. Performance and Risk Management", chapter: 12, title: "Performance Measurement", topics: ["trade statistics", "returns", "risk/reward", "drawdown"], application: "Report expectancy, profit factor, average win/loss, exposure, drawdown depth and duration, and benchmark-relative results." },
    { part: "V. Performance and Risk Management", chapter: 13, title: "Risk and Money Management", topics: ["strategy risk", "portfolio risk", "counterparty risk", "operational risk", "Kelly criterion", "VaR"], application: "Apply position limits, portfolio exposure checks, loss limits and operational kill-switches; use fractional sizing conservatively." },
    { part: "VI. Automated Trading", chapter: 14, title: "Event-Driven Trading Engine Implementation", topics: ["event queue", "data handler", "strategy", "portfolio", "execution handler", "backtest"], application: "Model MARKET, SIGNAL, ORDER and FILL events; keep data, strategy, portfolio/risk and execution components independently testable." },
    { part: "VI. Automated Trading", chapter: 15, title: "Trading Strategy Implementation", topics: ["moving-average crossover", "index forecasting", "mean-reverting pairs", "performance plotting"], application: "Implement reproducible baseline strategies before adding the AI's SMC, options and multi-factor hypotheses." },
    { part: "VI. Automated Trading", chapter: 16, title: "Strategy Optimisation", topics: ["parameter optimisation", "overfitting", "model selection", "cross-validation", "grid search", "walk-forward discipline"], application: "Limit parameter search, preserve untouched test data, inspect parameter stability and prefer robust plateaus over isolated peaks." }
  ],
  mandatoryPrinciples: [
    "A backtest is an idealised estimate, not a promise of live performance.",
    "No future information may enter a decision at time t; signals must use only data available at that time.",
    "Avoid curve fitting: minimise free parameters and inspect sensitivity, not just the best result.",
    "Include brokerage, exchange fees, taxes, bid-ask spread, slippage and realistic fill assumptions where applicable.",
    "Use chronological training, validation and untouched out-of-sample testing; never randomly shuffle time-series observations.",
    "Measure drawdown and risk-adjusted performance, not only net profit or win rate.",
    "A strategy must be explainable, reproducible, monitored and capable of being disabled safely.",
    "Research findings must not silently modify live or paper-trading execution rules."
  ],
  IndiaAdaptation: {
    instruments: ["NSE cash equities", "NIFTY and BANK NIFTY indices", "NSE F&O options and futures", "MCX instruments only when validated data and contract specs are available"],
    localChecks: ["NSE/MCX trading calendar and session times", "lot-size and contract-specification history", "expiry and settlement rules", "STT, GST, exchange and regulatory charges", "brokerage, spread, liquidity and slippage", "instrument survivorship and symbol changes"],
    constraints: ["Paper trading only", "No broker order-placement capability", "No assumptions of historical options data when it is unavailable"]
  }
};

export function buildBookLearningPlan() {
  return {
    ...SUCCESSFUL_ALGORITHMIC_TRADING,
    curriculumVersion: 1,
    completedChapters: [],
    nextChapter: 1,
    learningMode: "night_research_and_daytime_paper_validation",
    completionRule: "A chapter is complete only after its concept is implemented or explicitly marked not applicable, tested, and recorded with evidence.",
    operationalRules: [
      "Night jobs may study historical data, run reproducible diagnostics and prepare research proposals.",
      "Night jobs must not create live orders, alter risk limits, or deploy unvalidated strategy changes.",
      "Daytime validation is paper-only and records predictions before outcomes are known.",
      "When source data is missing or unreliable, report unavailable rather than fabricate or infer values."
    ]
  };
}

export function evaluateBookResearchGate(candidate = {}) {
  const checks = [
    ["hypothesis_defined", Boolean(candidate.hypothesis), "A falsifiable hypothesis is required."],
    ["data_provenance", Boolean(candidate.dataSource && candidate.dataRange && candidate.dataQualityPassed), "Data source, date range and quality validation are required."],
    ["no_lookahead", candidate.noLookahead === true, "No-look-ahead validation must pass."],
    ["costs_modelled", candidate.costsModelled === true, "Transaction costs and slippage assumptions must be modelled."],
    ["chronological_oos", candidate.chronologicalSplit === true && candidate.outOfSampleTrades >= 30, "Require a chronological split and at least 30 out-of-sample trades."],
    ["robustness", candidate.robustnessPassed === true, "Parameter sensitivity and regime robustness must pass."],
    ["risk_review", candidate.riskReviewed === true, "Drawdown, exposure and operational risk review must pass."]
  ];
  const results = checks.map(([id, passed, reason]) => ({ id, passed, reason: passed ? null : reason }));
  const passed = results.every(x => x.passed);
  return {
    status: passed ? "research_gate_passed_for_paper_review" : "research_gate_rejected",
    passed,
    checks: results,
    executionPermission: "none",
    nextStep: passed ? "Eligible for a separately approved paper-only trial; not eligible for live deployment." : "Resolve failed checks and rerun the research process."
  };
}
