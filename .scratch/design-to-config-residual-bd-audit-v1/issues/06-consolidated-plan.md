# 合并方案：五项修复的决策就绪方案

Type: grilling
Status: open
Owner: —
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
