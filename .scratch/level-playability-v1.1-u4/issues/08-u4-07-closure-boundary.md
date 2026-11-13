# U4-07 模型闭合、降级映射与输出边界

Type: task
Status: resolved
Owner: claude (U4-07 session 2026-11-13)
Blocked by: 07
Map: ../map.md
Class: U4 / IMPLEMENTATION

## Task

收束 `movementModelClosure`、降级原因映射与 U4 输出边界。**不组装 U5 字段或完整证书。**

### 允许文件

- `packages/contracts/src/playability/temporal-evasion.ts`
- `packages/contracts/tests/playability-temporal-evasion.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`（仅在确需时）

### 必须完成

1. `movementModelClosure` 固定为 `"not-proven-air-control"`；模块注释与证据引用 `scene.ts:89`、`graph.ts` hop 弧、`reach.ts` midAir、walk-off 的模型缺口。
2. 模型闭合失败 ⇒ `INCOMPLETE` + `movement-model-unclosed`；**不得**把图割不连通写成 Runtime 不可达。
3. 降级原因映射按地图 Notes 冻结执行；同一输入的主原因必须确定（固定判定顺序），不新增原因码、不修改 D9 闭集。
4. 输出边界：
   - 运行时输出键**恰好**为 `graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure` / `status` / `reason`；
   - **不得**出现 `puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` / `certificate` / `internalResult` / `publicCapability` / 完整 `PermanentGateProof`；
   - 不导出公共 barrel；不写公共 Verdict。
5. 结构性断言：D4 反例 11（不得把图割不连通写成 Runtime 不可达）与反例 12（`coverage.partial` / 模型未闭合时不得发布 PU）以注释 + 测试形式落地；生产 PU 与 `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`。
6. `hopSamplingCoverage.covered` 只在全部弧 `F1 ⊆ F2` 时为 `true`；否则 `method: "insufficient"`。
7. 测试：输出键形状、原因映射、模型闭合字段、无反例 11/12 的虚构字段。

### 禁止

- `puConditions` / `geometryCoverage` / `lagMode` / 完整证书；
- 公共导出 / barrel / Verdict；
- 修改 `reach.ts` / `graph.ts` / `temporal.ts` / D9 类型。

### 验收

定向 evasion 测试通过；build / typecheck exit 0；输出键形状断言通过；diff 仅白名单文件。

## Answer

（resolved 时填写）

## Answer

**完成。** 模型闭合声明、降级原因优先级与 U4 输出边界已收束。

| 项 | 结果 |
| --- | --- |
| `movementModelClosure` | 恒为 `"not-proven-air-control"`（D9 冻结），与 `status` / `reason` 无关 |
| 证据链 | `scene.ts:89` 空中水平控制、`graph.ts` hop 恒速弧、`reach.ts` 60Hz mid-air、`walk-off` 无水平漂移 |
| 主降级原因 | 固定优先级：图割否决 / 任一档可达 ⇒ `graph-cut-incomplete`；cap ⇒ `hop-sample-budget`；覆盖/不一致 ⇒ `hop-doubling-changed`；全成立 ⇒ `COMPLETE` + `null` |
| `movement-model-unclosed` | 保留码；U4 不主张 Runtime 不可达，当前不产生该路径 |
| 输出边界 | 运行时恰六键；无 `puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` / `certificate` / `internalResult` / `publicCapability` |
| `pnpm build` / `pnpm typecheck` | 退出码 **0** / **0** |
| 定向 evasion 测试 | 退出码 **0**；**29 / 29 passed** |
| graph + gate + input | 退出码 **0**；**124 / 124 passed** |
| `pnpm test` | 退出码 **0**；**175 / 175 files，2824 / 2824 tests passed** |

覆盖反例 11（不得写成 Runtime 不可达）与反例 12（模型未闭合 / coverage partial 不发布 PU）。

证据：[`../evidence/07-closure-boundary.md`](../evidence/07-closure-boundary.md)。

**下游**：U4-08（测试矩阵与 D4 反例 5、7–12）已 **unblocked**。本票未启动 U4-08。
