# U5-07 LP-06 / LP-07 回归

Type: task
Status: resolved
Owner: claude (U5-07 session 2026-11-13)
Blocked by: 07
Map: ../map.md
Class: U5 / VERIFICATION

## Task

执行 LP-06 / LP-07 acceptance 脚本，与 U5-00 冻结基线逐项比较。**任何差异 ⇒ STOP 并分析根因。**

### 允许文件

- `.scratch/level-playability-v1.1-u5/evidence/`、`reports/`
- 仅在暴露 I-02 回归缺陷时修改白名单内产品文件，并逐项说明

### 必须完成

1. 复跑：
   ```bash
   pnpm build && node .scratch/level-playability-v1-p1/acceptance-corpus.mjs
   pnpm build && node .scratch/level-playability-v1-p1/acceptance-matrix.mjs
   ```
2. 与 `.scratch/level-playability-v1.1-u5/evidence/00-baseline.md` 记录的基线逐项比较；记录退出码、计数、原始输出 hash。
3. 任何差异：登记到 `.scratch/level-playability-v1.1-u5/evidence/07-lp-regression.md`（差异项、根因、是否 I-02 引入、处置），STOP + HITL；不得静默接受。
4. 不迁移、不改造、不包装成 I-02 新测试；不修改脚本。
5. 复跑全量 `pnpm test`。

### 禁止

- 修改 `.scratch/level-playability-v1-p1/` 脚本或语料；
- 用重跑 / 换环境掩盖差异；
- 新增产品文件 / 依赖。

### 验收

两份脚本退出码 0 且与基线逐项一致；差异为零或已登记并 STOP；证据完整。

## Answer

**完成。** 两份 LP-06 脚本退出码均为 0；与 U5-00 冻结基线逐项、逐字节一致；差异为零，未触发 STOP。

| 项 | 结果 |
| --- | --- |
| `acceptance-corpus.mjs` | 退出码 **0**；usableConfigs 150 / uniquePairs 96 / uniqueConfigs 20 / evaluatedPairs 96 / uniqueContentPairs 31；pair PU36/IE36/NPB24；historicalDefects 3；falsePositives 0；insufficient 6 |
| `acceptance-matrix.mjs` | 退出码 **0**；cases 39（23/6/10）；legalPairs 33；results 39；final IE11/PU19/NPB9；expectedMismatch 9；layerExpectedMismatch 2 |
| 基线比较 | 两份 evidence JSON 剔除 `generatedAt` 后与 `HEAD` 逐字段相等；`stdout` 日志与 U5-00 基线**逐字节相同** |
| 差异 | **0**；未触发 STOP |
| 工作区 | 复跑后将 `.scratch/level-playability-v1-p1/evidence/06-*.json` 恢复为 `HEAD`；无产品 / 脚本 / 语料 diff |
| 命令 | `pnpm build` 0；`pnpm typecheck` 0；架构断言 65 / 65；`pnpm test` 176 files / 2877 tests，退出码 0 |

### 已知限制

- LP-06/07 仍是既有非 vitest 回归，不在 CI 门禁内；本票未迁移、未改造、未包装成 I-02 测试。
- I-02 不接生产；两种语料都不覆盖时序内部结果，“不变”是预期结果，不是时序能力证据。
- F 已按增量裁定 08 使用 `none` + `no-permanent-gate`。

证据：[`../evidence/07-lp-regression.md`](../evidence/07-lp-regression.md)。本票未推送 / 建 PR / 合并。
