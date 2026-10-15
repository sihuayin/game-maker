// 票 72 的**判据**：**声明尺寸就是画出来的尺寸** —— 两代外壳四个 HUD 格子都得把画面塑成配置声明的那个尺寸。
//
//   ⚠️ **为什么是读源码文本**：`shell/scene.ts` 与 `shell/td/scene.ts` 头几行就 `import Phaser`，
//     在 node 的 vitest 里 import 不了 ⇒ **渲染这一层没有可 import 的台子**。
//     这是 `shell-capability-witness.test.ts` 走同一条路的同一个理由（那份文件头写了更完整的经过）。
//
//   ⚠️ **这一条证什么、不证什么**（别拿它当渲染的正确性证明）：
//     ✅ 证「那四句话还在**活代码**里」—— 删掉、或挪进注释，当场红；
//     ❌ **不证**「画出来的确实对」—— 那只有浏览器能证。逐条的浏览器读数（含施工前后对照）在
//        `.scratch/game-maker-v2/experiments/72-two-shell-size/`，**它不进 CI**（本仓的既定取舍）。
//     两层合起来才是这件事的完整证据链；只有一层的时候要说得出来缺的是哪一层。
//
//   ⚠️ **纪律照抄那一份**：① `needle` 必须是**行为串**不是注释措辞 ——
//     否则改一次注释就能悄悄满足判据；守它的是 `stripComments`。
//     ② **靶子必须唯一** —— 票 14 实吃过「变异没打中靶」（`String.replace` 只替第一处），
//     所以这里连**计数**一起钉住：`setDisplaySize` 在塔防那份里有三处，判据指的那一处必须分得出来。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** ⚠️ 与 `shell-capability-witness.test.ts:50` 是同一句 —— 它是**测试内的局部助手**，
 *  不是契约（抽成共用模块要动那份文件，而票 72 的射程没有它）。 */
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const SCENE = "../src/shell/scene.ts";
const TD_SCENE = "../src/shell/td/scene.ts";

/** **四个格子一张表**（票 72 · Q2 = (甲)：横版与塔防**四格一起**裁）。 */
const WITNESS = [
  { where: "横版 `hud.panel` · 九宫格那一支", file: SCENE,
    needle: "nineslice(p.at.x, p.at.y, p.atlas, p.frame, p.w, p.h)" },
  { where: "横版 `hud.panel` · 普通 image 那一支", file: SCENE,
    needle: "if (!(s9 && canNine)) go.setDisplaySize(p.w, p.h);" },
  { where: "塔防 `hud.panel`", file: TD_SCENE,
    needle: "if (!(s9 && canNine)) go.setDisplaySize(panel.box.w, panel.box.h);" },
  { where: "塔防 `hud.buttons` / `hud.start`（`img()` 真图那一支）", file: TD_SCENE,
    needle: ".setDisplaySize(w, h);" },
] as const;

describe("§见证：四个 HUD 格子**逐格**指得到外壳里那一句", () => {
  it.each(WITNESS)("$where 的行为串还在（**剥掉注释之后**）", ({ where, file, needle }) => {
    const live = stripComments(read(file));
    expect(live, `${file} 的**活代码**里找不到 \`${needle}\` —— 这一格又回到「声明尺寸不作数」了：` +
      `${where}`).toContain(needle);
  });

  it("四条 `needle` 全是**行为串**，没有一条只在注释里", () => {
    for (const { where, file, needle } of WITNESS) {
      const src = read(file);
      // 原文里在、剥注释后不在 ⇒ 它只是一句**关于**实现的措辞。
      expect(src.includes(needle) && !stripComments(src).includes(needle),
        `${where} 的 needle 只在注释里`).toBe(false);
    }
  });
});

describe("§靶子唯一：那条 needle 指的**就是**这一处", () => {
  // ⚠️ 票 14 的教训：变异锚点不唯一时，「改中了」可能改的是另一处，
  //   于是判据看着别的行、而这行纹丝不动。⇒ 把**总数**也钉住。
  it.each([
    { file: SCENE, total: 1, unique: "setDisplaySize(p.w, p.h)" },
    { file: TD_SCENE, total: 3, unique: "setDisplaySize(w, h)" },
  ])("$file 里 `setDisplaySize` 共 $total 处，而 `$unique` 只出现一次", ({ file, total, unique }) => {
    const live = stripComments(read(file));
    expect(live.split("setDisplaySize(").length - 1, `${file} 的 setDisplaySize 处数变了 —— 复核这张表`).toBe(total);
    expect(live.split(unique).length - 1, `\`${unique}\` 在 ${file} 里不是唯一一处`).toBe(1);
  });

  it("塔防那三处**各有各的话**：面板那一格与 `img()` 那一格不是同一句", () => {
    const live = stripComments(read(TD_SCENE));
    expect(live).toContain("setDisplaySize(panel.box.w, panel.box.h)");
    expect(live).toContain(".setDisplaySize(w, h);");
    expect(live).toContain("setDisplaySize(Math.max(1, w), Math.max(1, h))");   // 占位符那一处，**不在本票射程内**
  });
});
