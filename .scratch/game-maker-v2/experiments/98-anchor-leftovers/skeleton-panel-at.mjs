// 票 98 · 读数 ②：骨架里 `hud.panel` 那一格 —— 旧数 (8,262) 与新数 (72,238)
// 在**每一个**锚点下分别落在视口里吗？用的是本仓自己的 `entityBox` + `auditScreenSpace`（零付费、只读）。
import path from "node:path";
const ROOT = path.resolve(new URL("../../../..", import.meta.url).pathname);
const C = await import(path.join(ROOT, "packages/contracts/dist/index.js"));
const VP = { w: 480, h: 270 };                     // ops.ts:607 DEFAULT_VIEWPORT
const EXAMPLE_WORLD = { w: 1440, h: 270 };         // gameConfigExample.world.size
const SIZE = { w: 72, h: 32 };                     // 骨架那一格的 size
const CELLS = [ {x:0,y:0}, {x:0,y:1}, {x:1,y:0}, {x:1,y:1}, {x:0.5,y:0.5}, {x:0.5,y:1}, {x:0.5,y:0}, {x:0,y:0.5}, {x:1,y:0.5} ];
for (const [label, at] of [["旧数 (8,262)", {x:8,y:262}], ["新数 (72,238)", {x:72,y:238}]]) {
  console.log(`\n=== ${label} · 视口 ${VP.w}×${VP.h} · world ${EXAMPLE_WORLD.w}×${EXAMPLE_WORLD.h} ===`);
  for (const a of CELLS) {
    const box = C.entityBox(at, SIZE, a);
    const iss = C.auditScreenSpace(VP, [{ where: "hud.panel", at, box }]);
    console.log(`  锚点 {${a.x},${a.y}} → 盒子 (${box.x},${box.y}) ${box.w}×${box.h}  ${iss.length ? "❌ " + iss[0].message.split("；")[0].replace(/\*\*/g,"") : "✔ 过"}`);
  }
}
