const ROWS=DATA.rows,GROUPS=DATA.groups,CORE=DATA.core_models;
const EFFORTS=["None","Low","Medium","High","Xhigh","Max"];
const COLORS={"GPT-5.5":"#8057c5","GPT-5.6 Luna":"#e4862d","GPT-5.6 Terra":"#0b9b78","GPT-5.6 Sol":"#315bd6","GPT-5.6 Sol Ultra":"#d65268","GPT-5.4":"#7b8598"};
// 价格版本：默认“调整后”（2026-07-30 官网调价，Luna −80% / Terra −20%），
// “调整前”恢复 2026-07 benchmark 发布时对应的老价格（即 data.js 原值）。
let priceVersion=localStorage.getItem("gpdl:price");
if(priceVersion!=="after"&&priceVersion!=="before")priceVersion="after";
const state={
  scenario:"coding",benchmark:"Agents' Last Exam",basis:"costIndex",view:"cost",budget:1,
  tolerance:4,costWeight:60,latencyWeight:30,tokenWeight:10,focusModel:null
};
let current={configs:[],frontier:[],choice:null,domain:{min:.1,max:3}};
let framePending=false;

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const fmt=(n,d=2)=>Number(n).toLocaleString(EN?"en-US":"zh-CN",{maximumFractionDigits:d});
function benches(){return state.scenario==="single"?[state.benchmark]:GROUPS[state.scenario]}
function models(){return state.scenario==="single"?[...new Set(ROWS.filter(r=>r.benchmark===state.benchmark).map(r=>r.model))]:CORE}
function gm(v){return Math.exp(v.reduce((a,b)=>a+Math.log(b),0)/v.length)}
function buildConfigs(){
  const bs=benches(),mods=models(),best={},base={};
  bs.forEach(b=>{
    best[b]=Math.max(...ROWS.filter(r=>r.benchmark===b&&mods.includes(r.model)).map(r=>r.score));
    base[b]=ROWS.find(r=>r.benchmark===b&&r.model==="GPT-5.5"&&r.effort==="Medium");
  });
  const out=[];
  mods.forEach(model=>EFFORTS.forEach(effort=>{
    const rr=bs.map(b=>ROWS.find(r=>r.benchmark===b&&r.model===model&&r.effort===effort)).filter(Boolean);
    if(rr.length!==bs.length||bs.some(b=>!base[b]))return;
    const costRows=rr.map(r=>r.cost_usd*(priceVersion==="after"&&(model==="GPT-5.6 Luna"||model==="GPT-5.6 Terra")?(model==="GPT-5.6 Luna"?.2:.8):1));
    out.push({
      model,effort,
      ability:rr.reduce((a,r)=>a+100*r.score/best[r.benchmark],0)/rr.length,
      costIndex:gm(rr.map((r,i)=>costRows[i]/base[r.benchmark].cost_usd)),
      tokenIndex:gm(rr.map(r=>r.output_tokens/base[r.benchmark].output_tokens)),
      latencyIndex:gm(rr.map(r=>r.latency_min/base[r.benchmark].latency_min)),
      rawCost:costRows.reduce((a,b)=>a+b,0),
      rawTokens:rr.reduce((a,r)=>a+r.output_tokens,0),
      rawLatency:rr.reduce((a,r)=>a+r.latency_min,0)/rr.length
    });
  }));
  return out;
}
function xValue(c){return c[state.basis]}
function priceRatio(c){
  if(state.basis==="costIndex")return c.costIndex;
  const base=current.configs.find(x=>x.model==="GPT-5.5"&&x.effort==="Medium");
  return base?c.rawCost/base.rawCost:c.costIndex;
}
function combinedBurden(c){
  return Math.pow(priceRatio(c),state.costWeight/100)*Math.pow(c.latencyIndex,state.latencyWeight/100)*Math.pow(c.tokenIndex,state.tokenWeight/100);
}
function viewValue(c){return state.view==="cost"?xValue(c):state.view==="latency"?c.latencyIndex:state.view==="tokens"?c.tokenIndex:combinedBurden(c)}
function viewFormat(v){return state.view==="cost"?xFormat(v):v.toFixed(2)+"×"}
function viewName(){return state.view==="cost"?tr("价格","Price"):state.view==="latency"?tr("延迟","Latency"):state.view==="tokens"?"Token":tr("综合资源","Combined resources")}
function shortModel(m){return m.replace("GPT-5.6 ","").replace("GPT-","").replace("Claude ","").replace(" Preview","")}
function shortEffort(e){return {None:"N",Low:"L",Medium:"M",High:"H",Xhigh:"X",Max:"Max"}[e]||e}
function xFormat(v){
  return state.basis==="costIndex"?v.toFixed(2)+"×":"$"+fmt(v,v<10?2:0);
}
function logDomain(vals){
  const min=Math.min(...vals),max=Math.max(...vals);
  return {min:min*.9,max:max*1.1};
}
function sliderToValue(pos){
  const p=(+pos)/1000,d=current.domain;
  return Math.pow(10,Math.log10(d.min)+p*(Math.log10(d.max)-Math.log10(d.min)));
}
function valueToSlider(v){
  const d=current.domain,x=Math.max(d.min,Math.min(d.max,v));
  return 1000*(Math.log10(x)-Math.log10(d.min))/(Math.log10(d.max)-Math.log10(d.min));
}
function pareto(cs,getValue=xValue){
  const sorted=[...cs].sort((a,b)=>getValue(a)-getValue(b)||b.ability-a.ability);
  const f=[];let best=-Infinity;
  sorted.forEach(c=>{if(c.ability>best+1e-9){f.push(c);best=c.ability}});
  return f;
}
function choose(){
  return current.configs.filter(c=>xValue(c)<=state.budget)
    .sort((a,b)=>b.ability-a.ability||xValue(a)-xValue(b))[0]||null;
}
function cheaperNear(choice){
  if(!choice)return null;
  return current.frontier.filter(c=>xValue(c)<xValue(choice)&&c.ability>=choice.ability-state.tolerance)
    .sort((a,b)=>xValue(a)-xValue(b))[0]||null;
}
function balancedNear(choice){
  if(!choice)return null;
  return current.configs.filter(c=>c!==choice&&xValue(c)<=state.budget&&c.ability>=choice.ability-state.tolerance)
    .sort((a,b)=>combinedBurden(a)-combinedBurden(b)||b.ability-a.ability)[0]||null;
}
function nextUpgrade(){
  return current.frontier.find(c=>xValue(c)>state.budget)||null;
}
function mainReferenceValue(){
  if(!current.choice)return null;
  // Map budget's relative position in the price domain to the same relative
  // position in the current view's domain, giving constant pixel speed.
  const d=current.domain;
  const t=Math.max(0,Math.min(1,(Math.log(state.budget)-Math.log(d.min))/(Math.log(d.max)-Math.log(d.min))));
  const vals=current.configs.map(viewValue);
  const viewDomain=logDomain(vals);
  return Math.exp(Math.log(viewDomain.min)+t*(Math.log(viewDomain.max)-Math.log(viewDomain.min)));
}
function rawTokens(v){return v>=1e6?fmt(v/1e6,2)+"M":v>=1e3?fmt(v/1e3,1)+"K":fmt(v,0)}
function signed(v,suffix="%"){return (v>0?"+":"")+v.toFixed(1)+suffix}
function ratioChange(v,base){return signed(100*(v/base-1))}
function rebuild(){
  current.configs=buildConfigs();
  current.frontier=pareto(current.configs);
  current.domain=logDomain(current.configs.map(xValue));
  state.budget=Math.max(current.domain.min,Math.min(current.domain.max,state.budget));
  renderStatic();
  updateBudget();
}
function renderStatic(){
  const d=current.domain,qs=[0,.25,.5,.75,1].map(p=>Math.pow(10,Math.log10(d.min)+p*(Math.log10(d.max)-Math.log10(d.min))));
  ["markMin","mark25","mark50","mark75","markMax"].forEach((id,i)=>$("#"+id).textContent=xFormat(qs[i]));
  $("#budgetPrefix").textContent=state.basis==="rawCost"?"$":"";
  $("#budgetSuffix").textContent=state.basis==="costIndex"?"×":"";
  $("#budgetNumber").step=state.basis==="costIndex"?.01:.1;
  $("#frontierButtons").innerHTML=current.frontier.map(c=>`<button class="frontierBtn" data-v="${xValue(c)}">${c.model.replace("GPT-","")} ${c.effort} · ${xFormat(xValue(c))}</button>`).join("");
  $$(".frontierBtn").forEach(b=>b.onclick=()=>scheduleBudget(+b.dataset.v));
  $("#legend").classList.toggle("hasFocus",!!state.focusModel);
  $("#legend").innerHTML=[...new Set(current.configs.map(c=>c.model))].map(m=>`<button data-model="${m}" class="${state.focusModel===m?"active":""}"><i class="dot" style="background:${COLORS[m]||"#7b8598"}"></i>${m}</button>`).join("");
  $$("#legend button").forEach(b=>b.onclick=()=>{state.focusModel=state.focusModel===b.dataset.model?null:b.dataset.model;renderStatic();updateBudget()});
  $$(".viewBtn").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
  $("#chartTitle").textContent=EN?viewName()+" vs. Ability":state.view==="tokens"?"Token 与能力":viewName()+"与能力";
  $("#frontierPill").textContent=tr("绿色线 = ","Green line = ")+viewName()+tr("–能力最优边界","–Ability efficient boundary");
  $("#chartHint").textContent=state.view==="cost"?tr("蓝色竖线 = 当前预算；黑圈 = 主推荐；橙圈 = 综合推荐","Blue line = current budget; black ring = main recommendation; orange ring = combined recommendation"):tr("深色竖线 = 预算在当前视角的映射位置；超预算点会变淡；橙圈 = 综合推荐","Dark line = budget position mapped to the current view; over-budget points are faded; orange ring = combined recommendation");
  $("#coverage").textContent=benches().length+tr(" 个 benchmark · "," benchmark"+(benches().length===1?"":"s")+" · ")+current.configs.length+tr(" 个完整配置"," complete configurations");
  $("#benchmarkMethod").textContent=benches().length+" benchmark"+(benches().length===1?"":"s")+" · Equal-weighted ability · Resources normalized to GPT-5.5 Medium";
  $("#benchmarkList").innerHTML=benches().map(b=>`<span class="benchmarkChip">${b}</span>`).join("");
  syncWeightControls();
  renderTable();
}
function scheduleBudget(v){
  state.budget=Math.max(current.domain.min,Math.min(current.domain.max,v));
  updateBudgetChrome();
  if(framePending)return;
  framePending=true;
  requestAnimationFrame(()=>{framePending=false;updateBudget()});
}
function updateBudgetChrome(){
  const slider=valueToSlider(state.budget),pct=(slider/10).toFixed(2)+"%";
  $("#budgetSlider").value=slider;
  $("#budgetSlider").style.setProperty("--pct",pct);
  $("#budgetRead").textContent=xFormat(state.budget);
  $("#budgetNumber").value=state.basis==="costIndex"?state.budget.toFixed(2):state.budget.toFixed(2);
}
function updateBudget(){
  current.choice=choose();
  updateBudgetChrome();
  renderRecommendations();
  drawChart();
  renderTable();
  $$(".frontierBtn").forEach(b=>b.classList.toggle("active",Math.abs(+b.dataset.v-state.budget)<=Math.max(.0001,state.budget*.003)));
}
function renderRecommendations(){
  const c=current.choice,cheap=cheaperNear(c),balanced=balancedNear(c),next=nextUpgrade();
  const candidates=current.configs.filter(x=>xValue(x)<=state.budget);
  $("#kpiCandidates").textContent=candidates.length+tr(" 个"," configs");
  if(!c){
    $("#hero").innerHTML=`<div class="explain">${tr("当前预算低于所有完整配置。请提高预算。","The current budget is below every complete configuration. Increase the budget.")}</div>`;
    ["cheaperReco","balancedReco","upgradeReco"].forEach(id=>$("#"+id).innerHTML="");
    return;
  }
  $("#hero").innerHTML=`
    <div class="heroTop"><div><span style="font-size:11px;color:var(--muted)">${tr("预算内能力最高","Highest ability within budget")}</span><h3 class="heroTitle">${c.model} · ${c.effort}</h3></div><span class="heroTag">${xFormat(xValue(c))}</span></div>
    <div class="heroStats">
      <div class="stat"><span>${tr("综合能力","Aggregate ability")}</span><b>${c.ability.toFixed(1)}</b></div>
      <div class="stat"><span>${tr("成本指数","Cost index")}</span><b>${c.costIndex.toFixed(2)}×</b></div>
      <div class="stat"><span>${tr("Token 指数","Token index")}</span><b>${c.tokenIndex.toFixed(2)}×</b></div>
      <div class="stat"><span>${tr("Latency 指数","Latency index")}</span><b>${c.latencyIndex.toFixed(2)}×</b></div>
    </div>
    <div class="explain">${tr(`预算为 ${xFormat(state.budget)} 时，${candidates.length} 个配置可用；当前配置在其中综合能力最高。`,`At a budget of ${xFormat(state.budget)}, ${candidates.length} configurations are available; this one has the highest aggregate ability.`)}</div>`;
  $("#cheaperReco").innerHTML=cheap?`
    <div class="recoHead"><div><span>${tr("更便宜的近似方案","Cheaper near-equivalent")}</span><b>${cheap.model} · ${cheap.effort}</b></div><div class="tag">${xFormat(xValue(cheap))}</div></div>
    <small>${tr(`能力 ${cheap.ability.toFixed(1)}，比主推荐低 ${(c.ability-cheap.ability).toFixed(1)} 分；预算资源节省 ${(100*(1-xValue(cheap)/xValue(c))).toFixed(0)}%。`,`Ability ${cheap.ability.toFixed(1)}, ${(c.ability-cheap.ability).toFixed(1)} points below the main recommendation; price is ${(100*(1-xValue(cheap)/xValue(c))).toFixed(0)}% lower.`)}</small>`
    :`<span>${tr("更便宜的近似方案","Cheaper near-equivalent")}</span><b>${tr("没有","None")}</b><small>${tr(`在允许损失 ${state.tolerance.toFixed(1)} 个能力点的范围内，没有更便宜的前沿配置。`,`No cheaper boundary configuration is within the allowed ${state.tolerance.toFixed(1)}-point ability loss.`)}</small>`;
  $("#balancedReco").innerHTML=balanced?`
    <div class="recoHead"><div><span>${tr("综合平衡推荐","Combined recommendation")}</span><b>${balanced.model} · ${balanced.effort}</b></div><div class="tag">${tr("综合 ","Combined ")}${combinedBurden(balanced).toFixed(2)}×</div></div>
    <div class="compareGrid">
      <div><span>${tr("能力","Ability")}</span><b>${signed(balanced.ability-c.ability,tr(" 分"," pts"))}</b></div>
      <div><span>${tr("价格","Price")}</span><b>${ratioChange(xValue(balanced),xValue(c))}</b></div>
      <div><span>Token</span><b>${ratioChange(balanced.tokenIndex,c.tokenIndex)}</b></div>
      <div><span>${tr("延迟","Latency")}</span><b>${ratioChange(balanced.latencyIndex,c.latencyIndex)}</b></div>
    </div>
    <small>${tr(`以上均与主推荐相比；只在能力最多降低 ${state.tolerance.toFixed(1)} 分的配置中寻找。`,`All values are relative to the main recommendation; candidates may lose at most ${state.tolerance.toFixed(1)} ability points.`)}</small>`:
    `<span>${tr("综合平衡推荐","Combined recommendation")}</span><b>${tr("当前范围内没有其他方案","No alternative in the current range")}</b><small>${tr("可以提高“最多少几分”，扩大备选范围。","Increase the maximum ability loss to widen the candidate range.")}</small>`;
  $("#upgradeReco").innerHTML=next?`
    <div class="recoHead"><div><span>${tr("下一个有效升级点","Next useful upgrade")}</span><b>${next.model} · ${next.effort}</b></div><div class="tag">${xFormat(xValue(next))}</div></div>
    <small>${tr(`预算再增加 ${(100*(xValue(next)/state.budget-1)).toFixed(0)}%，能力可从 ${c.ability.toFixed(1)} 提升到 ${next.ability.toFixed(1)}。`,`Increase the budget by ${(100*(xValue(next)/state.budget-1)).toFixed(0)}% to raise ability from ${c.ability.toFixed(1)} to ${next.ability.toFixed(1)}.`)}</small>`
    :`<span>${tr("下一个有效升级点","Next useful upgrade")}</span><b>${tr("已到前沿末端","End of the boundary")}</b><small>${tr("继续提高预算，在当前数据中没有更高能力配置。","No higher-ability configuration is available in the current data at a larger budget.")}</small>`;

  $("#kpiAbility").textContent=c.ability.toFixed(1);
  $("#kpiAbilityMeta").textContent=c.model+" · "+c.effort;
  $("#kpiTokens").textContent=c.tokenIndex.toFixed(2)+"×";
  $("#kpiTokensMeta").textContent=rawTokens(c.rawTokens)+" output tokens";
  $("#kpiLatency").textContent=c.latencyIndex.toFixed(2)+"×";
  $("#kpiLatencyMeta").textContent=fmt(c.rawLatency,2)+tr(" 分钟"," minutes");
  $("#toleranceOut").textContent=state.tolerance.toFixed(1);
}
function drawChart(){
  const cs=current.configs,f=pareto(cs,viewValue),c=current.choice,balanced=balancedNear(c),referenceValue=mainReferenceValue(),svg=$("#chart"),W=1110,H=620,L=78,R=48,T=32,B=70;
  const vals=cs.map(viewValue),viewDomain=state.view==="cost"?current.domain:logDomain(vals);
  const minX=viewDomain.min,maxX=viewDomain.max,minY=Math.floor((Math.min(...cs.map(x=>x.ability))-3)/5)*5,maxY=100;
  const pw=W-L-R,ph=H-T-B;
  const x=v=>L+(Math.log(v)-Math.log(minX))/(Math.log(maxX)-Math.log(minX))*pw;
  const y=v=>T+(maxY-v)/(maxY-minY)*ph;
  let s="";
  if(state.view==="cost"){
    const bx=x(state.budget);
    s+=`<rect x="${L}" y="${T}" width="${Math.max(0,bx-L)}" height="${ph}" fill="#f2f6ff"/>`;
  }
  [0,.2,.4,.6,.8,1].forEach(p=>{
    const v=Math.exp(Math.log(minX)+p*(Math.log(maxX)-Math.log(minX))),xx=x(v);
    s+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="#e9edf3"/><text x="${xx}" y="${H-30}" text-anchor="middle" font-size="11" fill="#748095">${viewFormat(v)}</text>`;
  });
  for(let v=Math.ceil(minY/5)*5;v<=maxY;v+=5){
    const yy=y(v);
    s+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e9edf3"/><text x="${L-10}" y="${yy+4}" text-anchor="end" font-size="11" fill="#748095">${v}</text>`;
  }
  if(state.view==="cost"){
    const bx=x(state.budget);
    s+=`<line x1="${bx}" y1="${T}" x2="${bx}" y2="${H-B}" stroke="#315bd6" stroke-width="2.5" stroke-dasharray="7 5"/><text x="${bx}" y="${T+14}" text-anchor="middle" font-size="11" font-weight="700" fill="#315bd6">${tr("预算 ","Budget ")}${xFormat(state.budget)}</text>`;
  }else if(referenceValue!==null){
    const gx=x(referenceValue);
    s+=`<line x1="${gx}" y1="${T}" x2="${gx}" y2="${H-B}" stroke="#172033" stroke-width="2" stroke-dasharray="6 5" opacity=".58"/><text x="${gx}" y="${T+14}" text-anchor="middle" font-size="11" font-weight="700" fill="#172033">${tr("预算 ","Budget ")}${viewFormat(referenceValue)}</text>`;
  }
  if(f.length>1)s+=`<polyline fill="none" stroke="#0b9b78" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" opacity=".82" points="${f.map(p=>x(viewValue(p))+","+y(p.ability)).join(" ")}"/>`;
  const placed=[];
  cs.forEach(p=>{
    const px=x(viewValue(p)),py=y(p.ability),on=f.includes(p),selected=p===c,isBalanced=p===balanced&&p!==c,col=COLORS[p.model]||"#7b8598",within=xValue(p)<=state.budget;
    const focus=state.focusModel,opacity=focus?(p.model===focus ? .98 : .1):(within?(on ? .98 : .68):.18);
    const comparison=c&&p!==c?tr(`比主推荐：能力 ${signed(p.ability-c.ability," 分")}，价格 ${ratioChange(xValue(p),xValue(c))}，Token ${ratioChange(p.tokenIndex,c.tokenIndex)}，延迟 ${ratioChange(p.latencyIndex,c.latencyIndex)}`,`Versus main: ability ${signed(p.ability-c.ability," pts")}, price ${ratioChange(xValue(p),xValue(c))}, tokens ${ratioChange(p.tokenIndex,c.tokenIndex)}, latency ${ratioChange(p.latencyIndex,c.latencyIndex)}`):tr("当前主推荐","Current main recommendation");
    const tip=[p.model+" · "+p.effort,tr("能力 ","Ability ")+p.ability.toFixed(1),tr("价格 ","Price ")+xFormat(xValue(p)),"Token "+p.tokenIndex.toFixed(2)+"×",tr("延迟 ","Latency ")+p.latencyIndex.toFixed(2)+"×",tr("综合资源 ","Combined resources ")+combinedBurden(p).toFixed(2)+"×",within?tr("价格预算内","Within price budget"):tr("超过价格预算","Over price budget"),comparison].join("|");
    s+=`<circle class="chartPoint" data-model="${p.model}" data-base-opacity="${opacity}" data-tip="${tip}" cx="${px}" cy="${py}" r="${on?7:5.5}" fill="${col}" stroke="${on?"#0b9b78":"#fff"}" stroke-width="${on?2.5:1.5}" opacity="${opacity}"/>`;
    if(isBalanced)s+=`<circle cx="${px}" cy="${py}" r="11" fill="none" stroke="#e4862d" stroke-width="3" pointer-events="none"/>`;
    if(selected)s+=`<circle cx="${px}" cy="${py}" r="${isBalanced?14:11}" fill="none" stroke="#111827" stroke-width="3" pointer-events="none"/>`;
    const label=shortModel(p.model)+" "+shortEffort(p.effort),w=Math.max(28,label.length*5.8),h=13;
    const options=[[9,-8],[9,15],[-w-9,-8],[-w-9,15],[9,-22],[-w-9,-22]];
    const ranked=options.map(([dx,dy])=>({dx,dy,box:{x:px+dx-2,y:py+dy-h+2,w:w+4,h}})).map(o=>({...o,hits:placed.filter(q=>!(o.box.x+o.box.w<q.x||q.x+q.w<o.box.x||o.box.y+o.box.h<q.y||q.y+q.h<o.box.y)).length})).sort((a,b)=>a.hits-b.hits);
    const pos=ranked[0];placed.push(pos.box);
    const labelOpacity=focus?(p.model===focus ? 1 : .08):(within ? .82 : .22);
    s+=`<text x="${px+pos.dx}" y="${py+pos.dy}" font-size="9.5" font-weight="650" fill="${col}" opacity="${labelOpacity}" paint-order="stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round" pointer-events="none">${label}</text>`;
  });
  const axis=state.view==="cost"?(state.basis==="costIndex"?tr("公平成本指数","Fair cost index"):tr("官网测试套件原始成本","Raw benchmark-suite cost")):viewName()+tr("指数"," index");
  s+=`<text x="${L+pw/2}" y="${H-8}" text-anchor="middle" font-size="12" fill="#667085">${axis}${tr("（对数尺度）"," (log scale)")}</text><text transform="translate(18 ${T+ph/2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#667085">${tr("综合能力（越高越好）","Aggregate ability (higher is better)")}</text>`;
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);svg.innerHTML=s;
  attachTips();
}
function renderTable(){
  const f=pareto(current.configs,viewValue),c=current.choice;
  let h=`<thead><tr><th>${tr("配置","Configuration")}</th><th>${tr("能力","Ability")}</th><th>${tr("成本指数","Cost index")}</th><th>${tr("原始成本","Raw cost")}</th><th>${tr("Token 指数","Token index")}</th><th>${tr("Latency 指数","Latency index")}</th><th>${tr("当前预算","Current budget")}</th><th>${tr("状态","Status")}</th></tr></thead><tbody>`;
  [...current.configs].sort((a,b)=>xValue(a)-xValue(b)||b.ability-a.ability).forEach(p=>{
    const cls=p===c?"selected":f.includes(p)?"front":"dim";
    h+=`<tr class="${cls}"><td>${p.model} · ${p.effort}</td><td>${p.ability.toFixed(1)}</td><td>${p.costIndex.toFixed(2)}×</td><td>$${fmt(p.rawCost,2)}</td><td>${p.tokenIndex.toFixed(2)}×</td><td>${p.latencyIndex.toFixed(2)}×</td><td>${xValue(p)<=state.budget?tr("可用","Available"):tr("超预算","Over budget")}</td><td>${p===c?tr("当前推荐","Current recommendation"):f.includes(p)?viewName()+tr("视角边界"," view boundary"):tr("普通配置","Regular configuration")}</td></tr>`;
  });
  $("#table").innerHTML=h+"</tbody>";
}
function syncWeightControls(){
  [["costWeight","costWeightOut"],["latencyWeight","latencyWeightOut"],["tokenWeight","tokenWeightOut"]].forEach(([id,out])=>{
    $("#"+id).value=state[id];$("#"+out).textContent=state[id]+"%";paintRange($("#"+id));
  });
  const signature=[state.costWeight,state.latencyWeight,state.tokenWeight].join(",");
  $$(".presetBtn").forEach(b=>b.classList.toggle("active",b.dataset.weights===signature));
  $("#weightTotal").textContent=tr("合计 ","Total ")+(state.costWeight+state.latencyWeight+state.tokenWeight)+"%";
}
function applyWeights(cost,latency,tokens){
  state.costWeight=cost;state.latencyWeight=latency;state.tokenWeight=tokens;
  syncWeightControls();updateBudget();
}
function changeWeight(key,value){
  value=Math.max(0,Math.min(100,Math.round(value)));
  const others=["costWeight","latencyWeight","tokenWeight"].filter(k=>k!==key),remain=100-value,sum=state[others[0]]+state[others[1]];
  const first=sum?Math.round(remain*state[others[0]]/sum):Math.round(remain/2);
  state[key]=value;state[others[0]]=first;state[others[1]]=remain-first;
  syncWeightControls();updateBudget();
}
function attachTips(){
  const t=$("#tip");
  $$("[data-tip]").forEach(el=>{
    el.onmousemove=e=>{t.innerHTML=el.dataset.tip.split("|").map((x,i)=>i?x:`<b>${x}</b>`).join("<br>");t.style.left=e.clientX+"px";t.style.top=e.clientY+"px";t.style.opacity=1};
    el.onmouseleave=()=>t.style.opacity=0;
  });
}
function paintRange(el){
  const min=+el.min||0,max=+el.max||100,pct=100*(+el.value-min)/(max-min||1);
  el.style.setProperty("--pct",Math.max(0,Math.min(100,pct)).toFixed(1)+"%");
}
function init(){
  $("#benchmark").innerHTML=[...new Set(ROWS.map(r=>r.benchmark))].sort().map(b=>`<option>${b}</option>`).join("");
  $("#benchmark").value=state.benchmark;$("#benchmark").disabled=true;
  $("#scenario").onchange=e=>{state.scenario=e.target.value;$("#benchmark").disabled=state.scenario!=="single";state.budget=1;rebuild()};
  $("#benchmark").onchange=e=>{state.benchmark=e.target.value;state.budget=1;rebuild()};
  $("#budgetBasis").onchange=e=>{state.basis=e.target.value;state.budget=state.basis==="costIndex"?1:current.configs.find(c=>c.model==="GPT-5.5"&&c.effort==="Medium")?.rawCost||1;rebuild()};
  $("#priceVer").value=priceVersion;
  $("#priceVer").onchange=e=>{priceVersion=e.target.value;localStorage.setItem("gpdl:price",priceVersion);rebuild()};
  $$(".viewBtn").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;renderStatic();updateBudget()});
  $("#budgetSlider").addEventListener("input",e=>scheduleBudget(sliderToValue(e.target.value)),{passive:true});
  $("#budgetNumber").oninput=e=>{const v=+e.target.value;if(Number.isFinite(v)&&v>0)scheduleBudget(v)};
  $("#budgetNumber").onkeydown=e=>{if(e.key==="Enter"){const v=+e.target.value;if(Number.isFinite(v)&&v>0)scheduleBudget(v)}};
  $("#stepDown").onclick=()=>scheduleBudget(state.budget/1.06);
  $("#stepUp").onclick=()=>scheduleBudget(state.budget*1.06);
  $("#tolerance").oninput=e=>{state.tolerance=+e.target.value;paintRange(e.target);updateBudget()};
  ["costWeight","latencyWeight","tokenWeight"].forEach(id=>$("#"+id).oninput=e=>changeWeight(id,+e.target.value));
  $$(".presetBtn").forEach(b=>b.onclick=()=>applyWeights(...b.dataset.weights.split(",").map(Number)));
  $("#resetWeights").onclick=()=>applyWeights(60,30,10);
  paintRange($("#tolerance"));syncWeightControls();
  $("#reset").onclick=()=>{
    Object.assign(state,{scenario:"coding",benchmark:"Agents' Last Exam",basis:"costIndex",view:"cost",budget:1,tolerance:4,costWeight:60,latencyWeight:30,tokenWeight:10,focusModel:null});
    priceVersion="after";localStorage.setItem("gpdl:price","after");$("#priceVer").value="after";
    $("#scenario").value="coding";$("#benchmark").value=state.benchmark;$("#benchmark").disabled=true;$("#budgetBasis").value="costIndex";
    $("#tolerance").value=4;paintRange($("#tolerance"));syncWeightControls();
    rebuild();
  };
  rebuild();
}
try{init()}catch(err){console.error(err);document.body.insertAdjacentHTML("afterbegin",`<div style="padding:14px;background:#fee2e2;color:#991b1b">${tr("页面脚本错误：","Page script error: ")}${err.message}</div>`)}
