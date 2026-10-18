# 05. 不可执行路线与缺失依赖的失败面

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线；第四轮已收口，见 [13](13-round-4-rulings.md))
Blocked by: —
Map: ../map.md
> PRD FR-7 / 第一轮验收：不可执行路线必须在**规划阶段**明确失败，不能推到 pack。
> ⚠️ 不新增错误通路；沿用现有 `CommandError` 闭集与退出码语义。

## Question

规划期的失败面怎么定？

1. **哪些情况在 plan 阶段硬失败**：能力缺失（image 无凭据 / drawlist 无文本上游 / import 无 ref）、
   ref 不可访问、规则冲突、无合法路线、模型候选非法？
2. **错误类别**：分别落 `usage`(2) / `invalid`(4) / `upstream`(3)？还是统一 `invalid`？
   与现有 `pack` 的报错（非法 route、缺 image 凭据）如何分工，避免同一事实报两遍？
3. **报文**：至少含 asset id、选择的 route（或候选）、失败原因、缺失的能力/输入。
4. **失败时落什么**：plan sidecar 是否仍写（带失败条目）？账是否照现有「发出即记」？
5. **与重采样的关系**：哪些失败算「模型没生成好」触发重采样，哪些是硬失败、不重采样？


## 第四轮裁定（收口，见 [13](13-round-4-rulings.md)

- `usage`(2)：必要配置/能力缺失（image transport、文本上游、用户输入）。
- `invalid`(4)：无合法路线、候选语义不合格、必需 ref 不可访问、sidecar 与 Recipe 不一致、resolver 输出非法。
- `upstream`(3)：仅规划阶段文本上游调用失败；resolver 错误不归 upstream。
- Schema/契约级候选错误保留现有重采样（用尽后 invalid）；resolver 语义失败立即硬失败、不重采样。
- 失败不生成 sidecar；错误上下文含 asset id / route / reason / 缺失能力或 ref / 阶段。
- 能力缺失与路线语义错误分开；不换路。
