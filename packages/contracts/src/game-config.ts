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
import { z } from "zod";
import { resolvePackRef, type AssetPackManifest } from "./assetpack.js";

export const GAME_CONFIG_FORMAT = "game-config/v1" as const;

/** 整数坐标。**非负** —— 世界从 (0,0) 起算。 */
const Coord = z.number().int().nonnegative();
const Point = z.object({ x: Coord, y: Coord }).strict();
const Size = z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).strict();
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
export const EntityKind = z.enum(["solid", "pickup", "hazard", "goal", "decor"]);

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
 * 世界里**有画面**的一个东西。
 *
 * ⚠️ 它**不重复声明自己的几何**：`size` 与 `anchor` 只住在[[资源包]]里（票 09 裁决 5）——
 *   同一个货箱在两个关卡里一样大，而 `scale` 会**静默**糊掉像素网格。
 *   `body` 省略时**就是资源的 `size`**（画面即碰撞面），给了就覆盖。
 */
export const Entity = z.object({
  id: z.string().min(1),
  kind: EntityKind,
  at: Point,
  asset: z.string().min(1),
  /** 用哪个动画。**资源只有一个动画时可省**；省了而资源有多个时，解析会失败。 */
  anim: z.string().min(1).optional(),
  body: Size.optional(),
  motion: Motion.optional(),
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

export const Player = z.object({
  asset: z.string().min(1),
  /**
   * **显式映射**，不是名字约定（票 09 裁决 10）。若外壳硬找 `idle`，那么一个把走路叫 `walk`
   * 的包就是**静默用错**；而这里每个名字都由 `resolvePackRef()` 在构建期逐个校验 ——
   * 构建期是唯一还能报出「哪个引用点引用了哪个不存在的动画」的地方。
   */
  anims: z.object({
    idle: z.string().min(1), run: z.string().min(1), jump: z.string().min(1),
  }).strict(),
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
  }
});

export type GameConfig = z.infer<typeof GameConfigSchema>;
export type GameEntity = z.infer<typeof Entity>;
export type EntityKind = z.infer<typeof EntityKind>;
export type Motion = z.infer<typeof Motion>;
export type Hud = z.infer<typeof Hud>;
export type Objective = z.infer<typeof Objective>;

/** 「要捡几件」= `kind:"pickup"` 的实体条数。**不重复声明**（票 09 裁决 8）。 */
export const pickupCount = (c: GameConfig): number => c.entities.filter((e) => e.kind === "pickup").length;

/** 玩家实际生效的手感参数 —— 只此一处回落到默认值，校验与外壳共用。 */
export const playerMoveOf = (c: GameConfig) => c.player.move ?? DEFAULT_PLAYER_MOVE;

/** 一次跳跃能到多高（像素）。抛物线顶点是**精确可算**的 —— 这是「可通关」那族的全部依据。 */
export const maxJumpHeight = (move: { jumpVelocity: number; gravity: number }): number =>
  (move.jumpVelocity * move.jumpVelocity) / (2 * move.gravity);

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
export function auditGameConfig(config: GameConfig, manifest: AssetPackManifest): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const err = (where: string, message: string) => out.push({ severity: "error", where, message });
  const warn = (where: string, message: string) => out.push({ severity: "warning", where, message });

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

  // ── 引用族（硬失败）────────────────────────────────────────────────────
  const sizeOf = (assetId: string): { w: number; h: number } | null =>
    manifest.assets.find((a) => a.id === assetId)?.size ?? null;

  ref("scene.background", { asset: config.scene.background.asset }, ["background"]);
  // ⚠️ 玩家**只核对种类，不在这里解引用** —— 它是「有多个可画动画」的常态资源，
  //   而下面那三个动作名才是真正要解的东西。
  if (kindOf("player", config.player.asset, ["animation"])) {
    // 三个动作名**逐个解** —— 这是票 09 裁决 10 那条「显式映射」的兑现处。
    for (const [action, anim] of Object.entries(config.player.anims))
      ref(`player.anims.${action}`, { asset: config.player.asset, anim });
  }
  for (const e of config.entities) ref(`entity "${e.id}"`, { asset: e.asset, ...(e.anim ? { anim: e.anim } : {}) });
  ref("hud.panel", { asset: config.hud.panel.asset }, ["ui"]);
  ref("hud.pip", { asset: config.hud.pip.asset }, ["ui"]);

  const gates = config.entities.filter((e) => e.kind === "goal");
  const gate = gates.find((e) => e.id === config.objective.gate);
  if (!gate) err("objective.gate", `找不到 id 为 "${config.objective.gate}" 的 goal 实体（现有 goal：${gates.map((e) => e.id).join(", ") || "无"}）`);

  if (pickupCount(config) === 0)
    err("entities", "一个 pickup 都没有 —— 而 objective 是「捡齐 N 件再到达终点」，N = 0 让这一关没有内容");

  // ── 自洽族（硬失败）────────────────────────────────────────────────────
  const { w: W, h: H } = config.world.size;

  /** 资源级锚点（manifest 上那一份）。取不到就用兜底 —— 与外壳（票 44）同款。 */
  const anchorOf = (assetId: string | undefined) =>
    (assetId ? manifest.assets.find((a) => a.id === assetId)?.anchor : undefined) ?? FALLBACK_ANCHOR;

  /**
   * 一个东西在世界上**占的那个盒子**（左上角 + 宽高）。**全函数只此一处算盒子。**
   *
   * ⚠️ **`at` 是「资源锚点落在哪」，不是左上角**（票 48）。这条由**包**定死：
   *   角色的锚点是**脚**（`{x:.5,y:.95}`）、世界里的道具是**底边中心**（`{x:.5,y:1}`）、
   *   HUD 面板是**左下角**（`{x:0,y:1}`）。所以站在地面线上的东西写 `at.y = 地面 y`，
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
  inWorld("hud.panel", boxOf(config.hud.panel.at, config.hud.panel.size, config.hud.panel.asset));

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

/** 解析 + 校验一步到位：schema 不过就返回那件事本身，不去谈别的。 */
export function parseGameConfig(input: unknown): { ok: true; value: GameConfig } | { ok: false; errors: string[] } {
  const r = GameConfigSchema.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "<根>"}: ${i.message}`) };
}
