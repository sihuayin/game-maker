# 03. Stage B · 构建 / 站点 / smoke / 人工检查

Type: task
Status: open
Owner: —
Blocked by: 02
Map: ../map.md

## Question

在 Stage B 预算获批后，跑 `build <run>`（pack → config → QA → site），
再跑 headless smoke，并保存截图 / 轨迹 / QA 报告 / ledger；人工检查视觉与可玩性。

## 边界

- 生图请求 ≤ 4 × Stage A 的 `imageCalls`；费用上限见票 01；文本请求 ≤ 40；墙钟 ≤ 75 分钟。
- 失败即停：不自动修复、不自动重生成、不隐藏重试。
- 不改 v7 / `fixtures/` / `game-maker.local.json`；不提交、不推送。
