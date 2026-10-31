# 14 · 候选付费筛查 —— 预算报告（待逐字点头）

> **本报告不授权任何调用。** 只有人在对话里逐字批准后，才允许启动筛查脚本。
> 当前 **0 次付费调用**；本研究阶段的付费日志仍只有 09 的 2 发。

## 结论先说

- 短名单（[13](../../research/alternative-animation-models-2026-10-21.md)）：**Gemini 3 Pro**（Interactions/JPEG，
  现有 key + 7890）与 **OpenAI gpt-image-2.5**（PNG，接入路径需人裁）。
- 筛查样本：`scavenger-actor.idle1/idle2`，同一组提示词 / 参考图；2 帧 / 候选；≤$0.50 / 候选。
- 候选 A：2 × $0.134 输出 + 输入 ≈ **$0.28**；≤3 发 ≈ **≤$0.42**；上限 **≤$0.50**。
- 候选 B2（官方 medium）：输出 ≈ $0.026 + 未验证参考图输入 ≈ $0.04–0.14 ⇒ **≈$0.07–0.17**；
  ≤4 发、≤$0.50。B1（现有中转）计价未知；若计价不明，**不保证 ≤$0.50**。
- 总上限：A + B ≤ **$1.00**；只筛 A ≤ **$0.50**。
- 本轮不发起任何调用；先选接入路径 + 逐字点头。

## 候选 A：`gemini-3-pro-image` · Interactions · JPEG

- 接入：现有顶层 `image` 的 Gemini key；proxy **7890**（文件里的 9098 未监听，本次显式覆盖）。
- 模型：`gemini-3-pro-image`；`api: "interactions"`；输出请求 `image/jpeg`；1K；3:4。
- 08 已落地 `decodeJPEG` + MIME 分派；**不需要新施工**。
- 2 帧：`scavenger-actor.idle1/idle2`；提示词 / 参考图逐字取 v7：
  `reference.png` + `reuse/master-scavenger-actor.png`。
- 发送上限：**≤3 发**（2 帧 + 1 次重试）；输出上界 3 × $0.134 + 输入 ≈ **$0.415**；预算 **≤$0.50**。

## 候选 B：OpenAI `gpt-image-2.5` —— 接入路径需人裁

### B2 · 官方 OpenAI（推荐用于干净对照）

- 接入：`https://api.openai.com/v1`；需要**新的官方 OpenAI key**；可能需要 organization verification；
  proxy 7890。
- 模型：`gpt-image-2.5-sunburst`（官方定位 “editing precision”，最贴合母版保真）；
  quality **medium**（筛查档；high 留资格阶段）。
- 输出：PNG 默认；多参考图走 `/images/edits` 的 `image[]`；官方承认 recurring character 跨多次生成可能漂移。
- 估算：输出 2 × $0.01317 = $0.026；参考图输入官方未给 2.5 的静态 token 数，按 4 张 1K 图估算
  ≈ $0.04–0.14；文本 ≈ $0.01 ⇒ **≈$0.07–0.17**。≤4 发、**≤$0.50**。
- 前置（HITL）：提供官方 key；确认 `gpt-image-2.5-sunburst` 的访问权限（org verification 若需要）。

### B1 · 现有 `_openai` 中转（无新 key，但不是官方端点）

- 接入：`https://api-slb.krill-code.net/codex/v1`，model `gpt-image-2.5`，key 已在 `_openai` 段；
  proxy 覆盖为 7890。
- 历史：2026-09-26 的中转实测（`api.krill-code.net/v1`，**不是**现在的 `/codex/v1`）能出 PNG、
  `/images/edits` 支持多参考图；但 28–48s/张、无透明（`background:"transparent"` 不兑现）、
  有 ≥10 分钟的多分钟 500 故障。`/codex/v1` 路径未验证。
- 计价：中转的计价方式未验证；不能把官方 medium 的 $0.07–0.17 当作中转账单。
  **若你确认它是订阅 / 额度制且不会按次超支，才按 ≤$0.50 记录；否则本报告不保证该上限。**
- 结论：B1 是“用现有 key 探一下”的便宜路径，不是官方候选的等价验证；结果必须标注为 relay。

## 筛查方法（两候选共用）

1. 2 帧生图（idle1/idle2；同一提示词 / 参考图）；保存 raw 与解码后 RGBA。
2. 走同一套导入管线：34 色、48×64、众数色抠底、`dropSpecks`、`dropBottomLines`。
3. 生成 2.5 vs 候选的联系表；计算机械指标：alpha 掩码差、干净 bbox 宽度 / 位置、背景众数色 L1、色数。
4. 筛查结论：红 ⇒ 淘汰；黄 / 绿 ⇒ 提议资格阶段（另票 + 预算）。**不做人眼闸 / 资格 / 决赛 / 整包。**
5. 每发落账（URL / 状态 / MIME / 字节 / 耗时）；无隐藏重试；遇 400 / 格式错 / 解码错即停。

## 预算表

| 项 | A · Gemini 3 Pro | B2 · OpenAI 官方 medium | B1 · 现有中转 |
| --- | ---: | ---: | ---: |
| 2 帧输出 | $0.268 | $0.026 | 未知（官方等价 $0.026） |
| 输入估算 | ≈$0.009 | ≈$0.04–0.14 | 未知 |
| base 合计 | **≈$0.28** | **≈$0.07–0.17** | **未知** |
| 发送上限 | 3 发 | 4 发 | 4 发 |
| 候选上限 | **$0.50** | **$0.50** | **$0.50，仅在计价可界定时** |
| 总上限 | A+B ≤ **$1.00**；A only ≤ **$0.50** | | |

- 时限：单候选 ≤15 分钟；两候选 ≤30 分钟。
- 文本调用 0；整包 0；配置 / fixtures 不改。

## 接入路径选项（请选一个）

- **Option 1 — 只筛 A**：Gemini 3 Pro only；≤$0.50；不需要新 key。
- **Option 2 — A + B1**：A + 现有中转；≤$1.00；不需要新 key；B1 非官方、计价 / 可用性有风险。
- **Option 3 — A + B2**：A + 官方 OpenAI medium；≤$1.00；需要你提供新的官方 key
  （可能需 organization verification）。

我的建议：**Option 3**（官方对照最干净）；若不想开新 key，**Option 2**（把 B 标为 relay，不当作官方结论）；
若两者都不接受，**Option 1**。无论哪个，筛查都只是淘汰红灯，不是选型结论。

## 零付费 dry-run（已完成，0 次 HTTP）

- `DRY_RUN=1 node screen.mjs`：**0 次 HTTP**；产物在 `runs/2026-10-21c-screening/`
  （`dry-run.log` / `dry-run-result.json`）。
- A 请求形状：`gemini-3-pro-image` · Interactions · `image/jpeg` · 3:4 · 1K ·
  3 个 input（text + 风格图 + 母版）。
- B 请求形状：`https://api-slb.krill-code.net/codex/v1/images/edits` · multipart ·
  model `gpt-image-2.5` · n=1 · size `1024x1536` · 2 × `image[]` · content-length = body **1,490,794 B**。
- 计数：dry 下 A 2 发 / B 2 发；硬上限 A **3** / B **4**。
- 基线核对：2.5 的 alpha **0.4%**、干净 bbox 宽度差 **0.2%**、背景 key L1 **2**
  （与 11 的干净 bbox 口径一致）。
- 合成 8×8 图只用于验证请求形状 / 解码 / 导入；不是上游产物，不代表画质。

**dry-run 不能验证的事**：B1 的 `/codex/v1` 路径是否真存在、中转计价、B1 的 PNG / 多参考图行为；
这些只有付费筛查才会暴露。A 的 `gemini-3-pro-image` 访问权与真实 JPEG 也需付费验证。

## 待你逐字点头（按选项选一句）

**Option 1**

> 批准 14（A only）：用 gemini-3-pro-image · Interactions · JPEG 跑 scavenger-actor idle1/idle2 两帧，
> 现有 Gemini key + 7890，≤3 发，预算 ≤$0.50，不改配置。

**Option 2**

> 批准 14（A + B1）：A 同 Option 1；B 用现有 `_openai` 中转 gpt-image-2.5 + 7890 跑同样两帧，
> B ≤4 发、≤$0.50；总预算 ≤$1.00；B 不是官方端点，结果按该前提记录。

**Option 3**

> 批准 14（A + B2）：A 同 Option 1；B 用官方 OpenAI gpt-image-2.5-sunburst medium +
> 我提供的官方 key + 7890 跑同样两帧，B ≤4 发、≤$0.50；总预算 ≤$1.00。
