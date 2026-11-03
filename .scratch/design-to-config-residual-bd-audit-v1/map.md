# Design-to-Config Residual B/D Audit V1：B/D 残余范围的决策就绪方案

Labels: wayfinder:map
Tracker: local-markdown
Effort: design-to-config-residual-bd-audit-v1
Baseline: `main` @ `3b1b61d`
Predecessors:
- [`design-to-config-residual-audit-v1`](../design-to-config-residual-audit-v1/map.md)（P0-A/P0-B；已收口）
- [`design-to-config-residual-audit-v1-p1`](../design-to-config-residual-audit-v1-p1/map.md)（A 类七项；已实施）

> **2026-11-03 开图。** 输入：`docs/v7.7/配置.md`（只读冻结）、P0 `final-report.md` §4 的 B/D 行、
> P1 实施后的当前源码。**本图不实施**；终点是可供 P1 审批的方案，不构成任何实施授权。

## Charter（Q1–Q8 冻结裁定，2026-11-03）

| 问题 | 裁定 | 核心约束 |
|---|---|---|
| Q1 Destination | 1 | 决策就绪方案，停在审批门前；不改生产代码 |
| Q2 Motivation | 1 + 局部 2 | P0 基线 + **P1 后当前源码复核**；历史推断不得直接列为修复项 |
| Q3 Scope seed | 2 | P0 §4 六组为 seed；允许有证据地增减，不得无声扩张 |
| Q4 修复门槛 | 四项全过（AND） | 当前成立 + 判据可写 + 语料零误伤 + 修改面可控 |
| Q5 契约变更 | 1 | 进方案、单列审批；必须带替代方案与不做的后果 |
| Q6 切票 | 1 | B/D 两研究 → HITL 裁定 → 方案票 → 收口票 |
| Q7 裁定粒度 | 1 | 逐原子项裁定（B-01…B-07、D-01…D-04，共 11 项） |
| Q8 推迟去向 | 1 | 可指名后续 effort，必须附交接说明 |

**四项门槛（AND，不加权）**

1. **当前仍成立**：有 E1 源码定位，且至少有 E2 确定性测试或 E3 零付费复现之一；仅历史推断不算。
2. **判据可写**：符合 `CONTEXT.md` 的判据门槛——精确、可计算，且错误必然不是设计意图。
3. **语料零误伤**：对现有 `out/**`、`fixtures/**`、`.scratch/**` 全量重判；新增 error 为 0，
   或每一处新增 error 都能解释为真实缺陷。
4. **修改面可控**：不新增依赖、不改 Runtime、不改变 CLI/MCP 对外形状；超出边界的契约级变更
   **不是禁止**，而是必须按 Q5 单列审批，不得混进普通修复。

**处置规则**

- 四项全过 ⇒ 进入修复方案。
- 任一项不过 ⇒ 推迟，记录缺失证据或不满足的条件。
- 当前问题已不存在 ⇒ 剔除，不再以推迟项保留。
- 发现原分类不正确 ⇒ 提出范围变更建议，不自行改写旧裁定。

**契约变更呈现（Q5）**：每项必须给出变更内容与必要性、替代方案（含不改契约能否解决）、
影响面（生产者/消费者/序列化/测试/历史数据）、不实施的后果、单独审批点及前置条件。

**推迟交接（Q8）**：每项必须记录推迟原因、推荐后续 effort、交接时必须重新确认的事实与条件、
后续 effort 启动时需要补充的证据、本图没有替后续 effort 作出的决定。

## Destination

在 P1 审批门前交付 **Design-to-Config Residual B/D Audit V1**：以 P0 的 B/D 六组为 seed，
逐原子项复核 P1 后的当前源码与证据，按四项门槛裁定「修复 / 推迟 / 剔除 / 范围变更建议」；
对修复项形成最小修改面、契约变更单列、测试矩阵与零付费验证方案。
**不修改生产代码、不修改契约、不启动付费模型调用、不生图；本图不构成任何实施授权。**

## Notes

### 权威与输入

- PRD（只读冻结）：`docs/v7.7/配置.md`。
- P0 收口报告（B/D 初始候选来源）：[`final-report.md`](../design-to-config-residual-audit-v1/final-report.md) §4。
- P0 审计票：[下游 01](../design-to-config-residual-audit-v1/issues/01-downstream-validation-audit.md)、
  [上游 02](../design-to-config-residual-audit-v1/issues/02-upstream-planning-audit.md)。
- P1 实施与证据：[`map.md`](../design-to-config-residual-audit-v1-p1/map.md)、[`report.md`](../design-to-config-residual-audit-v1-p1/report.md)。
- 领域词汇：`CONTEXT.md` 是唯一权威；本图不新增同义词。
- 基线：`main` @ `3b1b61d`；研究票中的行号均指该基线。

### 原子项与归属

| 编号 | 原子项 | 研究票 | 复核重点 |
|---|---|---|---|
| B-01 | Q2：sprite 内部语义 / `role` 无人读 | 01 | P1 是否增加了机读语义，还是仍只有资源形态约束 |
| B-02 | Q7：`reachability` 只在 QA | 01 | 当前 QA 覆盖是否充分；是否仍应留在 QA 层 |
| B-03 | Q10(a)：地形仅有提示词线索 | 01 | 既有裁定是否仍有效，是否存在新的契约事实 |
| B-04 | Q10(b)：layout 散文表达 | 01 | 同上 |
| B-05 | Q10(c)：斜坡无独立槽位 | 01 | 同上 |
| B-06 | `interactables` 同桶误归属 | 01 | 是否仍属于既有冻结限制，不借本图重开旧裁定 |
| B-07 | `decor` 无 kind 锁 | 01 | 同上 |
| D-01 | Q9：`viewport` 贯通 | 02 | P1 后参数贯通是否仍有缺口 |
| D-02 | Q9：`role` 贯通 | 02 | 横版/塔防清单不对称是否仍存在 |
| D-03 | Q9：`modelHard` 归因与重采样反馈 | 02 | 失败归因与盲重采样是否仍有缺口 |
| D-04 | Q10(d)：设计层缺少 goal 桶 | 02 | 是否仍需要设计表达或契约层面的独立改动 |

### 执行纪律

- **零付费、零模型调用、零生图**；只用既有 fixture、mock transport、既有运行产物与确定性测试。
- **只读**：不修改生产代码、测试、fixture、契约、CLI/MCP 或历史冻结证据。
- **不 commit、不建分支、不推送 `main`**；研究产出写在 `.scratch/design-to-config-residual-bd-audit-v1/`。
- 不 `reset`/`clean`；不覆盖既有 run / pack / site 版本。
- 证据分级：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据。
- **B-06 / B-07 尊重既有裁定**：`entity-identity-v1.1` 已把 `interactables` 同桶误归属列为已知限制。
  本图只复核它是否仍成立、是否已被 P1 消除；若仍成立且无新证据，处置必须尊重旧裁定
  （推迟或剔除），不得静默改裁。

### 票流

1. [01 B 类当前源码复核](issues/01-b-class-audit.md)（research）与
   [02 D 类当前源码复核](issues/02-d-class-audit.md)（research）并行。
2. [03 统一裁定](issues/03-disposition-ruling.md)（grilling，HITL，依赖 01/02）逐原子项处置。
3. [03 统一裁定](issues/03-disposition-ruling.md) 已收口：4 项修复、7 项推迟、0 剔除、0 范围变更。方案票与收口票的切法留到下一轮；裁定不构成实施授权。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->
- [B 类当前源码复核：Q2 / Q7 / Q10(a)(b)(c) / interactables / decor](issues/01-b-class-audit.md)：B-01…B-07 在 P1 后全部仍成立，P1 未消除任何一项。Q2 仍无 `sprite` 内部语义（`semanticClass` 必填会缺 1599 件资产）；`reachability` 仍只在 QA（134 对重判 0 新 error）；地形/layout 仍是 prose、无 slope 槽位；`interactables` 同桶误归属与 `decor` 无锁仍是既有冻结限制（`decor` 锁 `sprite|animation` 会误伤 39 个 config 副本，排除 background 则 0）。E2 194 tests、E3 5243 JSON 重判。**处置未定，归 03。**
- [D 类当前源码复核：viewport / role / modelHard / 设计 goal 桶](issues/02-d-class-audit.md)：D-01…D-04 在 P1 后仍全部成立（E1+E2/E3）。viewport 仍有规划/VDS/compile/site 参数分叉（常量同值 480×270，生产壳无可观察失败；E3 500×280 复现）；横版清单不打印 `role`、塔防打印；三发 body 逐字相同、`lastError` 不回灌，包根因仍写「模型错」；设计无 goal 桶且 `winConditions` 可为空，config 靠孤儿 gate，设计侧判据 43/43 误伤。**处置未定，归 03。**
- [统一裁定：B/D 11 个原子项的处置](issues/03-disposition-ruling.md)：10 个口径问题收敛为 4 修复（B-02 deterministic、D-01 贯通 viewport、D-02 打印 role、D-03 限定归因/反馈）、7 推迟、0 剔除、0 范围变更；D-03 不新增对外归因码；B-02 第二半 publish-gate 身份绑定独立待核实；方案票切法留到下一轮。

## Not yet specified

- **方案票的数量与切法**：03 已确认 4 项修复（B-02、D-01、D-02、D-03），但按用户裁定，分组 / 逐项开票留到下一轮；不得预先展开为实施承诺。
- **收口票与 P1 审批包形态**：是否沿用 P0 的 `final-report.md` + 审批问题清单，留到下一轮。
- **付费模型验证的方案边界**：D-02 / D-03 的收益需付费验证；方案须写清零付费可验证内容、付费验证要回答的问题、预算与授权门槛、回退 / 停止条件。具体问题清单待方案票起草时确定。
- **B-02 第二半：publish-gate 的 config 身份绑定**：`publish-gate` 只钉 pack、不钉 config；不得视为被 reachability 修复自动解决。待核实是否构成独立缺口、是否需修复或另立 effort；不并入 B-02 修改范围。
- **是否出现新的 B/D 原子项**：03 裁定 publish-gate 一项暂记待核实，不加入 11 项原子集；若后续核实构成独立缺口，按 Q3 记录证据与归属后再决定。

## Out of scope

- **A 类（Q1/Q3/Q4/Q5/Q6/Q8/Q11）**：已在 P1 实施；不重开、不重复审计。
- **C 类**：P0 裁定为空集；不制造新分类。
- **任何实施**：生产代码、契约、测试、fixture 的修改，以及任何“顺手修一下”。
- **付费链**：付费模型调用、真实生图、重新生成 Demo。
- **Runtime / CLI / MCP 形状变更**、新增依赖、重写 GameConfig / Asset Manifest / 资源生成流水线。
- **Level Playability V1 本身**：本图只在推迟项里留交接说明，不替它做决定。
- **静默重开既有裁定**：`entity-identity-v1.1` 的 `interactables` 已知限制、P0/P1 已裁定项与
  P0 `final-report.md` 的 Out-of-scope 列表。
- **推送 `main`、`reset`/`clean`、覆盖历史 run/pack/site、改写历史验收证据**。
