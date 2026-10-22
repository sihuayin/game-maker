# 01 根因证据：大 schema 丢数据 vs provider 映射

Effort: text-upstream-v1 · Ticket: [../issues/01-root-cause-evidence.md](../issues/01-root-cause-evidence.md)
Owner: research subagent · 2026-10-22 · 纯读仓库 + 既有日志，零付费、零上游调用。

## 一句话结论

`plan-assets` 的 `empty-input` 根因**不是「`emit_asset_recipe` schema 太大、模型填不动」**，
而是**上游/代理侧把 `tool_use.input` 丢了**（`empty-input`），外加**provider 映射把
`deepseek-v4-pro` 降级成 `deepseek-flash`**（模型弱，偶尔产出「有入参但不过契约」的 `schema` 失败）。
两者都指向 **provider / 转译层**，不指向「我们自己的 schema 需要缩小」。
**证据权重：provider/转译数据丢失 > 映射导致的弱模型 > 「schema 太大」**（最后一条基本被推翻）。

---

## 1. `emit_asset_recipe` schema 与描述的实际规模（本地量到，非日志）

来源：`packages/contracts/src/recipe-tool.ts`（`RecipeToolSchema`，v4 镜像）→
`toolInputSchema()`（`packages/contracts/src/structured-call.ts:216-231`：
`toJSONSchema(schema, { io: "input" })` 后去掉顶层 `$schema`）。

| 量 | 值 |
|---|---|
| `toolInputSchema` 字节（紧凑 JSON.stringify，去 `$schema` 后） | **10,447 B**（≈2.6k token 量级） |
| 同上 pretty-print（2 空格） | 31,686 B |
| 顶层 JSON-Schema 键 | 4：`type` / `properties` / `required` / `additionalProperties` |
| 配方顶层字段（`properties` 的键） | **7**：`format` / `id` / `styleRef` / `referenceImage` / `characterRef` / `assets` / `authoring` |
| `required` | `["format","id","styleRef","assets"]` |
| `additionalProperties` | `false` |
| 最大嵌套深度（对象/数组） | **15** 层 |
| 全树 `properties` 键合计 | **149** 个 |
| `PLAN_TOOL_DESCRIPTION`（`packages/assets/src/prompt.ts:802-843`） | **1,766 字符**（3,352 B UTF-8） |

完整 `plan-assets` 请求体（用 2026-10-22 失败现场的 `game-design.json` + `visual-world.json`
重建 `assetPlanPrompt`，与 `ops.ts:332-346` 同构）：

| 段 | 字节 | 估算 token（÷4） |
|---|---|---|
| prompt 正文（`assetPlanPrompt`） | 6,534 字符 | ≈1.6k |
| 工具 schema（`input_schema`） | 10,447 | ≈2.6k |
| 工具 description | 1,766 字符 | ≈0.84k |
| **完整请求体** | **19,350 B** | ≈4.8k（naive）；DeepSeek 代理记 **≈7,237**（见 §3） |

**判定「大到会截断/丢输入」吗？** 不会以「超出 API 上限」的方式：
- 19 KB 请求体 / ~7k 输入 token、`max_tokens=16_000` 输出，都在正常范围内；
- 模型**证明过它能填这个 schema**（票 59 第 4 发：7 键、6,808 字符、20 个 assets 完整回来，见 §2）。
⇒ 「schema 大到模型填不动」**被推翻**；它不是「大」到问题的那一档。

⚠️ **一条别被带偏的账**：票 59 的 `probe.log` 写「工具 schema **152,095 字符**」——
那是 `JSON.stringify(RecipeToolSchema)`（把 zod v4 的**内部对象**序列化），**不是**真正上线的
`input_schema`。真正发给上游的 `input_schema` 是 `toJSONSchema` 的输出 = **10,447 B**。
同一张票里又写了「`toolInputSchema(RecipeToolSchema)` = 9828 字符」——那是 2026-10-13 的旧值；
今天 schema 已长到 10,447 B（P0 期间加了字段），description 从票 59 记的 1,038 字符长到 1,766。

---

## 2. 「票 27」悬空引用定位

**证据源头（找到了，不是悬空）：**

- 票：`.scratch/game-maker-v2/issues/27-json-via-tool-choice.md`（`game-maker-v2` effort，Type: grilling，
  Status: resolved，2026-10-01，Owner: amber）。
- 探针：`.scratch/game-maker-v2/experiments/tool-choice-probe/README.md` + `raw/01-tool-choice-r1.json`。

**原文（`raw/01-tool-choice-r1.json`）：**

```json
{
  "label": "01-tool-choice-r1",
  "status": 200, "stopReason": "tool_use",
  "blockTypes": ["tool_use"],
  "requestedModel": "deepseek-v4-pro",
  "servedModel": "deepseek-flash",
  "usage": { "input_tokens": 1463, "output_tokens": 1135 },
  "toolUse": [{ "name": "emit_visual_world", "input": {} }]
}
```

票 27 Answer（第 71–84 行）的解读逐字：「上游烧了 1135 个输出 token，回来的 `input` 是空的。
它**不是**『模型不听话』（那样不会有 `tool_use` 块），也**不是**『模型吐了坏 JSON』（那样
`input` 不会是合法对象）。它是**代理把工具入参丢了**——一种**静默的数据丢失**。」

**它证明的是哪一条？** 三条关键事实：

1. **它打的不是 `emit_asset_recipe`，是 `emit_visual_world`**（`VisualWorldSpec`，**14 个顶层键**，
   整个请求才 **1,463 输入 token**）。⇒ 那次 `empty-input` 发生在一个**小 schema / 小请求**上。
2. 结论是**「入参在代理/上游这一环丢了」**，且 `stop_reason` / 块类型 / HTTP 码三项全部正常。
3. 它是 `empty-input` 这个 failure 桶的**出处**（`structured-call.ts:64` 注释：`empty-input` =
   「上游把入参丢了（票 27 第 1 发）」）。

**对本票的意义（重要）**：p0-final-v1 里那句「票 27 第 1 发实测：上游烧了 1135 输出 token、入参没了」
引用是**签名正确、场景不符**——它证明「入参会丢」这种**数据丢失**存在，但那次丢在
**1,463 token 的小 schema**上，所以它**不能**用来证明「大 schema 丢数据」。恰恰相反：
空输入在**小** schema 上也会发生 ⇒ 「schema 太大」不是丢入参的必要条件。

---

## 3. 失败签名区分：`empty-input` 与 `schema` 各自指向什么

分类器：`packages/contracts/src/structured-call.ts` 的 `parseToolUse`（`CALL_FAILURES` 闭集，line 58–66）：

| 档 | 判据（代码） | 指向的根因 |
|---|---|---|
| `empty-input` | `tool_use` 块**在**，但 `input` 是 `{}`/`null`/串/数组（非空对象都不算） | **入参在转译/传输层丢了**（票 27 定义：「上游把入参丢了」） |
| `schema` | `input` 是**非空对象**，但 `safeParse` 不过契约（或过 v4 形状、不过 v3 `parseRecipe`） | **模型质量问题**（弱模型产出近似的、但不过契约的清单） |

### 3a. 2026-10-22 现场（`.scratch/p0-final-v1/runs/2026-10-22-real/`）

| 现场 | step | failures | model | usage | 解读 |
|---|---|---|---|---|---|
| `stage-a.json`（create） | plan-assets | **empty-input ×3** | deepseek-flash | 217 in / 2,461 out | 三发全丢入参 |
| `plan-probe/plan.json`（plan-only） | plan-assets | **empty-input / schema / empty-input** | deepseek-flash | 217 in / 2,753 out | 第 2 发**入参回来了**、但不过契约 |
| `probe-tool-call.json`（小 schema 探针） | — | `ok:true`，`tool_input:{ok:true}` | deepseek-flash | 291 in / 33 out | **小 schema 能过** |

`probe-tool-call.mjs`（`.scratch/p0-final-v1/probe-tool-call.mjs`）用的是**一个 boolean 字段**的
小 schema（`emit_probe`），同一条 `tool_choice:{type:"tool"}` 路径 ⇒ 在 deepseek-flash 上**成功**。

⇒ 关键对证：**同一个 provider（deepseek-flash）、同一条强制工具调用路径**，小 schema 成功、
大 `emit_asset_recipe` schema 大多失败。但失败**不是**「模型不会工具调用」——
`plan-probe` 的第 2 发和票 59 的第 4 发都证明**模型能产出完整的 recipe 入参**。

### 3b. 决定性证据：票 59 的定向探针（2026-10-13）

`.scratch/game-maker-v2/issues/59-plan-assets-empty-input.md` + `experiments/59-plan-assets-probe/`
（n=4，一发一记，输入 = 已落盘的第九跑 design+world，同一份请求体连打）：

| 发 | outcome | output tokens | 入参 |
|---|---|---|---|
| 1 | empty-input | **4,430** | `{}`（2 字符） |
| 2 | empty-input | **3,198** | `{}` |
| 3 | empty-input | **3,512** | `{}` |
| 4 | schema | 3,319 | **对象 · 7 键 · 6,808 字符 · 20 assets**（不过契约：母版/资产宽高比不一致） |

票 59 的解读（Answer §三，逐字）：「一个 `{}` 不可能值三千多个输出 token，而第 4 发**同量级**
的 token 换回了 6808 字符的入参 ⇒ 证据指向『**模型写了相当体量的东西，而它没以入参的形式到达
客户端**』，即**丢失点在「模型生成之后」**，不在「模型不肯写」那一侧。」并明确指出响应 `id` 形状
（`call_00_…`）+ `model=deepseek-flash` 而上游是 OpenAI 形状模型接在 cc-switch 后面
⇒ 「中间**确实存在一层格式转译**，它是入参丢失的**合理嫌疑人**」。

⇒ 这**同时**回答了本票的两问：
- `empty-input`（入参空/丢失）→ **转译/传输层丢数据**（provider 侧），不是模型不写、也不是 schema 太大；
- `schema`（入参有、不过契约）→ **弱模型**（deepseek-flash，而非请求的 v4-pro）的**普通质量**问题。

---

## 4. 结论：倾向哪一边 + 证据权重

### 两问的量到的因果链

1. **`empty-input`（数据丢失）≠ schema 太大。**
   - 丢入参在**小 schema**上就发生过（票 27：`VisualWorldSpec` 14 键、1,463 token）；
   - 丢的时候模型**已经写了东西**（票 59：3,198–4,430 输出 token 换回一个 `{}`）；
   - 入参**不丢**时模型能填满大 schema（票 59 第 4 发 6,808 字符 / 2026-10-22 plan-probe 第 2 发）。
   ⇒ 丢入参是**上游转译层**的行为，schema 尺寸最多是**触发器/放大器**，不是根因。

2. **`schema`（不过契约）→ 弱模型 = provider 映射没生效。**
   - 请求 `deepseek-v4-pro`、回报 `deepseek-flash`（票 27 / 59 / 2026-10-22 全部命中，
     cc-switch 切换未在代理侧生效，见 `p0-final-v1/issues/05-fix-text-upstream.md`）；
   - flash 的失败是「20 个 assets 写出来了、只是母版宽高比没对上」——**能力/质量**问题，
     不是「读不懂大 schema」。

3. **小 schema 探针能过 ≠ provider 没问题**：`probe-tool-call.mjs` 的成功只证明
   「flash 会强制工具调用」，**没有**排除「大 tool 输出会被转译层丢」——
   而票 59 的量到正是后者。

### 权重表

| 假说 | 证据 | 权重 |
|---|---|---|
| **provider/转译层丢数据**（`empty-input` 的根因） | 票 59 输出 token 对账（丢的是「已生成的内容」）；票 27 小 schema 同签；响应 `id`/`model` 形状指向一层转译 | **高**（E2 实测 + 上游自身 usage 账） |
| **provider 映射没生效 → 弱模型**（`schema` 的根因） | 请求 v4-pro / 回报 flash 全命中；`schema` 失败是普通质量差（比率不对） | **高**（E1/E3 直读） |
| **schema 太大、模型填不动 / 被截断** | 10.4 KB schema、7.2k token 请求「偏大」；大 schema 失败率高于小 schema | **低**（模型已证明能填满；无截断证据：`stop_reason=tool_use` 从不撞 `max_tokens`） |

### 结论

**倾向「provider 映射 / 上游转译」这一侧，不倾向「schema 太大」。** 更准确的说法是**两个签名、
两个根因，都不在仓库侧**：

- `empty-input` = **上游转译层丢 `tool_use.input`**（数据丢失）；
- `schema` = **provider 映射把 v4-pro 降成 flash**（模型弱，质量不过契约）。

⇒ **不建议**据此开「最小仓库侧修法（缩小 `emit_asset_recipe` schema）」票作为首选——
证据不支持「我们的 schema 太大」是根因；首选是**切 provider**（本图 Q3 已定的 MiniMax-M2.7 →
qwen3.8-max → v4-pro/relay），这正是把「丢数据的转译层」与「弱模型」一起换掉的动作。
只有在**多个 provider 上大 schema 都稳定失败、而缩小 schema 后成功**，才需要回到「缩小 schema」。

### 证据路径速查

- schema 源：`packages/contracts/src/recipe-tool.ts`；`toolInputSchema`：`packages/contracts/src/structured-call.ts:216-231`
- 失败分类：`packages/contracts/src/structured-call.ts:58-66`（`CALL_FAILURES`）与 `:162-167`（`empty-input`）
- 调用点：`packages/assets/src/ops.ts:332-346`（`planAssets`）
- 描述：`packages/assets/src/prompt.ts:802-843`（`PLAN_TOOL_DESCRIPTION`）
- 票 27（1135 token 出处）：`.scratch/game-maker-v2/issues/27-json-via-tool-choice.md`；
  探针 `.scratch/game-maker-v2/experiments/tool-choice-probe/README.md` + `raw/01-tool-choice-r1.json`
- 票 59（决定性对账）：`.scratch/game-maker-v2/issues/59-plan-assets-empty-input.md`；
  探针 `.scratch/game-maker-v2/experiments/59-plan-assets-probe/`（`report.json` / `probe.log` / `probe.mjs` / `raw/shot-1..4.json`）
- 2026-10-22 现场：`.scratch/p0-final-v1/runs/2026-10-22-real/`
  （`stage-a.json` · `plan-probe/plan.json` · `probe-tool-call.json` · `.failed-*/`）
- 诊断与处置：`.scratch/p0-final-v1/issues/02-stage-a-understanding.md` · `05-fix-text-upstream.md`
- 探针脚本：`.scratch/p0-final-v1/probe-tool-call.mjs`

（本地测量脚本：`/tmp/measure-recipe-schema.mjs` / `/tmp/measure-request.mjs` / `/tmp/measure-detail.mjs`，
仅作复核，不入库。）
