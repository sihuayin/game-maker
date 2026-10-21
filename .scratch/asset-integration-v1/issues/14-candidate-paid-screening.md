# 14. 候选付费筛查：Gemini 3 Pro / OpenAI 2.5

Type: task
Status: resolved
Owner: claude (2026-10-21 · Option 2 筛查完成 · 已收口)
Blocked by: 13
Map: ../map.md
> 派生自 [12](12-alternative-animation-model.md) 的 Q7 与 [13](13-alternative-animation-models-research.md) 的短名单（2026-10-21）。
> ⚠️ **付费闸**：预算报告已出；执行前须逐字点头。本票不预授权任何调用。

## Question

按 [12](12-alternative-animation-model.md) 的筛查阶段（2 帧、≤$0.50/候选、同一组提示词 / 参考图）
筛查至多 2 个短名单候选。

### 候选 A：`gemini-3-pro-image` · Gemini API Interactions · JPEG

- 现有 Gemini key + proxy 7890；无 OAuth / ADC；无停服日。
- 2 帧：`scavenger-actor.idle1/idle2`；提示词 / 参考图取 v7。
- 08 已落地 JPEG 解码；格式条件已满足，无需新施工。
- 预算：2 × $0.134 + 输入 ≈ $0.28；**≤3 发**（2 帧 + 1 次重试）≈ ≤$0.42；上限 **≤$0.50**。

### 候选 B：OpenAI `gpt-image-2.5`（接入路径需人裁）

- **B1 · 现有 `_openai` 中转**：`https://api-slb.krill-code.net/codex/v1`，model `gpt-image-2.5`，
  key 已存在；proxy 覆盖为 7890。**不是官方端点**；2026-09-26 的中转实测能出 PNG、
  `/images/edits` 支持多参考图，但有 28–48s/张与多分钟 500 故障；本次 `/codex/v1` 路径未验证，
  计价方式未验证。
- **B2 · 官方 OpenAI**：`https://api.openai.com/v1`，`gpt-image-2.5-sunburst`（editing precision），
  quality `medium`；需要新的官方 key，可能需要 organization verification。
- 2 帧：同上；B2 预算按官方 medium ≈ $0.026 输出 + 未验证的参考图输入；
  ≤4 发、**≤$0.50**。B1 若计价不明，不保证 ≤$0.50。

### 筛查只做

2 帧生图 → 解码 → 同一套导入管线（34 色、48×64、众数色抠底、`dropSpecks` / `dropBottomLines`）
→ 2.5 对照联系表 + 机械指标（alpha 差、bbox 宽 / 位置、背景 L1、色数）→ 红 / 黄 / 绿结论。
**不做人眼闸、不做资格 / 决赛、不做整包。**

## 验收

- 书面预算报告 + 逐字点头后才发第一笔。
- 每候选 2 帧、raw + decoded + imported、联系表、指标、逐发日志、花费。
- 筛查结论：红 ⇒ 淘汰；黄 / 绿 ⇒ 提议资格阶段（另票 + 预算）。
- 若两候选都红，停止并报告，不自动加试。
- 0 文本调用；不改配置 / fixtures；不切换默认模型。

## 边界

- 不超每候选 $0.50 / 总 $1.00（若只筛 A，则 $0.50）。
- 不超发送上限（A ≤3；B ≤4）；无隐藏重试。
- 不做完整包跑批；不做共享裁框；不重基线 fixtures。


## Comments

### 2026-10-21 · 预算报告已出，0 发

- 报告：[`runs/2026-10-21c-screening/budget-report.md`](../runs/2026-10-21c-screening/budget-report.md)。
- 候选 A：`gemini-3-pro-image` · Interactions · JPEG，现有 Gemini key + 7890；2 帧 idle1/idle2；≤3 发 / ≤$0.50。
- 候选 B：OpenAI `gpt-image-2.5`；接入路径需人裁：
  - B1 现有 `_openai` 中转（无新 key；非官方；计价 / 可用性有风险）；
  - B2 官方 `gpt-image-2.5-sunburst` medium（需新官方 key）。
- 选项：Option 1 = A only（≤$0.50）；Option 2 = A + B1（≤$1.00）；Option 3 = A + B2（≤$1.00）。
- 建议 Option 3；无论哪个，执行前须逐字点头。**本轮 0 发**。
- 08 已落地 JPEG 解码；Gemini 3 Pro 的格式条件已满足，不需要新施工。


### 2026-10-21 · Option 2 已选；零付费 dry-run 已完成

- 人已选 **Option 2（A + B1 现有中转）**；付费闸仍需逐字批准。
- `DRY_RUN=1` 验证了两条请求形状，**0 次 HTTP**：
  - A：`gemini-3-pro-image` · Interactions · `image/jpeg` · 3:4 · 1K · 3 inputs；
  - B：`/codex/v1/images/edits` · multipart · `gpt-image-2.5` · n=1 · size 1024x1536 ·
    2 × `image[]` · content-length = 1,490,794 B。
- 基线核对：2.5 alpha 0.4% / 干净 bbox 宽差 0.2% / key L1 2。
- 脚本：`runs/2026-10-21c-screening/screen.mjs`；`RUN_APPROVED=1` 才会发付费请求。
- 待逐字点头的原话见预算报告末尾 Option 2 句；点头前 0 发。

## Answer（2026-10-21 · Option 2 筛查完成）

**结论：A（Gemini 3 Pro）为黄灯，提议进入资格阶段（需人眼复核）；B1（现有中转）无结果，
relay 路径返回 200 空体。** 本票不授权资格阶段、B 的重试或任何新调用。

### A · `gemini-3-pro-image` · Interactions · JPEG

- 2 发，全部 **200**，MIME `image/jpeg`；raw 440,478 B / 457,161 B；解码后均 **896×1200**；
  26.9s / 25.7s，每帧 1 次尝试，**0 重试**。
- 机械读数（生产口径，逐帧紧裁）：
  - alpha 掩码差 **1.8%**（56/3072）⇒ **黄灯**（1–3%）；
  - 干净 bbox 宽 **464 vs 464**（0%）⇒ 绿灯；
  - 位置漂移 **0%**（两帧 bbox 均 `150,68 464×1092`）⇒ 绿灯；
  - 背景众数色 L1 **3**（[212,52,154] vs [210,53,154]）⇒ 绿灯；
  - 调色板色数 **22 / 21** ⇒ 绿灯。
- 2.5 基线对照：alpha 0.4%、宽差 0.2%、L1 2。
- 联系表：`runs/2026-10-21c-screening/evidence/gemini3pro/contact.png`
  （顺序：2.5 idle1 | 3 Pro idle1 | 2.5 idle2 | 3 Pro idle2）。
- 结论：**无红灯；黄灯交人眼复核**。按 12 的标准，A 可进入资格阶段（3+3 帧，≤$2.00），
  但资格阶段须**另立票 + 预算报告 + 逐字点头**。

### B1 · 现有 `_openai` 中转 · `gpt-image-2.5`

- 1 发：`POST https://api-slb.krill-code.net/codex/v1/images/edits`，multipart，2 × `image[]`，
  content-length 1,490,794 B；**HTTP 200，空 body**（`no-b64`）。
- OpenAI 客户端随后 `res.json()` 失败：`Unexpected end of JSON input`；**没有图片**。
- **只发 1 发，未重试**（空 200 不是 5xx）；B 的 4 发上限只用了 1 发。
- relay 计价未验证；**不排除已计费**（本票不假设为 0）。
- 这是**接入路径失败，不是模型画质结论**。2026-09-26 的旧中转实测用的是
  `api.krill-code.net/v1`，不是现在的 `api-slb.krill-code.net/codex/v1`；路径 / 空 200 的原因未确认。
- 未尝试旧 `/v1` 路径或官方 B2；两者都需要新的逐字批准。

### 花费

- A：2 × $0.134 ≈ **$0.268** 输出 + 输入（≈$0.009）≈ **$0.277**。
- B1：1 发，relay 计价未知；**总花费 = ≈$0.277 + 未知 relay 费用**。
- 均在批准的 A ≤$0.50 / B ≤$0.50 / 总 ≤$1.00 内（B 的未知费用除外）。

### 下一步（均需新授权）

1. **A 资格阶段**：3 帧 scavenger idle（1/2/4）+ 3 帧 enemy patrol（1/2/4），Gemini 3 Pro，
   预算 ≤$2.00（base ≈$0.83，+50% 重试 ≈$1.24）；另立票 + 预算报告 + 逐字点头。
2. **B1 旧 `/v1` 路径**：换到 `api.krill-code.net/v1` 再试（同一 key，另一端点）；
   需新的书面批准与预算上限。
3. **B2 官方 OpenAI**：需要新的官方 key；另立票 + 预算。
4. **放弃 B**：只推进 A。

证据：`runs/2026-10-21c-screening/http-calls.log` / `result.json` / `evidence/gemini3pro/` /
`evidence/openai-relay/`。
