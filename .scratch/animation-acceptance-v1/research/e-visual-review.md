# 05 · E · 视觉审查能力（Phase 0 取证）

- **基线**：`main` · `f0dac01`
- **日期**：2026-10-21
- **范围**：`docs/v5/动画.md` §3、§4.5、§5；本票指定必查路径 + 仓库内可见的预览 / 联系表 / CDP / 人眼记录。
- **方法**：只读源码与已有产物；跑了两份**已有**单测（见 §9）；未跑 `pnpm check` / `pnpm build`、未写 `out/`、未发起任何生图或视觉模型调用、未改任何工具。
- **证据级别**：E1 源码 · E2 测试 · E3 已有产物 / 真实运行产物 · R 本次运行（命令 + 结果）。
- **状态**：`implemented` / `partial` / `missing` / `unverified`（`unverified` 不折算成 `missing`）。
- **“能看 / 能判”口径**：
  - **能看** = 存在人可直接观察的产物（PNG / HTML / 截图）或能一条入口生成它；
  - **能判** = 有确定性的判据与阈值并进入门禁（或至少在该次运行里有明确 verdict）；**视觉模型的描述不计入“能判”**。
- **“阻断”口径**：阻断 = 会让 `create/build` 或人工验收流程失败；仅生成材料不计。

---

## 0. 核心结论（先看这一段）

1. **不是“什么都没有”。** 仓库已有三块真能力：① `packContactSheet()` 联系表库 + 其测试；② `game-maker site` 真实游戏渲染 + 已落盘的 CDP 截图；③ `.scratch` 里成型的「基线 vs 候选联系表 + 目标 FPS 循环预览」产物与脚本模板。
2. **但它们没有汇成一个可复用的视觉审查入口。** 联系表没有 CLI / 落盘出口；循环预览与并列比较是**每个付费 run 各自复制一份**的脚本（4 份 `alphaDiff` / `upscale` / `contact.png` 拷贝）；预览页硬编码旧包路径且未入库。
3. **“Visual QA”不等于“看外观”。** `visualQaRunner` 只做两条元数据判据（构造性约束、色板绑定自洽），读不到 PNG、读不到参考图；能阻断，但**判不了画面**（`packages/qa/src/visual.ts:84-100`）。
4. **视觉模型有边界且边界写死在代码里。** `reviewPack` 是**付费、人工触发、只描述差异、不打分、不阻断、不进自动链**；`qaVerdict()` 字面上不看 `observations`。没有发现“把视觉模型观察当确定性判定”的代码路径。
5. **人工结论有记录，但没有结构化。** 04 / 08 / 15 / 16 的 `## Answer` 里有人裁逐字结论；但 15 / 16 要求的“逐项记录”没有落成清单，`result.json` 的 `humanVerdict` 至今仍是 `"pending"`（人已裁定之后）。
6. **追溯是部分成立。** 包清单有 `id / version / files[].checksum`；run 目录与票面互相引用。但 `contact.png` / `loop-preview.html` / `result.json` 都**不内嵌**包版本或 checksum，脚本里是硬编码路径。

---

## 1. 能力分类（四类归位）

### 1.1 可直接复用

| # | 能力 | 状态 | 能看/能判 | 阻断 | 入口 / 证据 |
|---|---|---|---|---|---|
| D1 | **单帧 PNG 产物直接查看**（所有动画帧都在盘上） | implemented（产物） | 能看 | 否 | 包 v7：`.../pack/v7/authoring/generated/` 132 个文件（66 图 + 66 prompt）；`delivery/atlas.animations.png`；候选 run：`2026-10-21f-finalist/evidence/{scavenger,enemy}/{decoded,imported,baseline-imported}/`（E3） |
| D2 | **`packContactSheet()` 联系表合成库** | implemented（库 + E2） | 能看 | 否 | `packages/assets/src/review.ts:24-70`；`packages/assets/tests/review.test.ts:34-51`；本次 `vitest` 11/11 通过（R）。**注意：无 CLI / 无落盘出口**，只有 `reviewPack` 内部调用与测试 |
| D3 | **真实游戏渲染（站点）** | implemented | 能看 | 否 | `game-maker site`：`packages/cli/src/cli.ts:575-593`；装配器 `packages/demo/src/site.ts:1-6`；已有站点 `.../runs/2026-10-20e-site/out/.../site/v3/`（`site.json: pack v7`）+ `cdp-*.png`（E3） |
| D4 | **QA 视觉族的结构性判据（唯一会阻断的“视觉”判据）** | implemented | **能判（仅元数据）** | **是**（`error` ⇒ `CommandError("invalid")`，退 4） | `packages/qa/src/visual.ts:84-100`（只声明 `constructive-constraint` / `palette-binding`）、`:110-123`、`:157-174`；阻断：`packages/pipeline/src/create-game.ts:215-226, 542-544`；测试：`packages/qa/tests/visual.test.ts` 14/14 通过（R） |
| D5 | **`inspectPack` 免费观察**（色板使用、源图尺寸、背景覆盖率…） | implemented | **只报数，不判** | 否 | `packages/assets/src/ops.ts:1900-1957`；已接入创建链作为 QA observation：`packages/pipeline/src/create-game.ts:511-527`；测试 `packages/assets/tests/inspect.test.ts` |
| D6 | **`reviewPack` / `game-maker review` 视觉模型观察** | implemented（库 + CLI + E2）；**真实运行 unverified** | **只看差异，不判** | 否 | `packages/assets/src/review.ts:100-112, 141-161, 181`；`packages/pipeline/src/review.ts:76-141`；`packages/cli/src/cli.ts:32-35, 603-609`；测试 `packages/assets/tests/review.test.ts`、`packages/pipeline/tests/review.test.ts`（R：11/11） |

**归位理由**：D1–D3 已经能产出人眼可看的材料；D4–D5 是确定性判据 / 观察，可直接复用；D6 只作辅助观察，**不能**当判定。

### 1.2 可通过少量改造复用

| # | 能力 | 状态 | 能看/能判 | 阻断 | 入口 / 证据 | 改造点 |
|---|---|---|---|---|---|---|
| M1 | **整包预览页**（逐动画循环 + 静态块 + 背景分层） | partial | 能看 | 否 | `.scratch/style-migration-v1/preview/index.html`（**untracked**）：`PACK` 硬编码 `:43`；动画卡片 `:84-99`，按 `anim.fps` 循环 `:98`；旧包 `2026-10-19l/.../pack/v1` 仍存在 | 改成 `?pack=` 参数 / 去掉硬编码；补帧序号与暂停/步进；入库到 `scripts/` 或 `packages/demo` |
| M2 | **基线 vs 候选循环预览（目标 FPS，8×）** | partial | 能看 | 否 | 生成模板：`2026-10-21d-qualification/qualify.mjs:240-250`；`2026-10-21e-enemy-retry/retry-enemy.mjs:228-241`；`2026-10-21f-finalist/finalist.mjs:241-254`；产物 `evidence/<char>/loop-preview.html` | 抽成独立生成器；加播放/暂停/上一帧/下一帧/帧号；去掉“2.5 baseline / 3 Pro candidate”这类**非盲标**；修正 finalist 页头仍写 “qualification sample … not full loop”（`finalist.mjs:244`） |
| M3 | **并列联系表 + 机械指标（同一 trim 框、同尺寸、8× nearest）** | partial | **能看 + 临时能判** | 在人工规则内阻断（非代码门禁） | `qualify.mjs:123-133`（`measure` 同一导入管线）、`:134-145`（`alphaDiff`）、`:178`（`upscale`）、`:228-236`（绿/黄/红）、`:237`（`contact.png` 两列：左 baseline / 右 candidate）；产物 `2026-10-21f-finalist/evidence/scavenger/contact.png`（776×2072，两列无文字） | 把 `measure/alphaDiff/upscale/hstack/vstack` 收进一个共享模块 + 单测；把阈值（票 12）写进代码；在 PNG 上打标签 |
| M4 | **CDP 驱动（按键 / eval / 多点截图）** | partial | 能看 | 否 | `2026-10-20e-site/drive-cdp.mjs`（tracked，41 行，按键 + 截图）；更通用的是 `p0-00-audit/runs/2026-10-20a-head-replay/drive.mjs`（**untracked**，支持 `wait/shot/down/up/eval/inject/reload`） | 提升为仓库脚本；加 clip 选择 / 帧步进 / 固定时间序列；记录包版本 |
| M5 | **无头 Chrome 单帧截图探针** | partial | 能看（单帧） | 否 | `packages/demo/probe/smoke.mjs:56-65`（`--screenshot` + `--dump-dom`）、`:124`；依赖本机 Chrome；写 `out/__probe`（被 .gitignore） | 只适合“起没起来”的单帧证据；序列 / 交互需 M4 |
| M6 | **人工裁定的文字记录（issue `## Answer`）** | partial | **人判** | 人工闸（策略性） | `04-palette-coat-review.md:29-41`、`p0-00-audit/issues/08-visual-comparison-rulings.md:44-70`、`15-a-qualification.md:125-135`、`16-a-finalist-full-loop.md:83-93` | 从散文升级为结构化清单（逐项 + 盲标 + 版本 + 时间 + reviewer），并回写 `result.json` |

### 1.3 需要新增

| # | 能力 | 状态 | 能看/能判 | 阻断 | 现状证据 |
|---|---|---|---|---|---|
| N1 | **免费的、带标签的统一视觉审查入口**（输入包/候选 → 输出 contact sheet + preview + 索引 JSON，零模型调用） | missing | 能看 | 否 | `packContactSheet` 只是库（`review.ts:24`），CLI 只有付费 `review`；预览页是 untracked 硬编码页 |
| N2 | **共享图像比较模块**（alpha 掩码差 / bbox 宽差 / 位置漂移 / 背景众数色 L1 / 色数 / 边界深色 / off-palette） + 票 12 阈值 + 单测 | missing | **能判（若接入门禁）** | 视接入方式 | 仓库内 `grep` 无 `alphaDiff` / `meanL1` 实现；同一段代码在 4 个 `.scratch` 脚本里各复制一份：`screen.mjs`、`qualify.mjs`、`retry-enemy.mjs`、`finalist.mjs`（R：grep 命中 4 文件） |
| N3 | **结构化人工审查记录**（逐项清单、A/B/C 盲标、pass/fail、评审人、时间、证据链接） | missing | 人判 | 人工闸 | 票 15 / 16 要求“逐项记录”（`15-a-qualification.md:34-38, 41-45`；`16-a-finalist-full-loop.md:28-32`），实际 Answer 只有一句“人眼清单通过”（`15:132`）；finalist HTML 直接标模型名（`qualify.mjs:241-242`） |
| N4 | **审查产物 ↔ 资源版本 / checksum 绑定** | partial → 需补字段 | 否（追溯） | 否 | 包清单有 `id/version/files[].checksum`（`pack/v7/manifest.json`）；但 `result.json` 无 pack 字段（R：`21d/21f` top-level keys 无 pack/version），`contact.png` / `loop-preview.html` 不内嵌版本；脚本硬编码 `RUN = .../2026-10-20f-lurker`、`GEN = .../pack/v7/...`（`finalist.mjs:27-28`） |
| N5 | **游戏内帧步进 / 选 clip / 按 manifest fps 播放 / 冻结帧** | missing | 能看（细粒度） | 否 | shell 的 fps 是写死的：实体 `frameRate: 8`（`packages/demo/src/shell/scene.ts:140`），玩家 `run ? 10 : 6`（`:193`），且全部 `repeat: -1`；manifest 的 `fps/loop`（v7：idle 6 / run 12 / jump 10 / patrol 8 / charge 14 / lunge 14 …）**未被读取**；`new Phaser.Game` 未暴露全局句柄（`shell/entry.ts:75-77`），CDP 只能发按键 |
| N6 | **自动截图回归 / 像素 diff 基线** | missing（本图范围内） | 能看 | 否 | 根 `package.json` 无 playwright/puppeteer；只有 Chrome CLI + 手写 CDP |

### 1.4 目前无法确认

| # | 事项 | 状态 | 说明 / 证据 |
|---|---|---|---|
| U1 | `site/v3` 在 HEAD 上能否原样跑起来 | unverified | 产物存在（`site/v3/{index.html,shell.js,site.json,game-config.json}`，`site.json` 指 `pack: v7`），但本票只读、未起服务；上次真实运行为 2026-10-20（`site-report.md`） |
| U2 | `game-maker review` 的真实 live 行为（HEAD） | unverified | 库 / CLI / 测试齐全；**没有找到任何带 `"step": "review"` 的 ledger**（R：grep `.scratch/**/ledger.json` 零命中）。唯一带真实观察的执行是更早的 `game-creation-v1/experiments/real-generation/README.md:51-62`（非本基线） |
| U3 | `contact-sheet-v6.png` / `contact-sheet-v7.png` 的生成脚本 | unverified | 产物存在（`2026-10-20d-groundline/evidence/`、`2026-10-20f-lurker/evidence/`），但对应 run 脚本里搜不到生成代码；无法确认可复现 |
| U4 | `p0-00-audit/.../visual-compare/*.png` 的生成方式 | unverified | 6 张对照图存在且被 08 票引用；未找到生成脚本（可能是临时命令） |
| U5 | 预览页对任意新包的实际渲染 | unverified | 页面依赖 `fetch`（需 HTTP server），且 `PACK` 指旧包；本次未起服务验证 |

---

## 2. 逐项证据详情

### 2.1 逐帧 / 联系表（问题 1）

**能看的层面：成立。**
- 交付包 v7 有 19 资源、76 帧、13 个动画 / 61 个动画帧；动画帧既有原始生成图 `authoring/generated/scavenger-actor.idle{1..4}.png`，也在交付图集 `delivery/atlas.animations.png` 里。
- 候选 run 把每帧的三种形态都落了盘：`decoded/`（模型原始输出）、`imported/`（导入后的交付尺寸）、`baseline-imported/`（同样管线处理的 2.5 基线）。例：`2026-10-21f-finalist/evidence/scavenger/{imported,baseline-imported}/scavenger-actor.idle{1..4}.png`。
- 因此“独立查看某一帧”只需图片查看器，**无需任何工具**。

**“一张表看全”的层面：库有，入口没有。**
- `packContactSheet()`（`packages/assets/src/review.ts:24-70`）从 `manifest.atlases` 逐图集解码、按帧矩形裁切、放大、拼成一张。它被单测真实覆盖（E2）。
- 但全仓没有免费 CLI / 脚本调用它并写文件；`game-maker review` 虽然内部调用它，却是**付费视觉调用**，且返回值里的 `contactSheet` 不会被 CLI 落盘（`pipeline/src/review.ts:126-141` 只输出文字与 data，不含图片）。
- 且联系表**没有标签与动画分组**：帧顺序是图集 JSON 的 `frames` 对象顺序，不是 `manifest.assets[].animations` 的动画顺序（`review.ts:29-41`）。看得到全部帧，但“哪一格是哪一帧”要靠外部说明。

**预览页** `.scratch/style-migration-v1/preview/index.html` 补上了“按动画分组”的看：每个 `asset.kind === "animation"` 的每个 `animations[]` 生成一张卡片，按 `anim.frames` 顺序、`anim.fps` 循环（`:84-99`），并展示静态资源与背景分层合成。它是**未入库**的一次性页面，`PACK` 指 `2026-10-19l` 的 v1 包（`:43`）。

**状态：partial。** 能看；不可直接 `game-maker` 调用；联系表可定位性弱。

### 2.2 按指定顺序播放（问题 2）

- **预览页**：顺序 = `anim.frames` 的清单顺序，速率 = `anim.fps`（缺省 8），循环（`:94, :98`）。这是最接近“按指定顺序播放”的现成实现；但没有暂停、步进、帧号，也不能指定任意顺序（如 1→3→2）。
- **候选 loop preview**：`qualify/retry/finalist` 生成的 HTML 用两个 `<img>` 同步播放 `baseline-imported` 与 `imported`，顺序 = 脚本里的 `frames` 数组，速率 = 角色 `fps`（`qualify.mjs:250`；`finalist.mjs:250`）。同样无控制、无帧号；finalist 页头还残留 “not full loop”（`finalist.mjs:244`）。
- **游戏内**：动画能按 config 自动播放（idle / run / jump 由输入切换，实体按配置播一个 clip），但 fps 写死（§1.3 N5），不读 manifest 的 `fps/loop`。因此“游戏内按目标 FPS 播放”**不成立**。

**状态：partial。** 能看“按清单顺序循环”，不能精确控制。

### 2.3 基线 vs 候选并列、统一条件（问题 3）

现成做法全部来自 `.scratch` 的付费 run 脚本，但方法是正确的：
- `measure()` 对基线帧与候选帧走**同一条**导入管线（同色板、同目标尺寸、同抠底 / 去碎点 / 去地面线），再 `upscale(8)`（`qualify.mjs:123-133, :178`）。
- `contact.png = vstack(frames.map(f => hstack([baseline, candidate])))`，即每行一对、左基线右候选（`qualify.mjs:237`；`finalist.mjs:241`）。
- 机械指标同时算 `alphaDiff / widthDiffPct / posDriftPct / keyL1 / 色数 / off-palette / 边界深色`，并按票 12 阈值给绿/黄/红（`qualify.mjs:134-145, :218-236`）。
- 已有的并列产物：`2026-10-21f-finalist/evidence/scavenger/contact.png`（776×2072）、`enemy/contact.png`（776×2344）；更早的 `2026-10-20d-groundline/evidence/compare-v4-*.png` / `compare-v6-*.png`；`.scratch/p0-00-audit/.../visual-compare/q1-*.png` / `q2-*.png`。

**缺口**：
- 这套“统一条件”只存在于**当次脚本**里，没有共享实现与测试；4 份拷贝很容易漂移。
- `contact.png` 上**没有文字标签**（尺寸恰为两列 384×512 + gap），“哪边是基线”只写在脚本 / 票面里。
- 机械 verdict 只在该 run 的 `result.json` 里（`mechanicalVerdict`），不是仓库门禁。

**状态：partial。** 能看；机械“能判”但只在人工流程里生效。

### 2.4 游戏内实际效果（问题 4）

- **入口是仓库命令**：`game-maker site <pack> --config <game-config>`（`cli.ts:575`）；输出 `out/<gameId>/site/v<N>/`，必须从 `out/<gameId>/` 起 HTTP server（`cli.ts:64-65`；`site-report.md` 的实测命令）。
- **已有真实产物**：`2026-10-20e-site/out/.../site/v3/`（`site.json`：`pack: "v7"`），截图为 `cdp-a.png` / `cdp-b.png`（相隔 900ms，idle 在动）、`cdp-run.png` / `cdp-jump.png`；报告 `site-report.md` 记录了 19/19 资源进场景。
- **驱动**：`drive-cdp.mjs`（tracked）只发 `ArrowRight` / `Space` 并在固定时刻截图；`p0` 的 `drive.mjs`（untracked）更通用（`eval` / `inject` / `reload`）。仓库自身的 `packages/demo/probe/smoke.mjs` 用 `chrome --screenshot` 做单帧冒烟，不进 CI，且写 `out/__probe`。
- **限制**：不能选 clip、不能步进帧、不能暂停；`charge/halt/standby` 这类未配置进关卡的 clip 在站点里看不到；shell 不暴露 Phaser 全局句柄（`entry.ts:75`），CDP 无法直接 `anims.pause()` / 设定 `currentFrame`。

**状态：implemented（工具与产物），HEAD 运行时 unverified。** 能看“角色在游戏里的样子”，不能做帧级审查。

### 2.5 人工审查记录（问题 5）

**已有的记录位置：**
- `.scratch/p0-00-audit/issues/08-visual-comparison-rulings.md:44-70`：风格一致度 / 新实体同世界的人裁逐字结论，附 `visual-compare/*.png`。
- `.scratch/asset-integration-v1/issues/04-palette-coat-review.md:29-41`：色板 / 外套的人裁，附 `04-evidence/player-*-8x.png`。
- `.scratch/asset-integration-v1/issues/15-a-qualification.md:125-135`：人裁“通过”，写了机械读数与人眼“通过”。
- `.scratch/asset-integration-v1/issues/16-a-finalist-full-loop.md:83-93`：人裁“拒绝 A”。

**缺口（票面自己要求的）：**
- 票 15 要求“人眼 verdict（pass/fail + 逐项）”“评审人：你；逐项记录结论”（`15:34-38, 41-45`）；票 16 同样要求“逐项记录”（`16:28-32`）。实际 Answer 只有汇总句，没有 7 项清单的逐项结论。
- 票 12 Q3 要求“A/B/C 盲标”（`12-alternative-animation-model.md:68`）；实际预览页直接写 “2.5 baseline / 3 Pro candidate”（`qualify.mjs:241-242`、`finalist.mjs:245-246`），**不盲**。
- run 的 `result.json` 里 `humanVerdict` 在写盘时固定为 `"pending"`（`finalist.mjs:258`），人裁之后没有任何脚本回写：`2026-10-21f-finalist/result.json:1007` 仍是 `"pending"`，而 16 的 Answer 已“拒绝 A”。`21d/result.json:475`、`21e/result.json:242` 同样。

**状态：partial（有结论，缺结构化与回写）。** 能由人判；不能机器读取。

### 2.6 追溯性（问题 6）

**成立的一半：**
- 包清单带 `id / version / createdAt / files[].checksum`（`pack/v7/manifest.json`，checksum 如 `sha256:e08c…`）。
- run 目录按日期 / 主题命名，票面 `Answer` 明确写“证据：`runs/2026-10-21f-finalist/`”。
- 站点 `site.json` 明确 `"pack": "v7"`。

**缺的一半：**
- `result.json` 只写模型、帧名、指标、`humanVerdict`，**不写**包路径 / 版本 / checksum（R：21d / 21f top-level 无 pack / version 键）。
- `contact.png` / `loop-preview.html` 内部没有版本或 checksum；文件位置是唯一线索。
- 生成脚本硬编码 `RUN = .scratch/.../2026-10-20f-lurker` 与 `GEN = .../pack/v7/authoring/generated`（`finalist.mjs:27-28`），换包要改代码。
- `reviewRun` 抽查的是“该 gameId 下**最新**的包”（`pipeline/src/review.ts:32-46`），而 run 目录没有记录它产了哪个包版本 ⇒ 结果与包的对应关系靠 `packVersion` 打印，不落盘。

**状态：partial。** 人可通过目录 + 票面追溯；产物不自描述。

### 2.7 视觉模型分析（问题 7）

仓库里只有两处视觉模型调用：

| 能力 | 入口 | 付费？ | 触发方式 | 输出 | 谁消费 | 是否阻断 | 是否被当判定 |
|---|---|---|---|---|---|---|---|
| `reviewPack` / `game-maker review` | `packages/assets/src/review.ts:100-186`；`pipeline/src/review.ts:76`；`cli.ts:603` | **是**（一次 `/v1/messages`，进 run 级 ledger） | **人主动**调用；不在 `createGame` / `runBuild` / QA 链上（`pipeline/src/review.ts:1-10`） | 观察清单 + `raw` + 内存里的联系表 + `LedgerCall` | CLI 打印 / `--json` 输出；QA 的 `review` observation 恒为 `unavailable`（`qa/src/assemble.ts:96-103, 133-141`） | **否**（`review.ts:13`；`pipeline/src/review.ts:131`） | **否**：prompt 明确“不打分、不排名、不给通过/不通过”（`review.ts:152-158`）；文件头三条边界（`:9-13`）；`qaVerdict()` 不看 observations（`contracts/src/qa.ts:356-378`） |
| `analyzeReference` | `packages/vision/src/analyze-reference.ts:303`；在 `createGame` 第一步自动调用 `pipeline/src/create-game.ts:279` | **是**（结构化文本/视觉上游，进 ledger） | 自动（理解层第一步） | `VisualWorldSpec`（模型读参考图 + 需求文本） | 装配成 `visual-world.json`，再驱动规划 / 生成 / 提示词 | 间接：schema 不过会重采样 / 失败 | **不是验收判定**：输出是**设计输入**；`buildVisualWorld` 重新过契约（`vision/src/build-visual-world.ts:31-48`），色板另由**确定性** `extractPalette` / `applyDeterministicPalette` 覆盖（`vision/src/palette.ts:162, 203`） |

**结论：**
- 没有发现把视觉模型输出当确定性判定的代码路径。质量结论来自：① 本地像素机械指标（脚本里）；② 人眼；③ 结构性 QA。视觉模型只是“描述差异”的辅助材料，且不进自动门禁。
- 残余风险（记录，不在本票修）：`analyzeReference` 的模型输出**作为世界规格被下游信任**，契约只校验形状不校验“看得对不对”；它虽不是“判定”，但会决定后续生成的世界观。票 12 的验收标准没有把它当判据，这一点在文档上是对的。
- `reviewPack` 默认模型是 `deepseek-v4-pro`（`review.ts:141`），走 `/v1/messages` 视觉图块；需要配置 transport。**零付费自检也不存在**：函数一被调用就发请求（除非构造失败在拼联系表 / 读原图阶段，`review.ts:120-128`）。

---

## 3. 任务书 §4.5 七问逐条回答

| # | 问题 | 回答 | 状态 | 关键证据 |
|---|---|---|---|---|
| 1 | 当前能否独立查看全部动画帧？ | **能看，但“全部 + 可定位”只有半套。** 所有帧都有 PNG；`packContactSheet` 能拼一张全表；预览页能按动画分组循环。缺免费入口、缺标签、缺动画分组顺序。 | partial | `review.ts:24-70`；`preview/index.html:84-99`；`pack/v7/authoring/generated/`；`2026-10-21f/evidence/*/imported/` |
| 2 | 能否按指定顺序播放动画？ | **能按清单顺序循环，不能任意指定 / 步进。** 预览页与 loop preview 都按数组顺序 + fps 循环；游戏内 fps 写死、不读 manifest。 | partial | `preview/index.html:94-98`；`qualify.mjs:246-250`；`scene.ts:140,193` |
| 3 | 能否在统一展示条件下比较两个版本？ | **方法存在且被真实用过，但没有工具化。** 同 trim 框 / 同尺寸 / 同色板 / 8× nearest，左基线右候选；四份脚本拷贝，PNG 无标签。 | partial | `qualify.mjs:123-145,178,237`；`finalist.mjs:241`；`finalist/evidence/scavenger/contact.png` |
| 4 | 能否查看角色在游戏中的实际效果？ | **能。** `game-maker site` + 已落盘的 site/v3 与 CDP 截图；限制是不能选 clip / 步进，未配置的 clip 看不到。 | implemented（HEAD 运行时 unverified） | `cli.ts:575-593`；`site/v3/site.json`；`cdp-*.png`；`site-report.md` |
| 5 | 是否保存人工审查结论？ | **保存了结论，没保存逐项。** issue `## Answer` 有逐字裁定；票 15/16 要求的逐项清单没有；`humanVerdict` 永远 `pending`。 | partial | `15:125-135`；`16:83-93`；`21f/result.json:1007`；`04/08 Answer` |
| 6 | 审查结果能否追溯到具体资源版本？ | **部分。** 包清单有 checksum；run 目录 + 票面可人肉追溯；审查产物本身不内嵌版本 / checksum，`result.json` 不记 pack。 | partial | `pack/v7/manifest.json` `files[]`；`finalist.mjs:27-28`；`21f/result.json` |
| 7 | 是否已有视觉模型分析能力，且其结果是否被错误地当作确定性判定？ | **有能力；没有被当确定性判定。** `reviewPack` 明确只观察、不判分、不阻断、不进链；`analyzeReference` 是设计输入而非验收判定；QA 裁决不看 observations。 | implemented / unverified（真实 review 运行） | `review.ts:9-13,152-158`；`pipeline/review.ts:1-10`；`contracts/qa.ts:356-378`；`vision/analyze-reference.ts:303` |

---

## 4. 与任务书 §5 缺口规则的对应

| 缺口类型 | 本票命中项 |
|---|---|
| §5.1 缺失能力 | 免费统一视觉审查入口（N1）；共享图像比较模块（N2）；结构化人工审查记录（N3）；游戏内帧步进 / clip 选择 / manifest fps（N5） |
| §5.2 已有能力但缺少覆盖 | `packContactSheet` 只有单测，没有对真实 v7 包的回归；预览页没有“全部动画 + 全帧”的自动检查；机械指标脚本没有负例测试 |
| §5.3 已有能力但缺少追溯 | 审查产物 ↔ pack version / checksum（N4）；`humanVerdict` 不回写；`reviewRun` 取“最新包”而非 run 产出的包 |
| §5.4 已有能力但尚未验证 | `game-maker review` 真实 live（U2）；site/v3 在 HEAD 重跑（U1）；旧 contact sheet / visual-compare 的生成（U3/U4） |
| §5.5 设计不一致 | ① 票 12 要 A/B/C 盲标 vs 预览页直标模型名；② finalist 全循环页头写 “not full loop”；③ 游戏内 fps 写死 vs manifest 有 `fps/loop`；④ “Visual QA”名字 vs 只判元数据；⑤ `humanVerdict: pending` vs 人已裁定 |

---

## 5. Phase 1 视觉审查最小方案（建议，不在本票实施）

**目标**：零付费、可复现、可追溯地“看到”基线 / 候选的全帧与循环，并让人的结论有结构化的落点；视觉模型保持可选、付费、人工、非门禁。

**P1-1 冻结审查输入（0 付费）**
- 选定基线：v7 包路径 + `manifest.id/version` + `manifest.json` 与图集 JSON/PNG 的 `files[].checksum`。
- 选定候选：候选帧所在 run 目录 + 每帧文件清单。
- 产出 `visual-review.json`（建议落 `<run>/visual-review/`）：
  `baseline: {packId, packVersion, manifestChecksum}`, `candidate: {runDir, frames[]}`, `createdAt`, `toolVersion`。
- 复用：`AssetPackManifest.files[]`（已有 checksum），不新增哈希算法。

**P1-2 免费联系表入口**
- 复用 `packContactSheet()`（`assets/src/review.ts:24`）。
- 新增一个**不调模型**的入口（建议 `pipeline` 薄函数 + CLI `review-sheet <pack> --out <dir>`，或 `scripts/visual-review/sheet.mjs`），写出 `contact-sheet.png` + 同名 JSON（每格 → asset / anim / frame 名）。
- 建议在 `assets` 里补一个 `packContactSheetWithLabels()` 或在同层加文字标签（`assets` 已有 PNG 编解码与 `sheet.ts` 的 `montageRow` 可复用）。
- 测试：用 v7 真包断言“格数 = 76 / 动画帧 61”、每格能回指到 `manifest` 里的 frame 名。

**P1-3 预览页工具化**
- 把 `.scratch/style-migration-v1/preview/index.html` 提升为仓库页面（建议 `scripts/visual-review/preview.html` 或 `packages/demo` 的静态页）：
  - `?pack=<path>` 参数替代硬编码 `PACK`（`preview:index.html:43`）；
  - 每个动画一张卡片：帧序号 / 帧名 / `fps` / `loop`；
  - 播放 / 暂停 / 上一帧 / 下一帧；
  - 侧栏放两个 slot（baseline / candidate），可同时加载两个包做逐动画对照；
  - 页面顶部显示 `packId@version` 与 `manifest` checksum（来自 P1-1）。
- 它仍只依赖 HTTP 静态服务，不需要新依赖。

**P1-4 共享比较模块**
- 把 `.scratch` 里 4 份拷贝收进 `packages/assets/src/compare.ts`（`assets` 已有 PNG 解码器）：
  - `alphaMaskDiff` / `bboxWidthDiffPct` / `posDriftPct` / `dominantColorL1` / `paletteCount` / `offPalette` / `boundaryDarkPct`；
  - 票 12 的绿 / 黄 / 红阈值（`12-alternative-animation-model.md:74-86`）作为常量与 `verdictOf()`；
  - 输出 JSON + 生成 `contact.png` / `loop-preview.html` 的纯函数。
- 测试：把 `qualify.mjs` / `finalist.mjs` 的现有读数作为 fixture，断言重算逐项相等；再加负例（改一帧、改背景色）。
- **注意依赖方向**：`qa` 只许依赖 `contracts`（`scripts/check-deps.mjs:24`），比较模块应放 `assets`，由 `pipeline` / CLI 调用，不要塞进 `qa`。

**P1-5 游戏内取证**
- 复用 `game-maker site`（`cli.ts:575`）+ `drive-cdp.mjs`：
  - 对冻结包重新装配一个 review 站点（不写 `out/` 之外的产物；按本图 Q3，截图写 `.scratch/animation-acceptance-v1/runs/`）；
  - 固定脚本：idle 两帧（≥900ms 间隔）、按住 `ArrowRight` 采 run、`Space` 采 jump；对已配置实体采 patrol / hang / lunge / retreat；
  - 报告里写 `site.json` 的 `pack` 版本 + `manifest` checksum。
- 若必须帧级：Phase 1 可加一个**仅 review 用**的查询参数（如 `?review=1`）在 `packages/demo/src/shell/scene.ts` 暴露“暂停 / 下一帧 / 选择 clip”；这是可选拉伸项，不是最小必需。
- 不在 Phase 1 引入 playwright / puppeteer；继续用现有 Chrome + CDP。

**P1-6 人眼裁定模板**
- 每动画一份 `review.json` / `review.md`（建议落 run 的 `visual-review/`），字段：
  `packId@version`、`anim`、`frames[]`、`mechanical`（绿/黄/红 + 读数）、`human.items`（身份/轮廓/比例、姿势族、明暗/色板、无呼吸/跳变、透明边缘、1px 描边、风格一致 7 项）、`human.verdict`、`reviewer`、`reviewedAt`、`evidence[]`。
- 盲标：预览页用 A / B 标签，映射写到单独文件（人或脚本最后再揭示）。
- 人裁后把 `result.json` 的 `humanVerdict` 从 `pending` 改成实际值（或在 `visual-review.json` 里写），并把证据文件路径写进去。

**P1-7 视觉模型（可选）**
- 继续用 `game-maker review`：付费、人工、只观察；结果不进门禁、不进 QA 裁决。
- 若 Phase 1 要用，必须先出预算报告 + 逐字点头；观察清单与 ledger 一起归档（ledger 已有 `review` step）。
- **不建议**把视觉模型引入自动验收；票 12 的验收标准是机械 + 人眼，没有模型判据。

**Phase 1 验收（建议）**
- [ ] 任一包 + 任一候选 run → 一条免费命令产出带标签联系表 + 全帧预览 + `visual-review.json`（含版本/checksum）。
- [ ] 同一对输入重跑，联系表 / 指标 JSON 逐字节稳定（除时间戳）。
- [ ] 比较模块有单测，读数与 `qualify/finalist` 现有结果一致。
- [ ] 人裁模板能记录 7 项逐项结论，`humanVerdict` 不再停留在 `pending`。
- [ ] 全程零模型调用；视觉模型仍为可选付费旁路。

---

## 6. 已运行 / 未运行

**已运行（R）**
```text
pnpm exec vitest run packages/assets/tests/review.test.ts packages/qa/tests/visual.test.ts
→ Test Files 2 passed (2) · Tests 25 passed (25) · Duration 947ms
```
- 说明：`review.test.ts` 覆盖 `packContactSheet` 的真实像素拷贝、两张图喂给视觉端点、失败不抛；`qa/tests/visual.test.ts` 覆盖两条元数据判据的正例/负例。

**未运行（及原因）**
- 未跑 `pnpm check` / `pnpm build` / 任何写 `out/` 的命令 —— 本图 Q2 边界。
- 未起 `site/v3`、未跑 CDP —— 本票要求只读，且会写新截图；运行时证据沿用 `2026-10-20e-site`。
- 未调用任何生图 / 视觉 / 文本上游 —— 零付费。
- 未改任何预览工具 / 脚本 / 源码。

**未能验证**
- U1–U5（见 §1.4）：HEAD 站点可跑性、`review` live、旧联系表 / 对照图生成脚本、预览页对新包的渲染。

---

## 7. 文件索引（证据路径）

**源码**
- `/Volumes/shy/some-projects/game-maker/packages/assets/src/review.ts`
- `/Volumes/shy/some-projects/game-maker/packages/pipeline/src/review.ts`
- `/Volumes/shy/some-projects/game-maker/packages/cli/src/cli.ts`
- `/Volumes/shy/some-projects/game-maker/packages/qa/src/visual.ts`
- `/Volumes/shy/some-projects/game-maker/packages/qa/src/assemble.ts`
- `/Volumes/shy/some-projects/game-maker/packages/contracts/src/qa.ts`
- `/Volumes/shy/some-projects/game-maker/packages/vision/src/analyze-reference.ts`
- `/Volumes/shy/some-projects/game-maker/packages/vision/src/build-visual-world.ts`
- `/Volumes/shy/some-projects/game-maker/packages/vision/src/palette.ts`
- `/Volumes/shy/some-projects/game-maker/packages/demo/src/site.ts`
- `/Volumes/shy/some-projects/game-maker/packages/demo/src/shell/scene.ts`
- `/Volumes/shy/some-projects/game-maker/packages/demo/probe/smoke.mjs`
- `/Volumes/shy/some-projects/game-maker/packages/assets/src/sheet.ts`（`montageRow` 等可复用图块）

**测试**
- `/Volumes/shy/some-projects/game-maker/packages/assets/tests/review.test.ts`
- `/Volumes/shy/some-projects/game-maker/packages/pipeline/tests/review.test.ts`
- `/Volumes/shy/some-projects/game-maker/packages/qa/tests/visual.test.ts`

**已有产物**
- `/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/manifest.json`
- `.../pack/v7/authoring/generated/`（132 文件）
- `.../pack/v7/delivery/atlas.animations.{png,json}`
- `/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/runs/2026-10-21d-qualification/evidence/scavenger/{contact.png,loop-preview.html}`
- `/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/runs/2026-10-21f-finalist/evidence/{scavenger,enemy}/{contact.png,loop-preview.html,imported/,baseline-imported/}`
- `/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/runs/2026-10-20e-site/{cdp-a.png,cdp-b.png,cdp-run.png,cdp-jump.png,drive-cdp.mjs,site-report.md}`
- `/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v3/`
- `/Volumes/shy/some-projects/game-maker/.scratch/p0-00-audit/runs/2026-10-20a-head-replay/visual-compare/`
- `/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/runs/2026-10-20d-groundline/evidence/{contact-sheet-v6.png,contact-sheet-v6-1600.png,compare-v4-*.png,compare-v6-*.png}`
- `/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/runs/2026-10-20f-lurker/evidence/contact-sheet-v7.png`
- `/Volumes/shy/some-projects/game-maker/.scratch/style-migration-v1/preview/index.html`（untracked）

**人裁记录**
- `/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/issues/04-palette-coat-review.md`
- `/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/issues/15-a-qualification.md`
- `/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/issues/16-a-finalist-full-loop.md`
- `/Volumes/shy/some-projects/game-maker/.scratch/p0-00-audit/issues/08-visual-comparison-rulings.md`
- `/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/issues/12-alternative-animation-model.md`（验收标准与阈值）
