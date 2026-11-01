# P0-04 票 01 · 基线 A/B 只读审计报告

- 生成时间：2026-11-01T12:30:40Z（UTC）
- 仓库 HEAD：`25985daf618aa845d5ee0667b92a16e6edaad53e` · 分支 `main`
- 结论：**PASS**
- 机器可读：`facts.json`；CLI 日志：`cli-A.*` / `cli-B.*`

## 1. 结论

两套基线的身份、数量、冻结关系、路径安全、逐文件 SHA-256 与 A 零变化均通过；未发现身份或哈希不一致。B 的 2 个 chrome.log 差异有明确解释，见 §3。

## 2. 基线身份与统计

| 项 | 基线 A（FPVS-V1） | 基线 B（P0-02 Second Demo V2） |
|---|---|---|
| Manifest | `.scratch/evidence-integrity-v1/manifest/expected-hashes.json` | `.scratch/p0-02-second-demo-v2/manifest/final-manifest.json` |
| 原始字节 SHA-256 | `sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd` | `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab` |
| 大小 | 61,616 B | 66,336 B |
| 文件 / required / optional | 223 / 151 / 72 | 231 / 137 / 94 |
| records | 13 | 6 |
| roots | 9 | 3 |
| 清单总字节 | 20,207,992 | 33,448,793 |

A 的 Anchor 与更新日志：

- `expected-hashes.sha256` = `sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd`；与 Manifest 匹配：**True**
- `MANIFEST-UPDATES.md` 条目 1 条；最后一条 `newSha256` = `sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd`；与 Manifest 匹配：**True**

B 的正式记录：`final-verdict.json` 记录摘要 `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab`，实测 `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab`，一致：**True**；数量一致：**True**。

## 3. 冻结快照 112 与正式清单 231 的关系

- 冻结快照磁盘文件：**112**；`freeze-sha256.txt` 条目：**112**；逐文件哈希不一致/缺失/多余：0 / 0 / 0。
- 清单 `out` root 文件：**110**（109 required + 1 optional）。
- 冻结快照有、清单没有：2 个；清单有、快照没有：0 个；共享文件哈希不一致：0 个。
- `.gitignore` 的 `*.log` 规则：`{'file': '.gitignore', 'line': 17, 'rule': '*.log'}`。

  - `wasteland-scavenger-recipe/run/v1/playtest/v1/chrome.log`（2,374 B）：Chrome 运行日志，首条非空行 `DevTools listening on ws://127.0.0.1:61461/devtools/browser/5062e190-c56d-4c0a-a04c-95f677aafb55`。被 spec 的 `out` 目录条目 `excludeExt=[".log"]` 排除：**True**；被 spec 显式列为单个文件：**False**；由 freeze-sha256.txt 覆盖：**True**。

  - `wasteland-scavenger-recipe/run/v1/playtest/v2/chrome.log`（10,655 B）：Chrome 运行日志，首条非空行 `DevTools listening on ws://127.0.0.1:63143/devtools/browser/4a4a570b-9a09-4c2c-8f7b-5e90742ed3a7`。被 spec 的 `out` 目录条目 `excludeExt=[".log"]` 排除：**True**；被 spec 显式列为单个文件：**False**；由 freeze-sha256.txt 覆盖：**True**。

  结论：这 2 个文件是**已被 v3 取代的旧 playtest attempt 的 Chrome 运行日志**，不是交付证据；成功 attempt 的 `v3/chrome.log` 被 spec 显式列为 **optional**。冻结快照的 112 文件完整性由 `freeze-sha256.txt` 覆盖；但该哈希清单本身不在 231 清单或 Anchor 内（见 §10 警告）。

## 4. 逐文件校验

| 基线 | verified | required 失败 | optional 问题 | 状态分布 |
|---|---|---|---|---|
| A | 223 / 223 | 0 | 0 | `{"verified": 223}` |
| B | 231 / 231 | 0 | 0 | `{"verified": 231}` |

Optional 缺失/异常逐条：0 条

## 5. 路径安全

| 检查 | A | B |
|---|---|---|
| root 均在仓库内 | True | True |
| 绝对路径 / `..` / 未规范化路径 | 0 | 0 |
| 重复 `root:path` | 0 | 0 |
| 大小写冲突（清单） | 0 | 0 |
| Unicode NFC 冲突 | 0 | 0 |
| 磁盘目录大小写冲突 | 0 | 0 |
| 符号链接组件 | 0 | 0 |

所有 root 解析结果：

**A**
- `out` → `../../fpvs-v1-final/work` → `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/work`（real `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/work`，仓库内 True）
- `snapshot` → `../../fpvs-v1-final/artifacts/wasteland-scavenger-recipe` → `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe`（real `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe`，仓库内 True）
- `reference` → `../../fpvs-v1-final/artifacts/reference` → `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/artifacts/reference`（real `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/artifacts/reference`，仓库内 True）
- `artifacts` → `../../fpvs-v1-final/artifacts` → `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/artifacts`（real `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/artifacts`，仓库内 True）
- `fa04` → `../../fpvs-v1-final/runs/2026-10-28-visual-review` → `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/runs/2026-10-28-visual-review`（real `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/runs/2026-10-28-visual-review`，仓库内 True）
- `fa05` → `../../fpvs-v1-final/runs/2026-10-28-final-acceptance` → `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/runs/2026-10-28-final-acceptance`（real `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/runs/2026-10-28-final-acceptance`，仓库内 True）
- `fa06` → `../../fpvs-v1-final/runs/2026-10-28-regression-closure` → `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/runs/2026-10-28-regression-closure`（real `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/runs/2026-10-28-regression-closure`，仓库内 True）
- `runs` → `../../fpvs-v1-final/runs` → `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/runs`（real `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/runs`，仓库内 True）
- `gp` → `../../generic-playtest-v1/evidence` → `/Volumes/shy/some-projects/game-maker/.scratch/generic-playtest-v1/evidence`（real `/Volumes/shy/some-projects/game-maker/.scratch/generic-playtest-v1/evidence`，仓库内 True）

**B**
- `fa04` → `../../fpvs-v1-final/runs/2026-10-28-visual-review` → `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/runs/2026-10-28-visual-review`（real `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/runs/2026-10-28-visual-review`，仓库内 True）
- `oldWork` → `../../fpvs-v1-final/work` → `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/work`（real `/Volumes/shy/some-projects/game-maker/.scratch/fpvs-v1-final/work`，仓库内 True）
- `out` → `../freeze` → `/Volumes/shy/some-projects/game-maker/.scratch/p0-02-second-demo-v2/freeze`（real `/Volumes/shy/some-projects/game-maker/.scratch/p0-02-second-demo-v2/freeze`，仓库内 True）

## 6. 记录（records）

**A**：13 条
- `out:wasteland-scavenger-recipe/run/v1/qa-report.json` · role=qa-report · required=True · identity=True · inFiles=True · file=verified
- `out:wasteland-scavenger-recipe/run/v1/playtest/v2/result.json` · role=playtest-result · required=True · identity=True · inFiles=True · file=verified
- `gp:06-attempt-1/attempt-v1/result.json` · role=playtest-attempt · required=True · identity=True · inFiles=True · file=verified
- `gp:06-attempt-2/attempt-v1/result.json` · role=playtest-attempt · required=True · identity=True · inFiles=True · file=verified
- `fa04:review-record.json` · role=visual-review · required=True · identity=True · inFiles=True · file=verified
- `fa04:capture.json` · role=visual-capture · required=True · identity=True · inFiles=True · file=verified
- `fa04:materials.json` · role=visual-materials · required=True · identity=True · inFiles=True · file=verified
- `fa05:evidence.json` · role=acceptance-evidence · required=True · identity=True · inFiles=True · file=verified
- `fa05:consistency.json` · role=acceptance-consistency · required=True · identity=False · inFiles=True · file=verified
- `fa06:regression.json` · role=regression · required=True · identity=False · inFiles=True · file=verified
- `gp:09-review-record.supplement.json` · role=visual-supplement · required=True · identity=True · inFiles=True · file=verified
- `gp:09-review-materials.json` · role=visual-supplement-materials · required=True · identity=True · inFiles=True · file=verified
- `artifacts:identity.json` · role=identity · required=True · identity=True · inFiles=True · file=verified

**B**：6 条
- `out:wasteland-scavenger-recipe/run/v1/qa-report.json` · role=qa-report · required=True · identity=True · inFiles=True · file=verified
- `out:wasteland-scavenger-recipe/run/v1/playtest/v3/result.json` · role=playtest-result · required=True · identity=True · inFiles=True · file=verified
- `out:wasteland-scavenger-recipe/run/v1/mechanic-coverage.json` · role=mechanic-coverage · required=True · identity=True · inFiles=True · file=verified
- `fa04:review-record.json` · role=visual-review · required=True · identity=True · inFiles=True · file=verified
- `fa04:materials.json` · role=visual-materials · required=True · identity=True · inFiles=True · file=verified
- `fa04:capture.json` · role=visual-capture · required=True · identity=True · inFiles=True · file=verified

## 7. 基线 A 零变化

- 223 文件逐条 SHA-256：223 / 223 verified。
- Manifest 原始字节摘要 = Anchor = 更新日志最后一条：**True**。
- 审计开始/结束的 A/B/冻结/配置文件哈希快照：变化 0 个。
- `git status` 变化仅限本 effort 的 `runs/`：**True**（新增 4 行，消失/变更 0 行）。

## 8. A/B 隔离与重叠

- 绝对路径重叠 **73** 个：双方 required 28；A required/B optional 30；A optional/B required 0；双方 optional 15。
- 按 root 对：`[{"aRoot": "out", "bRoot": "oldWork", "count": 45}, {"aRoot": "fa04", "bRoot": "fa04", "count": 28}]`。
- 重叠文件哈希不一致：0。
- 含义：07 的 A/B 负向样本必须选各自**独占** required 路径；否则“A PASS 掩盖 B FAIL”无法被证明。

## 9. CLI 复验（E3）

- **A**：`node packages/cli/dist/cli.mjs verify-delivery --manifest .scratch/evidence-integrity-v1/manifest/expected-hashes.json --expected-manifest-sha sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd --anchor-mode digest --out /Volumes/shy/some-projects/game-maker/.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T12-28-50Z-baseline-audit/cli/A --json`
  - exit=0 · status=pass · diagnostics=0 · declared↔recomputed=True · trust={"mode": "digest", "source": "cli", "expectedSha256": "sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd", "actualSha256": "sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd", "result": "matched"}
  - 报告：`cli/A/2026-11-01T12-30-40-757Z-delivery-verification/report.json`

- **B**：`node packages/cli/dist/cli.mjs verify-delivery --manifest .scratch/p0-02-second-demo-v2/manifest/final-manifest.json --out /Volumes/shy/some-projects/game-maker/.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T12-28-50Z-baseline-audit/cli/B --json`
  - exit=0 · status=pass · diagnostics=0 · declared↔recomputed=True · trust=null
  - 报告：`cli/B/2026-11-01T12-30-40-895Z-delivery-verification/report.json`

CLI 构建物：`sha256:ca48cdf55d2185dde80517bc63bc75fb2afbd58bae27586f7b28af4ecc56bf7f`；pipeline `sha256:68e19a04479b7230e1cccc1b09cf4ce0c528826a59f777ce7598f9f47b4f1d2e`；包含 `baseline-update` 锚点模式：**True**。

## 10. 发现与警告

- ⚠️ 冻结快照中 2 个 chrome.log（v1/v2）不在 231 文件清单内：由 spec 的 excludeExt=[".log"] 排除，仅由 freeze-sha256.txt 固定；该哈希清单本身未被 A/B Manifest 或 Anchor 钉住。
- ⚠️ B 尚无独立 Anchor 与更新日志（预期：由 04 票创建）。
- ⚠️ B final-verdict.json / final-report.md 称 optional 含“旧 work 94 个”，实测 oldWork=93 + v3/chrome.log=1 = 94 optional；数量总数正确，但“94 个旧 work 文件”的表述不精确。
- ⚠️ A/B 有实际文件路径重叠；A PASS 不能掩盖 B 对 B 独占 required 文件的失败，07 负向样本必须使用独占路径。

没有 FAIL 项。

## 11. 只读性证据

- 审计命令与退出码见 `facts.json` → `commands`（共 4 条）。
- 开始 `git status`：13 行；结束：17 行；变化仅限 `.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T12-28-50Z-baseline-audit/`：**True**。
- 新增状态行 4 条（全部为本目录 CLI 报告）；删除/变更 0 条。
- 证据/配置文件哈希变化：无。
- 本目录外新增文件：无。

## 12. 输入与产出

- 输入（只读）：A Manifest/Anchor/更新日志；B Manifest/spec/freeze/freeze-sha256/final-report/final-verdict；PRD `docs/v7.6/接入.md`。
- 产出：`report.md`、`facts.json`、`cli-A.stdout.log`、`cli-A.stderr.log`、`cli-B.stdout.log`、`cli-B.stderr.log`、`cli/A/…`、`cli/B/…`。
