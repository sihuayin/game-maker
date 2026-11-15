# U5-00 基线证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u5` |
| base | `wayfinder/level-playability-v1.1-i02` @ `b41f076`（含 U1–U4 实现、R1–R4 报告与 U4-SIGN） |
| charting commit | `c63655c`（`docs(wayfinder): chart U5 hardening-completion effort`） |
| HEAD | `c63655c`；`b41f076` 为祖先，领先 1 个 charting commit |
| 工作区 | 开工前干净；`git diff b41f076..HEAD -- packages/ docs/ fixtures/` 为空（本图仅新增 `.scratch` chart 文件） |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（`shasum -a 256 docs/v7.8/移动-I02.md`，与已签署版本一致） |
| 增量授权记录 | [`07-u5-incremental-authorization.md`](../../level-playability-v1.1-i02/reports/07-u5-incremental-authorization.md)（amber · 2026-11-13；仅 U5 实施 + AC-08～AC-13 + 用户签署；无 R5） |
| U4 合并状态 | **已并入 i02**（PR #39，`b41f076`）；R4 PASS + U4-SIGN（2026-11-13）；U5 授权来自独立记录 07 |

## 起点状态（U5-00 必须项 4）

| 项 | 状态 |
| --- | --- |
| `packages/contracts/tests/playability-temporal.test.ts` | **不存在**（U5-04 新建） |
| `.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs` | **不存在**（`scripts/` 目录存在且为空；U5-06 新建） |
| `analyzeTemporalInternal` | **无实现**；`temporal.ts:123` 仅有「不在 U1 实现」注释；导出列表无该符号 |
| `temporal.ts` 既有 U1 内部词汇 | `TemporalInternalInput` / `TemporalInternalAnalyzer` / `determinismSignature` 已存在 |
| `.scratch/level-playability-v1/corpus/inventory.json` | **存在**（8104 行）；SHA-256 `ba1d051a401ac70f45be5a705e2c478961ffc3fc0a6c9feb4cde09365df5f74f`；`freeze` = `sha256:25e6c891cbb01e456433e104862bc9f03c8404f92fec10acdc93700aca00983d`；152 configs / 171 manifests |
| `playability-temporal-fixtures.ts` | 存在，453 行（`TEST_ONLY`） |
| `temporal-gate.ts`（U3） / `temporal-evasion.ts`（U4） | 均存在 |

## 白名单文件基线 hash

| 文件 | sha256 |
| --- | --- |
| `temporal.ts` | `983cd9fb09da789c6e6c32c8e5eaafe4f7e04f80147204aa7541de83de4bfed6` |
| `temporal-result.ts` | `04e3c37ca140fa09b3ea1eabf0d0d3336c06cdda2cdeafde719c5b44c6d343fc` |
| `temporal-budget.ts` | `c2be787067902d3d903213020d19e59c4a98ef3c963688e4e3d8eb589f76816e` |
| `temporal-motion.ts` | `71ff8aaf4c7682949ffd2d0e9927c99cd45d9390266203c73e2ac62d55852df6` |
| `temporal-witness.ts` | `67ecea21d2b29b524ea1ac3503999a58a327515312f2db92efbdf301f55a4668` |
| `temporal-gate.ts` | `03ec5ef656815028afb9ef5bb7b9d19b5f7e02e1b63a7c095721d2eebf9913a2` |
| `temporal-evasion.ts` | `09ca8c5907ed5e530f4c2395ed5854bfc90336f8e797518aed6fb28e499fe54f` |
| `playability-temporal-fixtures.ts` | `20b56290fbb76a978a849422fa91fcf1573426172c2d186f75889fc1c2a2b481` |

## 基线命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose` | **0** | 1 file / **65 tests passed**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| `pnpm test` | **0** | **175 files / 2831 tests passed**；2 条 `[vitest-worker] Timeout calling "onTaskUpdate"`（工具层 RPC 超时，非断言失败） |
| `node .scratch/level-playability-v1-p1/acceptance-corpus.mjs` | **0** | 见下「LP-06 语料」 |
| `node .scratch/level-playability-v1-p1/acceptance-matrix.mjs` | **0** | 见下「LP-06 矩阵」 |

原始输出：`00-{build,typecheck,architecture,test,acceptance-corpus,acceptance-matrix}.log`（本地保留，不入库）。

## LP-06 / LP-07 冻结基线

### 语料回归（`acceptance-corpus.mjs`）

| 计数 | 值 |
| --- | ---: |
| `usableConfigs` | 150 |
| `uniquePairs` | 96 |
| `uniqueConfigs` | 20 |
| `evaluatedPairs` | 96 |
| `evaluatedConfigs` | 20 |
| `uniqueContentPairs` | 31 |
| `pairVerdicts` | PU 36 / IE 36 / NPB 24 |
| `configVerdicts` | PU 8 / IE 6 |
| `playabilityConfigVerdicts` | IE 11 / PU 3 |
| `allConfigVerdicts` | PU 9 / IE 9 / NPB 2 |
| `historicalDefects` | 3 |
| `falsePositives` | 0 |
| `insufficient` | 6 |

### 矩阵验收（`acceptance-matrix.mjs`）

| 计数 | 值 |
| --- | ---: |
| `cases` | 39（spatial 23 / mechanic 6 / completion 10） |
| `legalPairs` | 33 |
| `results` | 39 |
| `finalDistribution` | IE 11 / PU 19 / NPB 9 |
| `expectedFinalDistribution` | NPB 16 / PU 17 / IE 6 |
| `expectedMismatch` | 9（既有冻结差异，非 I-02 引入） |
| `layerExpectedMismatch` | 2（既有冻结差异，非 I-02 引入） |

### 与冻结基线比较

本次复跑生成的两份 evidence JSON 与仓库冻结版本逐字段一致（剔除 `generatedAt` 时间戳后相等）。
为避免基线票制造 scratch 噪声，复跑后已将 `.scratch/level-playability-v1-p1/evidence/06-{corpus-regression,matrix-acceptance}.json` 恢复为 `HEAD` 版本；**内容无差异**。

| 输出 / 日志 | sha256 |
| --- | --- |
| `00-acceptance-corpus.log` | `e0e43f4544b6663d86343b7e66f7ffe76872dda8f043e078d32b06149ff9723e` |
| `00-acceptance-matrix.log` | `7aaad2566158ea218c28bf5eff0243ee6651695eb75a20c332c9d5e108a3098d` |
| `00-architecture.log` | `7ff47fdbcaa281eb8bb78a1e34218a9ca78a0590944e56f51cf74af32931fa57` |
| `00-build.log` | `5a2efb3cb1df0834d64e7a9d4265f1a4217ab69e13cdccf9e40ba5aed0de7f58` |
| `00-typecheck.log` | `08cc46f3578feb49f75253d157c290a0f9adb899a2de66774a5c6ee70500561b` |
| `00-test.log` | `5454b2145956ace03011cb6279807eab9d3fccec48ccf3ef93c05a3b36e6a02b` |

## 架构断言

`playability-temporal-input.test.ts` verbose 输出逐条确认：

- T-55 contracts 源码不含 `node:fs` / `node:crypto` ✓
- T-57 `auditPlayabilityTemporal` 生产调用者只有 `ops.ts` ✓
- T-58 生产 `analyze` 实参只有 `stubTemporalAnalyzer` ✓
- T-61 三处生产接线各至少一次 ✓
- T-62 常量唯一且不复用 `FRAME_MARGIN_MS` ✓
- T-64 brand `Symbol` 只在 `temporal-input.ts` 铸造 ✓

## U5 完成协议（冻结）

- **唯一权威完成报告**：`.scratch/level-playability-v1.1-i02/reports/U5-completion.md`；必须写明已证明结论、仍为 `INSUFFICIENT_EVIDENCE` 的结论、预算 / 确定性 / 性能证据、未覆盖项（授权包 §9.5）。
- **唯一权威最终审计**：`.scratch/level-playability-v1.1-i02/reports/U5-final-audit.md`；由**未参与 U5 实现**的独立会话执行；**不是 R5 门**，不授权任何后续能力。
- **AC-08～AC-13 逐项** `PASS` / `FAIL` / `NOT_RUN`，不得用总通过率替代：
  - AC-08 预算；AC-09 双档 lag；AC-10 确定性；
  - AC-11 模型外 `INSUFFICIENT_EVIDENCE`；
  - AC-12 范围与白名单审计（E1 `git diff`）；
  - AC-13 核心测试 + LP-06/07 回归 + 性能证据完整性（E2 + E3）。
- 最终审计必须自己重跑 `pnpm build` / `pnpm typecheck` / `pnpm test` / 两个 acceptance 脚本 / bench 脚本，并记录退出码；独立验证至少 2 条关键断言。
- 每项证据记录：测试名 / 命令 / 退出码 / 原始输出摘要或 hash / 对应 AC / 复核门；E1 / E2 / E3 口径照用。
- 用户签署 U5 后地图收口；签署不授权 `PUBLIC_NB` / `PUBLIC_PU`、I-03、推送 / PR / 合并。
- 性能与 LP-06/07 只作 scratch 证据，不进 CI 门禁；不得用重跑 / 扩预算 / 换算法掩盖差异。

## 结论

基线全绿；授权台账记录 07 就绪；授权包 SHA 未变；产品目录自 `b41f076` 起零 diff；LP-06 语料与矩阵复跑结果与冻结基线逐字段一致。**U5-01 为下一 frontier 票。**
