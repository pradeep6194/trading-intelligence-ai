(() => {
  "use strict";
  const titles = {
    overview: "Overview",
    classroom: "AI Classroom",
    markets: "Live Markets",
    options: "Options Intelligence",
    analysis: "Technical Lab",
    backtest: "Backtesting Lab",
    psychology: "Psychology Coach",
    paper: "Paper Trading",
    risk: "Risk Coach",
    journal: "Trade Journal",
    learning: "Market Learning",
    engineDesk: "AI Trading Engine",
    optionsDesk: "Option Scanner",
    setupDesk: "Setup & Health"
  };

  // Delegated navigation survives scripts that fail before binding individual tabs.
  document.addEventListener("click", event => {
    const nav = event.target.closest(".nav[data-page]");
    if (!nav) return;
    const pageId = nav.dataset.page;
    const page = document.getElementById(pageId);
    if (!page) return;

    document.querySelectorAll(".page").forEach(node => {
      node.classList.toggle("active", node === page);
    });
    document.querySelectorAll(".nav").forEach(node => {
      node.classList.toggle("active", node === nav);
    });
    const heading = document.getElementById("pageTitle");
    if (heading) heading.textContent = titles[pageId] || pageId;
    window.scrollTo({ top: 0, behavior: "auto" });
  });
})();
