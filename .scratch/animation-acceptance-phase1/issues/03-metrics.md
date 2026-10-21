# 03. 新增 animation-metrics.ts 纯指标

Type: task
Status: resolved
Owner: task 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

新增 `packages/assets/src/animation-metrics.ts`，实现票 12 的纯动画指标与绿/黄/红判定：

- `alphaMaskDiff`（alpha 掩码差 %）
- `cleanBBox` / `bboxWidthDiffPct`
- `positionDriftPct`
- `dominantColorL1`
- `paletteCount` / `offPaletteCount`
- `boundaryDarkPct`
- `verdictOf`（绿/黄/红；阈值见票 12：
  alpha ≤1/3%、bbox 宽 ≤2/5%、位置 ≤1/3%、背景 L1 ≤10/20、色数 ≥14；
  off-palette = 0、边界深色 ≥50% 为交付硬门槛）。

先读 `.scratch/asset-integration-v1/runs/2026-10-21d-qualification/qualify.mjs` 与
`2026-10-21f-finalist/finalist.mjs` 的实际实现，保证指标定义一致；再读
`packages/assets/src/image.ts` / `png.ts` 的 `RasterImage` 与 `decodePNG`。

从 `packages/assets/src/index.ts` 导出。
新增 `packages/assets/tests/animation-metrics.test.ts`：
用 d 票 §3.3 的 v7 基线读数做 golden fixture，逐项断言；另加阈值边界与改一像素的负例。

## 验收

- 指标函数为纯函数，无新依赖。
- 测试 exit 0；`pnpm typecheck` 不新增错误。
- 只改新文件 + `assets/src/index.ts` + 新测试。

## 边界

- 不提交；不写 `out/`；零付费；不碰 `CONTEXT.md` / 无关 `.scratch`。
- 不写 `map.md`。

## 产出

本票 `## Answer`：函数清单、阈值常量、测试结果、与 scratch 脚本的任何差异。

## Answer

**结论：** `packages/assets/src/animation-metrics.ts` 已落地票 12 的纯指标与绿/黄/红判定；
v7 `scavenger-actor` idle 4 帧的 golden 读数与 d 票 §3.3 逐项一致（alpha 0.4% / bbox 宽 0.2% /
位置 0.4% / 背景 L1 3 / 最少 18 色 / off-palette 0 / 边界深色 87.4%），整体判绿。
定向测试 13/13 通过；定向 `tsc --noEmit` exit 0。未跑 `pnpm typecheck`（票 01 并行修两处已知错误）。

### 函数清单（全部纯函数，无新依赖）

| 函数 | 定义 | 量在哪张图 |
|---|---|---|
| `alphaMaskDiff(a, b, { floor=128 })` | `alpha ≥ floor` 的布尔掩码不同的像素占比 %，保留 1 位小数 | 导入后交付帧 |
| `cleanBBox(img, { floor=128, keyTolerance=30 })` | 众数色抠底 → 删底部地面线 → 删孤立碎点 → `inkBBox`；全透明返回 `null` | raw 帧 |
| `bboxWidthDiffPct(a, b)` | `(max(w)/min(w) − 1) × 100`；任一 bbox 为 `null` 返回 `null` | 两个干净 bbox |
| `positionDriftPct(a, b)` | `max(|dx| / max(srcW), |dy| / max(srcH)) × 100`；`a/b` 为 `{bbox, sourceWidth, sourceHeight}` | raw 帧 bbox + raw 源图尺寸 |
| `dominantColorL1(a, b)` | 两帧（或两组 RGB）众数色的 `|ΔR|+|ΔG|+|ΔB|` | raw 帧 |
| `paletteCount(img, { floor=128 })` | 不透明像素的不同 RGB 数 | 导入后交付帧 |
| `offPaletteCount(img, palette, { floor=128 })` | 颜色 ∉ 色板的不透明像素数 | 导入后交付帧 |
| `boundaryDarkPct(img, palette, { floor=128 })` | 轮廓边界像素中，亮度 ≤ 色板中位亮度的比例 %；无边界返回 `null` | 导入后交付帧 |
| `verdictOf(metrics)` | 任一红 → 红；否则任一黄 → 黄；否则绿 | 汇总读数 |

汇总类型 `AnimationMetrics` 的字段与 `animation-acceptance/v1` 报告的 `metrics` 同名：
`alphaMaskDiffPct` / `bboxWidthDiffPct` / `positionDriftPct` / `backgroundL1` /
`paletteCountMin` / `offPalette` / `boundaryDarkPctMin`（均取所有帧 / 帧对里的最差值）。

### 阈值（唯一来源 `ANIMATION_THRESHOLDS`）

- Alpha 掩码差：≤1% 绿 / ≤3% 黄 / >3% 红
- 干净 bbox 宽度差：≤2% / ≤5% / >5%
- 位置漂移：≤1% / ≤3% / >3%
- 背景众数色 L1：≤10 / ≤20 / >20
- 硬门槛（无黄灯）：色数 ≥14、off-palette = 0、边界深色 ≥50%
- 红灯压过黄灯；黄灯不能自动通过（人眼复核，票 12 原文）。

### 测试结果

- `pnpm vitest run packages/assets/tests/animation-metrics.test.ts` → **13/13 通过**（约 3s）。
- golden：逐帧断言 bbox / 众数色 / 色数 18,18,19,19 / off-palette 0 / 边界深色 87.4,89.6,87.9,87.4；
  6 个帧对逐项断言 alpha / 宽度 / 位置 / 背景 L1；汇总与 `verdictOf = green` 均通过。
- 另含阈值恰好边界（1/1.1/3、2/2.1/5、1/1.1/3、10/11/20、14 色、0 off、50%）、
  改一像素负例（4×4 改 alpha = 6.3%；14 色图改一像素变 15 色且 off-palette = 1；
  边界 4 深 4 浅 = 50% → 改一像素 37.5%；bbox 被一像素撑大）。
- 定向类型检查（不是 `pnpm typecheck`）：
  `pnpm exec tsc --noEmit --strict --noUncheckedIndexedAccess … src/animation-metrics.ts tests/animation-metrics.test.ts` → exit 0。

### 与 scratch 脚本的差异

指标定义、清洗顺序、alpha 下限 128、1 位小数舍入、色板中位亮度取法均与
`qualify.mjs` / `finalist.mjs` 逐字一致。差异只在 API 形状与缺值语义：

1. 脚本 `alphaDiff` 返回对象、聚合字段用 `maxAlphaPct` / `maxKeyL1` 等；本模块单个函数只返回数值，
   汇总类型改用报告的 `animation-acceptance/v1` 字段名（值语义相同）。
2. 脚本 `tier()` 把 `null` 记为 `"unknown"` 并从整体判定中略过；本模块的几何函数在缺 bbox 时返回 `null`，
   `verdictOf` 只接收已汇总的数值（缺值由调用方决定如何处理）。
3. `boundaryDarkPct` 对空色板抛错（脚本会静默得到 0% 深色）；真实调用不会传空色板。
4. `paletteCount` 内部用 RGB 打包整数集合（脚本用 `"r,g,b"` 字符串），读数相同。

### 变更文件

- 新增 `packages/assets/src/animation-metrics.ts`
- 新增 `packages/assets/tests/animation-metrics.test.ts`
- `packages/assets/src/index.ts`：追加 `export * from "./animation-metrics.js";`

未提交、未推送、零付费；未改 `CONTEXT.md` / `map.md` / 既有 `.scratch` 内容 / `game-maker.local.json`。
