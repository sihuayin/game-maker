# 05. 结构验收器 + 报告 writer + 负例测试

Type: task
Status: resolved
Owner: task 子代理 · 2026-10-21
Blocked by: 02, 03
Map: ../map.md

## Question

新增 `packages/assets/src/acceptance.ts`：

1. `acceptAnimationPack(opts)`：调用 `verifyPack`；用 `AtlasJson` 解析图集 JSON；
   解码图集 PNG；按 Phase 0 实施计划 §5 的 1–13 项检查；返回结构化 findings
   （code/severity/message/file?/assetId?/anim?/frame?）。
2. `writeAcceptanceReport`：写 `animation-acceptance/v1` 报告到
   `out/<packId>/acceptance/v<N>/report.json` + `report.md`；版本分配不得覆盖既有报告。
3. 从 `packages/assets/src/index.ts` 导出。

**实现前必须检查**仓库既有的版本分配（`nextPackVersion` / `nextVersion` / `nextSiteVersion`）、
路径安全（`PackPath`、`path.resolve`）和失败处理惯例；不得凭本票假设。`manifest.id` 若不能安全
用作目录名，须明确处理（拒绝或安全 slug）。

验收语义：
- 验收 findings 不抛异常；core 返回结果，CLI 决定 exit 1。
- 输入不合法（坏 manifest / baseline schema 不过）抛 `CommandError("invalid")`（exit 4）。
- findings 为空 ⇒ CLI exit 0；有 `severity: "error"` ⇒ exit 1。
- 报告即使有 findings 也要写盘。

新增 `packages/assets/tests/acceptance.test.ts`：
v7 正例；非 PNG、越界矩形、缺帧、幽灵帧、`atlases[].frames` 说谎、锚点/尺寸不一致、
跨资源同名帧负例；报告 schema/版本不覆盖测试。

## 验收

- `acceptAnimationPack` 对 v7 结构全绿；负例定位到 file/resource/frame。
- 报告通过 `parseAnimationAcceptance`；版本不覆盖。
- 定向测试 exit 0；`pnpm typecheck` 不新增错误。

## 边界

- 只改 `acceptance.ts` + `assets/src/index.ts` + 新测试；不改 `verifyPack` 语义。
- 不提交；不写 `out/`（测试用临时目录）；零付费；不碰 `CONTEXT.md` / 无关 `.scratch`。
- 不写 `map.md`。

## 产出

本票 `## Answer`：API、检查清单、版本分配实现、测试结果、偏差。

## Answer

**已收口（task · 2026-10-21）。** 未提交、零付费、未写仓库 `out/`；未改 `verifyPack` / 契约语义。

### API

- `acceptAnimationPack({ packDir, baselineDir?, now?, toolVersion? })` → `{ report, hasErrors, summary }`。
  `report` 是 `animation-acceptance/v1` 对象（写盘前再走 `parseAnimationAcceptance`）。
  `hasErrors` = 存在 `severity: "error"`（CLI exit 1 的唯一判据；warning / info 不阻断）。
- `writeAcceptanceReport({ report, outDir? })` → `{ version, dir, reportJson, reportMarkdown }`
  （相对 `outDir` 的 POSIX 路径），默认 `outDir = ./out`；写
  `out/<packId>/acceptance/v<N>/report.json` + `report.md`。
- `ACCEPTANCE_FINDING_CODES`：**21 个 code 的闭集**（`atlas.frame.out-of-bounds` /
  `atlas.frame.ghost` / `animation.frame.order` / `metrics.unavailable` …）；所有 finding 都由
  `finding()` 构造，无定位字段直接抛实现 bug。契约层 `code` 仍是 `string`（票 02 的边界）。
- `nextAcceptanceVersion(acceptanceDir)` 一并导出；`packages/assets/src/index.ts` 已导出
  `acceptance.js`。

### 检查清单（计划 §5）

1. `verifyPack` → schema + `files[]` 存在/大小/sha256 + 反向穷举；失败一律 `CommandError("invalid")`（exit 4）。
2. 图集 `meta`/`image` 在 `files[]`；图集 JSON 过 `AtlasJson`（坏 JSON / schema 各一条 error）。
3. PNG 解码；`atlases[].size` == PNG 宽高。
4. `atlases[].frames` == 图集 JSON 帧键数。
5. `atlases[].checksum` == 实际 PNG sha256。
6. 每帧矩形 `x,y >= 0`、`w,h > 0`、`x+w <= image.w`、`y+h <= image.h`。
7. manifest 帧 ↔ 图集 JSON 双向：缺失 error，孤儿帧 warning（`atlas.frame.ghost`）。
8. `Animation.frames[]` 存在、无重复、相对顺序与 manifest `frames[]` 一致。
9. `sourceSize` == 资源 `size`；图集矩形与 `spriteSourceSize`（含 rotated）一致；
   `trimmed=false` 时 `spriteSourceSize` 必须是完整源尺寸；trim 不越界；锚点在 manifest 与图集逐帧一致。
10. `scale9Borders` 在 manifest / 图集之间一致（存在时；单边缺也算不一致）。
11. 跨资源同名帧 error（含 `atlas.ts` 的静默覆盖风险）。
12. `fps` / `loop` 只抄进 `declared`，不验运行时；runtime 固定 `unverified`。
13. 定位字段由 `finding()` 强制（构造期检查）。

### 版本分配 / 路径安全

- 版本：沿用 `nextPackVersion` / `nextSiteVersion` 的「扫 `v<N>`、取最大 +1」口径，但**不先读再写**：
  `fs.mkdirSync(v<N>)` 以 `EEXIST` 抢占，冲突就试下一个 N（并发写者不会算出同一个版本）。
  既有 `v1` 永不覆盖；测试验证 v1 逐字节不变、第二次写落到 v2。
- `manifest.id`：写入前用 `^[A-Za-z0-9][A-Za-z0-9._-]*$` 且拒绝 `.` / `..`；不合法直接
  `CommandError("invalid")`（exit 4），不做 slug（避免 `a/b` 与 `a-b` 混进同一目录）。
- 报告 JSON 用 `JSON.stringify(o, null, 2) + "\n"`（与 `pack.ts` / `artifacts.ts` 同款）。

### baseline

- 读 `<baselineDir>/baseline.json`，schema 按计划 §6.2；不合法 → `CommandError("invalid")`（exit 4）。
  报告写 `baseline: { id, path, checksum, standardVersion }`，`checksum` 是 baseline.json 字节 sha256。
- **每个动画**（票面原文）都计算 metrics/verdict：raw 取包内 `authoring/**` 的 bitmap 源帧，
  交付帧从图集 PNG 按 `frame` 矩形裁出，色板优先用 `baseline.palette.values`（票 04 追加字段），
  否则用 `manifest.palette.values`；量法逐项调用 `animation-metrics.ts`，判档 `verdictOf`。
  任一帧缺 raw / 解码失败 / 图集矩形不可用 / 边界深色为 null ⇒ `metrics: null` + `info`
  的 `metrics.unavailable`（不抛）。无 baseline ⇒ 全动画 `metrics` / `verdict` 为 null。
- 与票 04 实际字段的对齐/偏差：实际 `raw[].sha256` / `delivery[].sha256` 是**无前缀** 64 位 hex，
  schema 接受该形状；`asset` / `palette` / `prompts` / `expectedMetricsTolerance` / `pixelSha256` /
  `packCopy` 等计划 §6.2 之外的追溯字段通过 `.passthrough()` 容忍（只消费被用到的字段）。
  `palette` 为可选。若 baseline 的 raw 帧名不在包里，记 warning `baseline.frame-unmatched`。

### 测试

`pnpm exec vitest run packages/assets/tests/acceptance.test.ts
packages/assets/tests/animation-metrics.test.ts packages/assets/tests/animation-baseline.test.ts`
→ **3 文件 / 37 例全过，exit 0**（acceptance 17 例，含 v7 正例、非 PNG、越界、缺帧、幽灵帧、
`atlases[].frames` 说谎、锚点/尺寸、跨资源同名、闭集、baseline、坏输入 exit 4、报告 schema /
有 findings 仍落盘 / 版本不覆盖 / 不安全 id）。

v7 正例（结构 + 真实 fixture baseline）：**findings 为空**；idle 复算 alpha 0.4% / bbox 宽 0.2% /
位置 0.4% / 背景 L1 3 / 色数 18 / off-palette 0 / 边界深色 87.4% / `verdict=green`。
包级 `tsc -p packages/assets/tsconfig.spec.json --noEmit` → **exit 0**（按票要求未跑根 `pnpm typecheck`）。

### 偏差 / 备注

- 定向测试前执行了 `tsc -b packages/contracts/tsconfig.json`：票 02 的新契约尚未编译进
  gitignored `packages/contracts/dist/`，而 `assets` 测试按仓库惯例从 `@game-maker/contracts` 导入。
  只写 `dist/`，未改源码，不入库。
- metrics 的数据源是**被验收包自己的 raw + 交付帧**（baseline 提供身份、标准版本与色板）；
  这与 Tier 2 `compare.ts` 的「基线 vs 候选」不同，后者仍留给 Tier 2。
- v7 的 metrics 计算约 9.5s（61 帧 raw 解码 + cleanBBox），测试设 120s 超时；
  `pnpm test` 默认 5s/例不适用。
- 未提交、未推送；`CONTEXT.md` / 无关 `.scratch` / v7 包 / fixture 均未改。
