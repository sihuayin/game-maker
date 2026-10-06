// 意图理解、设计编译与角色基因：**需求 → `GameIntentSpec` → `GameDesignSpec` → `CharacterDNA`**
// （票 09 / 票 10 / 票 31）。
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
//   · 设计那一半（票 10）**有** —— 三个照抄值 + R12 的拒绝，落在 `build-design.ts`（纯、可单测）；
//   · 角色基因那一半（票 31）**也有** —— 但**一个注入都没有**：两条检查（构造性 gate + 守门人）
//     落在 `build-character-dna.ts`（纯、可单测）。⚠️ 与票 09 的「干净」同款，理由却相反（见那个文件头）。
export * from "./prompts.js";
export * from "./build-design.js";
export * from "./analyze-intent.js";
export * from "./compile-design.js";
export * from "./build-character-dna.js";
export * from "./compile-character-dna.js";
