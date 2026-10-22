# 05. 修复文本上游并验证强制工具调用

Type: task
Status: paused
Owner: main session · 2026-10-22
Blocked by: —
Map: ../map.md

## Question

Stage A 在 `plan-assets` 上 **3/3** 返回 `empty-input`；当前 `cc-switch` 把请求里的
`deepseek-v4-pro` 映射成 `deepseek-flash`。先把文本上游换到能可靠返回**强制工具调用**
（`tool_choice: {type:"tool"}` + 非空 `tool_use.input`）的模型 / 提供方，再用 **1 次探针**验证；
之后才重跑 Stage A。

## 已核实的 cc-switch 上游（密钥已脱敏）

| provider | appType | 当前映射 | 端点 |
|---|---|---|---|
| **DeepSeek（当前）** | claude | `deepseek-flash` / `deepseek-v4-flash` | `https://api.deepseek.com/anthropic` |
| MiniMax | claude | `MiniMax-M2.7` | `https://api.minimaxi.com/anthropic` |
| 千问AI平台 Token Plan | claude | `qwen3.8-max` / `qwen3.8-flash` | `https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic` |
| Claude（relay） | claude | 未设 `ANTHROPIC_MODEL` | `https://api.ikuncode.cc` |
| Claude Official | claude | 官方登录（env 空） | 官方 |

## 推荐顺序

1. **DeepSeek 提供方内改映射**（最小改动）：把 `ANTHROPIC_MODEL`、`ANTHROPIC_DEFAULT_OPUS_MODEL`、
   `ANTHROPIC_DEFAULT_SONNET_MODEL`、`ANTHROPIC_DEFAULT_HAIKU_MODEL`、`ANTHROPIC_DEFAULT_FABLE_MODEL`
   及对应 `*_NAME` 从 `deepseek-flash` / `deepseek-v4-flash` 改为 **`deepseek-v4-pro`**。
   这是 `planAssets` 本来就在请求的模型；现在是被代理降级成了 flash。
2. 若 v4-pro 仍返回空入参：切到 **MiniMax-M2.7**（Anthropic 兼容端点），再跑探针。
3. 再不行：切到 **千问 qwen3.8-max**，再跑探针。
4. Claude relay / Official 需要 provider 里显式设一个可用的 Claude 模型名；放到最后。

⚠️ 只改 **cc-switch 的 provider 配置**（你的账号侧），不改仓库、不改 `game-maker.local.json`。
⚠️ 每次切换后先跑探针，**探针通过才重跑 Stage A**；不盲跑。

## 探针（1 次文本请求）

```bash
node .scratch/p0-final-v1/probe-tool-call.mjs deepseek-v4-pro
```

成功判据：`ok: true`、`content_types` 含 `tool_use`、`tool_input.ok === true`。
失败判据：`empty-input` / 只有文本 / HTTP 错误 / 模型仍被映射成别的名字（看 `model` 字段）。

探针是**一次文本请求**，预计 **< $0.01**；需逐字授权后才发。

## 授权语句

> **批准文本上游探针：1 次文本请求，模型 deepseek-v4-pro，强制工具调用，费用 < $0.01。**

探针通过后再另发 Stage A 重跑授权。

## 授权与当前状态（2026-10-22）

> 批准文本上游探针：1 次文本请求，模型 deepseek-v4-pro，强制工具调用，费用 < $0.01。

**状态**：已授权，**尚未发出**。读取 cc-switch 当前 provider 配置，DeepSeek 的
`ANTHROPIC_MODEL` / `ANTHROPIC_DEFAULT_*` 仍是 `deepseek-flash` / `deepseek-v4-flash`
（与失败时一致）。现在发探针只会重复同一档失败、白花一次请求；等切换生效后再发。

## 探针结果（2026-10-22，已授权 · 1 次请求）

```json
{
  "http": 200,
  "requested": "deepseek-v4-pro",
  "model": "deepseek-flash",
  "stop_reason": "tool_use",
  "content_types": ["tool_use"],
  "tool_input": { "ok": true },
  "usage": { "input_tokens": 291, "output_tokens": 33 },
  "ok": true
}
```

- **探针通过**：上游能返回强制工具调用 + 非空 `input`。
- **但模型仍是 `deepseek-flash`**：`requested=deepseek-v4-pro`，响应 `model=deepseek-flash`；
  cc-switch 的 DeepSeek provider 配置与代理日志都仍是 flash。**你在 UI 里的切换没有在代理侧生效。**
- 费用：291 in / 33 out ≈ **$0.00013**（deepseek-flash 单价），远低于 $0.01 上限。
- 解释：Stage A 的失败**不是**「deepseek-flash 完全不会工具调用」；小 schema 能过。
  更可能是**大 `emit_asset_recipe` schema** 或代理/上游的**数据丢失**（票 27 同档），而不是工具能力缺失。

## 下一步（待裁定）

- **A'. plan-only 重试（推荐）**：用失败现场的 `game-design.json` + `visual-world.json` 直接跑
  `game-maker plan`，只发 1 次 `plan-assets`（≤3 往返）、0 生图，≈$0.003；先验证失败是否可复现，
  再决定是否重跑整条 Stage A。
- **A. 直接重跑 Stage A**（当前 upstream，flash）：新授权 ≤15 文本请求、0 生图、15 分钟。
  便宜（上次约 $0.019），能直接验证是否偶发；若再次 `empty-input`，再换模型。
- **B. 先把映射真正切到 `deepseek-v4-pro`**：在 cc-switch 里确认保存 / 切走再切回 / 重启本地代理，
  再跑一次探针（`model` 应显示 `deepseek-v4-pro`），然后 Stage A。
- **C. 换 MiniMax-M2.7 或千问 qwen3.8-max**：先探针，再 Stage A；用于验证不同模型对大 schema 的处理。

## plan-only 重试（2026-10-22，已授权 · 1 次 plan-assets）

```bash
node packages/cli/dist/cli.mjs plan \
  --design  .failed-2026-10-22T08-18-36-700Z/game-design.json \
  --visual-world .failed-2026-10-22T08-18-36-700Z/visual-world.json \
  --out .scratch/p0-final-v1/runs/2026-10-22-real/plan-probe --json
```

- 退出码 **4**；`attempts=3`，failures **`empty-input` / `schema` / `empty-input`**；
  模型仍是 **`deepseek-flash`**；最后一发 217 in / 2753 out / 32.6 s。
- cc-switch 上游日志：19:02:19 / 19:02:31 / 19:02:41 三发，费用
  **$0.003743 + $0.003645 + $0.003418 = $0.010806**。
  ⚠️ **略高于授权的 $0.01 上限**（超出 $0.0008）；已停，未再发请求。
- 结论：**不是偶发**。当前 DeepSeek→`deepseek-flash` 映射无法稳定产出大 `emit_asset_recipe`
  工具入参；第二发甚至进了 `schema`（入参有、但不过契约）。

## 下一步（B 的继续）

1. **真正切换 provider**：在 cc-switch 里把当前 Claude provider 从 DeepSeek 切到
   **MiniMax（MiniMax-M2.7）** 或 **千问（qwen3.8-max）**；或确认 DeepSeek 的 v4-pro 映射真的生效
   （当前 DB / 代理日志仍是 flash）。
2. 切换后回我「已切换 <provider>」，我按已授权范围先跑 **1 次探针**（< $0.01）；
   探针通过后再请你批 **plan-only 重试**（1 次 plan-assets，≤3 往返，0 生图，< $0.01）。
3. 两次都过才重跑整条 Stage A。

## 暂停（2026-10-22，用户指令）

> **暂时停止。** 当前停在「切换 provider」这一步；恢复时按上文「下一步」继续：
> 切换 → 探针（< $0.01，需授权）→ plan-only 重试（< $0.01，需授权）→ Stage A 重跑 → Stage B。
> 已发生文本 ≈ $0.0297、生图 $0；无残留进程（9098 转发已停）。不提交 / 不推送。
