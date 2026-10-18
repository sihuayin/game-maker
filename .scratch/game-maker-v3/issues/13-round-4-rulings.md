# 13. 第四轮裁定（v3 · 04 确定性 / 05 错误语义收口）

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线回传)
Blocked by: —
Map: ../map.md
> 本轮接受 04/05 推荐方案，并明确能力缺失归 `usage`(2)；下一阶段进入 08 测试基准。
> 本轮仍不代表源码修改或施工授权。以下裁定逐字保留。

## Question

归一化输入/纯函数/重复性/sidecar 一致性；错误类别、候选缺失/非法、失败 sidecar、失败上下文、不换路、测试。

## Answer

> | 问题 | 裁定 | 决定与边界 |
> | --- | --- | --- |
> | Q13.1 归一化输入 | (a) 接受 | 归一化输入包含 `spec + context + capabilities + existingAssets + candidate`。固定归一化输入时，resolver 输出必须一致。模型发现的资源清单及候选生成过程不在确定性承诺范围内。 |
> | Q13.2 resolver 纯函数 | 接受 | ref 可访问性由 planner 在调用前预检查，并以 `accessible` 布尔值传入。resolver 不执行 I/O、不读取环境、不使用时间或随机数。确定性承诺限定在同一 `plannerVersion` 内。 |
> | Q13.3 重复性测试 | 接受推荐方案 | 比较 `route`、`reason.code`、`inputs`、`candidate`、`participated`；若 `reason.text` 为固定文案，也应比较。不要求模型生成的整份 Recipe 字节级一致。另验证 sidecar 与 Recipe 的 route 一致、资源 ID 集合一致。 |
> | Q13.4 sidecar 一致性 | 接受 | sidecar 由 resolver 输出生成，不从 Recipe 反推决策理由。仅当 sidecar 存在时执行 sidecar 一致性测试；旧 Recipe 缺少 sidecar 时允许兼容，不推断历史理由。 |
> | Q14.1 错误类别 | 接受，明确能力缺失归 `usage`(2) | `usage`：用户输入、配置或必要能力缺失；`invalid`：无合法路线、路线候选不合格、必需 ref 不可访问、sidecar 与 Recipe 不一致、resolver 输出非法；`upstream`：仅规划阶段文本上游调用本身失败。resolver 错误不归 `upstream`。 |
> | Q14.2 候选缺失/非法 | 接受两档处理 | Schema／契约级错误保留现有重采样机制，用尽后归 `invalid`(4)；Recipe 合法但候选在路由语义上不合格时，立即硬失败，不重采样。 |
> | Q14.3 失败落 sidecar | 接受：不落 | sidecar 只作为规划成功的产物。规划失败时使用错误报文、现有 ledger 和失败现场报告，不生成部分成功的 sidecar。 |
> | Q14.4 失败上下文 | 接受推荐字段 | 失败信息应尽可能包含 asset ID、最终或候选 route、已知 reason code、缺失能力或 ref，以及失败阶段。尚未产生的字段不强行伪造。 |
> | Q14.5 不换路 | 确认 | 路线不可执行或所需能力缺失时直接失败，不回退、不静默选择默认路线。 |
> | Q14.6 测试 | 接受 | 每类错误至少一例；覆盖 CLI/MCP 退出码 `2/4/3`、失败不生成 sidecar、import ref 可访问与不可访问、九宫格与非九宫格 UI；不调用付费上游。 |
>
> ### 确定性边界
>
> 对固定版本和同一份归一化输入：
> `normalizedInput = spec + context + capabilities + existingAssets + candidate`
> `resolveRoute(normalizedInput)` 必须返回相同结果。确定性测试不要求模型重复生成相同资源清单，也不要求整份 Recipe 在多次模型调用间字节级一致；测试直接固定输入，验证 resolver 可重复性。
>
> ### 纯函数边界
>
> - resolver 只消费已归一化的数据；`existingAssets` 的 `accessible` 在调用前检查并传入。
> - 不发起网络请求、不读取文件、不探测环境、不自行判断实时 transport 可用性。
> - `reason.code`、`inputs`、`candidate`、`participated` 均来自确定性决策过程。
>
> ### Sidecar 一致性
>
> 成功规划后：每项 `route` 与 Recipe 的 `source.kind` 一致；资源 ID 集合一致；记录来自 resolver 输出，
> 不通过最终 Recipe 倒推；旧 Recipe 无 sidecar 不推断、不因此失败。
>
> ### 错误语义
>
> | 类别 | 退出码 | 典型情况 | 处理 |
> | --- | --- | --- | --- |
> | `usage` | 2 | 缺少必要配置、image transport 不可用、文本上游配置缺失 | 直接报错，指出可修复的配置或能力问题 |
> | `invalid` | 4 | 无合法路线、候选语义不合格、必需 ref 不可访问、sidecar 与 Recipe 不一致、resolver 输出非法 | 硬失败，不静默降级 |
> | `upstream` | 3 | 规划阶段文本上游调用本身失败 | 沿用现有上游失败语义 |
>
> 特别明确：能力配置缺失归 `usage`(2)；能力缺失与路线语义错误分开（前者 usage，后者 invalid）；
> Schema/契约级候选错误继续走现有重采样，用尽后 invalid(4)；合法 Recipe 中语义不合格的候选不得靠重采样掩盖；
> 失败不生成 sidecar，不得用部分 sidecar 代替错误报文。
>
> **下一阶段**：推进 08 测试基准；08 未完成前不授权 09 施工，也不运行付费上游。
