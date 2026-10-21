# 09. 同动画 2 帧 smoke：2.1 · Interactions · JPEG（付费）

Type: task
Status: resolved
Owner: claude (2026-10-21 认领 · task · smoke 已跑、人裁 A · 已收口)
Blocked by: 08
Map: ../map.md
> 派生自 [07](07-model-route-ratification.md) 的 Q5 裁定（2026-10-20）。
> ⚠️ **付费闸**：预算上限已批，但执行前仍须一页书面预算报告 + 逐字点头；本票不预授权任何付费调用。

## Question

用 `gemini-nano-banana-2.1` · Interactions · JPEG 跑**同一动画的 2 帧**，验证真实 JPEG 编码与逐帧裁框抖动。

- 帧：`scavenger-actor` 的 `idle1` / `idle2`（48×64，旗舰资产）。
- 上限：**≤4 发 / ≤$0.16 / ≤15 分钟**；2 发余量只用于重试，每次都要落账。
- 两帧都走完整管线（抠底 → 裁框 → 降采样 → 二值化 → 量化），与同提示词的 2.5 PNG 对照。
- 记录真实 MIME、HTTP 状态、耗时、估算花费；保存 raw JPEG。
- 产出一张联系表：2.1 JPEG vs 2.5 PNG 逐帧并排，重点看轮廓抖动与背景众数色。
- 结论只能是：`接受 JPEG` / `触发 11（共享裁框）` / `拒绝`。

## 验收

- 书面预算报告先落盘；逐字点头后才发第一笔。
- 发数、花费、每发状态在日志 / JSON 里可核对；无隐藏重试。
- 联系表 + 结论落盘。
- 未改默认配置；未替换 fixtures；未跑其它帧。

## 边界

- 不超 4 发、不超 $0.16、不超 15 分钟。
- 不发文本上游；不作为完整包跑批。
- 若出现 400 / 解码失败，记录并停止；不得靠重试掩盖。

## Comments

### 2026-10-21 · 08 已收口，依赖解除

- [08. JPEG 解码 + Interactions 请求改 JPEG](08-jpeg-decoder.md) 已 resolved；本票现在是 frontier。
- ⚠️ **不是自动开跑**：先出书面预算报告（2 帧 · 2.1 · Interactions · JPEG · 上限 4 发 / $0.16 / 15 分钟），
  拿到逐字点头后才发第一笔。

### 2026-10-21 · 预算报告已出，0 发

- 报告：[`runs/2026-10-21a-smoke/budget-report.md`](../runs/2026-10-21a-smoke/budget-report.md)。
- 零付费自检：`DRY_RUN=1 node smoke.mjs` 用本地合成 JPEG 跑通请求体 + 解码 + 导入管线；
  **0 次 HTTP**；dry-run 产物隔离在 `evidence/dry/`。
- 请求摘要：`gemini-nano-banana-2.1` · Interactions · `image/jpeg` · 1K · 3:4 ·
  3 个 input（text 1720 字符 + 风格图 + 母版）。
- 当前配置是 `gemini-3.1-flash-lite-image` + proxy `9098`（未监听）；脚本显式覆盖为 2.1 + 7890，
  **不修改 `game-maker.local.json`**。
- 待逐字点头的原话见报告末尾；点头前不会发第一笔。全局硬上限 4 发 / $0.16 / 15 分钟。

### 2026-10-21 · smoke 已跑（2 发 / 2 张 / 0 重试）

**执行事实**

- `RUN_APPROVED=1`，2 发 HTTP，全部 **200**，MIME **`image/jpeg`**；每帧 1 次尝试，**0 重试**。
- raw JPEG：idle1 **359,772 B** / idle2 **402,726 B**；解码后均 **896×1200**。
- 文本 0；母版 0；未改配置。花费 ≈ **$0.067**（2 × $0.0336）+ 输入 token（≤$0.009）。
- 证据：`runs/2026-10-21a-smoke/http-calls.log` / `result.json` / `evidence/contact-imported.png` /
  `evidence/contact-raw.png` / `evidence/raw/*.jpg`。

**技术路径：通过**

- Interactions 真实回 JPEG；`decodeJPEG` → 导入管线（34 色 / 48×64 / 众数色抠底）全程无格式错、无重试。
- 未出现「200 计费后本地丢图」。

**帧间一致性：未通过**

| 指标 | 2.1 (idle1→idle2) | 2.5 基线 (idle1→idle2) |
| --- | --- | --- |
| raw ink bbox 漂移 | **dx 0 · dy −34 · dw −132 · dh −6** | dx 6 · dy 5 · dw −6 · dh −4 |
| 导入帧 alpha 掩码差 | **550 / 3072 = 17.9%** | 11 / 3072 = 0.4% |
| 导入帧 RGB 平均 L1 | **32.99** | 2.53 |
| trimmed 宽 | idle1 **555** vs idle2 **472** | 454 vs 454 |
| 不透明像素 | idle1 **1298** vs idle2 **1496** | 1496 vs 1501 |
| 平均亮度 | idle1 **50.1** vs idle2 **59.4** | 60.8 vs 60.3 |

- **idle1 是离群帧**：bbox 更宽（782 vs 650）、不透明像素更少、整体更暗（橄榄 `#59503b` 只占 4.6%，
  基线约 11%）；idle2 的色板分布与 2.5 基线接近。
- 逐帧紧裁把 132px 的 bbox 宽度差放大成最终 48×64 的**比例差**；联系表上 idle1 明显更宽、更暗，
  idle2 较接近 2.5。
- 结论：**不是 JPEG 压缩问题**（压缩在 48×64 上是温和的；离线模拟也一致），
  是 **2.1 的逐帧绘制方差 + 逐帧紧裁**叠加。idle1 是单帧离群，但它足以让 idle 循环肉眼可见地「呼吸」。

**待裁定**

- 选项 A：**触发 [11. 动画级共享裁框](11-shared-trimbox.md)**（先做零付费 dry-run，看共享框能消掉多少比例差；
  它不能消掉模型姿势/明暗方差）。
- 选项 B：用剩余 2 发预算对 idle1 做一次**质量重试**，再比较（仍须逐字点头；本轮已用的 2 发不重复）。
- 选项 C：**拒绝 2.1 作为动画默认**（可保留 JPEG 路径；动画继续用 2.5，或另试 3-pro）。

我的建议：**A → 若 dry-run 仍不可接受，再 C**。idle1 是离群帧，但 61 帧量级下这种方差会再出现；
共享裁框是零付费、可先验证的一步。

## Answer（2026-10-21 · 人裁）

**裁定（逐字）：A → 若 dry-run 仍不可接受，再 C。**

### 执行与结果

- 2 发 HTTP，全部 **200**，MIME **`image/jpeg`**；每帧 1 次尝试，**0 重试**。
- raw JPEG：idle1 **359,772 B** / idle2 **402,726 B**；解码后均 **896×1200**。
- 花费 ≈ **$0.067**（2 × $0.0336）+ 输入 token（≤$0.009）；文本 0；未改配置。
- **技术路径通过**：真实 JPEG → `decodeJPEG` → v7 同款导入管线，无格式错、无重试、无「200 后丢图」。
- **帧间一致性未通过**：imported alpha 掩码差 **17.9%**（550/3072）vs 2.5 基线 **0.4%**（11/3072）；
  raw bbox 宽漂移 **−132 px** vs 2.5 **−6 px**；RGB 平均 L1 **32.99** vs **2.53**。
- **idle1 是离群帧**：更宽、更暗、不透明像素更少（1298 vs 1496）；idle2 的色板分布接近 2.5 基线。
- 结论：不是 JPEG 压缩问题，是 **2.1 的逐帧绘制方差 + 逐帧紧裁**叠加。

### 后续

- 触发 [11. 动画级共享裁框](11-shared-trimbox.md)：先做**零付费 dry-run**，看共享框能消掉多少比例差；
  它消不掉模型姿势 / 明暗方差。
- 若 dry-run 仍不可接受 ⇒ 按本裁定走 **C：拒绝 2.1 作为动画默认**。
- 本票不授权 11 的施工改动；dry-run 结果出来后再裁定「施工」还是「C」。

### 证据

- `runs/2026-10-21a-smoke/http-calls.log` / `result.json`
- `runs/2026-10-21a-smoke/evidence/contact-raw.png` / `contact-imported.png`
- `runs/2026-10-21a-smoke/evidence/raw/*.jpg` / `evidence/*.imported.png`
