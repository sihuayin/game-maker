# Animation & Asset Acceptance V1 — Phase 1 文件级实施计划

| 属性 | 内容 |
|---|---|
| 项目 | `sihuayin/game-maker` |
| 阶段 | Phase 0 → Phase 1 计划 |
| 基线 | `main` · `f0dac01` |
| 日期 | 2026-10-21 |
| 任务书 | [动画.md](动画.md) |
| 现状报告 | [phase-0-current-state.md](phase-0-current-state.md) |
| 缺口分析 | [phase-0-gap-analysis.md](phase-0-gap-analysis.md) |
| 测试清单 | [phase-0-test-inventory.md](phase-0-test-inventory.md) |

## 0. 已裁定的 Phase 1 边界（Q1–Q8 全部 A）

| 问题 | 裁定 | 对施工的约束 |
|---|---|---|
| Q1 运行时保真 | 不修运行时；`accept` 只做只读运行取证，报告「声明 vs 实际」 | 不改 `world.ts` / `scene.ts` / `entry.ts` 的播放行为 |
| Q2 命令与门禁 | 新增 `accept` CLI + MCP `accept_asset_pack`；opt-in；**不接入 `runBuild` 阻断** | 不改 `runBuild` 的门禁；CLI/MCP 共用 core |
| Q3 结构验收落点 | `packages/assets` 新模块 | 不新建 package；不破 `check-deps` |
| Q4 报告与追溯 | 新增 `animation-acceptance/v1`；可选 `run-build-record/v1` | 不扩 `qa-report/v1` 的语义 |
| Q5 基准冻结 | `fixtures/animation-baselines/scavenger-idle/` + `baseline.json` + 回归测试 | **不重生成**；记录 32/34 色 Prompt 差异 |
| Q6 视觉审查 | 免费带标签联系表 + 循环预览 + 人裁模板，写回 `humanVerdict` | 不引入付费视觉模型 |
| Q7 测试与前置 | 先修两处 typecheck；负例 + 回归 + 阈值 + schema；CDP opt-in | 不引入 Playwright/Puppeteer |
| Q8 分层顺序 | Tier 1 先交付，Tier 2 随后，Tier 3 延后 | 每层可独立验收、独立回归 |

**本文件只给计划，不施工。** 所有路径以当前 HEAD 的实际结构为准。

## 1. Phase 1 范围

### Tier 1 — 最小可交付验收（先做）

1. 修 `pnpm typecheck` 的两处测试类型错误。
2. 新增 `AtlasJson` 契约与 `animation-acceptance/v1` 契约。
3. 新增纯动画指标模块（票 12 阈值）。
4. 冻结 v7 `scavenger-actor` idle 4 帧为 baseline fixture，并加回归测试。
5. 新增交付态结构验收器（PNG / 图集 JSON / 边界 / 锚点 / `frames` 计数 / `checksum` 对账）。
6. 新增 CLI `accept` 与 MCP `accept_asset_pack`，输出版本化验收报告。
7. 对 v7 包跑出第一份 `animation-acceptance/v1` 报告。

**Tier 1 完成判据**：`game-maker accept <v7 pack>` 能 exit 0（结构全绿）并写出可回溯报告；
所有负例测试通过；`pnpm test` 全绿；`pnpm typecheck` 全绿。

### Tier 2 — 视觉与运行时证据（随后）

1. 带标签联系表 + 逐动画循环预览 + 7 项人裁模板；写回报告 `human`。
2. `compare.ts`：基线 vs 候选的指标比较，复用票 12 阈值。
3. `packages/demo/probe/cdp-animation.mjs`：参数化只读 CDP 探针（截图 / console / network / 采样）。
4. `run-build-record/v1`：run → pack → site → qa 索引 sidecar。

**Tier 2 完成判据**：任一包/候选 run → 一条免费命令产出带标签联系表 + 循环预览 + 人裁模板；
CDP 探针可重复产出运行时证据；build record 可解析四元组。

### Tier 3 — 延后（另立票）

- 修运行时 `fps` / `loop` / `durationMs` 消费（G-10）。
- 固定动画场景 / 公开触发入口（G-07）。
- 录屏能力（G-08 的剩余部分）。
- 付费视觉模型（`review`）纳入验收流程。
- Playwright/Puppeteer 与 CI（G-12 / G-22）。
- 把验收接入 `runBuild` 门禁（Q2 A 明确不做）。
- QA 报告按 attempt 版本化（先只做 build record 钉 checksum）。

## 2. 总体结构

```
packages/contracts
  atlas-json.ts               ← 新增：图集 JSON schema
  animation-acceptance.ts     ← 新增：验收报告 schema
  build-record.ts             ← Tier 2：run-build-record/v1

packages/assets
  animation-metrics.ts        ← 新增：纯指标（Tier 1）
  acceptance.ts               ← 新增：结构验收器 + 报告 writer（Tier 1）
  compare.ts                  ← Tier 2：基线 vs 候选比较
  preview.ts                  ← Tier 2：带标签联系表 / 循环预览

packages/cli
  cli.ts                      ← 新增 accept 命令（Tier 1）；--visual（Tier 2）

packages/mcp
  server.ts                   ← 新增 accept_asset_pack（Tier 1）

packages/demo
  probe/cdp-animation.mjs     ← Tier 2：参数化 CDP 探针

packages/pipeline
  artifacts.ts / create-game.ts ← Tier 2：写 build record

fixtures/animation-baselines/scavenger-idle/  ← Tier 1：冻结基准
```

依赖方向不变：`assets` → `contracts`；`cli`/`mcp` → `assets`/`contracts`/`demo`/`pipeline`；
`demo` 的探针脚本是**独立 node 脚本**，不进入包依赖图；`pipeline` 不新增 `demo` 边。

## 3. 文件级实施计划

### 3.1 Tier 1

| # | 目标文件 | 当前职责 | 拟进行的改动 | 为什么 | 对应测试 | 依赖影响 |
|---|---|---|---|---|---|---|
| 1 | `packages/assets/tests/pack-sheet-grid.test.ts` | 九宫格出帧测试 | 在 `:150` 的假 generator 返回值补 `requestedSize` | 修 `pnpm typecheck` TS2322 | 自身 | 无 |
| 2 | `packages/assets/tests/prompt.test.ts` | 提示词测试 | 在 `:257` 导入 `CharacterDNA`（或改类型引用） | 修 `pnpm typecheck` TS2304 | 自身 | 无 |
| 3 | `packages/contracts/src/atlas-json.ts` **新增** | — | 定义 `AtlasFrame` / `AtlasJson`：`frames` record；每帧 `frame{x,y,w,h}`、`rotated`、`trimmed`、`spriteSourceSize`、`sourceSize`、可选 `anchor` / `scale9Borders`；`meta` 宽松 | 图集 JSON 目前只有 TS 类型，无 schema；验收器需要可信解析 | `packages/contracts/tests/atlas-json.test.ts` | 仅 `contracts` 内部 + 导出；无新依赖 |
| 4 | `packages/contracts/src/animation-acceptance.ts` **新增** | — | `animation-acceptance/v1` Zod schema + `parseAnimationAcceptance`（见 §4.1） | 统一验收报告，装包/基线/指标/findings/人裁/运行时证据 | `packages/contracts/tests/animation-acceptance.test.ts` | 仅 `contracts` |
| 5 | `packages/contracts/src/index.ts` | 契约导出 | 导出 `atlas-json.js` / `animation-acceptance.js` | 让 `assets` / `cli` / `mcp` 共用 | 类型检查 | 无 |
| 6 | `packages/assets/src/animation-metrics.ts` **新增** | — | 纯函数：`alphaMaskDiff`、`cleanBBox`、`bboxWidthDiffPct`、`positionDriftPct`、`dominantColorL1`、`paletteCount`、`offPaletteCount`、`boundaryDarkPct`、`verdictOf`；阈值常量来自票 12 | 把 `.scratch` 4 份脚本的读数收成一处；可单测 | `packages/assets/tests/animation-metrics.test.ts` | 复用 `image.ts` / `png.ts`；无新依赖 |
| 7 | `packages/assets/src/acceptance.ts` **新增** | — | `acceptAnimationPack(opts)`：调用 `verifyPack`；解析 `AtlasJson`；解码图集 PNG；逐项检查（见 §5）；返回结构化 findings；`writeAcceptanceReport` 写 JSON/Markdown | G-01 的核心；输出可定位到 file/resource/frame | `packages/assets/tests/acceptance.test.ts` | 复用 `ops.ts` / `png.ts` / `atlas.ts`；无新依赖 |
| 8 | `packages/assets/src/index.ts` | 导出 | 导出 `animation-metrics.js` / `acceptance.js` | CLI/MCP 调用 | 类型检查 | 无 |
| 9 | `fixtures/animation-baselines/scavenger-idle/` **新增** | — | 4 raw + 4 交付帧 + `prompts/actual.*`（32 色）+ `prompts/pack.*`（34 色）+ `baseline.json` + `README.md` | G-03 基准冻结；详见 §6 | `packages/assets/tests/animation-baseline.test.ts` | 新增约 5.2MB raw + 小交付帧；无代码依赖 |
| 10 | `packages/assets/tests/animation-baseline.test.ts` **新增** | — | 读 `baseline.json`，校验 raw/交付 hash、manifest/atlas checksum、指标在容差内 | 防止基准被无声篡改；补 v7 零测试引用 | 自身 | 读 fixture |
| 11 | `packages/assets/tests/acceptance.test.ts` **新增** | — | 正例 v7 / baseline；负例：非 PNG、越界矩形、缺帧、幽灵帧、`frames` 说谎、锚点/尺寸不一致、跨资源同名帧 | G-09 回归保护 | 自身 | 读 v7 + 合成包（临时目录） |
| 12 | `packages/cli/src/cli.ts` | 参数解析 + 命令 dispatch + 渲染 | 加 `accept` 命令、USAGE、退出码映射、`--baseline` / `--out` / `--json`；调用 `acceptAnimationPack` + `writeAcceptanceReport` | Q2 A：opt-in CLI 入口 | `packages/cli/tests/cli.test.ts` | 新增 import `assets` 导出；无跨包新边 |
| 13 | `packages/mcp/src/server.ts` | MCP 7 工具 | 加 `accept_asset_pack` 工具与 dispatch；`structuredContent` 返回同一份报告数据 | Q2 A：CLI/MCP 共用 core | `packages/mcp/tests/server.test.ts` | 无新依赖 |
| 14 | `packages/contracts/tests/atlas-json.test.ts` **新增** | — | 正例 v7 四张图集；负例缺字段/类型错/负宽高 | G-11 | 自身 | 读 v7 |
| 15 | `packages/contracts/tests/animation-acceptance.test.ts` **新增** | — | 正例最小报告；负例缺 pack identity / 未知 meta / findings 定位字段类型错 | G-02 | 自身 | — |

### 3.2 Tier 2

| # | 目标文件 | 当前职责 | 拟进行的改动 | 为什么 | 对应测试 | 依赖影响 |
|---|---|---|---|---|---|---|
| 16 | `packages/assets/src/compare.ts` **新增** | — | `compareToBaseline(metrics, baseline)`；绿/黄/红；输出 diff；复用 `animation-metrics.ts` 与票 12 阈值 | G-04 比较编排；替代 4 份脚本 | `packages/assets/tests/compare.test.ts` | 依赖 metrics + baseline schema |
| 17 | `packages/assets/src/preview.ts` **新增** | — | `packContactSheetWithLabels`（复用 `packContactSheet` + 文字标签）；逐动画 loop HTML；`human-review.json` 模板 | G-05 / G-17 / G-18 | `packages/assets/tests/preview.test.ts` | 复用 `review.ts` / `sheet.ts` / `encodePNG` |
| 18 | `packages/cli/src/cli.ts` | 同 #12 | `accept --visual`：生成联系表 / loop preview / 人裁模板，写进报告 `human` / `evidence` | Q6 A | `cli.test.ts` | 无 |
| 19 | `packages/mcp/src/server.ts` | 同 #13 | `accept_asset_pack` 增 `visual?: boolean` | 与 CLI 对齐 | `server.test.ts` | 无 |
| 20 | `packages/demo/probe/cdp-animation.mjs` **新增** | 现有 `packages/demo/probe/smoke.mjs` 只作模式参考 | 参数化 `--serve-root` / `--entry` / `--out` / `--clips` / `--samples`；只写指定目录；采集截图/console/network/采样 JSON | Q3 A + G-08；不改运行时 | 手动 / `test:runtime` opt-in | 独立 node 脚本；无包依赖 |
| 21 | `packages/demo/probe/README.md` **新增** | — | 运行前置（Chrome、HTTP 根、只读边界）与输出说明 | 可复现 | — | — |
| 22 | `packages/contracts/src/build-record.ts` **新增** | — | `run-build-record/v1` schema（见 §4.3） | G-06 / G-24–G-26 | `packages/contracts/tests/build-record.test.ts` | 仅 contracts |
| 23 | `packages/pipeline/src/artifacts.ts` | run 九项读写 | 新增 `builds/` 路径与 `writeBuildRecord`；不新增第十项 run 产物 | 索引 sidecar，不改现有九项 | `create-game.test.ts` | 仅 pipeline 内部 |
| 24 | `packages/pipeline/src/create-game.ts` | `runBuild` | 在成功/失败边界写 `builds/v<M>.json`；只在知道 stage 的边界填一次 | G-06 | `create-game.test.ts` | 无新跨包边 |
| 25 | `packages/pipeline/tests/create-game.test.ts` | 端到端测试 | 断言 build record 的 join key / checksum / stages / error | G-06 | 自身 | — |

### 3.3 Tier 3（不在 Phase 1 施工）

| 目标文件 | 拟改动 | 为什么延后 |
|---|---|---|
| `packages/demo/src/world.ts` / `shell/scene.ts` | 把 `fps` / `loop` 带进 `WorldDescription`；`frameRate` / `repeat` 读取声明 | Q1 A：验收能力先独立成立；行为变更另立票 |
| `packages/demo/src/shell/entry.ts` | 暴露固定动画场景 / `window.__gm` 只读句柄 | G-07；需单独设计 |
| `package.json` / `packages/*/package.json` | Playwright/Puppeteer、`test:runtime` project | Q7 A：不引入重依赖 |
| `.github/workflows/*` | CI | G-12；无现成 CI 约定 |

## 4. 新增契约草案

### 4.1 `animation-acceptance/v1`

```jsonc
{
  "format": "animation-acceptance/v1",
  "createdAt": "2026-10-21T00:00:00.000Z",
  "toolVersion": "0.0.0",
  "pack": {
    "id": "ruin-scavenger-extraction-assets",
    "version": 7,
    "manifestChecksum": "sha256:...",
    "atlases": [
      { "id": "animations", "imageChecksum": "sha256:...", "metaChecksum": "sha256:..." }
    ]
  },
  "baseline": {
    "id": "scavenger-actor.idle.v7.2026-10-19",
    "path": "fixtures/animation-baselines/scavenger-idle/baseline.json",
    "checksum": "sha256:...",
    "standardVersion": "ticket-12/2026-10-21"
  },
  "animations": [
    {
      "assetId": "scavenger-actor",
      "anim": "idle",
      "frames": ["scavenger-actor.idle1", "scavenger-actor.idle2",
                 "scavenger-actor.idle3", "scavenger-actor.idle4"],
      "declared": { "fps": 6, "loop": true },
      "metrics": {
        "alphaMaskDiffPct": 0.4,
        "bboxWidthDiffPct": 0.2,
        "positionDriftPct": 0.4,
        "backgroundL1": 3,
        "paletteCountMin": 18,
        "offPalette": 0,
        "boundaryDarkPctMin": 87.4
      },
      "verdict": "green",
      "findings": []
    }
  ],
  "findings": [
    {
      "code": "atlas.frame.out-of-bounds",
      "severity": "error",
      "message": "帧矩形超出图集：x+w=10048 > 256",
      "file": "delivery/atlas.animations.json",
      "assetId": "scavenger-actor",
      "anim": "idle",
      "frame": "scavenger-actor.idle1"
    }
  ],
  "human": {
    "verdict": "pending",
    "reviewer": null,
    "reviewedAt": null,
    "items": [
      { "key": "identity", "label": "身份 / 轮廓 / 比例", "verdict": "pending", "note": "" },
      { "key": "pose", "label": "姿势族", "verdict": "pending", "note": "" },
      { "key": "lighting", "label": "明暗 / 色板", "verdict": "pending", "note": "" },
      { "key": "loop", "label": "无呼吸 / 跳变", "verdict": "pending", "note": "" },
      { "key": "alpha", "label": "透明边缘", "verdict": "pending", "note": "" },
      { "key": "outline", "label": "1px 描边", "verdict": "pending", "note": "" },
      { "key": "style", "label": "风格一致", "verdict": "pending", "note": "" }
    ],
    "evidence": []
  },
  "runtime": {
    "status": "unverified",
    "evidence": [],
    "declaredVsActual": [
      { "anim": "jump", "declaredFps": 10, "actualFps": 6,
        "declaredLoop": false, "actualLoop": true }
    ]
  }
}
```

约束：

- `findings[].code` 是闭集；`severity` 只用 `error` / `warning` / `info`。
- `file` / `assetId` / `anim` / `frame` 全部可选，但**至少一个定位字段**必须存在（superRefine）。
- `human.verdict` 只用 `pending` / `pass` / `fail`；7 项 `items` 必须齐。
- `runtime.status` 只用 `verified` / `unverified` / `not-run`；`runtime` 不参与结构验收的 exit code。
- `metrics` 只在有 baseline 时出现；没有 baseline 时为 `null`。

### 4.2 `AtlasJson`

```ts
const Frame = z.object({
  frame: z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative(),
                    w: z.number().int().positive(), h: z.number().int().positive() }).strict(),
  rotated: z.boolean().default(false),
  trimmed: z.boolean().default(false),
  spriteSourceSize: z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative(),
                               w: z.number().int().positive(), h: z.number().int().positive() }).strict(),
  sourceSize: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).strict(),
  anchor: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict().optional(),
  scale9Borders: z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative(),
                            w: z.number().int().positive(), h: z.number().int().positive() }).strict().optional(),
}).strict();

export const AtlasJson = z.object({
  frames: z.record(z.string().min(1), Frame),
  meta: z.record(z.unknown()).optional(),
}).strict();
```

对齐 v7 实际形状（`frames` + `meta`；帧含 `frame` / `rotated` / `trimmed` / `spriteSourceSize` /
`sourceSize` / `anchor`）。若未来 TexturePacker 加入额外键，再显式加或放宽；**不要**用
`.passthrough()` 无声吞掉未知字段。

### 4.3 `run-build-record/v1`（Tier 2）

```jsonc
{
  "format": "run-build-record/v1",
  "createdAt": "...",
  "gameId": "...",
  "runVersion": 1,
  "attempt": 1,
  "inputs": {
    "intentMd":    { "path": "intent.md", "checksum": "sha256:..." },
    "recipe":      { "path": "asset-recipe.json", "checksum": "sha256:..." },
    "gameDesign":  { "path": "game-design.json", "checksum": "sha256:..." },
    "visualWorld": { "path": "visual-world.json", "checksum": "sha256:..." }
  },
  "pack": {
    "id": "...", "version": 2,
    "manifest": { "path": ".../pack/v2/manifest.json", "checksum": "sha256:..." },
    "ledger":   { "path": ".../pack/v2/ledger.json",   "checksum": "sha256:..." },
    "coverage": { "path": ".../pack/v2/coverage.json", "checksum": "sha256:..." }
  },
  "qa": { "path": "run/v1/qa-report.json", "checksum": "sha256:...",
          "verdict": "incomplete", "errors": 0, "warnings": 0 },
  "site": { "version": 2, "dir": ".../site/v2", "siteJsonChecksum": "sha256:..." },
  "stages": [ { "step": "pack", "status": "ok" }, { "step": "config", "status": "ok" },
              { "step": "qa", "status": "ok" } ],
  "error": { "kind": "invalid", "stage": "qa", "message": "...",
             "file": "run/v1/qa-report.json", "resource": "...", "frame": "..." }
}
```

只存路径 + checksum + 派生计数；**不复制** `findings[]` / `calls[]`；`error` 只在失败时出现。

## 5. 结构验收器检查清单

`acceptAnimationPack` 至少检查：

1. `verifyPack` 通过（schema + `files[]` 存在/大小/sha256 + 反向穷举 + sidecar 身份）。
2. 每张图集 `meta` / `image` 在 `files[]` 中；图集 JSON 过 `AtlasJson` schema。
3. 图集 PNG 可解码；`atlases[].size` == PNG 宽高。
4. `atlases[].frames` == 图集 JSON 的帧键数。
5. `atlases[].checksum` == PNG sha256（当前零读者）。
6. 每个 `frame` 矩形满足 `x >= 0`、`y >= 0`、`w > 0`、`h > 0`、`x + w <= image.w`、
   `y + h <= image.h`。
7. manifest 的每个 `frames[].name` 在对应图集 JSON 中存在；图集 JSON 的每个帧都有 manifest 条目
   （双向；孤儿帧报 warning/error）。
8. `Animation.frames[]` 的每一项存在、顺序与 manifest 一致、无重复。
9. 资源 `size` 与帧矩形 / `spriteSourceSize` 一致；`anchor` 在 manifest 与图集逐帧之间一致
   （图集有 `anchor` 时）。
10. `scale9Borders` 在 manifest 与图集之间一致（存在时）。
11. 跨资源同名帧报 error（当前 `atlas.ts:86` 静默覆盖）。
12. `fps` / `loop` 在 manifest 中存在且合法（schema 已保证）；**不验证运行时**，只在报告里记录
    `declared`，运行时状态归 `runtime`。
13. `findings` 每条至少带 `file` / `assetId` / `anim` / `frame` 之一。

退出码：

- `0`：没有 `severity: "error"` 的 finding（warning 不阻断）。
- `1`：有 error finding（验收失败）。
- `2`：参数错。
- `4`：包/基线不合法（manifest 坏 JSON、baseline schema 不过等）。
- `3`：本命令不使用。

## 6. 基准冻结方案（Q5 A）

### 6.1 目录

```
fixtures/animation-baselines/scavenger-idle/
  README.md
  baseline.json
  raw/scavenger-actor.idle{1..4}.png          # 4 张，约 5.2MB
  delivery/scavenger-actor.idle{1..4}.png     # 4 张 48×64
  prompts/actual.idle{1..4}.txt               # 19i 的 32 色真实 Prompt
  prompts/pack.idle{1..4}.txt                 # v7 的 34 色重建 Prompt
```

### 6.2 `baseline.json` 字段

- `baselineId`：`scavenger-actor.idle.v7.2026-10-19`
- `sourceCommit`：`e267ac4`（v7 入库提交）
- `sourcePack`：v7 包路径 + `manifest.id/version`
- `model`：`gemini-2.5-flash-image`（来自 19i 日志）
- `raw`：4 × `{name, sha256}`
- `delivery`：4 × `{name, sha256, atlasRect{x,y,w,h}}`
- `atlas`：`{checksum, metaChecksum}`
- `manifest`：`{checksum}`
- `reference` / `master`：`{path, sha256}`（像素 hash；注明母版输入与包内副本重编码不同）
- `stylespec`：`{actual: 32色, pack: 34色}` + 两份 checksum
- `standardVersion`：`ticket-12/2026-10-21`
- `thresholds`：票 12 的绿/黄/红阈值
- `expectedMetrics`：alpha 0.4% / bbox 0.2% / position 0.4% / L1 3 / palette ≥14 /
  off-palette 0 / boundary 87.4%
- `provenance`：19i 失败现场路径、日志关键行（model / 70 发 / 66 PNG / 终态失败）

### 6.3 施工规则

- **不重生成**；raw 从 v7 复制，交付帧从 v7 图集无损裁出。
- 32 色 Prompt 从 19i failed 目录复制前先核 sha256；复制后写进 `baseline.json`。
- 若仓库体积敏感：raw 可改为只钉 `sha256` + v7 路径；但 Q5 A 已选 4 raw，默认按 A 执行。
- `last-train/v2` 只作辅助结构夹具，不进入视觉基准。
- 回归测试读 `baseline.json`，校验 raw/交付 hash、manifest/atlas checksum、指标容差。

## 7. 依赖关系与实施顺序

```text
Tier 1:
  1 修 typecheck
    ↓
  2 AtlasJson 契约 ──→ 3 animation-acceptance 契约
    ↓                        ↓
  4 animation-metrics ──→ 5 结构验收器 ──→ 6 CLI accept ──→ 7 MCP accept
    ↓                        ↑
  8 baseline fixture ────────┘
    ↓
  9 负例 / 基准回归测试
    ↓
 10 对 v7 出第一份报告

Tier 2:
 11 compare.ts ──→ 12 preview.ts / 人裁模板 ──→ 13 CLI --visual
 14 CDP 探针
 15 run-build-record 契约 ──→ 16 pipeline 写入 ──→ 17 报告关联
```

**顺序理由**：先修 typecheck，保证后续回归可信；先契约后实现；先指标再验收器再命令；
基准 fixture 可与指标并行；Tier 2 全部消费 Tier 1 的报告 schema。

## 8. 测试方案

### 8.1 新增测试（Tier 1）

| 测试文件 | 覆盖 |
|---|---|
| `packages/contracts/tests/atlas-json.test.ts` | v7 四张图集正例；缺字段/负宽高/类型错负例 |
| `packages/contracts/tests/animation-acceptance.test.ts` | 最小报告正例；缺身份/人裁项不全/finding 无定位负例 |
| `packages/assets/tests/animation-metrics.test.ts` | 用 qualify/finalist 现有读数做 fixture，逐项重算一致；阈值边界绿/黄/红 |
| `packages/assets/tests/animation-baseline.test.ts` | baseline.json 的 raw/交付 hash、manifest/atlas checksum、期望指标容差 |
| `packages/assets/tests/acceptance.test.ts` | v7 正例；非 PNG、越界、缺帧、幽灵帧、`frames` 说谎、锚点/尺寸不一致、跨资源同名帧负例 |
| `packages/cli/tests/cli.test.ts` | `accept` 人类/JSON 输出；exit 0/1/2/4；版本目录不覆盖 |
| `packages/mcp/tests/server.test.ts` | `accept_asset_pack` 正例/负例/structuredContent |

### 8.2 新增测试（Tier 2）

| 测试文件 | 覆盖 |
|---|---|
| `packages/assets/tests/compare.test.ts` | 基线 vs 候选；阈值边界；负例改一帧/改背景色 |
| `packages/assets/tests/preview.test.ts` | 联系表格数 = 动画帧数；标签回指 manifest；loop preview 含 fps/loop |
| `packages/contracts/tests/build-record.test.ts` | join key / checksum / stages / error 缺失语义 |
| `packages/pipeline/tests/create-game.test.ts` | 成功/失败边界的 build record；不复制 findings |

### 8.3 默认套件边界

- `pnpm test` 保持 100% 离线；新增确定性测试直接进默认套件。
- CDP 探针与未来浏览器测试走独立 `test:runtime` / 脚本，显式 opt-in；
  **不引入 Playwright/Puppeteer**（Q7 A）。
- 所有测试只写 `os.tmpdir()` 或显式临时目录；不写 `out/`。

## 9. 风险与待裁定问题

| 风险 / 待裁定 | 影响 | 缓解 |
|---|---|---|
| 指标实现与 `.scratch` 脚本不完全一致 | 绿/黄/红判定漂移 | 用 `qualify.mjs` / `finalist.mjs` 现有读数做 golden fixture，逐项断言 |
| 图集 JSON schema 过严，拒绝未来 TexturePacker 变体 | 验收器误报 | 先按 v7 实际形状 strict；未来字段显式加，不用 `.passthrough()` |
| 基准 fixture 体积（4 raw ≈ 5.2MB） | 仓库变大 | 可选只存交付帧 + raw sha256；Q5 A 默认含 raw |
| 32 色 Prompt 来自未入库 19i 目录 | 证据可能丢失 | 复制前核 sha256；复制后写进 baseline.json |
| `humanVerdict` 写回格式 | 与现有 `result.json` 不一致 | 在 `animation-acceptance/v1` 内定义 `human`；旧 `result.json` 保持不动 |
| 运行时声明 vs 实际的红项（fps/loop） | v7 报告会出现 runtime 红项 | Q1 A：如实记录，不阻断结构验收；修复另立票 |
| MCP 工具增加后两壳漂移 | CLI/MCP 行为不一致 | 共用 `acceptAnimationPack` core；测试两壳同源 |
| QA 报告覆盖 | 多次 attempt 的验收证据混 | Tier 2 用 build record 钉 checksum；是否版本化另裁 |
| `site.json` 无 schema | 报告关联弱 | Tier 2 build record 引用 + checksum；不升 site 契约 |
| 是否把 `accept` 接入 `runBuild` | 会影响现有生成链 | Q2 A 明确不做；另立票 |
| 是否把 QA 报告版本化 | 改 `RUN_ARTIFACT.qaReport` 落点 | Tier 2 另裁；先只做 build record |

## 10. 明确不应修改的范围（Phase 1）

- **不改** `packages/demo/src/world.ts` / `shell/scene.ts` / `shell/entry.ts` 的播放行为（Q1 A）。
- **不改** `packages/qa` 的依赖白名单与判据语义（G-15 / G-42 另议）。
- **不改** `AssetPackManifest` 的 `.strict()` 形状（不升 `assetpack` 版本）。
- **不改** `qa-report/v1` 的现有字段（不塞 `packVersion` / `createdAt`）。
- **不改** `runBuild` 的阻断门禁（Q2 A）。
- **不重生成**任何动画帧；**不修改** v7 包 / `fixtures/packs` 现有产物。
- **不修改** `game-maker.local.json`。
- **不引入** Playwright/Puppeteer、新图像 diff 依赖、付费视觉模型（Q7 A / Q6 A）。
- **不把** 验收报告复制成第二份 `findings[]` / `calls[]`（只用 build record 索引）。

## 11. 证据索引

- 现状：[phase-0-current-state.md](phase-0-current-state.md)
- 缺口：[phase-0-gap-analysis.md](phase-0-gap-analysis.md)
- 测试：[phase-0-test-inventory.md](phase-0-test-inventory.md)
- 研究：
  [`a-architecture.md`](../../.scratch/animation-acceptance-v1/research/a-architecture.md) ·
  [`b-pack-atlas-animation.md`](../../.scratch/animation-acceptance-v1/research/b-pack-atlas-animation.md) ·
  [`c-deterministic-checks.md`](../../.scratch/animation-acceptance-v1/research/c-deterministic-checks.md) ·
  [`d-baseline-history.md`](../../.scratch/animation-acceptance-v1/research/d-baseline-history.md) ·
  [`e-visual-review.md`](../../.scratch/animation-acceptance-v1/research/e-visual-review.md) ·
  [`f-runtime.md`](../../.scratch/animation-acceptance-v1/research/f-runtime.md) ·
  [`g-report-traceability.md`](../../.scratch/animation-acceptance-v1/research/g-report-traceability.md) ·
  [`h-test-inventory.md`](../../.scratch/animation-acceptance-v1/research/h-test-inventory.md)
- v7 包：`../../.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
- 运行时证据：[`../../.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/`](../../.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/)
- 动画验收标准：`../../.scratch/asset-integration-v1/issues/12-alternative-animation-model.md`
