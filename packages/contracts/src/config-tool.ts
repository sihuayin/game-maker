// `game-config/v1` 的 **v4 镜像** —— **只为一个消费者存在**：`compile-runtime` 那一次工具调用。
//
// ⚠️ 与 `recipe-tool.ts` 同款、同一条理由（票 12 立的先例，票 14 照抄）：
//   `toolInputSchema` **只吃 `zod/v4`**（票 28 的边界），而 `game-config.ts` 是 **v3** 写的旧契约。
//
// ⚠️ **它只镜像「形状」** —— 类型 · 可选性 · 封口 · 枚举 · 整数性。**一个 `refine` 都不镜像**：
//   ① `toJSONSchema` 静默丢掉 `superRefine`（票 08 实测）⇒ 镜像里有没有它们，**模型看见的一样**；
//   ② 在两种方言里各写一遍判据就是 `derivePackMode` 那种「写入侧与校验侧各写一份必然漂移」。
//   ⇒ 权威是 v3 那一份。调用方的分工：`parseToolUse(..., ConfigToolSchema)` 判「**入参过没过线**」，
//     紧接着 `parseGameConfig(...)`（v3）判「**这份配置成不成立**」（实体 id 不重复那条 refine），
//     再过 `auditGameConfig` + `auditScreenSpace` 那**两族判据**（它们本来就在契约里、不在 schema 里）。
//
// ⚠️ **别在这里"顺手"加坐标约束**（比如「`world.size.h` 必须等于视口高」）—— 那条要看**视口**，
//   而视口是**调用方传进来的常量**，schema 看不见它。它住在提示词与 `auditScreenSpace` 里。
import { z } from "zod/v4";

/** 与 `game-config.ts` 的 `Coord` 同形。 */
const CoordShape = z.number().int().nonnegative();
const PointShape = z.strictObject({ x: CoordShape, y: CoordShape });
const SizeShape = z.strictObject({ w: z.number().int().positive(), h: z.number().int().positive() });
const RectShape = z.strictObject({ x: CoordShape, y: CoordShape, w: z.number().int().positive(), h: z.number().int().positive() });

const MotionShape = z.strictObject({
  kind: z.literal("cycle"),
  axis: z.enum(["x", "y"]),
  distance: z.number().int().positive(),
  periodMs: z.number().int().positive()
});

const EntityShape = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(["solid", "pickup", "hazard", "goal", "decor"]),
  at: PointShape,
  asset: z.string().min(1),
  anim: z.string().min(1).optional(),
  body: SizeShape.optional(),
  motion: MotionShape.optional()
});

/** ⚠️ 速度/重力**不是整数**（`z.number().positive()`）—— 「坐标一律整数」管的是**位置与尺寸**。 */
const PlayerMoveShape = z.strictObject({
  speed: z.number().positive(),
  jumpVelocity: z.number().positive(),
  gravity: z.number().positive()
});

const PlayerShape = z.strictObject({
  asset: z.string().min(1),
  anims: z.strictObject({ idle: z.string().min(1), run: z.string().min(1), jump: z.string().min(1) }),
  at: PointShape,
  move: PlayerMoveShape.optional()
});

const HudShape = z.strictObject({
  panel: z.strictObject({ asset: z.string().min(1), at: PointShape, size: SizeShape }),
  pip: z.strictObject({ asset: z.string().min(1), at: PointShape, step: PointShape })
});

/** 线形状的 `game-config/v1`。**不是**契约 —— 契约是 `game-config.ts` 那份（见文件头）。 */
export const ConfigToolSchema = z.strictObject({
  format: z.literal("game-config/v1"),
  world: z.strictObject({ size: SizeShape }),
  scene: z.strictObject({ background: z.strictObject({ asset: z.string().min(1) }) }),
  player: PlayerShape,
  terrain: z.array(RectShape),
  entities: z.array(EntityShape),
  hud: HudShape,
  objective: z.strictObject({ kind: z.literal("collect-then-reach"), gate: z.string().min(1) })
});
