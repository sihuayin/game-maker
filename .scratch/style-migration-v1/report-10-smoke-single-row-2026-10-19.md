# 票 10 smoke 单行：`scavenger run` 8×1 提示词验证（已授权）

- **授权（人裁逐字）**：
  > **裁 A：单行提示词重写，先零付费改提示词 + 1 发 scavenger run smoke（1 张 / ≤4 发 / 15 分钟）**
- **依据**：[票 16](issues/16-fixed-grid-not-followed.md) 的 A 裁定；[第二次真跑失败报告](report-10-real-legacy-failure-2026-10-19.md)。
- **不改** `game-maker.local.json`；不自动重跑 / 换模型 / 转码。

## 0 · 一句话

把 sheet 提示词的 **`rows=1`** 分支从「固定网格」改成「**一行等距排开**」（源码，零付费），
然后用 **1 发**验证最难的 `scavenger-actor.run`（8 帧、8×1）是否能被 2.5 正确排版。

## 1 · 提示词改动（已施工、零付费）

- `packages/assets/src/prompt.ts`：新增 `oneRow` 分支（仅 `sheet.rows === 1`）。
  - 不再说「固定网格 / 格子」；改「横向等距排开的游戏角色动画分解图」「一行排开 8 个角色」；
  - 明令「没有任何分隔线、边框、编号、文字」；
  - 多行网格（`rows > 1`）的旧文字**逐字不变**。
- 新增测试：`prompt.test.ts` 的 `rows=1` 用例（含 `not.toContain("固定网格"/"格子")`）。
- 全量 **102 文件 / 1625 条全绿**；`pnpm build` ✅。

## 2 · smoke 输入

| 项 | 内容 |
| --- | --- |
| 配方 | `runs/2026-10-19g-smoke-single-row/asset-recipe.json`（`id: smoke-single-row`） |
| 资产 | `scavenger-actor.run` · 8 帧 · `sheet { columns: 8, rows: 1 }` · 48×64 |
| 参考图 | 失败现场的 `master-scavenger-actor.png`（作为 `source.reference`；**零母版调用**） |
| 风格 | `stylespec.json`（32 色）+ `reference.png` |
| 模型 | `gemini-2.5-flash-image` · legacy `generateContent` |
| 代理 | `127.0.0.1:7890` |

`parseRecipe` 通过；`imageCallsOf = 1`（只有这一张 sheet）。

## 3 · 预算与硬停

| 项 | 上限 |
| --- | --- |
| 生图调用 | **1** |
| 生图 HTTP | **≤4 发**（4xx / 非 PNG 不重试） |
| 文本 | **0** |
| 墙钟 | **15 分钟** |
| 正常费用 | 1 × $0.039 ≈ **$0.039** |
| 最坏费用 | 4 × $0.039 ≈ **$0.156** |

输出：`runs/2026-10-19g-smoke-single-row/smoke-single-row/pack/v1/`。

## 4 · 验收

1. HTTP 200；`IMG-MIME #1 image/png`。
2. `ledger`：生图 **1** 次 · 文本 **0** 次。
3. `verifyPack` **ok**；`smoke-single-row` 包里有 **8 帧**（`run`）。
4. 按格校验通过：没有空格 / 四边框 / 多主体。
5. 肉眼：**一行 8 个角色**、大小一致、脚底同高；**没有格线 / 边框 / 编号 / 文字**。
6. 失败即停：保留日志 / 现场 / 已付费原图；不重跑、不换模型、不转码。

## 5 · 失败语义

| 失败点 | 花费 | 结果 |
| --- | --- | --- |
| 4xx / 非 PNG | 1 发 | 停；报文归因 |
| 按格校验失败（数量 / 空格 / 边框 / 多主体） | 1 发 ≈ $0.039 | 停；报文点名第几帧 |
| 解码 / 量化 / `verifyPack` 失败 | 1 发 ≈ $0.039 | 停；现场保留 |

通过后，下一步是：把其余动画的 `sheet` 改成单行（数据改动）→ 计算**可复用**的已生成母版 / 静物 /
背景（作为 import）→ 另出完整重跑预算报告 + 逐字点头。
