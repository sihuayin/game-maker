# 16 · A 决赛（Gemini 3 Pro · 全 4+6 帧）—— 预算报告（待逐字点头）

> **本报告不授权任何调用。** 只有逐字批准后才 `RUN_APPROVED=1` 启动决赛脚本。
> 当前 **0 次付费调用**。

## 结论先说

- 候选 A：`gemini-3-pro-image` · Interactions · JPEG；现有 Gemini key + 7890；08 已落地 JPEG 解码。
- 样本：scavenger idle **1–4**（4 帧，48×64，3:4）+ enemy patrol **1–6**（6 帧，48×48，1:1），共 **10 帧**；
  同一 run 全量重生成，不复用资格帧。
- 预算：10 × $0.134 ≈ **$1.34** + 输入 ≈$0.04 ⇒ **base ≈$1.38**；
  +50% 重试（15 发）≈ **$2.07**；硬上限 **≤$4.00**、**≤20 发**、墙钟 ≤30 分钟。
- 决赛通过 ≠ 整包批准；整包 / 默认切换另票 + 预算。

## 样本与请求

| 角色 | 帧 | 目标 | 母版 | fps |
| --- | --- | --- | --- | --- |
| scavenger-actor | idle1–4 | 48×64 · 3:4 | `reuse/master-scavenger-actor.png` | 6 |
| wasteland-enemy | patrol1–6 | 48×48 · 1:1 | `reuse/master-wasteland-enemy.png` | 8 |

- 风格图统一 `reference.png`；每帧 text + 风格图 + 母版三个 input。
- 请求：`model: gemini-3-pro-image` · `response_format.mime_type: image/jpeg` · `image_size: 1K`。

## 成本与发送

| 项 | 计算 | 金额 |
| --- | --- | --- |
| 10 帧输出 | 10 × $0.134 | $1.340 |
| 输入（3 Pro 560 tokens/图 × 2 图 + ~1k text/帧） | ≈21k tokens × $2/M | ≈$0.042 |
| base 合计 | | **≈$1.38** |
| +50% 重试（15 发） | | ≈$2.07 |
| 硬上限 | 10 帧 × attempts=2 = **≤20 发** | **≤$4.00** |

- 单帧实测 35–103s；10 帧串行约 7–12 分钟；上限 30 分钟。
- 每发落账；无隐藏重试；400 / 格式错 / 解码错即停。

## 机械与人眼

- 机械：每个动画**所有帧对**（含相邻对）取最差 alpha、宽、位置、背景 L1；色数取最小；
  另记 off-palette、边界深色。阈值同 12。
- 人眼：全循环 loop preview（idle 6fps / patrol 8fps）+ 8× 联系表；清单式 pass/fail。
- 决赛通过 ⇒ 提议整包 / 默认切换（另票 + 预算）；不自动迁移。

## 零付费 dry-run（已完成，0 次 HTTP）

- `DRY_RUN=1 node finalist.mjs`：**10 个请求**（4 × 3:4 + 6 × 1:1）；`image/jpeg` · 1K · 3 inputs；
  dry 计数 **10 / 20**；**0 次 HTTP**。
- 2.5 基线（全对取最差）：
  - scavenger：alpha **0.4%**、宽差 **0.2%**、key L1 **3**；
  - enemy：alpha **1.1%**、宽差 **0.9%**、key L1 **3**。
- dry-run 的合成单色块导致「色数 1 → 红」是预期的，不是画质结论。

## 待你逐字点头的原话

> **批准 16：用 gemini-3-pro-image · Interactions · JPEG 跑 scavenger-actor idle1–4 与
> wasteland-enemy patrol1–6 共 10 帧（全 10 帧重生成），现有 Gemini key + 7890，≤20 发，
> 预算 ≤$4.00，不改配置；跑完后我做机械 + 人眼全循环验收。**

## 边界

- 不超 20 发 / 不超 $4.00 / 不超 30 分钟；无隐藏重试；不换 provider；不重试 B。
- 不做完整包跑批；不改配置 / fixtures；不切换默认模型。
