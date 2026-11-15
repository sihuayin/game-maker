# U5-07 LP-06 / LP-07 回归 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u5` |
| base | `24f62b7`（U5-06） |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未变） |
| 实现票 | [U5-07](../issues/08-u5-07-lp-regression.md) |
| 冻结基线 | [U5-00 `00-baseline.md`](./00-baseline.md) |

## 命令与退出码

```bash
pnpm build
node .scratch/level-playability-v1-p1/acceptance-corpus.mjs
node .scratch/level-playability-v1-p1/acceptance-matrix.mjs
```

| 命令 | 退出码 |
| --- | ---: |
| `pnpm build` | **0** |
| `acceptance-corpus.mjs`（LP-06 语料） | **0** |
| `acceptance-matrix.mjs`（LP-06 矩阵） | **0** |

原始输出：`07-{build,typecheck,architecture,acceptance-corpus,acceptance-matrix,test}.log`（本地保留，不入库）。

## 与冻结基线逐项比较

### LP-06 语料

| 计数 | 基线（U5-00） | 本次 | 结果 |
| --- | ---: | ---: | --- |
| usableConfigs | 150 | 150 | 一致 |
| uniquePairs | 96 | 96 | 一致 |
| uniqueConfigs | 20 | 20 | 一致 |
| evaluatedPairs | 96 | 96 | 一致 |
| evaluatedConfigs | 20 | 20 | 一致 |
| uniqueContentPairs | 31 | 31 | 一致 |
| pairVerdicts PU / IE / NPB | 36 / 36 / 24 | 36 / 36 / 24 | 一致 |
| configVerdicts PU / IE | 8 / 6 | 8 / 6 | 一致 |
| playabilityConfigVerdicts IE / PU | 11 / 3 | 11 / 3 | 一致 |
| allConfigVerdicts PU / IE / NPB | 9 / 9 / 2 | 9 / 9 / 2 | 一致 |
| historicalDefects | 3 | 3 | 一致 |
| falsePositives | 0 | 0 | 一致 |
| insufficient | 6 | 6 | 一致 |

### LP-06 矩阵

| 计数 | 基线（U5-00） | 本次 | 结果 |
| --- | ---: | ---: | --- |
| cases（spatial / mechanic / completion） | 39（23 / 6 / 10） | 39（23 / 6 / 10） | 一致 |
| legalPairs | 33 | 33 | 一致 |
| results | 39 | 39 | 一致 |
| finalDistribution IE / PU / NPB | 11 / 19 / 9 | 11 / 19 / 9 | 一致 |
| expectedFinalDistribution NPB / PU / IE | 16 / 17 / 6 | 16 / 17 / 6 | 一致 |
| expectedMismatch | 9 | 9 | 一致 |
| layerExpectedMismatch | 2 | 2 | 一致 |

### 逐字段 / 逐字节

- 两次脚本写出的 evidence JSON 与仓库冻结版本在**剔除 `generatedAt`** 后逐字段相等：`identical = true`。
- `stdout` 原始日志与 U5-00 的 `00-acceptance-corpus.log` / `00-acceptance-matrix.log` **逐字节相同**（`cmp` 无差异）：
  - corpus log sha256 `e0e43f45…9723e`；
  - matrix log sha256 `7aaad256…3098d`。
- 复跑后已将 `.scratch/level-playability-v1-p1/evidence/06-{corpus-regression,matrix-acceptance}.json` 恢复为 `HEAD` 版本；工作区无产品 / 脚本 / 语料 diff。

## JSON 归一化比较

| 文件 | 剔除 `generatedAt` 后与 HEAD 相等 |
| --- | --- |
| `.scratch/level-playability-v1-p1/evidence/06-corpus-regression.json` | **true** |
| `.scratch/level-playability-v1-p1/evidence/06-matrix-acceptance.json` | **true** |

## 差异与处置

**差异：0。** 未触发 STOP。I-02 未接生产，本票期望结果不变；实际结果与冻结基线逐项、逐字节一致（除 `generatedAt` 时间戳）。

## 命令与退出码（完整）

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm typecheck` | **0** | 通过 |
| `playability-temporal-input.test.ts --reporter=verbose` | **0** | **65 / 65**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| `pnpm test` | **0** | **176 files / 2877 tests passed**；2 条 `onTaskUpdate` RPC 超时（工具层，非断言失败） |

## 日志 hash

| 日志 | sha256 |
| --- | --- |
| `07-build.log` | `b6837bb15a150aa05638cc00c91dcbc9523388df9e8935a59d753091164ffaa7` |
| `07-acceptance-corpus.log` | `e0e43f4544b6663d86343b7e66f7ffe76872dda8f043e078d32b06149ff9723e` |
| `07-acceptance-matrix.log` | `7aaad2566158ea218c28bf5eff0243ee6651695eb75a20c332c9d5e108a3098d` |
| `07-typecheck.log` | `66c93b7a79a857c0f5e100bb00793485e0a75d5dd9419ab9c70bab917cf3f1c5` |
| `07-architecture.log` | `8b68e664b704ff8355718e2749de47cbea2f62c2fd7ef38c60d860f338f4f5ed` |
| `07-test.log` | `382e6eb1c4da77b42a5dbc20c3c85814b7ad8a4ad2f6d87ac2d69541fcaeab31` |

## 已知限制

- LP-06/07 仍是既有非 vitest 回归，不在 CI 门禁内；本票不迁移、不改造、不包装成 I-02 测试。
- I-02 不接生产；两种语料都不覆盖时序内部结果，因此“不变”是预期结果，不是时序能力证据。
- F 已按增量裁定 08 使用 `none` + `no-permanent-gate`。

## 结论

两份脚本退出码均为 0；与 U5-00 冻结基线逐项一致；输出日志逐字节相同；差异为零，未触发 STOP。U5-08 为下一 frontier 票。
