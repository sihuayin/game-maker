# 预算授权 v5（LiteLLM 验证后）

Type: grilling
Status: resolved
Blocked by: 22

## Question

仅在票 22 的零预算 429 验证通过后，重新提交预算授权：

1. 确认 `max_budget=0 → 429` 在两条路径上都成立，且上游零调用；
2. 是否授权 `max_budget=6`（lifetime）的一次完整 A 运行；
3. 是否批准在上限内付费生图；
4. 执行前清除 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`，确认文本与生图都走 LiteLLM；
5. 第二次完整运行仍须另行 HITL 批准；只换输入、不改代码、不拼接。

若验证失败/部分通过，本票保持阻塞，不授权付费。产物：票内 Answer + `rulings-2026-10-29.md`（追加逐字裁定）。

## Answer

**已关闭（2026-10-29）：用户裁定不用 LiteLLM，票 23 作废。** 未授权 $6，未授权付费生图；P0-02 付费执行保持 BLOCKED。新路径由票 24 重新裁定。
