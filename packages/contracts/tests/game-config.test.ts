import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYER_MOVE, GameConfigSchema, auditGameConfig, maxJumpHeight, parseGameConfig, pickupCount, playerMoveOf,
  parseAssetPack, type AssetPackManifest, type GameConfig, type ConfigIssue,
} from "../src/index.js";

/** ⚠️ 夹具是**真跑出来的包**（票 40），不是现造的 —— 票 37 立的规矩：
 *  「最有分量的证据是真产物原样通过新契约」。 */
const PACK = fileURLToPath(new URL("../../../fixtures/packs/last-train/v2/manifest.json", import.meta.url));
const parsed = parseAssetPack(JSON.parse(readFileSync(PACK, "utf8")));
if (!parsed.ok) throw new Error("夹具包本身就不过 schema：" + parsed.errors.join("；"));
const MANIFEST: AssetPackManifest = parsed.value;

/** last-train 的配置 —— 资源 id 与动画名全部取自那个真包。 */
const base = (over: Partial<GameConfig> = {}): GameConfig => ({
  format: "game-config/v1",
  world: { size: { w: 1440, h: 270 } },
  scene: { background: { asset: "bg-dusk-halt" } },
  player: {
    asset: "player-traveler", anims: { idle: "idle", run: "run", jump: "jump" }, at: { x: 40, y: 250 },
  },
  terrain: [{ x: 0, y: 250, w: 1440, h: 20 }],
  entities: [
    { id: "suitcase-1", kind: "pickup", at: { x: 300, y: 240 }, asset: "pickup-suitcase" },
    { id: "suitcase-2", kind: "pickup", at: { x: 700, y: 240 }, asset: "pickup-suitcase" },
    { id: "suitcase-3", kind: "pickup", at: { x: 1100, y: 240 }, asset: "pickup-suitcase" },
    { id: "luggage", kind: "solid", at: { x: 500, y: 210 }, asset: "prop-luggage-pile", body: { w: 40, h: 40 } },
    { id: "carriage", kind: "hazard", at: { x: 800, y: 202 }, asset: "hazard-sweeping-carriage", anim: "sweep",
      motion: { kind: "cycle", axis: "x", distance: 400, periodMs: 4000 } },
    { id: "signal", kind: "goal", at: { x: 1400, y: 230 }, asset: "signal-endlight", anim: "red" },
  ],
  hud: {
    // ⚠️ `at` 是**左上角**（与 terrain 的 Rect、实体的 `body` 同一套），不是下边缘。
    //   世界高 270、面板高 32：`262` 是「底边留 8px」被写成了 `at.y`，于是面板跨 262..294
    //   —— 落在世界之外。底边留 8px 的正确写法是 `270 - 32 - 8 = 230`。
    panel: { asset: "hud-lost-slots", at: { x: 8, y: 230 }, size: { w: 72, h: 32 } },
    pip: { asset: "hud-pip", at: { x: 12, y: 250 }, step: { x: 20, y: 0 } },
  },
  objective: { kind: "collect-then-reach", gate: "signal" },
  ...over,
});

const issues = (c: unknown) => auditGameConfig(c as GameConfig, MANIFEST);
/** 人类的读法 —— 两个壳要渲染的就是这个形状。`ConfigIssue` 把「哪里」与「怎么了」
 *  拆成 `where` / `message` 两个字段（**一个事实只有一个家**），拼接是渲染方的事。
 *  ⚠️ 所以想断言「指到了哪一处」时，要拼起来断，不是去 `message` 里找位置。 */
const line = (i: ConfigIssue) => `${i.where}: ${i.message}`;
const errs = (c: unknown) => issues(c).filter((i) => i.severity === "error");
const warns = (c: unknown) => issues(c).filter((i) => i.severity === "warning");

describe("形状：一份真配置能过，逃生舱全被堵死", () => {
  it("last-train 的配置通过，且三族校验一条意见都没有", () => {
    const r = GameConfigSchema.safeParse(base());
    expect(r.success, r.success ? "" : r.error.issues.map((i) => i.message).join(" / ")).toBe(true);
    expect(issues(base())).toEqual([]);
  });

  it("多一个键就拒（`.strict()`，没有逃生舱）", () => {
    expect(GameConfigSchema.safeParse({ ...base(), extra: 1 }).success).toBe(false);
    expect(GameConfigSchema.safeParse({ ...base(), objective: { kind: "collect-then-reach", gate: "signal", count: 3 } }).success).toBe(false);
  });

  it("**非整数坐标被拒** —— `x: 10.5` 会静默糊掉像素网格", () => {
    expect(GameConfigSchema.safeParse({ ...base(), player: { ...base().player, at: { x: 10.5, y: 250 } } }).success).toBe(false);
    expect(GameConfigSchema.safeParse({ ...base(), terrain: [{ x: 0, y: 250.5, w: 10, h: 10 }] }).success).toBe(false);
  });

  it("`kind` 拼错被拒（封闭枚举）", () => {
    const c = base();
    c.entities[0] = { ...c.entities[0]!, kind: "collectible" as never };
    expect(GameConfigSchema.safeParse(c).success).toBe(false);
  });

  it("`motion.kind` 拼错被拒 —— V1 只实现 `cycle`", () => {
    const c = base();
    c.entities[4] = { ...c.entities[4]!, motion: { kind: "patrol", axis: "x", distance: 10, periodMs: 1 } as never };
    expect(GameConfigSchema.safeParse(c).success).toBe(false);
  });

  it("实体 id 重复被拒", () => {
    const c = base();
    c.entities[1] = { ...c.entities[1]!, id: "suitcase-1" };
    const r = GameConfigSchema.safeParse(c);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message).join()).toMatch(/id 重复/);
  });

  it("`player.move` 可省 —— 省了就用外壳的默认值（**默认值只有一处来源**）", () => {
    expect(base().player.move).toBeUndefined();
    expect(playerMoveOf(base())).toEqual(DEFAULT_PLAYER_MOVE);
    const explicit = base();
    explicit.player = { ...explicit.player, move: { speed: 120, jumpVelocity: 400, gravity: 1000 } };
    expect(playerMoveOf(explicit)).toEqual({ speed: 120, jumpVelocity: 400, gravity: 1000 });
  });

  it("`pickupCount` 从实体派生 —— 数量**不重复声明**", () => {
    expect(pickupCount(base())).toBe(3);
    expect(maxJumpHeight(DEFAULT_PLAYER_MOVE)).toBeCloseTo(60.5, 1);
  });
});

describe("引用族（硬失败）", () => {
  it("`objective.gate` 悬空 → 报出来", () => {
    const c = base();
    c.objective = { kind: "collect-then-reach", gate: "nope" };
    expect(errs(c).map((i) => i.message).join()).toMatch(/找不到 id 为 "nope" 的 goal 实体/);
  });

  it("引用了包里没有的资源 → 报出来（复用 `resolvePackRef`，不重写解析）", () => {
    const c = base();
    c.entities[0] = { ...c.entities[0]!, asset: "no-such-asset" };
    expect(errs(c).map((i) => i.message).join()).toMatch(/包里没有资源 "no-such-asset"/);
  });

  it("资源种类不对 → 报出来（把背景当玩家是最容易犯的那个）", () => {
    const c = base();
    c.player = { ...c.player, asset: "bg-dusk-halt" };
    expect(errs(c).map((i) => i.message).join()).toMatch(/是 background，这里要的是 animation/);
    const c2 = base();
    c2.hud = { ...c2.hud, panel: { ...c2.hud.panel, asset: "player-traveler" } };
    expect(errs(c2).map((i) => i.message).join()).toMatch(/是 animation，这里要的是 ui/);
  });

  it("**动作名逐个解** —— 一个把走路叫 `walk` 的包在构建期就被挡住，而不是运行时静默用错", () => {
    const c = base();
    c.player = { ...c.player, anims: { ...c.player.anims, run: "walk" } };
    expect(errs(c).map(line).join()).toMatch(/player\.anims\.run/);
  });

  it("一个 pickup 都没有 → 目标「捡齐 N 件」就没有内容", () => {
    const c = base();
    c.entities = c.entities.filter((e) => e.kind !== "pickup");
    expect(errs(c).map((i) => i.message).join()).toMatch(/一个 pickup 都没有/);
  });
});

describe("自洽族（硬失败）", () => {
  it("出生点卡在 solid 里 → 报出来", () => {
    const c = base();
    c.player = { ...c.player, at: { x: 510, y: 220 } };   // 落在 luggage 的盒内
    expect(errs(c).map((i) => i.message).join()).toMatch(/出生点卡在 solid "luggage" 里/);
  });

  it("坐标落到世界之外 → 报出来", () => {
    const c = base();
    c.entities[0] = { ...c.entities[0]!, at: { x: 5000, y: 240 } };
    expect(errs(c).map((i) => i.message).join()).toMatch(/落在世界之外/);
  });

  it("HUD 面板自己也要落在世界内", () => {
    const c = base();
    c.hud = { ...c.hud, panel: { ...c.hud.panel, at: { x: 1440, y: 262 } } };
    expect(errs(c).map(line).join()).toMatch(/hud\.panel.*世界之外/);
  });
});

describe("可通关族（**警告**，不判死刑）", () => {
  it("台阶高过最大跳跃高度 → 警告（正例）", () => {
    const c = base();
    c.entities[3] = { ...c.entities[3]!, at: { x: 500, y: 150 } };   // 地面 250，台阶 100px
    const w = warns(c);
    expect(w.map((i) => i.message).join()).toMatch(/台阶高 100px，而最大跳跃高度只有 60.5px/);
    expect(w[0]!.severity).toBe("warning");       // **不是 error** —— 上不去的台阶可能正是设计
    expect(errs(c)).toEqual([]);
  });

  it("台阶在能力之内 → 一条警告都没有（反例）", () => {
    expect(warns(base())).toEqual([]);
  });

  it("手感参数进 config 之后，同一条台阶的判决会跟着变", () => {
    const c = base();
    c.entities[3] = { ...c.entities[3]!, at: { x: 500, y: 150 } };
    expect(warns(c)).toHaveLength(1);
    c.player = { ...c.player, move: { speed: 90, jumpVelocity: 500, gravity: 900 } };   // 顶点 138.9
    expect(warns(c)).toEqual([]);
  });

  it("周期运动的行程越出世界 → 警告", () => {
    const c = base();
    c.entities[4] = { ...c.entities[4]!, motion: { kind: "cycle", axis: "x", distance: 900, periodMs: 4000 } };
    expect(warns(c).map((i) => i.message).join()).toMatch(/越出了世界的 x 边界 1440/);
  });
});

describe("parseGameConfig", () => {
  it("不过 schema 时给出可读的路径", () => {
    const r = parseGameConfig({ format: "game-config/v1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/world|player|objective/);
  });
});
