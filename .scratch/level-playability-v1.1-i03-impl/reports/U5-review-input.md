# U5 独立复核输入包

> **本文件只列事实与可复跑命令，不含作者结论 / PASS 声明。**
> 复核人必须自己读 diff、重跑命令、逐项判断。

## 1. 复核对象

| 项 | 值 |
| --- | --- |
| 单元 | U5（pipeline `publish-gate` 时序诊断字段，非阻断） |
| 授权记录 | `.scratch/level-playability-v1.1-i03-impl/reports/U5-incremental-authorization.md` · `sha256:45e72c93537d9052ba69d1903563dc722aaee914eb743c125a212b8b6f17c1b0` |
| 单元 brief | `.scratch/level-playability-v1.1-i03-impl/issues/05-i03-impl-u5.md` |
| 授权包 | `docs/v7.8/移动-I03.md` · 签署前 `2f89d572…` / 签署后 `f45332be…` / 当前 `5e3fa97f4ae855ef37a18c3aabd708ed28f250af1184c466eaadc890935d6f24` |
| Base | `41df0d3`（树与 `main` `f4e6ce7` 相同） |
| **Code head** | **`fcea791`** |
| **Code/test head** | **`57ff6de`** |
| Code/test diff range | `41df0d3..57ff6de` |
| 环境 | 见 `evidence/U5/commands.log`（OS / Node / pnpm） |

## 2. 改动文件（code/test diff，2 个）

| 文件 | 操作 |
| --- | --- |
| `packages/pipeline/src/publish-gate.ts` | `PublishGateTemporalEvidence`；`PublishGateResult.temporal?`；`configProblem` 结构化返回；消费 U4 `TemporalAuditReport` |
| `packages/pipeline/tests/publish-gate.test.ts` | G1–G11 + 变异守卫；fake report 默认委托实际 `runTemporalAudit` |

只读 / 未修改：`packages/contracts/**`、`packages/assets/**`、`packages/cli/**`、`packages/mcp/**`、`packages/pipeline/src/create-game.ts`、fixtures、`scripts/**`、`docs/**`、`package.json` / lockfile / tsconfig。

## 3. 证据

| 项 | 路径 / 值 |
| --- | --- |
| 证据目录 | `.scratch/level-playability-v1.1-i03-impl/evidence/U5/` |
| 文件 hash | `evidence/U5/SHA256SUMS` |
| 目标测试 | `evidence/U5/targeted-test-output.txt` · 1 file / 28 tests · exit 0 |
| 全量测试 | `evidence/U5/test-output.txt` · 178 files / 2944 tests · exit 0 · 3 条 vitest-worker `onTaskUpdate` 超时告警（runner 噪声，非失败） |
| build / deps / links | `build.log` / `check-deps.log` / `check-links.log` · exit 0 |
| 不变量 | `invariant-before.txt`（base）/ `invariant-after.txt`（head） |
| 回滚演练 | `rollback-drill.log` · 分支 `wayfinder/i03-u5-rollback-drill` · revert `57ff6de` + `fcea791` 回 base `41df0d3` · 目标 17 tests / 全量 2933 tests · exit 0 |

## 4. 可复跑命令

```bash
pnpm exec vitest run packages/pipeline/tests/publish-gate.test.ts
pnpm test
pnpm build
pnpm check:deps
pnpm check:links
```

## 5. 复核人必须独立完成

1. 现场核对授权包 / 审查报告 / U5 授权记录 / brief 的完整 hash；核对 `evidence/U5/SHA256SUMS`。
2. 检查 `41df0d3..57ff6de` diff 是否**只**落在 U5 两行白名单；确认 contracts / assets / CLI / MCP / `create-game.ts` / fixtures 零 diff；确认 `publish-gate.test.ts` 既有断言未被改动（只新增 import / mock / 用例）。
3. 逐项检查：
   - `configProblem` 结构化返回：`configPath` 缺省 / 解析失败 ⇒ `{}`（字段缺席）；硬失败 ⇒ `{problem}` 且不调用 temporal；通过 ⇒ `{temporal}`；条件 spread，无 `temporal: undefined`；
   - 三态语义：缺席 = 未运行；`{applicable:false}` = 已运行不适用；`{applicable:true,...}` = 已运行适用；`applicable:false` 不被读成 PU / NB；
   - 诊断来源：`coverage` / `evidence` / `publicVerdict.verdict`；**不使用** legacy `verdict` / `degradation`；不暴露整个 `TemporalAuditReport`；
   - `existingAudit` 复用本次 `auditPlayability`；硬失败 early return 不跑 temporal；
   - 变异守卫：fake `PROVEN_UNPLAYABLE` + `coverage:"checked"` 不放行、不抛；源级 `CommandError` / `playabilityIssues` 不消费 `temporal`；
   - G1–G11 与 fake report 的对应关系；fake report 满足真实 `TemporalAuditReport` 类型、无 `as any`；mock 默认委托实际 `runTemporalAudit`；
   - 发布行为 / 退出码 / 报告落盘不变；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；`publicCapability` / `publicResult` 不变；无契约版本升级；
   - 目标 28 tests、全量 178 files / 2944 tests、build / deps / links 全过；
   - 回滚演练真实、隔离、回 base 后目标 17 / 全量 2933，delivery 分支未被污染。
4. 至少 2 条自选关键断言，记录理由与结果。
5. 逐项 `PASS / FAIL / NOT_RUN`；不得用总通过率替代。
6. 写 `reports/U5-review.md`：复核人 / 日期 / 环境、输入与输出 hash、diff scope、逐项结论、命令 / 退出码、未覆盖项、限制、独立签署。

## 6. 权限边界

- 复核报告 PASS **只**表示 U5 证据足以支持该单元。
- 不授权 U3，不开放 `PUBLIC_NB` / `PUBLIC_PU`，不授权 probe / fixture 实施。
- 复核人不得修改产品代码 / 授权包 / 证据；只写复核报告。
