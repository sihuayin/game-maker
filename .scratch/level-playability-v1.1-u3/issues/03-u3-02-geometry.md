# U3-02 门区几何与闭式公式

Type: task
Status: open
Owner: —
Blocked by: 02
Map: ../map.md
Class: U3 / IMPLEMENTATION

## Task

实现 D4 §1 冻结的**门区闭式几何**与有效性判定。**不做周期覆盖、判侧或注入。**

### 允许文件

- `packages/contracts/src/playability/temporal-gate.ts`
- `packages/contracts/tests/playability-temporal-gate.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`）

### 必须完成

1. 闭式公式（D4 §1.1）：
   ```text
   p(θ) = at + d·k(θ/P)，θ ∈ [0, P)
   gateRect = [L, R] × [hazY, hazY + hazH]
   L = at + d − anchorX·w
   R = at + (1 − anchorX)·w
   width = R − L = w − d
   ```
   `w` / `anchorX` / `hazY` / `hazH` 来自冻结的 manifest 几何输入；`at` / `d` / `P` 来自 `TriangleMotion`。连续核心使用**未取整**位置（D2）。
2. 有效性判定：
   - `width > ε`；`ε` 只用于门宽 / 显式区间阈值，不进碰撞谓词；
   - 门矩形 y 区间与玩家盒 y 区间**严格重叠**，否则该 Hazard 不可能挡住玩家 ⇒ `INCOMPLETE` + `no-permanent-gate`；
   - 非法周期 / 非有限数值 / 非法几何 ⇒ `INCOMPLETE`，原因取 D9 闭集（`no-permanent-gate` 或 `geometry-untrusted`）；不得静默修复。
3. 门区**不加 Witness 的 lag pad**；不得用整段扫掠区、不得预扩张、不得把「某时刻经过」当成「永久覆盖」。
4. 有效时返回 `gate` 与 `gateStatus: "COMPLETE"`；其余半部字段允许暂为 `null`（由后续票填充），但必须保持类型诚实。
5. 定向测试：`L/R/width` 公式；ε 两侧（恰好等于 / 略大 / 略小）；y 严格重叠 / 相切 / 不重叠；非法周期与非有限值。

### 禁止

- 用采样、子周期或区段并集代替闭式；
- 加任何 lag pad 或预先扩张门；
- 计算图割 / hop / 完整证书；
- 修改 `graph.ts` / `reach.ts` / `temporal.ts`。

### 验收

`pnpm build` / `pnpm typecheck` exit 0；新增定向测试通过；门宽与有效性的边界两侧均有断言；失败只使用 D9 闭集原因码；diff 仅白名单文件。

## Answer

（resolved 时填写）
