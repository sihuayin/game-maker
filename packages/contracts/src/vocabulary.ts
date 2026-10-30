// 两份**封闭词表** —— 玩法**机制**与**外壳能力**的取值域（票 03 Q1(b)/Q3(b)/Q4(b)）。
//
// ⚠️ **它不是契约，是「取值的家」。** 三份契约引它：
//   `game-design.ts`      → `mechanics[].mechanic` · `runtimeRequirements[]`
//   `runtime-profile.ts`  → `mechanics[]` · `capabilities[]`（票 05，尚未落地）
//   `game-intent.ts`      → 只引 `INTENT_ENTITY_TYPES`（**不**引机制词表，理由见下）
// 住在任何一家名下都会让另外两家**反向依赖**它，所以它单独一层、谁也不拥有（Q4(b)）。
//   被否决的两个方案：写进 `runtime-profile.ts`（那时票 05 与票 03 **在两个 session 手上**，
//   两边同时改一个文件）；各立一份 + 漂移测试（票 02 的 v3/v4 镜像是**被迫**的 ——
//   同一个 schema 的两种方言；这里是**三个不同的契约**，没有被迫的理由）。

import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// 一、`MECHANICS` —— 玩法机制
//
// ⚠️ **这张表不是我发明的，是从 `game-config/v1` 反推的**（R12：`RuntimeProfile` 是
//   **外壳能力的事实投影**，不是一张许愿单）。它比想象的小得多 —— 四个构造，十个机制：
//
//     EntityKind = "solid" | "pickup" | "hazard" | "goal" | "chest" | "danger" | "decor"   game-config.ts:40
//     Motion     = { kind: "cycle", axis, distance, periodMs }                              game-config.ts:49
//     PlayerMove = { speed, jumpVelocity, gravity }                                         game-config.ts:105
//     Objective  = { kind: "collect-then-reach" }                                           game-config.ts:154
//
//   ⚠️ `chest` 与 `danger` 是 2026-10-23（票 13 / 14）加的：`open-chest`（近距自动触发、
//   一次性奖励并入收集计数）与 `avoid-danger`（定时打击 + 安全窗口）。两者都进了
//   `RUNTIME_IMPLEMENTED_MECHANICS`，所以是 `supported`。
//
// ⚠️ **`double-jump` / `attack` / `health` / `enemy-ai` / `dialogue` 全都不在表里** ——
//   而它们正是用户最常要的。这不是漏了，**这正是这张表存在的理由**：
//   用户说「要二段跳」，`analyze-intent` 照实记进 `GameIntentSpec.mechanics`（**自由文本**），
//   `compile-design` 一填 `GameDesignSpec.mechanics` 就**填不出来** ——
//   于是 R12 的「构建期拒绝」第一次**有真事可拒**，而且是在**生图之前**拒（票 10 §3 / 票 14 §2
//   都在追问「越晚拒绝越贵」，这就是那个解药）。
//
// ⚠️ 所以**意图侧故意不吃这张表**：`GameIntentSpec.mechanics[].name` 是 `z.string()`。
//   若两边都上封闭枚举，用户要的东西**根本记不下来**，也就没有东西可以被拒绝。
export const MECHANICS = [
  /** `PlayerMove.speed` —— 水平移动（game-config.ts:107）。 */
  "run",
  /** `PlayerMove.jumpVelocity` —— **单跳**。⚠️ 没有二段（`maxJumpHeight` 由 jump/gravity 推出，:192）。 */
  "jump",
  /** `PlayerMove.gravity` —— 重力。 */
  "gravity",
  /** `terrain: Rect[]` 的实体碰撞（:166）；解算见 `entityBox`（:97）。 */
  "collide-terrain",
  /** `EntityKind = "pickup"`（:40）＋ `pickupCount`（:186）。 */
  "collect-pickup",
  /** `Motion { kind: "cycle" }`（:49）—— 实体沿一个轴**周期往复**。 */
  "moving-platform",
  /** `EntityKind = "hazard"`（:40）—— 碰到就输。 */
  "hazard-contact",
  /** `EntityKind = "goal"`（:40）＋ `Objective = "collect-then-reach"`（:154）。 */
  "reach-goal",
  /** `EntityKind = "chest"`（:40）＋ 可选 `range` —— 近距自动触发、一次性奖励并入收集计数（票 04 / 13）。 */
  "open-chest",
  /** `EntityKind = "danger"`（:40）＋ `strike{periodMs,activeMs}` —— 定时打击 + 安全窗口（票 05 / 14）。 */
  "avoid-danger"
] as const;

export const MechanicSchema = z.enum(MECHANICS);
export type Mechanic = z.infer<typeof MechanicSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 一·补、`MECHANIC_STATUS` —— 机制状态（票 12 · 意图→机制契约）
//
// ⚠️ **不是手写宣称，是「推导」**：`supported` 由「运行时实现」这条见证推导而来。
//   「设计表达」与「config 表达」两条腿是**恒真**的 —— `MECHANICS` 本来就是从
//   `game-config/v1` 反推的（文件头 §一），进表的那天就带了 config，枚举里就带了设计；
//   真正会**漏**的是「运行时实现」：`moving-platform` 就是那个反例（见下）。
//   「QA probe」那条腿依赖票 06，落地前不计 —— 手写一张 `Record<Mechanic, Status>` 就是
//   票 01 禁掉的「手写宣称」：删掉 `scene.ts` 的一行实现，那张表照样躺在那儿说它 supported。
//
// ⚠️ **事实性由测试保证，不由类型保证**（`runtime-profile.ts` §一②③ 同款）：这里的
//   `RUNTIME_IMPLEMENTED_MECHANICS` 是**带行号的转录**，真伪由
//   `packages/demo/tests/shell-mechanic-witness.test.ts` 逐条读外壳源码断言（删实现 ⇒ 当场响）。
export const MECHANIC_STATUSES = ["experimental", "supported", "deprecated"] as const;
export const MechanicStatusSchema = z.enum(MECHANIC_STATUSES);
export type MechanicStatus = z.infer<typeof MechanicStatusSchema>;

/** 生命周期手标（`deprecated`）—— **不是**能力推导出来的：它是一句「别再用了」的人话。
 *  ⚠️ 今天为空 —— 没有哪条机制到了要退役的地步。 */
export const DEPRECATED_MECHANICS: readonly Mechanic[] = [];

/** **运行时实现**见证（转录）：哪几条机制在外壳里真有运行时行为。
 *  ⚠️ `moving-platform` 刻意**不在** —— `Motion` 在 `game-config/v1` 里是正交于 `kind` 的
 *   （`vocabulary.ts` 上面那句注释），但渲染器只在 `case "hazard"` 读 `motion`
 *   （`shell/scene.ts`），带 motion 的 solid 是静态体、从不移动。 */
export const RUNTIME_IMPLEMENTED_MECHANICS: readonly Mechanic[] = [
  "run",
  "jump",
  "gravity",
  "collide-terrain",
  "collect-pickup",
  "hazard-contact",
  "reach-goal",
  "open-chest",
  "avoid-danger"
];

/** 推导机制状态：`deprecated`（手标）→ `supported`（有运行时实现）→ `experimental`（其余）。
 *  ⚠️ 只收 `Mechanic`（封闭枚举），所以「不在词表里」不归它管 —— 那是 profile 差集的活。 */
export function deriveMechanicStatus(mechanic: Mechanic): MechanicStatus {
  if (DEPRECATED_MECHANICS.includes(mechanic)) return "deprecated";
  return RUNTIME_IMPLEMENTED_MECHANICS.includes(mechanic) ? "supported" : "experimental";
}

/** **QA probe** 见证（转录）：哪几条机制有**会过的运行时 probe**（票 15）。
 *  ⚠️ 与 `RUNTIME_IMPLEMENTED_MECHANICS` **不是一回事**（票 06 裁定）：`status` 是「运行时层」
 *   （有实现 ⇒ supported），probe 是**独立 QA 覆盖层**（行为级验证），**不进** `deriveMechanicStatus`。
 *  ⚠️ 事实性由 `packages/demo/probe/mechanic-probe.mjs` 保证：它读这张表，要求**每条都有 probe 且
 *   每条都过** —— 删掉一条 probe 实现、或某条 probe 在真 Chrome 里红了，`pnpm test:mechanic` 当场非 0。
 *   ⇒ 「声明了有 probe」与「probe 真过」由同一条命令钉住，不靠人记。 */
export const QA_PROBED_MECHANICS: readonly Mechanic[] = [
  "collect-pickup",
  "open-chest",
  "avoid-danger",
  "hazard-contact"
];

// ─────────────────────────────────────────────────────────────────────────────
// 二、`CAPABILITIES` —— 外壳能力（**机制以下的那一层**：输入、相机、坐标、碰撞）
//
// ⚠️ 与 `MECHANICS` 的分界：**机制是「这个游戏能玩出什么」，能力是「外壳能承载什么」**。
//   `§8 RuntimeProfile` 本来就把这两样分成两个数组（`mechanics` / `capabilities`），
//   这里与它对齐 —— 两两求差，得到两条独立的判据。
//
// ⚠️ **票 05（`RuntimeProfile`）必须采纳这一份，不许再立第二份**（票 03 Q4(b)）——
//   否则就是 `derivePackMode` 那种「写入侧与校验侧各写一份必然漂移」。
//   票 05 若发现这里漏了某一项，**改这个文件**，不要在自己的契约里另开一张表。
export const CAPABILITIES = [
  /** 键盘输入：方向键 + `A,D,W,S,SPACE`（`shell/scene.ts:69-70`）。 */
  "input:keyboard",
  /** 横向卷轴，纵向夹在视口内（`shell/scene.ts:64` 的 scrollY clamp）。 */
  "camera:side-scroll",
  /** 分层视差（`shell/scene.ts:109` 的 `setScrollFactor(l.parallax)`）。 */
  "camera:parallax",
  /** 轴对齐矩形碰撞（`game-config.ts:97` 的 `entityBox`）。 */
  "collision:aabb",
  /** 实体周期往复（`game-config.ts:49` 的 `Motion`）。 */
  "motion:cyclic",
  /** 收集后抵达终点（`game-config.ts:154` 的 `Objective`）。 */
  "objective:collect-then-reach",
  /** HUD 活在**屏幕空间**（`shell/scene.ts:216` 的 `setScrollFactor(0)`；契约见 `screen-space.ts`）。 */
  "hud:screen-space",
  /** 坐标一律**交付态像素、1:1、整数**（`CONTEXT.md:230`）。 */
  "coord:delivery-pixels"
] as const;

export const CapabilitySchema = z.enum(CAPABILITIES);
export type Capability = z.infer<typeof CapabilitySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 三、`INTENT_ENTITY_TYPES` —— 意图层实体的**桶名**
//
// ⚠️ 意图层只有**一个** `entities[]`（带 `type`），设计层拆成**四个数组**
//   （`enemies` / `npcs` / `interactables` / `resources`）。票 03 Q3 判 `type`
//   **必须是封闭枚举**，且与那四个数组**一一对应** —— 否则覆盖度的集合差**判得了
//   「丢了没有」，判不了「串桶了没有」**。
// ⚠️ 顺带解掉票 12：Asset Planner 要按类分派生成策略
//   （`03 §14` 的「角色 / 敌人 / 背景 / 复杂道具 / UI / 简单几何 / 碰撞体」），
//   类封闭了那边才好分派。
export const INTENT_ENTITY_TYPES = ["enemy", "npc", "interactable", "resource"] as const;

export const IntentEntityTypeSchema = z.enum(INTENT_ENTITY_TYPES);

/** **意图层的 `type` → 设计层的那个桶**（票 03 Q3 的「一一对应」落地成一个名字关系）。
 *  ⚠️ 住在这里是**故意的**：它是**名字**的关系，而这里就是名字的家（文件头）。
 *  在别处再写一份，就是「写入侧与校验侧各写一份必然漂移」那条老病
 *  （它此前散在 `vocabulary.test.ts` 的穷尽断言里，票 10 收上来）。
 *  ⚠️ `compile-design`（票 10）拿它判**意图的每个实体在设计里有没有对家** ——
 *  那是 R12 今天真正活着的那条拒绝。 */
export const ENTITY_BUCKETS: Record<IntentEntityType, "enemies" | "npcs" | "interactables" | "resources"> = {
  enemy: "enemies",
  npc: "npcs",
  interactable: "interactables",
  resource: "resources"
};

/** **桶名**（`enemies` / `npcs` / `interactables` / `resources`）。
 *  ⚠️ **从 `ENTITY_BUCKETS` 派生**（票 19），不新写一遍那四个字面量 ——
 *    否则桶名就有两张表，而它们必须一直相等（`game-design.ts` 那边还有第三处内联的清单，
 *    它是**遍历用**的，不是类型，见那张票的范围）。
 *  ⚠️ 它存在的理由：`auditIntentCoverage` 要说得出「它**本该**在哪个桶」（`bucket`）
 *    与「它**其实**在哪个桶」（`foundIn`）—— 那两个位置都需要一个名字。 */
export type EntityBucket = (typeof ENTITY_BUCKETS)[keyof typeof ENTITY_BUCKETS];
export type IntentEntityType = z.infer<typeof IntentEntityTypeSchema>;
