# Design-to-Config Residual B/D Audit V1 — 最终报告（P1 审批包）

- **日期**：2026-11-03
- **性质**：P1 审批裁定记录与实施授权凭据；**HITL，裁定人 amber**。
- **输入（只读）**：[合并方案 `plan.md`](plan.md)、[03 统一裁定](issues/03-disposition-ruling.md)、
  [05 方案票切法](issues/05-plan-ticket-slicing.md)、[06 合并方案票](issues/06-consolidated-plan.md)、
  [01 B 类研究](research/01-b-class.md)、[02 D 类研究](research/02-d-class.md)、
  [04 publish-gate 研究](research/04-publish-gate-config-identity.md)、P0
  [`final-report.md`](../design-to-config-residual-audit-v1/final-report.md)。
- **PRD（只读冻结）**：[`docs/v7.7/配置.md`](../../docs/v7.7/配置.md)。
- **基线**：`main` @ `3b1b61d`；`plan.md` 的行号均指该基线。
- **状态**：本图 Destination 到达。五项修复获准进入 **P1 实施**；本图**不实施**，
  不修改生产代码、不改变契约、不启动付费调用、不生图。

---

## 0. 结论摘要

1. **五项修复全部获准进入 P1 实施**：D-02 → B-02 → publish-gate → D-01 → D-03；
   每项独立授权、独立测试、独立验收记录、独立回退点。
2. **D-01 的 viewport API 增量获准**：`UnderstandingInput.viewport?`、
   `AssembleOptions.viewport?`、`SiteOptions.viewport?`，以及 `buildWorld` / `buildTdWorld`
   opts 的可选 `viewport`。纯可选字段、向后兼容；CLI/MCP、默认值、序列化与 Runtime 不变。
3. **三项契约候选明确不批**：B-02 的 `ConfigIssue.code: "unreachable"` 不加；
   `QAReport.subject.configChecksum` 交接到「publish-gate 完整 QA 输入身份」effort，以后做；
   D-03 不新增对外归因码。
4. **付费验证只有条件预算、没有执行授权**：2 场景、≤6 次文本调用、零生图、零站点重建；
   仅在 P1 代码实施完成后执行，执行前必须另做一次 go/no-go；当前不执行任何付费调用。
5. **本图在审批包处收口**：P1 实施另起 effort
   `.scratch/design-to-config-residual-bd-audit-v1-p1/`，以本报告为输入与授权依据。

**一句话结论：五项修复进入 P1 实施、D-01 的 API 增量获准、三项契约候选不批、付费验证只有条件预算；方案批准、实施批准与付费执行是三层独立授权，本报告只完成前两层，并只给第三层设了上限。**

---

## 1. 五项方案摘要

技术研究与判据细节见 [`plan.md`](plan.md)，本节不重复。

| 顺序 | 项 | 判据（一句话） | 最小修改面 | 契约结论 | 方案 |
|---|---|---|---|---|---|
| 1 | **D-02** `role` 提示词贯通 | 横版与塔防清单的每条资产行都打印 manifest `role` | `packages/assets/src/ops.ts` + 两个测试文件 | 无候选；`AssetPackEntry.role` 已在契约中 | §1 |
| 2 | **B-02** deterministic reachability | `auditReachability(...)` 的 error 进入 `deterministic` 档，不进 `resampleable` | `contracts/src/config-audit.ts`、`assets/src/ops.ts`、`pipeline/src/create-game.ts` | 可选 `unreachable` 码**不采用** | §2 |
| 3 | **publish-gate** reachability 复验 | 非 TD、有 `configPath` 时现场重跑 reachability，有 error 即拒绝发布 | `pipeline/src/publish-gate.ts` | `subject.configChecksum` **以后做** | §3 |
| 4 | **D-01** `viewport` 全链贯通 | 同一次调用的 viewport 在理解 / 构建 / 站点装配各阶段逐次相等 | `pipeline/src/create-game.ts`、`demo/src/assemble.ts`、`demo/src/site.ts`、`demo/src/td/site.ts`、`demo/src/world.ts`、`demo/src/td/world.ts`、`assets/src/ops.ts`（注释） | viewport API 增量**已批准**（见 §2.1） | §4 |
| 5 | **D-03** 归因与受限重采样反馈 | 只有确定可修的 config 错误进入反馈；确定的清单根因硬拒；不确定 ⇒ config 可修 | `contracts/src/config-audit.ts`（内部纯函数）、`assets/src/ops.ts`（只改编译循环）、测试 | 无；对外归因码**不纳入** | §5 |

**实施时须显式保留的三条方案约束**

- **B-02 行为变化**：不可达 config 的失败阶段从 QA 提前到编译 / 汇合点；退出码仍是
  `invalid`(4)，但落盘时机与文案不同；默认 QA 路径的最终结果不变（`plan.md` §2.3）。
- **D-01 实现纪律**：不能只把 viewport 传到最外层、内部 world builder 再读常量；必须逐行替换
  `buildWorld` / `buildTdWorld` 内的 `VIEWPORT` 引用，并用**自定义视口测试**证明该值到达
  世界描述、背景层尺寸、HUD fallback 盒与站点屏幕空间审计（`plan.md` §4.3）。
- **D-03 保守兜底**：任何不确定一律 config 可修，不硬拒；只有「能力明确 + manifest 无任何满足
  能力的资产 + 错误确实无法由 config 满足」三者同时成立才归包根因（`plan.md` §5.2）。

---

## 2. 逐项契约批准问题

| 候选 | 本轮裁定 | 一句话理由 |
|---|---|---|
| D-01 viewport API 增量 | **批准** | 纯可选字段、向后兼容；D-01 全链贯通的必要前提 |
| B-02 `ConfigIssue.code: "unreachable"` | **不加** | `where/message` 足以支持本轮 deterministic 分档，无机读消费者 |
| publish-gate `subject.configChecksum` | **以后做** | 现场重跑已封住 reachability 洞；完整身份体系另立 effort |
| D-03 对外归因码 | **确认不加** | 保守归因策略尚在探索期，不应固化为对外契约 |

### 2.1 D-01 viewport API 增量 —— **批准**

| 项 | 内容 |
|---|---|
| 变更内容 | `UnderstandingInput.viewport?: { w: number; h: number }`；`AssembleOptions.viewport?`；`SiteOptions.viewport?`；`buildWorld` / `buildTdWorld` 的 opts 增可选 `viewport` |
| 必要性 | D-01 的 A 方案依赖它；不改这些类型就无法让理解段 / 站点装配接收调用方的值 |
| 不改契约的替代 | ① 只收敛 `DEFAULT_VIEWPORT` 与 `VIEWPORT` 为一个常量 —— 仍不支持运行时自定义；② 入口显式拒绝自定义 viewport —— 把「不支持」说出口，但不满足 03 的「贯通」 |
| 影响面 | pipeline / demo 的公开 TS 类型（新增可选字段，向后兼容）；无序列化变化；既有产物不变；CLI/MCP 形状不变 |
| 不实施的后果 | 自定义视口下规划 / VDS 与下游审计继续分叉（E3 已复现）；D-01 只能推迟 |
| 兼容 / 迁移 | 可选字段、默认值不变；旧调用方无需改动 |
| 批准问题 | 是否批准这组 API 增量？ |
| **裁定** | **批准（2026-11-03，amber）**。边界：不新增 CLI/MCP 参数、不改默认值、不改序列化、不改 Runtime；若实施中发现必须扩大契约或改变上述边界，**暂停并重新审批**；不得退化成「只合并常量」后声称 D-01 完成。 |

### 2.2 B-02 可选 `ConfigIssue.code: "unreachable"` —— **不加**

| 项 | 内容 |
|---|---|
| 变更内容 | `CONFIG_ISSUE_CODES` 增加 `"unreachable"`；`auditReachability` 的报告项带该码 |
| 必要性 | 只有需要机读区分「不可达」与其它 deterministic 失败时才需要；本轮无此消费者 |
| 不改契约的替代 | 不加码；调用方按 `where` / `message` 区分（本方案） |
| 影响面 | contracts 闭集、QA 报告消费者、测试；无持久化字段 |
| 不实施的后果 | 失败文案只能家族中性；机读消费者无法在不解析文本的前提下区分 |
| 兼容 / 迁移 | 可选字段式增量；旧报告无码不受影响 |
| 批准问题 | 本轮是否需要机读码？ |
| **裁定** | **不加（2026-11-03，amber）**。本轮不扩展 `CONFIG_ISSUE_CODES` 或其它 contracts 闭集；若后续出现真实机读消费者，按 Q5 单独提出契约变更。 |

### 2.3 publish-gate `subject.configChecksum` —— **以后做**

| 项 | 内容 |
|---|---|
| 变更内容 | `QAReportSchema.subject`（strict）新增可选 `configChecksum`（`sha256:<hex>`）；`create-game.ts` 注入；gate 比较 `fileChecksum(configPath)` |
| 必要性 | 只有要「证明报告属于这份 config」时才需要；本方案选现场重跑，不依赖它 |
| 不改契约的替代 | 现场重跑（本方案）；out 树兄弟 config 字节比较；`delivery.config.file` 比较 |
| 影响面 | `contracts/qa.ts`、`create-game.ts`、`publish-gate.ts`、4 组测试、文档；`subject` 是 strict，必须契约与生产者同批改 |
| 不实施的后果 | 报告仍无法证明 config 身份；但 reachability 已被现场重跑，配置敏感判据的剩余洞只剩第七条 `visual-config-coherence` |
| 兼容 / 迁移 | 26/29 历史报告有 subject、0 有 `configChecksum`；若必填会全部拒；若可选缺席跳过则洞仍在 |
| 批准问题 | 现在做 / 以后做 / 不做？ |
| **裁定** | **以后做（2026-11-03，amber）**。本轮不修改 `QAReport.subject`、不注入 checksum、不在 publish-gate 做完整 config 身份绑定；交接到「publish-gate 完整 QA 输入身份」effort，按 `plan.md` §10.2 处理。 |

### 2.4 D-03 对外归因码 —— **确认不加**

| 项 | 内容 |
|---|---|
| 变更内容 | 无；对外错误码 / `ConfigIssue` / `auditConfigPipeline` 返回形状均不变 |
| 必要性 | 无；本轮只用内部纯函数与私有分类结果 |
| 不改契约的替代 | `classifyConfigIssues(...)` 作为内部 API 增量，返回私有分类结果（本方案） |
| 影响面 | 仅 `contracts/src/config-audit.ts` 内部函数与 `assets/src/ops.ts` 编译循环 |
| 不实施的后果 | 外部无法机读区分归因；本轮不需要 |
| 兼容 / 迁移 | 无对外形状变化 |
| 批准问题 | 是否确认本轮只用内部纯函数？ |
| **裁定** | **确认（2026-11-03，amber）**。不得改变 `ConfigIssue`、`auditConfigPipeline` 返回形状或对外错误码；归因不确定时仍归为 config 可修；只有证据明确满足清单根因条件时才硬拒。若将来需要对外码，按 Q5 另提。 |

**其余两项无契约候选**：D-02 的 `role` 已在 `AssetPackEntry` 契约中；publish-gate 选择的是不改契约的现场重跑方案。

---

## 3. 实施授权边界

### 3.1 已批准的实施范围

五项修复进入独立的 **P1 实施**，顺序固定：

1. **D-02** — `role` 提示词贯通
2. **B-02** — deterministic reachability
3. **publish-gate** — 发布时 reachability 复验
4. **D-01** — viewport 全链贯通（以 §2.1 的 API 批准为前提，已满足）
5. **D-03** — 归因与受限重采样反馈

每一项必须有：**独立测试、独立验收记录、独立回退点**。某项失败不得自动扩大到其它项，
也不得以其它项通过抵消。每项的实施完成以自身测试与零付费验证为准，不以「方案已批准」代替。

### 3.2 授权不包含

- 未列入五项的生产代码或契约修改；
- CLI/MCP 对外参数或行为扩展（D-01 已明确排除）；
- Q8 推迟项、历史排除项的顺带修复；
- 付费模型验证的自动执行；
- 推送 `main` 或发布生产版本。

### 3.3 付费验证：条件预算，不是执行授权

| 项 | 边界 |
|---|---|
| 场景 | 仅限 `plan.md` §5.8 的两个场景（① config 可修反馈；② 清单根因硬拒） |
| 调用上限 | **≤6 次文本调用**（场景①≤3、场景②≤3） |
| 禁止项 | 零生图、零站点重建；只用既有 fixture，不生成新资源 |
| 执行时点 | 仅在 P1 代码实施完成后执行 |
| 二次确认 | 执行前必须另做一次明确 **go/no-go**，确认模型、环境、实际调用计划与预算边界 |
| 重新申请 | 任何一次调用若可能突破上限，或需要增加场景、改用生图、重建站点，均须重新申请 |
| 不通过时 | 按既定方案回退 D-03 的**反馈**部分，保留已通过确定性验证的**归因与硬拒** |

**当前不执行任何付费调用。** 本图与本次审批均未调用模型、未消耗预算。

### 3.4 需要暂停并重新审批的触发条件

- 实施中发现需要扩大 §2.1 的契约或改变 D-01 的任何边界；
- 需要修改五项之外的生产代码、契约、CLI/MCP 形状；
- 需要突破 §3.3 的预算或场景；
- 需要重新解释 01 / 02 / 04 研究或 03 / 05 / 06 裁定以取得更宽授权。

### 3.5 三层授权不得混同

| 层 | 内容 | 状态 |
|---|---|---|
| 方案批准 | 06 的合并方案与五项判据 | 已批准（2026-11-03） |
| 实施批准 | 本报告 §3.1 的五项进入 P1 实施 | 已批准（2026-11-03） |
| 付费执行 | §3.3 的 2 场景、≤6 次文本调用 | **仅条件预算；未执行，需另做 go/no-go** |

### 3.6 P1 实施入口

- 目录：`.scratch/design-to-config-residual-bd-audit-v1-p1/`
- 输入与授权依据：本报告 [`final-report.md`](final-report.md) 与 [`plan.md`](plan.md)
- P1 effort **不得**把本图的研究票、方案票重新解释为更宽的授权；本图的审批裁定不在 P1 中重开。
- P1 的产出（实施记录、测试证据、零付费验证、付费 go/no-go 结论）写在 P1 目录，不写回本图。

---

## 4. 明确排除与 Q8 交接

### 4.1 本轮明确排除

- **第七条 `visual-config-coherence`**：不在 publish-gate 第五项范围；站点没有 VDS / design 入参，
  无法重跑。按 Q8 交接。
- **完整 config 身份体系**：`subject.configChecksum`（本轮裁为以后做）、VDS / design / intent 身份、
  runDir 跨阶段一致性、手写 config 工作流的身份策略 —— 均不在本轮。
- **规划循环 / 塔防循环的盲重采样**：本轮只修编译循环，另按 Q8 交接。
- **B-01 / B-03 / B-04 / B-05 / B-06 / B-07 / D-04**：维持 03 §4 的推迟交接；
  本方案不重开、不重新裁定。
- **任何本图内的实施**：本图只到审批包；生产代码、测试、fixture、契约的修改在 P1 另行授权执行。
- **付费链**：本轮不调用模型、不生图、不重建站点。

### 4.2 Q8 交接

| 交接项 | 推荐后续 effort | 详情 |
|---|---|---|
| 第七条 `visual-config-coherence` | 「publish-gate 完整 QA 输入身份」 | `plan.md` §10.2（交接时须重新确认的事实、启动前须补充的证据、本图未替其决定的事项） |
| 规划循环的盲重采样 | 「重采样反馈 v2（规划段）」 | `plan.md` §10.3 |
| 塔防循环的盲重采样 | 「重采样反馈 v2（塔防段）」 | `plan.md` §10.4 |
| `subject.configChecksum` | 「publish-gate 完整 QA 输入身份」 | 本报告 §2.3；与第七条同属身份体系 |
| B-01 / B-03 / B-04 / B-05 / B-06 / B-07 / D-04 | 见 03 §4 各自推荐 effort | [03 统一裁定](issues/03-disposition-ruling.md) §4 |

---

## 5. 交付物索引

| 交付物 | 路径 |
|---|---|
| 地图（Destination / 裁定 / 决策） | [map.md](map.md) |
| 合并方案（五项 + 跨项矩阵 + 验证计划） | [plan.md](plan.md) |
| 本报告（P1 审批包） | `final-report.md` |
| B / D 类研究 | [research/01-b-class.md](research/01-b-class.md) · [research/02-d-class.md](research/02-d-class.md) |
| publish-gate 研究 | [research/04-publish-gate-config-identity.md](research/04-publish-gate-config-identity.md) |
| 研究票 | [01](issues/01-b-class-audit.md) · [02](issues/02-d-class-audit.md) · [04](issues/04-publish-gate-config-identity.md) |
| 裁定与切法 | [03 统一裁定](issues/03-disposition-ruling.md) · [05 方案票切法](issues/05-plan-ticket-slicing.md) |
| 方案与收口票 | [06 合并方案](issues/06-consolidated-plan.md) · [07 收口 / P1 审批包](issues/07-closeout-approval-package.md) |
| P0 收口报告 | [`../design-to-config-residual-audit-v1/final-report.md`](../design-to-config-residual-audit-v1/final-report.md) |
| PRD（只读冻结） | [`docs/v7.7/配置.md`](../../docs/v7.7/配置.md) |

---

## 6. 自检

| 项 | 结果 |
|---|---|
| 零付费 / 零模型调用 / 零生图 | ✅ 本图全程未调用模型、未生图、未消耗预算 |
| 未修改生产代码 / 测试 / fixture / 契约 | ✅ 写入仅限 `.scratch/design-to-config-residual-bd-audit-v1/` 内的文档 |
| 未修改 CLI / MCP 形状 | ✅ |
| 未修改历史冻结证据 / 未改写验收结论 | ✅ |
| 未覆盖 run / pack / site 版本 | ✅ 未执行构建链 |
| 未 commit / 未建分支 / 未推送 | ✅ 本次未 commit、未 push |
| 审批结果已记录 | ✅ 本报告 §2、§3；07 的 `## Answer` |
| 实施未开始 | ✅ 五项均等 P1 effort 的独立实施与验收 |
| 付费验证未执行 | ✅ 仅记录条件预算；执行前另做 go/no-go |

---

## 7. 停止线

本报告完成 **Design-to-Config Residual B/D Audit V1** 的 Destination：审定后的 P1 审批包交付，
本图在审批包处收口。

- **本轮批准**：五项修复进入 P1 实施；D-01 可选 viewport API 增量；≤6 次文本调用的条件预算上限。
- **本轮不批准**：B-02 机读码、`QAReport` checksum、D-03 对外归因码、Q8 推迟项，
  以及任何额外契约或对外接口扩展。
- **仍需二次确认**：付费验证 go/no-go；当前不执行任何付费调用。
- **下一步入口**：`.scratch/design-to-config-residual-bd-audit-v1-p1/`。

**不自动进入 P1 实施；实施、验收与付费执行均在 P1 effort 中另行开始。**
