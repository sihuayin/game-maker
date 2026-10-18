# 01. 第一轮顶层裁定（v3 · Asset Planner）

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线回传)
Blocked by: —
Map: ../map.md
> 本轮只定「目的地与顶层分支」；规则矩阵、确定性语义、错误语义留待后续轮次。
> 以下裁定由人离线填写并回传，逐字保留。

## Question

v3 地图的终点是否带执行；Planner 边界（模型 vs 确定性 resolver）；`deriveRecipe` 口径；
`import` 本阶段范围；决策理由/追溯落点；Planner 能力输入的最小形状。

## Answer

> ## game-maker v3 · Asset Planner 路线决策改造 · 第一轮裁定
>
> | 问题 | 裁定 | 决定与边界 |
> | --- | --- | --- |
> | Q1 是否带执行 | (b) 带到实现 | 本图终点是 Phase 1 落地并通过测试，包含规则模块、测试与文档。决策票解完后，施工票也纳入本图追踪，避免 PRD Task 2–4 脱离路线图。 |
> | Q2 Planner 边界 | (a) 模型产完整 Recipe + 确定性 `resolveRoute` 唯一写入 `source.kind` | 保留现有模型调用，由模型提供资源规格及路线候选；后续确定性 resolver 决定最终路线并写入 `source.kind`。Recipe Schema 不变。改写 `plan-assets.test.ts:180` 的测试意图，验证最终路线由 resolver 决定，而非要求提示词不写死路线。 |
> | Q3 `deriveRecipe` 前提 | (a) 标记为历史措辞，目标直接指向 `planAssets` | 不重开 v2 票 12，不建立并行 planner 逻辑。更新 v3 地图和 PRD 中过时的术语与目标描述。 |
> | Q4 `import` 范围 | (b) 本阶段保证规则与 pack 支持，create 链素材输入留待后续 | `import` 保留为合法路线，但本阶段不扩展 `planAssets`、CLI 或 MCP 的 `existingAssets` 输入。通过手写 Recipe 与 planner fixture 覆盖。明确记录 create 链目前不可达的限制，并单独规划后续输入面改造。 |
> | Q5 决策记录 | (a) 使用 plan sidecar，Recipe Schema 不变 | 在 Recipe 旁记录每项资源的 `id`、最终 `route`、`reason`、`inputs`。规划理由与可执行 Recipe 分离；pack ledger 和失败现场继续负责执行侧追溯。 |
> | Q6 能力输入 | (a) 最小能力对象 | 将 image、drawlist、import 的可用性，以及 design 的 `runtimeProfile.capabilities` 作为 `planAssets` 输入。不引入跨包 capability registry；规划阶段应识别不可执行路线，避免把已知缺少依赖的问题推迟到 pack 阶段。 |
>
> ## 裁定依据与实施边界
>
> ### 1. 核心架构决定
>
> - 模型负责提出资源规格与路线候选：保留现有模型调用及其资源规划能力。
> - 确定性路由层负责最终决策：`resolveRoute` 是 `source.kind` 的唯一最终写入者。
> - 能力对象约束可执行路线：路线必须与实际可用能力相符；不能因为模型选择了某条路线，就默认该路线可执行。
> - plan sidecar 负责决策追溯：记录最终路由、决策理由及相关输入，不把规划过程混入公共 Recipe Schema。
> - pack 负责按最终 `source.kind` 执行：沿用现有严格分派机制，不按资源名称或文件后缀重新推断路线。
>
> ### 2. 本阶段明确不做的事情
>
> 1. 不重开 v2 票 12，也不恢复 `deriveRecipe`。
> 2. 不修改公共 Recipe Schema，不新增 `decisionReason` 字段。
> 3. 不引入 `existingAssets` 输入，不宣称 create 链已支持端到端 `import`。
> 4. 不建设跨包 capability registry。
> 5. 不改变 CLI/MCP 的既有接口，也不调整 Pack 目录结构。
> 6. 不把模型的路线输出当成最终判决；最终路线由确定性 resolver 决定。
>
> ### 3. 实施验收方向
>
> - 同一份资源规格与能力输入，路由结果可重复、可测试。
> - 模型提供的路线候选不能绕过 resolver 对最终 `source.kind` 的决定。
> - 不可执行路线能在规划阶段明确失败。
> - 每项资源都有可追溯的规划记录，且记录与最终 Recipe 一致。
> - `image`、`drawlist`、`import` 三条合法路线均有覆盖；`import` 使用手写 Recipe 或 planner fixture 验证，不伪装成 create 链端到端能力。
> - 现有契约、CLI/MCP 接口和 Pack 目录结构保持不变。
>
> **裁定性质**：本轮确定路线与范围，并确认本图包含 Phase 1 实施及验收。具体规则矩阵、确定性语义、错误语义仍留待下一轮裁定；本轮不提前替它们作决定。
