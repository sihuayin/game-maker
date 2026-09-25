// 票 04 原型：三个**结构不同**的参考图候选。
// 同一个世界（黄昏的山间列车小站），三种构图 —— 这样比较的是构图，不是题材。
//
// 设计约束（都来自票 04 与票 15）：
//  · 色板**刻意做小**（18 色，全部显式列出）—— 票 15 发现旧参考图有 122,240 色、
//    根本没有色板；这张图要能验证「干净色板 ⇒ 提取出的 palette 是否精确命中」。
//  · **不含**牛/拖拉机/谷仓/钓竿这类后续要生成的资源（Novel Asset Style Consistency 要考的就是这个）。
//  · 必须有：可辨识的形状语言、材质、光照层次、至少一个角色、明确的空间层次。
//  · 版权干净：每一笔都是这里画出来的。
import fs from "node:fs";
import { canvas } from "./draw.mjs";

export const PALETTE = {
  skyHi:  [0x2e, 0x3b, 0x4e], skyLo:  [0x4a, 0x60, 0x76],
  dusk:   [0xc9, 0x8b, 0x5e], duskLo: [0xe8, 0xc3, 0x9e],
  mtn:    [0x2a, 0x34, 0x42], mtn2:   [0x3b, 0x4a, 0x5c],
  woodD:  [0x4a, 0x32, 0x22], wood:   [0x6b, 0x4a, 0x33], woodL: [0x8a, 0x62, 0x44],
  stoneD: [0x56, 0x5b, 0x60], stone:  [0x7a, 0x7f, 0x84], stoneL:[0x9a, 0xa0, 0xa5],
  brass:  [0xd9, 0xa4, 0x41], brassL: [0xf2, 0xd9, 0x8b],
  greenD: [0x3f, 0x5c, 0x3a], green:  [0x55, 0x7a, 0x4a],
  dark:   [0x1b, 0x20, 0x27], cream:  [0xe6, 0xe2, 0xd6],
};
const P = PALETTE;
const W = 480, H = 270;

/**
 * 站务员 —— 三个变体共用同一个角色，这样「角色画法」这一维可以横向比。
 * ⚠️ `coat` 是参数：第一版把大衣定成 stone_d，而三个变体里角色都站在石质地面上
 * —— 颜色撞了，人物直接消失成一个色块。**角色必须与它脚下的东西对比。**
 */
function stationmaster(c, x, y, s = 4, facing = 1, coat = P.skyHi) {
  const R = (dx0, dy0, dx1, dy1, col) => {
    const a = Math.min(dx0, dx1), b = Math.max(dx0, dx1);
    const x0 = facing > 0 ? x + a * s : x - b * s - (s - 1);
    c.rect(x0, y + dy0 * s, x0 + (b - a) * s + s - 1, y + dy1 * s + s - 1, col);
  };
  R(-3, 16, -1, 17, P.dark); R(1, 16, 3, 17, P.dark);          // 鞋
  R(-3, 11, -1, 15, P.woodD); R(1, 11, 3, 15, P.woodD);        // 腿
  R(-6, 5, -5, 11, coat); R(5, 5, 6, 11, coat);                // 手臂
  R(-6, 11, -5, 12, P.cream); R(5, 11, 6, 12, P.cream);        // 手
  R(-5, 5, 5, 12, coat);                                       // 大衣
  R(-5, 8, 5, 9, P.dark); R(0, 8, 1, 9, P.brass);              // 腰带 + 铜扣
  R(-5, 5, 5, 5, P.stone);                                     // 肩线
  R(-4, 0, 4, 5, P.cream);                                     // 头
  R(-2, 2, -1, 3, P.dark); R(1, 2, 2, 3, P.dark);              // 眼
  R(-1, 4, 0, 4, P.woodD);                                     // 嘴
  R(-4, -3, 4, 0, P.woodD);                                    // 帽筒
  R(-5, 0, 5, 0, P.dark);                                      // 帽檐
  R(-1, -2, 0, -1, P.brass);                                   // 帽徽
}

// ── A：正交侧视单景 ─────────────────────────────────────────────────────────
function variantA() {
  const c = canvas(W, H);
  c.rect(0, 0, W - 1, 90, P.skyHi); c.rect(0, 60, W - 1, 120, P.skyLo);
  c.rect(0, 108, W - 1, 126, P.dusk); c.rect(0, 126, W - 1, 136, P.duskLo);      // 黄昏地平线
  c.ell(372, 126, 24, 24, P.brassL); c.ell(372, 126, 19, 19, P.brass);           // 落日（压在山脊后）
  c.poly([[0, 140], [70, 66], [140, 140]], P.mtn);                               // 山
  c.poly([[110, 140], [200, 44], [300, 140]], P.mtn);
  c.poly([[250, 140], [360, 62], [480, 140]], P.mtn);
  c.poly([[110, 140], [200, 44], [200, 140]], P.mtn2);                           // 受光面
  c.rect(0, 140, W - 1, 200, P.stoneD); c.rect(0, 200, W - 1, 220, P.stone);     // 站台
  c.rect(0, 220, W - 1, 244, P.woodD); c.rect(0, 244, W - 1, H - 1, P.stoneD);   // 轨道床
  for (let x = 0; x < W; x += 16) c.rect(x, 226, x + 9, 231, P.stone);           // 枕木
  c.rect(0, 216, W - 1, 218, P.stoneL);                                          // 站台沿
  // 候车室
  c.rect(40, 96, 210, 200, P.wood); c.rect(40, 96, 210, 104, P.woodL);
  c.rect(34, 90, 222, 98, P.woodD); c.rect(30, 94, 226, 98, P.woodL);            // 屋顶挑檐
  c.ell(96, 140, 26, 30, P.brassL); c.ell(96, 140, 22, 26, P.dusk);              // 拱窗
  c.frame(70, 140, 122, 170, P.woodD);
  c.rect(150, 150, 196, 200, P.woodD); c.rect(154, 154, 192, 198, P.skyLo);      // 门
  c.ell(173, 130, 13, 13, P.cream); c.line(173, 130, 173, 124, P.dark); c.line(173, 130, 178, 133, P.dark);
  c.frame(160, 117, 186, 143, P.brass);                                          // 挂钟
  c.rect(60, 78, 190, 90, P.brass); c.rect(60, 78, 190, 80, P.brassL);           // 招牌
  c.rect(64, 82, 78, 86, P.woodD); c.rect(84, 82, 132, 86, P.woodD); c.rect(138, 82, 186, 86, P.woodD);
  c.ell(228, 170, 5, 5, P.brassL); c.rect(227, 170, 229, 200, P.stoneD);         // 站灯
  stationmaster(c, 300, 150, 4);
  return c.png();
}

// ── B：等距俯视 ─────────────────────────────────────────────────────────────
function variantB() {
  const c = canvas(W, H);
  c.rect(0, 0, W - 1, H - 1, P.skyLo); c.rect(0, 0, W - 1, 70, P.skyHi);
  c.rect(0, 62, W - 1, 92, P.dusk); c.rect(0, 92, W - 1, 104, P.duskLo);
  c.ell(120, 88, 22, 22, P.brassL); c.ell(120, 88, 16, 16, P.brass);
  c.poly([[0, 104], [90, 40], [180, 104]], P.mtn); c.poly([[300, 104], [400, 30], [480, 104]], P.mtn);
  // 地面（抖动出草地/碎石质感）
  c.dither(0, 104, W - 1, H - 1, P.greenD, P.green, 5);
  c.poly([[0, 150], [W - 1, 120], [W - 1, 196], [0, 226]], P.stone);             // 斜穿的站台面
  c.poly([[0, 226], [W - 1, 196], [W - 1, 214], [0, 244]], P.stoneD);
  c.poly([[0, 244], [W - 1, 214], [W - 1, 232], [0, 262]], P.woodD);             // 轨道床
  for (let i = 0; i < 26; i++) { const t = i / 25; c.rect(t * W - 6, 250 - t * 34, t * W + 6, 256 - t * 34, P.stone); }
  c.line(0, 252, W - 1, 218, P.stoneL); c.line(0, 240, W - 1, 206, P.stoneL);
  // 候车室（等距盒）
  const bx = 210, by = 150;
  c.poly([[bx, by], [bx + 90, by - 30], [bx + 90, by + 20], [bx, by + 50]], P.wood);       // 正面
  c.poly([[bx + 90, by - 30], [bx + 150, by - 10], [bx + 150, by + 40], [bx + 90, by + 20]], P.woodL); // 侧面
  c.poly([[bx - 14, by - 4], [bx + 90, by - 44], [bx + 164, by - 20], [bx + 60, by + 20]], P.woodD);  // 屋顶
  c.rect(bx + 22, by + 4, bx + 50, by + 28, P.dusk); c.frame(bx + 20, by + 2, bx + 52, by + 30, P.woodD);
  c.poly([[bx + 100, by - 6], [bx + 130, by - 18], [bx + 130, by + 2], [bx + 100, by + 10]], P.brassL);  // 窗光
  c.ell(bx + 34, by - 30, 4, 4, P.cream); c.ell(bx + 120, by - 34, 4, 4, P.cream);
  for (const [tx, ty, r] of [[70, 140, 22], [120, 118, 17], [420, 132, 20], [455, 118, 14], [24, 160, 16]]) {
    c.ell(tx, ty + 6, r, r * 0.5, P.greenD); c.ell(tx, ty, r * 0.8, r * 0.8, P.green); c.ell(tx - r * 0.3, ty - r * 0.3, r * 0.35, r * 0.3, P.brass);
  }
  c.rect(bx - 40, by - 20, bx - 36, by + 34, P.stoneD); c.ell(bx - 38, by - 24, 5, 5, P.brassL);  // 站灯
  stationmaster(c, 150, 186, 4);
  return c.png();
}

// ── C：分层剖面（三条横向带，各带不同光照）───────────────────────────────────
function variantC() {
  const c = canvas(W, H);
  c.rect(0, 0, W - 1, 78, P.skyHi); c.rect(0, 40, W - 1, 78, P.skyLo);
  c.rect(0, 66, W - 1, 78, P.dusk);
  c.ell(400, 60, 18, 18, P.brassL); c.ell(400, 60, 13, 13, P.brass);
  c.poly([[0, 78], [80, 34], [170, 78]], P.mtn);
  c.rect(0, 70, W - 1, 78, P.woodD);                                            // 屋顶线
  // 中带：候车室内景（暖光）
  c.rect(0, 78, W - 1, 186, P.wood); c.dither(0, 78, W - 1, 186, P.wood, P.woodL, 4);
  c.rect(0, 78, W - 1, 82, P.woodD); c.rect(0, 182, W - 1, 186, P.woodD);
  c.rect(30, 100, 150, 160, P.woodD); c.frame(26, 96, 154, 164, P.woodL);       // 窗
  c.rect(32, 102, 148, 158, P.duskLo); c.rect(32, 102, 148, 128, P.dusk);
  c.poly([[32, 140], [70, 108], [110, 140]], P.mtn2);
  c.rect(120, 152, 200, 162, P.woodL); c.rect(120, 162, 126, 182, P.woodD); c.rect(194, 162, 200, 182, P.woodD);  // 长椅
  c.rect(330, 96, 360, 130, P.brassL); c.rect(336, 100, 354, 126, P.brass);     // 挂灯
  c.line(345, 82, 345, 96, P.stoneD);
  for (let i = 0; i < 3; i++) c.rect(390 + i * 26, 100, 404 + i * 26, 122, i === 1 ? P.dusk : P.stoneD);  // 行李
  // 下带：站台 + 轨道（冷光）
  c.rect(0, 186, W - 1, 214, P.stone); c.rect(0, 186, W - 1, 189, P.stoneL);
  c.rect(0, 214, W - 1, 236, P.woodD);
  c.rect(0, 236, W - 1, H - 1, P.stoneD);
  for (let x = 0; x < W; x += 18) c.rect(x, 220, x + 10, 225, P.stone);
  c.line(0, 244, W - 1, 244, P.stoneL); c.line(0, 254, W - 1, 254, P.stoneL);
  c.rect(410, 158, 412, 186, P.stoneD); c.ell(411, 154, 6, 6, P.brassL);
  stationmaster(c, 245, 156, 4, -1);
  return c.png();
}

const OUT = new URL("./out/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const variants = { A: variantA(), B: variantB(), C: variantC() };
for (const [k, buf] of Object.entries(variants)) {
  fs.writeFileSync(new URL(`ref-${k}.png`, OUT), buf);
  console.log(`✓ out/ref-${k}.png  ${W}×${H}  ${(buf.length / 1024).toFixed(1)} KiB`);
}
console.log(`调色板 ${Object.keys(PALETTE).length} 色：`, Object.values(PALETTE).map((v) => "#" + v.map((n) => n.toString(16).padStart(2, "0")).join("")).join(" "));
