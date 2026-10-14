import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_HUD_LINE_HEIGHT, DEFAULT_PLAYER_MOVE, GameConfigSchema, PLAYER_ACTION_NAMES, Player as PlayerSchema,
  auditGameConfig, auditScreenSpace, gameHudScreenItems, jumpSpan, maxJumpHeight, parseGameConfig, pickupCount, playerMoveOf,
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
    // ⚠️ `at` 是**锚点落点**，不是左上角（票 48）。面板的锚点是 `{x:0, y:1}`（左下角），
    //   所以 `y = 262` 就是「底边离世界底 8px」—— 盒子是 230..262，**本来就对**。
    //   票 41 曾按左上角近似把它改成 230，那是**修错了地方**（盒子算错，不是夹具写错）。
    panel: { asset: "hud-lost-slots", at: { x: 8, y: 262 }, size: { w: 72, h: 32 } },
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

/** ⚠️ **契约层没有视口常量**（票 80 施工时量的）：两份具名的住在别处 ——
 *  `assets/src/ops.ts` 的 `DEFAULT_VIEWPORT`、`demo/src/draw.ts` 的 `VIEWPORT`，
 *  而契约**依赖不到**它们（`check:deps` 会当场拒）。⇒ 这里就地写一份，
 *  值取那两份的一致值（480×270 = 票 32 裁决 1 的外壳常量）。 */
const VIEWPORT = { w: 480, h: 270 } as const;

/** **视口尺**那一族 —— 票 80 之后它是 `hud.*` **唯一**的尺子（世界尺那一条已从 `auditGameConfig` 删掉）。 */
const vpErrs = (c: GameConfig) =>
  auditScreenSpace(VIEWPORT, gameHudScreenItems(c, MANIFEST, { lineHeight: DEFAULT_HUD_LINE_HEIGHT }))
    .filter((i) => i.severity === "error");

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

  it("⚠️ 票 21：`jumpSpan` 是**一次跳跃的水平跨度** —— 同高 66px，落点越低越远（同一条抛物线）", () => {
    // 滞空 `2v/g` = 2×330÷900 = 0.7333s ⇒ 90 × 0.7333 = 66px。
    expect(jumpSpan(DEFAULT_PLAYER_MOVE)).toBeCloseTo(66, 1);
    expect(jumpSpan(DEFAULT_PLAYER_MOVE, 0)).toBeCloseTo(66, 1);
    // 落点掉到世界的底（270px）⇒ 滞空变长 ⇒ 跨度变大（`auditReachability` 的搜索半径就是这么来的）
    expect(jumpSpan(DEFAULT_PLAYER_MOVE, 270)).toBeCloseTo(110.13, 1);
    // ⚠️ **单调**：掉得越久走得越远 —— 这条式子只有一处实现（判据与提示词共用它）
    expect(jumpSpan(DEFAULT_PLAYER_MOVE, 270)).toBeGreaterThan(jumpSpan(DEFAULT_PLAYER_MOVE));
    // 跑得更快就跨得更远（换一套手感，同一式子照算）
    expect(jumpSpan({ ...DEFAULT_PLAYER_MOVE, speed: 180 })).toBeCloseTo(132, 0);
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

// ── 票 61 · 那一半「清单完全正确也拦不住」的形状 ────────────────────────────────
//
// ⚠️ 上面那条「动作名逐个解」**逐格**解引用：三格填**同一个**名字时它一格都不报
//   （每一格确实解得到）—— 而外壳按三个键**各取一路**播一种动作。⇒ 那是本票补的那个洞
//   （人裁 Q7(r2) = (b)：配方侧保证三路齐备，**配置侧**保证三格解析到三个不同的动画名）。
/** 只报在 `player.anims` **本格**上的（不含逐格那几条 `player.anims.<动作>`）。 */
const animsIssues = (c: unknown) => errs(c).filter((i) => i.where === "player.anims");

describe("票 61 · 三格必须指到三个**不同**的动画", () => {
  it("阳性：三格互不相同 ⇒ `player.anims` 上一条都不报", () => {
    expect(animsIssues(base())).toEqual([]);
  });

  it("阴性：三格**全填同一个** ⇒ **恰好一条** error，且 `where` 是 `player.anims`", () => {
    const c = base();
    c.player = { ...c.player, anims: { idle: "idle", run: "idle", jump: "idle" } };
    const hit = animsIssues(c);
    expect(hit, "三格全同也只报一条（同一个事实说一遍）").toHaveLength(1);
    expect(hit[0]!.message).toMatch(/同一个/);
    // ⚠️ **而逐格那几条照旧一条都不报** —— 三格各自都解得到，本票补的正是这个洞
    expect(errs(c).filter((i) => i.where.startsWith("player.anims."))).toEqual([]);
  });

  it("阴性 · 只有**两格**撞在一起 ⇒ 也报，且点名是**哪两格**", () => {
    const c = base();
    c.player = { ...c.player, anims: { idle: "idle", run: "run", jump: "idle" } };
    const hit = animsIssues(c);
    expect(hit).toHaveLength(1);
    expect(hit[0]!.message).toContain("`idle` 与 `jump`");
  });

  it("⚠️ 它**不**在收窄「显式映射」那条自由：三格指**三个不同的、别名叫法**的动画 ⇒ 本格一条不报", () => {
    // 票 09 裁决 10 说的是「这一路叫什么名字由包自己定」—— 所以「名字必须是 idle/run/jump」
    // **不是**配置层的要求（那是**配方层**那条闸门的事，票 61 的 Q5/Q6）。
    const c = base();
    c.player = { ...c.player, anims: { idle: "stand", run: "sprint", jump: "leap" } };
    expect(animsIssues(c)).toEqual([]);                       // 本格的对账不开口
    expect(errs(c).filter((i) => i.where.startsWith("player.anims.")), "逐格照旧解引用")
      .toHaveLength(3);                                      // 那个包没有这三个名字 —— 该报的是那三条
  });

  it("⚠️ **不削弱契约**（人裁验收第 5 条）：三格**仍必填、仍封口** —— 本票一个字没放宽", () => {
    const drop = (k: string) => {
      const c = base() as unknown as { player: { anims: Record<string, unknown> } };
      delete c.player.anims[k];
      return c;
    };
    for (const k of ["idle", "run", "jump"]) expect(parseGameConfig(drop(k)).ok, `缺 ${k}`).toBe(false);
    const extra = base() as unknown as { player: { anims: Record<string, unknown> } };
    extra.player.anims["walk"] = "walk";
    expect(parseGameConfig(extra).ok, "多一格").toBe(false);
    const empty = base() as unknown as { player: { asset: string } };
    empty.player.asset = "";
    expect(parseGameConfig(empty).ok, "`player.asset` 仍是非空串").toBe(false);
  });

  it("⚠️ **那三个词全仓只写一遍**：`PLAYER_ACTION_NAMES` 就是契约的键，且字面上仍是外壳播的那三个", () => {
    // ⚠️ 这一条是**故意重复**的：外壳（`demo/src/shell/scene.ts`）按定义就播 idle/run/jump，
    //   而 contracts 够不着它 ⇒ 只有这里那一条字面能把两边钉在一起。
    expect([...PLAYER_ACTION_NAMES]).toEqual(["idle", "run", "jump"]);
    // ⚠️ 走 `Player` 而不是顶层那份 —— 顶层带 `superRefine`（是 `ZodEffects`，没有 `.shape`）。
    expect(Object.keys(PlayerSchema.shape.anims.shape)).toEqual([...PLAYER_ACTION_NAMES]);
  });
});

describe("自洽族（硬失败）", () => {
  it("出生点卡在 solid 里 → 报出来", () => {
    const c = base();
    // ⚠️ luggage 的锚点是 `{x:.5,y:1}`、尺寸 40×40，`at = (500,210)`
    //   ⇒ 盒子是 **(480,170) 40×40**，不是 (500,210)。
    c.player = { ...c.player, at: { x: 500, y: 190 } };
    expect(errs(c).map((i) => i.message).join()).toMatch(/出生点卡在 solid "luggage" 里/);
  });

  it("坐标落到世界之外 → 报出来", () => {
    const c = base();
    c.entities[0] = { ...c.entities[0]!, at: { x: 5000, y: 240 } };
    expect(errs(c).map((i) => i.message).join()).toMatch(/落在世界之外/);
  });

  it("**`at` 是锚点落点，不是左上角** —— 站在地面线上的东西不许被判越界（票 48）", () => {
    // 世界高 270、地面线 250。底边锚点（`{x:.5,y:1}`）的东西写 `at.y = 250` 就是「站在地上」。
    // ⚠️ 这条以前会挂：越界检查把 `at` 当左上角，算成 `250 + 40 = 290 > 270` —— **凭空多算一个 h**。
    const c = base();
    for (const id of ["luggage", "carriage", "signal"]) {
      const e = c.entities.find((x) => x.id === id)!;
      e.at = { x: e.at.x, y: 250 };
    }
    expect(errs(c).map(line).join()).toBe("");
    expect(warns(c).map(line).join()).toBe("");
  });

  it("盒子的**底边**才是判据 —— 真越界必须被报", () => {
    const c = base();
    c.entities[0] = { ...c.entities[0]!, at: { x: 300, y: 280 } };   // 盒底 280 > 世界底 270
    expect(errs(c).map(line).join()).toMatch(/entity "suitcase-1".*世界之外/);
  });

  it("**锚点决定盒子从哪边长** —— 换个 `at`，判决跟着盒子走（这条是锚点语义的守门人）", () => {
    // ⚠️ 没有这一条，这个 bug 可以一直悄悄活着：**没有一条测试问过「盒子是从哪儿算的」**。
    // `hud-lost-slots` 锚点 `{x:0,y:1}`（左下角）、尺寸 72×32：
    //   `at = (8,262)` ⇒ 盒子 (8, 230, 72, 32)，底边正好压在 262 ✅
    // ⚠️ **票 80 之后量它的是视口尺，不是世界尺** —— 而算盒子的是**同一个** `entityBox`
    //   （`gameHudScreenItems` 调的就是它）⇒ 这条性质**照样被算到同一步**，不是换了条判据就没人守。
    //   世界高 270 与视口高 270 在这一轴上恰好相等，所以两个 `at` 的判决逐字不变。
    const ok = base();
    ok.hud = { ...ok.hud, panel: { ...ok.hud.panel, at: { x: 8, y: 262 } } };
    expect(vpErrs(ok)).toEqual([]);
    expect(errs(ok)).toEqual([]);          // 世界那一族照旧一个字没有（它今天管不着 HUD）
    // 同一个 `at`，把面板再往下推 9px ⇒ 盒子底边 271 > 270，真的出去了 ❌
    const bad = base();
    bad.hud = { ...bad.hud, panel: { ...bad.hud.panel, at: { x: 8, y: 271 } } };
    expect(vpErrs(bad).map(line).join()).toMatch(/hud\.panel.*屏幕空间/);
  });

  it("HUD 面板自己也要落在**视口**内（票 80：世界尺那一条已删）", () => {
    const c = base();
    c.hud = { ...c.hud, panel: { ...c.hud.panel, at: { x: 1440, y: 262 } } };
    expect(vpErrs(c).map(line).join()).toMatch(/hud\.panel.*屏幕空间/);
    // ⚠️ 而**世界尺今天对 HUD 一个字都不说** —— 票 80 删的就是那一行（`game-config.ts:430`）。
    //   这一句是**证伪性**的：谁把那一行加回来，它会当场红。⚠️ 断的是「HUD 不在里面」，
    //   不是「一条都没有」—— 后者会因为**别的原因**变红，把这条的意思带偏。
    expect(errs(c).map(line).join()).not.toMatch(/hud\.panel/);
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

// ── 票 14 补的那条判据 ─────────────────────────────────────────────────────────
//
// ⚠️ 票 09 的九条硬规矩里，**只有这一条此前没有任何判据看着**：`scale` 进不来靠的是 `.strict()`
//   这个**结构**保证。而结构保证会**静默失效** —— 下一个人把某个子对象从 `.strict()` 改回 `z.object()`
//   （比如为了收一个可选键），`scale` 就悄悄能进来了，而**没有任何测试会红**。
describe("⚠️ 禁 `scale`（票 09 裁决 5）+「资源自身的性质归包」", () => {
  const ok = (x: unknown) => parseGameConfig(x).ok;
  /** 往某个子对象上塞一个键。 */
  const withKey = (at: (c: Record<string, unknown>) => Record<string, unknown>, k: string) => {
    const c = base() as unknown as Record<string, unknown>;
    at(c)[k] = 1.7;
    return c;
  };

  it("`scale` 在**任何一层**出现都当场拒（顶层 / 实体 / HUD / 玩家）", () => {
    expect(ok({ ...(base() as unknown as Record<string, unknown>), scale: 1.7 }), "顶层").toBe(false);
    expect(ok(withKey((c) => (c["entities"] as Record<string, unknown>[])[0]!, "scale")), "实体").toBe(false);
    expect(ok(withKey((c) => c["hud"] as Record<string, unknown>, "scale")), "HUD").toBe(false);
    expect(ok(withKey((c) => c["player"] as Record<string, unknown>, "scale")), "玩家").toBe(false);
  });

  it("而 `size` / `anchor`（**资源自身的性质**）也进不来 —— 它们只住资源包里", () => {
    expect(ok(withKey((c) => (c["entities"] as Record<string, unknown>[])[0]!, "size")), "实体自己声明 size").toBe(false);
    expect(ok(withKey((c) => (c["entities"] as Record<string, unknown>[])[0]!, "anchor")), "实体自己声明 anchor").toBe(false);
  });

  it("⚠️ **形状上**唯一的例外照样合法：`Hud.panel.size` 进得了 schema（运行时放不放行由 `auditPanelSize` 按九宫格判 · 票 63）", () => {
    const c = base();
    expect(c.hud.panel.size.w).toBeGreaterThan(0);
    expect(ok(c)).toBe(true);
  });

  it("⚠️ 速度/重力**故意是浮点** —— 那条整数规矩管的是位置与尺寸，别顺手取整", () => {
    const c = base();
    (c.player as { move?: unknown }).move = { speed: 90.5, jumpVelocity: 330.25, gravity: 900.125 };
    expect(ok(c), "浮点速度不该被拒").toBe(true);
  });
});

// ── 票 63 补的那条判据 ─────────────────────────────────────────────────────────
//
// ⚠️ 它守的是「资源自身性质归包」那条例外的**射程**：例外**以九宫格为条件** ——
//   九宫格上声明值是个**被拉伸的目标**（「声明 ≠ 包」是正当用法）；非九宫格上两个数就得一致。
// ⚠️ 这也是上面那条老测试（`Hud.panel.size` 那条）**名字被架空**的原因：它证的是**形状**，
//   运行时放不放行从此归这里。（盘上 65 个声明尺寸的格子里，「声明 ≠ 包 且 非九宫格」= 0 处）
describe("⚠️ `hud.panel.size` 的例外**以九宫格为条件**（票 63）", () => {
  const withPanel = (panel: GameConfig["hud"]["panel"]) => base({ hud: { ...base().hud, panel } });
  /** 只挑**这条判据**报的那一条 —— 几何那几条不参与本组断言。 */
  const panelErrs = (panel: GameConfig["hud"]["panel"]) =>
    errs(withPanel(panel)).map(line).filter((l) => l.startsWith("hud.panel.size:"));

  it("正例：九宫格 + 声明 ≠ 包 ⇒ **放行**（`hud-lost-slots` 是九宫格，声明 144×40 是拉伸的目标）", () => {
    expect(panelErrs({ asset: "hud-lost-slots", at: { x: 8, y: 262 }, size: { w: 144, h: 40 } })).toEqual([]);
  });

  it("负例：非九宫格 + 声明 ≠ 包 ⇒ **报错**（`hud-pip` 包里那一件没有 `scale9Borders`）", () => {
    const msgs = panelErrs({ asset: "hud-pip", at: { x: 8, y: 262 }, size: { w: 72, h: 32 } });
    expect(msgs.join("\n")).toMatch(/不是九宫格/);
    expect(msgs.join("\n")).toMatch(/12×12/);
  });

  it("非九宫格 + 声明 == 包 ⇒ **也不报**（这条判据只在两个数打架时说话）", () => {
    expect(panelErrs({ asset: "hud-pip", at: { x: 8, y: 262 }, size: { w: 12, h: 12 } })).toEqual([]);
  });
});
