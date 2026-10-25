const logoContours=[[[79, 0], [331, 0], [448, 117], [448, 119], [327, 239], [326, 242], [324, 242], [324, 244], [322, 244], [79, 0]], [[622, 0], [1000, 0], [1000, 319], [947, 383], [942, 388], [775, 388], [660, 273], [883, 272], [883, 137], [737, 137], [252, 623], [1, 623], [1, 621], [622, 0]], [[630, 300], [632, 300], [954, 623], [703, 623], [506, 426], [506, 424], [630, 300]]];
/* Contours come from the original alpha, with staged technical construction. */
(()=>{
const scene=document.querySelector('.brand-reveal'),sequence=document.querySelector('.logo-sequence');if(!scene||!sequence)return;
const stage=scene.querySelector('.logo-stage'),body=scene.querySelector('.logo-body'),edge=scene.querySelector('.logo-edge'),aura=scene.querySelector('.logo-aura'),lights=scene.querySelectorAll('.logo-light'),copy=scene.querySelector('.about-copy');
const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1000 623');svg.classList.add('draft-geometry');svg.setAttribute('aria-hidden','true');
const paths=[],guides=[],tips=[];
function path(d,cls){const el=document.createElementNS(ns,'path');el.setAttribute('d',d);el.setAttribute('class',cls);svg.append(el);return el;}
logoContours.forEach(poly=>{for(let i=0;i<poly.length-1;i++){const a=poly[i],b=poly[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<5)continue;const line=path(`M${a}L${b}`,'draft-contour');line._ends=paths.length%2?[b,a]:[a,b];paths.push(line);if(len>100){const ex=dx/len*36,ey=dy/len*36;guides.push(path(`M${a[0]-ex},${a[1]-ey}L${b[0]+ex},${b[1]+ey}`,'draft-extension'));}}});
// Drafting dimensions use original image-space units, not invented physical measurements.
function guide(a,b,cls='draft-dimension'){
 const el=path(`M${a}L${b}`,cls);el._ends=[a,b];guides.push(el);return el;
}
function tick(x,y){guide([x-5,y+6],[x+5,y-6],'draft-tick');}
guide([1,-56],[1000,-56]);guide([1,-70],[1,-16]);guide([1000,-70],[1000,-16]);
tick(1,-56);tick(1000,-56);
guide([1050,0],[1050,623]);guide([1016,0],[1065,0]);guide([970,623],[1065,623]);tick(1050,0);tick(1050,623);
guide([737,100],[883,100]);guide([737,86],[737,155]);guide([883,86],[883,155]);tick(737,100);tick(883,100);
guide([500,-90],[500,700],'draft-centerline');
guide([-70,311.5],[1090,311.5],'draft-centerline');
guide([1,623],[115,623]);guide([1,623],[81,543]);
guides.push(path('M91 623 A90 90 0 0 0 64.64 559.36','draft-angle'));
// Compositional compass guides, not a claim about the logo's original construction.
[[500,311.5,311.5],[500,311.5,192.5],[810,205,73]].forEach(([cx,cy,r],i)=>{
 const start=i%2?cx-r:cx+r,sweep=i%2?0:1,opposite=i%2?cx+r:cx-r;
 guides.push(path(`M${start} ${cy} A${r} ${r} 0 1 ${sweep} ${opposite} ${cy} A${r} ${r} 0 1 ${sweep} ${start} ${cy}`,'draft-compass'));
});
[[1,623],[622,0],[1000,0],[883,137],[737,137],[660,273]].forEach(([x,y])=>{
 guide([x-7,y],[x+7,y],'draft-registration');guide([x,y-7],[x,y+7],'draft-registration');
});
[['999',500,-70,-3],['623',1074,316,3],['146',810,85,-4],['45\u00b0',116,589,-5]].forEach(([txt,x,y,angle])=>{
 const el=document.createElementNS(ns,'text');el.textContent=txt;el.setAttribute('x',x);el.setAttribute('y',y);el.setAttribute('transform',`rotate(${angle} ${x} ${y})`);el.setAttribute('class','draft-measure');svg.append(el);
});
// Loose notebook studies sit behind and outside the precision logo drawing.
const candleGroup=document.createElementNS(ns,'g');svg.insertBefore(candleGroup,svg.firstChild);
const candles=[];
const studies=[
 ...Array.from({length:5},(_,i)=>[26+i*34,240+Math.sin(i*1.7)*22]),
 ...Array.from({length:5},(_,i)=>[900+i*34,465-Math.sin(i*.9)*32]),
 ...Array.from({length:4},(_,i)=>[400+i*30,-34+Math.sin(i)*14]),
 ...Array.from({length:5},(_,i)=>[340+i*32,650-Math.sin(i*1.3)*14])
];
function pencil(d,cls='draft-candle'){
 const el=document.createElementNS(ns,'path');el.setAttribute('d',d);el.setAttribute('class',cls);candleGroup.append(el);candles.push(el);return el;
}
studies.forEach(([x,y],i)=>{
 const height=21+(i%4)*8,wick=12+(i%3)*7,t=y-height/2,b=y+height/2;
 const tilt=(i%3-1)*1.3;
 const d=`M${x+tilt},${t-wick}Q${x-1.2},${y} ${x+.8},${b+wick}M${x-8},${t+1}Q${x},${t-1.3} ${x+9},${t}L${x+8+tilt},${b}Q${x},${b+1.2} ${x-8.5},${b-.8}Z`;
 const el=pencil(d,i%3===0?'draft-candle draft-candle-down':'draft-candle');el.setAttribute('transform',`rotate(${(i%5-2)*1.8} ${x} ${y})`);
 if(i%3===0)pencil(`M${x-7},${t+3}L${x+7},${t+9}M${x-7},${t+11}L${x+7},${t+17}`,'draft-pencil-hatch');
});
[
 'M20 302 Q85 293 190 309 M22 305 Q90 297 188 311',
 'M913 524 Q985 513 1080 527',
 'M395 -2 Q450 6 515 -5',
 'M320 699 Q410 688 511 700',
 'M170 280 Q218 254 235 217 M227 225 L235 217 234 230',
 'M1007 435 Q1021 395 1000 365 M998 375 L1000 365 1008 372'
].forEach(d=>pencil(d,'draft-pencil-note'));
const formulas=[];
[['H \u2212 L',40,335,-4],['|C \u2212 O|',112,359,3],['risk / trade',905,561,-5],['R = reward / risk',330,730,-2],['price \u00d7 time',270,-78,3]].forEach(([txt,x,y,angle])=>{
 const el=document.createElementNS(ns,'text');el.textContent=txt;el.setAttribute('x',x);el.setAttribute('y',y);el.setAttribute('transform',`rotate(${angle} ${x} ${y})`);el.setAttribute('class','draft-formula');svg.append(el);formulas.push(el);
});
paths.forEach((el,i)=>{const dot=document.createElementNS(ns,'circle');dot.setAttribute('r','2');dot.setAttribute('class','draft-tip');svg.append(dot);tips.push(dot);});stage.append(svg);
const candleLengths=candles.map(el=>el.getTotalLength());candles.forEach((el,i)=>{el.style.strokeDasharray=candleLengths[i]+' '+candleLengths[i];el.style.strokeDashoffset=candleLengths[i];});
const statement=scene.querySelector('.brand-statement'),words=[...statement.querySelectorAll('p')];
const texts=[...copy.querySelectorAll('h2,p,nav')],reduced=matchMedia('(prefers-reduced-motion:reduce)'),short=matchMedia('(max-height:700px) and (max-width:800px)');let frame=0;
const clamp=n=>Math.max(0,Math.min(1,n));const ramp=(p,a,b)=>{const x=clamp((p-a)/(b-a));return x*x*(3-2*x);};

const lengths=guides.map(el=>el.getTotalLength());
guides.forEach((el,i)=>{if(!el._ends){el.style.strokeDasharray=lengths[i]+' '+lengths[i];el.style.strokeDashoffset=lengths[i];}});
function paint(){
frame=0;
const r=sequence.getBoundingClientRect(),vh=innerHeight,staticMode=reduced.matches,mobile=innerWidth<=800;
// Entry exposes the first strokes; the pinned scroll distance drives every later phase.
// On phones start as the drawing area enters the screen, not near the top edge.
const lead=mobile?vh*.55:vh*.28,travel=Math.max(1,sequence.offsetHeight-scene.offsetHeight);
const progress=staticMode?1:clamp((lead-r.top)/(travel+lead));
const p=clamp(progress/.66);
const metal=ramp(p,.59,.75),layout=staticMode?1:ramp(progress,.85,.98);
// Begin slightly outside the actual frame, then pull back before the metal reveal.
const closeup=Math.max(1.3,scene.clientWidth/stage.offsetWidth*1.08);
const camera=1+(closeup-1)*(1-ramp(p,.18,.56));
const scale=camera*(1-layout*(mobile?.36:.5)),x=mobile?0:-scene.clientWidth*.255*layout,y=mobile?(115-vh*.42)*layout:0;
stage.style.top=mobile?vh*.42+'px':'50%';
stage.style.transform=staticMode?'none':`translate(-50%,-50%) translate(${x}px,${y}px) scale(${scale})`;
const statementIn=ramp(progress,.61,.68),statementOut=ramp(progress,.81,.85);
stage.style.opacity=String(staticMode?1:1-statementIn+ramp(progress,.855,.90));
statement.style.opacity=String(staticMode?0:statementIn*(1-statementOut));
statement.style.transform=`translate(-50%,-50%) scale(${.96+.04*statementIn})`;
words.forEach((el,i)=>{const reveal=ramp(progress,.615+i*.055,.685+i*.055);el.style.opacity=String(reveal);el.style.transform=`translateY(${(1-reveal)*24}px)`;});
body.style.opacity=String(metal);edge.style.opacity=String(metal);aura.style.opacity=String(metal*.25);
paths.forEach((el,i)=>{
 const start=.04+(i%5)*.065+Math.floor(i/5)*.03,n=ramp(p,start,start+.19),[a,b]=el._ends;
 const x=a[0]+(b[0]-a[0])*n,y=a[1]+(b[1]-a[1])*n;
 el.setAttribute('d',`M${a[0]},${a[1]}L${x},${y}`);el.style.opacity=n>0?'1':'0';
 tips[i].setAttribute('cx',x);tips[i].setAttribute('cy',y);tips[i].style.opacity=n>0&&n<1?'1':'0';
});
guides.forEach((el,i)=>{
 const n=ramp(p,(i%5)*.018,.22+(i%5)*.018);
 if(el._ends){const [a,b]=el._ends;el.setAttribute('d',`M${a}L${a[0]+(b[0]-a[0])*n},${a[1]+(b[1]-a[1])*n}`);el.style.opacity=String(n>0?1:0);}
 else el.style.strokeDashoffset=String(lengths[i]*(1-n));
});
svg.style.opacity=String(1-ramp(p,.65,.78));
svg.querySelectorAll('text').forEach(el=>el.style.opacity=String(ramp(p,.3,.5)));
candles.forEach((el,i)=>{const start=.08+(i%17)*.013;el.style.strokeDashoffset=String(candleLengths[i]*(1-ramp(p,start,start+.18)));});
candleGroup.style.opacity=String(1-ramp(p,.56,.72));
formulas.forEach((el,i)=>el.style.opacity=String(ramp(p,.16+i*.018,.32+i*.018)*(1-ramp(p,.6,.73))));
for(const light of lights)light.style.transform=`rotate(${-75+ramp(p,.72,.95)*290}deg)`;
copy.inert=!staticMode&&layout<.6;copy.style.pointerEvents=copy.inert?'none':'auto';
texts.forEach((el,i)=>{const n=staticMode?1:ramp(layout,.35+i*.08,.7+i*.08);el.style.opacity=String(n);el.style.transform=`translateY(${(1-n)*16}px)`;});
scene.dataset.progress=progress.toFixed(3);scene.dataset.layout=layout.toFixed(3);

}
function schedule(){if(!frame)frame=requestAnimationFrame(paint);}
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});reduced.addEventListener('change',schedule);short.addEventListener('change',schedule);paint();
})();
