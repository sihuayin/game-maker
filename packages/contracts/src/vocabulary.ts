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
//   **外壳能力的事实投影**，不是一张许愿单）。它比想象的小得多 —— 四条构造，八个机制：
//
//     EntityKind = "solid" | "pickup" | "hazard" | "goal" | "decor"   game-config.ts:40
//     Motion     = { kind: "cycle", axis, distance, periodMs }         game-config.ts:49
//     PlayerMove = { speed, jumpVelocity, gravity }                    game-config.ts:105
//     Objective  = { kind: "collect-then-reach" }                      game-config.ts:154
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
  "reach-goal"
] as const;

export const MechanicSchema = z.enum(MECHANICS);
export type Mechanic = z.infer<typeof MechanicSchema>;

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
export type IntentEntityType = z.infer<typeof IntentEntityTypeSchema>;
