# 01. 本地模型代理的真实调用契约是什么？

Type: research
Status: resolved
Blocked by: —
Map: ../map.md

## Question

`http://127.0.0.1:15721` 这个本地代理暴露了 `deepseek-v4-pro` 和
`deepseek-v4-flash`（两者都声明 `input_modalities: ["text","image"]`、
`supported_in_api: true`、1M context），凭据是环境变量 `ANTHROPIC_AUTH_TOKEN`。

但 `/v1/models` 返回的 payload 形状（含 `base_instructions`、`apply_patch_tool_type`、
`shell_type` 等字段）看起来是 **OpenAI Codex / Responses 风格**，而环境变量名和
`x-api-key` 头又是 **Anthropic 风格**。必须查清：

1. **协议**：这个代理接受 Anthropic Messages API (`/v1/messages`)、
   OpenAI Chat Completions (`/v1/chat/completions`)、还是 OpenAI Responses API？
   三者都试，记录实际的请求/响应形状。
2. **鉴权**：`x-api-key` 还是 `Authorization: Bearer`？还是两者都收？
   `anthropic-version` 头是否必需？
3. **图像输入**：图片怎么传？base64 inline（`source.type: "base64"`）？
   还是 URL？单请求最多几张图（Q1 说的是「一张或者多张图片」）？
   有无单图体积/分辨率上限？
4. **结构化输出**：能否强制 JSON 输出？支持 `response_format: json_schema` /
   Anthropic 的 tool-use 强制 / 还是只能靠 prompt 约束 + 事后 Zod 校验？
   这直接决定 `compileStyle` / `compileGame` 的可靠性设计。
5. **限流与超时**：有无 RPM/TPM 限制？典型首字延迟与完整响应延迟是多少？
   超时该设多少？（票 14 的降级探测需要这个数字。）
6. **成本**：这两个模型的 token 单价，或者代理是否免费转发？
   （票 17 的 budget 需要这个来设 `maxCost`。）
7. **可用性边界**：这个代理由什么进程拉起？Claude Code 退出后它还活着吗？
   重启机器后呢？（这决定 fixture 降级到底是「偶发兜底」还是「常态」。）

产出：一份能让人直接照着写 HTTP client 的事实清单，含可复制的真实请求样例
和真实响应样例。**不要猜测，全部实测。**

## Answer

全部实测完成（2026-09-23）。测试脚本与产物留在 `/tmp`（未入库）。
**结论：能用，但和 `/v1/models` 声明的完全不一样 —— 有两处会直接推翻既有决策。**

### 1. 协议：三种都通，但**不同协议走不同上游供应商**

代理是 **CC Switch**（`/Applications/CC Switch.app`，本机 GUI 应用）。
它的错误信息自曝了身份：`CC Switch local proxy failed while handling Codex
endpoint /chat/completions. Provider: DeepSeek`。

| Endpoint | 协议 | 实际上游 | 真实模型 |
|---|---|---|---|
| `/v1/messages` | Anthropic Messages | **qwen3.8-max** | 只有一个；**请求里的 model 名被忽略** |
| `/v1/chat/completions` | OpenAI Chat | **DeepSeek** | `deepseek-v4-pro`、`deepseek-flash` |
| `/v1/responses` | OpenAI Responses | **DeepSeek** | 同上 |

三者均 HTTP 200。

### 2. ⚠️ `/v1/models` 的元数据是**误导性的**

它列出 `deepseek-v4-pro` / `deepseek-v4-flash`，两者都标
`input_modalities: ["text","image"]`。**实测为假**：

- 那份列表描述的是 **Codex/OpenAI 端点**，而该端点**不转发图片** ——
  DeepSeek 实际收到的是占位符 `[Unsupported Image]`。
  证据：请求一张四象限色块图并问颜色，`deepseek-v4-pro` 返回**空 content**，
  而它的 `reasoning_content` 里写着「用户上传图片但显示 [Unsupported Image]」，
  并把 200 个 token 全烧在纠结要不要诚实说自己看不到图。
- **真正能收图的是 Anthropic 端点（qwen3.8-max）**，而它**根本没出现在
  `/v1/models` 里**。

### 3. 图像输入：**只有 `/v1/messages` 可用**，且精度很高

格式：`{type:"image", source:{type:"base64", media_type:"image/png", data:<b64>}}`

用一张程序化生成的 64×64 四象限 PNG 验证（真实色值已知）：

| 象限 | 我生成的真实 hex | 模型返回 |
|---|---|---|
| 左上 | `#E74C3C` | `#E74C3C` ✅ 精确 |
| 右上 | `#2ECC71` | `#2ECC71` ✅ 精确 |
| 左下 | `#3498DB` | `#3498DB` ✅ 精确 |
| 右下 | `#F1C40F` | `#F1C40F` ✅ 精确 |

- **多图可用**：给 2 张（象限图 + 渐变图），正确区分「第一张红绿蓝黄象限、
  第二张是渐变」；给 3 张，正确回答「3」。→ **Q1 的「一张或者多张」成立。**
- **大图可用**：512×512、321 KB PNG / 418 KB base64 → HTTP 200，16.7 s，描述正确。
  未触到上限（没继续往上试）。
- ⚠️ **色板会被「补全」**：一张只有 4 种颜色的图，模型返回了 **5-6 个** hex，
  多出来的 `#ECF0F1`、`#2C3E50` 是 Flat UI 调色板的常见邻居色 —— 是幻觉。
  **这直接削弱票 12 的「颜色 ∈ palette」静态校验**（见下文对票 12 的更新）。

### 4. ⚠️ 强制 JSON：**tool-use 不可靠，必须走纯文本 JSON**

- **tool-use（`tool_choice` 强制）：完整 12 字段 StyleSpec schema → 1/3 通过。**
  失败形态：`tool_use` 块存在但 `input` **只有部分字段**，然后提前 `end_turn`
  （run2 只吐出 `camera`，run3 只吐出 `id`+`composition`）。
  唯一「通过」的那次是 `stop_reason=max_tokens`、烧满 8000 token、耗时 **136 秒**。
  小 schema（3 字段）下 tool-use 反而完美 —— 说明是**字段数/长度触发的截断**，
  推测与 qwen 原生 `<tool_response>` XML 格式被代理转译有关
  （`thinking` 块里能看到泄漏的 XML 原文）。
- **纯文本 JSON（prompt 里给结构，不要工具）：**
  - 视觉路径（qwen3.8-max，完整 StyleSpec）→ **3/3 通过**
  - 文本路径（DeepSeek，GameSpec 编译）→ **6/6 通过**（pro 3/3、flash 3/3）
  - **9 次调用零 markdown 代码围栏**，全部 `JSON.parse` 直接成功

  **→ 结论：用纯文本 JSON + Zod parse + 重试。不要用 `tool_choice`。**
  这让「Zod 校验失败后重试」从可选优化变成**必需机制**，
  直接抬高了票 09 第 7 条（schema 严格度）和票 14 第 5 条（fixture 清单）的权重。

### 5. 鉴权：**完全不校验**

`Authorization: Bearer <正确 key>` / `x-api-key: <正确 key>` /
`Authorization: Bearer WRONG_KEY` / `x-api-key: WRONG_KEY` /
**完全不带鉴权头** —— **五种全部 HTTP 200**。

代理自己持有上游凭据，对本地调用方不做任何验证。
`anthropic-version` 头**非必需**。

含义：① demo 不需要真的拿到 token 也能跑（但仍应发送，便于将来代理收紧）；
② 这是一个**开放的 localhost 端点**，任何本机进程都能白嫖上游额度 —— 记一笔，非本项目职责。

### 6. 延迟（**这是最大的工程约束**）

| 路径 | 实测延迟 |
|---|---|
| qwen3.8-max · 视觉 · 完整 StyleSpec（tool-use） | **11.1 / 40.9 / 136.3 s** |
| qwen3.8-max · 视觉 · 纯文本 JSON StyleSpec | **48.5 / 46.9 / 62.6 s** |
| qwen3.8-max · 视觉 · 短回答 | 2.6 – 16.7 s |
| deepseek-v4-pro · 文本 · GameSpec | 26.9 / 36.7 / 37.8 s |
| **deepseek-v4-flash · 文本 · GameSpec** | **5.6 / 7.2 / 7.6 s** |
| DeepSeek · 纯 ping（`hi`） | 0.63 s |

**延迟主因是推理 token**：pro 的一次调用 `completion_tokens=1993`，其中
`reasoning_tokens=1603` —— **80% 的输出预算烧在思考上**。
所以 `max_tokens` 必须给足（StyleSpec 建议 ≥ 3000，实测 2208-2842 够用），
给小了会被推理吃掉、正文被截断。

### 7. 限流与成本

- **无任何限流响应头**。全部响应头只有 `content-type`、`x-ds-trace-id`（DeepSeek 追踪）、
  `strict-transport-security`、`x-content-type-options`。没有 `x-ratelimit-*`。
- **usage 字段每条响应都有**，可直接用于成本核算：
  - Anthropic 形状：`{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}`
  - OpenAI 形状：`{prompt_tokens, completion_tokens, total_tokens, completion_tokens_details.reasoning_tokens}`
- **单价无法从代理获知**（它不转发定价）。要算钱得自己去 DeepSeek / 通义官网查牌价。
- 注意：图片的 token 计费看起来是**固定小额**（418 KB 的图只报了 `input_tokens=290`），
  不是按像素线性增长。

### 8. 可用性边界：**fixture 降级是「兜底」而非「常态」**

```
COMMAND   PID   USER      PPID  STARTED
cc-switch 651   sihuayin  1     一 9/21 20:13:01 2026
```

- **PPID = 1（launchd）**，不是 Claude Code 的子进程 → **退出 Claude Code 后代理仍活着**。
- 已持续运行 2 天。它是一个用户手动启动（或登录项启动）的 **macOS GUI 应用**。
- **但它活不过重启**，除非配了登录项；而且用户随时可能在 GUI 里切换/关闭供应商。

→ **Q8 的三层降级依然必需**，但定位从「常态兜底」修正为「偶发兜底」。
探测成本极低（`/v1/models` 或一次 8-token ping ≈ 0.6 s），
建议**每个 phase 前探测**而不是只在启动时探一次。

### 9. 模型命名

- `deepseek-v4-flash` 是**别名**，上游实际叫 `deepseek-flash`（响应的 `model` 字段会暴露）。
- 上游报错明确列出合法名：`The supported API model names are deepseek-flash, deepseek-v4-pro`。
- 在 OpenAI 端点请求任何其他名字（`claude-sonnet-5` / `gpt-5` / 乱写）→ **HTTP 400** + 上面那句有用提示。
- 在 Anthropic 端点请求任何名字 → 一律 **qwen3.8-max**，静默忽略。

---

## 对地图的影响（必须处理）

### ⚠️ A. Q8 的模型分工**部分作废**

原决策：「`deepseek-v4-pro` 做 compile，`deepseek-v4-flash` 做 repair 诊断」。
这假设了一个模型家族内部有 pro/flash 两档。

**实际情况是按模态分裂的**：

| 调用点 | 模态 | 必须走 | 实际模型 | 延迟 |
|---|---|---|---|---|
| `compileStyle` | **视觉** | `/v1/messages` | qwen3.8-max（**唯一选择**） | 47–63 s |
| `compileGame` | 文本 | `/v1/chat/completions` | `deepseek-v4-pro` | 27–38 s |
| GameplayTestPlan 补充 | 文本 | 同上 | `deepseek-v4-flash` | 6–8 s |
| Repair 诊断 | 文本 | 同上 | `deepseek-v4-flash` | 6–8 s |

**pro/flash 的分档只在文本路径存在；视觉路径只有一个模型，无从选择。**
已在 map.md 的 Q8 行加上修正标注。

### ⚠️ B. Q17 的 10 分钟 budget **有严重超支风险**

单次视觉调用最坏 **136 s**。粗算一次完整 run：
`compileStyle 60s + compileGame 35s + 3 轮 repair ×(诊断 7s + 重编译 60s)`
≈ **315 s 起步**，还没算 Playwright 构建/启动/截图/评估。
若触发一次 tool-use 式的退化长尾，单次就能吃掉 136 s。

**10 分钟（600 s）的 `maxDurationMs` 大概率不够。** 已开新票
[19. 延迟账本与缓存策略](19-latency-budget.md) 专门处理。

### 已同步更新的票

- **票 09**（Game Config 契约）：第 7 条权重上调 —— 纯文本 JSON 是唯一可靠路径，
  Zod 校验 + 重试从「可选」变「必需」；并新增「prompt 里如何描述 schema」的子问题。
- **票 12**（结构化 Visual QA）：新增**色板补全幻觉**问题 ——
  模型会为 4 色图返回 6 色，`颜色 ∈ palette` 校验因此变松；
  需要考虑反向校验（用真实像素直方图核对 palette）。
- **票 14**（三层降级）：降级必须**按模态分别做** ——
  视觉路径和文本路径可能独立失败（一个通、一个不通），
  原来的「整 run 降级 vs 逐调用降级」二分不够用了。
- **票 15**（StyleSpec fixture）：明确走 `/v1/messages` + 纯文本 JSON，
  `max_tokens ≥ 3000`，并记录色板补全现象。

### 新建的票

- **19. 一次完整 run 的时间账本与缓存策略** —— 由发现 B 直接催生。


---

## 2026-09-24 事实修订（主 session 实测）

⚠️ **本票 Answer 里的视觉路径结论已经失效，其余仍然有效。**

- ❌ **「`/v1/messages` 实为 qwen3.8-max，是唯一能收图的路」—— 现在这条路打不通了。**
  CC Switch 请求日志（`~/.cc-switch/cc-switch.db` 的 `proxy_request_logs`）显示：
  千问 Token Plan provider（`bcd60069`）最后一次成功是 **2026-09-24 01:36:33 UTC**，
  之后 22 次 `429 Throttling.AllocationQuota`；代理**已故障转移到 DeepSeek**
  （`331fbb23`，7856 次 200，仍在服务）。
  实测：往 `/v1/messages` 发图片块仍返回 200，但 `model` 是 `deepseek-flash`
  且它**看不到图**（对一张 1×1 图编出「light pink / salmon」）。
- ⚠️ **`/v1/models` 现在返回空列表 `[]`**（本票当时它列出了 deepseek 模型）——
  代理的上游配置会变，**任何探测结论都要带时间戳**。
- ✅ **文本路径的行为与延迟结论全部仍然有效**（纯文本 JSON 9/9、
  `thinking: disabled` 后 9s、鉴权不校验、`tool_choice` 不可靠）。
- ✅ **位图生图配方本身仍然有效**（端点、base64 参考图、7.8s/张），
  但**当前跑不通也不合规** —— 见[票 34](34-wan-quota-facts.md) 与[票 35](35-bitmap-provenance.md)。
- 📌 **教训**：本票把「哪个上游」当成了一个稳定事实记下来。
  它其实是**配置**，会变。后续所有票引用环境事实时都应注明观测时间。
