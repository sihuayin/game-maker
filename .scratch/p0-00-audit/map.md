# P0-00：能力差距审计与后续 P0 分流

Labels: wayfinder:map
Tracker: local-markdown
Effort: p0-00-audit

> **本图 2026-10-20 开。**输入任务书：[docs/v4/P0-00-task-brief.md](../../docs/v4/P0-00-task-brief.md)
> （原 `P0-00-capability-gap-audit.md`，按第一轮 Q5 改名）。
> 第一轮裁定逐字记录：[rulings-2026-10-20.md](rulings-2026-10-20.md)。
> ⚠️ 本图**只审计、不实施**；任何付费动作、实现修改、提交都需单独书面授权。
> ✅ **2026-10-21 收口**：01–08 全部 resolved；`docs/v4/` 五件套落地并通过交叉引用校验；
> P0 范围 13 条（6 个施工包 + 1 个付费最终门）；**停在等待提交 / 推送授权**。

## Destination

P0-00 审计完成：`docs/v4/` 五件套（能力差距证据表 / 调用链 / 测试矩阵 / E2E 证据 / P0 范围）
落地并通过交叉引用校验；每条差距都有 E0–E3 证据、明确分流（复用 / 修正 / 新增 / 补测 / 补文档 / 暂缓），
后续 P0 需求可直接交编码代理执行。**不含任何实现修改。**

## Notes

- **审计基线**：分支 `v2-foundation`，HEAD `ea53240`；开工时工作树非干净（`CONTEXT.md` 已改、`docs/v4/` 未入库、`.scratch/` 未跟踪）。每份证据须注明基线 commit。
- **任务书**：[P0-00-task-brief.md](../../docs/v4/P0-00-task-brief.md)（§4 证据表字段、§5 W1–W6、§6 分流规则、附录 A 证据强度）。
- **边界（第一轮逐字裁定，全文见 [rulings](rulings-2026-10-20.md)）**：
  - 全图零付费；任何付费动作单独立票 + 书面预算报告 + 逐次点头。
  - 不改实现和 Schema；不改 `packages/**`、CLI/MCP、Pack 目录结构。
  - 限制 `CONTEXT.md` 修改：只在裁定出新术语时改词条，不写实现细节。
  - 提交文档需单独授权；默认留工作树。五件套完成、交叉引用校验通过后，再考虑一次性提交；提交前仍需单独授权。
- **既有基线（Q3：只验证，不重开）**：v3 的 `planAssets` / `resolveRoute` / 三值路线 / plan sidecar 等裁定，
  见 [game-maker-v3/map.md](../game-maker-v3/map.md)；证据冲突才立新票重开。
- **证据源**（全部零付费可读）：
  - 归档真跑（2026-10-17，早于 HEAD）：`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-2026-10-17{a,b,c,d}.json`
    与 `run-out-2026-10-17{b,c,d}/`。其中 **d 是唯一走完 `pack → config → qa → 站点` 的单跑**
    （exit 0 · QA failures=[]），但 W6 打开后发现**不可玩**（pickup 不收 / 背景黑 / 敌人世界外）；
    运行后 `bf3e11f` / `a3ac8d8` 才修这些。
  - 最终包：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`。
  - 站点：`.scratch/asset-integration-v1/runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v3/`；
    驱动：同 run 的 `drive-cdp.mjs`；报告：`site-report.md`。
  - 既有地图：`game-maker-v2` / `game-maker-v3` / `game-maker-v3-visual-qa` / `style-migration-v1` / `asset-integration-v1`。
- **工作方式**：research 票由子代理并行跑，只写 `research/`；W6 由人机共同执行；综合票由人裁。
  证据分级用任务书附录 A（E0 推测 / E1 源码 / E2 测试 / E3 真实产物）。
- **不复述事实源**：地图只索引，细节在票与 `research/` 文件。

## Decisions so far

- [W3 资源生产路线审计](issues/03-w3-asset-routes.md)：**已收口（research）** —— A-01 不可复现：
  `deriveRecipe` 已不存在、无默认 `drawlist` 分支；无合法路线时 `resolveRoute` 硬失败 `no-route`。
  A-02 部分成立：只有 `characterId` / `masterAsset` / `animation` / `background` / `ui+ninePatch` /
  `existingAssets+mustReuse` 有确定性规则；敌人与 NPC 共用一规则，大型物件与高频道具无尺寸 / 频率规则，
  其余靠模型候选平局。路线枚举仍是三值，但执行层 `source.kind` 有第四值 `frames`；
  **F1（P1）：`frames` 被静默折叠成 `image`（`ops.ts:372` / `route.ts:154`），sidecar 也记成 `image`，无测试**。
  F6（P2）：`pack` 缺 import 文件时抛裸 `ENOENT`。`import` 仍不可从 CLI/MCP/create 到达（v3 Q4(b) 既定边界）。
  证据：`research/w3-asset-routes.md`。

- [W1 真实入口与主调用链](issues/01-w1-call-graph.md)：**已收口（research）** —— 主链两段式：
  `runUnderstanding`（五步理解，checkpoint 落 `run/v<N>`）→ `runBuild`（只吃 `runDir`，pack → config → QA）。
  checkpoint 只在 CLI `create`（无 `--yes`）；MCP `create_game` 总是一次跑完。站点装配在 pipeline 之外
  （CLI `create --yes` / `build` 走 `assembleFromConfig`；MCP 直接 `assembleSite`；TD 站点仅 CLI）。
  RuntimeProfile 两处派发（写侧 `compileDesign.pickProfile` 默认 platformer；读侧 `compileRuntime`
  platformer-only），`compile-td-game` 是旁路。**入口差异（未测）**：MCP 缺 `asCommandError`，
  vision/design 类错误退 1 而非 3/4；MCP `create_game` 的 `stylePath` 原样传导致绝对路径被拒；
  MCP 无 TD/review 工具；`compile_runtime` 漏 `hudLineHeight`。版本语义：首建 run/pack/site 对齐，
  重建取 `nextPackVersion`，site 显式版本碰撞拒绝。文档漂移：`RUN_ARTIFACT` 写「九项」实有 10 键
  （含 `recipePlan`）。证据：`research/w1-call-graph.md`。
- [W5 测试与 fixture 代表性](issues/05-w5-test-matrix.md)：**已收口（research）** ——
  `pnpm test`：105 文件 / 1640 条全绿（全离线）；`pnpm typecheck` **exit 2**（两个测试专用类型错误：
  `packages/assets/tests/pack-sheet-grid.test.ts:150` 缺 `requestedSize`；`prompt.test.ts:257` 找不到 `CharacterDNA`）。
  11 类裁定：existing 3 · needs strengthening 5 · missing 3。最明显空白：① 参考图未出现的新实体
  （`fixtures/e2e/wasteland-platformer` 在，但无断言）；② 游戏启动但机制不可执行（无浏览器 / boot / 输入测试，
  未装 Playwright/Puppeteer/jsdom）；③ CLI/MCP 一致性（无跨入口测试；MCP 直接 `assembleSite`、data 形状更小、
  不校验必填参数、漏 `hudLineHeight`）。另外：category 7 缺「pack 成功、site 装配失败」全链用例；
  category 3 的 `frames` 无 planner/resolver/sidecar 测试；category 6 QA 不解码交付像素，提交的 pack fixture 只有 drawlist。
  证据：`research/w5-test-matrix.md`。
- [W4 QA 真实判定能力](issues/04-w4-qa-capability.md)：**已收口（research）** —— 8 维矩阵。
  核心结论：① 自动 QA 只跑 6 个判定中的 5 个（`layer-coverage` 不属任何 family ⇒ `checked` 恒 5/6、
  `qaVerdict` 恒 `incomplete`；闸门只看 `failures[].severity === "error"`，不看 verdict）；
  ② **Visual QA 不读图像 / 参考风格**，只读 recipe/manifest/drawlist JSON；真正的视觉比较只在
  付费、人工、非阻断的 `review`（从未真跑）；③ `inspect` 读真实像素但只作观察（E3：真实包 +52.4% 宽高差、
  41 个离板色像素，仍 exit 0）；④ Intent/Design 只按 id 判覆盖；⑤ Asset QA 只查元数据，
  `verifyPack` 不在 `runBuild` 里；⑥ Gameplay QA 是静态 BFS，不启动游戏、不发输入；
  ⑦ 阻断对 `create --yes` / `build` 有效（先写报告 → exit 4、无站点），但 **`site` 与 MCP `assemble_site`
  不读 `qa-report.json`、不跑 reachability ⇒ 可绕过**；⑧ CLI/MCP 漂移（CLI 打印 inspect digest、MCP 不打印；
  MCP 无 build/review 工具；QA 失败路径未测）。证据：`research/w4-qa-capability.md`。
- [W2 规格字段是否被消费](issues/02-w2-field-consumption.md)：**已收口（research）** ——
  字段消费分三层：少量真实代码判定、大量只进提示词、少数只写不读。真正改变机器行为的只有
  `camera.mode`、路线 / DNA 查找、`styleReferences`、`style.palette`。**P0 缺口**：
  `GameConfig.objective.gate` 被校验但运行时从不读取；每个 `goal` 实体都调 `tryWin()`（只查拾取数），
  真实 config 有两个 goal ⇒ 碰到非 gate goal 可提前获胜。VWS 死字段：`styleIdentity.styleName`、
  `composition.characterScale`、整个 `lighting`、`camera.projection/angle/elevation/perspective`。
  Intent 的 `winConditions` / `loseConditions` / `progression` / `challenge` 从不进 `designPrompt`、
  无判定读取；Design 的同名字段与 `difficulty` 不进 `designBrief` / config / QA（真实设计写「接触 = 失败」，
  外壳只在 hazard 接触时重置）。动画 `fps` / `loop` 在 manifest → runtime 断链（外壳硬编码帧率与 `repeat:-1`）；
  `entities[].motion` 只对 `hazard` 生效。`AssetSpec.styleId` / `required` 无业务读者；Design → Recipe
  对敌人 / NPC / 互动物 / 资源无覆盖判定。21 条缺口（W2-G01…G21）登记在证据文件。
  证据：`research/w2-field-consumption.md`。
- [W6 真实产物验证（HEAD 零付费重放）](issues/06-w6-e2e-evidence.md)：**已收口（task/HITL，客观部分）** ——
  HEAD 下游重放可玩：`verify` 157 checksum → `site`（shell 2 / pack v7 / 19 资源）→ CDP 驱动 →
  3/3 pickup → 到达终点 → `won=true`（t=5990ms）。但**不是 HEAD 单跑 E2E**（上游归档、config 手写、
  `compile-runtime` 未参与）。归档完整链路单跑（第二十跑）站点装配成功、QA 全绿却**不可玩**
  （6 个 pickup 全收不到；背景黑；敌人 y=-125722）⇒ 「站点成功 ≠ 可玩」。新 P0：危险物在空中重置玩家
  ⇒ 掉穿地面、不可恢复（`hitHazard()` 只 `setPosition`，无物理体重置）。`site` 不生成 `qa-report.json`；
  `inspect` 的观察不阻断。**视觉 Q1/Q2 未裁定**，按用户裁定保留到
  [08 视觉对照裁定](issues/08-visual-comparison-rulings.md)；证据：`research/w6-e2e-evidence.md` 与
  `runs/2026-10-20a-head-replay/`。
- [08. 视觉对照裁定（W6 保留的 Q1 / Q2）](issues/08-visual-comparison-rulings.md)：**已收口（grilling/HITL）** ——
  **Q1 = (a)** 整体风格可接受（色彩 / 工业废土题材 / 硬边像素轮廓 / 材质基本统一；观察项：暗部偏重、局部细节密集）；
  **Q2 = (b)** 世界观兼容但有局部缺口：`ceiling-lurker` 剪影可读性、`extraction-point` 像素尺度与材质分块；
  `wasteland-enemy` **不定性为风格漂移**。裁定不改变 W6 证据边界（仍不得宣称 HEAD 单跑 E2E）；
  局部缺口交 [07](issues/07-synthesis-gap-table-p0-scope.md) 按影响 / 成本排序，**不默认全量重生成**；
  危险物掉穿地面仍是独立高优先级候选。对照材料：`runs/2026-10-20a-head-replay/visual-compare/`。
- [07. 综合：能力差距表与 P0 范围](issues/07-synthesis-gap-table-p0-scope.md)：**已收口（grilling/HITL）** ——
  Q1–Q10 全部 (a)：P0 只收「阻断目标」与「假成功」；P0 = 13 条（gate 假胜利 / 危险物软锁 / 发布闸门统一 /
  可玩 smoke / 资产完整性 / 像素阈值 / frames 静默折叠 + MCP 入口语义），拆成 6 个施工包 + 1 个付费最终门；
  P1 = 21 条、P2 = 21 条。五件套落 `docs/v4/`：能力差距表 / 调用链 / 测试矩阵 / E2E 证据 / P0 范围。
  交叉引用校验：CAP ID 55 唯一、无未定义引用、docs/v4 零断链；`pnpm test` 110 文件 / 1731 例、
  typecheck / build / check:deps 全绿；`check:links` 仅 2 条既有 `.scratch` 断链。基线 `ea53240`，
  已标注到 `7aa98d7` 的增量（`accept` 工具 + typecheck 修复）。**未提交 / 未推送；等待单独授权**。
## Not yet specified

（无。P0-00 审计已收口；后续 P0 施工与付费 E2E 是**新的 effort**，需另开图 / 票，不在本图继续。）

## Out of scope

- **实施任何修复 / 新功能**：本图只交审计五件套与 P0 分流。
- **P0 施工本身**：P0-01…P0-06 与 P0-FINAL 是收口后的新 effort；本图不承载施工，也不把 P0 范围裁定
  当作施工授权。
- **新增 `source.kind`（尤其 `derived`）**、重写 `raster.ts` / Pack / 图像客户端。
- **跨游戏视觉记忆 / 跨项目迁移 / 跨游戏资源复用**。
- **自动重试 / 自动修复 / 自动重生成循环**。
- **在本图内执行付费 E2E**（Q8 裁为 P0 最终验收门，另立付费票）。
- **修改 `game-maker.local.json`**（用户文件，一个字不动）。
- **玩法扩展 / 新关卡 / 新游戏题材**：审计样例只用于验证能力，不构成产品范围。
