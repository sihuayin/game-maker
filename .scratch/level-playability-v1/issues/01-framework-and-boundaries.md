# 判定框架与输入/结果/集成边界裁定

Type: grilling
Status: resolved
Owner: amber · 2026-11-04
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

## Answer

### Q1 — 输入边界：A（2026-11-04 裁定）

确定性判据只接收 `(GameConfig, AssetPackManifest) + FixedRuntimeProfile`；**不读** `GameDesignSpec`、自由文本 `layout`、viewport。

| 假设 | 定义 |
|---|---|
| 二段跳 | 不存在 |
| `solid` | 静态碰撞 |
| `hazard` | 接触后复位 |
| kill plane | 不存在 |
| viewport | 不作为判据输入 |
| design | 不读取 |

`FixedRuntimeProfile` 必须是**集中定义、可测试**的假设集合，不允许各审计函数各自隐含一套；Runtime 行为变化时必须重新评估相关判据。manifest 不可省（资源存在性 / 能力 / 尺寸）；design 不选是因为 `levels[].layout` 无坐标、无结构化空间语义，读它只能引入不可确定判据。

### Q2 — 结果模型：A（2026-11-04 裁定）

内部纯函数 `PlayabilityVerdict`，至少包含：三态 verdict、逐条 evidence、failure location、coverage。

| Verdict | 含义 | 硬拒 |
|---|---|---|
| `PROVEN_UNPLAYABLE` | 有确定性证据证明关卡不可玩 | 是 |
| `INSUFFICIENT_EVIDENCE` | 当前判据无法证明可玩或不可玩 | 否 |
| `NO_PROVEN_BLOCKER` | 已执行判据未发现确定性阻断 | 否 |

- `NO_PROVEN_BLOCKER` ≠ `PROVEN_PLAYABLE`；空 `ConfigIssue[]` 只表示没发现确定性错误。
- coverage 必须显式记录未覆盖维度（例如：空间可达性已检查 / 机制可通行性部分检查 / 关卡完成性未检查），不得因最终无 error 而隐去未运行检查。
- 类型与函数可供 scratch、测试及内部消费者使用；**不得**进入 `qa-report.json`、`delivery`、GameConfig 持久化结构或任何新 contracts schema。
- 错误侧只映射到现有 `ConfigIssue[]`；不新增持久化结果格式。

### Q3 — 未来集成点：A（2026-11-04 裁定）

`PROVEN_UNPLAYABLE` 进入 `auditConfigPipeline` 的 `deterministic` 档：

1. 编译循环完成；
2. 汇合点执行 playability 审计；
3. `PROVEN_UNPLAYABLE` 映射为确定性 `ConfigIssue`；
4. 硬拒，不再盲目重采样；
5. `INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` 不产生 error。

本轮**不新增 QA 判据**，不扩展 `QA_JUDGEMENTS`，不把 playability verdict 塞进 QA 报告。进入 deterministic 不等于每条检查都必须给确定结论：只有能证明不可玩才阻断，coverage 不足仍是证据不足，不是失败。

测试必须证明：确定性不可玩会阻断；证据不足不会阻断；未发现阻断不被提升为「已证明可玩」；deterministic 失败不触发模型重采样。

### Q4 — 术语落点：A（2026-11-04 裁定）

`CONTEXT.md` 已写入：`可玩性判定`（伞词）、`空间可达性` / `机制可通行性` / `关卡完成性`、`Playability Verdict`、`FixedRuntimeProfile`。规范层名用中文，英文码作机器标识。

必须区分：Playability Verdict 回答「基于确定性输入与规则，能否证明不可玩？」；Playtest 回答「某次实际试玩发生了什么，证据是否充分？」。Playtest 失败不得直接推出 `PROVEN_UNPLAYABLE`；`NO_PROVEN_BLOCKER` 不得推出 Playtest 必然成功。三态**不是** [[InsufficientEvidence]]，也不是 Playtest Outcome 五态。

### 锁定的架构原则

> Playability V1 是一个基于 GameConfig、AssetPackManifest 和固定运行剖面的确定性证明系统。它只对能够证明的不可玩问题实施硬拒；不能证明不代表可玩，也不能证明不代表不可玩。

以上仍是审计规格裁定，不构成生产代码修改或 contracts 变更授权。

### Q5 — 判据 id 与失败定位：A（2026-11-04 裁定）

- 稳定 id 只活在内部 `PlayabilityVerdict`，命名空间 `PLAYABILITY_SPATIAL_*` / `PLAYABILITY_MECHANIC_*` / `PLAYABILITY_COMPLETION_*`。
- 错误侧映射到 `ConfigIssue` 时**不带 `code`**；沿用现有 `where`（`entity "<id>"` / 字段路径）与 message 人话格式。
- 不扩展 `CONFIG_ISSUE_CODES` 闭集；若实施确需机器码，作为 09 的单列审批候选，本票不批。
- 不把 id 写进 `where` / message。

失败定位最小闭集：

| 字段 | 必填 | 说明 |
|---|---|---|
| `judgmentId` | 是 | 稳定判据 id |
| `target` | 是 | 实体 id 或字段路径；映射到 `ConfigIssue.where` |
| `detail` | 是 | 人话定位；映射到 `ConfigIssue.message` |
| `witness` | 是 | 可机检证明：`no-path` / `blocked` / `coverage-gap` / `count` |
| `coverage` | 是 | 三维各自的 `checked` / `partial` / `not-checked` |
| `assetId` | 否 | manifest 能力相关时 |
| `expected` / `actual` | 否 | 数值阈值类判据；不强制，避免非数值判据填占位值 |

### Q6 — 与既有警告族的关系：A（2026-11-04 裁定）

1. **严重度只由 verdict 派生**：`PROVEN_UNPLAYABLE` → error；`INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` → 不产 `ConfigIssue`。只有 `auditPlayability` 做这个映射。
2. **error 去重键 = `(target, 根因类)`**：同一目标多条证明只产一条 error，`witness` 列全部根因。
3. **已有 error 拥有根因时不重复**：出生点卡 `solid` 归 `auditGameConfig`；出生点埋 terrain 归 `auditPlayability`；目标不可达归 `auditPlayability`；QA standalone 的 `reachability` 属另一阶段，不算同报告重复。
4. **warning 原样保留、不参与 verdict**：台阶高 / 行程越界可与 playability error 并存（不同 `where` / message），但永不升级、不被 `auditPlayability` 读取来推断 verdict。
5. **替换而非叠加**：更严格 overlap、走路边、moving solid 对齐都在 reachability 组成件内部替换旧逻辑，不新增并列判据。
6. **机制覆盖不变**：`mechanic-coverage` 的存在性 verdict 不受影响。
7. **QA 不变**：`QA_JUDGEMENTS` 仍 7 条；QA 的 `reachability` 继续调 `auditReachability`。

### Q7 — 判据放置位置：B（2026-11-04 裁定）

- 另起单一入口 `auditPlayability`，内部组合各层判据。
- `auditConfigPipeline.deterministic` 里**替换** `auditReachability`（不是并列），避免重复报。
- 发布闸**直接改调** `auditPlayability`，不做「两个都调」的过渡。
- QA 仍只调 `auditReachability`，保持 7/7 不变。
- `assembleSite` 直调是否接线列为 09 的修改面；若不接线，规格必须明写「库直调 `assembleSite` 仍不过闸」的残余风险。
