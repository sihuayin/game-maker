// 视觉理解：**风格参考图 → `VisualWorldSpec`**（票 08）。
//
// 落点与决定：`../../../.scratch/game-maker-v2/issues/08-vision-analyze-reference.md`
// 与地图的 `R15` / `R16` / `R16`。
//
// ⚠️ 本包**只依赖 `contracts`**（R11 / `scripts/check-deps.mjs`）—— 所以 I/O 是自己写的，
//   而 `packages/assets` 的 `prompt.ts` / `review.ts` 够不着（那是**反方向**的那一半：它们把
//   `StyleSpec` 转成生成提示词，本包把参考图转成 `VisualWorldSpec`）。
export * from "./prompts.js";
export * from "./build-visual-world.js";
export * from "./analyze-reference.js";
