/* Desktop: the glass Menu button appears top-right once the header scrolls out of view. */
(()=>{
const button=document.querySelector('.menu-launch'),header=document.querySelector('.site-header'),dialog=document.querySelector('#mobile-menu');
if(!button||!header||!dialog||!('IntersectionObserver' in window))return;
const desktop=matchMedia('(min-width:801px)'),root=document.documentElement;
let headerVisible=true;
function update(){
 const show=desktop.matches&&(!headerVisible||dialog.open);
 if(show===root.classList.contains('desk-menu-on'))return;
 root.classList.toggle('desk-menu-on',show);
 button.classList.remove('glass-return');
 if(show){void button.offsetWidth;button.classList.add('glass-return');}
}
new IntersectionObserver(([e])=>{headerVisible=e.isIntersecting;update();},{threshold:0}).observe(header);
desktop.addEventListener('change',update);
dialog.addEventListener('close',update);
dialog.addEventListener('click',e=>{if(!desktop.matches||e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
})();
