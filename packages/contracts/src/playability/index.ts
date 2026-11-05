// 可玩性内部桶（LP-01）。
//
// ⚠️ 这里**不**导出到 `packages/contracts/src/index.ts`：加法导出（C1）在 LP-05 才接线。
//   在此之前，判据与测试直接从 `playability/*` 取。
//
// ⚠️ `geometry.ts` 不从这里转出：`Size` / `Vec` 与 `game-config.ts` 的同名导出会撞。
//   需要 AABB 原语的调用方直接 import `./geometry.js`。

export * from "./profile.js";
export * from "./graph.js";
