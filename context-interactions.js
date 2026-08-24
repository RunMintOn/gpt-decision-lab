(function(){
  const WINDOW=272000;
  const svg=document.getElementById('cumChart');
  if(!svg || typeof drawCum!=='function') return;

  const isEn=()=>document.documentElement.lang.toLowerCase().startsWith('en');
  const tx=(zh,en)=>isEn()?en:zh;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const money=v=>'$'+Number(v).toLocaleString('en-US',{minimumFractionDigits:v<.1?4:2,maximumFractionDigits:v<.1?4:2});
  const ktok=v=>`${(v/1000).toFixed(v<100000?1:0)}K`;

  let markerA=30;
  let markerB=50;
  let dragMarker=null;
  let lastP=null;
  let lastSim=null;
  let geom=null;

  function interpolateCum(rows,context){
    if(context<=0) return 0;
    if(!rows.length) return 0;
    if(context<=rows[0].context){
      const r=rows[0];
      return r.context>0 ? r.cum*(context/r.context) : r.cum;
    }
    for(let i=1;i<rows.length;i++){
      const a=rows[i-1],b=rows[i];
      if(context<=b.context){
        const f=(context-a.context)/(b.context-a.context||1);
        return a.cum+(b.cum-a.cum)*f;
      }
    }
    return rows[rows.length-1].cum;
  }

  function ensureInspector(){
    if(document.getElementById('cumInspector')) return;
    const body=svg.closest('.body');
    const legend=body?.querySelector('.legend');
    if(!body || !legend) return;
    const box=document.createElement('div');
    box.id='cumInspector';
    box.className='cum-inspector';
    box.innerHTML=`
      <div class="cum-inspector-head">
        <strong>${tx('区间成本对比','Interval cost comparison')}</strong>
        <span>${tx('拖动图上的 A / B 标记；数值按绿色“无灾难基准”计算。','Drag markers A / B on the chart; values use the green no-disaster baseline.')}</span>
      </div>
      <div class="cum-inspector-grid">
        <div class="cum-stat"><span>${tx('A 点','Point A')}</span><b id="cumA">—</b><small id="cumACost">—</small></div>
        <div class="cum-stat"><span>${tx('B 点','Point B')}</span><b id="cumB">—</b><small id="cumBCost">—</small></div>
        <div class="cum-stat emph"><span>${tx('A → B 增量','A → B delta')}</span><b id="cumDeltaAB">—</b><small>${tx('这段上下文增长额外花了多少','Extra cost across this interval')}</small></div>
        <div class="cum-stat"><span>${tx('0 → A 增量','0 → A delta')}</span><b id="cumDelta0A">—</b><small>${tx('到 A 点为止的累计成本','Cumulative cost up to A')}</small></div>
      </div>`;
    legend.insertAdjacentElement('afterend',box);
  }

  function updateInspector(p,sim){
    ensureInspector();
    const maxPct=100*p.maxContext/WINDOW;
    markerA=clamp(markerA,0,maxPct);
    markerB=clamp(markerB,markerA,maxPct);
    const ctxA=markerA/100*WINDOW;
    const ctxB=markerB/100*WINDOW;
    const yA=interpolateCum(sim.base,ctxA);
    const yB=interpolateCum(sim.base,ctxB);
    const a=document.getElementById('cumA');
    if(!a) return;
    a.textContent=`${markerA.toFixed(0)}% · ${ktok(ctxA)}`;
    document.getElementById('cumACost').textContent=tx(`累计 ${money(yA)}`,`Cumulative ${money(yA)}`);
    document.getElementById('cumB').textContent=`${markerB.toFixed(0)}% · ${ktok(ctxB)}`;
    document.getElementById('cumBCost').textContent=tx(`累计 ${money(yB)}`,`Cumulative ${money(yB)}`);
    document.getElementById('cumDeltaAB').textContent=money(Math.max(0,yB-yA));
    document.getElementById('cumDelta0A').textContent=money(yA);
  }

  function customDrawCum(p,sim){
    lastP=p;lastSim=sim;
    const W=1120,H=660,L=82,R=34,T=30,B=92,pw=W-L-R,ph=H-T-B;
    const all=[...sim.meanRows.map(r=>r.p90),...sim.sample.map(r=>r.cum),...sim.base.map(r=>r.cum)];
    const maxY=Math.max(...all)*1.08||1;
    const x=v=>L+(v/p.maxContext)*pw;
    const y=v=>T+(1-v/maxY)*ph;
    geom={W,H,L,R,T,B,pw,ph,p,maxY,x,y};
    let s='';

    for(let i=0;i<=5;i++){
      const xv=p.maxContext*i/5,xx=x(xv),pp=100*xv/WINDOW;
      s+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="#edf0f4"/>`;
      s+=`<text x="${xx}" y="${H-51}" text-anchor="middle" font-size="11.5" fill="#536178">${Math.round(xv/1000)}K</text>`;
      s+=`<text x="${xx}" y="${H-35}" text-anchor="middle" font-size="10.5" fill="#98a1b1">${pp.toFixed(pp<10?1:0)}%</text>`;
    }
    for(let i=0;i<=5;i++){
      const v=maxY*i/5,yy=y(v);
      s+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#edf0f4"/>`;
      s+=`<text x="${L-10}" y="${yy+4}" text-anchor="end" font-size="11" fill="#748095">$${v.toFixed(maxY<1?3:2)}</text>`;
    }
    if(p.maxContext>WINDOW){
      const xx=x(WINDOW);
      s+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="#8057c5" stroke-width="2" stroke-dasharray="7 6"/>`;
      s+=`<text x="${xx}" y="${T+14}" text-anchor="middle" font-size="11" fill="#8057c5">272K · 100%</text>`;
    }

    const top=sim.meanRows.map(r=>`${x(r.context)},${y(r.p90)}`);
    const bot=[...sim.meanRows].reverse().map(r=>`${x(r.context)},${y(r.p10)}`);
    s+=`<polygon points="${top.concat(bot).join(' ')}" fill="${COLORS.band}"/>`;
    s+=`<polyline fill="none" stroke="${COLORS.base}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="${sim.base.map(r=>`${x(r.context)},${y(r.cum)}`).join(' ')}"/>`;
    s+=`<polyline fill="none" stroke="${COLORS.sample}" stroke-width="2.5" opacity=".85" stroke-linecap="round" stroke-linejoin="round" points="${sim.sample.map(r=>`${x(r.context)},${y(r.cum)}`).join(' ')}"/>`;

    const maxPct=100*p.maxContext/WINDOW;
    markerA=clamp(markerA,0,maxPct);
    markerB=clamp(markerB,markerA,maxPct);
    const marks=[['A',markerA,'#315bd6'],['B',markerB,'#e4862d']];
    marks.forEach(([name,mp,color])=>{
      const ctx=mp/100*WINDOW;
      const val=interpolateCum(sim.base,ctx);
      const xx=x(ctx),yy=y(val);
      s+=`<line x1="${L}" y1="${yy}" x2="${xx}" y2="${yy}" stroke="${color}" stroke-width="1.4" stroke-dasharray="4 5" opacity=".72"/>`;
      s+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="${color}" stroke-width="2" stroke-dasharray="6 5" opacity=".72"/>`;
      s+=`<circle data-cum-marker="${name}" cx="${xx}" cy="${yy}" r="10" fill="${color}" stroke="#fff" stroke-width="3" style="cursor:ew-resize"/>`;
      s+=`<circle data-cum-marker="${name}" cx="${xx}" cy="${yy}" r="22" fill="transparent" style="cursor:ew-resize"/>`;
      const labelX=mp>88?xx-10:xx+10,anchor=mp>88?'end':'start';
      s+=`<text x="${labelX}" y="${Math.max(T+18,yy-13)}" text-anchor="${anchor}" font-size="11.5" font-weight="700" fill="${color}">${name} · ${mp.toFixed(0)}% · ${money(val)}</text>`;
    });

    s+=`<text x="${L+pw/2}" y="${H-8}" text-anchor="middle" font-size="12" fill="#667085">${tx('当前请求输入上下文长度 · 占 272K 成本基准窗口的比例','Prompt input tokens · share of the 272K cost-reference window')}</text>`;
    s+=`<text transform="translate(18 ${T+ph/2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#667085">${tx('累计总成本（USD）','Cumulative cost (USD)')}</text>`;
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    svg.innerHTML=s;
    updateInspector(p,sim);
  }

  drawCum=customDrawCum;

  function pointerToSvgX(ev){
    if(!geom) return null;
    const rect=svg.getBoundingClientRect();
    if(!rect.width) return null;
    return (ev.clientX-rect.left)/rect.width*geom.W;
  }

  svg.addEventListener('pointerdown',ev=>{
    const hit=ev.target.closest?.('[data-cum-marker]');
    if(!hit) return;
    dragMarker=hit.getAttribute('data-cum-marker');
    svg.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  });

  svg.addEventListener('pointermove',ev=>{
    if(!dragMarker || !geom || !lastP || !lastSim) return;
    const sx=pointerToSvgX(ev);
    if(sx===null) return;
    const ctx=clamp((sx-geom.L)/geom.pw*lastP.maxContext,0,lastP.maxContext);
    const pctx=Math.round(100*ctx/WINDOW);
    const maxPct=Math.round(100*lastP.maxContext/WINDOW);
    if(dragMarker==='A') markerA=clamp(pctx,0,markerB);
    else markerB=clamp(pctx,markerA,maxPct);
    customDrawCum(lastP,lastSim);
    ev.preventDefault();
  });

  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>svg.addEventListener(type,()=>{dragMarker=null}));

  function moveDecisionSliders(){
    const root=document.getElementById('continueRestartRoot');
    const controls=root?.querySelector('.cr-primaryControls');
    const legend=root?.querySelector('.cr-legend');
    if(controls && legend && controls.previousElementSibling!==legend){
      legend.insertAdjacentElement('afterend',controls);
      controls.classList.add('cr-primaryControls-below');
    }
  }
  moveDecisionSliders();

  document.getElementById('reset')?.addEventListener('click',()=>{
    const max=document.getElementById('maxContext');
    if(max && max.value!=='272000'){
      max.value='272000';
      if(typeof render==='function') render();
    }
  });

  if(typeof render==='function') render();
})();
