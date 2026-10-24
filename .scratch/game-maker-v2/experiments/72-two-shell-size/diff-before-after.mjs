#!/usr/bin/env node
/** 施工前后的**逐条对照** —— 回答「`img()` 那一句对其余四个调用者是不是空操作」。
 *  比较两份读数里每一条 `drawImage` 的 (目标 canvas · 变换 · 源矩形 · 局部目标矩形)。 */
import fs from 'node:fs';
const key = (d) => [d.iw, d.ih, d.sx, d.sy, d.sw, d.sh, d.dx, d.dy, d.dw, d.dh, JSON.stringify(d.tf)].join('|');
const load = (f) => new Set(JSON.parse(fs.readFileSync(f, 'utf8')).p72.draws.map(key));
for (const [name, b, a] of [['塔防', 'readout-td-before.json', 'readout-td.json'], ['横版', 'readout-landscape-before.json', 'readout-landscape.json']]) {
  const B = load(b), A = load(a);
  const gone = [...B].filter((k) => !A.has(k));
  const added = [...A].filter((k) => !B.has(k));
  console.log(`\n=== ${name} ===\n前 ${B.size} 条 · 后 ${A.size} 条 · 消失 ${gone.length} · 新增 ${added.length}`);
  const fmt = (k) => { const p = k.split('|'); const t = JSON.parse(p[10]);
    return `    图集 ${p[0]}×${p[1]} src(${p[2]},${p[3]}) ${p[4]}×${p[5]} · at(${t[2]},${t[3]}) scale(${+t[0].toFixed(4)},${+t[1].toFixed(4)}) ⇒ 画出来 ${(t[0] * Number(p[8])).toFixed(2)}×${(t[1] * Number(p[9])).toFixed(2)}`; };
  for (const k of gone.slice(0, 8)) console.log('  消失：' + fmt(k));
  for (const k of added.slice(0, 8)) console.log('  新增：' + fmt(k));
}
