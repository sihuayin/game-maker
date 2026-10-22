# 04. 把 DeepSeek 映射真正切到 deepseek-v4-pro 并确认代理侧生效

Type: task
Status: resolved
Owner: main session · 2026-10-22
Blocked by: 02
Map: ../map.md

## Question

按票 02 的定位，把 cc-switch 当前 DeepSeek provider 的模型映射**真正切到 `deepseek-v4-pro`**——
当前 `deepseek-v4-pro` 请求被 `ANTHROPIC_MODEL=deepseek-flash` 硬兜底降级成 flash。

**这是你账号侧的手工操作**（HITL）：只改 cc-switch 的 provider 配置，不改仓库、不改
`game-maker.local.json`。

要点（票 02 结论）：
- DeepSeek 卡的 `ANTHROPIC_MODEL` / `ANTHROPIC_DEFAULT_*_MODEL` / 对应 `*_NAME` 从
  `deepseek-flash` / `deepseek-v4-flash` 改成 **`deepseek-v4-pro`**；
- 或把 `deepseek-v4-pro` 加进别名映射（自映射），避免落到 flash 硬兜底。

完成判据：你回报「已切到 v4-pro」，且（经票 05 探针确认）响应 `model` 是 `deepseek-v4-pro`
（不再是 `deepseek-flash`）。若仍被映射成 flash，回到票 02 排查，不算完成。

⚠️ 风险（票 01）：DeepSeek 转译层曾实测把已生成的 `tool_use.input` 静默丢（`empty-input`），
且那次也是 flash 服务；切到 v4-pro 是否避得开丢数据，**只有票 05 探针能回答**。若探针仍 `empty-input`，
按 Q3 回退到 `MiniMax-M3.1-Flash → qwen3.8-max`。

## Answer

**已收口（task · HITL）**：用户改了 DeepSeek 卡的 `ANTHROPIC_MODEL`，并已本地核实。

- 改前：`ANTHROPIC_MODEL = deepseek-flash`（字面 `deepseek-v4-pro` 请求被兜底降级成 flash）。
- 改后：`ANTHROPIC_MODEL = deepseek-v4-pro`（已读 `~/.cc-switch/cc-switch.db` providers 表核实）。
- 根因：`plan-assets` 发字面 `model="deepseek-v4-pro"`（`packages/assets/src/ops.ts:334` 等，
  `generate.ts:101` 默认），未命中 Claude 别名 → 落到 `ANTHROPIC_MODEL` 兜底；兜底原来是 flash。
  代理日志有 809 条 `deepseek-v4-pro → deepseek-flash` 铁证。
- 效果：字面 `deepseek-v4-pro` 请求现在映射到 `deepseek-v4-pro`，不再降级。

端到端确认（代理进程是否已重载、实际返回 `model` 是否变 v4-pro）属票 05 探针；若探针仍回 flash，
回来重开本票（查代理缓存 / 重启 cc-switch）。
