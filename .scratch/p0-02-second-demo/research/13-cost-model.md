# 票 13 · 调用成本估算与超限停止机制

> **性质**：只读研究。未调用任何付费上游、未运行 `create/build/plan/pack/compile-*` / `playtest` / `test:*`、未读 `game-maker.local.json` 内容、未读/输出密钥、未改生产代码。
> **基准**：冻结 run ledger `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/ledger.json`（sha256 `42ed224e4a6356b1db94dac749d0b5502d7e24976d9e5154932823ffa2921a4d`）。
> **日期**：2026-10-29。

## 0. 结论先行

1. **官方价格已核实（USD，检索 2026-10-29）**：`gemini-3.6-flash` Standard $0.75 in / $3.75 out（含 thinking；2027 起 $1.50/$7.50）；`gemini-3.1-flash-lite-image` $0.0336/张 1K 图（$30/1M image tokens）+ $0.25/1M input。requested 3.5 / served 3.6 的差异由**官方弃用路由**解释（3.5 的 API 请求自动路由到 3.6），**不必然是中转**。**唯一未闭合的是端点**：配置可自定义 `baseUrl`，本票不读配置；若端点不是官方，则官方价不适用，需用户提供价格表（字段见 §6）。
2. **用量已核实**（ledger）：`create` checkpoint 5 次文本 / 36,522 tokens；`build` 3 次文本 + 14 次生图 / 23,920 文本 tokens；合计 **8 次文本 + 14 次生图 / 60,442 tokens**（input 29,649 · output 6,944 · reasoning 23,849）。
3. **三档（官方价）**：checkpoint **≈$0.073**（5 次文本）；build **≈$0.535**（3 文本 $0.064 + 14 生图 $0.470）；全量（冻结 run 复现）**≈$0.608**；A 按 15/16/17 张图估 **≈$0.64 / $0.68 / $0.71**（背景拆层到 24 张则 ≈$0.94；checkpoint 才权威）。**生图占约 77%**。参数化形式：全量 = `0.029649·Pi + 0.030793·Po + N_img·Pimg`（官方口径 reasoning 含在 output；`Pi/Po` 每 1M token，`Pimg` 每张）。
4. **超限停止：现状不能提供“下一次调用不超限就停”的可靠动态护栏。** run ledger 只在**阶段末**落盘（`create` 结束、`build` 结束）；`build` 期间 17 次调用 + 内部重试在 ledger 里不可见，默认文本并发 4 / 生图并发 3。补救是**监视 pack staging 目录里逐张落盘的成功生图（§5.3 B）**，配合 `--concurrency-image 1` 把超射压到 ≤1–2 张——**有界超射的止损器，不是零超射保证**。provider 侧：官方 **Prepay 余额**（$0 → HTTP 402，但有 ~10 分钟 overage 延迟）或**月度 spend cap**（更慢）；**预算告警不是硬停**。可保证不超授权的只有：**静态上限 ≥ 结构性最坏情况**、**checkpoint 后人工放行 build**、**Prepay 余额（若可用）**。
5. **“22 次调用”不是货币上限**：它是 ledger 里的**条目数**（每资产/每步一格，重试折叠进 `attempts`），不是往返数（最坏 87 趟）、不是 token 量、更不是金额；它也不覆盖 A 的不同资源数（≈16，可到 24–25 张图）、失败 run 的沉没成本与端点/计价差异。按官方价，22 次里 $0.47 是 14 张图，8 次文本只有 $0.14。

---

## 1. 证据与边界

### 1.1 读过的输入

| 输入 | 用途 |
|---|---|
| `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/ledger.json` | 调用/用量基准（sha256 `42ed224e…921a4d`） |
| `.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/pack/v1/ledger.json` | 包级账（sha256 `435f63a3…3283fa`），与 run 级口径对照 |
| `packages/assets/src/generate.ts` | 文本 drawlist 调用、重试、账 |
| `packages/assets/src/image-config.ts` / `text-config.ts` | 上游配置来源与优先级（**不读值**） |
| `packages/pipeline/src/create-game.ts` | run ledger 的**唯一**写入点 |
| `packages/assets/src/pack.ts` | 生图并发、重试、包内 ledger 写入点 |
| `packages/contracts/src/structured-call.ts` | 结构化调用重采样次数 / 超时 |
| `packages/contracts/src/image-units.ts` | “清单 → 生图调用次数”的唯一尺子 |
| `packages/cli/src/cli.ts` | checkpoint 输出、并发 flag、失败时的花费回报 |
| `docs/v7.6/p0-01-readonly-capability-audit.md` §8、`rulings-2026-10-29.md`、票 01/14 | 预算闸与裁定 |

### 1.2 明确排除

- 未读 `game-maker.local.json` 的**任何内容**；只确认文件存在。
- 未读取/输出任何环境变量的**值**；只检查名称是否设置。
- 未调用上游、未跑生成/测试/浏览器命令、未改生产代码/契约/测试/fixtures/历史证据。
- 价格核查限于公开网页；**没有**登录任何 provider 控制台，也没有查看任何账单。

---

## 2. 冻结 run 的调用结构（已核实）

### 2.1 逐调用明细

| # | 阶段 | step | target | 类型 | input | output | reasoning | 合计 |
|---|---|---|---|---|---|---:|---:|---:|---:|
| 1 | create | analyze-reference | style | 文本+图 | 3,335 | 1,101 | 1,542 | 5,978 |
| 2 | create | analyze-intent | game-intent | 文本 | 3,008 | 503 | 2,350 | 5,861 |
| 3 | create | compile-design | game-design | 文本 | 4,268 | 766 | 1,956 | 6,990 |
| 4 | create | character-dna | character-dna | 文本 | 2,875 | 644 | 2,075 | 5,594 |
| 5 | create | plan-assets | recipe | 文本 | 7,731 | 1,442 | 2,926 | 12,099 |
| — | — | **checkpoint 小计** | | **5 次** | **21,217** | **4,456** | **10,849** | **36,522** |
| 6 | build | drawlist | hud-icon-scrap | 文本 | 1,368 | 452 | 2,504 | 4,324 |
| 7 | build | drawlist | hud-panel | 文本 | 1,481 | 1,153 | 4,601 | 7,235 |
| 8 | build | compile-runtime | game-config | 文本 | 5,583 | 883 | 5,895 | 12,361 |
| — | — | **build 文本小计** | | **3 次** | **8,432** | **2,488** | **13,000** | **23,920** |
| 9–22 | build | master ×2 / image ×12 | 8 个 target | **生图** | — | — | — | — |
| — | — | **合计** | | **22 条 / 8 文本 + 14 生图** | **29,649** | **6,944** | **23,849** | **60,442** |

- 生图 target 分布：`scavenger-hero`×3、`wasteland-bg`×4、`wasteland-patroller`×2、两个 master、`wasteland-chest`、`wasteland-scraps`、`wasteland-platform-tile` 各 1。
- 冻结 run 的 `attempts` 全为 1：`calls[]` 22 条 = **22 次往返**，没有重试消耗。`run.wallClockMs = 376,190`，包段 `wallClockMs = 332,781`。
- **ledger 的 `calls` 不是往返数**：重试折叠进同一格的 `attempts`；`calls` 条数 ≠ HTTP 请求数 ≠ 金额。

### 2.2 重试上限（决定最坏情况）

| 调用 | 重试策略 | 单步最多往返 | 代码 |
|---|---|---:|---|
| analyze-reference / analyze-intent / compile-design / character-dna | 结构化重采样 3 次（`STRUCTURED_CALL_ATTEMPTS`）；传输错误不重采样 | 3 | `packages/contracts/src/structured-call.ts:25` |
| plan-assets | `empty-input` 单独 6 次、其余 3 次 | **8** | `structured-call.ts:37`、`packages/assets/src/ops.ts:424` |
| drawlist（每个资源） | `attempts` 默认 **4**，**任何**失败都重试 | 4 / 资源 | `packages/assets/src/generate.ts:111,207-222` |
| compile-runtime | 结构化重采样 3 次 | 3 | `packages/assets/src/ops.ts:1162` |
| 生图（每个图单元） | 默认 **4**（429/5xx/网络/NO_IMAGE 才重试） | 4 / 单元 | `packages/assets/src/image-gen.ts:395,439-472` |

**结构性最坏情况（冻结 run 同样输入）**：

- 文本往返：`3+3+3+3+8`（理解层 20）+ `2×4 + 3`（构建层 11）= **31 趟**
- 生图往返：`14 × 4` = **56 趟**
- 合计 **87 趟**，而 ledger 只记 22 条。

> 说明：文本重试**不是**每次都发生；但静态预算必须按上限算，因为仓库里**没有**任何“按金额停止”的闸门（见 §5）。

### 2.3 A 的规模与冻结 run 不相等

按 `inputs/a-assets.md` 的资源表与 `imageUnitsOf` 的展开规则（动画一个动画一次、分层背景一层一次、其余一个资源一次、母版一张一次）粗估：

- `player-courier` 3 个动画 = 3 次；三层背景若各 1 层 = 3 次；4 个 solid = 4 次；pickup/goal/HUD×2/可选 chest = 5 次；母版 1 张。
- **≈16 次生图**（区间约 **15–17**；若模型把背景拆成多层，按冻结 run 的 `wasteland-bg`×4 层类比，可能到 **≈24–25**）。
- 冻结 run 是 14 次。**A 的真实数字只在 checkpoint 的“预计 N 次生图调用”里才成为权威值**（`packages/cli/src/cli.ts:311-324`，该数本身是“完整派发上限”，依赖/母版失败时实际更少）。

---

## 3. 价格：一手来源核查

### 3.1 先说清楚：模型可核实，端点不可核实

- **模型 ID 都是真的**（官方页，检索 2026-10-29）：
  - `gemini-3.5-flash` 的模型页写着：**“Deprecated … API requests to `gemini-3.5-flash` are automatically routed to `gemini-3.6-flash`”**（https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash，页面更新 2026-10-12）。
  - ⇒ **requested 3.5 / served 3.6 的差异由 Google 官方的弃用路由解释**，**不必然**意味着中转；但也不能据此证明端点就是官方（见下）。
  - `gemini-3.1-flash-lite-image` 在定价页有独立行（Nano Banana 2 Lite），且只支持 **1K**。
- **端点不可核实**：仓库允许 `baseUrl` / `protocol` / `model` 全配置（`text-config.ts:60-96`、`image-config.ts:20-30,160-190`），而本票**不读** `game-maker.local.json`。因此：
  - 若配置指向官方 Gemini API（协议形状 `x-goog-api-key` + `/interactions` / `:generateContent` 与官方一致），§3.3 的官方价**适用**；
  - 若指向中转/代理，官方价**只是参照**，实际以中转价目表为准。
  - 用户只需确认**端点主机名**（不是密钥），这一项就能闭合；本票不能代读。

### 3.2 配置存在性检查（不读值）

| 检查 | 结果 |
|---|---|
| `game-maker.local.json` 是否存在 | **存在**（内容未读） |
| `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` 是否设置（本会话） | **均已设置**（只检查存在性，未读值） |
| `GAME_MAKER_IMAGE_*` 是否设置 | 均未设置 → 生图配置走文件 |

> ⚠️ 本会话的 `ANTHROPIC_*` 可能继承自 agent 运行环境；但**如果执行票在同一环境跑**，文本上游会被 env 覆盖：`protocol` 固定为 `anthropic`、默认模型 `deepseek-v4-pro`（`text-config.ts:7,70-79`；`gemini-call.ts:36-38`），**不是**冻结 run 的 gemini 路径。执行前必须显式 `unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN`，或由用户明确接受另一个 provider。这一点**不需要读密钥**即可检查。

### 3.3 官方一手价格（检索 2026-10-29，USD）

**文本 `gemini-3.6-flash`**（served 模型；https://ai.google.dev/gemini-api/docs/pricing）：

| 档 | Input / 1M | Output（**含 thinking tokens**）/ 1M |
|---|---:|---:|
| Standard（至 2026-12-31） | **$0.75** | **$3.75** |
| Standard（2027-01-01 起） | $1.50 | $7.50 |
| Batch / Flex | $0.375 → $0.75 | $1.875 → $3.75 |
| Priority | $1.35 → $2.70 | $6.75 → $13.50 |

- **thinking 没有单独的行**：行标题逐字是 “Output price (including thinking tokens)” ⇒ **reasoning 按 output 计价**。
- 上下文缓存：$0.075/1M（2027 起 $0.15）+ $0.50/1M tokens/小时存储。
- `gemini-3.5-flash` 在 Gemini Developer API 定价页**没有独立行**（已弃用、自动路由）；Vertex/Agent Platform 页仍列 “Gemini 3.5 Flash” $1.50 input / $9.00 output，但实际请求路由到 3.6 ⇒ **按 3.6 计价**。

**生图 `gemini-3.1-flash-lite-image`**（同页）：

| 项 | 价格 |
|---|---:|
| Input（text / image / video） | **$0.25 / 1M** |
| Text + thinking output | **$1.50 / 1M** |
| Image output | **$30 / 1M image tokens** = **$0.0336 / 张 1K 图**（1,120 tokens/张） |
| Batch | $0.125 / $0.75 / $15 / 1M |

- 官方脚注逐字：“Output images at 1K (1024x1024px) consume 1120 tokens and are equivalent to $0.0336 per image.”
- 该模型**只支持 1K**（2K/4K unsupported）；本管线请求的正是 `image_size:"1K"`（`image-gen.ts:434`）。
- ⚠️ 本管线请求的是**非方形 1K**（如 `aspect 3:4`）；官方按 1024×1024 给 1,120 tokens，非方形是否同额未逐字说明——按 ± 处理。

**provider 侧花费上限（官方文档）**：

- **预算告警不是硬停**：Cloud Billing 文档逐字 “Setting an alerts-only budget doesn't automatically cap … usage or spending”。
- **Spend cap budget**（https://cloud.google.com/billing/docs/how-to/budgets-spend-caps，更新 2026-10-26）：Gemini API 是 eligible service；超限时“any new request … are paused”；限制：**单项目 + 单服务、仅按月**；且 “enforcement … isn't instant and any cost overages are billed as normal”。
- **Prepay 余额**（https://ai.google.dev/gemini-api/docs/billing）：余额到 $0 时该 billing account 下**所有 key 同时停**，请求返回 **HTTP 402**；但有 **~10 分钟 overage 延迟**，batch/agent 可能继续消耗。
- 账户级 cap（Tier 1 $250 / Tier 2 $2,000 / Tier 3 $20,000–$100,000）远高于本 run 的量级，且是账户级而非 run 级。
- ⇒ 官方侧**没有“每次调用前”的金额闸**；最接近的是 **Prepay 余额**（有 ~10 分钟延迟）或**月度 spend cap**（更慢、更粗）。

### 3.4 结论

- **价格本身可以核实**（官方页，USD）；**能否套用到本 run 取决于端点是否为官方**——这是唯一未闭合的事实，且只需用户提供主机名即可确认（不需要密钥）。
- **若为官方端点**：冻结 run 的三档成本见 §4.3（全量约 **$0.61**；A 按 16 张图估约 **$0.68**）。**生图占约 77%**，文本只占约 $0.14。
- **若为中转**：官方价不成立，需要用户提供 §6 A 的价格字段。

---

## 4. 成本模型与三档估算

### 4.1 公式

设：

- `Pi` = 文本 input 单价（每 1M token）；`Po` = output 单价（**官方口径已含 thinking**）；
- `Pr` = reasoning 单价（官方 = `Po`；若 provider 单独计价则替换）；
- `Pimg` = 每次生图单价（官方 1K = $0.0336；或 `$30/1M image tokens × tokens/张`）；
- `N_img` = 生图调用次数（含母版）。

```
C_text = (T_in/1e6)·Pi + ((T_out + T_reason)/1e6)·Po        # 官方：reasoning 按 output 计
C_img  = N_img · Pimg + (image input tokens/1e6)·Pi          # 输入图/提示词另计，通常可忽略
C      = C_text + C_img
```

### 4.2 三档的用量与参数化成本

| 档 | 文本调用 | 生图调用 | T_in | T_out | T_reason | 参数化成本 |
|---|---:|---:|---:|---:|---:|---|
| **checkpoint** | 5 | 0 | 21,217 | 4,456 | 10,849 | `0.021217·Pi + 0.015305·Po`（官方口径） |
| **build** | 3 | 14 | 8,432 | 2,488 | 13,000 | `0.008432·Pi + 0.015488·Po + 14·Pimg` |
| **全量** | 8 | 14 | 29,649 | 6,944 | 23,849 | `0.029649·Pi + 0.030793·Po + 14·Pimg` |

- 若 provider 把 reasoning 单独计价，把 `0.015305/0.015488/0.030793` 拆成 `T_out` 与 `T_reason` 两项分别乘 `Po` / `Pr`。
- **A 的 `N_img` 不是 14**：按资源表估 **≈15–17**（若背景拆层可到 ≈24–25，§2.3）；checkpoint 后以 CLI 报的“预计 N 次生图调用”为准。
- **build 的文本调用数也可能变**：drawlist 条数取决于模型把多少资源划给 drawlist（冻结 run 是 2 条）；compile-runtime 固定 1 条；理解层固定 5 条。

### 4.3 官方价下的三档估算（USD，Standard，2026 年内）

> 假设：端点 = 官方 Gemini API；按 served `gemini-3.6-flash` + `gemini-3.1-flash-lite-image` Standard 计价；reasoning 按 output；未计图片输入 token（估算 <$0.01/run）。

| 档 | 文本 | 生图 | 合计 |
|---|---:|---:|---:|
| **checkpoint**（5 次文本） | **$0.0733** | $0 | **$0.0733** |
| **build**（3 文本 + 14 生图，冻结规模） | $0.0644 | **$0.4704** | **$0.5348** |
| **全量（冻结 run 复现）** | $0.1377 | $0.4704 | **$0.6081** |
| **全量（A，15 张图）** | ~$0.138 | $0.5040 | **~$0.642** |
| **全量（A，16 张图）** | ~$0.138 | $0.5376 | **~$0.675** |
| **全量（A，17 张图）** | ~$0.138 | $0.5712 | **~$0.709** |
| **全量（A，24 张图，背景拆层）** | ~$0.138 | $0.8064 | **~$0.944** |
| **全量（2027 价，14 张）** | $0.2754 | $0.4704 | **$0.746** |

- **生图占全量的 77%**（$0.470 / $0.608）；文本 8 次调用合计只有 $0.138。
- 图片输入 token（风格图 + 母版 + 提示词）未在 ledger 里；按每张 ~0.5–1k input tokens 估，14 张约 $0.002–$0.004，可忽略但**不是 0**。
- 若 provider 走 Batch/Flex，文本与图各减半；本管线不默认走 Batch。
- 汇率/税费未计；官方页为 USD。

### 4.4 最坏情况（按仓库的重试上限与 maxTokens）

| 场景 | 文本往返 | 生图往返 | 文本 token 上界 | 官方价成本上界 |
|---|---:|---:|---|---:|
| S1 基准复现（全部 attempts=1） | 8 | 14 | 60,442（实测） | **$0.608** |
| S2 A 预期（attempts=1，`N_img≈16`） | 8 | 16 | 与 S1 同量级 ±20% | **≈$0.675** |
| **S3 结构性上限** | **31** | **56**（A 最多 64–96） | **≈754k**（见下） | **$4.32**（A 64 张：**$4.59**；96 张：**$5.67**） |

S3 的 token 上界算法：

- 文本 output+reasoning 每次 ≤ `maxTokens`（**假设 maxOutputTokens 含 thinking**；若 provider 不含，这个上界会更高）：理解层 5 步各 16,000（`analyze-intent.ts:30`、`compile-design.ts:30`、`compile-character-dna.ts:29`、plan-assets 16,000），drawlist 32,000（`generate.ts:37,47`），compile-runtime 16,000。
  - `20×16,000 + 8×32,000 + 3×16,000 = 624,000`
- input 按“同一 prompt 每次重发”估算：`3,335×3 + 3,008×3 + 4,268×3 + 2,875×3 + 7,731×8 + (1,368+1,481)×4 + 5,583×3 ≈ 130,451`。
- 合计 ≈ **754,451 tokens**，是实测 60,442 的 **12.5 倍**。
- 官方价：`(130,451×0.75 + 624,000×3.75)/1e6 = $2.4378`；加 56 张图 `$1.8816` ⇒ **$4.32**。

⚠️ **S3 是“几乎不会达到”的数学上界**（要求每次重试都撞 maxTokens 且仍失败）。它的用途是证明“静态授权上限”可以设得**不可能被突破**；不是预期花费。

- **checkpoint 的结构上限**（20 趟）：input ≈102,306、output ≤320,000 ⇒ **≈$1.28**。
- **build 的结构上限**（11 文本 + 56 图）：文本 ≈$1.16 + 图 $1.88 ⇒ **≈$3.04**。

### 4.5 不确定性（按影响排序）

1. **端点是否官方**（§3.1）：若不是，官方价全部作废，需中转价目表——这是最大的不确定性。
2. **结算模型**：官方已解释 3.5→3.6 的路由；但中转可能按 requested 或别的模型计价。
3. **reasoning 计价方式**：官方 = output 价（已核实）；中转可能不同。若被重复计费，文本成本可差约 1.8 倍（$0.138 → $0.25）。
4. **生图计费单位**：官方按 1K 图 $0.0336；非方形 1K 是否同额、参考图 input token 是否另计，均未逐字说明；生图调用的 text/thinking output（$1.50/1M）**没有**记进 ledger，若模型思考则另计。
5. **失败/重试计费**：官方按实际生成计费；失败响应是否计费取决于错误类型（如 NO_IMAGE 未产出图，可能不计 image output，但 input 可能计）。
6. **A 的资源数与图单元数**：≈15–17 vs 冻结 14；若背景被拆成多层可到 ≈24–25；checkpoint 才权威。
7. **失败 run 的沉没成本**：首次运行失败也必须花钱；预算必须覆盖“失败一次”的可能性。
8. **token 随机性**：60,442 是单次观测，不是期望值的严格估计；A 的输入不同，token 会变。
9. **价格时效**：3.6 Flash 是**介绍价**，2027-01-01 起翻倍（$1.50/$7.50）；若跨年执行，估算要换。
10. **税费/汇率/四舍五入**：官方价 USD；实际账单可能含税/本地货币。

---

## 5. 超限停止机制（不改生产代码）

### 5.1 关键事实：账是“阶段末”才有的

| 事实 | 证据 |
|---|---|
| `create`（理解层）结束时**一次性**写 run ledger；checkpoint 由 CLI 进程退出 | `packages/pipeline/src/create-game.ts:404,720-730` |
| `build` 期间账只在**内存数组**里累积；`run/v<N>/ledger.json` 在 build 结束才写 | `create-game.ts:666-668`；`packages/assets/src/pack.ts:1120-1135,1254-1255` |
| 包内 `ledger.json` 的“第一处”写入发生在**所有资产调用 `allSettled` 之后**（不是逐笔） | `pack.ts:1093-1135` |
| 生图/文本默认并发：文本 4、生图 3；可 `--concurrency` / `--concurrency-image` 调低 | `pack.ts:187,368-369`；`cli.ts:87-90` |
| 没有任何“预算/金额/剩余额度”钩子 | 全仓只有记账（`spentCall` / `formatSpentCalls`），无预算/限额实现（`grep budget/spend/cost` 无命中） |

**推论**：一个外部 watcher 轮询 `run/v<N>/ledger.json` 时——

- 在 `create` 阶段（5 次调用，串行约 90s）**看不到任何中间花费**；
- 在 `build` 阶段（17 次调用 + 重试，包段约 333s）**看不到任何中间花费**；
- 它只能在 **checkpoint 之后 / build 之后**读到完整账。

### 5.2 provider 侧硬限额（首选，但取决于 provider）

| 情形 | 能否做货币硬上限 | 验证方式 |
|---|---|---|
| 官方 Google Gemini API / Vertex AI | **可以，但都不是“逐调用即时”**：① **Prepay 余额**（$0 → HTTP 402，~10 分钟 overage 延迟）；② **月度 spend cap budget**（Gemini API eligible，单项目+单服务，“pauses new requests”，非即时，超支照常计费）；③ 请求配额/RPM 不是金额；**告警预算不是硬停** | 需登录 Cloud Billing / AI Studio 设置并查看；本票无法代为核实 |
| 预付费中转（余额制） | **余额本身可以是硬上限**：余额耗尽 → 调用失败（代码里见过 `INSUFFICIENT_BALANCE` 这类上游错误，`generate.ts:8-13`） | 用户在控制台确认“余额 = 批准上限”“不足时拒绝调用、不透支”；无需付费探测 |
| 支持 per-key 限额的中转 | 可能可设“每 key 的金额/请求上限” | 用户确认控制台是否有该字段；仓库内无此知识 |

**我无法从仓库或公开来源确认当前 provider 属于哪一类**（不读配置）。因此这一步必须由用户在票 14 里确认，并给出可核验的证据（余额/限额截图或文字描述，**不含密钥**）。

### 5.3 effort 侧 watcher（两种可观测信号）

#### A. 轮询 run ledger（阶段末才可见）

**能做到**：

- 在 `create` 进程退出后、`build` 启动前，读 run ledger 核对 checkpoint 花费，再由人决定是否放行 build（现有两段式流程天然提供的闸门）。
- 在 `build` 进程退出后（无论成功/失败），读 ledger 得到完整花费；失败时 CLI 也会把“已经花掉的那几笔”打到 stderr（`packages/cli/src/cli.ts:845-857`、`ops.ts:58-62`）。

**不能做到**：

1. **不能在 `build` 内的两次调用之间终止**：run ledger 在 build 结束前不变（§5.1）。
2. **不能保证“下一次调用不超限”**：默认最多 4 文本 + 3 生图同时在飞；杀进程时在飞的请求可能已在 provider 侧完成并计费。
3. **轮询延迟 + 进程退出延迟**：至少一个轮询周期；`kill` 之后子进程/在飞 HTTP 的清理也不是原子的。
4. **计数 ≠ 金额**：下一次调用的 token 量（尤其 reasoning）不可预知；若端点不是官方，单价也未定 ⇒ 仍然不知道“下一次”会花多少。

#### B. 监视 pack staging 目录（**实时副作用**，比 ledger 强）

`packAssets` 先写 `<out>/<gameId>/.building-<pid>-<version>/`（`pack.ts:329-333`），成功后才 `renameSync` 成 `pack/v<N>`（`:1303-1304`）。运行期间，**每个成功的生图单元一返回就落盘**：

- 图单元：`authoring/generated/<id>[.<anim>].png`（`pack.ts:668-670, 775`）；
- 母版：`authoring/masters/*`（`:487`）；
- drawlist：`authoring/drawlist/*.json`（`:597`）。

⇒ 外部 watcher 可以 glob `out/*/.building-*/authoring/generated/*.png`（以及 masters），**在 build 进行中**数“已成功返回的付费图”，达到阈值 K 后 `kill`。

**这条路的真实边界**：

| 能看见 | 看不见 |
|---|---|
| 已成功返回的生图单元数（≈已付费成功的张数） | 失败/重试的往返（NO_IMAGE、5xx 也可能计费） |
| 已完成的 drawlist/母版产物 | 在飞调用（默认并发 3） |
| 进度（与 CLI 的 `（done/all）` 同源） | 文本 token 用量与 text 花费 |

- 默认生图并发 3：看到第 K 张时，最多还有 **3 张在飞**；`--concurrency-image 1` 可把“看到后还能再发几张”压到 **≤1**（加上 kill 延迟内刚发出的一张）。
- 这是**近似的张数护栏**，不是“下一次调用不超限”的保证。若配一个有余量的 K（例如授权 N 张、在 N+2 杀），可以把超射限制在很小的常数内，但**不能归零**。
- ⚠️ **杀进程会丢账**：仓库里没有任何 `SIGINT`/`SIGTERM` 处理（全仓 grep 无命中）。正常异常的失败现场与 ledger 由 `pack` 的失败路径写；被 watcher `kill` 的 build **不会**写 build ledger，事后只能靠 staging 目录的 PNG 与 provider 账单对账。

> 所以：**“轮询 ledger 保证不超限”做不到；“监视 staging 目录并按张数杀”是一个有界超射的实用止损器**，两者不能混为一谈。

### 5.4 其他不改代码的做法（评估）

| 做法 | 能力 | 边界 |
|---|---|---|
| **静态授权上限 ≥ 结构性最坏情况** | **唯一能保证“不会超授权”的做法** | 需要价格（官方或中转）；授权额可能远高于预期（S3 的 $4.32–$5.67） |
| **provider 预付费余额 = 上限** | 若拒绝透支，则是**真正的金额硬上限** | 取决于 provider（§5.2），需用户确认 |
| 本地反向代理数请求（把 `GAME_MAKER_IMAGE_BASE_URL` 指到本地） | 可对**生图**做请求数硬停 | 需要用户提供真实 baseUrl（本票不读配置）；只数“请求”不数金额；文本侧没有对应的 env 覆盖（`ANTHROPIC_*` 会改协议） |
| 本地 HTTP 代理（`text.proxy` / `image.proxy`） | 只能看到 CONNECT 目标，HTTPS 内文不可见 | 不能按模型/请求计数，除非 MITM（侵入性远超本票） |
| 墙钟 `timeout` / 外部计时杀进程 | 粗粒度止损 | macOS 无 `timeout`/`gtimeout`（本机核实）；只限时间不限金额；会留下失败 run |
| 监视 staging + 阈值杀（§5.3 B） | 实时、有界超射的**近似**张数护栏 | 失败重试与在飞调用不可见；仍需单价才能换算金额 |

### 5.5 判定

**不能提供可靠的“每次付费调用前检查剩余预算、下一次不超限就停”的动态护栏**（在“不改生产代码 + 端点/计价未确认 + 账只在阶段末落盘”三条同时成立时）。

能做到的是**有界超射的止损**：监视 staging 目录 + `--concurrency-image 1`，在超过张数阈值后杀进程，超射约为 1–2 次生图（外加不可见的失败重试）。这不是“零超射”，所以不能替代货币上限。

能保证“不超授权”的只有下面三条，票 14 应从中选：

1. **provider 预付费余额 = 批准上限**（若 provider 支持且拒绝透支）→ 金额硬上限；
2. **静态授权上限 ≥ 结构性最坏情况** → 无论是否停止，花费都不可能超过授权；
3. **checkpoint 两段闸** → 在花第一笔生图钱之前，用实际 checkpoint 账 + CLI 的“预计生图调用数”重新核算 build 上限，由人放行。

推荐组合：**1（若可用）+ 2 + 3**；把 staging 止损（§5.3 B）作为额外保险，而不是主护栏。

---

## 6. 票 14 的最小输入清单

用户必须提供/裁定（A、B、C 三组缺任何一组，票 14 都无法给出“可核实的货币上限”）：

### A. 价格（二选一）

- **若端点 = 官方 Gemini API**：§3.3 的官方价已足够，**无需**用户再抄价格表；只需确认端点身份（B-4）与计价档（Standard / Batch；2026 介绍价 vs 2027 标准价）。
- **若端点 = 中转/代理**：必须提供（币种明确）：
  1. 文本 **served/计费** 模型的：input / output / reasoning 单价（每 1M token）；reasoning 的计价方式（单独 / 按 output / 已含）。
  2. 生图：每次单价，或每 1M image output token 单价 + 每次（1K）token 数；参考图/风格图是否另计 input。
  3. 失败/重试（NO_IMAGE、5xx、截断）是否计费；是否有缓存/批量折扣；税费。

### B. Provider 与结算

4. **端点主机名**（不是密钥）：官方 `generativelanguage.googleapis.com` / Vertex / 某中转；这一项决定 §3.3 是否适用。结算方式：Prepay 余额 / Cloud Billing 后付费 / 中转余额 / 其他。
5. 实际 served 模型（应为 `gemini-3.6-flash`；3.5 已是官方弃用别名，自动路由）。

### C. 硬上限能力

6. provider 是否支持：**Prepay 余额**（$0 → HTTP 402）/ **月度 spend cap**（Gemini API eligible，单项目+单服务）/ per-key 金额或请求上限 / 其他硬配额。
7. 用户将如何设置与**在不花钱的前提下**验证（控制台余额/限额、错误行为说明）；证据不含密钥。⚠️ 官方 Prepay 有 **~10 分钟 overage 延迟**，spend cap 也“不是即时”；不能承诺逐调用即停。

### D. 授权额度与范围

8. 金额 + 币种 + 覆盖阶段：仅 checkpoint / checkpoint+build / 全量；是否包含**一次失败 run**的沉没成本；未用完是否结转。**付费只发生在 `create`（理解层）+ `build`（生图/配置）**；`playtest` / QA / site / delivery 是本地执行，不调用付费上游（本票核实：`packages/cli/src/playtest.ts` 无上游调用）。
9. 是否批准在额度内**付费生图**（票 01 Q4 当前为“不批准”）。
10. 生图数量的授权口径：按 checkpoint 报的预计数（A 估 15–17）+ 余量；或明确接受“结构性上限（预计数 × 4）”。

**推荐额度菜单**（用户选一；金额为 USD，官方价假设）：

| 方案 | 上限 | 覆盖 | 保证 |
|---|---:|---|---|
| **A 最强** | **Prepay 余额 $2.00** + checkpoint 闸 | 一次全量（期望 ≈$0.68）；失败重跑需另充 | 余额到 0 停（~10 分钟 overage）。⚠️ 文本重试的结构性最坏（$1.28 checkpoint + $1.16 build）本身可能先撞上限 ⇒ **run 失败但不会超支**；不保证重跑跑完 |
| **B 无 provider 护栏** | **静态授权 = `4×N_img×$0.0336 + $2.44`**（16 图 ⇒ $4.59；24 图 ⇒ $5.67），向上取整 | 一次全量 + 全部重试上限 | 数学上不可能超授权；实际期望 ≈$0.68。⚠️ **必须在 checkpoint 后按实际清单重算**（图单元/drawlist 条数可能超出预估） |
| **C 折中** | **$3.50** + staging 张数止损（预计数+2 杀）+ `--concurrency-image 1` | 一次全量 + 有界超射 | 文本结构最坏 ≈$2.44 + 图 ≤~30 张 ≈$1.01 ⇒ ≈$3.45；超射 ≤1–2 张图（≈$0.03–0.07）+ 不可见重试；**不是零超射** |

> 若采用“先 checkpoint、再 build”的两段授权：checkpoint 段也应按其**结构最坏 $1.28** 授权（或用 Prepay 余额硬停），否则文本重试可能在中途撞上限、把 checkpoint 跑成失败。期望值仍是 $0.073。

### E. 执行环境

11. 执行前是否 `unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN`（本会话检测到已设置；不 unset 会切到 anthropic 协议/默认模型）。
12. 是否接受默认并发（文本 4 / 生图 3），或改用 `--concurrency 1`（只影响速度与在飞笔数，不影响总次数）。
13. 重试政策：仓库固定 3/4/6 次重采样；授权是否覆盖这些重试；是否仍坚持“首次失败不手工重试”。
14. 第二次完整运行仍须另行 HITL（继承票 01 Q5）。

### 推荐护栏（票 14 可直接采用）

> **余额硬上限（若可用）+ 静态最坏情况授权 + checkpoint 后人工放行 build + `--concurrency 1`（可选）+ 首次失败即停、不手工重试。**
> 不采用“watcher 轮询 ledger 保证下一次不超限”的表述——现状做不到。

---

## 7. “22 次调用”为什么不是货币上限

1. 它是 `calls[]` 的**条目数**：一个资源/一步一格，内部重试折叠进 `attempts`（`ops.ts:815-816`）。冻结 run 恰好 attempts 全为 1，所以 22 条 = 22 次往返；这不是保证。
2. **往返上限是 87**（文本 31 + 生图 56；A 的生图可能到 64）。
3. 它不含 token 量：8 次文本调用合计 60,442 tokens；按官方价只有 $0.138（reasoning 占 39%，已含在 output 价里）。
4. 它不覆盖 A 的设计差异（生图单元 ≈15–17 vs 14；drawlist 条数可能不同）。
5. 它不覆盖失败 run 的沉没成本。
6. 它不覆盖端点/计价口径（官方 vs 中转）与 2026 介绍价→2027 标准价的切换。

---

## 8. 审计限制

1. **未付费、未调用上游**：本票所有金额都是“实测用量 × 官方公开价”的估算，没有真实账单佐证；若端点不是官方，金额全部作废。
2. **未读配置**：`game-maker.local.json` 只确认存在；因此 provider 身份、baseUrl、模型别名映射、是否有余额/限额都**未核实**。
3. **只检查了环境变量是否存在**（未读值）；`ANTHROPIC_*` 的存在可能来自 agent 运行环境，不代表用户终端也如此——执行票应在实际执行 shell 里复核。
4. **单次观测**：ledger 来自一个 Demo、一次成功运行、全部 attempts=1；不能外推为“每次运行都 22 次 / 60,442 tokens”。
5. **A 未运行**：A 的资源数、drawlist 条数、token 量都是估计；唯一权威值在 checkpoint。
6. **公开价格核查的外部性**：官方页可能随地区/时间变化；本票记录的是 2026-10-29 检索结果（3.6 Flash 仍是 2026 介绍价），且**不构成**本 run 的结算价。
7. **未验证 provider 控制台**：硬上限能力只能由用户在票 14 确认。
8. **watcher 杀进程的证据缺口**：被外部杀掉的 build 不写 ledger（无信号处理），只能靠 staging 目录与 provider 账单核对；这会让“花了多少”失去仓库内的完整凭证。

---

## 9. 来源

- 冻结账：`.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/ledger.json`（sha256 `42ed224e…921a4d`）
- 包账：`.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/pack/v1/ledger.json`（sha256 `435f63a3…3283fa`）
- 代码：`packages/assets/src/generate.ts`、`image-gen.ts`、`image-config.ts`、`text-config.ts`、`pack.ts`；`packages/pipeline/src/create-game.ts`；`packages/contracts/src/structured-call.ts`、`image-units.ts`；`packages/cli/src/cli.ts`
- 审计与裁定：`docs/v7.6/p0-01-readonly-capability-audit.md` §8；`.scratch/p0-02-second-demo/rulings-2026-10-29.md`；票 01 / 14

### 官方价格与限额（检索 2026-10-29）

- Gemini API 定价：https://ai.google.dev/gemini-api/docs/pricing （Gemini 3.6 Flash、Gemini 3.1 Flash Lite Image）
- 模型页（3.5 Flash 弃用/自动路由）：https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash
- Vertex / Agent Platform 定价（3.5 Flash 行、3.6 介绍价说明）：https://cloud.google.com/vertex-ai/generative-ai/pricing
- 计费/Prepay：https://ai.google.dev/gemini-api/docs/billing
- 预算与 spend cap：https://cloud.google.com/billing/docs/how-to/budgets · https://cloud.google.com/billing/docs/how-to/budgets-spend-caps
- 检索方式：子代理经本机代理抓取官方页；页面自报 “Last updated 2026-10-29 UTC”（3.5 Flash 模型页为 2026-10-12 UTC）。
