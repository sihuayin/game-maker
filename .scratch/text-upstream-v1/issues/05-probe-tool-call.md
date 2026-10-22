# 05. 探针验证强制工具调用（付费 · 需授权）

Type: task
Status: resolved
Owner: main session · 2026-10-22
Blocked by: 04
Map: ../map.md

## Question

票 04 把 DeepSeek 映射切到 deepseek-v4-pro 后，发 **1 次文本探针**（小 schema、强制工具调用），验证：
- 响应 `model` 是 `deepseek-v4-pro`（不再是 `deepseek-flash`）—— 确认切换真生效；
- `content_types` 含 `tool_use`、`tool_input.ok === true`（非空入参）。

成功判据：`model` 正确 + 强制工具调用 + 非空入参。
失败判据：`empty-input` / 只有文本 / HTTP 错误 / `model` 仍被映射成别的名字。

**付费**：1 次文本请求，预计 < $0.01；计入 Q4 的 $0.25 硬上限。**必须先逐字授权再发。**

授权语句（待用户逐字）：
> 批准文本上游探针：1 次文本请求，模型 deepseek-v4-pro，强制工具调用，费用 < $0.01。

## Answer

**已收口（task · 付费探针）**：探针通过，`ANTHROPIC_MODEL` 修法在代理侧已生效。

- `model = deepseek-v4-pro`（不再是 `deepseek-flash`）→ 修复生效，**无需重启代理**。
- `stop_reason = tool_use`、`content_types = [tool_use]`、`tool_input = { ok: true }`（非空入参）。
- 实际花费 **$0.000135**（302 in / 37 out，cc-switch 日志 `total_cost_usd=0.0001350`）；
  累计 $0.000135 / $0.25。
- 结论：小 schema 强制工具调用在 v4-pro 上正常。下一步：票 06 plan-only 验证大 schema 的 recipe 入参。
