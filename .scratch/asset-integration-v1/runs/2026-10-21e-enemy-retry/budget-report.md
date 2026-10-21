# 15-重试 · enemy 3 帧 —— 预算报告（待逐字点头）

> **本报告不授权任何调用。** 只有逐字批准后才 `RUN_APPROVED=1` 启动重试脚本。
> 当前 **0 次付费调用**。

## 结论先说

- 人裁选择：重试 `wasteland-enemy.patrol1/patrol4/patrol6` 三帧，看上一轮的 enemy 红灯是否可复现 / 可救。
- 模型 / 接入不变：`gemini-3-pro-image` · Interactions · JPEG · 1K · 1:1；现有 Gemini key + 7890。
- **3 发，无重试**；输出 3 × $0.134 ≈ **$0.402** + 输入 ≈$0.013 ⇒ **≈$0.415**；本重试上限 **≤$0.50**。
- 15 总用量：已用 6 发 ≈$0.83；重试后 **9 / 12 发**、**≈$1.245 / $2.00**。
- 只重试 enemy 三帧；不重试 scavenger、不动 B、不做整包。

## 请求与对比

- 提示词 / 参考图 / 母版逐字取 v7：`wasteland-enemy.patrol1/4/6.prompt.txt` +
  `reference.png` + `reuse/master-wasteland-enemy.png`。
- 与上一轮 `2026-10-21d-qualification/evidence/enemy/` 的同三帧逐帧对比，并与 2.5 基线对比。
- 机械闸同 12：alpha、bbox 宽 / 位置、背景 L1、色数、off-palette、边界深色；
  按最差一对取 max。
- 产出：raw / decoded / imported、联系表、loop preview、机械读数、日志。

## 零付费 dry-run（已完成，0 次 HTTP）

- `DRY_RUN=1 node retry-enemy.mjs`：3 个请求；`gemini-3-pro-image` · Interactions ·
  `image/jpeg` · 1K · **1:1** · 3 inputs；dry 发送 3 / 3；**0 次 HTTP**。
- 合成图导致的「色数 1 → 红」是预期的，不是画质结论。

## 待你逐字点头的原话

> **批准 15-重试：用 gemini-3-pro-image · Interactions · JPEG 重跑 wasteland-enemy patrol1/patrol4/patrol6
> 三帧，现有 Gemini key + 7890，≤3 发，预算 ≤$0.50，不改配置；跑完后对比这次与上一轮 enemy 的机械/肉眼结果。**

## 边界

- 不超 3 发 / 不超 $0.50；无隐藏重试；遇 400 / 格式错 / 解码错即停。
- 不重试 scavenger；不改配置 / fixtures；不换 provider；不做整包。
