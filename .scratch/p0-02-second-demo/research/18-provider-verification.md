# 票 18 · 零付费核验 provider 端点、计价与护栏

| 属性 | 值 |
|---|---|
| 方法 | 本地脱敏解析 `resolveTextTransport` / `resolveImageTransport`；不调用上游、不读/输出密钥内容 |
| 基线 | P0-02 起始 `4f3bc69`；本票零付费、零生产修改 |
| 结论 | **图片端点 = 官方 Gemini API；文本在当前 env 下被 `ANTHROPIC_*` 覆盖到本地代理；unset 后回落到官方 Gemini。严格 $6 硬护栏未建立。** |

## 1. 环境变量存在性（只查名称，不读值）

| 变量 | 是否设置 |
|---|---|
| `ANTHROPIC_BASE_URL` | **是** |
| `ANTHROPIC_AUTH_TOKEN` | **是** |
| `GAME_MAKER_IMAGE_BASE_URL` / `_API_KEY` / `_MODEL` / `_PROTOCOL` | 均否 |

## 2. 当前解析结果（不输出密钥）

| 上游 | source | protocol | host | model | key | proxy |
|---|---|---|---|---|---|---|
| text（当前 env） | **env** | anthropic | `http://127.0.0.1:15721` | （未指定） | 有 | 否 |
| image（文件） | file | gemini | `https://generativelanguage.googleapis.com` | `gemini-3.1-flash-lite-image` | 有 | 有 |

- `resolveTextTransport` 的优先级：`ANTHROPIC_*` env 优先于 `game-maker.local.json` 的 `text` 段；同时存在时**以 env 为准**（`packages/assets/src/text-config.ts:63-78`）。
- 文件里的 `text` 段本身是 **gemini 官方端点**（`https://generativelanguage.googleapis.com`，model `gemini-3.5-flash`）。
- 因此当前会话的文本路径是**本地 anthropic 代理**，**不是**冻结 run 的 Gemini 路径；成本模型不适用于当前文本路径。

## 3. unset 后的解析结果（零付费验证）

```bash
env -u ANTHROPIC_BASE_URL -u ANTHROPIC_AUTH_TOKEN node --input-type=module -e '...'
```

| 上游 | source | protocol | host | model |
|---|---|---|---|---|
| text | **file** | gemini | **`https://generativelanguage.googleapis.com`** | `gemini-3.5-flash` |
| image | file | gemini | **`https://generativelanguage.googleapis.com`** | `gemini-3.1-flash-lite-image` |

- **两端点都是官方 Gemini API 主机**；按官方价表计价（`gemini-3.5-flash` 官方已弃用并自动路由到 `gemini-3.6-flash`）。
- 两个上游都配置了 proxy（只确认存在，未输出 proxy 主机）；proxy 是传输通道，**不是**支出限额。
- **执行前必须** `unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN`，并在干净 env 下复核 source=file / host=官方；否则文本会走本地代理，成本模型不成立。

## 4. 支出护栏核验

- 官方 Gemini API 的 **Prepay 余额**在 $0 时返回 HTTP 402，但计费处理有约 10 分钟延迟；**月度 spend cap** 更慢，且文档明说 enforcement 不是即时、overage 照常计费（见 `research/13-cost-model.md` §3.3/§5）。
- 本地 proxy（`127.0.0.1:15721`）不是计量网关，未验证为预算上限；不能当硬护栏。
- **结论：无法建立“单次运行严格不超过 $6.00”的 provider 侧硬停止。**
- 可行的替代是**有界超射**：
  - 静态上限 $6.00 + checkpoint 两段闸 + 监视 pack staging 目录 + `--concurrency-image 1`；
  - 超射上限约 1–2 张图（≈$0.034–$0.067），不是零；
  - 若要求零超射，只能保持阻塞，或改用能按次计费/硬拒绝的 provider。

## 5. 对票 19 的输入

1. 端点/计价档：**已闭合**——两端均为官方 Gemini API；文本需 unset `ANTHROPIC_*`。
2. $6.00 上限：可作为目标，但**不是严格硬停止**。
3. 可选项：
   - (a) 接受“有界超射（≤1–2 张图）+ checkpoint 闸”，授权 $6.00；
   - (b) 不接受任何超射 → 保持阻塞；
   - (c) 换 provider / 换能硬拒绝的计量网关后再授权。
4. 付费生图：仅在 (a) 或 (c) 成立时批准。
5. 环境：执行前 unset `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`，干净 env 复核 source=file / host=官方。
6. 第二次完整运行：仍须另行 HITL 批准；只换输入、不改代码、不拼接。

## 6. 限制

- 没有登录 provider 控制台、没有查账单、没有做付费探测；Prepay/spend cap 的实际行为来自官方文档与 `research/13`。
- 没有读取/输出任何密钥；只输出 host/model/protocol 与 key 存在性。
- 本地 proxy 的性质（转发/计量/限额）未验证；若它是计量网关，需用户提供其预算能力。
- 端点官方价按 2026-10-29 官方页；`gemini-3.5-flash` 自动路由到 3.6，按 3.6 计价。
