# 阶段 A 事实快照（2026-10-29）

> 来源：三组只读探查（冻结 Demo/Playtest、覆盖门禁/hazard、delivery/清单），仓库 HEAD `f0411e6`。
> 本文件只记录事实与 file:line，不做决策；决策见票 02–07。
> 未运行任何写产物命令；未读取本地凭据。

## 0. 基线

- 生产代码 HEAD：`f0411e676309fede8f20b79d9f8e44e5ac479ef6`（`main`），工作区干净。
- 旧 P0-02 基线 `4f3bc69`、P0-01 基线 `2c1a9d5`；`4f3bc69..f0411e6` 对 `packages/**`、根配置与 lockfile 的 diff 为空。
- 冻结只读快照：`.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/`（66 文件，`chmod -R a-w`）。
- 旧可写工作副本：`.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/`（95 文件；含 `run/v1/playtest/v1`、`v2`，`qa-report.json` 有 `delivery.verdict=pass`）。
- 原始 p0 来源：`.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/wasteland-scavenger-recipe/`（可写，`qa-report` 无 `delivery`）。
- 冻结脚本与身份：`.scratch/fpvs-v1-final/freeze.mjs:13-18,113,158`；`.scratch/fpvs-v1-final/artifacts/identity.json`（`fpvs-final-identity/v1`，`:23-47`）；`artifacts/hashes.json`（80 条）。

## 1. 冻结 Demo 身份与可运行性

- 身份文件：`pack/v1/manifest.json`（`id=wasteland-scavenger-recipe`、`version=1`）、`pack/v1/ledger.json`、`pack/v1/coverage.json`、`site/v1/site.json`（`shell=2`、`pack=v1`、`config=game-config.json`）、`run/v1/game-config.json`（与 site 配置逐字节相同，sha256 `455d9c7f…`）。
- `delivery` 是 `run/v1/qa-report.json` 的可选子对象；只读快照与 p0 来源的 qa-report **没有 `delivery`**，CLI playtest 准备阶段会拒（`packages/cli/src/playtest.ts:116-117`）。
- 旧 work 的 qa-report 有 `delivery`：`verdict=pass`、`site={version:1,shell:"2"}`、`playtest.report=…/playtest/v2/result.json`。
- 因此：**只有带 `delivery` 的可写副本能进 CLI playtest**；冻结快照本身不能直接跑。

## 2. Playtest：版本、写回、身份、失败重跑

- 不存在字面意义的「Playtest CLI v2」；CLI 仍是 Playtest V1 命令。v2 指 `harnessVersion` / `rulesVersion`：
  `packages/contracts/src/playtest.ts:19-24`（report v1、scenario v1、harness v2、rules v2）。
- CLI 入口：`packages/cli/src/cli.ts:765-776`；执行层 `packages/cli/src/playtest.ts:345-448`；默认场景目录常量 `:23`。
- 写回层：`packages/pipeline/src/playtest.ts:27-76`；读 qa-report `:33-40`；身份校验 `:51-62`；只改 `delivery.playtest`、`playable-smoke`、`verdict` `:64-70`。
- 纯函数合并：`packages/contracts/src/delivery.ts:317-350`；身份校验 `:326-331`；替换 `playable-smoke` `:333-337`；**删除旧 `playtest-*` 证据再追加本次** `:337-341`。
- 报告身份字段由 harness 写入 `result.json`：`scenarioFormatVersion`、`siteVersion`、`packId`、`packVersion`、`packChecksum`、`configChecksum`、`shellVersion`、`harnessVersion`、`rulesVersion`（`packages/demo/probe/playtest/runner.mjs:343-353`）。
- 写回只校验部分身份：config checksum `packages/pipeline/src/playtest.ts:56-59`；pack checksum `:60-62`；pack/site/shell `packages/contracts/src/delivery.ts:326-331`。**harness/rules 只记录、不与常量比较**（常量 `packages/contracts/src/playtest.ts:23-24`；CLI import 了但未使用 `packages/cli/src/playtest.ts:12`）。
- 失败重跑：
  - attempt 目录递增、不覆盖：`packages/cli/src/playtest.ts:178-186,367,385,397-399`。
  - harness 无可解析 `result.json`：只写 `harness-error.json` 并抛错，**qa-report 不动**，旧 pass 保留（`:377-387`）。
  - 有可解析报告（含失败/UNKNOWN）：照常写回，旧 `playtest-*` 证据引用被移除，`playable-smoke` 与 verdict 重算并降级（`packages/contracts/src/delivery.ts:337-352`）。
  - 准备拒绝只写 `playtest/rejections/*.json`，不触碰旧 delivery（`packages/cli/src/playtest.ts:170-176,350-365`）。
  - 写回失败写 `writeback-error.json`，不改 `result.json`（`packages/pipeline/src/playtest.ts:79-96`）。
- 现有测试没有覆盖「旧 pass → 新失败 attempt」；`applyPlaytest` 测试基线是 `checks("incomplete")`（`packages/contracts/tests/playtest.test.ts:270-297`）。

## 3. 默认 Playtest 场景与 `--scenario-dir`

- 默认五态目录：`packages/demo/probe/playtest/scenarios/five-state/`。
- `success-basic.json` 是唯一 `required:true` + `harnessCondition:"none"` 的场景：
  - `target.siteVersion=1`（`:8-10`）；`initialActivePickups == 4`（`:32-44`，值在 `:41`）；`collected == 6`（`:47-59`，值在 `:56`）；`won == true`（`:62-74`）。
  - 动作：`move_to gate` + `wait_until won`（`:16-27`）。
- `failure-missing-pickup.json`：`required:false`、`setup.remove-pickup index 0`、`initialActivePickups == 4`。
- `--scenario-dir` 解析：`packages/cli/src/cli.ts:130,769-770`；`packages/cli/src/playtest.ts:348,162`。
- 选择规则：只收 `harnessCondition === "none"`（`:90`）且 `required === true`（`:92`）且 `siteVersion` 匹配实际 site（`:93-95`）；否则 exit 4。
- 场景 schema：`playtest-scenario/v1`，`packages/contracts/src/playtest.ts:392-428`；`setup` 枚举含 `none | remove-pickup | mutate-hazard`（`:370-390`）。
- FPVS 验收场景实例：`.scratch/fpvs-v1-final/scenarios/acceptance/acceptance-win-wasteland-v1.json`（`required:true`、`siteVersion:1`、断言 `initialActivePickups==4`、`collected==6`、`chestsOpened==2` 等）。

## 4. 覆盖门禁：只读 design、不核 config、不落盘

- 契约：`mechanic-coverage/v1`，`packages/contracts/src/mechanic-coverage.ts:29,38-51`；条目 `{mechanic, design, runtime, qa}`；probe 入参 `{mechanic, passed}` `:57`。
- 生成函数 `buildMechanicCoverage(design, probeResults = [])`：`:74-101`。
  - 唯一读 `design.mechanics`：`:83`。
  - `probeResults` 为空时 `defaultProbed` 把 `QA_PROBED_MECHANICS` 全当 `passed`：`:79-81`。
  - 门禁只在 design/runtime 非 satisfied 或 qa failed 时阻断；`not-tested` 不阻断：`:59-65`。
- 生产调用：`packages/pipeline/src/create-game.ts:644-650`；`buildMechanicCoverage(designParsed.data)` **不传 probe**（`:647`）。
- `QA_PROBED_MECHANICS` 是 `collect-pickup / open-chest / avoid-danger`（`packages/contracts/src/vocabulary.ts:114-118`）；**不含 `hazard-contact`**。
- 覆盖报告**生产不落盘**：`create-game.ts` 只写 `qa-report.json`（`:634-635`）；`RUN_ARTIFACT` 无覆盖报告（`packages/pipeline/src/artifacts.ts:14-28`）；`qa-report` schema 无该字段（`packages/contracts/src/qa.ts:283-305`，strict）。
- 只有免费验收脚本落盘：`packages/demo/probe/free-acceptance.mjs:90` 写 `<out>/mechanic-coverage.json`。
- 契约影响：
  - 新增独立 `run/vN/mechanic-coverage.json`：不改 `qa-report` schema，但属于运行产物清单的加性变更；证据清单必须显式列出才会被核验。
  - 在 `qa-report.json` 顶层加字段：`QAReportSchema` 是 `z.strictObject`，旧解析器会拒未知键。
  - 扩 `mechanic-coverage/v1` 条目（如加 config 层）：schema strict，属于带版本号的契约变更。

## 5. Probe、hazard、avoid-danger

- Probe 脚本：`packages/demo/probe/mechanic-probe.mjs`；定义表 `:94-175` 只有 `collect-pickup`、`open-chest`、`avoid-danger`；**没有 `hazard-contact`**。
- Probe 结果形状：`{mechanicId, passed, failures[], durationMs, out, samples?}`（`:244-263`）；summary `:282`。
- `READ_STATE`：`packages/demo/probe/probe-harness.mjs:207-262`；`hazards` 只有几何/相位（`:228-240`），**无命中计数**；`dangers` 有 `{state,hits,...}`（`:246-257`）。
- 运行时：`hazard` overlap → `hitHazard()`（`packages/demo/src/shell/scene.ts:157-161`）；`hitHazard` 只 `body.reset` 回出生点（`:352-359`），**不计数、不发事件**。`danger` 每帧 `advanceDangers`，active 窗口命中时 `d.hits += 1` 并复用 `hitHazard()`（`:284-306`，`hits` 在 `:302`）。
- Playtest 事件闭集含 `danger-hit / danger-erupt / reset`，**不含 `hazard-hit`**：`packages/contracts/src/playtest.ts:69-75`；`runner.mjs:23`；`observe.mjs:24`。`danger-hit` 由 `hits` 差推导（`observe.mjs:104-108`），`reset` 由位置突变推导（`:111-115`）。
- 证据完整性只做否定断言：`eventCounts["danger-hit"]` 必须为 0（`packages/pipeline/src/evidence-integrity.ts:856-859`）。
- 冻结 config：2 个 `hazard`（`patroller-1`、`patroller-2`），**0 个 `danger`**（`.scratch/fpvs-v1-final/artifacts/.../run/v1/game-config.json:45-61,100-115`）；设计声明了 `avoid-danger`（`run/v1/game-design.json:89-93`），但 config 无可触发对象。
- 设计 `mechanics[]` 未声明 `hazard-contact`（仅 run/jump/collect-pickup/open-chest/avoid-danger）。
- 现有 hazard 测试：`packages/demo/tests/shell-mechanic-witness.test.ts:30`（needle `this.hitHazard()`，danger 分支也调用，判别力不足）；`shell-scene-wiring.test.ts:43-58`（源码文本判据）；`hazard.test.ts:10-32`（锚点/相位）；`self-test.mjs:77,171-207`（猴子补丁旧实现，不是当前实现正向用例）。
- 结论：`hazard-contact` 既无 probe、也无运行时命中事件；`avoid-danger` 只靠合成 probe 拿绿，冻结交付无可触发对象。

## 6. Delivery 身份、review-verdict、失败重跑

- `DeliveryCheckStatus`：`pass/fail/incomplete/blocked/not-required`（`packages/contracts/src/delivery.ts:26-27`）；`DeliveryVerdict`：`pass/fail/incomplete/blocked`（`:29-30`）；优先级 `fail > blocked > incomplete > pass`（`:46-56`）。
- 六项检查 `asset-pack/config/qa/site/playable-smoke/visual-review`（`:79-101`）；报告 schema `:135-229`。
- `delivery` 身份只有 `runId`、`pack{packId,packVersion,manifestChecksum?}`、`config{file}`、可选 `site{version,shell}`（`:136-150`）；**没有 harness/rules**。
- `delivery` 是 `qa-report/v1` 的可选子对象（`packages/contracts/src/qa.ts:283-304`）；实际写入 `run/vN/qa-report.json`（`packages/pipeline/src/artifacts.ts:23-24`、`packages/pipeline/src/delivery.ts:118-128`）。
- `review-verdict` CLI：入口 `packages/cli/src/cli.ts:784-818`；只校验 run 目录形状 `/v\d+$/`（`:790-793`）、`qa-report.json` 存在（`:794-796`）、`--verdict` 只能是 `pass|fail`（`:797-799`）。**不校验截图、不校验材料、不校验 Demo 身份**。
- 视觉写回：`packages/pipeline/src/delivery.ts:153-170`；无 delivery 时初始化 `:174-198`；`applyVisualReview` 只改 `visualReview`、`visual-review`、verdict（`packages/contracts/src/delivery.ts:293-307`）。
- 现有测试：`packages/cli/tests/review-verdict.test.ts:48-96`（pass/fail/非法 runDir/缺报告/非法 verdict/跨 run 不继承）；`packages/pipeline/tests/delivery.test.ts:172-236`（只动三处/缺 delivery 初始化/无 subject 拒绝/原子替换）。

## 7. 证据清单与 `verify-delivery`

- 清单 schema 已在 `packages/pipeline/src/evidence-integrity.ts:50-111`（`ManifestSubjectSchema` `:72-80`；`EvidenceManifestSchema` `:82-111`）。
- 清单生成器只在 effort：`.scratch/evidence-integrity-v1/tools/build-manifest.mjs`。roots 写死 `:23-33`，文件规则写死 `:72-130`，records 写死 `:166-180`，`generatedBy` 自报 effort 路径 `:185`；默认拒绝覆盖、`--force` 才重建 `:193-196`。
- `packages/` 与根 `package.json` **没有**引用该脚本。
- `verify-delivery` CLI 已存在：`packages/cli/src/cli.ts:820-829`；`packages/cli/src/evidence.ts:15-63`；核心 `packages/pipeline/src/evidence-integrity.ts:1177-1289`；`--out` 越界拒绝 `:1132-1151`；报告原子目录 `:1154-1175`；退出码 `:1224-1280`。
- MCP 没有 `verify-delivery`；报告 limitations 明写不做 MCP 镜像（`evidence-integrity.ts:1285`）。
- 结论：**缺的是 `packages/pipeline` 内参数化清单生成器 + CLI 薄壳 + 测试**；只搬 effort 脚本仍不算生产路径。

## 8. 测试与证据缺口

- 覆盖门禁：`packages/contracts/tests/mechanic-coverage.test.ts:19,30,44,54,62,69`；**没有** pipeline/CLI 集成测试断言 `create-game.ts:647` 的调用或覆盖报告落盘。
- Probe：无直接 vitest；`packages/demo/probe/playtest/tests/danger-forms.test.mjs:212-250`、`observe.test.mjs:23-44`、`policy.test.mjs:34-169` 覆盖 harness/策略，不是 `mechanic-probe.mjs` 本身。
- Playtest 写回：`packages/pipeline/tests/playtest.test.ts:88-145`（成功/幂等/身份不匹配/config 不匹配/写回失败/无 delivery）；`packages/contracts/tests/playtest.test.ts:265-344`（pass/fail/身份/缺结果/UNKNOWN）；**没有**旧 pass → 失败重跑的用例。
- 默认场景：`packages/cli/tests/playtest-scenario-dir.test.ts:55-97`（默认仍只选 success-basic/required 筛选/空目录/schema/siteVersion 不匹配）；`packages/cli/tests/cli.test.ts:64`（`--scenario-dir` 参数）。
- 清单生成：**没有生产测试**；只有 fixture 手工拼清单（`packages/pipeline/tests/evidence-integrity.test.ts:98,239-251`；`packages/cli/tests/evidence.test.ts:20-43`）。
- `verify-delivery`：`packages/cli/tests/evidence.test.ts:49-104`；核心负向 18 例在 `packages/pipeline/tests/evidence-integrity.test.ts:281-467`。
- `pnpm test:evidence` 默认写旧 effort `.scratch/evidence-integrity-v1/runs`；阶段 A 必须用 `--out` 指向本 effort。

## 9. 零付费与写入面

- playtest 零付费：CLI 只传 `outRoot/runDirInput/scenarioDir`（`packages/cli/src/cli.ts:765-776`）；本地 Chrome/CDP + 本地 HTTP（`probe-harness.mjs:106-160,431`）；无模型调用。
- 在本 effort 可写副本上运行会写：`run/v1/playtest/v<K>/`（result/site-integrity/chrome.log/harness-* 等）、`playtest/rejections/*.json`（准备拒绝）、`writeback-error.json`（写回失败）、`qa-report.json`（原子重写）。
- 不会改 pack/site/config：harness 只读站点并前后比对（`runner.mjs:440-445,482-485`）；准备阶段校验 checksum（`cli/src/playtest.ts:142-158`）。
- 不会改冻结快照/旧 work（只要 `--out` 指向本 effort 副本）；不会改 p0 历史源。
- 需要 `pnpm build`（写 `.gitignore` 的 `dist/`、`*.tsbuildinfo`）；系统 Chrome 可用。
