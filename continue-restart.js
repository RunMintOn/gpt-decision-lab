(function(){
  const root=document.getElementById("continueRestartRoot");
  if(!root)return;

  const WINDOW=272000;
  const OBSERVED={score:5.5,calls:72,growth:92700,baseline:45000};
  const isEn=()=>document.documentElement.lang.toLowerCase().startsWith("en");
  const tx=(zh,en)=>isEn()?en:zh;
  const q=s=>root.querySelector(s);
  const money=v=>"$"+Number(v).toLocaleString("en-US",{minimumFractionDigits:v<.1?4:2,maximumFractionDigits:v<.1?4:2});
  const pct=v=>(100*v/WINDOW).toFixed(1)+"%";
  const ktok=v=>`${(v/1000).toFixed(v<100000?1:0)}K`;
  const num=(sel,fallback=0)=>{const el=q(sel),v=+(el?.value);return Number.isFinite(v)?v:fallback};
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

  function info(text){return `<button class="cr-info" type="button" aria-label="info">i</button><div class="cr-help">${text}</div>`}

  function moduleHtml(){
    root.innerHTML=`
      <div class="head cr-head">
        <div>
          <h2>${tx("做到这里：继续当前对话，还是整理后重开？","At this point: continue, or restart from a smaller context?")}</h2>
          <div class="cr-intro">${tx("这张图把 272K 作为 100% 的成本基准窗口。你只需要判断两件事：当前上下文已经用了多少、下一个功能大概有多大。模型调用次数仍参与底层计算，但不要求你自己估算。","This view treats 272K as the 100% cost-reference window. You only estimate two things: how full the current context is, and roughly how large the next feature is. Model-call count still drives the calculation, but you do not have to enter it yourself.")}</div>
        </div>
        <div class="cr-presetRow"><button id="crObserved" class="cr-preset">${tx("套用真实纯开发参考","Use observed pure-dev reference")}</button></div>
      </div>

      <div class="body">
        <div class="cr-primaryControls">
          <div class="cr-sliderCard">
            <div class="cr-labelRow"><label for="crCurrentPct">${tx("当前上下文占 272K 的比例","Current context as % of 272K")}</label>${info(tx("这是用户最直观的决策变量。40% 就是约 108.8K Prompt input tokens。这里的 272K 是成本基准窗口，不是模型最大 context window。","This is the most intuitive decision variable. 40% is about 108.8K prompt input tokens. 272K is the pricing reference window here, not the model's maximum context window."))}</div>
            <div class="cr-rangeRow"><input id="crCurrentPct" type="range" min="0" max="100" step="1" value="40"><output id="crCurrentPctOut">40%</output></div>
            <div class="cr-under" id="crCurrentTokens">≈ 108.8K tokens</div>
          </div>

          <div class="cr-sliderCard">
            <div class="cr-labelRow"><label for="crWorkload">${tx("下一个功能工作量","Next feature workload")}</label>${info(tx("这是主观工作量刻度，不是模型能力评分。5–6 分有一条真实纯开发记录做锚点：约 72 次 model calls，Prompt 从 45K 增长到约 137.7K，即新增约 92.7K。其他分数目前按这个锚点做透明的线性估算。","This is a subjective workload scale, not a model-quality score. A real pure-development trace anchors 5–6: about 72 model calls and prompt growth from 45K to about 137.7K, or +92.7K. Other scores currently scale linearly from that anchor."))}</div>
            <div class="cr-rangeRow"><input id="crWorkload" type="range" min="1" max="10" step="0.5" value="5.5"><output id="crWorkloadOut">5.5 / 10</output></div>
            <div class="cr-under" id="crWorkloadText">—</div>
          </div>
        </div>

        <div class="cr-anchor">
          <strong>${tx("真实参考：纯开发 · 无用户介入","Observed reference: pure development · no user intervention")}</strong>
          <span>${tx("Compact 后约 45K（16.5%）→ 72 calls → 约 137.7K（50.6%）；新增约 92.7K。缓存处于理想前缀复用状态，没有灾难性整段失效。","After compact: ~45K (16.5%) → 72 calls → ~137.7K (50.6%); +92.7K. Prefix reuse was effectively ideal, with no catastrophic full-prefix loss.")}</span>
        </div>

        <div class="cr-results">
          <div id="crDecision" class="cr-result cr-decision"><span>${tx("当前条件下的机器成本结论","Machine-cost result for this scenario")}</span><b>—</b><small>—</small></div>
          <div class="cr-result"><span>${tx("当前上下文临界位置","Current-context threshold")}</span><b id="crThreshold">—</b><small>${tx("高于这里时，整理后重开开始更省","Above this point, restart becomes cheaper")}</small></div>
          <div class="cr-result"><span>${tx("继续：预计做到","Continue: projected ending")}</span><b id="crContinueEnd">—</b><small id="crContinueCost">—</small></div>
          <div class="cr-result"><span>${tx("重开：预计做到","Restart: projected ending")}</span><b id="crRestartEnd">—</b><small id="crRestartCost">—</small></div>
          <div class="cr-result"><span>${tx("底层调用参考","Underlying call estimate")}</span><b id="crCalls">—</b><small>${tx("用于计算，不要求用户填写","Shown for reference; not user-entered")}</small></div>
        </div>

        <div class="cr-chartTitle">
          <div><strong>${tx("同样一个功能：从不同上下文位置开始，哪条路径更省？","Same feature, different starting context: which path is cheaper?")}</strong><span>${tx("横轴 = 开始开发前的上下文占比；纵轴 = 把这个功能做完的预计累计 API 成本。","X-axis = context fullness before starting the feature; Y-axis = estimated cumulative API cost to finish it.")}</span></div>
        </div>
        <div class="cr-chartbox"><svg id="crChart" viewBox="0 0 1120 600"></svg></div>
        <div class="cr-legend">
          <span><i class="cr-line" style="background:#d65268"></i>${tx("继续当前对话","Continue current context")}</span>
          <span><i class="cr-line" style="background:#0b9b78"></i>${tx("整理后重开 / Compact","Restart / compact to smaller context")}</span>
          <span><i class="cr-line" style="background:#8057c5"></i>${tx("当前选择","Your current position")}</span>
        </div>

        <details class="cr-advanced">
          <summary>${tx("高级假设","Advanced assumptions")}</summary>
          <div class="cr-controls">
            <div class="cr-field">
              <div class="cr-labelRow"><label for="crRestartPct">${tx("整理后 / 重开 baseline","Post-restart baseline")}</label>${info(tx("默认采用真实 trace 的 45K，即 272K 的 16.5%。它代表摘要、计划、仓库状态、关键文件等恢复完毕后，新工作段第一轮要携带的 Prompt。","Defaults to the observed 45K, or 16.5% of 272K. It represents the first prompt after restoring summary, plan, repository state and key files."))}</div>
              <div class="cr-rangeRow compact"><input id="crRestartPct" type="range" min="5" max="60" step="0.5" value="16.5"><output id="crRestartPctOut">16.5%</output></div>
            </div>
            <div class="cr-field">
              <div class="cr-labelRow"><label for="crFixed">${tx("额外固定 System / Tool prefix","Extra fixed System / Tool prefix")}</label>${info(tx("System prompt 和 tool definitions 可以量化。如果 baseline 已经包含这些内容，就保持 0，避免重复计算；只有你能单独测出且 baseline 不含它们时才填写。","System prompts and tool definitions are measurable. Leave this at 0 when the baseline already includes them; only enter a value when you can measure them separately and the baseline excludes them."))}</div>
              <input id="crFixed" type="number" value="0" min="0" step="100">
            </div>
            <div class="cr-field">
              <div class="cr-labelRow"><label for="crFriction">${tx("重开对齐摩擦（等效额外 calls）","Restart friction (equivalent extra calls)")}</label>${info(tx("如果重开后通常需要额外几次调用来重新定位、确认计划，可以在这里加进去。默认 0，不把人的脑力成本硬换算成美元。","If a restart usually needs a few extra calls to regain orientation and confirm the plan, add them here. Default is 0; human effort is not arbitrarily converted to dollars."))}</div>
              <input id="crFriction" type="number" value="0" min="0" max="50" step="1">
            </div>
          </div>
        </details>

        <div class="cr-explain">
          <div class="cr-explainCard" id="crWhyContext"></div>
          <div class="cr-explainCard" id="crWhyCalls"></div>
        </div>
        <div class="cr-assumption">${tx("估算口径：功能工作量 5.5/10 以真实纯开发 trace 为锚点（72 calls、+92.7K Prompt）；其他工作量暂按线性比例估计。底层仍逐 call 计算历史缓存读取、新增输入和输出成本，并沿用本页选择的模型与价格。这个工作量刻度是决策辅助，不是经验定律。","Estimation basis: workload 5.5/10 is anchored to the observed pure-development trace (72 calls, +92.7K prompt). Other workload levels currently scale linearly. The engine still calculates cached-history reads, fresh input and output call by call using the selected model and pricing. This workload scale is a decision aid, not an empirical law.")}</div>
      </div>`;
  }

  function currentModel(){return document.getElementById("model")?.value||"Sol"}
  function currentPricing(){return document.getElementById("pricing")?.value||"standard"}
  function currentOutput(){return Math.max(0,+(document.getElementById("output")?.value||0))}

  function crRates(context){
    if(typeof rates==="function")return rates(context,currentModel(),currentPricing());
    return {input:1,cache:.1,write:1.25,output:6};
  }

  function workloadEstimate(score){
    const scale=score/OBSERVED.score;
    return {
      score,
      calls:Math.max(1,Math.round(OBSERVED.calls*scale)),
      growth:OBSERVED.growth*scale
    };
  }

  function normalRequestCost(context,fresh,output){
    const r=crRates(context),f=Math.min(Math.max(0,fresh),context),history=Math.max(0,context-f);
    return (history*r.cache+f*r.input+output*r.output)/1e6;
  }

  function restartFirstCost(totalContext,fixedPrefix,workingSet,output){
    const r=crRates(totalContext),fixed=Math.min(Math.max(0,fixedPrefix),totalContext),dynamic=Math.max(0,workingSet);
    return (fixed*r.cache+dynamic*r.write+output*r.output)/1e6;
  }

  function featureCost(startContext,est,{restart=false,baseline=OBSERVED.baseline,fixed=0,friction=0}={}){
    const output=currentOutput();
    const productiveCalls=est.calls;
    const perCallGrowth=est.growth/Math.max(1,productiveCalls-1);
    let cum=0,context=startContext;

    if(restart){
      const working=Math.max(1,baseline);
      context=working+fixed;
      cum+=restartFirstCost(context,fixed,working,output);
      for(let f=0;f<friction;f++){
        context+=perCallGrowth;
        cum+=normalRequestCost(context,perCallGrowth,output);
      }
      for(let k=2;k<=productiveCalls;k++){
        context+=perCallGrowth;
        cum+=normalRequestCost(context,perCallGrowth,output);
      }
    }else{
      for(let k=1;k<=productiveCalls;k++){
        const fresh=k===1?perCallGrowth:perCallGrowth;
        cum+=normalRequestCost(context,fresh,output);
        if(k<productiveCalls)context+=perCallGrowth;
      }
    }
    return {cost:cum,endContext:context,calls:productiveCalls+(restart?friction:0),perCallGrowth};
  }

  function scenario(){
    const currentPct=clamp(num("#crCurrentPct",40),0,100);
    const score=clamp(num("#crWorkload",5.5),1,10);
    const baselinePct=clamp(num("#crRestartPct",16.5),5,60);
    const fixed=Math.max(0,num("#crFixed",0));
    const friction=Math.max(0,Math.floor(num("#crFriction",0)));
    const est=workloadEstimate(score);
    const current=currentPct/100*WINDOW;
    const baseline=baselinePct/100*WINDOW;
    const cont=featureCost(current,est);
    const restart=featureCost(current,est,{restart:true,baseline,fixed,friction});
    return {currentPct,current,score,baselinePct,baseline,fixed,friction,est,cont,restart};
  }

  function thresholdFor(s){
    const restartCost=s.restart.cost;
    let first=null;
    const rows=[];
    for(let p=0;p<=100;p+=1){
      const start=p/100*WINDOW;
      const cont=featureCost(start,s.est);
      rows.push({p,continueCost:cont.cost,restartCost});
      if(first===null&&restartCost<=cont.cost)first=p;
    }
    return {first,rows};
  }

  function render(){
    const s=scenario(),th=thresholdFor(s);
    q("#crCurrentPctOut").textContent=`${s.currentPct.toFixed(0)}%`;
    q("#crCurrentTokens").textContent=`≈ ${ktok(s.current)} tokens`;
    q("#crWorkloadOut").textContent=`${s.score.toFixed(1)} / 10`;
    q("#crRestartPctOut").textContent=`${s.baselinePct.toFixed(1)}%`;
    q("#crWorkloadText").textContent=tx(`底层参考：约 ${s.est.calls} 次 model calls · 预计新增约 ${ktok(s.est.growth)} Prompt`,`Underlying reference: ~${s.est.calls} model calls · about +${ktok(s.est.growth)} prompt`);

    const savings=s.cont.cost-s.restart.cost,restartWins=savings>0;
    const decision=q("#crDecision");
    decision.classList.toggle("restart",restartWins);
    decision.querySelector("b").textContent=restartWins?tx("整理后重开更省","Restart is cheaper"):tx("继续当前对话更省","Continuing is cheaper");
    decision.querySelector("small").textContent=restartWins?tx(`按当前 ${s.currentPct.toFixed(0)}% 和工作量 ${s.score.toFixed(1)}/10，预计机器成本少 ${money(savings)}。`,`At ${s.currentPct.toFixed(0)}% current context and workload ${s.score.toFixed(1)}/10, estimated machine cost is lower by ${money(savings)}.`):tx(`按当前条件，重开的恢复成本还高于继续携带当前上下文的成本。`,`Under the current assumptions, restart recovery still costs more than carrying the current context.`);

    if(th.first===null)q("#crThreshold").textContent=tx("0–100% 内都不划算","Not cheaper within 0–100%");
    else if(th.first===0)q("#crThreshold").textContent=tx("几乎从一开始就更省","Cheaper almost immediately");
    else q("#crThreshold").textContent=tx(`约 ${th.first}%（${ktok(th.first/100*WINDOW)}）`,`~${th.first}% (${ktok(th.first/100*WINDOW)})`);

    q("#crContinueEnd").textContent=`${pct(s.cont.endContext)} · ${ktok(s.cont.endContext)}`;
    q("#crContinueCost").textContent=tx(`预计成本 ${money(s.cont.cost)}`,`Estimated cost ${money(s.cont.cost)}`);
    q("#crRestartEnd").textContent=`${pct(s.restart.endContext)} · ${ktok(s.restart.endContext)}`;
    q("#crRestartCost").textContent=tx(`预计成本 ${money(s.restart.cost)}`,`Estimated cost ${money(s.restart.cost)}`);
    q("#crCalls").textContent=`≈ ${s.est.calls} calls`;

    const repeated=Math.max(0,s.current-(s.baseline+s.fixed))*s.est.calls;
    q("#crWhyContext").innerHTML=`<strong>${tx("为什么先看上下文占比？","Why start with context fullness?")}</strong><br>${tx(`你现在在 ${s.currentPct.toFixed(0)}%（${ktok(s.current)}）。如果直接继续，同一个旧历史会被后续调用反复读取；而整理后从约 ${s.baselinePct.toFixed(1)}% 的较小工作集重新开始。`,`You are currently at ${s.currentPct.toFixed(0)}% (${ktok(s.current)}). If you continue, the same old history is repeatedly read by later calls; restarting begins from a smaller working set around ${s.baselinePct.toFixed(1)}%.`)}`;
    q("#crWhyCalls").innerHTML=`<strong>${tx("为什么还要显示 model calls？","Why still show model calls?")}</strong><br>${tx(`用户不用填写，但成本底层离不开它。当前工作量被估计为约 ${s.est.calls} calls；按当前起点，相比较小 baseline，旧路径粗略会额外重复携带约 ${ktok(repeated)} 历史 token-read。这个数字只是解释成本为何会被放大。`,`You do not enter it, but the cost model still needs it. This workload maps to about ${s.est.calls} calls; from the current starting point, the old path roughly carries an extra ${ktok(repeated)} historical token-reads versus the smaller baseline. This is shown only to explain the amplification.`)}`;

    draw(s,th);
  }

  function draw(s,th){
    const svg=q("#crChart"),W=1120,H=600,L=78,R=34,T=34,B=82,pw=W-L-R,ph=H-T-B;
    const maxY=Math.max(...th.rows.map(r=>Math.max(r.continueCost,r.restartCost)))*1.08||1;
    const x=p=>L+(p/100)*pw,y=v=>T+(1-v/maxY)*ph;
    let out="";

    for(let i=0;i<=5;i++){
      const p=i*20,xx=x(p),tok=p/100*WINDOW;
      out+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="#edf0f4"/>`;
      out+=`<text x="${xx}" y="${H-42}" text-anchor="middle" font-size="12" fill="#5f6b7c">${p}%</text>`;
      out+=`<text x="${xx}" y="${H-26}" text-anchor="middle" font-size="10.5" fill="#98a1b1">${Math.round(tok/1000)}K</text>`;
    }
    for(let i=0;i<=5;i++){
      const v=maxY*i/5,yy=y(v);
      out+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#edf0f4"/>`;
      out+=`<text x="${L-10}" y="${yy+4}" text-anchor="end" font-size="11" fill="#748095">$${v.toFixed(maxY<1?3:2)}</text>`;
    }

    out+=`<polyline fill="none" stroke="#d65268" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="${th.rows.map(r=>`${x(r.p)},${y(r.continueCost)}`).join(" ")}"/>`;
    out+=`<polyline fill="none" stroke="#0b9b78" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="${th.rows.map(r=>`${x(r.p)},${y(r.restartCost)}`).join(" ")}"/>`;

    if(th.first!==null&&th.first>0){
      const xx=x(th.first);
      out+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="#7c8798" stroke-width="1.5" stroke-dasharray="6 6"/>`;
      out+=`<text x="${Math.min(W-R-8,xx+8)}" y="${T+16}" font-size="11" fill="#596579">${tx(`约 ${th.first}% 后重开开始更省`,`Restart becomes cheaper at ~${th.first}%`)}</text>`;
    }

    const cx=x(s.currentPct),cyCont=y(s.cont.cost),cyRest=y(s.restart.cost);
    out+=`<line x1="${cx}" y1="${T}" x2="${cx}" y2="${H-B}" stroke="#8057c5" stroke-width="2.5" stroke-dasharray="7 6"/>`;
    out+=`<circle cx="${cx}" cy="${cyCont}" r="6" fill="#d65268" stroke="#fff" stroke-width="2"/>`;
    out+=`<circle cx="${cx}" cy="${cyRest}" r="6" fill="#0b9b78" stroke="#fff" stroke-width="2"/>`;
    out+=`<text x="${cx}" y="${H-B-10}" text-anchor="middle" font-size="11" font-weight="700" fill="#8057c5">${tx(`你现在 ${s.currentPct.toFixed(0)}%`,`You: ${s.currentPct.toFixed(0)}%`)}</text>`;

    out+=`<text x="${L+pw/2}" y="${H-7}" text-anchor="middle" font-size="12" fill="#667085">${tx("开始下一个功能前：当前上下文占 272K 的比例","Current context before next feature (% of 272K)")}</text>`;
    out+=`<text transform="translate(18 ${T+ph/2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#667085">${tx("完成该功能的预计累计 API 成本（USD）","Estimated cumulative API cost to finish feature (USD)")}</text>`;
    svg.innerHTML=out;
  }

  function useObserved(){
    q("#crCurrentPct").value="50.6";
    q("#crWorkload").value="5.5";
    q("#crRestartPct").value="16.5";
    q("#crFixed").value="0";
    q("#crFriction").value="0";
    render();
  }

  moduleHtml();
  root.addEventListener("click",e=>{
    const btn=e.target.closest(".cr-info");
    if(btn)btn.parentElement?.parentElement?.classList.toggle("open");
  });
  root.querySelectorAll("input").forEach(el=>el.addEventListener("input",render));
  q("#crObserved").addEventListener("click",useObserved);
  ["model","pricing","priceVer","output"].forEach(id=>document.getElementById(id)?.addEventListener("input",render));
  render();
})();