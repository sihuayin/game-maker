import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTdWorld, pathPointAt, type TdWorldDescription } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
/** ⚠️ **真产物**：跑过完整资源管线的那一份包 + 手写的那一关。**不现造**（票 37 立的规矩）。 */
const PACK = path.join(ROOT, "fixtures/packs/counter-siege/v4");
const CONFIG = path.join(ROOT, "fixtures/td-configs/counter-siege.json");
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const manifest = () => readJson(path.join(PACK, "manifest.json"));
const config = () => readJson(CONFIG);

const build = (m: unknown = manifest(), c: unknown = config()): TdWorldDescription =>
  buildTdWorld(m, c, { packBase: "../../pack/v4/" });

describe("buildTdWorld：真包 + 真关卡读出来的那份描述", () => {
  it("**一条 issue 都没有** —— 真产物原样过", () => {
    expect(build().issues).toEqual([]);
  });

  it("场地是一格一格铺满的：32×18 = 576 块砖，与世界严丝合缝", () => {
    const w = build();
    expect([w.arena.cols, w.arena.rows]).toEqual([32, 18]);
    expect(w.arena.cell * w.arena.cols).toBe(w.worldSize.w);
    expect(w.arena.cell * w.arena.rows).toBe(w.worldSize.h);
    expect(w.arena.tiles).toHaveLength(576);
    expect(w.arena.tiles.every((t) => !t.draw.missing)).toBe(true);
  });

  it("折线的弧长**在纯层就累好了** —— 外壳不做几何", () => {
    const w = build();
    expect(w.path.total).toBeCloseTo(555, 6);
    expect(w.path.cum).toHaveLength(w.path.points.length);
    expect(w.path.cum[0]).toBe(0);
    expect(w.path.cum.at(-1)).toBeCloseTo(w.path.total, 6);
  });

  it("柜台的位置**就是路径终点**（不重复声明，所以不可能对不上）", () => {
    const w = build();
    expect(w.core.at).toEqual(w.path.points.at(-1));
  });

  it("机关按配置原样搬过来，两级都在", () => {
    const w = build();
    expect(w.towers.map((t) => t.id)).toEqual(["nailgun", "shock", "floodlight"]);
    expect(w.towers.every((t) => t.levels.length === 2)).toBe(true);
    const shock = w.towers.find((t) => t.id === "shock")!;
    expect(shock.attack).toBe("aoe");
    expect(shock.fx?.frames).toHaveLength(3);          // 电击环的逐帧名
    expect(shock.projectile).toBeUndefined();          // aoe 不抛东西
  });

  it("HUD 按钮的条数 = 机关种类数（派生），位置按 step 排开", () => {
    const w = build();
    expect(w.hud.buttons).toHaveLength(w.towers.length);
    expect(w.hud.buttons.map((b) => b.towerId)).toEqual(w.towers.map((t) => t.id));
    const xs = w.hud.buttons.map((b) => b.at.x);
    expect(xs).toEqual([300, 348, 396]);
  });

  it("波次**在纯层就摊平成绝对毫秒**了 —— 外壳不做 `delayMs + i×gapMs` 这种算术", () => {
    const w = build();
    expect(w.waves).toHaveLength(5);
    for (const wave of w.waves) {
      const times = wave.spawns.map((s) => s.atMs);
      expect(times).toEqual([...times].sort((a, b) => a - b));   // 已排序
      expect(wave.durationMs).toBe(times.at(-1) ?? 0);
    }
    // 第 3 波：蛮兵 4 只（延迟 1s、间隔 1.5s）+ 拾荒者 6 只（间隔 0.7s，与上一组**并行**）
    const w3 = w.waves[2]!;
    expect(w3.spawns.filter((s) => s.enemy === "brute").map((s) => s.atMs)).toEqual([1000, 2500, 4000, 5500]);
    expect(w3.spawns.filter((s) => s.enemy === "scavenger")).toHaveLength(6);
  });

  it("objective 的波数**从 waves.length 派生**，不重复声明", () => {
    const w = build();
    expect(w.objective).toEqual({ kind: "survive-waves", waveCount: w.waves.length });
  });
});

describe("pathPointAt：敌人现在在哪（**渲染、索敌、命中判定三处共用**）", () => {
  const line = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }], cum: [0, 100, 150], total: 150 };

  it("段内线性、拐点精确", () => {
    expect(pathPointAt(line, 0)).toEqual({ x: 0, y: 0 });
    expect(pathPointAt(line, 50)).toEqual({ x: 50, y: 0 });
    expect(pathPointAt(line, 100)).toEqual({ x: 100, y: 0 });
    expect(pathPointAt(line, 125)).toEqual({ x: 100, y: 25 });
  });

  it("**超界夹住**，不外推 —— 外推会让漏掉的怪跑到世界外面去", () => {
    expect(pathPointAt(line, -10)).toEqual({ x: 0, y: 0 });
    expect(pathPointAt(line, 999)).toEqual({ x: 100, y: 50 });
  });
});

describe("buildTdWorld：**零数据也必须起得来**（与横版同一条纪律）", () => {
  const broke = (w: TdWorldDescription) => {
    expect(w.issues.some((i) => i.severity === "error")).toBe(true);   // 坏了要说出来
    expect(w.arena.tiles).toEqual([]);                                  // 但**不抛**
    expect(w.objective.waveCount).toBe(0);
  };

  it("什么都没有", () => broke(buildTdWorld(undefined, undefined)));
  it("配置是垃圾", () => broke(buildTdWorld(manifest(), { format: "td-config/v1", 乱写: true })));
  it("包是垃圾", () => broke(buildTdWorld({ nope: 1 }, config())));
  it("配置是 null", () => broke(buildTdWorld(manifest(), null)));

  it("配置**过得了 schema 但解不到资源**时：占位符就位、issue 说得出是哪个引用", () => {
    const c = config();
    c.towers[0].asset = "__没有__";
    const w = build(manifest(), c);
    const errs = w.issues.filter((i) => i.severity === "error").map((i) => `${i.where}: ${i.message}`);
    // ⚠️ 消息与位置**分开报**（`where` + `message`）—— 与横版同一个形状
    expect(errs.join("\n")).toMatch(/tower "nailgun": __没有__：包里没有资源 "__没有__"/);
    expect(w.towers[0]!.draw.missing).toBe(true);       // 画不出来 → 占位符
    expect(w.arena.tiles).toHaveLength(576);            // 其余照画，游戏继续
  });
});
