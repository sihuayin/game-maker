// 意图理解与设计编译：**需求 → `GameIntentSpec` → `GameDesignSpec`**（票 09 / 票 10）。
//
// 落点与决定：`.scratch/game-maker-v2/issues/09-intent-analyzer.md` 与 `.../10-design-compiler.md`，
// 以及地图的 `R7`（① 档欠条）/ `R12`（构建期拒绝）/ `R16`（结构化调用）。
//
// ⚠️ 本包**只依赖 `contracts`**（R11 / `scripts/check-deps.mjs`）——
//   所以 I/O 是自己写的（见 `analyze-intent.ts` / `compile-design.ts` 的文件头），
//   而 `packages/vision` 与 `packages/assets` 都够不着（几个新包**彼此不依赖**）。
//
// ⚠️ 两半的分界也是**两票的分界**：
//   · 理解那一半（票 09）**没有装配步** —— `GameIntentSpec` 没有一个字段是调用方才知道的；
//   · 设计那一半（票 10）**有** —— 三个照抄值 + R12 的拒绝，落在 `build-design.ts`（纯、可单测）。
export * from "./prompts.js";
export * from "./build-design.js";
export * from "./analyze-intent.js";
export * from "./compile-design.js";
