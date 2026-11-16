# U4 独立复核输入包（decision A amended code）

> **本文件只列事实与可复跑命令，不含作者结论 / PASS 声明。**
> 复核人必须自己读 diff、重跑命令、逐项判断。

## 1. 复核对象

| 项 | 值 |
| --- | --- |
| 单元 | U4（assets `runTemporalAudit` 接真实分析并产出证据） |
| 授权记录 | `.scratch/level-playability-v1.1-i03-impl/reports/U4-incremental-authorization.md` |
| **U4 brief 修订** | `.scratch/level-playability-v1.1-i03-impl/reports/U4-brief-amendment-01.md`（用户裁定 A） |
| 单元 brief | `.scratch/level-playability-v1.1-i03-impl/issues/04-i03-impl-u4.md`（Q3/Q4 由 amendment 取代） |
| 授权包 | `docs/v7.8/移动-I03.md` · 签署前 `2f89d572…` / 签署后 `f45332be…`（U1/U2 Ledger 后当前 `32152c01…`） |
| 独立审查报告 | `.scratch/level-playability-v1.1-i03/reports/I03-review.md` · `40af4b4b…` |
| Base | `a0688be` |
| **Product code/test head** | **`ce6ce63`** |
| Code/test diff range | `a0688be..ce6ce63` |
| 环境 | 见 `evidence/U4/commands.log`（OS / Node / pnpm） |

## 2. 改动文件（code/test diff，3 个）

| 文件 | 操作 |
| --- | --- |
| `packages/assets/src/ops.ts` | `runTemporalAudit`：real path 仅 `existingAudit` 存在时运行；create-game legacy-only；`TemporalAuditReport` |
| `packages/assets/tests/ops.test.ts` | 真实接线（传 existingAudit）/ legacy-only / 失败 / 确定性 / 兼容性 |
| `packages/contracts/tests/playability-temporal-input.test.ts` | **仅 T-58** |

只读 / 未修改：`temporal.ts` / `temporal-result.ts` / U1 / U2 / `publish-gate.ts` / `mechanic.ts` / `create-game.ts` / fixtures。

## 3. 可复跑命令

```bash
pnpm exec vitest run packages/assets/tests/ops.test.ts packages/assets/tests/compile-runtime.test.ts packages/contracts/tests/playability-temporal-input.test.ts
pnpm test
pnpm build
pnpm check:deps
pnpm check:links
```

退出码与输出摘要见 `evidence/U4/commands.log`、`evidence/U4/test-output.txt`、`evidence/U4/targeted-test-output.txt`。

## 4. 回滚演练

- `evidence/U4/rollback-drill.log`：drill 分支 `wayfinder/i03-u4-rollback-drill-2`，从 `ce6ce63` revert 回 base `a0688be`，跑全量 `pnpm test`；记录命令 / 退出码 / 输出。
- 复核人应核对 drill 分支与 delivery 分支隔离，delivery 未被 drill 污染。

## 5. 复核人必须独立完成

1. 现场核对授权包 / 审查报告 / U4 授权记录 / amendment 完整 hash；核对 `evidence/U4/SHA256SUMS`。
2. 检查 `a0688be..ce6ce63` code/test diff 是否逐文件落在 U4 白名单；U1 / U2 / U5 / U3 / `create-game` / `publish-gate` / `mechanic.ts` / `temporal.ts` / `temporal-result.ts` / fixtures 零 diff。
3. 逐项检查：
   - **decision A**：无 `existingAudit` ⇒ legacy-only（不跑真实 analyzer、不跑 auditPlayability）；有 `existingAudit` ⇒ 真实路径；
   - legacy `auditPlayabilityTemporal` + `stubTemporalAnalyzer` 保留；T-57 未改；T-58 仅新增真实 analyzer 恰一次；T-61 三处调用者不变；
   - `TemporalAuditReport` 旧字段兼容；`MINIMAL_PUBLIC_VERDICT` 冻结；原 JSDoc 归位；
   - 真实路径 `analyzeTemporalInternalTwoLag → toPublicTemporalEvidence → mapPublicVerdict`；gate BLOCKED 不产 NB/PU；`assetId` 单一/多 Hazard；
   - 分层 catch、trusted / analyzer 失败 ⇒ IE/unknown/evidence[]/不抛；phase-1 冲突不可达；`applicable:false` 短路；确定性；
   - `compile-runtime` 既有测试不再因 create-game 真实分析超时；全量 178 files / 2933 tests；
   - 回滚演练真实、隔离、记录完整。
4. 至少 2 条自选关键断言，记录理由与结果。
5. 逐项 `PASS / FAIL / NOT_RUN`；不得用总通过率替代。
6. 写 `reports/U4-review-amendment.md`：复核人 / 日期 / 环境、输入与输出 hash、diff scope、逐项结论、命令 / 退出码、未覆盖项、限制、独立签署。原 `U4-review.md` / `U4-review-rerun.md` 仅作历史。

## 6. 权限边界

- 复核报告 PASS **只**表示 amended U4 证据足以支持该单元。
- 不授权 U5 / U3，不开放 `PUBLIC_NB` / `PUBLIC_PU`，不授权 probe / fixture 实施。
- 复核人不得修改产品代码 / 授权包 / 证据；只写复核报告。
