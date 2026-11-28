// Chapter-by-chapter learning state and assessment engine for Successful Algorithmic Trading.
// Lessons are concise original study notes mapped to the uploaded book's chapter structure.
// This module stores mastery evidence; it does not train model weights.
import { SUCCESSFUL_ALGORITHMIC_TRADING } from "./book-learning.js";

const questions = {
  1: [
    { q:"What is the book's central practical objective?", options:["Build robust algorithmic systems from research through execution","Predict every market turn","Replace all risk controls with AI","Optimise indicators until the backtest is profitable"], answer:0, explain:"The book is about creating robust automated systems, including data, backtesting and execution." },
    { q:"Which prerequisite does the book assume?", options:["No trading or programming experience","Basic trading familiarity and elementary programming concepts","Advanced PhD mathematics","A professional exchange membership"], answer:1, explain:"The introduction assumes basic trading familiarity and elementary programming knowledge." }
  ],
  2: [
    { q:"In the book's definition, what makes a strategy algorithmic?", options:["A human confirms every signal","Trades follow pre-designed rules without discretionary intervention","It uses at least five indicators","It trades only at high frequency"], answer:1, explain:"The strategy is designed before trading and executed according to predetermined rules." },
    { q:"What is one key benefit of systematic trading discussed in the chapter?", options:["It guarantees profits","It removes market risk","Historical performance can be assessed through backtesting","It eliminates the need for monitoring"], answer:2, explain:"Backtesting enables historical assessment; it does not guarantee future returns." }
  ],
  3: [
    { q:"A strategy uses tomorrow's closing price to decide today's trade. Which bias is present?", options:["Survivorship bias","Look-ahead bias","Execution latency","Market impact"], answer:1, explain:"Look-ahead bias occurs when information unavailable at decision time enters the test." },
    { q:"Why should transaction costs be included in a backtest?", options:["They increase the number of trades","They make the equity curve smoother","They approximate the friction between theoretical and realised performance","They remove all model risk"], answer:2, explain:"Costs, spread and slippage can materially reduce realised strategy returns." }
  ],
  4: [
    { q:"What is a key distinction of an event-driven backtester?", options:["It processes market and order events through system components","It ignores order state","It only calculates monthly returns","It assumes every order fills instantly"], answer:0, explain:"An event-driven design models the sequence of market, signal, order and fill events." },
    { q:"Why does execution latency matter?", options:["It changes historical prices","It can change the fill price or whether an order fills","It guarantees better queue position","It removes brokerage"], answer:1, explain:"Delay can affect price, fill probability and execution quality." }
  ],
  5: [
    { q:"What should happen to a strategy idea before implementation?", options:["Immediately optimise its parameters","Write a testable hypothesis and define evaluation criteria","Deploy with minimum capital","Choose the best-looking chart"], answer:1, explain:"A disciplined strategy pipeline evaluates ideas against explicit criteria." },
    { q:"Why document the origin and rationale of an idea?", options:["To make it impossible to reject","To preserve traceability and reduce hindsight-driven changes","To increase leverage","To avoid collecting data"], answer:1, explain:"Traceability makes research reproducible and helps distinguish evidence from narrative." }
  ],
  6: [
    { q:"Why use a reproducible software environment?", options:["To ensure code and dependencies can be recreated and tested","To guarantee a profitable strategy","To avoid version control","To replace data validation"], answer:0, explain:"Reproducible environments reduce software drift and make research repeatable." },
    { q:"The book's Python examples use older versions. What is the safe modernisation approach?", options:["Assume all old APIs still work","Port carefully, pin dependencies and test behaviour","Delete tests","Change outputs until they look plausible"], answer:1, explain:"Legacy examples need deliberate adaptation and verification in the current stack." }
  ],
  7: [
    { q:"What metadata should a historical market record retain?", options:["Only the latest price","Timestamp, instrument identity, source and data provenance","Only a chart image","Only the strategy signal"], answer:1, explain:"Accurate storage requires time, instrument and provenance context." },
    { q:"Why maintain an instrument master?", options:["To map symbols and contract specifications over time","To predict tomorrow's return","To remove missing candles","To calculate sentiment"], answer:0, explain:"Instrument identity and changing specifications are essential for valid historical research." }
  ],
  8: [
    { q:"What should a data-quality check detect?", options:["Missing or duplicated bars and invalid OHLC relationships","Only profitable days","Only high-volume candles","Only bullish signals"], answer:0, explain:"Bad timestamps, gaps and inconsistent OHLCV can corrupt all later analysis." },
    { q:"Why are futures roll rules important?", options:["They make every futures series identical","Contract expiry and roll adjustments can create artificial price behaviour","They eliminate slippage","They guarantee continuous liquidity"], answer:1, explain:"A continuous futures series needs explicit treatment of expiry and contract transitions." }
  ],
  9: [
    { q:"What is the difference between prediction and inference?", options:["Prediction estimates unknown outcomes; inference explains relationships or effects","They are always identical","Inference requires no data","Prediction guarantees causality"], answer:0, explain:"The modelling objective determines whether forecasting or explaining relationships is primary." },
    { q:"Which is a supervised-learning task?", options:["Clustering unlabelled observations","Classifying examples with known outcome labels","Compressing data without labels","Randomly shuffling prices"], answer:1, explain:"Supervised learning uses labelled examples such as defined future-return classes." }
  ],
  10: [
    { q:"Why test stationarity before applying some time-series methods?", options:["Their assumptions may require stable statistical properties over time","It guarantees mean reversion","It removes transaction costs","It increases sample size"], answer:0, explain:"Non-stationary series can invalidate inference from methods that assume stationarity." },
    { q:"What does cointegration investigate?", options:["Whether two non-stationary series share a stable long-run relationship","Whether two assets have equal prices","Whether volatility is zero","Whether all returns are normally distributed"], answer:0, explain:"Cointegration concerns a stationary combination or long-run equilibrium relationship." }
  ],
  11: [
    { q:"Why is hit rate alone insufficient to evaluate a forecast-driven strategy?", options:["It ignores payoff size, costs and risk","It always equals Sharpe ratio","It measures drawdown exactly","It includes slippage automatically"], answer:0, explain:"A high win rate can still lose money if losses are larger or costs are high." },
    { q:"What does a confusion matrix help evaluate?", options:["Classification outcomes by actual and predicted classes","Brokerage charges","Order queue priority","Futures expiry"], answer:0, explain:"It breaks classification predictions into true/false positives and negatives." }
  ],
  12: [
    { q:"What does maximum drawdown measure?", options:["Largest peak-to-trough decline in portfolio value","Average winning trade","Number of signals","Average holding time"], answer:0, explain:"Drawdown measures loss from a prior equity peak to a subsequent trough." },
    { q:"Why examine expectancy?", options:["It estimates average outcome per trade using win/loss probabilities and payoffs","It guarantees the next trade","It measures only win rate","It ignores losing trades"], answer:0, explain:"Expectancy combines the frequency and magnitude of wins and losses." }
  ],
  13: [
    { q:"What should determine position size?", options:["Predefined risk limits and the distance to invalidation/stop","Confidence alone","Recent winning streak","Maximum available leverage"], answer:0, explain:"Position sizing should link exposure to risk, not emotional conviction." },
    { q:"Which is an operational risk control?", options:["A kill switch and monitoring for failed orders or stale data","Increasing leverage after losses","Ignoring disconnects","Removing logs"], answer:0, explain:"Operational controls detect and contain system failures." }
  ],
  14: [
    { q:"Which sequence best represents a simple event-driven trading flow?", options:["Market data → signal → order → fill","Fill → market data → signal → order","Signal → fill → market data → order","Order → signal → fill → market data"], answer:0, explain:"Market data is processed into a signal, then an order is submitted and a fill is received." },
    { q:"Why separate strategy, portfolio/risk and execution components?", options:["To isolate responsibilities and test them independently","To allow each to use different future data","To remove the need for order states","To guarantee execution"], answer:0, explain:"Modular components improve testability and reduce hidden coupling." }
  ],
  15: [
    { q:"Why implement simple baseline strategies first?", options:["To establish a reproducible benchmark before adding complexity","Because simple strategies always win","To avoid out-of-sample testing","To skip transaction costs"], answer:0, explain:"Baselines help determine whether added complexity provides genuine incremental value." },
    { q:"What must be specified for a strategy to be reproducible?", options:["Entry, exit, sizing, timing and execution assumptions","Only its name","Only its best trade","Only a screenshot"], answer:0, explain:"A strategy needs unambiguous rules and assumptions to be independently reproduced." }
  ],
  16: [
    { q:"What is the main danger of parameter optimisation?", options:["Overfitting in-sample data and poor out-of-sample performance","It always reduces computation","It removes model selection","It guarantees robustness"], answer:0, explain:"A parameter set can fit historical noise and fail on unseen data." },
    { q:"What is the purpose of keeping out-of-sample data untouched?", options:["To provide a less biased final evaluation after model selection","To tune parameters more aggressively","To increase in-sample accuracy","To remove the need for validation"], answer:0, explain:"Untouched data helps estimate how a selected strategy may generalise." }
  ]
};

const practicalTasks = {
  1:"Write the full research-to-execution lifecycle your AI should follow, naming data, strategy, backtest, risk, execution and monitoring stages.",
  2:"Write one falsifiable trading hypothesis with instrument, timeframe, entry, exit and measurable outcome.",
  3:"List look-ahead, survivorship and optimisation bias examples; specify costs and slippage to include in one backtest.",
  4:"Draw the event sequence from market data to fill and describe how a rejected or partially filled order is handled.",
  5:"Create a strategy-idea record with rationale, data needed, acceptance criteria and explicit rejection criteria.",
  6:"Record the runtime version, dependency versions and test command needed to reproduce one research run.",
  7:"Design a historical candle schema containing timestamp, instrument key, OHLCV, source and quality flags.",
  8:"Define validation rules for missing bars, duplicate timestamps, invalid OHLC and futures expiry/roll handling.",
  9:"Choose a prediction target and explain whether it is regression or classification, supervised or unsupervised.",
  10:"Specify a stationarity or cointegration test and the conditions under which a mean-reversion hypothesis is rejected.",
  11:"Define a forecast evaluation using confusion matrix plus payoff-aware trading metrics.",
  12:"Calculate win rate, average win, average loss, expectancy and maximum drawdown from a sample trade log.",
  13:"Write position sizing, daily loss, exposure and operational kill-switch rules for a paper strategy.",
  14:"Map data handler, event queue, strategy, portfolio/risk and execution handler responsibilities.",
  15:"Implement or specify a baseline strategy with fully deterministic entry, exit and sizing rules.",
  16:"Define chronological train/validation/test windows and a parameter-stability test that avoids tuning on the final test set."
};

export function createBookLearningState(existing={}) {
  return {
    version:1,
    currentChapter:Number(existing.currentChapter)||1,
    chapters:existing.chapters||{},
    attempts:existing.attempts||[],
    createdAt:existing.createdAt||Date.now(),
    updatedAt:Date.now(),
    mode:"chapter_by_chapter",
    paperOnly:true
  };
}
export function getBookLearningSession(existing={}) {
  const state=createBookLearningState(existing);
  const chapter=SUCCESSFUL_ALGORITHMIC_TRADING.chapters.find(c=>c.chapter===state.currentChapter)||SUCCESSFUL_ALGORITHMIC_TRADING.chapters[0];
  const prior=state.chapters[chapter.chapter]||{};
  return {
    state,
    curriculum:{id:SUCCESSFUL_ALGORITHMIC_TRADING.id,title:SUCCESSFUL_ALGORITHMIC_TRADING.title,author:SUCCESSFUL_ALGORITHMIC_TRADING.author,totalChapters:16},
    chapter:{...chapter,lesson:lessonFor(chapter),practicalTask:practicalTasks[chapter.chapter],assessment:questions[chapter.chapter].map(({q,options})=>({question:q,options}))},
    progress:{completed:Object.values(state.chapters).filter(x=>x.status==="completed").length,learned:Object.values(state.chapters).filter(x=>x.status==="learned").length,current:chapter.chapter,status:prior.status||"not_started"},
    lastAttempt:state.attempts.at(-1)||null
  };
}
function lessonFor(c) {
  return {
    objective:c.application,
    keyConcepts:c.topics,
    studyNotes:[
      "Problem: identify the specific research or engineering question this chapter addresses.",
      "Method: define assumptions, inputs, transformations and measurable outputs before implementation.",
      "Validation: test the method on appropriate evidence and document limitations.",
      "Trading AI rule: "+c.application
    ]
  };
}
export function submitBookAssessment(existing={},answers=[]) {
  const state=createBookLearningState(existing), chapter=state.currentChapter, bank=questions[chapter];
  if(!Array.isArray(answers)||answers.length!==bank.length) throw new Error("Submit one answer for every assessment question.");
  const results=bank.map((item,i)=>({question:i+1,correct:Number(answers[i])===item.answer,selected:Number(answers[i]),correctAnswer:item.answer,explanation:item.explain}));
  const score=results.filter(x=>x.correct).length, passed=score/bank.length>=0.8;
  const previous=state.chapters[chapter]||{};
  state.chapters[chapter]={...previous,status:passed?"learned":"in_progress",quizScore:score,quizTotal:bank.length,passed,lastAssessedAt:Date.now(),taskEvidence:previous.taskEvidence||null};
  state.attempts.push({chapter,score,total:bank.length,passed,at:Date.now()});
  if(state.attempts.length>200)state.attempts=state.attempts.slice(-200);
  state.updatedAt=Date.now();
  return {state,results,passed,score,total:bank.length,passMark:"80%",message:passed?"Theory assessment passed. Submit practical-task evidence to complete this chapter.":"Assessment not passed. Review the lesson and retry; chapter remains incomplete."};
}
export function submitBookTaskEvidence(existing={},evidence="") {
  const state=createBookLearningState(existing), chapter=state.currentChapter;
  const text=String(evidence||"").trim();
  if(text.length<20)throw new Error("Provide at least 20 characters describing the completed practical task and its evidence.");
  const record=state.chapters[chapter]||{};
  if(!record.passed)throw new Error("Pass the chapter assessment before submitting practical-task evidence.");
  state.chapters[chapter]={...record,status:"completed",taskEvidence:text.slice(0,2000),taskCompletedAt:Date.now()};
  state.currentChapter=Math.min(16,chapter+1);
  state.updatedAt=Date.now();
  return {state,completedChapter:chapter,nextChapter:state.currentChapter,courseCompleted:chapter===16};
}
export function resetBookChapter(existing={},chapterNumber) {
  const state=createBookLearningState(existing), n=Number(chapterNumber);
  if(!Number.isInteger(n)||n<1||n>16)throw new Error("Chapter must be between 1 and 16.");
  state.currentChapter=n;state.updatedAt=Date.now();return state;
}
