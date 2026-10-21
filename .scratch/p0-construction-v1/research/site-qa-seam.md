# 05 R1 · `site` / `assemble_site` 与 QA 的接缝（事实底座）

- 票：`.scratch/p0-construction-v1/issues/05-r1-site-qa-seam.md`
- 日期：2026-10-21 · 分支 `p0-construction-v1` · HEAD `70631af`
- 性质：只读调查；零上游、零付费；未运行真实 `create` / `pack` / `understand` / `site`；未改代码、契约、包、fixture、站点。
- 证据等级沿用地图：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径）。
- 本文件是票 09（发布闸门统一）的事实输入；**推荐方案在本文件 §8，票 09 的逐项变更清单仍须单独报批**（地图 Q5）。

---

## 0. 结论先行

1. **正常链上 QA 不缺上下文，独立发布路径缺。** `create --yes` / `build` 在 `runBuild` 里同时拥有 `runDir`、`packDir`、`configPath`、`intentPath`、`designPath`、`recipePath`（`packages/pipeline/src/create-game.ts:521-528`），QA 默认就在那里跑。CLI `site` 与 MCP `assemble_site` 只拿到 `packDir + configPath + outRoot`（`packages/cli/src/cli.ts:642-648`、`packages/mcp/src/server.ts:203-213,386-393`），**没有 runDir，也没有 intent/design/recipe**。
2. **就地在 `site` 里重跑 QA（方案 B）成本极低，但上下文不够。** QA 三族只读 JSON，零上游（`packages/qa/package.json:13-14`、`packages/qa/src/visual.ts:84-91`、`gameplay.ts:71-74`、`intent.ts:81-87`）；实测合成器一次 24–125ms，`inspectPack` 对 89MB 的 v7 包 0.58s（E3，§2.4）。但只有 `pack + config` 时，默认合成器会因视觉族读不到 recipe、意图族读不到 intent/design 而**直接抛**（`visual.ts:85-88`、`intent.ts:81-87`）；即使只跑玩法族，也只有 2/6、必然 `incomplete` ⇒ **不能**在发布路径独立产出一份可通过的报告。B 必须新增 `runDir` 入参，且旧的无 run 手工 `site` 永远无法使用。
3. **现有 `qa-report/v1` 没有任何包身份。** 字段只有 `format / checked / failures / observations`（`packages/contracts/src/qa.ts:266-320`）；`observations` 的 `source` 是闭集（只允许 `inspect` / `review`，`qa.ts:212`），塞不进身份。**「报告属于哪个 pack」今天只能靠它所在目录猜**。
4. **`manifest.id + manifest.version` 是当前最可靠的包身份；`files[].checksum` 是内容指纹；`run-ledger` 的 `packVersion` 不存在。** `RunLedger` 只有 `gameId / runVersion / createdAt / run / calls`（`packages/contracts/src/run-ledger.ts:19-34`），`writeRunLedger` 也不写 `packVersion`（`create-game.ts:603-613`）。带 `packId + packVersion` 的是**包内** `ledger.json`（`packages/contracts/src/ledger.ts:156-159`）与 `coverage.json`（`packages/contracts/src/coverage.ts:25-30`）。
5. **推荐 A + C 组合**：报告携带 `subject: { packId, packVersion }`（A），发布路径按身份查找/校验；对 out 树之外的包提供显式 `--qa-report` / `qaReportPath`（C）作为定位手段，但仍强制校验 `subject`。**不推荐把 B 作为默认**：上下文不成立、无 run 手工工作流无解、TD 不支持、且会重复跑 QA。
6. **`2026-10-20e-site` 没有 `qa-report.json` 是流程/架构问题，不是路径问题。** 那棵 out 树里根本没有 `run/` 目录；包 v6/v7 来自另一棵只含 `pack/` 的交付目录；`site` 从不跑 QA，`pack` 也不跑 QA（§7）。

---

## 1. 入口与入参事实表

### 1.1 CLI `site`

| 项 | 事实 | 证据 |
|---|---|---|
| 用法 | `game-maker site <资源包目录> --config <关卡配置> [--shell <shell.js>] [--out <目录>] [--json]` | `packages/cli/src/cli.ts:29` |
| 位置参数 | 第一个位置参数是 pack 目录 | `packages/cli/src/cli.ts:634` |
| 必填 flag | `--config`；可选 `--shell`、`--out`、`--game-id` | `packages/cli/src/cli.ts:635-647`、`takesValue` `:90-96` |
| 实际调用 | `assembleFromConfig({ packDir, configPath, shellJsPath, outRoot, gameId? })` | `packages/cli/src/cli.ts:642-648` |
| runDir | **不可得** | 同上；签名里没有 |
| QA | **不读、不跑**；只做 `assembleFromConfig` 的装配期审计 | `packages/cli/src/cli.ts:633-649` |
| 格式分派 | 按 config 的 `format` 分派横版 / 塔防 | `packages/demo/src/assemble.ts:53-66` |

### 1.2 MCP `assemble_site`

| 项 | 事实 | 证据 |
|---|---|---|
| 工具名 | `assemble_site` | `packages/mcp/src/server.ts:196` |
| inputSchema | `packDir`、`configPath`（required）；`shellPath`、`outDir`、`gameId`（optional） | `packages/mcp/src/server.ts:203-213` |
| 实际调用 | `assembleSite({ packDir, configPath, shellJsPath, outRoot, gameId? })` | `packages/mcp/src/server.ts:386-393` |
| runDir | **不可得** | 同上 |
| QA | **不读、不跑** | `packages/mcp/src/server.ts:386-393` |
| 格式 | 只调 `assembleSite`（横版），不分派塔防 | `packages/mcp/src/server.ts:13,386-393` |

### 1.3 CLI `create --yes` / `build`

| 项 | 事实 | 证据 |
|---|---|---|
| `build` 入参 | 只吃 `<run 目录>`；`--out`、`--shell`、并发 flag | `packages/cli/src/cli.ts:555-565` |
| 共用构建 + 站点 | `buildAndSite()`：先 `runBuild`，再 `assembleFromConfig` | `packages/cli/src/cli.ts:235-259` |
| runDir | **可得**（`build` 的位置参数 / `create` 的 `understanding.run.dir`） | `packages/cli/src/cli.ts:548-549,557-560` |
| 站点版本 | 用 `built.packVersion` 显式透传（父指定、子不自算） | `packages/cli/src/cli.ts:252-259` |
| QA | `runBuild` 默认跑；硬失败先落盘再抛，站点不产 | `packages/pipeline/src/create-game.ts:507-544`、`assertQaPassed:215-226` |

### 1.4 MCP `create_game`

| 项 | 事实 | 证据 |
|---|---|---|
| inputSchema | `stylePath`、`intent`（required）；`outDir`、`styleId`（optional） | `packages/mcp/src/server.ts:153-162` |
| 实际调用 | `runUnderstanding` → `runBuild` → `assembleSite` | `packages/mcp/src/server.ts:336-361` |
| runDir | **可得**（`understanding.run.dir`，`runBuild` 也返回） | `packages/mcp/src/server.ts:348-355` |
| QA | 由 `runBuild` 默认跑；MCP 无 `qa: null` 开关 | `packages/mcp/src/server.ts:348-354`、`packages/pipeline/src/create-game.ts:200-201` |

### 1.5 非发布入口（事实澄清）

- CLI `pack` 只调 `packAssets`，**不跑 QA**（`packages/cli/src/cli.ts:582-600`）。
- `compile-runtime` 只做 `auditGameConfig + auditScreenSpace + auditLayerCoverage`，**不跑 QA、不跑 reachability**（`packages/assets/src/ops.ts:1047-1051`）。
- `assembleSite` 是 `@game-maker/demo` 的公开导出（`packages/demo/src/index.ts:6`），库调用方可绕过两个壳；P0 的「发布路径」按票面只算 CLI / MCP 五个入口，但这一点应写进 09 的残余风险。

---

## 2. QA 真正需要什么，与 site 的上下文重合多少

### 2.1 `QaContext` 的七项

`packages/contracts/src/qa.ts:436-458`：

| 字段 | 用途 | 谁读 | site 拿得到吗 |
|---|---|---|---|
| `runDir` | 运行目录（路径本身） | 契约字段；各族不直接读，各产物路径逐项给 | **否**（site 入参没有） |
| `packDir` | 包目录 | 视觉族、玩法族 | **是** |
| `configPath` | 已落盘的 `game-config.json` | 玩法族 | **是**（`--config`） |
| `intentPath` | `game-intent.json` | 意图族 | **否** |
| `designPath` | `game-design.json` | 意图族 | **否** |
| `recipePath` | `asset-recipe.json` | 视觉族 | **否** |
| `gameId` | 身份 | 契约字段；合成器只透传 | 可由 `manifest.id` 推出（`site.ts:183`） |
| `inspectObservation`（可选） | 免费 inspect 观察 | 合成器原样装配 | **否**（site 不调 `inspectPack`） |

各族实际读的东西：

- 视觉族：`asset-recipe.json` + `pack/manifest.json` + manifest 指向的创作态 drawlist（`packages/qa/src/visual.ts:84-91,110-151`）。
- 玩法族：`pack/manifest.json` + `game-config.json`（`packages/qa/src/gameplay.ts:71-74`）。
- 意图族：`game-intent.json` + `game-design.json`（`packages/qa/src/intent.ts:81-87`）。
- `inspect` 观察：由 pipeline 调 `inspectPack` 后塞进 `QaContext`（`packages/pipeline/src/create-game.ts:511-518`）；`inspectPack` 会解 PNG（`packages/assets/src/ops.ts:1905`），但免费。

### 2.2 重合度结论

- site / `assemble_site` 的上下文 = `packDir + configPath + outRoot + gameId?`。
- QA 的上下文 = 上面这些东西 **+ run 目录里三份文书（intent / design / recipe）+ 可选 inspect 观察**。
- **只有 pack + config 时**：默认合成器会因三族并发里视觉族 / 意图族读不到文件而**直接抛**（`packages/qa/src/visual.ts:85-88`、`packages/qa/src/intent.ts:81-87`）；即使只接玩法族两条（`reference-resolution`、`reachability`），`layer-coverage` 仍不归任何族（`packages/qa/src/assemble.ts:89`）⇒ 最多 `checked=2/6`，`qaVerdict` 必为 `incomplete`（`packages/contracts/src/qa.ts:374-377`）。
- 因此：**B（发布路径就地重跑 QA）不是「成本问题」，是「上下文问题」**；要跑满 6/6（票 08 之后）必须拿到 run 目录里的三份文书。

### 2.3 包本身有没有 recipe / intent / design？

没有。以 v7 包为例，`authoring/` 下只有 `drawlist / generated / imported / masters / stylespec.json / visual-world.json`；全包没有 `asset-recipe.json`、`game-intent.json`、`game-design.json`（E3：`find` 结果为空）。这三份只在 `run/v<N>/` 里（`packages/pipeline/src/artifacts.ts:14-26`）。

### 2.4 重跑 QA 的成本（E3，免费、只读）

命令与读数（都在归档产物上跑，不写任何文件）：

```text
node packages/cli/dist/cli.mjs inspect <v7 pack> --json     exit=0  real 0.58s   (89MB 包)
node packages/cli/dist/cli.mjs verify  <v7 pack> --json     exit=0  real 1.26s   (157 文件)
qaRunner(run-out-2026-10-18a/run/v1, pack/v1)               checked=5 failures=1  24ms
qaRunner(run-out-2026-10-18a/run/v1, pack/v2)               checked=5 failures=0  31ms
```

QA 本体只解析 JSON；`inspectPack` 解 PNG 是唯一的重活，实测 0.58s / 89MB。**成本不是 B 的障碍**。

---

## 3. 发布路径能否定位 `run/v<N>/qa-report.json`

### 3.1 目录约定

- run：`<out>/<gameId>/run/v<runVersion>/`（`packages/pipeline/src/run.ts:68-99`）。
- pack：`<out>/<gameId>/pack/v<packVersion>/`（`packages/assets/src/pack.ts:333`、`packages/demo/src/layout.ts:78`）。
- site：`<out>/<gameId>/site/v<siteVersion>/`（`packages/demo/src/layout.ts:85-97`）。
- QA 报告：固定写 `run/v<N>/qa-report.json`（`packages/pipeline/src/artifacts.ts:24`、`create-game.ts:542-544`）。

### 3.2 从 packDir 反推 runDir：只能启发式，不能可靠

- 如果 packDir 是规范布局 `<out>/<id>/pack/v<M>`，可以取 `gameDir = dirname(dirname(packDir))`，再扫 `<gameDir>/run/v*/`。
- **但 runVersion 与 packVersion 不保证相等。** 首次 attempt 对齐；同一 run 重跑构建时，`pack/v<runVersion>` 已存在 ⇒ `packVersion = nextPackVersion(...)`（`packages/pipeline/src/create-game.ts:437-441`、`packages/assets/src/pack.ts:250-255`）。真实归档 18a 就是 **run/v1 + pack/v1 + pack/v2** 并存。
- **报告会被覆盖。** 同一 run 的第二次 attempt 仍写同一个 `run/v1/qa-report.json`（`create-game.ts:542`），旧 findings 不再可读。
- **外部包无法反推。** site 允许 packDir 在 out 树之外（§7 的现场），`laySite` 只是把包**拷进**自己的 out 树（`packages/demo/src/layout.ts:78-83`）；源 run 可能在另一棵 out 树，甚至根本不存在。
- **没有外键。** manifest 的 `generator.run` 字段虽然存在（`packages/contracts/src/assetpack.ts:270`、`packages/assets/src/pack.ts:1179`），但全仓**没有任何调用方写它**；`RunLedger` 也不记 `packVersion`（§4.2）。⇒ run → pack 没有持久 join key。

### 3.3 18a 的实证：同一份报告，无法说是哪个包

`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/`：

- `run/v1/` 一份；`pack/v1/` 与 `pack/v2/` 两份（E3：目录树）。
- `run/v1/qa-report.json`：`checked=5 · failures=0`（E3，读文件）。
- 用同一份 `run/v1` 重跑 QA：**对 pack v1 得到 1 条 `reference-resolution` error（16 条引用缺失），对 pack v2 得到 0 条**（E3，§2.4 的探针）。
- ⇒ 那份绿色报告属于 pack v2，但报告和 run ledger 里**没有一个字**说明这一点。一个「拿旧报告给新包发布」或「拿绿色报告给旧包发布」的路径今天无法被识破。

### 3.4 结论

- 发布路径**不能**仅凭 packDir 可靠定位到「属于这个包的」`run/v<N>/qa-report.json`：要么扫目录 + 身份匹配（需要报告里有身份），要么显式给路径（`--qa-report`），要么重跑（需要 runDir）。
- 「从 pack 目录推出 run 目录」只在规范 out 树、且只做**候选扫描**时可用；**不能**把 `v<N>` 当成同一个 N 直接拼接。

---

## 4. 「当前包」的身份用什么钉住

### 4.1 现有的包身份字段

| 载体 | 字段 | 强度 | 证据 |
|---|---|---|---|
| `manifest.json` | `id` + `version` | **声明身份**；版本目录绝不覆盖（R8），但手工改包可以保持同 id/version | `packages/contracts/src/assetpack.ts:265-269` |
| `manifest.json` | `files[].checksum`（每个文件的 sha256） | **内容指纹**；manifest 自身不在 `files[]` 里（自指） | `packages/contracts/src/assetpack.ts:298-299` |
| `pack/v<N>/ledger.json` | `packId` + `packVersion` | 包的收据；与 manifest 冗余但自证 | `packages/contracts/src/ledger.ts:156-159` |
| `pack/v<N>/coverage.json` | `packId` + `packVersion` | sidecar 自证；site 已用它和 manifest 对账 | `packages/contracts/src/coverage.ts:25-30`、`packages/demo/src/site.ts:197-202` |
| `run/v<N>/ledger.json` | `gameId` + `runVersion` | **没有 `packVersion`** | `packages/contracts/src/run-ledger.ts:19-34`、`create-game.ts:603-613` |

### 4.2 `qa-report/v1` 今天有什么、缺什么

`QAReportSchema` 是 `z.strictObject`，只有四项（`packages/contracts/src/qa.ts:266-320`）：

```text
format: "qa-report/v1"
checked: QAJudgement[]
failures: QAFailure[]
observations: Observation[]   // source 闭集：inspect | review
```

- **不能承载身份**：`observations[].source` 只允许 `inspect` / `review`（`qa.ts:212`）；`failures` 是判据结论；`checked` 是判据名单。硬塞会破坏语义，且 strict schema 会拒未知键。
- 真实归档三份 `qa-report.json`（10-13h / 10-17d / 10-18a）的键都恰好是这四项（E3：逐份读取）。
- 契约头注明写「没有 `createdAt`，哪一次运行由目录答了」（`qa.ts:258-265`）。这条对「一个 run 一次构建」成立，对「同一 run 多次 attempt」不成立（§3.2）。

### 4.3 建议的身份形状（供票 09 报批，不在本票落地）

最小、且与现有词汇一致：

```text
subject: {                       // 新增、可选（旧报告仍能解析；发布闸要求必须有）
  packId: string,                // = manifest.id
  packVersion: number,           // = manifest.version
  manifestChecksum?: string      // 可选：sha256(manifest.json 原始字节)，绑定声明与 files[] 列表
}
```

- 复用 `packId` / `packVersion` 两个名字（`coverage.json` / 包 ledger 已经在用），不另造 `pack.id/pack.version`。
- **不升 `qa-report/v2`**：字段是**可选**的，磁盘上已有的四字段报告仍能通过 `QAReportSchema`（`packages/contracts/tests/qa.test.ts:100-116`）；只是发布闸会以「无 subject ⇒ 无法证明」拒它们。这与既有追溯研究「升 v2 会让旧报告解析不过」的结论不冲突（`.scratch/animation-acceptance-v1/research/g-report-traceability.md:378`）。
- **不**加 `runVersion` / `createdAt`：run 身份由 `run/v<N>` 目录回答；报告被复制时目录可能变，但包身份不变。
- **不**加 `status` / `repairAttempts`：派生量 / 循环量，契约头已明确排除（`qa.ts:260-264`）。
- 可选 `manifestChecksum` 的价值：同 id/version 的包被改过时能发现声明层面的改动；文件内容完整性仍归 P0-04 的 `verifyPack`（它会重算 `files[]`，`packages/assets/src/ops.ts` 的 `verifyPack`，实测 v7 1.26s）。
- **配置身份另说**：QA 的 `reachability` / `reference-resolution` 是吃 config 的。只钉 pack 时，一份绿色 pack 报告仍可给**另一份手写 config** 放行（P0-02 的票面只要求 pack id+version；这一点必须作为残余风险写进 09，见 §8.4）。若将来要钉 config，可加 `subject.configChecksum`，但今天没有「给任意 pack+config 单独跑 QA」的入口，贸然要求会堵死手写 config 工作流。

### 4.4 身份匹配算法（建议）

```text
publish(packDir, configPath, explicitReport?):
  manifest = parseAssetPack(packDir/manifest.json)
  reportPath = explicitReport
            ?? scan(<out>/<manifest.id>/run/v*/qa-report.json)
  report = parse(QAReportSchema, reportPath)
  require report.subject exists
  require subject.packId === manifest.id
  require subject.packVersion === manifest.version
  require report.failures 中没有 severity:"error"
  require report.checked.length === QA_JUDGEMENTS.length      // 票 09 的 incomplete 阻断；票 08 之后才可能 6/6
  if subject.manifestChecksum: require sha256(manifest.json bytes) 一致
  → 放行
```

- 多个候选时，按 `subject` 精确匹配；同一 id+version 的包只有一个（R8 不覆盖），重复报告等价。
- 找不到 ⇒ `invalid`（退出码 4），文案必须带 `packId v<version>`、查过的目录、以及「先跑 `build`（QA 在 build 里跑）或用 `--qa-report` 指一份该包的报告」。
- 报告不匹配 ⇒ 文案必须同时报「报告属于谁」与「当前包是谁」（对齐 `site.ts:200-201` 的 coverage 对账文案）。

---

## 5. A / B / C 对比矩阵

### 5.1 定义

- **A**：报告携带包身份，发布路径查找并校验匹配。
- **B**：发布路径就地重跑 QA。
- **C**：显式参数传入 QA 报告路径（CLI `--qa-report` / MCP `qaReportPath`）。

### 5.2 矩阵

| 维度 | A（身份 + 查找） | B（就地重跑） | C（显式路径） |
|---|---|---|---|
| 可行性 | **高**。报告是唯一裁决（`qa.ts:340`），加一个身份字段即可；查找可扫规范 out 树 | **中低**。成本低（24–125ms + inspect 0.58s），但 site/assemble_site 拿不到 run 里的 intent/design/recipe；只有 pack+config 时默认合成器直接抛，最多也只到 2/6 | **高**。不改契约、不改 QA；只加参数 |
| 需要的新字段 | `qa-report/v1` 新增可选 `subject {packId, packVersion, manifestChecksum?}`。**契约变更，须报批** | 不需要报告字段；需要新 CLI `--run <runDir>` 或把 run 目录塞进 site 入参；MCP `assemble_site.runDir`；pipeline 导出独立 QA 函数（`packages/qa` 只有 `contracts` 依赖，`demo` 够不着） | 不需要契约字段；CLI `--qa-report <path>`；MCP `assemble_site.qaReportPath` |
| 需要的代码改动 | 写身份（pipeline）+ 读/校验（新 gate，两个壳各接一次）+ 测试 | 新 QA 入口 + 两个壳新参数 + 报告落点/是否落盘的新决定 + 测试；`demo` 不能做，必须放 pipeline | gate 新增显式路径分支 + 两个壳各加一个参数 + 测试 |
| 正常 create/build | 已有内存里的 `built.paths.qaReport`；补 `incomplete` 阻断即可 | 已经跑过，没必要重跑 | 不需要（内部路径已有） |
| 独立 site（out 树内） | 扫 `<out>/<id>/run/v*/qa-report.json`，按身份匹配；**无需新 flag** | 需要 runDir；没有就跑不了 | 可以不传（若同时有 A 的查找）；也可显式指 |
| 外部 pack（out 树外） | 扫不到 ⇒ 必须配 C | 无 run ⇒ 不可用 | **唯一可用**：显式指一份属于该包的报告 |
| 无 run 手工工作流 | A 单独会拒；A+C 可在有报告时放行 | **永远不可用** | 有报告才放行；没有就拒 |
| 「报告属于旧 pack」 | **能精确拒**（subject 不匹配） | 不适用（重跑的是当前包） | **单独不能证明**；只能靠路径信任，容易指错/指旧 |
| 配置被换掉 | **不能发现**（只钉 pack）——残余风险 | **能发现**（重跑的是发布用 config） | **不能发现** |
| 包内容被改（同 id/version） | id+version 不能发现；加 `manifestChecksum` 可发现声明改动；文件内容仍归 P0-04 `verifyPack` | 重跑 QA 只读 JSON，不校验文件 checksum；同样发现不了字节损坏 | 同 A |
| TD config | 需在 gate 里显式跳过或另立 TD QA；P0 塔防等价是 P2（`docs/v4/P0-00-p0-scope.md:33,344`） | **不可用**：玩法族只 `parseGameConfig`（`packages/qa/src/gameplay.ts:73`），TD config 会抛 | 同 A：可跳过 TD |
| 兼容性 | 正常 in-tree 工作流零 flag；旧报告无 subject ⇒ 拒（无法证明） | 正常 build 链可用；独立 site / 手工 site 全断 | 手写 workflow 可通过显式路径保留；但必须拿到报告 |
| 主要风险 | 查找启发式、旧报告全拒、契约变更需批准 | 上下文不完整导致假 6/6 或永远 incomplete；重复跑；报告是否落盘/落哪未定；TD 不支持 | 没有身份校验时形同「调用方说啥就是啥」；必须与 A 合用才有证明力 |

### 5.3 结论

- **A 是唯一能直接回答「这份报告属于当前包吗」的方案**；成本是一次契约字段 + 一个共享 gate。
- **C 不是一个独立方案**：没有 A 的身份，显式路径只是「信调用方」。C 的价值是**定位**（外部 pack / 非规范目录），必须与 A 合用。
- **B 技术可行但不是默认**：它把「验证报告属于当前包」变成「现在重跑一次 QA」，语义更强但要求 run 上下文；对票面点名的旧手工 `site` 无解，且与票 08 的 6/6 修复耦合。
- **不推荐 D（第三本 `run-build-record` / 身份 sidecar）作为 09 的首选**：`animation-acceptance-v1` 的追溯研究提过 `run/vN/builds/v<M>.json`（`.scratch/animation-acceptance-v1/issues/07-g-report-traceability.md:58`），它能避免动 `qa-report`，但会新增第四个持久格式，且同样需要 run 目录；对 09 的「报告自证」需求，报告内 `subject` 更短、更直接。

---

## 6. 旧手工工作流在 A / B / C 下分别怎样

场景一：**先 build 成功，再手工 `site`**（有 run、有报告、out 树规范）

| 方案 | 结果 |
|---|---|
| A | 查找 `<out>/<id>/run/v*/qa-report.json`，subject 匹配 ⇒ 放行（无新 flag） |
| B | 需要 `--run`；有 run 时可重跑 ⇒ 放行 |
| C | 需要显式 `--qa-report`；不指就拒（若没有 A 的自动查找） |

场景二：**先 build 失败（QA error），再手工 `site`**

| 方案 | 结果 |
|---|---|
| A | 找到的是那份 error 报告 ⇒ **拒**（有意，票面边界） |
| B | 重跑仍 error ⇒ **拒** |
| C | 指向 error 报告 ⇒ 拒；不指 ⇒ 缺报告拒 |

场景三：**没有 run 目录的 `site`**（外部交付包 + 手写 config，即 `2026-10-20e-site`）

| 方案 | 结果 |
|---|---|
| A | 扫不到报告 ⇒ **拒**（缺 QA）；除非同时用 C 指一份属于该包的报告 |
| B | 没有 run 里的 intent/design/recipe ⇒ **无法重跑** ⇒ 拒（且没有兼容口） |
| C | 可指一份报告；若报告不存在（本例就是）⇒ **拒** |

场景四：**TD config 的 `site`**

| 方案 | 结果 |
|---|---|
| A / C | 若 gate 只对 `game-config/v1` 生效 ⇒ TD 维持现状（P0 明确把 TD 等价留 P2）；若强行 gate TD ⇒ 没有 TD QA 报告可找，TD 站点会被误伤 |
| B | 玩法族 `parseGameConfig` 直接抛（`packages/qa/src/gameplay.ts:73`） ⇒ **不可用** |

**兼容方案建议**（给票 09 的报批项）：

- 正常 in-tree 工作流：A 的自动查找，零新 flag。
- 外部 / 非规范目录：C 的 `--qa-report` / `qaReportPath`。
- 完全没有报告的手工包：**拒**，并在错误里说清「缺什么报告、怎么产出（先跑 `build`，QA 在 build 里跑），或用 `--qa-report` 指一份」。这与 P0-00 的「旧手工工作流被拒绝是有意的」一致（`docs/v4/P0-00-p0-scope.md:188-189`）。
- 不提供「无 run 就跳过」的逃生口；否则闸门又变成可绕过。

---

## 7. `2026-10-20e-site` 为什么没有 `qa-report.json`

**结论：流程/架构问题，不是路径问题。**

证据链（E3 + E1）：

1. 该 run 的报告写明：零付费、输入包是 `runs/2026-10-20d-groundline/.../pack/v6/`，站点用 `site` 命令从**外部包**装配（`.scratch/asset-integration-v1/runs/2026-10-20e-site/site-report.md:3-4,28-31`）。
2. 该 out 树只有 `pack/v6`、`pack/v7`、`site/v1..v3`，**没有 `run/` 目录**（E3：`find`）。
3. 源包目录 `runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/` 只有 `pack/v6`，**没有 run**；`find` 全 `asset-integration-v1/runs` 没有任何 `qa-report.json` / 任何 `run/` 目录（E3）。
4. `site` 命令不跑 QA、不读 QA（`packages/cli/src/cli.ts:633-649`；`packages/demo/src/site.ts` 全文没有 `qa` / `QA` / `reachability` 引用，grep 无命中）。
5. `pack` 命令也不跑 QA（`packages/cli/src/cli.ts:582-600`）；QA 只在 `runBuild` 里跑（`packages/pipeline/src/create-game.ts:507-544`）。
6. 该包的 `ledger.json` 是**包收据**（`assetpack-ledger/v1`，`packId/packVersion`），不是 QA（E3：v6/v7 两份都是 `assetpack-ledger/v1`）。

⇒ 这份归档从未走过 `create` / `build`，自然没有 `run/v<N>/qa-report.json`。`site` 按设计就不产生它；这是「`site` 可绕过 QA」的现场，而不是某个路径拼错。

---

## 8. 推荐方案与最小变更清单

### 8.1 推荐：A + C（A 为主，C 为定位口）

理由：

1. **直接满足票面语义**：「QA 报告必须与本次要发布的 pack id + version 对应」（`docs/v4/P0-00-p0-scope.md:159`）。A 把身份写进报告，闸门做一次纯比较即可，不依赖目录猜谜。
2. **正常链路零新 flag**：`create --yes` / `build` / MCP `create_game` 已经持有 `built.paths.qaReport`，只需补身份与 `incomplete` 阻断；独立 `site` 在规范 out 树里可自动查找。
3. **旧手工 / 外部包有兼容口**：C 的显式路径让「包在 out 树之外、但有一份属于它的报告」仍可发布；没有报告则拒绝（有意）。
4. **不把 QA 的上下文问题转嫁给发布路径**：B 需要 run 里的三份文书，独立 `site` 本来就拿不到；把 `runDir` 塞进 `site` 会改变 CLI 用法且对无 run 工作流无解。
5. **不新增第三本账**：身份是报告自身的事实，不是第二份 findings；符合「一份裁决」的纪律（`packages/contracts/src/qa.ts:340-354`）。

### 8.2 最小变更清单（供票 09 按 Q5 逐项报批；本票不落地）

| # | 文件 / 位置 | 变更 | 必要性 |
|---|---|---|---|
| 1 | `packages/contracts/src/qa.ts:266-320` | `QAReportSchema` 增加**可选** `subject: { packId, packVersion, manifestChecksum? }`；更新头注 `:258-265`；保持 `qa-report/v1` 与既有字段语义不变 | A 的核心契约变更 |
| 2 | `packages/contracts/tests/qa.test.ts:100-116` | 新增 subject 正例 / 缺字段 / 错类型 / 未知键；旧的四字段报告仍可解析（向后兼容） | 契约测试 |
| 3 | `packages/pipeline/src/create-game.ts:533-544` | 在 `QAReportSchema.safeParse` 之前由 pipeline 注入 `subject`（取 `manifest.value.id/version`；可选 `manifestChecksum` = sha256(manifest.json 原始字节)）；**覆盖** runner 自带的 subject，写入唯一来源 | 新报告自证 |
| 4 | `packages/pipeline/src/create-game.ts:215-226` | 把 `assertQaPassed` 扩成发布闸：除 `severity:"error"` 外，`checked.length < QA_JUDGEMENTS.length`（`incomplete`）也拒（票 08 落地后生效） | 票 09 的 incomplete 阻断，覆盖 create/build/create_game |
| 5 | 新 `packages/pipeline/src/publish-gate.ts` + `packages/pipeline/src/index.ts` | 共享 `findQaReport({ packDir, outRoot?, explicit? })` + `assertPublishableQa({ packDir, qaReportPath? })`：解析 manifest / 报告，校验 subject、error、checked；报告缺失/不匹配抛 `CommandError("invalid")`（退出码 4） | 两个壳共用，不复制判定 |
| 6 | `packages/cli/src/cli.ts:90-96,29,633-649` | `takesValue` 加 `qa-report`；USAGE 加 `[--qa-report <path>]`；`case "site"` 在 `assembleFromConfig` **之前**调用 gate（保证失败不建 `site/v<N>`）；TD (`td-config/v1`) 显式跳过并记录为 P2 | CLI `site` |
| 7 | `packages/cli/src/cli.ts:235-259` | `buildAndSite` 在 `assembleFromConfig` 之前调用同一 gate（用 `built.paths.qaReport`）；`runBuild` 已抛 error，这里是统一入口与身份复核 | CLI create/build |
| 8 | `packages/mcp/src/server.ts:203-213,386-393` | `assemble_site` inputSchema 加可选 `qaReportPath`；dispatch 在 `assembleSite` 之前调用 gate | MCP `assemble_site` |
| 9 | `packages/mcp/src/server.ts:348-361` | `create_game` 在 `assembleSite` 之前调用同一 gate（`built.paths.qaReport`）；补 QA 失败测试（`isError` / `_exitCode=4` / 站点不产 / 报告在盘） | MCP `create_game` |
| 10 | `packages/cli/tests/*`、`packages/mcp/tests/*` | 新增四类路径测试：缺报告 / 旧 pack（subject 不匹配）/ error / incomplete；CLI+`site` 与 MCP `assemble_site` 各至少一条；MCP `create_game` 失败路径一条。测试用临时目录手写 report，不需要上游、零付费 | 票 09 验收 |
| 11 | `docs/v2/01-contracts.md:586-597`、`USAGE` / `README` 相关段落 | 记录 `subject` 字段、`--qa-report` / `qaReportPath`、TD 的 P2 例外 | 文档同步 |

**测试注意**：

- 现有 `packages/demo/tests/site.test.ts:12-14` 直接用 `fixtures/packs/last-train/v2` + `fixtures/game-configs/last-train.json` 调 `assembleSite`，**不经过壳**。把 gate 放在 pipeline / 壳层可以保持这些测试不变；如果把 gate 放进 `assembleSite`，会连带改 `SiteOptions` 和 demo 测试，不推荐。
- 现有测试**没有**直接调用 CLI `site` 或 MCP `assemble_site`（`packages/mcp/tests/server.test.ts:83-91` 只断言工具清单；CLI 测试没有 `site` 用例）⇒ 票 09 必须新开入口级测试。
- `fixtures/` 是只读边界（票面），不要往 `fixtures/packs/last-train/v2` 或 `fixtures/game-configs/` 里塞 QA 报告；测试在临时目录里造。

### 8.3 放行条件（建议写死）

- `subject.packId === manifest.id` 且 `subject.packVersion === manifest.version`；
- `failures` 中没有 `severity:"error"`；
- `checked.length === QA_JUDGEMENTS.length`（6/6；票 08 之后）；
- 可选：`subject.manifestChecksum` 与 `sha256(manifest.json)` 一致；
- 全部满足才进入 `assembleFromConfig` / `assembleSite`；否则在**任何目录创建之前**抛 `invalid`（4）。

### 8.4 残余风险 / 必须写进 09 的话

1. **只钉 pack，不钉 config。** `reachability` / `reference-resolution` 吃 config；一份绿色 pack 报告可给另一份手写 config 放行。P0-02 的票面只要求 pack id+version；若要堵这个洞，需另裁 `subject.configChecksum`，但今天没有「给任意 pack+config 跑 QA」的入口，会堵死手写 config 工作流（如 `2026-10-20e-site` 的手写 config）。建议 09 明确写「本票只保证 pack 身份；config 身份不在范围内」。
2. **同 id/version 的包内容被改**：id+version 发现不了；`manifestChecksum` 能发现声明改动，文件字节完整性归 P0-04 的 `verifyPack`。独立 `site` 今天不跑 `verifyPack`（`site.ts` 只解析 schema + 审计），是否在 gate 里顺手跑 `verifyPack`（实测 v7 1.26s）需 09 决定。
3. **`incomplete` 阻断会让所有发布在全绿之前失效**：今天 `checked` 恒 5/6（`packages/qa/src/assemble.ts:89`、`packages/contracts/src/qa.ts:374-377`），09 依赖 08；测试要按 08 之后 `checked=6` 构造。
4. **旧报告（无 subject）全部被拒**：这是「无法证明」的正确结果；若需要兼容，必须另立「给已有 pack+run 重跑 QA 并补写报告」的命令，不在 09 范围。
5. **TD**：P0 只做横版；gate 必须显式跳过 `td-config/v1` 或另立 TD QA，否则 TD 站点会被误伤（`packages/demo/src/assemble.ts:64-65`、`packages/qa/src/gameplay.ts:73`）。
6. **库调用方**：`assembleSite` / `assembleFromConfig` 是公开导出（`packages/demo/src/index.ts:6-7`），绕过两个壳的调用方不受 gate 约束；P0 的发布路径按票面只算五个入口，需在 09 写清。
7. **查找启发式**：自动扫描只对规范 out 树有效；非规范目录必须用 C。错误文案要把「查过哪里」写出来，避免用户以为是包坏了。

---

## 9. 证据索引（本文件引用的关键行）

- CLI `site`：`packages/cli/src/cli.ts:29,90-96,633-649`
- CLI `buildAndSite`：`packages/cli/src/cli.ts:235-259`
- MCP `assemble_site`：`packages/mcp/src/server.ts:196-213,386-393`
- MCP `create_game`：`packages/mcp/src/server.ts:336-361`
- `SiteOptions` / `assembleSite`：`packages/demo/src/site.ts:145-156,167-216`
- 格式分派：`packages/demo/src/assemble.ts:36-44,53-66`
- 站点摆盘 / 包拷贝：`packages/demo/src/layout.ts:75-100`
- `QaContext`：`packages/contracts/src/qa.ts:436-458`
- `QAReportSchema`：`packages/contracts/src/qa.ts:258-320`
- `qaVerdict`：`packages/contracts/src/qa.ts:374-377`
- `runBuild` 的 QA 段：`packages/pipeline/src/create-game.ts:507-544`
- `assertQaPassed`：`packages/pipeline/src/create-game.ts:215-226`
- 版本分配：`packages/pipeline/src/create-game.ts:437-441`；`packages/assets/src/pack.ts:250-255`
- `RUN_ARTIFACT`：`packages/pipeline/src/artifacts.ts:14-26`
- `RunLedger`：`packages/contracts/src/run-ledger.ts:19-34`；写：`create-game.ts:603-613`
- 包 ledger：`packages/contracts/src/ledger.ts:156-159`
- `coverage.json` 身份：`packages/contracts/src/coverage.ts:25-30`；site 对账：`packages/demo/src/site.ts:197-202`
- manifest：`packages/contracts/src/assetpack.ts:265-299`
- 依赖白名单（`demo` 只依赖 `contracts`）：`scripts/check-deps.mjs:18-30`
- QA 包依赖只有 contracts：`packages/qa/package.json:13-14`
- 真实归档 18a：`.../run-out-2026-10-18a/wasteland-scavenger-assets/{run/v1,pack/v1,pack/v2}`（E3）
- 2026-10-20e-site：`site-report.md:3-4,28-31`；out 树无 `run/`（E3）
- 票 08：`.scratch/p0-construction-v1/issues/08-p0-02a-qa-6of6.md`
- P0-02 范围：`docs/v4/P0-00-p0-scope.md:146-190`
- 既有追溯研究：`.scratch/animation-acceptance-v1/issues/07-g-report-traceability.md:55-59`、`.scratch/animation-acceptance-v1/research/g-report-traceability.md:185-210,368-390`
