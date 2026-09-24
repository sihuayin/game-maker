# 千问 Token Plan 的生图配额、计费与限流事实

票 [34](../issues/34-wan-quota-facts.md) 的产出。2026-09-24 调研。
**所有结论以官方文档为准；实测部分单独标注。查不到的明确写「查不到」，不填空。**

---

## 0. 最重要的两条（先读这个）

### ⚠️ A. 配额**当前已耗尽**，生图现在就是不可用的

实测（2026-09-24 06:18 UTC）：**任何**模型调用都返回 429。生图端点也不例外。

```
HTTP/1.1 429 Too Many Requests
retry-after: 1849295
{"code":"Throttling.AllocationQuota",
 "message":"Your token-plan 1-month quota has been exhausted. The quota will reset at 10-15 16:00:00 UTC.",
 "request_id":"871236c9-448e-4a96-8fd3-36a462b8401d"}
```

- 本地 CC Switch 日志显示**最后一次成功调用**是 `2026-09-24 01:36:34 UTC` 之前，之后全是 429。
- 复位时间 `10-15 16:00:00 UTC`（= `10-16 00:00 UTC+8`），距今约 **21 天**。
- → **在 10-15 之前，位图交付路线在前端跑不通**。票 23 / 19 / 14 必须按这个前提设计。

### ⚠️ B. 用这个 key 做**自动化批量生图**违反使用条款

官方原文（[Token Plan 个人版概述](https://help.aliyun.com/zh/model-studio/token-plan-personal-overview)）：

> 仅限在编程工具和智能体工具（如 Claude Code、Cursor、Qwen Code、Qoder、OpenClaw 等）中**交互式使用，
> 不可用于自动化脚本、自定义应用程序后端或任何非交互式批量调用场景**。……
> 将套餐 API Key 用于允许范围之外的调用将被视为**违规或滥用，可能会导致订阅被暂停或 API Key 被封禁**。

另有：「Token Plan 个人版供本人在单台设备上使用。将 API Key 共享给他人使用可能被判定为违规并导致封禁。」

→ 本项目（编译管线里自动批量出图）**正好落在禁止范围内**。这不是配额问题，是合规问题，
   而且失败的后果（封号）比配额耗尽严重得多。**需要产品决策，不能靠工程绕。**

---

## 1. 配额：与聊天调用**共享**，且超额**不降级、直接停服**

### 1.1 有两个完全不同的「配额」，别混

| | 按量付费 · 新人免费额度 | 订阅制 · Token Plan Credits |
|---|---|---|
| 单位 | 张 / Token | **Credits**（统一） |
| 图像 vs 文本 | **各自独立，不共享** | **共享同一个池** |
| 超额行为 | 认证用户自动转按量付费（可关） | **调用被阻断，不转按量** |

**免费额度是分开的**（[免费额度文档](https://help.aliyun.com/zh/model-studio/new-free-quota) 原文）：

> 不同模型（含同一模型的不同快照版本）的免费额度**相互独立，不互通、不共享**。
> 当某个模型额度用完后，系统**不会自动切换到其他有额度的模型**。

`wan2.7-image-pro` / `wan2.7-image` 各 **50 张**免费额度，**仅华北2（北京）**，90 天有效
（[模型调用价格](https://help.aliyun.com/zh/model-studio/model-pricing) 万相图像生成与编辑表）。

**Token Plan 是共享的**（[Token Plan 概述](https://help.aliyun.com/zh/model-studio/token-plan-overview) 原文）：

> Token Plan 采用 **Credits 统一抵扣机制** ……支持文本生成、**图像生成**、视频生成、语音识别、
> 实时语音对话等多种模型，以及联网搜索、代码解释器等模型内置工具。

官方支持模型表里，`wan2.7-image`、`wan2.7-image-pro`（图片生成）与 `qwen3.8-max`、
`qwen3.7-plus` 等**并列在同一份订阅清单中**。→ **同一个 Credits 池。**

### 1.2 实测证据（共享是实测确认的，不是推断）

同一个 key，分别打三个端点，**全部**返回同一条额度耗尽消息：

| 端点 | 协议 | 响应体形状 | HTTP |
|---|---|---|---|
| `/compatible-mode/v1/chat/completions` | OpenAI | `{"error":{"message":"Your token-plan 1-month quota has been exhausted. …","id":"…","type":"insufficient_quota","code":"insufficient_quota"}}` | 429 |
| `/api/v1/services/aigc/multimodal-generation/generation` | MaaS 原生 | `{"code":"Throttling.AllocationQuota","message":"Your token-plan 1-month quota has been exhausted. …","request_id":"…"}` | 429 |
| `/apps/anthropic/v1/messages` | Anthropic | `{"code":"Throttling.AllocationQuota","message":"Your token-plan 1-month quota has been exhausted. …","request_id":"…"}` | 429 |

**聊天（qwen3.8-flash / qwen3.8-max）与生图（wan2.7-image-pro / wan2.7-image）打的是同一个池子。
这是本票最硬的一条结论。**

### 1.3 档位与额度（官方数字）

**个人版**（[概述](https://help.aliyun.com/zh/model-studio/token-plan-personal-overview) /
[常见问题](https://help.aliyun.com/zh/model-studio/token-plan-personal-faq)）：

| 档位 | 价格 | 每月限额 | 并发 Agent |
|---|---|---|---|
| Lite | 原价 60 元/月，限时 39 元/月 | 11,500 Credits | 1-2 个 |
| Essential | 原价 120 元/月，限时 79 元/月 | 25,500 Credits | 2-3 个 |
| Standard | 原价 180 元/月，限时 139 元/月 | 45,000 Credits | 3-4 个 |
| Pro | 原价 600 元/月，限时 499 元/月 | 180,000 Credits | 6-8 个 |
| 用量包 | 100 元/个/月 | +20,000 Credits | 最多同时持有 5 个 |

**团队版**：标准坐席 25,000 / 高级坐席 100,000 / 尊享坐席 250,000 Credits/坐席/月；
共享用量包 5,000 元 = 625,000 Credits。

- 订阅月 = **自订阅日起向后 30 天**（不是自然月），**未用完不结转**。
- 抵扣顺序：套餐月额度 → 用量包 → **服务暂停**。
- 官方原文：「**限额用完后调用会被阻断，不会按量计费。**」

### 1.4 ⚠️ 超额行为：不是降级，是**阻断**

这一点对票 14 是关键：**Token Plan 没有「超出后自动转按量付费」这个降级档**。
额度用尽 = 服务暂停，只能①等下一个订阅月 ②升级套餐 ③买用量包。
所以降级链必须**自己**兜底（回退程序化绘制），不能指望上游自动降级。

（注意与按量付费区分：按量付费 + 已实名认证时，免费额度用完会**自动转按量付费扣费**，
除非开了「免费额度用完即停」。这是另一条路径，与 Token Plan 无关。）

### 1.5 ⚠️ 实测与文档不一致：周配额

本地日志抓到的历史 429 有两种窗口：

```
2026-09-15  {"code":"Throttling.AllocationQuota","message":"Your token-plan 1-week quota has been exhausted. The quota will reset at 09-22 06:59:00 UTC."}
2026-09-24  {"code":"Throttling.AllocationQuota","message":"Your token-plan 1-month quota has been exhausted. The quota will reset at 10-15 16:00:00 UTC."}
```

- 当前官方文档说：个人版「**无周额度使用限制**」，团队版「固定月额度」——**都没有周窗口**。
- 但 `bl` CLI 文档又写 `bl usage token-plan` 是「查看 Token Plan **5 小时与周**配额用量」，
  `bl usage coding-plan` 是「查看 **5 小时、周与月**用量」。
- → **该账号实际持有的订阅带周配额窗口，与现行个人版/团队版文档不符。
  具体是哪个产品/档位，查不到**（需要登录百炼控制台 `Token Plan > 我的订阅` 才能确认）。
- 对下游的含义：**失败消息里的窗口名（1-week / 1-month / 5-hour）必须原样透传**，
  不要硬编码只认某一种。

### 1.6 失败签名速查（票 14 直接用）

**判定「配额耗尽」的充分条件**（任一命中）：

- HTTP `429` **且** body `code` ∈ {`Throttling.AllocationQuota`, `insufficient_quota`}
- HTTP `429` **且** message 匹配 `/quota has been exhausted/` 或 `/allocated quota exceeded/`

**响应头**：实测**有 `retry-after`，单位秒**（如 `1849295`），值精确等于到复位时刻的秒数。

> ⚠️ **`retry-after` 官方文档查不到。** 我 grep 了 error-code / rate-limit /
> rate-limiting-best-practices 三个官方页面，零命中；官方推荐的等待机制是**请求侧**头
> `X-DashScope-Wait-Timeout`（且只对 `Throttling.BurstRate` 生效）。
> `retry-after` 是**实测观察**，不是文档承诺 —— 下游可以读，但要有兜底默认值。

**必须区分开的其他 429**（都是限流，重试即可，不是配额）：

| code | 含义 | 官方处置 |
|---|---|---|
| `Throttling.RateQuota` / `LimitRequests` / `limit_requests` | RPM/RPS 超限 | 等一分钟 |
| `Throttling.BurstRate` / `limit_burst_rate` | 瞬时突增 | 平滑/退避；可用 `X-DashScope-Wait-Timeout` |
| `Throttling.Concurrency` | 并发超上限 | 等片刻 |
| `Throttling` | 泛化限流 | 等数分钟 |

**不要误判为配额的其他错误**：

| HTTP | code | 含义 |
|---|---|---|
| 401 | `invalid_api_key` / `InvalidApiKey` | key 错/漏 |
| 400 | `Arrearage` | **账号欠费**（注意是 400 不是 402/429） |
| 403 | `AllocationQuota.FreeTierOnly` | 免费额度用尽且开了「用完即停」 |
| 403 | `AccessDenied.Unpurchased` | 模型不在该档位白名单 |

官方明确语义切分（[限流文档](https://help.aliyun.com/zh/model-studio/rate-limit)）：
**「429 为速率限制，403 为配额耗尽」**。

> 但请注意：**Token Plan 的套餐额度耗尽实测返回的是 429**（不是 403），
> 因为它的 code 是 `Throttling.AllocationQuota`。**光看状态码会误判**，必须看 code。

---

## 2. 计费：按张，不随分辨率变化

### 2.1 按量付费原价（权威表）

来源：[模型调用价格](https://help.aliyun.com/zh/model-studio/model-pricing) 万相图像生成与编辑表
（列头是「**输出单价**」，**表里没有分辨率这一列**）。

| 模型 ID | 华北2（北京） | 国际（新加坡） | 免费额度 |
|---|---|---|---|
| `wan2.7-image-pro` | **0.50 元/张** | 0.562065 元/张 | 50 张 |
| `wan2.7-image` | **0.20 元/张** | 0.224826 元/张 | 50 张 |
| `wan2.6-image` | 0.20 元/张 | 0.220177 元/张 | 50 张 |

- **一张 1024×1024 的 pro 图 = 0.50 元**（北京）。pro 是非 pro 的 **2.5×**。
- **不随分辨率变化**：计费表无分辨率维度。`2K`（2048×2048）与 `1K`（1024×1024）同为 0.50 元/张；
  pro 文生图独有的 `4K`（4096×4096）也是同一单价。
  （对比：`qwen-image-3.0-pro` 是分档的，1k 0.25 元 / 2k 0.5 元 —— **wan2.7 不这样**。）
- **`n` 直接乘费用**：官方 API 参考原文「`n` 直接影响费用。费用 = 单价 × 成功生成的图片张数」。

> ⚠️ 文档 bug：[wan2.7-image 模型页](https://help.aliyun.com/zh/model-studio/wan2-7-image) 的
> 「日本（东京）」行把 **USD 数字 `0.027504` 标成了「价格（元）」**。权威价格表里
> **没有东京行**。**不要引用这个数。**

### 2.2 i2i 与 t2i 同价

万相图像生成与编辑章节标注「**仅输出计费**」，计费规则原文：

> 按输入图像和成功生成的**图像张数**计费。未说明输入图像价格的模型，**输入不计费，仅输出计费**。
> 费用 = 输入图像单价 × 输入的图像张数 + 输出图像单价 × 输出的图像张数。

→ **图生图的输入图不计费，与文生图同价。** 另外「请求失败不产生任何费用，也不消耗免费额度」。

### 2.3 ⚠️ Token Plan 下每张图耗多少 Credits —— **查不到**

官方只说「不同模型按**分档抵扣系数**计费 ……实际消耗以控制台订阅页用量详情为准」，
**没有公布任何系数表**。文档里唯一的算例是文本模型的 token 换算，与图像无关。

→ **无法把「一张图 = 多少 Credits」算出来**，只能到控制台实测。
   这是本票最大的事实缺口，直接影响票 19 的账本和票 23 的可行性判断。

---

## 3. 限流：RPS 5 / 并发 5

来源：[限流](https://help.aliyun.com/zh/model-studio/rate-limit) 万相表（实测核对过原始 HTML 表格）

| 模型 | 每秒钟调用次数（RPS） | 同时处理中任务数量（并发数） |
|---|---|---|
| `wan2.7-image-pro` | **5** | **5** |
| `wan2.7-image` | **5** | **5** |

模型页写的 `RPM 300` 与 `5 RPS × 60` **一致**，两处互证。

**关键约束**：

- **按主账号维度计算** —— 账号下所有 RAM 子账号、业务空间、API Key 的调用量**合并计算**
  （原文：「百炼按主账号维度对模型调用设置限流」）。所以不是「每个 key 5 并发」，是**总共 5**。
- **Token Plan 的并发上限 —— 查不到具体数字。** 官方只说
  「Token Plan 团队版存在并发限制。平台会根据整体资源负载**动态调整**并发上限」。
  个人版另有「并发 Agent 1-2 / 2-3 / 3-4 / 6-8 个」的档位描述，但这是**工具侧**的 Agent 数，不是 API 并发数。
- 「充值不改变模型默认的 RPM 和 TPM 限流阈值」，要提额得走商务。

### 对「一次生 20 张」的账（票 19 可用）

- 硬上限 **5 并发**。20 张 = 4 轮。
- 实测单张 **7.8 s**（[实验 README](../experiments/bitmap-asset-via-wan/README.md)）。
- **理论下限 ≈ 4 × 7.8 ≈ 31 s**（假设理想并发、无排队、无重试）。
- 但这是**按量付费**的 5 并发。走 **Token Plan** 时并发受「动态调整」限制，**无法给出确定数字**，
  且上面 §0.B 的条款问题在这里同样适用。
- 另外单账号 5 并发是**全项目共享**的 —— 如果并行跑多个 game run，会互相抢。

---

## 4. image-to-image：有，且是**框选**不是 mask

来源：[图像生成与编辑 API 参考](https://help.aliyun.com/zh/model-studio/wan-image-generation-and-editing-api-reference)
（已核对原始 HTML 参数表）

wan2.7 系列能力：**文生图、文生组图、图生组图、图像编辑、多图参考生成、交互式编辑**。

### 4.1 输入图参数

```
{"model":"wan2.7-image-pro",
 "input":{"messages":[{"role":"user","content":[
    {"image":"<URL 或 data:{MIME};base64,{data}>"},   // 0–9 张
    {"text":"<prompt>"}]}]},
 "parameters":{"size":"2K","n":1,"watermark":false,"thinking_mode":true}}
```

- 图片走 `input.messages[].content[].image`，**0–9 张**，多图按数组顺序。
- 图片限制：JPEG/JPG/PNG(**无 alpha**)/BMP/WEBP；宽高各 **[240, 8000]** px；
  宽高比 **[1:8, 8:1]**；单张 **≤ 20 MB**。
- **有图片输入时，输出宽高比跟随输入图（多图时为最后一张）**，再缩放到选定分辨率。
  → 对「保持角色比例」有用。

### 4.2 局部编辑 = `parameters.bbox_list`，**没有 mask**

官方参数表原文：

> `bbox_list` — `array[array[array[integer]]]`（可选）
> **交互式编辑框选区域。** 对应关系：列表长度必须与输入图片数量一致。
> 若某张图片无需编辑，请在对应位置传入空列表 `[]`。
> 坐标格式：`[x1, y1, x2, y2]`（左上角 x, 左上角 y, 右下角 x, 右下角 y），
> 使用**原图绝对像素坐标**，左上角坐标为（0，0）。
> 限制条件：**单张图片最多支持 2 个边界框。**

- **wan2.7 明确不支持 `mask`、`ref_img`、`prompt_extend`、`negative_prompt`。**
- 需要真正的 mask 编辑要用**别的模型**：`wanx2.1-imageedit`
  （`input.function: description_edit_with_mask` + `input.mask_image_url`，
  白=编辑区、黑=保留区），0.14 元/张，500 张免费额度。
- 还有 `wan2.5-i2i-preview`（`input.images: [...]` + `input.prompt`），0.20 元/张。

### 4.3 计费

i2i 与 t2i **同价**（§2.2，「仅输出计费」）。局部编辑同理。

### 4.4 对票 23 的含义

- **多帧一致性有官方支持面**：`image` 输入 + 多图参考 + 输出跟随输入比例，
  可以拿「同一张参考图」喂每一帧。但**没有 frame-to-frame 的时序约束**，
  一致性靠模型自己，**能不能对齐未验证**（实验 README 也把「多帧 sheet」标为❓）。
- **bbox 粒度粗**（每图最多 2 个框，矩形），做不了精细修形。
- 分辨率上限：非文生图场景最大 **2K**；`4K` 仅 pro 的文生图可用。

---

## 5. 可引用的官方文档 URL（中文，后续 session 直接用）

**配额 / 计费**
- https://help.aliyun.com/zh/model-studio/token-plan-overview ← Token Plan 概述、档位、Credits 机制
- https://help.aliyun.com/zh/model-studio/token-plan-personal-overview ← 个人版档位 + **使用条款限制（§0.B）**
- https://help.aliyun.com/zh/model-studio/token-plan-personal-faq ← 额度规则、报错表
- https://help.aliyun.com/zh/model-studio/token-plan-team-overview
- https://help.aliyun.com/zh/model-studio/token-plan-team-faq
- https://help.aliyun.com/zh/model-studio/model-pricing ← **权威价格表**（万相图像生成与编辑）
- https://help.aliyun.com/zh/model-studio/new-free-quota ← 免费额度独立性的官方表述

**限流 / 错误码**
- https://help.aliyun.com/zh/model-studio/rate-limit ← **RPS/并发表**
- https://help.aliyun.com/zh/model-studio/error-code ← **错误码总表**（注意是单数 `error-code`；
  复数 `error-codes` 是百炼 1.0 旧文档，不适用）
- https://help.aliyun.com/zh/model-studio/rate-limiting-best-practices ← 退避/重试官方建议

**模型 / API**
- https://help.aliyun.com/zh/model-studio/wan2-7-image-pro ← 模型卡 + RPM
- https://help.aliyun.com/zh/model-studio/wan2-7-image
- https://help.aliyun.com/zh/model-studio/wan-image-generation-and-editing-api-reference ← **API 参数权威**
- https://help.aliyun.com/zh/model-studio/token-plan-multimodal-gen ← **Token Plan 下怎么调生图**
- https://help.aliyun.com/zh/model-studio/cli/usage-quota ← `bl` CLI 查用量/配额/限流

**接入信息**
- Base URL（OpenAI 兼容）：`https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- Base URL（Anthropic 兼容）：`https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic`
- 生图端点：`POST https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- Key 前缀：Token Plan 专属 key 以 **`sk-sp-`** 开头（按量付费是 `sk-`）；混用会 401。
- **生图不能走文本 Base URL** —— 官方：「图像、视频生成模型使用独立接口，无法通过文本模型的 Base URL 直接调用」，
  必须通过工具的 Skill / Slash Command / Agent 扩展机制接入。

### 怎么查剩余额度（官方途径）

本地没装 `bl` CLI（实测 `which bl` 找不到）。官方途径：

- 控制台：`百炼控制台 > Token Plan > 我的订阅` 看 Credits 余额与消耗；`用量分析` 看明细。
- CLI（需先安装）：`bl usage token-plan`（5 小时与周配额）、`bl usage coding-plan`、
  `bl token-plan harness-quota`、`bl quota list/check`（RPM/TPM）、`bl usage free`（免费额度）。

---

## 6. 实测方法与原始记录

全部为**极少量**真实请求（票 34 明确禁止压测），共 6 次，均为只读探测或必然失败的调用：

| # | 请求 | 结果 |
|---|---|---|
| 1 | `GET /compatible-mode/v1/models` | **200**，15 个模型（含 `wan2.7-image`、`wan2.7-image-pro`）。**`/models` 不受配额门控** |
| 2 | `POST /compatible-mode/v1/chat/completions`（qwen3.8-flash，5 tok） | 429 `insufficient_quota` |
| 3 | `POST .../multimodal-generation/generation`（wan2.7-image-pro） | 429 `Throttling.AllocationQuota` |
| 4 | 同上（wan2.7-image, 512*512） | 429 `Throttling.AllocationQuota` |
| 5 | `POST /apps/anthropic/v1/messages` | 429 `Throttling.AllocationQuota` |
| 6 | 错误 key / 无 key（各 1 次） | **401** `invalid_api_key` / `No API-key provided.` |

> 因配额已耗尽，**「成功生图的响应体长什么样、usage/计费字段有哪些」这次没能实测到**。
> 官方 API 参考给的响应字段是：`output.choices[].message.content[].image`（PNG URL，**24 小时有效**）、
> `usage.image_count`、`usage.size`；并注明 token 类字段**不计费**，「按图片张数计费」。
> **但我没有拿到真实响应样本** —— 实验 README 里的那次成功调用也没有留响应体。

**本地日志旁证**（`~/.cc-switch/cc-switch.db`，只读）：

- 该 key 在 `2026-09-23` 当天成功调用 **1411 次**（1.38M input tokens / 774K output tokens /
  175M cache-read tokens），`2026-09-24 01:36 UTC` 起开始 429。
- 更早 `2026-09-15` 有过一轮 **1-week quota** 耗尽，复位于 `09-22 06:59 UTC`。
- → 该订阅**同时存在周窗口和月窗口**，与现行文档不符（见 §1.5）。

**健康探测建议**：`GET /compatible-mode/v1/models` 不受配额影响，
适合做「key 是否还有效」的低成本探测（但**探测不到配额是否耗尽** —— 它额度用完也返回 200）。
要探配额，只能发一次真实的最小调用，然后看是不是 429。

---

## 7. 明确「查不到」清单

1. **Token Plan 下一张 `wan2.7-image-pro` 图消耗多少 Credits。** 官方无系数表，只说「以控制台为准」。
   → 直接导致票 19 的成本账**目前算不出来**。
2. **Token Plan 的具体并发/QPS 上限数字。** 只说「动态调整」。
3. **该账号持有的确切订阅产品与档位。** 因为实测出现「周配额」，而现行个人版文档说无周配额、
   团队版说固定月额度 —— **对不上**。需要登录控制台确认。
4. **`retry-after` 响应头的官方文档。** 实测存在（秒），但三份官方页零命中。
5. **配额耗尽时**`usage` / 计费字段**长什么样**（因为额度已耗尽，无法实测成功响应）。
6. **`n` 与并发叠加时的实际计费**（例如 `n=4` 是算 4 张还是 1 次调用）—— 官方只说按张计费。
7. **Token Plan 的「分档抵扣系数」具体分几档、各是多少。**
8. **`bbox_list` / `enable_sequential` / `color_palette` 在 Token Plan 端点上是否全部可用。**
   Token Plan 的官方 curl 示例只传了 `size`，未声明其他参数的可用性。
9. **`size` 取值格式在 Token Plan 端点上是否一致。** Token Plan 示例用 `"1024*1024"`，
   而按量付费 API 参考用档位串 `"1K"/"2K"/"4K"`（或 `"宽*高"`）。文档未对齐。

---

## 8. 对既有票的直接影响（供主 session 更新 map 时参考）

- **票 23（位图管线）**：位图交付态**当前不可用**（配额耗尽至 10-15），
  且长期看**自动化批量生图违反条款**。→ Q3 的「位图 vs 程序化」需要重新摆；
  至少要有「只有人工交互式出图才行」的假设。
- **票 14（降级链）**：配额耗尽**不是**上游自动降级，是硬阻断。
  识别签名见 §1.6（**注意 429 + `Throttling.AllocationQuota`，别只看状态码**）。
  另需把「条款违规风险」当成一条独立降级触发条件 —— 它不是错误，是策略。
- **票 19（延迟/成本账本）**：单张单价已知（0.50 元），但 **Credits 换算查不到**；
  并发硬上限 RPS 5 / 并发 5，20 张理论下限 ≈ 31 s。
  成本账目前**只能按按量付费单价估**，Token Plan 路径无法计价。
- **票 12（结构化 Visual QA）**：`usage.image_count` 可用于核对实际出图张数。
