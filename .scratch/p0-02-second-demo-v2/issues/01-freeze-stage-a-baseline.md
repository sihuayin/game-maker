# 冻结阶段 A 基线、工作副本与证据工作区

Type: task
Status: resolved
Blocked by: （无）

## Question

在开任何代码改动前，冻结阶段 A 的可复核起点：

1. 记录 `main` 的完整 SHA、分支、`git status`、审计时间；确认生产代码相对旧 P0-02 基线 `4f3bc69`、P0-01 基线 `2c1a9d5` 的 diff。
2. 从 `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/` 复制一份**新的可写工作副本**到 `.scratch/p0-02-second-demo-v2/work/wasteland-scavenger-recipe/`；不原地修改旧 work，不改写冻结快照。
3. 核对副本的 `pack/v1`、`site/v1`、`run/v1/game-config.json` 与只读快照 `.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/` 身份一致；记录逐文件 sha256。
4. 备份副本的 `run/v1/qa-report.json`（含当前 `delivery.verdict=pass` 与 `playtest/v2` 引用）到 `baseline/qa-report.before.json`，记录 sha256；在基线报告中明确：后续真实运行会改写副本的 qa-report，不会改写旧 work / 快照 / 历史。
5. 确认免费运行前提：`pnpm build` 可完成、系统 Chrome 可用；记录基线回归（`pnpm test`、`pnpm typecheck`、证据验收 `--out` 到本 effort）的命令、退出码、耗时与环境。超时按 Q7 隔离重跑并记录，不判能力失败。
6. 建立本 effort 的 `work/`、`runs/`、`baseline/`、`research/` 目录；所有新产物只写本 effort 或 `out/`。

产物：`research/01-stage-a-baseline.md`（HEAD / 分支 / status / 文件数 / 身份哈希 / 备份位置 / 基线回归）。零付费、零历史写入、零生产修改。

## Answer

**基线就绪（M0）。** 2026-10-29T12:58:22Z 冻结；HEAD `f0411e676309fede8f20b79d9f8e44e5ac479ef6`（`main`），工作区仅未跟踪本 effort。

1. **代码**：生产代码相对 `4f3bc69`、`2c1a9d5` 的 `packages/` diff 均为空。
2. **副本**：`.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/`（95 文件）已复制到 `work/wasteland-scavenger-recipe/`，逐文件 sha256 与旧 work 全等；旧 work 未改。
3. **身份**：`pack/v1/**` + `site/v1/**` + `run/v1/game-config.json` 共 51 文件，与 66 文件只读快照的对应文件 sha256 全等；多出的 29 文件均为 `run/v1/playtest/**` 与 qa-report 等非身份文件。哈希见 `baseline/copy-sha256.txt`、`baseline/snapshot-sha256.txt`。
4. **备份**：`baseline/qa-report.before.json`，sha256 `dc20e3013044ddac0f9dc6c720384945448628dd628db369da4d6b98d66c5ee6`；当前 `delivery.verdict=pass`、`playable-smoke=pass`、`delivery.playtest` 指向 `run/v1/playtest/v2/result.json`。
5. **免费前提**：Node v22.23.2 / pnpm 10.7.1 / Chrome 156.0.8078.48；`pnpm build` exit 0（1s）。
6. **基线回归**：`pnpm test` exit 0（149 文件 / 2231 测试，30s）；`pnpm typecheck` exit 0（11s）；`node scripts/evidence-acceptance.mjs --out .scratch/p0-02-second-demo-v2/runs/evidence` exit 0（223 文件 / 19.3 MB，`delivery-verification/v1` status=pass，13 条记录，2s）。无超时。
7. **保护**：旧 work 95/95、冻结快照 66/66 哈希复核不变；git status 仅本 effort；零付费、未提交/推送。

产物：[research/01-stage-a-baseline.md](../research/01-stage-a-baseline.md) · `baseline/` · `runs/baseline-logs/` · `runs/evidence/`。

后续约束：票 11 的失败重跑实验必须在**另一份独立副本**上做，避免污染本基线副本。
