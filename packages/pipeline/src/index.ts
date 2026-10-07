// **端到端流水线**：一条 `create` 链串起来（票 15）。
//
// ⚠️ 本包是**唯一**把新包串起来的地方（R11 的依赖图）—— 而它**够不着 `demo`**：
//   **站点装配不在这一层**（它归 CLI / MCP，票 16）。
//
// ⚠️ 三个模块各管一件事，别混：
//   · `run.ts`      —— **一次运行的生命周期**（`RunHandle` + 三次状态转移 + 版本分配）；
//   · `artifacts.ts`—— `run/v<N>/` 里那九项的**写与读**（序列化只此一处）；
//   · `create-game.ts` —— 两段（理解 / 构建）与 `createGame` 的串联。
export * from "./run.js";
export * from "./artifacts.js";
export * from "./create-game.js";
