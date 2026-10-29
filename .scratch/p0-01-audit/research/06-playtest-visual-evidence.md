# P0-01E · Playtest、人工视觉与证据完整性（只读审计）

| 属性 | 值 |
|---|---|
| 审计基线 | 生产代码 `2c1a9d5`（`2c1a9d55c1ac94bc5271318514897b9485587bec`，分支 `main`）；审计时 HEAD `a495da0`，`git diff 2c1a9d5..a495da0 -- packages/` 为空 |
| 工作区 | 仅本 effort 的 `.scratch/p0-01-audit/**` 与未跟踪 `docs/v7.6/管线.md`；本票未修改生产代码/契约/测试/历史证据 |
| 审计方式 | 只读 shell（`git` / `rg` / `find` / `sed` / `node -e`）；在 HEAD 运行 5 个离线测试文件（仅写 `mkdtemp`）：90/90 pass；未运行 `playtest`、未运行 `test:playtest`、未启动浏览器、未构建、未写历史目录 |
| 输入 | 本票 `.scratch/p0-01-audit/issues/06-playtest-visual-evidence.md`；`docs/v7.6/管线.md` §P0-01E；`CONTEXT.md` 的 Playtest V1 术语 |
| 证据分级 | E1 源码 · E2 自动化测试 · E3 历史真实产物/运行证据（均注明来源 commit 与适用边界） |
| 词汇权威 | `CONTEXT.md`：Playtest / Playtest Attempt / Runtime Observation / Runtime Event Log / Playtest Outcome / InsufficientEvidence / Evidence / DeliveryCheckStatus / DeliveryVerdict |

> 本票只核实事实与边界。发现的问题作为审计线索记录，不在本轮修复；不把历史报告当成当前 HEAD 的直接证明。

---

## 0. 结论先行

1. **Playtest 确实执行真实浏览器操作**：系统 Chrome（`--headless=new`）+ CDP 远程调试 + 本地只读 HTTP 服务 + 真实键盘事件；状态由注入的只读探针读取，不写站点字节。E3 有两类：交付内 CLI 写出的 v1/v2 两次运行（harness/rules **v1**），以及 `06-attempt-1/2` 直接调 harness 的 v2 两次运行（未归因）。当前 HEAD 的 **v2 CLI 写回没有 E3**。
2. **关键状态是轮询快照 + 状态差推导事件**，不是帧级事件日志。采样间隔约 `stepDelayMs=35ms` + CDP 往返；同一窗口内发生又消失的瞬时事件**结构性可能漏采**。`state` 读不到（返回 `null`）会被记成 gap 并强制相关断言 `unknown`；但两次**成功**读取之间漏掉的事件不会留下 gap 标记，事件计数等式断言理论上可能把“没采到”读成“没发生”。累计量（collected/won/chests/hits）单调，较稳；spawn/jump/land/reset 是推断事件。
3. **结果分类完整**：五态 `SUCCESS / GAMEPLAY_FAILURE / ENVIRONMENT_FAILURE / AGENT_LIMITATION / TIMEOUT` + `UNKNOWN`（归因不成立）+ `not-executed`（执行资格，不是 outcome）。归因是纯函数，按阶段与环境健康前置门决策；断言 `fail` 不自动升级为玩法失败。E2 覆盖 19 个归因用例；**真实 E3 只有 SUCCESS**；交付命令默认只要求一个 happy-path 场景，失败/限制/超时/环境故障状态只由 E2 证明。
4. **报告身份绑定到版本 + 校验和层**：`identity` 含 site 版本、pack id/version/manifest checksum、config checksum、shell 版本、harness/rules 版本、场景格式版本；CLI 准备阶段六项校验把 run/site/pack/config/delivery 对齐，写回层再复核。缺口：没有 gameId/runId/attempt nonce；site 只绑定版本与 config 字节，index.html/shell.js 的字节由独立 `site-integrity.json` 记录；**harness/rules 版本只记录、不在写回或验收时强制等于当前常量**。
5. **人工视觉有独立记录，且与冻结交付身份匹配**：`review-record.json`（6 项全 pass）、`capture.json`（站点前后哈希不变）、`materials.json`（44 条材料）、`09-review-record.supplement.json`（4 项补审、明确 8 个不同画面而非 9 个）。验收器 11 条身份记录全 verified，视觉记录 subject 六字段与清单 subject 一致。**但 `verify-delivery` 只校验记录完整性/身份/材料集合/与 `delivery.visualReview` 一致，不重判人工结论**；`review-verdict` CLI 本身只检查 run 形状与报告存在，不检查截图或身份。
6. **`verify-delivery` 验证的是“相对冻结清单的当前证据”**：清单 schema、双端 realpath 路径安全、文件哈希/字节、记录解析、六字段身份、三方自述哈希、站点完整性、报告引用、截图/材料、playtest 摘要/两次 attempt/投影、六项检查由证据重导出、declared vs recomputed、verdict。它**不构建、不跑 QA、不启动浏览器**；信任根是 git 固定的清单，发现不了“清单与被验证据一起改并提交”。
7. **缺失或身份不一致时确实拒绝 pass**：必需文件缺失/不可读 → blocked；哈希不符、身份 mismatch、引用错、声明与重算不符 → fail；视觉/playtest 记录缺失 → blocked；exit 0 只在 pass。**但生产路径有两个残留口**：playtest 准备拒绝或 harness 无 `result.json` 时不改旧 delivery（旧 pass 仍在），只有 CLI 退出码表达失败；`review-verdict` 不校验材料身份。
8. **负向测试在验收器层很强，在 CLI playtest 准备层和视觉绑定层偏弱**：18 个 pipeline 验收用例 + 6 个 CLI 用例覆盖篡改/缺失/不可读/身份/三方/路径五类/引用错 attempt/材料集合/结论过期/只读性/确定性；`playtest` 的六项准备校验没有 CLI 级测试；验收器没有“视觉记录非全 pass”“playtest 摘要与重投影不一致”“harness/rules 版本不符”的负向用例。

---

## 1. Playtest 是否执行真实浏览器操作

**结论：是。** 不是 headless DOM 模拟、不是假时钟、不是对 `shell.js` 的单测替身。

| 事实 | 证据 |
|---|---|
| 查找系统 Chrome（`CHROME_BIN` / macOS / Linux 路径），找不到即 `StageError('browser')`，不静默跳过 | `packages/demo/probe/probe-harness.mjs:77-89` |
| `--headless=new`、`--disable-gpu`、`--remote-debugging-port=0`、独立临时 profile | `packages/demo/probe/probe-harness.mjs:91-104`、`:106-163` |
| 从 `DevToolsActivePort` 取端口，`/json/list` 取 page target，WebSocket CDP 连接 | `probe-harness.mjs:106-204` |
| 本地 HTTP 服务只读服务 `gameRoot`，`Cache-Control: no-store`，拒绝越出 root 的路径 | `probe-harness.mjs:431-460` |
| `Page.navigate` 到实际 `site/vN/index.html`；`Page.enable` / `Runtime.enable` / 注入 `PHASER_HOOK` | `packages/demo/probe/playtest/runner.mjs:397-407` |
| 真实按键：`Input.dispatchKeyEvent` 发 ArrowRight / Space（keyDown/keyUp） | `probe-harness.mjs:365-380`；`runner.mjs:120-145` |
| 站点字节零改动：运行前后对 `index.html/shell.js/site.json/game-config.json` 取 sha256，写 `site-integrity.json` | `runner.mjs:462-470` |
| E3：交付内 `playtest/v1`、`v2` 的 `command` 含 `playtest.mjs --site ... --scenario-dir .../.tmp-.../scenarios`，与 CLI 的 workRoot 形状一致；`chrome.log`、`events/trace/input/console/exceptions` 齐全 | `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/playtest/{v1,v2}/`（来源 `5b8283f`） |
| E3：`06-attempt-1/2` 直接调 harness 的 v2 运行，raw `result.json` 无 `outcome/aggregate`（未归因） | `.scratch/generic-playtest-v1/evidence/06-attempt-{1,2}/attempt-v1/result.json`（来源 `8e92c69`） |

**边界**：
- 只支持 Phaser 外壳（`window.__gmGame` + `scene('shell')` 字段）；换引擎/改字段名会 boot 失败，归因走环境故障/UNKNOWN，而不是判游戏失败。
- 依赖系统 Chrome、Node 22、已构建的 `packages/demo/dist`（`dist/shell.js` 未入库，`.gitignore`）；干净 checkout 必须先 `pnpm build`。
- harness 不产截图；视觉截图来自独立的 effort 脚本（`.scratch/fpvs-v1-final/runs/2026-10-28-visual-review/capture.mjs` + `Page.captureScreenshot`），不在 Playtest 交付证据里。
- 当前 HEAD 的 `playtest` CLI 写回（rules v2）没有 E3；冻结交付里的报告是 **harness v1 / rules v1**。v2 只有 harness 直跑观测，未经过 `attributeReport` 与 `writePlaytestToReport`。

---

## 2. 关键游戏状态如何采集，瞬时事件是否可能遗漏

**采集方式**：CDP `Runtime.evaluate(READ_STATE)` 轮询。探针只读场景上已存在的字段：

- 玩家：`x/y/bottom/top/left/right/width/height/vx/vy/onFloor/blockedRight/touchingRight`
- 计数/终态：`collected`、`won`
- 实体：`pickups[] {x,y,active,visible}`、`chests[] {x,y,opened}`、`hazards[] {轴、行程、周期、盒几何}`、`dangers[] {state,hits,periodMs,activeMs,t,打击盒}`、`gate`、`solids`、`scrollX`
- 页面错误：CDP `Runtime.consoleAPICalled` / `Runtime.exceptionThrown`（`probe-harness.mjs:298-340`），`consoleErrors` 只取 `type==='error'` 并忽略 favicon（`:422-424`）

**事件是状态差的边，不是埋点**（`observe.mjs:1-8`、`:96-170`）：

| 事件 | 判定 | 可靠性 |
|---|---|---|
| `scene-ready` / `spawn` | 第一次读到状态 | `spawn` 带 `inferred:true` |
| `pickup` | 前后 `active` 由 true→false；同窗口多个标 `ambiguous:true` | 计数是 delta，顺序不可判 |
| `chest-open` | `opened` false→true | 持久标志，较稳 |
| `win` | `won` false→true | 持久标志 |
| `danger-hit` / `danger-erupt` | `hits` 增量 / `state` 进入 active | `hits` 单调，计数较稳；起止同窗口会漏 |
| `land` / `jump` | `onFloor` 翻转 | 纯推断；短于采样窗口会漏 |
| `reset` | `st.x < prev.x-150` 且回到出生点附近 | 启发式，阈值外漏判 |
| `runtime-error` | CDP 实际捕获的 console.error / exception，`source:"cdp"` | 与轮询无关，较可靠 |

**瞬时事件风险（已验证的结构性限制）**：
- 采样节奏是 `scenario.stepDelayMs`（默认 35ms）+ 每次 CDP 往返（`runner.mjs:168-198`、`:226-244`）；报告里的 `runtime.pollIntervalMs: 50` 是声明值，**实际观测循环不读它**（`runner.mjs:360-362`）。
- 如果一次读取返回 `null`（状态不可读），`markGap` 写 `trace.jsonl` 的 gap；相关断言在存在 gap 时被降为 `unknown`（`observe.mjs:174-201`；E2 `tests/observe.test.mjs:108-114`）。这是“没看到 ≠ 没发生”的显式门。
- 但两次**成功**读取之间发生并消失的事件不会留下 gap。事件计数 `eq` 断言可能在“实际发生但漏采”时得到 `fail`，而不是 `unknown`；`gte` 是单调下界仍可判。关键交付场景（`success-basic`/冻结 acceptance）主要用累计状态 `collected/won`，降低了这一风险，但没有消除。
- 归因器把任何 gap 都视为 `structuralUndecidable`，与超时同时存在时 `UNKNOWN` 优先（`contracts/src/playtest-attribution.ts:176-179`）；这是保守方向，不会把漏采读成 pass。

---

## 3. 结果分类是否区分玩法失败、环境故障、执行器限制、超时和未知

**结论：区分完整，且是纯函数决策；但真实 E3 只覆盖 SUCCESS。**

`packages/contracts/src/playtest-attribution.ts`：

| 结果 | 触发（摘要） | 证据/测试 |
|---|---|---|
| `ENVIRONMENT_FAILURE` | 环境健康前置门失败：Chrome 不可用、场景未 ready、资源加载/网络/CORS/WebGL 类错误；或准备阶段有具体环境故障 | `attribute`（`:99-119`）、`envFailure`（`:90-96`）；`playtest-attribution.test.ts:70-86,122-140` |
| `GAMEPLAY_FAILURE` | 仅正面证据：初始态与关卡契约矛盾、invariant 断言 fail、终止达成但契约断言 fail、到 gate 但 `won=false`、来源判定为 game 的 runtime-error | `:127-147`；测试 `:42-58` |
| `AGENT_LIMITATION` | 执行器主动停止（`stop.reason` ∈ no-progress/reset-exhaustion/wait-limit/jump-exhaustion），或正面能力边界证据（探索耗尽 + stuck / capability gap） | `:160-172`；测试 `:161-200` |
| `TIMEOUT` | 动作截止期命中、未达成终止、且非结构性不可判 | `:178-179`；测试 `:88-94` |
| `UNKNOWN` | 环境未证明健康、错误来源不明、超时 + 轮询断档、无终止/无失败/无截止期等；schema 强制带结构化 `InsufficientEvidence` | `:76-85,113-116,174-177,187-190`；`contracts/src/playtest.ts:155-160,259-261` |
| `not-executed` | 版本/schema/准备拒绝或尚未开始；不是 outcome；交付映射 `blocked` | `attributeReport`（`:196-208`）、`mapPlaytest`（`contracts/src/playtest.ts:518-545`） |

聚合优先级 `GAMEPLAY_FAILURE > ENVIRONMENT_FAILURE > TIMEOUT > AGENT_LIMITATION > UNKNOWN > SUCCESS`（`contracts/src/playtest.ts:496-505`）。

**边界/缺口**：
- `originOf` 用正则把错误文本分成 game / environment / unknown（`packages/cli/src/playtest.ts:213-219`）。顺序上 environment 正则先命中 `texture`/`load` 等词，因此游戏代码里的 texture/load 类 `TypeError` 可能被归成 ENVIRONMENT_FAILURE（blocked），而不是 GAMEPLAY_FAILURE（fail）。方向是“不轻易判游戏失败”，不会假绿，但会误归因。
- `attributionEvidence` 把所有“已执行”场景的阶段都记成 `execute`（`cli/src/playtest.ts:237-241`）；`evaluate` 阶段实际上不会出现在报告里。结论不受影响，阶段字段不够精确。
- `chromeAvailable` 在 CLI 归因输入里**硬编码为 true**（`cli/src/playtest.ts:256`）；Chrome 缺失靠 harness 的 not-executed reason 走 prepare + 环境故障，仍能判 ENVIRONMENT_FAILURE，但字段本身不真实。
- `event-unjudgeable` 作为 `ruleId` 被 CLI 检查（`cli/src/playtest.ts:252-254`），但 harness 只产生 `poll-gap` / `negative-not-judgeable`（`observe.mjs:174-201`）；这是死引用。
- **交付命令默认只跑 `success-basic`**（`required:true` 且 `harnessCondition:none`；`cli/src/playtest.ts:66-103`、`scenarios/five-state/success-basic.json`）。`failure-missing-pickup` / `limitation-wide-patrol` / `timeout-hang` / `env-no-chrome` 都是 `required:false` 或 harness 条件场景，不进入交付聚合。`--scenario-dir` 可以指定更多必需场景，但没有随仓库提供负向必需场景。因此五态归因的**真实运行覆盖只有 SUCCESS**，其余状态是 E2。

---

## 4. Playtest 报告如何关联 Demo 身份及版本

`PlaytestIdentitySchema`（`packages/contracts/src/playtest.ts:178-192`）：

- `scenarioFormatVersion`（`playtest-scenario/v1`）
- `siteVersion`
- `packId` / `packVersion` / `packChecksum`（pack `manifest.json` 的 sha256）
- `configChecksum`（site 实际消费的 `game-config.json` 的 sha256）
- `shellVersion`
- `harnessVersion` / `rulesVersion`

**关联链**：

1. harness 从传入的 `site/vN` 目录解析 `site.json` → pack 版本 → pack `manifest.json` / config；身份取自实际产物，不复制场景里的预期值（`runner.mjs:31-48`；`loadScenarios` 拒绝 `target.siteVersion` 不匹配，`:54-82`）。
2. CLI 准备六项（`cli/src/playtest.ts:106-163`）：run 形状/在 outRoot 内；`qa-report.json` 有 `delivery`；`delivery.site` 在且 `qa`/`site` 均 pass；site 目录与 `site.json`（shell/pack/config）三元组；pack manifest id/version/checksum；run config = site config = `delivery.config` 字节一致；场景 siteVersion 匹配。
3. 写回（`packages/pipeline/src/playtest.ts:27-92`）：重新读 `qa-report`、重验 pack checksum/config checksum；`applyPlaytest` 再验 pack id/version、site version/shell（`contracts/src/delivery.ts:317-350`）。不匹配即抛，退出 4/1，不污染 delivery。
4. 交付摘要 `delivery.playtest.report` 指向 `run/vN/playtest/vK/result.json`；同一条路径必须作为 `playtest-result` 证据条目存在（`contracts/src/delivery.ts:330-370` 的 superRefine）。
5. `verify-delivery` 用同一个报告重投影 `playtestSummaryOf`，与 `delivery.playtest` 逐字节比较（`evidence-integrity.ts:815-879`）；冻结报告身份 11/11 verified。

**缺口**：
- 报告没有 `gameId` / `runId` / attempt nonce；身份是“同一 pack/site/config”级别。把一份旧报告复制到同 identity 的另一个 run，写回层会接受；只有 `site-integrity.json` 与验收器的站点哈希能发现 site 字节变化。
- `harnessVersion` / `rulesVersion` 只写不校验：写回和验收器都不要求它等于当前 `PLAYTEST_HARNESS_VERSION` / `PLAYTEST_RULES_VERSION`（`contracts/src/playtest.ts:23-24`；`evidence-integrity.ts:349-350,375-383`）。因此 frozen 的 rules v1 报告在 HEAD（rules v2）下仍被接受。
- 交付内 v2 的 `harness-determinism.json` 是 `repeat:1`（`.../playtest/v2/harness-determinism.json`）；CLI 的 `runHarness` 不传 `--repeat`（`cli/src/playtest.ts:188-198`）。交付路径本身**不做重复运行确定性**；验收器里的 `playtest.projection` 用的是 `06-attempt-1/2` 两份直接 harness 证据，不是交付 attempt。

---

## 5. 人工视觉确认：独立记录、身份匹配与在最终判定中的作用

**独立记录存在（E3）**：

| 记录 | 内容 | 身份 |
|---|---|---|
| `.scratch/fpvs-v1-final/runs/2026-10-28-visual-review/review-record.json` | 6 项（整体风格/色彩明暗/角色/场景/关键物件/运行效果）全 pass；reviewer=`人（本次会话用户）`；`deliveryBinding` 记录写回结果 | subject 六字段（packId/version、siteVersion、shellVersion、manifestChecksum、configChecksum）齐全 |
| `.../capture.json` | 9 张真实按键截图；`siteIntegrity.before/after` 四文件哈希；`run.won=true, collected=6, chests=2, resets=0, runtimeErrors=0` | 同上 |
| `.../materials.json` | 17 源 + 27 生成 + 参考/交付资源；44 条材料路径 + sha256 | 同上 + siteJson |
| `.scratch/generic-playtest-v1/evidence/09-review-record.supplement.json` | 4 项补审（可读性等）全 pass；明确 `distinctFrameCount:8`、`08-goal.png` 与 `09-final.png` 字节相同；`historicalRecordModified:false` 及三份历史记录哈希 | 同上 + siteHashes |
| `.scratch/generic-playtest-v1/evidence/09-review-materials.json` | 补审材料清单、bindingChecks 全 true、`notClaimed` 说明 | 同上 + siteHashes |

**与当前交付身份匹配（E3）**：
- 记录 subject 与清单 subject / 冻结 identity 完全一致（pack `wasteland-scavenger-recipe` v1、site v1、shell 2、manifest `sha256:a162942d…`、config `sha256:455d9c7f…`）。
- 最终验收报告 `results.identities` 11/11 verified，其中 `fa04:review-record.json`、`fa04:capture.json`、`fa04:materials.json`、`gp:09-review-record.supplement.json`、`gp:09-review-materials.json` 均 verified。
- 站点完整性：capture/playtest/supplement 的 before/after 与当前站点四文件一致，`unchanged:true`。

**在最终判定中的作用**：
- `visual-review` 是六个**必需**交付检查项之一（`contracts/src/delivery.ts:76-84,89-90`）；`pending → incomplete`，`pass` 才可能让 verdict 为 pass，`fail → verdict fail`（`deriveDeliveryVerdict`，`:46-70`）。
- 冻结 delivery：`visualReview.status=pass`、`visual-review=pass`、verdict=pass。
- **但机器只校验“记录存在、格式、subject 身份、材料集合、与 delivery.visualReview 一致”，不重判人工结论**（`evidence-integrity.ts:1083-1089`；验收报告 limitations 明示）。`review-verdict` CLI 只检查 run 形状 + `qa-report.json` 存在 + `--verdict pass|fail`，然后写 `status/reviewer/reviewedAt/note`（`cli/src/cli.ts:784-818`；`pipeline/src/delivery.ts:153-180`）。它**不检查截图、材料、身份或评审人真实性**，也不把 review-record 写进 delivery。
- `delivery.visualReview` 只有四个字段，没有 review-record 路径/哈希；记录与交付的绑定在冻结案例中由 effort 流程人工完成，验收器通过“清单里恰好有 visual-review 记录”间接建立。若换一个新交付、没有清单或没有该记录，`verify-delivery` 会 blocked；但正常生产路径（不跑 verify-delivery）没有任何代码要求视觉记录存在。
- 结论：**人工视觉是最终 pass 的必要条件，但其“真实性”是人的断言，不是机器可验证的事实**；“审核者确实看了这些截图”只能由记录、材料哈希与流程纪律支持。

---

## 6. `verify-delivery` 实际验证哪些证据、身份、路径和判定关系

入口：CLI `verify-delivery --manifest <清单> --out <目录>`（`cli/src/cli.ts:820-828`）→ `runVerifyDeliveryCommand`（`cli/src/evidence.ts:19-62`）→ `verifyDeliveryEvidence`（`pipeline/src/evidence-integrity.ts:1177-1290`）。

| 类别 | 实际检查 | 代码 |
|---|---|---|
| 清单 | `delivery-evidence-manifest/v1` schema；roots 非空；files/records 的 root 必须已登记；files 不重复；records 必须在 files 里 | `:52-111,1099-1120` |
| 路径 | 相对路径；词法包含性；`lstat` 符号链接；双端 `realpath`；root 外链接/悬空链接/父级逃逸拒绝；目录冒充文件 → unreadable | `resolveEntry` `:237-310`；E2 `evidence-integrity.test.ts:366-424` |
| 文件 | 逐文件 sha256 + bytes；状态 `verified/missing/unreadable/hash-mismatch/path-invalid/optional-missing`；required 缺失/不可读 → blocked，篡改/越界 → fail | `:312-345,1092-1097` |
| 记录 | JSON 解析；qa-report 过 `QAReportSchema`；playtest 过 `PlaytestReportSchema`；不可解析 → fail，缺失/不可读 → blocked | `:353-442` |
| 身份 | 清单 subject 六字段 vs 11 条 `identity:true` 记录的 subject；mismatch → fail，missing → blocked；每字段 expected/actual | `:444-488` |
| 三方哈希 | identity.json 的 manifest/config/run config 自述哈希；acceptance evidence 的 `files[]`；visual materials 的 44 条；09 补审的历史记录哈希；consistency 引用的 qa-report 哈希 | `threeWay` `:545-670` |
| 站点 | capture / playtest / supplement 的 before/after 四文件 vs 当前站点清单哈希；`unchanged` 必须 true；引用不匹配 → fail | `siteIntegrity` `:672-751` |
| 报告引用 | `delivery.config.file`、`delivery.playtest.report`、`delivery.evidence[].path` 必须解析到清单；未登记 → fail；必需缺失/不可读 → blocked；可选日志缺失 → 通过 | `reportReferences` `:753-803` |
| 视觉 | 截图引用必须在清单且 verified；统计张数/不同字节；review materials 引用必须在清单且属于 materials.json 集合 | `visualConsistency` `:883-960` |
| Playtest | `delivery.playtest` 与报告重投影逐字节一致；`06-attempt-1/2` 每场景 executed/pass/termination/无 stop/无 reset/无 hit/无 error；两次 attempt 投影一致 | `playtestConsistency` `:815-879` |
| 六项重导出 | `asset-pack`=verifyPack+manifestChecksum；`config`=实际哈希 vs subject；`qa`=qaVerdict；`site`=四文件+site.json 引用；`playable-smoke`=playtestSummaryOf+mapPlaytest；`visual-review`=记录全 pass+subject+delivery.visualReview 一致 | `recomputeChecks` `:962-1088` |
| 判定关系 | declared vs recomputed 六项；verdict match；required 四组（files/identity/consistency/verdict）用 `deriveDeliveryVerdict` 汇总；exit 0 只在 pass | `:1210-1290` |
| 不检查 | 不构建、不跑 QA、不启动浏览器；不重判人工视觉；不校验 harness/rules 版本；不校验评审人身份；不校验 review item 的 `evidence[]` 引用；截图重复只统计不判失败；不校验清单本身是否“应该”由某策略生成 | 验收报告 limitations；代码如上 |

**信任根**：清单是唯一期望哈希来源；校验器只读、不回写。能发现相对清单的改动；发现不了“清单与被验证据一起被改并提交”（`TRUST_BOUNDARY` `:1090`）。清单生成器 `.scratch/evidence-integrity-v1/tools/build-manifest.mjs` 是 effort 工具，不在 `packages/` 生产链里。

---

## 7. 缺失证据或身份不一致时是否会拒绝通过

**验收器（`verify-delivery` / `pnpm test:evidence`）**：

| 情形 | 结果 | 是否 exit 非 0 |
|---|---|---|
| 必需文件缺失 | files blocked → 总 status blocked | 是（1） |
| 必需文件不可读（目录冒充） | unreadable → blocked | 是 |
| 内容篡改 / bytes 不符 | hash-mismatch → fail | 是 |
| 身份 mismatch | identity fail | 是 |
| 身份字段缺失 | identity blocked | 是 |
| 记录不可解析 | 三方/身份 fail | 是 |
| 报告引用错 attempt / 未登记路径 | reference-invalid → fail | 是 |
| 视觉材料集合不一致 | visual.materials.collection → fail | 是 |
| 视觉记录缺失 / delivery.visualReview 非 pass | recompute visual-review blocked/fail → verdictStatus blocked/fail | 是 |
| playtest 摘要缺失 / 报告不可用 | playable-smoke blocked | 是 |
| 声明 pass 但当前必需证据失效 | declared 保留 pass，recomputed ≠ pass → status ≠ pass | 是 |
| 声明 verdict 与重算不一致 | verdict fail | 是 |
| `--out` 在证据 root 内 | usage，**任何写入之前**拒绝 | 是（2） |
| 清单读不出/不过 schema | invalid | 是（4） |

已由 E2 断言：`packages/pipeline/tests/evidence-integrity.test.ts:281-470`（18 个）、`packages/cli/tests/evidence.test.ts:49-105`（6 个）；E3：冻结最终验收 status=pass、exit 0、223 文件、13 records、diagnostics=0（`2c1a9d5`）。

**生产写入路径**：
- `playtest` 准备拒绝：写 `playtest/rejections/<ts>.json`，不伪造 attempt，exit 4（`cli/src/playtest.ts:345-366`）。
- harness 无 `result.json`：留 `harness-error.json`，exit 4（`:381-390`）。
- 写回身份不符/无 delivery/缺 evidence：抛，写 `writeback-error.json`，exit 1；qa-report 不变（`pipeline/src/playtest.ts:27-116`）。
- `review-verdict`：只拒绝非法 run 形状、缺报告、非法 verdict；不拒绝身份/材料不一致（`cli/src/cli.ts:784-818`）。

**残留口（重要）**：
1. **失败的重跑不撤销旧 pass**：准备拒绝或 harness 无结果时，CLI 直接退出，不触碰已有 `delivery.playtest` / `playable-smoke`。qa-report 里的旧 SUCCESS 仍在；只有退出码表达这次失败。若旧证据仍在清单里，`verify-delivery` 仍会 pass。
2. **清单省略无法发现**：验收只看清单声明的文件和记录；清单作者可以把某记录标 `identity:false` 或干脆不登记，只要重算仍能得到 pass（例如不登记 06 attempts 就没有 projection 检查）。冻结清单是人工审查 + git 固定的，但校验器本身不强制“哪些 role 必须 identity:true”。
3. **`review-verdict` 无绑定**：任何能写 run 目录的人/代理都能写 `visualReview=pass`；没有截图/记录/身份前置。

---

## 8. 现有测试覆盖哪些负向场景

### 8.1 证据完整性（本票核心）

`packages/pipeline/tests/evidence-integrity.test.ts`（18 个，1 正 + 17 负/边界）：

| # | 用例 | 断言 |
|---|---|---|
| 1 | 完整未变化 | status pass / exit 0 / 六项 match / diagnostics 0 / 身份全 verified |
| 2 | 内容篡改 | hash-mismatch / fail |
| 3 | 必需文件缺失 | missing / blocked |
| 4 | 身份不符 | mismatch / fail |
| 5 | 身份字段缺失 | missing / blocked（不静默跳过） |
| 6 | 三方哈希矛盾 | consistency fail / 最终 fail |
| 7 | 声明与重算 verdict 不一致 | fail；qa check match=false |
| 8 | `..` 路径逃逸 | path-invalid / fail |
| 9 | 目录冒充文件 | unreadable / blocked |
| 10 | root 外符号链接 | path-invalid / fail |
| 11 | 悬空符号链接 | path-invalid / fail |
| 12 | root 内合法符号链接 | verified（不误伤） |
| 13 | 绝对路径引用 | path-invalid / fail |
| 14 | 报告引用错 attempt | references.report fail |
| 15 | 审核材料集合不一致 | visual.materials.collection fail |
| 16 | 结论过期（声明 pass，证据失效） | declared 仍 pass，status/recomputed ≠ pass |
| 17 | 只读性 | 校验前后 fixture 全量哈希不变 |
| 18 | 确定性 | 两次结果除 generatedAt 一致 |

`packages/cli/tests/evidence.test.ts`（6 个）：缺 `--manifest` → 2；清单坏 → 4 且不写；`--out` 在 root 内 → 2 且不写；六项前置缺失 → blocked 1 且报告落盘；篡改 → fail 1 且可定位；重复运行不覆盖。

### 8.2 Playtest / 归因 / 视觉写回

| 文件 | 用例数 | 覆盖 |
|---|---|---|
| `packages/contracts/tests/playtest-attribution.test.ts` | 19 | 五态、环境优先、runtime-error 来源、超时 vs UNKNOWN、not-executed、主动停止、聚合 |
| `packages/contracts/tests/playtest.test.ts` | 41 | 事件 schema（混入字段/伪装 cdp）、断言三值、报告不变量、delivery 映射、applyPlaytest 身份拒写、版本、投影、stop |
| `packages/pipeline/tests/playtest.test.ts` | 6 | 写回只动三处、幂等、身份不匹配拒写、config 不匹配拒写、writeback-error、无 delivery 拒写 |
| `packages/cli/tests/playtest-scenario-dir.test.ts` | 9 | 场景选择：混合 required、全诊断拒绝、空目录、schema、site 版本、路径不存在/不是目录 |
| `packages/cli/tests/review-verdict.test.ts` | 6 | pass/fail 写入、非法 run、缺报告、非法 verdict、跨 run 不继承 |
| `packages/demo/probe/playtest/tests/*.test.mjs` | 60 | observe 事件/断言/轮询 gap、策略/危险形态、有限终止、场景版本绑定 |
| `packages/pipeline/tests/delivery-integration.test.ts` | 4 | QA 失败提前 delivery、站点成功/失败、playtest UNKNOWN 并入 |

本票在 HEAD `a495da0` 实跑 5 个核心文件：**90/90 pass**（`evidence-integrity` 18、`cli/evidence` 6、`pipeline/playtest` 6、`contracts/playtest` 41、`playtest-attribution` 19）。测试只写 `mkdtemp`。

### 8.3 覆盖缺口

- **CLI `playtest` 六项准备校验没有测试**：`resolveTarget` 的 delivery/site/qa/pack/config 身份拒写只在 E1；`packages/cli/tests/` 只有 `playtest-scenario-dir.test.ts`，没有 `playtest.test.ts`。
- **验收器没有视觉“非全 pass”负向**：没有“review items 有 fail”“supplement overall=fail”“delivery.visualReview=fail 但记录 pass”的用例；`recompute visual-review` 的 fail 分支只由正向 fixture 间接走到。
- **验收器没有 playtest 摘要不一致负向**：没有“delivery.playtest 与重投影不同”“06 attempt 有 stop/reset/error”的用例；`playtestConsistency` 的 fail 分支未被负向断言。
- **没有 harness/rules 版本不符测试**；没有“记录应 identity 但清单标 false”的清单策略测试；没有截图重复字节的拒绝测试（只统计）。
- **没有 CLI 级 playtest 写回/exit code 测试**；没有“失败重跑不撤销旧 pass”的测试。
- **v2 CLI 写回无真实 E3**；`test:playtest` 是历史 E3（`2c1a9d5` 最终验收记录 exit 0），本票未运行（按约束禁止整条 `test:playtest`）。

---

## 9. 证据存在 / 证据有效 / 证据真实（必须分开）

| 层次 | 含义 | 本次可核实的例子 | 不能证明什么 |
|---|---|---|---|
| **存在** | 文件在、路径可解析、记录在清单里 | 223 个文件、13 条 records、playtest v1/v2、06 attempts、FA-04/09 视觉记录都在 | 文件内容未被改、身份属于当前交付 |
| **有效** | schema 通过、哈希匹配清单、身份六字段匹配、引用可解析、六项可由证据重导出 | 冻结最终验收：223/223 verified、11/11 identity、144/144 consistency、declared/recomputed pass、diagnostics 0；负向测试证明这些检查会拒绝 | 证据“真的来自一次真实运行”；清单本身是否被与证据一起改 |
| **真实** | 证据对应实际发生的浏览器执行/人工观看 | 支持：`chrome.log`、events/trace/input、两次 attempt 投影一致（steps 452/451、同一事件计数）、站点字节前后不变、截图与 capture 状态、人工记录逐项问题与理由 | 无密码学 attestation：哈希只证明“自清单冻结后未变”，不证明“当时确实发生”；人工视觉的“看过”只能由记录与流程纪律支持 |

**结论**：`verify-delivery` 能证明“存在 + 有效（相对清单）”；**不能单独证明“真实”**。真实性的支撑是运行产物本身、可复现 attempts、站点零改动与人工记录，以及 git 历史；这是文档已声明的信任边界。

---

## 10. 已验证 vs 仅在文档中声明

### 已验证（E1 + E2，且有 E3 支撑）

- 真实 Chrome/CDP/按键/本地服务；站点字节零改动（E1 + E3）。
- 状态轮询/事件推导/断言三值/轮询 gap 降级（E1 + E2）。
- 五态 + UNKNOWN + not-executed 的归因决策与聚合（E1 + E2；SUCCESS 有 E3）。
- Playtest 身份字段、CLI 准备六项、写回身份拒写（E1 + E2；冻结身份 11/11 verified 有 E3）。
- 人工视觉记录的独立存在、subject 身份、材料哈希、站点完整性、与 delivery.visualReview 的一致性（E1 + E2 + E3）。
- `verify-delivery` 的文件/路径/身份/三方/引用/视觉/playtest/六项重导出/verdict；负向拒绝（E1 + E2 + E3）。
- 只读性（312 个受保护文件运行前后零变化）与确定性（重复运行一致）（E3 + E2）。

### 仅在文档/记录中声明，或只有 E1

- “人工审核者确实逐项看了 9 张截图并作出 pass”：reviewer 是自由字符串，无身份认证；机器只检查记录完整性，不重判。
- “清单 + 证据一起被改并提交”的防篡改：明确在信任边界外，依赖 git 历史与人工审查。
- 当前 HEAD `rules v2` 的 CLI 写回行为：E1 完整，E2 覆盖纯函数/写回，但**无 E3**；冻结报告是 v1。
- 五态中除 SUCCESS 外的真实运行：归因器 E1 + E2，交付路径没有必需负向场景，**无 E3**。
- `harnessVersion`/`rulesVersion` 的语义（“规则变了旧报告不再按新规则解释”）：文档声明，代码不强制。
- Playtest baseline：`fixtures/playtest-baselines/` 只有 README，**没有真实 baseline**；baseline 比较是纯观察，不参与 verdict。

---

## 11. 风险与缺口（按对“第二个 Demo 能否依赖”的影响排序）

1. **人工视觉是 pass 的必要条件，但其绑定只在 effort 证据里**：`review-verdict` 可在无截图、无身份校验的情况下写 pass；`delivery.visualReview` 不带记录路径/哈希。第二个 Demo 若没有同等的 effort 纪律，视觉结论不可追溯。最小解除：要求 `review-verdict` 接受 `--record`/`--materials` 并校验 subject 与材料哈希，或把 `visual-review` 检查项绑定到清单记录。
2. **交付 Playtest 只要求一个 happy-path**：五态归因的负向分支没有真实运行覆盖；一个“能通关但有关卡/资源错误”的游戏可能因场景集不足而得到 SUCCESS。最小解除：随交付提供至少一个 `required:true` 的 invariant/负向场景（或把 `failure-missing-pickup` 提升为必需），并让 `mapPlaytest` 要求覆盖声明。
3. **失败重跑不撤销旧 pass**：harness 错误/准备拒绝/writeback 失败时旧 `delivery.playtest` 与 `playable-smoke=pass` 保留。最小解除：失败时把 `playable-smoke` 降为 `incomplete`/`blocked`（或写 attempt 级失败摘要），并让验收器看到“最近一次 attempt 失败”。
4. **版本/重放缺口**：没有 runId/attempt nonce；harness/rules 版本不强制；同 identity 的旧报告可被复制写回；交付路径 `repeat:1`，确定性来自非交付的 06 证据。最小解除：身份加 `runId` + `attemptId`；写回/验收要求 `rulesVersion` 等于当前常量；交付路径至少两次 attempt。
5. **采样与归因启发式**：两次成功读取之间的瞬时事件可漏；错误来源用正则分流，texture/load 类游戏错误可能被判环境故障。方向保守（不会假绿），但会影响诊断精度。最小解除：关键事件改为页面内只读事件缓冲（仍不改站点字节）或提高采样率；错误来源改为显式分类表并记录不确定性。
6. **清单信任根与记录策略**：清单作者可省略记录或把 identity 标 false；校验器不强制 role→identity 策略。最小解除：在清单 schema 增加“必需 role 及 identity 要求”的固定注册表，并在校验器中强制。
7. **视觉 item 证据未校验**：`review-record.items[].evidence[]` 指向的文件不被解析；记录可以引用不存在的证据仍 pass。最小解除：把 item evidence 纳入 `visual.materials` 的引用图。

---

## 12. 证据索引

| 证据 | 路径 | 来源 commit / 说明 |
|---|---|---|
| 冻结交付身份 | `.scratch/fpvs-v1-final/artifacts/identity.json` | `5b8283f`；pack v1 / site v1 / shell 2；manifest `a162942d…`、config `455d9c7f…` |
| 冻结 delivery | `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json` | `5b8283f`（visualReview 写回 `f458beb`；后续 `8e92c69`）；六项 pass、verdict pass、playtest SUCCESS |
| 交付内 Playtest v1/v2 | `.../run/v1/playtest/{v1,v2}/result.json`、`site-integrity.json`、`chrome.log` | `5b8283f`；harness/rules **v1**；SUCCESS；steps 452/453；0 reset/hit/error；站点 unchanged |
| 06 真实 attempt（v2） | `.scratch/generic-playtest-v1/evidence/06-attempt-{1,2}/attempt-v1/result.json` | `8e92c69`；harness/rules **v2**；raw 无 outcome；steps 452/451 |
| FA-04 视觉记录 | `.scratch/fpvs-v1-final/runs/2026-10-28-visual-review/{review-record,capture,materials}.json`、`shots/*.png` | `f458beb`；6 项 pass；9 张截图（8 个不同字节）；站点 unchanged |
| 09 视觉补审 | `.scratch/generic-playtest-v1/evidence/09-review-record.supplement.json`、`09-review-materials.json` | `8e92c69`；4 项 pass；明确非全量重审、8 帧、历史哈希未改 |
| 期望哈希清单 | `.scratch/evidence-integrity-v1/manifest/expected-hashes.json` | `2c1a9d5`；223 文件（151 required / 72 optional）、13 records、9 roots；sha `ba7a485b…` |
| 最终验收 | `.scratch/evidence-integrity-v1/runs/2026-10-29T05-04-57Z-final-acceptance/{report.json,report.md,final-acceptance.md}` | `2c1a9d5`；status pass / exit 0 / 1,546ms / 223 verified / 11 identity / 144 consistency / diagnostics 0 / 六项 match |
| 基线重验 | `.scratch/evidence-integrity-v1/runs/2026-10-29T04-58-19Z-baseline/` | `2c1a9d5`；5,766ms；312 受保护文件零变化；07 交叉 27/27 |
| 审计 Phase 0 | `.scratch/evidence-integrity-v1/research/phase0-audit.md` | 证据完整性 V1 的前置审计（正式路径不重算、07 是旧唯一校验器） |
| 实现 | `packages/demo/probe/probe-harness.mjs`、`packages/demo/probe/playtest/{runner,observe,policy}.mjs`、`packages/cli/src/playtest.ts`、`packages/pipeline/src/playtest.ts`、`packages/contracts/src/{playtest,playtest-attribution,delivery}.ts`、`packages/pipeline/src/{delivery,evidence-integrity}.ts`、`packages/cli/src/{cli,evidence}.ts` | HEAD `a495da0`（生产代码与 `2c1a9d5` 相同） |
| 测试 | `packages/pipeline/tests/evidence-integrity.test.ts`（18）、`packages/cli/tests/evidence.test.ts`（6）、`packages/pipeline/tests/playtest.test.ts`（6）、`packages/contracts/tests/playtest.test.ts`（41）、`packages/contracts/tests/playtest-attribution.test.ts`（19）、`packages/cli/tests/playtest-scenario-dir.test.ts`（9）、`packages/cli/tests/review-verdict.test.ts`（6）、`packages/demo/probe/playtest/tests/*.test.mjs`（60） | 本票在 HEAD 实跑前 5 个文件 90/90 |

---

## 13. 审计限制

- **只读**：未运行 `playtest`、`test:playtest`、`review`、`review-verdict`、`playtest-baseline`、`create/build/plan/pack/compile-*`、任何浏览器探针；未构建；未写历史/受跟踪目录；未提交/推送。
- **历史 E3 不等于 HEAD 证明**：冻结交付生成于 `040b907`，冻结于 `5b8283f`；playtest v1/v2 与 06 attempts 产生于 `5b8283f`/`8e92c69`；视觉审核 `f458beb`；最终证据重验 `2c1a9d5`。生产代码在 `2c1a9d5..a495da0` 未变，但 **v2 CLI 写回**没有 E3，旧 v1 报告不能外推为 v2 写回/归因的真实证据。
- **本票测试**只跑了 5 个离线文件（90/90）；未跑全仓 149 文件 / 2231 用例、未跑 `typecheck`/`build`/`test:evidence`；历史计数引自最终验收记录（`2c1a9d5`）。
- **单 Demo**：所有真实证据只覆盖 `wasteland-scavenger-recipe` 一个横版、一个 site v1；不支持塔防（无 delivery/playtest），也不支持第二个玩法/设计样本的外推。
- **平台**：符号链接/路径测试在 macOS 验证；Windows 未验证；`test:evidence` 的耗时是机器相关读数，不作为门槛。
- **人工视觉**：本审计只读记录，无法独立确认“人确实看了”；该结论按文档/记录声明处理，不升级为机器事实。
