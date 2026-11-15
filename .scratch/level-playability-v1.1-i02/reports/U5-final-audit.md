# I-02 U5 最终审计报告（AC-08 ～ AC-13）

| 项 | 值 |
| --- | --- |
| 审计类型 | **U5 最终审计**（AC-08 ～ AC-13）；**不是 R5 门**，不授权任何后续能力 |
| 审计人 | 独立评审（U5-AUDIT 会话；全新上下文，未参与 U5 实现） |
| 日期 | 2026-11-13 |
| 审计 HEAD | `e7822f79a00f0894ab837ee8d4fd20b72d59b687`（U5-08 docs 提交） |
| Base | `wayfinder/level-playability-v1.1-i02` @ `b41f076`（已核验为 HEAD 祖先） |
| Diff 范围 | `b41f076..HEAD`（产品面：`packages docs fixtures`） |
| 授权包 | `docs/v7.8/移动-I02.md` · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（现场复算一致） |
| 输入包声明的 HEAD | `3b9f732`；实际 HEAD `e7822f7`。已核实 `3b9f732..HEAD` 对 `packages docs fixtures` **零 diff**（U5-08 仅 docs/evidence），产品审计范围不受影响 |
| 起始工作区 | **不干净**：`M .scratch/level-playability-v1.1-u5/issues/10-u5-audit.md`（Status `in-progress` / Owner 已填，前序会话所留；非产品文件）。审计结束时该文件按本票要求更新为 `resolved`，其余无 diff |
| 结论 | **AC-08 ～ AC-13 全部 PASS**；无 FAIL、无 NOT_RUN。限制与残余风险见 §6 |

## 0. 独立性声明

- 本会话为全新上下文，**未参与 U5-00 ～ U5-08 的任何实现、测试编写、证据生成或完成报告撰写**。
- 本报告不接受作者结论作为通过依据：所有结论来自本次现场重跑、独立 diff 核对、源码阅读与独立断言脚本（`/tmp/u5-audit-assert.mjs`，未入库）。
- 审计过程中未修改产品代码、测试、脚本、证据或已签署授权包。两个 acceptance 脚本与 bench 覆盖的 tracked 证据文件在记录比较结果后均已 `git checkout --` 恢复；工作区无产品 / 证据 diff。

## 1. 逐项判定

| AC | 要求 | 状态 | 证据（本次重跑 / 独立核对） | 备注 |
| --- | --- | --- | --- | --- |
| **AC-08** | 预算：工作预算是唯一语义预算；墙钟 abort-only；累计 cut 按 segments；恰好 / 超限、非法、溢出 | **PASS** | `playability-temporal-budget.test.ts` **26/26**；`playability-temporal.test.ts` 预算组（AC-08 标签 13 条）；A–J H；U5-02 新增 3 条 tracker 级断言；源码核对 `resolveBudgetProfile` / `createWitnessWorkBudget` | 恰好达上限通过、多 1 触顶；`maxCutsPerBranch` 按 `segments = cutPoints + 1`；state/edge 先于 cut；非法与 `budget-bound-overflow` 不回退默认；witness 体积 / hop cap / `phaseGridCapped` 均闭合 |
| **AC-09** | 双档 lag：两档完整执行、独立证据；一致 / 不一致 / 不完整三分；不保留乐观档 | **PASS** | U5-05 6 条；A–J I；`06-dual-lag.md`；独立断言 A4（wrapper 逐档 ≡ 独立运行、证书对象不共享、合并语义） | 限制：**未找到同一输入两档完整但不一致的真实世界**；「不一致」由两个完整但结论不同的真实单档结果直接调用合并函数测试。合并函数与 wrapper 同一路径，但端到端同输入不一致未实测（见 §6.1） |
| **AC-10** | 确定性：签名 / 规范化完整序列化；排除 `wallClockMs` / `detail`；跨进程 | **PASS** | U5-03 7 条；A–J J；`04-cross-process.json`；bench 3 进程摘要一致；独立断言 A3（独立 FNV-1a 重算、排除项 / 覆盖项变异） | 签名独立重算一致；改 `wallClockMs` / `detail` 签名不变；改 `work` 计数签名改变；剔除 `wallClockMs` / `detail` 的规范化序列化跨运行相同 |
| **AC-11** | 模型外 / 几何 / 时序 / 规避证据不足 ⇒ IE 且原因一致 | **PASS** | U5-01 模型外测试（Y 轴 / 多移动 Hazard）；A–J C（`spawn-not-on-lattice`、`no-permanent-gate`）、E；A–J B 六条件 2/5 `BLOCKED`；`02-assembly.md` / `05-matrix.md` | 覆盖缺口：Moving Platform / Danger `strike` 两个 `model-out` 分支实现了但 U5 新测试未直接覆盖；`geometry-untrusted` 由 U2/U3 单元测试覆盖，非组装层直接断言（见 §6.6） |
| **AC-12** | 范围与白名单审计 | **PASS** | `git diff --name-status b41f076..HEAD`；逐文件 sha256；零 diff 清单；barrel / `api.ts` / package exports 核对 | 产品 diff **恰好 7 个文件**，全部在授权包 §5.2 白名单；禁止修改文件 / 目录零 diff；无新依赖 / lockfile / 产品 JSON / 公共导出。详见 §3 |
| **AC-13** | 核心测试 + LP-06/07 回归 + 性能证据完整性 | **PASS** | `pnpm test` **176 files / 2877 tests passed**；A–J 11 条（43 条新文件全部通过）；架构断言 **65/65**；LP-06/07 退出码 0、JSON 剔除 `generatedAt` 后逐字段相等、stdout 与 U5-00 基线逐字节相同；bench 退出码 0、3 进程摘要一致 | 性能证据完整性符合 §8.7；限制：历史语料 20/20 IE 早退、搜索分布 0、synthetic 只作 sanity、`hopSamplesChecked` 仍 0（见 §6.2） |

**不存在总通过率替代。** 上述每项均为本次独立重跑或独立核对后的判定。

## 2. 命令与退出码（本次现场重跑）

| # | 命令 | 退出码 | 关键计数 / 结果 | 输出 hash（sha256） |
| --- | --- | ---: | --- | --- |
| 1 | `pnpm build` | **0** | 全包 build 完成 | 日志 `dc2bd4b5dfd396303aa242e72963a052b0b4795443e6aa25e4ef878eef5f014a` |
| 2 | `pnpm typecheck` | **0** | 全包 typecheck 完成 | 日志 `34079e0854a892735b87bd72afc41ff8a54312214e9f7f28e52e8b09ba52f1ec` |
| 3 | `pnpm test` | **0** | **176 files / 2877 tests passed**；2 条 `[vitest-worker]: Timeout calling "onTaskUpdate"`（工具层 RPC 超时，非断言失败；与作者声明一致） | 日志 `63d01253606084ca7cc7ae157a6a39034563a8fb03812c4129ed4439d78024a2` |
| 4 | `pnpm exec vitest run packages/contracts/tests/playability-temporal.test.ts` | **0** | **43 / 43** | 日志 `2ef228f41e9da7784c219a40705fb2e627d28fbf0081bf5c9bf4d7779ce44977` |
| 5 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-budget.test.ts` | **0** | **26 / 26** | 日志 `3172505bf81ed93e51628b781cf4d19e04f78b3b6811f2048bd0751396aa2108` |
| 6 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose` | **0** | **65 / 65**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ | 日志 `4d2a6864e0dc7522db444541a0f667f464568dd9bf08f5ca274435bfb1428ef2` |
| 7 | `node .scratch/level-playability-v1-p1/acceptance-corpus.mjs`（build 后） | **0** | 96 配对 / 20 config；pair verdicts PU/IE/NPB = 36/36/24；historicalDefects 3；insufficient 6；JSON 剔除 `generatedAt` 后与 HEAD **逐字段相等** | stdout `e0e43f4544b6663d86343b7e66f7ffe76872dda8f043e078d32b06149ff9723e`（与 U5-00 基线 **逐字节相同**） |
| 8 | `node .scratch/level-playability-v1-p1/acceptance-matrix.mjs`（build 后） | **0** | 39 results；33 legalPairs；final IE/PU/NPB = 11/19/9；expectedMismatch 9；layerExpectedMismatch 2；JSON 剔除 `generatedAt` 后与 HEAD **逐字段相等** | stdout `7aaad2566158ea218c28bf5eff0243ee6651695eb75a20c332c9d5e108a3098d`（与 U5-00 基线 **逐字节相同**） |
| 9 | `node .scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs`（build 后） | **0** | inventory SHA `sha256:ba1d051a…f74f`、freeze `sha256:25e6c891…983d`；150 usable / 96 pairs / 20 unique；20/20 `insufficient-evidence`；原因 11/7/2；`phaseGridCapped` 0；3 进程摘要 `sha256:2909f2b3…7aac` 完全一致 | stdout `5d0baefc6ec44dfd98107dd66bf24575ab4cdb785d259070c8eba6e01749229f` |

### 证据文件比较与恢复

| 文件 | HEAD（恢复后）sha256 | 重跑后与 HEAD 比较 |
| --- | --- | --- |
| `.scratch/level-playability-v1-p1/evidence/06-corpus-regression.json` | `4bd95026…fbd94` | 剔除 `generatedAt` 后相等（`identical=true`）；已恢复 |
| `.scratch/level-playability-v1-p1/evidence/06-matrix-acceptance.json` | `21161ea8…68d7` | 剔除 `generatedAt` 后相等；已恢复 |
| `.scratch/level-playability-v1.1-u5/evidence/06-performance.json` | `0263a5e2a5710f9e1d36c470b9f587c68daee5fac401052c0a7d71141175eba9` | 重跑版（`307c601a…`）与 committed 版在 corpus / environment / aggregates（除 `wallMs`）/ configs / synthetic / cross-process 上**完全相同**，仅各 `wallClockMs` 与 `generatedAt` 不同；已恢复为 HEAD 版本 |

> 环境：Node `v22.23.2` / Darwin `24.6.0` / arm64 / Apple M4（10 cores）/ 16 GiB，与 committed 证据一致。

## 3. Diff / 白名单审计（AC-12）

### 3.1 产品 diff（`b41f076..HEAD -- packages docs fixtures`）

恰好 7 个文件（作者输入包与 `08-audit.md` 声明一致）：

```text
M packages/contracts/src/playability/temporal.ts
M packages/contracts/src/playability/temporal-budget.ts
M packages/contracts/src/playability/temporal-evasion.ts
M packages/contracts/src/playability/temporal-witness.ts
M packages/contracts/tests/playability-temporal-budget.test.ts
M packages/contracts/tests/playability-temporal-fixtures.ts
A packages/contracts/tests/playability-temporal.test.ts
```

| 文件 | §5.2 白名单依据 | HEAD sha256 | diff 规模 |
| --- | --- | --- | --- |
| `temporal.ts` | §5.2：I-01 入口 + I-02 编排 + 内部入口 + 签名 | `6df8475822717d7e06a611e2e539785a3f8c9f67719e93d07e03d6373ef7ce53` | +776 / −3 |
| `temporal-budget.ts` | §5.2：新增预算与降级 | `d84bdfc96068325692fb8635317540a21b834bd5b43d364afe1c56efb4746992` | +3 / −0 |
| `temporal-evasion.ts` | §5.2：U4 图割 | `8712da87e6e08e37e3c437106ee8f4b28707b51cee4522ceb1fb2f9b4799d773` | +52 / −6 |
| `temporal-witness.ts` | §5.2：U2 Witness | `aa8f17e7f92cfacc66e231c9eb1e0b219fc9bb7fbccb517a433bcc969594e607` | +13 / −1 |
| `playability-temporal-budget.test.ts` | §5.2：`playability-temporal*.test.ts` | `c9a38ef6ea50f70c23eadd15c9397b47ce070d4ae75a531798d19ffe9e33e44c` | +71（纯新增） |
| `playability-temporal-fixtures.ts` | §5.2：`TEST_ONLY` helper 可扩展 | `3c3f2af9ddb870efbe57054f59713e6da1f0bc29a99172089182be82f72eac2c` | +11（纯新增） |
| `playability-temporal.test.ts` | §5.2：`playability-temporal*.test.ts`（新建） | `60adeba1fe2dc16c1f4fc8ced4419e527607e072c9f506e0259126a91827679a` | 新建 1059 行 |

逐文件 hash 与 `08-audit.md` 声称值逐一相等。

### 3.2 零 diff 核对（全部通过）

以下路径 `git diff b41f076..HEAD -- <path>` 为空：

- `temporal-result.ts`、`temporal-gate.ts`、`temporal-motion.ts`、`graph.ts`、`reach.ts`、`profile.ts`、`targets.ts`、`game-config.ts`、`geometry.ts`、`spatial.ts`、`completion.ts`、`mechanic.ts`、`api.ts`、`packages/assets/src/ops.ts`
- `packages/pipeline`、`packages/cli`、`packages/mcp`、`packages/demo`
- `fixtures/packs/**`、`docs/**`
- `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`packages/contracts/package.json`
- `packages/contracts/src/playability/index.ts`、`packages/contracts/src/index.ts`
- `packages/contracts/tests/playability-temporal-input.test.ts`（T-55 ～ T-65 原样）

### 3.3 公共面 / 内部符号

- `analyzeTemporalInternal` / `resolveTwoLagInternalResults` / `analyzeTemporalInternalTwoLag` / `TemporalTwoLagInternalResult` 只定义于 `temporal.ts`（`@internal` 注释），**不在** `playability/index.ts`、`contracts/src/index.ts`、`api.ts`。
- `packages/contracts/package.json` 仅导出 `"."`，无子路径导出；`temporal.js` 不可经公共 package 面导入。
- 无新增产品 JSON；新测试全部使用内存夹具（不新增 `packages/contracts/tests/fixtures/**`）。
- `temporal-result.ts` 零 diff ⇒ D9 类型、`DegradationReason` 闭集未被 U5 修改。
- U5-08 提交（`3b9f732..HEAD`）对 `packages docs fixtures` **零 diff**，仅新增/修改 `.scratch` 文档与证据。

**AC-12 结论：PASS。**

## 4. 独立断言（自选，≥2）

审计人自选 4 组、共 29 个检查点，脚本 `/tmp/u5-audit-assert.mjs` 只 import 已 build 的 `dist`，并**自行重建** synthetic 世界（不复用作者测试夹具），避免「重跑作者测试」。

| # | 断言 | 理由 | 结果 |
| --- | --- | --- | --- |
| **A1** | 独立构造 PU 世界 ⇒ `pu-candidate`；六个 `puConditions` id 顺序为 `gate-coverage / geometry-checked / graph-cut / hop-doubling / model-out-excluded / lag-consistent`；状态 1/3/4/6 `PASS`、2/5 `BLOCKED`；`PASS` 有 `evidence`、`BLOCKED` 有 `blockedReason`；`geometryCoverage` 三项均 `partial` + `runtimeBody="unverified"`；`graphCut.verdict="conditional"`；`lagInvariantByConstruction=true`；`publicCapability="BLOCKED"`、`publicResult=null`、`modelConditional=true` | 六条件与公共边界是 AC-05/06/07/11 的核心健全性断言，必须绕开作者测试独立复现 | **PASS（12/12）** |
| **A2** | 独立构造「无恒覆盖核心」世界 ⇒ IE + `certificate.kind="none"` + `no-permanent-gate` + `budgetStatus="complete"` + `BLOCKED/null` | 验证增量裁定 08 的 F 形状，且不伪造门区证明；同时确认 D9 类型未被改（`temporal-result.ts` 零 diff） | **PASS（5/5）** |
| **A3** | 独立实现 FNV-1a 32-bit 与 canonical stringify，按文档覆盖面重算签名并与实现比对；分别变异 `wallClockMs`、`detail`、`work.edgesChecked`；比较重复运行剔除 `wallClockMs` / `detail` 的完整规范化序列化 | 32-bit 签名只是指纹，规范要求同时比较完整序列化；独立实现可发现覆盖面与实现不一致 | **PASS（5/5）**：独立重算 `2c4d7930` 与实现一致；`wallClockMs` / `detail` 不影响签名；work 计数影响；规范化序列化相同 |
| **A4** | `analyzeTemporalInternalTwoLag` 的 `first` / `second` 与各自独立运行逐字段一致（规范化后）；两档 `certificate` 不是同一对象；返回键恰为 `first/second/combined`；一致时 `combined` 保留主档；任一档不完整时保留实际原因而非 `lag-disagreement`；三个结果均 `BLOCKED/null` | 直接检查双档 wrapper 的独立性与合并语义，不依赖作者测试 | **PASS（7/7）** |

脚本输出全部 `PASS`，退出码 **0**。

## 5. 作者声称的限制 / 待核对项复核

| # | 作者声称 | 审计核对结果 | 定性 |
| --- | --- | --- | --- |
| 1 | F 使用 `certificate.kind="none"` + IE `no-permanent-gate`；D9 类型未改 | 独立断言 A2 复现；`temporal-result.ts` 零 diff；裁定 08 为 amber 签署的独立记录 | **属实**；偏离冻结 §8.2/§6.6 的字面 F 形状，但由存量授权裁定 08 覆盖，审计以此为准 |
| 2 | `geometry-checked` / `model-out-excluded` 恒 `BLOCKED`；`geometryCoverage` 恒 `partial` | PU 断言逐项确认；`GEOMETRY_COVERAGE` 常量固定为 `manifest+atlas-metadata / unverified / partial` | **属实**，且与 §3.7 PU 阻塞条件一致 |
| 3 | U9 未进入组装；NB 由 W 承载 | 源码 `analyzeTemporalInternal` 只调用 `searchWinningSet`，无 U9 调用；注释与报告一致 | **属实**（不是把 U9 改成非必需，而是 `coverage.temporal=partial` 前置不成立） |
| 4 | 历史语料 20/20 全部 IE 早退；搜索分布 0；synthetic 只作 sanity | bench 重跑完全一致：20/20 IE，原因 11 `goal-not-representable` / 7 `model-out` / 2 `spawn-not-on-lattice`，`nDistribution {"0":20}`，states/edges/cuts 全 0 | **属实**；性能证据不能代表生产搜索预算分布 |
| 5 | `stats.work.hopSamplesChecked` 仍为 0；U4 独立搜索预算未实现 | committed 与重跑证据中 corpus + synthetic 的 `hopSamplesChecked` 全为 0；`temporal-evasion.ts` 只实现 `maxHopSamples`，无 `maxStates/maxEdges` | **属实**；与 §4.1 的预算作用域（`maxStates/maxEdges` 属 U2）不冲突，但“U4 独立搜索预算”确未闭合 |
| 6 | 同一输入的 lag 不一致世界未找到；合并逻辑用两个完整但结论不同的真实单档结果测试 | 复核测试：A–J I 与 U5-05 的 disagreement 均用 `NB_WORLD` vs `NO_GATE_WORLD` 的结果直接调用合并函数；wrapper 的同输入测试只覆盖一致 / 不完整 | **属实**；见 §6.1 残余风险 |
| 7 | `perLagResults` 由内部 `TemporalTwoLagInternalResult` 提供，D9 字段未扩 | wrapper 返回 `{first,second,combined}`；`TemporalInternalResult` 键仍为 D9 七项（测试断言 + 独立断言 A4） | **属实** |
| 8 | `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；I-03 未接线 | 源码中 `publicCapability: "BLOCKED"` 硬编码、`publicResult: null` 唯一赋值；产品源无 `PUBLIC_NB/PUBLIC_PU` 字样；生产无 `analyzeTemporalInternal` 调用者 | **属实** |

## 6. 未覆盖项、限制与残余风险

### 6.1 同一输入的 lag 不一致
- U5-05 与 A–J I 的“两档完整但不一致”均由**两个不同世界**的完整结果直接调用 `resolveTwoLagInternalResults` 测试；wrapper 本身只在同输入一致 / 不完整场景下被端到端执行。
- 影响：合并函数的语义被充分测试；但“同一世界在 16.67ms 与 200ms 下都完整却结论不同”这一真实路径未被找到或构造。若严格解释 AC-09 要求同输入端到端不一致，这是唯一有争议点。按冻结 §8.5 与输入包证据要求（U5-05 6 条 + A–J I），判定 **PASS**，但保留该残余风险。

### 6.2 性能证据的语料边界
- 20 个唯一历史 config 全部在输入 / 几何阶段 IE 早退，搜索指标（states / edges / cuts / witness）分布恒 0；`phaseGridCapped=0`、`budgetHitCount=0`。
- synthetic NB / PU 只作脚本与聚合路径 sanity，不是生产语料，不能用于推断生产搜索预算分布。
- `hopSamplesChecked` 仍为 0，U4 逐弧采样计数未暴露；U4 图割耗时只隐含在 synthetic PU 的总墙钟中。

### 6.3 几何与模型闭合
- `geometryCoverage` 恒 `partial`（Runtime body 未验证）；`geometry-checked` 与 `model-out-excluded` 恒 `BLOCKED`；PU 六条件中的 2/5 未闭合符合 R3/R4 既有边界。
- 这不影响 U5 的模型内结果边界，但意味着任何公共 PU 仍不可发布。

### 6.4 内部入口与 `trustedInput`
- `analyzeTemporalInternal` 的 `TemporalInternalInput.trustedInput` 参数**未被消费**；信任门的 `isTrustedAtlasInput` 只在 I-01 公共入口执行。
- 新测试使用 `trustedInputFixture()`（`as unknown as TrustedAtlasInput`）满足类型；bench 也传入非品牌对象。
- 影响：当前内部入口不读取该字段，因此不会产生“信任”假象；但这是一个 dead parameter，若未来 I-03 直接调用内部入口，信任语义需重新明确。记录为残余风险，不是 AC-08～AC-13 的失败。

### 6.5 其他
- `determinismSignature` 是 32-bit FNV-1a 指纹，不是无碰撞证明；规范已要求同时比较完整规范化序列化，U5 已实现，审计亦独立验证。
- 全量测试运行中出现 2 条 vitest worker `onTaskUpdate` RPC 超时（工具层，非断言失败，退出码 0）。
- LP-06/07 是既有非 vitest 回归、不在 CI 门禁内，且不覆盖时序内部结果；“差异 0”是预期结果，不是时序能力证据。
- `playability-temporal.test.ts` 未直接覆盖 Moving Platform / Danger `strike` 两个 `model-out` 分支，也未在组装层直接构造 `geometry-untrusted`；这些路径由 U2/U3 单元测试与源码核对支持。
- `temporal-evasion.ts` 的 `maxHopSamples` 新增为可选尾参，`undefined` 时保持 U4 冻结的 120/240 默认；现有 U4 测试在全量运行中通过。

## 7. 边界声明

- 本审计是 **U5 最终审计（AC-08 ～ AC-13）**，**不是 R5 门**，不授权任何后续单元或能力。
- `PUBLIC_NB` / `PUBLIC_PU` 仍为 **`BLOCKED`**；`publicCapability="BLOCKED"`、`publicResult=null` 恒成立。
- **I-03 未接线**；本报告不构成公共 Verdict 或生产证据链。
- 未推送、未创建 PR、未合并；未修改已签署授权包（SHA 仍为 `797cd6fc…`）、产品代码、测试、脚本或证据。
- 唯一写操作：本报告 + `.scratch/level-playability-v1.1-u5/issues/10-u5-audit.md` 状态更新。

## 8. 签署

| 项 | 内容 |
| --- | --- |
| 审计人 | 独立评审（U5-AUDIT 会话，未参与 U5 实现） |
| 日期 | 2026-11-13 |
| 审计 HEAD | `e7822f7` |
| 结论 | **AC-08 / AC-09 / AC-10 / AC-11 / AC-12 / AC-13 全部 PASS**；无 FAIL、无 NOT_RUN。限制与残余风险见 §6。U5 可进入用户签署；本审计不授权 `PUBLIC_NB` / `PUBLIC_PU`、I-03、推送 / PR / 合并。 |
