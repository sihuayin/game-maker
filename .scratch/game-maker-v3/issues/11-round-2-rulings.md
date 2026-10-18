# 11. 第二轮裁定（v3 · 规则方向 / sidecar 方向 / 能力对象边界）

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线回传)
Blocked by: —
Map: ../map.md
> 本轮确定路线优先级、sidecar 方向、能力对象边界；**具体信号定义、sidecar Schema、能力映射仍留在 03/06/07**。
> 以下裁定由人离线填写并回传，逐字保留。

## Question

模型候选的角色；路线优先级与额外信号；sidecar 路径/格式/reason/搬运；能力对象形状与 import 在 create 链的取值；runtime capabilities 是否参与规则。

## Answer

> | 问题 | 裁定 | 决定与边界 |
> | --- | --- | --- |
> | Q7 · 模型候选的角色 | (b) 硬约束优先，候选只在 image/drawlist 之间平局裁决 | 模型候选是消除不确定性的信号，不是最终判决。显式 import 条件和结构化硬信号优先于候选；候选可在没有更高优先级规则决定路线时，帮助区分 image 与 drawlist。候选及其是否参与最终决策写入 sidecar。 |
> | Q7 · 路线优先级 | 接受 `import > image > drawlist`；无合法路线或能力缺失时规划期硬失败 | import 必须有显式既有素材引用，并且设计或资源规格要求原样使用；不能仅凭模型候选选择 import。image 的硬信号优先于 drawlist。选定路线不可用时直接失败，不静默降级或重新选路。 |
> | Q7 · 额外信号 | 不纳入 `size` / `required` / `dependsOn` | Phase 1 保持最小信号集合。尺寸、必需性和依赖关系不参与路线选择，避免混淆资源生成方式与资源优先级、依赖管理等其他语义。未来如需纳入，应另行裁定。 |
> | Q8 · sidecar 路径、格式与搬运 | 接受推荐方案 | 规划记录写入 `recipes/v<N>.plan.json`，与 Recipe 版本对齐；create 时复制至 `run/v<N>/asset-recipe.plan.json`。pack 不读取 sidecar，执行侧继续使用 ledger 和失败现场。旧 Recipe 缺少 sidecar 时允许继续处理，不推断或伪造规划记录。 |
> | Q8 · reason 表示 | 稳定 code + 可选人话；记录候选和能力快照 | reason code 是自动化测试的稳定锚点，人话说明用于排查。记录每项资源的最终路线、理由、相关输入和可选候选，同时记录能力快照。sidecar 的最终 route 必须与 Recipe 对应资源的 `source.kind` 一致。 |
> | Q9 · 能力对象形状 | 接受推荐方案 | 采用 `routes: { image, drawlist, import }` 三个布尔值，加 `runtime: { profile, version, capabilities }`。作为 `planAssets` 内部输入，不建 registry、不缓存、不持久化；能力快照写入 sidecar。 |
> | Q9 · import 在 create 链 | 接受：固定 `false` | Phase 1 的 create 链不提供 import 能力。手写 Recipe 和 planner fixture 可以显式传入 `import: true`，验证规则与 pack 的 import 支持。不扩展公共 Recipe、CLI 或 MCP 接口。 |
> | Q9 · runtime capabilities | 只记录，不参与路线规则 | 记录 design 中 `runtimeProfile` 的 profile、version 和 capabilities，供追溯与后续分析。本阶段不让 runtime capabilities 参与 `resolveRoute` 的路线选择或能力判定。 |
>
> ### 补充裁定与边界
>
> **1. Q7 确定性路线规则**：路线决策按以下顺序执行：
> 1. Import 硬规则：有显式既有素材引用，且 design/spec 要求原样使用，选择 `import`。若缺少引用，不允许由候选触发 import。
> 2. Image 硬信号：`characterId`、`masterAsset`、`kind: animation`、`kind: background` 等已约定硬信号，选择 `image`。
> 3. Drawlist 硬信号：`kind: ui` 且符合已约定的简单几何／九宫格条件，选择 `drawlist`。
> 4. 候选平局裁决：在没有 import 条件、也没有决定性硬信号时，候选可在 `image` 和 `drawlist` 之间作选择。候选不能覆盖 import 规则或与之冲突的硬信号。
> 5. 规划期硬失败：没有合法路线，或最终路线所需能力不可用时，报错并指出资源 ID、路线及缺失能力。不静默降级。
>
> ⚠️ 实施前，03 路线规则矩阵仍需将各硬信号的具体字段、冲突组合及候选缺失时的行为写成可测试的判据。
>
> **2. Q8 sidecar 形状**：接受以下顶层结构（形状示意，不是完整 Schema）：
>
> ```json
> {
>   "format": "asset-plan/v1",
>   "recipeId": "...",
>   "recipeVersion": 1,
>   "plannerVersion": "...",
>   "capabilities": {
>     "routes": { "image": true, "drawlist": true, "import": false },
>     "runtime": { "profile": "...", "version": "...", "capabilities": [] }
>   },
>   "assets": [
>     {
>       "id": "...",
>       "route": "image",
>       "reason": { "code": "image:character", "text": "..." },
>       "inputs": {},
>       "candidate": "image"
>     }
>   ]
> }
> ```
>
> `inputs` 仅保留与决策有关的 `importRef`、`masterAsset`、`styleRef`、`referenceImage` 等字段；
> 具体必填条件、空值表达和候选枚举应在 06 中明确。旧 Recipe 没有 sidecar 不构成错误；
> 不能反过来根据旧 Recipe 的 `source.kind` 补造其历史决策理由。
>
> **3. Q9 能力对象**：
> - `routes.image`：来自当前 image transport／生图能力是否可用。
> - `routes.drawlist`：来自文本上游能力是否可用。
> - `routes.import`：create 链固定为 `false`；测试或手写 Recipe 路径可显式提供 `true`。
> - `runtime`：来自 design 的 `runtimeProfile`，仅用于记录。
>
> 这里的能力布尔值必须代表真实可执行条件，不能仅以配置字段存在就断言上游可用。
> 具体如何从 `resolveImageTransport` 和文本上游解析结果映射到布尔值，应在 07 中固定并测试。
>
> **下一轮交接**：本轮只确定规则优先级、sidecar 方向和能力对象边界。后续仍按依赖顺序处理：
> 03 路线规则矩阵（硬信号、候选平局、冲突组合、无合法路线）· 06 sidecar 形状（字段 Schema、reason code 枚举、输入字段与兼容行为）·
> 07 能力对象形状（能力来源、判定条件与错误上下文）· 04 确定性语义（依赖 03/07）· 05 错误语义（依赖 03/07）。
