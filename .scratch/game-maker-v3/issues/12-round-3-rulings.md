# 12. 第三轮裁定（v3 · 03/06/07 实现前细节）

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线回传)
Blocked by: —
Map: ../map.md
> 本轮只针对 03 路线规则、06 sidecar、07 能力对象的实现前细节；
> 04 确定性、05 错误语义仍留待下一轮。以下裁定逐字保留。

## Question

import 的表示；image 硬信号顺序；drawlist 的 UI 条件；冲突/缺失矩阵；reason 集合；
sidecar 字段/枚举/输入/候选/兼容；能力来源/结构性检查/接线。

## Answer

> | 问题 | 裁定 | 决定与边界 |
> | --- | --- | --- |
> | Q10.1 import 表示 | (a) fixture-only `existingAssets` | `existingAssets: [{ id, ref, mustReuse }]` 仅用于 resolver 内部输入与测试夹具。create 链传空数组，不扩展公共 `planAssets`、CLI 或 MCP 输入。只有 `mustReuse === true` 且 ref 可访问才允许选择 import；否则不能由模型候选触发。`mustReuse=true` 但 ref 不可访问时，规划期硬失败，不回退。 |
> | Q10.2 image 硬信号顺序 | 接受推荐顺序 | 固定为 `characterId > masterAsset > kind:"animation" > kind:"background"`，对应 `image:character`、`image:master`、`image:animation`、`image:background`。多项同时命中时取优先级最高者，reason code 记录实际采用的首个命中规则。 |
> | Q10.3 drawlist UI 条件 | (b) `ninePatch` 硬信号 | `kind:"ui"` 且存在有效 `ninePatch` 时，产生 `drawlist:ui-ninepatch` 硬信号。非九宫格 UI 不自动归入 drawlist，由 image/drawlist 候选平局裁决；候选缺失、非法或为 import 时，规划期失败。 |
> | Q10.4 冲突与缺失 | 接受推荐矩阵 | import 合格条件优先于所有 image/drawlist 信号；image 硬信号优先于 drawlist 硬信号；硬信号优先于候选。无硬信号时只接受合法的 image/drawlist 候选。没有合法路线或所选路线能力缺失时硬失败，不静默降级。`mustReuse=false` 时 import 不合格，继续评估其他信号。 |
> | Q10.5 reason code | 接受 8 个 code，不增加 `drawlist:ui-simple` | 闭合枚举：`import:explicit-ref`、`image:character`、`image:master`、`image:animation`、`image:background`、`drawlist:ui-ninepatch`、`image:candidate`、`drawlist:candidate`。 |
> | Q11.1/2 sidecar 字段 | 接受顶层与资源级分层 | 顶层保存 recipe 元数据、能力快照、规划级 `styleRef` 与可选 `referenceImage`；每项资源保存 ID、最终路线、reason、决策相关输入，以及可选候选和 `participated`。`inputs` 始终为对象；缺省字段省略，不写 `null`。 |
> | Q11.3 reason 枚举 | 接受闭合枚举 | `reason.code` 必须来自 Q10.5 的同一份闭合枚举；`reason.text` 可选，不能用自由文本代替 code。 |
> | Q11.4 搬运与兼容 | 接受推荐方案 | `plannerVersion` 使用字符串 `"1"`，规则版本改变时升级；`recipeVersion` 对应 `v<N>` 的 N。CLI/MCP 的 `plan` artifacts 包含 sidecar；create 将其复制到 `run/v<N>/asset-recipe.plan.json`。旧 Recipe 允许没有 sidecar，不推断历史理由。一致性测试只对 sidecar 存在的产物执行。 |
> | Q12.1–3 能力来源 | 接受结构性检查，不做 live ping | image、drawlist 的可用性根据配置完整性和协议支持进行结构性判断；不在规划阶段探测真实上游可用性。import 能力由内部输入决定，create 链固定为 `false`。选中不可用路线时规划期硬失败。 |
> | Q12.5 接线 | 接受推荐方案 | `plan` CLI/MCP 免费解析 image transport，命令名与参数保持不变；create 复用已有 image transport。能力对象作为 `planAssets` 内部输入，不扩展公共 CLI/MCP 参数。参考图支持性按具体资源所需的协议能力检查。测试使用 fake transport／配置，不调用付费上游。 |
>
> ### 关键规则的最终解释
>
> **1. 路线判定顺序**：1) import（匹配的既有素材 + mustReuse=true + ref 可访问；候选不能触发）；
> 2) image 硬信号（`characterId` → `masterAsset` → animation → background，取首个命中）；
> 3) drawlist 硬信号（`kind:"ui"` + 有效 `ninePatch`）；4) 候选平局（无硬信号时合法的 image/drawlist 候选）；
> 5) 能力校验（所选路线必须可用；能力缺失/无合法候选/无匹配规则均硬失败，不换路）。
> “import 优先”指**合格的** import 条件优先；`mustReuse=false` 时即使 ref 存在也不能据此选 import。
>
> **2. 候选与 `participated`**：有硬信号决定路线时，即使候选相同，`participated=false`；
> 无硬信号且合法候选决定路线时，`participated=true`；没有候选或候选非法时，不伪造候选、
> 不静默选默认路线；记录不应以 sidecar 代替错误处理。
>
> **3. Sidecar 结构边界**：接受顶层 `format / recipeId / recipeVersion / plannerVersion / capabilities /
> inputs{styleRef, referenceImage?} / assets[]`；每项 `id / route / reason{code,text?} /
> inputs{importRef?, masterAsset?} / candidate? / participated`。示例中 `candidate:"drawlist"` 与
> `image:character` 仅展示硬信号覆盖候选。
>
> **4. 能力判定边界**：image = 配置完整 + 协议受支持（需要参考图时须支持参考图）；
> drawlist = 文本上游 baseUrl/apiKey 非空；import = create 链 false / fixture 可 true（仍须验证 ref 可访问）；
> runtime 只记录。**结构性可执行不等于上游在线可用**；本阶段不 live ping、不引入付费探测。
>
> **下一轮交接**：04 确定性语义（resolver 输入输出、纯函数边界、重复执行一致性、候选规范化、sidecar 一致性）；
> 05 错误语义（无合法路线、ref 不可访问、能力缺失、候选非法的分类与上下文）。本轮不授权实现。
