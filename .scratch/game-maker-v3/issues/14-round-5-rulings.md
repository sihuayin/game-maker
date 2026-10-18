# 14. 第五轮裁定（v3 · 08 测试基准收口）

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线回传)
Blocked by: —
Map: ../map.md
> 本轮只裁定测试基准；不实施路由算法、不跑付费上游、不解除 09 施工阻塞。
> 以下裁定逐字保留。

## Question

fixture 来源；测试落点与 sidecar schema；用例清单；旧测试改写；观察/门禁；零付费。

## Answer

> | 问题 | 我的裁定 |
> | --- | --- |
> | Q15.1 fixture 来源 | 接受 (a)。将真实 LLM 输出中的 `game-design.json`、`visual-world.json`、`character-dna.json`、`asset-recipe.json` 复制到 `fixtures/e2e/wasteland-platformer/`，测试只读固定 fixture，不依赖 `.scratch` 运行现场。另建小型 import fixture，使用复制进 fixtures 的既有 PNG 和手写 Recipe。 |
> | Q15.2 测试落点 | 接受推荐落点。resolver、sidecar 行为、capability 测试放在 `packages/assets/tests/`；集成测试放在 `packages/pipeline/tests/`；CLI、MCP 退出码分别在各自测试目录验证；契约测试放在 `packages/contracts/tests/`。 |
> | Q15.2 sidecar schema | 接受新契约 `packages/contracts/src/asset-plan.ts`，定义 `asset-plan/v1` 和 `parseAssetPlan`。sidecar 是独立契约，不修改公共 Recipe Schema，不把规划过程中的临时字段混入既有 Recipe。 |
> | Q15.3 用例清单 | 接受全部 12 组覆盖，N=20。加入 sidecar JSON Schema 专项测试，覆盖必填字段、空值、candidate 枚举及非法值。20 次测试用于验证同一归一化输入的确定性，不视为统计意义上的稳定性证明。 |
> | Q15.3 旧测试 | 接受改写 `plan-assets.test.ts:180`。测试语义改为「最终 route 由 resolver 决定」，并断言候选信息被记录；不再把旧的直接选路行为当成契约。 |
> | Q15.4 观察/门禁 | 接受。路线分布、宽高比、失败原因作为观察数据，不作为 Phase 1 阻断条件。门禁仅覆盖路线合法性、能力、ref、sidecar 一致性、确定性和错误分类。不引入综合 QA 分数。 |
> | Q15.5 零付费 | 接受。仅使用固定 fixture、fake transport、fake generator 和手写 Recipe；不调用付费上游，不为测试引入隐式真实网络请求。 |
>
> ### 补充边界
>
> **Sidecar 专项测试**：除必填字段、空值、candidate 枚举外，还覆盖 `route` / `reason.code` / `inputs` /
> `candidate` / `participated` 的类型与约束；未知版本、未知 reason code、非法 route、非法枚举值应被拒；
> `null` / 缺失 / 空字符串 / 错误类型按契约区分；sidecar route 与 Recipe `source.kind` 不一致必须失败；
> candidate 合法性与最终 route 合法性分别验证。contracts 负责结构与合法性，assets 负责路由决策语义。
>
> **错误分类**：`usage`(2) = 所需能力不存在（缺 image transport / 文本上游 / 参考图能力）；
> `invalid`(4) = 输入或产物违反契约（无合法路线 / ref 不可访问 / sidecar 不一致）；
> `upstream`(3) = 已进入文本上游调用但失败。不得把能力缺失误报为 invalid，也不得把上游失败降级为 invalid。
>
> **确定性比较**：同一归一化输入 20 次，比较 `route / reason.code / inputs / candidate / participated`；
> 同时验证 sidecar route 与 Recipe source.kind、ID 集合一致。不要求键顺序/日志顺序/无关诊断文本一致。
>
> **路线分布**：废土 fixture 预期的 4 image / 6 drawlist 仅作观察；偏离不使 Phase 1 失败。
>
> **验收边界**：实施后覆盖 assets / CLI / MCP / pipeline / pack / 旧 Recipe / 塔防分派 / `check:deps`
> 全量回归。本轮不实施路由算法、不新增付费上游、不提前解除 09 施工阻塞。
