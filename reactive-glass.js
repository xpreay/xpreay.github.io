/* Pointer-position highlights on small navigation surfaces; no idle animation. */
(()=>{
const fine=matchMedia('(hover:hover) and (pointer:fine)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
document.querySelectorAll('.social-links a,.site-header .theme-toggle,.menu-launch').forEach(el=>{
let frame=0,x=0,y=0;
function paint(){frame=0;el.style.setProperty('--light-x',x+'px');el.style.setProperty('--light-y',y+'px');}
el.addEventListener('pointermove',e=>{if(!fine.matches||reduced.matches)return;const r=el.getBoundingClientRect();x=e.clientX-r.left;y=e.clientY-r.top;if(!frame)frame=requestAnimationFrame(paint);},{passive:true});
el.addEventListener('pointerleave',()=>{cancelAnimationFrame(frame);frame=0;el.style.removeProperty('--light-x');el.style.removeProperty('--light-y');});
});
})();

/* Direction-aware mobile navigation. One interruptible spring retains velocity. */
(()=>{
const button=document.querySelector('.menu-launch'),dialog=document.querySelector('#mobile-menu');
if(!button||!dialog)return;
const mobile=matchMedia('(max-width:800px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
let lastY=scrollY,travel=0,direction=0,target=1,value=1,velocity=0,frame=0,lastTime=0;
function draw(){
 const visible=Math.max(0,Math.min(1,value));
 button.style.opacity=String(visible);
 button.style.transform=`translateY(${(1-value)*22}px) scale(${.9+value*.1})`;
 button.style.filter=`blur(${(1-visible)*4}px)`;
 button.style.pointerEvents=target?'auto':'none';
}
function tick(time){
 const dt=Math.min((time-lastTime)/1000,.032);lastTime=time;
 velocity+=(240*(target-value)-28*velocity)*dt;value+=velocity*dt;draw();
 if(Math.abs(target-value)>.001||Math.abs(velocity)>.01)frame=requestAnimationFrame(tick);
 else{value=target;velocity=0;draw();frame=0;}
}
function show(next){
 if(next===target)return;
 target=next;button.dataset.scrollHidden=String(!next);
 button.classList.toggle('glass-return',Boolean(next));
 if(!frame){lastTime=performance.now();frame=requestAnimationFrame(tick);}
}
function reset(){cancelAnimationFrame(frame);frame=0;target=value=1;velocity=0;travel=0;lastY=scrollY;button.dataset.scrollHidden='false';button.classList.remove('glass-return');draw();}
addEventListener('scroll',()=>{
 const y=Math.max(0,Math.min(scrollY,document.documentElement.scrollHeight-innerHeight)),delta=y-lastY;lastY=y;
 if(!mobile.matches||reduced.matches)return;
 if(dialog.open||button.matches(':focus-visible')||y<80){travel=0;show(1);return;}
 if(Math.abs(delta)<1)return;
 const sign=Math.sign(delta);if(sign!==direction){direction=sign;travel=0;}
 travel+=Math.abs(delta);
 if(sign>0&&travel>36)show(0);
 if(sign<0&&travel>12)show(1);
},{passive:true});
button.addEventListener('focus',()=>show(1));
dialog.addEventListener('close',reset);
mobile.addEventListener('change',reset);reduced.addEventListener('change',reset);
})();
