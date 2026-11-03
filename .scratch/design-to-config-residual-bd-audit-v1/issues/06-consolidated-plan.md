# 合并方案：五项修复的决策就绪方案

Type: grilling
Status: resolved
Owner: amber · 2026-11-03
Blocked by: —
Map: ../map.md

## Question

在 01/02 研究、03 裁定、04 publish-gate 核实、05 切法裁定之后，产出**一份合并方案**（方案票），
覆盖五项修复。本票只产出方案与验证计划：**不修改生产代码、不批准契约、不启动付费调用、不生图**。

### 方案结构（每项一节，节内顺序固定）

1. **B-02** — deterministic reachability
2. **D-01** — viewport 贯通
3. **D-02** — role 提示词贯通
4. **D-03** — modelHard 归因与受限重采样反馈
5. **publish-gate** — standalone `site` / `assemble_site` 的 reachability 复验（第五项，
   独立证据、独立测试、独立修改边界）

每节必须包含：

- **当前缺口与证据**：引用 01 / 02 / 04 报告的 `file:line`；标 E1 / E2 / E3。
- **修复判据**：精确、可计算、误报边界（对齐 `CONTEXT.md` 的判据门槛）。
- **最小修改面**：包 / 文件 / 契约 / 调用链；是否新增依赖；是否改 Runtime / CLI / MCP 形状。
- **测试矩阵**：正 / 负 / 边界；既有测试如何扩展。
- **零付费验证**：命令、fixture、期望退出码；不得修改历史语料。
- **风险与回退条件**：失败分档、兼容性、历史数据。
- **契约变更候选（如有）**：变更内容、必要性、不改契约的替代方案、影响面、不做后果、
  兼容 / 迁移要求。

### 公共章节

- **跨项测试矩阵**，至少覆盖：
  - **B-02 × D-03**：`config-audit` 与重采样循环的交互——deterministic 不进入
    `resampleable`；反馈只带 config 可修错误，包根因不喂回。
  - **D-01 × D-02 × site/QA**：viewport 从 `UnderstandingInput` 到 plan / VDS / compile /
    QA / site 的贯通；横版与塔防资源清单的 `role` parity。
  - **D-02 × B-01**：只保证 `role` 可见，不建立机读语义分类（B-01 仍为推迟项）。
  - **B-02 × publish-gate**：同一 `auditReachability` 判据在 build 与 standalone `site`
    两个调用点；不把 publish-gate 包装成 B-02 的自动覆盖。
- **零付费验证计划**：全量语料重判（`out/**`、`fixtures/**`、`.scratch/**`）与既有测试；
  记录命令与退出码；新增 error 逐条解释。
- **失败分类与回退策略**：deterministic / resampleable / 包根因；哪些新拒绝可解释为真实缺陷。
- **契约候选单列清单**：
  - B-02 可选 `unreachable` 错误码（未批准）
  - D-01 可选 `UnderstandingInput.viewport`（未批准）
  - publish-gate `subject.configChecksum`（备选，不默认采用，未批准）
  - D-03 对外归因码（不纳入当前方案）
  全部保持**未批准**；批准留到 07 收口 / P1 审批包。
- **明确排除与推迟项交接**：
  - 第七条 `visual-config-coherence` 不在 publish-gate 第五项范围；按 Q8 交接
    （推荐后续 effort、交接时须重新确认的事实、启动前须补充的证据、本图未替其决定的事项）。
  - B-01 / B-03 / B-04 / B-05 / B-06 / B-07 / D-04 的既有推迟交接（引用 03 §4）。

### 边界

- 五项进入同一份方案，不代表五项必须一次性批准。
- 方案票的 HITL 结论不授予契约批准；契约批准留到 07。
- publish-gate 只处理 `reachability`；不扩大到完整 config-audit、身份绑定体系、
  VDS/design 身份或 runDir 一致性。
- 零付费验证不等于付费模型效果验收；付费验证的问题、预算 / 授权门槛、回退 / 停止条件
  写入方案，但本轮不执行。
- **只读**：不改生产代码 / 测试 / fixture / 契约 / 历史证据；不 commit / 建分支 / 推送；
  零付费、零模型调用、零生图。

### 产出

- 方案写入 `../plan.md`（五项各一节 + 公共章节）。
- 本票 `## Answer` 记录方案摘要与文件指针；`Status` 改 `resolved`。
- 本票是 HITL：技术研究可由代理起草，但第五节范围、契约候选、跨项排序与最终接受
  必须由用户确认。

## Answer

**裁定日期**：2026-11-03 · **裁定人**：amber · **性质**：HITL。
**产出**：[`../plan.md`](../plan.md)（五项各一节 + 公共章节；章节顺序即实施顺序）。

### 1. Q1–Q6 裁定

| 问题 | 裁定 |
|---|---|
| Q1 D-01 修复面 | **A：全链贯通，包含站点**；`UnderstandingInput.viewport?`、`AssembleOptions.viewport?`、`SiteOptions.viewport?`，并让 `buildWorld` / `buildTdWorld` 接受可选 viewport；CLI/MCP 不加参数、默认不变、不改 Runtime。站点不得留给 Q8。 |
| Q2 D-03 归因与循环 | **只改编译循环**（`ops.ts:1174-1215`）；规划循环、塔防循环推迟并 Q8 交接。归因采用**保守兜底**：能力不明确、实体 id 不在 config、decor 无 kind 锁等不确定情形一律 config 可修，不硬拒；只有明确清单根因才把 `attempts` 从 3 降为 1。 |
| Q3 publish-gate | **A：共享 `assertPublishableQa`**；非 TD、`configPath` 存在时现场重跑 `auditReachability`；缺省跳过（四个真实发布入口都传 `configPath`，实现时须逐入口复核）；不改契约、不扩第七条。 |
| Q4 契约候选 | 全部维持原状态：B-02 可选 `unreachable` 码提出但不默认采用；**D-01 API 增量必须进入 07 单列审批**；publish-gate `subject.configChecksum` 仅备选；D-03 对外归因码不纳入。D-01 若审批不通过 ⇒ **标记推迟**，不得退化成只合并常量后声称完成。 |
| Q5 付费验证 | 写入方案：2 场景（config 可修反馈 / 清单根因硬拒）、≤6 次文本调用、零生图、零站点重建、既有 fixture；**本轮不授权执行**。D-03 反馈不通过 ⇒ 只回退反馈部分，保留归因与硬拒。 |
| Q6 实施顺序 | **A：D-02 → B-02 → publish-gate → D-01 → D-03**；每项独立测试、独立回退；B-02 与 publish-gate 复用 `auditReachability` 但各自保留独立入口测试。 |

### 2. D-03 保守归因的六条细则（写入 `plan.md` §5.2）

1. 所需能力先从 config 语义与 `where` 推导，`where` 只作索引；
2. `entity "<id>"` 必须在 config 中确认实体语义类型，确认不了 ⇒ config 可修；
3. `entity-state-frames` 必须确认 code 命中且实体 kind 确实是 `chest` / `danger`，才追加「≥2 帧」条件；
4. `hud.panel` / `hud.pip`、`player` / `player.anims.*`、`scene.background` 使用明确结构映射；
5. 只有「能力明确 + manifest 无任何满足能力的资产 + 错误确实无法由 config 满足」三者同时成立 ⇒ 清单根因；
6. 任何不确定 ⇒ config 可修，不硬拒。

**明确不归包根因**：包里没有某个 id、但 manifest 有同 kind 资产 —— 可能是幻觉 id，模型可换一个；
只有所需能力在 manifest 中完全不存在（如 hud 需要 ui 而整包无 ui）才硬拒。

### 3. 方案边界

- `plan.md` 是**决策就绪方案**，不构成实施授权；生产代码修改、契约批准、付费验证各自另批。
- 五项进入同一份方案 ≠ 一次性批准；允许逐项批准、逐项实施、逐项回退。
- publish-gate 只处理 `reachability`；第七条 `visual-config-coherence` 按 Q8 交接。
- D-03 归因不确定时不得硬拒；只有明确清单根因才能减少重采样次数。
- 零付费验证 ≠ 付费模型效果验收；D-02 只证明 body 含 `role`。
- 未修改生产代码 / 测试 / fixture / 契约 / 历史证据；未 commit、未建分支、未推送；零付费、零模型调用、零生图。

### 4. 下一轮

- [07 收口 / P1 审批包](07-closeout-approval-package.md) 的 blocker（本票）已满足，成为当前 frontier。
- 07 需要的输入：`plan.md` 的五项摘要、§9 契约候选清单、§11 待审批问题清单、§10 Q8 交接。
