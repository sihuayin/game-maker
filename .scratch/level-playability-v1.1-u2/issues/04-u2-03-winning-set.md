# U2-03 全相位 Winning Set 与终止性

Type: task
Status: open
Owner: claude (U2-03 session 2026-11-12)
Blocked by: 03
Map: ../map.md
Class: U2 / IMPLEMENTATION

## Task

在 1D 走廊 × N 相位格上求最小不动点，并提取严格递减 rank 的策略。**不做 U9。**

### 必须实现

- `W = μX.(Goal ∪ Pre∃(X))`；只用 `wait` / `move` 与已实现的 S1–S4 安全边。
- 状态 `(x_i, k)`：`x_i` 在走廊栅格（`xStep = 1`，并入 spawn / goal 的 x）；后继相位 `(k+1) mod N`；`|Δx| ≤ maxSpeed·dt`。
- **全部 N 个半开相位格**覆盖；每格先验证 spawn 残差等待（U2-02），再搜索。
- 反向 BFS / 队列求**最小**不动点；每个状态记录有限 rank（到 goal 的步数）；策略只选 rank **严格递减**的后继。
- 终止性：有限完整轨迹或严格递减 rank；仅有逐边安全不足。
- 失败语义：未覆盖全部格 ⇒ IE `winning-set-failed`；预算耗尽 ⇒ IE；**绝不推 PU**。
- 确定性：固定遍历顺序、稳定排序、去重；不依赖 `Set` 枚举顺序。
- 输出：W 状态（complete / failed / insufficient）、policy / rank、覆盖计数、预算计数。

### 禁止

- U9；Witness 编码 / 体积；修改其它文件；测试文件（U2-06 负责）；公共导出。

### 验收

`pnpm build` / `pnpm typecheck` 通过；W 的最小不动点与 rank 语义由 U2-06 测试验证；diff 只含 `temporal-witness.ts`。
