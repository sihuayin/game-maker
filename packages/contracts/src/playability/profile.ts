// Runtime geometry profile（LP-01）—— **LP-00 复核后**的唯一碰撞语义入口。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、它为什么存在（LP-00 复核裁定，2026-11-05 PASS WITH BOUNDARIES）
//
//   四个 Runtime 事实已经用源码钉住（`../research/01-runtime-semantics.md`）：
//
//     P1  纯层盒 = entityBox(at, body ?? size, manifest.anchor)
//     P2  solid / chest / danger 吃 `body`；pickup / hazard / goal 忽略 `body`
//     P3  chest 交互盒 = 实体盒**四边**外扩 `range`，与玩家 AABB **严格**相交
//     P4  Runtime **没有**出生点专用处理 —— 不得把「重叠会被推出」写成确定性假设
//
//   ⇒ 判据不得各写一套；所有空间判据都从这里取几何。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、coverage 的诚实口径
//
//   `body` 系（solid / chest / danger）的几何直接来自 manifest ⇒ `checked`。
//   `frame` 系（pickup / hazard / goal）的物理体由 Phaser 按**图集帧**创建；
//   审计输入看不到图集 JSON，帧尺寸 / 帧锚点 == manifest 标称值这条等式**不在 schema 里**，
//   只由 pack acceptance 保证 ⇒ `partial`。玩家是动画精灵，body 位置同样跟帧 origin 走
//   ⇒ `partial`。`partial` 不阻止确定性阻断，但会在没有阻断时把 verdict 拉向
//   `INSUFFICIENT_EVIDENCE`（聚合规则在 LP-02 / LP-05）。
//
//   ⚠️ 绝不能因为「资源标称尺寸对」就推断「每一帧碰撞几何都对」。

import { FALLBACK_ANCHOR, entityBox } from "../game-config.js";
import type { EntityKind, GameConfig, GameEntity } from "../game-config.js";
import type { AssetPackManifest } from "../assetpack.js";
import type { Aabb, Size, Vec } from "./geometry.js";
import { expandBox, overlapsStrict } from "./geometry.js";

export type CollisionSource = "body" | "frame" | "none";
export type GeometryCoverage = "checked" | "partial" | "not-checked";
export type SolidMotionModel = "static-origin" | "swept";

export type FixedRuntimeProfile = {
  readonly id: string;
  /** 每个 EntityKind 的碰撞几何来源。`none` = 没有碰撞（decor）。 */
  readonly collisionSource: Readonly<Record<EntityKind, CollisionSource>>;
  readonly chestInteraction: {
    readonly expansion: "four-sides";
    readonly overlap: "strict";
  };
  /** LP-00 复核后的模型修正：solid 的 `motion` 按**原始位置**静态处理。 */
  readonly solidMotion: SolidMotionModel;
};

export const FIXED_RUNTIME_PROFILE: FixedRuntimeProfile = {
  id: "platformer/v1",
  collisionSource: {
    solid: "body", chest: "body", danger: "body",
    pickup: "frame", hazard: "frame", goal: "frame",
    decor: "none",
  },
  chestInteraction: { expansion: "four-sides", overlap: "strict" },
  solidMotion: "static-origin",
};

export type RuntimeGeometry = {
  readonly box: Aabb;
  readonly source: Exclude<CollisionSource, "none">;
  readonly coverage: GeometryCoverage;
};

export type RuntimePlayerGeometry = {
  readonly size: Size;
  readonly anchor: Vec;
  readonly foot: Vec;
  readonly coverage: GeometryCoverage;
};

const assetOf = (manifest: AssetPackManifest, id: string) =>
  manifest.assets.find((a) => a.id === id);

/** 脚点 = 盒子底边中点（`at` 是锚点落点，不是脚点）。 */
export const footOf = (at: Vec, size: Size, anchor: Vec): Vec => ({
  x: at.x + (0.5 - anchor.x) * size.w,
  y: at.y + (1 - anchor.y) * size.h,
});

/** 实体在 Runtime 语义下的碰撞几何。资源解不到返回 `null`（归引用族，不在这里报）。 */
export function runtimeEntityGeometry(
  entity: GameEntity,
  manifest: AssetPackManifest,
  profile: FixedRuntimeProfile = FIXED_RUNTIME_PROFILE,
): RuntimeGeometry | null {
  const source = profile.collisionSource[entity.kind];
  if (source === "none") return null;
  const asset = assetOf(manifest, entity.asset);
  if (!asset) return null;
  const size = source === "body" ? entity.body ?? asset.size : asset.size;
  const anchor = asset.anchor ?? FALLBACK_ANCHOR;
  return {
    box: entityBox(entity.at, size, anchor),
    source,
    coverage: source === "frame" ? "partial" : "checked",
  };
}

/** 玩家几何。`body` 尺寸来自 manifest；body 位置跟动画帧 origin 走 ⇒ `partial`。 */
export function runtimePlayerGeometry(
  config: GameConfig,
  manifest: AssetPackManifest,
): RuntimePlayerGeometry | null {
  const asset = assetOf(manifest, config.player.asset);
  if (!asset) return null;
  const anchor = asset.anchor ?? FALLBACK_ANCHOR;
  return {
    size: asset.size,
    anchor,
    foot: footOf(config.player.at, asset.size, anchor),
    coverage: "partial",
  };
}

/** chest 交互盒 = 实体盒四边各外扩 `range`（P3）。 */
export function chestInteractionBox(geometry: RuntimeGeometry, range: number): Aabb {
  return expandBox(geometry.box, range);
}

/** 玩家盒子与 chest 交互盒**严格**相交；不要求玩家落地（P3）。 */
export function chestInteractable(
  playerBox: Aabb,
  geometry: RuntimeGeometry,
  range: number,
  profile: FixedRuntimeProfile = FIXED_RUNTIME_PROFILE,
): boolean {
  if (profile.chestInteraction.expansion !== "four-sides") return false;
  return overlapsStrict(playerBox, chestInteractionBox(geometry, range));
}
