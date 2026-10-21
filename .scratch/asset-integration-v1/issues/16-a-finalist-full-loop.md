# 16. A 决赛：Gemini 3 Pro 全循环（4+6 帧）

Type: task
Status: resolved
Owner: claude (2026-10-21 认领 · task · 人裁拒绝 A · 已收口)
Blocked by: 15
Map: ../map.md
> 派生自 [12](12-alternative-animation-model.md) 的决赛阶段与 [15](15-a-qualification.md) 的人裁通过（2026-10-21）。
> ⚠️ **付费闸**：预算报告已出；执行前须逐字点头。本票不预授权任何调用。

## Question

对候选 A（`gemini-3-pro-image` · Interactions · JPEG）做**决赛**：全循环，不做抽样。

- scavenger-actor **idle1–4**（48×64，3:4，全 4 帧）；
- wasteland-enemy **patrol1–6**（48×48，1:1，全 6 帧）；
- 共 **10 帧**；同一 run 全量重生成（不复用资格帧），保证循环一致性；
- 风格图 / 母版 / 提示词逐字取 v7；模型 / 接入同 15。

### 机械闸

- 每个动画的**相邻帧对**（以及全对）取最差：alpha 掩码差、干净 bbox 宽度、位置、
  背景众数色 L1；色数取最小；另记 off-palette 与边界深色占比。
- 阈值同 12：alpha ≤1/3%、宽 ≤2/5%、位置 ≤1/3%、L1 ≤10/20、色数 ≥14；
  任一红灯 ⇒ 动画失败；黄灯人眼复核。
- 决赛通过 ≠ 整包批准。

### 人眼闸

- 全循环 loop preview（idle 6fps / patrol 8fps）+ 8× 联系表；
- 清单：身份/轮廓/比例、姿势族、明暗/色板、无呼吸/跳变、透明边缘、1px 描边、风格一致；
- 评审人：你；逐项记录。

## 验收

- 书面预算报告 + 逐字点头后才发第一笔。
- 10 帧 raw / decoded / imported、两动画联系表、全循环 preview、机械读数、逐发日志、花费。
- 机械 verdict + 人眼 verdict；通过后可提议整包 / 默认切换（另票 + 预算），不自动迁移。

## 边界

- ≤20 发；预算 **≤$4.00**；墙钟 ≤30 分钟；无隐藏重试。
- 不做完整包跑批；不改配置 / fixtures；不换 provider；不重试 B。


## Comments

### 2026-10-21 · 预算报告 + dry-run 就绪，0 发

- 报告：[`runs/2026-10-21f-finalist/budget-report.md`](../runs/2026-10-21f-finalist/budget-report.md)；
  脚本 `runs/2026-10-21f-finalist/finalist.mjs`。
- dry-run：**10 请求**（4 × 3:4 + 6 × 1:1）· `image/jpeg` · 1K · 3 inputs · **0 次 HTTP**；
  dry 计数 10 / 20。
- 2.5 基线（全对最差）：scavenger alpha 0.4% / 宽 0.2% / L1 3；enemy alpha 1.1% / 宽 0.9% / L1 3。
- 待逐字点头的原话见报告末尾；点头前 **0 发**。


## Comments

### 2026-10-21 · 决赛跑完成（10 发 / 10 张 / 0 重试）

- **10 发，全部 200，MIME `image/jpeg`；10/20 发；≈$1.38 / $4.00；0 重试。**
- **scavenger-actor：机械红。**
  - 最大 alpha **10.4%**、宽差 **13.6%**、位置 **4%**、背景 L1 **57**；色数 21、边界 82.6%、off-palette 0。
  - idle1/3 是离群帧：bbox `527×1096` / `504×1074`，idle2/4 是 `464×1094`；key 也从
    [210,60,155] 漂到 [231,40,181]。
  - 联系表：`runs/2026-10-21f-finalist/evidence/scavenger/contact.png`（4 行 × 左 2.5 / 右 3 Pro）。
- **wasteland-enemy：机械红。**
  - 最大 alpha **33.6%**、宽差 **35.5%**、位置 **14.5%**、背景 L1 **352**；色数 16、边界 90.6%、off-palette 0。
  - patrol1/3/5 是离群帧：bbox `730×1014` / `778×1022` / `652×844`，patrol2/4/6 是 `574×878`；
    联系表上能看到明显的暗色前倾姿势与洋红毛边。
  - 联系表：`runs/2026-10-21f-finalist/evidence/enemy/contact.png`（6 行 × 左 2.5 / 右 3 Pro）。
- **资格 3 帧的通过没有泛化到全循环**：全 4 帧 / 全 6 帧把 run-to-run 与逐帧姿势方差暴露出来。
  这正是 12 的决赛阶段要挡的东西。
- **按 12 的标准：两项均红 ⇒ 决赛不通过。** 我的判读：**A 不能作为当前 frames 模式的动画默认**。
- 人眼全循环 verdict 待你确认；材料：
  `evidence/scavenger/loop-preview.html` / `evidence/enemy/loop-preview.html`。
- 下一步（均需新决策 / 预算）：
  1. 拒绝 A，退回 2.5（内部截止 2026-12-31）；
  2. 走官方 OpenAI B2（需新 key + adapter 验证）；
  3. 改生成策略再试（如 sheet 模式 / 更强的姿势锁 / 更严格的背景约束）—— 另票。

## Answer（2026-10-21 · 人裁：拒绝 A）

**裁定：决赛不通过；A（`gemini-3-pro-image`）不作为动画默认。2.5 继续承担动画生产。**

- 决赛结果：scavenger 与 enemy 均机械红（scavenger alpha 10.4% / 宽 13.6%；enemy alpha 33.6% /
  宽 35.5% / 背景 L1 352）；全 4/6 帧暴露了资格 3 帧样本没有的逐帧方差。
- 本轮 10 发 / 10 张 / 0 重试；≈$1.38；未超 ≤20 发 / ≤$4.00。
- **拒绝 A 作为动画默认**；不改默认模型、不迁移整包、不重基线 fixtures。
- 2.5 继续用于动画，内部截止 **2026-12-31** 不变；替代模型（官方 B2 / 换生成策略 / 其他）
  未定，下一次决策在截止前另立票。
- 证据：`runs/2026-10-21f-finalist/`（result.json / http-calls.log / 两套 contact / loop preview）。
