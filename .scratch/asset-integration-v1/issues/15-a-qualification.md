# 15. A 资格：Gemini 3 Pro 3+3 帧机械 + 人眼验收

Type: task
Status: resolved
Owner: claude (2026-10-21 认领 · task · 人裁通过 · 已收口)
Blocked by: 14
Map: ../map.md
> 派生自 [12](12-alternative-animation-model.md) 的 Q1/Q2/Q3 与 [14](14-candidate-paid-screening.md) 的 A 黄灯（2026-10-21）。
> ⚠️ **付费闸**：预算报告已出；执行前须逐字点头。本票不预授权任何调用。

## Question

对候选 A（`gemini-3-pro-image` · Interactions · JPEG）做**资格阶段**：3 帧拾荒者 idle +
3 帧敌人 patrol，机械闸 + 人眼闸。

### 样本

- `scavenger-actor.idle1/idle2/idle4`（首/中/尾；48×64；母版 `master-scavenger-actor`）；
- `wasteland-enemy.patrol1/patrol4/patrol6`（首/中/尾；48×48；母版 `master-wasteland-enemy`）；
- 风格图统一 `reference.png`；提示词逐字取 v7。
- 模型：`gemini-3-pro-image` · Interactions · JPEG · 1K；拾荒者 3:4，敌人 1:1。
- 接入：现有 Gemini key + proxy 7890；08 已落地 JPEG 解码。

### 机械闸（生产口径，逐帧紧裁）

- 对每个动画的 3 帧取**最差一对**（max pairwise）：
  alpha 掩码差、干净 bbox 宽度 `max/min−1`、位置漂移 `max(dx/W,dy/H)`、背景众数色 L1；
  调色板色数取最小值。
- 阈值按 12 的绿/黄/红：alpha ≤1/3%、宽 ≤2/5%、位置 ≤1/3%、L1 ≤10/20、色数 ≥14。
- 交付机械项：off-palette = 0；轮廓边界深色占比 ≥50%（深色 = 调色板亮度最低的一半）；
  无残留地面线 / 碎点（管线清理 + 人眼复核）。
- 任一红灯 ⇒ 整个动画不合格；黄灯必须人眼复核；机械全绿 ≠ 整包通过。

### 人眼闸

- 每动画：2.5 vs 3 Pro 的 8× 联系表 + 目标 FPS loop preview（idle 6fps / patrol 8fps）。
- 清单：身份/轮廓/比例、姿势族、明暗/色板、无可见呼吸/跳变、透明边缘、1px 描边、风格一致。
- 评审人：你；逐项记录结论。
- 两级都过 ⇒ 提议决赛（全 4 帧 idle + 全 6 帧 patrol，另票 + 预算）；任一不过 ⇒ 停止并报告。

## 验收

- 书面预算报告 + 逐字点头后才发第一笔。
- 6 帧 raw / decoded / imported、两动画的联系表、loop preview、机械读数、逐发日志、花费。
- 机械 verdict（每动画 绿/黄/红）+ 人眼 verdict（pass/fail + 逐项）。
- 不自动进入决赛 / 整包；不切换默认模型。

## 边界

- ≤12 发；预算 **≤$2.00**；墙钟 ≤30 分钟；无隐藏重试。
- 不做完整包跑批；不改配置 / fixtures；不换 provider；不重试 B。


## Comments

### 2026-10-21 · 预算报告 + dry-run 就绪，0 发

- 报告：[`runs/2026-10-21d-qualification/budget-report.md`](../runs/2026-10-21d-qualification/budget-report.md)；
  脚本：`runs/2026-10-21d-qualification/qualify.mjs`。
- `DRY_RUN=1` 核对 6 个请求：`gemini-3-pro-image` · Interactions · `image/jpeg` · 1K ·
  3 inputs；scavenger **3:4**、enemy **1:1**；**0 次 HTTP**。
- 2.5 基线机械读数：scavenger alpha 0.4% / 宽差 0.2% / key L1 3 / 边界深色 87.4%；
  enemy alpha 1.1% / 宽差 0.7% / key L1 3 / 边界深色 89.5%；off-palette 0。
- dry-run 的合成单色块导致「色数 1 → 红」是预期的，不是画质结论。
- 待逐字点头的原话见报告末尾；点头前 **0 发**。


## Comments

### 2026-10-21 · 资格跑完成（6 发 / 6 张 / 0 重试）

- **6 发，全部 200，MIME `image/jpeg`；6 张成功；0 重试**；花费 ≈ **$0.83**
  （6 × $0.134 + 输入 ≈$0.025）；≤12 发 / ≤$2.00。
- **scavenger-actor：机械绿。**
  - 3 帧 idle1/idle2/idle4；alpha 最大 **1.0%**、宽差 **0.2%**、位置 **0.1%**、背景 L1 **5**、
    色数 **19**、边界深色 **85.4%**、off-palette 0。
  - 联系表：`runs/2026-10-21d-qualification/evidence/scavenger/contact.png`
    （3 行 × 左 2.5 / 右 3 Pro）；三帧 3 Pro 很接近，与 2.5 轻微风格差异。
- **wasteland-enemy：机械红。**
  - patrol1/4/6；alpha 最大 **31.3%**、宽差 **43.6%**、位置 **10.2%**、背景 L1 **233**、
    色数 **14**、边界深色 **89.2%**、off-palette 0。
  - 背景众数色：patrol1/4 = **[253,0,252] / [252,0,252]**；patrol6 = **[191,34,115]** —— 同一动画内背景色突变。
  - 联系表：`runs/2026-10-21d-qualification/evidence/enemy/contact.png`。3 Pro 的敌人明显更暗、
    轮廓/姿势与 2.5 基线差异大，且三帧之间也不一致。
- **按 12 的标准**：任一红灯动画 ⇒ 该动画失败。A 的 scavenger 通过、enemy **红** ⇒
  **A 不能作为两动画的整体资格候选**。scavenger 单独通过不能抵消 enemy 的红灯（两角色样本正是为了防过拟合）。
- **人眼裁定待你**。联系表 + loop preview：
  `evidence/scavenger/loop-preview.html`、`evidence/enemy/loop-preview.html`。
- 我的判读：**A 资格不通过**（enemy 红 + 肉眼可见的暗/不一致）。可选项：
  ① 拒绝 A；② 用剩余 6 发额度重试 3 帧 enemy（需新点头）；③ 走官方 B2（需新 key）；
  ④ 退回 2.5，等下一次模型决策。


### 2026-10-21 · 人裁选择：重试 enemy 3 帧；预算 + dry-run 就绪

- 选择 **2**：重试 `wasteland-enemy.patrol1/patrol4/patrol6`，3 发 / ≤$0.50；15 总用量 6 + 3 = **9 / 12 发**、
  ≈$1.245 / $2.00。
- 报告：[`runs/2026-10-21e-enemy-retry/budget-report.md`](../runs/2026-10-21e-enemy-retry/budget-report.md)；
  脚本 `runs/2026-10-21e-enemy-retry/retry-enemy.mjs`。
- `DRY_RUN=1`：3 请求、aspect 1:1、0 次 HTTP。
- 待逐字点头；点头前 **0 发**。


### 2026-10-21 · enemy 重试完成（3 发 / 3 张 / 0 重试）

- 3 发，全部 **200**，MIME `image/jpeg`；1024×1024；86.1s / 94.8s / 102.8s；0 重试；
  花费 ≈ **$0.415**。15 累计 **9 / 12 发**、**≈$1.245 / $2.00**。
- **enemy 重试：机械黄**（不再是红）：
  - alpha 最大 **2.3%**（黄灯 1–3%）；宽差 **0%**、位置 **0%**、背景 L1 **3**、
    色数 **17**、边界深色 **89.7%**、off-palette 0。
  - 三帧 bbox 完全一致（`170,122 574×878`），背景 key 稳定（[192,33,114] / [192,31,113] / [192,31,113]）。
  - 联系表：`runs/2026-10-21e-enemy-retry/evidence/enemy/contact.png`；loop：
    `runs/2026-10-21e-enemy-retry/evidence/enemy/loop-preview.html`。
  - 与上一轮红（alpha 31.3% / 宽 43.6% / L1 233）对比：背景与姿势一致性被重试修好。
- **A 的组合状态**：
  - scavenger **机械绿**（上一轮，`2026-10-21d-qualification/evidence/scavenger/`）；
  - enemy **机械黄**（本轮重试）；
  - 两动画都无红灯；enemy 黄灯必须人眼复核。**人眼 pass ⇒ A 资格通过；fail ⇒ 不通过。**
- 人眼材料：
  - scavenger：`2026-10-21d-qualification/evidence/scavenger/contact.png` / `loop-preview.html`；
  - enemy：`2026-10-21e-enemy-retry/evidence/enemy/contact.png` / `loop-preview.html`。
- 待你逐项裁定（身份/轮廓/比例、姿势族、明暗/色板、无呼吸/跳变、边缘、1px 描边、风格）。
- 资格通过才提议决赛（全 4 帧 idle + 全 6 帧 patrol），决赛另票 + 预算。

## Answer（2026-10-21 · 人裁通过）

**裁定：通过。** 候选 A（`gemini-3-pro-image` · Interactions · JPEG）通过资格：

- scavenger-actor：机械绿（alpha ≤1.0%、宽差 0.2%、位置 0.1%、背景 L1 5、色数 19、边界深色 85.4%）。
- wasteland-enemy（重试）：机械黄（alpha 2.3%，宽/位置 0%、背景 L1 3、色数 17、边界深色 89.7%）；
  人眼通过。
- 两动画均无红灯；人眼清单通过。
- 用量：**9 / 12 发**；≈**$1.245 / $2.00**；0 隐藏重试。
- 证据：`runs/2026-10-21d-qualification/`（scavenger）与 `runs/2026-10-21e-enemy-retry/`（enemy）。
- 下一步：**决赛**（scavenger idle 全 4 帧 + enemy patrol 全 6 帧，全循环），另票 + 预算 + 逐字点头。
  决赛通过 ≠ 整包批准；整包 / 默认切换另票。
