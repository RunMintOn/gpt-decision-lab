const CONTEXT_EN=document.documentElement.lang.toLowerCase().startsWith("en");
const CONTEXT_TEXT={
  pageTitle:"GPT Decision Lab · Context & Cache Cost",
  navModels:"Model & reasoning effort",navContext:"Context & cache cost",toolTag:"Tool 2 · Context economics",
  heading:"Context and cache cost simulator",
  model:"Model",turns:"Total turns",maxContext:"Final prompt input tokens",startContext:"First-request prompt input tokens",
  newInput:"New uncached input per turn",output:"Output tokens per turn",failures:"Number of disaster requests",bias:"Disaster-position bias",
  uniform:"Uniform random",early:"Early-biased",middle:"Middle-biased",late:"Late-biased",sims:"Monte Carlo runs",seed:"Random seed",pricing:"Pricing tier",
  reroll:"Draw another sample",reset:"Reset",failureRate:"Disaster rate",failureRateSub:"Fixed count ÷ total turns",
  growth:"Prompt growth per turn",growthSub:"Derived from first, final, and total turns",lastCost:"Last-request cost",lastCostSub:"Baseline / Monte Carlo expectation",
  totalCost:"Cumulative total cost",totalCostSub:"Baseline / Monte Carlo expectation",extraCost:"Extra disaster cost",extraCostSub:"Mean and 10–90% interval",
  singleTitle:"Per-request cost vs prompt input tokens",brokenAxis:"Broken axis: normal trend and disaster spikes separated",
  idealPrefix:"Ideal prefix reuse (no full-prefix disaster)",expectedSingle:"Expected per-request cost with a fixed number of random disasters",
  sampleDisasters:"Disaster positions and rebuild costs in one sample",singleNote:"The lower panel zooms into normal request cost. The upper panel shows full cache-rebuild cost for disaster requests. Red dashed stems preserve the matching prompt position.",
  cumTitle:"Cumulative cost vs prompt input tokens",band:"Blue band = 10–90% random interval",baseline:"No-disaster baseline",sampleCum:"Cumulative cost for one sample",
  cumNote:"The cumulative chart keeps the no-disaster baseline, one random path, and the 10–90% interval. A pointwise mean path is omitted because it is not an actually realizable conversation path.",
  biasCompare:"Early / middle / late / uniform disaster bias"
};
const CONTEXT_HTML={
  subtitle:'The x-axis is the current request’s <strong>prompt input tokens</strong>. Under ideal prefix reuse, the history shared with the previous request remains cached. A fixed number of “disaster requests” invalidate the entire prefix and rebuild it from zero at cache-write rates.',
  footer:'<strong>Model:</strong> The first request has no reusable history and is charged as a full cache write, but it is not counted as a disaster. Disaster turns are sampled without replacement from turns 2 through the end; normal prefix reuse resumes on the next request.<br><strong>Pricing:</strong> Defaults to GPT-5.6 Standard API input, cached-input, cache-write, and output rates. The current official rule still switches the full request to long-context pricing above 272K input tokens. Pricing verified 2026-07-18. Values are API-equivalent costs, not Plus/Codex subscription deductions.'
};
if(CONTEXT_EN){
  document.title=CONTEXT_TEXT.pageTitle;
  document.querySelectorAll("[data-i18n]").forEach(el=>{const v=CONTEXT_TEXT[el.dataset.i18n];if(v!==undefined)el.textContent=v});
  document.querySelectorAll("[data-i18n-html]").forEach(el=>{const v=CONTEXT_HTML[el.dataset.i18nHtml];if(v!==undefined)el.innerHTML=v});
}
