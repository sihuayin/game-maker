# 02. cc-switch 切换不生效的原因与正确切换流程

Type: research
Status: resolved
Owner: research subagent · 2026-10-22
Blocked by: —
Map: ../map.md

## Question

cc-switch 里把 provider 从 DeepSeek 切走，但代理侧响应 `model` 仍是 `deepseek-flash`——切换没生效。
查明原因与正确流程，供票 04（HITL 切换）用：

1. cc-switch 的 provider 切换机制：它是怎么把请求模型名映射到目标 provider 的？
   「切换」要**保存 / 重载 / 重启代理**才生效吗？有没有已知的「切了不生效」的坑
   （缓存、DB 未写入、代理进程没重启、模型名 env 覆盖）？
2. 为什么「UI 里切了但代理侧没生效」——最可能的原因是什么？需要看 cc-switch 的哪个配置文件 /
   日志 / DB 才能确认？
3. 正确切换 MiniMax-M2.7 的**逐步操作清单**（含验证切换生效的最小手段：响应 `model` 不再是 flash）。

产出：research 笔记 + 一份给票 04 的 HITL 切换清单。**零付费、零上游调用**（纯查 cc-switch 文档与本地配置）。

## Answer

详见 research 笔记：`../research/02-cc-switch-mechanism.md`

**一句话结论**：切换根本没在代理侧生效——当前 Claude provider 仍是 DeepSeek（`providers.is_current=1`、
`~/.cc-switch/settings.json` 的 `currentProviderClaude=331fbb23-…`），MiniMax 只是「已配置、未启用」
（`is_current=0`）；代理日志 `[Claude] >>> 请求目标: https://api.deepseek.com/anthropic/...` 至今仍指向
DeepSeek，且整份日志无任何 MiniMax 记录。最可能原因是**只点了「编辑」而没点「启用/Switch」**（Edit≠Apply，
不翻转 `is_current`），或**切到了 Codex 侧的同名 MiniMax 卡**；不是缓存 / DB 没写 / 代理没重启。

模型名映射：代理把请求里的 Claude 别名档位（`claude-opus-5`→`deepseek-v4-pro`、`claude-sonnet-5`/`haiku`/
`fable`→`deepseek-flash`）按当前 provider 的 `ANTHROPIC_DEFAULT_*_MODEL` 映射，未命中别名时落到
`ANTHROPIC_MODEL`（DeepSeek 卡上 = `deepseek-flash`）硬兜底——这正是「请求 v4-pro 却回 flash」的来源。

正确切换（给票 04 的 HITL 清单）：Claude 列表对 MiniMax（端点 `https://api.minimaxi.com/anthropic`）点
**「启用」** → 校验 `is_current=1` + `currentProviderClaude=e8f6660c-…` → 重启 Claude Code →
看日志确认转发目标是 `https://api.minimaxi.com/anthropic/v1/messages (model=MiniMax-M2.7)` →
票 05 探针确认响应 `model=MiniMax-M2.7`（MiniMax 卡四档全映射到 M2.7，响应不会再是 flash）。
