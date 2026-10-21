# D · 动画基准与历史验收材料（票 04）

> 基线：`main` · `f0dac01`（2026-10-21）。只读取证；未改资源 / 测试 / 契约 / 配置 / 验收规则，
> 未重生成任何帧，未跑 `pnpm check` / `pnpm build`，未写 `out/`，零付费。
> 任务书：`docs/v5/动画.md` §3、§4.4、§5。票：`.scratch/animation-acceptance-v1/issues/04-d-baseline-history.md`。
> 证据分级沿用 `docs/v4/P0-00-task-brief.md` 附录 A（E0 推测 / E1 源码 / E2 测试 / E3 真实产物）；
> 本文另有运行证据（命令 + 退出码 + 路径）。

## 0. 结论速览

1. **v7 `scavenger-actor` idle 4 帧主基准成立，且可以冻结。** 4 张 raw 与 4 张交付帧都存在、都已入库、
   `verify` 通过；4 帧机械读数全部落在票 12 的绿档（最差 alpha 0.4%、宽差 0.2%、背景 key L1 3、
   off-palette 0、边界深色 87.4%）。状态：`implemented`。
2. **但“同一输入”目前不是严格成立。** v7 包内 `*.prompt.txt` 是 `reuseFrom` 重建时用 34 色
   `stylespec.json` 重写的提示词；真正生成这 4 帧的 32 色提示词只存在于**未入库**的
   `19i-failed/authoring/generated/*.prompt.txt`。
   两者逐字只差提示词末尾的两个色号（`#59503b`、`#50432b`），但这不是“同一提示词”。
   状态：`partial`。
3. **票 12 的验收标准没有独立版本号，也没有共享实现或测试。** 唯一来源是票 12 的 `## Answer`
   （`2026-10-21`，已入库 `f0dac01`）；机械闸被复制进 `qualify.mjs` / `finalist.mjs` 两份脚本，
   `screen.mjs` 只量不判档；人眼闸逐项记录只存在于票面文字。状态：`partial`。
4. **历史付费验证的材料基本都在，但关键日志有未入库项。** `21a` smoke 30/30 入库；
   `21c`–`21f` 的 `result.json` / contact sheet / loop preview 入库，`http-calls.log` 与
   `dry-run.log` **未入库**；人裁 `humanVerdict` 在结果 JSON 里仍是 `"pending"`。
   状态：`partial`。
5. **`fixtures/packs/last-train/v2` 只能做辅助候选，不能做动画主基准。** 它是 drawlist 包，
   idle 只有 2 帧，无 raw、无参考图、无 Prompt / 模型记录；`verify` 通过只证明结构与 checksum。
   状态：`partial`（结构夹具可用；视觉基准不足）。
6. **只有文档结论、缺原始证据的项目已逐项列在 §9。** 最需要补的是：19i 真实 Prompt 与 HTTP 日志、
   21c–21f 的 HTTP 日志、人眼逐项清单、v7 站点的 CDP 运行记录。

## 1. 范围、方法与只读证据

本轮实际执行的只读命令与结果：

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `node packages/cli/dist/cli.mjs verify .scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7 --json` | exit 0；`ok=true`；157 个文件 checksum 全对；19 资源 / 61 动画帧 / 76 总帧 | 命令输出（本节） |
| `node packages/cli/dist/cli.mjs inspect .scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7 --json` | exit 0；`scavenger-actor · animation · 48×64 · 16 帧 · idle(4)/run(8)/jump(4) · 用色 20/34` | 命令输出 |
| `node packages/cli/dist/cli.mjs verify fixtures/packs/last-train/v2 --json` | exit 0；`ok=true`；31 个文件 checksum 对；9 资源；无 ledger | 命令输出 |
| `pnpm vitest run packages/assets/tests/pack-frames.test.ts packages/assets/tests/pack-ground-band.test.ts` | 2 文件 / 10 用例全过 | 命令输出 |
| `pnpm vitest run packages/contracts/tests/assetpack.test.ts` | 1 文件 / 40 用例全过 | 命令输出 |
| `git ls-files` / `git status --porcelain` / `sha256` / 只读 PNG 解码 | 用于判断入库状态与逐字节同一性 | 本文各表 |

`verify` 的 checksum 覆盖 `manifest.json` 的 `files[]`（157 条），manifest 自身不在 `files[]` 里；
所以“158 个文件 / 157 checksum”不是矛盾。v7 包工作树与 HEAD 无差异（`git status` 对该目录 0 行）。

路径简写（本文所有缩写都按此展开；表中不再重复全路径）：

- `asset-runs/` = `.scratch/asset-integration-v1/runs/`
- `style-runs/` = `.scratch/style-migration-v1/runs/`
- `v7/` = `asset-runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
- `19i-failed/` = `style-runs/2026-10-19i-real-frames/ruin-scavenger-extraction-assets/failed-2026-10-19T11-50-47-861Z/`

未写前缀的 `runs/2026-10-19*` 均指 `style-runs/`；未写前缀的 `runs/2026-10-20*` / `runs/2026-10-21*` 均指 `asset-runs/`。

## 2. 基准资产清单（任务书 §4.4 表）

### 2.1 原始参考图

| 项目 | 路径 / 引用 | 是否存在 | 是否可复现 | 证据完整性 | 状态 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| 原始参考图（图 43 整页） | `.scratch/style-migration-v1/assets/reference-sheet.png`（1024×1024，sha256 `153bcafa…`） | 是，已入库 | 产物在；生成记录未在本仓 | 中：`assets/crop-table.md:4` 明写“图 43” | `partial` | 基线记录里钉 checksum |
| 风格参考裁切 | `.scratch/style-migration-v1/assets/style-ref-clean.png`（654×563，sha256 `6fb15bca…`） | 是，已入库 | 可从 reference-sheet 按裁切表重现 | 强：与各 run 的 `reference.png` 同 hash | `implemented` | 作为 baseline 的风格输入冻结 |
| run 内风格输入 | `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/reference.png`（654×563，sha256 `6fb15bca…`） | 是，已入库 | 同上 | 强：与 `style-ref-clean.png` 同 hash | `implemented` | 冻结 |
| 角色母版输入（实际送模型的那张） | `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/reuse/master-scavenger-actor.png`（864×1152，sha256 `e8ea2999…`） | 是，已入库 | 像素可从 19h 失败现场追溯；模型重生成不能保证 | 中：像素与 v7 包内 master 完全相同，但字节 hash 不同（重编码） | `partial` | 冻结像素 hash；不要把包内 byte hash 当输入 hash |
| 包内母版副本 | `v7/authoring/masters/master-scavenger-actor.png`（864×1152，sha256 `5b264bbd…`） | 是，已入库 | 由 `buildAssetPack` 重编码/写入 | 强（像素与输入同一：逐像素相等） | `implemented` | 作为交付产物记录 |
| 角色 DNA / 风格规范 | `asset-runs/2026-10-20f-lurker/character-dna.json`、`stylespec.json` | 是，已入库（19i 的 `character-dna.json` 未入库） | 是（文件在） | 中：v7 用 34 色；19i 生成时用 32 色 | `partial` | 同时记录 32 色生成版与 34 色导入版 |

### 2.2 动画帧

| 项目 | 路径 / 引用 | 是否存在 | 是否可复现 | 证据完整性 | 状态 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| idle raw 1–4 | `v7/authoring/generated/scavenger-actor.idle{1,2,3,4}.png`（各 864×1184 RGBA） | 是，4/4 已入库 | 字节可从包/19i 复制；**不能保证用同一模型别名重生成** | 强：4 个 sha256 在 19i 失败现场、19j/v1、19k、v2–v7 全部逐字节相同 | `implemented` | 冻结 4 个 raw sha256；禁止重生成 |
| idle 交付帧 1–4 | `v7/delivery/atlas.animations.png` 的 `(64,192)`、`(112,192)`、`(160,192)`、`(208,192)`，各 48×64 | 是，4/4 可从图集无损裁出 | 可由 raw 走同一导入管线重建 | 强：atlas checksum `a3ecf529…`；裁出帧 RGBA 像素 hash 见 §3 | `implemented` | 交付态 baseline 应钉图集 checksum + 矩形 |
| raw 的旧包副本 | `asset-runs/2026-10-20a-olive-palette/ruin-scavenger-extraction-assets/pack/v{2,3,4}`、`asset-runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/pack/v6`、`asset-runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/pack/v{6,7}` | 是（都在 worktree） | 同上 | 强：与 v7 4 帧逐字节相同（sha256 相同） | `partial` | 作为版本链证据，不另做基准 |
| 19i 失败现场 raw | `.scratch/style-migration-v1/runs/2026-10-19i-real-frames/ruin-scavenger-extraction-assets/failed-2026-10-19T11-50-47-861Z/authoring/generated/` | 是，**未入库**（88MB） | 是（就在盘上） | 中：含 66 张 raw + 66 份真实 Prompt | `partial` | 只把 4 帧 Prompt 与 hash 转存；不要依赖 88MB 目录长期存活 |
| 视觉复核图 | `asset-runs/2026-10-20f-lurker/evidence/contact-sheet-v7.png`（8460×2230） | 是，已入库 | 是 | 强：非空、有色阶；整包联系表 | `implemented` | 保留 |
| 站点截图（v7） | `asset-runs/2026-10-20f-lurker/evidence/site-v7.png`（960×540） | 是，已入库 | 是（静态图） | 弱：没有对应 CDP 日志 | `partial` | 若要运行时基准，补 v7/v3 CDP 运行证据 |

### 2.3 动画元数据

| 项目 | 路径 / 引用 | 是否存在 | 是否可复现 | 证据完整性 | 状态 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| 包 manifest | `v7/manifest.json`：19 资源 / 76 帧 / 61 动画；`scavenger-actor` 16 帧，`idle` 4 帧、`fps:6`、`loop:true`、`size 48×64`、`anchor {0.5,1}` | 是，已入库 | 是（build 可重建；但需同一输入） | 强：manifest + verify | `implemented` | 冻结 manifest checksum |
| 图集帧矩形 | `v7/delivery/atlas.animations.json`：idle1–4 均 48×64、未旋转、未 trim、anchor {0.5,1} | 是，已入库 | 是 | 强 | `implemented` | 冻结 checksum |
| 包内 Prompt | `v7/authoring/generated/scavenger-actor.idle{1..4}.prompt.txt` | 是，已入库 | 可由 v7 recipe/stylespec 重建 | **中：不是实际生成 Prompt**（34 色 vs 32 色；见 §3/§9） | `partial` | 明确标注“重建提示词”，不要当原始输入 |
| 实际生成 Prompt | `19i-failed/authoring/generated/scavenger-actor.idle{1..4}.prompt.txt` | 是，**未入库** | 是（文件在） | 强：66 份逐帧 Prompt 完整；与 19i 失败现场 raw 同目录 | `partial` | 优先转存这 4 份到 baseline fixture |
| 动画声明 / 配方 | `asset-runs/2026-10-20f-lurker/asset-recipe.json`（idle 4/6fps/loop；`masterAsset: master-scavenger-actor`）；19i `asset-recipe.json` 已入库 | 是 | 是 | 强 | `implemented` | 冻结 recipe hash + 32/34 色说明 |
| 模型 / 传输记录 | 19h `http-calls.log`：`model=gemini-2.5-flash-image`、18 发、18×200（母版）；19i `http-calls.log`：同模型、70 发、68×200、66×`image/png`、最终 office-debris 失败 | 19i 日志**未入库**；19h 日志**未入库** | 事实可读；请求体不可复现 | 中：无逐帧请求映射、无 request body | `partial` | 把 `model`、调用数、成功数、MIME 写进 baseline manifest |
| 包内 ledger | `v7/ledger.json`：`calls: []`（干净重建，0 上游） | 是，已入库 | 是 | 弱：不能说明 raw 的真实来源 | `partial` | 不要拿它当生成账本；与 19i 日志交叉引用 |

### 2.4 资源包

| 项目 | 路径 / 引用 | 是否存在 | 是否可复现 | 证据完整性 | 状态 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| v7 主包 | `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`（89MB，158 文件，`assetpack/v4`，19 资源 / 76 帧 / 61 动画 / 34 色） | 是，已入库 `e267ac4` | **产物在；从 git 干净 checkout 不能重放 v7 重建**（`run-rebuild.mjs` 依赖未入库的 `patch/`）；重建需 19i/19k 现场 | 强：`verify` ok；v7 包工作树与 HEAD 无差异 | `implemented` | 冻结 manifest + 全部 checksum；不要依赖 patch 长期存在 |
| v7 图集 | `delivery/atlas.animations.png`（256×760，61 帧，sha256 `a3ecf529…`）、`atlas.sprites/backgrounds/ui` | 是 | 是 | 强 | `implemented` | 冻结 |
| v7 版本链 | v1（19j，pack 未入库）→ 19k patch（未入库）→ v1（19l，已入库）→ v2/v3/v4（20a，未入库）→ v6（20d，已入库）→ v7（20f，已入库） | 是（v2–v4 在 worktree） | 是 | 强：4 张 idle raw 在各版本 byte 相同 | `partial` | 记录链，不必复制全部旧包 |
| 辅助候选 `last-train/v2` | `fixtures/packs/last-train/v2/`（32 tracked 文件，9 资源，14 动画帧；idle 2 帧） | 是，已入库 `e2a2c40` | **不能**从包内重生成（无 raw / Prompt / 参考图） | 中：`verify` 31 checksum ok；只是 drawlist 包 | `partial` | 只用于结构 / 运行时夹具，不作视觉基准 |
| 站点 v3 | `asset-runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v3/`（`site.json` 指向 `pack: v7`） | 是，**未入库** | 可重装配 | 弱：无 v3 CDP 日志；`site-v7.png` 是静态图 | `partial` | 若要运行时基准，需单独采证（票 06 范围） |

### 2.5 验收规则

| 项目 | 路径 / 引用 | 是否存在 | 是否可复现 | 证据完整性 | 状态 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| 动画验收标准 | `.scratch/asset-integration-v1/issues/12-alternative-animation-model.md:57-120`（`## Answer`） | 是，已入库 `f0dac01` | 文本可复制；无机器可读版本 | 中：阈值、样本量、成本公式齐全；无版本号 / 无 schema | `partial` | Phase 1 落一份 `standard/v1`（JSON 或 md + 引用 hash） |
| 机械闸实现 | `runs/2026-10-21d-qualification/qualify.mjs:215-233`、`runs/2026-10-21f-finalist/finalist.mjs:222-237` | 是，已入库 | 是（脚本） | 中：两份复制；`screen.mjs` 只量不判档；仓内无共享模块 / 无测试 | `partial` | 抽成共享 `acceptance` 模块 + 单测 |
| 人眼闸记录 | 票 12 `:68,87,96`；票 15 `:132`；票 16 `:85-96` | 仅票面文字 | 不可机器复现 | 弱：无逐项 checklist 文件；无 A/B/C 盲标证据；`result.json` 的 `humanVerdict` 仍 `"pending"` | `partial` | 建立人眼 verdict JSON（逐项 + 评审材料 hash） |
| 成本口径 | 票 12 `:101-113`（每合格动画成本公式；筛查 $0.50 / 资格 $2.00 / 决赛 $4.00 上限） | 是 | 文本可复现 | 强（定义）；实际 relay 费用未知（21c B1） | `partial` | baseline manifest 记录标准版本与成本口径 |

### 2.6 实验记录

| 项目 | 路径 / 引用 | 是否存在 | 是否可复现 | 证据完整性 | 状态 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| 19h 母版 / 单行真跑 | `style-runs/2026-10-19h-real-single-row/`（根 4 tracked；`failed-2026-10-19T11-00-30-685Z/` 未入库） | 是 | 不能重生成；现场在 | 中：18 发全 200；母版 3 张在 failed | `partial` | 记录母版来源 |
| 19i 逐帧真跑 | `runs/2026-10-19i-real-frames/`（根 4 tracked；failed 88MB 未入库） | 是 | 不能重生成；现场在 | 强（raw+prompt）/ 弱（日志未入库、无请求体） | `partial` | 转存 4 帧 Prompt + 模型事实 |
| 19j / 19k / 19l 零付费抢救 | `runs/2026-10-19j-salvage/`（5 个根文件 tracked；pack/v1 未入库）、`runs/2026-10-19k-patch/`（0 tracked，85MB）、`runs/2026-10-19l-salvage-standby3/`（tracked） | 是 | 是（reuse） | 中：19j 结果表完整；19k 无 Prompt | `partial` | 19k 是临时 patch，不应作为唯一来源 |
| 20a / 20d / 20f 资源加工 | `runs/2026-10-20a-olive-palette/`（0 tracked）、`2026-10-20d-groundline/`（191/191 tracked）、`2026-10-20f-lurker/`（277 文件 / 202 tracked） | 是 | 是（零上游重建） | 强：报告 / 联系表 / 结果 / verify；20a 只在本机 | `partial` | v7 冻结即可；20a 仅作链证据 |
| 21a 2.1 smoke | `runs/2026-10-21a-smoke/`（30/30 tracked） | 是 | 是（raw/decoded/imported/请求 JSON 全在） | 强：2 发 200、0 重试、成本可核对 | `implemented` | 作为“被拒候选”的完整样本保留 |
| 21b 共享框 dry-run | `runs/2026-10-21b-shared-box-dry/`（17/17 tracked） | 是 | 是（0 HTTP） | 强：2.5 基线 0.4% / 2.1 17.9%→7.1% 的读数在 `dry-run-result.json` | `implemented` | 基线只用 2.5 读数 |
| 21c 筛查 | `runs/2026-10-21c-screening/`（42 文件 / 40 tracked） | 是 | 证据可读 | 中：`http-calls.log` 与 `dry-run.log` 未入库；B1 200 空体 | `partial` | 补入库 HTTP 日志 |
| 21d / 21e 资格 | `runs/2026-10-21d-qualification/`（80/78）、`2026-10-21e-enemy-retry/`（43/41） | 是 | 证据可读 | 中：contact/loop/prompt/result 在；日志未入库；人裁仅票面 | `partial` | 关联人裁 verdict |
| 21f 决赛 | `runs/2026-10-21f-finalist/`（124/122） | 是 | 证据可读 | 中：两套 contact/loop 在；日志未入库；人裁仅票面 | `partial` | 同上 |
| CDP v6 运行时 | `runs/2026-10-20e-site/`：`cdp-a/b/run/jump.png`、`screenshot-v1/v2.png`、`console.txt`、`drive-cdp.mjs`、`site-report.md`（12 tracked） | 是 | 是（脚本在；但需站点/服务） | 强：我用只读像素 diff 复算 `cdp-a` vs `cdp-b` = **7130** 像素，与报告一致 | `implemented` | v7/v3 若要运行时基准，另采证 |

## 3. v7 scavenger idle 4 帧的追溯链

### 3.1 版本链与逐字节证据

| 阶段 | 路径 | 4 帧是否与 v7 逐字节相同 | 入库 | 说明 |
| --- | --- | --- | --- | --- |
| 真实生成 | `.scratch/style-migration-v1/runs/2026-10-19i-real-frames/ruin-scavenger-extraction-assets/failed-2026-10-19T11-50-47-861Z/authoring/generated/scavenger-actor.idle{1..4}.png` | 是（4/4） | 否（88MB 现场） | 19i 日志：`model=gemini-2.5-flash-image`、70 发、68×200、66×`image/png`；最终因 office-debris 失败 |
| 零付费抢救 | `runs/2026-10-19j-salvage/ruin-scavenger-extraction-assets/pack/v1/...` | 是（4/4） | **部分**：根文件 5 个入库，`pack/v1` 未入库 | `reuseFrom` 19i failed；`imageCalls=0` |
| 临时 patch | `runs/2026-10-19k-patch/authoring/generated/...` | 是（4/4） | **否**（0 tracked，85MB） | 19k 只有 raw/drawlist，**无 prompt.txt** |
| 零付费 standby3 修复 | `style-runs/2026-10-19l-salvage-standby3/ruin-scavenger-extraction-assets/pack/v1/...` | 是（4/4） | 是（pack 158 tracked） | 19l 的 pack/v1 是 git 里最早含这 4 帧的完整包（`77886d9`） |
| 34 色迁移 | `asset-runs/2026-10-20a-olive-palette/ruin-scavenger-extraction-assets/pack/v{2,3,4}/...` | 是（4/4） | **否**（整个 20a 目录未入库） | 34 色 `stylespec.json` 导入 |
| 地面线清理 | `asset-runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/pack/v6/...` | 是（4/4） | 是 | v6 定稿 |
| v7 潜伏者修复 | `runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/...` | —（基准） | 是 `e267ac4` | 复用 patch；`imageCalls=0` / `ledgerCalls=0`；`verify` ok；61 动画帧 |

结论：这 4 帧的 **raw 产物**在盘上可以追溯到 19i 真实生成现场，并逐字节贯穿 v1→v7；中间没有换图。
**git 里只有 19l 的 pack/v1、20d 的 v6、20f 的 v7 三代完整包**：19j 的 `pack/v1`、20a 的 v2–v4、19k patch、
19i 失败现场都未入库；19i 的请求体、逐帧调用映射、真实 Prompt 也都没有入库。

### 3.2 关键 hash

v7 raw（sha256）：

- idle1 `068ee2d78df156fd92afddbd6d257ffe4b109db8da5ebc077bb3b421192c0ebd`
- idle2 `617b75aa427ca81b8e5073e797f52bc13ef0ed23e61fa29de0097dd3ba00642b`
- idle3 `44255922f326b8029e7846674b626c58ef8599c342ea2ac9c8cc3e70a57b33b3`
- idle4 `a8de40a37e2e3e036a674cbd77ebdaaf5f5c920f7ca02a63e4917c776e04ec47`

v7 raw Prompt（**重建版，不是实际输入**）：idle1 `e0dc4b84…`、idle2 `849c5565…`、idle3 `ebdf0d56…`、idle4 `64cffc61…`。
19i 实际 Prompt（**未入库**）：idle1 `e30e0c37…`、idle2 `f034d011…`、idle3 `30dfd1cb…`、idle4 `4be8cf5a…`。
两者 diff 只有提示词末尾调色板：19i 32 色；v7 多 `#59503b` `#50432b` 两个色号。
21a smoke 的 `evidence/scavenger-actor.idle1.prompt.txt` 与 v7 包内 Prompt **同 hash**（`e0dc4b84…`）；
21c–21f 的请求均为 `inputs=3`（text + 2 images），参考图/master 来自
`asset-runs/2026-10-20f-lurker/reference.png` 与 `reuse/master-*.png`。⇒ **图像输入同组，文本输入不同。**

v7 交付帧（48×64 RGBA，从图集裁出）像素 hash（sha256 前 16 位）：
idle1 `d21d898dc942c84a`、idle2 `2e82660272a0a806`、idle3 `7bb59d2fbb9afcbe`、idle4 `cc68e5f00018c74a`。
图集 checksum：`a3ecf5294d850678fdcb71295880e0eda4d682d29bca4bc8f3032f1711836735`。
输入参考图 / 母版：`reference.png` = `6fb15bca…`；输入 master = `e8ea2999…`（包内副本 `5b264bbd…` 像素完全相同）。

### 3.3 4 帧基线读数

来自 `runs/2026-10-21d-qualification/result.json` 与 `2026-10-21f-finalist/result.json` 的 baseline 字段
（两处独立运行、同一组 raw）：

| 指标 | 4 帧最差 / 汇总 | 票 12 绿档 |
| --- | --- | --- |
| Alpha 掩码差 | 0.4%（11/3072 等） | ≤ 1.0% |
| 干净 bbox 宽差 | 0.2% | ≤ 2% |
| 位置漂移 | 0.4%（x 均 141；y 16–21，按 `max(abs(dx)/srcW, abs(dy)/srcH)` 复算 5/1184） | ≤ 1% |
| 背景众数色 L1 | 3 | ≤ 10 |
| 调色板色数 | 18 / 19（逐帧），≥14 | ≥ 14 |
| off-palette | 0 | 0 |
| 轮廓边界深色占比 | 87.4%（最低） | ≥ 50% |

这说明 v7 idle 4 帧作为主基准在机械闸上是**全绿**的，且 21c–21f 已经实际把它当 comparator 使用。
状态：`implemented`（测量与对照已发生）；尚未固化成独立 baseline 文件（见 §8/§9）。

## 4. 票 12 的验收标准：版本与完整性

### 4.1 版本

- **没有独立版本号**。标准本体只在 `issues/12-alternative-animation-model.md` 的 `## Answer`（2026-10-21）里；
  14 / 15 / 16 只用“按 12 的标准”引用。
- 没有独立的 `acceptance-standard.md` / JSON / schema；没有把阈值输入 `packages/*`。
- `screen.mjs` 不判档；`qualify.mjs` / `finalist.mjs` 各自复制了 `tier()` 与阈值；三者没有共享模块或测试。
- 结论：**“当前验收标准有明确版本”不成立**，只能算“有明确文本日期与内容”。状态：`partial`。

### 4.2 阈值完整性

| 维度 | 票 12 的规定 | 是否完整 | 证据 |
| --- | --- | --- | --- |
| 机械闸 | Alpha ≤1/3%；bbox 宽 ≤2/5%；位置 ≤1/3%；背景 L1 ≤10/20；色数 ≥14；任一红灯整动画失败 | **基本完整**；但“位置漂移”的分母/坐标系未在票面定义（脚本用 `max(abs(dx)/srcW, abs(dy)/srcH)`） | 票 12 `:80-88`；脚本 `qualify.mjs:206-233` |
| 交付硬门槛 | `off-palette=0`、无残留地面线/碎点、边界深色 ≥50% | 完整 | 票 12 `:88`；脚本 `:230-233` |
| 人眼闸 | 清单式检查、A/B/C 盲标、目标 FPS 循环预览 | **定义有，记录机制缺**；无逐项 checklist 产物、无盲标证据 | 票 12 `:68,87,96`；`21d/21f result.json` 的 `humanVerdict` |
| 样本量 | 筛查 2 帧；资格 scavenger 3 + enemy 3；决赛 idle 4 + patrol 6 | 完整且脚本按此执行 | 票 12 `:93-95`；`screen.mjs` / `qualify.mjs` / `finalist.mjs` 帧表 |
| 成本口径 | `全部付费（含重试与被拒帧）/ 通过验收动画数`；另报 yield；零合格动画披露总花费 | 完整（定义）；relay 成本仍未知 | 票 12 `:101-113`；14 的 B1 relay 计价未验证 |
| 决策 / 回退 | 资格→机械→人眼→排序；主/备/停止必须新裁定 | 完整（文本） | 票 12 `:115-126` |

结论：**机械闸 + 样本量 + 成本口径在文本上是完整的；人眼闸的“记录”与“盲标”不完整；
标准的版本化与可执行化缺失。** 总体状态：`partial`。

## 5. 历史验收材料核验（09 / 14 / 15 / 16 + 21b）

| 票 / run | 材料 | 文件数 / 入库 | 结论 | 证据强度 / 备注 |
| --- | --- | --- | --- | --- |
| 09 · `21a-smoke` | raw JPEG、decoded/imported PNG、请求 JSON、Prompt、contact-raw/imported、`result.json`、`http-calls.log`、`smoke.mjs`、预算报告 | 30 / 30 tracked | 2.1 技术路径过、帧间一致性不过（alpha 17.9% vs 2.5 0.4%）；裁定 C | **强**：请求 JSON 记录 3 inputs（text + 2 images），raw 与 decoded 都在；可复核 |
| 11 · `21b-shared-box-dry` | 2.1/2.5 各 6 张模式图、contact、`dry-run-result.json`、`dry-run-report.md` | 17 / 17 tracked | 共享并集框 17.9%→7.1%，仍远差于 2.5 0.4%；建议 C | **强**：0 HTTP；基线 4 帧的 2.5 读数在 JSON 里 |
| 14 · `21c-screening` | A raw/decoded/imported/contact/请求/Prompt；B1 dry 与 1 发现场；`result.json` | 42 / 40 tracked | A 黄灯；B1 200 空体；A 可进资格 | **中强**：图像证据全；`http-calls.log` / `dry-run.log` 未入库；`result.json` `ok=false` |
| 15 · `21d-qualification` | scavenger 3 帧、enemy 3 帧：baseline/decoded/imported/contact/loop/prompts/requests；`result.json` | 80 / 78 tracked | scavenger 绿、enemy 红；后 21e enemy 重试黄；人裁通过 | **中强**：机械 tier 已写进 `result.json`；`humanVerdict=pending`；HTTP 日志未入库 |
| 15 · `21e-enemy-retry` | enemy 3 帧全套 + contact/loop | 43 / 41 tracked | enemy 黄（alpha 2.3%），两动画无红灯；人裁通过 | **中强**：同上；日志未入库 |
| 16 · `21f-finalist` | scavenger 4 帧 + enemy 6 帧全套 + contact/loop | 124 / 122 tracked | 两项机械红；人裁拒绝 A 作为动画默认，2.5 继续 | **中强**：机械结论可由 `result.json` 复核；人眼拒绝只在票面；日志未入库 |

**共同弱点**：21c–21f 每个 run 的 `http-calls.log` 与 `dry-run.log` 均未入库；`humanVerdict` 在结果 JSON
里是 `"pending"`，人裁结论只写在 ticket markdown。也就是说“花了多少发 / 有没有隐藏重试 / 人眼逐项怎么看”
这三类事实，**在 git 里没有完整原始证据**。

## 6. CDP、联系表、fixtures v2 与测试

### 6.1 CDP / 运行时

- `runs/2026-10-20e-site/` 有 `cdp-a.png`、`cdp-b.png`、`cdp-run.png`、`cdp-jump.png`、
  `screenshot-v1/v2.png`、`console.txt`、`drive-cdp.mjs`、`site-report.md`，共 12 个入库文件。
- 我用只读 PNG 解码复算：`cdp-a.png` 与 `cdp-b.png` 在 960×453 上不同像素 **7130**，与 `site-report.md` 的
  “相隔 900ms，7130 个像素不同”**完全一致**。状态：`implemented`（v6 运行时）。
- 这些截图对应 **v6**（报告开头写明输入包是 `asset-runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/pack/v6`）。
  `site/v3` 虽然存在且 `site.json` 指向 `pack: v7`，但它在 `out/`（`.gitignore`）下、未入库；
  没有 v3 的 CDP 日志；`evidence/site-v7.png` 只是一张静态截图。状态：`unverified`（v7 运行时）。

### 6.2 联系表

已核实存在且非空（尺寸 / hash 见下；均为真实图像，不是 0 字节或纯色）：

- `2026-10-20f-lurker/evidence/contact-sheet-v7.png`（8460×2230）
- `2026-10-21a-smoke/evidence/contact-raw.png`（898×296）、`contact-imported.png`（1560×512）
- `2026-10-21b-shared-box-dry/evidence/contact-2.1-modes.png` / `contact-2.5-modes.png`（1168×1032）
- `2026-10-21c-screening/evidence/gemini3pro/contact.png`（1560×512）
- `2026-10-21d-qualification/evidence/{scavenger,enemy}/contact.png`（776×1552 / 776×1168）
- `2026-10-21e-enemy-retry/evidence/enemy/contact.png`（776×1168）
- `2026-10-21f-finalist/evidence/{scavenger,enemy}/contact.png`（776×2072 / 776×2344）

### 6.3 `fixtures/packs/last-train/v2`

- 32 个 tracked 文件；manifest `assetpack/v4`，9 资源；动画帧 14（`player-traveler` idle 2 / run 4 / jump 2，
  `hazard-sweeping-carriage` sweep 2，`signal-endlight` red/green 各 2）。
- `verify`：31 个文件 checksum 全对；`provenance.mode = generated`；无 `ledger.json`。
- 目录里**没有** `reference.png`、`master-*.png`、`*.prompt.txt`、raw 生成帧；只有 `delivery/atlas.*` 与
  `authoring/drawlist/*.json`。W5（`.scratch/p0-00-audit/research/w5-test-matrix.md:294`）也把它归为 drawlist 包。
- 结论：可作为 `compile-runtime` / `inspect` / `ledger` / site 的结构夹具（相关测试见 §6.4），
  **不适合作为动画视觉主基准**；状态：`partial`（结构夹具）；视觉基准的缺口见 §9。

### 6.4 测试

- `packages/assets/tests/pack-frames.test.ts`：1 用例，`source.kind="frames"` 的 2 帧打包（`hero.idle1/idle2`）。
- `packages/assets/tests/pack-ground-band.test.ts`：9 用例，含 4 帧 `guard.idle` 的图集/地面线清理。
- `packages/contracts/tests/assetpack.test.ts`：40 用例，覆盖动画帧引用、重名、锚点、图集索引等结构契约。
- 本轮定向执行：上述前两个文件 10/10 通过；assetpack 40/40 通过。
- **没有任何测试读取 v7 包或 `scavenger-actor.idle1`**（`grep -rn "2026-10-20f-lurker\|scavenger-actor" packages/*/tests` 0 命中；
  唯一 `pack/v7` 命中是 `cli-create.test.ts` 的版本参数测试）。因此基线的 checksum / 像素 / 指标
  **没有回归守卫**；状态：`missing`（baseline regression test）。

## 7. 任务书 §4.4 的 8 个问题

1. **样本实际存放在哪里？** v7 raw 在 `v7/authoring/generated/scavenger-actor.idle{1..4}.png`；
   交付帧在 `v7/delivery/atlas.animations.png` 的 `(64/112/160/208,192)`；19i 失败现场与 19k patch 有同字节副本。
2. **原始参考图是否可追溯？** **是**：`assets/reference-sheet.png`（图 43）→ `style-ref-clean.png`（654×563）
   → 各 run 的 `reference.png`（同 sha `6fb15bca…`）；角色母版输入 `reuse/master-scavenger-actor.png`
   （`e8ea2999…`，864×1152）可追溯到 19h。但 19i 请求体没有保存，无法证明“当时实际附了两张图”的 payload。状态：`partial`。
3. **生成后的帧和资源包是否存在？** **是**：v7 包 158 文件 / 19 资源 / 76 帧 / 61 动画；
   `verify` ok；4 帧 raw 与交付帧都在。状态：`implemented`。
4. **是否有模型 / Prompt / 处理版本记录？** **部分**：19i / 19h 日志记录 `gemini-2.5-flash-image`；
   19i 66 份真实 Prompt（未入库）；v7 recipe/stylespec/rebuild 脚本已入库；
   但 manifest 没有 model / git SHA，`ledger.json` 为空，19i 日志与 Prompt 未入库。状态：`partial`。
5. **当前验收标准是否有明确版本？** **没有版本号 / 没有独立文件**；票 12 Answer 是唯一文本来源，
   阈值被散落在两三个 scratch 脚本里。状态：`partial`。
6. **同一输入能否用于后续模型或 Prompt 的对比？** **部分可以**：21a–21f 确实复用了
   `reference.png` + `reuse/master-*.png` + 同一组帧名 / 尺寸；但基线真实 Prompt 是 32 色，
   对照用的 v7 包 Prompt 是 34 色（多两个色号），且原始请求体 / 模型快照未固定。状态：`partial`。
7. **当前记录能否关联到真实资源产物？** **大体可以**：v7 路径、manifest、checksum、图集矩形、
   联系表、`21d/21f` 的 baseline 字段都能互相对上；缺口是 ledger 为空、人裁 verdict 不在 JSON、
   部分日志未入库。状态：`partial`。
8. **是否存在只有文档结论、缺原始证据的历史记录？** **是**，见 §9。

## 8. v7 idle 4 帧作为主基准：冻结 / 版本固定 / 证据保存可行性

### 8.1 结论

**可行，且应现在冻结；不需要重生成、不需要付费。** 理由：

- 4 帧 raw 与交付帧都已入库，且 `verify` 通过；逐字节从 19i → v1 → … → v7 连续。
- 4 帧机械读数全绿，且 21c–21f 已用它们做 comparator，基准不是纸上数字。
- 参考图 / 母版像素在库；模型事实（2.5 alias）有日志；处理链（19i run-real → 20f run-rebuild）
  有脚本、有 commit；**但 20f 重建依赖未入库的 `patch/`，所以这只是“产物冻结”，不是“从 git 可重放”。**

**但必须先解决两个“同一输入”问题，否则冻结的只是产物，不是可比较的输入：**

1. **Prompt**：把 19i 的 4 份真实 Prompt（32 色）转存进 baseline fixture；
   v7 包内 Prompt 只能标注为“由 34 色 stylespec 重建的提示词”。后续模型对比若要“同输入”，用 32 色版；
   若要“重放 v7 导入”，用 34 色版，并在报告里写明差异。
2. **模型版本**：`gemini-2.5-flash-image` 是 alias，不是 dated snapshot；票 07 记录内部截止 2026-12-31。
   基线本身不依赖重生成，但“用同一模型再跑一次”不可保证。

### 8.2 建议的冻结形态（Phase 1 可直接落）

优先“checksum 钉住 + 小 fixture”，不要复制 89MB 包：

- `fixtures/baselines/scavenger-actor/idle/`（或等价小目录）：
  - `raw/scavenger-actor.idle{1..4}.png`：可选；若不想复制，则在 `baseline.json` 里钉 v7 包路径 + sha256。
  - `delivery/scavenger-actor.idle{1..4}.png`：4 张 48×64，直接 serving / 比较用。
  - `prompts/actual.idle{1..4}.txt`：19i 的 32 色真实 Prompt。
  - `prompts/pack.idle{1..4}.txt`：v7 的 34 色重建 Prompt，文件名明确区分。
  - `baseline.json`：`baselineId`（例 `scavenger-actor.idle.v7.2026-10-19`）、source commit `e267ac4`、
    model `gemini-2.5-flash-image`、raw sha256 ×4、delivery sha256 ×4、atlas checksum、manifest checksum、
    reference/master sha256、stylespec（32 与 34 两份）、阈值标准版本、期望指标（alpha ≤0.4% 等）。
- 新增一条定向测试（Phase 1，不在本票施工）：读取 `baseline.json`，验证 v7 包 checksum、4 个交付帧像素 hash、
  4 个 raw hash、以及 mechanical metrics 仍在容差内；当前测试对 v7 **零引用**。
- 证据保存：把 19i 的 4 份 Prompt + 19i `http-calls.log` 的关键行（model / 70 发 / 66 PNG / 终态失败）
  与 19h 母版日志的模型行复制成小文本；不要依赖 88MB failed / 85MB patch 目录长期存在。
- `last-train/v2`：保持辅助候选，用于 `verify` / `compile-runtime` / site 结构测试；不要拿它当视觉基线。

### 8.3 明确不建议

- **不要**重生成这 4 帧来“冻结”（模型 alias 与 payload 不可保证，且会引入新差异）。
- **不要**把 v7 包内 `*.prompt.txt` 直接当“原始 Prompt”写进 baseline。
- **不要**用 `ledger.json` 的 0 调用来叙述生成成本；真实成本在 19i 日志（且未入库）。
- **不要**只用 ticket 12 的数字而不落 `baseline.json`；数字没有 checksum 锚点，未来会被悄悄改掉。

## 9. 只有文档结论 / 缺原始证据 / 不可复现

| 项 | 现状 | 缺失的原始证据 | 影响 | 状态 |
| --- | --- | --- | --- | --- |
| 19i 真实生成记录 | 票 / 报告说“gemini-2.5-flash-image、70 发、66 帧、office-debris 失败” | `http-calls.log`、66 份 Prompt、failed 现场 **均未入库**；日志无逐帧映射 / 无请求体 | 无法从 git 独立证明 v7 idle 的真实模型与 Prompt | `partial` |
| v7 包内 Prompt 的出处 | `lurker-report.md:67-72` 已警告“复用/旋转帧写的是基础提示词，不是真正来源” | 无“每帧真实 Prompt”索引 | 同一输入比较可能用了错误 Prompt（34 色 vs 32 色） | `partial` |
| 21c–21f 的付费调用账 | `result.json` 有 sends / costEstimate；票面有“0 隐藏重试” | 4 个 `http-calls.log` 与 `dry-run.log` 未入库 | 重试 / 计费 / 逐发状态无法从 git 审计 | `partial` |
| 人眼闸 | 票 15 “人眼清单通过”、票 16 “拒绝 A” | 无逐项 checklist、无 A/B/C 盲标记录；`result.json.humanVerdict = "pending"` | 人眼结论不可机器复核，不符合票 12 的“逐项结论” | `partial` |
| 票 12 标准版本 | 票 12 Answer 文本 | 无版本号、无独立文件、无共享实现 / 单测 | 不同脚本可漂移；无法引用“标准 v1” | `partial` |
| v7 站点运行时 | `lurker-report.md` 称 `site/v3` 校验全过；`site-v7.png` 在 | `site/v3` 在 ignored `out/`；无 v3 CDP 日志 / console | 无法从 git 证明 v7 在游戏中播放；v6 CDP 证据很强 | `unverified` |
| v7 包 ledger | `ledger.json: calls: []` | 真实生成账在 19i/19h 日志（未入库） | 容易把“零上游重建”误读成“零成本生成” | `partial` |
| `last-train/v2` 视觉基准 | 包 / manifest / atlas 在 | 无 raw、无参考图、无 Prompt、无模型记录；idle 仅 2 帧 | 不能做 4 帧 idle 的视觉基准 | `missing` |
| 母版输入 hash | 包内副本 `5b264bbd…` 与输入 `e8ea2999…` 不同字节 | 无“重编码”说明在包里 | 若直接拿包内 hash 当输入 hash 会对不上 | `partial` |
| 历史 19h 母版生成 Prompt | 有母版图与模型日志 | 未保存母版 Prompt / 请求体；HEAD 代码在 `b545875` 后可能已改写 | 母版不能精确重生成 | `unverified` |

## 10. 与 Phase 1 的交接建议（本票不施工）

1. 采用 §8.2 的 baseline fixture + `baseline.json`；`baselineId` 与 v7 manifest checksum 绑定。
2. 把票 12 标准落成版本化 `acceptance-standard/v1`（阈值、样本量、成本公式、人眼 checklist schema），
   并把机械闸从 `qualify.mjs` / `finalist.mjs` 抽成共享模块 + 单测。
3. 人眼 verdict 落为 JSON（逐项 + 评审材料 hash + 盲标分组），不再只写票面。
4. 证据保存优先级：19i 4 份 Prompt + 19i 日志关键行 > 21c–21f HTTP 日志 > v7/v3 CDP 运行记录。
5. 任何“同一输入”比较，先声明用 32 色真实 Prompt 还是 34 色重建 Prompt；两者不能混用。
6. `last-train/v2` 只做结构 / 运行时辅助；主基准固定为 v7 `scavenger-actor` idle 4 帧。

## 11. 证据索引

- 基准包：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
- 真实生成现场：`.scratch/style-migration-v1/runs/2026-10-19i-real-frames/ruin-scavenger-extraction-assets/failed-2026-10-19T11-50-47-861Z/`
- v7 施工记录：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/lurker-report.md`、`lurker-result-v7.json`、`run-rebuild.mjs`
- 票 12：`.scratch/asset-integration-v1/issues/12-alternative-animation-model.md`
- 票 09 / 14 / 15 / 16：`.scratch/asset-integration-v1/issues/` 与 `runs/2026-10-21{a..f}/`
- 票 09 证据：`.scratch/asset-integration-v1/runs/2026-10-21a-smoke/evidence/`
- 资格 / 决赛证据：`.scratch/asset-integration-v1/runs/2026-10-21{d,e,f}-*/evidence/`
- CDP：`.scratch/asset-integration-v1/runs/2026-10-20e-site/`（v6）
- 辅助夹具：`fixtures/packs/last-train/v2/`
- 相邻取证：`.scratch/animation-acceptance-v1/research/h-test-inventory.md`（v7 零测试引用、verify 不解码图集）
