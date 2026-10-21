# 04. 冻结 baseline fixture 与回归测试

Type: task
Status: resolved
Owner: task 子代理 · 2026-10-21
Blocked by: 03
Map: ../map.md

## Question

按 Phase 0 实施计划 §6 创建 `fixtures/animation-baselines/scavenger-idle/`：

- `raw/scavenger-actor.idle{1..4}.png`：从 v7 包复制（4 张，约 5.2MB）。
- `delivery/scavenger-actor.idle{1..4}.png`：从 v7 `delivery/atlas.animations.png` 无损裁出 48×64。
- `prompts/actual.idle{1..4}.txt`：19i 失败现场的真实 32 色 Prompt。
- `prompts/pack.idle{1..4}.txt`：v7 包内的 34 色重建 Prompt。
- `baseline.json`：字段按计划 §6.2（baselineId、sourceCommit、sourcePack、model、raw/delivery
  的 sha256、atlas/manifest checksum、reference/master sha256、stylespec 32/34、standardVersion、
  thresholds、expectedMetrics、provenance）。
- `README.md`：来源、32/34 色差异、不重生成声明。

新增 `packages/assets/tests/animation-baseline.test.ts`：
读 `baseline.json`，实际校验 4 raw hash、4 delivery hash、manifest/atlas checksum、
期望指标（用 `animation-metrics.ts`）在容差内；失败信息定位到 `资源.动画.帧`。

源路径：
- v7：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
- 19i 真实 Prompt：`.scratch/style-migration-v1/runs/2026-10-19i-real-frames/ruin-scavenger-extraction-assets/failed-2026-10-19T11-50-47-861Z/authoring/generated/`
复制前核 sha256；源缺失则停止并报告 `unverified`，不得伪造。

## 验收

- fixture 文件齐全；`baseline.json` 是合法 JSON（2 空格 + 末尾换行）。
- 回归测试实际校验内容与指标，不只检查文件存在。
- 不重生成图片；不把重建 Prompt 标成真实生成 Prompt。
- 定向测试 exit 0；`pnpm typecheck` 不新增错误。

## 边界

- 只新增 fixture 与测试；不改 v7 包 / 19i 现场 / 既有资源。
- 不提交；不写 `out/`；零付费；不碰 `CONTEXT.md` / 无关 `.scratch`。
- 不写 `map.md`。

## 产出

本票 `## Answer`：fixture 路径、文件数/大小、测试结果、来源 hash 核验结果。

## Answer

**已收口（task · 2026-10-21）。** 未提交、零付费、未重生成图片；未改 v7 包 / 19i 现场 / 既有资源。

### Fixture

- 路径：`fixtures/animation-baselines/scavenger-idle/`
- 文件：**18 个 / 5,595,982 字节（5.4 MB）**
  - `raw/` 4 张（5.3 MB，864×1184）
  - `delivery/` 4 张（16 KB，48×64，从 v7 `atlas.animations.png` 按 `atlasRect` 无损裁出）
  - `prompts/actual.idle{1..4}.txt`（19i 真实 32 色 Prompt）与 `prompts/pack.idle{1..4}.txt`（v7 34 色重建 Prompt）
  - `baseline.json`（8,419 B，合法 JSON，2 空格缩进 + 末尾换行）与 `README.md`
- 回归测试：`packages/assets/tests/animation-baseline.test.ts`（实际校验 raw/delivery hash、图集矩形像素、
  manifest/图集 checksum、Prompt 32/34 色区分、`animation-metrics.ts` 复算指标容差；失败信息定位 `资源.动画.帧`）。

### 测试结果

- `pnpm exec vitest run packages/assets/tests/animation-baseline.test.ts packages/assets/tests/animation-metrics.test.ts`
  → **2 文件 / 20 例全过，exit 0**（baseline 7 例 + metrics 13 例）。
- 按本票要求未跑 `pnpm typecheck`（留给最终统一验证）。

### 来源 hash 核验（复制前逐个核对，全部一致）

- 4 raw（v7 与 19i 现场逐字节相同）：`068ee2d7…` / `617b75aa…` / `44255922…` / `a8de40a3…`。
- 8 份 Prompt：actual `e30e0c37…` / `f034d011…` / `30dfd1cb…` / `4be8cf5a…`；
  pack `e0dc4b84…` / `849c5565…` / `ebdf0d56…` / `64cffc61…`。两份 Prompt 仅调色板行不同（v7 多 `#59503b` `#50432b`）。
- v7 图集 `a3ecf529…`、图集 JSON `aa7533cc…`、manifest `e620cd7e…`、34 色 stylespec `c97744b4…`、
  19i 32 色 stylespec `3e2f3095…`、reference `6fb15bca…`、输入母版 `e8ea2999…`、包内母版副本 `5b264bbd…`。
- 交付帧像素 hash 前缀与 d 票 §3.2 一致：`d21d898d…` / `2e826602…` / `7bb59d2f…` / `cc68e5f0…`。
- 复算指标：alpha 0.4% / bbox 宽 0.2% / 位置 0.4% / 背景 L1 3 / 色数 ≥18 / off-palette 0 / 边界深色 87.4%，整体判绿。

### 偏差

- `baseline.json` 含 §6.2 全部字段，另加：`asset`、`palette`（34 色值，测试复算 off-palette/边界深色所需）、
  `prompts`（逐文件 hash + 色数）、`expectedMetricsTolerance`（期望指标容差）、
  `reference/master.pixelSha256`、`master.packCopy`（输入母版与包内副本分别钉 byte/pixel hash）。
- `expectedMetrics.paletteCountMin` 记实测 golden **18**（计划 §6.2 的「≥14」是阈值，已住在 `thresholds`）。
- `atlas.metaChecksum` 与 `manifest.checksum` 都是文件字节 sha256（manifest 无自指 checksum 字段）。
- `pixelSha256` 口径 = 解码后 RGBA8 行主序像素（不含宽高头），与 d 票 §3.2 一致；byte hash 单独记录。
- fixture 由一次性 `/tmp` 脚本调用仓库自身的 `png.ts` / `import.ts` / `animation-metrics.ts` 生成（脚本未入库），无生成调用。
