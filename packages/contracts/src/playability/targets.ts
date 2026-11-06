// **可玩性目标集**（LP-02 抽出；LP-03/LP-04 共用）。
//
//   运行时把**每一个** pickup / chest 都算进胜利计数（`pickupCount`），goal 只认
//   `objective.gate`。目标几何一律走 `profile.ts`：
//     pickup / goal —— 帧几何（忽略 `body`）⇒ `partial`；
//     chest        —— `body ?? size` 再四边外扩 `range` ⇒ `checked`。
//
//   越界目标、缺失资源只记 gap，不在这里报；它们归 `auditGameConfig` / 引用族。

import type { GameConfig } from "../game-config.js";
import type { AssetPackManifest } from "../assetpack.js";
import type { Aabb } from "./geometry.js";
import type { GeometryCoverage } from "./profile.js";
import { FIXED_RUNTIME_PROFILE, chestInteractionBox, runtimeEntityGeometry } from "./profile.js";
import type { FixedRuntimeProfile } from "./profile.js";

export type TargetSubject = "PICKUP" | "CHEST" | "GATE";

export type PlayabilityTarget = {
  readonly id: string;
  readonly subject: TargetSubject;
  readonly rect: Aabb;
  readonly assetId: string;
  readonly frameBased: boolean;
  readonly coverage: GeometryCoverage;
};

export type TargetGap = { readonly missing: string; readonly target?: string };

export const TARGET_NOUN: Record<TargetSubject, string> = {
  PICKUP: "拾取物", CHEST: "宝箱", GATE: "终点",
};

export const formatRect = (r: Aabb): string => `x=${r.x}, y=${r.y}, w=${r.w}, h=${r.h}`;

const outOfWorld = (rect: Aabb, width: number, height: number): boolean =>
  rect.x < 0 || rect.y < 0 || rect.x + rect.w > width || rect.y + rect.h > height;

export function collectTargets(
  config: GameConfig,
  manifest: AssetPackManifest,
  profile: FixedRuntimeProfile = FIXED_RUNTIME_PROFILE,
): { targets: PlayabilityTarget[]; gaps: TargetGap[] } {
  const { w: width, h: height } = config.world.size;
  const targets: PlayabilityTarget[] = [];
  const gaps: TargetGap[] = [];

  for (const entity of config.entities) {
    if (entity.kind !== "pickup" && entity.kind !== "chest") continue;
    const geometry = runtimeEntityGeometry(entity, manifest, profile);
    if (!geometry) {
      gaps.push({ missing: "target-asset-missing", target: entity.id });
      continue;
    }
    // ⚠️ 越界看**实体盒**，不看 chest 的交互盒：`range` 合法地可以把交互区伸到世界外。
    if (outOfWorld(geometry.box, width, height)) {
      gaps.push({ missing: "target-out-of-world", target: entity.id });
      continue;
    }
    targets.push({
      id: entity.id,
      subject: entity.kind === "chest" ? "CHEST" : "PICKUP",
      rect: entity.kind === "chest" ? chestInteractionBox(geometry, entity.range ?? 0) : geometry.box,
      assetId: entity.asset,
      frameBased: geometry.source === "frame",
      coverage: geometry.coverage,
    });
  }

  const gate = config.entities.find((e) => e.kind === "goal" && e.id === config.objective.gate);
  if (!gate) {
    gaps.push({ missing: "gate-missing" });
  } else {
    const geometry = runtimeEntityGeometry(gate, manifest, profile);
    if (!geometry) {
      gaps.push({ missing: "target-asset-missing", target: gate.id });
    } else if (outOfWorld(geometry.box, width, height)) {
      gaps.push({ missing: "target-out-of-world", target: gate.id });
    } else {
      targets.push({
        id: gate.id, subject: "GATE", rect: geometry.box, assetId: gate.asset,
        frameBased: geometry.source === "frame", coverage: geometry.coverage,
      });
    }
  }

  return { targets, gaps };
}
