# Animation & Asset Acceptance V1 — Phase 0 现状报告

| 属性 | 内容 |
|---|---|
| 项目 | `sihuayin/game-maker` |
| 阶段 | Phase 0（只读调查） |
| 基线 | `main` · `f0dac01` |
| 日期 | 2026-10-21 |
| 任务书 | [动画.md](动画.md) |
| 证据根 | [`../../.scratch/animation-acceptance-v1/`](../../.scratch/animation-acceptance-v1/map.md) |
| 配套交付物 | [缺口分析](phase-0-gap-analysis.md) · [实施计划](phase-0-implementation-plan.md) · [测试清单](phase-0-test-inventory.md) |

## 0. 阅读指引

- **状态**只用四种：`implemented` / `partial` / `missing` / `unverified`。
  `unverified` **不等于** `missing`；静态实现也不等于运行已验证。
- **证据等级**沿用 [`docs/v4/P0-00-task-brief.md`](../v4/P0-00-task-brief.md) 附录 A 的精神：
  E1 源码、E2 测试、E3 真实产物；本报告另加运行证据（命令 + 退出码 + 路径）。
- 本报告只陈述现状；缺口编号与 Phase 1 动作见 [缺口分析](phase-0-gap-analysis.md) 与
  [实施计划](phase-0-implementation-plan.md)。
- 详细取证（字段表、矩阵、逐命令输出）在
  [`../../.scratch/animation-acceptance-v1/research/`](../../.scratch/animation-acceptance-v1/research/)；
  本报告只做索引与结论，不复述全部细节。

## 1. 调查范围与方法

覆盖任务书 §4 的 A–H：

| 范围 | 取证文件 |
|---|---|
| A 项目架构与依赖边界 | [`a-architecture.md`](../../.scratch/animation-acceptance-v1/research/a-architecture.md) |
| B 资源包、图集与动画数据结构 | [`b-pack-atlas-animation.md`](../../.scratch/animation-acceptance-v1/research/b-pack-atlas-animation.md) |
| C 现有确定性检查 | [`c-deterministic-checks.md`](../../.scratch/animation-acceptance-v1/research/c-deterministic-checks.md) |
| D 动画基准与历史验收材料 | [`d-baseline-history.md`](../../.scratch/animation-acceptance-v1/research/d-baseline-history.md) |
| E 视觉审查能力 | [`e-visual-review.md`](../../.scratch/animation-acceptance-v1/research/e-visual-review.md) |
| F 游戏运行时与集成验证 | [`f-runtime.md`](../../.scratch/animation-acceptance-v1/research/f-runtime.md) |
| G 报告、错误与追溯 | [`g-report-traceability.md`](../../.scratch/animation-acceptance-v1/research/g-report-traceability.md) |
| H 测试体系与运行可行性 | [`h-test-inventory.md`](../../.scratch/animation-acceptance-v1/research/h-test-inventory.md) |

**实际执行的命令**（全部只读、零付费）：

- `pnpm test` → exit 0，105 文件 / 1647 用例全绿，15.89s；运行前后 `git status --porcelain` 逐行相同。
- `pnpm typecheck` → exit 2；根 `tsc -b` 通过，两处**测试文件**类型错误（详见 §10）。
- `game-maker verify` / `inspect`：v7 包、`fixtures/packs/last-train/v2`、`counter-siege/v4`，均 exit 0。
- 多个定向 vitest 组：契约 40、pack 43、导入 38、QA/视觉 25、CLI/MCP 与 pipeline 等（见 §10）。
- 运行时：现有 `site/v3` + 本地 HTTP + Chrome headless + CDP，idle / run / jump 采样与截图。
- 未执行：`pnpm check`、`pnpm build`、任何写 `out/` 的 `pack` / `site` / `build` / `create`；
  未发起任何生图 / 文本上游；未修改 `game-maker.local.json`。

## 2. 核心结论

1. **资源包格式与运行链路是通的**：`assetpack/v4` manifest、四类图集、`site` 装配与 Phaser 播放
   在现有 `site/v3` 上真实跑通；v7 包 `verify` exit 0、157 个 checksum 全对。
2. **“包能解析”与“动画有效”之间缺一整层**：`verifyPack` 只验 schema + 文件大小 + sha256，
   不解码 PNG、不读图集 JSON、不查帧矩形越界/锚点；manifest ↔ 图集 JSON ↔ PNG 之间没有门。
3. **动画验收基准事实上已经存在，但没有被冻结成产品**：v7 `scavenger-actor` idle 4 帧机械读数全绿、
   可逐字节追溯到 19i 现场；但它零测试引用、没有 `baseline.json`、真实 32 色 Prompt 未入库。
4. **运行时会播放，但不遵守 manifest 的播放参数**：`fps` / `loop` / `durationMs` 在运行时写死或零读者；
   固定动画场景、公开触发入口、录屏能力缺失。
5. **报告与追溯断在 run → pack → site → qa**：`run-ledger` 无 `packVersion` / `siteVersion`，
   `qa-report/v1` 无身份字段且重跑覆盖；验收报告需要独立 schema 与一层索引 sidecar。

## 3. 架构与模块职责

### 3.1 package 划分

工作区共 9 个包（`pnpm-workspace.yaml:1-2`）：

| Package | 兄弟依赖 | 职责 | 状态 |
|---|---|---|---|
| `@game-maker/contracts` | 无（仅 `zod`） | Zod schema、纯类型、确定性判据 | implemented |
| `@game-maker/assets` | `contracts` | 规划、生成、处理、打包、`verify` / `inspect` | implemented |
| `@game-maker/demo` | `contracts` + `phaser` | 纯场景描述、Phaser 外壳、站点装配 | implemented |
| `@game-maker/cli` | `assets` · `contracts` · `demo` · `pipeline` | 参数解析 + 调 core + 渲染 | implemented |
| `@game-maker/mcp` | `assets` · `contracts` · `demo` · `pipeline` | MCP stdio 薄壳，直接调 core | implemented |
| `@game-maker/pipeline` | `contracts` · `assets` · `vision` · `game-design` · `qa` | `runUnderstanding` / `runBuild`；**够不着 `demo`** | implemented |
| `@game-maker/qa` | 仅 `contracts` | 5 条判据族 + `qaRunner` 合成器 | implemented |
| `@game-maker/vision` | 仅 `contracts` | 参考图 → `VisualWorldSpec` | unverified（本图未展开） |
| `@game-maker/game-design` | 仅 `contracts` | intent / design / CharacterDNA | unverified（本图未展开） |

依赖方向由 [`scripts/check-deps.mjs:16-31`](../../scripts/check-deps.mjs) 守卫，违规 exit 1；
HEAD 实测 exit 0（9 包）。规则是：

- `assets` / `demo` / `qa` / `vision` / `game-design` → 只允许 `contracts`；
- `pipeline` → `contracts` / `assets` / `vision` / `game-design` / `qa`；
- `cli` / `mcp` → `contracts` / `assets` / `demo` / `pipeline`；
- `mcp` 不依赖 `cli`（R5：不 shell out）。

### 3.2 资源生成、处理、验证与运行时

- **格式的唯一家**：`packages/contracts/src/assetpack.ts`（`assetpack/v4`，`:57,265-333`）；
  `Animation` / `FrameRef` 在 `:150-162`，`superRefine` 在 `:194-251`，`resolvePackRef` 在 `:377-426`。
- **生成/处理/打包**：`packages/assets`。`planAssets`（`ops.ts:249`）、`packAssets`（`:1508`）、
  `buildAssetPack`（`pack.ts:307`）；导入/切帧/光栅化/量化/图集/PNG 也都在这里
  （`import.ts:315`、`sheet.ts:175/192`、`raster.ts:120`、`quantize.ts:19`、`atlas.ts:55`、`png.ts:29/44`）。
- **验证**是四层：`contracts` 的 schema/纯判据、`assets` 的 `verifyPack`（`ops.ts:1662`）与
  `inspectPack`（`:1900`）、`qa` 的 5/6 判据族（`qa/assemble.ts:73`）、`demo` 装配期硬失败
  （`site.ts:188-213`）。四者都不是“动画验收”。
- **运行时**：`packages/demo`。纯层 `buildWorld`（`world.ts:90`）+ Phaser 外壳
  （`shell/entry.ts:44-85`、`shell/scene.ts`）+ 站点装配（`site.ts:167`）；没有独立 runtime package。

### 3.3 CLI / MCP 入口差异（HEAD 复验）

| 能力 | CLI | MCP | 证据 |
|---|---|---|---|
| 端到端创建 | `create [--yes]`；无 `--yes` 停在清单检查点 | `create_game` 总是跑完 | `cli.ts:486-489`；`server.ts:117-143` |
| 站点装配 | `site` 按 config `format` 分派横版/塔防 | `assemble_site` 不分派 | `cli.ts:575-591`；`server.ts:287,318-325` |
| 塔防编译 | `compile-td-game` | **无** | `cli.ts:560-573` |
| 事后视觉抽查 | `review`（付费、人工、不进链） | **无** | `cli.ts:603-609` |
| 错误翻译 | `asCommandError` 把理解层错误翻成 3/4 | 裸 Error 一律 1 | `cli.ts:207-218`；`server.ts:338-360` |
| 工具/命令数量 | 10 命令 | 7 工具 | `cli.ts:20-66`；`server.ts:70-194` |

README 仍写 MCP“六个工具”（`README.md:208`、`README_zh.md:206`），与代码的 7 个不一致。

### 3.4 可直接复用的验证入口

| 入口 | 用途 | 局限 |
|---|---|---|
| `parseAssetPack` | manifest schema + 包内引用 | 只看 manifest，不碰图集 |
| `verifyPack` | schema + `files[]` 存在/大小/sha256 + 反向穷举 + 可选 ledger/master-ratios | 不解码 PNG、不读图集 JSON、不查锚点/越界；不在 `runBuild` |
| `inspectPack` | 解码真实像素、色板使用、背景覆盖 | 只观察、不阻断；缺图集帧时静默跳过 |
| `auditAssetSpec` | spec ↔ manifest 对账（kind/size/动画名与帧数） | 不读 `anchor` / `scale9Borders` / 图集 bounds |
| `qaRunner` | 5 条判据 + 2 条观察 | 白名单只有 `contracts`，够不着 PNG/demo/runtime |
| `buildWorld` | 纯层把 manifest + config 读成场景描述 | 不启动 Phaser；坏数据变占位符 |
| `packContactSheet` | 把包内帧拼成联系表 | 无标签、无 CLI、无落盘出口 |

### 3.5 Phase 1 落点建议（已裁定）

确定性检查 → `packages/assets`；运行时探针 → `packages/demo`；报告/基线 schema → `packages/contracts`；
编排 → `packages/cli`（必要时 `mcp`）。**不需要新 package**；`qa`（依赖白名单）与 `pipeline`
（无 `demo` 边）不适合承载完整验收。

## 4. 资源包、图集与动画数据结构

### 4.1 真实数据路径

```
authoring/generated/*.png
  → buildAssetPack（pack.ts:307）
  → manifest.json（assetpack/v4）+ delivery/atlas.<kind>.{json,png}
  → game-config.json（compileRuntime）
  → site/v<N>/site.json → Phaser load.atlas → buildWorld → shell/scene.ts
```

v7 的真实路径见 §4.5；详细调用链见
[`b-pack-atlas-animation.md` §1](../../.scratch/animation-acceptance-v1/research/b-pack-atlas-animation.md)。

### 4.2 正式格式与字段

**包 = `assetpack/v4` manifest + 四类 TexturePacker JSON Hash 图集 + `authoring/` + sidecar**
（`ledger.json` / `coverage.json` / 可选 `master-ratios.json`）。

顶层 manifest（`AssetPackManifest`，`assetpack.ts:265-333`）：

| 字段 | 必填 | 生产者 | 消费者 | 校验 |
|---|---|---|---|---|
| `format` | 是 | pack | 所有读者 | `literal("assetpack/v4")` |
| `id` / `version` | 是 | pack | verify / inspect / site / QA | 非空 / 正整数 |
| `createdAt` | 是 | pack | **零消费者** | ISO datetime |
| `generator{name,version,run?}` | 是（`run` 可选） | pack；**`run` 零生产者** | **零消费者** | strict |
| `provenance.mode` | 是 | `derivePackMode` | verify / inspect | 与 `assets[].origin` 对账 |
| `palette{ref,size,values,coverage}` | 是 | pack | QA `palette-binding`；inspect | 长度 / 去重 |
| `atlases[]` | 是（≥1） | pack | draw / ops / review | `AtlasEntry` + 互指 |
| `assets[]` | 是（≥1） | pack | world / QA / ops | `AssetPackEntry` |
| `files[]` | 是（≥1） | pack（walk 穷举） | verify | path / bytes / sha256 |

资源条目（`AssetPackEntry`，`assetpack.ts:164-251`）关键字段：

| 字段 | 必填/可选 | 消费者 | 备注 |
|---|---|---|---|
| `id` | 必填 | 所有引用点 | 包内唯一 |
| `kind` | 必填 | `auditReferences`、图集分组 | `sprite` / `animation` / `background` / `ui` |
| `role` | 必填 | **运行时零消费者** | 人读 / 提示词 |
| `origin` | 必填 | `derivePackMode` | generated / imported |
| `paletteBinding` | 必填 | QA `palette-binding` | exact / composited / quantized / unbound |
| `required` | 默认 true | **全仓零读者** | — |
| `size` | 必填 | world 盒子 / HUD | 取第一帧实际尺寸 |
| `anchor` | 必填 | world 盒子 / Phaser `customPivot` | 0..1 |
| `scale9Borders` | 可选 | `auditPanelSize`；壳读图集那份 | 九宫格 |
| `layers` | 可选（仅 background） | `buildBackground` | 层/帧一一对应 |
| `atlasId` | 必填 | draw / atlas 查找 | 必须存在；不查反向包含 |
| `frames[]` | 必填（≥1） | `resolvePackRef` / world / QA | 帧名唯一 |
| `animations[]` | 可选（仅 animation） | `resolvePackRef` / world | 帧存在、名字唯一、多帧必归组 |
| `authoring[]` | 必填 | 追溯 / QA drawlist 对账 | ref 必须在 `files[]` |

帧与动画（`FrameRef` / `Animation`，`assetpack.ts:150-162`）：

| 字段 | 必填/可选 | 生产者 | 消费者 | 语义 |
|---|---|---|---|---|
| `FrameRef.name` | 必填 | pack | manifest / 图集 JSON / Phaser | **唯一连接键** |
| `FrameRef.index` | 可选 | **零生产者** | **零消费者** | 死字段 |
| `FrameRef.durationMs` | 可选 | **零生产者** | **零消费者** | 死字段 |
| `Animation.name` | 必填 | spec | config / `resolvePackRef` | 资源内唯一 |
| `Animation.frames[]` | 必填（≥1） | pack（保持帧数组顺序） | world → Phaser | **顺序就是播放顺序** |
| `Animation.fps` | 可选 | spec | **只有 `inspect` 打印** | 运行时零读者 |
| `Animation.loop` | 默认 true | spec | **只有 `inspect` 打印** | 运行时零读者 |

图集条目（`AtlasEntry`）与图集 JSON：

- `id` / `kind` / `meta` / `image` / `size` / `frames` / `assets` / `checksum`（`assetpack.ts:253-263`）。
- **`size` / `frames` / `checksum` 零消费者**：不核对 PNG、不核对 JSON 键数、不与 PNG 对账。
- 图集 JSON **没有 Zod schema**（`atlas.ts:21-34` 只是 TS 类型）；事实字段包括
  `frames.<name>.frame{x,y,w,h}`、`rotated` / `trimmed`（恒 false）、`spriteSourceSize`、
  `sourceSize`、可选 `anchor` / `scale9Borders`、`meta`。
- `frames.<name>.frame` 的矩形**没有越界检查**。

### 4.3 五层合法性

| 层 | 状态 | 证据 |
|---|---|---|
| L1 manifest schema | implemented | `assetpack.ts:194-333`；`assetpack.test.ts` 40 例 |
| L1 图集 JSON schema | missing | 无 Zod schema，只有 TS 类型 |
| L2 文件存在 / checksum | partial | `verifyPack` 手动；`runBuild` 不调用 |
| L3 文件可解码 | partial | 只有 `inspect` 解码，且不阻断 |
| L4 元数据引用有效 | partial | manifest 内与 config→pack 实；**manifest→图集 JSON 无检查** |
| L5 动画可正确播放 | partial | 帧推进实测通过；fps/loop/duration 不生效；视觉正确性未验证 |

### 4.4 明确拒绝 vs 可能漏过

**明确拒绝**：manifest schema 错误、帧名/动画名/层名/资源 id 重复、动画引用不存在的帧、
多帧不归组、层帧不一一对应、锚点越界、`files[]` 缺文件/大小不符/checksum 不符、未知顶层键。

**可能漏过**（`/tmp` 合成探针，未入库）：

- 图集 PNG 不是 PNG（`verify` 通过；`inspect` 才报）；
- 帧矩形 `x=y=9999`（`verify` 通过）；
- `atlases[].frames=999`（`verify` 通过）；
- manifest 动画引用一个**图集 JSON 里不存在**的帧（`verify` 通过）；
- 包目录从 `v7` 改名 `v99`（`verify` 通过，不核对目录名）；
- 跨资源同名帧在 `atlas.ts:86` 静默覆盖；
- 坏 `manifest.json`（非法 JSON）抛裸 `SyntaxError`，退 **1** 而非 4。

### 4.5 v7 `scavenger-actor` idle 全链路

| 站点 | 事实 |
|---|---|
| 源图 | `pack/v7/authoring/generated/scavenger-actor.idle{1..4}.png`（864×1184 RGBA） |
| manifest | `scavenger-actor` · animation · 48×64 · anchor `{0.5,1}` · idle 4 帧 fps 6 loop true |
| 图集 | `delivery/atlas.animations.json`：矩形 `(64/112/160/208,192,48,64)`；PNG 256×760 |
| config | `game-config.player.anims.idle` 指向 4 个帧名 |
| site | `site/v3/site.json` 写 `{"shell":"2","pack":"v7","config":"game-config.json"}` |
| runtime | `buildWorld` → Phaser；CDP 采样 124 点，4 帧 ~168ms 循环 |

证据：[`d-baseline-history.md` §3](../../.scratch/animation-acceptance-v1/research/d-baseline-history.md)、
[`b-pack-atlas-animation.md` §9](../../.scratch/animation-acceptance-v1/research/b-pack-atlas-animation.md)、
[`runs/2026-10-21-runtime/samples-idle.json`](../../.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/samples-idle.json)。

## 5. 现有确定性检查

### 5.1 覆盖矩阵

| 检查项 | 实现位置 | 正常用例 | 异常用例 | 错误定位 | 状态 |
|---|---|---|---|---|---|
| 文件存在 | `ops.ts:1672-1679`；`site.ts:169-175` | v7 `verify` 157 文件通过（E3） | 无缺文件仓库负例；`/tmp` 探针报相对路径 | 文件路径，无资源/帧；最多 6 条 | implemented（链上不跑） |
| 图片可解码 | `decodePNG` `png.ts:44-60`；`inspect` `ops.ts:1767` | `raster.test.ts:225` 往返；v7 `inspect` 解码 4 图集 | `raster.test.ts:232` 非 PNG；**`verify` 不解码** | 解码错误不含路径；runBuild 剥路径 | partial |
| 图集边界 | 构建期 `atlas.ts:55-91`；读取期无 | `raster.test.ts:188` 每帧落矩形 | 仓库无交付包负例；探针矩形 9999 通过 | 构建期只写“超 4096×4096”，无资源/帧 | partial |
| 动画帧引用 | `assetpack.ts:200-205,247-250`；`resolvePackRef` | `assetpack.test.ts` 多例 | 动画引用不存在的帧、多帧不归组 | 资源 id / 动画名 / 帧名；无文件 | partial（manifest 内 implemented；不与图集对账） |
| 动画播放配置 | schema `assetpack.ts:157-162`；写入 `pack.ts:1050-1056`；观察 `ops.ts:1950` | `pack-frames.test.ts:34` 顺序；v7 inspect 打印 fps/loop | 探针 fps=0 被拒；fps=100000、index=99、durationMs=0.0001 通过 | schema 路径；播放期无检查 | partial |
| 锚点数据 | `assetpack.ts:73,175`；`draw.ts:123-126`；`audit.ts` | 真包锚点可读 | 锚点越界被 schema 拒；**spec↔产物 `{0,0}` vs `{0.9,0.9}` 仍返回 `[]`** | schema 路径；`audit` 不报 | partial |
| 资源版本关联 | manifest id/version；包目录 vN；`verify` 对账 ledger/母版比例；`site` 对账 coverage | v7 `verify` 报 packId/version | 探针目录改 v99 通过；`atlases[].frames=999` 通过 | 文本有 packId/version；无文件/资源/帧 | partial |
| 资源名称冲突 | recipe / assetpack 多处 | 真包与 fixture 全过 | 资源 id、帧名、动画名、层名重复均被拒 | 名字 + JSON 路径，无文件 | implemented |
| 透明背景 | 生成期 `pack.ts:812-930`；导入 `import.ts:416`；装配 `site.ts:52-120` | 正例充分 | 空格/多主体/黑框/抠多/抠碎 | 资源 id + 动画名 + 第几格 | partial |
| 错误分类与定位 | `CommandError` / `EXIT`；schema 文本化；QA finding | `cli.test.ts:117-138` | 坏 manifest JSON 退 1 | 无统一错误对象；无文件+资源+帧三合一 | partial |

完整矩阵见 [`c-deterministic-checks.md` §1](../../.scratch/animation-acceptance-v1/research/c-deterministic-checks.md)。

### 5.2 “只声明不读取”与死字段

- **QA `constructive-constraint`** 的注释与标签写“尺寸 / 锚点 / 九宫格”（`qa.ts:114,385`），
  实际 `auditAssetSpec`（`audit.ts:45-84`）**不读 `anchor` / `scale9Borders` / 图集帧 bounds**。
- `AtlasEntry.checksum` / `size` / `frames`：**零读者**。
- `FrameRef.index` / `durationMs`：**零生产者、零消费者**。
- `checkSize`（`audit.ts:24`）：**零生产调用**。
- `AssetPackEntry.required`：全仓零读者。
- `manifest.generator.run`：零生产者；`createdAt`：零消费者。

### 5.3 返回结构、错误对象与定位

| 层 | 成功 | 失败 | 结构化字段 | 定位 |
|---|---|---|---|---|
| `parseAssetPack` | `{ok:true,value}` | `{ok:false,errors:string[]}` | 无 | JSON 路径 + 消息里的 id/帧名 |
| `verifyPack` | `CommandResult.data.ok=true` + `problems[]` | 抛 `CommandError("invalid")` | `kind/message/ledger?/failureDir?` | 相对文件路径；最多 6 条 |
| `auditAssetSpec` | `[]` | `string[]` | 无 | 资源 id + 动画名/帧数 |
| `ConfigIssue` | `[]` | `{severity,where,message}[]` | 有 | `where` 是人话 |
| QA `QAFinding` | `findings[]` | `{target,severity,detail}` + `judgement` | 有 | 资源 id / recipe / game-config |
| `inspectPack` | `InspectData` | 抛（多为裸 `Error`） | 结构化观察 | 解码错误不带路径 |

**没有任何一层同时给出文件 + 资源 + 帧的结构化字段。**

### 5.4 重复实现与漂移风险

- 同一文件两份 checksum：`files[].checksum`（被验）与 `atlases[].checksum`（不被验）。
- 动画帧引用校验两处活实现：`superRefine`（`assetpack.ts:200-205`）与 `resolvePackRef`（`:385-388`）。
- 帧数一致性在 recipe / pack / manifest / audit 四层各说一遍（输入/输出不同层，非同一句话）。
- 层名唯一在 recipe 与 assetpack 各一份（有意镜像）。
- `checkSize` 是死代码。

### 5.5 W4 结论在 HEAD 的复验

`git diff ea53240..HEAD -- packages` 只有 JPEG 支持相关 5 个文件，未触碰验证器/测试/契约。
W4 的六条验证结论在 `f0dac01` **全部成立**：`verifyPack` 不在 `runBuild`、`inspect` 只观察不阻断、
Asset QA 只对账 spec↔manifest、`pack.audit` 不被消费、`checkSize` 无生产调用、阻断只由 `error` 触发。
详见 [`c-deterministic-checks.md` §6](../../.scratch/animation-acceptance-v1/research/c-deterministic-checks.md)。

## 6. 动画基准与历史验收材料

### 6.1 基准资产清单（摘要）

| 项目 | 路径 / 引用 | 存在 | 可复现 | 证据完整性 | 状态 |
|---|---|---|---|---|---|
| 原始参考图（图 43） | `.scratch/style-migration-v1/assets/reference-sheet.png` | 是，已入库 | 产物在；生成记录不在本仓 | 中 | partial |
| 风格参考裁切 | `.scratch/style-migration-v1/assets/style-ref-clean.png` | 是，已入库 | 可从 reference-sheet 重现 | 强 | implemented |
| run 内风格输入 | `runs/2026-10-20f-lurker/reference.png` | 是，已入库 | 同上，同 hash | 强 | implemented |
| 角色母版输入 | `runs/2026-10-20f-lurker/reuse/master-scavenger-actor.png` | 是，已入库 | 像素可从 19h 追溯；模型重生成不保证 | 中 | partial |
| idle raw 1–4 | `pack/v7/authoring/generated/scavenger-actor.idle{1..4}.png` | 是，4/4 已入库 | 可复制；**不可保证重生成** | 强（逐字节相同） | implemented |
| idle 交付帧 1–4 | `pack/v7/delivery/atlas.animations.png` 的 4 个矩形 | 是 | 可由 raw 走同一导入管线 | 强 | implemented |
| 19i 失败现场 raw | `runs/2026-10-19i-real-frames/.../failed-2026-10-19T11-50-47-861Z/` | 是，**未入库**（88MB） | 在盘上 | 中（含 66 raw + 66 prompt） | partial |
| 包 manifest | `pack/v7/manifest.json` | 是，已入库 | 可重建（需同一输入） | 强 | implemented |
| 包内 Prompt | `pack/v7/authoring/generated/*.prompt.txt` | 是，已入库 | 可由 recipe/stylespec 重建 | **中：34 色重建版，不是实际生成 Prompt** | partial |
| 实际生成 Prompt | 19i failed 目录内 4 份 | 是，**未入库** | 在盘上 | 强 | partial |
| 验收规则 | 票 12 `## Answer`（`.scratch/asset-integration-v1/issues/12-...md`） | 是，已入库 | 文本可复制；无机器可读版本 | 中：阈值齐全，无版本号/schema | partial |
| 机械闸实现 | `runs/2026-10-21d-qualification/qualify.mjs`、`runs/2026-10-21f-finalist/finalist.mjs` | 是 | 是（脚本） | 中：两份复制，无共享模块/测试 | partial |
| 人眼闸记录 | 票 12 / 15 / 16 的 `## Answer` | 仅票面文字 | 不可机器复现 | 弱：无逐项 checklist；`humanVerdict` 仍 `pending` | partial |
| 辅助候选 `last-train/v2` | `fixtures/packs/last-train/v2/` | 是，已入库 | **不能**从包内重生成（无 raw/Prompt/参考图） | 中：drawlist 包，idle 2 帧 | partial |
| 站点 v3 | `runs/2026-10-20e-site/out/.../site/v3/` | 是，**未入库** | 可重装配 | 弱：无 v3 CDP 日志；只有静态截图 | partial |

完整清单见 [`d-baseline-history.md` §2](../../.scratch/animation-acceptance-v1/research/d-baseline-history.md)。

### 6.2 v7 基准读数

来自 `runs/2026-10-21d-qualification/result.json` 与 `2026-10-21f-finalist/result.json` 的 baseline 字段
（两处独立运行、同一组 raw；4 帧最差/汇总）：

| 指标 | 读数 | 票 12 绿档 |
|---|---|---|
| Alpha 掩码差 | 0.4%（11/3072 等） | ≤ 1.0% |
| 干净 bbox 宽差 | 0.2% | ≤ 2% |
| 位置漂移 | 0.4% | ≤ 1% |
| 背景众数色 L1 | 3 | ≤ 10 |
| 调色板色数 | 18 / 19（逐帧） | ≥ 14 |
| off-palette | 0 | 0 |
| 轮廓边界深色占比 | 87.4%（最低） | ≥ 50% |

结论：v7 idle 4 帧在机械闸上**全绿**；21c–21f 已实际把它当 comparator 使用。
但它**尚未固化成独立 baseline 文件**，也**零测试引用**。

### 6.3 追溯链

19i 失败现场 → 19j v1 → 19k patch → 20a v2–v4 → 20d v6 → 20f v7。4 帧 raw 在上述版本中
**逐字节相同**；19i 日志记录 `gemini-2.5-flash-image`（70 发 / 68×200 / 66×PNG）。
v7 包 158 文件 / 19 资源 / 76 帧 / 61 动画，`verify` exit 0、157 checksum 全对。

**但同一输入不严格成立**：v7 包内 `*.prompt.txt` 是 34 色重建版；真正生成用的 32 色 Prompt
只在未入库的 19i failed 目录，两者只差 `#59503b` / `#50432b` 两个色号；21a–21f 用的是 34 色版。

### 6.4 验收标准与历史记录

- 票 12 的 `## Answer` 是唯一文本来源：机械绿/黄/红、3+3 样本、盲标 loop、每合格动画成本。
  **无版本号、无独立文件、无共享实现或测试**。
- `qualify.mjs` 与 `finalist.mjs` 各自复制阈值；仓库内没有共享比较模块。
- 04 / 08 / 15 / 16 的人裁原文在票面；票 15/16 要求的逐项清单缺失；
  `2026-10-21f-finalist/result.json:1007` 的 `humanVerdict` 仍为 `"pending"`。
- 19i / 21c–21f 的 HTTP 日志、19k patch 未入库；19h 母版真实 Prompt 不可考；
  `last-train/v2` 无 raw / 参考图 / Prompt。

## 7. 视觉审查能力

### 7.1 四类归位

| # | 能力 | 状态 | 能看/能判 | 阻断 | 入口 / 证据 |
|---|---|---|---|---|---|
| D1 | 单帧 PNG 直接查看 | implemented | 能看 | 否 | v7 `authoring/generated/` 132 文件；候选 run 的 decoded/imported |
| D2 | `packContactSheet()` 联系表库 | implemented（库 + E2） | 能看 | 否 | `assets/src/review.ts:24-70`；`review.test.ts` 11/11；**无 CLI / 无标签 / 无落盘出口** |
| D3 | 真实游戏渲染（站点） | implemented | 能看 | 否 | `cli.ts:575-593`；`site/v3` + `cdp-*.png` |
| D4 | QA 视觉族结构判据 | implemented | 能判（仅元数据） | 是（error ⇒ 退 4） | `qa/src/visual.ts:84-100`；`create-game.ts:215-226,542-544` |
| D5 | `inspectPack` 免费观察 | implemented | 只报数，不判 | 否 | `ops.ts:1900-1957`；接入 runBuild 作为 observation |
| D6 | `reviewPack` / `game-maker review` | implemented（库+CLI+E2）；真实运行 unverified | 只看差异，不判 | 否 | `review.ts:100-181`；`pipeline/review.ts`；`cli.ts:603-609` |
| M1 | 整包预览页 | partial | 能看 | 否 | `.scratch/style-migration-v1/preview/index.html`（untracked，硬编码旧包） |
| M2 | 基线 vs 候选循环预览 | partial | 能看 | 否 | `qualify.mjs:240-250`、`finalist.mjs:241-254`；4 份拷贝、无测试 |
| M3 | 人眼裁定模板 | missing | 能判（人） | 否 | 只有票面文字；`humanVerdict` 仍 `pending` |
| M4 | 版本绑定 | partial | — | — | manifest 有 id/version/checksum；contact/loop/result 不内嵌版本 |

### 7.2 视觉模型边界

`reviewPack` 明确：**付费、人工主动、只描述差异、不判分、不阻断、不进自动链**
（`review.ts:9-13,152-158`）；`qa/assemble.ts:96-103` 把 `review` 观察恒置 unavailable；
`contracts/qa.ts:356-378` 的 `qaVerdict` 根本不看 `observations`。
**未发现视觉模型结果被当作确定性判定。** `analyzeReference` 是设计输入，不是验收判定。

## 8. 游戏运行时与集成验证

### 8.1 最小路径逐步状态

`资源版本 → 游戏配置 → 启动命令 → 资源加载 → 动画播放 → 验证证据`

| 步骤 | 现状 | 状态 | 证据 |
|---|---|---|---|
| 资源版本 | `site/v3/site.json` 写 `{"shell":"2","pack":"v7","config":"game-config.json"}`；manifest 自带 id/version/checksum | implemented（运行时横幅不打印包版本） | `site/v3/site.json`；`layout.ts:114-116` |
| 游戏配置 | 装配器写 `game-config.json`，外壳按 `site.json.config` 读取 | implemented | `layout.ts:100`；`entry.ts:58-61` |
| 启动命令 | `python3 -m http.server <父目录>` + 打开 `/site/v3/index.html`；README 明确根必须是 `pack/` 与 `site/` 的父目录 | implemented（手动两步，无单一 npm script） | `README.md:77-84`；`run-log.txt` HTTP 200 |
| 资源加载 | `site.json` → manifest → `atlasList` → Phaser `load.atlas`；4 张图集全 200 | implemented（已验证） | `entry.ts:54-56`；`draw.ts:173-177`；`network.json` |
| 动画播放（帧推进） | 玩家 idle 4 帧、run 8 帧、jump 4 帧；多帧实体各自建动画并 `play` | implemented（已验证） | `scene.ts:137-141,190-195`；`samples-*.json` |
| 动画播放参数（fps/loop） | manifest 有 fps/loop，`world.ts` 只带帧名，`scene.ts` 硬编码帧率与 `repeat:-1` | **missing** | `assetpack.ts:157-162`；`world.ts:138-153`；`scene.ts:140,193` |
| 验证证据（截图/日志） | 站点自身不产出；本轮 CDP 采集截图、console、异常、网络失败并落盘 | partial（外挂能力） | `runs/2026-10-21-runtime/` |

### 8.2 `fps` / `loop` 断链实测

- 生产：`pack.ts:1050-1057` 把 `spec.animations[].fps` / `loop` 写进 manifest。
- 读回：`world.ts:138-153` 只把帧名带进 `WorldDescription`；`fps` / `loop` 没有进入描述。
- 播放：`scene.ts:140` 实体动画硬编码 `frameRate: 8`、`repeat: -1`；`scene.ts:193` 玩家
  `frameRate: action === "run" ? 10 : 6`、`repeat: -1`。
- 实测：`ceiling-lurker.lunge`（manifest 14fps / loop:false）以 ~127ms（8fps）**无限循环**；
  `jump`（10fps / loop:false）以 ~168ms 循环回第 1 帧。
- W2-G04 在 HEAD 成立。

### 8.3 运行时证据与安全

- 现有 `site/v3` 真实跑通：HTTP 根为 `pack/` + `site/` 父目录，`python3 -m http.server 8791` → 200；
  Chrome headless + CDP；idle 4 帧 ~168ms；`ArrowRight` / `Space` 触发 run / jump。
- 站点与包未被修改（mtime 仍 2026-10-20 14:53:15；`find -newermt 2026-10-21` 为空）；
  server / Chrome 已关闭（8791/9333 无监听）。
- 仓库无 Playwright/Puppeteer、无 CI；录屏 `missing`，CDP 截图 `partial`，运行时错误落盘 `partial`。
- 固定动画场景与公开触发入口 `missing`：只有一个 shell scene；`entry.ts:75` 丢弃 `new Phaser.Game`，
  `Phaser.GAMES` 不存在，必须注入 `Phaser.Game.prototype.boot` 才能拿到 scene。

## 9. 报告、错误与追溯

### 9.1 错误模型

`CommandResult`（`command.ts:13-21`）+ `EXIT 0–4`（`:46`）+ `CommandError(kind/message/ledger?/failureDir?)`
（`:67-87`）+ `Carried`（`:114-119`）+ `carryOnError`（`:133-139`）。壳层信封统一，
但 core 仍有裸 `Error`；**没有 `stage/file/resource/frame` 结构化字段**。
QA `target` 与 ledger `step/target` 是仅有的机器可读定位。

### 9.2 追溯链与断链

| 环节 | 现有身份 | 状态 |
|---|---|---|
| run | `run/v<N>` + `run-ledger.gameId/runVersion` | implemented，但**无 packVersion/siteVersion** |
| pack | `manifest.id/version` + `files[].checksum` + `atlases[].checksum` | implemented；manifest 自身不在 `files[]` |
| site | `site/v<K>/site.json` 写 `pack:"vN"` | implemented；无契约 schema，无 run/qa/checksum |
| qa | `run/v<N>/qa-report.json` | **无身份/checksum/time；固定路径，重跑覆盖** |
| 实验 | `result.json` / `budget-report.md` | 无 schema、无 run/pack 外键 |

**最大缺口**：没有任何文件说明「run v1 产了 pack v2、site v2、哪份 qa」。
`run-ledger` 与 `qa-report` 都没有这条四元组。

### 9.3 可复用的报告格式

`assetpack/v4` manifest、`assetpack-ledger/v1`、`run-ledger/v1`、`assetpack-coverage/v1`、
`assetpack-master-ratios/v1`、`qa-report/v1`、`asset-plan/v1`、`game-config/v1`、
`CommandResult`（CLI `--json` / MCP `structuredContent`）、`design-attempts/v1`、
`visual-world-attempts/v1`。判断：`qa-report` 是唯一裁决报告；manifest + 三份 sidecar 是交付证据；
`run-ledger` 是花费证据；`CommandResult` 是壳层信封。缺的是把它们串起来的**一张索引**。

### 9.4 最小数据关联建议

不建第三本账；新增 `run/vN/builds/v<M>.json`（`run-build-record/v1`）：

- join key：`runVersion → pack.version → site.version → qa.path`；
- 只新增 `manifest.json`、`qa-report.json`、输入文件（intent / recipe / design / visual-world）的 checksum；
- 包内文件不重复哈希，直接用 `manifest.files[]` / `atlases[]`；
- `qa` 只存派生计数，不复制 `findings[]`；
- `stages` 复用 `CreateStep`；`error` 只在失败时出现。

详见 [`g-report-traceability.md` §4](../../.scratch/animation-acceptance-v1/research/g-report-traceability.md)。

## 10. 测试体系

### 10.1 实测

| 命令 | 结果 |
|---|---|
| `pnpm test` | **exit 0**；105 文件 / 1647 用例全绿；0 跳过；15.89s |
| `pnpm typecheck` | **exit 2**；根 `tsc -b` 通过；`packages/assets/tests/pack-sheet-grid.test.ts:150`（TS2322 缺 `requestedSize`）与 `packages/assets/tests/prompt.test.ts:257`（TS2304 未导入 `CharacterDNA`）红；其余 8 包 Done |
| 定向契约测试 | `assetpack.test.ts` 40 例通过 |
| 定向 assets 测试 | `pack` 43、`import` 38、`inspect` 9、`ledger` 10 等 |
| 定向 demo/qa/pipeline/cli/mcp | `site` 24、`world` 23、`qa assemble` 10、`cli` 20、`mcp server` 8 等 |

测试只写 `os.tmpdir()`；运行前后 `git status --porcelain` 逐行相同；零凭据、零外网、零费用；
仅 2 个文件绑定 `127.0.0.1` 临时端口（`cli.test.ts`、`build-pack-stdio.test.ts`）。无 CI。

### 10.2 动画/资源测试矩阵（摘要）

已覆盖：动画声明（帧数、动画名、顺序、fps/loop 的 schema 合法性）、帧名引用闭合、切帧数量与顺序、
九宫格切分、底部横带救援、帧间尺寸一致性、导入/抠底/量化、生成态失败不落盘。

未覆盖：交付态 PNG 与图集 JSON 的几何对账、帧矩形越界、声明尺寸与实际帧包围盒、锚点与脚底像素关系、
基线冻结与版本对比、动画在运行时的真实播放、验收报告 schema、CI。

完整矩阵见 [`h-test-inventory.md` §6](../../.scratch/animation-acceptance-v1/research/h-test-inventory.md)。

### 10.3 安全执行边界

| 命令 | 写文件 | 联网 | 费用 | 结论 |
|---|---|---|---|---|
| `pnpm test` | 仅 `os.tmpdir()` | 否（loopback 除外） | 0 | 可安全执行 |
| `pnpm typecheck` | 写 gitignored `dist/` / `*.tsbuildinfo` | 否 | 0 | 已授权并执行；当前 exit 2 |
| `verify` / `inspect` | 否 | 否 | 0 | 可安全执行 |
| `pnpm check` / `pnpm build` | 写 `dist/` 与 bundle | 否 | 0 | 本图**禁止** |
| `pack` / `site` / `build` / `create` | 写 `out/` | 生图时会 | 可能 | 本图**禁止** |
| CDP 运行时探针 | 只写指定 run 目录 | 仅 loopback | 0 | 本图授权（仅现有 site/v3） |

## 11. 已验证 / 未验证

### 11.1 已验证

- package 边界与 `check-deps` 规则（`scripts/check-deps.mjs`，exit 0）。
- manifest schema 与包内引用校验（40 例）。
- v7 包 checksum 与结构（`verify` exit 0，157 checksum；`inspect` 19 资源 / 76 帧 / 13 动画）。
- v7 idle 4 帧机械读数全绿。
- `site/v3` 真实加载与播放（idle/run/jump；CDP 采样与截图）。
- 全量测试离线全绿（1647 例）。
- 视觉模型审查不判分、不阻断（代码 + 测试）。

### 11.2 未验证

| 事项 | 原因 | 最小验证方式 |
|---|---|---|
| `pnpm typecheck` 全绿 | HEAD 两处测试类型错误 | 修 `pack-sheet-grid.test.ts:150` 与 `prompt.test.ts:257` |
| 图集越界矩形在 `inspect` 的具体失败形态 | 仓库无负例 | 构造合成包，跑 `inspect` |
| `coverage.json` 版本对账 | 只有 `site` 侧代码，无测试 | 加一条版本不符负例 |
| MCP 设计/vision 错误的动态 `_exitCode` | 静态 E1，无测试 | 注入 fake 上游，跑 MCP `create_game` |
| QA 硬失败时 run ledger 缺口 | 无 E3 归档失败 run | 构造 QA 失败 run，检查 ledger |
| HEAD 真实端到端 | 本图只读；未跑付费/生成 | 另立票，预算 + 逐字点头 |
| `game-maker review` live | 无 `"step":"review"` ledger | 另立票（付费） |
| 完全禁网沙箱下的测试表现 | 未执行 | 断网跑 `pnpm test` |
| `pnpm build` / 干净 `dist` | 本图禁止 | Phase 1 施工时验证 |
| v7 `site/v3` 在 HEAD 重跑 | 本图只用现有站点 | 已有 `runs/2026-10-21-runtime/`；如需新证据另跑 |
| 分支 `main` 清检出 | 工作树非干净 | CI / 清检出环境复跑 |

## 12. 证据索引

- 地图与票：[`../../.scratch/animation-acceptance-v1/map.md`](../../.scratch/animation-acceptance-v1/map.md)
- 取证报告：[`../../.scratch/animation-acceptance-v1/research/`](../../.scratch/animation-acceptance-v1/research/)
- 运行时证据：[`../../.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/`](../../.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/)
- v7 包：`../../.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
- 动画验收标准：`../../.scratch/asset-integration-v1/issues/12-alternative-animation-model.md`
- 票 09 / 14 / 15 / 16：`../../.scratch/asset-integration-v1/issues/`
- 站点 v3：`../../.scratch/asset-integration-v1/runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v3/`
- 测试清单：[`phase-0-test-inventory.md`](phase-0-test-inventory.md)
