import fs from "node:fs";
const B=process.env.ANTHROPIC_BASE_URL, K=process.env.ANTHROPIC_AUTH_TOKEN;
const SS=JSON.parse(fs.readFileSync("/tmp/gen/stylespec.json","utf8"));
const pal=SS.palette;
const SCHEMA=`drawlist+curve/v1 格式（JSON）：
{"format":"drawlist+curve/v1","id":"<资产id>","state":"<状态名>","viewBox":[0,0,W,H],"expectedSize":[W,H],"ops":[...]}
op 只能是以下六种之一，所有坐标/尺寸必须是数字：
 {"op":"rect","x":n,"y":n,"w":n,"h":n,"fill":"palette:N"}
 {"op":"circle","cx":n,"cy":n,"r":n,"fill":"palette:N"}
 {"op":"ellipse","cx":n,"cy":n,"rx":n,"ry":n,"fill":"palette:N"}
 {"op":"poly","points":[[x,y],...],"fill":"palette:N"}
 {"op":"line","x1":n,"y1":n,"x2":n,"y2":n,"stroke":"palette:N","strokeWidth":n}
 {"op":"curve","points":[[x,y],...],"closed":bool,"fill":"palette:N"}
可加 "stroke":"palette:N","strokeWidth":n,"opacity":n(0-1)。
**fill/stroke 只能是 "palette:N"（N 是色板索引数字），绝对禁止硬编码 hex。**
色板（索引 → 颜色）：${pal.map((c,i)=>`${i}:${c}`).join("  ")}
完整示例（形状必须长这样，ops 在顶层，不要包在任何外层键里）：
{"format":"drawlist+curve/v1","id":"crate","state":"idle","viewBox":[0,0,24,24],"expectedSize":[24,24],
 "ops":[{"op":"rect","x":2,"y":2,"w":20,"h":20,"fill":"palette:2","stroke":"palette:3","strokeWidth":1},
        {"op":"line","x1":2,"y1":12,"x2":22,"y2":12,"stroke":"palette:3","strokeWidth":1},
        {"op":"curve","points":[[6,6],[12,4],[18,6]],"closed":false,"stroke":"palette:5","strokeWidth":1}]}
只输出这个形状的 JSON。`;
const STYLE=`参考图的视觉语法（必须遵守）：
identity: ${JSON.stringify(SS.identity)}
shapeLanguage: ${JSON.stringify(SS.shapeLanguage)}
material: ${JSON.stringify(SS.material)}
characterStyle: ${JSON.stringify(SS.characterStyle)}
constraints: ${JSON.stringify(SS.constraints)}`;
const ASSETS=[
 {id:"player",state:"idle",vb:[0,0,24,32],desc:"横版跳跃游戏的玩家角色，站立姿态。像素风小人，正面或侧面，轮廓清晰，带 1px 深色描边。"},
 {id:"player",state:"jump",vb:[0,0,24,32],desc:"同一个玩家角色的跳跃姿态：腿收起、手臂上扬。必须与 idle 是同一个角色。"},
 {id:"platform",state:"idle",vb:[0,0,64,16],desc:"可站立的地面/平台砖块，横向可平铺。顶部有受光面，侧面有磨损与锈迹质感。"},
 {id:"pickup",state:"idle",vb:[0,0,16,16],desc:"可拾取物：一个能量罐/电池，带 CRT 发光感的屏幕小块。轮廓清晰。"},
 {id:"hazard",state:"idle",vb:[0,0,32,12],desc:"尖刺障碍，一排三角形尖刺，硬边，带深色描边。"},
 {id:"bg_sign",state:"idle",vb:[0,0,48,32],desc:"背景墙上的告示牌/屏幕模块：嵌套面板框 + 一块发光小屏幕 + 几行假文字条。"}
];
const OPS={rect:["x","y","w","h"],circle:["cx","cy","r"],ellipse:["cx","cy","rx","ry"],line:["x1","y1","x2","y2"],poly:["points"],curve:["points"]};
function validate(o){
  const e=[]; if(!o||typeof o!=="object")return["非对象"];
  if(o.format!=="drawlist+curve/v1")e.push("format 错");
  if(!Array.isArray(o.ops))return[..."ops 不是数组"];
  o.ops.forEach((op,i)=>{
    if(!OPS[op.op])return e.push(`ops[${i}].op=${op.op} 非法`);
    for(const f of OPS[op.op]) if(f!=="points"&&typeof op[f]!=="number") e.push(`ops[${i}].${f} 非数字`);
    if(op.op!=="line"){ if(op.fill&&!/^palette:\d+$/.test(op.fill)) e.push(`ops[${i}].fill=${op.fill} 硬编码`); }
    if(op.stroke&&!/^palette:\d+$/.test(op.stroke)) e.push(`ops[${i}].stroke=${op.stroke} 硬编码`);
  });
  return e;
}
function bounds(o){let a=1e9,b=1e9,c=-1e9,d=-1e9;const p=(x,y)=>{x=+x;y=+y;if(x<a)a=x;if(y<b)b=y;if(x>c)c=x;if(y>d)d=y;};
 for(const op of o.ops||[]){const s=(op.strokeWidth||0)/2;
  if(op.op==="rect"){p(op.x-s,op.y-s);p(op.x+op.w+s,op.y+op.h+s);}
  else if(op.op==="circle"){p(op.cx-op.r-s,op.cy-op.r-s);p(op.cx+op.r+s,op.cy+op.r+s);}
  else if(op.op==="ellipse"){p(op.cx-op.rx-s,op.cy-op.ry-s);p(op.cx+op.rx+s,op.cy+op.ry+s);}
  else if(op.op==="line"){p(op.x1-s,op.y1-s);p(op.x2+s,op.y2+s);}
  else if(op.points)for(const q of op.points)p(q[0]-s,q[1]-s);}
 return isFinite(a)?{w:+(c-a).toFixed(1),h:+(d-b).toFixed(1)}:null;}
function roundness(o){const r=(o.ops||[]).filter(x=>["curve","circle","ellipse"].includes(x.op)).length;
 return {round:r,total:(o.ops||[]).length,pct:(o.ops||[]).length?Math.round(100*r/(o.ops||[]).length):0};}
function svg(o){
  const C=s=>pal[+s.split(":")[1]]||"#f0f";
  const body=(o.ops||[]).map(op=>{
    const f=op.fill&&op.fill!=="none"?` fill="${C(op.fill)}"`:' fill="none"';
    const st=op.stroke?` stroke="${C(op.stroke)}" stroke-width="${op.strokeWidth||1}" stroke-linecap="round"`:"";
    const oq=op.opacity!=null?` opacity="${op.opacity}"`:"";
    switch(op.op){
      case"rect":return `<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}"${f}${st}${oq}/>`;
      case"circle":return `<circle cx="${op.cx}" cy="${op.cy}" r="${op.r}"${f}${st}${oq}/>`;
      case"ellipse":return `<ellipse cx="${op.cx}" cy="${op.cy}" rx="${op.rx}" ry="${op.ry}"${f}${st}${oq}/>`;
      case"poly":return `<polygon points="${op.points.map(q=>q.join(",")).join(" ")}"${f}${st}${oq}/>`;
      case"line":return `<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}"${st}${oq}/>`;
      case"curve":return `<path d="${catmull(op.points,op.closed)}"${f}${st}${oq}/>`;
    }}).join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${o.viewBox.join(" ")}" width="${o.viewBox[2]*6}" height="${o.viewBox[3]*6}" style="image-rendering:pixelated">\n  ${body}\n</svg>`;
}
function catmull(P,closed){
  let d=`M${P[0][0]} ${P[0][1]}`;
  for(let i=0;i<P.length-1;i++){const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||p2;
    d+=` C${(p1[0]+(p2[0]-p0[0])/6).toFixed(2)} ${(p1[1]+(p2[1]-p0[1])/6).toFixed(2)}, ${(p2[0]-(p3[0]-p1[0])/6).toFixed(2)} ${(p2[1]-(p3[1]-p1[1])/6).toFixed(2)}, ${p2[0]} ${p2[1]}`;}
  return closed?d+" Z":d;
}
async function gen(a){
  const body={model:"deepseek-v4-pro",max_tokens:4000,thinking:{type:"disabled"},
    messages:[{role:"user",content:`${STYLE}\n\n${SCHEMA}\n\n为以下资产生成 drawlist：\nid=${a.id} state=${a.state} viewBox=${JSON.stringify(a.vb)}\n描述：${a.desc}\nviewBox 与 expectedSize 都用 ${JSON.stringify(a.vb.slice(2))}。`}]}
  const t0=Date.now();
  const r=await fetch(`${B}/v1/chat/completions`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${K}`},body:JSON.stringify(body)});
  const j=await r.json();
  const txt=(j.choices?.[0]?.message?.content||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
  const dt=((Date.now()-t0)/1000).toFixed(1);
  let o=null,err=null; try{o=JSON.parse(txt)}catch(e){err=e.message}
  if(o){ if(Array.isArray(o.drawlist)&&!Array.isArray(o.ops)) o.ops=o.drawlist;
         o.format=o.format||"drawlist+curve/v1"; o.id=o.id||a.id; o.state=o.state||a.state;
         o.viewBox=o.viewBox||a.vb; o.expectedSize=o.expectedSize||a.vb.slice(2); }
  if(!o) return {a,ok:false,dt,err:"JSON 解析失败: "+err,raw:txt.slice(0,200)};
  const ve=validate(o);
  fs.writeFileSync(`/tmp/gen/${a.id}.${a.state}.json`,JSON.stringify(o,null,1));
  return {a,o,ve,dt,ok:true,bounds:bounds(o),round:roundness(o),used:new Set((o.ops||[]).flatMap(x=>[x.fill,x.stroke].filter(v=>v&&v!=="none").map(v=>+v.split(":")[1])))};
}
const t=Date.now();
const res=await Promise.all(ASSETS.map(gen));
console.log(`总耗时 ${((Date.now()-t)/1000).toFixed(0)}s（5 路并行）\n`);
let okc=0; const svgs=[];
for(const r of res){
  const n=`${r.a.id}/${r.a.state}`;
  if(!r.ok){ console.log(`✗ ${n.padEnd(16)} ${r.err}  raw=${r.raw}`); continue; }
  if(r.ve.length){ console.log(`✗ ${n.padEnd(16)} ${r.dt.padStart(4)}s  schema: ${r.ve.slice(0,2).join("; ")}`); svgs.push({n,svg:svg(r.o),o:r.o,ve:r.ve}); continue; }
  const good=r.ve.length===0; if(good)okc++;
  console.log(`${good?"✓":"✗"} ${n.padEnd(16)} ${r.dt.padStart(5)}s  ops=${String(r.o.ops.length).padStart(2)}  包围盒=${r.bounds?`${r.bounds.w}×${r.bounds.h}`:"?"}  圆润op=${r.round.pct}%  用色=${[...r.used].sort((a,b)=>a-b).join(",")}${r.ve.length?"  ERR:"+r.ve[0]:""}`);
  svgs.push({n,svg:svg(r.o),o:r.o,ve:r.ve});
}
console.log(`\nschema 通过 ${okc}/${res.length}`);
// 生成查看页
const ref=fs.readFileSync("/tmp/gen/ref.b64","utf8").trim();
const html=`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>风格迁移实验：test.png → 横版跳跃资源</title>
<style>body{margin:0;padding:28px;background:#14181a;color:#dfe6e2;font:14px/1.6 -apple-system,"PingFang SC",sans-serif}
h1{font-size:20px;margin:0 0 4px} .sub{color:#8b9a94;font-size:13px;margin-bottom:20px}
.ref{border:1px solid #2c3538;border-radius:6px;overflow:hidden;margin-bottom:26px}
.ref img{width:100%;display:block;image-rendering:pixelated}
.ref .cap{padding:8px 12px;background:#1b2124;font-size:12px;color:#8b9a94}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}
.c{background:#1b2124;border:1px solid #2c3538;border-radius:6px;overflow:hidden}
.c .st{display:flex;align-items:center;justify-content:center;min-height:190px;background:repeating-conic-gradient(#20272a 0% 25%,#181e21 0% 50%) 50%/18px 18px}
.c h3{margin:0;padding:9px 12px;font-size:13px;border-bottom:1px solid #2c3538;background:#171c1f}
.c h3 .b{color:#69d6a8}.c h3 .r{color:#e07a6a}
.c pre{margin:0;padding:9px 12px;font:10.5px/1.45 ui-monospace,Menlo,monospace;color:#7d8b86;max-height:130px;overflow:auto;white-space:pre-wrap}
.pal{display:flex;gap:4px;margin:10px 0 22px}
.pal div{flex:1;text-align:center;font:10px ui-monospace,monospace;color:#8b9a94}
.pal span{display:block;height:34px;border-radius:3px;margin-bottom:3px}</style></head><body>
<h1>风格迁移实验：参考图 → 横版跳跃游戏资源</h1>
<div class="sub">链路：test.png →（qwen3.8-max 视觉）StyleSpec →（deepseek-v4-pro 文本）drawlist → SVG 渲染。全程无人工修图。</div>
<div class="ref"><img src="data:image/png;base64,${ref}"><div class="cap">参考图 fixtures/reference/test.png · 1218×685 · 提取色板见下</div></div>
<div class="pal">${pal.map((c,i)=>`<div><span style="background:${c}"></span>${i}</div>`).join("")}</div>
<div class="grid">${svgs.map(s=>`<div class="c"><h3>${s.n} <span class="${s.ve.length?"r":"b"}">${s.ve.length?"schema 报错":"schema 通过"}</span></h3><div class="st">${s.svg}</div><pre>${JSON.stringify(s.o.ops,null,0).slice(0,700)}</pre></div>`).join("")}</div>
</body></html>`;
fs.writeFileSync("/tmp/gen/view.html",html);
console.log("查看页: /tmp/gen/view.html");
