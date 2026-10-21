# Animation & Asset Acceptance V1 — Phase 0 测试清单

| 属性 | 内容 |
|---|---|
| 项目 | `sihuayin/game-maker` |
| 阶段 | Phase 0（只读调查） |
| 基线 | `main` · `f0dac01` |
| 日期 | 2026-10-21 |
| 任务书 | [动画.md](动画.md) |
| 现状报告 | [phase-0-current-state.md](phase-0-current-state.md) |
| 缺口分析 | [phase-0-gap-analysis.md](phase-0-gap-analysis.md) |
| 实施计划 | [phase-0-implementation-plan.md](phase-0-implementation-plan.md) |

## 0. 结论速览

- `pnpm test` **exit 0**：105 文件 / 1647 用例全绿，0 跳过，15.89s；全离线、零凭据、零费用；
  测试只写 `os.tmpdir()`，运行前后 `git status --porcelain` 逐行相同。
- `pnpm typecheck` **exit 2**：根 `tsc -b` 通过；两处**测试文件**类型错误
  （`pack-sheet-grid.test.ts:150`、`prompt.test.ts:257`）；其余 8 包 Done。
- 现有框架**能承载 Phase 1 的确定性回归**（vitest 根级自动发现、node 环境、临时目录隔离、
  `decodePNG` / `encodePNG` 已导出），**不能直接承载运行时/浏览器回归**（无 Playwright/Puppeteer）。
- 动画验收的关键空白：交付态 PNG ↔ 图集 JSON ↔ manifest 的几何/像素对账、基准冻结、
  基线/候选比较、运行时播放、验收报告 schema、CI。
- 本图未执行 `pnpm check` / `pnpm build` / 任何写 `out/` 的生成命令；零付费。

## 1. 测试框架与命令面

| 项 | 事实 |
|---|---|
| 框架 | vitest 3.2.7 |
| 根脚本 | `"test": "vitest run --passWithNoTests"` |
| 配置 | 无 `vitest.config.*`；根级自动发现全部 105 个测试文件 |
| 环境 | node；无 jsdom / canvas / 浏览器 |
| 类型检查 | `"typecheck": "tsc -b && pnpm -r --if-present typecheck"` |
| 依赖守卫 | `node scripts/check-deps.mjs`（exit 0，9 包） |
| 链接守卫 | `node scripts/check-links.mjs` |
| CI | **无** `.github/` 或任何工作流 |
| 测试位置 | `packages/*/tests/*.test.ts`；样本在 `fixtures/` 与已入库的 `.scratch/` |

## 2. 实测记录

### 2.1 `pnpm test`

- 命令：`pnpm test`
- 结果：**exit 0**
- 统计：**105 文件 / 1647 用例**全绿；0 红 / 0 跳过；15.89s。
- 副作用：测试只写 `os.tmpdir()`；运行前后 `git status --porcelain` 逐行相同。
- 网络：无出站请求；仅 2 个测试文件绑定 `127.0.0.1` 临时端口
  （`packages/cli/tests/cli.test.ts`、`packages/mcp/tests/build-pack-stdio.test.ts`；
  后者在测试内 esbuild + spawn 子进程）。
- 凭据 / 费用：0。

### 2.2 `pnpm typecheck`

- 命令：`pnpm typecheck`
- 结果：**exit 2**
- 根 `tsc -b`：通过。
- 失败：
  - `packages/assets/tests/pack-sheet-grid.test.ts:150` — TS2322：假 generator 的 `call`
    返回值缺 `requestedSize`。
  - `packages/assets/tests/prompt.test.ts:257` — TS2304：找不到 `CharacterDNA`（未导入）。
- no-bail 复跑确认其余 8 包 Done。
- 含义：`pnpm test` 转译后能跑，但**测试文件类型不成立**；“测试全绿”不等于“类型安全”。

### 2.3 定向测试（各票取证时执行）

| 范围 | 文件 / 用例 | 结果 |
|---|---|---|
| 契约 | `packages/contracts/tests/assetpack.test.ts` 40 例 | exit 0 |
| assets | `pack` 43、`import` 38、`inspect` 9、`ledger` 10、`review` 11 等 | exit 0 |
| demo | `site` 24、`world` 23、`shell-*` 21 | exit 0 |
| qa | `assemble` 10、`visual` 14、`gameplay` 12 | exit 0 |
| pipeline / cli / mcp | `create-game` 41、`cli` 20、`server` 8 等 | exit 0 |
| 架构票定向 | 8 个文件 / 138 用例 | exit 0 |
| 数据结构票定向 | 7 个文件 / 129 用例 | exit 0 |
| 确定性检查票定向 | 5 组：40 / 26 / 14 / 20 / 41 用例 | exit 0 |
| 视觉审查票定向 | `review.test.ts` + `qa/visual.test.ts` 25 例 | exit 0 |
| 报告追溯票定向 | 11 个文件 / 209 用例 | exit 0 |

> 定向结果的用例数与全量 1647 有重叠；本表只证明“这些文件在本轮实际跑过且为绿”，
> 不用于重新计算总数。

### 2.4 只读包检查

| 命令 | 结果 |
|---|---|
| `game-maker verify <v7 pack>` | exit 0；157 文件 checksum 全对；19 资源 / 76 帧 / 61 动画 |
| `game-maker inspect <v7 pack>` | exit 0；19 资源；4 图集；`scavenger-actor` 16 帧（idle 4 / run 8 / jump 4） |
| `game-maker verify fixtures/packs/last-train/v2` | exit 0；31 文件 checksum 对；9 资源 |
| `game-maker verify fixtures/packs/counter-siege/v4` | exit 0 |

### 2.5 运行时探针

- 站点：现有 `site/v3`（`site.json` → `pack: v7`）。
- 启动：`python3 -m http.server 8791`，根为 `pack/` + `site/` 的父目录；`site/v3/index.html` 200。
- 浏览器：Chrome 155 headless + CDP；站点与包资源全 200；唯一 404 是 favicon。
- 播放：`scavenger-actor.idle` 4 帧 ~168ms 循环（124 个 20ms 采样）；局部连拍去重 4 帧；
  `drawImage` 轨迹 4501 次，帧名全映射，换帧 ~167ms。
- 触发：CDP 合成 `ArrowRight` / `Space` 触发 run / jump。
- 断链：`ceiling-lurker.lunge`（manifest 14fps / loop:false）实测 8fps 无限循环；
  `jump`（10fps / loop:false）实测 6fps 循环。
- 非破坏性：站点与包 mtime 仍 2026-10-20 14:53:15；server / Chrome 已关闭（8791/9333 无监听）。
- 证据：[`../../.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/`](../../.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/)。

## 3. 安全执行清单

| 命令 | 测试范围 | 前置条件 | 写文件 | 联网 | 费用 | 实际结果 / 未执行原因 |
|---|---|---|---|---|---|---|
| `pnpm test` | 全量 105 文件 / 1647 用例 | Node ≥22、pnpm 10、已安装依赖 | 仅 `os.tmpdir()` | 否（loopback 除外） | 0 | **exit 0** |
| `pnpm typecheck` | 全包类型检查 | 同上 | gitignored `dist/` / `*.tsbuildinfo` | 否 | 0 | **exit 2**（两处测试类型错误） |
| 定向 `pnpm vitest run <files>` | 指定文件 | 同上 | 仅临时目录 | 否 | 0 | 已用于 A–G 取证，exit 0 |
| `game-maker verify <pack>` | 包 schema + checksum | 现有 `dist/` 可运行 | 否 | 否 | 0 | v7 / last-train / counter-siege exit 0 |
| `game-maker inspect <pack>` | 解码 + 观察 | 同上 | 否 | 否 | 0 | v7 / last-train exit 0 |
| `python3 -m http.server` + Chrome/CDP | 现有 `site/v3` 播放 | Chrome、现有站点 | 只写指定 run 目录 | 仅 loopback | 0 | 已执行；证据已落盘 |
| `pnpm check` | 依赖 + 链接 + build | — | `dist/` 与 bundle | 否 | 0 | **未执行**（Q2 禁止） |
| `pnpm build` | tsc + bundle | — | `dist/` | 否 | 0 | **未执行**（Q2 禁止） |
| `game-maker pack` / `site` / `build` / `create` | 生成 / 装配 | 配置与上游 | `out/` | 生图时会 | 可能 | **未执行**（本图禁止写 `out/`） |
| 真实生图 / 视觉模型 | 上游 | key / 预算 | raw / 产物 | 是 | **是** | **未执行**（零付费） |

## 4. 凭据、网络与费用

- **需要凭据 / 外部模型的测试**：本轮全量测试 0 个；24 个测试文件使用 `fetchImpl` 注入假上游
  （177 处），不读真实 key。
- **会访问网络（仅 loopback）的测试**：`packages/cli/tests/cli.test.ts`、
  `packages/mcp/tests/build-pack-stdio.test.ts`（临时端口；后者 spawn 子进程）。
- **可能产生费用的测试**：无；`review` 相关测试全部用假 fetch。
- **`game-maker review` live**：未执行（无 `"step":"review"` 的 ledger）；属付费动作，
  须另立票 + 预算 + 逐字点头。

## 5. 文件写入边界

- 40 个测试文件使用 `mkdtemp` / `os.tmpdir()` 隔离；运行前后 `git status --porcelain` 相同。
- `packages/mcp/tests/build-pack-stdio.test.ts` 在测试内 esbuild + spawn，但产物落临时目录。
- 本图运行的 CDP 探针只写
  `.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/`；未写 `out/`、未改站点/包。
- `pnpm typecheck` 写 gitignored `dist/` / `*.tsbuildinfo`；这是本图唯一允许的构建输出写入。

## 6. 动画 / 资源相关测试矩阵

「真实样本」= 读取已入库的 PNG / 包产物；「合成」= 内存画像素或注入假 generator。
所有行均为 `implemented`（测试存在且本轮通过），除非另有说明。

| 测试文件（用例数） | 覆盖的检查 | 正例 / 反例 / 边界 | 真实样本 |
|---|---|---|---|
| `contracts/tests/assetpack.test.ts`（40） | manifest 契约：帧名重复、动画引用不存在的帧、动画名重复、多帧不归组、锚点越界、`size: null`、图集引用、层帧一一对应、色板重复、path `..`、checksum 格式、未知顶层键 | 最小合法包正例；逐条反例；单帧资源不需动画分组 | 合成 manifest（inline 变异），不解码 PNG |
| `contracts/tests/asset-spec.test.ts`（38） | drawlist spec ↔ 产物：帧数、尺寸、viewBox、动画声明、零不透明像素、kind 不符、多做一个动画 | 一致正例；逐项反例 | `fixtures/drawlist/` |
| `assets/tests/pack.test.ts`（43） | 生成态建包全链：manifest 结构、`files[]` 覆盖、帧数与顺序、多帧画布、切帧内容、背景分层、键色抠图、失败不落盘、版本不覆盖 | 大量正例 + 反例（帧数不符、底不平涂、墨被抠碎） | 合成像素 + `fixtures/recipes/shift-change.json` |
| `assets/tests/pack-sheet-grid.test.ts`（5） | 九宫格出帧：画布申请、帧数与顺序、空格、单格双主体、黑框、1 帧 1×1 | 正例 + 4 反例；1 帧也不能绕过 | 合成 |
| `assets/tests/sheet-grid.test.ts`（10） | 网格切片：不整除居中、图比网格小、单边贴边、空格、双主体、四边墨 | 正例 / 反例 / 边界齐全 | 合成 |
| `assets/tests/pack-ground-band.test.ts`（9） | 底部横带救援：切出 N 帧且横带 0 像素、无横带不变、碎块过滤、阈值边界 | 正例 + 4 类反例 | 合成 + `fixtures/recipes/shift-change.json` |
| `assets/tests/pack-frames.test.ts`（1） | `frames` 源：2 帧 = 2 次调用、分组正确、独立落盘、`verifyPack` 通过 | 正例 | 合成 generator |
| `assets/tests/pack-reuse-threshold.test.ts`（4） | 复用已有帧：0 调用、缺一帧硬失败、阈值 0.6/0.5 | 正例 + 反例 + 边界 | 合成 |
| `assets/tests/pack-selfcheck.test.ts`（4） | 包级自检：分层背景同名层、动画名重复、失败不提交、合法包逐字节不变 | 正例 + 反例 | 合成 + `fixtures/import/wan-player-1024.png` |
| `assets/tests/import.test.ts`（38） | 导入：抠背景、容差、量化、alpha 二值化、裁框、网格越界、确定性逐字节相同、连通块 | 正例 + 反例 + 数值边界 | **真实** `fixtures/import/wan-player-1024.png` |
| `assets/tests/import-fixture.test.ts`（1） | 手写 import fixture → 契约 → 建包 → `verifyPack` → `inspect` | 端到端正例 | **真实** `fixtures/e2e/wasteland-platformer/` |
| `assets/tests/despill.test.ts`（16） | 品红去污：只删品红、阈值、暖色不动、单帧/多帧/非最远层/天空层、可关可配 | 正例 + 反例 + 边界 | **真实** `fixtures/model-paint-despill/` |
| `assets/tests/speck.test.ts`（4） | 孤立碎点清理与主块保留、包围盒 | 正例 + 反例 + 边界 | 合成 |
| `assets/tests/groundline.test.ts`（6） | 贴脚地面线删除、虚线、厚底座、抗锯齿残边、并集包围盒 | 正例 + 反例 + 边界 | 合成 |
| `assets/tests/raster.test.ts`（27） | drawlist 光栅化、混合、抖动、九宫格 | 正例 + 反例 | **真实** `fixtures/drawlist/` |
| `assets/tests/model-paint.test.ts`（8） | 真实模型图：声明色覆盖率、众数色覆盖率、L1、单帧/多帧出包 | 反例式事实 + 正例 | **真实** `fixtures/model-paint/` |
| `assets/tests/model-paint-layers.test.ts`（9） | 背景层统计、最远层不透明、非最远层被抠出透明 | 事实/反例 + 结构正例 | **真实** `fixtures/model-paint-layers/` |
| `assets/tests/inspect.test.ts`（9） | 色板用色观察：每资源用几色、整包 vs 逐资源、色板外像素；观察不是判据 | 正例 + 阴性构造 | **真实** `last-train/v2`、`counter-siege/v4` |
| `assets/tests/ledger.test.ts`（10） | 账本落包、`files[]`、`verify` 认账、账与包不符、篡改 checksum | 正例 + 反例 | **真实** `last-train/v2`（篡改临时副本） |
| `assets/tests/text-op-ledger.test.ts`（12） | 文本调用账、与真包对账 | 正例 + 反例 | **真实** 包与 recipes |
| `assets/tests/compile-runtime.test.ts`（27） | 配置编译引用真包：资源存在、HUD 屏幕坐标、锚点语义、重采样、版本不覆盖 | 正例 + 反例 + 业务边界 | **真实** `last-train/v2` + 假 fetch |
| `assets/tests/compile-td-game.test.ts`（24）+ error-class（1） | 塔防关卡：地图尺寸、路径派生、世界大于视口、版本不覆盖、错误分类 | 正例 + 反例 | **真实** `counter-siege/v4` + 假 fetch |
| `assets/tests/plan-assets*.test.ts`（16+9）、`planner-masters`（7）、`route-resolver`（17） | 规划与路线：玩家动画三路、每路 ≥2 帧、母版复用、九宫格硬信号、能力缺失不换路、确定性 20 次 | 正例 + 反例 + 边界 | **真实** recipe / visual-world / reference PNG |
| `assets/tests/review.test.ts`（11）、`pipeline/tests/review.test.ts`（8）、`vision/tests/analyze-reference.test.ts`（24） | 联系表拷帧、透明不覆盖底色、原图在前、失败带账、视觉模型不判分 | 正例 + 反例（上游 500/网络异常/读图失败） | **真实** `fixtures/e2e/wasteland-platformer/style.png`；假 fetch |
| `qa/tests/visual.test.ts`（14）、`gameplay`（12）、`assemble`（10） | 清单与包对账、可达性、QA 硬失败阻断 | 正例 + 反例 | **真实** `last-train/v2` + config |
| `demo/tests/site.test.ts`（24）、`td-site`（23）、`world`（23）、`shell-*`（21） | 包 + 配置 → 站点；版本不覆盖；视差/HUD 越界硬失败；外壳静态见证 | 正例 + 反例 | **真实** 包 + 配置 |
| `pipeline/tests/create-game.test.ts`（41）、`cli-create`（33）、`mcp/*`（12） | 端到端：假上游 → 清单 → 包 → 配置 → 站点；版本与失败产物；两段式等价 | 正例 + 反例 | `fixtures/upstream/canned.json` 假上游；无真模型 |

### 6.1 动画专项覆盖程度

**已覆盖**：动画声明（帧数、动画名、顺序、fps/loop 的 schema 合法性）、帧名引用闭合、
切帧数量与顺序、九宫格切分、底部横带救援、帧间尺寸一致性、导入/抠底/量化、生成态失败不落盘。

**未覆盖**：交付态 PNG 与图集 JSON 的几何对账、帧矩形越界、声明尺寸与实际帧包围盒、
锚点与脚底像素的关系、基线冻结与版本对比、动画在运行时的真实播放、验收报告 schema、CI。

## 7. 覆盖缺口（按任务书 §5 分类）

### 7.1 缺失能力（`missing`）

- **图集像素级验证器**：`verifyPack` 不解码 PNG、不读图集 JSON、不查帧矩形越界
  （G-01 / G-43 / G-47）。
- **固定动画验收基准**：v7 在盘上且已入库，但零测试引用；无 `baseline.json`
  （G-03 / G-19）。
- **基线与候选比较**：无基准记录、无比较函数、无比较测试、无阈值来源（G-04）。
- **运行时动画播放回归**：vitest 内无浏览器；CDP 是独立脚本，不在测试套件（G-07 / G-08 / G-10）。
- **验收报告测试**：没有 `animation-acceptance/v1` 的 schema/写入测试（G-02）。
- **CI**：无 `.github/` 或任何工作流（G-12）。

### 7.2 已有能力但缺少覆盖（`partial`）

- **测试文件自身类型不成立**：`pnpm typecheck` exit 2（G-31）。
- **`verify` 只证明“文件没被改”**：checksum 对得上不等于图集内容与 manifest 语义一致（G-13）。
- **真实包样本偏旧**：`last-train/v2` / `counter-siege/v4` 是 drawlist 包；没有 image 源动画包
  作为固定回归样本（G-19）。
- **`.scratch` 依赖**：14 个测试读已入库的 `.scratch/.../stylespec.json`；样本位置双轨（G-20）。
- **无结构性网络守卫**：新增测试可以无声发出请求（G-22）。

### 7.3 设计不一致（`partial` / 待裁定）

- README 写“`pnpm test` 完全离线”，代码层面成立；但没有 vitest project / tag / 环境门控。
- `pnpm check` 把依赖守卫、链接守卫、build 捆在一起，无法只跑守卫（G-21 / G-50）。
- QA 标签与 `auditAssetSpec` 实现对不上（G-42），测试没有覆盖这个差异。

## 8. 现有框架能否承载 Phase 1 回归测试

**能承载确定性部分，不能直接承载运行时部分。**

可复用：

- 根级 vitest 自动发现：新增 `packages/*/tests/*.test.ts` 即被 `pnpm test` 收集，无需改配置。
- node 环境 + `fs` / `os` / `crypto`：可读 fixture、写 `os.tmpdir()`、算 sha256。
- `@game-maker/assets` 已导出 `decodePNG` / `encodePNG`、`parseAssetPack`、`verifyPack`、`inspectPack`。
- 真实包 fixture + 假上游注入模式成熟；`build-pack-stdio.test.ts` 证明可在测试内现 bundle 并 spawn。
- 临时目录隔离已成惯例（40 个文件），不会污染仓库。

不能直接承载：

- 浏览器 / Phaser 启动、键盘输入、动画播放观察：无 Playwright / Puppeteer / jsdom / canvas。
- 图像相似度 / 人工视觉审查：没有图像 diff 依赖；现有 `review` 是付费视觉模型接线。
- 基线版本管理：没有快照测试（全局无 `toMatchSnapshot` / `toMatchFileSnapshot`），也没有基准清单格式。

## 9. 需要补充的测试（Phase 1）

按 [实施计划](phase-0-implementation-plan.md) 的 Tier 1 / Tier 2 排序：

### 9.1 Tier 1

1. `contracts/tests/atlas-json.test.ts` — v7 四张图集正例；缺字段/负宽高/类型错负例。
2. `contracts/tests/animation-acceptance.test.ts` — 最小报告正例；缺身份/人裁项不全/finding 无定位负例。
3. `assets/tests/animation-metrics.test.ts` — 用 `qualify.mjs` / `finalist.mjs` 现有读数做 golden fixture。
4. `assets/tests/animation-baseline.test.ts` — raw/交付 hash、manifest/atlas checksum、期望指标容差。
5. `assets/tests/acceptance.test.ts` — v7 正例；非 PNG、越界、缺帧、幽灵帧、`frames` 说谎、
   锚点/尺寸不一致、跨资源同名帧负例。
6. `cli/tests/cli.test.ts` — `accept` 人类/JSON 输出；exit 0/1/2/4；版本目录不覆盖。
7. `mcp/tests/server.test.ts` — `accept_asset_pack` 正例/负例/structuredContent。

### 9.2 Tier 2

8. `assets/tests/compare.test.ts` — 基线 vs 候选；阈值边界；负例改一帧/改背景色。
9. `assets/tests/preview.test.ts` — 联系表格数 = 动画帧数；标签回指 manifest；loop preview 含 fps/loop。
10. `contracts/tests/build-record.test.ts` — join key / checksum / stages / error。
11. `pipeline/tests/create-game.test.ts` — 成功/失败边界的 build record；不复制 findings。

### 9.3 显式 opt-in

- CDP 运行时探针：独立脚本 / `test:runtime`，不进入默认 `pnpm test`；不引入 Playwright（Q7 A）。
- 未来真实上游 / 视觉模型测试：一律另立票 + 预算 + 逐字点头。

## 10. 未运行 / 未验证

| 事项 | 原因 | 最小验证方式 |
|---|---|---|
| `pnpm check` | Q2 禁止（会 build） | Phase 1 施工时或 CI 单独跑守卫 |
| `pnpm build` | Q2 禁止（写 `dist/`） | Phase 1 施工时验证干净构建 |
| 完全禁网沙箱下的 `pnpm test` | 未执行 | 断网跑一次，确认无出站 |
| HEAD 真实端到端（创建 → 包 → 站点） | 本图只读；可能付费 | 另立票 + 预算 |
| `game-maker review` live | 付费；人工主动 | 另立票 + 预算 + 逐字点头 |
| MCP 设计/vision 错误动态退出码 | 静态 E1，无测试 | 注入 fake 上游跑 MCP `create_game` |
| QA 硬失败 run ledger 缺口 | 无 E3 归档失败 run | 构造失败 run |
| 图集越界在 `inspect` 的失败形态 | 仓库无负例 | 合成包 + `inspect` |
| `coverage.json` 版本对账 | 无测试 | 版本不符负例 |
| 干净 `dist` / 清检出 | 工作树非干净 | CI / 清检出复跑 |
| v7 包当前 checksum | 票 04 已跑 `verify` exit 0；票 08 自身未跑 | 已由票 04 覆盖 |

## 11. 证据索引

- 测试取证：[`../../.scratch/animation-acceptance-v1/research/h-test-inventory.md`](../../.scratch/animation-acceptance-v1/research/h-test-inventory.md)
- 确定性检查：[`../../.scratch/animation-acceptance-v1/research/c-deterministic-checks.md`](../../.scratch/animation-acceptance-v1/research/c-deterministic-checks.md)
- 运行时证据：[`../../.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/`](../../.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/)
- 票 08（测试清单）：[`../../.scratch/animation-acceptance-v1/issues/08-h-test-inventory.md`](../../.scratch/animation-acceptance-v1/issues/08-h-test-inventory.md)
- 现状报告：[phase-0-current-state.md](phase-0-current-state.md)
- 缺口分析：[phase-0-gap-analysis.md](phase-0-gap-analysis.md)
- 实施计划：[phase-0-implementation-plan.md](phase-0-implementation-plan.md)
