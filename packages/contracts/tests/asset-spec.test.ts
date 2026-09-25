import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AssetSpecSchema, auditAssetSpec, boundsOfOps, checkSize, parseDrawList,
  type AssetPackEntry, type AssetSpec, type DrawList,
} from "../src/index.js";

const FIXTURE_DIR = fileURLToPath(new URL("../../../fixtures/drawlist/", import.meta.url));
const fixture = (n: string): DrawList => JSON.parse(readFileSync(FIXTURE_DIR + n, "utf8"));

// ── 四类各用一份**真实实验产物**填（票 27 的产出要求）────────────────────────
/** experiments/animated-player/ 的一套六帧：idle + walk1-4 + jump（票 26 之后每帧都必须归组）。 */
const PLAYER: AssetSpec = {
  kind: "animation", id: "player", role: "protagonist", description: "玩家角色",
  styleId: "style-ref", anchor: { x: 0.5, y: 0.92 }, size: { w: 24, h: 32 },
  dependencies: [], required: true,
  animations: [
    { name: "idle", frames: 1, fps: 1, loop: true },
    { name: "walk", frames: 4, fps: 8, loop: true },
    { name: "jump", frames: 1, fps: 1, loop: false },
  ],
};
/** experiments/style-transfer-from-test-png/ 的 platform（64×16，单帧）。 */
const PLATFORM: AssetSpec = {
  kind: "sprite", id: "platform", role: "ground-tile", description: "地面平台",
  styleId: "style-ref", anchor: { x: 0, y: 0 }, size: { w: 64, h: 16 },
  dependencies: [], required: true,
};
/** 人工导入的场景尺度背景（票 23 那条通道）。 */
const INTERIOR: AssetSpec = {
  kind: "background", id: "shop_interior", role: "scene-backdrop", description: "商店内景",
  styleId: "style-ref", anchor: { x: 0, y: 0 }, size: { w: 1218, h: 685 },
  dependencies: [], required: true,
  layers: [{ parallax: 0.2 }, { parallax: 1 }],
};
/** 一个真正**屏幕空间**的面板（带九宫格）。 */
const PANEL: AssetSpec = {
  kind: "ui", id: "hud_panel", role: "panel", description: "HUD 面板",
  styleId: "style-ref", anchor: { x: 0, y: 0 }, size: { w: 48, h: 32 },
  dependencies: [], required: true,
  ninePatch: { left: 4, right: 4, top: 4, bottom: 4 }, screenSpace: true,
};

describe("四类都能装下真实产物", () => {
  it.each([["player", PLAYER], ["platform", PLATFORM], ["shop_interior", INTERIOR], ["hud_panel", PANEL]])(
    "%s 通过校验", (_name, spec) => {
      const r = AssetSpecSchema.safeParse(spec);
      expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    });

  it("判别式真的是 kind", () => {
    expect(AssetSpecSchema.safeParse({ ...PLATFORM, kind: "sprites" }).success).toBe(false);
  });
});

describe("两类逃生舱已删除（票 27）", () => {
  it.each(["visual", "geometry"])("`%s` 不再是合法字段", (key) => {
    expect(AssetSpecSchema.safeParse({ ...PLATFORM, [key]: { 随便: "什么都行" } }).success).toBe(false);
  });

  it("`states` 也没了（票 26 降格成动画）", () => {
    expect(AssetSpecSchema.safeParse({ ...PLATFORM, states: ["ripe"] }).success).toBe(false);
  });
});

describe("按类的硬要求", () => {
  it("sprite 不许带动画", () => {
    expect(AssetSpecSchema.safeParse({ ...PLATFORM, animations: [{ name: "x", frames: 1 }] }).success).toBe(false);
  });

  it("animation 必须声明至少一个动画", () => {
    const { animations: _drop, ...without } = PLAYER as Extract<AssetSpec, { kind: "animation" }>;
    expect(AssetSpecSchema.safeParse(without).success).toBe(false);
    expect(AssetSpecSchema.safeParse({ ...without, animations: [] }).success).toBe(false);
  });

  it("背景可以声明分层视差与可平铺", () => {
    expect(AssetSpecSchema.safeParse({ ...INTERIOR, tileable: { x: true, y: false } }).success).toBe(true);
  });
});

describe("UI 九宫格：中央区不能空", () => {
  it("正常内缩通过", () => {
    expect(AssetSpecSchema.safeParse(PANEL).success).toBe(true);
  });

  it("左右内缩之和 ≥ 宽度被拒", () => {
    const r = AssetSpecSchema.safeParse({ ...PANEL, ninePatch: { left: 24, right: 24, top: 2, bottom: 2 } });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message).join()).toMatch(/中央区会空/);
  });

  it("上下内缩之和 ≥ 高度被拒", () => {
    expect(AssetSpecSchema.safeParse({ ...PANEL, ninePatch: { left: 2, right: 2, top: 16, bottom: 16 } }).success).toBe(false);
  });
});

describe("checkSize —— 用 exact 分两档，不要魔法阈值", () => {
  it("在期望内 → 通过（精确与上界都一样）", () => {
    const exact = boundsOfOps(fixture("tomato.growing.json").ops);
    expect(checkSize(exact, { w: 32, h: 32 }).ok).toBe(true);
  });

  it("**精确**包围盒超出 → error，容差 0", () => {
    const exact = boundsOfOps(fixture("cow.idle.json").ops);   // 纯数值图元，exact
    expect(exact.exact).toBe(true);
    const v = checkSize(exact, { w: 10, h: 10 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.severity).toBe("error");
  });

  it("**含 curve** 的包围盒超出 → warning，因为那只是**上界**（可能高估）", () => {
    const inexact = boundsOfOps([
      { op: "rect", x: 0, y: 0, w: 10, h: 10, fill: "palette:1" },
      { op: "curve", points: [[0, 0], [40, 40]], stroke: "palette:1" },
    ]);
    expect(inexact.exact).toBe(false);
    const v = checkSize(inexact, { w: 10, h: 10 });
    expect(v.ok).toBe(false);
    if (!v.ok) { expect(v.severity).toBe("warning"); expect(v.message).toMatch(/可能/); }
  });

  it("一个像素都没画出来 → error", () => {
    const none = boundsOfOps([]);
    const v = checkSize(none, { w: 10, h: 10 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.severity).toBe("error");
  });
});

describe("auditAssetSpec —— spec ↔ 产物的对账", () => {
  const entry = (over: Partial<AssetPackEntry> = {}): AssetPackEntry => ({
    id: "player", kind: "animation", role: "protagonist", origin: "generated", paletteBinding: "exact",
    required: true, size: { w: 24, h: 32 }, anchor: { x: 0.5, y: 0.92 }, atlasId: "animations",
    frames: [
      { name: "player.idle" }, { name: "player.walk1" }, { name: "player.walk2" },
      { name: "player.walk3" }, { name: "player.walk4" }, { name: "player.jump" },
    ],
    animations: [
      { name: "idle", frames: ["player.idle"], fps: 1, loop: true },
      { name: "walk", frames: ["player.walk1", "player.walk2", "player.walk3", "player.walk4"], fps: 8, loop: true },
      { name: "jump", frames: ["player.jump"], fps: 1, loop: false },
    ],
    authoring: [{ kind: "drawlist", ref: "authoring/drawlist/player.idle.json" }],
    ...over,
  });

  it("一致时没有意见", () => {
    expect(auditAssetSpec(PLAYER, entry())).toEqual([]);
  });

  it("少做了一个动画 → 报出来", () => {
    const e = entry({ animations: entry().animations!.filter((a) => a.name !== "jump") });
    expect(auditAssetSpec(PLAYER, e).join()).toMatch(/动画 "jump" 没有做出来/);
  });

  it("做出了没要求的动画 → 报出来", () => {
    const e = entry({ animations: [...entry().animations!, { name: "run", frames: ["player.walk1"], loop: true }] });
    expect(auditAssetSpec(PLAYER, e).join()).toMatch(/做出了没要求的动画 "run"/);
  });

  it("帧数对不上 → 报出来（这正是「spec 说 4 帧、实际 3 帧」）", () => {
    const e = entry({ animations: entry().animations!.map((a) => (a.name === "walk" ? { ...a, frames: a.frames.slice(0, 3) } : a)) });
    expect(auditAssetSpec(PLAYER, e).join()).toMatch(/动画 "walk" 要 4 帧，实际 3 帧/);
  });

  it("尺寸对不上 → 报出来", () => {
    expect(auditAssetSpec(PLAYER, entry({ size: { w: 32, h: 48 } })).join()).toMatch(/尺寸对不上/);
  });

  it("kind 对不上 → 报出来（同一份产物，spec 说它是 sprite）", () => {
    expect(auditAssetSpec(PLATFORM, entry()).join()).toMatch(/spec 声明为 sprite，产物却是 animation/);
  });

  it("声明为 sprite 的产物却带了动画 / 多帧 → 报出来", () => {
    const e = entry({ kind: "sprite", animations: undefined });
    const msgs = auditAssetSpec(PLATFORM, e).join();
    expect(msgs).toMatch(/产物却带了动画|却有 6 帧/);
  });

  it("⚠️ drawlist 的 viewBox 与声明尺寸不一致 → 报出来（锚点的分母会跟着错）", () => {
    // ⚠️ 这里有两份不同的真实产物，别搞混：
    //   fixtures/drawlist/ 里的是**原型 GEOM** 的 player（32×48）；
    //   PLAYER 常量是 experiments/animated-player/ 那一套（24×32）。
    const dls = readdirSync(FIXTURE_DIR).filter((f) => f.startsWith("player.")).map((f) => fixture(f));
    expect(dls.length).toBeGreaterThan(0);
    expect(dls[0]!.viewBox.slice(2)).toEqual([32, 48]);
    const msgs = auditAssetSpec(PLAYER, entry(), dls).join();      // PLAYER 声明 24×32
    expect(msgs).toMatch(/viewBox 是 32×48，与声明的 24×32 不一致/);
    expect(msgs).toMatch(/锚点的分母/);
  });

  it("viewBox 与声明一致时不报（按原型那套 player 的尺寸来对）", () => {
    const dls = [fixture("player.idle.json")];                     // 32×48
    const spec: AssetSpec = { ...PLAYER, size: { w: 32, h: 48 } };
    expect(auditAssetSpec(spec, entry({ size: { w: 32, h: 48 } }), dls)).toEqual([]);
  });

  it("真实 fixture 全部能过 schema（规格与产物同源）", () => {
    for (const f of readdirSync(FIXTURE_DIR).filter((x) => x.endsWith(".json"))) {
      expect(parseDrawList(fixture(f)).ok, f).toBe(true);
    }
  });
});
