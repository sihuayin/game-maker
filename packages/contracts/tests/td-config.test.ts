import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  auditTdConfig, parseAssetPack, parseTdConfig, tdDerivePath, tdDistanceToPath, tdPathCells,
  tdPathLength, tdResolveConfig, waveCount, towerButtonCount, tdTotalEnemyHp, tdWaveDurationMs,
  type AssetPackManifest, type TdConfig,
} from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
/** ⚠️ **真产物**：跑过完整资源管线的那一份包 + 手写的那一关。**不现造**（票 37 立的规矩）。 */
const PACK = path.join(ROOT, "fixtures/packs/counter-siege/v4");
const CONFIG = path.join(ROOT, "fixtures/td-configs/counter-siege.json");

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
const manifestOf = (): AssetPackManifest => {
  const r = parseAssetPack(readJson(path.join(PACK, "manifest.json")));
  if (!r.ok) throw new Error(`fixture 包不过 schema：${r.errors.join("；")}`);
  return r.value;
};
/** 一个合法的基准，每个用例 `structuredClone` 之后**只改一处**（与 `assetpack.test.ts` 同款）。 */
const valid = (): TdConfig => {
  const r = parseTdConfig(readJson(CONFIG));
  if (!r.ok) throw new Error(`fixture 关卡不过 schema：${r.errors.join("；")}`);
  return r.value;
};
const errorsOf = (c: TdConfig, tweakManifest?: (m: AssetPackManifest) => void) => {
  const m = manifestOf();
  tweakManifest?.(m);
  return auditTdConfig(c, m).filter((i) => i.severity === "error").map((i) => `${i.where}: ${i.message}`);
};
const warningsOf = (c: TdConfig) =>
  auditTdConfig(c, manifestOf()).filter((i) => i.severity === "warning").map((i) => `${i.where}: ${i.message}`);

describe("td-config/v1：schema 收与拒", () => {
  it("**真关卡原样通过**（最有分量的那条证据）", () => {
    expect(parseTdConfig(readJson(CONFIG)).ok).toBe(true);
  });

  it("它不是 game-config 的 v2 —— 换个 format 串就拒", () => {
    const c = readJson(CONFIG);
    c.format = "game-config/v1";
    expect(parseTdConfig(c).ok).toBe(false);
  });

  it("多一个字段就拒（`.strict()` —— 静默吞掉拼错的字段是最坏的失败）", () => {
    const c = readJson(CONFIG);
    c.paths = c.path;      // 拼错
    expect(parseTdConfig(c).ok).toBe(false);
  });

  it("坐标必须是**整数** —— `x: 10.5` 会静默糊掉像素网格", () => {
    const c = readJson(CONFIG);
    (c.path as { points: { x: number }[] }).points[1]!.x = 10.5;
    expect(parseTdConfig(c).ok).toBe(false);
  });

  it("`lives` 必须 > 0 —— 0 会产出一局「一开局就已经输了」的游戏", () => {
    const c = readJson(CONFIG);
    (c.economy as { lives: number }).lives = 0;
    expect(parseTdConfig(c).ok).toBe(false);
  });

  it("`levels` 是**定长 2 的元组** —— 三级机关不该能用这份 schema 表达", () => {
    const c = readJson(CONFIG);
    type Lv = Record<string, number>;
    (c.towers as { levels: Lv[] }[])[0]!.levels.push({ range: 80, damage: 9, fireMs: 300 });
    expect(parseTdConfig(c).ok).toBe(false);
  });

  it("减速系数必须**严格小于 1** —— 1 不是减速，>1 是加速", () => {
    const c = readJson(CONFIG);
    type Lv = { slow?: { factor: number; ms: number } };
    (c.towers as { levels: Lv[] }[])[1]!.levels[0]!.slow = { factor: 1, ms: 1000 };
    expect(parseTdConfig(c).ok).toBe(false);
  });

  it("机关 id 重复 → 拒（错在**根上**，不是等真跑起来两个同名机关互相覆盖）", () => {
    const c = readJson(CONFIG);
    const t = c.towers as unknown[];
    t[1] = structuredClone({ ...(t[0] as object), id: "nailgun" });
    expect(parseTdConfig(c).ok).toBe(false);
  });

  it("波次引用一个不存在的敌人 → 拒，且消息里点名是哪一个", () => {
    const c = readJson(CONFIG);
    ((c.waves as { groups: { enemy: string }[] }[])[0]!.groups[0]!).enemy = "__没有__";
    const r = parseTdConfig(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/找不到 id 为 "__没有__" 的敌人/);
  });
});

describe("td-config/v1：三族校验（真包 + 真关卡）", () => {
  it("**真关卡零硬失败**", () => {
    expect(errorsOf(valid())).toEqual([]);
  });

  it("引用族：借来的包少一个资源就当场拦住", () => {
    const c = structuredClone(valid());
    c.towers[0]!.asset = "__没有__";
    expect(errorsOf(c).join("\n")).toMatch(/包里没有资源 "__没有__"/);
  });

  it("引用族：拿 sprite 当 ui 用 → 拒，且消息说得出**它是什么**", () => {
    const c = structuredClone(valid());
    c.hud.panel.asset = "tower-nailgun";
    expect(errorsOf(c).join("\n")).toMatch(/"tower-nailgun" 是 sprite，这里要的是 ui/);
  });

  it("引用族：敌人的 anim 解不开 → 拒", () => {
    const c = structuredClone(valid());
    c.enemies[0]!.anim = "__没有__";
    expect(errorsOf(c).join("\n")).toMatch(/没有名为 "__没有__" 的动画/);
  });

  it("自洽族：**斜着的一段路**必须拒 —— 任意角度会毁掉像素网格", () => {
    const c = structuredClone(valid());
    c.path!.points[1] = { x: c.path!.points[1]!.x, y: c.path!.points[1]!.y + 3 };
    expect(errorsOf(c).join("\n")).toMatch(/不轴对齐/);
  });

  it("自洽族：**零长度段**必须拒 —— 归一化方向是 (0,0) → NaN 的精灵坐标，而不报错", () => {
    const c = structuredClone(valid());
    c.path!.points[1] = { ...c.path!.points[0]! };
    expect(errorsOf(c).join("\n")).toMatch(/完全重合/);
  });

  it("自洽族：**插槽不许压在走道上**", () => {
    const c = structuredClone(valid());
    c.slots[0]!.at = { x: 412, y: 127 };     // 正好是折线上的一个拐点
    expect(errorsOf(c).join("\n")).toMatch(/离走道只有 0.0px/);
  });

  it("自洽族：**场地必须与世界的尺寸对得上**", () => {
    const c = structuredClone(valid());
    c.arena.cell = 16;                        // 32×16 = 512 ≠ 480
    expect(errorsOf(c).join("\n")).toMatch(/场地与世界的尺寸对不上/);
  });

  it("自洽族：**走道画在哪、敌人就走哪** —— 路径穿过一格货架就是硬失败", () => {
    const c = structuredClone(valid());
    // 第 8 行是那条长走道，把它中间改成货架
    c.arena.rows[8] = c.arena.rows[8]!.slice(0, 12) + "=" + c.arena.rows[8]!.slice(13);
    expect(errorsOf(c).join("\n")).toMatch(/不是走道砖/);
  });

  it("自洽族：`walkChar` 指的字符不在 tiles 里 → 拒（那样整张图没有一格是走道）", () => {
    const c = structuredClone(valid());
    c.arena.walkChar = "%";
    expect(errorsOf(c).join("\n")).toMatch(/走道字符 "%" 不在 arena.tiles 里/);
  });

  // ⚠️ 下面两条由票 07 顶出来。判据的实据是：**两个真包的砖都是 15×15、锚点正中** ⇒ 不误伤任何真产物。
  it("引用族：**砖的尺寸必须正好等于 `arena.cell`**（一张 40×32 的柜台当走道砖 → 拒）", () => {
    const c = structuredClone(valid());
    c.arena.tiles[":"] = { asset: "core-counter" };          // 40×32，而 cell 是 15
    expect(errorsOf(c).join("\n")).toMatch(/砖的尺寸必须\*\*正好等于\*\* arena\.cell/);
  });

  it("引用族：**砖的锚点必须正中**（锚点偏了整张地图偏半格，而不报错）", () => {
    const c = structuredClone(valid());
    expect(errorsOf(c, (m) => {
      m.assets.find((a) => a.id === "tile-wall")!.anchor = { x: 0, y: 0 };
    }).join("\n")).toMatch(/砖的锚点必须是 \{x:0\.5, y:0\.5\}/);
  });

  // ⚠️ 这条由票 10 顶出来，而它的实据是一次真跑：模型编译的那一关，电击地板 L1（射程 40）
  //   在**任何一个插槽上都够不着**（覆盖 0%）—— 那座塔建了永远不开火。
  it("自洽族：**每种机关的 L1 至少要有一个插槽够得着走道**（否则那座塔是死的）", () => {
    const c = structuredClone(valid());
    c.towers[1]!.levels[0].range = 5;                        // 而最近的插槽离走道 15px
    expect(errorsOf(c).join("\n")).toMatch(/任何一个插槽上都够不着走道/);
  });

  it("⚠️ **只看 L1**：L1 够得着就放行，哪怕 L2 够不着（L1 才是「你第一次把它建出来」的那个状态）", () => {
    const c = structuredClone(valid());
    c.towers[1]!.levels[0].range = 52;                       // L1 够得着
    c.towers[1]!.levels[1].range = 5;                        // L2 反而够不着 —— 不看它
    expect(errorsOf(c)).toEqual([]);
  });

  it("可通关族：伤害与护甲**写反了量级** → 警告（不是硬失败：下限 1 保证还打得动）", () => {
    const c = structuredClone(valid());
    for (const t of c.towers) for (const l of t.levels) l.damage = 1;
    for (const e of c.enemies) e.armor = 5;
    expect(warningsOf(c).join("\n")).toMatch(/数值刻度多半写反了量级/);
  });
});

describe("td-config/v1：**路径从走道派生**（票 12 —— 那一族失败被做成结构上不可能）", () => {
  // ⚠️ **为什么这一族要整块删掉**：20 次真调用里单次过 ≈ 25%，而失败**几乎全在同一族** ——
  //   模型写下的 `path.points` 与它自己画成 `:` 的那张地图**对不上**。
  //   写得更硬（0/4 → 1/4）与换更大的模型（代理忽略模型名）都够不着它 ⇒ 换掉**谁写它**。
  /** 真关卡**删掉 `path` 那一块** —— 模型交出来的就是没有它的那一份。 */
  const noPath = (): TdConfig => {
    const c = structuredClone(valid());
    delete c.path;
    return c;
  };
  /** 把某一行的某一格改成别的字符（原地改，别的都不动）。 */
  const put = (c: TdConfig, r: number, col: number, ch: string) => {
    c.arena.rows[r] = c.arena.rows[r]!.slice(0, col) + ch + c.arena.rows[r]!.slice(col + 1);
  };
  const doors = (c: TdConfig) =>
    c.arena.rows.flatMap((row, r) => [...row].map((ch, col) => ({ ch, col, r }))).filter((x) => x.ch === "+");

  it("schema 收得下**没有 `path`** 的关卡 —— 模型本来就不写它", () => {
    expect(parseTdConfig(noPath()).ok).toBe(true);
  });

  it("`tdResolveConfig` 把它**填回去**，而且**只补这一块**（别处逐字未动）", () => {
    const r = tdResolveConfig(noPath());
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    // ⚠️ 断言「除了 path 之外一字不差」—— 补全**只许**补这一块，多补一处就是另一件事了。
    expect({ ...r.value, path: null }).toEqual({ ...valid(), path: null });
    expect(parseTdConfig(r.value).ok).toBe(true);
  });

  it("派生的路径：**只落在走道格上**、**轴对齐**、起点**紧挨着门口**那一格", () => {
    const c = noPath();
    const d = tdDerivePath(c);
    expect(d.ok, d.ok ? "" : d.error).toBe(true);
    if (!d.ok) return;
    expect(d.points.length).toBeGreaterThanOrEqual(2);
    for (const p of d.points) {
      const ch = [...c.arena.rows[Math.floor(p.y / c.arena.cell)]!][Math.floor(p.x / c.arena.cell)]!;
      expect(ch, `路径点 (${p.x},${p.y}) 落在格 "${ch}" 上`).toBe(c.arena.walkChar);
    }
    for (let i = 1; i < d.points.length; i++) {
      const a = d.points[i - 1]!, b = d.points[i]!;
      expect(a.x === b.x || a.y === b.y, `第 ${i} 段不轴对齐`).toBe(true);
    }
    // ⚠️ 起点必须是**紧挨着 `+` 的那一格**的中心 —— 敌人从门口进，第一步就踩在路径上。
    const door = doors(c)[0]!;
    const half = Math.floor(c.arena.cell / 2);
    const start = d.points[0]!;
    expect(Math.abs(start.x - (door.col * c.arena.cell + half)) +
      Math.abs(start.y - (door.r * c.arena.cell + half))).toBe(c.arena.cell);
  });

  it("⚠️ **走道分了叉** → 拒 —— 那时「敌人走哪条」就没有唯一答案", () => {
    // 票 02 当年正是拿这条理由否掉了「用算法找路」；票 12 证明它的**前提没了**（单线 ⇒ 顺序唯一）。
    const c = noPath();
    put(c, 7, 12, ":");                       // 长走道上方再开一格 ⇒ `(12,8)` 成了 T 字口
    expect(errorsOf(c).join("\n")).toMatch(/分了叉/);
  });

  it("⚠️ **两个入口** → 拒 —— 不然不知道敌人从哪一头进", () => {
    const c = noPath();
    put(c, 16, 30, "+");
    expect(errorsOf(c).join("\n")).toMatch(/个入口/);
  });

  it("⚠️ **端头都不挨着入口** → 拒 —— 敌人从门口走不到走道上", () => {
    const c = noPath();
    put(c, 4, 31, ".");                       // 把原来的门口封上（走道还在，入口没了）
    put(c, 16, 2, "+");                       // 远处另开一个 —— 它不挨着任何一个端头
    expect(errorsOf(c).join("\n")).toMatch(/都不挨着入口/);
  });

  it("⚠️ **走道断了**（还有一块连不上）→ 拒，且说得出走了几格、画了几格", () => {
    const c = noPath();
    c.arena.rows[2] = "::" + c.arena.rows[2]!.slice(2);   // 左上角另开一个 2×2 的环
    c.arena.rows[3] = "::" + c.arena.rows[3]!.slice(2);
    expect(errorsOf(c).join("\n")).toMatch(/走道断了：从入口那头只走得到 \d+ 格/);
  });

  it("⚠️ **走道绕成一个圈**（一个端头都没有）→ 拒 —— 起点无从谈起", () => {
    const c = noPath();
    c.arena.rows = c.arena.rows.map((_, r) => (r === 2 || r === 3 ? "##::" + "#".repeat(28) : "#".repeat(32)));
    put(c, 2, 0, "+");                        // 只留门口那个 `+`，走道是一个 2×2 的环
    expect(errorsOf(c).join("\n")).toMatch(/绕成了一个圈/);
  });

  it("⚠️ 手写的路径**照旧被校验** —— 缺席才派生，写了就按写的查", () => {
    const c = structuredClone(valid());
    c.path!.points[1] = { ...c.path!.points[1]!, y: c.path!.points[1]!.y + 3 };
    expect(parseTdConfig(c).ok).toBe(true);   // schema 这一层收得下
    expect(errorsOf(c).join("\n")).toMatch(/不轴对齐/);
  });
});

describe("td-config/v1：派生量与几何助手（**只此一处算**）", () => {
  it("波数 / 按钮数都是派生的，不重复声明", () => {
    const c = valid();
    expect(waveCount(c)).toBe(c.waves.length);
    expect(towerButtonCount(c)).toBe(c.towers.length);
  });

  it("折线总长 = 各段之和（轴对齐时就是曼哈顿距离）", () => {
    expect(tdPathLength([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }])).toBe(70);
  });

  it("点到折线的距离：落在段上得 0，垂直偏移得偏移量", () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(tdDistanceToPath(line, { x: 50, y: 0 }).distance).toBe(0);
    expect(tdDistanceToPath(line, { x: 50, y: 15 }).distance).toBe(15);
    expect(tdDistanceToPath(line, { x: -10, y: 0 }).distance).toBe(10);   // 端点外
  });

  it("折线穿过的格子：轴对齐时一格不落", () => {
    const cells = tdPathCells([{ x: 7, y: 7 }, { x: 37, y: 7 }], 15);
    expect(cells.map((c) => c.c)).toEqual([0, 1, 2]);
    expect(new Set(cells.map((c) => c.r))).toEqual(new Set([0]));
  });

  it("全场敌人总血 = 各波各组的血量之和", () => {
    const c = valid();
    const byHand = c.waves.reduce((n, w) =>
      n + w.groups.reduce((m, g) => m + g.count * (c.enemies.find((e) => e.id === g.enemy)?.hp ?? 0), 0), 0);
    expect(tdTotalEnemyHp(c)).toBe(byHand);
  });

  it("一波的时长 = 最晚放完的那一组", () => {
    expect(tdWaveDurationMs({ groups: [
      { enemy: "a", count: 1, gapMs: 0, delayMs: 0 },
      { enemy: "b", count: 3, gapMs: 100, delayMs: 50 },
    ] })).toBe(250);
  });
});
