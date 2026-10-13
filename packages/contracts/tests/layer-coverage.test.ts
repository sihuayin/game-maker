// 票 65：**层盖不住世界**那条判据与它唯一的那份规则（`layer-coverage.ts`）—— 纯函数那一层。
//
// ⚠️ 这一份钉的是**判据本身**（几何怎么算 + message 的字面）。**两个调用者**（config 步住 `assets`、
//   站点装配住 `demo`）各自还有一条集成判据 —— 其中「**两侧 message 逐字相等**」那一条
//   **只能靠两边测试各钉同一个字面**来守：`assets` 与 `demo` 之间**没有依赖边**
//   （`check-deps.mjs` 的 `ALLOWED`），一个测试里同时调两边**做不到**。
//   ⚠️ 而这不是权宜之计：两侧调的是**同一个函数**（本文件测的那个），要漂只能靠「有人在一侧
//   重新实现一遍」，而那时**那一侧的字面判据会当场红**（见票 65 的变异 M5）。
import { describe, expect, it } from "vitest";
import { auditLayerCoverage, coveredExtent, layerDrawnSize } from "../src/index.js";

const VP = { w: 480, h: 270 };
/** 立案现场（第十五跑 · 段 B）的世界：`world.size.w = 1440` ⇒ 镜头横向要走 960px。 */
const WORLD = { w: 1440, h: 270 };
/** last-train 那件背景的标称尺寸 —— 与立案现场那件同值（480×270），这不是巧合：视口就是 480×270。 */
const NOMINAL = { w: 480, h: 270 };

describe("`layerDrawnSize` —— **`draw.ts:221` 那条规则本身**（票 65 把它提到 contracts）", () => {
  it("可平铺的轴**铺满整个世界**，不平铺的轴用**标称尺寸** —— 逐轴各算各的", () => {
    // 只有 x 平铺（三层背景里最常见的形状：墙与地平铺、天空不平铺）。
    expect(layerDrawnSize({ tileable: { x: true, y: false }, nominal: NOMINAL }, WORLD))
      .toEqual({ w: 1440, h: 270 });
    // 只有 y 平铺 —— 竖直方向的世界与视口等高，所以这一支今天恒等于标称高，但它**不是特例**。
    expect(layerDrawnSize({ tileable: { x: false, y: true }, nominal: NOMINAL }, { w: 1440, h: 540 }))
      .toEqual({ w: 480, h: 540 });
  });

  it("**没有 `tileable`**（不平铺的层）⇒ 两个轴都用标称尺寸", () => {
    expect(layerDrawnSize({ nominal: NOMINAL }, WORLD)).toEqual({ w: 480, h: 270 });
  });

  it("⚠️ 用的是**标称尺寸**，不是帧的真实尺寸 —— 各帧真实尺寸只住在图集 JSON 里，纯函数读不到它", () => {
    // 一条钉子：这条规则**只有两个来源**（世界尺寸、`AssetPackEntry.size`）。
    // 若有人给本函数加第三个入参（比如「帧」），这条判据不会红 —— 但它也不会**帮**那次改动，
    // 因为调用方（`draw.ts` / config 步）手上都只有标称尺寸。
    const only = layerDrawnSize({ nominal: { w: 480, h: 270 } }, WORLD);
    expect(only).toEqual(NOMINAL);
  });
});

describe("`coveredExtent` —— 镜头走到尽头时这一层还剩多长", () => {
  it("跟着走 `parallax` 的层，退掉 `parallax × travel`", () => {
    expect(coveredExtent(480, 0.1, 960), "立案现场 sky：480 − 96").toBe(384);
    expect(coveredExtent(480, 0.4, 960), "立案现场 silhouette：480 − 384").toBe(96);
    expect(coveredExtent(480, 0, 960), "视差 0 = 不跟着走 ⇒ 一点不退").toBe(480);
  });
});

describe("⭐ 阳性 · 立案现场那三条层（第十五跑 · 段 B 的几何）", () => {
  /** `bg-ruined-street` 那三层的相对位置：**恰好错两层**，可平铺的 `facade` 是对的。 */
  const ENTRIES = [
    { where: "scene.background[0]", name: "bg-dusk-halt.sky", parallax: 0.1,
      drawn: layerDrawnSize({ nominal: NOMINAL }, WORLD) },
    { where: "scene.background[1]", name: "bg-dusk-halt.wall", parallax: 0.4,
      drawn: layerDrawnSize({ nominal: NOMINAL }, WORLD) },
    { where: "scene.background[2]", name: "bg-dusk-halt.ground", parallax: 1,
      drawn: layerDrawnSize({ tileable: { x: true, y: false }, nominal: NOMINAL }, WORLD) },
  ];

  it("**恰好两条** error，`where` 是 [0] / [1]，点名 `sky` 与 `wall`", () => {
    const e = auditLayerCoverage(VP, WORLD, ENTRIES).filter((i) => i.severity === "error");
    expect(e.map((i) => i.where)).toEqual(["scene.background[0]", "scene.background[1]"]);
    expect(e[0]!.message).toMatch(/bg-dusk-halt\.sky/);
    expect(e[1]!.message).toMatch(/bg-dusk-halt\.wall/);
    expect(auditLayerCoverage(VP, WORLD, ENTRIES).every((i) => i.severity === "error")).toBe(true);
  });

  it("**三层里只错两层**：`tileable.x` 那一层一条都不报 —— 它铺满世界，恒成立", () => {
    const e = auditLayerCoverage(VP, WORLD, ENTRIES);
    expect(e.map((i) => i.where)).not.toContain("scene.background[2]");
    expect(e.map((i) => i.message).join("\n")).not.toMatch(/bg-dusk-halt\.ground/);
  });

  it("⚠️ 报出来的数逐个对得上立案现场：sky 剩 384 · wall 剩 96", () => {
    const e = auditLayerCoverage(VP, WORLD, ENTRIES);
    expect(e[0]!.message).toMatch(/最坏时屏幕上只剩 384×270px/);
    expect(e[1]!.message).toMatch(/最坏时屏幕上只剩 96×270px/);
    expect(e[0]!.message).toMatch(/退掉 96×0px/);
    expect(e[1]!.message).toMatch(/退掉 384×0px/);
  });
});

describe("⭐ 验收条件 7 + 4：那条 message 的**字面**", () => {
  const ONE = {
    where: "scene.background[0]", name: "bg-dusk-halt.sky", parallax: 0.1,
    drawn: { w: 480, h: 270 },
  };
  const MSG = auditLayerCoverage(VP, WORLD, [ONE])[0]!.message;

  it("**四样数一个不少**（世界尺寸 · 逐层 parallax · 最坏 px · 视口）—— 坏配置从此不落盘，只有它能读", () => {
    expect(MSG, "世界尺寸 —— §1 那条老 message 里**没有**它，读者得自己除一次才推得出来").toMatch(/世界 1440×270px/);
    expect(MSG, "视口").toMatch(/视口 480×270px/);
    expect(MSG, "逐层 parallax").toMatch(/视差 0\.1/);
    expect(MSG, "最坏时剩多少 px").toMatch(/最坏时屏幕上只剩 384×270px/);
  });

  it("⚠️ **这条字面是两个调用者之间的合约** —— 站点侧（`demo/tests/site.test.ts`）钉着**同一个字符串**", () => {
    // 两侧调的是同一个函数 ⇒ 本可以只钉一遍。钉两遍的理由是**变异**：
    //   谁在一侧重新实现一遍（哪怕只是换了四舍五入的位置），**那一侧当场红**。
    expect(MSG).toBe(
      `层 "bg-dusk-halt.sky" 盖不住世界：世界 1440×270px、视口 480×270px（镜头横向最多走 960px、纵向 0px），` +
      `它画出来 480×270px，视差 0.1 会跟着镜头退掉 96×0px，最坏时屏幕上只剩 384×270px，` +
      `而视口要 480×270px。—— **不平铺的层只有 parallax = 0 才恒成立**（票 40 算过的那条）`);
  });
});

describe("⚠️ 它与 (甲) 那条更严的代理规则的**分界**（票 65 §3 第二轮裁决）", () => {
  const layer = (parallax: number) =>
    ({ where: "scene.background[0]", name: "bg.sky", parallax, drawn: NOMINAL });

  it("**不误伤**：世界宽 == 视口宽（`travelX = 0`）⇒ 不平铺 + 非零视差**不报**", () => {
    // ⚠️ 这正是 (甲)「非平铺层的 parallax 必须为 0」会误伤、而本票不会的那种局面：
    //   镜头一步都不走，退掉的自然也是 0。**判据吃的是真实几何，不是视差本身。**
    expect(auditLayerCoverage(VP, { w: 480, h: 270 }, [layer(0.9)])).toEqual([]);
  });

  it("边界：`cover` **恰好等于**视口 ⇒ 不报（界是 `<`，不是 `<=`）", () => {
    // 世界 960（travel 480）· 视差 0.5 · 画出来 720 ⇒ 最坏时正好剩 480 = 视口宽。
    const exact = { where: "scene.background[0]", name: "bg.sky", parallax: 0.5, drawn: { w: 720, h: 270 } };
    expect(auditLayerCoverage(VP, { w: 960, h: 270 }, [exact])).toEqual([]);
    // 差一个像素就报 —— 这条钉的是「界在哪儿」，不是「有没有这条判据」。
    const one = { ...exact, drawn: { w: 719, h: 270 } };
    expect(auditLayerCoverage(VP, { w: 960, h: 270 }, [one]).map((i) => i.where)).toEqual(["scene.background[0]"]);
  });

  it("⚠️ **纵向也判**：这一关单屏高（世界高恒等于视口高），但判据不是「只看 x」", () => {
    const tall = { where: "scene.background[0]", name: "bg.sky", parallax: 0.5, drawn: { w: 480, h: 270 } };
    expect(auditLayerCoverage(VP, { w: 480, h: 540 }, [tall]).map((i) => i.where)).toEqual(["scene.background[0]"]);
  });
});
