import fs from "node:fs";
const B=process.env.ANTHROPIC_BASE_URL,K=process.env.ANTHROPIC_AUTH_TOKEN;
const SS=JSON.parse(fs.readFileSync(process.env.SS_PATH,"utf8"));
const pal=SS.palette;
const FRAMES=["idle","walk1","walk2","walk3","walk4","jump"];
const SCHEMA=`格式（JSON，一次给出全部帧）：
{"format":"drawlist+curve/v1","id":"player","viewBox":[0,0,24,32],"expectedSize":[24,32],
 "states":{"<帧名>":{"ops":[...]} , ...}}
帧名必须是：${FRAMES.join(", ")}
op 只能六种，坐标/尺寸全是数字：
 {"op":"rect","x":n,"y":n,"w":n,"h":n,"fill":"palette:N"}
 {"op":"circle","cx":n,"cy":n,"r":n,"fill":"palette:N"}
 {"op":"ellipse","cx":n,"cy":n,"rx":n,"ry":n,"fill":"palette:N"}
 {"op":"poly","points":[[x,y],...],"fill":"palette:N"}
 {"op":"line","x1":n,"y1":n,"x2":n,"y2":n,"stroke":"palette:N","strokeWidth":n}
 {"op":"curve","points":[[x,y],...],"closed":bool,"fill":"palette:N"}
可加 "stroke":"palette:N","strokeWidth":n,"opacity":n。
fill/stroke 只能是 "palette:N"（N 为色板索引），禁止硬编码 hex。
色板：${pal.map((c,i)=>`${i}:${c}`).join("  ")}`;
const EXAMPLE=`形状示例（一个两帧的最小例子，注意 states 的结构）：
{"format":"drawlist+curve/v1","id":"bot","viewBox":[0,0,16,20],"expectedSize":[16,20],
 "states":{
  "idle":{"ops":[{"op":"rect","x":5,"y":2,"w":6,"h":6,"fill":"palette:4","stroke":"palette:3","strokeWidth":1},
                {"op":"rect","x":4,"y":9,"w":8,"h":7,"fill":"palette:1"},
                {"op":"rect","x":5,"y":16,"w":2,"h":3,"fill":"palette:3"},
                {"op":"rect","x":9,"y":16,"w":2,"h":3,"fill":"palette:3"}]},
  "walk1":{"ops":[{"op":"rect","x":5,"y":2,"w":6,"h":6,"fill":"palette:4","stroke":"palette:3","strokeWidth":1},
                 {"op":"rect","x":4,"y":9,"w":8,"h":7,"fill":"palette:1"},
                 {"op":"rect","x":3,"y":16,"w":2,"h":3,"fill":"palette:3"},
                 {"op":"rect","x":10,"y":16,"w":2,"h":3,"fill":"palette:3"}]}}}
注意上例：两帧的**头和躯干 ops 完全相同**，只有腿的 x 坐标变了。这就是帧间一致性。`;
const STYLE=`参考图视觉语法（必须遵守）：
identity: ${JSON.stringify(SS.identity)}
shapeLanguage: ${JSON.stringify(SS.shapeLanguage)}
material: ${JSON.stringify(SS.material)}
characterStyle: ${JSON.stringify(SS.characterStyle)}
constraints: ${JSON.stringify(SS.constraints)}`;
const TASK=`为横版跳跃游戏生成**一个**玩家角色的完整动画帧集。

**帧间一致性是硬性要求**：六帧必须是同一个角色 ——
相同的头、躯干、配色、部件尺寸与描边；帧与帧之间**只允许腿和手臂的位置/角度变化**。
walk1→walk4 是一个循环走路周期（左腿前 → 过渡 → 右腿前 → 过渡），
首尾相接要能无缝循环。jump 是收腿腾空姿态。idle 是站立。
建议：先把头和躯干的 ops 写定，然后在每一帧里**原样复用**，只改四肢。

角色设计（必须全部满足）：
- 像素风**人物**，~3 头身，轮廓清晰，带 1px 深色描边（palette:3）
- **必须有脸**：头部至少两个 1×1 的深色眼睛像素
- **必须有手臂**，且走路时手臂与腿**反向摆动**（左腿前则右臂前）
- 身上有一块 CRT 发光感小屏幕（palette:7）**和一块可见的橙色标识**（palette:6，至少 2×2，别只画 1 像素）
- 头戴一顶帽子或头盔（palette:5 或 6），增加剪影辨识度
- 每帧 12-18 个 op，不要少于 12
只输出 JSON 本体。`;
const body={model:"deepseek-v4-pro",max_tokens:9000,thinking:{type:"disabled"},
  messages:[{role:"user",content:`${STYLE}\n\n${SCHEMA}\n\n${EXAMPLE}\n\n${TASK}`}]}
  ;
const t0=Date.now();
const r=await fetch(`${B}/v1/chat/completions`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${K}`},body:JSON.stringify(body)});
const j=await r.json();
const u=j.usage||{};
console.log(`HTTP ${r.status}  ${((Date.now()-t0)/1000).toFixed(1)}s  out=${u.completion_tokens} reason=${u.completion_tokens_details?.reasoning_tokens??0} finish=${j.choices?.[0]?.finish_reason}`);
const txt=(j.choices?.[0]?.message?.content||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
let o; try{o=JSON.parse(txt)}catch(e){console.log("PARSE FAIL:",e.message,"\n",txt.slice(0,500));process.exit(1)}
if(!o.states){ console.log("缺 states 键。顶层键:",Object.keys(o)); process.exit(1); }
fs.writeFileSync("/tmp/an/player.raw.json",JSON.stringify(o,null,1));
// 校验 + 一致性指标
const OPS={rect:["x","y","w","h"],circle:["cx","cy","r"],ellipse:["cx","cy","rx","ry"],line:["x1","y1","x2","y2"],poly:["points"],curve:["points"]};
const bounds=ops=>{let a=1e9,b=1e9,c=-1e9,d=-1e9;const p=(x,y)=>{x=+x;y=+y;if(x<a)a=x;if(y<b)b=y;if(x>c)c=x;if(y>d)d=y;};
 for(const op of ops){const s=(op.strokeWidth||0)/2;
  if(op.op==="rect"){p(op.x-s,op.y-s);p(op.x+op.w+s,op.y+op.h+s);}
  else if(op.op==="circle"){p(op.cx-op.r-s,op.cy-op.r-s);p(op.cx+op.r+s,op.cy+op.r+s);}
  else if(op.op==="ellipse"){p(op.cx-op.rx-s,op.cy-op.ry-s);p(op.cx+op.rx+s,op.cy+op.ry+s);}
  else if(op.op==="line"){p(op.x1-s,op.y1-s);p(op.x2+s,op.y2+s);}
  else if(op.points)for(const q of op.points)p(q[0]-s,q[1]-s);}
 return isFinite(a)?{w:+(c-a).toFixed(1),h:+(d-b).toFixed(1)}:null;};
console.log("\n帧        ops  包围盒    用色索引            schema");
let allOK=true;
for(const f of FRAMES){
  const st=o.states[f];
  if(!st||!Array.isArray(st.ops)){console.log(`${f.padEnd(9)} 缺!`);allOK=false;continue;}
  const errs=[];
  st.ops.forEach((op,i)=>{ if(!OPS[op.op])errs.push(`ops[${i}].op=${op.op}`);
    for(const k of (OPS[op.op]||[])) if(k!=="points"&&typeof op[k]!=="number")errs.push(`ops[${i}].${k}`);
    if(op.fill&&!/^palette:\d+$/.test(op.fill))errs.push(`ops[${i}].fill`);
    if(op.stroke&&!/^palette:\d+$/.test(op.stroke))errs.push(`ops[${i}].stroke`);});
  const used=[...new Set(st.ops.flatMap(x=>[x.fill,x.stroke].filter(v=>v&&v!=="none").map(v=>+v.split(":")[1])))].sort((a,b)=>a-b);
  const bb=bounds(st.ops);
  console.log(`${f.padEnd(9)} ${String(st.ops.length).padStart(3)}  ${bb?`${bb.w}×${bb.h}`:"?"}   ${used.join(",").padEnd(18)}  ${errs.length?"✗ "+errs.slice(0,2).join(";"):"✓"}`);
  if(errs.length)allOK=false;
  fs.writeFileSync(`/tmp/an/frame.${f}.json`,JSON.stringify({...o,states:undefined,ops:st.ops},null,1));
}
console.log(`\n${allOK?"✓ 六帧全部通过 schema":"✗ 有帧未通过"}`);
