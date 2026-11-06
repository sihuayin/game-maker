# 最小实施方案与契约候选

Type: research
Status: resolved
Owner: research subagent · 2026-11-05
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08
Map: ../map.md

## Question

在审计、候选判据、语料重判与合成矩阵完成后，产出 Level Playability V1 的**最小实施方案**与**契约候选**，供 10 审批。不得实施。

### 必须交付

1. **最小修改面**：contracts 审计纯函数、编译提示词、测试、fixtures；逐文件列出，标注是否属于 Q5 允许面。
2. **结果模型落地**：如何承载三态；是否新增导出 schema/API；若新增，单列契约候选（变更内容、必要性、至少一个不改契约替代、影响面、不做后果、审批点）。
3. **集成点与失败分档**：接入 `auditConfigPipeline` / QA / publish gate 的哪种方式；失败阶段、退出码、文案是否变化；与 B-02 的关系。
4. **测试计划**：单测、语料回归、合成负例、合法边界；每条判据的正负测试。
5. **回退策略**：若某判据在实施中误伤，如何逐条回退而不污染其它判据。
6. **实施 effort 票据**：建议的串行/并行票、每票的验收与回退点、分支与提交纪律。
7. **风险与未决**：仍然只能到 `INSUFFICIENT_EVIDENCE` 的判据、可能需要 Runtime/契约扩展的部分（明确排除在 V1 外）。
8. **判据放置与发布闸覆盖**：新判据并进 `auditReachability`，还是另起函数并在 compile / 汇合点 / 发布闸显式接入；说明 standalone `site` / `assemble_site` 是否覆盖，以及修改面差异。

### 输出

- `../plan.md`。
- 本票 `## Answer` 摘要；更新 map 的 Decisions so far。

### 边界

- 不修改生产代码；不实施判据。
- 不把契约候选写成已批准；审批归 10。
- 不扩大 Q5 的允许面；不引入 Runtime 修改。

## Answer

研究完成 2026-11-05。方案报告：[plan.md](../plan.md)（808 行，覆盖八个必交项）；未修改生产代码、未实施判据、未改 tracker。

### 结论摘要

1. **不需要新的持久化契约形状**。三态 `PlayabilityVerdict` 只活在 contracts 内部；`PROVEN_UNPLAYABLE` 映射为现有 `ConfigIssue[]`，另两态不产 issue。
2. **单一入口 `auditPlayability(config, manifest, profile?)`**，内部组合空间 / 机制 / 完成性；`auditReachability` 保留为 QA 的单层空间入口，两者共用同一移动图核心。
3. **生产接线三处**：`config-audit.ts` 的 `deterministic` 替换、`publish-gate.ts` 现场复验替换、`index.ts` 加法导出；compile 循环 / 汇合点 / CLI/MCP 发布闸自动覆盖；QA 仍 7 条；`assembleSite` 直调残余风险明写。
4. **实施顺序**：LP-00 基础设施 → LP-01 03 移动图修正 → LP-02 03 空间判据 + `CHEST_BLOCKED` → LP-03 机制 A → LP-04 机制 B → LP-05 完成性 → LP-06 编译提示词 → LP-07 验收。A 必须在 03 walk/clearance 修复之后，且票 10 对 3 条历史真实缺陷做出迁移 / 例外裁定之后才可硬拒。
5. **回退**：注册表 + `PLAYABILITY_DISABLED` profile 开关；每条判据可单独移除，不污染其它判据；每票一个 commit。
6. **测试**：每条判据单测（正/负/合法边界）、07 的 39 例矩阵转生产测试、08 的冻结语料回归（96 配对 / 20 唯一；空间 0、完成性 0、机制 A 3 真实缺陷）、profile 缺口测试。

### 契约候选（均未批准，交票 10）

| 候选 | 内容 | 建议 |
|---|---|---|
| C1 | 加法导出 `auditPlayability` + `playabilityIssues` + 内部类型 | **批准**（Q5 审计纯函数；若 10 把任何加法导出视为形状变更，则按 C1 单列批准） |
| C2 | 新增 `ConfigIssue.code` | **否 / 推迟**（闭集无消费者需要；未来另立审批） |
| C3 | 持久化 `PlayabilityVerdict` / coverage | **否**（违反 framework §3.5） |
| C4 | 新增 QA 判据（第 8 条） | **否**（framework §4.3 已裁定 QA 不变） |
| C5 | `FixedRuntimeProfile` 成为生产入参 / CLI 参数 | **否**（Q5 排除；profile 是内部常量） |
| C6 | 扩展 manifest 暴露逐帧 atlas 几何 | **否 / 未来 effort**（超出 Q5） |

### 票 10 必须裁定

1. 批准本方案与 LP-00…LP-07 实施 effort（分支 `p1/level-playability-v1`，每票一 commit）。
2. C1 批准、C2–C6 不采用。
3. 3 条历史真实缺陷：迁移还是保留例外（不设路径例外；如需迁移，另立票据，超出本图「不改历史」边界）。
4. 批准 profile 假设 P1（标称 size + 资源 anchor）/ P2（`body` 语义）/ P3（chest range）/ P4（spawn 分离）；不批准则对应判据只能 `INSUFFICIENT_EVIDENCE`。
5. 接受 `auditReachability` 与 QA `reachability` detail 的行为变化（仍 7 条判据），或要求 QA 行为冻结（代价是两套移动模型漂移）。
6. R1：04 B 的 `no-safe-window` witness 是否作为第五种 witness，或折入 `blocked` 子字段。
7. R21：07 矩阵的层级 `expectedVerdict` 与整关 aggregate 的口径（推荐 (a) 层级预期，整关另测）。
8. 残余风险：`assembleSite` 直调不过闸、QA standalone 看不到机制 / 完成性 error。

### 明确排除 V1

Runtime 修改、新机制、移动平台支持、hazard / pickup / goal 的 `body` honor、二段跳、kill plane、世界边界碰撞、斜坡 / 非 AABB、逐帧 atlas 几何、设计层布局坐标、新 EntityKind / Motion。
