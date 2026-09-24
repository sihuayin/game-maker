# 34. 千问 Token Plan 的生图配额与计费事实

Type: research
Status: resolved
Blocked by: —
Map: ../map.md

> R3 之后位图是**交付态**，也就是每条资源都过生图或光栅化 ——
> 生图配额从「一个成本项」变成**产品能不能用的前提**。
> [票 23](23-bitmap-asset-pipeline.md) 问题 6 与[票 19](19-latency-budget.md)
> 都在等这个事实。

## Question

1. **配额**：千问 Token Plan 的图像生成配额是多少？
   **它与聊天（qwen3.8-max 的视觉/文本调用）共享还是分开计**？
   超出之后的行为是什么（报错？降级？按量计费？）——失败签名长什么样，
   这是[票 14](14-degradation-chain.md) 要能识别的东西。
2. **计费**：一张 1024×1024 的 `wan2.7-image-pro` 生图折合多少？
   定价是否随分辨率/质量档位变化？
3. **限流**：有没有 QPS / 并发上限？一次要生 20 张图时，
   能不能并发、并发度多少？（直接决定批量生成的耗时，进[票 19](19-latency-budget.md) 的账本。）
4. **image-to-image**：票 23 提到 wan 支持 image 输入、可能能做**局部编辑** ——
   这个能力在 API 上的确切参数是什么、计费与纯生成是否相同？
   （票 23 问题 4 虽然随 R2 出局了 repair，但**图生图仍可能用于「同一个角色的多帧一致性」**——
   这是票 23 问题 1 的候选解法之一。）
5. **中文文档在哪**：把可引用的官方文档 URL 记下来，
   供后续 session 直接读，不必重新找。

## 产出要求

调用 `research` skill。**以官方文档为准**；查不到的部分**明确写「查不到」**，
不要用推测填空 —— 这张票的价值全在事实准确度上。
产出写到 `.scratch/game-creation-v1/research/wan-quota-facts.md`，
并在本票 `## Answer` 里给出一句话结论 + 指向该文件的链接。

⚠️ **凭据在环境变量里**（票 01 记录了探测方式）。可以发**极少量**真实请求验证事实
（例如 1 次生图确认计费字段），但**不要**做批量压测 —— 配额本身就是要查清的资源。

## Answer

**核心结论：生图配额与聊天调用共享同一个 Credits 池，超额直接阻断（不降级、不转按量），
且该配额此刻已经耗尽 —— 加上官方条款明确禁止自动化批量生图，位图交付路线当前既不可用也违规。**

全部事实写在 [`../research/wan-quota-facts.md`](../research/wan-quota-facts.md)（含可引用的官方文档 URL 清单）。

### 两条会推翻既有假设的发现

1. **⚠️ 配额已耗尽（2026-09-24 实测）。** 任何模型调用（含生图端点）都返回
   `429 / Throttling.AllocationQuota`，复位时间 `10-15 16:00:00 UTC`，距今约 21 天。
   位图交付路线**现在跑不通**。
2. **⚠️ 自动化批量生图违反使用条款。** 官方原文：Token Plan「仅限在编程工具和智能体工具中
   **交互式使用，不可用于自动化脚本、自定义应用程序后端或任何非交互式批量调用场景**」，
   违者「订阅被暂停或 API Key 被封禁」。本项目把生图编进编译管线，**正落在禁止范围内**。
   这是产品决策，工程绕不过去。

### 关键事实摘要

**1. 配额 —— 共享**
- Token Plan 用 **Credits 统一抵扣**，官方支持模型表里 `wan2.7-image(-pro)`（图片生成）与
  `qwen3.8-max` 等文本模型**并列在同一份订阅中** → 同一个池。
- **实测确认**：同一 key 打 chat / 生图 / Anthropic 三个端点，返回**同一条**「quota has been exhausted」。
- 档位：个人版 Lite 11,500 / Essential 25,500 / Standard 45,000 / Pro 180,000 Credits/月；
  用量包 100 元 = 20,000 Credits。订阅月 = 订阅日起 30 天，不结转。
- **超额行为：调用被阻断，不会按量计费**（官方原文）。没有「自动降级」档 —— 降级必须自己做。
- 注意区分：**按量付费的新人免费额度是每模型独立的**（`wan2.7-image-pro` 50 张，仅北京），
  与 Token Plan 的共享池是两回事。

**2. 失败签名（票 14 直接用）**
- 生图端点 / Anthropic 端点：`429` + `{"code":"Throttling.AllocationQuota",
  "message":"Your token-plan 1-month quota has been exhausted. …","request_id":"…"}`
- OpenAI 兼容端点：`429` + `{"error":{…,"type":"insufficient_quota","code":"insufficient_quota"}}`
- 响应头实测有 **`retry-after`（秒）**（**官方文档查不到此头**，属实测观察）。
- ⚠️ **别只看状态码**：Token Plan 额度耗尽是 **429**，而官方文档的「配额耗尽 403」说的是免费额度用完即停。
  必须按 code / message 判别。
- 需与限流区分：`Throttling.RateQuota`（RPM/RPS）、`Throttling.BurstRate`、`Throttling.Concurrency`。

**3. 计费 —— 按张，不随分辨率变**
- `wan2.7-image-pro` **0.50 元/张**（北京），`wan2.7-image` **0.20 元/张**（北京）。
  计费表**无分辨率维度**，1K/2K/4K 同价。`n` 直接乘费用。
- 万相图像生成与编辑是「**仅输出计费**」→ **图生图与文生图同价，输入图不计费**。
- ⚠️ **Token Plan 下一张图消耗多少 Credits —— 查不到**（官方无系数表，只说「以控制台为准」）。
  → 票 19 的成本账目前**只能按按量付费单价估**。

**4. 限流 —— RPS 5 / 并发 5**
- `wan2.7-image-pro`：**5 RPS，5 并发**（模型页 RPM 300 与之一致）。
- **按主账号维度合并计算**（所有子账号/空间/API Key 加总）。
- **Token Plan 的具体并发上限查不到**（官方只说「动态调整」）。
- 20 张图的理论下限 ≈ 4 轮 × 7.8 s ≈ **31 s**（票 19 可用），但这是按量付费的 5 并发。

**5. image-to-image —— 有，但是框选不是 mask**
- wan2.7 支持文生图 / 文生组图 / **图生组图 / 图像编辑 / 多图参考生成 / 交互式编辑**。
- 输入图参数：`input.messages[].content[].image`，**0–9 张**（URL 或 base64 data URI），
  单张 ≤20 MB、宽高 [240,8000]、比例 [1:8,8:1]。**有图输入时输出宽高比跟随最后一张输入图**。
- 局部编辑靠 **`parameters.bbox_list`**（绝对像素矩形坐标，**每图最多 2 个框**）。
  **wan2.7 明确不支持 `mask` / `ref_img` / `prompt_extend` / `negative_prompt`。**
  要真 mask 得换 `wanx2.1-imageedit`（0.14 元/张）。
- 计费与纯生成**相同**（仅输出计费）。
- 对票 23：多帧一致性有官方支持面（同一参考图喂每帧），但**无时序约束，能否对齐未验证**；
  bbox 粒度太粗做不了精细修形；非文生图场景分辨率上限 2K。

**6. 官方文档 URL** —— 完整清单见 research 文件 §5。最关键的几个：
[Token Plan 概述](https://help.aliyun.com/zh/model-studio/token-plan-overview)、
[个人版概述（含条款限制）](https://help.aliyun.com/zh/model-studio/token-plan-personal-overview)、
[模型调用价格（权威价表）](https://help.aliyun.com/zh/model-studio/model-pricing)、
[限流（RPS/并发表）](https://help.aliyun.com/zh/model-studio/rate-limit)、
[错误码总表](https://help.aliyun.com/zh/model-studio/error-code)、
[图像生成与编辑 API 参考](https://help.aliyun.com/zh/model-studio/wan-image-generation-and-editing-api-reference)、
[Token Plan 接入多模态生图](https://help.aliyun.com/zh/model-studio/token-plan-multimodal-gen)。

### 查不到的部分（不填空）

1. **Token Plan 下一张图的 Credits 消耗** —— 无系数表。→ 票 19 成本账算不出来。
2. **Token Plan 的具体并发/QPS 上限** —— 只说动态调整。
3. **该账号持有的确切订阅档位** —— 实测出现「1-week quota」错误，但现行个人版文档称「无周额度限制」、
   团队版称「固定月额度」，**对不上**。需登录控制台确认。
4. **`retry-after` 头的官方文档**（实测有，文档零命中）。
5. **成功生图的响应体样本**（因配额已耗尽，无法实测 `usage` / 计费字段）。
6. **`n` 与 `size` 在 Token Plan 端点上的取值/计费细节**（官方示例与按量付费 API 参考格式不一致）。

> 实测共 6 次极少量请求（票 34 禁止压测），明细见 research 文件 §6。
> 附带：`GET /compatible-mode/v1/models` **不受配额门控**（额度耗尽仍返回 200），
> 可做 key 有效性探测，但**探不到配额是否耗尽**。
