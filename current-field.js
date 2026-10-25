/* XPREAY monochrome currents. Independent implementation from observed public behaviour.
   Not React Bits source. Fixed dot matrix samples an animated flow field and local impulses. */
(()=>{
'use strict';
const hero=document.querySelector('.home-hero'),canvas=document.querySelector('#terrain-canvas'),button=document.querySelector('#motion-toggle');
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const config={pattern:0,pitch:8,dotSize:.62,variance:.35,baseDots:.12,stretch:.2,streams:4,spread:.5,speed:.6,direction:0,turbulence:.6,trail:.6,intensity:1,bloom:.6,grain:.2,stir:1,plume:1,scale:1,centerX:.5,centerY:.5};
const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,powerPreference:'low-power'});
function fallback(){canvas.hidden=true;button.hidden=true;hero.dataset.motion='fallback';}
if(!gl){fallback();return;}
const vs=`attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const fs=`precision highp float;
uniform vec2 resolution,cssSize;
uniform float time,intro,pitch,dotSize,variance,baseDots,stretch,streams,spread,direction,turbulence,trail,intensity,bloom,grain,scale,pattern;
uniform vec2 center;
uniform vec3 pointer;
uniform vec2 pointerVelocity;
uniform vec4 impulses[8];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return .57*noise(p)+.28*noise(p*2.03+7.)+.15*noise(p*4.1-4.);}
float field(vec2 pos){
 vec2 p=pos/cssSize.y;float t=time*.14;
 float angle=direction*.0174533;mat2 rotation=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));p=rotation*p*scale;
 vec2 delta=(pos-pointer.xy*cssSize)/cssSize.y;
 float influence=exp(-dot(delta,delta)/.045)*pointer.z;
 // Advect the existing light, never add brightness at the cursor.
 p-=pointerVelocity*influence*.16;
 float curl=(delta.x*pointerVelocity.y-delta.y*pointerVelocity.x);
 p+=vec2(-delta.y,delta.x)*curl*influence*1.6;
 float dye=0.;
 for(int j=0;j<8;j++){
  vec4 imp=impulses[j];float age=max(0.,time-imp.z);
  vec2 d=(pos-imp.xy*cssSize)/cssSize.y-vec2(age*.025,0.);
  float r=.045+age*.024;
  float influence=exp(-dot(d,d)/(r*r))*exp(-age/(1.3+trail*3.))*imp.w;
  p+=vec2(-d.y,d.x)*influence*.8;
  dye+=influence*.75;
 }
 float value=0.;
 for(int i=0;i<16;i++){
  float f=float(i);if(f>=streams)break;
  float line=(f+.5)/streams;
  float x=p.x-t*(.8+f*.09);
  float path=line+.09*sin(x*4.+f*1.9+t*.4)+turbulence*.18*sin(x*7.1+f*3.2-t*.5);
  path+=turbulence*.14*(fbm(vec2(x*4.,f*3.7+t))-.5);
  float distanceTo=abs(p.y-path);
  if(pattern>.5&&pattern<1.5)distanceTo=abs(p.y-line-.12*sin(x*5.+f));
  vec2 c=(pos-center*cssSize)/cssSize.y*scale;
  if(pattern>1.5&&pattern<2.5){float phase=atan(c.y,c.x)+length(c)*5.-t;distanceTo=abs(sin(phase*streams*.5+f*3.14159))/8.;}
  if(pattern>2.5&&pattern<3.5)distanceTo=abs(sin((atan(c.y,c.x)-t*.12)*streams*.5))/8.;
  if(pattern>3.5)distanceTo=abs(fbm(c*2.2+vec2(t*.16,-t*.1))-(f+1.)/(streams+1.))*.7;
  float width=.014+spread*.067;
  float ribbon=exp(-distanceTo*distanceTo/(width*width));
  float packets=.35+.65*pow(.5+.5*sin(x*5.5+f*4.2+fbm(vec2(x*2.,f))*3.),1.2-trail*.6);
  value+=ribbon*packets*(.7+.3*sin(f*1.7+1.));
 }
 return min(1.5,value+dye);
}
void main(){
 vec2 pixel=gl_FragCoord.xy/resolution*cssSize;
 vec2 cell=(floor(pixel/pitch)+.5)*pitch;
 float light=field(cell)*intensity;
 float strength=clamp(light,0.,1.);
 vec2 local=(pixel-cell)/pitch;
 local.x/=1.+strength*stretch;
 float radius=dotSize*.5*mix(1.,.32+.68*strength,variance);
 float aa=cssSize.x/resolution.x/pitch;
 float disc=1.-smoothstep(radius-aa*.7,radius+aa*.7,length(local));
 float brightness=baseDots*.24+strength*.76;
 float halo=exp(-dot(local,local)*8.)*light*bloom*.075;
 float haze=light*bloom*.025;
 float texture=(hash(cell)-.5)*grain*.12*strength;
 float color=.018+intro*(disc*max(0.,brightness+texture)+halo+haze);
 gl_FragColor=vec4(vec3(color),1.);
}`;
let program;
function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
try{program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vs));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}catch(e){console.warn('Currents fallback',e);fallback();return;}
gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const attr=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
const uniforms=Object.fromEntries([...Object.keys(config),'resolution','cssSize','time','intro','center','pointer','pointerVelocity','impulses[0]'].map(k=>[k,gl.getUniformLocation(program,k)]));
const cursor={x:.5,y:.5,tx:.5,ty:.5,power:0,target:0,vx:0,vy:0,dx:0,dy:0};
let w=1,h=1,frame=0,last=0,time=8,entry=0,visible=true,paused=false,lost=false,impulseIndex=0,lastPointer=null,lastStir=0;
const impulses=new Float32Array(32);for(let i=0;i<8;i++)impulses[i*4+2]=-100;
function draw(){
 cursor.power+=(cursor.target-cursor.power)*.055;
 cursor.x+=(cursor.tx-cursor.x)*.065;cursor.y+=(cursor.ty-cursor.y)*.065;
 cursor.vx+=(cursor.dx-cursor.vx)*.18;cursor.vy+=(cursor.dy-cursor.vy)*.18;
 cursor.dx*=.86;cursor.dy*=.86;
 gl.uniform3f(uniforms.pointer,cursor.x,cursor.y,cursor.power);
 gl.uniform2f(uniforms.pointerVelocity,cursor.vx,cursor.vy);
 gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform2f(uniforms.cssSize,w,h);
 gl.uniform1f(uniforms.time,time);gl.uniform1f(uniforms.intro,reduced.matches?1:Math.min(1,entry/1.2));
 gl.uniform2f(uniforms.center,config.centerX,config.centerY);gl.uniform4fv(uniforms['impulses[0]'],impulses);
 for(const [key,value]of Object.entries(config))if(uniforms[key]!==null)gl.uniform1f(uniforms[key],value);
 gl.drawArrays(gl.TRIANGLES,0,3);
}
function canRun(){return visible&&!paused&&!document.hidden&&!reduced.matches&&!lost;}
function tick(now){frame=0;if(!canRun())return;if(!last||now-last>=1000/30){const dt=last?Math.min((now-last)/1000,.1):0;last=now;time+=dt*config.speed;entry+=dt;draw();}frame=requestAnimationFrame(tick);}
function sync(){cancelAnimationFrame(frame);frame=0;last=0;hero.dataset.motion=canRun()?'running':'paused';button.hidden=reduced.matches||lost;if(canRun())frame=requestAnimationFrame(tick);}
function resize(){const r=hero.getBoundingClientRect();w=r.width;h=r.height;const dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1200000/(w*h)));canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));gl.viewport(0,0,canvas.width,canvas.height);if(!lost)draw();}
function plume(x=.5,y=.5,strength=1){if(!canRun())return;const i=(impulseIndex++%8)*4;impulses.set([x,1-y,time,strength],i);hero.dataset.impulses=String(impulseIndex);}
hero.addEventListener('pointermove',e=>{
 if(e.pointerType==='touch'||!canRun())return;
 const r=hero.getBoundingClientRect(),x=(e.clientX-r.left)/w,y=(e.clientY-r.top)/h,now=performance.now();
 cursor.tx=x;cursor.ty=1-y;cursor.target=config.stir;hero.dataset.pointer='active';
 if(lastPointer){const dt=Math.max(.016,(now-lastPointer.now)/1000);cursor.dx=Math.max(-1.5,Math.min(1.5,(x-lastPointer.x)/dt));cursor.dy=Math.max(-1.5,Math.min(1.5,(lastPointer.y-y)/dt));}
 lastPointer={x,y,now};
},{passive:true});
hero.addEventListener('pointerleave',()=>{lastPointer=null;cursor.target=0;hero.dataset.pointer='idle';});
button.addEventListener('click',()=>{paused=!paused;button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'Włącz ruch':'Zatrzymaj ruch';sync();});
new ResizeObserver(resize).observe(hero);new IntersectionObserver(e=>{visible=e[0].isIntersecting;sync();}).observe(hero);document.addEventListener('visibilitychange',sync);
reduced.addEventListener('change',()=>{entry=1.2;if(!lost)draw();sync();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;sync();fallback();});
window.xpreayCurrent={plume,replay(){entry=0;sync();},configure(options){for(const k in config)if(Number.isFinite(options[k]))config[k]=options[k];config.streams=Math.max(1,Math.min(16,config.streams));config.pitch=Math.max(4,config.pitch);if(!lost)draw();},pause(value=true){paused=value;button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'Włącz ruch':'Zatrzymaj ruch';sync();}};
resize();sync();
})();

