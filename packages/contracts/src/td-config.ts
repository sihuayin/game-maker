// `td-config/v1` —— **塔防**那一族玩法与手写外壳之间的语义接口。
//
// ⚠️ **它与 `game-config/v1` 是平级的兄弟格式，不是它的 v2。** 两条理由：
//   ① 「一个文件 = 一个关卡」这条（`game-config.ts` 文件头）本来就允许关卡文件是不同形状；
//   ② 判别式要动 `game-config/v1` 的 `.strict()` 字段集，而那会让**磁盘上已经存在的每一份
//      关卡文件**（fixtures 里的、`out/*/site/v*/` 里的）当场读不出来 —— 那个坑
//      `assetpack.ts` 的 v1→v2 已经踩过一次。兄弟格式让磁盘上**零字节**失效。
//
// ⚠️ **它是一份菜谱，不是一门语言** —— 与 `game-config/v1` 同一条纪律
//   （`CONTEXT.md` 的 [[Behavior Primitive]]）：外壳写死实现一组行为原语，配置只说
//   「哪里有、参数是多少」。`attack` / `targeting` 这些**封闭枚举**就是这个天花板的形状：
//   「这个游戏做不出来」因此是**构建期的 schema 拒绝**，不是运行时的意外。
//
// ── 三条**外壳写死、配置说不了**的规则（写在契约里，免得它们变成埋在代码里的知识）──────
//
//  ① **伤害在开火那一刻结算**，抛射物只是**装饰**（它飞向目标开火时的位置）。
//     理由：让「打中了没有」不依赖帧率与飞行时间 —— 于是索敌与结算是**确定性可算**的，
//     可以在 vitest 里零浏览器地测（`packages/demo/src/td/sim.ts`）。
//     代价：`projectile.speed` **不影响平衡**，它只影响看起来多快。
//  ② **护甲是平减且下限为 1**：`实际伤害 = max(1, damage - armor)`。
//     下限取 1 而不是 0 —— 取 0 会让「一队低伤机关打不动装甲敌人」变成一局
//     **打不赢又看不出来**的游戏，而那种失败没有任何构建期信号。
//  ③ **减速取最强的一份并刷新时长**（不是叠加、不是连乘）。两座电击地板同时打中一个敌人，
//     它按**更慢**的那个系数走，时长取**更晚**的那个到期时间。
//
// ⚠️ **坐标全是交付态像素，1:1、整数**（与 `game-config/v1` 同一条裁决）——
//   `x: 10.5` 会**静默**把精灵糊掉，而没有任何东西拦得住它。
//   `Coord` / `Point` / `Size` **从 `game-config.ts` 借**，不在这里重写一遍。
import { z } from "zod";
import { resolvePackRef, type AssetPackManifest } from "./assetpack.js";
import { Coord, Point, Size, entityBox, FALLBACK_ANCHOR, type ConfigIssue } from "./game-config.js";

export const TD_CONFIG_FORMAT = "td-config/v1" as const;

/** 一条折线上的一个点。**相邻两点必须轴对齐**（见 `auditTdConfig` 的自洽族）。 */
export const TdPoint = Point;

/** 一个可画的引用 —— 与 `AssetPackRef` **同一个形状**（`{asset, anim?}`）。 */
export const TdRef = z.object({ asset: z.string().min(1), anim: z.string().min(1).optional() }).strict();

/**
 * 机关的攻击方式。**封闭枚举** —— 它同时是「外壳实现了哪几种攻击」的清单。
 *
 * ⚠️ 两种的 `levels[].range` 含义**不同**，这是有意的、写在名字里的：
 *   · `single` —— `range` 是**索敌半径**（打得着才开火），伤害只落在选中的那一个身上；
 *   · `aoe`    —— `range` 是**爆炸半径**，开火时不索敌，落在射程内的**全部**敌人各吃一份伤害。
 * 不给 AoE 另开一个 `aoeRadius` 字段：那会让「射程」与「爆炸范围」变成两个可以互相矛盾的数。
 */
export const TdAttack = z.enum(["single", "aoe"]);

/**
 * 索敌策略。**两个值都实现**（不像 `Motion` 那样只实现一个）——
 * 两个都只是一行比较，而它们让「这座塔打谁」变成**配置说得出来的事**。
 */
export const TdTargeting = z.enum([
  "first",      // 沿路径走得**最远**的那个（经典塔防：先打快漏掉的）
  "strongest",  // **当前血量最高**的那个
]);

/**
 * 机关在**某个等级**上的战斗数值。
 *
 * ⚠️ `slow` 住在**等级**里而不是机关上 —— 它与 `damage` / `fireMs` 是同一种东西
 *   （「这一级的战斗力」）。挂在机关上的话，升级永远升不了减速，
 *   而那个不对称没有任何理由。
 */
export const TdTowerLevel = z.object({
  /** `single` = 索敌半径；`aoe` = 爆炸半径。**整数像素**。 */
  range: z.number().int().positive(),
  /** 单次伤害。**正整数** —— 0 伤害的机关没有意义，而它会让「打不打得赢」算错。 */
  damage: z.number().int().positive(),
  /** 两次开火之间的间隔（毫秒）。 */
  fireMs: z.number().int().positive(),
  /** 命中后附加的减速。`factor` 是速度乘数（0.6 = 降到六成），**严格小于 1**。 */
  slow: z.object({
    factor: z.number().gt(0).lt(1),
    ms: z.number().int().positive(),
  }).strict().optional(),
}).strict();

/**
 * 一种机关。**两级**（`levels` 是定长 2 的元组，`upgradeCost` 只有一个数）——
 * v1 的升级语义就是「花 `upgradeCost` 从 L1 变成 L2」，用元组说死它，
 * 比用一个能装 5 个元素的数组 + 一个标量价格（第 3 级的价钱无处可放）诚实。
 */
export const TdTower = z.object({
  id: z.string().min(1),
  /** 显示名（按钮上那三个字）。 */
  name: z.string().min(1),
  asset: z.string().min(1),
  /** 资源只有一个动画时可省 —— 与 `Entity.anim` 同一条规矩。 */
  anim: z.string().min(1).optional(),
  attack: TdAttack,
  targeting: TdTargeting,
  /** 建造花费（废料）。 */
  cost: z.number().int().positive(),
  /** 升到 2 级的花费。 */
  upgradeCost: z.number().int().positive(),
  levels: z.tuple([TdTowerLevel, TdTowerLevel]),
  /**
   * 开火时在原地播一次的特效（`aoe` 那类用它画扩散环）。
   * ⚠️ **是引用，不是外壳按攻击方式猜的** —— 「电击地板放电长什么样」是这个世界的事，
   *   不是「凡是 aoe 都长这样」。不给就只是没有特效，不影响伤害。
   */
  fx: z.object({ asset: z.string().min(1), anim: z.string().min(1) }).strict().optional(),
  /** 抛射物（**装饰**，见文件头规则 ①）。`single` 不给就是「看不见的即时命中」。 */
  projectile: z.object({
    asset: z.string().min(1),
    /** 像素/秒。⚠️ **不影响平衡**，只影响看起来多快。 */
    speed: z.number().positive(),
  }).strict().optional(),
}).strict();

/** 一种敌人。 */
export const TdEnemy = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  asset: z.string().min(1),
  anim: z.string().min(1),
  hp: z.number().int().positive(),
  /** 像素/秒（沿折线的推进速度）。 */
  speed: z.number().positive(),
  /** 击杀奖励（废料）。 */
  bounty: z.number().int().nonnegative(),
  /** 平减护甲，下限保护见文件头规则 ②。 */
  armor: z.number().int().nonnegative(),
  /** 走到柜台要扣几点声望。⚠️ 让「漏了这个」可以有不同代价 —— 否则它是个外壳常量。 */
  leakCost: z.number().int().positive(),
}).strict();

/**
 * 一波里的一组敌人。
 *
 * ⚠️ 时间语义说死在这里：`delayMs` 与 `gapMs` 都**相对本波开始**——
 *   组与组之间**不**串行等待。串行的话「蛮兵×4 同时从两端来」这种编排就写不出来了。
 */
export const TdWaveGroup = z.object({
  enemy: z.string().min(1),
  count: z.number().int().positive(),
  /** 同一组里两只之间的间隔。 */
  gapMs: z.number().int().nonnegative(),
  /** 本组第一只相对本波开始的延迟。 */
  delayMs: z.number().int().nonnegative(),
}).strict();

export const TdWave = z.object({ groups: z.array(TdWaveGroup).min(1) }).strict();

export const TdEconomy = z.object({
  /** 开局废料。 */
  startScrap: z.number().int().nonnegative(),
  /** 声望（命）。⚠️ **必须 > 0** —— 0 会产出一局「一开局就已经输了」的游戏。 */
  lives: z.number().int().positive(),
  /** 每波打完的额外奖励。 */
  waveBonus: z.number().int().nonnegative(),
}).strict();

/**
 * 顶栏与按钮的摆放。
 *
 * ⚠️ **按钮的条数不在这里** —— 它是 `towers.length` **派生**的
 *   （与 `game-config/v1` 的 HUD 槽位数 = 拾取物件数同一条规矩）：
 *   多写一个数就会多出「加了机关忘了改按钮数」这一类静默错误。
 */
export const TdHud = z.object({
  panel: z.object({ asset: z.string().min(1), at: Point, size: Size }).strict(),
  /** 第 i 个机关按钮的位置 = `at + i × step`。 */
  buttons: z.object({ asset: z.string().min(1), at: Point, size: Size, step: Point }).strict(),
  /** 开波按钮。 */
  start: z.object({ asset: z.string().min(1), at: Point, size: Size }).strict(),
  /**
   * 三行数字读数（**废料 / 声望 / 波次**，顺序是外壳的约定）的起点与行距。
   * ⚠️ 位置是数据、顺序是外壳 —— 一个只画三行的读数不值得为它开一个数组字段。
   */
  readout: z.object({ at: Point, step: Point }).strict(),
  /** 两枚图标，各自贴在第 1、2 行读数左边。 */
  icons: z.object({
    scrap: z.object({ asset: z.string().min(1), at: Point }).strict(),
    life: z.object({ asset: z.string().min(1), at: Point }).strict(),
  }).strict(),
}).strict();

export const TdConfigSchema = z.object({
  format: z.literal(TD_CONFIG_FORMAT),
  world: z.object({ size: Size }).strict(),
  /**
   * 场地：一张**字符地图**，每个字符是一种砖。
   *
   * ⚠️ **为什么是砖不是一张大背景图**（2026-09-29 实测的结论）：这个项目的画师是
   *   drawlist 生成器，它画**小物件**很稳（15×15 的砖、16×16 的机关一眼能认出来），
   *   画 480×270 的整幅场景则会退化成一片抖动条纹 —— 没有任何可读的轮廓。
   *   把场地拆成一格一格的砖，正好落在它擅长的尺度上；而且「地面 / 走道 / 货架 / 墙」
   *   本来就是**四种不同的砖**，不是四种不同的颜色。
   *   另一个好处是便宜：这张地图**构建期就能整个校验**（尺寸、字符、与路径的一致性），
   *   而一张大图只能靠人眼。
   */
  arena: z.object({
    /** 一格多少像素（正方形）。必须整除 `world.size`。 */
    cell: z.number().int().positive(),
    /** 字符 → 砖（资源引用）。 */
    tiles: z.record(z.string().length(1), TdRef),
    /**
     * **哪个字符是走道。**
     *
     * ⚠️ 有了它，「敌人走过的每一格都必须是走道砖」才是**可判的**
     *   （见 `auditTdConfig`）—— 而那条判据的价值在于：地图画错一格，
     *   表现是敌人在货架上走，而**没有任何东西会报错**。
     */
    walkChar: z.string().length(1),
    /** 每行一个字符串，**所有行长必须相等**（列数）。行数 × cell 必须等于世界高。 */
    rows: z.array(z.string().min(1)).min(1),
  }).strict(),
  scene: z.object({
    /** 空插槽的画法。**声明一次**，在每个 `slots[].at` 上重复出现（与 `hud.pip` 同款）。 */
    slot: z.object({ asset: z.string().min(1) }).strict(),
    /** 悬停/选中时套上去的高亮框。 */
    slotActive: z.object({ asset: z.string().min(1) }).strict(),
  }).strict(),
  /**
   * 敌人走的折线，**从出生点到柜台**。相邻两点必须轴对齐。
   *
   * ⚠️ **这里没有「走道砖」也没有「走道宽度」** —— 走道是**画在场地上的**
   *   （`arena.tiles.walk`），而它的宽度就是 `arena.cell`。
   *   把它们再声明一遍就等于给了它们一个能与场地对不上的机会，
   *   而「走道画在哪、敌人就走哪」这件事由 `auditTdConfig` 当场钉死。
   *
   * ⚠️ **2026-09-30 起它在 schema 里是可选的**（票 12）：**模型不写它** ——
   *   编译那一步从场地派生完再写进去（`tdResolveConfig`），所以**产物里它恒在**、
   *   下游（外壳 / 手写关卡 / 校验）**一无所知**。
   *   理由是一次实测（20 次真调用）：模型写的路径与它自己画的地图**对不上**，
   *   而那占了失败原因的绝大多数 ⇒ 那一族失败被做成了**结构上不可能**。
   *   ⚠️ 而**手写的关卡照旧可以自己声明**（人比模型靠谱），那条校验仍然守着「路径与地图对不上」；
   *   缺席时 `auditTdConfig` **派生一份再校验**（所以「校验看不到路径」这件事不会发生）。
   */
  path: z.object({ points: z.array(Point).min(2) }).strict().optional(),
  /**
   * 要守的东西（柜台）。
   *
   * ⚠️ **位置不在配置里** —— 它就是 `path.points` 的**最后一个点**。
   *   重写一遍只会多出一个能与路径末尾对不上的数（与 `objective` 不带数量同一条规矩）。
   */
  core: z.object({ asset: z.string().min(1) }).strict(),
  slots: z.array(z.object({ id: z.string().min(1), at: Point }).strict()).min(1),
  towers: z.array(TdTower).min(1),
  enemies: z.array(TdEnemy).min(1),
  waves: z.array(TdWave).min(1),
  economy: TdEconomy,
  hud: TdHud,
}).strict().superRefine((c, ctx) => {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
  const unique = (xs: readonly string[], where: (string | number)[], what: string) => {
    const seen = new Set<string>();
    for (const [i, x] of xs.entries()) {
      if (seen.has(x)) issue([...where, i], `${what}重复："${x}"`);
      seen.add(x);
    }
  };
  unique(c.towers.map((t) => t.id), ["towers"], "机关 id ");
  unique(c.enemies.map((e) => e.id), ["enemies"], "敌人 id ");
  unique(c.slots.map((s) => s.id), ["slots"], "插槽 id ");

  // 波的引用必须在 enemies 里 —— 与「找不到 id 为 X 的 goal 实体」同一条，且**这里是构建期**
  const enemyIds = new Set(c.enemies.map((e) => e.id));
  for (const [wi, w] of c.waves.entries())
    for (const [gi, g] of w.groups.entries())
      if (!enemyIds.has(g.enemy))
        issue(["waves", wi, "groups", gi, "enemy"], `找不到 id 为 "${g.enemy}" 的敌人（可选：${[...enemyIds].join(", ") || "无"}）`);
});

export type TdConfig = z.infer<typeof TdConfigSchema>;
export type TdTowerSpec = z.infer<typeof TdTower>;
export type TdTowerLevelSpec = z.infer<typeof TdTowerLevel>;
export type TdEnemySpec = z.infer<typeof TdEnemy>;
export type TdWaveSpec = z.infer<typeof TdWave>;
export type TdHudSpec = z.infer<typeof TdHud>;
export type TdRef = z.infer<typeof TdRef>;

// ── 派生量：**只此一处算**（echo `pickupCount` 的规矩）──────────────────────

/** 波数 = `waves.length`。**不重复声明。** */
export const waveCount = (c: TdConfig): number => c.waves.length;
/** 机关按钮数 = 机关种类数。**不重复声明**（HUD 按钮条数是它的派生）。 */
export const towerButtonCount = (c: TdConfig): number => c.towers.length;

/** 一段的长度。轴对齐保证了它是曼哈顿距离，但写成通式免得将来加斜线时算错。 */
const segLength = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

/** 折线总长（像素）。外壳按**弧长**推进敌人，所以这个数必须由纯层算好。 */
export function tdPathLength(points: readonly { x: number; y: number }[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) n += segLength(points[i - 1]!, points[i]!);
  return n;
}

/**
 * 一个点到折线的**最短距离**，外加它落在**第几段**上。
 *
 * ⚠️ 它同时被两处用：构建期的「插槽不许压在走道上」，与纯层算插槽覆盖哪几段
 *   （射程够不够得着）。**两份实现 = 两个答案**，而这里的差一点点就是
 *   「校验过的位置」与「玩起来的位置」不一样 —— 这一类错是静默的。
 */
export function tdDistanceToPath(
  points: readonly { x: number; y: number }[], p: { x: number; y: number },
): { distance: number; segment: number } {
  let best = { distance: Number.POSITIVE_INFINITY, segment: 0 };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const qx = a.x + t * dx, qy = a.y + t * dy;
    const d = Math.hypot(p.x - qx, p.y - qy);
    if (d < best.distance) best = { distance: d, segment: i - 1 };
  }
  return best;
}

/** 场地上的一格（列、行）。⚠️ **别处那几个同形的内联类型就是它** —— 别各写各的。 */
export type TdWalkCell = { c: number; r: number };

/**
 * 像素坐标落在哪一格。**全仓只此一处做这个换算** —— 构建期的「敌人走过的每一格」
 * 与纯层的「这块砖画在哪」必须用同一个映射，否则校验过的与画出来的会差一格。
 */
export const tdCellOf = (p: { x: number; y: number }, cell: number): TdWalkCell => ({
  c: Math.floor(p.x / cell), r: Math.floor(p.y / cell),
});

/**
 * 折线**穿过**的全部格子（按段推进，含两端）。
 *
 * ⚠️ 轴对齐这一条（自洽族）在这里是**前提**：斜段按 1 像素步进采样会漏格。
 *   校验的顺序是先判轴对齐、再用它 —— 两者是同一条规则的两半。
 */
export function tdPathCells(points: readonly { x: number; y: number }[], cell: number): TdWalkCell[] {
  const out: { c: number; r: number }[] = [];
  const seen = new Set<string>();
  const push = (p: { x: number; y: number }) => {
    const k = tdCellOf(p, cell), key = `${k.c},${k.r}`;
    if (!seen.has(key)) { seen.add(key); out.push(k); }
  };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    // ⚠️ **零长度段要单独挡**（`n === 0` ⇒ `t/n` 是 `0/0` = NaN ⇒ 格号是 NaN ⇒
    //   `rows[NaN]` 是 `undefined` ⇒ 这个函数**会抛**）。它本身是自洽族的硬失败，
    //   但校验器**不许在报出那条之前先自己炸掉** —— 那样人看到的是一个 TypeError，
    //   而不是「路径上有两个点重合」。
    if (n === 0) { push(a); continue; }
    for (let t = 0; t <= n; t++) push({ x: a.x + ((b.x - a.x) * t) / n, y: a.y + ((b.y - a.y) * t) / n });
  }
  return out;
}

/**
 * 一组敌人全部放完需要多久 —— 「这一波什么时候算清场」的**上界**，
 * 也是「打不打得赢」那条警告的分母。
 */
export function tdWaveDurationMs(wave: TdWaveSpec): number {
  return wave.groups.reduce((m, g) => Math.max(m, g.delayMs + Math.max(0, g.count - 1) * g.gapMs), 0);
}

/** 全部波次的敌人总血量 —— 「打不打得赢」那条警告的另一个数。 */
export function tdTotalEnemyHp(c: TdConfig): number {
  const hp = new Map(c.enemies.map((e) => [e.id, e.hp]));
  return c.waves.reduce((n, w) => n + w.groups.reduce((m, g) => m + (hp.get(g.enemy) ?? 0) * g.count, 0), 0);
}

/** 全配置里最高的单发伤害、与最低的护甲 —— 「有没有可能打不动」那条判据的两个数。 */
export const tdMaxDamage = (c: TdConfig): number =>
  Math.max(...c.towers.flatMap((t) => t.levels.map((l) => l.damage)));
export const tdMinArmor = (c: TdConfig): number =>
  Math.min(...c.enemies.map((e) => e.armor));

// ── 三族构建期校验（与 `auditGameConfig` 同一套判据纪律）────────────────────
//
//  引用族 / 自洽族 → **硬失败**（精确可算、且「错了一定不是设计」）
//  可通关族      → **硬失败仅限「压根打不动」那一条**，其余是**警告**
//                  （与「越不过这块台阶可能是设计」同一条：精确的硬失败、上界报警告）
export function auditTdConfig(config: TdConfig, manifest: AssetPackManifest): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const err = (where: string, message: string) => out.push({ severity: "error", where, message });
  const warn = (where: string, message: string) => out.push({ severity: "warning", where, message });

  const assetOf = (id: string) => manifest.assets.find((a) => a.id === id);

  /** 只看种类 —— 与 `auditGameConfig` 的 `kindOf` 同一个理由（把「是不是这一类」与「解不解得开」分开）。 */
  const kindOf = (where: string, assetId: string, kinds: readonly string[]) => {
    const a = assetOf(assetId);
    if (!a) { err(where, `包里没有资源 "${assetId}"`); return null; }
    if (!kinds.includes(a.kind)) { err(where, `"${assetId}" 是 ${a.kind}，这里要的是 ${kinds.join(" / ")}`); return null; }
    return a;
  };
  /** 解一个引用（顺带核种类）。 */
  const ref = (where: string, r: { asset: string; anim?: string }, kinds?: readonly string[]) => {
    if (kinds && !kindOf(where, r.asset, kinds)) return null;
    const res = resolvePackRef(r, manifest);
    if (!res.ok) { err(where, res.error); return null; }
    return res;
  };

  // ── 引用族（硬失败）──────────────────────────────────────────────────────
  ref("scene.slot", { asset: config.scene.slot.asset }, ["sprite"]);
  ref("scene.slotActive", { asset: config.scene.slotActive.asset }, ["sprite"]);
  for (const [ch, r] of Object.entries(config.arena.tiles)) {
    if (!ref(`arena.tiles["${ch}"]`, r, ["sprite", "animation"])) continue;
    // ⚠️ **砖的尺寸与锚点**（票 07）：上面那条只要求引用解得开 —— 于是**一张声明成 sprite 的
    //   480×270 大图照样解得开**。而外壳按「格心 + 锚点」摆精灵，576 格会各画一张大图叠在一起，
    //   **没有任何东西会报错**。三个真包的砖都是 `cell×cell`、锚点正中 ⇒ 这条判据不误伤任何真产物。
    const a = assetOf(r.asset)!;
    if (a.size.w !== config.arena.cell || a.size.h !== config.arena.cell)
      err(`arena.tiles["${ch}"]`, `砖 "${r.asset}" 是 ${a.size.w}×${a.size.h}，而格子是 ${config.arena.cell}×${config.arena.cell} —— ` +
        `比格子大就会**盖住邻居**（每一格都画一张），比格子小就会**留缝、透出外壳底色**。` +
        `砖的尺寸必须**正好等于** arena.cell`);
    if (a.anchor.x !== 0.5 || a.anchor.y !== 0.5)
      err(`arena.tiles["${ch}"]`, `砖 "${r.asset}" 的锚点是 {x:${a.anchor.x}, y:${a.anchor.y}}，而外壳按「**格心 + 锚点**」摆精灵 ` +
        `⇒ 锚点不正中，整张地图会**偏半格**，而没有任何东西会报错。砖的锚点必须是 {x:0.5, y:0.5}`);
  }
  ref("core", { asset: config.core.asset }, ["sprite"]);
  for (const t of config.towers) {
    ref(`tower "${t.id}"`, { asset: t.asset, ...(t.anim ? { anim: t.anim } : {}) }, ["sprite", "animation"]);
    if (t.projectile) ref(`tower "${t.id}".projectile`, { asset: t.projectile.asset }, ["sprite", "animation"]);
    if (t.fx) ref(`tower "${t.id}".fx`, { asset: t.fx.asset, anim: t.fx.anim }, ["animation"]);
  }
  // 敌人**按定义**是带动画的（要走），所以这里连 anim 一起解
  for (const e of config.enemies) ref(`enemy "${e.id}"`, { asset: e.asset, anim: e.anim }, ["animation"]);
  ref("hud.panel", { asset: config.hud.panel.asset }, ["ui"]);
  ref("hud.buttons", { asset: config.hud.buttons.asset }, ["ui"]);
  ref("hud.start", { asset: config.hud.start.asset }, ["ui"]);
  ref("hud.icons.scrap", { asset: config.hud.icons.scrap.asset }, ["ui"]);
  ref("hud.icons.life", { asset: config.hud.icons.life.asset }, ["ui"]);

  // ── 自洽族（硬失败）──────────────────────────────────────────────────────
  const { w: W, h: H } = config.world.size;
  const { cell } = config.arena;
  // ⚠️ `path` 是**可选**的（票 12）：缺席时**派生**一份来校验 ——
  //   于是「校验器看不到路径」这件事不会发生（而那正是「校验说没问题、外壳却崩了」的样子）。
  //   ⚠️ 走的是**同一个** `tdResolveConfig`（默认那条：写了就尊重）—— 校验器自己再实现一遍，
  //   「要不要派生」就有了两个住址，而两份实现会漂。
  const resolvedPath = tdResolveConfig(config);
  if (!resolvedPath.ok) err("arena", `从场地派生不出路径：${resolvedPath.error}`);
  const pts = resolvedPath.ok ? resolvedPath.value.path?.points ?? [] : [];

  const inWorld = (where: string, b: { x: number; y: number; w: number; h: number }) => {
    if (b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H)
      err(where, `落在世界之外（世界 ${W}×${H}；这个盒子是 (${b.x},${b.y}) ${b.w}×${b.h}）`);
  };

  // 路径：轴对齐 + 不许有零长度段。
  // ⚠️ 只查**配置里真写了**的那一份 —— 派生的那份按构造就是轴对齐、无重合（`tdDerivePath` 只留转折点）。
  for (const [i, p] of (config.path?.points ?? []).entries()) {
    if (p.x > W || p.y > H) err(`path.points[${i}]`, `落在世界之外（世界 ${W}×${H}）`);
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    if (a.x === b.x && a.y === b.y) {
      // ⚠️ 零长度段的归一化方向是 (0,0) → NaN 的精灵坐标 → **Phaser 什么都不画，也不报错**。
      //   与票 03 那条「静默失败」是同一类，所以它是硬失败。
      err(`path.points[${i}]`, `与上一个点完全重合（(${a.x},${a.y})）—— 零长度段会算出 NaN 的朝向，而不报错`);
    } else if (a.x !== b.x && a.y !== b.y) {
      err(`path.points[${i}]`, `与上一个点不轴对齐（(${a.x},${a.y}) → (${b.x},${b.y})）—— ` +
        `走道只允许横段与竖段：斜着铺地砖要旋转精灵，而任意角度会**毁掉像素网格**（本项目的立身之本）`);
    }
  }

  // 插槽：不许压在走道上、不许互相重合
  // ── 场地：几何 + 字符 + 与路径的一致性 ─────────────────────────────────
  const cols = config.arena.rows[0]!.length;
  if (cols * cell !== W || config.arena.rows.length * cell !== H)
    err("arena", `场地与世界的尺寸对不上：${cols} 列 × ${config.arena.rows.length} 行 × ${cell}px = ` +
      `${cols * cell}×${config.arena.rows.length * cell}，而世界是 ${W}×${H}。` +
      `（格子必须整除世界 —— 不然边缘会留一条画不到的地缝）`);
  for (const [r, row] of config.arena.rows.entries()) {
    if (row.length !== cols)
      err(`arena.rows[${r}]`, `这一行有 ${row.length} 个字符，而第 1 行有 ${cols} 个 —— 行长得一样齐`);
    for (const [c, ch] of [...row].entries())
      if (config.arena.tiles[ch] === undefined)
        err(`arena.rows[${r}][${c}]`, `字符 "${ch}" 不在 arena.tiles 里（可选：${Object.keys(config.arena.tiles).join(" ") || "无"}）`);
  }
  // 敌人走过的每一格，都必须是**走道砖**
  const walkTile = config.arena.tiles[config.arena.walkChar];
  if (walkTile === undefined)
    err("arena.walkChar", `走道字符 "${config.arena.walkChar}" 不在 arena.tiles 里 —— ` +
      `那样整张图就没有一格是走道，而敌人仍然会从上面走过去`);
  if (walkTile && cols * cell === W && config.arena.rows.length * cell === H) {
    for (const { c, r } of tdPathCells(pts, cell)) {
      // ⚠️ `Number.isInteger` 不是多余的：NaN 与任何数比较都是 false，会一路滑过去
      if (!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || r < 0 || c >= cols || r >= config.arena.rows.length) {
        err("path.points", `路径走出了场地（格 ${c},${r}）`);
        continue;
      }
      const ch = [...config.arena.rows[r]!][c]!;
      const tile = config.arena.tiles[ch];
      if (tile && tile.asset !== walkTile.asset)
        err(`arena.rows[${r}][${c}]`, `敌人从这里走过（格 ${c},${r}），而这一格画的是 "${ch}"（${tile.asset}），` +
          `不是走道砖（${walkTile.asset}）—— **走道画在哪，敌人就该走哪**，两者对不上就是地图在骗人`);
    }
  }

  // ⚠️ **路径缺席且派生不出来时，下面那几条「够不够得着走道」都无从谈起** ——
  //   照旧跑的话它们会拿 `Number.POSITIVE_INFINITY` 去比，报出一串**误导**的错
  //   （塔的射程明明没问题，却被告知够不着走道）。上面那条「派生不出路径」已经把话说清了。
  const hasPath = pts.length >= 2;
  const slotA = assetOf(config.scene.slot.asset);
  const slotSize = slotA ? slotA.size : { w: 16, h: 16 };
  const slotAnchor = slotA?.anchor ?? FALLBACK_ANCHOR;
  const slotBoxes = config.slots.map((s) => ({ id: s.id, box: entityBox(s.at, slotSize, slotAnchor) }));
  // 避让 = 走道半宽（= 半个格）+ 插槽半宽。走道宽就是格宽 —— 不另开一个数。
  const clearance = cell / 2 + Math.max(slotSize.w, slotSize.h) / 2;
  for (const [i, s] of config.slots.entries()) {
    inWorld(`slot "${s.id}"`, slotBoxes[i]!.box);
    if (!hasPath) continue;
    const { distance } = tdDistanceToPath(pts, s.at);
    if (distance < clearance)
      err(`slot "${s.id}"`, `离走道只有 ${distance.toFixed(1)}px，而避让要求 ≥ ${clearance.toFixed(1)}px ` +
        `（走道半宽 ${cell / 2} + 插槽半宽 ${Math.max(slotSize.w, slotSize.h) / 2}）—— ` +
        `机关压在敌人走的路上，读起来像站在路中间`);
  }

  // ⚠️ **每种机关的 L1 至少要有一个插槽够得着走道**（票 10）：否则那座塔在这一关里
  //   **建了永远不开火** —— 而「一种塔在这关里是死的」不可能是设计。实测：模型编译出来的那一关，
  //   电击地板 L1（射程 40）在**任何一个插槽上都够不着**。
  //   ⚠️ **只看 L1** —— 那是你第一次把它建出来的状态。看每一级太紧：编译那关 L1 是 0% 但 L2 有 29%，
  //   按「每一级都要」会拒掉一个「升级之后就能用」的关卡，而那是**可能的设计**。
  if (hasPath && config.slots.length > 0)
    for (const t of config.towers) {
      const range = t.levels[0].range;
      if (!config.slots.some((s) => tdDistanceToPath(pts, s.at).distance <= range))
        err(`tower "${t.id}"`, `L1 射程 ${range} 在**任何一个插槽上都够不着走道** —— 这座机关在这一关里是**死的**` +
          `（建了永远不开火）。要么把 L1 射程放大到够得着最近的那个插槽，要么把它从这一关的机关表里去掉`);
    }

  // 柜台与 HUD 落在世界里 / 视口里
  // ⚠️ **`coreAt` 是派生的，而派生的那份可能根本没有**（路径缺席 + 走道画得不合法）。
  //   这里原来写着 `pts[pts.length - 1]!` —— 那个 `!` 是**假的**：空数组会给出 `undefined`，
  //   而 `entityBox(undefined)` 当场抛 ⇒ **校验器把一个「说得出哪儿不对」的失败变成了崩溃**。
  const coreA = assetOf(config.core.asset);
  const coreAt = pts[pts.length - 1];
  if (coreA && coreAt) inWorld("core", entityBox(coreAt, coreA.size, coreA.anchor));
  const hudPanel = assetOf(config.hud.panel.asset);
  if (hudPanel) inWorld("hud.panel", entityBox(config.hud.panel.at, config.hud.panel.size, hudPanel.anchor));

  // ── 可通关族 ─────────────────────────────────────────────────────────────
  //
  // ⚠️ 硬失败的只有一条：**最高伤害打不穿最低护甲**。那意味着「这一局在数学上赢不了」，
  //   而它是精确可算的、且**不可能是有意的设计**（与「越不过台阶可能是设计」正相反）。
  //
  // ⚠️ **「打不动」在这一版里是不可能的** —— 规则 ② 的下限 1 保证了任何一次命中至少掉 1 点血。
  //   那是**有意的**：取 0 会产出一局「打不赢、而且看不出为什么」的游戏。
  //   所以这里剩下的唯一一条是**刻度检查**：伤害与护甲若是写反了量级
  //   （比如伤害全是个位数、护甲全是两位数），游戏会变成一局磨到超时的钝仗。
  const maxDmg = tdMaxDamage(config);
  const minArmor = tdMinArmor(config);
  if (maxDmg <= minArmor)
    warn("towers", `全部机关的最高伤害是 ${maxDmg}，而敌人的最低护甲是 ${minArmor} —— ` +
      `下限 1 保证了仍然打得动，但这说明**数值刻度多半写反了量级**（伤害该比护甲大一个档）`);

  // DPS 上界（假设全部机关满负荷、全部命中）< 全部敌人总血 → 警告
  const totalHp = tdTotalEnemyHp(config);
  const dpsBound = config.slots.length * Math.max(
    ...config.towers.map((t) => t.levels[1]!.damage / (t.levels[1]!.fireMs / 1000)),
  );
  const firstWaveStart = 0;   // 第一波随时可开 —— 上界按「从 0 开始一直打」算
  void firstWaveStart;
  if (hasPath && dpsBound * 1 > 0 && totalHp > 0) {
    // 敌人总「在场时间」的上界：全部 wave 的 duration 之和 + 走完全程的时间
    const walkMs = (tdPathLength(pts) / Math.min(...config.enemies.map((e) => e.speed))) * 1000;
    const spawnMs = config.waves.reduce((n, w) => n + tdWaveDurationMs(w), 0);
    const capacity = dpsBound * ((spawnMs + walkMs) / 1000);
    if (capacity < totalHp)
      warn("waves", `全部插槽插满二级机关、全部满负荷命中的**上界**约 ${Math.round(capacity)} 点伤害，` +
        `而全场敌人总血量 ${totalHp} —— 可能打不赢。⚠️ 这是个**上界**（它假设了完美输出、没有漏怪、` +
        `没有建造顺序问题）；真的打不打得赢要玩过才知道。若这是有意的（就是要难），忽略本条`);
  }

  return out;
}

/** 解析 + 校验一步到位：schema 不过就返回那件事本身，不去谈别的。 */
export function parseTdConfig(input: unknown): { ok: true; value: TdConfig } | { ok: false; errors: string[] } {
  const r = TdConfigSchema.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "<根>"}: ${i.message}`) };
}

// ── 走道 → 折线：**派生**（票 12）──────────────────────────────────────────
//
// ⚠️ **为什么路径由代码派生，而不是模型声明**（票 12 的 Q1）：实测模型产出的关卡里，
//   失败**几乎全在同一族** —— 「`path.points` 的坐标」与「地图上画成 `:` 的格」**对不上**。
//   而那条路是**结构上可以被消灭的**：走道只有一条，顺序唯一 ⇒ 派生出来的路**就是**画的那条。
// ⚠️ **它推翻了票 02 的 Q3**（那条否决的前提是「走道可以有多个合法顺序」，而它不成立）。
// ⚠️ 而 `path` **仍是契约里的一等公民**：产物里它还在，下游一无所知；
//   **手写的关卡照旧可以自己声明路径** ✓ —— 而那正是 `tdResolveConfig` 有两种模式的原因：
//   装配与校验**尊重**写下的那一份，**编译一律从地图派生**（`{ fromMap: true }`），
//   所以「模型写的路径与地图对不上」在编译那条路上**根本无从发生**。

/**
 * 把场地上的走道格**从入口端到柜台端排好序**。
 *
 * ⚠️ **它是派生路径与「走道不许分叉」那条校验共用的同一份**（一个决定只能住在一个地方）——
 *   两份实现会漂，而漂的表现是「校验说没问题、派生出另一条路」。
 */
export function tdWalkway(
  config: TdConfig,
): { ok: true; cells: TdWalkCell[] } | { ok: false; error: string } {
  const { rows, walkChar } = config.arena;
  const cols = rows[0]?.length ?? 0;
  const at = (c: number, r: number): string =>
    r < 0 || r >= rows.length || c < 0 || c >= cols ? "" : ([...rows[r]!][c] ?? "");
  const isWalk = (c: number, r: number) => at(c, r) === walkChar;

  const walk: TdWalkCell[] = [];
  const doors: TdWalkCell[] = [];
  for (const [r, row] of rows.entries())
    for (const [c, ch] of [...row].entries()) {
      if (ch === walkChar) walk.push({ c, r });
      else if (ch === "+") doors.push({ c, r });
    }
  if (walk.length === 0) return { ok: false, error: `地图上一格走道（"${walkChar}"）都没有` };
  if (doors.length === 0) return { ok: false, error: `地图上没有入口（"+"）—— 派生不出起点` };
  if (doors.length > 1) return { ok: false, error: `地图上有 ${doors.length} 个入口（"+"）—— 只能有一个，否则不知道敌人从哪进` };

  const deg = (p: TdWalkCell) =>
    [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dc, dr]) => isWalk(p.c + dc!, p.r + dr!)).length;

  // ⚠️ **走道必须是一条简单路径**：连通、不分叉、不绕圈。
  //   否则「派生出来的那条路」就只是算法挑的一条，而不是**画的那条**（票 02 担心的正是这个）。
  const leaves = walk.filter((p) => deg(p) === 1);
  const branched = walk.filter((p) => deg(p) > 2);
  if (branched.length > 0)
    return { ok: false, error: `走道在格 (${branched[0]!.c},${branched[0]!.r}) 处分了叉（有 ${deg(branched[0]!)} 条出口）—— ` +
      `走道必须是**一条**一折再折的路，否则「敌人走哪条」就没有唯一答案` };
  if (leaves.length !== 2)
    return { ok: false, error: `走道有 ${leaves.length} 个端头（度数 1 的格），而一条简单路径应当**正好两个**` +
      `${leaves.length === 0
        ? "（一个都没有 ⇒ 它绕成了一个圈）"
        // ⚠️ **要点名是哪几格** —— 说得清才有得改（与「分了叉」那条同一个理由）。
        : `：${leaves.slice(0, 4).map((p) => `(${p.c},${p.r})`).join(" ")}${leaves.length > 4 ? " …" : ""}`}` };

  // 起点 = 紧挨着入口那一头
  const start = leaves.find((l) => doors.some((d) => Math.abs(d.c - l.c) + Math.abs(d.r - l.r) === 1));
  if (!start) return { ok: false, error: `两个端头都不挨着入口（"+"）—— 敌人从门口进不到走道上` };

  const ordered: TdWalkCell[] = [start];
  const seen = new Set([`${start.c},${start.r}`]);
  for (;;) {
    const cur = ordered[ordered.length - 1]!;
    const next = [[0, -1], [0, 1], [-1, 0], [1, 0]]
      .map(([dc, dr]) => ({ c: cur.c + dc!, r: cur.r + dr! }))
      .find((p) => isWalk(p.c, p.r) && !seen.has(`${p.c},${p.r}`));
    if (!next) break;
    ordered.push(next);
    seen.add(`${next.c},${next.r}`);
  }
  if (ordered.length !== walk.length) {
    // ⚠️ **要点名是哪一格** —— 这条失败取代了「路径穿过的格不是走道砖」那一族，
    //   而那一族是**说得出格号**的（`arena.rows[8][12]`）。说得清才有得改。
    const stuck = walk.find((p) => !seen.has(`${p.c},${p.r}`))!;
    return { ok: false, error: `走道断了：从入口那头只走得到 ${ordered.length} 格，而地图上画了 ${walk.length} 格` +
      `（头一格走不到的是 (${stuck.c},${stuck.r}) —— 它与入口那头不连通）` };
  }
  return { ok: true, cells: ordered };
}

/**
 * **把配置补全**：`path` 缺席就派生一份填上。
 *
 * ⚠️ **「要不要派生」这件事只有这一处** —— 三个消费方（`compileTdGame` · `assembleTdSite` ·
 *   `auditTdConfig`）都调它。各自写一遍的后果是：一个派生了、另一个没有，
 *   而**产物里到底有没有路径**就成了谜（它真的谜过一次：校验器自己又实现了一遍）。
 *
 * ⚠️ `opts.fromMap` = **不看它写没写，一律从地图派生**（**编译那一步**用这个）。
 *   它才是票 12 那句「那一族失败**结构上不可能**」真正落地的地方：
 *   只要还「尊重」模型写的 `path`，「模型写了一份与地图对不上的路径」这条失败就**还在**
 *   —— 而它是 20 次真调用里失败原因的绝大多数。**手写关卡与装配走默认那条**（写了就尊重）。
 */
export function tdResolveConfig(
  config: TdConfig,
  opts: { fromMap?: boolean } = {},
): { ok: true; value: TdConfig } | { ok: false; error: string } {
  if (config.path && !opts.fromMap) return { ok: true, value: config };
  const d = tdDerivePath(config);
  if (!d.ok) return d;
  return { ok: true, value: { ...config, path: { points: d.points } } };
}

/**
 * 从场地**派生**那条折线（单元格中心，只留**转折点**）。
 *
 * ⚠️ **终点就是走道的另一端 —— 那**就是柜台**（所以 `core` 不需要再声明一个位置：它是派生的）。
 *   票 12 的 Q3 原写的是「`core` 加一个显式 `at`」，而写到这里看清楚了**那个字段会是多余的**：
 *   柜台的位置**已经被「走道从门口通到柜台」那条规则完全决定了**（`+` 是入口 ⇒ 另一端就是柜台），
 *   再加一个 `at` 等于把一个**只能是派生值**的数交给模型去写错 ——
 *   而票 12 整张票就是在删这种字段。⇒ **已就地更正票 12。**
 */
export function tdDerivePath(
  config: TdConfig,
): { ok: true; points: { x: number; y: number }[] } | { ok: false; error: string } {
  const w = tdWalkway(config);
  if (!w.ok) return w;
  const { cell } = config.arena;
  const centre = (p: TdWalkCell) => ({ x: p.c * cell + Math.floor(cell / 2), y: p.r * cell + Math.floor(cell / 2) });
  const pts: { x: number; y: number }[] = [];
  for (const [i, p] of w.cells.entries()) {
    const prev = w.cells[i - 1], next = w.cells[i + 1];
    const turn = i === 0 || next === undefined ||
      (prev!.c !== p.c) !== (next.c !== p.c);   // 横竖变了 = 一个转折
    if (turn) pts.push(centre(p));
  }
  return { ok: true, points: pts };
}
