# U4 / R4 输入包（供独立复核会话使用）

> 本包只提供**复核输入**：白名单、验收表、证据路径、测试命令与必要原始输入。
> 它**不包含**作者结论；所有验收项一律留空，由复核人自行判定 `PASS` / `FAIL` / `NOT_RUN`。

## 1. 复核对象

| 项 | 值 |
| --- | --- |
| 单元 | U4（I02-04：垂直规避图割） |
| 授权记录 | [`.scratch/level-playability-v1.1-i02/reports/05-u4-incremental-authorization.md`](../../level-playability-v1.1-i02/reports/05-u4-incremental-authorization.md) |
| `graph.ts` 独立审批 | [`.scratch/level-playability-v1.1-i02/reports/06-u4-graph-approval.md`](../../level-playability-v1.1-i02/reports/06-u4-graph-approval.md)（amber · 2026-11-12） |
| 授权包 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |
| U4 产品 diff 范围 | `b884a35b37548e7e686562eadef258d7d0fb9c2f..<R4 复核时 HEAD>`（`b884a35` = U4 并入已合并 i02 后的起点） |
| 上游 `graph.ts` | PR #37 合并 commit `2241e11`；产品 commit `13b4e3b`（U4 不再改动 `graph.ts`） |
| 正式报告落点 | `.scratch/level-playability-v1.1-i02/reports/R4-review.md` |

## 2. 白名单与文件 hash（复核时现场复算）

| 文件 | 性质 | sha256（U4-09 时点） |
| --- | --- | --- |
| `packages/contracts/src/playability/temporal-evasion.ts` | 新增（U4） | `09ca8c5907ed5e530f4c2395ed5854bfc90336f8e797518aed6fb28e499fe54f` |
| `packages/contracts/tests/playability-temporal-evasion.test.ts` | 新增（U4 / R4） | `3839288b33fe623b9c3f420767c6b92b741729fee1bc494f70078013ecc30817` |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | 既有 `TEST_ONLY` | 本单元未修改（`20b56290…2a2b481`） |
| `packages/contracts/src/playability/graph.ts` | 仅 PR #37 的 `HopSampling` 尾参 | `85346d6f…e0228b0` |

期望：U4 产品路径 diff **只有**前两个新增文件；`temporal.ts` / `reach.ts` / `docs/` / `fixtures/` 零 diff；无新依赖、无锁文件变更、无 JSON fixture、无公共 barrel 导出。

## 3. R4 验收表（复核人逐项填写）

来源：授权包 §9.4；另加输出边界与范围项。

| # | 验收项 | 通过条件 | 结论 |
| --- | --- | --- | --- |
| R4-01 | 图割判据 | 精确 spawn；无可达落脚点 / hop 弧采样盒覆盖 `goalRegion`；`midAirHits = 0` 只作否决；`verdict` 恒 `conditional` |  |
| R4-02 | hop 双档 | 60 / 120Hz 分别记录 `n` / 端点 / cap；两档各自完整检查；`F1 ⊆ F2`；**不要求** `n` 精确 2× |  |
| R4-03 | 反例 | D4 §11 的 5、7–12 全覆盖（1–4、6、13 不回归） |  |
| R4-04 | 模型闭合 | `movementModelClosure = "not-proven-air-control"`；公共 PU 仍 `BLOCKED` |  |
| R4-05 | `graph.ts` | 只有经独立审批的 `HopSampling` 尾参；默认行为回归通过 |  |
| R4-06 | 输出边界 | 未生成 / 伪造 `puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` / 完整 `PermanentGateProof` / `TemporalInternalResult` / `certificate` / 公共 Verdict |  |
| R4-07 | 范围 | 未实现 U5；未修改 `temporal.ts` / `reach.ts`；`temporal.ts` 零 diff |  |
| R4-08 | 独立验证 | 复核人自选 ≥2 条关键反例 + 1 条边界值，记录理由与结果 |  |

复核结论只写 `PASS` / `FAIL` / `NOT_RUN`；不得用总通过率替代逐项结论；未运行项不得推定通过。

## 4. 复核命令

```bash
pnpm build
pnpm typecheck
pnpm exec vitest run packages/contracts/tests/playability-temporal-evasion.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts
pnpm exec vitest run packages/contracts/tests/playability-graph.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts
pnpm test
```

另建议独立检查：

```bash
git diff --name-status b884a35..HEAD -- packages/ docs/ fixtures/
git diff --name-status 13b4e3b..HEAD -- packages/contracts/src/playability/graph.ts
git diff --name-only b884a35..HEAD -- '**/package.json' pnpm-lock.yaml '*.json'
grep -n "temporal-evasion" packages/contracts/src/playability/index.ts packages/contracts/src/index.ts
grep -nE "from \"" packages/contracts/src/playability/temporal-evasion.ts
```

## 5. 必要原始输入

| 输入 | 路径 |
| --- | --- |
| 冻结语义 D4 | [`.scratch/level-playability-v1.1-i02/issues/10-i02-d4-gate-graphcut.md`](../../level-playability-v1.1-i02/issues/10-i02-d4-gate-graphcut.md) §4–§7、§11 |
| 白名单 / DAG | [`.scratch/level-playability-v1.1-i02/issues/12-i02-d6-whitelist-layout.md`](../../level-playability-v1.1-i02/issues/12-i02-d6-whitelist-layout.md) §3、§5.2 |
| D9 契约 | `.scratch/level-playability-v1.1-i02/issues/15-i02-d9-internal-result-contract.md`；实现 `packages/contracts/src/playability/temporal-result.ts` |
| 授权包条款 | `docs/v7.8/移动-I02.md` §3.7 / §5.2 / §7.2 / §9.4 |
| `graph.ts` 尾参 | `packages/contracts/src/playability/graph.ts`（`HopSampling`） |
| 可达原语 | `packages/contracts/src/playability/reach.ts`（只读） |

## 6. 复核会话隔离

- 复核人必须未参与 U4 实现；
- **不得**读取 `.scratch/level-playability-v1.1-u4/reports/`、`.scratch/level-playability-v1.1-u4/map.md`、`.scratch/level-playability-v1.1-u4/issues/` 下除 R4 票外的任何票；
- 证据目录 `.scratch/level-playability-v1.1-u4/evidence/` 只作**原始输出对照**，不得作为结论依据；
- 不修改产品代码；不推送 / 建 PR / 合并；不把 R4 结论扩展为 U5 授权或公共能力。
