# 绿基线前置：修复 6 条既有断裂链接

Type: task
Status: resolved
Blocked by: —

## Question

`pnpm check` 的 `check-links` 当前在 `main` 上红：6 条既有相对链接断裂，均位于历史 `.scratch` 文档；目标文件实际存在，只是相对路径写错。四项 required checks 要求 `pnpm check` 绿，因此这是 03 的前置。

断裂清单（2026-10-30 实测 `node scripts/check-links.mjs`）：

1. `.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/palette-curation.md:21` → `../issues/04-palette-coat-review.md`；目标实际在 `.scratch/asset-integration-v1/issues/04-palette-coat-review.md`。
2. `.scratch/asset-integration-v1/runs/2026-10-21c-screening/budget-report.md:8` → `../research/alternative-animation-models-2026-10-21.md`；目标实际在 `.scratch/asset-integration-v1/research/`。
3. `.scratch/fpvs-v1-final/issues/04-win-route-ruling.md:95` → `../../runs/2026-10-27-gate-stop/README.md`；目标实际在 `.scratch/fpvs-v1-final/runs/2026-10-27-gate-stop/README.md`。
4. `.scratch/fpvs-v1-p1/issues/11-cross-stage-integration-tests.md:39` → `issues/12-stage-c-real-artifact-acceptance.md`；目标实际在同目录。
5. `.scratch/text-upstream-v1/issues/01-root-cause-evidence.md:50` → `../game-maker-v2/issues/27-json-via-tool-choice.md`；目标实际在 `.scratch/game-maker-v2/issues/`。
6. `.scratch/text-upstream-v1/issues/01-root-cause-evidence.md:51` → `../game-maker-v2/experiments/tool-choice-probe/README.md`；目标实际在 `.scratch/game-maker-v2/experiments/tool-choice-probe/`。

选项：

- **(a) 修正 6 条相对路径**（推荐）：只改链接文本，不改证据、交付、历史结论；最小、可审计。
- **(b)** 把 4 个文件加入 `scripts/check-links.mjs` 的 `ALLOW`：保留历史原文，但降低链接守卫覆盖。
- **(c)** 不修，`check` 不作为 required check：与 Q10(a) 冲突，不推荐。

完成条件：

- `node scripts/check-links.mjs` exit 0；
- 6 条链接指向现有目标；
- 不修改任何证据文件、交付产物或历史验收报告；
- 记录修改文件与 diff，确认未改动被链接目标的内容。

## Answer

**已收口（2026-10-31）。选择 (a)：只修正 6 条相对路径，不改证据、交付或历史结论。**

### 修改（仅链接目标，5 个文件 / 6 条链接）

- `.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/palette-curation.md`：`../issues/…` → `../../issues/…`
- `.scratch/asset-integration-v1/runs/2026-10-21c-screening/budget-report.md`：`../research/…` → `../../research/…`
- `.scratch/fpvs-v1-final/issues/04-win-route-ruling.md`：`../../runs/…` → `../runs/…`
- `.scratch/fpvs-v1-p1/issues/11-cross-stage-integration-tests.md`：`issues/12…` → `12…`
- `.scratch/text-upstream-v1/issues/01-root-cause-evidence.md`：`../game-maker-v2/…` → `../../game-maker-v2/…`（2 条）

`git diff` 确认只改链接目标；被链接目标文件内容未动，证据/交付/历史报告未动。

### 验证

- `node scripts/check-links.mjs`：**exit 0**，889 份文档 / 3,028 条链接零断裂。
- `pnpm check`：**exit 0**（check:deps + check:links + build）；日志：`runs/2026-10-31-green-baseline/check.log`。
- 01/02 的 `pnpm test`（156 文件 / 2303 用例）与 `pnpm typecheck` 不受影响。

### CI clean-checkout follow-up（2026-10-31）

首轮 GitHub CI 在**干净 checkout** 下发现第 7 条断裂链接：`docs/v4/P0-00-capability-gap-audit.md:335` 指向 gitignored 的 `out/.../site/v3/`。本地 `pnpm check` 因工作区存在 `out/` 而漏过。

处理：把该行改为指向 tracked 运行目录 `../../.scratch/asset-integration-v1/runs/2026-10-20e-site/`，并在行内注明“`out/` 构建产物不入库”。修正后 CI 的 `check` job 通过（38s），`check-links` 在 runner 上零断裂。

因此本票最终修正 **7 条**链接（6 条 + CI 发现的 1 条）；仍未修改任何证据/交付/历史结论。

### 结果

`pnpm check` 已从既有的 6 条断裂链接恢复为绿；03 的回归 job 不再因历史链接假失败。
