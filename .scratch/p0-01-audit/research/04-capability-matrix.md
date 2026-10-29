# P0-01C · 能力矩阵（只读审计）

| 属性 | 值 |
|---|---|
| 生产代码审计基线 | **`2c1a9d55c1ac94bc5271318514897b9485587bec`**（`2c1a9d5`，分支 `main`） |
| 审计时 HEAD | `a495da0f7f5248e4c9cae77344d18f50c70b80d1`（`a495da0`）；`git diff 2c1a9d5..a495da0 -- packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml` 为空 |
| 工作区 | 只有本 effort 的票面/研究报告与未跟踪 PRD `docs/v7.6/管线.md`；本票只新增本文件并改票 04，未改生产代码、契约、测试、fixtures、历史证据 |
| 审计时间 | 2026-10-29 |
| 本票执行的命令 | 只读 shell（`git` / `rg` / `find` / `sed` / `node -e` 读 JSON）；`pnpm test` 两次（均因超时非 0，见 §5）；超时用例隔离重跑两次（60/60、94/94 pass）；`pnpm typecheck`（exit 0）；`pnpm build`（exit 0）；`node scripts/evidence-acceptance.mjs --out /tmp/p0-01c-evidence-out`（exit 0，pass） |
| 未执行 | `create` / `build` / `plan` / `pack` / `compile-*` / `playtest` / 整条 `test:playtest` / `review` / `review-verdict` / `playtest-baseline` / 浏览器探针 / `pnpm install` |
| 输入 | 本票 `.scratch/p0-01-audit/issues/04-capability-matrix.md`；`docs/v7.6/管线.md` §3.1 / §P0-01C；已收口 `research/01-baseline.md`、`02-safe-commands.md`、`03-real-pipeline.md`、`06-playtest-visual-evidence.md`；`CONTEXT.md` |
| 证据分级 | E1 源码 · E2 自动化测试断言 · E3 真实运行/产物 + 命令 + 退出码 + 身份；历史 E3 只证明其来源 commit + 交付身份 + 实际覆盖场景 |

> 本票只判定能力状态，不修复代码。机制细节以票 05 为准，Playtest / 人工视觉 / 证据完整性的细粒度事实以票 06 为准；本文件只把它们折成「能力 × 入口/场景」行。

---

## 0. 结论先行

1. **10 个能力域全部有结论，共 52 行。** 状态分布：**`E2E_VERIFIED` 31 行 · `TESTED` 17 行 · `UNKNOWN` 4 行 · `IMPLEMENTED` 0 行 · `BLOCKED` 0 行**。`E2E_VERIFIED` 行数多，是因为同一批真实运行被拆到不同能力/入口；**它们只来自 7 组独立真实运行**（见 §3），不能读成 31 个独立证明。
2. **横版主链的完整真实 E3 只有一个 Demo。** `040b907` 的 `create` 真实跑通输入 → 理解六步 → 规划 → 打包 → 校验 → 配置 → QA → 站点（`EXIT=0`），冻结副本在 `5b8283f`。`040b907..2c1a9d5` 之间，理解/规划/打包/配置/QA/站点装配代码未变；变化集中在 delivery 写回、playtest、review-verdict、verify-delivery。**该 E3 不能证明 HEAD 的重建等价，也不能外推到第二个玩法或第二个设计样本。**
3. **冻结 Demo 的 `delivery` 信封不是当前 `buildAndSite` 产出的。** 原始 `040b907` 的 `qa-report.json` 没有 `delivery`；冻结工作区里的 delivery 由 effort 脚本 `.scratch/fpvs-v1-final/acceptance/init-delivery.mjs`（`5b8283f`）初始化。当前 `buildAndSite` 的 delivery 写回只有 E1 + 分层 E2（`delivery-integration.test.ts`），**没有 CLI/MCP 壳级真实 E3**。
4. **Playtest 的真实 E3 分三块，且版本不同。** 交付内 `playtest/v1`、`v2` 是 **`harness/rules v1`** 的 CLI 写回 `SUCCESS`（`5b8283f`）；`06-attempt-1/2` 是 **`harness/rules v2`** 的 harness 直跑、未归因（`5f29592` / `8e92c69`）；当前 HEAD 的 **`v2` CLI 归因 + 写回组合没有 E3**。另有一份 `AGENT_LIMITATION → incomplete` 的沙箱 E3（票 08，`cf817c1`），不是冻结交付的负向场景。
5. **人工视觉只有一次可追溯真实记录。** `f458beb` 的记录：人类 reviewer、6 项全 pass、9 张真实按键截图、材料绑定冻结身份、站点字节未改。`verify-delivery` 只校验记录存在/格式/身份/材料集合/与 `delivery.visualReview` 一致，**不重判人工结论**；`review-verdict` 本身不校验截图/材料/身份。人工视觉的独立性、可重复性与第二个交付的迁移能力是 `UNKNOWN`。
6. **`verify-delivery` 是 HEAD 上唯一被本票独立重跑并 `pass` 的正式入口。** 审计本地重跑：223 文件（151 required / 72 optional）、13 records、六项 declared↔recomputed 全 match、diagnostics 0、exit 0、清单 sha `ba7a485b…`；运行前后 1,035 个受保护文件 sha256 零变化。它只证明「冻结清单覆盖的证据未被改」，**不证明当前 HEAD 能重新生成同一交付**；清单生成器不在 `packages/`，是 effort 工具。
7. **塔防旁路没有完整能力。** `compile-td-game` 没有「模型真实产出 td-config」的 E3；TD 站点装配/浏览器证据来自 **fixture pack + fixture td-config**（`d3e9137`，Canvas 回退、`canNine=false`）；TD 无 QA / delivery / playtest，真实浏览器里的玩家控制与目标达成是 `UNKNOWN`。
8. **MCP 只有 `create_game` 能走完横版全链；其余都是单步工具。** MCP 无 `build`、无 TD、无 `playtest` / `review` / `review-verdict` / `verify-delivery`；手工 `plan_assets → build_asset_pack → compile_runtime → assemble_site` 会被 QA 发布闸拒绝。MCP 全链**没有真实 E3**（只有 E2）。
9. **测试约束要单独看。** 本票两次整仓 `pnpm test` 都因超时非 0（第一次 3 个用例、第二次 5 个用例 + 2 个 suite；宿主负载极高，`collect` 最长 804s），但所有超时用例隔离重跑 **60/60 + 94/94 pass**；`typecheck` exit 0。历史 `2c1a9d5` 最终验收记录整仓 `pnpm test` exit 0 / 149 文件 / 2231 用例，但**本票没有在审计环境复现整仓绿**。这条写进 `TESTED` 行的 `limitations`，不据此判任何生产能力失败。
10. **第二个 Demo 的主要风险不在“有没有实现”，而在“单样本 + 证据链版本错位”。** 横版主链的 E3 只覆盖一个 Demo、一个平台玩法、一个设计样本（另有 TD fixture 渲染与旧包 accept，但不构成第二玩法或完整交付）；新玩法的机制支持、TD 编译、HEAD v2 试玩写回、交付信封生成、人工视觉迁移都需要补证据或另立需求。最终「能否进入实施」由票 07/08/09 与主文档裁定，本矩阵只提供依据。

---

## 1. 方法与状态规则

### 1.1 状态与证据映射

| 本报告状态 | 判定 | 与既有词汇的映射 |
|---|---|---|
| `IMPLEMENTED` | 能定位生产实现，但没有可核实的测试断言或真实 E2E | ≈ E1 |
| `TESTED` | 有可核实的测试断言，但没有充分真实 E2E（或 E2E 只覆盖不同场景/版本） | ≈ E2 |
| `E2E_VERIFIED` | 有可追溯真实运行：命令 + 退出码 + 路径 + 产物身份；**只对证据实际覆盖的场景成立** | ≈ E3 + 交付身份绑定 |
| `UNKNOWN` | 证据不足；或生产入口不存在/不可核实 | 证据不足 |
| `BLOCKED` | 审计限制（权限、不可读、环境）导致无法核实 | 本次无 |

`Mechanic Coverage` 的 `design / runtime / qa` 三层与 `DeliveryCheckStatus` 五值（`pass / fail / incomplete / blocked / not-required`）按 `CONTEXT.md` 既有语义使用，不另造同义词。

### 1.2 判定纪律

- **实现 + 测试但无真实 E2E ⇒ 主状态 `TESTED`**，实现事实留在 `implementation`。
- **单一成功样本必须在 `limitations` 写明**；同一能力域可拆多行（CLI / MCP / TD 旁路 / 不同版本），每行一个主状态。
- **历史 E3 不是 HEAD 的直接证明。** 每条 E3 在 §3 记录来源 commit、交付身份、证据清单 SHA、适用场景；正文只引用证据 ID。
- **代码漂移单独核对**：若证据 commit 与 `2c1a9d5` 之间该能力代码有变，状态降级或在 `limitations` 明示不能外推。
- **`UNKNOWN` 不等于“没实现”**：它表示“现有证据不足以判”；`BLOCKED` 本次为零，因为所有声明证据都可读。
- **`tests` 列**给出测试文件 + 行范围 + 代表性用例名/断言描述；完整用例名以文件为准。`implementation` 的 `path:line` 以 `2c1a9d5` 为准。

### 1.3 代码漂移核对（决定历史 E3 能否用于当前能力）

| 证据 commit | 与 `2c1a9d5` 的代码关系 | 对能力判定的影响 |
|---|---|---|
| `040b907`（真实 create） | `packages/pipeline/src/create-game.ts` 在 `040b907..2c1a9d5` 只增加「QA 失败时提前写 delivery」的 36 行；成功链（理解/规划/pack/verify/config/QA/site）未改。`packages/demo/src`、`packages/qa/src`、`packages/assets/src` 主链未改 | 输入、理解、设计、规划、打包、配置、QA、站点装配的 E3 可用于这些能力的**同一代码路径**；delivery 写回不能 |
| `5b8283f`（playtest v1 / visual） | `playtest` CLI 与写回层 `5b8283f..2c1a9d5` 未改；但 `packages/demo/probe/playtest/{policy,runner}.mjs` 与 `contracts/src/playtest*.ts` 在 `5b8283f..2c1a9d5` 升到 **harness/rules v2** | v1 CLI 写回 E3 只证明 v1；v2 组合必须单列 |
| `f458beb`（人工视觉写回） | `writeVisualReviewToReport` / `review-verdict` 在 `f458beb..2c1a9d5` 未改；变化只在 playtest 契约/harness | 视觉写回的 E3 可用于同一代码路径；人工判断本身不可机器复核 |
| `c619d84`（accept） | `packages/assets/src/acceptance.ts` 在 `c619d84..2c1a9d5` 未改；只 `cli.ts` 增长 | accept 的 E3 可用于同一代码路径，但包是旧的、独立包 |
| `d3e9137`（TD 浏览器） | `packages/demo/src/td/**`、`site.ts`、`assemble.ts`、`contracts/src/td-config.ts` 在 `d3e9137..2c1a9d5` 未改 | TD 站点装配/渲染 E3 可用；compile 的 E3 仍缺 |
| `2c1a9d5`（证据完整性） | 生产代码即基线 | 这是 HEAD 的直接证据（本票又独立重跑一次） |

---

## 2. 能力矩阵（按 PRD §3.1 的 10 个域）

### 2.1 输入与游戏意图解析

| capability | implementation | contract | tests | real_evidence | status | limitations | next_action |
|---|---|---|---|---|---|---|---|
| CLI `create` 输入：1 张参考图 + 需求文本或 `.md` 路径 | `packages/cli/src/cli.ts:576-600`（create）；`:226-244`（`readRequirement` 路径判别）；`packages/pipeline/src/create-game.ts:285-312`（单图/PNG 校验） | 需求是自由文本（`CONTEXT.md:64-72`），无输入 schema；`StyleReferencePath` 必须相对（`create-game.ts:263-269`） | `packages/cli/tests/cli-create.test.ts:217-246`（裸文本/`.md`/路径误判）；`:477-496`（缺参、`--style` 两次） | **E-01**：`create.log` `command=create`、`EXIT=0`；`run/v1/intent.md`（257B）、`style.png`、`reference.png` | `E2E_VERIFIED` | 单样本：1 张 PNG + 一段中文需求；多参考图/非 PNG 未实现（代码在理解前拒绝）；历史 E3 非 HEAD 重跑，但输入解析代码未变 | 无需行动；第二 Demo 换输入形态时补一次真实运行 |
| CLI 两段式：`create` 停在清单 → 人改 → `build` | `cli.ts:591-594`（awaiting 状态，退出 0）；`:601-612`（`build` → `buildAndSite`）；清单磁盘真相 `create-game.ts:477` | `run/v<N>/` 自包含；`asset-recipe.json` 是唯一人工编辑点 | `cli-create.test.ts:248-306`（检查点/摘要/退出码）；`:333-379`（两路等价、磁盘清单生效）；`create-game.test.ts:241-293`（人改清单、篡改包） | E-01 是 `create --yes` 直通；**检查点分支无真实 E3** | `TESTED` | 真实运行没有“停住→人改→build”的日志；`cli-create` 还依赖未入库的 `dist/shell.js`（`cli-create.test.ts:178-182`） | 第二 Demo 若需人改清单，补一次检查点真实运行 |
| MCP `create_game` 输入 | `packages/mcp/src/server.ts:24-32`（路径判别）、`:350-429`（create_game） | 与 CLI 同一 `runUnderstanding`；输入 `stylePath` + `intent` | `packages/mcp/tests/server.test.ts:77`（8 工具）；`create-game-qa-failure.test.ts:109-110`；`error-semantics.test.ts` | 无真实 MCP E3 | `TESTED` | 从未真实跑过 MCP 入口；`create_game` 恒跑完、无检查点；不传 `hudLineHeight`（与 CLI 入口参数不对称） | 若第二 Demo 走 MCP，补一次真实 `create_game` |
| 需求 → `GameIntentSpec`（`analyzeIntent`） | `packages/game-design/src/analyze-intent.ts:178`；`create-game.ts:336-345` | `GameIntentSpecSchema`（`packages/contracts/src/game-intent.ts:130`） | `packages/game-design/tests/analyze-intent.test.ts:69-146`（强制工具调用、重采样、空输入）；`packages/contracts/tests/game-intent.test.ts` | **E-01**：`run/v1/game-intent.json`（2087B，5 条 mechanics、4 条 ambiguity） | `E2E_VERIFIED` | 单设计样本；模型输出依赖真实上游；历史 E3 非 HEAD 重跑，代码未变 | 无需行动 |

### 2.2 风格与视觉世界描述

| capability | implementation | contract | tests | real_evidence | status | limitations | next_action |
|---|---|---|---|---|---|---|---|
| 参考图 → `VisualWorldSpec` + 参考图自包含拷贝 | `packages/vision/src/analyze-reference.ts:286`；`create-game.ts:314-328`；`packages/pipeline/src/artifacts.ts:60-78`（拷图并改写相对路径） | `VisualWorldSpecSchema`（`packages/contracts/src/visual-world.ts:160`）；`styleReferences` 相对 `visual-world.json` | `packages/vision/tests/analyze-reference.test.ts:76-154`；`build-visual-world.test.ts:29-95`；`palette.test.ts:72-129` | **E-01**：`run/v1/visual-world.json`（3970B）、`stylespec.json`（758B、16 色） | `E2E_VERIFIED` | 单张 PNG；多图/非 PNG 未支持；单样本 | 无需行动 |
| 设计 + VWS → `VisualDesignSpec` + SVG/预览 | `packages/visual-design/src/compile.ts:30`；`create-game.ts:371`；layout/render/validator 同包 | `VisualDesignSpecSchema`（`packages/contracts/src/visual-design.ts:79`） | `packages/visual-design/tests/compile.test.ts:15`；`layout.test.ts:45-102`；`render/svg/validator.test.ts` | **E-01**：`run/v1/visual-design.json`（1778B）+ `visual-design/{svg,preview}/` | `E2E_VERIFIED` | 确定性纯计算；真实产物只有一个设计；预览不进入人工视觉材料（人工材料用交付图集帧） | 无需行动 |
| Character DNA | `packages/game-design/src/compile-character-dna.ts:163`；`create-game.ts:358-367` | `CharacterDNAFileSchema`（`packages/contracts/src/character-dna.ts:162`） | `compile-character-dna.test.ts:37-120`（一次调用产一族、重采样）；`packages/qa/tests/entity-identity.test.ts` | **E-01**：`run/v1/character-dna.json`（2463B） | `E2E_VERIFIED` | 单设计样本（2 个角色）；没有第二个美术世界的 E3 | 无需行动 |

### 2.3 游戏设计与机制表达

| capability | implementation | contract | tests | real_evidence | status | limitations | next_action |
|---|---|---|---|---|---|---|---|
| 意图 + VWS → `GameDesignSpec`；R12 只允许 `platformer/v1` | `packages/game-design/src/compile-design.ts:218`；`create-game.ts:347-356`；`packages/contracts/src/runtime-profile.ts:114-129` | `GameDesignSpecSchema`（`packages/contracts/src/game-design.ts:124`）；`RuntimeProfile` 只有 `platformer/v1` | `compile-design.test.ts:98-152`（R12 拒绝/重采样）；`build-design.test.ts:89-202`（意图覆盖、`moving-platform` ⇒ `mechanic-experimental`） | **E-01**：`run/v1/game-design.json`（3202B，`runtimeProfile=platformer/v1`）；**E-13** coverage `design` 全 satisfied | `E2E_VERIFIED` | 单平台玩法、单设计样本；**没有真实运行触发过 R12 拒绝**（只有 E2）；TD 旁路完全不经设计层 | 第二 Demo 选非平台玩法时，先按票 05 审计机制/Profile 支持 |
| `RuntimeProfile` / `Mechanic Status`：`supported` 来自运行时见证，`moving-platform` 为 `experimental` | `packages/contracts/src/runtime-profile.ts:114-129`；`packages/contracts/src/vocabulary.ts:89-105`；`packages/demo/tests/shell-mechanic-witness.test.ts` | `MECHANICS` / `CAPABILITIES` 封闭词表；`supported` / `experimental` / `deprecated` | `packages/contracts/tests/runtime-profile.test.ts:28-48`；`vocabulary.test.ts:112-124`；`shell-mechanic-witness.test.ts`（10 条机制逐条源码见证、`moving-platform=null`）；`build-design.test.ts:190-202` | 无真实 E3（真实运行中未触发拒绝） | `TESTED` | 状态是源码见证 + 测试，不是行为级 E3；只有 `platformer/v1`；`moving-platform` 明确 experimental | 无需行动；行为级机制见票 05 |
| `Mechanic Coverage` 报告生成与门禁（**不是机制验收**） | `packages/contracts/src/mechanic-coverage.ts:74-112`；门禁 `create-game.ts:647-650`；runner `packages/qa/src/assemble.ts:75` | `mechanic-coverage/v1`；五态 `satisfied/missing/unsupported/not-tested/failed`；`verdict` 是「无阻断」 | `packages/contracts/tests/mechanic-coverage.test.ts:18-69`；`packages/qa/tests/*` | **E-13**：`mechanic-coverage.json` verdict `satisfied`；8 条机制中 3 条 `qa=satisfied`、5 条 `qa=not-tested`；**`avoid-danger` 的 satisfied 不等于真实触发**（冻结 config 无 danger 实体，票 05 §0-4） | `E2E_VERIFIED` | 只读 `design.mechanics`，不检查 config；生产不传 `probeResults`；报告不落盘；`satisfied` 是覆盖字段，不是行为证据；本票未重跑 probe | 票 05 已详审；第二 Demo 新机制先补 probe |

### 2.4 资源规划、生成、打包及验证

| capability | implementation | contract | tests | real_evidence | status | limitations | next_action |
|---|---|---|---|---|---|---|---|
| 资源规划 `planAssets` → `asset-recipe` + `asset-plan` sidecar | `packages/assets/src/ops.ts:370-681`；`create-game.ts:381-401`；CLI `plan` `cli.ts:613-627` | `asset-recipe/v1`（`packages/contracts/src/recipe.ts:17,373`）；`asset-plan/v1`；路线 `resolveRoute`（`packages/assets/src/route.ts:80-120`） | `packages/assets/tests/plan-assets*.test.ts`（覆盖/HUD/玩家/背景闸、sidecar、重采样）；`route-resolver.test.ts` | **E-01**：`run/v1/asset-recipe.json`（7243B）+ `asset-recipe.plan.json`（2947B）；`ledger.json` 记 `plan-assets` 1 次 | `E2E_VERIFIED` | 单样本；真实包只走 `generated` 路线；`import` / 纯程序化路线只有 fixture 测试 | 无需行动；第二 Demo 换资源路线时补真实包 |
| 资源生成 + 打包 `packAssets` / `buildAssetPack` | `ops.ts:1681-1835`；`packages/assets/src/pack.ts:307-1304`；`create-game.ts:515`；CLI `pack` `cli.ts:629-647` | `assetpack/v4`（`packages/contracts/src/assetpack.ts:57,335`）；`files[]` 穷举包内除 manifest 外全部文件 | `pack.test.ts:45-115`（结构/files[]/确定性/不覆盖）；`pack-selfcheck.test.ts`；`pack-*.test.ts`；`ops.test.ts`（无兜底、失败现场、账） | **E-01**：`pack/v1` 8 资源 / 4 图集 / 45 文件，`manifest.json` sha `sha256:a162942d…feb3`；包内 ledger 22 次调用 | `E2E_VERIFIED` | 单 Demo、`generated` 路线；`import` / 程序化路线只有 E2；`dashscope-mcp` 不支持参考图且无真实 E3 | 无需行动 |
| `verifyPack` 链内正例（pack 之后、config 之前） | `ops.ts:1836-1923`；入链 `create-game.ts:540`；CLI `verify` `cli.ts:706-710` | 逐文件 bytes + sha256；`files[]` 穷举；ledger / master-ratios schema 与身份 | `create-game.test.ts:270-291`（注入口篡改包 ⇒ config/QA/site 之前 `invalid`，原包保留）；`pack.test.ts` 多处 `verifyPack(...).data.ok` | **E-01** 间接：`create` 退出 0 即链内 `verifyPack` 通过；无独立 `verify` 日志 | `E2E_VERIFIED` | 只证明「生成包在链内通过」；不是独立 CLI `verify` 的 E3；真实篡改检测只有 E2 | 无需行动 |
| CLI `verify` 独立入口 + 篡改检测 | `cli.ts:706-710` → `verifyPack` | 同上 | `packages/cli/tests/cli.test.ts:123-146`（篡改后 verify 非 0）；`pack.test.ts` / `ledger.test.ts` 负例 | 无跟踪的独立 `game-maker verify` 真实日志；**E-09** 的 `asset-pack` 重算会调用 `verifyPack`（`evidence-integrity.ts:982`），但那是验收器内部，不是 CLI `verify` 的 E3 | `TESTED` | 无真实独立 CLI 运行；失败现场与退出码只在 E2 | 第二 Demo 交付前补一次独立 `verify` 真实运行 |
| 结构验收 `accept`（图集/帧/锚点/checksum + 可选 baseline） | `packages/assets/src/acceptance.ts:566-850`；CLI `cli.ts:716-729`；MCP `server.ts:295-339` | `animation-acceptance/v1` | `packages/assets/tests/acceptance.test.ts:225-509`（v7 正例、7 类负例、baseline、版本不覆盖）；`cli.test.ts:308-390` | **E-10**：`report.json` pack `ruin-scavenger-extraction-assets` v7、`findings=[]`、`baseline=null`，来源 `c619d84` | `E2E_VERIFIED` | 单旧包、无 baseline、不是当前 wasteland Demo；accept 不在 create/build 链 | 无需行动；新 Demo 另行跑 accept |
| `import` / 纯导入 / 程序化路线 | `packages/assets/src/route.ts:80-120`；`pack.ts` 的 import 分支；`import.ts` | `route` 决策与 `provenance` | `pack-test.ts:116-186`、`import.test.ts`、`route-resolver.test.ts:67-98`、`import-fixture.test.ts` | 冻结包 `provenance.mode=generated`；真实 E3 未覆盖 import 路线 | `TESTED` | 只有 fixture/真实素材单测；无真实交付包 | 第二 Demo 需要复用资源时补真实 import 包 |
| MCP `plan_assets` / `build_asset_pack` / `verify_asset_pack` / `accept_asset_pack` / `inspect_asset_pack` | `server.ts:267-349`、`:445-446`；与 CLI 共用 core | 同 CLI 的 recipe / assetpack / acceptance 契约 | `server.test.ts:110-209`；`build-pack-stdio.test.ts:149-230`；`error-semantics.test.ts` | 无真实 MCP E3 | `TESTED` | 单步工具；`build_asset_pack` 不跑 QA；MCP 无 `build` | 若第二 Demo 走 MCP，补一次真实组合 |

### 2.5 关卡配置与运行时编译

| capability | implementation | contract | tests | real_evidence | status | limitations | next_action |
|---|---|---|---|---|---|---|---|
| `compileRuntime` → `game-config/v1` | `packages/assets/src/ops.ts:1039-1277`；`create-game.ts:550-570`；CLI `cli.ts:649-663`；MCP `server.ts:340-349` | `game-config/v1`（`packages/contracts/src/game-config.ts:30,215`）；`auditGameConfig` / `auditEntityIdentity` / `auditScreenSpace` / `auditLayerCoverage` | `compile-runtime.test.ts:72-160`（示例过 schema、重采样、业务校验、HUD 屏幕空间）；`contracts/tests/game-config.test.ts:65-187` | **E-01**：`run/v1/game-config.json` 与 `site/v1/game-config.json` 同字节，sha `sha256:455d9c7f…7dcd` | `E2E_VERIFIED` | 单横版关卡；真实 E3 是 `create` 链内调用，不是独立 `compile-runtime`；MCP 不传 `hudLineHeight`（今天同值 10，但入口漂移） | 无需行动 |
| 配置族校验 / 拒绝语义 | `ops.ts:1180-1235`；`packages/contracts/src/screen-space.ts`、`layer-coverage.ts` | 引用族 / 自洽族 / 屏幕空间 / 层覆盖 | `compile-runtime.test.ts:130-160`；`game-config.test.ts`；`site.test.ts:79-140`（装配期再跑） | E-01 间接（配置通过）；无真实“坏配置被拒”的 E3 | `TESTED` | 负向路径只有 E2；层覆盖是确定性硬失败、不重采样 | 无需行动 |
| TD `compileTdGame` → `td-config/v1` | `ops.ts:1405-1570`；CLI `cli.ts:665-679`；MCP 无 | `td-config/v1`（`packages/contracts/src/td-config.ts:33`）；`tdResolveConfig` / `auditTdConfig` / `auditTdWorldSize` | `compile-td-game.test.ts:31-153`；`compile-td-game-error-class.test.ts:42-43`；`contracts/tests/td-config.test.ts:37-178` | **无真实模型输出 E3**；`counter-siege-v4.json` 是 `inspect` 输出，不是 compile 输出 | `TESTED` | 不经设计层；无 QA/delivery/playtest；空凭据检查缺失（`ops.ts:1412` vs `ops.ts:1080`）；真实关卡只有 fixture | 第二 Demo 若走 TD，先补一次真实 `compile-td-game` 并加空凭据闸 |
| 横版站点装配 `assembleFromConfig → assembleSite` | `packages/demo/src/assemble.ts:53-66`；`site.ts:167-250`；壳层 `cli.ts:247-297`；`layout.ts:75-150` | `site.json = {shell,pack,config}`；`index.html` 引用 `shell.js`；发布闸要求当前包的 QA 报告 | `site.test.ts:29-317`（三份数据、不覆盖、硬失败、层覆盖、HUD 屏幕空间）；`cli-site-gate.test.ts`；`publish-gate.test.ts` | **E-01**：`site/v1`（shell 2、pack v1、game-config.json）；**E-12** 真实 Chrome 打开站点（但核心循环失败） | `E2E_VERIFIED` | 单横版站点；装配成功不等于玩法通过（E-12 已证明）；独立 `site` 不写 delivery ⇒ 不能 playtest | 无需行动 |
| TD 站点分派 `assembleTdSite`（从 fixture td-config） | `assemble.ts:53-66` 按 `format` 分派；`td/site.ts:92-175`；CLI `site` 支持 TD，MCP `assemble_site` 只调横版 | `td-config/v1`；世界尺寸/可通关模拟；`publish-gate.ts:145-147` 显式跳过 TD 的 QA 闸 | `td-site.test.ts:33-270`；`td-winnable.test.ts`；`td-sim.test.ts`；`cli-site-gate.test.ts:149`（TD 跳过 QA 闸） | **E-11**：fixture `counter-siege/v4` + fixture td-config，真实 Chrome、Canvas 回退（`canNine=false`） | `E2E_VERIFIED` | 配置来自 fixture，不是 `compile-td-game` 产物；只证明装配/渲染/一次尺寸读数，不证明玩法；无 delivery/playtest | 与 D5-3 一起补 TD 真实编译 + 交付闭环 |
| MCP `assemble_site` | `server.ts:430-444`，只调 `assembleSite` | 横版 site 契约；不能分派 TD | `assemble-site-qa-gate.test.ts:65-124`；`server.test.ts` | 无真实 MCP E3 | `TESTED` | 不能装 TD；默认 shell 路径是相对字符串；需要已有 QA 报告 | 若 MCP 要支持 TD，另立需求 |

### 2.6 Demo 启动、玩家控制及目标达成

| capability | implementation | contract | tests | real_evidence | status | limitations | next_action |
|---|---|---|---|---|---|---|---|
| Demo 启动：静态站点 + 本地 HTTP + 真实 Chrome | `packages/demo/src/shell/entry.ts:54-87`（按 `site.json.config` + `format` 分派）；`layout.ts:118-137`；`packages/demo/probe/probe-harness.mjs` | `site.json` / `index.html` / `shell.js`；HTTP server 根必须是 pack/site 的父目录 | `packages/demo/tests/world.test.ts:34-180`；`shell-*`；`site.test.ts:72-77` | **E-12**：Chrome/155.0.8059.86 打开 `http://127.0.0.1:54116/site/v1/index.html`；场景 `playable` 失败（45s 超时，x=79、collected=1/4、won=false） | `E2E_VERIFIED` | 启动与渲染 E3 成立；**核心循环当时未通过**；只证明 Chrome 155 + 该站点；`dist/shell.js` 未入库 | 无需行动；玩法证据看下一行 |
| 横版玩家控制 + 目标达成（真实按键） | 外壳 `packages/demo/src/shell/scene.ts`；harness `probe/playtest/runner.mjs` + `policy.mjs`；playtest CLI `packages/cli/src/playtest.ts:345-447` | `playtest-scenario/v1`、`playtest-report/v1`；断言三值；`delivery.playable-smoke` | `probe/playtest/tests/observe/policy/termination/danger-forms.test.mjs`（60 个）；`contracts/tests/playtest.test.ts`；`pipeline/tests/playtest.test.ts` | **E-03**：v1 CLI 写回 `SUCCESS`，`won=true`、`collected=6`、`chests=2`、`resets=0`；**E-04**：v2 直跑两次，`won=true`、`collected=6`、`chests=2`、`hits=0`、steps 452/451、同投影 | `E2E_VERIFIED` | 单 Demo、单场景、自动策略（非人类）；v1 与 v2 版本错位；`state` 轮询可能漏瞬时事件；TD 不适用 | 无需行动；第二 Demo 重新跑 |
| 机制级真实触发（collect-pickup / open-chest / reach-goal） | 外壳 `scene.ts` 的 `collect` / `openChest` / `tryWin`；真实 playtest 断言 | 场景断言 `initial-pickups` / `all-collected` / `chests-opened` / `won`；`mechanic-coverage/v1` 只作覆盖报告，不作机制验收 | `shell-mechanic-witness.test.ts`（三条均有运行时见证）；`probe/playtest/tests/observe.test.mjs`（事件/断言三值）；`mechanic-coverage.test.ts:18-69` | **E-03**：`collected=6`、`chests=2`、`won=true`（三条都有真实断言）；**E-13** 的 `avoid-danger` 不是真实触发（冻结 config 无 danger 实体，票 05 §0-4） | `E2E_VERIFIED` | `reach-goal` 不在 `design.mechanics[]`；`run/jump/gravity/collide-terrain` 只有间接证据；`avoid-danger` 只有 fixture probe；`hazard-contact` 有真实发生无正向判定；本票未重跑 probe | 票 05 已详审；第二 Demo 新机制先补 probe + 交付场景断言 |
| TD 站点真实渲染（fixture 关卡） | `td/scene.ts`；`td/world.ts`；`td/sim.ts`；`assembleTdSite` | `td-config/v1`；参考玩家；`killed === 0` 判据 | `td-sim.test.ts:29-247`；`td-winnable.test.ts:21-78`；`td-world.test.ts`；`td-site.test.ts` | **E-11**：真实 Chrome 读数；`hud.start` 声明 28 实际画 44.5、右边缘出屏；Canvas 回退、`canNine=false` | `E2E_VERIFIED` | 只证明 fixture 配置能装、能渲染、能读；**不是 compile 产物**；只测渲染尺寸，不代表玩法通关 | 与 TD 编译/交付一起补 |
| TD 玩家控制 + 目标达成（真实浏览器） | `td/sim.ts` 参考玩家；`td-winnable` | 可通关下界；输赢规则 | `td-sim.test.ts:199-247`；`td-winnable.test.ts` | **无真实 E3**；只有单元模拟与 reference player | `UNKNOWN` | 没有跟踪的真实 TD 通关/失败运行；`experiments/72` 是渲染探针，不是 gameplay | 若要第二 Demo 走 TD，必须先补真实 TD 试玩或明确不支持 |
| MCP `create_game` 全链 | `server.ts:350-429`：`runUnderstanding → runBuild → assertPublishableQa → assembleSite → delivery` | 横版全链；恒跑完、无检查点 | `create-game-qa-failure.test.ts:109-110`；`server.test.ts:77`；`create-game-no-digest.test.ts:119-120` | 无真实 MCP E3 | `TESTED` | 只有横版；不能 TD；不能对已有 run 重新 build；不传 `hudLineHeight` | 第二 Demo 若走 MCP，补一次真实全链 |

### 2.7 Playtest 的执行、观测、结果分类与报告写回

| capability | implementation | contract | tests | real_evidence | status | limitations | next_action |
|---|---|---|---|---|---|---|---|
| CLI `playtest` 六项准备 + 身份校验 | `packages/cli/src/playtest.ts:106-163`（`resolveTarget`）；`cli.ts:765-773` | run 形状/outRoot、`qa-report.delivery`、`delivery.site` 且 qa/site pass、site 三元组、pack 身份/checksum、run config = site config = delivery.config | `playtest-scenario-dir.test.ts:54-97`（场景选择）；**六项准备校验没有 CLI 级测试**（票 06 §8.3） | **E-03**：v1 运行成功；**E-05**：AGENT_LIMITATION 沙箱运行、退出 1、站点未改 | `E2E_VERIFIED` | 真实 E3 是 v1；v2 组合无 E3；准备拒绝分支只有 E1 | 补 v2 CLI 准备/拒绝测试与一次真实运行 |
| 真实浏览器执行 + 观测（Chrome/CDP/按键/只读探针） | `probe-harness.mjs:77-460`；`probe/playtest/runner.mjs:397-470`；`observe.mjs:1-241` | `Runtime Observation` / `Runtime Event Log`（11 类闭事件）；`site-integrity.json` 前后哈希 | `probe/playtest/tests/observe.test.mjs:23-137`；`scenarios/termination/danger-forms/policy`（60 个） | **E-03**：`events/trace/input/console/exceptions` + `chrome.log` + 站点四文件 unchanged；**E-04**：v2 两次 attempt | `E2E_VERIFIED` | 轮询快照，**两次成功读取之间的瞬时事件可能漏**；spawn/jump/land/reset 是推断；只支持 Phaser 外壳 | 无需行动；关键事件需要更强观测时另立需求 |
| `SUCCESS` 归因 + 聚合 + 场景门槛 | `contracts/src/playtest-attribution.ts:99-208`；`contracts/src/playtest.ts:496-545` | 五态 + `UNKNOWN` + `not-executed`；聚合优先级；`SUCCESS` 必须有终止 + 实质断言全 pass | `contracts/tests/playtest-attribution.test.ts`（19）；`contracts/tests/playtest.test.ts:96-345`（41） | **E-03**：aggregate `SUCCESS`、8/8 断言 pass、termination true | `E2E_VERIFIED` | 单场景 happy-path；自动策略；只证明冻结 Demo | 无需行动 |
| 非 `SUCCESS` 归因（GAMEPLAY / ENVIRONMENT / TIMEOUT / AGENT_LIMITATION / UNKNOWN） | `playtest-attribution.ts:99-208`；`cli/src/playtest.ts:213-256`（错误来源正则、归因输入） | 五态 + `UNKNOWN`；`InsufficientEvidence` 结构化必填；`not-executed` 不是 outcome | `playtest-attribution.test.ts:70-200`（19）；`playtest.test.ts:112-141`（映射/不升级） | **E-05**：`AGENT_LIMITATION → incomplete` 的沙箱 E3（exit 1、站点未改）；其余状态无真实 E3 | `TESTED` | 交付路径默认只要求一个 happy-path；`ENVIRONMENT/GAMEPLAY/TIMEOUT/UNKNOWN` 只有 E2；错误来源用正则，`texture/load` 类游戏错误可能误归环境；`chromeAvailable` 硬编码 true | 补至少一个 `required:true` 的负向/invariant 场景与真实 E3 |
| CLI 写回 `delivery.playtest` / `playable-smoke`（v1） | `packages/pipeline/src/playtest.ts:27-92`；`cli/src/playtest.ts:406-410`；`contracts/src/delivery.ts:317-370`（`applyPlaytest`） | 只动 `playable-smoke` 检查项、`delivery.playtest`、`verdict`；身份不匹配拒写；幂等 | `pipeline/tests/playtest.test.ts:88-138`（6）；`contracts/tests/playtest.test.ts:265-345`（写回纯函数/拒写） | **E-03**：`delivery.playtest.report` 指向 v2、`playable-smoke=pass`、verdict pass；**E-05**：AGENT_LIMITATION → incomplete、写回成功 | `E2E_VERIFIED` | **只有 v1 harness/rules 的 E3**；v2 写回没有 E3；失败重跑不撤销旧 pass（票 06 §7） | 补 v2 CLI 写回 E3；失败时将 `playable-smoke` 降级 |
| HEAD 的 `playtest` CLI × harness/rules v2 组合 | `cli/src/playtest.ts`（未变）+ `probe/playtest/{policy,runner}.mjs`（v2）+ `contracts/src/playtest.ts:23-24`（v2） | `PLAYTEST_HARNESS_VERSION/RULES_VERSION = v2`；报告 schema 仍 v1（加性） | 同上；`packages/demo/probe/playtest/tests/*`（v2 行为） | **E-04** 只证明 harness v2 能跑；**没有 v2 CLI 归因/写回 E3** | `TESTED` | 组合未经真实 E2E；版本不强制等于当前常量（票 06 §4） | 补一次 HEAD v2 CLI 真实 playtest |
| Playtest baseline 晋升与比较 | `packages/pipeline/src/playtest-baseline.ts:29`；`contracts/src/playtest-baseline.ts:117`；CLI `cli.ts:730-764` | `playtest-baseline/v1`；覆盖字段投影；身份不匹配 `not-comparable`；纯观察、不改 verdict | `pipeline/tests/playtest-baseline.test.ts:49-105`（6）；`contracts/tests/playtest-baseline.test.ts` | **E-06**：ticket-09 沙箱 `promote` 成功（report checksum `b8942403…` / `9f34bffc…`），随后 playtest 显示「与基线一致」 | `E2E_VERIFIED` | 沙箱基线，**`fixtures/playtest-baselines/` 只有 README、零入库基线**；比较是纯观察，不参与 verdict；只有 v1 | 决定是否把基线纳入交付；否则保持 `not-required` |

### 2.8 人工视觉确认及其与最终判定的关系

| capability | implementation | contract | tests | real_evidence | status | limitations | next_action |
|---|---|---|---|---|---|---|---|
| `review-verdict` 人工结论写回 | `cli.ts:784-818`；`packages/pipeline/src/delivery.ts:153-180`；`contracts/src/delivery.ts:293-315` | 只动 `delivery.visualReview` + `visual-review` 检查项 + verdict；reviewer 默认 git user | `packages/cli/tests/review-verdict.test.ts:48-92`（pass/fail/非法 run/缺报告/非法 verdict/跨 run 不继承）；`pipeline/tests/delivery.test.ts:172-236` | **E-07**：`review-record.deliveryBinding` 记录由 `review-verdict` 写回；`visualReview.status=pass`、verdict pass、快照零写入 | `E2E_VERIFIED` | **只检查 run 形状 + 报告存在，不校验截图/材料/身份/评审人真实性**；`delivery.visualReview` 不带记录路径/哈希 | 建议让 `review-verdict` 接受并校验 record/materials subject 与哈希 |
| 视觉材料绑定 + 证据完整性校验 | `.scratch/fpvs-v1-final/runs/2026-10-28-visual-review/{materials,capture}.json`；`evidence-integrity.ts:883-960`（`visualConsistency`） | 材料 44 条（17 源 + 27 生成）；截图去重；subject 六字段；`delivery.visualReview` 与记录一致 | `pipeline/tests/evidence-integrity.test.ts:438-446`（材料集合不一致 fail）；最终验收身份 11/11 | **E-07** + **E-08/E-09**：材料引用全部 verified、截图 9 张/8 个不同字节、subject 与清单一致 | `E2E_VERIFIED` | 只校验完整性/一致性，不重判“像不像”；`review-record.items[].evidence[]` 不被解析；截图重复只统计不判失败 | 建议把 item evidence 纳入材料引用图 |
| 人工视觉与最终 verdict 的关系 | `contracts/src/delivery.ts:46-101`（六项必需）；`deriveDeliveryVerdict` | `visual-review` 必需；`pending→incomplete`；`pass` 才可能 verdict pass | `contracts/tests/delivery.test.ts:25-120`（A–L 矩阵、总序）；`pipeline/tests/delivery-integration.test.ts` | **E-02**：冻结 delivery 六项 pass / verdict pass，visualReview=pass；**E-07** 记录全 pass | `E2E_VERIFIED` | 只对冻结交付成立；人工结论是人的断言；生产路径不强制视觉记录存在（只有 verify-delivery 会 blocked） | 第二 Demo 重新做人工审核并绑定新身份 |
| 自动视觉诊断 `review`（付费） | `packages/pipeline/src/review.ts:76-110`；CLI `cli.ts:775-783` | 只记 run 级账；不写 delivery；选“最新包”而非 run 绑定包 | `pipeline/tests/review.test.ts:75-150` | 无跟踪的真实 `review` 运行 | `TESTED` | 不在交付链；无真实 E3；包选择有歧义；本票禁止付费未运行 | 无需行动（非交付能力） |
| 人工视觉的独立性与可重复性 | 无生产机制；仅 effort 记录 | reviewer 是自由字符串；无身份认证；`review-verdict` 不校验记录 | 无测试 | **E-07** 只有一次记录；reviewer=`人（本次会话用户）` | `UNKNOWN` | 无法核实“审核者确实看了”；无法证明第二个交付会得到同等审核；历史 pass 未继承 | 第二 Demo 另做人工审核；建议把审核记录纳入交付绑定 |

### 2.9 `verify-delivery` 与证据完整性验证

| capability | implementation | contract | tests | real_evidence | status | limitations | next_action |
|---|---|---|---|---|---|---|---|
| CLI `verify-delivery` 正例（冻结清单） | `cli.ts:820-828`；`packages/cli/src/evidence.ts:15-63`；`packages/pipeline/src/evidence-integrity.ts:1177-1290` | `delivery-verification/v1`；清单 `delivery-evidence-manifest/v1`；`--out` 必须在 roots 外 | `packages/cli/tests/evidence.test.ts:49-105`（6）；`pipeline/tests/evidence-integrity.test.ts:281-282`（正例） | **E-08**：`2c1a9d5` status pass/exit 0/223 文件/13 records/六项 match/diagnostics 0；**E-09**：本票 HEAD 重跑同样 pass、3,011ms | `E2E_VERIFIED` | 只验冻结清单覆盖的证据；不重新生成交付；不构建/不跑 QA/不启动浏览器；单 Demo | 无需行动；第二 Demo 需要新清单 |
| 六项检查由证据重导出 + declared vs recomputed | `evidence-integrity.ts:962-1088`（`recomputeChecks`）；`:1210-1290`（verdict/exit） | `asset-pack/config/qa/site/playable-smoke/visual-review` 六项；`deriveDeliveryVerdict` 总序 | `evidence-integrity.test.ts:354-364`（声明与重算不一致 fail）；`:449-456`（结论过期） | **E-09**：六项 `match=true`、`verdictMatch=true`；**E-08** 同 | `E2E_VERIFIED` | 六项中的 `qa` 来自 `qaVerdict`、`playable-smoke` 来自 playtest 摘要，重算不等于重跑；不校验 harness/rules 版本 | 无需行动 |
| 负向检测（篡改/缺失/不可读/路径逃逸/身份/引用/材料/过期） | `evidence-integrity.ts:237-960`；`cli/src/evidence.ts` | 状态 `verified/missing/unreadable/hash-mismatch/path-invalid/optional-missing`；exit 0 只在 pass | `evidence-integrity.test.ts:295-470`（18：篡改、缺失、身份、三方、`..`、目录冒充、root 外/悬空/root 内链接、绝对路径、引用错 attempt、材料集合、结论过期、只读、确定性）；`cli/evidence.test.ts:49-105`（6） | 只有 E2；本票没有真实篡改运行 | `TESTED` | 负向全部是 fixture 测试；无真实失败运行的 E3；CLI playtest 准备层与视觉非全 pass 无负向用例 | 无需行动；第二 Demo 前可补一条真实失败演练 |
| 只读性（校验不写历史/受保护交付） | `evidence-integrity.ts` 只读；`writeVerificationReport` 只写新 `--out` 目录；`assertOutOutsideRoots` | 报告目录原子分配、不覆盖；root 外 `--out` 拒绝 | `evidence-integrity.test.ts:458-464`（只读性、确定性）；`cli/evidence.test.ts:99-105`（重复运行不覆盖） | **E-09**：本票运行前后 **1,035 个受保护文件 sha256 零变化**；**E-08**：312 个受保护文件零变化、证据目录 git status 零改动 | `E2E_VERIFIED` | 只覆盖本票选定的受保护根；清单与证据一起被改并提交仍在信任边界外 | 无需行动 |
| 期望哈希清单生成/冻结（生产入口） | 只有 effort 工具 `.scratch/evidence-integrity-v1/tools/build-manifest.mjs`；**不在 `packages/`**；`build-manifest` 未被生产 CLI/MCP 引用 | 清单 schema `delivery-evidence-manifest/v1` | 无生产测试；清单本身 223 文件 / 13 records / sha `ba7a485b…` | **E-08/E-09** 使用同一冻结清单；清单由 effort 生成 | `UNKNOWN` | 生产链没有“生成/更新清单”的入口；无法从 CLI/MCP 复现；清单作者可选择记录策略（票 06 §7） | 明确清单是否纳入生产；若第二 Demo 需要，另立需求 |

> 注：MCP 没有 `verify-delivery`（Evidence Integrity V1 用户裁定 Q4(a)）；D9 只有 CLI 入口，MCP 不单列。

### 2.10 版本隔离、历史交付保护及相关测试约束

| capability | implementation | contract | tests | real_evidence | status | limitations | next_action |
|---|---|---|---|---|---|---|---|
| Run 版本分配 `run/v<N>`（原子抢、失败不消耗版本） | `packages/pipeline/src/run.ts:37-96`（`nextRunVersion` / `commitRun`）；`:108-117`（`abandonRun` 改名留现场） | `run/v<N>`；`gameId` 由清单派生；失败现场 `failed-<ts>` | `pipeline/tests/run.test.ts:15-99`（开/定稿/撞名原子抢/重试/放弃不消耗/`parseRunVersion`） | **E-01**：真实 create 落在 `run/v1`；无重复运行 E3 | `TESTED` | 单次运行；无并发真实验证；`nextRunVersion` 无锁（`run.ts:34` 自陈） | 无需行动 |
| Pack / Site / Config / Accept 版本只增不覆盖 | `pack.ts:250-333,1304`；`layout.ts:60,75-108`；`compile-runtime`/`compile-td-game` 的 `v<N>`；`acceptance.ts` 的版本分配 | `pack/v<N>`、`site/v<N>`、`game-configs/v<N>`、`td-configs/v<N>`、`acceptance/v<N>` | `pack.test.ts:77-87`；`site.test.ts:47-55`；`td-site.test.ts:47-54`；`compile-runtime.test.ts:115-122`；`compile-td-game.test.ts:137-143`；`acceptance.test.ts:452-479`；`cli.test.ts:352-368` | **E-01**：pack/site/config 同一 `v1`；**E-10**：accept v1；无版本冲突 E3 | `TESTED` | 真实运行没有“两次产物并存”的 E3；并发分配无锁（`pack.ts` 的 `.building-*` 只处理单进程） | 无需行动；并发写入需另立需求 |
| Playtest attempt 不可覆盖（`run/v<N>/playtest/v<K>`） | `cli/src/playtest.ts:180-190`（`nextAttemptVersion` 扫 max+1）；`:345-410`（新 attempt 目录、写回只改 qa-report） | `Playtest Attempt`：一旦创建不可覆盖 | `pipeline/tests/playtest.test.ts:88-138`（幂等/拒写/不改 result）；无 `nextAttemptVersion` 单测 | **E-03**：冻结 Demo `playtest/v1` 与 `v2` 并存；**E-05**：ticket-08 沙箱 `v1/v2/v3` 并存 | `E2E_VERIFIED` | 并发分配无锁；没有 runId/attempt nonce（票 06 §4）；单 Demo | 无需行动；并发需另立需求 |
| 历史交付保护（冻结证据、只读校验、git 边界） | `verify-delivery` 只读；`--out` 越界拒绝；证据目录不写；effort 冻结脚本 | 清单 + git + 文件权限 | `evidence-integrity.test.ts:458-464`；`cli/evidence.test.ts:99-105` | **E-08**：312 受保护文件零变化、git status 零改动；**E-09**：1,035 文件零变化；本票 git status 只有审计文件 | `E2E_VERIFIED` | 信任根是 git 固定清单；清单与证据一起改并提交无法发现；`*.log` 为 optional 不在信任边界内 | 无需行动；第二 Demo 另建清单 |
| 测试套件约束（整仓 `pnpm test`、`typecheck`、`test:evidence`） | `package.json:13-18`；`scripts/evidence-acceptance.mjs`；Vitest 配置 | `pnpm test` 不 build、不起浏览器；`test:playtest` / `test:acceptance` / `test:mechanic` 才起 Chrome；`test:evidence` 先 build | 本票：`pnpm typecheck` exit 0；`pnpm test` 两次非 0（超时）；隔离重跑 60/60 + 94/94；`test:evidence` 等价命令 exit 0 | **E-14**：`/tmp/p0-01c-*` 日志（本票临时，不入库）；**E-15**：历史 `2c1a9d5` 最终验收记录 `pnpm test` exit 0 / 149 文件 / 2231 用例 | `TESTED` | **本票没有复现整仓绿**：两次整仓运行分别 3 个用例、5 个用例 + 2 个 suite 超时；宿主负载高；隔离重跑全过；`cli-create` 依赖未入库 `dist/shell.js`；干净 clone 需先 build | 调查/固定超时与并行度；把 `dist/shell.js` 依赖显式化 |
| 并发版本分配 / 多进程写入 | `nextRunVersion` / `nextPackVersion` / `nextSiteVersion` / `nextAttemptVersion` 均为扫目录 max+1；只有 `commitRun` 用 rename 原子抢 | 无锁、无租约 | 无并发测试 | 无真实并发 E3 | `UNKNOWN` | 审计未做并发验证（票 03 §7-D20）；不在第二 Demo 的最小路径上 | 若需要并行生成，另立需求 |

---

## 3. 真实证据索引

> 证据 ID 在 §2 引用。每条都记录来源 commit、交付身份、适用场景。**历史 E3 不是 HEAD 重跑**；`E-09` / `E-14` 是本票审计时新产生的临时证据。

| ID | 证据路径 | 来源 commit | 身份 / 关键事实 | 适用场景 |
|---|---|---|---|---|
| **E-01** | `.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/create.log`；冻结副本 `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/{run,pack,site}/v1` | 运行 `040b907`；冻结 `5b8283f` | `command=create`、`EXIT=0`；pack v1 / site v1 / shell 2；manifest `sha256:a162942d…feb3`；config `sha256:455d9c7f…7dcd`；8 资源 / 4 图集 / 45 文件；ledger 22 次调用（analyze-reference/analyze-intent/compile-design/character-dna/plan-assets 各 1，master 2，image 12，drawlist 2，compile-runtime 1） | 输入、理解六步、规划、打包、链内 verify、配置、QA、站点装配；**不含 delivery 写回** |
| **E-02** | `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json`；`.scratch/fpvs-v1-final/acceptance/init-delivery.mjs` | 冻结 `5b8283f`；visual `f458beb`；聚合 `5f29592` | `qa-report` 的 `checked` 7/7；delivery 六项全 pass、verdict pass；`visualReview=pass`；**delivery 由 effort 脚本初始化，不是 `040b907` 原始 create 产出** | 交付信封语义、最终 verdict 关系；**不能证明当前 `buildAndSite` 的 delivery 写回** |
| **E-03** | `.../run/v1/playtest/v1/result.json`、`v2/result.json`、`site-integrity.json`、`chrome.log` | `5b8283f` | `playtest-report/v1`；harness/rules **v1**；`execution=executed`、`aggregate=SUCCESS`；`won=true`、`collected=6`、`chests=2`、`resets=0`；8/8 断言 pass；站点四文件 unchanged；identity pack v1/site v1/shell 2/config `455d9c7f…` | CLI playtest 准备/执行/观测/SUCCESS 归因/写回；**v1 only** |
| **E-04** | `.scratch/generic-playtest-v1/evidence/06-attempt-1/attempt-v1/result.json`、`06-attempt-2/...`、`06-reproducibility.json` | `5f29592` / `8e92c69` | harness/rules **v2**；同 identity；steps 452/451；`sameProjection=true`；`won=true`、`collected=6`、`chests=2`、`hits=0`；raw `outcome=null`（未归因） | harness v2 执行/观测/确定性；**不含 CLI 归因/写回** |
| **E-05** | `.scratch/playtest-v1/runs/2026-10-27-ticket-08/README.md`、`run-evidence.json`、`e2e-evidence/run/v1/playtest/v1..v3/result.json`、`.../qa-report.json` | 实现 `cf817c1`；证据入库 `6e99bf0` | 真实 Chrome；`AGENT_LIMITATION`；CLI exit 1；`playable-smoke=incomplete`；delivery `incomplete`；站点字节未改；QA 层保留；沙箱用 symlink 指向旧 pack/site | 非 SUCCESS 归因与写回；**沙箱，不是冻结交付的负向场景** |
| **E-06** | `.scratch/playtest-v1/runs/2026-10-27-ticket-09/promote.json`、`baselines/success-basic/baseline.json`、`playtest-with-baseline.json` | `e91d02e` | baseline `playtest-baseline/v1`；来源 report checksum `sha256:b8942403…bde1` / `sha256:9f34bffc…1d38`；promotedBy `amber`；后续 playtest 显示「与基线一致」 | baseline 晋升/比较；**沙箱基线，fixtures 无入库基线** |
| **E-07** | `.scratch/fpvs-v1-final/runs/2026-10-28-visual-review/review-record.json`、`capture.json`、`materials.json`、`shots/01..09.png`；`.scratch/generic-playtest-v1/evidence/09-review-record.supplement.json` | `f458beb`；补审 `8e92c69` | reviewer=`人（本次会话用户）`；6 项 + 4 项补审全 pass；9 张截图（8 个不同字节）；materials 44 条（17 源 + 27 生成）逐文件 sha；subject pack v1/site v1/shell 2/manifest `a162942d…`/config `455d9c7f…`；站点 unchanged；`snapshotZeroWrites=true` | 人工视觉记录、材料绑定、与 delivery 的关系；**不证明审核者独立/真实观看** |
| **E-08** | `.scratch/evidence-integrity-v1/runs/2026-10-29T05-04-57Z-final-acceptance/report.json`、`final-acceptance.md` | `2c1a9d5` | status pass / exit 0 / 1,546ms；223 文件（151 required / 72 optional）；13 records；11/11 identity；144/144 consistency；六项 match；diagnostics 0；清单 `sha256:ba7a485b…36fd`；312 个受保护文件零变化 | 冻结证据完整性；HEAD 生产代码的直接 E3 |
| **E-09** | 审计本地：`node scripts/evidence-acceptance.mjs --out /tmp/p0-01c-evidence-out`；报告 `/tmp/p0-01c-evidence-out/2026-10-29T08-13-34-399Z-delivery-verification/report.json` | 生产代码 `2c1a9d5`（HEAD `a495da0` 零生产 diff）；审计时间 2026-10-29 | `pnpm build` exit 0 后运行；status pass / exit 0 / 3,011ms；223/151/72；13 records；六项 match；diagnostics 0；清单 `ba7a485b…`；**1,035 个受保护文件运行前后 sha256 零变化**；输出只在 `/tmp` | 本票独立重跑 `verify-delivery` 正例 + 只读性；**临时路径，不入库** |
| **E-10** | `.scratch/p0-construction-v1/runs/2026-10-22-final/accept-v7/ruin-scavenger-extraction-assets/acceptance/v1/report.json`、`report.md` | `c619d84` | `animation-acceptance/v1`；pack `ruin-scavenger-extraction-assets` v7；manifest `sha256:e620cd7e…8326`；`findings=[]`；`baseline=null` | `accept` 结构验收；**旧独立包，不是 wasteland Demo** |
| **E-11** | `.scratch/game-maker-v2/experiments/72-two-shell-size/{README.md,readout-td.json,readout-landscape.json,run-output.txt,shot-td.png}` | `d3e9137` | fixture `fixtures/packs/counter-siege/v4` + `fixtures/td-configs/counter-siege.json`；site v1；真实 Chrome；Canvas 回退 `canNine=false`；`hud.start` 声明 28×22、实际画 44.5×22.5、右边缘出屏 | TD 站点装配/渲染；**不是 compile 产物、不是通关证据** |
| **E-12** | `.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/smoke3.log`、`smoke3/summary-positive.json`、`smoke3/chrome.log` | `040b907` | Chrome/155.0.8059.86；HTTP `http://127.0.0.1:54116/site/v1/index.html`；`playable` 场景 `ok=false`、stage `navigate`、45s 超时、`x=79.0 collected=1/4 won=false`；两个 hazard 场景也失败 | 站点启动/真实浏览器；**核心循环未通过**（后续 playtest 才通关） |
| **E-13** | `.scratch/evidence-integrity-v1/runs/2026-10-29T05-04-57Z-final-acceptance/acceptance/mechanic-coverage.json`、`free-acceptance.json` | `2c1a9d5` | `mechanic-coverage/v1`；8 条机制；`verdict=satisfied`；`qa=satisfied`：collect-pickup/open-chest/avoid-danger；`qa=not-tested`：run/jump/gravity/collide-terrain/reach-goal；free-acceptance `allOk=true`；**`avoid-danger` 的 satisfied 不是交付中的真实触发**（冻结 config 无 danger 实体，票 05 §0-4） | 机制覆盖报告/真实 probe 结果；**未在本票重跑** |
| **E-14** | 审计本地 `/tmp/p0-01c-pnpm-test.log`、`/tmp/p0-01c-pnpm-test-2.log`、`/tmp/p0-01c-retry3.log`、`/tmp/p0-01c-retry2.log`、`/tmp/p0-01c-typecheck.log`、`/tmp/p0-01c-build.log`、`/tmp/p0-01c-test-evidence.log` | 生产代码 `2c1a9d5`；HEAD `a495da0` | 整仓 `pnpm test` 两次 exit 1（第一次 149 文件/2231 用例，3 用例超时；第二次 149 文件/2191 用例，5 用例 + 2 suite 超时）；隔离重跑 60/60、94/94 pass；`typecheck` exit 0；`build` exit 0；`test:evidence` 等价命令 exit 0 | 测试约束/环境稳定性；**临时路径，不入库** |
| **E-15** | `.scratch/evidence-integrity-v1/runs/2026-10-29T05-04-57Z-final-acceptance/final-acceptance.md` | `2c1a9d5` | 历史记录：`pnpm test` exit 0、149 文件/2231 用例；`typecheck` exit 0；`test:playtest` exit 0（10 文件/143 用例）；`test:acceptance` exit 0；`test:evidence` exit 0 | 历史回归记录；**本票未复跑整仓** |


**清单边界**：E-08 / E-09 的冻结清单只覆盖其 9 个 roots（`out` / `snapshot` / `reference` / `artifacts` / `fa04` / `fa05` / `fa06` / `runs` / `gp`），因此 **E-01 的冻结副本（work/snapshot）、E-02 的 qa-report、E-03、E-04、E-07 在清单内**（清单 sha `ba7a485b…` 对它们成立）；**E-01 的原始 create.log、E-02 的 init-delivery.mjs、E-05、E-06、E-10、E-11、E-12、E-13 不在该清单内**，只能靠各自路径、来源 commit 与记录使用，不能引用 `ba7a485b…` 作为它们的哈希保证。清单只证明「自冻结后未变」，不证明「运行确实发生」。

---

## 4. `UNKNOWN` / `BLOCKED` 清单

### 4.1 `UNKNOWN`（4 行）

| 行 | 缺什么 | 为什么现在不能判 | 最小解除代价 |
|---|---|---|---|
| D6-5 TD 玩家控制 + 目标达成 | 真实浏览器里的 TD 通关/失败运行 | 只有 `td-sim` 单测与 reference player；`experiments/72` 是渲染探针，不是 gameplay | 起真实 Chrome 跑一次 TD 试玩；但 TD 无 delivery/playtest，需要先补交付闭环 |
| D8-5 人工视觉的独立性与可重复性 | 第二个交付的人工审核、审核者身份/独立性证据 | 只有一次记录，reviewer 是自由字符串；机器不重判 | 第二 Demo 重新做人工审核，并把 record/materials 纳入交付绑定 |
| D9-5 期望哈希清单的生产入口 | 生产 CLI/MCP 的清单生成/更新能力 | 只有 `.scratch` effort 工具，`packages/` 无引用 | 另立需求，明确是否把清单生成纳入生产；否则把它固定为审计工具 |
| D10-6 并发版本分配/多进程写入 | 并发真实运行/测试 | 审计未做并发验证（票 03 §7-D20 明确不做） | 若第二 Demo 需要并行生成，另立需求并补锁/租约 |

### 4.2 `BLOCKED`（0）

本次没有因为权限、不可读、环境限制而无法核实的检查项。所有声明的证据路径都可读；所有需要的判断要么有 E1/E2，要么明确标 `UNKNOWN`。

---

## 5. 审计限制

1. **只读边界**：未运行 `create` / `build` / `plan` / `pack` / `compile-*` / `playtest` / 整条 `test:playtest` / `review` / `review-verdict` / `playtest-baseline` / 浏览器探针 / `pnpm install`；未写历史/受跟踪目录；未提交/推送。只改了本文件与票 04。
2. **真实 E3 不是 HEAD 重跑**：`E-01` 生成于 `040b907`；`E-03`/`E-07` 产生于 `5b8283f`；`E-04` 产生于 `5f29592`/`8e92c69`；`E-05` 是 `cf817c1` 的沙箱；`E-10` 是 `c619d84` 的旧包；`E-11` 是 `d3e9137` 的 fixture。只有 `E-08`/`E-09` 是 `2c1a9d5` 生产代码的直接证据。**历史 E3 只证明其来源 commit + 交付身份 + 实际覆盖场景。**
3. **单 Demo**：除 `E-10`（旧独立包）与 `E-11`（TD fixture）外，所有 E3 都落在 `wasteland-scavenger-recipe` v1 一个横版 Demo、一个 site v1、一个平台玩法、一个设计样本上。不能外推为“管线普遍支持新玩法”。
4. **测试环境不稳**：本票两次整仓 `pnpm test` 都因 5s/120s 超时非 0；隔离重跑全过。宿主负载（`collect` 最长 804s）明显影响结果；**本票没有在审计环境复现整仓绿**。历史 `E-15` 记录整仓绿，但那是记录而非本票复跑。`cli-create` 依赖未入库 `packages/demo/dist/shell.js`，干净 clone 跑 `pnpm test` 不保证成立。
5. **没有浏览器探针**：本票未启动 Chrome，因此 Playtest / TD 渲染 / 视觉截图全部是历史 E3；没有新增行为观测。
6. **没有付费调用**：`review` 等付费诊断没有真实 E3；本票未运行。
7. **符号链接/路径测试在 macOS 验证**；Windows 未验证。`test:evidence` 耗时是机器相关读数，不作为性能门槛。
8. **人工视觉**：本审计只读记录，无法独立确认“人确实看了”；该结论按记录/流程声明处理，不升级为机器事实。
9. **行号以 `2c1a9d5` 为准**；当前 HEAD `a495da0` 的生产代码 diff 为空。
