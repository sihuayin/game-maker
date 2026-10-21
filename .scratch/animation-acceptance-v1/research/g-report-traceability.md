# 07 · G · 报告、错误与实验追溯

- **票**：[07-g-report-traceability](../issues/07-g-report-traceability.md)
- **基线**：`main` · `f0dac01`（2026-10-21）。工作树非干净，本调查只读，未提交。
- **任务书**：[docs/v5/动画.md](../../../docs/v5/动画.md) §3、§4.7、§5、§7。
- **性质**：只读审计；零付费。未运行 `create` / `build` / `plan` / `pack` / `compile-*` / `site` / `review`；
  未调用任何上游；未写 `out/`；未跑 `pnpm check` / `pnpm build`。
- **证据等级**：E1 源码 · E2 测试 · E3 真实产物；另记运行证据（命令 + 结果）。
- **行号说明**：以下行号均指 `f0dac01` 的 `packages/**/src`；源码一改就会漂移。
- **状态词**：只使用 `implemented` / `partial` / `missing` / `unverified`。

## 0. 结论先行

1. **壳层有统一错误模型，但全链只是 `partial`**：`CommandError`（`kind` / `message` / `ledger?` /
   `failureDir?`）+ `EXIT` 0–4 + `Carried`（异常上可挂账、现场、设计入参）已经是 CLI 与 MCP 共用的出口；
   但 core 里大量判断仍抛裸 `Error`，且**没有任何结构化字段能直接放文件 / 资源 / 阶段 / 帧**。
2. **追溯链的最短闭环只到「包」**：`manifest.id + version + files[].checksum + atlases[].checksum`
   足以钉住一个包的字节；但 **run → pack → site → qa-report 之间没有显式 join key**：
   `run/vN/ledger.json` 不记 `packVersion` / `siteVersion`，`qa-report.json` 连身份字段都没有，
   `site.json` 只记 `pack`。今天靠目录约定和 `gameId` 推断。
3. **QA 报告是唯一一份「裁决」报告，但会被重跑构建覆盖**：`runBuild` 固定写
   `run/v<N>/qa-report.json`（`packages/pipeline/src/create-game.ts:542-543`），而同一 run 的第二次
   attempt 会得到 `pack/v2`（`packages/pipeline/tests/create-game.test.ts:162-174`），旧 QA 报告没有版本目录。
4. **可复用 JSON 格式已经很多**：`qa-report/v1`、`assetpack/v4`、`assetpack-ledger/v1`、
   `run-ledger/v1`、`assetpack-coverage/v1`、`assetpack-master-ratios/v1`、`asset-plan/v1`、
   `CommandResult`（CLI `--json` / MCP `structuredContent`）。**缺的不是格式，是格式之间的外键与证据索引。**
5. **推荐的最小方案**：不新建第三本账、不复制 QA findings；在 `run/v<N>/` 增一份
   `run-build-record/v1` **索引 sidecar**，记录 `runVersion → packVersion → siteVersion → qaReport`
   的 join key、`manifest.json` / `qa-report.json` / 输入文件的 checksum、以及每一步的 stage 结果。
   失败时同一份记录带 `error` 明细。这样复用现有账本与报告，且不触碰 `assetpack` / `qa-report/v1` 的 strict schema。
6. **W1 / W4 在 HEAD 复验成立**：CLI 有 `asCommandError`、MCP 没有；MCP 对理解层裸错误退 1 而工具说明写 3/4；
   QA `checked` 恒 5/6、`incomplete` 恒真、闸门只看 `failures[].severity === "error"`；
   `site` 独立命令不读 QA 报告。W4 引用的真实 `qa-report.json` 产在 inspect 接线之前，不能当 HEAD 行为证据。

---

## 1. 错误模型

### 1.1 类型与字段

| 类型 / 字段 | 位置 | 实际内容 | 读者 |
|---|---|---|---|
| `CommandResult` | `packages/contracts/src/command.ts:13-21` | `command` · `summary[]` · `data`（自由对象） · `artifacts[]`（相对 `outRoot` 的 path + kind） | CLI `--json`、MCP `structuredContent`、人类渲染 |
| `EXIT` | `packages/contracts/src/command.ts:46` | `ok:0` · `failure:1` · `usage:2` · `upstream:3` · `invalid:4` | 两个壳 |
| `CommandError` | `packages/contracts/src/command.ts:67-87` | `kind: keyof EXIT` · `message` · `ledger?: LedgerCall[]` · `failureDir?: string` | `exitCodeOfError`、两个壳 |
| `exitCodeOfError` | `packages/contracts/src/command.ts:88` | 只认 `CommandError`；其他一律 `EXIT.failure`(1) | 两个壳 |
| `Carried` | `packages/contracts/src/command.ts:114-119` | `ledger?` · `failureDir?` · `designAttempts?` · `visualWorldAttempts?` | `ledgerOfError` / `failureDirOfError` / `designAttemptsOfError` / `visualWorldAttemptsOfError` |
| `carryOnError` | `packages/contracts/src/command.ts:133-139` | 把 `Carried` **挂到原异常上**，不重包、不丢栈；只加不改 | 两个壳按能力读 |
| `CallFailure` | `packages/contracts/src/structured-call.ts:58-68` | 闭集：`http` · `timeout` · `truncated` · `invalid-json` · `no-tool-use` · `empty-input` · `schema` | `LedgerCall.failures[]`、两个壳 |
| `LedgerCall` | `packages/contracts/src/ledger.ts:96-146` | `step` · `target` · `attempts` · `failures?` · `ms?` · `model?` · `requestedModel?` · `upstream?` · `requestId?` · `usage?` | run / pack ledger、报表摘要 |
| `ConfigIssue` | `packages/contracts/src/game-config.ts:251` 附近 | `severity` · `where`（人话字符串，如 `entity "x"`） · `message` | 编译 / 装配期硬失败 |
| `QAFinding` | `packages/contracts/src/qa.ts:168-175` | `target`（账的词汇：资源 id / `recipe` / `game-config`） · `detail` · `severity` | QA 报告、两个壳 |
| `QAFailure` | `packages/contracts/src/qa.ts:180-183` | `QAFinding` + 投影出来的 `judgement` | QA 报告 |

**结论**：`CommandError` 是一个**壳层错误信封**，不是**可查询的错误对象**。它没有 `code`、`stage`、`file`、
`resource`、`frame`、`cause` 的结构化格子；能放的结构化信息只有 `ledger` 与 `failureDir`。

### 1.2 退出码与传播路径

退出码语义（`packages/contracts/src/command.ts:46`；CLI 用法同 `packages/cli/src/cli.ts:59-62`）：

| 码 | 含义 | 典型来源 | 证据 |
|---|---|---|---|
| 0 | 成功 / `--help` / 停在检查点 | 任一 `CommandResult`；`status:"awaiting"` | `cli.ts:466,486-489,615-616` |
| 1 | 失败 / 我们的 bug / 未包装裸 `Error` | `pack` 段 11 处判断（帧数、抠底、尺寸等）；`site` 显式版本撞名；MCP 的理解层裸错误 | `packages/assets/src/pack.ts:813-816,923-930,953-966,1028`；`ops.ts:1595-1609`；`command.ts:88` |
| 2 | 参数 / 用法 | 缺 flag、`--recipe` 缺值、不认识子命令、清单要生图但没凭据 | `cli.ts:451-455,473-474,499-500`；`ops.ts:1517-1520` |
| 3 | 上游不可达 | HTTP / timeout；`GenerationError` / `ImageGenerationError` 被包成 `upstream` | `ops.ts:1592-1593`；`cli.test.ts:171-190`；`create-game.test.ts` 的 `failure:"http"` 档 |
| 4 | 产物 / 清单 / 设计不合法 | schema 不过、QA 硬失败、R12 拒绝、业务校验不过 | `create-game.ts:215-226,533-537`；`cli-create.test.ts:409-450` |

传播路径（E1）：

```
core / pipeline 抛点
 ├─ CommandError(kind, message, { ledger?, failureDir? })
 ├─ GenerationError | ImageGenerationError
 │     └─ packAssets → CommandError("upstream", e.message, carried)          ops.ts:1592-1593
 ├─ CommandError
 │     └─ packAssets → new CommandError(e.kind, e.message, carried)          ops.ts:1594
 └─ 裸 Error
       └─ carryOnError(e, { ledger?, failureDir?, designAttempts?, visualWorldAttempts? })
          + throw e（原样、保栈）                                            ops.ts:1595-1609
CLI
 └─ catch → asCommandError(raw) → exitCodeOfError(e) → renderHuman / --json  cli.ts:617-641
MCP
 └─ catch → exitCodeOfError(e) → { isError:true, _exitCode, content, structuredContent? }  server.ts:338-360
```

关键差异：

- **CLI 做一层按形状的错误翻译**：带 `rejections` ⇒ `invalid`(4)；带 `failure` ⇒ `http|timeout` 为
  `upstream`(3)，其余 `invalid`(4)；其他原样 ⇒ 1（`packages/cli/src/cli.ts:207-218`）。测试
  `packages/cli/tests/cli-create.test.ts:429-449` 钉住「三发不过契约 ⇒ 4」「R12 拒绝 ⇒ 4」。
- **MCP 不做这层翻译**：`packages/mcp/src/server.ts:338-360` 直接 `exitCodeOfError(e)`。
  而理解层的 `AnalyzeReferenceError` / `AnalyzeIntentError` / `CompileDesignError` / `DesignRejectedError` /
  `CompileCharacterDnaError` 全部 `extends Error`，不是 `CommandError`
  （`packages/vision/src/analyze-reference.ts:90`；`packages/game-design/src/analyze-intent.ts:66`、
  `compile-design.ts:58,71`、`compile-character-dna.ts:56`）⇒ MCP 会把它们报成 `_exitCode: 1`，
  而 `create_game` 工具说明写的是「上游不可达 3；文书 4」（`server.ts:130-131`）。
  这条只有静态证据，无测试覆盖（见 §7）。
- **CLI 的翻译还会丢掉 `failureDir`**：`runUnderstanding` 在失败时把现场路径挂到原异常上
  （`create-game.ts:394-396`），但 `asCommandError` 为理解层错误新建 `CommandError` 时**只带 `ledger`**，
  没有把 `failureDir` 传过去（`cli.ts:207-218`）⇒ CLI 的 `--json` / 人类输出读不到现场路径；
  MCP 不做翻译，`failureDirOfError(e)` 反而读得到。测试 `cli-create.test.ts:429-449` 只断言退出码与文案，
  没有覆盖这条。状态：`partial`（静态 E1）。
- **失败 JSON 的形状是临时信封，不是契约**：CLI 失败时输出
  `{ command, error, exitCode, ledger?, failureDir? }`（`cli.ts:632-633`）；成功时输出完整的 `CommandResult`
  （`cli.ts:615`）。POST 里没有 `stage` / `file` / `resource` / `frame` / `artifacts`。
- **`parseArgs` 在 `try` 里**（`cli.ts:449-456`），所以缺值不会崩栈成 1；这条是票 16 修过的洞。

### 1.3 错误能否定位文件 / 资源 / 阶段 / 帧

| 定位对象 | 状态 | 实际能力 | 证据 | 缺口 |
|---|---|---|---|---|
| **文件** | `partial` | `verify` 逐文件报「缺文件 / 大小不符 / checksum 不符：`f.path`」；部分 pack 错误直接带绝对路径（`reuseFrom` 缺 drawlist / 生图文件、`readRunJson` 读不出）；`failureDir` 给整个失败现场目录 | `ops.ts:1672-1679`；`pack.ts:574,729`；`artifacts.ts:112-119`；`cli.ts:631-639` | 大量错误没有路径；`CommandError` 没有 `file` 字段；QA finding 没有路径字段 |
| **资源** | `partial` | pack 错误文案常带 `资源 "id"`；QA finding 的 `target` 是资源 id / `recipe` / `game-config`；ledger 的 `target` 也是同一套词汇 | `pack.ts:813-816,878-883,923-930,953-966,1028`；`qa.ts:168-175`；`qa/visual.ts:110-121`；`qa/gameplay.ts:96-105`；`ledger.ts:96-99` | 只存在于**文案**或 QA 报告；错误对象本身没有 `resource` 字段；MCP 失败结构化内容只有 ledger/failureDir |
| **阶段** | `partial` | `LedgerCall.step` 是闭集（`LedgerStep`）；`runBuild` / `runUnderstanding` 有 `CreateStep` 进度（`visual-world`/`intent`/…/`pack`/`config`/`qa`）；失败现场里「已经跑完哪几步」可从文件存在性判断 | `ledger.ts:21-78`；`create-game.ts:39-42,257-258,447-448`；`run.ts:103-106` | 进度只走 `onProgress`（CLI 写 stderr，MCP 走 progress 通知），**不落盘**；错误对象没有 `stage`；QA 失败只给报告路径 |
| **帧** | `partial` | pack 文案能精确到「第 N 格（第 r 行第 c 列）」「检测到 N 块」、drawlist 的 `dl.id.frame`；manifest 有 `frames[].name` / `animations[].frames` | `pack.ts:900-906,923-930,953-966`；`assetpack.ts:150-162`；`audit.ts:79-83` | 没有结构化 `frame` 字段；manifest 的 `frames[]` **只写 name**（`pack.ts:1221`），不写 per-frame `durationMs`；`FrameRef.durationMs` 契约允许但生产侧零使用 |

**结论**：错误能「说清」文件 / 资源 / 阶段 / 帧中的一部分，靠的是**人写的消息文本**；
但「读得出」这件事只对 QA 的 `target`、ledger 的 `step`/`target` 成立。对机器而言，
`CommandError` 仍然是一个不可查询的字符串。

一个具体的**契约 / 实现 / 产物三方不一致**：

- 契约注释说 `image` 的 `target` 会带 `<id>.<动画|层名>`（`packages/contracts/src/ledger.ts:98`）；
- 实现只写 `spec.id`（`packages/assets/src/pack.ts:734`）；
- 真实产物里同一个 `player-scavenger` 出现多次，分别对应 idle / run / jump 三个动画
  （`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/run/v1/ledger.json`，
  `calls[].target` 均为 `player-scavenger`）。

⇒ 账上能定位到「资源」，**定位不到「这次生图是哪个动画」**。

### 1.4 失败时保下了什么

| 阶段 | 失败时的落盘 | 证据 | 缺什么 |
|---|---|---|---|
| 理解层 | staging 改名为 `<out>/<gameId>/run/failed-<ts>/`（id 已定）或 `<out>/.failed-<ts>/`（id 未定）；里面是已跑完步骤的产物；被拒设计写 `design-attempts.json`，参考图失败写 `visual-world-attempts.json` | `pipeline/src/run.ts:108-117`；`pipeline/src/create-game.ts:371-397`；测试 `pipeline/tests/run.test.ts:67-93`、`create-game.test.ts:290-308` | 没有 `error.json` / stage 标记；现场名只有时间戳；**CLI 在 `asCommandError` 翻译后丢 `failureDir`**（`cli.ts:207-218`），只有 MCP 能读到 |
| pack | `.building-*` 改名为 `<out>/<id>/failed-<ts>/`；里面有已付费原图 / 逐字提示词 / drawlist / `ledger.json` / `master-ratios.json`；只保留**最近一份**失败现场 | `pack.ts:288-318,1088-1129`；真实现场 `run-out-2026-10-17c/.../failed-2026-10-17T03-03-43-155Z/`（33 个文件，含 PNG / prompt / ledger / master-ratios） | 没有 manifest（未生成）；没有 `error.json`；旧失败现场被删 |
| config | `mkdtempSync` 的 staging 在 `finally` 里 `rmSync`；run + pack 保留 | `create-game.ts:477-495` | 配置 attempt 的中间产物直接丢；只留最终 `run/v1/game-config.json`（重跑会覆盖） |
| QA | **报告先落盘、再抛** `invalid`；run + pack 保留；站点不产 | `create-game.ts:539-545,215-226`；测试 `create-game.test.ts:640-673`、`cli-create.test.ts:409-426` | `assertQaPassed` 抛的 `CommandError` **不带 `failureDir`、不带 ledger**；QA 报告没有版本路径，重跑会被覆盖 |
| site | 校验在 `laySite` 之前，硬失败**一个目录都不建** | `demo/src/site.ts:211-221` | 没有失败记录文件；错误只在异常消息里 |
| review | 已发出的调用写 run ledger；失败仍退出 3 或 4 | `pipeline/src/review.ts:104-124`；测试 `pipeline/tests/review.test.ts:120-139` | 观察结果**不落盘**（只在 `CommandResult` / stdout）；账的 `target` 只有 `packId`，没有包版本（`assets/src/review.ts:114-117`） |

**另一个断点**：`runBuild` 在 QA 硬失败时于 `create-game.ts:544` 抛出，而 run ledger 的并集写回在
`create-game.ts:549-551` ⇒ **QA 失败这一次构建的 pack / config 调用不会进入 run ledger**；
此时能读的只有包内 `ledger.json`（包已经落盘）与异常上带的 `ledger`（只给当场看）。
静态 E1 清楚，无归档的 QA 失败 run 做 E3（见 §7）。

---

## 2. 追溯链

### 2.1 现有链条（按真实产物）

```
outRoot/
└─ <gameId>/
   ├─ run/v<N>/
   │   ├─ intent.md / visual-world.json / game-intent.json / game-design.json
   │   ├─ character-dna.json / asset-recipe.json / asset-recipe.plan.json
   │   ├─ game-config.json                 ← 重跑构建会覆盖
   │   ├─ qa-report.json                   ← 重跑构建会覆盖
   │   └─ ledger.json                      ← run-ledger/v1：gameId + runVersion + calls
   ├─ pack/v<M>/
   │   ├─ manifest.json                    ← packId + version + files[].checksum + atlases[].checksum
   │   ├─ ledger.json                      ← packId + packVersion + calls
   │   ├─ coverage.json                    ← packId + packVersion + layers
   │   └─ master-ratios.json               ← packId + packVersion + masters
   └─ site/v<K>/
       ├─ site.json                        ← shell + pack + config
       └─ game-config.json / index.html / shell.js
```

真实证据：
`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/`：
`run/v1`、`pack/v1`、`pack/v2`、`site/v1` 并存；`site/v1/site.json` 指向 `pack:"v2"`，
而 `run/v1/ledger.json` 只记 `runVersion:1`，**没有**任何字段说「这次 run 产了 pack v1 还是 v2」。
`run/v1/qa-report.json` 只有 `format/checked/failures/observations` 四个键。

### 2.2 关联矩阵

| 关联 | 显式 join key？ | 今天的实际做法 | 证据 | 状态 |
|---|---|---|---|---|
| pack → 包内 ledger / coverage / master-ratios | **是** | 三份 sidecar 都有 `packId` + `packVersion`；`verify` 还核对它们与 manifest 一致 | `coverage.ts:25-30`；`master-ratio.ts:41-49`；`ledger.ts:156-160`；`ops.ts:1683-1707` | `implemented` |
| site → pack | **是** | `site.json.pack = "v<M>"`；`site.json.shell` 给外壳版本；`site.json.config` 给配置文件名 | `demo/src/layout.ts:114-116`；测试 `demo/tests/site.test.ts:30-43` | `implemented` |
| shell → site | **是** | 外壳读 `site.json`，比对 `shell` 版本，按 `pack` 拼 `../../pack/v<M>/` | `demo/src/shell/entry.ts:45-58` | `implemented` |
| run → pack | **否** | 只靠 `<out>/<gameId>/` 同树 + 首建版本对齐约定；`packVersion` 存在 `BuildResult` / `CommandResult.data`，但不进任何持久文件 | `create-game.ts:437-441,553-567`；`run-ledger.ts:19-34` | `missing` |
| run → site | **否** | `siteVersion` 只在 `CommandResult.data`；`site.json` 不记 run 版本 | `demo/src/site.ts:238-244`；`cli.ts:329-337,366-373` | `missing` |
| qa-report → pack | **否** | 只有目录位置 `run/v<N>/qa-report.json`；报告不含 `packId/packVersion`，也不含 checksum/time | `qa.ts:266-319`；真实产物 18a | `missing` |
| qa-report → run | **弱** | 只能由它所在的 `run/v<N>` 目录推断；没有字段 | 同上 | `partial` |
| error → 产物 | **弱** | 理解层 / pack 失败通过 `failureDir` 指到现场；QA / site / config 失败没有 | `command.ts:67-77`；`run.ts:108-117`；`pack.ts:288-318`；`create-game.ts:215-226` | `partial` |
| review → pack | **弱** | `data.packVersion` 给 stdout；ledger 只记 `target: packId`，版本不落账 | `pipeline/src/review.ts:109-139`；`assets/src/review.ts:114-117` | `partial` |
| verify → pack | **是（按路径）** | `verify <packDir>` 重算 checksum，但不落盘、不在创建链上自动跑 | `ops.ts:1662-1726`；测试 `cli.test.ts:122-139` | `partial` |

### 2.3 断链清单（按严重度）

1. **run ↔ pack 无外键**。`run-ledger/v1` 没有 `packVersion`；`manifest` 没有 `runVersion` / `recipe` 校验和。
   同一 run 的多次构建（`pack/v1`、`pack/v2`…）只能靠目录时间或 `pack ledger.createdAt` 猜。
2. **qa-report 无身份**。没有 `runVersion`、`packId`、`packVersion`、`checksum`、`createdAt`；
   契约还**故意**不设 `createdAt`，理由是「哪一次运行由目录答了」（`qa.ts:258-265`）。
   这对「一个 run 一次构建」成立，对「同一 run 多次 attempt」不成立。
3. **qa-report 被重跑覆盖**。`runBuild` 固定写 `runDir/qa-report.json`；第二次 attempt 仍是同一路径，
   而 `packVersion` 变成 2（`create-game.test.ts:162-174`）⇒ 第一版的 findings 不再可读。
4. **run ledger 的 `createdAt` / `wallClockMs` 在成功构建后被重写**：`writeRunLedger` 用 `new Date()` 与
   本次构建的 `Date.now()-t0`（`create-game.ts:603-613`；`runBuild` 的 `t0` 在 `:443`）。
   头注却说 `wallClockMs` 是「人等了多久」（`run-ledger.ts:27-31`），构建后它只覆盖构建段，
   理解段的时间被覆盖掉。⚠️ QA 硬失败时因为先抛（`create-game.ts:544`）连这次重写都到不了，
   所以 run ledger 会停在理解段那一版 —— 同一个字段在两种失败路径下含义不同。
5. **run ledger 没有消费者**。除 `pipeline` 自己的 `readRunLedger` / `recordRunSpend` 外，
   CLI / MCP 不读、不打印、不把它作为 artifact 暴露；`BuildResult.ledger` 也没有进 `CommandResult.data`。
   账写了，但报告侧看不见它。
6. **`manifest.json` 自身不在 `files[]` 里**（`assetpack.ts:298` 明确「manifest 自身除外」），
   也没有任何文件记录它的 sha256 ⇒ 无法用一枚短摘要钉住「这个包到底是哪一版 manifest」。
7. **`verify` 不在创建链上**。`pack` 写盘后只做 schema 自校验（`pack.ts:1283-1287`），不做 checksum 重算；
   `verifyPack` 只能手动跑（`cli.ts:593-596`；MCP `verify_asset_pack`）。所以「checksum 存在」≠「交付时校验过」。
8. **失败现场没有错误索引，且 CLI 会丢现场指针**。理解层 / pack 现场有产物与账，但没有 `error.json`；
   理解层明明把 `failureDir` 挂在异常上（`create-game.ts:394-396`），CLI 的 `asCommandError` 却只转交
   `ledger`（`cli.ts:207-218`）⇒ CLI 用户看不到现场，MCP 用户看得到。QA / site 失败连现场都没有。
9. **review 的观察不落盘**，且账的 `target` 只有包 id，不记版本（`assets/src/review.ts:114-117`）。
10. **`pack` 的失败现场只保留最近一份**（`pack.ts:300-301` 删掉旧 `failed-*`）；
    run 理解层现场没有清理，二者策略不一致。

### 2.4 稳定资源版本标识

| 层级 | 状态 | 现有标识 | 证据 | 备注 |
|---|---|---|---|---|
| 包 | `implemented` | `(manifest.id, manifest.version)`；版本目录绝不覆盖；`createdAt` / `generator`；`files[].checksum` 覆盖包内除 manifest 外每个文件；`atlases[].checksum` | `assetpack.ts:265-299`；`pack.ts:1296-1298`；`verify` `ops.ts:1672-1679` | 没有包级 content hash；manifest 自身未哈希；包版本可被外部改写（verify 能发现，但链上不跑） |
| 资源 | `partial` | 资源 `id`；其内容由所在包的版本隐式决定；`authoring[]` 指到包内证据文件 | `assetpack.ts:164-193` | 没有 per-asset 版本 / checksum；资源 id 在多个包版本里复用 |
| 动画 | `partial` | `animations[].name` + `frames: string[]`；`fps` 可选；`loop` 默认 true | `assetpack.ts:157-162` | 无动画级 checksum；fps 不是必需 |
| 帧 | `partial` | `frames[].name`（契约允许 `index` / `durationMs`，生产侧只写 name） | `assetpack.ts:150-155`；`pack.ts:1221` | 无逐帧 checksum / duration；帧身份靠包版本 + 帧名 |

**结论**：`packId + packVersion + files[].checksum` 足以做「资源版本」的稳定锚点；
但「资源 / 动画 / 帧」没有独立版本，必须连同包版本一起引用，不能只写一个 `scavenger-actor idle`。

### 2.5 实验记录与真实产物

| 类别 | 真实路径 | 内容 | 可追溯性 | 状态 |
|---|---|---|---|---|
| 付费实验 `result.json` | `.scratch/asset-integration-v1/runs/2026-10-21a-smoke/result.json` 等 5 份（a/c/d/e/f） | `ok` · `mode` · `model` · `api` · `proxy` · `requests` · `frames[]`（name/bytes/ms/attempts/decoded/bbox/baseline/imported/key） · `drift` · `verdict` / `humanVerdict` | 有模型 / 接口 / 代理 / 每帧读数；**没有** commit、ticket、baseline 包版本、生成脚本参数、审批人 | `partial` |
| 付费预算报告 | `.scratch/asset-integration-v1/runs/2026-10-21a-smoke/budget-report.md` 等 | 预算、请求体摘要、验收标准、「待你点头的原话」 | 人可读；与 `result.json` 没有共享 ID；审批是文本，不是字段 | `partial` |
| 证据目录 | 同 run 下 `evidence/*.png` / `*.prompt.txt` / `http-calls.log` / `dry-run-result.json` | 原图、解码图、导入图、逐字提示词、每次 HTTP | 文件名带帧名；没有 manifest/checksum 索引 | `partial` |
| 失败 run 记录 | `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-2026-10-17c.json` | `code` · `ms` · `text`（CLI stderr 原文，含 JSON 错误 + 进度） · `steps[]` | 记录了退出码、错误、账、`failureDir`；`steps` 是 harness 从 stderr 抄的，不是工具落盘 | `partial` |
| 最终包 v7 | `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/` | `manifest.json` 19 资源 / 76 帧 / 61 动画帧 / 34 色；`coverage.json` 3 层；`ledger.json` **0 调用** | 包身份与 checksum 完整；`ledger.json` 的 0 调用是真实的零上游重建，**不是**原始生成那几发；与原始生成 run 没有链接 | `implemented`（包内）/ `partial`（跨实验） |

`run-2026-10-17c.json` 的 `text` 是理解「失败记录长什么样」的最好 E3：它同时包含
CLI 的失败 JSON（`error`、`exitCode`、`ledger`、`failureDir`）与 stderr 的逐步进度。
但它由实验 harness 生成，**不是 `game-maker` 自己落的**。

### 2.6 W1 / W4 在 HEAD 的复验

| 旧结论（线索） | HEAD 复验 | 证据 | 状态 |
|---|---|---|---|
| W1：CLI / MCP 复用 core，但站点装配不同：CLI `assembleFromConfig` 按 format 分派，MCP 直接 `assembleSite` | 成立 | `cli.ts:241-247,584-590`；`server.ts:287-293,319-324`；`demo/tests/td-site.test.ts:226-275` 钉住 CLI 分派；MCP 无 TD 分派是 E1 | `implemented` |
| W1：版本号父分配；首次 pack 对齐 run，之后 next；create/build 的 site 等于 pack | 成立 | `create-game.ts:437-441`；`cli.ts:245-247`；`server.ts:291-293`；测试 `create-game.test.ts:162-174`、`cli-create.test.ts:284-308` | `implemented` |
| W1：失败语义按段分裂（理解现场 / pack 现场 / config 删除 / QA 先落报告再抛 / 站点不产） | 成立 | §1.4 | `partial`（QA/site 无失败记录） |
| W1：MCP **不做** `asCommandError` 翻译，裸 Error 一律 1 | 成立 | `server.ts:338-360`；`command.ts:88`；五个错误类均 `extends Error` | `partial`（静态；无测试） |
| W4：QA `checked` 恒 5/6，`layer-coverage` 无族，`qaVerdict` 恒 `incomplete`，闸门只看 error | 成立 | `qa/src/assemble.ts:85-100`；`qa.ts:374-378`；`create-game.ts:215-226`；测试 `qa/tests/assemble.test.ts:71-80`、`create-game.test.ts:575-587` | `implemented` |
| W4：Visual QA 不读图片；`inspect` 是免费观察；`review` 是付费手动、不阻断 | 成立 | `qa/src/visual.ts:84-174`；`create-game.ts:509-519`；`assets/src/review.ts:100-170`；`pipeline/src/review.ts:76-142` | `implemented` |
| W4：`site` 独立命令不读 `qa-report.json`，可绕过 QA | 成立 | `demo/src/site.ts:191-221`；`cli.ts:575-591`；`server.ts:319-324` | `implemented` |
| W4 引用 18a 的真实 `qa-report.json` 说 inspect 未跑 | **HEAD 行为已不同**：`runBuild` 现在会调 `inspectPack` 并把 `ok` 观察传进 QA（`create-game.ts:509-519`）；18a 那份产在接线之前 | `qa/src/assemble.ts:95-100`；`create-game.test.ts:769-800` | `partial`（旧 E3 不可当 HEAD 证据） |

---

## 3. 可复用报告格式清单

| 路径 / 格式 | schema | 生产者 | 消费者 | 是否含证据字段 | 状态 |
|---|---|---|---|---|---|
| `out/<gameId>/pack/v<M>/manifest.json` `assetpack/v4` | strict Zod，`assetpack.ts:265-333` | `pack.ts` | `verify` / `inspect` / `site` / `qa` / shell | **是**：`id`/`version`/`createdAt`/`generator`/`atlases[].checksum`/`assets[]`（size/anchor/frames/animations/authoring）/`palette`/`files[].checksum` | `implemented` |
| `pack/v<M>/ledger.json` `assetpack-ledger/v1` | `ledger.ts:156-180` | `pack.ts` | `verify`（schema + pack 一致性）、人 | **是**：`packId`/`packVersion`/`createdAt`/`run.wallClockMs`/`byStep`/`calls[]`（step/target/attempts/failures/ms/model/requestId/usage） | `implemented` |
| `run/v<N>/ledger.json` `run-ledger/v1` | `run-ledger.ts:19-34` | `pipeline/create-game.ts` | `pipeline`（并集）、`review`（追加）、人 | **是**：`gameId`/`runVersion`/`createdAt`/`run`/`calls[]`；**没有** `packVersion`/`siteVersion` | `partial` |
| `pack/v<M>/coverage.json` `assetpack-coverage/v1` | `coverage.ts:25-30` | `pack.ts` | `site.ts`、`inspect` | **是**：`packId`/`packVersion`/`layers[]`（asset/frame/w/h/opaque/ratio） | `implemented` |
| `pack/v<M>/master-ratios.json` `assetpack-master-ratios/v1` | `master-ratio.ts:41-49` | `pack.ts` | `verify`、CLI 摘要 | **是**：`packId`/`packVersion`/`masters[]`（requested/returned/ratioDelta/match） | `implemented` |
| `run/v<N>/qa-report.json` `qa-report/v1` | strict Zod + 4 条 refine，`qa.ts:266-319` | `pipeline/create-game.ts`（内容由 `qa/assemble.ts` 合成） | CLI / MCP 摘要、人、将来的修复循环 | **是**：`checked[]`、`failures[]`（judgement/target/detail/severity）、`observations[]`（source/outcome/lines 或 reason）；**没有身份/checksum/time** | `implemented`（格式）/ `partial`（追溯） |
| `run/v<N>/asset-recipe.plan.json` `asset-plan/v1` | `asset-plan.ts:67-75` | `planAssets` | 人、规划审计 | **是**：`recipeId`/`recipeVersion`/`plannerVersion`/`capabilities`/`inputs`/`assets[].route+reason` | `implemented` |
| `run/v<N>/game-config.json` `game-config/v1` | `game-config.ts:29` | `compileRuntime` | site / QA / shell | **是**：实体、引用、世界、目标；无生成 provenance | `implemented` |
| `site/v<K>/site.json` 无契约 schema | 无 Zod；`layout.ts:114-116` 直接写 | `demo/src/layout.ts` | `demo/src/shell/entry.ts` | 仅 `shell` / `pack` / `config`；无 run/qa/checksum | `partial` |
| `CommandResult`（CLI `--json` / MCP `structuredContent`）无 format tag | TS 类型，`command.ts:13-21` | 所有 core ops | CLI / MCP | **是**：`summary`、`data`（各命令自由形状）、`artifacts[]` 相对路径 | `implemented`（信封）/ `partial`（`data` 无统一 schema） |
| `design-attempts.json` / `visual-world-attempts.json` | `run-design-attempts/v1` / `run-visual-world-attempts/v1` | `compile-design` / `analyze-reference`，经 pipeline 写入失败现场 | 人、测试 | **是**：每发 `attempt`/`outcome`/`detail`/`raw?`/`rejections?` | `implemented`（失败现场） |
| 失败现场 `failed-*` / `.failed-*` | 无格式 | `run.ts` / `pack.ts` | 人 | 有产物、账、原图、prompt、drawlist、master-ratios；无 `error.json` / stage | `partial` |
| 实验 `result.json` / `budget-report.md` | 无 schema | `.scratch/**/*.mjs` harness | 人 | 有 model/api/proxy/帧读数/预算；无 commit/baseline/pack 外键 | `partial` |

**判断**：`qa-report/v1` 是唯一一份**裁决报告**；`manifest` + 三份包 sidecar 是**交付证据**；
`run-ledger` 是**花费证据**；`CommandResult` 是**壳层信封**。这四类已经够用，缺的是把它们串起来的一张索引。

---

## 4. 推荐的最小数据关联方案

### 4.1 可直接复用的现有字段（不新增）

| 需求 | 直接复用 | 位置 |
|---|---|---|
| 包身份 | `manifest.id` + `manifest.version` | `assetpack.ts:265-269` |
| 包内容证据 | `manifest.files[].checksum` + `manifest.atlases[].checksum` | `assetpack.ts:253-263,299` |
| 包构建时间 / 生成器 | `manifest.createdAt` / `manifest.generator` | `assetpack.ts:270-271` |
| 包花费 | `ledger.packId` / `packVersion` / `calls[]` | `ledger.ts:156-180` |
| run 身份 | run 目录 `v<N>` + `run-ledger.gameId` / `runVersion` | `run-ledger.ts:19-34`；`run.ts:75-94` |
| site 身份 | `site.json.pack` / `shell` / `config` + `site/v<K>` 目录 | `layout.ts:114-116` |
| QA 裁决 | `checked` / `failures[].{judgement,target,detail,severity}` / `observations` | `qa.ts:266-319` |
| 阶段词汇 | `LedgerStep`（上游步） + `CreateStep`（链步：`visual-world`/`intent`/`design`/`character-dna`/`recipe`/`pack`/`config`/`qa`） | `ledger.ts:21-78`；`create-game.ts:39-42` |
| 资源 / 帧词汇 | 资源 `id`、`Animation.name`、`FrameRef.name` | `assetpack.ts:150-162,164-193` |
| 失败当场信息 | `Carried.ledger` / `failureDir`；`CommandResult.artifacts` | `command.ts:114-151`；`command.ts:13-21` |

### 4.2 必须新增的最小字段（建议）

**一份 run 级 sidecar，而不是第三本账：**

`out/<gameId>/run/v<N>/builds/v<M>.json`，format `run-build-record/v1`：

```json
{
  "format": "run-build-record/v1",
  "createdAt": "2026-10-21T...",
  "gameId": "...",
  "runVersion": 1,
  "attempt": 1,
  "inputs": {
    "intentMd":     { "path": "intent.md",     "checksum": "sha256:..." },
    "recipe":       { "path": "asset-recipe.json", "checksum": "sha256:..." },
    "gameDesign":   { "path": "game-design.json",  "checksum": "sha256:..." },
    "visualWorld":  { "path": "visual-world.json", "checksum": "sha256:..." }
  },
  "pack": {
    "id": "...", "version": 2,
    "manifest": { "path": ".../pack/v2/manifest.json", "checksum": "sha256:..." },
    "ledger":   { "path": ".../pack/v2/ledger.json",   "checksum": "sha256:..." },
    "coverage": { "path": ".../pack/v2/coverage.json", "checksum": "sha256:..." }
  },
  "qa": {
    "path": "qa-reports/v2.json",
    "checksum": "sha256:...",
    "verdict": "incomplete",
    "errors": 0,
    "warnings": 0
  },
  "site": { "version": 2, "dir": ".../site/v2", "siteJsonChecksum": "sha256:..." },
  "stages": [
    { "step": "pack",   "status": "ok" },
    { "step": "config", "status": "ok" },
    { "step": "qa",     "status": "ok" }
  ],
  "error": {
    "kind": "invalid", "stage": "qa", "message": "...",
    "file": "run/v1/qa-report.json", "resource": "enemy-wasteland", "frame": "enemy-wasteland.patrol1"
  }
}
```

要点：

- **join key**：`runVersion → pack.version → site.version → qa.path`，这是今天完全缺失的四元组。
- **checksum 只新增三个**：`manifest.json`（自身不在 `files[]`，必须补）、`qa-report.json`（补身份/防篡改）、
  输入文件（`intent.md` / `asset-recipe.json` / `game-design.json` / `visual-world.json`）。
  包内文件**不重复哈希**——直接用 `manifest.files[]` / `atlases[]`。
- **`qa` 只存派生计数，不复制 findings**。需要详情就读 `qa.path`；避免第二份真相。
- **`stages` 复用 `CreateStep`**，不另造阶段枚举。若 sidecar 契约要住 `contracts`，把
  `RUN_STAGES` 定义在 `contracts`、让 pipeline 的 `CreateStep` 从它派生（今天 `CreateStep` 在
  `pipeline/create-game.ts:39-42`，contracts 不能反向依赖 pipeline）。
- **`error` 只在失败时出现**；成功时键缺席（与账本「缺席 == 没发生」同一条纪律，`ledger.ts:81-88,142`）。

**失败记录**：在理解层 / pack / build 三个 catch 边界写同一形状的 `failure.json` 到失败现场
（理解层与 pack 已有 `failureDir`），字段复用上面的 `error`。不要在每个 `throw` 点改造；
只在知道 `stage` 的两个边界（`runUnderstanding`、`runBuild`）填一次。

**QA 报告版本化**（二选一，需人裁）：

- 最小：只加 `builds/v<M>.json`，`qa.path` 仍指 `run/v<N>/qa-report.json`；**接受旧 QA 报告被覆盖**，
  build record 只能证明「当时那份的 checksum」，不能回读旧 findings。
- 推荐（若要比较 attempt）：把 QA 报告写进 `run/v<N>/qa-reports/v<M>.json`，并让 `BuildResult.paths.qaReport`
  指过去；顶层 `qa-report.json` 可作为「最新一份」的兼容副本或干脆保留旧路径给旧消费者。
  这需要改 `RUN_ARTIFACT.qaReport` 的落点，属于 Phase 1 的最小路径改动，不能在调查阶段做。

### 4.3 明显不该新增的东西

| 不要做 | 理由 | 证据 |
|---|---|---|
| 第三本账 / 验收账 | 已有 run 账（总花费）与 pack 账（包收据），再加一本必然漂移 | `run-ledger.ts:1-13`；`pack.ts:1088-1112` |
| 把 `qa-report` 扩成 v2 塞 `packVersion` / `createdAt` | `qa-report/v1` 是 strict；`status` / `createdAt` / `repairAttempts` 都被**故意**排除；升版会让磁盘上已有报告解析不过 | `qa.ts:258-265`；`qa.test.ts:100-117` |
| 新建一个「统一验收报告」复制 `failures[]` | 第二份真相；修复循环会不知道读哪一份 | `qa.ts:340-354`（`buildQAReport` 是唯一装配点） |
| 在 `manifest` 里加 run / report 字段 | `AssetPackManifest` 是 `.strict()`，加字段要升 `assetpack` 版本；sidecar 是既有逃生路径 | `ledger.ts:1-9`；`coverage.ts:1-9`；`master-ratio.ts:12-17` |
| 给每个文件重新算 hash | `manifest.files[]` 已经覆盖除 manifest 外全部文件；重算只是重复工作 | `assetpack.ts:298-299`；`ops.ts:1672-1679` |
| 把实验 `result.json` 当成产品的验收报告 | 它是 harness 自由格式，没有 schema、没有 run/pack 外键 | §2.5 |

### 4.4 重复账本 / 报告的现状与风险

| 现状 | 是否重复 | 判断 |
|---|---|---|
| `pack/v<M>/ledger.json` + `run/v<N>/ledger.json` | 内容重叠（run 是理解段 ∪ 本次构建；pack 是本次构建） | **不是错误**，口径不同（`run-ledger.ts:1-7`）；但 QA 失败时 run 账不更新，会让「run 总花费」少一段 |
| `coverage.json` / `master-ratios.json` 里的 `packId+packVersion` | 与 manifest 重复 | **必要冗余**：sidecar 不在 manifest 里，必须自证属于哪个包；`verify` 也会核对 |
| `master-ratios.json` + 每张母版 `.ratio.json` | 汇总与逐项 | 有意的「汇总 + 单点证据」，不算重复报告 |
| `qa-report.observations[].lines` 抄 `inspect.summary` | 文本复制 | 契约明确说「原样搬，不重算」（`qa.ts:218-223`）；可接受，但它不可结构化查询 |
| 实验 `result.json` 与 `budget-report.md` | 机器 / 人两份 | 无共享 ID；不是产品报告，风险低但无法交叉引用 |
| **新增 build record 若复制 `failures[]` / `calls[]`** | 会变成第三份 | **必须避免**：只存路径 + checksum + 计数 |

---

## 5. 逐题回答（任务书 §4.7）

### 5.1 当前是否有统一的错误模型？ — `partial`

有壳层统一模型：`CommandError` + `EXIT` + `Carried` + `CommandResult`（`command.ts:13-21,46,67-151`）。
但 core 里 `pack` 的判断大量抛裸 `Error`（`pack.ts:813-816` 等 11 处），
理解层五个错误类都 `extends Error`，两个壳对它们的处理不一致（CLI 翻译、MCP 不翻译）。
所以「统一」只到出口，不到抛点。

### 5.2 错误是否能够携带文件、资源和阶段信息？ — `partial`

- **资源**：文案里常带；QA 的 `target` 与 ledger 的 `target` 是结构化的。
- **文件**：`verify` 有包内路径；部分 pack 错误有绝对路径；`failureDir` 有目录；其余没有。
- **阶段**：ledger 的 `step` 与 progress 的 `CreateStep` 有；错误对象没有；progress 不落盘。
- **帧**：文案里能到「第 N 格 / 第 r 行 c 列 / 检测到 N 块 / drawlist frame」；没有结构化 `frame` 字段。
  `image` 的 ledger `target` 实际上只写资源 id，连动画都到不了（`pack.ts:734`）。

### 5.3 失败任务是否保存已有产物与执行记录？ — `partial`

理解层 / pack 会改名保留现场（`run.ts:108-117`；`pack.ts:288-318`），现场有已经产出的文件与账；
QA 报告先落盘再抛（`create-game.ts:539-545`）。但：
QA / site 失败没有 `failureDir`；config staging 被删；run ledger 在 QA 失败时不更新；
进度只在 stderr / MCP 通知；pack 失败现场只保留最近一份。见 §1.4。

### 5.4 是否能关联一次生成运行与具体资源？ — `partial`

`<out>/<gameId>/run/v<N>` 与 `pack/v<M>` 同树，`asset-recipe.json` 列资源 id，`manifest.assets[]` 列产物，
所以**人**能通过目录与 id 对上。但**文件之间没有外键**：run ledger 无 `packVersion`，manifest 无 `runVersion`，
pack ledger 无 run id，QA 报告无任何身份。多次 attempt 时（`pack/v1`、`pack/v2`）只能靠时间猜。见 §2.2。

### 5.5 是否有稳定的资源版本标识？ — 包级 `implemented` / 资源帧级 `partial`

包级：`(id, version)` + `files[].checksum` + `atlases[].checksum`，版本目录绝不覆盖
（`assetpack.ts:265-299`；`pack.ts:1296-1298`）。资源 / 动画 / 帧没有独立版本或 checksum；
帧身份 = 包版本 + `FrameRef.name`。`manifest.json` 自身不被 `files[]` 覆盖（`assetpack.ts:298`），
所以没有「整包 manifest 短摘要」；`verify` 也不在链上自动跑。

### 5.6 是否已经存在可复用的 JSON 报告格式？ — `implemented`

`qa-report/v1`、`assetpack/v4`、`assetpack-ledger/v1`、`run-ledger/v1`、`assetpack-coverage/v1`、
`assetpack-master-ratios/v1`、`asset-plan/v1`、`CommandResult`。见 §3。

### 5.7 新增验收报告应扩展还是独立？ — 建议「独立的最小索引 sidecar」

不要扩 `qa-report/v1`（strict、故意不含 `createdAt` / `status`）；不要新造一份复制 findings 的「统一报告」。
新增 `run-build-record/v1` 作为**索引 / 证据清单**，引用现有报告与 ledger；需要人看的摘要由读侧
（CLI / Markdown 渲染）从索引 + `qa-report` 生成，不落第二份。

### 5.8 是否会造成新的重复账本或重复报告？ — 现状 `partial`，方案可避免

今天已有两本账（run / pack），是设计不是 bug；新增 build record **只存外键和 checksum**，
不复制 `calls[]` / `findings[]`，就不会造出第三本账。风险点是：
QA 报告版本化时若同时保留顶层副本，会产生两份 findings；必须在 Phase 1 明确「哪一份是权威」。
实验 `result.json` 与 `budget-report.md` 也应只作证据引用，不并入产品报告。

---

## 6. 能力状态汇总

| 能力 | 状态 | 关键证据 |
|---|---|---|
| 壳层统一错误信封 / 退出码 | `implemented` | `command.ts:13-21,46,67-151`；`cli.ts:207-218,617-641`；`server.ts:338-360` |
| 结构化错误定位（file/resource/stage/frame） | `partial` | §1.3；`pack.ts:813-816,923-930,953-966`；`qa.ts:168-175` |
| 失败现场保留 | `partial` | `run.ts:108-117`；`pack.ts:288-318`；`create-game.ts:371-397`；17c E3 |
| run → pack / site 外键 | `missing` | `run-ledger.ts:19-34`；18a E3 |
| pack 身份 / checksum | `implemented` | `assetpack.ts:265-299`；`ops.ts:1672-1679` |
| 资源 / 动画 / 帧身份 | `partial` | `assetpack.ts:150-193`；`pack.ts:1221` |
| QA 报告格式 / 裁决 | `implemented` | `qa.ts:266-378`；`qa.test.ts` 31 项 |
| QA → pack / run 身份 | `missing` | 18a `qa-report.json`；`qa.ts:258-265` |
| 报告格式复用 | `implemented` | §3 |
| 实验记录追溯 | `partial` | 2026-10-21 `result.json` / `budget-report.md`；17c `run-*.json` |
| 自动 verify 在链上 | `missing` | `ops.ts:1662-1726`；`pack.ts:1283-1287` |
| 失败结构记录（error.json / stage） | `missing` | §1.4 |

---

## 7. 未验证 / 风险 / 阻塞

1. **MCP 的理解层退出码差异**：静态 E1 清楚（`server.ts:338-360` + 五个 `extends Error`），
   但没有测试把 `create_game` 跑死在 design/vision 错误上并断言 `_exitCode`。
   状态：`unverified`（动态行为），不建议为验证而发起付费跑。
2. **CLI 理解层丢 `failureDir`**：静态 E1 清楚（`create-game.ts:394-396` vs `cli.ts:207-218`），
   但没有测试断言「理解层失败时 CLI `--json` 里没有 `failureDir`」；状态：`unverified`（动态行为）。
3. **QA 失败时 run ledger 不更新**：E1 明确（`create-game.ts:544` 早于 `:549-551`），
   但没有归档的「QA 硬失败」run 做 E3；现有 QA 失败测试只断言报告落盘 / 退出码。
   状态：`unverified`（E3 缺口）。
4. **`qa-report.json` 重跑覆盖**：E1 + `create-game.test.ts:162-174` 证明第二次 attempt 会得到 pack/v2；
   没有测试直接断言旧 qa-report 字节变了。状态：`unverified`（行为本身是 E1 可推导）。
5. **`run.wallClockMs` 语义在构建后被改写**：E1（`create-game.ts:443,603-613`），无测试；
   需要人裁这是 bug 还是「最近一次 attempt 的耗时」。
6. **真实 HEAD 端到端未跑**：本轮零付费、不写 `out/`；所有 HEAD 结论来自源码 + 本地测试。
   真实产物（18a / 17c / v7）产在 HEAD 之前或来自实验 harness，不能当 HEAD 的 E3。
7. **W4 的真实 `qa-report.json` 已过时**：18a 那份产在 `inspect` 接线之前；HEAD 的 `runBuild` 会调
   `inspectPack`（`create-game.ts:509-519`），因此不能拿它证明 HEAD 的观察内容。
8. **`pack` 失败现场只保留最近一份**（`pack.ts:300-301`），历史失败不可回读；这是设计选择，
   但会影响「多次实验比较」的追溯。
9. **`review` 观察不落盘**（`pipeline/review.ts:126-142`），且账的 `target` 只有包 id
   （`assets/review.ts:114-117`）；如果视觉审查要进验收报告，必须新增持久化落点。

---

## 8. 本轮实际运行的命令与结果

只跑定向测试；未跑 `pnpm check` / `pnpm build`；未写 `out/`；未发起任何上游调用。

| 命令 | 结果 |
|---|---|
| `pnpm exec vitest run packages/contracts/tests/carried-error.test.ts packages/contracts/tests/qa.test.ts packages/cli/tests/cli.test.ts` | 3 files / **65 tests passed** |
| `pnpm exec vitest run packages/pipeline/tests/run.test.ts packages/pipeline/tests/create-game.test.ts` | 2 files / **51 tests passed** |
| `pnpm exec vitest run packages/cli/tests/cli-create.test.ts packages/mcp/tests/server.test.ts packages/demo/tests/site.test.ts packages/assets/tests/ledger.test.ts` | 4 files / **75 tests passed** |
| `pnpm exec vitest run packages/qa/tests/assemble.test.ts packages/pipeline/tests/review.test.ts` | 2 files / **18 tests passed** |

合计 **11 个测试文件 / 209 项通过**。这些测试覆盖：
错误携带（`carried-error.test.ts`）、QA 契约（`qa.test.ts`）、CLI 退出码与失败现场（`cli.test.ts`）、
run 生命周期（`run.test.ts`）、构建 / 版本 / QA 阻断（`create-game.test.ts`）、
CLI 端到端（`cli-create.test.ts`）、MCP 工具面与失败回复（`server.test.ts`）、
站点装配（`site.test.ts`）、包账本（`ledger.test.ts`）、QA 合成器（`assemble.test.ts`）、
review 记账（`review.test.ts`）。

---

## 9. 证据索引

源码：

- `packages/contracts/src/command.ts`（错误信封 / 退出码 / Carried）
- `packages/contracts/src/structured-call.ts`（`CallFailure` 闭集 / `parseToolUse`）
- `packages/contracts/src/ledger.ts`、`run-ledger.ts`、`coverage.ts`、`master-ratio.ts`、`asset-plan.ts`
- `packages/contracts/src/qa.ts`（`qa-report/v1`）
- `packages/contracts/src/assetpack.ts`（`assetpack/v4`）
- `packages/contracts/src/zod-issues.ts`（`formatIssues`）
- `packages/pipeline/src/create-game.ts`（两段 / QA 阻断 / run ledger）
- `packages/pipeline/src/run.ts`（run 身份 / 失败现场）
- `packages/pipeline/src/artifacts.ts`（九项文件名）
- `packages/pipeline/src/review.ts`（review 记账 / 观察）
- `packages/assets/src/pack.ts`（包构建 / 失败现场 / 包账）
- `packages/assets/src/ops.ts`（packAssets / verifyPack / inspectPack / 失败渲染）
- `packages/cli/src/cli.ts`、`packages/mcp/src/server.ts`
- `packages/demo/src/layout.ts`、`site.ts`、`shell/entry.ts`
- `packages/qa/src/assemble.ts`、`visual.ts`、`gameplay.ts`

测试：

- `packages/contracts/tests/carried-error.test.ts`、`qa.test.ts`
- `packages/cli/tests/cli.test.ts`、`cli-create.test.ts`
- `packages/pipeline/tests/run.test.ts`、`create-game.test.ts`、`review.test.ts`
- `packages/mcp/tests/server.test.ts`
- `packages/demo/tests/site.test.ts`
- `packages/assets/tests/ledger.test.ts`
- `packages/qa/tests/assemble.test.ts`

真实产物：

- `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/`
  （run/v1、pack/v1+v2、site/v1；`site.json.pack="v2"`；`qa-report.json` 无身份）
- `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-17d/wasteland-scavenger-assets/site/`
  （v1–v3 三份站点都指 pack v1）
- `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-17c/wasteland-scavenger-assets/failed-2026-10-17T03-03-43-155Z/`
  （33 个文件：原图 / prompt / drawlist / ledger / master-ratios；无 error.json）
- `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
  （manifest 19 资源 / 76 帧；ledger 0 调用；coverage 3 层）
- `.scratch/asset-integration-v1/runs/2026-10-21{a,c,d,e,f}-*/result.json` 与 `budget-report.md`

旧线索（只作入口，已按 HEAD 复验）：

- `.scratch/p0-00-audit/research/w1-call-graph.md`
- `.scratch/p0-00-audit/research/w4-qa-capability.md`
