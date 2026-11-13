# I-02 U5 完成报告 — 硬化、集成与最终结果

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 单元 | **U5**（I02-05：预算 / 确定性硬化、A–J 矩阵、性能证据、最终集成与完成报告） |
| 授权包 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未变） |
| 分支 / base | `wayfinder/level-playability-v1.1-u5` ← `wayfinder/level-playability-v1.1-i02` @ `b41f076` |
| 增量授权 | [07-u5-incremental-authorization.md](./07-u5-incremental-authorization.md)（amber · 2026-11-13；仅 U5 + AC-08～AC-13 + 用户签署；无 R5） |
| 增量裁定 | [08-u5-f-certificate-decision.md](./08-u5-f-certificate-decision.md)（F 使用 `certificate.kind="none"` + IE `no-permanent-gate`） |
| 状态 | U5 实施与证据完成；**U5-AUDIT（AC-12 / AC-13）PASS（2026-11-13）**；用户签署待进行 |

> 本报告只陈述**模型内**结果。`PUBLIC_NB` / `PUBLIC_PU` 仍为 `BLOCKED`，I-03 未接线；
> 本报告不是公共能力声明，也不授权推送 / 建 PR / 合并。

## 0. 结论摘要

- U5-00 ～ U5-08 全部完成：基线 / 增量授权、D9 组装、预算硬化、确定性、A–J 矩阵、双档隔离、性能证据、LP-06/07 回归、白名单审计与本报告。
- 内部结果可产出 D9 `nb-candidate` / `pu-candidate` / `insufficient-evidence`；`publicCapability` 恒 `"BLOCKED"`、`publicResult` 恒 `null`。
- AC-08 ～ AC-13 的作者侧状态均为 **PASS**，但附有本报告 §5 的明确限制；**独立最终审计（2026-11-13）已 PASS，无 FAIL / NOT_RUN**（见 `U5-final-audit.md`）。
- LP-06/07 与 U5-00 冻结基线逐项、逐字节一致（除 `generatedAt`）。
- 产品改动严格落在授权包 §5.2 白名单；`PUBLIC_NB` / `PUBLIC_PU`、I-03、推送 / PR / 合并均未授权。

## 1. 已证明的结论（模型内）

### 1.1 D9 内部结果组装

- `analyzeTemporalInternal` 实现 D9 §6 内部入口：模型适用性 → 预算 → U2 状态格 → NB（`∀φ0` W）→ PU（U3 门区 + forbidden 注入图 + U4 图割 / hop）。
- NB：W 完整成立 ⇒ `encodeWitness` 成功 ⇒ `nb-candidate` + `witness/COMPLETE`。
- PU：门区、注入、图割、hop 全部完整 ⇒ `pu-candidate` + `permanent-gate/COMPLETE`；六条件 1/3/4/6 `PASS`、2/5 `BLOCKED`。
- G：门区完整、图割不完整 ⇒ `permanent-gate/INCOMPLETE` + `graph-cut-incomplete`，保留部分证明。
- F：门区不成立 ⇒ `certificate.kind="none"` + IE `no-permanent-gate`（增量裁定 08），不伪造门区字段。
- 模型外（Y 轴 / 多移动 Hazard / Moving Platform / Danger `strike`）⇒ IE `model-out`；几何不可信 ⇒ `geometry-untrusted`。
- `publicCapability` / `publicResult` 边界在全部 A–J 测试中显式断言。

### 1.2 预算（D5 / D5B）

- 工作预算是唯一语义预算；墙钟 abort-only。
- `maxStates 500k/1M`、`timeBudgetMs 2s/10s`、`maxCutsPerCheck 1M`、`maxCutsPerBranch 5M/10M`（segments = cutPoints + 1）、`maxWitnessTransitions 1M`、`maxWitnessBytes 64 MiB`、`maxHopSamples 240/arc`、`timeBudgetCheckpointWork 1024`。
- 状态 / edge 触顶后 `ownStop` 单向锁定，累计 cut 不覆盖原因；`verifyTransition` 先 edge 后 cut。
- 恰好达上限通过、多 1 即触顶；非法预算 / 派生溢出 ⇒ `invalid-budget` / `budget-bound-overflow`，不回退默认值。
- `phaseGridCapped` 仅诊断；`N < 2` ⇒ `grid-resolution-infeasible`。
- Witness 体积 / `maxHopSamples` 触顶 ⇒ IE + 对应 `budgetKind`，不截断、无部分证书。

### 1.3 确定性（D5 Q1 / Q9）

- `determinismSignature` 覆盖 `stats.grid`、`stats.work` 计数、`internalResult`、`certificate`、`diagnostics` 原因码、`stats.budget` 状态；排除 `wallClockMs`、`detail`、时间戳与 `testHooks`。
- 相同输入重复运行：签名 + 剔除 `wallClockMs` / `detail` 的规范化完整序列化一致。
- 注入时钟确定性触发 `wall-clock-abort`；同一工作预算 + 恒定时钟不 abort。
- 策略后继 tie-break：多候选世界零分歧；W 按整数状态升序输出。
- 跨进程：U5-03 两输入 3 进程签名 / 规范化序列化一致；U5-06 语料 + synthetic 3 进程摘要一致。

### 1.4 双档 lag（D5 §8.5 / D10 §3）

- `analyzeTemporalInternalTwoLag` 两档各自完整执行，独立预算 / 独立证据；`first` / `second` 与各自独立运行逐字段一致。
- `first` / `second` 保留逐档结果，`combined` 为 D9 合并结果；不扩 D9 `TemporalInternalResult`。
- 两档一致 ⇒ 主档结果；完整但不一致 ⇒ IE + `lag-disagreement`；任一档不完整 ⇒ IE + 该档实际预算 / abort 原因。
- 不保留乐观档；不把“不完整”伪装成“不一致”。

### 1.5 A–J 矩阵

`playability-temporal.test.ts` 中 A–J 十项与跨单元组合均有具名测试；每条显式断言 `publicCapability="BLOCKED"` / `publicResult=null`。详见 [`05-matrix.md`](../../level-playability-v1.1-u5/evidence/05-matrix.md)。

### 1.6 LP-06 / LP-07 回归

两份 acceptance 脚本退出码 0；语料 / 矩阵计数与 U5-00 冻结基线逐项一致；evidence JSON 剔除 `generatedAt` 后逐字段相等；stdout 日志逐字节相同。差异 0，未触发 STOP。

## 2. 仍为 `INSUFFICIENT_EVIDENCE` / 未闭合的结论

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 几何 `checked` | **未证明** | Runtime body / 帧几何未验证；`geometryCoverage` 三份恒 `partial` / `unverified`；PU 条件 2 恒 `BLOCKED` |
| 模型外规避排除 | **未证明** | 空中水平控制未闭合；`movementModelClosure="not-proven-air-control"`；PU 条件 5 恒 `BLOCKED` |
| U9 证书 | **未参与组装** | `coverage.temporal = partial`，D10 §1.1 的 `checked` 前置不成立；NB 由 `∀φ0` W 承载 |
| F（短暂安全窗口） | **无门区证明** | 按增量裁定 08：`certificate.kind="none"` + IE `no-permanent-gate`；不伪造门区 |
| 历史 19 关语料 | **全部 IE 早退** | 20/20 在输入 / 几何阶段 IE；未进入相位网格 / 搜索，不能证明生产搜索预算分布 |
| `stats.work.hopSamplesChecked` | **仍为 0** | U4 六键输出边界未暴露逐弧采样计数；U5-06 只记录 synthetic PU 的总墙钟 |
| U4 独立搜索预算 | **未实现** | `maxStates` / `maxEdges` 按 D5 只属 U2；U5 只闭合 `maxHopSamples` 与原因映射 |
| 同一输入 lag 不一致世界 | **未找到** | 不一致合并逻辑用两个完整但结论不同的真实单档结果测试；逐档隔离由“逐档 ≡ 独立运行”证明 |
| `perLagResults` | **内部 wrapper 提供** | `TemporalTwoLagInternalResult` 的 `first` / `second` 记录逐档结果；D9 `TemporalInternalResult` 未扩字段 |
| 公共 Verdict | **BLOCKED** | `PUBLIC_NB` / `PUBLIC_PU` 未授权；I-03 未接线 |

## 3. 预算 / 确定性 / 性能证据摘要

| 类别 | 证据 |
| --- | --- |
| 预算 | `playability-temporal-budget.test.ts` 26 / 26；A–J H；恰好 / 超限、非法、溢出、Witness 体积、hop cap、`phaseGridCapped` |
| 确定性 | U5-03 7 条；`04-cross-process.json`：last-train `e504455e`、compact NB `2c4d7930`，规范化 sha256 逐进程一致；墙钟 0 vs 1 / 0 vs 67 |
| 性能 | `bench-temporal.mjs`；inventory SHA `sha256:ba1d051a…f74f`、freeze `sha256:25e6c891…983d`；Node v22.23.2 / Darwin 24.6.0 / arm64 / Apple M4；20 unique config 全部 IE 早退；synthetic NB/PU 只作 sanity；3 进程摘要 `2909f2b3…7aac` 一致 |
| LP 回归 | 两份 acceptance 脚本退出码 0；与 U5-00 基线逐项 / 逐字节一致；差异 0 |
| 全量 | `pnpm test` **176 files / 2877 tests passed**；架构断言 65 / 65；build / typecheck 0 |

性能证据**只作 E3 证据，不作 CI 门禁**；墙钟阈值不是通过条件。历史语料全部早退是 I-02 输入边界的真实结果，不是性能回归。

## 4. AC-08 ～ AC-13 逐项状态（作者侧）

| AC | 状态 | 证据 |
| --- | --- | --- |
| AC-08 预算 | **PASS** | 预算测试 26 / 26；A–J H；`03-budget.md` |
| AC-09 双档 lag | **PASS** | U5-05 6 条 + A–J I；`06-dual-lag.md`；限制：同一输入不一致世界未找到 |
| AC-10 确定性 | **PASS** | U5-03 7 条 + `04-cross-process.json`；`04-determinism.md` |
| AC-11 模型外 IE | **PASS** | U5-01 模型外测试、A–J C / E；`02-assembly.md` / `05-matrix.md` |
| AC-12 白名单 / 范围 | **PASS** | 产品 diff 仅 §5.2 白名单；只读 / 生产 / barrel / 依赖 / JSON 零 diff；`08-audit.md` |
| AC-13 核心测试 + 回归 + 性能证据 | **PASS（附限制）** | A–J 11 条、全量 2877、LP 差异 0、bench 完整；限制：语料全部 IE 早退、synthetic 只作 sanity |

逐项状态不使用总通过率替代。最终审计（独立会话）必须自行重跑并判定；本表是作者侧结论，不是最终审计。

## 5. 未覆盖项与已知限制

1. **几何 / Runtime body**：未证明帧几何与 manifest 标称值一致；`coverage` 恒 `partial`。
2. **空中控制**：`scene.ts` 每帧无条件水平加速未被移动模型闭合；`movementModelClosure` 恒 `not-proven-air-control`。
3. **公共能力**：`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；I-03 未接线；本报告不构成公共 Verdict。
4. **U9**：未进入 U5 组装路径；D10 §1.1 前置不成立。
5. **F**：按增量裁定 08 使用 `none`；不是永久门区证明。
6. **性能语料**：20 个唯一 config 全部在输入 / 几何阶段 IE；搜索分布为 0；synthetic 不是生产语料。
7. **`hopSamplesChecked` / U4 预算**：未闭合；U4 图割 / hop 的耗时只体现在 synthetic PU 总墙钟。
8. **lag 不一致世界**：未找到同一输入的两档完整不一致世界；合并逻辑由不同完整结果测试。
9. **`perLagResults`**：由内部 two-lag wrapper 提供，D9 字段未扩。
10. **LP-06/07**：非 vitest、非 CI 门禁；不覆盖时序内部结果。

## 6. 边界声明

- `modelConditional: true`；`publicCapability: "BLOCKED"`；`publicResult: null` 恒成立。
- `PUBLIC_NB` / `PUBLIC_PU` **未授权**；I-03 未接线。
- 未推送、未建 PR、未合并；U5-08 Draft PR 描述仅准备，未创建。
- 授权包 SHA `797cd6fc…` 未变；未修改已签署正文。
- 本报告不授权后续单元或公共能力。

## 7. 证据索引

- 增量授权：`07-u5-incremental-authorization.md`
- F 裁定：`08-u5-f-certificate-decision.md`
- U5 票与证据：`../../level-playability-v1.1-u5/issues/`、`../../level-playability-v1.1-u5/evidence/`
- A–J / 预算：`playability-temporal.test.ts`、`playability-temporal-budget.test.ts`
- 架构断言：`playability-temporal-input.test.ts`
- 性能脚本：`../scripts/bench-temporal.mjs`；输出 `../../level-playability-v1.1-u5/evidence/06-performance.json`
- LP 回归：`../../level-playability-v1.1-u5/evidence/07-lp-regression.md`
- 白名单审计：`../../level-playability-v1.1-u5/evidence/08-audit.md`
- 最终审计输入包：`../../level-playability-v1.1-u5/reports/09-audit-input-package.md`
- 最终审计报告：`./U5-final-audit.md`

## 8. 完成声明

U5 的**实施与证据**已完成：D9 组装、预算 / 确定性硬化、A–J 矩阵、双档隔离、性能证据、LP 回归与白名单审计均就绪。**独立最终审计（AC-08～AC-13）已于 2026-11-13 PASS，无 FAIL / NOT_RUN**（[`U5-final-audit.md`](./U5-final-audit.md)）。仍待：**用户签署 U5**；在签署前，U5 不视为最终验收，公共能力仍 `BLOCKED`。
