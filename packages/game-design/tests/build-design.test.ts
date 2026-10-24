// `buildDesign` 的判据 —— **不碰网络**（这正是把它从 `compile-design.ts` 里拆出来的理由）。
//
// 两件事最容易写错，所以它们占了这份文件的大头：
//   ① **三个照抄值真的被强制覆盖**（模型写了什么都不算）；
//   ② **R12 的拒绝判得对**（尤其「相机」那条 —— 它最容易被写成一句笼统的 `startsWith("camera:")`，
//      那样俯视的参考图会**静默通过**）。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GameIntentSpecSchema, PLATFORMER_V1, type GameDesignSpec, type GameIntentSpec, type RuntimeProfile, type VisualWorldSpec } from "@game-maker/contracts";
import { CAMERA_MODE_NEEDS, buildDesign } from "../src/index.js";

const profile = (over: Partial<RuntimeProfile> = {}): RuntimeProfile => ({ ...PLATFORMER_V1, ...over });

/** 一份过得了意图层契约（含它那条 gate）的意图。⚠️ 故意要了一条外壳做不了的机制。 */
const INTENT: GameIntentSpec = {
  format: "game-intent/v1",
  title: "拾荒者",
  genre: "platformer",
  targetExperience: "孤独但一直向上",
  coreLoopSteps: ["探索废墟"],
  player: { role: "拾荒者", goals: ["在天黑前抵达"] },
  world: { theme: "废土", setting: "铁轨旁的废墟", atmosphere: "黄昏，尘土悬浮" },
  mechanics: [{ id: "m-jump", name: "跳跃" }, { id: "m-double-jump", name: "二段跳" }],
  entities: [
    { id: "e-drone", type: "enemy", role: "巡逻的无人机" },
    { id: "r-part", type: "resource", role: "散落的零件" }
  ],
  winConditions: ["抵达终点"],
  loseConditions: [],
  ambiguity: []
};

/** 一份过得了世界契约（含它那条越界 gate）的世界。 */
const VWS: VisualWorldSpec = {
  format: "visual-world/v1",
  styleIdentity: { keywords: ["低饱和"], description: "黄昏的铁路小站" },
  camera: { mode: "side" },
  composition: { foreground: "铁轨", midground: "月台", background: "山影", density: "中" },
  lighting: {}, character: {}, environment: { architecture: "木构小站", terrain: "碎石子" },
  palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
  materials: {}, shapeLanguage: [], constraints: [], styleReferences: [],
  style: { id: "halt-dusk", identity: [], camera: {}, composition: {}, palette: ["#2e3b4e", "#4a6076"], lighting: {}, shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [], confidence: 0.5 }
};

/** 模型吐的设计：默认**把两条机制都做出来了**（`m-double-jump` 落在 `jump` 上）。 */
const design = (over: Partial<GameDesignSpec> = {}): GameDesignSpec => ({
  format: "game-design/v1",
  game: { title: "拾荒者", genre: "模型瞎写的", camera: "模型瞎写的", runtimeProfile: { id: "胡编", version: "9" } },
  coreLoopSteps: ["探索废墟", "抵达终点"],
  player: { id: "p", role: "拾荒者", abilities: ["跑"], goals: ["在天黑前抵达"] },
  enemies: [{ id: "e-drone", behavior: "沿固定路线往复", threat: "接触即伤" }],
  npcs: [], interactables: [],
  resources: [{ id: "r-part", purpose: "收集目标" }],
  world: { theme: "废土", setting: "铁轨旁的废墟", structure: "三段式" },
  levels: [{ id: "l-1", purpose: "教学", layout: "左到右", entities: ["e-drone", "r-part"] }],
  progression: { model: "linear", description: "三关" },
  mechanics: [{ id: "m-jump", mechanic: "jump" }, { id: "m-double-jump", mechanic: "jump" }],
  winConditions: ["抵达终点"], loseConditions: [],
  runtimeRequirements: ["input:keyboard"],
  ...over
});

const build = (over: Partial<GameDesignSpec> = {}, o: { intent?: GameIntentSpec; vws?: VisualWorldSpec; profile?: RuntimeProfile } = {}) =>
  buildDesign({ fromModel: design(over), intent: o.intent ?? INTENT, vws: o.vws ?? VWS, profile: o.profile ?? profile() });

describe("装配：三个照抄值**强制覆盖**（票 10 的 Q5）", () => {
  it("`game.runtimeProfile` / `game.genre` / `game.camera` 一律以调用方为准，模型写什么都不算", () => {
    const r = build();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.game.runtimeProfile).toEqual({ id: PLATFORMER_V1.id, version: PLATFORMER_V1.version });
    expect(r.spec.game.genre).toBe(PLATFORMER_V1.id);
    expect(r.spec.game.camera).toBe(VWS.camera.mode);   // ⚠️ 取的是**世界的字面**，不是 profile 的能力名
  });

  it("而 `game.title` **不动** —— 那是模型给它起的名字，不是照抄值", () => {
    const r = build({ game: { ...design().game, title: "铁轨末班" } });
    expect(r.ok && r.spec.game.title).toBe("铁轨末班");
  });

  it("装配后**重过一次契约**：模型留下的空字段照样被那条 gate 拦下（⇒ `schema`、重采样）", () => {
    const r = build({ world: { theme: "废土", setting: "铁轨旁的废墟", structure: "   " } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("schema");
  });
});

describe("R12 ①：意图 → 设计的覆盖（今天最常响的那条）", () => {
  it("意图里的机制在设计里没有对家 ⇒ **拒绝**，报错里带着**用户的原话**", () => {
    const r = build({ mechanics: [{ id: "m-jump", mechanic: "jump" }] });
    expect(r.ok).toBe(false);
    if (r.ok || r.kind !== "rejected") return;
    expect(r.rejections.map((x) => x.reason)).toEqual(["intent-mechanic-missing"]);
    expect(r.rejections[0]!.detail).toContain("二段跳");        // ⚠️ 意图层的 `name` 是自由文本，才报得出这句
    expect(r.rejections[0]!.detail).toContain("外壳做不了它");
  });

  it("意图里的实体在设计里没有对家 ⇒ 拒绝，且**按 `type` 落到对的桶**再找", () => {
    const r = build({ enemies: [], levels: [{ id: "l-1", purpose: "p", layout: "a", entities: ["r-part"] }] });
    expect(r.ok).toBe(false);
    if (r.ok || r.kind !== "rejected") return;
    expect(r.rejections.map((x) => x.reason)).toEqual(["intent-entity-missing"]);
    expect(r.rejections[0]!.detail).toContain("巡逻的无人机");
    // ⚠️ **真缺失**就不许说「串桶」—— 那句话只有同 id 躺在别的桶里时才成立（票 19 的 Q12）。
    expect(r.rejections[0]!.detail).not.toContain("串桶");
  });

  it("⚠️ 同一个 id **落在错的桶里不算有对家**（`e-drone` 出现在 `npcs` 里，`enemies` 是空的）", () => {
    const r = build({ enemies: [], npcs: [{ id: "e-drone", role: "r", interaction: "i" }] });
    expect(r.ok).toBe(false);
    if (r.ok || r.kind !== "rejected") return;
    expect(r.rejections.map((x) => x.reason)).toContain("intent-entity-missing");
    // ⚠️ 票 19 的 Q12：**「放错桶」与「没做」要分开说** —— 这条文案是给人改需求看的，
    //   不说清的话人会去那个空桶里找一个**就在隔壁**的东西。
    expect(r.rejections[0]!.detail).toContain("串桶");
    expect(r.rejections[0]!.detail).toContain("npcs");
    expect(r.rejections[0]!.detail).toContain("不是没做");
  });

  it("全都有对家 ⇒ 放行（负判据不许误伤正例）", () => {
    expect(build().ok).toBe(true);
  });

  it("⚠️ **单向的**：设计里**新加**意图没点名的实体 ⇒ **什么都不触发**（那是「需求补全」，是它的活）", () => {
    // 探针的正例（票 10 的 R2-Q1）：意图层的 `coreLoopSteps` 说了「收集废料与净水」，而 `entities[]` 里
    // 只有废料 ⇒ 设计层补一个 `e-water` 是**对的**。这条判据**只查「少」，不查「多」**。
    const r = build({
      resources: [{ id: "r-part", purpose: "收集目标" }, { id: "e-water", purpose: "喝一口回血" }],
      levels: [{ id: "l-1", purpose: "p", layout: "a", entities: ["e-drone", "r-part", "e-water"] }]
    });
    expect(r.ok).toBe(true);
  });
});

describe("R12 ②：相机 —— 参考图的视角这一代承载得了吗", () => {
  it("`top-down` / `isometric` / `first-person` / `other` 都 ⇒ 拒绝（`CAMERA_MODE_NEEDS` 里是 `null`）", () => {
    for (const mode of ["top-down", "isometric", "first-person", "other"] as const) {
      expect(CAMERA_MODE_NEEDS[mode]).toBeNull();
      const r = build({}, { vws: { ...VWS, camera: { mode } } });
      expect(r.ok, mode).toBe(false);
      if (!r.ok && r.kind === "rejected") expect(r.rejections[0]!.reason).toBe("camera-unsupported");
    }
  });

  it("`side` ⇒ 放行", () => {
    expect(build({}, { vws: { ...VWS, camera: { mode: "side" } } }).ok).toBe(true);
  });

  it("⚠️ **别把判据写成「有 `camera:*` 就支持」** —— 只剩 `camera:parallax` 的那一代，`side` 也得拒", () => {
    const p = profile({ capabilities: PLATFORMER_V1.capabilities.filter((c) => c !== "camera:side-scroll") });
    const r = build({}, { profile: p });
    expect(r.ok).toBe(false);
    if (!r.ok && r.kind === "rejected") expect(r.rejections[0]!.reason).toBe("camera-unsupported");
  });

  it("而 `game.camera` **不是**被填成 profile 那条能力名（填成它这条对照就恒真、拒绝面当场死掉）", () => {
    const r = build();
    expect(r.ok && r.spec.game.camera).toBe("side");
    expect(r.ok && r.spec.game.camera).not.toBe(CAMERA_MODE_NEEDS.side);
  });
});

describe("R12 ③：两条差集 —— 今天恒空，是**给第二个成员留的位**（票 05 的自白）", () => {
  it("在真的 `PLATFORMER_V1` 上，一份合法设计两条差集**恒空** ⇒ 放行", () => {
    expect(PLATFORMER_V1.mechanics).toHaveLength(10);   // 票 13/14 加了 open-chest / avoid-danger
    expect(PLATFORMER_V1.capabilities).toHaveLength(8);
    expect(build().ok).toBe(true);
  });

  it("造一个**少一条机制**的 profile ⇒ `mechanic-unsupported`（位还在）", () => {
    const p = profile({ mechanics: PLATFORMER_V1.mechanics.filter((m) => m !== "jump") });
    const r = build({}, { profile: p });
    expect(r.ok).toBe(false);
    // ⚠️ 两条理由：fixture 里**两条机制都落在 `jump` 上**（`m-double-jump` 是模型拿近似值顶的那种情形）
    //   —— 拒绝是**逐条**报的，所以这里就该是两条。
    if (!r.ok && r.kind === "rejected")
      expect(r.rejections.map((x) => x.reason)).toEqual(["mechanic-unsupported", "mechanic-unsupported"]);
  });

  it("造一个**少一条能力**的 profile ⇒ `capability-unsupported`", () => {
    const p = profile({ capabilities: PLATFORMER_V1.capabilities.filter((c) => c !== "input:keyboard") });
    const r = build({}, { profile: p });
    expect(r.ok).toBe(false);
    if (!r.ok && r.kind === "rejected") expect(r.rejections.map((x) => x.reason)).toEqual(["capability-unsupported"]);
  });
});

describe("R12 ③b：机制状态硬约束 —— 声明了 ≠ 真能用（票 12）", () => {
  it("设计引用 `moving-platform`（词表与 profile 都有、却没运行时实现）⇒ `mechanic-experimental`", () => {
    // ⚠️ `moving-platform` 是意图没点名的**补全**（合法，覆盖不查「多」），但它的 status 是
    //   experimental —— 单这一条就该拒，不掺别的理由。
    const r = build({
      mechanics: [
        { id: "m-jump", mechanic: "jump" },
        { id: "m-double-jump", mechanic: "jump" },
        { id: "m-plat", mechanic: "moving-platform" }
      ]
    });
    expect(r.ok).toBe(false);
    if (r.ok || r.kind !== "rejected") return;
    expect(r.rejections.map((x) => x.reason)).toEqual(["mechanic-experimental"]);
    expect(r.rejections[0]!.detail).toContain("moving-platform");
    expect(r.rejections[0]!.detail).toContain("experimental");
  });

  it("只引用 supported 机制 ⇒ 放行（负判据不许误伤正例）", () => {
    expect(build().ok).toBe(true);
  });
});

describe("拒绝是给人改需求用的 —— **一次把所有理由都算出来**", () => {
  it("同时踩中三类 ⇒ 三条都在，不是只报第一条", () => {
    const r = build(
      { mechanics: [{ id: "m-jump", mechanic: "jump" }], runtimeRequirements: ["input:keyboard", "hud:screen-space"] },
      { vws: { ...VWS, camera: { mode: "top-down" } }, profile: profile({ capabilities: PLATFORMER_V1.capabilities.filter((c) => c !== "hud:screen-space") }) }
    );
    expect(r.ok).toBe(false);
    if (r.ok || r.kind !== "rejected") return;
    expect(r.rejections.map((x) => x.reason).sort()).toEqual(
      ["camera-unsupported", "capability-unsupported", "intent-mechanic-missing"].sort()
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 票 54：拿**第八次真跑盘上那份意图**回放（本票唯一一份**不是编的**输入）
// ═════════════════════════════════════════════════════════════════════════════
// 那一跑死在 `compile-design`：`wasteland-bg` 这条「机制」在设计层的封闭枚举里没有对家。
// ⚠️ 这份回放要证的是**两件事分开的两件事**（人类裁定的补充裁定 3）：
//   ①（本票改的那一半）这种意图**今天生成不出来了** —— 它在意图层契约就被拦下、重采样；
//   ②（本票**没改**的那一半）R12 一条没松 —— 就算放它过去，拒绝照样点名 `wasteland-bg`。
// ⚠️ 它**不**证明「模型学会了分类」—— 那件事只能在票 23 的下一次完整真跑里看（本票不追加付费探针）。
describe("票 54：第八次真跑那份 `game-intent.json` 回放", () => {
  /** ⚠️ **只读**的真读数（盘上那份失败目录里的产物，git 里跟着走）—— 别改它。 */
  const RAW: GameIntentSpec = JSON.parse(readFileSync(
    fileURLToPath(new URL(
      "../../../.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13a/" +
      ".failed-2026-10-13T02-21-58-177Z/game-intent.json", import.meta.url)), "utf8"));

  /** 那一跑模型**实际交出去**的设计（盘上没有：它死在拒绝那一发）—— 照第七跑的活法**拿近似顶上**：
   *  `chest`/`resource` → `collect-pickup`、`enemy` → `hazard-contact`、`final-goal` → `reach-goal`，
   *  唯独 `wasteland-bg` **没有近似可用** ⇒ 全篇只它一条落空（这正是「省掉之后由 `compile-design` 判」）。 */
  const run8Design = (): GameDesignSpec => ({
    ...design(),
    enemies: [{ id: "enemy", behavior: "在废墟里巡逻", threat: "接触即伤" }],
    npcs: [{ id: "scavenger", role: "玩家控制的拾荒者", interaction: "（没有可做的）" }],
    interactables: [{ id: "chest", type: "宝箱", behavior: "可开启" }],
    resources: [{ id: "resource", purpose: "补给与废料" }],
    levels: [{ id: "l-1", purpose: "穿过废弃城市", layout: "左到右", entities: ["p", "scavenger", "enemy", "chest", "resource"] }],
    mechanics: [
      { id: "side-scroll-move", mechanic: "run" },
      { id: "jump", mechanic: "jump" },
      { id: "chest", mechanic: "collect-pickup" },
      { id: "resource", mechanic: "collect-pickup" },
      { id: "enemy", mechanic: "hazard-contact" },
      { id: "final-goal", mechanic: "reach-goal" }
    ]
  });

  it("① 它今天**过不了意图层契约**：⑤b 的三条跨数组重 id + ⑤c 的两条类名 id，逐条点名，两条路径都在", () => {
    const r = GameIntentSpecSchema.safeParse(RAW);
    expect(r.success).toBe(false);
    if (r.success) return;
    // `chest` / `resource` / `enemy` 三条同时躺在两个数组里 ⇒ 三条 issue，各指自己那条机制。
    // ⚠️ 而 ⑤c（**2026-10-13 票 52 加的**）在**同一份真意图**上又多报两条：`enemy` 与 `resource`
    //   这两个 `id` **就是它们自己的 `type`** ⇒ 第八跑那份意图**同时**踩中两条规矩来。
    //   （不是巧合：把「这一类」抄成 id 与把清单整张抄进 `mechanics[]`，是同一种手感。）
    expect(r.error.issues.map((x) => x.path.join("."))).toEqual([
      "mechanics.2.id", "mechanics.3.id", "mechanics.4.id", // ⑤b —— 跨数组重 id
      "entities.1.id", "entities.3.id"                      // ⑤c —— `enemy` / `resource` 写成了类名
    ]);
    expect(r.error.issues[0]!.message).toContain("`chest`");
    expect(r.error.issues[0]!.message).toContain("`entities[2].id`");
    // ⚠️ 而 `wasteland-bg` / `final-goal` **不在这五条里** —— 它们是**语义**上的错格（世界设定 / 胜利条件），
    //   没有 gate 判得了那个（R3：判据只收「精确可算」）。它们靠提示词里那段「先分家」拦。
    expect(r.error.issues.every((x) => !x.message.includes("wasteland-bg"))).toBe(true);
  });

  it("② 设计层那条 R12 **一个字没松**：放它过去，拒绝照样点名 `废土背景`、且**只它一条**", () => {
    const r = buildDesign({ fromModel: run8Design(), intent: RAW, vws: VWS, profile: profile() });
    expect(r.ok).toBe(false);
    if (r.ok || r.kind !== "rejected") return;
    expect(r.rejections.map((x) => x.reason)).toEqual(["intent-mechanic-missing"]);
    expect(r.rejections[0]!.detail).toContain("废土背景");       // 意图层的 `name` 原话
    expect(r.rejections[0]!.detail).toContain("`wasteland-bg`");
  });
});
