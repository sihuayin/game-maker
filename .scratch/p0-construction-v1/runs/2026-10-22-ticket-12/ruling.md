# 票 12 · 裁定原文与事实核验（2026-10-22）

## 裁定原文（用户逐字）

### 第一轮（Q1–Q2）

| 问题 | 裁定 | 依据与边界 |
|---|---|---|
| Q1：P0 验收口径 | A | 以 §3「明确失败、不落 sidecar」为准，修订 §3 建议范围、§5 和能力差距表的措辞，统一文档口径；不改契约。 |
| Q2：模型可见的 frames 漂移 | A | 本票不修改 AssetRecipeTool 契约或提示词，将模型可见的 frames 入口记录为 P1 observation。 |

### 第二轮（Q3–Q5）

| 问题 | 裁定 | 边界 |
|---|---|---|
| Q3 文档修订 | A：按所列四处原位最小修订 | 保留 ea53240 审计证据列原样；追加带日期的裁定注记，不倒写历史。 |
| Q4 错误消息扩展 | A：不改代码 | 采用现有 plan-frames-candidate.test.ts 作为见证，不为重复覆盖新增测试；不扩展为一次列出全部 frames 资源。 |
| Q5 票 11 历史状态 | A：保留原文，追加日期补记 | 更新 CAP-ASSET-01 的当前判定为「通过（票 12 修订口径）」，并将非 E2E 判据结论更新为 12/12；保留原始收口记录。 |

## 事实核验（E1：源码 + 文档）

- 冲突原文：`docs/v4/P0-00-p0-scope.md` §3 P0-06 建议范围 #1（原「并让 sidecar 记录模型真实候选」）、
  测试 #1（「且不落 sidecar」）、§5 判据（「sidecar 记录真实候选」）；
  `docs/v4/P0-00-capability-gap-audit.md` `CAP-ASSET-01` 验收条件（同）。
- 现行实现：`packages/assets/src/ops.ts:384` —— `frames` 候选在路线决策前 `CommandError("invalid")`，
  一发就收、不重采样、不落 recipe / sidecar；账随异常回报。
- sidecar 契约：`packages/contracts/src/asset-plan.ts:13,47` —— `candidate` 只允许
  `image | drawlist | import`；sidecar 在路线决策之后生成，不变量是「规划成功才有」
  （`packages/assets/src/ops.ts:494-513`）。
- 账的载体：`packages/contracts/src/command.ts:167-172`（`ledgerOfError`）；
  CLI/MCP catch 打印。`create` 链的 `run/v<N>/ledger.json` 只在成功路径写
  （`packages/pipeline/src/create-game.ts:391,628`）。
- 见证测试：`packages/assets/tests/plan-frames-candidate.test.ts` —— 断言 `invalid` / 退出码 4、
  消息含资源 id 与 `frames`、只发一次、账 `attempts=1`、输出目录零产物。

## 执行动作

- `docs/v4/P0-00-p0-scope.md`：§3 P0-06 建议范围 #1、测试 #1、§5 判据，以及 §5 末尾日期注记。
- `docs/v4/P0-00-capability-gap-audit.md`：`CAP-ASSET-01` 验收条件、P0 表后日期注记；
  审计证据列原样不动。
- `.scratch/p0-construction-v1/issues/11-final-validation.md`：顶部日期补记、判据表
  `CAP-ASSET-01` 行、缺口项日期补记；原文保留。
- `.scratch/p0-construction-v1/runs/2026-10-22-final/summary.md`：追加 §8 补记。
- 地图：追加票 12 索引、票 11 索引行补指向、头部收口标记。

## 命令与结果

| 命令 | 退出码 | 结果 |
|---|---|---|
| `pnpm check:links` | **1** | 仅 2 条既有 `.scratch` 断链；本次修订无新增断链（见 `check-links.txt`） |
| `git diff -- <改动文件>` | 0 | 见 `doc-diff.txt` |

无代码改动 ⇒ 未跑测试；见证测试为既有 `plan-frames-candidate.test.ts`。

## 边界

- 不改代码 / 契约 / CLI / MCP / 依赖；不改 `AssetRecipeTool` 或提示词。
- 不重开 `frames` 路线；不参数化保留；不碰 v7 / `fixtures/`；零付费；不提交 / 不推送。
