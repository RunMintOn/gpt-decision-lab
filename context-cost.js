
const PRICING={
  standard:{
    Luna:{short:{input:1,cache:.1,write:1.25,output:6},long:{input:2,cache:.2,write:2.5,output:9}},
    Terra:{short:{input:2.5,cache:.25,write:3.125,output:15},long:{input:5,cache:.5,write:6.25,output:22.5}},
    Sol:{short:{input:5,cache:.5,write:6.25,output:30},long:{input:10,cache:1,write:12.5,output:45}}
  },
  discount:{
    Luna:{short:{input:.5,cache:.05,write:.625,output:3},long:{input:1,cache:.1,write:1.25,output:4.5}},
    Terra:{short:{input:1.25,cache:.125,write:1.5625,output:7.5},long:{input:2.5,cache:.25,write:3.125,output:11.25}},
    Sol:{short:{input:2.5,cache:.25,write:3.125,output:15},long:{input:5,cache:.5,write:6.25,output:22.5}}
  }
};
const COLORS={base:"#0b9b78",mean:"#315bd6",sample:"#d65268",band:"rgba(49,91,214,.14)"};
const $=s=>document.querySelector(s);
let comparisonModel="Luna";
const EN=document.documentElement.lang.toLowerCase().startsWith("en");
const tr=(zh,en)=>EN?en:zh;
const BIAS_NAMES={
  uniform:tr("均匀随机","Uniform random"),
  early:tr("偏前期","Early-biased"),
  middle:tr("偏中期","Middle-biased"),
  late:tr("偏后期","Late-biased")
};

function mulberry32(a){
  return function(){
    let t=a+=0x6D2B79F5;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return ((t^t>>>14)>>>0)/4294967296;
  }
}
function fmtMoney(v){
  return "$"+v.toLocaleString("en-US",{minimumFractionDigits:v<.1?4:2,maximumFractionDigits:v<.1?4:2});
}
function quantile(sorted,q){
  if(!sorted.length)return 0;
  const p=(sorted.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);
  return sorted[lo]+(sorted[hi]-sorted[lo])*(p-lo);
}
function params(){
  const turns=Math.max(2,Math.floor(+$("input#turns").value||130));
  const startContext=Math.max(1,+$("#startContext").value||2000);
  const maxContext=Math.max(startContext,+$("#maxContext").value||372000);
  return {
    model:$("#model").value,turns,startContext,maxContext,
    newInput:Math.max(0,+$("#newInput").value||0),
    output:Math.max(0,+$("#output").value||0),
    failures:Math.max(0,Math.min(turns-1,Math.floor(+$("#failures").value||0))),
    bias:$("#bias").value,
    sims:Math.max(100,Math.min(10000,Math.floor(+$("#sims").value||1500))),
    seed:Math.floor(+$("#seed").value||56),
    pricing:$("#pricing").value
  };
}
function contextAt(t,p){
  return p.startContext+(p.maxContext-p.startContext)*(t-1)/(p.turns-1);
}
function rates(context,model,pricing){
  return PRICING[pricing][model][context>272000?"long":"short"];
}
function normalCost(context,p,model=p.model){
  const r=rates(context,model,p.pricing);
  const fresh=Math.min(p.newInput,context),history=Math.max(0,context-fresh);
  return (history*r.cache+fresh*r.input+p.output*r.output)/1e6;
}
function rebuildCost(context,p,model=p.model){
  const r=rates(context,model,p.pricing);
  return (context*r.write+p.output*r.output)/1e6;
}
function firstCost(context,p,model=p.model){
  return rebuildCost(context,p,model);
}
function biasWeight(t,p,bias){
  const x=(t-2)/Math.max(1,p.turns-2);
  if(bias==="early") return Math.pow(1-x,2)+.035;
  if(bias==="late") return Math.pow(x,2)+.035;
  if(bias==="middle"){
    const z=(x-.5)/.18;
    return Math.exp(-.5*z*z)+.035;
  }
  return 1;
}
function sampleFailures(p,bias,rng){
  const pool=[];
  for(let t=2;t<=p.turns;t++)pool.push({t,w:biasWeight(t,p,bias)});
  const chosen=[];
  for(let k=0;k<p.failures&&pool.length;k++){
    let total=pool.reduce((a,x)=>a+x.w,0),r=rng()*total,idx=0;
    for(;idx<pool.length;idx++){r-=pool[idx].w;if(r<=0)break}
    idx=Math.min(idx,pool.length-1);
    chosen.push(pool[idx].t);pool.splice(idx,1);
  }
  return new Set(chosen);
}
function baselineRows(p,model=p.model){
  const rows=[];let cum=0;
  for(let t=1;t<=p.turns;t++){
    const context=contextAt(t,p);
    const cost=t===1?firstCost(context,p,model):normalCost(context,p,model);
    cum+=cost;rows.push({t,context,cost,cum});
  }
  return rows;
}
function onePath(p,model,bias,seed){
  const failures=sampleFailures(p,bias,mulberry32(seed));
  const rows=[];let cum=0;
  for(let t=1;t<=p.turns;t++){
    const context=contextAt(t,p),fail=failures.has(t);
    const cost=t===1?firstCost(context,p,model):(fail?rebuildCost(context,p,model):normalCost(context,p,model));
    cum+=cost;rows.push({t,context,cost,cum,fail});
  }
  return {rows,failures};
}
function simulate(p,model=p.model,bias=p.bias,seed=p.seed){
  const base=baselineRows(p,model),sumCost=Array(p.turns).fill(0),cumSamples=Array.from({length:p.turns},()=>[]);
  const totals=[];
  for(let s=0;s<p.sims;s++){
    const path=onePath(p,model,bias,seed+s*104729+17).rows;
    for(let i=0;i<p.turns;i++){
      sumCost[i]+=path[i].cost;
      cumSamples[i].push(path[i].cum);
    }
    totals.push(path[path.length-1].cum);
  }
  const meanRows=base.map((r,i)=>{
    const arr=cumSamples[i].sort((a,b)=>a-b);
    return {...r,meanCost:sumCost[i]/p.sims,meanCum:arr.reduce((a,b)=>a+b,0)/arr.length,p10:quantile(arr,.1),p90:quantile(arr,.9)};
  });
  const sample=onePath(p,model,bias,seed+999983).rows;
  totals.sort((a,b)=>a-b);
  return {base,meanRows,sample,totalMean:totals.reduce((a,b)=>a+b,0)/totals.length,totalP10:quantile(totals,.1),totalP90:quantile(totals,.9)};
}
function axes(maxX,maxY,yTitle){
  const W=1120,H=630,L=76,R=34,T=28,B=66,pw=W-L-R,ph=H-T-B;
  const x=v=>L+(v/maxX)*pw,y=v=>T+(1-v/maxY)*ph;
  let s="";
  for(let i=0;i<=5;i++){
    const xv=maxX*i/5,xx=x(xv);
    s+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="#edf0f4"/><text x="${xx}" y="${H-30}" text-anchor="middle" font-size="11" fill="#748095">${Math.round(xv/1000)}K</text>`;
  }
  for(let i=0;i<=5;i++){
    const v=maxY*i/5,yy=y(v);
    s+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#edf0f4"/><text x="${L-10}" y="${yy+4}" text-anchor="end" font-size="11" fill="#748095">$${v.toFixed(maxY<1?3:2)}</text>`;
  }
  if(maxX>272000){
    const xx=x(272000);
    s+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="#8057c5" stroke-width="2" stroke-dasharray="7 6"/><text x="${xx}" y="${T+14}" text-anchor="middle" font-size="11" fill="#8057c5">272K</text>`;
  }
  s+=`<text x="${L+pw/2}" y="${H-7}" text-anchor="middle" font-size="12" fill="#667085">${tr("当前请求输入上下文长度","Prompt input tokens")}</text><text transform="translate(18 ${T+ph/2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#667085">${yTitle}</text>`;
  return {s,x,y,W,H,L,R,T,B};
}
function drawSingle(p,sim){
  const svg=$("#singleChart");
  const W=1120,H=700,L=86,R=36,T=28,B=66;
  const spikeTop=T,spikeH=150,gap=42,trendTop=spikeTop+spikeH+gap,trendBottom=H-B;
  const trendH=trendBottom-trendTop,pw=W-L-R;
  const x=v=>L+(v/p.maxContext)*pw;

  const normalSample=sim.sample.filter(r=>!r.fail);
  const trendValues=[
    ...sim.base.map(r=>r.cost),
    ...sim.meanRows.map(r=>r.meanCost),
    ...normalSample.map(r=>r.cost)
  ];
  const trendMax=Math.max(...trendValues)*1.14;
  const yTrend=v=>trendTop+(1-v/trendMax)*trendH;

  const spikes=sim.sample.filter(r=>r.fail);
  const spikeValues=spikes.map(r=>r.cost);
  const spikeMinRaw=spikeValues.length?Math.min(...spikeValues):trendMax*2;
  const spikeMaxRaw=spikeValues.length?Math.max(...spikeValues):trendMax*4;
  const spikeMin=Math.max(trendMax*1.2,spikeMinRaw*.90);
  const spikeMax=Math.max(spikeMin*1.05,spikeMaxRaw*1.08);
  const ySpike=v=>spikeTop+(1-(v-spikeMin)/(spikeMax-spikeMin))*spikeH;

  let s="";

  // Shared x grid and bottom labels.
  for(let i=0;i<=5;i++){
    const xv=p.maxContext*i/5,xx=x(xv);
    s+=`<line x1="${xx}" y1="${spikeTop}" x2="${xx}" y2="${spikeTop+spikeH}" stroke="#f1f3f7"/>`;
    s+=`<line x1="${xx}" y1="${trendTop}" x2="${xx}" y2="${trendBottom}" stroke="#edf0f4"/>`;
    s+=`<text x="${xx}" y="${H-30}" text-anchor="middle" font-size="11" fill="#748095">${Math.round(xv/1000)}K</text>`;
  }

  // Lower normal-cost axis.
  for(let i=0;i<=5;i++){
    const v=trendMax*i/5,yy=yTrend(v);
    s+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#edf0f4"/>`;
    s+=`<text x="${L-11}" y="${yy+4}" text-anchor="end" font-size="11" fill="#748095">$${v.toFixed(trendMax<1?3:2)}</text>`;
  }

  // Upper spike-cost axis.
  for(let i=0;i<=3;i++){
    const v=spikeMin+(spikeMax-spikeMin)*i/3,yy=ySpike(v);
    s+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#f0e6e9"/>`;
    s+=`<text x="${L-11}" y="${yy+4}" text-anchor="end" font-size="11" fill="#a05a66">$${v.toFixed(v<1?3:2)}</text>`;
  }

  // 272K threshold across both panels.
  if(p.maxContext>272000){
    const xx=x(272000);
    s+=`<line x1="${xx}" y1="${spikeTop}" x2="${xx}" y2="${spikeTop+spikeH}" stroke="#8057c5" stroke-width="2" stroke-dasharray="7 6"/>`;
    s+=`<line x1="${xx}" y1="${trendTop}" x2="${xx}" y2="${trendBottom}" stroke="#8057c5" stroke-width="2" stroke-dasharray="7 6"/>`;
    s+=`<text x="${xx}" y="${spikeTop+14}" text-anchor="middle" font-size="11" fill="#8057c5">272K</text>`;
  }

  // Baseline and expected normal trend in the zoomed lower panel.
  s+=`<polyline fill="none" stroke="${COLORS.base}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="${sim.base.map(r=>`${x(r.context)},${yTrend(r.cost)}`).join(" ")}"/>`;
  s+=`<polyline fill="none" stroke="${COLORS.mean}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="${sim.meanRows.map(r=>`${x(r.context)},${yTrend(r.meanCost)}`).join(" ")}"/>`;

  // Disaster positions, stems, lower-panel markers, and upper-panel spike magnitudes.
  spikes.forEach((r,idx)=>{
    const xx=x(r.context),yy=ySpike(r.cost);
    s+=`<line x1="${xx}" y1="${yy}" x2="${xx}" y2="${trendBottom}" stroke="${COLORS.sample}" stroke-width="1.6" stroke-dasharray="5 5" opacity=".68"/>`;
    s+=`<circle cx="${xx}" cy="${yy}" r="7" fill="${COLORS.sample}" stroke="#fff" stroke-width="2"/>`;
    s+=`<path d="M ${xx-6} ${trendTop+3} L ${xx+6} ${trendTop+3} L ${xx} ${trendTop+13} Z" fill="${COLORS.sample}"/>`;
    const anchor=idx===spikes.length-1?"end":"middle";
    const tx=idx===spikes.length-1?xx-5:xx;
    s+=`<text x="${tx}" y="${Math.max(spikeTop+13,yy-10)}" text-anchor="${anchor}" font-size="10.5" fill="#b63f55">${fmtMoney(r.cost)}</text>`;
  });

  // Broken-axis markers and labels.
  s+=`<path d="M ${L-7} ${spikeTop+spikeH+12} l 7 7 l 7 -7 M ${L-7} ${spikeTop+spikeH+22} l 7 7 l 7 -7" fill="none" stroke="#8b95a7" stroke-width="2"/>`;
  s+=`<text x="${L}" y="${spikeTop-8}" font-size="12" font-weight="700" fill="#a04d5d">${tr("灾难轮：完整缓存重建成本（独立纵轴）","Disaster requests: full cache rebuild cost (separate axis)")}</text>`;
  s+=`<text x="${L}" y="${trendTop-10}" font-size="12" font-weight="700" fill="#556176">${tr("正常单轮成本（放大显示）","Normal request cost (zoomed)")}</text>`;
  s+=`<text x="${L+pw/2}" y="${H-7}" text-anchor="middle" font-size="12" fill="#667085">${tr("当前请求输入上下文长度","Prompt input tokens")}</text>`;
  s+=`<text transform="translate(18 ${trendTop+trendH/2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#667085">${tr("正常单轮成本（USD）","Normal request cost (USD)")}</text>`;
  s+=`<text transform="translate(18 ${spikeTop+spikeH/2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#9a5965">${tr("重建成本（USD）","Rebuild cost (USD)")}</text>`;

  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  svg.innerHTML=s;
}
function drawCum(p,sim){
  const all=[...sim.meanRows.map(r=>r.p90),...sim.sample.map(r=>r.cum)];
  const a=axes(p.maxContext,Math.max(...all)*1.08,tr("累计总成本（USD）","Cumulative cost (USD)"));
  let s=a.s;
  const top=sim.meanRows.map(r=>`${a.x(r.context)},${a.y(r.p90)}`);
  const bot=[...sim.meanRows].reverse().map(r=>`${a.x(r.context)},${a.y(r.p10)}`);
  s+=`<polygon points="${top.concat(bot).join(" ")}" fill="${COLORS.band}"/>`;
  s+=`<polyline fill="none" stroke="${COLORS.base}" stroke-width="3.5" points="${sim.base.map(r=>`${a.x(r.context)},${a.y(r.cum)}`).join(" ")}"/>`;
  s+=`<polyline fill="none" stroke="${COLORS.sample}" stroke-width="2.5" opacity=".85" points="${sim.sample.map(r=>`${a.x(r.context)},${a.y(r.cum)}`).join(" ")}"/>`;
  $("#cumChart").innerHTML=s;
}
function biasLabel(v){return BIAS_NAMES[v]}
function renderBiasTable(p){
  const biases=["early","middle","late","uniform"];
  const base=baselineRows(p,comparisonModel).at(-1).cum;
  let h=`<thead><tr><th>${tr("灾难位置倾向","Disaster-position bias")}</th><th>${tr("无灾难基准","No-disaster baseline")}</th><th>${tr("模拟平均总成本","Mean total cost")}</th><th>${tr("额外成本","Extra cost")}</th><th>${tr("额外比例","Extra share")}</th><th>${tr("10% 分位","10th percentile")}</th><th>${tr("90% 分位","90th percentile")}</th></tr></thead><tbody>`;
  biases.forEach((b,i)=>{
    const sim=simulate({...p,sims:Math.min(p.sims,1200)},comparisonModel,b,p.seed+8101*i);
    const extra=sim.totalMean-base;
    h+=`<tr><td>${biasLabel(b)}</td><td>${fmtMoney(base)}</td><td>${fmtMoney(sim.totalMean)}</td><td>${fmtMoney(extra)}</td><td>${(100*extra/base).toFixed(1)}%</td><td>${fmtMoney(sim.totalP10)}</td><td>${fmtMoney(sim.totalP90)}</td></tr>`;
  });
  $("#biasTable").innerHTML=h+"</tbody>";
}
function render(){
  const p=params(),sim=simulate(p);
  drawSingle(p,sim);drawCum(p,sim);renderBiasTable(p);
  const baseTotal=sim.base.at(-1).cum,extra=sim.totalMean-baseTotal,lastBase=sim.base.at(-1).cost,lastMean=sim.meanRows.at(-1).meanCost;
  $("#failureRate").textContent=(100*p.failures/p.turns).toFixed(2)+"%";
  $("#growth").textContent=Math.round((p.maxContext-p.startContext)/(p.turns-1)).toLocaleString()+tr(" tokens"," tokens");
  $("#lastCost").textContent=fmtMoney(lastBase)+" / "+fmtMoney(lastMean);
  $("#totalCost").textContent=fmtMoney(baseTotal)+" / "+fmtMoney(sim.totalMean);
  $("#extraCost").textContent=fmtMoney(extra);
  $("#extraCost").nextElementSibling.textContent=`${tr("总成本区间","Total-cost range")} ${fmtMoney(sim.totalP10)} – ${fmtMoney(sim.totalP90)}`;
}
let timer;
function schedule(){clearTimeout(timer);timer=setTimeout(render,90)}
["model","turns","maxContext","startContext","newInput","output","failures","bias","sims","seed","pricing"].forEach(id=>$("#"+id).addEventListener("input",schedule));
$("#reroll").onclick=()=>{$("#seed").value=(+$("input#seed").value||0)+1;render()};
$("#reset").onclick=()=>{
  $("#model").value="Sol";$("#turns").value=130;$("#maxContext").value=372000;$("#startContext").value=2000;
  $("#newInput").value=1512;$("#output").value=100;$("#failures").value=5;$("#bias").value="uniform";
  $("#sims").value=1500;$("#seed").value=56;$("#pricing").value="standard";comparisonModel="Luna";
  document.querySelectorAll(".modelTab").forEach(b=>b.classList.toggle("active",b.dataset.model==="Luna"));
  render();
};
document.querySelectorAll(".modelTab").forEach(b=>b.onclick=()=>{
  comparisonModel=b.dataset.model;
  document.querySelectorAll(".modelTab").forEach(x=>x.classList.toggle("active",x===b));
  renderBiasTable(params());
});
const languageSwitch=document.querySelector("#languageSwitch");
const navModels=document.querySelector("#navModels");
const navContext=document.querySelector("#navContext");
if(EN){
  languageSwitch.textContent="中文";
  languageSwitch.href="context-cost.html";
  navModels.href="index.html?lang=en";
  navContext.href="context-cost.html?lang=en";
}else{
  languageSwitch.textContent="English";
  languageSwitch.href="context-cost.html?lang=en";
  navModels.href="index.html";
  navContext.href="context-cost.html";
}
render();
