# I03-05 PUBLIC_PU 独立准入链

Type: grilling
Status: resolved
Owner: claude (I03-05 session 2026-11-14)
Blocked by: 01, 02, 03, 04, 13, 14, 15, 16
Map: ../map.md
Class: I-03 / DECISION

## Question

`PUBLIC_PU` 的独立准入条件与持续 `BLOCKED` 的机制；至少覆盖几何 `checked`、空中控制 / 模型外规避闭合、hop 图割与加倍采样完整性、I-00 六项 PU 条件、独立审查与增量授权。

### 必须裁定

- 每项条件的证据与 gate；
- PU 与 NB 的独立性；
- 任何一项未满足时 `publicCapability="BLOCKED"` 的表达；
- 假 PU 的负向测试与停止规则；
- 不得因 NB 通过推导 PU 可用。

### 禁止

- 在几何 / 空中控制 / hop 未闭合时开放 PU；
- 用内部 `pu-candidate` 直接发布 `PROVEN_UNPLAYABLE`；
- 把 NB 准入当作 PU 准入。

### 验收

PU 条件表、gate 状态、独立审查 / 授权路径、负向场景、持续 BLOCKED 的机制。

## Answer

**Q1=A / Q2=A / Q3=A / Q4=A / Q5=A。** 冻结 `PUBLIC_PU` 独立三阶段准入链与六条件 gate；**不授权生产实施、不开放 `PUBLIC_PU`**。条件 5 由新的独立闭合票承担，不能用 U4 conditional 图割或 NB 结果替代。

### 0. 状态机

| 阶段 | 名称 | 公共 gate | 公共结果 | 进入条件 |
| --- | --- | --- | --- | --- |
| 1 | **WIRED** | `BLOCKED` | IE | 生产链路能消费内部 PU candidate；候选只作非结论证据 |
| 2 | **ADMITTED** | `BLOCKED` | IE | 六条件全 PASS + 固定 PU 夹具通过 + 独立复核 |
| 3 | **OPEN** | `OPEN` | 逐关通过六条件后 `PROVEN_UNPLAYABLE` | 独立复核 + 用户显式授权 + gate 变更 |

- 三阶段独立记录；内部 candidate 出现不等于能力开放。
- `ADMITTED` 不等于 `OPEN`。
- `PUBLIC_PU` 与 `PUBLIC_NB` 完全独立；NB 的 `NO_PROVEN_BLOCKER` **不能**作为 PU 的任何正面证明。

### 1. 六条件 gate（Q2）

| # | 条件 | 当前约束 | 状态语义 |
| --- | --- | --- | --- |
| 1 | 永久门区证明 | 必须完整 PASS | 全周期闭式覆盖 + 判侧 + forbidden 注入完整 |
| 2 | 几何可信 | `hazard / player / graph` 全部 checked | **当前 BLOCKED**（geometry partial；A/B/C evidence 未实现） |
| 3 | 图割证明 | 完整、可信、无可达路径 | 模型内图割 + hop 完整；**不等于 Runtime 不可达** |
| 4 | Hop 采样 | 双档完整、一致，无采样预算问题 | U4 `hopDoubling` / `hopSamplingCoverage` 完整 |
| 5 | 模型外规避闭合 | 必须独立 PASS | **当前 BLOCKED**；由 I03-PU-Air-Control-Closure 独立闭合 |
| 6 | Lag 证明 | 满足冻结的 lag 语义及双档要求 | 构造性 `lagInvariantByConstruction` + 两档证据 |

```ts
type PUConditionStatus =
  | "PASS"
  | "BLOCKED"
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_RUN";
```

聚合规则：

- 六项全部 `PASS` 才允许进入 `ADMITTED`。
- 任一项 `BLOCKED` / `INSUFFICIENT_EVIDENCE` / `NOT_RUN` ⇒ 不得进入 `ADMITTED`。
- 不使用总分、加权、通过率或多数决。
- `ADMITTED` 仍不等于 `OPEN`。
- **当前条件 2 和条件 5 硬阻断**；即使 1/3/4/6 通过，也不能开放 `PUBLIC_PU`。

### 2. 空中控制与模型外规避闭合（Q3）

新建独立决策票：

[`I03-PU-Air-Control-Closure — 空中控制与模型外规避闭合证据`](18-i03-pu-air-control.md)

该票必须冻结：

1. 必须排除的模型外规避行为（空中水平控制、walk-off 漂移、moving platform、y 轴、其他未建模运动）。
2. 需要的 Runtime / 控制能力证据。
3. 证据产生者与产生方式。
4. 负向测试矩阵。
5. 独立复核人与复核标准。
6. `PASS / FAIL / INSUFFICIENT_EVIDENCE` 判定规则。

在该票闭合之前：

- PU 条件 5 恒 `BLOCKED`；
- `PUBLIC_PU` 恒 `BLOCKED`；
- U4 conditional graph cut 只证明模型范围内不可达，**不能**证明 Runtime 实际不可达；
- `midAirHits = 0` **不能**作为模型外规避不存在的正面证据。

本票的 PU admission 规则不能绕过这一点。

### 3. Admission 夹具（Q4）

固定夹具集三类：

**Synthetic PU 正例（必须通过）**

- 永久门区完整；
- 图割完整；
- Hop 双档完整且一致；
- 所有模型内证明条件满足。

**False-PU 负例（必须拒绝）**

- N1 上方绕行；
- N2 下方坑道；
- `midAirHits = 0` 不得被当作模型外排除证据；
- 部分路径；
- 局部封锁；
- 采样漏检。

**真实 IE 负例（必须保持 IE）**

- 几何证据不足；
- 模型外行为未闭合；
- 双档不一致；
- 预算耗尽或证明不完整。

要求：

- 夹具先冻结并记录 hash；禁止事后调整样本取得通过。
- 正例必须真实满足完整准入合同，不能弱化条件制造正例。
- 每个 False-PU 负例有明确预期拒绝原因。
- U4 现有合成测试只作部分证据，不能替代完整 admission fixtures。
- 19 关历史语料仍只承担 IE 不回归验证。

### 4. 公共结果、粒度与回滚（Q5）

公共 PU 结果：

```ts
{
  verdict: "PROVEN_UNPLAYABLE",
  coverage: {
    // 沿用现有 PlayabilityCoverage；至少：
    temporal: "checked",
    geometry: "checked",
  },
  evidence: {
    // I03-01 的完整公共 temporal evidence summary
    // 必须包含六条件的可审计摘要
  },
}
```

- **不新增公共 `publicCapability` 字段。**
- I-02 内部 `publicCapability="BLOCKED"` / `publicResult=null` 保持原样。

能力粒度：全局 `PUBLIC_PU` gate；gate `OPEN` 后，每关仍须独立满足六条件 + 完整证据准入。

假 PU 回滚：

1. 全局 `PUBLIC_PU` gate 立即关闭。
2. 所有受影响公共 PU 结果退回 `INSUFFICIENT_EVIDENCE`。
3. 按基线元组使相关证据失效。
4. 关闭优先于缓存、历史产物、逐关准入结果。
5. 重新开放需根因分析、修复、独立复核、用户显式授权。
6. 禁止只回滚当前关卡而让全局能力继续开放。

证据基线元组至少包含：`algorithmVersion`、`geometryBaseline`、`proofRulesVersion`、`fixtureVersion`、`puAdmissionRulesVersion`。假 PU 时所有依赖同一元组的结果失效。

### 5. 不可逆向推导

- **NB 通过不代表 PU 通过**；NB 的 `NO_PROVEN_BLOCKER` 不能作为 PU 的任何正面证明。
- PU 证明目标（不可达）与 NB（存在安全路径）不同，必须走独立准入链。
- `midAirHits = 0` / conditional 图割 / 无 witness 都不能单独支持 PU。

### 6. 边界

- 不授权生产接线、WIRED / ADMITTED / OPEN 实现、`publish-gate` / `api.ts` / `mechanic.ts` / Runtime 修改。
- 不开放 `PUBLIC_NB` / `PUBLIC_PU`；不改变 publish rejection。
- 全部进入 I-03 授权包；I03-09 必须写入 PU 状态机、六条件 gate、空中控制闭合票、admission fixtures / hash、公共结果、回滚与基线失效。
- 当前条件 2 与 5 是硬阻断；`PUBLIC_PU` 仍 `BLOCKED`。

### 7. 下游

- **I03-06**：publish-gate 消费规则，与 PU 独立。
- **I03-PU-Air-Control-Closure**：条件 5 闭合；未闭合前 PU 不得 ADMITTED / OPEN。
- **I03-07 / I03-08 / I03-09**：白名单、验收矩阵、授权包组装。
- 最终 PU OPEN 仍需独立复核 + 用户显式授权；本票不构成任何实施授权。
