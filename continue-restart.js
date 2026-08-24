(function(){
  const root=document.getElementById("continueRestartRoot");
  if(!root)return;

  const isEn=()=>document.documentElement.lang.toLowerCase().startsWith("en");
  const tx=(zh,en)=>isEn()?en:zh;
  const q=s=>root.querySelector(s);
  const n=(id,fallback=0)=>{const v=+q(id).value;return Number.isFinite(v)?v:fallback};
  const money=v=>"$"+Number(v).toLocaleString("en-US",{minimumFractionDigits:v<.1?4:2,maximumFractionDigits:v<.1?4:2});
  const toks=v=>Math.round(v).toLocaleString()+" tokens";

  function moduleHtml(){
    root.innerHTML=`
      <div class="head">
        <div>
          <h2>${tx("继续当前会话，还是 Compact / 重开？","Continue current context, or compact / restart?")}</h2>
          <div class="cr-intro">${tx("这里不再只问“长上下文多少钱”，而是比较两条未来路径：继续携带当前上下文，或支付一次恢复成本，把工作集压回较小 baseline。横轴是未来还要发生的 productive model calls。","This compares two future paths: keep carrying the current prompt, or pay a one-time recovery cost and resume from a smaller working-set baseline. The x-axis is future productive model calls.")}</div>
        </div>
        <div class="cr-presetRow"><button id="crObserved" class="cr-preset">${tx("应用真实纯开发 Trace","Use observed pure-dev trace")}</button></div>
      </div>
      <div class="body">
        <div class="cr-controls">
          ${field("crCurrent",tx("当前 Prompt input tokens","Current prompt input tokens"),137700,1000,tx("决策点当前请求的总 Prompt 长度。它决定继续旧会话时，每一个未来调用需要重复读取多少历史。","Total prompt size at the decision point. This determines how much history each future call keeps re-reading if you continue."))}
          ${field("crRemaining",tx("预计剩余 productive calls","Expected remaining productive calls"),72,1,tx("这是最关键的放大器之一。上下文成本不是付一次；每多一个模型调用，旧历史就会再次被读取。","One of the main amplifiers. Context cost is not paid once; every additional model call reads the carried history again."))}
          ${field("crGrowth",tx("平均 Prompt 净增长 / call","Average prompt growth / call"),1306,10,tx("真实纯开发 trace：compact 后约 45K，在 71 个 call interval 后到约 137.7K，端点平均约 1.31K tokens / call。实际过程会有波动。","Observed pure-dev trace: about 45K after compaction and about 137.7K after 71 call intervals, averaging roughly 1.31K tokens per call between endpoints. Real growth is bursty."))}
          ${field("crRestart",tx("Compact / 重开后的工作 baseline","Post-compact / restart working baseline"),45000,1000,tx("恢复计划、仓库状态、关键文件和摘要后，新工作段第一轮大约需要携带多少 Prompt。真实 trace 中 compact 后 baseline 约 45K。","Prompt carried by the first call after restoring plan, repository state, key files and summary. The observed trace started around 45K after compaction."))}
          ${field("crFixed",tx("固定 System / Tool prefix","Fixed system / tool prefix"),0,100,tx("如果你能单独测出 system prompt + tool definitions，可以填在这里。它会在每轮重复出现，而且计入 272K 阈值。若 45K baseline 已经包含这些内容，就保持 0，避免重复计算。","If you can measure system prompt + tool definitions separately, enter them here. They recur on every request and count toward the 272K threshold. Leave this at 0 when your baseline already includes them."))}
          ${field("crFriction",tx("重启对齐摩擦（等效额外 calls）","Restart friction (equivalent extra calls)"),0,1,tx("把人的重新解释、模型重新定位、重新确认需求等难以货币化的损耗，表达成额外 model calls。默认 0，不把未经观测的人力成本硬塞进模型。","Represent hard-to-price re-alignment work as extra model calls. Default is 0 so the model does not invent a human-effort dollar value."))}
        </div>

        <div class="cr-results">
          <div id="crDecision" class="cr-result cr-decision"><span>${tx("机器成本结论","Machine-cost result")}</span><b>—</b><small>—</small></div>
          <div class="cr-result"><span>${tx("Break-even","Break-even")}</span><b id="crBreakEven">—</b><small>${tx("未来 productive calls","future productive calls")}</small></div>
          <div class="cr-result"><span>${tx("继续当前会话","Continue")}</span><b id="crContinueCost">—</b><small id="crContinueMeta">—</small></div>
          <div class="cr-result"><span>${tx("Compact / 重开","Compact / restart")}</span><b id="crRestartCost">—</b><small id="crRestartMeta">—</small></div>
          <div class="cr-result"><span>${tx("预计节省","Expected savings")}</span><b id="crSavings">—</b><small id="crSavingsPct">—</small></div>
        </div>

        <div class="cr-chartbox"><svg id="crChart" viewBox="0 0 1120 570"></svg></div>
        <div class="cr-legend">
          <span><i class="cr-line" style="background:#d65268"></i>${tx("继续当前会话","Continue current context")}</span>
          <span><i class="cr-line" style="background:#0b9b78"></i>${tx("Compact / 重开","Compact / restart")}</span>
          <span><i class="cr-line" style="background:#8057c5"></i>${tx("Break-even","Break-even")}</span>
        </div>

        <div class="cr-explain">
          <div class="cr-explainCard" id="crWhyTurns"></div>
          <div class="cr-explainCard" id="crWhyCompact"></div>
        </div>
        <div class="cr-assumption">${tx("模型假设：沿用页面当前选择的模型、API 价格版本和 Output Tokens / call。继续路径按理想前缀复用计费；Compact / 重开路径把第一轮恢复工作集按 Cache Write 处理，随后恢复正常前缀复用。固定 System / Tool prefix 若单独填写，则假设它保持稳定并可继续命中缓存。人类认知成本只通过“等效额外 calls”显式加入。","Assumptions: this module inherits the selected model, API price version and Output Tokens / call from the page. The continue path uses ideal prefix reuse. The compact/restart path treats the restored working set on its first call as a cache write, then resumes normal prefix reuse. A separately entered fixed system/tool prefix is assumed stable and cacheable. Human cognitive cost is included only through explicit equivalent extra calls.")}</div>
      </div>`;
  }

  function field(id,label,value,step,help){
    return `<div class="cr-field"><div class="cr-labelRow"><label for="${id}">${label}</label><button class="cr-info" type="button" aria-label="info">i</button></div><input id="${id}" type="number" value="${value}" min="0" step="${step}"><div class="cr-help">${help}</div></div>`;
  }

  function currentModel(){return document.getElementById("model")?.value||"Sol"}
  function currentPricing(){return document.getElementById("pricing")?.value||"standard"}
  function currentOutput(){return Math.max(0,+(document.getElementById("output")?.value||0))}

  function crRates(context){
    if(typeof rates==="function")return rates(context,currentModel(),currentPricing());
    return {input:1,cache:.1,write:1.25,output:6};
  }

  function normalRequestCost(context,fresh,output){
    const r=crRates(context),f=Math.min(Math.max(0,fresh),context),history=Math.max(0,context-f);
    return (history*r.cache+f*r.input+output*r.output)/1e6;
  }

  function restartFirstCost(totalContext,fixedPrefix,workingSet,output){
    const r=crRates(totalContext),fixed=Math.min(Math.max(0,fixedPrefix),totalContext),dynamic=Math.max(0,workingSet);
    return (fixed*r.cache+dynamic*r.write+output*r.output)/1e6;
  }

  function compute(){
    const current=Math.max(1,n("#crCurrent",137700));
    const R=Math.max(1,Math.floor(n("#crRemaining",72)));
    const growth=Math.max(0,n("#crGrowth",1306));
    const restartWorking=Math.max(1,n("#crRestart",45000));
    const fixed=Math.max(0,n("#crFixed",0));
    const friction=Math.max(0,Math.floor(n("#crFriction",0)));
    const output=currentOutput();
    const restartStart=restartWorking+fixed;

    const cont=[];let contCum=0;
    for(let k=1;k<=R;k++){
      const context=current+growth*(k-1);
      contCum+=normalRequestCost(context,growth,output);
      cont.push({k,context,cum:contCum});
    }

    const restartAll=[];let restartCum=0;
    const totalRestartCalls=R+friction;
    for(let j=1;j<=totalRestartCalls;j++){
      const context=restartStart+growth*(j-1);
      const cost=j===1?restartFirstCost(context,fixed,restartWorking,output):normalRequestCost(context,growth,output);
      restartCum+=cost;
      restartAll.push({j,context,cum:restartCum});
    }
    const restart=cont.map((r,i)=>{
      const j=friction+i+1;
      const rr=restartAll[j-1];
      return {k:r.k,context:rr.context,cum:rr.cum};
    });

    let breakEven=null;
    for(let i=0;i<R;i++)if(restart[i].cum<=cont[i].cum){breakEven=i+1;break}

    return {current,R,growth,restartWorking,fixed,friction,output,restartStart,cont,restart,breakEven};
  }

  function render(){
    const d=compute(),cEnd=d.cont[d.cont.length-1],rEnd=d.restart[d.restart.length-1];
    const savings=cEnd.cum-rEnd.cum,pct=cEnd.cum?100*savings/cEnd.cum:0,restartWins=savings>0;
    const decision=q("#crDecision");
    decision.classList.toggle("restart",restartWins);
    decision.querySelector("b").textContent=restartWins?tx("Compact / 重开更省","Compact / restart is cheaper"):tx("继续当前会话更省","Continuing is cheaper");
    decision.querySelector("small").textContent=restartWins?tx(`在预计 ${d.R} 个 productive calls 内，机器成本预计少 ${money(savings)}。`,`Across ${d.R} productive calls, expected machine cost is lower by ${money(savings)}.`):tx(`在预计 ${d.R} 个 productive calls 内，重建成本尚未回本。`,`Within ${d.R} productive calls, the restart cost has not paid back.`);
    q("#crBreakEven").textContent=d.breakEven?tx(`第 ${d.breakEven} call`,`Call ${d.breakEven}`):tx("区间内未出现","Not reached");
    q("#crContinueCost").textContent=money(cEnd.cum);
    q("#crRestartCost").textContent=money(rEnd.cum);
    q("#crSavings").textContent=(savings>=0?"":"−")+money(Math.abs(savings));
    q("#crSavingsPct").textContent=(pct>=0?"":"−")+Math.abs(pct).toFixed(1)+"%";
    q("#crContinueMeta").textContent=tx(`末端 Prompt ≈ ${Math.round(cEnd.context/1000)}K`,`Ending prompt ≈ ${Math.round(cEnd.context/1000)}K`);
    q("#crRestartMeta").textContent=tx(`末端 Prompt ≈ ${Math.round(rEnd.context/1000)}K；含 ${d.friction} 个对齐 calls`,`Ending prompt ≈ ${Math.round(rEnd.context/1000)}K; includes ${d.friction} friction calls`);

    const repeated=Math.max(0,d.current-d.restartStart)*d.R;
    q("#crWhyTurns").innerHTML=`<strong>${tx("为什么 calls 很关键？","Why do calls matter?")}</strong><br>${tx(`按当前输入，继续路径相对较小工作集，在 ${d.R} 个未来 calls 中会重复携带约 ${Math.round(repeated/1000).toLocaleString()}K 个额外历史 token-read（粗略量级，未扣除两条路径共同增长部分）。`,`With the current inputs, continuing carries roughly ${Math.round(repeated/1000).toLocaleString()}K additional historical token-reads over ${d.R} future calls versus the smaller working set, before accounting for growth shared by both paths.`)}`;
    const retained=100*d.restartStart/d.current;
    q("#crWhyCompact").innerHTML=`<strong>${tx("Compact 买到了什么？","What does compaction buy?")}</strong><br>${tx(`当前 ${Math.round(d.current/1000)}K → 恢复 baseline ${Math.round(d.restartStart/1000)}K，相当于只保留约 ${retained.toFixed(1)}% 的当前 Prompt。你先支付一次恢复/重建成本，再让后续每个 call 从更小的工作集出发。`,`Current ${Math.round(d.current/1000)}K → restored baseline ${Math.round(d.restartStart/1000)}K, retaining about ${retained.toFixed(1)}% of the prompt. You pay a one-time restore/rebuild cost, then each future call starts from a smaller working set.`)}`;
    draw(d);
  }

  function draw(d){
    const svg=q("#crChart"),W=1120,H=570,L=72,R=32,T=30,B=62,pw=W-L-R,ph=H-T-B;
    const maxY=Math.max(d.cont[d.cont.length-1].cum,d.restart[d.restart.length-1].cum)*1.10||1;
    const x=k=>L+(k/d.R)*pw,y=v=>T+(1-v/maxY)*ph;
    let s="";
    for(let i=0;i<=5;i++){
      const k=d.R*i/5,xx=x(k);
      s+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="#edf0f4"/><text x="${xx}" y="${H-28}" text-anchor="middle" font-size="11" fill="#748095">${Math.round(k)}</text>`;
    }
    for(let i=0;i<=5;i++){
      const v=maxY*i/5,yy=y(v);
      s+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#edf0f4"/><text x="${L-10}" y="${yy+4}" text-anchor="end" font-size="11" fill="#748095">$${v.toFixed(maxY<1?3:2)}</text>`;
    }
    s+=`<polyline fill="none" stroke="#d65268" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="${d.cont.map(r=>`${x(r.k)},${y(r.cum)}`).join(" ")}"/>`;
    s+=`<polyline fill="none" stroke="#0b9b78" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="${d.restart.map(r=>`${x(r.k)},${y(r.cum)}`).join(" ")}"/>`;
    if(d.breakEven){
      const xx=x(d.breakEven);
      s+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="#8057c5" stroke-width="2" stroke-dasharray="7 6"/><text x="${xx+6}" y="${T+14}" font-size="11" fill="#8057c5">${tx("回本","break-even")} ${d.breakEven}</text>`;
    }
    const cont272=d.cont.find(r=>r.context>272000),rest272=d.restart.find(r=>r.context>272000);
    [[cont272,"#d65268",tx("继续路径跨 272K","Continue >272K")],[rest272,"#0b9b78",tx("重开路径跨 272K","Restart >272K")]].forEach(([row,color,label])=>{
      if(!row)return;const xx=x(row.k);s+=`<line x1="${xx}" y1="${H-B-26}" x2="${xx}" y2="${H-B}" stroke="${color}" stroke-width="2"/><text x="${xx}" y="${H-B-31}" text-anchor="middle" font-size="10" fill="${color}">${label}</text>`;
    });
    s+=`<text x="${L+pw/2}" y="${H-7}" text-anchor="middle" font-size="12" fill="#667085">${tx("未来 productive model calls","Future productive model calls")}</text>`;
    s+=`<text transform="translate(18 ${T+ph/2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#667085">${tx("累计 API 等效成本（USD）","Cumulative API-equivalent cost (USD)")}</text>`;
    svg.innerHTML=s;
  }

  function useObserved(){
    q("#crCurrent").value=137700;
    q("#crRemaining").value=72;
    q("#crGrowth").value=1306;
    q("#crRestart").value=45000;
    q("#crFixed").value=0;
    q("#crFriction").value=0;
    render();
  }

  moduleHtml();
  root.querySelectorAll(".cr-info").forEach(btn=>btn.addEventListener("click",()=>btn.closest(".cr-field").classList.toggle("open")));
  root.querySelectorAll("input").forEach(el=>el.addEventListener("input",render));
  q("#crObserved").addEventListener("click",useObserved);
  ["model","pricing","priceVer","output"].forEach(id=>document.getElementById(id)?.addEventListener("input",render));
  render();
})();
