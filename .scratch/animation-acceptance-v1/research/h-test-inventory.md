# H · 测试体系与安全执行清单（票 08）

- 仓库：`/Volumes/shy/some-projects/game-maker`
- 分支 / 基线：`main` · `f0dac01`（2026-10-21）
- 任务书：`docs/v5/动画.md` §2.3、§3、§4.8、§5
- 票：`.scratch/animation-acceptance-v1/issues/08-h-test-inventory.md`
- 地图：`.scratch/animation-acceptance-v1/map.md`（只读）
- 环境：Node `v22.23.2` · pnpm `10.7.1` · 实际安装 vitest `3.2.7`（catalog 声明 `^3.1.2`）
- 边界：只读调查；实际执行 `pnpm test` 与 `pnpm typecheck`；未执行 `pnpm check` / `pnpm build` / 任何写 `out/` 的命令；零付费；未修改测试、测试配置、业务代码或 `map.md`。
- 证据分级沿用 `docs/v4/P0-00-task-brief.md` 附录 A：E0 推测 / E1 源码 / E2 测试 / E3 真实产物；本文另记运行证据（命令 + 退出码 + 路径）。

## 0. 结论速览

| 能力 | 状态 | 一句话证据 |
| --- | --- | --- |
| 本地无凭据执行全量测试 | `implemented` | `pnpm test` 退出 0；105 文件 / 1647 用例全过；无出站网络、无凭据 |
| 测试文件的类型检查 | `partial` | `pnpm typecheck` 退出 2；生产 `tsc -b` 通过，`@game-maker/assets` 的 2 个测试文件类型错误 |
| 资源 / 动画结构契约检查 | `implemented` | `packages/contracts/src/assetpack.ts` + `packages/contracts/tests/assetpack.test.ts`（40 例）覆盖帧引用、重名、锚点范围等 |
| 图集 PNG 与 manifest 的像素级交叉检查 | `missing` | `verifyPack` 只验 schema、文件存在、大小与 checksum（`packages/assets/src/ops.ts:1662`），不解码、不查帧矩形越界 |
| 真实动画包作为固定回归样本 | `partial` | v7 包已入库且含 `scavenger-actor` idle 4 帧，但没有任何测试读取它 |
| 基线冻结 / 基线与候选比较 | `missing` | 未找到基准记录或对比测试；`fixtures/packs` 只有 `last-train/v2`、`counter-siege/v4` 两份旧包 |
| 现有框架承载 Phase 1 确定性回归 | `implemented` | vitest 根级自动发现、node 环境、临时目录隔离、PNG 解码已导出；新增测试即可 |
| 运行时动画播放回归 | `missing` | vitest 内没有浏览器 / Phaser 启动测试；CDP 冒烟是独立脚本，不在测试套件 |
| 确定性测试与外部服务测试的结构隔离 | `partial` | 现状靠「全部注入假 fetch」的约定，无 vitest project / tag / 环境门控 |
| CI 配置 | `missing` | 无 `.github/`，全仓无 CI 工作流文件 |

## 1. 测试框架与命令面

- 框架：Vitest，根 `package.json:13` 的脚本是 `vitest run --passWithNoTests`。
- **没有** `vitest.config.*` / `vitest.workspace.*` / setup 文件（`find` 全仓无命中）；使用默认的 node 环境与默认 include，因此根命令会收集所有 `packages/*/tests/*.test.ts`。实测正好发现 105 个文件。
- 各包脚本只有 `typecheck`；测试统一在根跑，没有 per-package `test` 脚本。
- 类型检查：根 `package.json:14` 为 `tsc -b && pnpm -r --if-present typecheck`；各包执行 `tsc -p tsconfig.spec.json`，`packages/demo` 额外执行 `tsc -p tsconfig.shell.json`。
- `packages/mcp/tests/build-pack-stdio.test.ts` 在测试内用 esbuild 现 bundle 当前 `src`，这是有意为之：`pnpm test` 不 build，不能赌 `dist/` 是新的。
- 跳过的用例：仅 `describe.skipIf(!hasPack)` 两处（`packages/cli/tests/cli.test.ts:122`、`packages/mcp/tests/server.test.ts:93`）；本次因 fixture 包存在，**没有实际跳过**（输出无 skipped）。

## 2. 实测记录

### 2.1 `pnpm test`

```
$ pnpm test            # 工作目录：仓库根
EXIT=0
 Test Files  105 passed (105)
      Tests  1647 passed (1647)
   Start at  17:38:56
   Duration  15.89s (transform 17.43s, setup 0ms, collect 77.24s, tests 42.29s, environment 10ms, prepare 7.38s)
```

分布（从同一份输出逐文件汇总）：

| 包 | 文件数 | 用例数 |
| --- | ---: | ---: |
| `packages/assets` | 39 | 537 |
| `packages/contracts` | 29 | 590 |
| `packages/demo` | 10 | 140 |
| `packages/game-design` | 8 | 138 |
| `packages/vision` | 5 | 58 |
| `packages/pipeline` | 4 | 64 |
| `packages/qa` | 4 | 47 |
| `packages/cli` | 3 | 61 |
| `packages/mcp` | 3 | 12 |
| **合计** | **105** | **1647** |

失败摘要：无。红/绿分布：**0 红 / 1647 绿 / 0 跳过**。与 `ea53240` 的旧审计（`.scratch/p0-00-audit/research/w5-test-matrix.md`：105 文件 / 1640 用例）相比，HEAD 多 7 个用例，文件数不变。

### 2.2 `pnpm typecheck`

```
$ pnpm typecheck       # 工作目录：仓库根
EXIT=2
> tsc -b && pnpm -r --if-present typecheck
packages/assets typecheck: tests/pack-sheet-grid.test.ts(150,11): error TS2322: ...
packages/assets typecheck:   Property 'requestedSize' is missing in type '{ protocol: "openai"; ms: number; attempts: number; }' but required in type 'ImageGenCall'.
packages/assets typecheck: tests/prompt.test.ts(257,14): error TS2304: Cannot find name 'CharacterDNA'.
packages/assets typecheck: Failed
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @game-maker/assets@0.0.0 typecheck: `tsc -p tsconfig.spec.json`
 Exit status 2
 ELIFECYCLE  Command failed with exit code 2.
```

- 两条错误都在**测试文件**里，不在生产源码：
  - `packages/assets/tests/pack-sheet-grid.test.ts:150`：假 `ImageGenerator` 的 `call` 少 `requestedSize`（`packages/assets/src/image-gen.ts:34` 的 `ImageGenCall` 必填）。
  - `packages/assets/tests/prompt.test.ts:257`：使用 `CharacterDNA` 但文件头只 import 了 `AssetSpec` / `StyleSpec`。
- 根 `tsc -b`（生产项目图）先通过，随后逐包 spec 检查失败；因此这是「测试类型不过」，不是「生产构建不过」。
- 复现性与归因：`git diff --name-only` 只有 `CONTEXT.md`，两个失败文件都是 HEAD 版本；错误在 `ea53240` 的旧审计里已存在，HEAD 未修复。

补充运行（同一检查族的 no-bail 变体，便于看清其余包）：

```
$ pnpm -r --if-present --no-bail typecheck
EXIT=1
contracts / qa / game-design / vision / demo / pipeline / mcp / cli: Done
assets: Failed（同上两条 error TS；Exit status 2）
```

### 2.3 副作用核对

- **测试不写仓库内文件**：运行前后 `git status --porcelain` 均为 54 行且逐行相同；`git diff --name-only` 仍只有 `CONTEXT.md`。所有测试写操作的目的地都在 `os.tmpdir()` 的 `mkdtempSync` 目录（40 个测试文件使用该模式）。
- **typecheck 会写被忽略的构建信息**：运行后 `packages/{assets,cli,mcp,pipeline}/tsconfig.tsbuildinfo` 的 mtime 更新；`*.tsbuildinfo` 与 `dist/` 均在 `.gitignore` 中。`dist/` 内没有文件发生变化（`find packages -path '*/dist/*' -newer` 计数 0）。
- **未执行**：`pnpm check`、`pnpm build`、`pnpm check:deps`、`pnpm check:links`、`verify` / `inspect` CLI、`packages/demo/probe/smoke*.mjs`、CDP 驱动脚本。
- 运行期间 `.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/` 有新文件出现，来自并行的运行时取证代理，**不是** `pnpm test` 的产物；它位于未跟踪的 `.scratch` 目录，不影响 git 状态。

## 3. 安全执行清单

| 命令 | 测试范围 | 前置条件 | 写文件 | 联网 | 可能费用 | 实际结果 / 未执行原因 |
| --- | --- | --- | --- | --- | --- | --- |
| `pnpm test` | 全仓 105 文件 / 1647 用例 | `node_modules` 已安装；Node 22 | 只写 `os.tmpdir()`；仓库无改动 | 无出站；2 个文件绑 `127.0.0.1` 临时端口 | 无 | **已执行，EXIT 0，全绿** |
| `pnpm exec vitest run <path>` | 单个文件 / 目录 | 同上 | 同上 | 同上 | 无 | 未执行；与 `pnpm test` 同一 runner，可按路径收窄，推荐作为迭代命令 |
| `pnpm typecheck` | 9 个包的生产构建 + 测试 tsconfig | `node_modules`、TypeScript | 更新被忽略的 `*.tsbuildinfo`；不改 `dist/` | 无 | 无 | **已执行，EXIT 2**；2 个测试文件类型错误 |
| `pnpm -r --if-present --no-bail typecheck` | 同上，不因首败中止 | 同上 | 同上 | 无 | 无 | **已执行，EXIT 1**；其余 8 包 Done，assets Failed（补充证据） |
| `pnpm check:deps` | 包依赖方向守卫（`scripts/check-deps.mjs`） | 无 | 无（只读 `package.json`） | 无 | 无 | 未执行：不在本票允许的命令内；静态阅读为只读安全 |
| `pnpm check:links` | 文档相对链接守卫（`scripts/check-links.mjs`） | 无 | 无 | 无 | 无 | 未执行：同上 |
| `pnpm check` | deps + links + build | 会跑构建 | **写 `dist/`** | 无 | 无 | **禁止，未执行**（票面边界） |
| `pnpm build` | `tsc -b` + esbuild bundle | — | **写 `dist/`**（cli.mjs / server.mjs / shell.js） | 无 | 无 | **禁止，未执行** |
| `pnpm --filter @game-maker/demo smoke` | 真浏览器冒烟：静态 server + Chrome | 先 build；本机 Chrome / `CHROME_BIN`；`python3` | **写 `out/__probe`** | 仅 loopback | 无 | **禁止，未执行**（写 `out/`；且 build 前置） |
| `node packages/demo/probe/smoke-td.mjs` | 塔防冒烟 | 同上 | 写 `out/` | loopback | 无 | **禁止，未执行**（同上） |
| CDP 驱动（`.scratch/.../drive-cdp.mjs`、`drive-runtime.mjs`） | 真实站点 + Chrome | 已有 `site/v3` / 运行中的站点 | 写 `.scratch/runs/` | loopback | 无 | 未执行：运行时取证归票 06；不属于测试框架 |
| `pnpm exec vitest`（无 `run`） | 同上 | 同上 | 同上 | 同上 | 无 | 未执行：watch 模式会挂起，不适合取证 |
| `game-maker verify <pack>` / `inspect <pack>` | 单包校验 / 观察 | CLI 已构建或被测试直接调用 | 无 | 无 | 无 | 未执行：本票只允许 `test` / `typecheck`；函数级等价行为已由 `ledger` / `inspect` 测试覆盖 |

## 4. 凭据、网络与费用

### 4.1 需要凭据 / 外部模型的测试

**没有。** 全量测试在无任何 API key、无 `game-maker.local.json` 的情况下通过。

- 24 个测试文件、177 处出现 `fetchImpl` 注入；图像生成、drawlist 生成、视觉审查、意图 / 设计 / 配置编译全部用假 fetch。
- `packages/vision/tests/analyze-reference.test.ts` 文件头逐字写明「全部用假 `fetch`（`review.ts` 的既有用法）——不发真请求、不花钱」。
- `packages/assets/tests/review.test.ts` 用假上游，并断言「上游挂了也不抛」「网络异常也不抛」。
- `packages/cli/tests/cli-create.test.ts` 的 `stage()` 显式注入假文本上游与假图像上游（`GAME_MAKER_IMAGE_*` 指向 `http://up.test`），不读真实凭据。
- `packages/mcp/tests/build-pack-stdio.test.ts` 把子进程 `cwd` 指到临时目录，使仓根 `game-maker.local.json` 不可见；子进程环境注入的是本地桩地址。
- `packages/mcp/tests/create-game-no-digest.test.ts` 用 `vi.stubGlobal("fetch", ...)` 并在 `afterEach` 复原。

### 4.2 会访问网络（仅 loopback）的测试

| 文件 | 行为 | 证据 |
| --- | --- | --- |
| `packages/cli/tests/cli.test.ts` | 起 `node:http` 桩服务，`listen(0, "127.0.0.1")`；另有一例把文本上游指到 `127.0.0.1:9` 死端口，测试后恢复 `process.env` | 行 214–225、161–167 |
| `packages/mcp/tests/build-pack-stdio.test.ts` | 起本地 HTTP 桩，`listen(0, "127.0.0.1")`；用 esbuild 把当前 `src` bundle 到临时目录，再 `spawn(process.execPath, [BUNDLE])` | 行 44、58、79、88、99 |

两者都不出本机，不需要外网。`packages/assets/tests/image-config.test.ts` 调用 `git check-ignore`（本地子进程，只读），用于证明凭据文件被忽略。

### 4.3 可能产生费用

**当前全量测试为零。** 成立条件是：所有生产入口都收到注入的 `fetchImpl` / 假 generator。若新增测试直接调用 `resolveImageTransport({ env: process.env })` 或 CLI `pack` / `create` 而不注入 fetch，则存在真实调用风险；这是 Phase 1 新增测试必须守的边界。

一个隐患（当前不产生费用，但会破坏 hermeticity）：`packages/cli/tests/cli-create.test.ts` 的 `stage()` 传 `cwd: ROOT`。它同时显式给出完整图像环境变量，所以今天的 `resolveImageTransport` 走 env 分支；若未来漏掉某个环境变量，它会去读仓根真实的 `game-maker.local.json`。假 fetch 仍在，因此不会发出请求，但会读到真实凭据。

## 5. 文件写入边界

- 所有写操作的目的地均为 `fs.mkdtempSync(path.join(os.tmpdir(), ...))`：`site.test.ts` / `td-site.test.ts` 每个用例一个临时 out 根；`pack*.test.ts` 写临时包目录；`cli*.test.ts`、`mcp/*.test.ts` 写临时 cwd / outRoot / bundle。
- **没有测试写 `out/`、`.scratch/`、`fixtures/` 或 `dist/`**。`grep` 中出现的 `out/`、`.scratch/` 均是只读路径、注释或文档链接。
- 读取仓库内样本是允许且普遍的：`fixtures/` 下 `packs/`、`recipes/`、`import/`、`model-paint*/`、`reference/`、`e2e/`、`drawlist/`、`upstream/canned.json`；另有 14 个测试文件读取**已入库**的 `.scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json`（`git ls-files` 命中）。
- `packages/game-design/tests/build-design.test.ts` 读取**已入库**的真跑失败产物：`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13a/.failed-.../game-intent.json`（`git ls-files` 命中）。
- `packages/cli/tests/cli.test.ts` 会优先读取本机 `out/shift-change-assets/pack/vN`，但只在它是当前契约（`assetpack/v4`）时；本机最新为 `v9`，格式是 `assetpack/v1`，本次回落到 `fixtures/packs/counter-siege/v4`，所以本次结果不依赖本机 `out/`。这是未跟踪目录影响测试选择的唯一入口，属于可复现性隐患。

## 6. 动画 / 资源相关测试矩阵

「真实样本」= 读取仓库里已入库的 PNG / 包产物；「合成」= 在内存里画像素或注入假 generator。所有行均为 `implemented`（测试存在且本次通过），除非另有说明。

| 测试文件（用例数） | 覆盖的检查 | 正例 / 反例 / 边界 | 真实样本 |
| --- | --- | --- | --- |
| `packages/contracts/tests/assetpack.test.ts`（40） | manifest 契约：帧名重复、动画引用不存在的帧、动画名重复、多帧不归组、锚点越界 0..1、`size: null`、图集引用、层与帧一一对应、色板重复、path `..`、checksum 格式、未知顶层键（strict） | 正例「最小合法包通过」；反例逐条对应历史 9 条 + 新增若干；边界含单帧资源不需要动画分组 | 合成 manifest（inline 变异），不解码 PNG |
| `packages/contracts/tests/asset-spec.test.ts`（38） | drawlist spec 与产物：帧数、尺寸、`viewBox`、动画声明、动画名重复、零不透明像素、kind 不符、多做一个动画 | 正例「一致时不报」；反例逐项报错 | 读 `fixtures/drawlist/`；像素为 fixture 数据 |
| `packages/assets/tests/pack.test.ts`（43） | 生成态建包全链：manifest 结构、`files[]` 覆盖、帧数与顺序、多帧画布 N 倍宽、切帧内容、背景分层、键色抠图、单帧/多帧结构判据、失败不落盘、版本不覆盖 | 大量正例 + 反例（帧数不符、底不平涂、墨被抠碎、交付色不同不算错） | 合成像素 + `fixtures/recipes/shift-change.json`；一处 import 用 `fixtures/import/wan-player-1024.png` |
| `packages/assets/tests/pack-sheet-grid.test.ts`（5） | 九宫格出帧：按 cols×rows 申请画布、帧数与顺序、空格、单格双主体、格子黑框、1 帧 1×1 也走按格校验 | 正例 + 4 条反例；边界「1 帧也不能绕过」 | 合成 |
| `packages/assets/tests/sheet-grid.test.ts`（10） | 网格切片：不整除时居中让掉、图比网格小报错、阳性零 issue、单边贴边不算框、空格、双主体、四边墨 | 正例 / 反例 / 边界齐全 | 合成 |
| `packages/assets/tests/pack-ground-band.test.ts`（9） | 底部横带救援：切出 N 帧且横带颜色 0 像素、无横带行为不变、N-1 个角色仍失败、碎块过滤、0.65 宽度比不误杀、84.4% 横带可救 | 正例 + 4 类反例 + 阈值边界 | 合成；读 `fixtures/recipes/shift-change.json`、入库 stylespec |
| `packages/assets/tests/pack-frames.test.ts`（1） | `frames` 源：2 帧 = 2 次调用、分组正确、每帧原图独立落盘、`verifyPack` 通过 | 正例 | 合成 generator |
| `packages/assets/tests/pack-reuse-threshold.test.ts`（4） | 现场已有帧的复用：已有两帧 0 调用、缺一帧硬失败、默认阈值 0.6 / 显式 0.5 | 正例 + 反例 + 阈值边界 | 合成 |
| `packages/assets/tests/pack-selfcheck.test.ts`（4） | 包级自检：分层背景同名层、动画名重复（import 进路）、失败不提交、合法包逐字节不变 | 正例 + 反例 | 合成；一处 `fixtures/import/wan-player-1024.png` |
| `packages/assets/tests/import.test.ts`（38） | 导入管线：抠背景、容差、量化、alpha 二值化、裁框（逐帧 / 共用 / 并集）、网格切片越界、确定性逐字节相同、连通块统计 | 正例 + 反例 + 数值边界 | **真实** `fixtures/import/wan-player-1024.png` |
| `packages/assets/tests/import-fixture.test.ts`（1） | 手写 import fixture → 契约 → 建包 → `verifyPack` → `inspect` 观察 | 端到端正例 | **真实** `fixtures/e2e/wasteland-platformer/import-frame.png` + `import-recipe.json` |
| `packages/assets/tests/despill.test.ts`（16） | 品红去污：只删品红、阈值可配、暖色不动、单帧 / 多帧 / 非最远层 / 天空层不跑、可关可配 | 正例 + 反例 + 阈值边界 | **真实** `fixtures/model-paint-despill/` 6 张 + `model-paint-layers/` |
| `packages/assets/tests/speck.test.ts`（4） | 孤立碎点清理与主块保留、包围盒不再被碎点拉高 | 正例 + 反例 + 边界 | 合成 |
| `packages/assets/tests/groundline.test.ts`（6） | 贴脚地面线删除、虚线、厚底座不误删、抗锯齿残边、并集包围盒恢复 | 正例 + 反例 + 边界 | 合成 |
| `packages/assets/tests/raster.test.ts`（27） | drawlist 光栅化、混合、抖动、九宫格等 | 正例 + 反例 | **真实** `fixtures/drawlist/` |
| `packages/assets/tests/model-paint.test.ts`（8） | 真实模型图：声明色覆盖率 = 0、众数色覆盖率 ≥ 60%、众数与声明色 L1 ≥ 100、单帧真图出包、多帧真图切 2 帧 | 以反例式事实为主 + 2 条正例 | **真实** `fixtures/model-paint/` 5 张 |
| `packages/assets/tests/model-paint-layers.test.ts`（9） | 背景层同款统计、最远层整帧不透明、非最远层被抠出透明 | 事实 / 反例 + 结构正例 | **真实** `fixtures/model-paint-layers/` |
| `packages/assets/tests/inspect.test.ts`（9） | 色板用色观察：每资源用几色、每色几个资源、整包 vs 逐资源、色板外像素；**观察不是判据** | 正例 + 阴性构造 | **真实** `fixtures/packs/last-train/v2`、`counter-siege/v4` |
| `packages/assets/tests/ledger.test.ts`（10） | 账本落包、`files[]`、`verify` 认账、账与包不符报错、篡改 checksum 必非 0 | 正例 + 反例 | **真实** `fixtures/packs/last-train/v2`（篡改在临时副本） |
| `packages/assets/tests/text-op-ledger.test.ts`（12） | 文本调用账、与真包对账、探针 | 正例 + 反例 | **真实** 包与 recipes |
| `packages/assets/tests/compile-runtime.test.ts`（27） | 配置编译引用真包：资源存在、HUD 屏幕坐标、锚点语义不误报、重采样分类、版本不覆盖 | 正例 + 反例 + 业务边界 | **真实** `fixtures/packs/last-train/v2` + 假 fetch |
| `packages/assets/tests/compile-td-game.test.ts`（24）+ `compile-td-game-error-class.test.ts`（1） | 塔防关卡编译：地图尺寸、路径派生、世界大于视口、版本不覆盖、错误分类 | 正例 + 反例 | **真实** `fixtures/packs/counter-siege/v4` + 假 fetch |
| `packages/assets/tests/plan-assets*.test.ts`（16 + 9）、`planner-masters`（7）、`route-resolver`（17） | 规划与路线：玩家动画三路、每路 ≥ 2 帧、母版复用、九宫格硬信号、能力缺失不换路、确定性 20 次 | 正例 + 反例 + 确定性边界 | **真实** recipe / visual-world / reference PNG |
| `packages/assets/tests/review.test.ts`（11）、`packages/pipeline/tests/review.test.ts`（8）、`packages/vision/tests/analyze-reference.test.ts`（24） | 联系表真的拷帧、透明不覆盖底色、原图在前 / 联系表在后、失败也带账、不把视觉模型当确定性判定 | 正例 + 反例（上游 500、网络异常、读图失败） | **真实** `fixtures/e2e/wasteland-platformer/style.png`；模型调用为假 fetch |
| `packages/qa/tests/visual.test.ts`（14）、`gameplay`（12）、`assemble`（10） | 清单与包对账：尺寸、帧数、缺资源、viewBox；可达性；QA 硬失败阻断 | 正例 + 反例 | **真实** `last-train/v2` + 配置 |
| `packages/demo/tests/site.test.ts`（24）、`td-site`（23）、`world`（23）、`shell-*`（21） | 包 + 配置 → 站点装配；不覆盖版本；视差 / HUD 越界硬失败；外壳能力静态见证 | 正例 + 反例 | **真实** 包 + 配置 |
| `packages/pipeline/tests/create-game.test.ts`（41）、`cli-create`（33）、`mcp/*`（12） | 端到端：假上游 → 清单 → 包 → 配置 → 站点；版本与失败产物；两段式产物等价 | 正例 + 反例 | `fixtures/upstream/canned.json` 假上游；无真模型 |

### 6.1 动画专项覆盖到什么程度

已覆盖：动画**声明**（帧数、动画名、顺序、fps/loop 的 schema 合法性）、帧名引用闭合、切帧数量与顺序、九宫格切分、底部横带救援、帧间尺寸一致性、导入 / 抠底 / 量化、生成态失败不落盘。

未覆盖：交付态 PNG 与图集 JSON 的几何对账、帧矩形越界、声明尺寸与实际帧包围盒、锚点与脚底像素的关系、基线冻结与版本对比、动画在运行时的真实播放。

## 7. 覆盖缺口（按任务书 §5 分类）

### 7.1 缺失能力（`missing`）

1. **图集像素级验证器**：`verifyPack` 的检查清单是 schema + 文件存在 + 字节数 + sha256 + 未登记文件 + sidecar schema；它不解码 PNG、不读 `atlas.*.json` 的帧矩形、不查 `x + w <= image.width`。证据：`packages/assets/src/ops.ts:1662-1730`。
2. **固定动画验收基准**：v7 包在盘上（`manifest` 19 资源 / 76 帧 / 动画 61 帧，`scavenger-actor` idle 4 帧 @6fps、run 8 帧、jump 4 帧，锚点 `{0.5,1}`），且 158 个文件已入库；但没有任何测试引用该路径。`fixtures/packs` 两份旧包只有 2–4 帧的小动画，没有验收基准语义。
3. **基线与候选比较**：无基准记录、无比较函数、无比较测试、无阈值来源。
4. **运行时动画播放回归**：vitest 内无浏览器；`packages/demo/probe/smoke*.mjs` 是独立脚本且写 `out/`，不在测试套件；CDP 驱动在 `.scratch`，归运行时取证。
5. **验收报告测试**：没有针对「统一验收报告 schema / 人工审查记录」的测试；现有 `qa-report` 与 `ledger` 是另一套职责。
6. **CI**：无 `.github/` 或任何 CI 工作流。

### 7.2 已有能力但缺少覆盖（`partial`）

1. **契约层已覆盖动画结构的反例，但测试文件自身类型不成立**：`pnpm test` 转译后能跑，`pnpm typecheck` 红；「绿」不代表类型安全。
2. **`verify` 只证明「文件没被改」**：checksum 对得上不等于图集内容与 manifest 语义一致；缺「尺寸 / 帧数 / 帧矩形」的交叉断言。
3. **真实包样本偏旧且无动画验收语义**：`last-train/v2` / `counter-siege/v4` 是 drawlist 包；没有 image 源的真实动画包 fixture。
4. **`.scratch` 依赖**：14 个测试读已入库的 `.scratch/.../stylespec.json`；`game-design` 读已入库的真跑失败产物。可用，但样本位置与 `fixtures/` 的双轨是结构性隐患。
5. **本机 `out/` 选择逻辑**：`cli.test.ts` 会优先用本机当前契约包；本次因 `v9` 是 `assetpack/v1` 而回落。清检出与脏工作树可能跑不同输入。

### 7.3 设计不一致（`partial` / 待裁定）

- README 写「`pnpm test` 完全离线」，代码层面成立；但没有**结构性**网络守卫（vitest project / tag / 环境门控），新测试可以无声地发出请求。
- `pnpm check` 把「依赖守卫 + 链接守卫 + build」捆在一起，导致「只跑守卫」需要绕开脚本；本票因边界未执行。

## 8. 现有框架能否承载 Phase 1 回归测试

**能承载确定性部分，不能直接承载运行时部分。**

可复用（`implemented`）：

- 根级 vitest 自动发现：新增 `packages/*/tests/*.test.ts` 即被 `pnpm test` 收集，无需改配置。
- node 环境 + `fs` / `os` / `crypto`：可直接读 fixture、写 `os.tmpdir()`、算 sha256。
- `@game-maker/assets` 已导出 `decodePNG` / `encodePNG`（`src/index.ts:10` → `src/png.ts`）、`parseAssetPack`、`verifyPack`、`inspectPack`。
- 真实包 fixture + 假上游注入模式成熟；`packages/mcp/tests/build-pack-stdio.test.ts` 证明可在测试内现 bundle 并 spawn，适合外部进程边界。
- 临时目录隔离已成惯例（40 个文件），不会污染仓库。

不能直接承载（`missing`）：

- 浏览器 / Phaser 启动、键盘输入、动画播放观察：仓库没有 Playwright / Puppeteer / jsdom / canvas 依赖；`packages/qa/src/gameplay.ts` 文件头也明写不跑游戏。
- 图像相似度 / 人工视觉审查：没有图像 diff 依赖；现有 `review` 是付费视觉模型的接线，不适合作为确定性判据。
- 基线版本管理：没有快照测试（全局无 `toMatchSnapshot` / `toMatchFileSnapshot`），也没有基准清单格式。

## 9. 补测建议（只给建议，不写测试）

按 Phase 1 的最小闭环排序：

1. **冻结基准样本**：把 v7 包（或其最小子集：`scavenger-actor` 16 帧 + 图集 JSON + manifest + stylespec）复制到 `fixtures/animation-acceptance/v7/`，或在 `fixtures/` 写一份 `baseline.json` 记录 pack id / version / manifest sha256 / 每帧 checksum。当前 v7 虽已入库，但位于 `.scratch` 运行档案，语义上不是「验收基准」。
2. **图集几何测试**（确定性，最高优先）：解码 `atlas.*.png`，逐帧断言矩形在图内、`w/h > 0`、帧名与 atlas JSON 一致、`frames` 计数与 manifest 一致、资源声明尺寸与帧包围盒的关系（相等或显式容差）。
3. **帧像素不变量**：每帧至少 1 个不透明像素、帧包围盒、脚底行（`anchor.y = 1`）接地、透明边距、颜色全部落在包内色板；对 `scavenger-actor` idle 4 帧额外断言「同尺寸、同锚点行、顺序与 fps/loop 与 manifest 一致」。
4. **基线回归（golden metrics）**：为每帧记录 `opaquePixels / bbox / 色板计数 / 顶部透明行` 到 JSON；与冻结值比较并给出显式容差；失败信息必须定位到「资源.动画.帧」。
5. **候选比较**：同一组指标对「基准 vs 候选」输出机器可读 diff（帧数增删、尺寸变化、包围盒漂移、颜色漂移），不改动现有 `pack` 行为。
6. **反例 fixture**：截断 PNG、atlas 帧矩形越界、帧数少一、帧名不存在、动画名重复、全透明帧、锚点越界；每条断言错误可定位（当前 schema 已覆盖文本类反例，缺像素 / 几何类）。
7. **把 `verifyPack` 挂到基准上**：一条便宜测试即可防止基准文件被无声篡改（checksum 已实现）。
8. **测试分层**：默认 `pnpm test` 保持 100% 离线；新增 `test:external` / `test:runtime` 脚本或 vitest project，外部模型 / 浏览器测试必须显式 opt-in，并加网络守卫（例如全局 mock fetch 或 `--project` 隔离）。这是 Phase 1 唯一需要改根配置的测试改动。
9. **运行时回归**：若 Phase 1 要求自动化播放，选择 (a) 把现有 CDP 脚本保留为独立 probe（不改依赖），或 (b) 新增 Playwright 依赖与独立 project（需额外授权）。在裁定前标 `unverified`，不要写进默认套件。
10. **CI**：先修 2 个类型错误，再加一条跑 `pnpm test` + `pnpm typecheck` 的工作流；`check:deps` / `check:links` 可在 CI 单独跑（本票未执行）。

## 10. 未验证项

| 项 | 原因 | 状态 |
| --- | --- | --- |
| v7 包的逐文件 checksum 是否仍然全对 | 未执行 `verify`（本票只允许 `test` / `typecheck`） | `unverified` |
| 本机若存在当前契约的 `out/shift-change-assets/pack/vN`，`cli.test.ts` 会选择它并改变输入 | 当前本机最新为 `assetpack/v1`，本次走回落分支 | `unverified` |
| 测试在完全无网络的沙箱中是否仍通过 | 本次未禁网运行；代码证据显示只有 loopback | `unverified` |
| Phase 1 是否引入浏览器自动化 | 属地图 Not yet specified，等运行时票与综合票裁定 | `unverified` |
| `game-maker.local.json` 内容是否影响任何测试 | 未读取该文件（`git check-ignore` 除外，且不读内容）；代码证据表明测试均注入 env / fetch | `unverified`（不读是刻意的） |

## 11. 证据索引

- 运行输出：`/tmp/gm-test.log`、`/tmp/gm-typecheck.log`、`/tmp/gm-typecheck-nobail.log`（临时文件，不随仓库保存；关键行已抄录在 §2）
- 命令定义：`package.json:8,12,13,14`
- 测试配置缺失：全仓无 `vitest.config.*`（`find` 无命中）
- 类型错误：`packages/assets/tests/pack-sheet-grid.test.ts:150`、`packages/assets/tests/prompt.test.ts:257`；契约字段：`packages/assets/src/image-gen.ts:34`
- 包校验实现：`packages/assets/src/ops.ts:1662`
- 动画契约：`packages/contracts/src/assetpack.ts:145-250`；测试：`packages/contracts/tests/assetpack.test.ts:137-232`
- 真实包：`fixtures/packs/last-train/v2/manifest.json`、`fixtures/packs/counter-siege/v4/manifest.json`
- v7 基准包：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/manifest.json`（158 个文件已入库；`scavenger-actor` idle 4 / run 8 / jump 4）
- 旧审计线索（已在 HEAD 复验）：`.scratch/p0-00-audit/research/w5-test-matrix.md`
- 冒烟脚本（不在 vitest）：`packages/demo/probe/smoke.mjs`、`smoke-td.mjs`
- 写入边界证据：40 个测试文件使用 `mkdtempSync`；运行前后 `git status --porcelain` 逐行相同
