// **可达性**（QA 单层空间入口）—— 这一关从出生点出发，必需目标够不够得到。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、它是**一条判据**，不是「难度」那种观察
//
//   `CONTEXT.md` 的门槛是「**精确可算 + 错了一定不是设计**」。终点 / 拾取物 / 宝箱够不到
//   **错的一定不是设计** —— 没有哪一种设计意图能把「这一关走不通」变成对的。
//   ⚠️ 难度、路线好不好、危险物躲不躲得开一律不在里面。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、移动模型 = LP-01 的共享移动图（LP-05 起）
//
//   `playability/graph.ts` / `reach.ts`：walk / walk-off / fall / 真实抛物线 hop；
//   solid 按运行时静态原位；hazard 当空气；下落不设限；脚点 + 严格 AABB。
//   ⇒ 可达集是玩家能力的**上界** ⇒ 「不在里面」才是可靠的那半句话。
//   它**只报不可达 / 完全封死**，从不报「可达」。
//
//   目标集 = 全部 pickup + chest + `objective.gate`（与 `pickupCount` / `tryWin` 同源）。
//   chest 用 `body ?? size` 四边外扩 `range`；pickup / gate 用帧几何（忽略 `body`）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、出生点非法 / 引用缺口不在这里报
//
//   出生点附近没有落脚点 ⇒ 不报（归 `auditGameConfig` 的自洽族）；
//   玩家资源解不到 ⇒ 不报（引用族）；目标资源缺失 / 越界 / gate 缺失 ⇒ 跳过。
//   ⚠️ 这不是「漏报」，是 Ownership：同一件事只在一个地方说。
import { maxJumpHeight, playerMoveOf } from "./game-config.js";
import type { ConfigIssue, GameConfig } from "./game-config.js";
import type { AssetPackManifest } from "./assetpack.js";
import { buildMovementGraph } from "./playability/graph.js";
import { assessReachability, blockedBySolids } from "./playability/reach.js";
import { collectTargets } from "./playability/targets.js";

/**
 * **这一关通不通** —— 从出生点出发，gate / 每个 pickup / 每个 chest 够不够得到。
 *
 * @returns 逐条**够不到 / 完全封死**的实体（`where` 是 `entity "<id>"`，与 `auditGameConfig`
 *          同一套人话）；一条都没有 = 通。⚠️ 它**不是**一份可达性报告，只报那半边坏消息。
 */
export function auditReachability(config: GameConfig, manifest: AssetPackManifest): ConfigIssue[] {
  const move = playerMoveOf(config);
  const graph = buildMovementGraph(config, manifest);
  if (!graph) return [];                       // 玩家资源解不到 ⇒ 引用族负责

  const { targets } = collectTargets(config, manifest);
  const reach = assessReachability(graph, move, targets);
  if (reach.seeds.length === 0) return [];     // 出生点非法 ⇒ 自洽族负责

  const apex = maxJumpHeight(move);
  const out: ConfigIssue[] = [];
  for (const [i, target] of targets.entries()) {
    if (reach.covered.has(i) || reach.midAir.has(i)) continue;
    const block = blockedBySolids(graph, target.rect);
    out.push({
      severity: "error",
      where: `entity "${target.id}"`,
      message: block.blocked
        ? `这个${target.subject === "CHEST" ? "宝箱" : target.subject === "GATE" ? "终点" : "拾取物"}的交互区完全落在实心体内：` +
          "玩家盒在任何一个不撞墙的位置都无法与它相交。"
        : `够不到 —— 从出生点出发，用**最宽的能力上界**都到不了它（跳跃顶点 ${apex.toFixed(1)}px · 跑速 ${move.speed}px/s · ` +
          "危险物当空气 · 下落不设限）。⚠️ 这条只报「到不了」：没有哪一种设计意图能把「走不通」变成对的。" +
          "要去的地方：地形 / 这一关的布局（不是再抽一次奖）。",
    });
  }
  return out;
}
