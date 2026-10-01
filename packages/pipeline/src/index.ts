// ⚠️ **骨架，尚未实现。**
//
// 这一包要做的事在
// `../../../.scratch/game-maker-v2/issues/15-pipeline-create-game.md`
// —— 那才是有消费者的地方；这里空空如也**是有意的**。
//
// 它现在存在的唯一理由：让 `scripts/check-deps.mjs` 与根 `tsconfig.json` 能**先表态**
// （见票 07 的 Answer —— 那个守卫是**双向**的，图和 `packages/` 必须时刻同步），
// 从而下游那张票写代码时不必再碰构建管线。
export {};
