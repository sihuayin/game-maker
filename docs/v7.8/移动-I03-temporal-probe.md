# I-03 独立时序探针契约与 Fixture 设计草案

- **Effort**：I03-TEMPORAL-PROBE
- **实施单元**：TP1
- **状态**：DRAFT / NOT FROZEN / NOT AUTHORIZED
- **类型**：独立时序分析证据探针
- **上游契约**：I-02 D9 + I-03 §2–§5
- **目标**：验证现有时序分析模型能否对受支持输入产生真实、可复算、可独立复核的时序证据。

---

# Part A：时序探针契约

## A1. 目标与非目标

### 目标

通过独立探针执行既有时序分析路径，验证：

1. 可信输入能否进入时序分析。
2. 模型适用的输入能否完成时序分析。
3. NB Witness 候选能否产生完整、可复算的内部证据。
4. Permanent Gate 分析路径能否产生其各组成部分的证据。
5. 双档 lag 结果是否符合既有一致性规则。
6. 预算耗尽、模型不适用、输入不可信等情况能否正确降级。
7. 同一输入重复执行是否得到一致的规范化结果。

### 非目标

本 effort 不负责：

- 修改 I-02 D9。
- 修改 I-03 公共 Verdict 或公共 evidence 类型。
- 修改 Runtime 运动模型。
- 证明 Runtime 中所有可能的空中规避行为。
- 开放 `PUBLIC_NB` / `PUBLIC_PU`。
- 将 `nb-candidate` 转换为公共 `NO_PROVEN_BLOCKER`。
- 将 `pu-candidate` 转换为公共 `PROVEN_UNPLAYABLE`。
- 修改发布拒稿行为。
- 实施 Phase-2 P2 几何探针。
- 替代 P3 几何独立复核或 P6 几何证据消费。

## A2. 权威模型与来源

探针只消费现有模型，不自行定义另一套时序算法。

| 模型 / 证据 | 权威来源 | 探针责任 |
|---|---|---|
| 输入可信度 | `temporal-input.ts` | 验证 manifest、Atlas 字节、checksum、frame、anchor |
| 运动模型 | `temporal-motion.ts` | 验证三角波运动与连续碰撞区间 |
| Witness 状态空间 | `temporal-witness.ts` | 验证相位网格、静态走廊、精确 spawn、wait/move 转移及 Witness |
| Permanent Gate | `temporal-gate.ts` | 验证门区、周期覆盖、判侧和 forbidden 注入 |
| 垂直规避图割 | `temporal-evasion.ts` | 验证图割、hop 双档和采样覆盖 |
| 预算 | `temporal-budget.ts` | 验证预算解析、执行限制与降级 |
| 内部结果 | `temporal-result.ts` | 验证 NB / PU / IE、证书、统计及降级原因 |
| 公共映射 | I-03 §3 / `temporal-evidence.ts` | 验证候选摘要、coverage 和 degradation 映射，不产生公共结论 |

文件 SHA 应在契约冻结时重新读取并记录，不以本草案编写时的仓库快照代替最终基线。

## A3. 输入契约

探针输入必须来自真实、可复算的配置和资产数据。

至少包括：

- `GameConfig`；
- `AssetPackManifest`；
- 对应 Atlas 原始字节；
- 可信输入验证所需的 digest；
- 移动 Hazard 的运动参数；
- 玩家移动参数；
- 精确 spawn；
- Goal；
- 已冻结 Runtime profile；
- 两档 lag 参数；
- 预算 profile。

可信 Atlas 必须经既有 `verifyTemporalInput` 产生。

禁止：

- 直接构造或伪造 `TrustedAtlasInput` brand；
- 从 fixture 的 expected 值反推 actual；
- 用未经验证的 manifest 几何产生有效证明；
- 将 `player.at`、脚点和锚点混为一谈；
- 为使 fixture 通过而修改原始生产输入。

## A4. 双档时序契约

必须区分两种不同的“双档”概念：

**1. Witness / Temporal 分析 lag**

沿用 I-03 的两档语义：

- 主档：来自实际输入 `lagMs`；
- 基准档：来自既有 `secondLagMs`；
- 每档独立执行；
- 每档分别记录内部结果、证书状态和 degradation；
- 两档不一致时按既有 `lag-disagreement` 规则处理。

具体数值不得由探针自行重新定义，必须从冻结的 I-02 输入契约和实现中读取。

**2. Permanent Evasion hop 采样双档**

沿用 U4 已冻结的：

- 60Hz / 120 samples；
- 120Hz / 240 samples。

必须分别记录两档的可达性、弧采样、覆盖情况和 cap 状态。

不得把 lag 双档与 hop 双档混为一个测试维度。

## A5. 结果契约

每个 fixture 的结果至少记录：

- fixture ID；
- 输入摘要及 SHA-256；
- 契约版本；
- 探针版本；
- 可信输入验证结果；
- 是否适用；
- 内部结果状态；
- 证书种类及状态；
- 每档 lag 结果；
- Permanent Gate / Evasion 分项结果（适用时）；
- 预算状态与预算类别；
- 主降级原因及次级降级原因；
- Witness 体积与转移数量；
- determinism signature；
- 原始结果文件摘要。

内部状态必须保留为：

- `nb-candidate`
- `pu-candidate`
- `insufficient-evidence`

证书状态必须保留为：

- `COMPLETE`
- `INCOMPLETE`

探针不能把这些状态重新映射为公共 Verdict。

## A6. Coverage 与降级语义

沿用 I-03 的既有语义：

| Coverage | 语义 |
|---|---|
| `checked` | 输入有效、模型适用、两档均完成且无禁止性降级 |
| `partial` | 分析已开始，但因预算、墙钟或 Witness 体积等原因不完整 |
| `unknown` | 不适用、输入无效、模型外、几何不可信或没有可消费的时序结果 |

特别要求：

- `checked` 不代表 NB 证据准入。
- `checked` 不代表 Runtime 完全可达。
- `partial` 不得升级为 `checked`。
- `unknown` 不得通过静态层结果回退成 `checked`。
- IE 不得被解释为安全结论。

## A7. PU 证明边界

Permanent Gate 和 Evasion 的完整证据必须保留其分项。

至少包含：

- `gate`
- `periodCoverage`
- `sideRule`
- `forbiddenInjection`
- `graphCut`
- `hopDoubling`
- `hopSamplingCoverage`
- `movementModelClosure`
- `puConditions`
- `geometryCoverage`
- `lagMode`
- `lagInvariantByConstruction`

不得以单个 `gateStatus=COMPLETE` 代替完整 `PermanentGateProof`。

不得以 `midAirHits=0` 作为不存在空中规避的正面证明。

现有 `movementModelClosure="not-proven-air-control"` 必须保留。即使模型内部证书完整，也不能宣称 Runtime 空中控制已经闭合。

当前几何证据和模型外排除条件仍受 I-03 既有约束；本探针不能将它们自行升级为 PASS。

## A8. 确定性

同一 fixture、同一输入摘要、同一探针版本：

- 规范化内部结果一致；
- 证书结构一致；
- Witness 语义内容一致；
- degradation 一致；
- determinism signature 一致。

规范化时可以排除纯运行环境字段，但不得排除影响证明正确性的字段。

墙钟时间、预算执行统计等字段应与语义证明分开记录，不能为了 hash 一致而删除真实的预算失败证据。

## A9. 输出与证据布局

建议独立 scratch 目录：

```text
.scratch/level-playability-v1.1-i03-temporal-probe/
├── contract/
│   └── temporal-probe-contract.md
├── fixtures/
│   ├── manifest.json
│   ├── positive/
│   ├── negative/
│   └── regression/
├── scripts/
├── evidence/
│   ├── raw/
│   ├── normalized/
│   └── hashes/
└── reports/
```

每个批次生成独立报告，不覆盖历史证据。

原始内部 proof / Witness 只留在受控 scratch evidence 中；不得复制到公共 evidence 或产品持久化结构。

## A10. STOP

遇到以下情况必须 STOP：

1. 需要修改 I-02 D9。
2. 需要改变 I-03 公共 evidence / Verdict 语义。
3. 需要修改 Runtime 运动行为。
4. 需要伪造可信输入。
5. 无法构造模型适用的有效输入。
6. 需要修改预算硬上限才能得到预期结果。
7. 需要把模型外规避解释成已证明不可达。
8. 无法复现 Witness 或 determinism signature。
9. 需要修改 `PUBLIC_NB` / `PUBLIC_PU` gate。
10. 需要修改 Phase-2 P2 几何契约或 14＋11 manifest。

---

# Part B：时序 Fixture 设计草案

## B1. Fixture 设计原则

Fixture 数量不预设为 14＋11。

每个 fixture 必须有：

- 唯一 ID；
- 输入文件和 hash；
- 覆盖的模型路径；
- 预期内部状态；
- 预期证书类型；
- 预期证书状态；
- 预期 coverage；
- 预期 degradation；
- 关键反证；
- 可独立复算的断言。

Fixture 必须覆盖真正的时序路径，而不是只测试输入校验或静态几何。

## B2. Fixture 分组

### T-NB：NB Witness 路径

| 候选 ID | 目标路径 | 预期断言 |
|---|---|---|
| T-NB-01 | 有效输入 + 模型适用 + 完整 Witness | 目标为 `nb-candidate` / `witness` / `COMPLETE`，两档均完成 |
| T-NB-02 | U9 安全等待格证书路径 | 验证 wait / move 转移、终止性和 Witness 派生 |
| T-NB-03 | Winning Set 路径 | 验证全相位 Winning Set 与 phase coverage |
| T-NB-04 | 无有效安全 Witness | 保留 IE，不得产生 NB 结论 |
| T-NB-05 | 两档 lag 结果不一致 | 保留逐档结果，合并结果按 `lag-disagreement` 降级 |

T-NB-01 是核心正向 fixture。

如果不能构造满足真实输入契约的有效 Witness，必须记录阻塞原因，不能将静态 NB 候选替代。

### T-PU：Permanent Gate / Evasion 路径

| 候选 ID | 目标路径 | 预期断言 |
|---|---|---|
| T-PU-01 | Permanent Gate 几何成立 | 产生门区相关证据，不自动产生公共 PU |
| T-PU-02 | 全周期覆盖 | 验证周期覆盖区间及完整性 |
| T-PU-03 | 门宽不成立 | `no-permanent-gate` 或对应冻结降级 |
| T-PU-04 | 图割命中目标 | 不得产生完整不可达证明 |
| T-PU-05 | hop 双档连通性变化 | 按 `hop-doubling-changed` 降级 |
| T-PU-06 | hop 采样 cap 绑定 | 按 `hop-sample-budget` 降级 |
| T-PU-07 | 完整内部 Permanent Gate 组合 | 验证所有组成部分的来源和组合，不得绕过 PU 条件 |

T-PU 组的目标是验证既有内部证明链。

即使内部证书达到 `COMPLETE`，也不得把它解释为公共 PU 已准入。几何检查和模型外排除仍须遵守 I-03 的独立门槛。

### T-LAG：双档一致性

| 候选 ID | 目标路径 | 预期断言 |
|---|---|---|
| T-LAG-01 | 两档得到一致结果 | 保留两档独立结果 |
| T-LAG-02 | 两档结果不一致 | 合并结果为 IE，原因可追溯 |
| T-LAG-03 | 单档预算耗尽 | 不得把双档 coverage 标记为 checked |

### T-BUDGET：预算与中止

| 候选 ID | 目标路径 | 预期断言 |
|---|---|---|
| T-BUDGET-01 | state budget 耗尽 | IE + budget-exhausted |
| T-BUDGET-02 | edge budget 耗尽 | IE + budget-exhausted |
| T-BUDGET-03 | cut budget 耗尽 | IE + budget-exhausted |
| T-BUDGET-04 | wall-clock abort | IE + wall-clock-abort |
| T-BUDGET-05 | Witness volume 超限 | IE + witness-volume |
| T-BUDGET-06 | hop sample budget 不足 | IE + hop-sample-budget |

具体预算值必须在 fixture 冻结时依据现有硬上限和预算解析规则确定，不能通过放宽生产上限制造通过。

### T-INPUT：输入与模型适用性

| 候选 ID | 目标路径 | 预期断言 |
|---|---|---|
| T-INPUT-01 | Atlas checksum 错误 | 输入验证失败，不进入有效证明 |
| T-INPUT-02 | Frame 缺失 / 尺寸不一致 | 输入验证失败 |
| T-INPUT-03 | Anchor 缺失或不匹配 | 输入验证失败 |
| T-INPUT-04 | spawn 不在整数格 | `spawn-not-on-lattice` |
| T-INPUT-05 | goal 不可表示 | `goal-not-representable` |
| T-INPUT-06 | goal 矩形退化 | `goal-rect-degenerate` |
| T-INPUT-07 | 模型外运动 | `model-out` |
| T-INPUT-08 | 几何不可信 | `geometry-untrusted` |

### T-REGRESSION：现有移动配置回归

当前 19 个 moving configs 全部在时序层提前返回 IE：

- 11 个 `goal-not-representable`；
- 6 个 `model-out`；
- 2 个 `spawn-not-on-lattice`。

这些配置应作为独立回归 cohort 保留。

要求：

1. 能够复现既有输入与结果。
2. 每个配置保留原始 ID 和输入摘要。
3. 验证原因码不发生非预期变化。
4. 不把这 19 个 IE 样本统计成成功的时序 NB / PU 证据。
5. 不通过修改输入来消除历史 IE。

## B3. Fixture 冻结准入

每个 fixture 在冻结前必须通过：

- 输入可复算；
- 模型路径明确；
- expected 有现有模型依据；
- 反证条件明确；
- 不依赖人工编辑输出；
- 不依赖生产代码变更；
- 重复执行可比较；
- 与其他 fixture 的单变量差异可解释。

对于无法形成有效正向 Witness 的候选 fixture，状态应为 `BLOCKED` 或 `NOT_READY`，不能通过弱化 expected 让它进入冻结集合。

## B4. Fixture 数量

不沿用几何 14＋11 数量。

最终数量由覆盖矩阵决定：

- 至少有真实 NB Witness 正向路径；
- 覆盖 Permanent Gate / Evasion 组成路径；
- 覆盖 lag 一致与不一致；
- 覆盖预算与中止；
- 覆盖输入无效和模型不适用；
- 覆盖 19 个现有移动配置的历史 IE 回归。

如果某条路径无法构造，应将其列为明确缺口，不得用增加其他 fixture 数量来掩盖。

---

# Part C：验收标准

## AC-T01：契约来源

所有字段、状态和原因码均能追溯到 I-02 / I-03 已冻结定义。

## AC-T02：真实时序路径

至少有一个有效 NB Witness fixture 实际进入时序分析并产生可复算证据。

## AC-T03：PU 分项证据

Permanent Gate / Evasion 相关 fixture 能分别验证各组成部分；不把局部结果当完整证明。

## AC-T04：双档

两档独立执行，能够验证一致与不一致两类路径。

## AC-T05：降级

输入错误、模型外、预算耗尽、墙钟中止、Witness 体积和采样限制均保留正确原因。

## AC-T06：确定性

相同输入重复执行，规范化结果和确定性签名一致。

## AC-T07：历史回归

19 个既有 moving configs 的 IE 原因保持可追溯，不伪装成有效 NB / PU。

## AC-T08：能力隔离

所有 fixture 执行后：

- `publicCapability = "BLOCKED"`；
- `publicResult = null`；
- 不改变公共 Verdict；
- 不改变 publish-gate 行为。

## AC-T09：独立复核准备

完整交付输入 hash、fixture manifest hash、探针版本、命令、原始输出、规范化输出和复算说明。

---

# Part D：治理关系与授权边界

## D1. 上游权威

本 effort 继承：

1. `docs/v7.8/移动-I03.md` 已签署的公共证据语义；
2. I-02 D9 已冻结的内部时序结果和证明定义；
3. I-03 已签署的能力 gate、降级和发布边界。

本 effort 不修改上述上游文件。

## D2. 与 Phase-2 annex 的关系

`docs/v7.8/移动-I03-phase2.md` 继续保持原样。

其中：

- P1 是几何 probe 契约与夹具物化；
- P2 是几何 probe 实施；
- P3 是几何证据独立复核；
- P6 是 AC-14 几何证据消费。

本 effort 不得：

- 把几何 P2 改称时序 P2；
- 把 14＋11 几何 fixture 纳入时序 fixture manifest；
- 把时序探针结果作为 P3 几何复核证据；
- 将本 effort 完成视为 AC-14 PASS；
- 修改 Phase-2 Ledger。

## D3. 独立治理单元

新增独立 effort：

`I03-TEMPORAL-PROBE`

新增实施单元：

`TP1`

TP1 必须拥有独立：

- 契约；
- fixture manifest；
- hash；
- 文件白名单；
- STOP 条件；
- 实施授权记录；
- 实施分支；
- 证据目录；
- 独立复核报告；
- 用户签署记录；
- Ledger。

## D4. 授权顺序

1. 本草案评审。
2. 时序契约与 fixture 逐项冻结。
3. 生成契约和 manifest SHA-256。
4. 编制 TP1 独立增量授权记录。
5. 用户签署 TP1 授权记录。
6. docs-only PR 合入 `main`。
7. 从授权后的 `main` 切独立实施分支。
8. TP1 实施、执行和证据归档。
9. fresh 独立复核。
10. 用户签署实施结果并更新独立 Ledger。

**本草案不构成 TP1 实施授权。**

## D5. 本阶段允许范围

本阶段仅允许：

- 只读分析现有 I-02 / I-03 契约；
- 编写时序探针契约；
- 编写时序 fixture 设计；
- 形成覆盖矩阵；
- 编写治理补充文件；
- 计算并记录文档 hash。

本阶段不允许：

- 修改 `packages/**`；
- 修改 `fixtures/**` 产品数据；
- 修改 Phase-2 P1 / P2 资产；
- 执行生产代码变更；
- 新增依赖；
- 修改 CI；
- 开放公共能力；
- 付费调用。

---

## 当前裁定

- [ ] 时序契约已冻结
- [ ] Fixture manifest 已冻结
- [ ] 覆盖矩阵已独立评审
- [ ] TP1 授权记录已生成
- [ ] 用户签署
- [ ] docs-only PR 合入

当前状态：**DRAFT / BLOCKED / NOT AUTHORIZED**

签署人：待定

签署日期：待定

契约 SHA-256：冻结后填写

Fixture manifest SHA-256：冻结后填写