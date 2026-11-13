# U4-08 测试矩阵与 D4 §11 反例 5、7–12

Type: task
Status: resolved
Owner: claude (U4-08 session 2026-11-13)
Blocked by: 08
Map: ../map.md
Class: U4 / VERIFICATION

## Task

收束 U4 测试矩阵，逐条覆盖 D4 §11 的 **5、7、8、9、10、11、12**；并确认 1–4、6、13 不回归（U3 / R3 已覆盖）。**产品代码原则上零改动**；若测试暴露实现缺陷，先修缺陷并在 Answer 中逐条说明。

### 允许文件

- `packages/contracts/tests/playability-temporal-evasion.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`（仅在确需时）
- `packages/contracts/src/playability/temporal-evasion.ts`（仅修复测试暴露的缺陷）

### 必须完成

1. 每条反例一个具名测试：
   - **5**：目标区域必须使用已外扩 0.5px 的 `goalRegion`；构造仅在外扩带内相交的边界用例，未外扩则漏判 ⇒ 必须失败；
   - **7**：`midAirHits = 0` 不得作为正面证明（只允许进入 hop 检查）；
   - **8**：精确 spawn 脚点格，不得用 `startCells()` 宽松种子；
   - **9**：必须两档都跑且比较完整可达性，只跑倍档 / 只比单边 ⇒ 失败；
   - **10**：`n_double === 2·n_prime` 不得作为通过条件（`Tf = 1.2` 一类反例）；
   - **11**：不得把图割不连通写成 Runtime 不可达；`movementModelClosure` 固定；
   - **12**：`coverage.partial` / 模型未闭合时不得发布 PU；模块无公共能力字段。
2. 覆盖主路径：不可达 / 可达 / midAir 否决 / cap 绑定 / 双档不一致 / `F1 ⊆ F2` 正反例 / 输出形状 / 原因闭集。
3. 确认 U3 反例 1–4、6、13 的 gate 测试仍通过（不修改 gate 文件）。
4. 复跑：
   ```bash
   pnpm build
   pnpm typecheck
   pnpm exec vitest run packages/contracts/tests/playability-temporal-evasion.test.ts
   pnpm exec vitest run packages/contracts/tests/playability-graph.test.ts
   pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts
   pnpm test
   ```
5. 写证据 `.scratch/level-playability-v1.1-u4/evidence/08-tests.md`（测试名清单 ↔ 反例编号矩阵、退出码、计数）。

### 禁止

- 放宽或删除既有断言；
- 修改 `reach.ts` / `graph.ts` / `temporal.ts` / 既有测试文件；
- 新增白名单外文件。

### 验收

7 条反例均有具名断言；定向与全量测试 exit 0；产品改动仅限测试暴露缺陷（如无则零改动）；白名单外零 diff。

## Answer

（resolved 时填写）

## Answer

**完成。** D4 §11 的 U4 反例（5、7–12）逐条落成具名测试；U3 的 1–4、6、13 不回归。**产品代码零改动。**

| 项 | 结果 |
| --- | --- |
| 反例 5 | `goalRegion` 未外扩 ⇒ `goalIntersections=0`；外扩 0.5px 后 `=1` |
| 反例 7 | `midAirHits=1` 只作否决，`verdict` 仍 `conditional` |
| 反例 8 | 精确 spawn，`evidence` 记录 `seeds=1` |
| 反例 9 | 两档都跑；`connectivityPreserved=false`，端点分别审计 |
| 反例 10 | 判据为 `F1 ⊆ F2`；`(6,18)` 覆盖、`(7,13)` 不覆盖 |
| 反例 11 | 代码无 Runtime 不可达主张 |
| 反例 12 | 无 `certificate` / `publicCapability` / `puConditions` |
| U3 反例 1–4、6、13 | gate **48 / 48**，未回归 |
| `pnpm build` / `pnpm typecheck` | 退出码 **0** / **0** |
| 定向 evasion 测试 | 退出码 **0**；**36 / 36 passed** |
| gate + graph + input | 退出码 **0**；**124 / 124 passed** |
| `pnpm test` | 退出码 **0**；**175 / 175 files，2831 / 2831 tests passed** |
| 产品代码改动 | **无**（仅测试文件） |

证据：[`../evidence/08-tests.md`](../evidence/08-tests.md)。

**下游**：U4-09（回归 / 白名单审计 / R4 输入包）已 **unblocked**。本票未启动 U4-09。
