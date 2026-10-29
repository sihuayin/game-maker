# 票 20 · 寻找可硬限额的计量网关

> **性质**：零付费研究。未调用任何付费上游、未读/输出密钥或环境变量值、未改生产代码/契约/测试/fixtures/历史证据、未运行 `create/build/plan/pack/compile-*` / `playtest` / `test:*` / 浏览器探针。
> **基准**：P0-02 起始 `4f3bc69`（票 02）；当前分支 `main`，研究期间工作树只改本票两处。
> **日期**：2026-10-29。
> **上游**：`research/13-cost-model.md`（成本与护栏）、`research/18-provider-verification.md`（端点与环境）。

## 0. 结论先行

1. **没有可核实的 provider 侧“预请求金额硬限”。** 官方最接近的三条都不是严格路径：**Prepay** 在余额 $0 时返回 402，但有 **~10 分钟计费管线延迟**；**spend cap budget** 是月度、非即时、在飞请求会完成且超支照常计费；**AI Studio 项目 spend cap** 也是实验性、~10 分钟延迟。官方文档逐字写了 “any cost overages are billed as normal” 与 “doesn’t guarantee that you won’t spend more than your budget”。
2. **Gemini API 的 RPD/RPM/TPM 配额不是可用的替代品**：按 project（不按 key）计；官方只描述 tier 分配与“申请增加”，**没有记录可下调 RPD**；Cloud Quotas 的 quota override 虽然官方定义为 “capping usage”，但明确“not available to all services”，且**没有 `generativelanguage.googleapis.com` 可用 override 的文档**；更关键的是速率限制页逐字写 “Specified rate limits are not guaranteed and actual capacity may vary.”。
3. **能做“下一次调用前”金额判断的只有网关侧/客户端侧记账**：
   - **LiteLLM Proxy（自托管）＝最接近严格**：key `max_budget=6`（lifetime）、预请求 **429**、per-request **预算预留（含 image 成本）**、原生 Gemini `:generateContent` 与 `/v1beta/interactions`、cost map 精确模型；残留是 `x-goog-api-key` 鉴权未验证、预留为估算。
   - **OpenRouter（SaaS，零代码）＝部分**：lifetime per-key cap、超限 403；但 **image 不在在飞预留里**，且本仓生图 `/images/generations` 与 PNG 输出未验证。把 key cap 设为 **$5.80**、生图并发 1，可把绝对花费压在 $6 内（≤$5.84）。
   - **自建计量代理＝兜底**：唯一不依赖第三方网关语义、能保持两条原生路径的方案，但信任根是我们自己的代码；必须先实现/离线验证/HITL。
4. **Cloudflare AI Gateway** 原生文本可硬拒，但 `gemini-3.1-flash-lite-image` 不在其定价目录，生图可能是 $0 盲区；**Vercel** 官方自认 soft cap；**Portkey/Helicone/Requesty/Kong** 协议/模型/状态码不匹配（§4）。
5. **本地 `127.0.0.1:15721` 不是计量网关**：它是 CC Switch 3.20.3 的本地路由服务（格式转换 / failover / 请求日志 / 用量估算），没有预算或限额执行；不能当硬护栏（详见 §5）。
6. **不推荐“有界超射”**：票 19 的 Q1(b) 已否决。若网关/代理路径都不被接受，正确结论是**保持 BLOCKED**，不是把超射包装成控制。

**一句话**：**没有 provider 强制的严格 $6 路径**；最接近的是 **LiteLLM 的 key 预算 + 预请求预留**（自托管，需先做 `max_budget=0` 的零付费 429 验证），零代码替代是 **OpenRouter lifetime cap $5.80**（**仅在用户明确接受“cap 低于 $6 以吸收在飞缺口”时**；且有生图路由/格式未验证），最后才是**自建代理**。若“严格”必须由 provider 保证，答案是**不存在**，应保持 BLOCKED。

---

## 1. 事实基线（代码与官方文档，2026-10-29）

### 1.1 本仓实际发出的请求形状

| 上游 | 协议 | 实际 URL（`baseUrl` 来自配置） | 请求头 | 代码 |
|---|---|---|---|---|
| 文本（强制工具调用） | `gemini` | `${baseUrl}/models/${model}:generateContent` | `x-goog-api-key` | `packages/contracts/src/gemini-call.ts:195` |
| 文本（纯 JSON / drawlist） | `gemini` | `${baseUrl}/models/${model}:generateContent` | `x-goog-api-key` | `packages/contracts/src/gemini-call.ts:270`；`packages/assets/src/generate.ts:124-127` |
| 文本（`anthropic` 回退） | `anthropic` | `${baseUrl}/v1/messages` | `x-api-key` | `packages/contracts/src/gemini-call.ts:211` |
| 生图 | `gemini` | `${baseUrl}/interactions`（3.x；2.5 才走 `:generateContent`） | `x-goog-api-key` | `packages/assets/src/image-gen.ts:399-407,448` |
| 生图（`openai`） | `openai` | `${baseUrl}/images/generations`、`/images/edits` | `Authorization: Bearer` | `packages/assets/src/image-gen.ts`（OpenAI 段） |

- 配置的官方示例：`game-maker.local.example.json` 的 `text.baseUrl` / `image.baseUrl` 都是 `https://generativelanguage.googleapis.com/v1beta`，所以实际请求是 `/v1beta/models/...:generateContent` 与 `/v1beta/interactions`。**本地代理必须原样保留 `/v1beta` 与 `/interactions` 路径**。
- 文本配置**没有** `GAME_MAKER_TEXT_*` 环境变量；只有 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`，且它们会**强制** `protocol: "anthropic"`（`packages/assets/src/text-config.ts:63-78`）。要把文本指向一个 Gemini 协议的本地/第三方端点，只能改 `game-maker.local.json` 的 `text` 段（或用一份临时 cwd 下的副本，见 §6.3）。
- 生图有环境变量覆盖：`GAME_MAKER_IMAGE_BASE_URL / _API_KEY / _MODEL / _PROTOCOL`（`packages/assets/src/image-config.ts:20-25`），优先级高于文件。**生图可以在不改文件的前提下改路**。
- ⚠️ **代理字段的耦合**：CLI 用 `text.proxy` 造一个 `fetchImpl`，并把它同时传给生图（`packages/cli/src/cli.ts:562`；`packages/assets/src/ops.ts:1576` 的 `fetchImpl ?? (t.proxy ? …)`）。若把 `text.baseUrl` 指向 `http://127.0.0.1:<port>` 却保留 `text.proxy`，`createProxyFetch` 会对 localhost 发起 HTTPS/CONNECT（`packages/assets/src/http.ts:34-72`），**本地代理这条路会直接坏掉**。临时配置副本必须**删掉 `text.proxy`**。

### 1.2 当前端点与环境（继承票 18，未重读密钥）

- 图片与文件文本两段都指向官方 Gemini（`generativelanguage.googleapis.com`）；文本模型 `gemini-3.5-flash`（官方自动路由到 `gemini-3.6-flash`），生图模型 `gemini-3.1-flash-lite-image`。
- 当前会话的 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` 把文本覆盖到 `http://127.0.0.1:15721`（CC Switch），`protocol` 变成 `anthropic`。**执行前必须 unset 并在干净 env 复核**；否则本票的 Gemini 成本模型不成立。
- 票 18 已确认：`ANTHROPIC_*` **两个都设置**；`GAME_MAKER_IMAGE_*` 均未设置；`game-maker.local.json` 存在，内容未读。

### 1.3 官方价格（USD，检索 2026-10-29）

| 项 | 单价 | 来源 |
|---|---:|---|
| `gemini-3.6-flash` input | **$0.75 / 1M**（2027-01-01 起 $1.50） | https://ai.google.dev/gemini-api/docs/pricing |
| `gemini-3.6-flash` output（**含 thinking tokens**） | **$3.75 / 1M**（2027 起 $7.50） | 同上；页面逐字 “Output price (including thinking tokens)” |
| `gemini-3.1-flash-lite-image` input | **$0.25 / 1M** | 同上 |
| `gemini-3.1-flash-lite-image` text/thinking output | **$1.50 / 1M** | 同上 |
| `gemini-3.1-flash-lite-image` image output | **$30 / 1M image tokens；1K 图 1,120 tokens ⇒ $0.0336/张** | 同上；逐字 “Output images at 1K (1024x1024px) consume 1120 tokens and are equivalent to $0.0336 per image.” |

- 冻结 run 的成本（票 13，官方价）：checkpoint **$0.0733**；build **$0.5348**；全量 **$0.6081**；A（16 图）**≈$0.675**；结构性最坏（31 文本 + 56 图）**$4.32**；A 96 图 **$5.67**；A 100 图 **$5.80**。
- **本票所有“$6 内”的论证都只按 2026 年内价格**；跨到 2027 年价格翻倍，必须重算。

---

## 2. 方案对比表

| 方案 | 硬限机制（是否预请求） | provider 强制？ | 与现有 protocol/model 兼容 | 零付费验证 | 用户动作 | 改生产代码？ | 残留风险 | 严格 ≤$6？ |
|---|---|---|---|---|---|---|---|---|
| **A. Google Cloud 配额覆盖（RPD/模型）** | 若存在则 429 预请求；但**未获文档支持** | 未证明 | 是（不动端点/协议/模型） | 控制台若允许改 0，可验 429 | 有项目/计费与配额编辑权限；在 `IAM & Admin → Quotas & System Limits` 找 RPD | 否 | 该服务是否开放 override 未知；无传播 SLA；官方写 “rate limits are not guaranteed”；午夜重置 | **否（本票不推荐）** |
| **B. Google 官方 Prepay 余额** | 余额 $0 → `402` | 是 | 是 | 查余额，无需调用 | 充值到目标值；**关闭 auto-reload** | 否 | 文档明说 **~10 分钟 overage**；可出现负余额 | **否**（票 13/18/19 已否决） |
| **C. Google 月度 spend cap budget** | 超限暂停新用量 | 是 | 是 | 看控制台设置 | 设置预算 | 否 | **非即时**、按月、在飞请求完成、超支照常计费 | **否** |
| **D. 第三方计量网关** | LiteLLM：**429 + per-request 预留**；OpenRouter：**403**（image 不在在飞预留）；Cloudflare：429 但最终一致；Vercel：402 但官方称 soft | **网关强制（非 provider）** | **LiteLLM 原生两条路径 ✓**；OpenRouter 需 Anthropic Messages + OpenAI Images；Cloudflare 原生文本 ✓ / 生图未证；Vercel 生图走 chat | LiteLLM `max_budget=0` → 429（零上游）；OpenRouter `GET /api/v1/key` + 模型目录 | 自托管 + Postgres，或注册/充值/建 key；设置预算 | **否**（配置/自托管） | 估算型预留；image 记账盲区；鉴权头/输出格式；网关故障 | **LiteLLM 最接近；OpenRouter 部分（cap 设 <$6）；其余否**；见 §4 |
| **E. 本地 `127.0.0.1:15721`（CC Switch）** | **无**：只有日志/用量估算/failover | **否** | 它说的是 anthropic 协议；上游不是 Gemini | 不适用 | 无 | 否 | 只有事后估算，不能阻止 | **否** |
| **F. effort-local 计量代理（兜底）** | 转发前预留最坏成本；超额 `402` | **否**（我们自己执行） | **是**：透明转发两条 Gemini 路径 | 离线 mock + 重放历史请求 + 可选免费 `ListModels` | 批准工具与信任模型；临时 cwd 配置副本；确认出站代理主机 | **否**（原配置文件不动） | 代理 bug / 价格假设 / 并发预留；信任根是自建代码 | **是（条件）**：预留为上界且价格正确；见 §6 |

---

## 3. 方案 A：官方 Google Cloud / Gemini

### 3.1 配额（评估结论：未获文档支持，不能作为路径）

**官方事实（2026-10-29 检索）**：

- Gemini API 速率限制按 **project** 计，不按 API key；维度包括 RPM、TPM、**RPD**；**RPD 在太平洋时间午夜重置**；超限返回 `429 RESOURCE_EXHAUSTED`（https://ai.google.dev/gemini-api/docs/rate-limits）。
- 但速率限制是 **tier 分配**的：Free / Tier 1–3 由项目自动升级；官方文档只给“**request a rate limit increase**”的入口，**没有给出把 RPD 下调的记录**。Free tier 的 per-model 数值已不在公开页，只在 AI Studio 登录后可见（https://aistudio.google.com/rate-limit）。
- 关键免责声明（逐字）：“**Specified rate limits are not guaranteed and actual capacity may vary.**”（同上）。即使存在一个数值，也不是“保证”。
- Gemini 另有**按花费的速率限制**：Free 无、Tier 1 **$10 / 10 分钟**、Tier 2 $50、Tier 3 $200，滚动窗口，超限 429（同上）。它是**速度**限制，不是单次运行累计上限（$10 > $6）。
- Google Cloud 的**配额覆盖**官方确实被定义为“capping usage”：“To restrict usage of a particular resource, create a quota override by changing the quota value to a value less than the default quota value. **Creating a quota override is sometimes referred to as capping usage.**”（https://docs.cloud.google.com/docs/quotas/view-manage）。但同一页紧接着写：“**Quota overrides are not available to all services.** For service-specific information, check the quota and system limits documentation for your service.”
- **没有官方文档证明 `generativelanguage.googleapis.com` 的 `generateContent` RPD 可被 consumer override 下调**；也没有传播延迟 SLA。Service Usage 的 consumer override 语义是“限制自身用量”，但不能据此推断该服务一定开放（https://docs.cloud.google.com/service-usage/docs/reference/rest/v1beta1/services.consumerQuotaMetrics.limits.consumerOverrides/create）。
- **API key 没有独立计费设置**：官方逐字 “They have no independent billing settings; they inherit the tier limits and billing status of the project. The cumulative usage from all keys within a project counts toward that project's spend cap…”（https://ai.google.dev/gemini-api/docs/billing）。所以“按 key 设 RPD/金额”不成立。

**判定**：

- **不能把“Cloud 控制台下调 RPD”当作已核实的路径**。它最多是一个“用户可以去控制台碰运气”的未验证假设；官方文档既不记录该服务可 override，也不保证限制被强制执行。**本票不把它列为首选，票 21 不应基于它授权。**
- 即便用户控制台里恰好能改，仍有：午夜重置、同项目其他用量、传播延迟、以及 “rate limits are not guaranteed” 四条残留风险。

**假如它可用（仅作成本算术，不作为推荐）**：文本单请求最坏 = 32,000 × $3.75/M = **$0.12**；生图单请求 ≈ **$0.04**。文本 RPD 20 + 生图 RPD 60 ⇒ ≤ $4.80；只下调文本 20、生图按结构上界 96 趟 ⇒ ≤ $5.63。这些数只在“配额真的存在且被预请求执行”时成立，而这一前提**未核实**。

### 3.2 Prepay 余额（已知不够，列作对照）

- 官方逐字：Prepay 余额到 **$0** 时，该 billing account 下所有 API key 的请求返回 **HTTP 402 Payment Required**；但 “Prepay billing is subject to overages during the approximately **10 minute** billing pipeline latency”，系统处理并停止前可继续消费（https://ai.google.dev/gemini-api/docs/billing，检索 2026-10-29）。
- 2026-03-23 起 Prepay/Postpay 生效；新用户默认 Prepay；最低充值 **$5**、最高 **$5,000**；credit **12 个月过期且不可退**（转 Postpay 除外）。
- **auto-reload 会破坏硬停**：若开启，余额低时自动充值；要用余额当上限必须**关闭 auto-reload**。
- 延迟可造成 **negative credit balance**（https://cloud.google.com/billing/docs/how-to/billing-cycle#delayed-billing）。
- ⇒ 不是“下一次调用前”的硬拒绝；票 13/18/19 已据此否决。

### 3.3 月度 spend cap budget（已知不够）

- **Spend cap budgets 已 GA（2026-10-13；Preview 2026-07-27）**，eligible services 包含 **Gemini API**；限制为**单项目 + 单服务、按月**；超限**暂停新用量**，但**在飞请求会完成并计费**（https://cloud.google.com/billing/docs/how-to/budgets-spend-caps ；release notes https://cloud.google.com/billing/docs/release-notes）。
- 官方逐字：“the enforcement of spend caps **isn’t instant** and any cost overages are billed as normal.” “You remain responsible for any overage costs accrued due to reporting latency.”
- **AI Studio 项目 spend cap**（https://aistudio.google.com/spend）是实验性入口，官方入口/控制台口径为 **~10 分钟**延迟；同样可被长任务超射。
- 预算告警（alerts-only）**不是**硬停：逐字 “Setting an alerts-only budget **doesn’t** automatically cap … usage or spending.”（https://cloud.google.com/billing/docs/how-to/budgets）。
- Pub/Sub + Cloud Run function 禁用 billing 的教程自己写：“There’s a delay … **doesn’t guarantee that you won’t spend more than your budget**.”（https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications）。
- ⇒ 粒度与延迟都不满足。

### 3.4 API key 级配额

- 官方逐字：“API keys … have **no independent billing settings**; they inherit the tier limits and billing status of the project. The cumulative usage from all keys within a project counts toward that project's spend cap…”（https://ai.google.dev/gemini-api/docs/billing）。没有按 key 的金额或请求数硬上限。

---

## 4. 方案 B：第三方计量网关（一手文档核实，2026-10-29）

### 4.1 结论

**没有一条同时满足“预请求硬拒 + 文本 Gemini native/Anthropic + 生图 `/interactions` + 精确模型 + 无超射”。** 按“离严格硬限的远近”排序：

1. **LiteLLM Proxy（自托管）** —— **最接近**：key 级 `max_budget=6`（不设 `budget_duration` = 永不重置）、**预请求 429**、且有 **per-request 预算预留（含 image 成本）**；原生 Gemini `/v1beta/models/{model}:generateContent` 与 `/v1beta/interactions` 都支持，cost map 有 `gemini/gemini-3.6-flash` 与 `gemini/gemini-3.1-flash-lite-image`。代价：自托管 + Postgres；`x-goog-api-key` 是否被原生 Gemini 端点接受**未验证**；预留仍是估算。
2. **OpenRouter（SaaS，零代码）** —— key `limit` + `limit_reset` 不设 = **生命周期 $6 上限**，预算/key 超限在请求前 **403**；文本有 `/api/v1/messages`（Anthropic Messages，任意模型），生图有 `/api/v1/images`，两个精确模型 ID 都在目录里。**缺口**：in-flight 预留**不含 image 定价**（并发生图可越过 key cap），且本仓生图客户端打的是 `/images/generations`（OpenRouter 存在但**未文档化**），输出还必须是 PNG（本仓 OpenAI 路径只解 PNG）。若用，应把 key cap 设为 **$5.80**、生图并发压到 1，并把“绝对上限”留出 ≤$0.10 的在飞余量。
3. **Cloudflare AI Gateway** —— 原生 Google AI Studio 透传（`:generateContent`、`x-goog-api-key`），spend limit 在 provider 前评估、超限 **429**；但官方明说 **eventually consistent，突发并发可短暂超限**，且成本只对“目录里有定价”的模型计算——**`gemini-3.1-flash-lite-image` 不在其模型目录**，生图可能按 $0 记账；`/interactions` 是否透传**未验证**。不能单独作为生图硬限。
4. **Vercel AI Gateway** —— 预算检查在请求前、超限 **402**、API-key budget 可设 lifetime；但官方逐字 “A budget is a **soft cap, not a hard limit**. … the request that crosses the limit still completes and total spend can end up slightly over the budget.” 生图走 Chat Completions（本仓 OpenAI 客户端打 `/images/generations`，未文档化）。**不满足严格性**。
5. **Portkey / Helicone / Requesty / Kong** —— 不适用：Portkey 预算为 Enterprise/select Pro 且 **Google Gemini Images 不支持**、超限 **412**；Helicone 只 OpenAI-compatible、图像目录只有 `gemini-3-pro-image-preview`；Requesty 只有**月度** key cap、超限 **412**、生图未验证；Kong 是窗口速率限制、无 lifetime 预算、无 Gemini native。

### 4.2 对比表

| 网关 | 预请求拒绝/状态 | 预算语义 | 文本协议 | 生图协议 | 精确模型 | 费用 | 零付费验证 | 严格 ≤$6？ |
|---|---|---|---|---|---|---|---|---|
| **LiteLLM（自托管）** | 是 / **429 `budget_exceeded`** | key `max_budget`，无 duration = lifetime；per-request 预留（含 image） | Anthropic `/v1/messages` ✓；Gemini `/v1beta/models/{model}:generateContent` ✓ | `/v1beta/interactions` ✓（2026-10-28 文档）；`/images/generations` ✓ | `gemini/gemini-3.6-flash`、`gemini/gemini-3.1-flash-lite-image` ✓ | OSS 免费；你直接付 Google | 本地起服务，`max_budget=0` → 429 且不触上游 | **最接近（估算+预留）** |
| **OpenRouter** | 是 / **403**（预算/key）、402（信用/在飞） | key `limit` + `limit_reset` 不设 = lifetime | Anthropic Messages `/api/v1/messages` ✓（任意模型） | `/api/v1/images` ✓；`/images/generations` 存在但未文档化 | `google/gemini-3.6-flash`、`google/gemini-3.1-flash-lite-image` ✓ | 5.5% 标准 / 8% 商业（充值费） | `GET /api/v1/key`、公开模型目录、`:free` 模型 | **部分**：image 不在在飞预留里 |
| **Cloudflare AI Gateway** | 是 / **429** | spend limit 按 gateway/model/metadata，美元；**最终一致** | Gemini native ✓ | Gemini native 内联图 ✓；`/interactions` 未验证 | `gemini-3.6-flash` ✓；`gemini-3.1-flash-lite-image` **不在目录** | 核心免费/BYOK；Unified Billing 5% | 免费 gateway + Workers AI 可演练规则 | **部分/生图盲区** |
| **Vercel AI Gateway** | 是 / **402** | team/project/key/user；refresh `none` = lifetime | Anthropic Messages ✓（任意模型） | Chat Completions images ✓；`/images/generations` 未文档化 | 两个精确 ID ✓ | 零 markup，预付信用 | 免费月度额度 + 公开模型目录 | **否**：官方称 soft cap |
| **Portkey** | 是 / **412** | key/workspace/integration；Enterprise/select Pro | Anthropic 仅限 Anthropic provider；Gemini 走 OpenAI chat ✗ | **Gemini Images ✗** | 聊天 ID 未验证；图像不支持 | $49/mo 起 | 免费 10k logs | **否** |
| **Helicone** | 成本型速率限制，预请求检查 | 窗口（秒），无 lifetime | OpenAI-compatible only ✗ | 仅 `gemini-3-pro-image-preview` ✗ | lite-image 不支持 | 免费 10k；Pro $79/mo | 免费层 | **否** |
| **Requesty** | cap 执行；预请求未验证 / **412** | **月度** key cap，无 lifetime | Anthropic Messages ✓ | `/images/generations` 仅 Azure GPT Image；Gemini image 未验证 | `gemini-3.1-flash-image`，lite 未验证 | 5% markup | 免费 200 req/day | **否/部分** |
| **Kong AI Gateway** | 窗口速率限制 / **429** | 窗口成本，非 lifetime | OpenAI-compatible ✗ | 无 Gemini image 文档 ✗ | 透传，未验证 | OSS/企业 | — | **否** |
| **Unify** | 文档不可得（登录页/404） | — | — | — | — | — | — | **未核实/排除** |

### 4.3 与本案的三个关键兼容性风险

1. **生图路径与输出格式**：本仓 `openai` 协议打 `${baseUrl}/images/generations`，且 `imageFromOpenAI` **只解码 PNG**（`packages/assets/src/image-gen.ts`）；`gemini` 协议打 `${baseUrl}/interactions`，接受 JPEG/PNG（`decodeUpstreamImage`）。OpenRouter / Vercel 的文档生图入口与本仓路径不完全对齐；LiteLLM 的 `/v1beta/interactions` 是本票核实的网关路径中能保持本仓现有 JPEG 形状的那一条。**任何“换到 OpenAI 生图协议”的方案都要先确认输出不是 JPEG**，否则会在付费成功后本地解码失败。
2. **鉴权头**：本仓 Gemini 客户端固定发 `x-goog-api-key`（`packages/contracts/src/gemini-call.ts:204`、`packages/assets/src/image-gen.ts:448`）。LiteLLM 的 Gemini-native 端点通常用 `Authorization: Bearer sk-...`；是否接受 `x-goog-api-key` **未验证**。若不行，只能走 LiteLLM 的 Anthropic/OpenAI 兼容路径（文本 `/v1/messages`、生图 `/images/generations`），从而回到第 1 条的格式风险。

3. **文本工具调用翻译**：走 Anthropic Messages（OpenRouter、Requesty、LiteLLM 的 anthropic 路径）时，`tools` / `tool_choice` 要由网关翻译成 Gemini function calling；本仓的结构化调用完全依赖这个形状（`parseToolUse` / `parseGeminiFunctionCall`），翻译差异或 `thinking: {type:"disabled"}` 被拒都会让文本步失败。LiteLLM 的原生 Gemini 路径与自建代理不翻译，风险较低。

### 4.4 可审计性

- **LiteLLM**：key/team/user 的 spend、request logs、budget 状态在管理 API/DB 里可查；可作为票 21 的预算证据。自托管意味着账本在本机，审计方便，但需要自己备份/防篡改。
- **OpenRouter**：账户的 activity/usage、`GET /api/v1/key` 的 limit/usage 可查；403/402 的响应可留证。
- **Cloudflare / Vercel**：控制台有 spend/usage 面板；但 Cloudflare 的 estimated cost 与 Vercel 的 soft cap 语义都削弱了“账单=硬限”。
- **自建代理**：JSONL + 前一条 hash，可逐笔复核；但它只是本地账，不是 provider 账单。

### 4.5 零付费验证方式（各网关）

- **LiteLLM**：本地起服务 + 一条 key 设 `max_budget: 0`；用本仓的实际请求形状打过去，应在转发前得到 **429 `budget_exceeded`**（不触上游、零付费）。这同时验证了鉴权头/路径；通过后再设 `max_budget: 6`。这一步是唯一能**零付费证明“预请求拒绝”**的第三方路径。
- **OpenRouter**：`GET /api/v1/key` 查 limit；`GET /api/v1/models` / `/api/v1/images/models` 查模型；免费 `:free` 文本模型可验证鉴权；**生图路径/输出格式无法零付费验证**（没有免费生图），只能读文档或小额实测。
- **Cloudflare**：免费 gateway + BYOK，可用 Workers AI 免费额度演练 spend limit；但生图模型不在目录，无法证明其成本记账。
- **Vercel**：免费月度额度 + 公共模型目录；文档自认 soft cap。
- **Portkey/Helicone/Requesty/Kong**：免费层可验鉴权，但协议/模型不匹配已足够排除。

### 4.6 来源

- LiteLLM：https://docs.litellm.ai/docs/proxy/users ；https://docs.litellm.ai/docs/proxy/error_reference ；https://docs.litellm.ai/docs/generateContent ；https://docs.litellm.ai/docs/anthropic_unified/ ；https://docs.litellm.ai/docs/interactions ；https://docs.litellm.ai/docs/image_generation ；预留 PR https://github.com/BerriAI/litellm/pull/27539 ；并发/预留缺口 https://github.com/BerriAI/litellm/issues/34732 ；价格缺失修复 https://github.com/BerriAI/litellm/issues/40741
- OpenRouter：https://openrouter.ai/docs/api_reference/limits ；https://openrouter.ai/docs/guides/best-practices/capping-shared-agent-keys ；https://openrouter.ai/docs/guides/features/workspaces/workspace-budgets ；https://openrouter.ai/docs/guides/overview/multimodal/image-generation ；https://openrouter.ai/docs/api/api-reference/anthropic-messages/create-a-message ；https://openrouter.ai/pricing ；https://openrouter.ai/api/v1/models ；https://openrouter.ai/api/v1/images/models
- Cloudflare：https://developers.cloudflare.com/ai-gateway/features/spend-limits/ ；https://developers.cloudflare.com/ai-gateway/usage/providers/google-ai-studio/ ；https://developers.cloudflare.com/ai-gateway/features/unified-billing/ ；https://developers.cloudflare.com/ai-gateway/reference/pricing/ ；https://developers.cloudflare.com/ai-gateway/configuration/custom-costs/ ；https://developers.cloudflare.com/ai/models/google/gemini-3.6-flash/
- Vercel：https://vercel.com/docs/ai-gateway/observability-and-spend/budgets ；https://vercel.com/docs/ai-gateway/faq ；https://vercel.com/docs/ai-gateway/pricing ；https://vercel.com/docs/ai-gateway/sdks-and-apis/anthropic-messages-api ；https://vercel.com/docs/ai-gateway/modalities/image-generation/openai ；https://ai-gateway.vercel.sh/v1/models
- Portkey：https://docs.portkey.ai/docs/guides/use-cases/enforcing-limits-and-budgets ；https://docs.portkey.ai/docs/product/ai-gateway/virtual-keys/budget-limits ；https://docs.portkey.ai/docs/integrations/llms/gemini ；https://docs.portkey.ai/docs/api-reference/inference-api/supported-providers ；https://portkey.ai/pricing
- Helicone：https://docs.helicone.ai/features/advanced-usage/custom-rate-limits ；https://docs.helicone.ai/gateway/overview ；https://docs.helicone.ai/gateway/concepts/image-generation ；https://docs.helicone.ai/references/how-we-calculate-cost ；https://www.helicone.ai/pricing
- Requesty：https://docs.requesty.ai/features/api-limits ；https://docs.requesty.ai/features/error-codes ；https://docs.requesty.ai/features/image-generation ；https://www.requesty.ai/pricing
- Kong：https://developer.konghq.com/ai-gateway/policies/ai-rate-limiting-advanced ；https://developer.konghq.com/ai-gateway/policies/ai-rate-limiting-advanced/reference/

---

## 5. 方案 C：本地 `127.0.0.1:15721`（CC Switch）不是计量网关

### 5.1 它是什么（只读证据，未读密钥/配置内容）

| 事实 | 证据（2026-10-29） |
|---|---|
| 监听者 | `lsof -nP -iTCP:15721 -sTCP:LISTEN` → `cc-switch` PID 820，`TCP 127.0.0.1:15721 (LISTEN)` |
| 应用/版本 | `/Applications/CC Switch.app`，`CFBundleIdentifier com.ccswitch.desktop`，`CFBundleShortVersionString **3.20.3**` |
| 官方定位 | “The proxy service starts a local HTTP proxy … **Record request logs / Track API usage / Support failover / Centrally manage requests**”（v3.20.1 `docs/user-manual/en/4-proxy/4.1-service.md`） |
| 用量页 | “Understand API usage patterns / **Estimate cost expenditure**”；数据源 = 代理请求日志 + 各 CLI 会话日志（v3.20.1 `4.4-usage.md`） |
| 是否有预算/限额执行 | **文档中没有**：`4.4-usage.md` 全文 grep `budget|limit|reject|block|spend` **0 命中**；4.1 的四项用途里也没有 enforcement |
| 本地 DB 结构（只读 schema，未读行值） | `proxy_config` 列：`app_type, proxy_enabled, listen_address, listen_port, enable_logging, enabled, auto_failover_enabled, max_retries, streaming_*_timeout, circuit_*, default_cost_multiplier, pricing_model_source, …` —— **没有任何 budget / spend limit / hard cap 列** |
| 它确实会算钱 | `proxy_request_logs` 有 `input_cost_usd / output_cost_usd / total_cost_usd`（54,403 行）；`usage_daily_rollups` 有 `total_cost_usd`（792 行）—— 这是**事后估算**，不是闸门 |
| 当前配置里的角色 | 票 18：`ANTHROPIC_BASE_URL` 把文本指到 `127.0.0.1:15721`，`protocol` 变成 `anthropic`；上游不一定是 Gemini；生图不经过它 |

### 5.2 判定

- **它能做**：请求日志、token/成本估算、failover、多应用集中管理；可作**事后审计**的一个旁证源。
- **它不能做**：在请求前按金额/预算拒绝；没有 per-key/per-run 预算字段，也没有 402/403 的执行路径。把“用量页里看到已经花了多少”当成“下一次调用会被阻止”是错的。
- **结论：不能当硬护栏，也不能替代 §3/§6。** 本票不修改它的任何设置。

---

## 6. 方案 D：effort-local 计量代理（兜底，技术上可行）

### 6.1 为什么它是兜底方案

- 本仓文本走 `${baseUrl}/models/{model}:generateContent`，生图走 `${baseUrl}/interactions`，都是 **Gemini native 路径 + `x-goog-api-key`**（§1.1）。
- 一个透明的本地 HTTP 代理只要**原样转发 path + query + body + headers** 到 `https://generativelanguage.googleapis.com`，就不需要理解协议、不需要改生产代码、也不需要转译；文本/生图的响应形状由上游保持不变。
- **LiteLLM 是本票核实到同时支持这两条原生路径（`/v1beta/interactions` 有文档）的第三方**（§4），所以它是首选；但 LiteLLM 的 `x-goog-api-key` 鉴权、image 成本预留、cost map 口径都还需要实测。若这些不通，自建代理是唯一不依赖第三方语义、且能完全保持本仓请求/响应形状的兜底。
- OpenRouter/Cloudflare/Vercel 各自有生图路由、输出格式或记账盲区（§4），不能作为“零改动、严格”的兜底。

### 6.2 需要实现什么（研究结论，不在本票落地）

最小实现（effort-local，非生产代码，建议放 `.scratch/p0-02-second-demo/tools/`）：

1. **监听** `127.0.0.1:<port>`（不要占用 15721），只接受 `POST`；路径白名单：`/v1beta/models/*:generateContent` 与 `/v1beta/interactions`。
2. **转发** 到 `https://generativelanguage.googleapis.com`，保留 path/query/body 与 `content-type`、`x-goog-api-key`；出站走用户确认的 HTTP 代理（如 `127.0.0.1:7890`），可用仓库现成的 `createProxyFetch` 语义（只读复用，不改它）。
3. **预请求预留（关键）**：
   - 文本：`reserve = f(input_upper_bound, maxOutputTokens)`。input 上界可取请求体文本字节数（token ≤ 字节数是保守上界）+ 内联图按每张 ≤1,120 tokens；output 取 `maxOutputTokens × $3.75/1M`，若担心 thinking 不在 `maxOutputTokens` 内则再乘 2。
   - 生图：`reserve = $0.0336 + 输入/文本输出的小额上界`（建议每次按 **$0.04** 预留）。
   - 若 `spent + 所有在飞预留 + 新预留 > cap` ⇒ **在转发前**返回 `402`（不要用 429：本仓生图重试正则包含 429，会重试；402 不在重试正则里，会立即失败）。
4. **结算**：
   - 文本成功响应读 `usageMetadata.promptTokenCount / candidatesTokenCount / thoughtsTokenCount`，按官方价结算，退回未用预留。
   - 生图响应没有稳定的 usage 字段（历史响应未记录 usage），成功则按固定 $0.0336 + 预留中的输入部分结算；无法确定是否计费的结果（超时、连接中断、5xx）**按整笔预留计费**，只对明确的 4xx（参数错、429 上游限额）退款。**fail-closed**。
   - 单进程 Node 事件循环内做原子预留；并发请求共享同一 `spent`。
5. **证据**：追加式 JSONL（请求 id、路径、模型、预留、结算、状态、时间、前一条 hash），不记录 header/key；运行结束后可复核“没有一笔超过 cap”。**代理重启后从该账本重算已花金额，cap 不因重启清零**（`create` 与 `build` 是两个 CLI 进程，代理必须跨进程保持同一上限）。
6. **不在代理里做**：不缓存、不改模型、不重试、不注入 key（key 从请求头原样转发）。

### 6.3 如何在不改原配置的前提下把两条路都指向代理

- **生图（无需改文件）**：设置环境变量
  `GAME_MAKER_IMAGE_BASE_URL=http://127.0.0.1:<port>/v1beta`、`GAME_MAKER_IMAGE_PROTOCOL=gemini`、`GAME_MAKER_IMAGE_MODEL=gemini-3.1-flash-lite-image`、`GAME_MAKER_IMAGE_API_KEY=<用户设置，不打印>`；env 优先于文件（`image-config.ts:117-130`）。
- **文本（用临时 cwd 的配置副本，不动原文件）**：
  1. 用户在自己的终端把 `game-maker.local.json` 复制到一个 `chmod 700` 的临时目录；
  2. 副本里只改：`text.baseUrl = http://127.0.0.1:<port>/v1beta`，`text.protocol = gemini`，模型不变，**删除 `text.proxy`**（§1.1 的耦合：不删会让 CLI 对 localhost 发 CONNECT/HTTPS，直接坏掉）；
  3. 从该临时 cwd 运行 CLI，所有输入/输出用**绝对路径**（`--out`、`--style`、`--intent`、`--recipe`，以及 `--shell`：否则 `defaultShellPath(..., cwd)` 会按临时 cwd 找外壳，`cli.ts:277`），让 cwd 只影响配置解析；
  4. 运行结束删除临时目录（里面含 key 副本；代理本身不落 key）。
- **环境**：`unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN`，并在干净 env 复核 source=file / host=官方。
- **注意**：`fetchImpl` 由 `text.proxy` 决定并复用到生图（`cli.ts:562`、`ops.ts:1576`）；删除 `text.proxy` 后 `fetchImpl` 为 undefined，生图走 env（无 proxy 字段）→ 全局 fetch 打 localhost，路径成立。

### 6.4 不花钱能验证到什么程度

1. **离线回放（可以完全零付费）**：mock 上游 + 仓库历史 dry-run 请求体（如 `.scratch/asset-integration-v1/runs/.../evidence/requests/*.dry.json`，请求体不含 key）验证：path/body/header 原样；cap=0 时**不发出任何上游请求**就返回 402；预留/结算/并发/异常计费/哈希链。
2. **免费控制面通路（可选）**：通过代理发 `GET /v1beta/models`（模型列表，不生成内容、不产生生成费用）验证转发与鉴权头；这能证明“代理能到达官方”，但不能证明计费模型。
3. **零付费端到端闸门测试（建议在实现票做）**：把 cap 设为 **0**，只跑一次最小请求路径（或一个 `--dry-run` 调用点），应在上游前拿到 402；这能证明“下一次调用前被拦截”，无需付费。
4. **不能验证**：真实账单与官方计费口径的逐分对齐；第一次付费 run 本身才是最终对账。

### 6.5 风险与判定

| 风险 | 说明 | 缓解 |
|---|---|---|
| 代理 bug | 预留未覆盖某条路径/异常，导致真实花费 > cap | 离线回放 + cap=0 端到端 + fail-closed + cap 留余量（如 $5.50） |
| 价格口径 | thinking 是否含在 `maxOutputTokens`、非方形 1K 图 token、失败请求计费 | 预留取保守上界；无法确定的结果按整笔预留计费；2026 年内价格 |
| 信任根 | 这是自建代码，不是 provider 强制 | 用户 HITL 明确接受“代理是信任根”；代码/账本可审计 |
| 配置副本 | 临时目录含 key | 用户自己创建/删除，`chmod 700`；不提交、不打印 |
| 并发 | 在飞请求的预留必须先记账 | 单线程原子预留；cap 检查在转发前 |
| 与 `text.proxy` 耦合 | 不删 proxy 字段会破坏 localhost 通路 | 临时副本删除；跑前用解析器复核 |

**可行性结论**：技术可行，约 200–300 行，不改生产代码；但**不是“已建立”的硬限**——必须先实现、离线验证、再由 HITL 批准信任模型。它值得作为 §4/§7 的网关路径（LiteLLM/OpenRouter）失败后的兜底；若网关路径可行，不值得再增加自建代码的复杂度。

---

## 7. 推荐顺序与最小用户动作

### 7.1 顺序

1. **LiteLLM Proxy（自托管）** —— 本票核实的**最接近严格**的外部网关：key `max_budget=6`（不设 `budget_duration` = 永不重置）、预请求 **429**、per-request **预留（含 image 成本）**、原生 Gemini `:generateContent` 与 `/v1beta/interactions`、cost map 精确模型。**先用 `max_budget: 0` 做零付费 429 验证**（不触上游），确认 `x-goog-api-key` 鉴权与两条路径后再设 $6。
2. **OpenRouter（SaaS，零代码）** —— 生命周期 per-key cap；文本走 Anthropic Messages，生图走 OpenAI Images；**key cap 设 $5.80（不是 $6）**，生图并发压到 1，把 image 不在在飞预留的缺口（单并发 ≤$0.0336；即使 3 并发也 ≤$0.10）留在 $6 以内。**生图路由 `/images/generations` 与 PNG 输出未验证**；若验证不通过，不要用它跑生图。
3. **effort-local 计量代理**（§6）—— 若 LiteLLM 的 `x-goog-api-key`/路径不通、OpenRouter 生图也不通；这是唯一不依赖第三方网关语义、能保持本仓两条原生路径的兜底。
4. **Cloudflare AI Gateway** —— 只在确认 `gemini-3.1-flash-lite-image` 出现在 spend log/成本记账后；否则生图是 $0 盲区。**Vercel** 官方自认 soft cap，不作为严格路径。**Portkey/Helicone/Requesty/Kong** 已排除。
5. **官方配额路径** —— 只能作为“用户去控制台看一眼”的未验证实验；**不能作为票 21 授权的依据**（§3.1）。
6. **若 1–3 都不被接受**：保持 BLOCKED；不把有界超射改写成满足。

### 7.2 最小用户动作

**若走 LiteLLM（首选）**：

1. 在本机起 LiteLLM Proxy + Postgres（Docker 或 pip），配置两个模型别名（**别名可直接用本仓现有模型名** `gemini-3.5-flash`、`gemini-3.1-flash-lite-image`，映射到 `gemini/gemini-3.6-flash`、`gemini/gemini-3.1-flash-lite-image`，这样配置里只改 baseUrl、不改 model）与你的 Gemini key（存在性即可，不输出）。
2. 建一个 virtual key：`max_budget: 6`，**不设** `budget_duration`；`max_parallel_requests: 1`；文本请求显式 `max_tokens`（本仓已经发 16k/32k）。
3. **零付费验证**：临时把该 key 的 `max_budget` 设为 **0**，用本仓的请求形状（`x-goog-api-key`）打 LiteLLM；应**在转发前 429 `budget_exceeded`**。若 401，说明原生 Gemini 端点不接受 `x-goog-api-key`，改走 Anthropic/OpenAI 兼容路径（需另验输出格式），或退回 §6。
4. 验证通过后设回 $6；提供网关 URL（`http://127.0.0.1:<port>`）、key 存在性、预算值、429 证据（不含 key）给票 21。
5. 执行时用临时 cwd 配置副本（`text.baseUrl` 指 LiteLLM、`text.protocol=gemini`、删 `text.proxy`）或 LiteLLM 的 Anthropic 路径；生图用 `GAME_MAKER_IMAGE_*` 指 LiteLLM 的 `/v1beta`。原 `game-maker.local.json` 不动。

**若走 OpenRouter（零代码 SaaS）**：

1. 注册/登录，购买足够覆盖 **$5.80 cap + 5.5% 充值费** 的 credits（约 $6.14）；创建一个 key，`limit: 5.80`、`limit_reset` **留空**（lifetime）。
2. 零付费检查：`GET /api/v1/key` 确认 limit；`GET /api/v1/models`、`/api/v1/images/models` 确认两个模型 ID。
3. 文本：临时配置副本里 `text.protocol=anthropic`、`text.baseUrl=https://openrouter.ai/api`（客户端会拼 `/v1/messages`）、`text.model=google/gemini-3.6-flash`、`text.apiKey=<OpenRouter key>`；删 `text.proxy`。
4. 生图：`GAME_MAKER_IMAGE_PROTOCOL=openai`、`GAME_MAKER_IMAGE_BASE_URL=https://openrouter.ai/api/v1`、`GAME_MAKER_IMAGE_MODEL=google/gemini-3.1-flash-lite-image`；`--concurrency-image 1`。**先确认 `/images/generations` 与 PNG 输出**；不确认就不要用它跑生图。
5. 把 key limit 值、模型目录、零付费 401/403 证据给票 21。

**若走自建代理（兜底）**：

1. HITL 批准“effort-local 代理作为信任根”+ 实现+离线验证的范围（新票）。
2. 用户准备 `chmod 700` 临时目录里的配置副本（只改 `text.baseUrl`、`text.protocol`、删 `text.proxy`），不让我们读原文件/密钥。
3. 用户确认出站 HTTP 代理主机（当前已知 `127.0.0.1:7890` 在监听；属票 18/历史事实，不是本票探测）与端口占用（15721 已被 CC Switch 占用，代理用其他端口）。
4. 干净 env（unset `ANTHROPIC_*`）+ 绝对路径运行；结束后删除临时副本。

### 7.3 为什么不再把官方配额列为首选

- 官方文档没有记录 `generativelanguage.googleapis.com` 的 RPD 可下调；Cloud Quotas 明说“不是所有服务都支持 override”；速率限制页还写 “Specified rate limits are not guaranteed”。把这三点叠加，任何“控制台里可能能改”的假设都不足以支撑一次付费授权的严格性。
- 若用户愿意，仍可在控制台 `IAM & Admin → Quotas & System Limits` 自查（只读，不改任何东西），但这属于“未验证的旁路”，不是本票的推荐路径。

---

## 8. 能否严格满足 $6.00

| 路径 | 结论 | 依据/条件 |
|---|---|---|
| **LiteLLM Proxy（自托管）** | **最接近“能”** | key `max_budget=6`（lifetime）+ 预请求 429 + per-request 预留（含 image）；原生两条路径；显式 `max_tokens` + `max_parallel_requests: 1`。残留：预留是估算，cost map 与 Google 账单口径必须一致；`x-goog-api-key` 未验证。 |
| **OpenRouter（SaaS）** | **部分／有条件** | key lifetime cap 设为 **$5.80**；文本在飞有预留，image 没有 → 并发 1 时绝对超射 ≤$0.0336，总额 ≤$5.84；即使并发 3，也 ≤$5.92 < $6。代价：生图 `/images/generations` 与 PNG 输出**未验证**；5.5% 充值费。 |
| **Cloudflare AI Gateway** | **否（生图盲区）** | 原生文本可硬拒，但 `gemini-3.1-flash-lite-image` 不在其定价目录，spend limit 可能按 $0 记账；且最终一致、突发可超。 |
| **Vercel AI Gateway** | **否** | 官方逐字 “soft cap, not a hard limit”；跨线请求会完成。 |
| **自建计量代理（§6）** | **能（条件）** | 预留为上界 + fail-closed + cap $6.00（建议运行上限 $5.50 留余量）；实际期望 $0.68。**不是 provider 强制**，是我们自己的代码。 |
| **官方配额覆盖** | **否（未获文档支持）** | 不能证明 RPD 可下调；且 “rate limits are not guaranteed”。 |
| **官方 Prepay / spend cap** | **否** | ~10 分钟 / 非即时 / 按月；超支照常计费。 |
| **CC Switch 15721** | **否** | 无预算执行字段/路径。 |

**总判定**：**没有 provider 强制的严格 $6 路径**。能做到“下一次调用前拒绝”的只有**网关侧/客户端侧的金额记账**：LiteLLM（最接近，有预留）或自建代理；OpenRouter 可在 **cap < $6** 的前提下把绝对花费压在 $6 内，但有 image 在飞缺口和协议未验证。若“严格”被定义为“必须由 provider 保证”，结论是**不存在**，应保持 BLOCKED。

---

## 9. 来源（全部检索于 2026-10-29）

### 官方 Google / Gemini

- 定价（3.6 Flash、3.1 Flash Lite Image、1,120 tokens/1K 图）：https://ai.google.dev/gemini-api/docs/pricing
- 速率限制（per project、RPD、午夜太平洋重置、spend-based $10/10min Tier 1、“rate limits are not guaranteed”）：https://ai.google.dev/gemini-api/docs/rate-limits
- AI Studio 活动速率限制（登录后可见）：https://aistudio.google.com/rate-limit
- Prepay/Postpay、$0 → 402、~10 分钟 overage、最低 $5、12 个月过期、auto-reload、key 无独立计费：https://ai.google.dev/gemini-api/docs/billing
- AI Studio 项目 spend cap（实验性，~10 分钟）：https://aistudio.google.com/spend
- 配额覆盖 = capping usage（低于默认值）；“不是所有服务都支持”：https://docs.cloud.google.com/docs/quotas/view-manage
- 配额总览：https://cloud.google.com/docs/quotas/overview ；配额排障（429 / ResourceExhausted）：https://cloud.google.com/docs/quotas/troubleshoot
- Consumer quota override（限制自身用量，不能超过默认/上层上限）：https://docs.cloud.google.com/service-usage/docs/reference/rest/v1beta1/services.consumerQuotaMetrics.limits.consumerOverrides/create
- 配额覆盖示例（Terraform，override_value；**是其他服务的示例，不是 Generative Language API 的证明**）：https://github.com/hashicorp/terraform-provider-google/blob/82aabaa3590960285b61a8262e64b504cd2637cd/website/docs/r/service_usage_consumer_quota_override.html.markdown
- Firebase AI Logic 配额页（控制台 `Quotas & System Limits → Edit quota` 的路径示例；面向 Firebase AI Logic，不是 Gen Language API）：https://firebase.google.cn/docs/ai-logic/quotas?hl=en&api=dev
- 月度 spend cap（GA 2026-10-13；pauses new requests、在飞请求完成、非即时、超支照常计费）：https://cloud.google.com/billing/docs/how-to/budgets-spend-caps ；release notes https://cloud.google.com/billing/docs/release-notes
- 预算告警不是硬停：https://cloud.google.com/billing/docs/how-to/budgets
- 程序化预算通知（多次/天，首条可数小时）：https://cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications
- 通知触发禁用 billing 的教程（自认不保证不超预算）：https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
- 计费延迟/负余额：https://cloud.google.com/billing/docs/how-to/billing-cycle#delayed-billing ；成本明细可 >24h：https://cloud.google.com/billing/docs/how-to/view-history#missing-transactions
- Vertex AI 配额（per-minute、动态共享；429 不表示固定配额）：https://cloud.google.com/vertex-ai/generative-ai/docs/quotas ；https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 ；Standard PayGo：https://cloud.google.com/gemini-enterprise-agent-platform/models/standard-paygo

### 第三方网关

- 见 §4.6 的逐产品 URL（LiteLLM / OpenRouter / Cloudflare / Vercel / Portkey / Helicone / Requesty / Kong）。

### CC Switch（本地 `127.0.0.1:15721`）

- 代理服务定位（日志/用量/failover/集中管理）：https://github.com/farion1231/cc-switch/blob/v3.20.1/docs/user-manual/en/4-proxy/4.1-service.md
- 用量统计（“Estimate cost expenditure”；无 budget/limit）：https://github.com/farion1231/cc-switch/blob/v3.20.1/docs/user-manual/en/4-proxy/4.4-usage.md
- 本机证据：`lsof -nP -iTCP:15721 -sTCP:LISTEN`；`/Applications/CC Switch.app/Contents/Info.plist` 版本 3.20.3；`~/.cc-switch/cc-switch.db` 的 **schema**（未读行值/密钥）：`proxy_config`、`proxy_request_logs`、`usage_daily_rollups`。

### 本仓

- `packages/contracts/src/gemini-call.ts`（文本 URL/头）
- `packages/assets/src/generate.ts`（drawlist 文本路径）
- `packages/assets/src/image-gen.ts`（`/interactions`、生图头/重试正则、OpenAI 仅 PNG 解码）
- `packages/assets/src/text-config.ts` / `image-config.ts`（配置优先级/协议白名单）
- `packages/assets/src/http.ts`（`createProxyFetch`；不认 `HTTPS_PROXY`）
- `packages/cli/src/cli.ts:559-562`（text proxy → fetchImpl）、`packages/assets/src/ops.ts:1576`
- `game-maker.local.example.json`（`/v1beta` 路径示例）
- `research/13-cost-model.md`、`research/18-provider-verification.md`、`rulings-2026-10-29.md` §7、票 19/21
- 历史先例：`.scratch/asset-integration-v1/runs/2026-10-21a-smoke/budget-report.md`（effort-local 脚本的“全局 4 发硬上限 / exit 124”）

---

## 10. 审计限制

1. **未登录任何控制台、未查账单、未注册/充值任何网关、未调用任何付费上游**。§3.1 的配额可用性只能由用户在控制台确认；本票不能代替。
2. **未读 `game-maker.local.json` 内容、未读/输出任何环境变量值**：端点/模型/来源继承票 18；配置副本方案里的字段名来自示例与代码，不代表用户当前文件的具体值。
3. **未实现/未运行 §6 的代理**：其“能硬限”是设计论证 + 离线验证计划，不是实测结论。实现票必须补齐回放、cap=0 端到端、并发/异常计费测试。
4. **LiteLLM 未实测**：`max_budget=0 → 429` 是文档/PR 结论，**未在本机跑过**；`x-goog-api-key` 在 Gemini-native 端点是否被接受、`/v1beta/interactions` 的 image 成本是否进入预留，均**未验证**。
5. **OpenRouter 未注册、未充值、未发请求**：key cap、403/402 状态来自官方文档；`/images/generations` 路由与 PNG 输出**未验证**；image 不在在飞预留是官方文档的明确限制。
6. **Cloudflare 生图成本盲区**：`gemini-3.1-flash-lite-image` 不在模型目录，spend limit 是否记账**未验证**；`/interactions` 透传**未验证**。
7. **Vercel 是 soft cap**：官方逐字承认跨线请求会完成；不作为严格路径。
8. **价格是 2026-10-29 的官方页**：2027-01-01 起 3.6 Flash 翻倍；若跨年执行，所有 $6 计算重做。
9. **配额传播延迟/午夜重置**：只有在用户控制台确实能下调 RPD 时才相关；本票未证实该前提。
10. **第三方子代理的探测**：只做了未认证/假 key 的 HTTP 探测（返回 401/400），没有生成内容、没有使用用户密钥；但它们不是“官方文档”，只用于确认路由是否存在。
11. **CC Switch 的 DB 只读了 schema 与表名/计数**：未读 provider 配置、key、请求体或日志内容。
