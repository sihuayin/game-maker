# U2-02 wait / move、S1–S4 与预算计数

Type: task
Status: open
Owner: claude (U2-02 session 2026-11-12)
Blocked by: 02
Map: ../map.md
Class: U2 / IMPLEMENTATION

## Task

实现状态转移与四条验证义务。**不做 U9 / W / Witness 编码。**

### 允许文件

- `packages/contracts/src/playability/temporal-witness.ts`（只增）
- 只读引用：`temporal-motion.ts`、`temporal-budget.ts`、`temporal-result.ts`、`geometry.ts`、`graph.ts`

### 必须实现

- **状态**：`(footX, k)`；`wait(x,k) → (x,(k+1) mod N)`；`move(x,k) → (x',(k+1) mod N)`，恒速线性，`|x'−x|/dt ≤ maxSpeed`，方向任意。
- **S1**：`move` 对 `graph.solids` 做静态连续检查——玩家盒 x 线性移动，任一正宽度重叠 ⇒ 失败；**不得只查端点 `standable`**。
- **S2**：按折返点切段 + `lagPad`，调用 motion 的解析连续求交；任意正宽度碰撞区间 ⇒ 失败；相切不算撞；ε 不进碰撞谓词。
- **S3**：区间恰为一个相位格；时间 / 相位连续、可达；不得跨格。
- **S4**：`t1_prev = t0_next`、`x1_prev = x0_next`、相位格恰好 +1 (mod N)、玩家 y 与盒定义不变。
- **残差等待**：每个 `C_k` 从 `φ0` 到 `(k+1)·dt` 的整格保守验证（跨折返点切段），不得只查端点；`symbolic: true`。
- **预算**：`statesEnqueued` / `statesVisited` / `edgesChecked`；`maxStates` / `maxEdges` / `maxCutsPerBranch`（`segmentsTotal`）；wall-clock 只 abort；耗尽 ⇒ IE，不得输出部分 witness。
- 确定性排序；不得依赖 `Set` / 对象键枚举 / 墙钟。

### 禁止

- U9 / W 证书；Witness 编码；修改 budget / result / `temporal.ts`；测试文件；公共导出。

### 验收

`pnpm build` / `pnpm typecheck` 通过；diff 只含 `temporal-witness.ts`；S1–S4 失败语义只产生无效转移，不抛未处理异常。
