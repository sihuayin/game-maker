# U5-06 性能证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u5` |
| base | `09e12c2`（U5-05） |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未变） |
| 实现票 | [U5-06](../issues/07-u5-06-performance.md) |
| 脚本（冻结路径） | `.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs` |
| 机器可读输出 | `.scratch/level-playability-v1.1-u5/evidence/06-performance.json` |

## 运行

```bash
pnpm build
node .scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs
```

- 脚本使用 `packages/contracts/dist` 的两个内部入口：`analyzeTemporalInternalTwoLag`（16.67ms + 200ms）。
- 历史 manifest（v1–v3）做**只读归一化**：`format → assetpack/v4`、`provenance` 只留 `mode`；与 inventory 的 old-schema 口径一致。
- **墙钟只作诊断**：脚本不设阈值、不改证明结论、不接 CI workflow。
- 跨进程：父进程 + 两个 `--child` 子进程各自重跑同一语料 / synthetic 集，比较签名与剔除 `wallClockMs` / `detail` 的规范化序列化摘要。

## 语料

| 项 | 值 |
| --- | --- |
| inventory | `.scratch/level-playability-v1/corpus/inventory.json` |
| 文件 SHA-256 | `sha256:ba1d051a401ac70f45be5a705e2c478961ffc3fc0a6c9feb4cde09365df5f74f` |
| inventory freeze | `sha256:25e6c891cbb01e456433e104862bc9f03c8404f92fec10acdc93700aca00983d` |
| usableConfigs | 150 |
| uniquePairs | 96 |
| uniqueConfigs（按 contentHash 去重） | 20 |
| 实际分析 | 20 |
| 解析排除 | 0 |

## 环境

| 项 | 值 |
| --- | --- |
| Node | `v22.23.2` |
| OS | Darwin 24.6.0 |
| Arch | arm64 |
| CPU | Apple M4（10 cores） |
| Memory | 16 GiB |

## 历史语料结果（20 唯一 config，两档）

| 指标（第一档 / 第二档） | p50 | max |
| --- | ---: | ---: |
| `statesEnqueued` | 0 / 0 | 0 / 0 |
| `statesVisited` | 0 / 0 | 0 / 0 |
| `edgesChecked` | 0 / 0 | 0 / 0 |
| `cutPointsTotal` | 0 / 0 | 0 / 0 |
| `segmentsTotal` | 0 / 0 | 0 / 0 |
| `witnessTransitions` | 0 / 0 | 0 / 0 |
| `witnessBytes` | 0 / 0 | 0 / 0 |
| `wallClockMs`（诊断） | 1 / 1 | 4 / 1 |

- 结果分布：`insufficient-evidence` **20 / 20**（两档同样）。
- 原因分布：`goal-not-representable` 11、`model-out` 7、`spawn-not-on-lattice` 2。
- `phaseGridCapped`：**0**；实际 `N` 分布：`{"0": 20}`（全部在相位网格之前退出）。
- 预算触顶：**0**。

> **关键发现**：历史 19 关语料在 I-02 模型下全部在输入 / 几何阶段 IE，**没有进入相位网格与搜索**。
> 因此这批语料的 states / edges / cuts 分布天然为 0；这不是回归，而是 I-02 严格输入边界的结果。
> 不能用这批语料证明搜索预算在生产中的分布。完成报告必须如实写明这一点。

## Synthetic sanity（**不是生产语料**）

只用于验证脚本 / 聚合 / 跨进程路径在真实搜索上可工作，不冒充生产预算证据：

| id | 结果 | N / N_max | xPositions | states | edges | cutPoints / segments | witness | wallMs | 签名 |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | --- |
| `synthetic-nb` | `nb-candidate` | 4 / 4 | 19 | 76 | 64 | 0 / 64 | 44 转移 / 1251 B | 1 | `2c4d7930` |
| `synthetic-pu` | `pu-candidate` | 4 / 4 | 99 | 114 | 111 | 0 / 111 | — | 13 | `80f87b8c` |

- 两档一致；合成世界的签名与 U5-03 的 compact NB 跨进程签名 `2c4d7930` 对齐。
- `hopSamplesChecked` 仍为 0（U5-02 已知缺口：U4 六键输出边界不暴露逐弧计数），本票不伪造该字段。

## 跨进程确定性

| 项 | 值 |
| --- | --- |
| 进程数 | 3（父 + 2 子） |
| 摘要 | `sha256:2909f2b37d349eef005bf2818724cedd23e15dcc0480a6b31602534f6a7ffaac`（三次相同） |
| `equal` | **true** |

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `playability-temporal-input.test.ts --reporter=verbose` | **0** | **65 / 65**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| `playability-temporal-budget.test.ts` | **0** | **26 / 26**（语义预算上限仍由 vitest 确定性验收） |
| `node .scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs` | **0** | 20 config 分析完成；跨进程摘要一致 |
| `pnpm test` | **0** | **176 files / 2877 tests passed**；3 条 `onTaskUpdate` RPC 超时（工具层，非断言失败） |

原始输出：`06-performance-{build,typecheck,architecture,budget,test}.log`（本地保留，不入库）。

| 文件 / 日志 | sha256 |
| --- | --- |
| `bench-temporal.mjs` | `ebbe7d6d516d94575c607174f1acc62361f4a5825ed0f335ef73c5988955e4bd` |
| `06-performance.json` | `0263a5e2a5710f9e1d36c470b9f587c68daee5fac401052c0a7d71141175eba9` |
| `06-performance-build.log` | `1987139ce2a74071e9dfb2fb680e67ac6f4b171725ad3b4bb4b6560a2171d2f0` |
| `06-performance-typecheck.log` | `8d15ba2e817b7a37795bb98277de33cbbfeacba04d90fafd1c6f854dea885c3a` |
| `06-performance-architecture.log` | `f3e515af128cb76835775ce176a400b989d058d8fbf27e723eac62e1b0094dca` |
| `06-performance-budget.log` | `a5ba34dc63e5750507de22ab465f229a74b0976f69d112c61eb947200e16e604` |
| `06-performance-test.log` | `3d93349111cc33466094f06cef781c131bafacfe4a3eb9c49edfdfb31dca86cf` |

## 已知限制

1. **语料不进入搜索**：20 个唯一 config 全部在输入 / 几何阶段 IE；生产搜索预算的分布无法由这批语料证明。Synthetic 世界只作脚本 sanity。
2. `wallClockMs` 依赖机器与环境，不构成通过条件；本证据不接 CI 门禁，也不改变任何语义预算。
3. `hopSamplesChecked` 仍为 0（U5-02 已知缺口）；U4 图割 / hop 的耗时只体现在 synthetic PU 的总 `wallMs` 中，未拆分。
4. 不得用本证据的重跑 / 扩预算 / 换算法掩盖失败；语义结论仍由 `playability-temporal.test.ts` / `playability-temporal-budget.test.ts` 的确定性测试承担。
5. F 已按增量裁定 08 使用 `none` + `no-permanent-gate`。

## 结论

脚本可复跑，记录语料 SHA / freeze、环境、两档分布、`phaseGridCapped` / N 分布、synthetic sanity 与 3 进程确定性摘要。历史语料全部早退是 I-02 输入边界的真实结果，完成报告必须原样写明。U5-07 为下一 frontier 票。
