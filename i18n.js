const EN=document.documentElement.lang.toLowerCase().startsWith("en");
const tr=(zh,en)=>EN?en:zh;

const EN_TEXT={
  pageTitle:"GPT Decision Lab · Model Configuration Selector",
  navModels:"Model & reasoning effort",
  navContext:"Context & cache cost",
  toolModelTag:"Tool 1 · Model routing",
  heading:"GPT Multidimensional Efficiency Selector",
  subtitle:"Start with a price budget to find the strongest configuration, then examine the trade-offs in latency and output tokens. The main recommendation, balanced alternative, and chart views each serve a distinct purpose.",
  scenarioLabel:"Scenario",
  scenarioCoding:"Coding · 5 benchmarks",
  scenarioKnowledge:"Knowledge work · 4 benchmarks",
  scenarioCombined:"Combined · 9 benchmarks",
  scenarioSingle:"Single benchmark",
  benchmarkLabel:"Single benchmark",
  budgetBasisLabel:"Budget basis",
  fairCost:"Fair cost index",
  rawCost:"Raw benchmark-suite cost",
  priceVersion:"Price version",
  priceAfter:"Adjusted (since Jul 30, 2026)",
  priceBefore:"Legacy (Jul 2026 prices)",
  resetAll:"Reset all",
  chartPrice:"Price vs. Ability",
  viewPrice:"Price",
  viewLatency:"Latency",
  viewCombined:"Combined",
  frontierInitial:"Green line = Price–Ability efficient boundary",
  currentBudget:"Current budget",
  adjustBudget:"Adjust budget",
  exactInput:"Exact input",
  chartHintInitial:"Dashed line = budget; black ring = main recommendation; orange ring = combined recommendation",
  recommendationTitle:"Current Budget Recommendations",
  balanceSettings:"Combined Balance Settings",
  maxAbilityLoss:"Maximum ability loss",
  resourceWeights:"Resource weights",
  weightTotalInitial:"Total 100%",
  resetWeights:"Reset weights",
  presetDefault:"Default balance",
  presetPrice:"Price first",
  presetSpeed:"Speed first",
  presetQuota:"Quota sensitive",
  weightPrice:"Price",
  weightLatency:"Latency",
  kpiCandidates:"Within-budget candidates",
  kpiCandidatesSub:"Price does not exceed the current budget",
  kpiAbility:"Current ability",
  tableTitle:"All Configurations and Boundary Status"
};

const EN_HTML={
  weightInfo:'<strong>1.00× = GPT-5.5 Medium; lower combined values use fewer resources.</strong> The calculation combines relative price, latency, and token ratios. Weights change the orange combined recommendation and, in the Combined view, move the points and green line. The top price budget still determines the main recommendation.',
  footer:'<strong>Main rule:</strong> Filter by price budget, then select the highest-ability configuration within budget. The combined recommendation also obeys the price budget and ability-loss limit, then finds the lowest resource burden under the selected price, latency, and token weights.<br><strong>Data:</strong> Cost, output tokens, and latency for all 9 benchmarks come from the supplied official SVGs. Resource values are reconstructed from point geometry and axis ticks to avoid rounded aria-label values becoming zero.<br><strong>Price version:</strong> The default “After Jul 30, 2026” scales Luna / Terra benchmark costs by the official 2026-07-30 price change (×0.2 / ×0.8; Sol unchanged). Choose “Legacy” to restore the July 2026 rates. The choice is remembered in the browser.'
};

const EN_ARIA={
  chartViewsAria:"Chart view",
  decreaseBudget:"Decrease budget",
  increaseBudget:"Increase budget"
};

if(EN){
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const value=EN_TEXT[el.dataset.i18n];
    if(value!==undefined)el.textContent=value;
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el=>{
    const value=EN_HTML[el.dataset.i18nHtml];
    if(value!==undefined)el.innerHTML=value;
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(el=>{
    const value=EN_ARIA[el.dataset.i18nAria];
    if(value!==undefined)el.setAttribute("aria-label",value);
  });
}

const languageSwitch=document.querySelector("#languageSwitch");
const navModels=document.querySelector("#navModels");
const navContext=document.querySelector("#navContext");
if(EN){
  languageSwitch.textContent="中文";
  languageSwitch.href="index.html";
  navModels.href="index.html?lang=en";
  navContext.href="context-cost.html?lang=en";
}else{
  languageSwitch.textContent="English";
  languageSwitch.href="?lang=en";
  navModels.href="index.html";
  navContext.href="context-cost.html";
}
