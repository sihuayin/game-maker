// 票 40 的**那一把尺子**：一张清单意味着**几次生图调用**。
//
// ⚠️ 这份测试是**手工列出的期望表** —— 右边的每个数都**写死在这里**，**不由被测函数推出来**。
//   这正是本仓库反复记的那条纪律（票 38 那三条假牙）：拿同一个实现同时生成「预期」与「实际」，
//   它错了**两边一起错、测试照绿**。
// ⚠️ 而「`pack` 真发出去的次数」那半边由**另一条腿**兜着 ——
//   `packages/assets/tests/recipes-sweep.test.ts` 拿**桩实际收到的调用**（`told`）对账。
//   两条腿缺一不可：这一份钉**分类的语义**，那一份钉**它真被 `pack` 用上了**。
import { describe, expect, it } from "vitest";
import {
  AssetSpecSchema, RECIPE_FORMAT, imageCallsOf, imageUnitsOf, parseRecipe,
  type AssetSpec,
} from "../src/index.js";

const COMMON = {
  role: "r", description: "d", styleId: "halt-dusk",
  anchor: { x: 0.5, y: 1 }, size: { w: 32, h: 48 },
};
const spec = (s: Record<string, unknown>): AssetSpec => AssetSpecSchema.parse(s);

/** 把一份手写清单过一遍契约（测试**不绕过** `parseRecipe`：形状真变了它就该红）。 */
function recipeOf(doc: Record<string, unknown>): Parameters<typeof imageCallsOf>[0] {
  const p = parseRecipe({ format: RECIPE_FORMAT, id: "t", styleRef: "s.json", referenceImage: "r.png", ...doc });
  if (!p.ok) throw new Error("手写清单本身就不过契约：" + p.errors.join("；"));
  return p.value;
}
const imageAsset = (s: Record<string, unknown>) => ({ spec: s, source: { kind: "image" } });
const drawlistAsset = (s: Record<string, unknown>) => ({ spec: s, source: { kind: "drawlist" } });

describe("§ `imageUnitsOf`：一个资源切几个单元、每个单元画什么（票 40 的 Q2）", () => {
  it("`sprite` / `ui` / **没有 `layers` 的** `background` ⇒ 各**一个**单元、1 帧", () => {
    const sprite = spec({ kind: "sprite", id: "crate", ...COMMON });
    const ui = spec({ kind: "ui", id: "hud", ...COMMON });
    const flat = spec({ kind: "background", id: "sky", ...COMMON });
    for (const s of [sprite, ui, flat]) expect(imageUnitsOf(s)).toEqual([{ frames: 1 }]);
  });

  it("⚠️ `animation` ⇒ **一个动画一个单元**（**不是一帧一个**）—— 4+4+6 帧是 **3** 个单元", () => {
    const s = spec({
      kind: "animation", id: "scavenger", ...COMMON,
      animations: [{ name: "idle", frames: 4 }, { name: "run", frames: 4 }, { name: "jump", frames: 6 }],
    });
    expect(imageUnitsOf(s)).toEqual([
      { anim: "idle", frames: 4 }, { anim: "run", frames: 4 }, { anim: "jump", frames: 6 },
    ]);
    // ⚠️ **帧数不是次数**：14 帧 ≠ 14 次，也不是 1 次
    expect(imageUnitsOf(s)).toHaveLength(3);
  });

  it("⚠️ 分层 `background` ⇒ **一层一个单元**，`index` 从远到近、`total` 是层数", () => {
    const s = spec({
      kind: "background", id: "bg", ...COMMON,
      layers: [{ name: "sky", parallax: 0 }, { name: "dunes", parallax: 0.4, tileable: { x: true } }, { name: "rocks", parallax: 0.9 }],
    });
    expect(imageUnitsOf(s)).toEqual([
      { layer: { name: "sky", index: 0, total: 3, tileX: false }, frames: 1 },
      { layer: { name: "dunes", index: 1, total: 3, tileX: true }, frames: 1 },
      { layer: { name: "rocks", index: 2, total: 3, tileX: false }, frames: 1 },
    ]);
  });
});

describe("§ `imageCallsOf`：一张清单全派发时要发几次（票 40 的 Q3/Q4）", () => {
  it("全是 drawlist 的清单 ⇒ **0 次**（文本那一路不在这把尺子里）", () => {
    const r = recipeOf({ assets: [drawlistAsset({ kind: "sprite", id: "a", ...COMMON })] });
    expect(imageCallsOf(r)).toEqual({ total: 0, breakdown: { animation: 0, single: 0, background: 0, master: 0 } });
  });

  it("四类混着来：分类各自落对格子，而**四项之和 === total**", () => {
    const r = recipeOf({
      assets: [
        imageAsset({ kind: "animation", id: "hero", ...COMMON, animations: [{ name: "idle", frames: 4 }, { name: "run", frames: 4 }] }),
        imageAsset({ kind: "sprite", id: "crate", ...COMMON }),
        imageAsset({ kind: "ui", id: "hud", ...COMMON }),
        imageAsset({ kind: "background", id: "bg", ...COMMON, layers: [{ name: "sky", parallax: 0 }, { name: "rocks", parallax: 0.9 }] }),
        // ⚠️ 单层背景是 `single`，不是 `background` —— 它只发一次，与 `sprite` 同款
        imageAsset({ kind: "background", id: "flat", ...COMMON }),
        drawlistAsset({ kind: "sprite", id: "dust", ...COMMON }),
      ],
    });
    const got = imageCallsOf(r);
    expect(got.breakdown).toEqual({ animation: 2, single: 3, background: 2, master: 0 });
    expect(got.total).toBe(7);
    expect(got.breakdown.animation + got.breakdown.single + got.breakdown.background + got.breakdown.master).toBe(got.total);
  });

  it("§ `frames` 源：**一帧一次调用**（票 17）—— 12 帧 = 12 次，不是 2 次", () => {
    const r = recipeOf({
      assets: [{
        spec: spec({
          kind: "animation", id: "hero", ...COMMON,
          animations: [{ name: "idle", frames: 4 }, { name: "run", frames: 8 }],
        }),
        source: { kind: "frames" },
      }],
    });
    expect(imageCallsOf(r)).toEqual({ total: 12, breakdown: { animation: 12, single: 0, background: 0, master: 0 } });
  });

  it("§ `frames` 只用于 animation，且**不能与 `sheet` 同时写**", () => {
    const base = { format: RECIPE_FORMAT, id: "t", styleRef: "s.json", referenceImage: "r.png" };
    const sprite = parseRecipe({ ...base, assets: [{ spec: { kind: "sprite", id: "a", ...COMMON }, source: { kind: "frames" } }] });
    expect(sprite.ok).toBe(false);
    const withSheet = parseRecipe({
      ...base,
      assets: [{
        spec: spec({ kind: "animation", id: "a", ...COMMON, animations: [{ name: "run", frames: 4, sheet: { columns: 4, rows: 1 } }] }),
        source: { kind: "frames" },
      }],
    });
    expect(withSheet.ok).toBe(false);
  });

  it("⚠️ 母版：**`image` 的算、`import` 的不算**（人给的图一分钱不花），且**asset 的 import 源也不发**", () => {
    const r = recipeOf({
      assets: [
        imageAsset({ kind: "sprite", id: "crate", ...COMMON }),
        { spec: { kind: "sprite", id: "ported", ...COMMON }, source: { kind: "import", ref: "art/ported.png" } },
      ],
      authoring: [
        { id: "m-hero", role: "r", description: "d", source: { kind: "image" }, characterId: "p-hero", size: { w: 32, h: 48 } },
        { id: "m-drone", role: "r", description: "d", source: { kind: "image" }, characterId: "e-drone", size: { w: 32, h: 32 } },
        { id: "m-ported", role: "r", description: "d", source: { kind: "import", ref: "art/m.png" }, characterId: "p-hero", size: { w: 32, h: 48 } },
      ],
    });
    const got = imageCallsOf(r);
    expect(got.breakdown).toEqual({ animation: 0, single: 1, background: 0, master: 2 });
    expect(got.total).toBe(3);
  });

  it("⚠️⚠️ **第六跑那份清单的形状**（本票的立案读数 A）：11 个 image 源资产 = **24 次**，不是一个资产一次", () => {
    // 逐资产复算：scavenger×4 · enemy×2 · rubble-hound×3 · wanderer×2 = **11 个动画单元**
    //             （合起来 19 帧，而调用是 11 次）· 6 个单帧 · bg-wasteland 三层 · 4 张母版
    const anim = (id: string, frames: number[]) =>
      imageAsset({ kind: "animation", id, ...COMMON, animations: frames.map((f, i) => ({ name: `a${i}`, frames: f })) });
    const one = (id: string) => imageAsset({ kind: "sprite", id, ...COMMON });
    const r = recipeOf({
      assets: [
        anim("scavenger", [2, 2, 2, 2]), anim("enemy", [2, 2]),
        anim("rubble-hound", [2, 1, 1]), anim("wanderer", [2, 1]),
        one("chest"), one("chest-open"), one("chest-treasure"),
        one("sign-post"), one("sign-post-lit"), one("landmark-tower"),
        imageAsset({ kind: "background", id: "bg-wasteland", ...COMMON, layers: [{ name: "sky", parallax: 0 }, { name: "mid", parallax: 0.5 }, { name: "near", parallax: 1 }] }),
      ],
      authoring: [1, 2, 3, 4].map((i) => ({
        id: `m-${i}`, role: "r", description: "d", source: { kind: "image" }, characterId: `c-${i}`, size: { w: 32, h: 32 },
      })),
    });
    const got = imageCallsOf(r);
    expect(r.assets.filter((a) => a.source.kind === "image")).toHaveLength(11);   // ← 检查点**以前**报的就是这个数
    expect(got.breakdown).toEqual({ animation: 11, single: 6, background: 3, master: 4 });
    expect(got.total).toBe(24);                                                   // ← 真发出去的次数
    // ⚠️ 而**那 4 个动画资产合起来是 19 帧**：帧数一次都没被说成次数（那正是这把尺子要防的事）
    const frames = r.assets.filter((a) => a.source.kind === "image" && a.spec.kind === "animation")
      .flatMap((a) => imageUnitsOf(a.spec)).reduce((n, u) => n + u.frames, 0);
    expect(frames).toBe(19);
  });
});
