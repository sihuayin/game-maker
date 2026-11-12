# U3-06 测试矩阵与 D4 反例

Type: task
Status: resolved
Owner: claude (U3-06 session 2026-11-12)
Blocked by: 06
Map: ../map.md
Class: U3 / IMPLEMENTATION

## Task

收束 `packages/contracts/tests/playability-temporal-gate.test.ts` 的完整测试矩阵，覆盖 D4 §11 中由 R3 负责的反例。**不实现新语义。**

### 允许文件

- `packages/contracts/tests/playability-temporal-gate.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`）
- 若测试暴露白名单内实现缺陷：`packages/contracts/src/playability/temporal-gate.ts`（只修缺陷，不扩语义）

### 必须覆盖

1. **门区闭式**：`L/R/width` 公式；`width > ε` 两侧；`ε` 不进碰撞谓词。
2. **y 区间**：严格重叠 / 相切 / 不重叠。
3. **全周期覆盖**：`t = 0 / P/2 / P`、负时间、多周期；`periodCoverage.complete` 只能来自闭式。
4. **判侧**：左→右 / 右→左；精确 spawn 盒；`goalRegion = inflate(goalRect, 0.5)`；同侧 / 跨门 / 无法判侧 ⇒ `INCOMPLETE`。
5. **forbiddenInjection**：原始 `gateRect` 注入；`expandedRect` 只扩张一次；门顶不可站立；不可穿越；不使用整段扫掠区。
6. **D4 §11 反例（R3 范围：1–4、6、13）**，每条必须 `INCOMPLETE` / 拒绝，不得产生 `COMPLETE`：
   1. 门宽用 pad 或扫掠并集计算；
   2. 按相位格采样求交或只取上升段；
   3. 把整段扫掠区注入 `forbiddenBoxes`；
   4. 手工预扩张门、再经 `forbiddenBoxes` 扩张；
   6. 起点与目标同侧、目标跨门或起点不在严格一侧仍输出可升级结论；
   13. 把 Witness 的 lag pad 方向用到门区。
7. **确定性与公共面**：相同输入重复运行结果规范化序列化相等；模块无随机 / 时间依赖；无公共 barrel 导出；不新增依赖。
8. **架构断言**：T-55 / T-62 / T-64；`temporal-gate.ts` 不 import `temporal.ts` / `temporal-witness.ts`。

### 禁止

- 覆盖 U4 图割 / hop 双档；
- 修改 `playability-temporal-input.test.ts` 或既有测试；
- 新增 JSON fixture / 依赖 / 公共导出。

### 验收

`pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts` exit 0；R3 范围内的 6 条反例全部有断言；`pnpm build` / `pnpm typecheck` exit 0；diff 仅白名单文件。

## Answer

**完成。** 门区测试矩阵收束为 48 条，D4 §11 的 R3 范围反例（1–4、6、13）全部有断言；产品代码本票零改动。

| 项 | 结果 |
| --- | --- |
| 测试文件 | `packages/contracts/tests/playability-temporal-gate.test.ts`（48 条） |
| D4 §11 反例 | 1（pad / 扫掠并集门宽）、2（采样 / 只取上升段）、3（整段扫掠区注入）、4（预扩张再注入）、6（同侧 / 跨门 / 起点不严格在一侧）、13（Witness lag pad）均被拒绝或与闭式不符 |
| ε | 仅作门宽阈值；同一门宽在不同 ε 下 `L/R/width` 不变；模块不使用 `overlapsStrict` |
| 确定性与公共面 | 重复运行序列化相等；无 `Math.random` / `Date.now` / `performance.now`；无新依赖；无 barrel 导出 |
| 架构断言 | T-55 / T-62 / T-64 保持 ✓；不 import `temporal.ts` / `temporal-witness.ts` |
| `pnpm build` / `pnpm typecheck` | 退出码 **0** / **0** |
| 定向 gate 测试 | 退出码 **0**；**48 / 48 passed** |
| `playability-temporal-input.test.ts` | 退出码 **0**；**65 / 65 passed** |
| 白名单外改动 | **无**；STOP **未触发** |

注：首轮有 1 条新用例失败（ε 对比用例未同步移动目标，判侧按设计拒绝）；修的是测试而非产品代码。

证据：[`../evidence/06-tests.md`](../evidence/06-tests.md)。

**下游**：U3-07（回归 / 白名单审计 / 实现报告）已 **unblocked**。本票未启动 U3-07。
