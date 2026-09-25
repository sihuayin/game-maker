// 把三个候选 + 它们的**真实提取结果**拼成一个自包含 HTML。
// 单文件、双击即开（图片与数据都内联）—— 不需要起 server，因为这不是产品页面，是给人看的一张纸。
import fs from "node:fs";
import { PALETTE } from "./generate.mjs";

const ex = JSON.parse(fs.readFileSync("out/extractions.json", "utf8"));
const b64 = (v) => fs.readFileSync(`out/ref-${v}.png`).toString("base64");
const hex = (c) => "#" + c.map((n) => n.toString(16).padStart(2, "0")).join("");
const OWN = Object.values(PALETTE).map(hex);

const NAMES = { A: "正交侧视单景", B: "等距俯视", C: "分层剖面" };
const NOTES = {
  A: "一条地平线，天空/山/站台/轨道四段横切。最接近现有参考图的构图。",
  B: "斜穿的地面 + 等距盒子建筑 + 树。深度层次最丰富，但元素最少「正交」。",
  C: "三条横向带（天空 / 候车室内景 / 站台），每带一套光照。空间层次最清楚。",
};

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const list = (a) => (a || []).map((x) => `<li>${esc(x)}</li>`).join("");
const kv = (o) => Object.entries(o || {}).map(([k, v]) => `<div><b>${esc(k)}</b> ${esc(v)}</div>`).join("");

function card(v) {
  const e = ex[v], s = e.spec;
  const pal = (s.palette || []).map((h) => {
    const own = OWN.includes(h.toLowerCase());
    return `<span class="sw" style="background:${h}" title="${h}${own ? " · 图上真实存在" : " · 图上没有这个精确值"}"></span>`;
  }).join("");
  return `<section class="card" data-v="${v}">
  <div class="left">
    <img src="data:image/png;base64,${b64(v)}" alt="候选 ${v}">
    <div class="own"><span class="lbl">本图真实色板（18 色，每像素都恰好是其中之一）</span>
      ${OWN.map((h) => `<span class="sw own-sw" style="background:${h}" title="${h}"></span>`).join("")}</div>
  </div>
  <div class="right">
    <h2>${v} · ${NAMES[v]}</h2>
    <p class="note">${NOTES[v]}</p>
    <p class="meta">提取耗时 ${(e.ms / 1000).toFixed(1)}s · 过 schema <b class="${e.schemaOk ? "ok" : "bad"}">${e.schemaOk ? "✅" : "❌"}</b> · 报出 ${(s.palette || []).length} 色</p>
    <div class="pal">${pal}</div>
    <div class="grid">
      <div><span class="lbl">identity</span><ul>${list(s.identity)}</ul></div>
      <div><span class="lbl">camera</span>${kv(s.camera)}</div>
      <div><span class="lbl">composition</span>${kv(s.composition)}</div>
      <div><span class="lbl">lighting</span>${kv(s.lighting)}</div>
      <div><span class="lbl">shapeLanguage</span><ul>${list(s.shapeLanguage)}</ul></div>
      <div><span class="lbl">material</span><ul>${list(s.material)}</ul></div>
      <div><span class="lbl">environment</span><ul>${list(s.environment)}</ul></div>
      <div><span class="lbl">characterStyle</span><ul>${list(s.characterStyle)}</ul></div>
      <div class="wide"><span class="lbl">constraints</span><ul>${list(s.constraints)}</ul></div>
    </div>
  </div></section>`;
}

const html = `<!doctype html><meta charset="utf-8">
<title>原型 · 票 04 参考图候选（一次性，勿当真）</title>
<style>
 body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;background:#14171c;color:#dfe3e8;padding:20px 20px 92px}
 h1{font-size:17px;margin:0 0 4px} .sub{color:#8d96a3;margin:0 0 16px;font-size:13px}
 .card{display:none;gap:22px;grid-template-columns:minmax(360px,44%) 1fr;background:#1b1f26;border:1px solid #2b313b;border-radius:10px;padding:18px}
 .card.on{display:grid}
 img{width:100%;image-rendering:pixelated;border-radius:6px;border:1px solid #2b313b;background:#000}
 h2{font-size:15px;margin:0 0 6px} .note{color:#9aa4b2;margin:0 0 6px;font-size:13px}
 .meta{color:#8d96a3;font-size:12px;margin:0 0 10px}
 .ok{color:#5fce8a}.bad{color:#e0685f}
 .lbl{display:block;color:#7f8a99;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:8px 0 3px}
 .pal{display:flex;gap:3px;margin:6px 0 12px}
 .sw{width:26px;height:26px;border-radius:4px;border:1px solid #333a45;display:inline-block}
 .own{display:flex;gap:3px;align-items:center;margin-top:8px;flex-wrap:wrap}
 .own .lbl{width:100%;margin-bottom:5px}
 .own-sw{width:18px;height:18px}
 .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}
 .grid .wide{grid-column:1/-1}
 ul{margin:0;padding-left:16px} li{font-size:13px;color:#c3cad4}
 .grid div{color:#c3cad4;font-size:13px} b{color:#e8ecf1}
 .bar{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;
      background:#0d1014;border:1px solid #39414e;border-radius:999px;padding:8px 18px;box-shadow:0 6px 24px #000a;font-size:13px}
 .bar button{background:none;border:0;color:#dfe3e8;font-size:17px;cursor:pointer;padding:2px 8px;line-height:1}
 .bar button:hover{color:#7fb2ff}
 .bar .k{color:#7f8a99;font-size:12px}
</style>
<h1>票 04 · 参考图候选（三选一，或都不选）</h1>
<p class="sub">同一个世界（黄昏的山间列车小站），三种**结构不同**的构图。按 ← → 切换。
每张右侧是**真跑出来**的 StyleSpec 提取结果 —— 连同它读错的地方。</p>
${["A", "B", "C"].map(card).join("")}
<div class="bar">
  <button id="prev">←</button><span id="lab"></span><button id="next">→</button>
  <span class="k">← → 或点箭头 · 数字键 1/2/3</span>
</div>
<script>
 const V=["A","B","C"], NAME=${JSON.stringify(NAMES)};
 let i=Math.max(0,V.indexOf((location.hash||"").slice(1)));
 function draw(){
   document.querySelectorAll(".card").forEach(c=>c.classList.toggle("on",c.dataset.v===V[i]));
   document.getElementById("lab").textContent=V[i]+" ("+NAME[V[i]]+")";
   try{ history.replaceState(null,"","#"+V[i]); }catch(e){ location.hash=V[i]; }
 }
 function go(d){ i=(i+d+V.length)%V.length; draw(); }
 document.getElementById("prev").onclick=()=>go(-1);
 document.getElementById("next").onclick=()=>go(1);
 addEventListener("keydown",e=>{
   const t=e.target.tagName; if(t==="INPUT"||t==="TEXTAREA"||e.target.isContentEditable) return;
   if(e.key==="ArrowLeft")go(-1); else if(e.key==="ArrowRight")go(1);
   else if("123".includes(e.key)){ i=Number(e.key)-1; draw(); }
 });
 draw();
</script>`;
fs.writeFileSync("prototype.html", html);
console.log(`✓ prototype.html  ${(html.length / 1024).toFixed(0)} KiB（自包含，双击即开）`);
