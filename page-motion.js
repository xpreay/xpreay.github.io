/* Content stays visible without JS. Each entry plays once and respects reduced motion. */
(()=>{
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const active=new Set();
const observer=new IntersectionObserver(entries=>{
 for(const entry of entries){
  if(!entry.isIntersecting)continue;
  const el=entry.target;observer.unobserve(el);
  if(reduced.matches)return;
  const sticker=el.matches('.mentorship-map');
  const frames=sticker?[
   {transform:'perspective(1000px) translateY(36px) rotateX(12deg) rotateZ(-3deg) scale(1.025)',opacity:.2},
   {transform:'perspective(1000px) translateY(0) rotateX(0deg) rotateZ(.4deg) scale(1)',opacity:1,offset:.8},
   {transform:'perspective(1000px) translateY(0) rotateX(0deg) rotateZ(0deg) scale(1)',opacity:1}
  ]:[{transform:'translateY(20px)',opacity:.15},{transform:'translateY(0)',opacity:1}];
  const animation=el.animate(frames,{duration:sticker?750:500,easing:'cubic-bezier(.23,1,.32,1)'});
  active.add(animation);animation.finished.finally(()=>active.delete(animation)).catch(()=>{});
 }
},{threshold:.12});
document.querySelectorAll('.mentorship-map,.mentorship-copy,.home-tools-title,.catalog .tool,.process-steps li,.contact-layout').forEach(el=>observer.observe(el));
reduced.addEventListener('change',()=>{if(reduced.matches){active.forEach(a=>a.finish());active.clear();}});
})();
