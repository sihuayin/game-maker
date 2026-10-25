// `game-config/v1` —— AI 与**手写 runtime 外壳**之间**唯一**的语义接口（票 09 定形状）。
//
// ⚠️ **它是一份菜谱，不是一门语言。** 外壳写死实现一组**行为原语**，Config 只说
//   「哪里有、参数是多少」。理由：通用规则语言要让外壳变成解释器（与 R8 打架），
//   而**失败会发生在运行时** —— Phaser 的 loader 静默失败是同一个坑。
//   封闭枚举把「这个游戏做不出来」变成**构建期的 schema 拒绝**。
//   代价（支持一种新玩法 = 改外壳）由票 18 现成化解：站点有自己的版本号，
//   改外壳 = 出一个新版本的外壳，不破「绝不覆盖」。
//
// **一个文件 = 一个关卡**（票 09 裁决 14）。多关卡 = 多份文件 + 一份索引
//   （索引的形状等真有第二关时再定）。
//
// ⚠️ **所有坐标都是交付态像素，1:1、整数**（票 09 裁决 13）。
//   整数不是洁癖：`x: 10.5` 会**静默**把精灵糊掉，而 R2 之后没有别的东西拦得住它。
//   视口也是 480×270（票 32），于是 1 交付像素 = 1 屏幕像素。
//
//   ⚠️ **这条规矩管的是「位置与尺寸」，不是「每秒多少像素」**（票 14 补的自白）：
//     `PlayerMove.speed/jumpVelocity/gravity` 与塔防那边的 `slow.factor` / `projectile.speed` /
//     `enemy.speed` **故意是浮点** —— 它们不是格子上的一个点，是速度。**别顺手给它们取整。**
//
//   ⚠️ 而「资源自身的性质归包」那条（`size`/`anchor` 只住[[资源包]]里，同一个货箱在两个关卡里一样大）的
//     落地方式是 **`.strict()`：`scale` 这个键根本进不来**（票 09 裁决 5）。⚠️ 它同时**明确禁止 `scale`**
//     —— `1.7` 会**静默**糊掉像素网格。⚠️ 唯一批准过的例外是 `Hud.panel.size`（那正是九宫格的定义：
//     四边不拉伸、中央拉伸，所以拉伸**不会**破坏像素网格）。
//     ⚠️ **票 14 给这条禁令补了一条判据**（`tests/game-config.test.ts`）—— 在那之前它**只有**结构性保证。
import { z } from "zod";
import { resolvePackRef, type AssetPackEntry, type AssetPackManifest } from "./assetpack.js";
import type { GameDesignSpec } from "./game-design.js";

export const GAME_CONFIG_FORMAT = "game-config/v1" as const;

/** 整数坐标。**非负** —— 世界从 (0,0) 起算。 */
export const Coord = z.number().int().nonnegative();
export const Point = z.object({ x: Coord, y: Coord }).strict();
export const Size = z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).strict();
/**
 * 世界里的一个轴对齐矩形（地形、碰撞盒）。
 *
 * ⚠️ 与 `geometry.ts` 那个 `Box` 是**同一个形状、两个域**：那个是**绘制指令的包围盒**
 * （不渲染算出来的），这个是**游戏世界里的占位**。不共用名字，因为它们回答的问题不同 ——
 * 但形状一致这件事是有意的，视觉上撞见时不必怀疑。
 */
export const Rect = z.object({ x: Coord, y: Coord, w: z.number().int().positive(), h: z.number().int().positive() }).strict();

/**
 * 实体的种类。**封闭枚举** —— 它同时是「外壳实现了哪些行为」的清单。
 *
 * ⚠️ 与 [[地形]] 的分工：**看不见的碰撞进 `terrain`，看得见的进 `entities`**。
 * 所以一块看得见的静态碰撞体（一摞行李、一段台阶）是 `solid`，**只写一次**。
 */
export const EntityKind = z.enum(["solid", "pickup", "hazard", "goal", "chest", "danger", "decor"]);

/**
 * 实体怎么动。**它与 `kind` 正交** —— `kind` 说**碰到会怎样**，`motion` 说**它怎么动**。
 *
 * ⚠️ **V1 只实现 `cycle` 一个值**。枚举的存在是为了让「加一种运动」= 加一个枚举值 +
 *   外壳里一个分支，**而不是改 schema 的形状**。而它必须是数据：外壳写死「危险物会动」
 *   就等于把一条**没有任何契约写着**的知识埋进代码里，而 R8 之后 AI 只产数据。
 */
export const Motion = z.object({
  kind: z.literal("cycle"),
  axis: z.enum(["x", "y"]),
  /** 单程行程（像素）。从 `at` 起沿 `axis` 走这么远，然后折回，周期 `periodMs`。 */
  distance: z.number().int().positive(),
  periodMs: z.number().int().positive(),
}).strict();

/**
 * `danger` 的定时打击（票 05 / 14）—— **激活周期**，不是位置周期。
 *
 * ⚠️ 与 [[Motion]] 正交：`Motion` 说「它**怎么动**」（位置周期），`strike` 说「它**何时喷发**」
 *   （idle ↔ active 状态周期）。danger 是**静止区 + 激活周期**；将来若要「移动的定时打击」，
 *   再把两者组合（本票不做）。打击区 = 实体盒子（`body` / asset size）。
 * ⚠️ `periodMs` 是**安全窗口时长**（两次喷发之间的间隔），`activeMs` 是**喷发时长**；
 *   完整周期 = `periodMs + activeMs`，喷发落在周期的**最后** `activeMs`（t=0 从 idle 开始，
 *   给玩家一个安全窗口）。「规避」= 掐在 idle 窗口穿过。
 */
export const Strike = z.object({
  periodMs: z.number().int().positive(),
  activeMs: z.number().int().positive(),
}).strict();

/**
 * 世界里**有画面**的一个东西。
 *
 * ⚠️ 它**不重复声明自己的几何**：`size` 与 `anchor` 只住在[[资源包]]里（票 09 裁决 5）——
 *   同一个货箱在两个关卡里一样大，而 `scale` 会**静默**糊掉像素网格。
 *   `body` 省略时**就是资源的 `size`**（画面即碰撞面），给了就覆盖。
 */
export const Entity = z.object({
  id: z.string().min(1),
  /** ⚠️ 设计实体身份回指（entity-identity-v1 Q1）：GameDesignSpec 四桶实体的稳定 id。
   *  `id` 是**运行时**唯一身份，`sourceIntent` 是**设计**身份 —— 1:N（一个 resource 派生多个
   *  pickup）共享同一个 `sourceIntent`；孤儿实体（地面 solid、终点 goal，无设计对位）**不带**。
   *  可空但**不唯一**（id 唯一检查只看 `id`）；**不跨文件查**设计 id —— 悬空归编译期验真 / QA。 */
  sourceIntent: z.string().min(1).optional(),
  kind: EntityKind,
  at: Point,
  asset: z.string().min(1),
  /** 用哪个动画。**资源只有一个动画时可省**；省了而资源有多个时，解析会失败。 */
  anim: z.string().min(1).optional(),
  body: Size.optional(),
  motion: Motion.optional(),
  /** `kind:"chest"` 的交互外扩（像素）—— 交互区 = 实体盒子外扩 `range`；缺省 0 = 就用盒子本身。 */
  range: z.number().int().nonnegative().optional(),
  /** `kind:"danger"` 的定时打击参数。danger **必须**带（见 superRefine）。 */
  strike: Strike.optional(),
}).strict();

/**
 * 手感参数的**默认值** —— 票 09 裁决 11 把它们判给了数据（理由：关卡几何与「玩家能跳多高」
 * 是同一件事的两半），但**默认值只有一个来源**：外壳与「可通关」校验都读这里。
 * 两边各写一份必然漂移，而这个字段一漂移就是**关卡要么不可通关、要么白送**。
 */
export const DEFAULT_PLAYER_MOVE = { speed: 90, jumpVelocity: 330, gravity: 900 } as const;

/**
 * 资源解不到时算盒子用的兜底锚点。**与外壳（票 44）是同一个值** ——
 * 世界里的东西绝大多数是「底边中心」（票 40 的真包：`{x:.5,y:1}`）。
 */
export const FALLBACK_ANCHOR = { x: 0.5, y: 1 } as const;

/**
 * 由「**锚点落点** + 尺寸 + 锚点」推出盒子（左上角）。**全仓只此一处算这个。**
 *
 * ⚠️ `at` 是**锚点落在哪**，不是左上角（票 48）。四件事共用它：
 *   校验器（`auditGameConfig`）· 外壳的纯层（`packages/demo` 的 `world.ts`）·
 *   `compile-game` 的 HUD 自检 · 站点装配。
 *   ⚠️ 交付态坐标是整数，盒子也**取整** —— 不取整的话「校验过的盒子」与
 *   「画出来的位置」会差半像素，而那正是**静默**糊掉像素网格的那一类。
 */
export const entityBox = (
  at: { x: number; y: number }, size: { w: number; h: number }, anchor: { x: number; y: number },
) => ({
  x: Math.round(at.x - anchor.x * size.w),
  y: Math.round(at.y - anchor.y * size.h),
  w: size.w, h: size.h,
});

export const PlayerMove = z.object({
  /** 水平速度（像素/秒）。 */
  speed: z.number().positive(),
  /** 起跳初速度（像素/秒，向上）。 */
  jumpVelocity: z.number().positive(),
  /** 重力（像素/秒²）。 */
  gravity: z.number().positive(),
}).strict();

/**
 * 玩家那件资源要同时带的三个动作 —— **键就是契约要的字面名**（票 61）。
 *
 * ⚠️ **全仓这三个词只写这一遍**（票 61 的 Q2(r1) = (a)）。四处由它派生：
 *   ① `Player.anims` 自己（`z.object(PlayerAnimsShape).strict()`）；
 *   ② 导出的 `PLAYER_ACTION_NAMES` —— **配方提示词插值它、玩家动画闸门读它**；
 *   ③ v4 镜像 `config-tool.ts` 的 `PlayerShape`；
 *   ④ 给模型看的骨架 `assets/src/ops.ts` 的 `gameConfigExample`。
 *   ⇒ 这四处**结构上不可能漂**：改这三个词只能改这里。
 *
 * ⚠️ 它们要的是**三路彼此不同**的动画（外壳按三个键各取一路播一种动作），
 *    而**值**（动画叫什么名字）仍由包自己定 —— 见 `Player.anims` 那段注释。
 */
const PlayerAnimsShape = {
  idle: z.string().min(1), run: z.string().min(1), jump: z.string().min(1),
} as const;

/** 玩家那三个动作的**名字**（票 61）—— 键本身就是字面名，顺序即上面那个字面量的声明序。 */
export const PLAYER_ACTION_NAMES = Object.keys(PlayerAnimsShape) as readonly (keyof typeof PlayerAnimsShape)[];

export const Player = z.object({
  asset: z.string().min(1),
  /**
   * **显式映射**，不是名字约定（票 09 裁决 10）。若外壳硬找 `idle`，那么一个把走路叫 `walk`
   * 的包就是**静默用错**；而这里每个名字都由 `resolvePackRef()` 在构建期逐个校验 ——
   * 构建期是唯一还能报出「哪个引用点引用了哪个不存在的动画」的地方。
   *
   * ⚠️ 三个**键**由 `PlayerAnimsShape` 派生（票 61：这三个词全仓只写一遍，在那里）。
   */
  anims: z.object(PlayerAnimsShape).strict(),
  /** 出生点。锚点落在这一点上（角色的**脚**在这里）。 */
  at: Point,
  move: PlayerMove.optional(),
}).strict();

/**
 * HUD。
 *
 * ⚠️ **`panel.size` 是票 09 那条「资源自身性质归包」的**唯一例外** ——
 * 而它正是九宫格的定义：四边不拉伸、中央拉伸，所以拉伸**不会**破坏像素网格。
 *
 * ⚠️ **`pip` 是一个独立的资源，不是 `slot` 的两个动画**（票 40 抓到的）：
 * `ui` 类**不允许声明动画**（票 27），一个 ui 资源只有一张图 —— 「空 / 亮」两态在契约里
 * 根本表达不了。这个包里的做法是：面板画着三个空槽，点亮时把 pip 叠上去。
 */
export const Hud = z.object({
  panel: z.object({ asset: z.string().min(1), at: Point, size: Size }).strict(),
  /** 第一个槽位的位置 + 槽位之间的间距。槽位数 = 拾取物的条数（见 `pickupCount`）。 */
  pip: z.object({ asset: z.string().min(1), at: Point, step: Point }).strict(),
}).strict();

/**
 * 胜负条件。**封闭枚举**，V1 只有一个变体：**捡齐 N 件 → 激活终点 → 到达即胜**。
 *
 * ⚠️ **它不带数量** —— 那个数由 `kind:"pickup"` 的实体条数**派生**（`pickupCount()`），
 * HUD 的槽位数是**同一个数**。重复声明会让「改了实体忘了改数字」成为一类静默错误。
 *
 * ⚠️ 这个形态正好解释了票 31 那个「信号灯由红转绿」：红/绿就是「是否已捡齐」的**显示** ——
 * 规则与视觉是同一个决定的两种表达。
 */
export const Objective = z.object({
  kind: z.literal("collect-then-reach"),
  /** 终点实体的 id（必须是 `kind:"goal"` 的那一个）。 */
  gate: z.string().min(1),
}).strict();

export const GameConfigSchema = z.object({
  format: z.literal(GAME_CONFIG_FORMAT),
  world: z.object({ size: Size }).strict(),
  scene: z.object({ background: z.object({ asset: z.string().min(1) }).strict() }).strict(),
  player: Player,
  /** **只有看不见的碰撞**（地面线、关卡边界、隐形墙）。看得见的静态碰撞体是 `solid` 实体。 */
  terrain: z.array(Rect),
  entities: z.array(Entity),
  hud: Hud,
  objective: Objective,
}).strict().superRefine((c, ctx) => {
  const seen = new Set<string>();
  for (const e of c.entities) {
    if (seen.has(e.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `实体 id 重复："${e.id}"`, path: ["entities"] });
    seen.add(e.id);
    // ⚠️ danger 没有 strike = 永不喷发，`avoid-danger` 名存实亡（票 14）。这是**结构不变量**，
    //   不该留到 audit 阶段再发现 —— parse 时就得拦。
    if (e.kind === "danger" && !e.strike)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `danger 实体 "${e.id}" 缺 strike（定时打击参数）`, path: ["entities"] });
  }
});

export type GameConfig = z.infer<typeof GameConfigSchema>;
export type GameEntity = z.infer<typeof Entity>;
export type EntityKind = z.infer<typeof EntityKind>;
export type Motion = z.infer<typeof Motion>;
export type Strike = z.infer<typeof Strike>;
export type Hud = z.infer<typeof Hud>;
export type Objective = z.infer<typeof Objective>;

/** 「要捡/开的件数」= `kind:"pickup"` + `kind:"chest"` 的实体条数。**不重复声明**（票 09 裁决 8）。
 *  ⚠️ 票 04/13：宝箱是「有 open 状态、近距触发、一次性」的加强版 pickup —— 奖励并入同一条
 *   collect-then-reach 计数，不另造奖励系统。所以「捡齐」这个数要数到 chest。 */
export const pickupCount = (c: GameConfig): number =>
  c.entities.filter((e) => e.kind === "pickup" || e.kind === "chest").length;

/** 玩家实际生效的手感参数 —— 只此一处回落到默认值，校验与外壳共用。 */
export const playerMoveOf = (c: GameConfig) => c.player.move ?? DEFAULT_PLAYER_MOVE;

/** 一次跳跃能到多高（像素）。抛物线顶点是**精确可算**的 —— 这是「可通关」那族的全部依据。 */
export const maxJumpHeight = (move: { jumpVelocity: number; gravity: number }): number =>
  (move.jumpVelocity * move.jumpVelocity) / (2 * move.gravity);

/**
 * 一次跳跃的**水平跨度**（像素）—— 落点比起跳点低 `drop` 像素时，最远能落到多远。
 *
 * ⚠️ **它与 `auditReachability` 的 `hop` 是同一条抛物线**（票 21 抽出来、**两个调用方共用**）：
 *   判据拿它算搜索半径，`compile-runtime` 拿它**把数告诉模型**。
 *   ⇒ 同一条式子写两遍就是这个仓库一直在打的「两套真相」，而这里漂移的代价是
 *   **模型照提示词摆出来的关卡被自己的判据判死**。
 *
 * `drop` 省略 = 落点与起点**同高**（滞空 `2·v/g`）—— 那是**最紧**的那一半，
 * 也正是提示词该给模型的那个数（落点更低时判据会放宽，判据的**上界**是 `drop = 世界高`）。
 */
export const jumpSpan = (
  move: { speed: number; jumpVelocity: number; gravity: number }, drop = 0,
): number =>
  (move.speed * (move.jumpVelocity + Math.sqrt(move.jumpVelocity ** 2 + 2 * move.gravity * drop))) / move.gravity;

// ── 三族构建期校验（票 09 §4）─────────────────────────────────────────────
//
// 跑在**装配站点那一步** —— 那是唯一同时看得到包与 config 的地方，
// 而 `resolvePackRef` 正需要这两样输入。
//
// ⚠️ 这里只**判定**，不决定怎么办。而**硬失败必须是失败、不是降级** ——
//   票 30 抓到过「校验不过时退出码是 0」，于是篡改过的包骗过了校验脚本。
export type ConfigIssue = {
  severity: "error" | "warning";
  /** 出问题的位置（实体 id / 字段路径）。 */
  where: string;
  message: string;
};

/**
 * 三族校验：**引用**（硬失败）· **自洽**（硬失败）· **可通关**（警告）。
 *
 * 可通关那族精确可算，但**不构成判决** —— 越不过某块台阶可能正是设计（玩家该走另一条路）。
 * 与票 27 立的规矩一致：**精确的硬失败、上界的报警告**。
 */
/**
 * **引用族**（`03 §22` 的引用那一半）—— 票 18 从 `auditGameConfig` 里**抽出来的**。
 *
 * ⚠️ **为什么抽**：票 06 把 `reference-resolution` 这条判据的**家**钉在这里
 *   （`qa.ts` 写着「住 `game-config.ts` 的 `auditGameConfig`」），而票 18 的裁决只要
 *   **引用族**那一半 —— 自洽族不进 QA，它归 `compile-runtime` / `site` 的硬失败。
 *   抽成一个具名函数之后，「哪几条属于引用族」在代码里**只有一处说法**。
 * ⚠️ 而 `auditGameConfig` 仍然**调它** ⇒ 既有那两个调用点一行不改，报出来的东西一字不变
 *   （**连顺序也一致**：引用族仍在最前）。
 */
export function auditReferences(config: GameConfig, manifest: AssetPackManifest): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const err = (where: string, message: string) => out.push({ severity: "error", where, message });

  /**
   * **只看种类**：这个 id 在不在包里、是不是该有的那一类。**不解引用。**
   *
   * ⚠️ 「这个 id 是不是一个 animation」与「这个引用画的是哪一帧」**是两个问题** ——
   *   玩家资源按定义有多个动画，拿 `{ asset }` 去解它必然撞上「必须指明 anim」，
   *   可这里问的根本不是 anim。合并成一个 `ref()` 会让**种类核对永远跑不到**
   *   （`resolvePackRef` 先失败），于是「你拿三层背景当玩家了」被报成「缺 anim」——
   *   一个把人指向不存在出路的消息。
   */
  const kindOf = (where: string, assetId: string, kinds: readonly string[]) => {
    const asset = manifest.assets.find((a) => a.id === assetId);
    // 措辞与 `resolvePackRef` 一致 —— 同一个事实在哪里说都是同一句话
    if (!asset) { err(where, `包里没有资源 "${assetId}"`); return null; }
    if (!kinds.includes(asset.kind)) {
      err(where, `"${assetId}" 是 ${asset.kind}，这里要的是 ${kinds.join(" / ")}`);
      return null;
    }
    return asset;
  };

  /** 解一个引用，顺带核对它是不是该有的资源种类。 */
  const ref = (where: string, r: { asset: string; anim?: string }, kinds?: readonly string[]) => {
    // 先判种类、后解引用 —— 理由见 `kindOf`
    if (kinds && !kindOf(where, r.asset, kinds)) return null;
    const res = resolvePackRef(r, manifest);
    if (!res.ok) { err(where, res.error); return null; }
    return res;
  };

  ref("scene.background", { asset: config.scene.background.asset }, ["background"]);
  // ⚠️ 玩家**只核对种类，不在这里解引用** —— 它是「有多个可画动画」的常态资源，
  //   而下面那三个动作名才是真正要解的东西。
  if (kindOf("player", config.player.asset, ["animation"])) {
    // 三个动作名**逐个解** —— 这是票 09 裁决 10 那条「显式映射」的兑现处。
    for (const [action, anim] of Object.entries(config.player.anims))
      ref(`player.anims.${action}`, { asset: config.player.asset, anim });

    // ⚠️ **票 61：三格必须解析到三个互不相同动画。** 上面那个循环**逐格**解引用，
    //   三格填同一个名字时它**一格都不报**（每一格确实解得到）—— 而这三格是**三个动作**
    //   （外壳按 `PLAYER_ACTION_NAMES` 那三个键**各取一路**）：指同一个名字 = 玩家在屏幕上
    //   三种动作长得一模一样，而这份配置过得了今天所有的校验。
    //   ⚠️ 它**不是**在收窄「显式映射」那条自由（票 09 裁决 10）：那条说的是「这一路叫什么名字」
    //   由包自己定；它说的是「三路**不能指同一路**」。⇒ 只在**值**上对账，一次只报一条。
    const slotsOf = new Map<string, string[]>();
    for (const [action, anim] of Object.entries(config.player.anims))
      slotsOf.set(anim, [...(slotsOf.get(anim) ?? []), action]);
    const clash = [...slotsOf.entries()].find(([, actions]) => actions.length > 1);
    if (clash !== undefined) {
      const [anim, actions] = clash;
      err(
        "player.anims",
        `${actions.map((a) => `\`${a}\``).join(" 与 ")} 指向**同一个**动画 "${anim}" —— 这三个槽位是` +
        `三个动作（外壳按 ${PLAYER_ACTION_NAMES.map((n) => `\`${n}\``).join(" / ")} 各取一路），` +
        "指同一个名字，玩家三种动作在屏幕上长得一模一样。⚠️ 一件资源里给它三条**不同**的动画，" +
        "或在清单里把缺的那路补上 —— 把三格填成同一个不是解法。",
      );
    }
  }
  // ⚠️ **recipe-config-gap-v1 票 05**：`solid` 是**可见的静态碰撞体**（地形块/台阶），只能引用 `sprite` ——
  //   加 kind 锁把「拿玩家动画当地形」从「多动画缺 anim」这种间接失败变成「是 animation，这里要的是 sprite」
  //   的**构建期 kind 拒绝**（与 player/hud 同口径）。⚠️ `decor` **不加锁**：它是纯装饰，动画（吊着的
  //   lurker）与 ui（血条图标）都是合法引用（v7 真配置就这么用）。
  for (const e of config.entities)
    ref(`entity "${e.id}"`, { asset: e.asset, ...(e.anim ? { anim: e.anim } : {}) },
      e.kind === "solid" ? ["sprite"] : undefined);
  ref("hud.panel", { asset: config.hud.panel.asset }, ["ui"]);
  ref("hud.pip", { asset: config.hud.pip.asset }, ["ui"]);

  const gates = config.entities.filter((e) => e.kind === "goal");
  const gate = gates.find((e) => e.id === config.objective.gate);
  if (!gate) err("objective.gate", `找不到 id 为 "${config.objective.gate}" 的 goal 实体（现有 goal：${gates.map((e) => e.id).join(", ") || "无"}）`);

  if (pickupCount(config) === 0)
    err("entities", "一个 pickup 或 chest 都没有 —— 而 objective 是「捡齐 N 件再到达终点」，N = 0 让这一关没有内容");

  return out;
}

/**
 * **一只面板：配置声明的那个盒子 vs 包里那件资源的真实尺寸**（票 63）。
 *
 * ⚠️ `Hud.panel.size` 是票 09 那条「**资源自身的性质归包**」的**唯一例外**，
 *   而例外的理由是**九宫格**：四边不拉伸、中央拉伸 ⇒ 声明值是个**被拉伸的目标**，
 *   与资源像素尺寸**本来就不该相等**（塔防 `hud.panel` 就声明 480×30、包里是 96×26）。
 * ⚠️ 可契约**不要求** `panel.asset` 指向九宫格（那一格只是 `z.string().min(1)`）——
 *   例外**借九宫格说理，却不检查九宫格在不在** ⇒ 那半个条件由**本函数**守。
 *
 * ⇒ 判据的形状：**声明 ≠ 包 且 这件资源不是九宫格** = error。
 *   · 九宫格 + 声明 ≠ 包 → **放行**（那是这个字段的正当用法）；
 *   · 非九宫格 + 声明 ≠ 包 → **报错**（理由没了，两个数就得一致）。
 *
 * ⚠️ **不误伤任何真产物**：盘上 31 份真配置 + 两份夹具，65 个声明尺寸的格子里
 *   「声明 ≠ 包 **且** 非九宫格」= **0 处**（自证的口径照票 07 那条砖的判据）。
 * ⚠️ **横版与塔防共用这一份实现**（票 63 的 Q6：同类字段必须由**同一条**判据约束）——
 *   所以它不长在 `auditGameConfig` 里，而是抽出来给两个审计各调一次。
 */
export function auditPanelSize(
  where: string,
  declared: { w: number; h: number },
  asset: AssetPackEntry | undefined,
): ConfigIssue | null {
  // 引用族已经报过「包里没有这件 / 种类不对」—— 这里不抢它的活
  if (!asset) return null;
  // 九宫格：声明值就是被拉伸的目标，与资源真实尺寸**本来就不该相等**
  if (asset.scale9Borders !== undefined) return null;
  if (declared.w === asset.size.w && declared.h === asset.size.h) return null;
  return {
    severity: "error",
    where,
    message:
      `声明的是 ${declared.w}×${declared.h}，而包里的 "${asset.id}" 是 ${asset.size.w}×${asset.size.h} —— ` +
      `而这件资源**不是九宫格**（包里没有 \`scale9Borders\`）。` +
      `「配置里声明尺寸」这一格是「资源自身性质归包」的唯一例外，而例外的理由**是九宫格**：` +
      `四边不拉伸、中央拉伸，所以声明值是个**被拉伸的目标**、与资源像素尺寸本来就不该相等；` +
      `非九宫格上没有这个机制，两个数就得一致 —— ` +
      `要么把声明改成 ${asset.size.w}×${asset.size.h}，要么把这件资源做成九宫格。`,
  };
}

export function auditGameConfig(config: GameConfig, manifest: AssetPackManifest): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const err = (where: string, message: string) => out.push({ severity: "error", where, message });
  const warn = (where: string, message: string) => out.push({ severity: "warning", where, message });

  // ── 引用族（硬失败）────────────────────────────────────────────────────
  // ⚠️ **只此一处实现**（票 18 的 R2-Q1）：本函数调它，QA 的 `reference-resolution` 也调它。
  //   抄第二份 = 第二份真相 —— 两边的措辞会漂移，而措辞本身就是裁决过的东西。
  out.push(...auditReferences(config, manifest));

  // ── 自洽族（硬失败）────────────────────────────────────────────────────
  const { w: W, h: H } = config.world.size;

  /** 资源尺寸（manifest 上那一份）。取不到就当下面的兜底。 */
  const sizeOf = (assetId: string): { w: number; h: number } | null =>
    manifest.assets.find((a) => a.id === assetId)?.size ?? null;

  /** 资源级锚点（manifest 上那一份）。取不到就用兜底 —— 与外壳（票 44）同款。 */
  const anchorOf = (assetId: string | undefined) =>
    (assetId ? manifest.assets.find((a) => a.id === assetId)?.anchor : undefined) ?? FALLBACK_ANCHOR;

  /**
   * 一个东西在世界上**占的那个盒子**（左上角 + 宽高）。**全函数只此一处算盒子。**
   *
   * ⚠️ **`at` 是「资源锚点落在哪」，不是左上角**（票 48）。`anchor` 由**包**声明、**契约不钉值**：
   *   角色的锚点是**脚**（`{x:.5,y:.95}`）、世界里的道具是**底边中心**（`{x:.5,y:1}`）。
   *   所以站在地面线上的东西写 `at.y = 地面 y`，
   *   而它的盒子是**从 `at` 往上长**的 —— 不是从 `at` 往下。
   *   ⚠️ 用**资源级**锚点（不是图集里逐帧那一份）：这是**占位/碰撞盒**，要的是稳定；
   *   逐帧锚点归渲染（外壳那边由 Phaser 自己逐帧 `setOrigin`）。
   *   ⚠️ 盒子取整（与外壳 `boxAt` 同一个公式）—— 交付态坐标是整数，盒子也该是。
   */
  const boxOf = (at: { x: number; y: number }, size: { w: number; h: number } | null, assetId?: string) =>
    entityBox(at, size ?? { w: 1, h: 1 }, anchorOf(assetId));

  const inWorld = (where: string, b: { x: number; y: number; w: number; h: number }) => {
    if (b.x + b.w > W || b.y + b.h > H)
      err(where, `落在世界之外（世界 ${W}×${H}；这个盒子是 (${b.x},${b.y}) ${b.w}×${b.h}）`);
  };
  for (const [i, t] of config.terrain.entries()) inWorld(`terrain[${i}]`, t);
  for (const e of config.entities) inWorld(`entity "${e.id}"`, boxOf(e.at, e.body ?? sizeOf(e.asset), e.asset));
  inWorld("player.at", boxOf(config.player.at, sizeOf(config.player.asset), config.player.asset));
  // ⚠️ **`hud.panel` 不在这里**（票 80 · 票 62 的 Q3）。理由：它的尺子是**视口**不是 `world.size`
  //   —— 那一族是 `auditScreenSpace`（`screen-space.ts`），而视口要**调用方传进来**，
  //   所以它住在编译/装配那一层（`ops.ts` / `site.ts`）。两条尺子量的是**同一个盒子**
  //   （都走 `boxOf` / `entityBox`），在这里再判一次 = 同一个事实说两遍，而视口那条**更严**
  //   （它查四条边，含负数）。⇒ 谁要把这一行加回来，`game-config.test.ts` 里那条**证伪性**断言会当场红。

  // ⚠️ **票 63**：「声明尺寸」这一格是「资源自身性质归包」的唯一例外，而例外的理由**是九宫格** ——
  //   收窄成「以九宫格为条件」之后，那半个条件**由这条判据守着**（`auditPanelSize`，与塔防共用一份）。
  //   ⚠️ 它落在这里而不是 `parseGameConfig` 的 refine：**这一步拿得到 `manifest`**（包与 config
  //   同时可见的只有这里），而且它走的是**额外请求次数为零**的 config 审计路径。
  const panelSize = auditPanelSize("hud.panel.size", config.hud.panel.size, manifest.assets.find((a) => a.id === config.hud.panel.asset));
  if (panelSize) out.push(panelSize);

  // 出生点不能卡在墙里 —— 点在某个 solid 的**盒子**里就是硬失败。
  const solids = config.entities.filter((e) => e.kind === "solid");
  const inside = (p: { x: number; y: number }, box: { x: number; y: number; w: number; h: number }) =>
    p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
  for (const e of solids) {
    const s = e.body ?? sizeOf(e.asset);
    if (!s) continue;   // 资源都解不到，谈不上「卡在里面」
    if (inside(config.player.at, boxOf(e.at, s, e.asset))) err("player.at", `出生点卡在 solid "${e.id}" 里`);
  }

  // ── 可通关族（**警告**）─────────────────────────────────────────────────
  const move = playerMoveOf(config);
  const apex = maxJumpHeight(move);
  // ⚠️ 只对「**一条平地面 + 若干台阶**」这种布局成立（last-train 就是）。
  //   多层地形要等真出现时再细化 —— 现在做一个更强的判断只会给出假的确定感。
  const groundY = config.terrain.length > 0 ? Math.max(...config.terrain.map((t) => t.y)) : H;
  for (const e of solids) {
    const s = e.body ?? sizeOf(e.asset);
    if (!s) continue;
    // ⚠️ 台阶高 = 地面线 − **盒子的底边**（不是 `at.y`）。锚点在底边时两者相同，
    //   锚点在别处时只有盒子这一种读法是对的（票 48：这里以前读的是 `at.y`）。
    const box = boxOf(e.at, s, e.asset);
    const step = groundY - (box.y + box.h);
    if (step > apex)
      warn(`entity "${e.id}"`, `台阶高 ${step}px，而最大跳跃高度只有 ${apex.toFixed(1)}px（${move.jumpVelocity}²/(2×${move.gravity})）—— 可能上不去。若这是有意的（该绕路走），忽略本条`);
  }
  for (const e of config.entities) {
    if (!e.motion) continue;
    const end = e.motion.axis === "x" ? e.at.x + e.motion.distance : e.at.y + e.motion.distance;
    const limit = e.motion.axis === "x" ? W : H;
    if (end > limit) warn(`entity "${e.id}"`, `周期运动的行程走到 ${end}，越出了世界的 ${e.motion.axis} 边界 ${limit}`);
  }

  return out;
}

/**
 * 设计桶名 —— 身份 / 一致性对账用到的四桶（player 是 config 顶层字段、不是 entity，不进对账）。
 */
export type DesignBucket = "enemies" | "npcs" | "interactables" | "resources";

/**
 * 设计桶 → 允许的运行时 `EntityKind` 集合。**单一来源**（entity-identity-v1.1 票 02）：
 * 编译期 `auditEntityIdentity` 与 QA `visual-config-coherence` **共用这一份**，不得各写一份漂移。
 *
 * ⚠️ 票 02 **C 路线**：只收进**可严格证明**的跨桶规则（`enemies`/`npcs`/`resources` 的桶语义
 *   天然封死），`interactables` **保持原样**（除 `decor` 外全部允许 —— `decor` 是纯装饰
 *   = 丢了交互 = 串桶，visual-design-impl-v1 票 02）。
 * ⚠️ **同桶误归属不在本矩阵射程内**：`interactables` 内部「信号灯→goal 对 / 宝箱→goal 错」
 *   靠 `type`/`behavior` 开放文本区分，票 01 已证不可靠 ⇒ 记录为已知限制，不靠摘 `goal`/`solid`
 *   制造误拒来假装解决（真实夹具 `i-signal`(信号灯)→goal 会因此被误拒，Phase 1 全仓实测 16 处）。
 */
export const DESIGN_BUCKET_KINDS: Readonly<Record<DesignBucket, readonly EntityKind[]>> = {
  enemies: ["hazard", "danger"],
  npcs: ["decor"],
  interactables: ["chest", "pickup", "goal", "hazard", "danger", "solid"],
  resources: ["pickup"],
};

/**
 * 实体身份验真（entity-identity-v1 Q2=(c) 的后半）：设计实体 ↔ 配置实体的 `sourceIntent` 对账。
 *
 * ⚠️ 四条规则都是**模型错**（`compile-runtime` 下一发能写对，进重采样循环）：
 *   ① **coverage**：**当前关卡**（`levelId`）必需的每个设计实体（四桶，**player 除外** —— 它是
 *     config 顶层字段、不是 entity）都要有**至少一个** config entity 的 `sourceIntent` 指向它；
 *   ② **悬空**：每个 config entity 的非空 `sourceIntent` 都要指向设计里真实存在的四桶实体 id；
 *   ③ **越界**（entity-identity-v1.1 票 03 B4）：`sourceIntent` 指向有效四桶 id 但**不属于当前关卡**
 *     → `wrong-scope`（配置多出了别的关卡的实体，覆盖循环只能发现「缺失」，须单独遍历 `config.entities[]`）；
 *   ④ **兼容**（entity-identity-v1.1 票 02，C 路线）：`sourceIntent` 指向真实且在**当前关卡**的设计实体时，
 *     运行时 `kind` 必须落在该设计桶的允许集合里 —— 只拦**可严格证明的跨桶错误**；同桶误归属见
 *     `DESIGN_BUCKET_KINDS` 注释。
 *
 * ⚠️ **关卡作用域**（票 03 B1/B4 + 票 05）：`levelId` 显式传入；**不默认取第一关、也不回退全局覆盖** ——
 *   多关不传 `levelId` = 缺上下文，报 `scope` error（不静默通过）。单关（`design.levels` 恰一条）时
 *   那条就是作用域，免显式传（票 03 B3 单关卡兼容，现有单关 fixture 不被破坏）。
 * ⚠️ **孤儿合法**：没有 `sourceIntent` 的 config entity（地面 solid / 终点 goal，无设计对位）**不报**。
 */
export function auditEntityIdentity(design: GameDesignSpec, config: GameConfig, levelId?: string): ConfigIssue[] {
  const bucketOf = new Map<string, DesignBucket>();
  for (const e of design.enemies) bucketOf.set(e.id, "enemies");
  for (const e of design.npcs) bucketOf.set(e.id, "npcs");
  for (const e of design.interactables) bucketOf.set(e.id, "interactables");
  for (const e of design.resources) bucketOf.set(e.id, "resources");

  const out: ConfigIssue[] = [];

  // ── 关卡作用域（票 03 B1/B4）：覆盖只查**当前关卡**必需的四桶实体，不查全局 ──
  //   ⚠️ 不默认取第一关、也不回退全局覆盖 —— 多关不传 levelId 就是「缺上下文」，报 scope error。
  const levels = design.levels ?? [];
  const level = levelId !== undefined
    ? levels.find((l) => l.id === levelId)
    : (levels.length === 1 ? levels[0] : undefined);
  if (level === undefined) {
    out.push({ severity: "error", where: "scope",
      message: levelId !== undefined
        ? `levelId "${levelId}" 在设计里没有对应关卡（现有：${levels.map((l) => l.id).join(" / ") || "无"}）`
        : `关卡作用域缺失 —— 设计有 ${levels.length} 关，必须显式传 levelId（不默认取第一关、也不回退全局覆盖）` });
    return out;
  }
  // 当前关卡必需实体（四桶；`player` 是顶层字段、不是 entity，不进 coverage —— gate ⑥ 已保证
  // `levels[].entities[]` 只含 player + 四桶，这里再用 `bucketOf` 滤掉 player）。
  const scope = new Set(level.entities.filter((id) => bucketOf.has(id)));

  // ① coverage：当前关卡每个必需四桶实体都要有 ≥1 个 config entity 的 sourceIntent 指向它
  for (const id of scope) {
    if (!config.entities.some((c) => c.sourceIntent === id))
      out.push({ severity: "error", where: `entity "${id}"`,
        message: `设计实体 "${id}" 在关卡 "${level.id}" 里没有对应实体 —— 缺一个 sourceIntent 指向它的 entity` });
  }
  // ② 悬空：config 的 sourceIntent 必须指向真实设计实体（四桶）
  for (const e of config.entities) {
    if (e.sourceIntent !== undefined && !bucketOf.has(e.sourceIntent))
      out.push({ severity: "error", where: `entity "${e.id}"`,
        message: `sourceIntent "${e.sourceIntent}" 指向设计里不存在的实体` });
  }
  // ③ 越界（票 03 B4）：sourceIntent 指向有效四桶 id 但**不在当前关卡** entities[] → wrong-scope。
  //   ⚠️ 必须单独遍历 config.entities[]（覆盖循环只能发现「缺失」，发现不了「配置多出别的关卡的实体」）。
  for (const e of config.entities) {
    if (e.sourceIntent === undefined) continue;
    if (!bucketOf.has(e.sourceIntent)) continue; // 悬空（② 已报）不重复
    if (!scope.has(e.sourceIntent))
      out.push({ severity: "error", where: `entity "${e.id}"`,
        message: `sourceIntent "${e.sourceIntent}" 不在关卡 "${level.id}" 的必需实体里（wrong-scope）—— 属于别的关卡或未归属本关` });
  }
  // ④ 兼容（票 02 C 路线）：只查「sourceIntent 有效且在本关」的实体 —— 悬空（②）/ 越界（③）已分别报，
  //   不重复报。同桶（interactables 内 goal↔chest）不在此射程。
  for (const e of config.entities) {
    if (e.sourceIntent === undefined) continue;
    const bucket = bucketOf.get(e.sourceIntent);
    if (bucket === undefined) continue;
    if (!scope.has(e.sourceIntent)) continue;
    const allowed = DESIGN_BUCKET_KINDS[bucket];
    if (!allowed.includes(e.kind))
      out.push({ severity: "error", where: `entity "${e.id}"`,
        message: `sourceIntent "${e.sourceIntent}" 指向 ${bucket} 桶，但运行时 kind "${e.kind}" 不在允许集合 {${allowed.join(", ")}} —— 语义不兼容（归属错误）` });
  }
  return out;
}

/** 解析 + 校验一步到位：schema 不过就返回那件事本身，不去谈别的。 */
export function parseGameConfig(input: unknown): { ok: true; value: GameConfig } | { ok: false; errors: string[] } {
  const r = GameConfigSchema.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "<根>"}: ${i.message}`) };
}
