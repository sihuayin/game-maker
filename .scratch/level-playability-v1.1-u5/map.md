# I02-U5：硬化、集成与完成报告（执行型 effort）

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-u5
Authority: [`docs/v7.8/移动-I02.md`](../../docs/v7.8/移动-I02.md) @ `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（已签署；U5 为 `PLANNED`，条件 = R4 PASS + 独立增量签署）
Incremental authorization: 用户 `amber` · 2026-11-13 · 指令「开 U5 地图」（经确认选项选择）· 范围**仅 U5 实施（预算 / 确定性硬化、A–J 矩阵、性能证据、最终集成与完成报告）+ AC-08～AC-13 验收 + 用户签署**；记录落点 `.scratch/level-playability-v1.1-i02/reports/07-u5-incremental-authorization.md`（U5-00 创建）
Baseline: `wayfinder/level-playability-v1.1-i02` @ `b41f076`（含 U1–U4 全部实现、R1–R4 报告与签署）
Branch: `wayfinder/level-playability-v1.1-u5`
PR target: `wayfinder/level-playability-v1.1-i02`
Status: open · 2026-11-13 · U5-AUDIT 完成（AC-08～AC-13 全 PASS）；U5-SIGN 为下一 frontier 票

> **执行型 effort。** 本图 override wayfinder 默认的 plan-only：票是执行切片，不是纯决策。执行范围**严格等于**已签署授权包的 U5（I02-05）；**不设 R5**，最终由完成报告 + AC-08～AC-13 + 最终审计 + 用户签署收口。
>
> **U5 只做模型内结果与证据**：`internalResult` / `certificate` 可以组装，但 `publicCapability` 恒 `BLOCKED`；**不接生产、不发布 `PUBLIC_NB` / `PUBLIC_PU`、不做 I-03 接线**。
>
> 任何新增产品文件 / 白名单外修改 / 新依赖 / 新 JSON fixture / 扩 `DegradationReason` 或 `BudgetProfile` / 修改已签署授权包 ⇒ STOP + HITL，不得由票自行扩权。
>
> 推送 / 建 PR / 合并 / i02 → main 不在本图授权内；需另行明确指令。

## Destination

**U5（预算与确定性硬化、A–J 矩阵、性能证据、最终集成与完成报告）完成，经 AC-08～AC-13 最终审计与用户签署，地图收口。**

完成条件：

1. `temporal.ts` 内部组装与派发就位：门区半部（U3）+ 图割半部（U4）汇成 D9 `TemporalInternalResult` / `PermanentGateProof`；`puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` 按 D4/D9 填充；生产入口行为不变。
2. 预算与确定性硬化：工作预算为唯一语义预算、墙钟 abort-only、累计 cut（segments）、Witness 体积、非法预算与派生上界、`determinismSignature` 与规范化序列化。
3. A–J 矩阵（`playability-temporal.test.ts`）与双档 lag 证据隔离回归通过。
4. 性能证据：`.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs` + 语料 SHA + p50/max + 环境 + 跨进程确定性签名；**只作证据，不作 CI 门禁**。
5. LP-06 / LP-07 acceptance 脚本与冻结基线逐项比较，任何差异已分析并登记。
6. 完成报告写明：已证明结论、仍为 `INSUFFICIENT_EVIDENCE` 的结论、预算 / 确定性 / 性能证据、未覆盖项。
7. 最终审计（AC-12 / AC-13）通过；用户签署 U5。
8. 地图收口；**不发布公共能力，不启动 I-03。**

**U5 完成不等于 `PUBLIC_NB` / `PUBLIC_PU` 获准；公共能力仍由 I-03 独立准入。**

## Notes

### 授权与范围

- 增量授权：用户 `amber` · 2026-11-13 · 「开 U5 地图」；依据 R4 PASS + U4-SIGN（2026-11-13）与授权包 §7.3 / §9.5。
- U5 允许文件（授权包 §5.2：**既有白名单文件，不新增产品文件**）：
  - `packages/contracts/src/playability/temporal.ts`（内部入口 + 组装 + 最小编排）
  - `packages/contracts/src/playability/temporal-result.ts` / `temporal-budget.ts` / `temporal-motion.ts` / `temporal-witness.ts` / `temporal-gate.ts` / `temporal-evasion.ts`（仅在缺口处修改）
  - `packages/contracts/tests/playability-temporal*.test.ts`（含新建 `playability-temporal.test.ts`；A–J 矩阵）
  - `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`，可扩展）
  - `.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs`（性能证据，路径冻结）
- 只读引用（不得修改）：`graph.ts`、`reach.ts`、`profile.ts`、`targets.ts`、`game-config.ts`、`geometry.ts`、`spatial.ts`、`completion.ts`。
- **生产接线零改动**：`ops.ts`、`mechanic.ts`、`api.ts`、Runtime / Pipeline / CLI / MCP 不改；T-57 / T-58 / T-61 原样通过。
- 不授权：`PUBLIC_NB` / `PUBLIC_PU`、I-03、新依赖、JSON fixture、`fixtures/packs/**`、公共 Contract / barrel export、按关卡配置预算。
- 预算如需扩 `BudgetProfile` 或 `DegradationReason` 闭集 ⇒ STOP + HITL。
- 增量签署记录 `.scratch/level-playability-v1.1-i02/reports/07-u5-incremental-authorization.md`；完成报告 `.scratch/level-playability-v1.1-i02/reports/U5-completion.md`；最终审计 `.scratch/level-playability-v1.1-i02/reports/U5-final-audit.md`；**不改已签署授权包**（SHA `797cd6fc…` 必须保持不变）。

### U5 输出边界（冻结）

- 组装 D9 `TemporalInternalResult`：
  - `internalResult`: `"nb-candidate" | "pu-candidate" | "insufficient-evidence"`；
  - `certificate.kind`: `"witness" | "permanent-gate" | "none"`；`certificate.status`: `COMPLETE | INCOMPLETE`；
  - `publicCapability` 恒 `"BLOCKED"`；`publicResult` 恒 `null`（I-03 前）；
  - `modelConditional: true`。
- `PermanentGateProof` 六条件 `puConditions` 按 D4 §8 冻结状态；`geometryCoverage` 三份均 `partial` / `unverified`；`lagMode = "gate-independent; witness-only"`；`lagInvariantByConstruction: true`。
- **不得**把 `nb-candidate` / `pu-candidate` 写成公共 Verdict；不得删除 / 放宽 T-57 / T-58 / T-61。

### 冻结语义（引用）

- **D5 / D5B**：工作预算是唯一语义预算；墙钟 abort-only；`maxStates 500k/1M`、`timeBudget 2s/10s`、`maxCutsPerBranch 5M/10M`（segments = cutPoints + 1）、`maxWitnessTransitions 1M`、`maxWitnessBytes 64 MiB`、`maxHopSamples 240/arc`、`timeBudgetCheckpointWork 1024`；`maxEdges` 防溢出。
- **D7 §8**：A–J 矩阵、数值边界、证明健全性反例、双档 lag、预算 / 确定性测试、性能证据口径、LP-06/07 回归。
- **D8 / §9.5**：U5 不设 R5；完成报告 + AC-08～AC-13 + 最终审计 + 用户签署。
- **D9**：`TemporalInternalResult` / `PermanentGateProof` 字段冻结；`puConditions` 六条齐全，`PASS` 必有 `evidence`、`BLOCKED` 必有 `blockedReason`；`status = INCOMPLETE` 至少一个降级原因。
- **D10**：全 N 个半开相位格、残差等待整格保守、策略严格递减 rank / 有限轨迹；phase 0 BFS 不构成全相位证明。
- **D3 / D4**：反例清单（D3 §11 十三条、D4 §11 十三条）继续全覆盖。
- **A–J**：A/B/C/D/E/F/G/H/I/J 的语义断言与 AC 映射见授权包 §8.2；测试标题必须带 `[I02-0x][AC-xx]` 编号。

### 执行形态

- 一票一 commit：`U5-0x: …`；每张实现票一个独立会话。
- 依赖：U5-00 → U5-01 → U5-02 → U5-03 → U5-04 → U5-05 → U5-06 → U5-07 → U5-08 → U5-AUDIT → U5-SIGN。
- 性能与 LP-06/07 证据只作 scratch 证据，不进 CI 门禁；不得用重跑 / 扩预算 / 换算法掩盖差异。
- U5-AUDIT 由未参与 U5 实现的独立会话执行（**不是 R5 门**，不授权后续单元）；U5-SIGN 只由用户完成。
- U5-08 准备 Draft PR 描述，但**不推送、不创建 PR**；推送 / 合并需另行指令。
- 不自动合并；用户签署后才讨论 PR 后续。

### 冻结的扫描约束

- T-55：contracts `src` 不引 `node:fs` / `node:crypto`；
- T-57：不新增 `auditPlayabilityTemporal(` 的生产调用者；
- T-58：生产 `analyze:` 实参仍只有 `stubTemporalAnalyzer`；
- T-61：三处生产接线不变；
- T-62：不新增 `TEMPORAL_LAG_*` 同名常量；
- T-64：不出现 `Symbol(`；
- 不新增公共 barrel 导出；`temporal-result.ts` 不得反向导入上层模块。

### 命令

```bash
pnpm build
pnpm typecheck
pnpm exec vitest run packages/contracts/tests/playability-temporal.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-budget.test.ts
pnpm test
pnpm build && node .scratch/level-playability-v1-p1/acceptance-corpus.mjs
pnpm build && node .scratch/level-playability-v1-p1/acceptance-matrix.mjs
pnpm build && node .scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs
```

### 证据落点

- 实现证据 / 临时材料 / 阶段报告：`.scratch/level-playability-v1.1-u5/`。
- 完成报告（唯一权威）：`.scratch/level-playability-v1.1-i02/reports/U5-completion.md`。
- 最终审计（AC-12 / AC-13）：`.scratch/level-playability-v1.1-i02/reports/U5-final-audit.md`。
- 证据格式沿用 E1 / E2 / E3；逐项 `PASS` / `FAIL` / `NOT_RUN`，不得用总通过率替代。

### 依赖图

```text
U5-00 初始化、增量授权台账与基线
  └─ U5-01 内部结果组装与 dispatch
       └─ U5-02 预算闭合与降级硬化
            └─ U5-03 墙钟 abort 与确定性
                 └─ U5-04 A–J 矩阵
                      └─ U5-05 双档 lag 证据隔离回归
                           └─ U5-06 性能证据
                                └─ U5-07 LP-06 / LP-07 回归
                                     └─ U5-08 白名单审计与完成报告
                                          └─ U5-AUDIT 最终审计（AC-12/13，非 R5）
                                               └─ U5-SIGN 用户签署
```

## Decisions so far

- [U5-AUDIT 最终审计（AC-12 / AC-13）](issues/10-u5-audit.md): 独立会话现场重跑；**AC-08～AC-13 全部 PASS，无 FAIL / NOT_RUN**；产品 diff 恰好 7 个白名单文件；176 files / 2877 tests；架构 65/65；LP-06/07 逐字段 + stdout 逐字节一致；bench 3 进程摘要一致。限制与残余风险见审计报告 §6。下一步用户签署。
- [U5 增量裁定 08 — F 证书形状](../level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md): 用户 amber 2026-11-13 选择方案 ③：F 使用 `certificate.kind="none"` + IE `no-permanent-gate`，保留 D9 证明完整性，不伪造门区；仅影响 F，不授权公共能力 / I-03。
- [U5-08 白名单审计与完成报告](issues/09-u5-08-audit-report.md): 产品 diff 仅 7 个白名单文件；只读 / 生产 / barrel / 依赖 / JSON 零 diff；架构 65 / 65；全量 176 files / 2877 tests；完成报告、最终审计输入包、Draft PR（未推送）就绪。**U5-AUDIT 已 PASS（2026-11-13）。**
- [U5-07 LP-06 / LP-07 回归](issues/08-u5-07-lp-regression.md): 两份 acceptance 脚本退出码 0；语料 / 矩阵计数与 U5-00 冻结基线逐项一致；evidence JSON 剔除 `generatedAt` 后逐字段相等；stdout 日志逐字节相同；差异 0，未触发 STOP；全量 176 files / 2877 tests。
- [U5-06 性能证据](issues/07-u5-06-performance.md): 冻结路径 `bench-temporal.mjs` 可复跑；记录语料 SHA/freeze、环境、两档分布、`phaseGridCapped`/N 分布、synthetic sanity 与 3 进程确定性摘要。**历史语料 20/20 在输入/几何阶段 IE，搜索分布为 0**；完成报告必须写明。新增 0 条产品测试；build/typecheck/架构/预算/全量均绿。
- [U5-05 双档 lag 证据隔离回归](issues/06-u5-05-dual-lag.md): 新增内部 `analyzeTemporalInternalTwoLag`（`first`/`second`/`combined`）；两档独立预算与逐档证据可复现；不完整保留实际预算 / 墙钟原因；完整不一致 ⇒ `lag-disagreement`；per-lag 记录不扩 D9；新增 6 条 AC-09 测试，定向 69 / 69，全量 176 files / 2877 tests。
- [U5-04 A–J 矩阵](issues/05-u5-04-matrix.md): A–J 十项 + 跨单元组合均有具名测试；新增 `resolveTwoLagInternalResults` 内部双档合并；F 按裁定 08 使用 `none`；每条断言公共边界；新增 11 条，定向 63 / 63，全量 176 files / 2871 tests。**I 的同输入不一致世界未找到（U5-05 承担）；D5 `perLagResults` 已由 U5-05 的 two-lag wrapper 提供，不扩 D9。**
- [U5-03 墙钟 abort 与确定性](issues/04-u5-03-determinism.md): 零产品改动；注入时钟确定性 abort；签名 / 规范化序列化排除 `wallClockMs` / `detail`；4 世界 × 3 档重复一致；策略 tie-break 零分歧；两个输入跨 3 进程签名 / 序列化一致；新增 7 条测试，全量 176 files / 2860 tests。
- [U5-02 预算闭合与降级硬化](issues/03-u5-02-budget.md): 工作预算为唯一语义预算；状态 / edge 不被累计 cut 抢占；恰好达上限 / 多 1 边界、非法预算 / 派生溢出、Witness 体积、`maxHopSamples`、`phaseGridCapped` 诊断与双档原因区分均有测试；新增 13 条，全量 176 files / 2853 tests；生产接线零改动。
- [U5-01 内部结果组装与 dispatch](issues/02-u5-01-assembly.md): `analyzeTemporalInternal` 组装 D9 结果；NB（W）/ PU（门区+注入图+图割+hop）/ G 部分证明 / 模型外 / 预算路径均有测试；build 0、typecheck 0、全量 176 files / 2840 tests；生产接线零改动。F（门区不成立）的证书形状已由 [增量裁定 08](../level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md) 解决（方案 ③：`none` + `no-permanent-gate`）。
- [U5-00 初始化、增量授权台账与基线](issues/01-u5-00-init.md): 基线全绿（build/typecheck 0；175 files / 2831 tests）；增量授权 07 就绪，仅 U5 实施 + AC-08～AC-13 + 用户签署（无 R5）；产品目录零 diff；LP-06/07 复跑与冻结基线逐字段一致。

## Not yet specified

<!-- 路线由已签署授权包 §4 / §5.2 / §8 / §9.5、D5 / D5B / D7 / D9 / D10 冻结；无已知雾区。任何新增产品文件 / 扩权需求 = STOP + HITL。 -->

## Out of scope

- **`PUBLIC_NB` / `PUBLIC_PU` 与任何公共 Verdict**：I-03 独立准入；`publicCapability` 恒 `BLOCKED`。
- **I-03 生产接线**：`ops.ts`、`mechanic.ts`、`api.ts`、`coverage.temporal`、Runtime / Pipeline / CLI / MCP。
- **新依赖 / JSON fixture / `fixtures/packs/**` / 新公共导出 / 公共 Contract**。
- **按关卡配置预算**；扩 `BudgetProfile` 或 `DegradationReason` 闭集（需 STOP + HITL）。
- **修改已签署授权包 / I-00 / I-02 原文**。
- **R5 门**：授权包明确不设。
- **推送、建 PR、合并、i02 → main**（另行明确指令）。
- **把 U5 完成写成公共 NB / PU 能力或 I-03 授权。**
