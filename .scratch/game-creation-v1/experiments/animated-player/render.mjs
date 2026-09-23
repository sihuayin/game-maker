import fs from "node:fs";
const SS=JSON.parse(fs.readFileSync(process.env.SS_PATH,"utf8"));
const pal=SS.palette;
const FR=JSON.parse(fs.readFileSync("/tmp/an/player.raw.json","utf8"));
const FRAMES=["idle","walk1","walk2","walk3","walk4","jump"];
const C=s=>pal[+s.split(":")[1]]||"#f0f";
const catmull=(P,closed)=>{let d=`M${P[0][0]} ${P[0][1]}`;for(let i=0;i<P.length-1;i++){const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||p2;
 d+=` C${(p1[0]+(p2[0]-p0[0])/6).toFixed(2)} ${(p1[1]+(p2[1]-p0[1])/6).toFixed(2)}, ${(p2[0]-(p3[0]-p1[0])/6).toFixed(2)} ${(p2[1]-(p3[1]-p1[1])/6).toFixed(2)}, ${p2[0]} ${p2[1]}`;}return closed?d+" Z":d;};
const body=ops=>ops.map(op=>{
 const f=op.fill&&op.fill!=="none"?` fill="${C(op.fill)}"`:' fill="none"';
 const st=op.stroke?` stroke="${C(op.stroke)}" stroke-width="${op.strokeWidth||1}" stroke-linecap="round"`:"";
 const oq=op.opacity!=null?` opacity="${op.opacity}"`:"";
 switch(op.op){case"rect":return`<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}"${f}${st}${oq}/>`;
 case"circle":return`<circle cx="${op.cx}" cy="${op.cy}" r="${op.r}"${f}${st}${oq}/>`;
 case"ellipse":return`<ellipse cx="${op.cx}" cy="${op.cy}" rx="${op.rx}" ry="${op.ry}"${f}${st}${oq}/>`;
 case"poly":return`<polygon points="${op.points.map(q=>q.join(",")).join(" ")}"${f}${st}${oq}/>`;
 case"line":return`<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}"${st}${oq}/>`;
 case"curve":return`<path d="${catmull(op.points,op.closed)}"${f}${st}${oq}/>`;}}).join("");
const VB=FR.viewBox, S=8, CW=VB[2]*S+30, CH=VB[3]*S+60;
const W=CW*FRAMES.length+30, H=CH+70;
let x=15;
const cells=FRAMES.map(f=>{
 const g=`<g transform="translate(${x+15},${30}) scale(${S})">${body(FR.states[f].ops)}</g>`;
 const fr=`<rect x="${x}" y="20" width="${CW-14}" height="${CH-24}" fill="#1b2124" stroke="#2c3538"/>`;
 const lb=`<text x="${x+(CW-14)/2}" y="${CH+16}" text-anchor="middle" font-family="Menlo,monospace" font-size="16" fill="#a8b5ae">${f}</text>`;
 x+=CW; return fr+g+lb;}).join("");
const sw=pal.map((c,i)=>`<rect x="${15+i*40}" y="${H-36}" width="36" height="26" fill="${c}"/><text x="${15+i*40+18}" y="${H-12}" text-anchor="middle" font-family="Menlo,monospace" font-size="12" fill="#8b9a94">${i}</text>`).join("");
fs.writeFileSync("/tmp/an/sheet.svg",`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#171c1f"/>${cells}${sw}</svg>`);
console.log("sheet.svg",W+"x"+H);
// 动画预览页：循环播放 walk1-4，可切速度/单帧/看全部
const framesJson=JSON.stringify(Object.fromEntries(FRAMES.map(f=>[f,FR.states[f].ops])));
const html=`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>玩家走路动画预览</title>
<style>body{margin:0;padding:26px;background:#14181a;color:#dfe6e2;font:14px/1.6 -apple-system,"PingFang SC",sans-serif}
h1{font-size:19px;margin:0 0 3px}.sub{color:#8b9a94;font-size:12.5px;margin-bottom:18px}
.stage{display:flex;gap:26px;align-items:flex-end;flex-wrap:wrap}
.box{background:#1b2124;border:1px solid #2c3538;border-radius:6px;padding:14px;text-align:center}
.box .cap{font:12px Menlo,monospace;color:#8b9a94;margin-top:8px}
canvas{image-rendering:pixelated;background:repeating-conic-gradient(#20272a 0% 25%,#181e21 0% 50%) 50%/16px 16px}
button{background:#242c30;border:1px solid #38464b;color:#dfe6e2;border-radius:4px;padding:6px 12px;font:13px inherit;cursor:pointer;margin:3px}
button.on{background:#3f6b57;border-color:#69d6a8}
.row{margin:16px 0}</style></head><body>
<h1>玩家角色 · 走路循环动画</h1>
<div class="sub">test.png 风格 → 单次调用生成六帧 · 左：循环播放 · 右：六帧全览</div>
<div class="row">
 <button id="bPlay" class="on">▶ 播放</button><button id="bStop">■ 停</button>
 <button data-fps="4">4 fps</button><button data-fps="8" class="on">8 fps</button><button data-fps="12">12 fps</button>
 <button id="bPrev">◀ 上一帧</button><button id="bNext">下一帧 ▶</button>
</div>
<div class="stage">
 <div class="box"><canvas id="anim" width="192" height="256"></canvas><div class="cap" id="cap">walk1</div></div>
 <div class="box"><canvas id="all" width="1200" height="256"></canvas><div class="cap">idle / walk1-4 / jump</div></div>
</div>
<script>
const PAL=${JSON.stringify(pal)}, FR=${framesJson}, NAMES=${JSON.stringify(FRAMES)};
const C=s=>PAL[+s.split(":")[1]]||"#f0f";
function catmull(x,P,closed){x.beginPath();x.moveTo(P[0][0],P[0][1]);
 for(let i=0;i<P.length-1;i++){const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||p2;
  x.bezierCurveTo(p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6,p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6,p2[0],p2[1]);}
 if(closed)x.closePath();}
function draw(x,ops,S,ox,oy){x.save();x.translate(ox,oy);x.scale(S,S);
 for(const op of ops){const F=op.fill&&op.fill!=="none"?C(op.fill):null,S2=op.stroke?C(op.stroke):null;
  x.globalAlpha=op.opacity!=null?op.opacity:1;
  if(op.op==="rect"){if(F){x.fillStyle=F;x.fillRect(op.x,op.y,op.w,op.h);}}
  else if(op.op==="circle"){if(F){x.fillStyle=F;x.beginPath();x.arc(op.cx,op.cy,op.r,0,7);x.fill();}}
  else if(op.op==="ellipse"){if(F){x.fillStyle=F;x.beginPath();x.ellipse(op.cx,op.cy,op.rx,op.ry,0,0,7);x.fill();}}
  else if(op.op==="poly"){if(F){x.fillStyle=F;x.beginPath();op.points.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath();x.fill();}}
  else if(op.op==="line"){if(S2){x.strokeStyle=S2;x.lineWidth=op.strokeWidth||1;x.lineCap="round";x.beginPath();x.moveTo(op.x1,op.y1);x.lineTo(op.x2,op.y2);x.stroke();}}
  else if(op.op==="curve"){if(S2){x.strokeStyle=S2;x.lineWidth=op.strokeWidth||1;x.lineCap="round";catmull(x,op.points,op.closed);x.stroke();}
   if(F){x.fillStyle=F;catmull(x,op.points,op.closed);x.fill();}}
  x.globalAlpha=1;}
 x.restore();}
const a=document.getElementById("anim").getContext("2d"), al=document.getElementById("all").getContext("2d");
const WALK=["walk1","walk2","walk3","walk4"];
let i=0,fps=8,playing=true,cur=null,timer=null;
function frame(){cur=cur||WALK[0];a.clearRect(0,0,192,256);draw(a,FR[cur],8,0,0);document.getElementById("cap").textContent=cur+"  ("+(WALK.indexOf(cur)+1)+"/4)";}
function tick(){i=(i+1)%WALK.length;cur=WALK[i];frame();}
function loop(){clearInterval(timer);if(playing)timer=setInterval(tick,1000/fps);}
al.clearRect(0,0,1200,256);NAMES.forEach((n,k)=>draw(al,FR[n],8,k*200,0));
document.getElementById("bPlay").onclick=()=>{playing=true;loop();};
document.getElementById("bStop").onclick=()=>{playing=false;clearInterval(timer);};
document.getElementById("bNext").onclick=()=>{playing=false;clearInterval(timer);i=(i+1)%WALK.length;cur=WALK[i];frame();};
document.getElementById("bPrev").onclick=()=>{playing=false;clearInterval(timer);i=(i+3)%WALK.length;cur=WALK[i];frame();};
document.querySelectorAll("[data-fps]").forEach(b=>b.onclick=()=>{fps=+b.dataset.fps;
 document.querySelectorAll("[data-fps]").forEach(x=>x.classList.toggle("on",x===b));loop();});
frame();loop();
</script></body></html>`;
fs.writeFileSync("/tmp/an/anim.html",html);
console.log("anim.html 已生成");
