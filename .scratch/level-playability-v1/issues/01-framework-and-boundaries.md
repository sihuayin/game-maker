# 判定框架与输入/结果/集成边界裁定

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md

## Question

在开图裁定（Q1–Q7 全 A）之后，把 Level Playability V1 的**判定框架**钉死到可以写规格的程度。本票是 HITL：由用户裁定，代理不得代答。

### 必须裁定

1. **输入边界**：所有确定性判据是否只吃 `(GameConfig, AssetPackManifest)`（加上固定常量/运行剖面），不读 `GameDesignSpec`、不比较设计散文？
   - (a) 只吃 config + manifest（推荐）；
   - (b) 增加 `GameDesignSpec` 作为输入，判断设计意图是否被实现；
   - (c) 只用 config，不用 manifest。
2. **结果模型**：`PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` 如何承载？
   - (a) 规格定义**内部**纯函数结果（私有类型 + 证据/定位 + coverage）；错误侧映射到现有 `ConfigIssue[]`；不新增导出 schema；
   - (b) 规格提出新的 contracts 导出 schema（作为单列审批候选）；
   - (c) 三态只作为审计文档的人工结论，代码只产 `ConfigIssue[]`。
3. **未来集成点**：未来实施时，`PROVEN_UNPLAYABLE` 进入哪里？
   - (a) `auditConfigPipeline` 的 deterministic 档（与 B-02 同档），编译/汇合点硬拒；另两态不进 error（推荐）；
   - (b) 只在 QA 报告里作为观察；
   - (c) 只在 publish gate 复验；
   - (d) 本图不定，留给实施 effort 决定。
4. **术语落点**：`可通行性` / `空间可达性` / `机制可通行性` / `关卡完成性` 是否现在写入 `CONTEXT.md`？三态码用英文还是中文作为规范名？
5. **判据 id 与失败定位**：每条原子判据是否需要稳定 id（例如 `PLAYABILITY_SPATIAL_*`）？失败定位至少包含哪些字段（entityId / field / assetId / expected / actual / judgmentId）？
6. **与既有警告族的关系**：`auditGameConfig` 现有的台阶高/行程越界警告、`auditReachability` 的 error，如何避免重复报告与分档漂移？
7. **判据放置位置**：新判据并进 `auditReachability`、另起函数并在 compile / 汇合点 / 发布闸显式接入、还是只放 QA？02 已确认 `publish-gate.ts:140` 只重跑 `auditReachability`；另起函数会扩大修改面，并可能漏掉 standalone `site` / `assemble_site`。

### 输出

- `../framework.md`：三层定义、输入边界、结果模型、集成点、判据 id 规则、失败定位字段、与既有审计的关系。
- 本票 `## Answer` 记录逐项裁定；若 `CONTEXT.md` 需要更新，记录具体词条与定义（文档更新可同票完成）。
- 更新 `../map.md` 的 Decisions so far。

### 边界

- 不修改生产代码；不实施任何判据。
- 契约形状变化只能作为候选，不得在本票批准。
- 不重开 Q1–Q7 的裁定；本票只细化到可写规格。
- 不把 `AGENT_LIMITATION` / `TIMEOUT` / `ENVIRONMENT_FAILURE` 纳入不可玩判定。

### 通过标准

- 六个必须裁定项都有明确答案与理由。
- 结果模型能表达三态，且不隐含新的对外契约。
- 集成点明确说明失败阶段与退出码是否变化。
- 术语与既有 `CONTEXT.md` 不冲突；新增词条有定义。
