# U3-02 门区几何与闭式公式

Type: task
Status: resolved
Owner: claude (U3-02 session 2026-11-12)
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

**完成。** 门区闭式几何与有效性判定就位；周期覆盖 / 判侧 / 注入仍未实现。

| 项 | 结果 |
| --- | --- |
| 闭式 | `L = at + d − anchorX·w`、`R = at + (1 − anchorX)·w`、`width = w − d`、`y = at.y − anchorY·h`、`height = h` |
| 有效条件 | `width > ε` 且 Hazard y 区间与玩家盒 y 区间**严格重叠**（相切不算） |
| ε 域 | `[at.x, at.x + d]`（锚点全周期行程）；不用门宽自身作标尺，否则阈值恒真 |
| 失败分类 | 非有限 / 非法周期 / 非法几何 ⇒ `geometry-untrusted`；`width ≤ ε` / y 不相交 ⇒ `no-permanent-gate` |
| 无 pad | 门区取恒覆盖核心，不等于扫掠区，不带宽高 pad、不预扩张 |
| 有效输出 | `gate` + `gateStatus: "COMPLETE"`；其余半部 `null` |
| `pnpm build` / `pnpm typecheck` | 退出码 **0** / **0** |
| 定向 gate 测试 | 退出码 **0**；**17 / 17 passed** |
| `playability-temporal-input.test.ts` | 退出码 **0**；**65 / 65 passed**；架构断言保持 ✓ |
| 白名单外改动 | **无**；STOP **未触发** |

证据：[`../evidence/02-geometry.md`](../evidence/02-geometry.md)。

**下游**：U3-03（全周期覆盖）已 **unblocked**。本票未启动 U3-03。
