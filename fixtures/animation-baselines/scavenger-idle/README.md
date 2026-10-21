# scavenger-idle baseline（`animation-acceptance/v1`）

`baselineId`: `scavenger-actor.idle.v7.2026-10-19` · 冻结于 2026-10-21（Phase 1 Tier 1 票 04）。

这是 v7 资源包 `scavenger-actor` idle 4 帧的**证据冻结**，不是生成流程的一部分。
回归测试：[`packages/assets/tests/animation-baseline.test.ts`](../../../packages/assets/tests/animation-baseline.test.ts)。

## 来源

| 内容 | 来源 | 说明 |
| --- | --- | --- |
| `raw/*.png` 4 帧 | 19i 真实生成现场 → v7 包 | 复制自 v7 `authoring/generated/scavenger-actor.idle{1..4}.png`；与 19i 失败现场逐字节相同 |
| `delivery/*.png` 4 帧 | v7 `delivery/atlas.animations.png` | 按图集 `atlasRect`（y=192，x=64/112/160/208，48×64）**无损裁出** |
| `prompts/actual.idle{1..4}.txt` | 19i `failed-2026-10-19T11-50-47-861Z/authoring/generated/` | 真实生成 Prompt，**32 色** |
| `prompts/pack.idle{1..4}.txt` | v7 `authoring/generated/` | 由 34 色 stylespec **重建**的 Prompt，**不是**实际生成输入 |

- v7 包：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
  （`assetpack/v4`，manifest `ruin-scavenger-extraction-assets` v7，入库提交 `e267ac4`）。
- 19i 失败现场：`.scratch/style-migration-v1/runs/2026-10-19i-real-frames/ruin-scavenger-extraction-assets/failed-2026-10-19T11-50-47-861Z/`。
  日志 `.scratch/style-migration-v1/runs/2026-10-19i-real-frames/http-calls.log`：
  `model=gemini-2.5-flash-image`、70 次图像请求、68×200、66×`image/png`，最终因 `office-debris` 失败。
- 模型是 alias（`gemini-2.5-flash-image`），不是 dated snapshot；本基线**不依赖**重生成。

## 32 色与 34 色的区别

- 19i 真实生成时用 32 色 stylespec；v7 导入时用 34 色 stylespec。
- v7 比 19i 多 `#59503b`、`#50432b` 两个色号；两份 Prompt 的差异**只有这一行调色板**。
- 4 张 raw 从 19i 到 v7 逐字节相同 —— 换色板发生在导入阶段，没有重新生成图片。
- 需要「同文本输入」做模型对比时用 `actual.*`；需要「重放 v7 34 色导入」时用 `pack.*`。
  `pack.*` 在任何报告里都不得标成真实生成 Prompt。

## hash 口径

- `sha256`：文件原始字节的 SHA-256。
- `pixelSha256`：解码后 RGBA8 行主序像素的 SHA-256（不含宽高头）。交付帧的像素 hash 与
  d 票 §3.2 的 `d21d898d…` / `2e826602…` / `7bb59d2f…` / `cc68e5f0…` 一致。
- `master` 同时记录输入母版与包内副本：两者**逐像素相同**，但 PNG 重编码后**字节 hash 不同**
  （`e8ea2999…` vs `5b264bbd…`），所以不能拿包内副本的 byte hash 当输入 hash。

## 不重生成声明

本目录的 PNG 全部由既有产物**复制或裁切**而来，零付费、零生成调用：

- 没有重生成任何图片；
- 没有修改 v7 包、19i 现场或既有资源；
- raw 的 4 个 sha256 在 19i → v1 → … → v7 连续且逐字节相同，禁止用重生成替换。
- v7 `ledger.json` 的 `calls` 为空：v7 是零付费重建，不是生成账本；真实账本在 19i 日志（未入库）。

## 回归

```sh
pnpm exec vitest run packages/assets/tests/animation-baseline.test.ts
```

测试实际校验 4 raw hash、4 delivery hash 与图集矩形像素、manifest/图集 checksum、
Prompt 的 32/34 色区分，以及用 `animation-metrics.ts` 复算的期望指标（容差见
`baseline.json` 的 `expectedMetricsTolerance`）；失败信息定位到 `资源.动画.帧`。
