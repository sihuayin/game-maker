import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildWorld, SHELL_VERSION, VIEWPORT, type Box, type Missing } from "../src/index.js";

const read = (rel: string) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

/** ⚠️ **真跑出来的包**（票 40）。票 37 立的规矩：「最有分量的证据是真产物原样通过新契约」。 */
const MANIFEST = read("../../../fixtures/packs/last-train/v2/manifest.json");
/** 票 32 §3 那份**故意什么都缺**的夹具。 */
const EMPTY = read("../fixtures/empty-world.json");

/**
 * last-train 的一份**合法** game-config —— **文件是唯一来源**（探针也读它，不复制第二份）。
 *
 * ⚠️ 它的数字是按**锚点语义**写的 —— `at` 是「**锚点落在哪**」，不是左上角：
 *   角色的锚点是 `{x:.5,y:.95}`（脚），道具是 `{x:.5,y:1}`（底边中心），
 *   HUD 面板是 `{x:0,y:1}`（左下角）。所以「站在地面线上」= `at.y = 地面 y`。
 * ⚠️ **它就是票 31 要的那份「last-train 的 fixture game-config」**（票 33 产）。
 *   `fixtures/` 现在是**唯一来源** —— 外壳测试、站点装配、端到端冒烟读的都是它。
 */
const BASE = read("../../../fixtures/game-configs/last-train.json");
/** 每个用例都从**深拷**一份改 —— 反例才有意义（`structuredClone` 免得串味）。 */
const valid = (over: Record<string, unknown> = {}) => ({ ...structuredClone(BASE), ...over });

const build = (c: unknown) => buildWorld(MANIFEST, c, { packBase: "../../pack/v2/" });
/** 占位符的盒子 —— 只有它把落点直接写成左上角（画得出来的那些由锚点推，见 `world.ts` 的 `boxAt`）。 */
const boxOf = (d: Missing): Box => ({ x: d.x, y: d.y, w: d.w, h: d.h });

/** 票 32 §3 的四条判据之一：**出画布** —— 占位符必须真的落在能看到的地方。 */
const inViewport = (b: Box, v: { w: number; h: number } = VIEWPORT) =>
  b.x < v.w && b.y < v.h && b.x + b.w > 0 && b.y + b.h > 0;

describe("零数据：起得来（票 32 裁决 3）", () => {
  it("什么都不给也不抛，且产出一份「全是占位符」的描述", () => {
    const w = buildWorld(undefined, undefined);
    expect(w.viewport).toEqual(VIEWPORT);
    expect(w.worldSize).toEqual(VIEWPORT);
    expect(w.atlases).toEqual([]);
    expect(w.player.draw.missing).toBe(true);
    expect(w.hud.panel.draw.missing).toBe(true);
    expect(w.issues.length, "坏数据必须留下痕迹").toBeGreaterThan(0);
    expect(w.shellVersion).toBe(SHELL_VERSION);
  });

  it("给垃圾（不是对象）也不抛 —— 纯函数是外壳唯一扛得住坏数据的地方", () => {
    for (const junk of ["nope", 42, null, [], { format: "game-config/v9" }]) {
      expect(() => buildWorld(junk, junk)).not.toThrow();
      expect(() => buildWorld(MANIFEST, junk)).not.toThrow();
    }
  });
});

describe("空场景最小数据集：数据全错也不白屏", () => {
  it("不抛，且三处引用各自留下一条 error", () => {
    const w = build(EMPTY);
    expect(w.issues.filter((i) => i.severity === "error").length).toBeGreaterThanOrEqual(3);
    const all = w.issues.map((i) => `${i.where}: ${i.message}`).join("\n");
    expect(all).toMatch(/scene\.background/);
    expect(all).toMatch(/player/);
    expect(all).toMatch(/hud\.panel/);
  });

  it("**出画布** —— 每一个占位符都真的落在视口里", () => {
    const w = build(EMPTY);
    const boxes: Box[] = [
      ...w.background.map((l) => l.box),
      w.player.box,
      ...(w.player.draw.missing ? [boxOf(w.player.draw)] : []),
      ...(w.hud.panel.draw.missing ? [boxOf(w.hud.panel.draw)] : []),
    ];
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) expect(inViewport(b), `占位符跑到画布外了：${JSON.stringify(b)}`).toBe(true);
  });

  it("空数据也把玩家摆出来 —— 否则渲染层没法把相机挂上去", () => {
    const w = build(EMPTY);
    expect(w.player.draw.missing).toBe(true);
    expect(w.player.box.w).toBeGreaterThan(0);
  });
});

describe("正常数据：last-train 装配正确", () => {
  it("三族引用全部解得到 —— 一条意见都没有", () => {
    expect(build(valid()).issues).toEqual([]);
  });

  it("背景：**一个资源 = 一摞层**，视差与可平铺都从包里来（票 09 裁决 6）", () => {
    const w = build(valid());
    expect(w.background.map((l) => l.parallax)).toEqual([0, 0.6, 1]);
    expect(w.background.map((l) => l.tileX)).toEqual([false, true, true]);
    // ⚠️ 可平铺的层铺满**整个世界宽** —— 视差 p 的层要盖住宽 W 的世界，铺到 W 恒成立
    expect(w.background[0]!.box.w, "不平铺的层用资源标称宽").toBe(480);
    expect(w.background[1]!.box.w, "平铺的层铺满世界").toBe(1440);
    expect(w.background[2]!.box.w).toBe(1440);
    // 层与帧一一对应
    expect(w.background.map((l) => (l.draw.missing ? null : l.draw.frame)))
      .toEqual(["bg-dusk-halt.sky", "bg-dusk-halt.wall", "bg-dusk-halt.ground"]);
  });

  it("玩家：逐帧锚点来自资源、盒子由锚点推出来（**脚落在地面线上**）", () => {
    const w = build(valid());
    // 资源锚点 {x:.5, y:.95}、尺寸 32×48 ⇒ 盒子 (40−16, 250−46, 32, 48)
    expect(w.player.box).toEqual({ x: 24, y: 204, w: 32, h: 48 });
    expect(w.player.draw.missing).toBe(false);
    if (!w.player.draw.missing) expect(w.player.draw.anchor).toEqual({ x: 0.5, y: 0.95 });
  });

  it("动作名是**显式映射**，逐帧名一个不少（票 09 裁决 10）", () => {
    const w = build(valid());
    expect(Object.keys(w.player.anims).sort()).toEqual(["idle", "jump", "run"]);
    expect(w.player.anims.idle).toHaveLength(2);
    expect(w.player.anims.run).toHaveLength(4);
    expect(w.player.anims.jump).toHaveLength(2);
  });

  it("实体：盒子由锚点推出来 —— 站在地面线上的东西，盒底就是地面线", () => {
    const w = build(valid());
    const by = (id: string) => w.entities.find((e) => e.id === id)!;
    expect(by("luggage").box).toEqual({ x: 480, y: 210, w: 40, h: 40 });
    expect(by("luggage").box.y + by("luggage").box.h).toBe(250);
    expect(by("carriage").frames, "animation 类实体要带上帧名").toHaveLength(2);
    expect(by("carriage").motion).toEqual({ kind: "cycle", axis: "x", distance: 200, periodMs: 4000 });
    expect(by("suitcase-1").frames, "单帧资源不必带帧名").toBeUndefined();
  });

  it("HUD：面板尺寸来自 config（**票 09 的唯一例外**），槽位数与拾取物是**同一个数**", () => {
    const w = build(valid());
    expect(w.objective.pickupCount).toBe(3);
    expect(w.hud.pips).toHaveLength(3);
    expect(w.hud.pips.map((p) => p.at.x)).toEqual([12, 32, 52]);   // step.x = 20
    expect(w.hud.panel.box).toEqual({ x: 8, y: 230, w: 72, h: 32 });   // 锚点 {x:0,y:1} ⇒ 底边压在 262
  });

  it("地形与终点：盒子原样搬运，`gate` 指向真的 goal 实体", () => {
    const w = build(valid());
    expect(w.terrain).toEqual([{ x: 0, y: 250, w: 1440, h: 20 }]);
    expect(w.objective.gate).toBe("signal");
    expect(w.entities.some((e) => e.id === "signal" && e.kind === "goal")).toBe(true);
  });

  it("图集 URL 带上包基址 —— **路径写死就是 404，而 Phaser 静默失败**（票 03 实测）", () => {
    const w = build(valid());
    expect(w.atlases.length).toBe(4);
    for (const a of w.atlases) {
      expect(a.json.startsWith("../../pack/v2/")).toBe(true);
      expect(a.image.startsWith("../../pack/v2/")).toBe(true);
    }
  });

  it("手感参数：给就用给的，不给就回落到契约那一处默认值（票 09 裁决 11）", () => {
    const given = build(valid({ player: { ...valid().player, move: { speed: 120, jumpVelocity: 400, gravity: 1000 } } }));
    expect(given.player.move).toEqual({ speed: 120, jumpVelocity: 400, gravity: 1000 });
    expect(build(valid()).player.move).toEqual({ speed: 90, jumpVelocity: 330, gravity: 900 });
  });
});

describe("坏数据要显形，不许静默（票 32 裁决 3）", () => {
  it("终点指向不存在的实体 → 留下一条 error，但世界照常产出", () => {
    const w = build(valid({ objective: { kind: "collect-then-reach", gate: "__没有__" } }));
    expect(w.issues.map((i) => `${i.where}: ${i.message}`).join()).toMatch(/objective\.gate/);
    expect(w.entities.length, "世界不受影响").toBe(6);
  });

  it("某个实体的资源解不到 → 只有**那一个**变占位符，别的照常", () => {
    const c = valid();
    (c.entities[0] as Record<string, unknown>).asset = "__没有__";
    const w = build(c);
    expect(w.entities.filter((e) => e.draw.missing).map((e) => e.id)).toEqual(["suitcase-1"]);
    expect(w.entities.filter((e) => !e.draw.missing)).toHaveLength(5);
    const bad = w.entities[0]!.draw;
    expect(bad.missing).toBe(true);
    if (bad.missing) expect(inViewport(boxOf(bad))).toBe(true);
  });

  it("玩家的动画名对不上 → 那条链路报出来，玩家本体还在", () => {
    const c = valid();
    c.player = { ...c.player, anims: { ...c.player.anims, run: "walk" } };
    const w = build(c);
    expect(w.issues.map((i) => `${i.where}: ${i.message}`).join()).toMatch(/player\.anims\.run/);
    expect(w.player.draw.missing).toBe(false);
  });

  it("包坏了（manifest 不是包）→ 不抛，图集一个都不加载", () => {
    const w = buildWorld({ nope: true }, valid());
    expect(w.atlases).toEqual([]);
    expect(w.issues.length).toBeGreaterThan(0);
  });
});

describe("外壳常量", () => {
  it("视口是常量 480×270（票 32 裁决 1）—— 它不该被任何一个资源包改动", () => {
    expect(VIEWPORT).toEqual({ w: 480, h: 270 });
    // 换一个世界尺寸，视口纹丝不动
    const w = build(valid({ world: { size: { w: 3000, h: 270 } } }));
    expect(w.viewport).toEqual({ w: 480, h: 270 });
    expect(w.worldSize).toEqual({ w: 3000, h: 270 });
  });

  it("外壳版本号是从这里出去的那个数（票 32 裁决 6）", () => {
    expect(typeof SHELL_VERSION).toBe("string");
    expect(build(valid()).shellVersion).toBe(SHELL_VERSION);
  });
});
