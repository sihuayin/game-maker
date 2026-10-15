// 票 73 · 读数 ②：**把骨架里那一格逐字照抄，只换 `asset`** —— 两条判据各自怎么判？
//
// ⚠️ 零付费、只读：只调 `packages/contracts/dist` 里的 `entityBox` / `auditScreenSpace` / `auditPanelSize`。
// ⚠️ 用法：node skeleton-cell-vs-pack.mjs <manifest.json> [更多 manifest…]
//   清单里**每一件 `kind:"ui"`** 都试一遍（模型要从里面挑一件当 `hud.panel.asset`）。
import fs from "node:fs";
const ROOT = new URL("../../../..", import.meta.url).pathname;
const C = await import(ROOT + "/packages/contracts/dist/index.js");
const VP = { w: 480, h: 270 };
/** ⚠️ **逐字**是 `packages/assets/src/ops.ts` 的 `gameConfigExample.hud.panel` 那一格。 */
const SKELETON_CELL = { at: { x: 8, y: 262 }, size: { w: 72, h: 32 } };
for (const p of process.argv.slice(2)) {
  const m = JSON.parse(fs.readFileSync(p, "utf8"));
  const label = p.split("/").slice(-4, -1).join("/");
  for (const a of m.assets.filter((x) => x.kind === "ui")) {
    const box = C.entityBox(SKELETON_CELL.at, SKELETON_CELL.size, a.anchor);
    const screen = C.auditScreenSpace(VP, [{ where: "hud.panel", at: SKELETON_CELL.at, box }]);
    const size = C.auditPanelSize("hud.panel.size", SKELETON_CELL.size, a);
    console.log(
      `${label.padEnd(24)} ${a.id.padEnd(20)} ` +
      `包内 ${a.size.w}×${a.size.h} 锚点 {${a.anchor.x},${a.anchor.y}} ${a.scale9Borders ? "九宫格" : "非九宫格"} ` +
      `→ 盒子 (${box.x},${box.y}) ${box.w}×${box.h} · ` +
      `屏幕空间 ${screen.length ? "❌ 拒" : "✔ 过"} · 面板尺寸 ${size ? "❌ 拒" : "✔ 过"}`);
    if (screen.length) console.log(`      ${screen[0].message.replace(/\n/g, " ").slice(0, 120)}`);
    if (size) console.log(`      ${size.message.replace(/\n/g, " ").slice(0, 120)}`);
  }
}
