# 票 01 · 阶段 A 基线冻结报告

- 审计时间：2026-10-29T12:58:22Z（本地 2026-10-29 20:58 +0800）
- 票：[冻结阶段 A 基线、工作副本与证据工作区](../issues/01-freeze-stage-a-baseline.md)
- 结论：**基线就绪（M0 达成）**。生产代码 HEAD 相对两条旧基线零 diff；可写副本与冻结快照身份一致；三件套基线全绿；旧 effort / 旧 work / 冻结快照 / 历史 run 零改动；零付费。

## 1. 代码基线

| 项目 | 值 |
|---|---|
| 分支 | `main` |
| HEAD | `f0411e676309fede8f20b79d9f8e44e5ac479ef6` |
| HEAD 提交时间 | 2026-10-29（`feat: 补充文档`） |
| 工作区 | 仅 `?? .scratch/p0-02-second-demo-v2/`（本 effort，未跟踪）；无已跟踪文件改动 |
| 旧 P0-02 基线 | `4f3bc69cb820f3690b0932c6959cfe279dc00e6a` |
| P0-01 基线 | `2c1a9d55c1ac94bc5271318514897b9485587bec` |

生产代码 diff（`git diff --stat <base>..HEAD -- packages/`）：

- `4f3bc69..HEAD`：**空**（0 文件）。
- `2c1a9d5..HEAD`：**空**（0 文件）。

两条基线之后的提交只改 `docs/`、`.scratch/` 等非生产代码路径；`4f3bc69..HEAD` 全量 diff 为 45 文件 / +2869 行，全部为文档与 effort 产物。

## 2. 可写工作副本

- 来源：`.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/`（95 文件）。
- 副本：`.scratch/p0-02-second-demo-v2/work/wasteland-scavenger-recipe/`（`cp -a` 后 `chmod -R u+w`）。
- 副本与旧 work 逐文件 sha256 **完全一致**（95/95）；旧 work 未原地修改。
- 本 effort 目录已建立：`work/`、`runs/`、`baseline/`、`research/`；全部新产物只写本 effort 或 `out/`。

## 3. 身份核对（副本 vs 只读冻结快照）

- 只读快照：`.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/`（66 文件，只读）。
- 身份范围：`pack/v1/**`、`site/v1/**`、`run/v1/game-config.json`，共 **51 文件**。
- 结果：51/51 sha256 **全等**；快照中没有副本缺失的文件。
- 副本比快照多 29 个文件，全部是 `run/v1/playtest/**` 运行产物与 `qa-report.json` 等非身份文件（快照只冻结身份范围）。
- 逐文件哈希落盘：
  - 副本：`baseline/copy-sha256.txt`（95 行）
  - 快照：`baseline/snapshot-sha256.txt`（66 行）

## 4. qa-report 备份与写回边界

- 备份：`baseline/qa-report.before.json`
- sha256：`dc20e3013044ddac0f9dc6c720384945448628dd628db369da4d6b98d66c5ee6`
- 当前身份：`delivery.verdict=pass`；`playable-smoke=pass (SUCCESS)`；`delivery.playtest.report` 指向 `run/v1/playtest/v2/result.json`（`playtest-report/v1`，`aggregate=SUCCESS`）。
- 边界：后续真实运行只改写**副本**的 `run/v1/qa-report.json` 与 `run/v1/playtest/**`；旧 work、冻结快照、旧 effort 的历史 run/pack/site 不写。

## 5. 免费运行前提

| 项目 | 值 |
|---|---|
| Node | v22.23.2 |
| pnpm | 10.7.1 |
| OS | Darwin 24.6.0 (arm64) |
| Chrome | Google Chrome 156.0.8078.48（`/Applications/Google Chrome.app`） |
| `pnpm build` | exit 0，1s（只写 `.gitignore` 的 `dist/` 与 `*.tsbuildinfo`） |

## 6. 基线回归（Q7 三件套）

日志目录：`runs/baseline-logs/`。

| 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|
| `pnpm test` | 0 | 30s | 149 个测试文件、2231 个测试全部通过（`pnpm-test.log`） |
| `pnpm typecheck` | 0 | 11s | 全部 package `tsc` 完成（`pnpm-typecheck.log`） |
| `pnpm build` | 0 | 1s | CLI/MCP bundle 完成（`pnpm-build.log`） |
| `node scripts/evidence-acceptance.mjs --out .scratch/p0-02-second-demo-v2/runs/evidence` | 0 | 2s | 清单 `.scratch/evidence-integrity-v1/manifest/expected-hashes.json`（223 文件 / 19.3 MB / sha256:ba7a485b195f…）；`delivery-verification/v1` status=pass，13 条记录，诊断 0（`evidence-acceptance.log`） |

无超时，未触发 Q7 隔离重跑。

证据验收产物：
- 报告：`runs/evidence/2026-10-29T13-00-22-728Z-delivery-verification/report.json`
- 运行记录：`runs/evidence/2026-10-29T13-00-20-881Z-test-evidence/summary.json`

## 7. 历史零改动与零付费

- 旧 work 逐文件哈希复核：与副本拷贝时记录一致（95/95）。
- 冻结快照逐文件哈希复核：与 `baseline/snapshot-sha256.txt` 一致（66/66）。
- `git status` 仍只有未跟踪的本 effort 目录；`pnpm build` 仅触碰 gitignored 的 `dist/`、`*.tsbuildinfo`。
- 证据验收只读历史清单并写本 effort `runs/evidence/`，未写 `.scratch/evidence-integrity-v1/runs`。
- 全程未调用模型、生图或任何付费上游；未提交、未推送。

## 8. 对后续票的事实

- 票 08–14 可直接使用副本 `work/wasteland-scavenger-recipe/`；基线期望为 `delivery.verdict=pass` + `playtest/v2`。
- 副本当前包含 v1 与 v2 两代写回产物；任何“失败重跑撤销”实验（票 11）必须在**另一份独立副本**上进行，避免污染本基线副本。
- 身份判定的 51 个文件清单可直接复用（分项计数见 `baseline/copy-sha256.txt`）。
