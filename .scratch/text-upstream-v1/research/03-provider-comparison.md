# 03 候选 provider 的工具调用能力与单价（Anthropic 兼容端点）

Effort: text-upstream-v1 · Ticket: [../issues/03-provider-comparison.md](../issues/03-provider-comparison.md)
Owner: research subagent · 2026-10-22 · 零付费、零上游调用（只 WebSearch/WebFetch + curl 公开文档与价格页）。

记号：**【文档】** = 官方文档 / 官方价格页原文；**【估算】** = 由官方价格推导或第三方快照、非官方逐项报价；**【仓库】** = 本仓库既有零付费/历史事实；**【未验证】** = 官方一手资料没有明确说法，本文不猜测。

> 本笔记只查「Anthropic 兼容端点（cc-switch `appType=claude`）上的候选事实」，供 Q3 回退顺序
> 与成本记账用。**不预授权任何付费调用**；是否切换、预算多少，另票、另出书面预算并逐字点头。

---

## 0. 一句话结论

Q3 原定「MiniMax-M2.7 → qwen3.8-max → v4-pro / relay」需要**两处修正**：

1. **MiniMax 档的模型名该换成 `MiniMax-M3.1-Flash`（或 `MiniMax-M3`），不是 M2.7。**
   MiniMax 官方明确：Anthropic 兼容端点**只支持 M3.1-Flash 与 M3**；M2.x 走「标准（OpenAI 兼容）接口」。
   而且 **M2.7 正在退市** —— 2026-10-19 起不对新用户开放、2026-11-18 下线，官方模型列表已把
   `MiniMax-M2.7` 标为 **Retired**（今天 2026-10-22，已过新用户截止日）。
   M Plan / Token Plan 下 M2.7 的请求还会被**自动路由到 M3.1 Flash**。
2. **「大 schema 工具调用最稳」排序建议**（按官方文档可查的强制工具调用支持 + 输出余量 + 是否一手端点）：

   **`deepseek-v4-pro` ≥ `qwen3.8-max` > `MiniMax-M3.1-Flash` > Claude relay（IKunCode）**。

   理由：DeepSeek 官方 Anthropic 端点 `tool_choice` 的 `tool` 档**明确 Supported**、`input_schema` 全支持、
   max output 384K（四家里余量最大）、一手端点；qwen3.8-max 同为一手端点、`{"type":"tool","name":…}` 明确支持、
   1M 上下文、但输出单价最高；MiniMax M3.1-Flash 支持 `tool_choice` 且最便宜，但输出余量与长期行为
   需票 05 探针确认；relay 是真实 Claude（工具调用本身最强），但是**第三方中转**，稳定性/429/记账三处都差，
   只作成本兜底。

> 注意：这是**文档层面**的排序。本仓库教训（game-creation-v1/01）——「哪个上游」是配置、会变，
> 且大 schema `tool_use.input` 丢失发生在**转译层**，不写在公开文档里。最终以票 05 探针实测为准。

---

## 1. Provider 对照表（主交付物）

价格均为 **USD / 1M tokens**（官方 list price，除非注明）。「强制工具调用」指
`tool_choice` 强制指定/强制任意工具 + 输出 `tool_use` 块在 Anthropic 兼容端点上是否被支持。

| 候选 | Anthropic 兼容端点（base URL → messages 路径） | 要填的模型名 | 强制工具调用 `tool_choice` | 大 schema 风险 / 上下文·输出余量 | 输入 / 输出单价 |
| --- | --- | --- | --- | --- | --- |
| **MiniMax（官方 Anthropic 端点）** | `https://api.minimax.io/anthropic` → `/anthropic/v1/messages`（国内域名 `https://api.minimaxi.com/anthropic`） | **`MiniMax-M3.1-Flash` / `MiniMax-M3`**（M2.7 **不在** Anthropic 端点支持列表；见 §2） | ✅ **`tool_choice` Fully supported**（工具选择策略）；`tools` 定义 Fully supported；`tool_use`/`tool_result` 块 Fully supported【文档】 | 上下文 1M；`max_tokens` 必填、thinking token 计入（给小了会 `stop_reason:max_tokens` 无正文）；无公开的 schema 尺寸上限【未验证】 | M3.1-Flash **$0.15 / $0.60**（缓存读 $0.015）；M3 标准 **$0.30 / $1.20**（≤512k，永久五折；缓存读 $0.06） |
| **qwen3.8-max（阿里云 Model Studio / 千问 Token Plan）** | Model Studio：`https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/apps/anthropic/v1/messages`（legacy `https://dashscope.aliyuncs.com/apps/anthropic/v1/messages`）；千问 Token Plan：`https://maas.qianwenaiapi.com/apps/anthropic/v1/messages` | **`qwen3.8-max`**（别名档 `qwen3.8-max-0902`） | ✅ **`{"type":"auto"\|"any"\|"none"\|"tool","name":…}`** 全支持（`"tool"` 档=强制指定工具）【文档】 | 上下文 1M、max output **131,072**、CoT 上限 262,144；`input_schema` 必填；无公开 schema 尺寸上限【未验证】 | 北京/全球 **$1.65 / $4.951**（缓存读 $0.206）；新加坡/美区 **$2.00 / $6.00**（缓存读 $0.25） |
| **deepseek-v4-pro** | `https://api.deepseek.com/anthropic` → `/anthropic/v1/messages` | **`deepseek-v4-pro`**（`claude-opus*` 会自动映射到它） | ✅ **`tool_choice` 的 `none`/`auto`/`any`/`tool` 全 Supported**（`disable_parallel_tool_use` 被忽略）；`tools.name/input_schema/description` Fully supported【文档】 | 上下文 1M、max output **384K**（余量最大）；**Vision 不支持**（文本工具调用无影响）；无公开 schema 尺寸上限【未验证】 | 输入（cache-miss）**$0.66** 峰外 / $1.32 峰时；缓存命中 $0.022 / $0.044；输出 **$1.98** / $3.96 |
| **Claude relay（IKunCode `api.ikuncode.cc`）** | `https://api.ikuncode.cc`（Claude Code 追加 `/v1/messages`；Anthropic Messages 格式） | 真实 Claude 名：**`claude-opus-4-6` / `claude-opus-4-7`（1M）· `claude-sonnet-4-6`（200K）· `claude-haiku-4-5-20251001`** | ✅ 中转真 Claude，`tool_choice`/`tool_use` 原生透传（**推定**，无公开 schema 说明【未验证】） | 上下文 1M（opus 档）；第三方中转，**通道稳定性/风险控制 429** 是主要风险（官方自己标注部分通道「less stable / risk controls may produce 429s」）【文档】 | 无固定单价：**乘数计费**，充值 1 CNY = 1 USD 额度；Claude Code-Stable 组乘数 **2.2–2.3×**、cc-reverse 0.45–0.5×、cc-kiro 0.7–0.8×（即实付 ≈ Claude 官价 × 乘数，人民币） |

> 「大 schema 风险」列：公开文档**没有**任何一家给出「工具入参 schema 的字节/字段上限」或「截断阈值」。
> 本仓库实测的大 schema `tool_use.input` 丢失（empty-input）发生在**转译层**，见 §5 与票 01 笔记。

---

## 2. MiniMax：M2.7 不能按原计划用，换 M3.1-Flash / M3

**【文档】官方事实（MiniMax 开放平台文档，`platform.minimax.io`）：**

- Anthropic 兼容端点（`https://api.minimax.io/anthropic/v1/messages`）的「Supported Models」表**只有
  `MiniMax-M3.1-Flash` 与 `MiniMax-M3`**；页面两处重申：
  > "The Anthropic API compatibility interface currently only supports the MiniMax-M3.1-Flash and MiniMax-M3 models.
  > For other models, please use the standard MiniMax API interface."
- 兼容参数表里对 M2 系列只写了消息块支持说明（「M2.7/M2.5/M2.1/M2 只支持 text 与 tool-call 块，不支持图像/视频输入」），
  但**支持模型清单与重要说明都不含 M2.x**。M2.7 的官方自托管页（`local-deploy-m2-7.md`）明确
  「通过 **OpenAI 兼容端点**验证推理/推理/工具调用」——即 **M2.7 的标准接口是 OpenAI 兼容，不是 Anthropic 兼容**。
- **退市**（`faq/models.md`）：M2.5/M2.7 家族 **2026-10-19 起不对新用户开放、2026-11-18 下线**；
  M Plan / Token Plan 用户 2026-10-19 起请求 M2.5/M2.7 **自动路由到 M3.1 Flash**（旧模型名向后兼容）。
  官方 Model List 的 Retired Models 表已把 `MiniMax-M2.7` 列为 **Retired**。
- M2.7 定价已不在官方价格页（只列 M3.1-Flash / M3）。第三方快照（hermes-agent `official_docs_snapshot` 2026-04、
  aimodelapis/empiriolabs）一致记 **$0.30 输入 / $1.20 输出**（缓存读 $0.06）——【估算】。

**对票 02/04 的含义**：票 02 笔记里 MiniMax 卡端点 `https://api.minimaxi.com/anthropic`、模型
`MiniMax-M2.7` 的写法**与官方支持清单冲突**（M2.7 不在 Anthropic 端点、且已退市）。建议票 04 切 MiniMax 时
把模型名改成 **`MiniMax-M3.1-Flash`**（更便宜 $0.15/$0.60、1M 上下文、官方 Anthropic 端点明确支持），
或退而用 `MiniMax-M3`。若坚持 M2.7 名字，也可能被 M Plan 路由到 M3.1 Flash——最终由票 05 探针的响应 `model`
字段确认真实上游。

---

## 3. qwen3.8-max：两个 Anthropic 兼容入口，模型名一致

**【文档】官方事实：**

- **阿里云 Model Studio（maas）**（`help.aliyun.com/en/model-studio/anthropic-api-messages`）：
  - 端点：`https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/apps/anthropic/v1/messages`（北京）；
    `{WorkspaceId}.ap-southeast-1…`（新加坡）、`{WorkspaceId}.us-east-1…`（美）、`{WorkspaceId}.eu-central-1…`（德）、
    `{WorkspaceId}.ap-northeast-1…`（日）。legacy 域名 `dashscope.aliyuncs.com`（北京）/ `dashscope-intl.aliyuncs.com`（新加坡）。
  - 鉴权：`x-api-key` 或 `Authorization: Bearer`。
  - 模型名：`qwen3.8-max`（Qwen-Max 档，另有 `qwen3.8-max-0902`）。
  - `tool_choice`：`{"type":"auto"}` 默认 / `{"type":"any"}` 强制任一工具 / `{"type":"none"}` 禁工具 /
    `{"type":"tool","name":"tool_name"}` 强制指定工具。`tools` 的 `input_schema` 必填。
- **千问AI平台 Token Plan**（`platform.qianwenai.com/docs/api-reference/chat/anthropic`，即仓库里
  cc-switch 的「千问 Token Plan」`bcd60069` 那路）：
  - 端点：`https://maas.qianwenaiapi.com/apps/anthropic/v1/messages`；模型名同样 **`qwen3.8-max`**。
  - FAQ：该兼容端点**只提供 `/v1/messages`、不提供 `/v1/models`**（模型发现会 404，需手动填模型名）。
- 模型能力（`qwen3.8-max` 模型页）：Function Calling **Supported**；输入模态 image/text/video、输出 text；
  上下文 1M、max output 131,072、max CoT 262,144；2.4T 参数 MoE 旗舰。
- 单价（模型页，USD/1M）：北京/全球 **$1.65 输入 / $4.951 输出**（隐式缓存读 $0.206、显式缓存建 $2.063/读 $0.137）；
  新加坡/美区 **$2.00 / $6.00**（缓存读 $0.25）。Token Plan 为订阅制套餐，**套餐费≠按 token 单价**，未查到公开逐 token 价【未验证】。

---

## 4. deepseek-v4-pro：一手 Anthropic 端点、强制工具调用最「明确」

**【文档】官方事实（`api-docs.deepseek.com`）：**

- 端点：`https://api.deepseek.com/anthropic` → `/anthropic/v1/messages`；模型名 **`deepseek-v4-pro`**（`deepseek-flash` 为另一档）。
- 模型名映射：`claude-opus*` → `deepseek-v4-pro`、`claude-haiku/sonnet*` → `deepseek-flash`；其它非 `claude` 名返回 400。
- `tool_choice` 兼容表：`none` Fully Supported；`auto` / `any` / **`tool` 均 Supported**（`disable_parallel_tool_use` 被忽略）。
- `tools`：`name` / `input_schema` / `description` **Fully Supported**；`cache_control` Ignored。
- 特征（价格页）：Tool Calls ✓、Anthropic API ✓、JSON Output ✓、Responses API ✓；**Vision 不支持**。
- 上下文 1M、max output **384K**。
- 单价（USD/1M，峰时/峰外）：输入 cache-miss **$1.32 峰时 / $0.66 峰外**、cache-hit $0.044/$0.022、
  输出 **$3.96 / $1.98**。峰时 = 周一至五 01:00–04:00 与 06:00–10:00 UTC（节假日除外）；峰外 = 峰时一半。

**与仓库现状的关系**：当前 cc-switch 的 Claude provider 就是 DeepSeek（票 02：`currentProviderClaude=331fbb23-…`），
端点 `https://api.deepseek.com/anthropic/...`。即 **deepseek-v4-pro 已经是一手 Anthropic 端点、且强制工具调用在
文档里是四家里写得最全的**；问题不在「v4-pro 支不支持」，而在 cc-switch 把 `claude-opus-5`→v4-pro 的映射没生效、
落到了 `deepseek-flash` 兜底（票 01/02 已定）。

---

## 5. Claude relay（IKunCode `api.ikuncode.cc`）：真 Claude，但记账与稳定都打折

**【文档】官方事实（`docs.ikuncode.cc`）：**

- 定位：面向 Claude Code / CodeX 的 **API relay（中转）**；端点 `https://api.ikuncode.cc`（Claude Code 填
  base URL，客户端自动追加 `/v1/messages`）。
- 模型：真实 Claude 模型名 —— `claude-opus-4-6` / `claude-opus-4-7`（1M）、`claude-sonnet-4-6`（200K）、
  `claude-haiku-4-5-20251001`。
- 计费：**乘数制**，充值 1 CNY = 1 USD 额度；不同通道（group）不同乘数：Claude Code-Stable 2.3/2.25/2.2（C1/C2/C3）、
  cc-reverse 0.5/0.45/0.45、cc-reverse2 1.4/1.35/1.3、cc-reverse3 1.35/1.3/1.25、cc-wf 0.7/0.65/0.6、
  cc-antigravity 0.7/0.65/0.6、cc-kiro 0.8/0.75/0.7。实付 ≈ Claude 官价 × 乘数（人民币）。**不是固定逐 token 价**。
- 官方自述风险：cc-reverse/cc-reverse2「less stable / risk controls may produce 429s」；cc-antigravity/Gemini
  「weak caching」；Claude Code-Stable 组「仅限 Claude Code CLI / 官方 VS Code 插件」。→ 通道是配置、会变。
- 工具调用：它是真 Claude 的透传，`tool_choice`/`tool_use` 能力与 Claude 一致（**推定**；官方无逐字段兼容表【未验证】）。

**对本图的意义**：relay 是唯一「真 Claude」候选（工具调用本身最强），但 (a) 第三方中转有 429/不稳定风险、
(b) 乘数计费不便于按 token 记账、(c) 模型/通道随时变。按本图「按实际消费记账」纪律，它应作**最后兜底**，
且须在账上单列 provider + 通道 + 乘数。

---

## 6. 大 schema 工具调用的排序依据（佐证 / 修正 Q3）

按「强制工具调用 + 大 schema 入参」最稳排序的**可查证据**：

| 排序 | 候选 | 强制工具调用（文档） | 输出余量 | 端点性质 | 大 schema 已知风险 |
| --- | --- | --- | --- | --- | --- |
| 1 | `deepseek-v4-pro` | `tool_choice:"tool"` 明确 Supported；`input_schema` 全支持 | 384K | 一手 | 仅「Vision 不支持」；转译丢输入来自 cc-switch，非官方端点 |
| 2 | `qwen3.8-max` | `{"type":"tool","name":…}` 明确支持 | 131K | 一手 | 输出单价最高；【仓库】旧 Anthropic 路由（qwen）曾现大 schema tool-use 截断 |
| 3 | `MiniMax-M3.1-Flash` | `tool_choice` Fully supported | 未给明数（1M 上下文内） | 一手 | 较新；长期行为未验证；**M2.7 已排除**（退市 + 不在 Anthropic 端点） |
| 4 | Claude relay（IKunCode） | 真 Claude 原生（推定） | 1M 上下文 | 三方中转 | 429/不稳定、乘数记账、通道会变 |

**修正要点（供 Q3 记账与回退用）：**

1. Q3 的「MiniMax-M2.7」应读作「**MiniMax M 系，经 Anthropic 端点**」→ 落地为 `MiniMax-M3.1-Flash`
   （便宜、明确支持、不退市）；`MiniMax-M3` 为同端点次选。M2.7 名字不填、退市且新用户不可用。
2. 若「最稳」优先于「最便宜」：**deepseek-v4-pro 应是第一档**（文档上强制工具调用最明确 + 384K 余量），
   而且它已在当前 DeepSeek 卡上，只是 cc-switch 映射没生效（票 02/04 修开关即可，不用换 key）。
3. 若「最便宜」优先：MiniMax-M3.1-Flash $0.15/$0.60 是四家里最低，且支持强制工具调用。
4. relay 无论按「稳」还是「便宜记账」都应**最后**（唯一优势是真 Claude，但稳定性/记账双差）。

**结论**：推荐回退顺序 **`deepseek-v4-pro` → `qwen3.8-max` → `MiniMax-M3.1-Flash` → Claude relay**；
若维持「MiniMax 第一」的 Q3 原意，则至少把模型名从 M2.7 换成 **M3.1-Flash**。最终以票 05 探针为准。

---

## 7. 来源

- DeepSeek 价格页（`deepseek-v4-pro` / `deepseek-flash` 单价、1M 上下文、384K 输出、Vision 不支持）：
  https://api-docs.deepseek.com/quick_start/pricing/
- DeepSeek Anthropic API 指南（`/anthropic` 端点、claude→deepseek 映射、`tool_choice` 兼容表）：
  https://api-docs.deepseek.com/guides/anthropic_api
- MiniMax Anthropic SDK（`/anthropic/v1/messages`、Supported Models 仅 M3.1-Flash/M3、`tool_choice` Fully supported）：
  https://platform.minimax.io/docs/api-reference/text-anthropic-api
- MiniMax Model List（M2.5/M2.7 退市时间表、M2.7 已 Retired）：
  https://platform.minimax.io/docs/faq/models
- MiniMax Pricing Overview（M3.1-Flash $0.15/$0.60、M3 $0.30/$1.20）：
  https://platform.minimax.io/docs/pricing/overview
- MiniMax M2.7 自托管（OpenAI 兼容端点验证工具调用）：
  https://platform.minimax.io/docs/guides/local-deploy-m2-7
- MiniMax M2.7 单价（第三方快照，官方已下架 M2.7 定价）：
  https://github.com/NousResearch/hermes-agent/pull/17423/files · https://aimodelapis.com/providers/minimax/minimax-minimax-m2-7
- 阿里云 Model Studio Anthropic 兼容 Messages（端点、`qwen3.8-max`、`tool_choice` 四档）：
  https://help.aliyun.com/en/model-studio/anthropic-api-messages
- 阿里云 Model Studio `qwen3.8-max` 模型页（1M 上下文、131K 输出、Function Calling、单价 $1.65/$4.951 与 $2/$6）：
  https://www.alibabacloud.com/help/en/model-studio/qwen3-8-max
- 千问AI平台 Token Plan Anthropic Messages API 参考（`maas.qianwenaiapi.com/apps/anthropic`、`qwen3.8-max`、无 `/v1/models`）：
  https://platform.qianwenai.com/docs/api-reference/chat/anthropic
- IKunCode 定价（乘数、通道、Claude 模型清单）：
  https://docs.ikuncode.cc/intro/pricing
- IKunCode Claude Code 部署指南（`https://api.ikuncode.cc`）：
  https://docs.ikuncode.cc/deploy/claude-code
- 仓库既有事实（cc-switch 机制、大 schema 丢输入证据）：
  ../research/01-root-cause-evidence.md · ../research/02-cc-switch-mechanism.md ·
  ../../game-creation-v1/issues/01-proxy-api-contract.md

## 8. 未验证项汇总（不猜测）

- 各家「工具入参 schema」的**字节/字段上限或截断阈值**：官方均无公开数字。
- 千问 Token Plan 的**订阅套餐价**（非逐 token 单价）。
- MiniMax M3.1-Flash 在 Anthropic 端点上的**最大输出 token 上限**（页面只写 1M 上下文、`max_tokens` 必填）。
- relay 的 `tool_choice`/`tool_use` **逐字段兼容性**（官方无兼容表）。
- 上述一切「哪个上游/模型名真被接受」——按仓库教训，须由票 05 探针带时间戳实测。
