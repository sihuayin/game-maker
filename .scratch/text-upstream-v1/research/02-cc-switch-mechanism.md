# cc-switch 切换机制 + 「切了不生效」根因（research 02）

> 对应票：`../issues/02-cc-switch-mechanism.md`
> 结论一句话：**切换根本没在代理侧发生**——当前 Claude provider 仍是 DeepSeek（`is_current=1`），
> MiniMax 只是「已配置、未启用」（`is_current=0`）。最可能是 UI 里只做了「编辑」而没做「启用/Switch」，
> 或切到了 Codex 侧的同名 MiniMax 卡；不是缓存 / DB 没写 / 代理没重启的问题。

- 本机安装：CC Switch **v3.20.3**（farion1231/cc-switch，macOS）。
- 数据目录：`~/.cc-switch/`（`cc-switch.db`、`settings.json`、`logs/`、`backups/`、`model-pricing.json`）。
- 代理：`127.0.0.1:15721`，Claude 侧 `proxy_config.enabled=1`、`enable_local_proxy=true`。

---

## 1. cc-switch 的 provider 切换机制

### 1.1 代理模式（本机现状）

`~/.claude/settings.json` 的 `env` 只有三件事，把 Claude Code 指到代理：

```jsonc
{
  "ANTHROPIC_BASE_URL": "http://127.0.0.1:15721",
  "ANTHROPIC_AUTH_TOKEN": "PROXY_MANAGED",
  "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-5",      "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME": "deepseek-v4-pro",
  "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-5",  "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME": "deepseek-flash",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5",  "ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME": "deepseek-flash",
  "ANTHROPIC_DEFAULT_FABLE_MODEL": "claude-fable-5",    "ANTHROPIC_DEFAULT_FABLE_MODEL_NAME": "deepseek-flash"
}
```

即：Claude Code 把请求发给本机代理，**具体打到哪个 provider、什么 base URL、什么 token、什么模型名，
由代理根据「当前 provider」决定**，而不是由 `~/.claude/settings.json` 决定。

### 1.2 模型名映射

代理收到的请求里 `model` 是 Claude 的**别名档位**（`claude-opus-5` / `claude-sonnet-5` /
`claude-haiku-4-5` / `claude-fable-5`），代理按当前 provider 的 `settings_config.env` 做映射：

| 请求模型（别名） | 映射来源 env | DeepSeek 当前值 |
|---|---|---|
| `claude-opus-5` | `ANTHROPIC_DEFAULT_OPUS_MODEL` | `deepseek-v4-pro` |
| `claude-sonnet-5` | `ANTHROPIC_DEFAULT_SONNET_MODEL` | `deepseek-flash` |
| `claude-haiku-4-5` | `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `deepseek-flash` |
| `claude-fable-5` | `ANTHROPIC_DEFAULT_FABLE_MODEL` | `deepseek-flash` |
| 未命中别名（兜底） | `ANTHROPIC_MODEL` | `deepseek-flash`（硬兜底） |

本地 `proxy_request_logs` 直接证实了这张表：`request_model`（别名）→ `model`（实际模型），
例如 `claude-opus-5 → deepseek-v4-pro`、`claude-sonnet-5 → deepseek-flash`。历史聚合里还有
809 条 `deepseek-v4-pro → deepseek-flash`：当请求模型直接是真实名 `deepseek-v4-pro`（非别名）时，
代理没把它识别成 opus 档，落进 `ANTHROPIC_MODEL=deepseek-flash` 兜底 —— 这就是 map 里
「请求 v4-pro 被映射成 flash」的由来。

**三层覆盖优先级**（Claude Code 选模型 / cc-switch 映射共用的心智模型，lynxflow 博客归纳）：

1. `ANTHROPIC_MODEL`（最高，一旦设置整场强制）
2. `ANTHROPIC_DEFAULT_<档位>_MODEL`（档位 → 具体模型）
3. `model` 档位字段（当前选 opus/sonnet/haiku/fable）

### 1.3 「切换」必须分开「编辑」和「启用」，且要重启 CLI

- **「编辑」≠「切换」**。在 UI 里点「编辑 provider → 改模型 → 保存」只写 cc-switch 自己的 DB
  （`providers` 表模板），**不会**翻转 `is_current`、也不会把模板推到 Claude Code 实际读取的
  `~/.claude/settings.json`。真正生效要单独点 **「启用 / Switch / Apply」**。
- 官方 FAQ「切换供应商后不生效」给的解法是：**Claude Code 关闭重开终端 / 重启 IDE**（env 在进程
  启动时注入，改文件不影响已运行会话）。
- 代理本身对每个请求打一行 `[Claude] >>> 请求目标: <base_url> (model=<x>)`，说明它是按请求
  读当前 provider 的；但若切换后日志仍指向旧 base URL，兜底做法是**重启 CC Switch 应用**（连带重启代理）。

---

## 2. 已知「切了不生效」的坑

1. **只编辑没启用**（Edit ≠ Apply）：改了 provider 卡片但没点「启用/Switch」，`is_current` 没翻转。
2. **DB 模板与 live 文件漂移**：多次「编辑」累积在 DB 模板里，live 文件停在旧切换点，两边错位。
3. **`ANTHROPIC_MODEL` 硬兜底覆盖档位映射**：provider env 里如果设了 `ANTHROPIC_MODEL`，它会压过
   档位映射（尤其请求带的是真实模型名而非别名时）。
4. **旧版只写 base_url + token**（Issue #1790）：早期版本切换时只把 `ANTHROPIC_BASE_URL` 和
   `ANTHROPIC_AUTH_TOKEN` 写进 `settings.json`，模型 env 不同步（本机 3.20.3 已非此问题）。
5. **`settings.local.json` 优先级高于 `settings.json`**：本机 `~/.claude/settings.local.json` 不存在，排除。
6. **切错 app_type**：cc-switch 里 Claude 和 Codex 是两套独立 provider 列表、各自有 `is_current`。
   本机恰好 Claude 侧和 Codex 侧各有一张 MiniMax 卡（见 §4），切错那一边，Claude 代理完全不受影响。
7. **没重启 Claude Code**：会话 env 是启动时注入的。

---

## 3. 本地证据（2026-10-22，只读）

- `~/.cc-switch/settings.json` → `"currentProviderClaude": "331fbb23-…"` = **DeepSeek**。
- `~/.cc-switch/cc-switch.db` `providers`（`app_type='claude'`）：
  - `331fbb23-8870-4714-b872-308e11fa00a6` DeepSeek → **`is_current=1`**
  - `e8f6660c-f67f-46e1-8f3d-32608b187f81` MiniMax → **`is_current=0`**
  - 其余（Claude / 千问 Token Plan / Claude Official）均 `is_current=0`。
- `~/.cc-switch/logs/cc-switch.log` 当前（20:07 前后）仍是：
  `[Claude] >>> 请求目标: https://api.deepseek.com/anthropic/v1/messages (model=deepseek-flash)`
  （偶尔 `model=deepseek-v4-pro`）。整份日志里 **没有出现过 `MiniMax`/`minimaxi`** —— 说明切换从未到达代理层。
- `proxy_live_backup` 的 claude 项 = DeepSeek 配置，`backed_up_at=2026-10-22T11:08:45Z`。
- MiniMax 的 claude provider 在 DB 里**配置完整且可用**：`ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic`、
  token 已填（redacted）、`ANTHROPIC_MODEL` 与 opus/sonnet/haiku 全部 = `MiniMax-M2.7`、`API_TIMEOUT_MS=3000000`。

→ 结论：不是缓存、不是 DB 没写、不是代理没重启，而是**「当前 Claude provider」这个状态本身就没切走**。

## 4. 最可能的原因（按概率排序）

1. **只「编辑」没「启用」**：把 MiniMax 卡片改好/保存了，但没点启用/Switch，`is_current` 仍在 DeepSeek。
2. **切错 app_type**：Codex 侧有另一张 `minmax`（MiniMax-M3，`https://api.minimaxi.com/v1`），
   如果切的是这张，Claude 代理无感。
3. 切换被回滚 / 没保存成功（当前 `currentProviderClaude` 与 `is_current` 一致地指向 DeepSeek，说明没有半写状态）。

---

## 5. 正确切换到 MiniMax-M2.7 的逐步清单（供票 04 HITL）

前置：MiniMax 的 Claude provider 已在库里配好（§3），无需新建，只需「启用」。

1. 打开 CC Switch，进 **Claude** provider 列表（不是 Codex / Gemini）。
2. 找到名为 **MiniMax**、端点 `https://api.minimaxi.com/anthropic` 的卡片（provider id
   `e8f6660c-f67f-46e1-8f3d-32608b187f81`）。确认模型 env 全部 `MiniMax-M2.7`。
3. 点该卡片的 **「启用 / Switch」**（不是「编辑」）。这是让 `is_current` 翻到 MiniMax 的关键动作。
4. 只读校验 DB 状态：
   ```bash
   sqlite3 ~/.cc-switch/cc-switch.db \
     "SELECT id,name,is_current FROM providers WHERE app_type='claude';"
   # 期望：MiniMax 行 is_current=1，DeepSeek 行 is_current=0
   python3 -c "import json;print(json.load(open('$HOME/.cc-switch/settings.json'))['currentProviderClaude'])"
   # 期望输出：e8f6660c-f67f-46e1-8f3d-32608b187f81
   ```
5. **重启 Claude Code**（关终端重开 / 重启 IDE），让新会话从代理拿新 provider。
6. 零成本验证（不发请求）：看代理转发日志
   ```bash
   grep "请求目标" ~/.cc-switch/logs/cc-switch.log | tail -5
   # 期望出现：https://api.minimaxi.com/anthropic/v1/messages (model=MiniMax-M2.7)
   ```
   若仍显示 `api.deepseek.com`，**重启 CC Switch 应用**（连带重启代理）后再看一次。
7. 最终验证（票 05 探针，小额付费）：响应体 `model` 字段应为 **`MiniMax-M2.7`**，不再是
   `deepseek-flash`。因为 MiniMax 配置里 opus/sonnet/haiku/fable 全部映射到 `MiniMax-M2.7`，
   无论 Claude Code 发哪个别名档位，响应 model 都会是 `MiniMax-M2.7`。

完成判据（票 04）：探针响应 `model != deepseek-flash`（= `MiniMax-M2.7`），且日志目标为
`api.minimaxi.com/anthropic`。

---

## 6. 来源

- cc-switch 仓库（farion1231/cc-switch）：https://github.com/farion1231/cc-switch
- 官方 FAQ「5.2 常见问题」·「切换供应商后不生效」：https://raw.githubusercontent.com/farion1231/cc-switch/c002688a/docs/user-manual/zh/5-faq/5.2-questions.md
- 代理服务文档：https://ccswitch.co/docs/proxy-service.html ；代理指南（zh）：https://github.com/farion1231/cc-switch/blob/v3.19.1/docs/guides/proxy-guide-zh.md
- Issue #1790「切换 Provider 后模型环境变量未同步到 Claude Code settings.json」：https://github.com/farion1231/cc-switch/issues/1790
- lynxflow「ccswitch 改了模型不生效：三层模型覆盖根因诊断」（Edit≠Apply / DB 漂移 / ANTHROPIC_MODEL 硬兜底）：https://blog.lynxflow.co/en/posts/ccswitch-model-not-applying-claude-code/
- ofox.ai「CC Switch 接第三方中转踩坑指南：6 类配置问题」：https://ofox.ai/zh/blog/cc-switch-claude-code-third-party-relay-config-guide/
