# 15 · A 资格（Gemini 3 Pro · 3+3 帧）—— 预算报告（待逐字点头）

> **本报告不授权任何调用。** 只有逐字批准后才 `RUN_APPROVED=1` 启动脚本。
> 当前 **0 次付费调用**；筛查已收口，B1 中转未再尝试。

## 结论先说

- 候选 A：`gemini-3-pro-image` · Interactions · JPEG；现有 Gemini key + 7890；08 已落地 JPEG 解码。
- 样本：scavenger idle1/idle2/idle4（48×64，3:4）+ enemy patrol1/patrol4/patrol6（48×48，1:1）。
- 预算：6 × $0.134 输出 ≈ **$0.804** + 输入 ≈ $0.025 ⇒ **base ≈$0.83**；
  +50% 重试（9 发）≈ **$1.24**；硬上限 **≤$2.00**、**≤12 发**、墙钟 ≤30 分钟。
- 机械闸 + 人眼闸按 12 的标准；**资格通过 ≠ 整包批准**。

## 样本与请求形状

| 角色 | 帧 | 目标 | 母版 | 提示词 |
| --- | --- | --- | --- | --- |
| scavenger-actor | idle1 / idle2 / idle4 | 48×64 · 3:4 | `reuse/master-scavenger-actor.png` | v7 `*.prompt.txt` |
| wasteland-enemy | patrol1 / patrol4 / patrol6 | 48×48 · 1:1 | `reuse/master-wasteland-enemy.png` | v7 `*.prompt.txt` |

- 风格图统一 `reference.png`；每帧 text + 风格图 + 母版三个 input。
- 请求：`model: gemini-3-pro-image`，`response_format.mime_type: image/jpeg`，`image_size: 1K`。
- 不做文本调用；不做整包；不改配置 / fixtures。

## 成本与发送

| 项 | 计算 | 金额 |
| --- | --- | --- |
| 6 帧输出 | 6 × $0.134 | $0.804 |
| 输入（3 Pro 560 tokens/图 × 2 图 + ~1k text/帧） | ≈12.7k tokens × $2/M | ≈$0.025 |
| base 合计 | | **≈$0.83** |
| +50% 重试（9 发） | | ≈$1.24 |
| 硬上限 | 6 帧 × attempts=2 = **≤12 发** | **≤$2.00** |

- 单帧实测约 26–27s；6 帧串行约 3 分钟；上限 30 分钟。
- 每发落账；无隐藏重试；400 / 格式错 / 解码错即停。

## 机械与人眼

- 机械：每动画 3 帧取最差一对的 alpha 差 / bbox 宽 / 位置 / 背景 L1；色数取最小；
  另记 off-palette、轮廓边界深色占比。
- 阈值：alpha ≤1/3%、宽 ≤2/5%、位置 ≤1/3%、L1 ≤10/20、色数 ≥14；任一红灯 → 动画失败；
  黄灯 → 人眼复核；机械全绿 ≠ 整包通过。
- 人眼：2.5 vs 3 Pro 的 8× 联系表 + 目标 FPS loop preview；清单式 pass/fail；评审人是你。
- 资格通过才提议决赛（全 4 帧 idle + 全 6 帧 patrol）；决赛另票 + 预算。

## 零付费 dry-run（已完成，0 次 HTTP）

- `DRY_RUN=1 node qualify.mjs`：**0 次 HTTP**；6 个请求形状全部核对。
- 请求：`gemini-3-pro-image` · Interactions · `image/jpeg` · 1K ·
  3 个 input（text + 风格图 + 对应母版）。
  - scavenger idle1/idle2/idle4：aspect **3:4**；
  - enemy patrol1/patrol4/patrol6：aspect **1:1**。
- dry 发送计数 **6 / 12**。
- 2.5 基线机械读数（同一管线，3 帧两两取最大）：
  - scavenger：alpha **0.4%**、宽差 **0.2%**、key L1 **3**、边界深色 **87.4%**、off-palette 0；
  - enemy：alpha **1.1%**、宽差 **0.7%**、key L1 **3**、边界深色 **89.5%**、off-palette 0。
- dry-run 的候选是本地合成 8×8 单色块，所以它的「色数 1 → 红」是预期的，**不是画质结论**。
- dry-run 不能验证：3 Pro 的访问权、真实 JPEG 画质、真实跨帧一致性；这些只有付费跑才会暴露。

## 待你逐字点头的原话

> **批准 15：用 gemini-3-pro-image · Interactions · JPEG 跑 scavenger-actor idle1/idle2/idle4 与
> wasteland-enemy patrol1/patrol4/patrol6 共 6 帧，现有 Gemini key + 7890，≤12 发，预算 ≤$2.00，
> 不改配置；跑完后我做机械 + 人眼验收。**

## 边界

- 不超 12 发、不超 $2.00、不超 30 分钟；不换 provider；不重试 B；不做整包。
- 不切换默认模型；不改 `game-maker.local.json`；不重基线 fixtures。
