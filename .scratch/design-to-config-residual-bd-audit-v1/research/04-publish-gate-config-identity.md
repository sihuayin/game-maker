# publish-gate 的 config 身份绑定：是否构成独立缺口（04）

- **Date**：2026-11-03
- **Baseline**：`main` @ `3b1b61d`；本票工作树 HEAD `8a155f7`（docs 提交）。
  `git diff --stat 3b1b61d -- packages fixtures docs` 为空 ⇒ 源码、fixture、文档与基线一致，
  本报告所有 `file:line` 可直接按基线读。
- **Nature**：只读研究。未修改生产代码、测试、fixture、契约或历史证据；未 commit / 建分支 / 推送；
  零付费模型调用、零生图。所有运行证据只用临时目录 + 既有 fixture + 既有 `dist`。
- **Input**：本票 `issues/04-publish-gate-config-identity.md`、`map.md`、`issues/03-disposition-ruling.md`、
  `research/01-b-class.md`、P0-02b 票 05 研究文件 §8.4、P0-02b 票 09、当前源码。

---

## 0. 结论速览

| # | 问题 | 结论 | 证据级别 |
|---|---|---|---|
| 1 | 是不是独立于 B-02 的真实缺口？ | **是。** gate 只比较 pack 三字段；`configPath` 只用于 TD 识别；`site` / `assemble_site` 可用任意 config 配一份绿报告发布 | E1 + E2 + E3 |
| 2 | 哪些发布路径会中招？ | **只有 standalone `site` / `assemble_site`**（以及绕过 gate 的库调用）。`build` / `create --yes` / MCP `create_game` 的 QA 与站点用的是同一个 `built.paths.config` | E1 + E3 |
| 3 | 哪些 QA 判据受 config 影响？ | 基线实际是 **7 条**（不是票面写的 6 条）。其中 4 条读 config：`layer-coverage`、`reference-resolution`、`reachability`、`visual-config-coherence`。站点装配会重跑前两条；**未重跑的是 `reachability` 与 `visual-config-coherence`** | E1 + E3 |
| 4 | `QAReport` 今天能承载 config 身份吗？ | **不能。** `subject` 是 `strictObject`，只有 `packId` / `packVersion` / `manifestChecksum`；加 `configChecksum` 会被 schema 拒 | E1 + E3 |
| 5 | 既有机制覆盖了吗？ | **没有一条在发布闸上覆盖。** run 兄弟 config、六字段 subject、config checksum、delivery、evidence manifest 都是事后或旁路机制 | E1 + E3 |
| 6 | 能否零成本确定性复现？ | **能。** CLI `site` 用「config A 的绿色报告」发布「带 100px 墙的 config B」，**exit 0**；auto 查找与显式 `--qa-report` 两条都成立。config B 有 3 条 reachability error，而 `auditGameConfig` 0 条 error | E3 |
| 7 | 若修的判据？ | 契约式：`subject.configChecksum === fileChecksum(configPath)`；**不改契约的替代**：gate 现场重跑 `auditReachability`（以及现有 run 兄弟 config 的字节比较） | E0（候选，未实施） |
| 8 | 修改面？ | 契约式：`contracts/qa.ts` + `pipeline/create-game.ts` + `publish-gate.ts` + 4 组测试 + 文档；**不改契约式**：`publish-gate.ts` + 测试。均无新依赖、不改 Runtime、不加 CLI/MCP 参数 | E1 |
| 9 | 归属？ | 三种选项的事实见 §8；**本票不裁定**。03 的现行边界是「独立待核实，不并入 B-02，不视为已解决」 | E1 |

**一句话**：这是 P0-02b 自己写下、P1 没有改变的真实残余风险；它的实际弹着点比注释写的窄
（`reference-resolution` 已被站点装配重跑），但 `reachability` 与第七条的
`visual-config-coherence` 确实可以在「绿报告属于 A、实际发布 B」时漏过去。

---

## 1. 当前事实：四个调用点是否同时持有 pack 与 config

### 1.1 调用点全表

`assertPublishableQa` 只有四个壳调用点（另有测试直接调用）：

| 发布入口 | gate 调用 | pack 来源 | config 来源 | 报告来源 | QA 用的 config 与站点用的 config 是否保证同一份？ |
|---|---|---|---|---|---|
| CLI `create --yes` / `build`（`buildAndSite`） | `packages/cli/src/cli.ts:281-284` | `built.paths.packDir` | `built.paths.config` | `built.paths.qaReport`（显式）或 out 树 auto | **是**：`runBuild` 的 QA 读 `run/v<N>/game-config.json`（`create-game.ts:665-676`，其中 `configPath` 在 `:670`），站点装配在 `cli.ts:288-291` 用同一 `built.paths.config` |
| CLI `site` | `packages/cli/src/cli.ts:717-720` | `--pack <dir>` | `--config <path>` | `--qa-report`（显式）或 out 树 auto | **否**：报告只按 pack 身份定位；config 是调用方任意给的，见 `cli.ts:705-727` |
| MCP `create_game` | `packages/mcp/src/server.ts:374-378` | `built.paths.packDir` | `built.paths.config` | `built.paths.qaReport`（显式）或 out 树 auto | **是**：`assembleSite` 在 `server.ts:384-387` 用同一 `built.paths.config` |
| MCP `assemble_site` | `packages/mcp/src/server.ts:433-436` | `args.packDir` | `args.configPath` | `args.qaReportPath`（显式）或 out 树 auto | **否**：装配在 `server.ts:438-442`，config 就是入参 |
| pipeline `createGame` | 不调用 gate | — | — | — | **不装配站点**（`create-game.ts:761-782` 只做 understand + build） |
| 库直调 `assembleSite` / `assembleFromConfig` | 不经过 gate | 调用方 | 调用方 | 调用方 | **不受约束**（publish-gate.ts:6-8 明写；`packages/demo/src/index.ts:6-7` 公开导出） |

### 1.2 gate 实际比较了什么

`subjectProblem`（`packages/pipeline/src/publish-gate.ts:112-121`）只做三件事：

1. `report.subject` 必须存在（`:114-116`）；
2. `subject.packId === manifest.id && subject.packVersion === manifest.version`（`:117-118`）；
3. 若报告带 `manifestChecksum`，必须等于当前 `manifest.json` 的字节哈希（`:119-120`）。

`configPath` 在 gate 里的唯一用途是 `formatOf(opts.configPath) === TD_CONFIG_FORMAT` 时提前返回
（`publish-gate.ts:147`；`formatOf` 在 `:75-83`）。`PublishGateOptions.configPath` 的注释也明写
「**只用来识别 TD**」（`:42-43`）。

### 1.3 config 能否与 QA 时不同？

- **build / `create --yes` / MCP `create_game`：不能。** QA 与站点装配都拿 `built.paths.config`；
  `runBuild` 里 QA 的 `configPath` 是 `path.join(runDir, RUN_ARTIFACT.config)`（`create-game.ts:670`），
  站点装配拿的是同一个 `built.paths.config`（`cli.ts:289`、`server.ts:385`）。
- **standalone `site` / `assemble_site`：能。** 报告按 pack 身份查找（`publish-gate.ts:87-96,169-178`），
  config 是调用方给的任意路径；out 树里 `run/v<N>/game-config.json` 与 `qa-report.json` 虽然是兄弟
  （`RUN_ARTIFACT.config` / `RUN_ARTIFACT.qaReport`，`artifacts.ts:14-30`），但 gate **不读兄弟 config**。
- 即使显式 `--qa-report` 指向 out 树里的报告，gate 也只验 pack 三字段（`publish-gate.ts:156-163`）。

### 1.4 站点装配自己重跑了什么（决定实际弹着点）

`assembleSite`（`packages/demo/src/site.ts:167`）会跑：

- `auditGameConfig(config, manifest)`（`site.ts:191`），它**以 `auditReferences` 开头**
  （`packages/contracts/src/game-config.ts:506`）⇒ `reference-resolution` 的引用族会被重跑；
- `auditGeometry`（`site.ts:205`），内部调用 `auditLayerCoverage`（`site.ts:43`）⇒ `layer-coverage` 会被重跑；
- `auditScreenSpace`（`site.ts:210`）。

站点**没有** `runDir` / VDS / design 入参（`SiteOptions` 只有 `packDir` / `configPath` / `shellJsPath` /
`outRoot` / `gameId` / `siteVersion`，`site.ts:145-156`），因此：

- `reachability` **不会**被站点重跑（`site.ts` 全文无 `auditReachability`）；
- `visual-config-coherence` **不会**被站点重跑（它需要 `ctx.vdsPath` / `ctx.designPath`，
  `qa/src/visual.ts:196-200`）。

---

## 2. config 敏感性：逐条核对（基线实际 7 条，不是 6 条）

> **新发现 1**：`QA_JUDGEMENTS` 在基线有 **7 个值**（`packages/contracts/src/qa.ts:111-160`）：
> `palette-binding`、`constructive-constraint`、`layer-coverage`、`reference-resolution`、
> `reachability`、`intent-coverage`、`visual-config-coherence`。`qa.ts:104` 等多处注释仍写「六条」，
> 是文档漂移；gate 用 `QA_JUDGEMENTS.length`（`publish-gate.ts:132-135`），所以功能上按 7 条跑。
> 本票把第七条单列，因为它是 config 敏感且站点不重跑的。

| # | 判据 | 实现位置 | 读 config？ | 读什么 | 站点装配是否重跑？ | 发布闸上的洞？ |
|---|---|---|---|---|---|---|
| 1 | `palette-binding` | `qa/src/visual.ts:98,162-178` | 否 | manifest | 否（pack-only） | 否 |
| 2 | `constructive-constraint` | `qa/src/visual.ts:97,115-127` | 否 | recipe + manifest + packDir | 否（pack/recipe-only） | 否 |
| 3 | `layer-coverage` | `qa/src/layers.ts:48-60` | **是** | `config.scene.background.asset`、`config.world.size` + manifest + viewport | **是**（`site.ts:43,205`） | 否（站点重跑） |
| 4 | `reference-resolution` | `qa/src/gameplay.ts:79` | **是** | `auditReferences(config, manifest)` | **是**（`site.ts:191` → `game-config.ts:506` 同一函数） | 否（站点重跑） |
| 5 | `reachability` | `qa/src/gameplay.ts:80` | **是** | `auditReachability(config, manifest)` | **否** | **是** |
| 6 | `intent-coverage` | `qa/src/intent.ts:89` | 否 | intent + design | 否（与 config 无关） | 否 |
| 7 | `visual-config-coherence` | `qa/src/visual.ts:99,196-277` | **是** | `config.entities[].sourceIntent` / `kind` + VDS + design + manifest | **否**（站点无 VDS/design） | **是** |

**说明 1（`reference-resolution` 的修正）**：`publish-gate.ts:10-12` 与 P0-02b 的残余风险把
`reachability` / `reference-resolution` 并列。就 standalone `site` 的最终产物而言，
`reference-resolution` 已被 `assembleSite` 的 `auditGameConfig` 重跑，且 `auditGameConfig`
的第一个动作就是 `auditReferences`（`game-config.ts:506`），是同一个实现、同一份输入
（`config` + `manifest`）。所以**真正未被站点重跑、且被注释点名的只剩 `reachability`**。

**说明 2（第七条）**：`visual-config-coherence` 会读 `config.entities[].sourceIntent` 与 `kind`，
在「设计桶实体在 config 里不存在」或「kind 越界」时是 **error**（`qa/src/visual.ts:238-263`）。
站点没有 VDS/design，无法重跑；因此它和 `reachability` 一样，是 green-A / publish-B 可以漏过去的
QA 判据。它不在票面的「六条」里，是本次必须补上的事实。

**说明 3（`layer-coverage` 的边界）**：站点重跑它，但站点用外壳常量 `VIEWPORT`
（`site.ts:210` 那一行的 `VIEWPORT` / `geometry` 用 `buildWorld` 的 `world.viewport`），
而 QA 用调用方传入的 `ctx.viewport`（`create-game.ts:668-669`）。默认路径二者同值；自定义
viewport 的贯通问题归 D-01，不属于本票。

---

## 3. `QAReport` 今天能否承载 config 身份

`QAReportSchema`（`packages/contracts/src/qa.ts:283-304`）的 `subject` 是 `strictObject`：

```ts
subject: z.strictObject({
  packId: z.string().min(1),
  packVersion: z.number().int().positive(),
  manifestChecksum: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
}).optional(),
```

- 没有 `configChecksum`、没有 config 路径、没有 design/intent/VDS 身份。
- 报告由 `buildQAReport` 生成时**根本不带 subject**（`qa.ts:370-384`）；subject 是 pipeline 在
  `create-game.ts:684-691` 注入的，只注入三个 pack 字段。
- `strictObject` 意味着今天往 `subject` 里塞 `configChecksum` 会被 schema 拒。实测（§6.3）：
  `QAReportSchema.safeParse` 对带 `subject.configChecksum` 的报告返回
  `Unrecognized key: "configChecksum"`。
- `qa-report` 里的 `delivery.config` 只有 `{ file: string }`（`packages/contracts/src/delivery.ts:144-145`），
  是**路径**不是字节哈希；且 `delivery` 是站点装配之后由壳补写的（`pipeline/src/delivery.ts:6-10`），
  standalone `site` 不写它。

结论：**要携带 config 身份，必须改契约**（可选字段、与六字段 subject 同形，不升 `qa-report/v1`
是可行的先例——`delivery` 就是加性加入且不升版，`qa.ts:301-304`）。不改契约则只能在 gate 现场重算。

### 3.1 六字段 `subject` 先例

| 报告 | 字段 | 位置 | 何时写 |
|---|---|---|---|
| `mechanic-coverage/v2` | `packId` / `packVersion` / `siteVersion` / `shellVersion` / `manifestChecksum` / `configChecksum` | `contracts/src/mechanic-coverage.ts:54-62`；构造在 `pipeline/src/mechanic-coverage.ts:26-38` | 站点装配成功后由 CLI 写（`cli.ts:296-303`） |
| `visual-review-record/v1` | 同上六字段 | `contracts/src/visual-review-record.ts:13-21` | 人工评审写回（`delivery.ts:208-234`） |
| `delivery-evidence-manifest/v1` | 同上六字段 | `pipeline/src/evidence-integrity.ts:73-80` | `build-evidence-manifest` 独立命令 |
| `playtest` / `verify-mechanics` 记录 | `configChecksum` | `cli/src/playtest.ts:174-181`；`cli/src/verify-mechanics.ts:69-77` | 站点装配之后 |

这些先例证明：**「config 字节哈希进身份」在本仓已有四套实现**，且 `publish-gate.ts:30-32` 的
`fileChecksum` 已经是现成 helper。缺的只是 `QAReport` 与发布闸这一环。

---

## 4. 既有保障逐条判「覆盖 / 未覆盖」

| 机制 | 事实 | 是否覆盖本缺口 |
|---|---|---|
| build 一次性同时产 config + 报告 | `runBuild` 写 `run/v<N>/game-config.json`（`create-game.ts:573-608`）后跑 QA，QA 的 `configPath` 就是那一份（`:670`）；报告落 `run/v<N>/qa-report.json`（`:700-701`） | **build 路径覆盖**；**standalone `site` 不覆盖**（报告可复用、config 可换） |
| out 树 run 版本 | `candidateReports` 只按 `<outRoot>/<packId>/run/v*/qa-report.json` 找，新版本优先，再只比 pack subject（`publish-gate.ts:87-96,169-178`） | **未覆盖**：run 版本不等于 config 身份；兄弟 `game-config.json` 不被读 |
| config 字节哈希 | `fileChecksum` 存在（`publish-gate.ts:30-32`）；`mechanic-coverage` / `visual-review` / evidence manifest / playtest / verify-mechanics 都算 config 哈希 | **未覆盖**：`QAReport` 没有该字段，gate 不读；上述都是站点后或独立命令 |
| config 是否进 pack | 包 manifest 只有 `assets` / `files` / palette 等（`contracts/src/assetpack.ts:265-299`）；config 住 `run/v<N>/`（`artifacts.ts:23`），站点装配时才拷进 `site/v<N>/`（`layout.ts:100`） | **未覆盖**：config 不在 pack 身份里；`site.json` 只记 `pack` 版本与 config 文件名（`layout.ts:114-116`），不记哈希 |
| `mechanic-coverage` / `visual-review` 六字段 subject | 见 §3.1；两者都带 `configChecksum` | **先例，不覆盖**：mechanic-coverage 在站点后写；visual-review 需人工记录；gate 都不读 |
| `qa-report.delivery` | 可选；`config.file` 是路径不是哈希（`contracts/src/delivery.ts:144-145`）；由壳在站点后写（`pipeline/src/delivery.ts:6-10`） | **未覆盖**：standalone `site` 不写 delivery；gate 不读 delivery |
| 站点自身审计 | `auditGameConfig` / `auditGeometry` / `auditScreenSpace`（`site.ts:191,205,210`） | **部分覆盖**：`reference-resolution`、`layer-coverage` 被重跑；`reachability`、`visual-config-coherence` 不跑 |
| `verify-delivery` / evidence integrity | 会把 `qa.delivery.config.file` 的实际哈希与 evidence manifest 的 `subject.configChecksum` 对账（`evidence-integrity.ts:1045-1055`） | **未覆盖发布闸**：需要 `qa.delivery`（standalone `site` 没有），且是独立的事后命令（CLI USAGE `cli.ts:44`） |

---

## 5. 零成本确定性复现（E3）

### 5.1 最小复现：绿色报告（config A）+ config B ⇒ CLI `site` 发布成功

**构造**（全部在 `/tmp`，仓库语料只读）：

- pack：`fixtures/packs/last-train/v2`（既有 fixture，只读）。
- config A：`fixtures/game-configs/last-train.json`（既有 fixture；`auditReachability(A) === []`、
  `auditGameConfig(A)` 无 error，见 `packages/contracts/tests/reachability.test.ts:36-41`）。
- 绿色报告：临时 out 树 `<TMP>/out/last-train/run/v1/qa-report.json`，`checked` 为
  `QA_JUDGEMENTS` 全量、`failures: []`、`subject` 为 `{packId:"last-train", packVersion:2,
  manifestChecksum: manifestChecksumOf(PACK)}`。**这是既有测试的同款构造**
  （`packages/pipeline/tests/publish-gate.test.ts:33-40`），不是新代码。
- config B：同一份 fixture config + 一个 100px 高的实心墙
  `{id:"wall", kind:"solid", asset:"prop-luggage-pile", at:{x:600,y:250}, body:{w:20,h:100}}`
  （这是 `reachability.test.ts:64-69` 自己用的「100px 墙」配方，顶点 60.5px 过不去）。

**命令与结果**（工作目录 `packages/pipeline`，脚本 `/tmp/gm-pg04-wfgwEb/repro.mjs`，
`TMP=/tmp/gm-pg04-wfgwEb`）：

```text
$ TMP=/tmp/gm-pg04-wfgwEb node /tmp/gm-pg04-wfgwEb/repro.mjs
{ "step": "facts",
  "judgements": 7,
  "configA_reachability_errors": [],
  "configB_reachability_errors": ["entity \"suitcase-2\"", "entity \"suitcase-3\"", "entity \"signal\""],
  "configB_auditGameConfig_errors": [],
  "configB_schema_ok": true }
{ "step": "gate_with_config_B", "outcome": "PASS",
  "reportPath": "/tmp/gm-pg04-wfgwEb/out/last-train/run/v1/qa-report.json",
  "manifestId": "last-train" }
{ "step": "assemble_from_config_B", "outcome": "PASS", "command": "site",
  "siteDir": "last-train/site/v1", "siteVersion": 1, "packVersion": "v2", "siteConfigExists": true }
{ "step": "assemble_from_config_A_control", "outcome": "PASS", "siteDir": "last-train/site/v1" }
EXIT=0
```

**再走真实壳（CLI）**，两条定位方式都放行：

```text
# 显式报告
$ node packages/cli/dist/cli.js site fixtures/packs/last-train/v2 \
    --config /tmp/gm-pg04-wfgwEb/config-b.json \
    --qa-report /tmp/gm-pg04-wfgwEb/out/last-train/run/v1/qa-report.json \
    --out /tmp/gm-pg04-wfgwEb/out-cli2
EXIT=0
SITE_CONFIG_PRESENT=yes
wall_in_published_config= true

# 规范 out 树 auto 查找（out-auto 里只有 config A + 绿色报告）
$ node packages/cli/dist/cli.js site fixtures/packs/last-train/v2 \
    --config /tmp/gm-pg04-wfgwEb/config-b.json \
    --out /tmp/gm-pg04-wfgwEb/out-auto
EXIT=0
AUTO_SITE_CONFIG_PRESENT=yes
```

输出显示站点装配自己的三族 + 第四族（几何）+ 第五族（HUD）全过；即 gate 放行之后，站点不会
再因为 `reachability` 拒绝。`site/v1/game-config.json` 里确实含有 `wall`。

**这是「绿报告属于 A、发布 B」的完整复现**：报告 `failures: []` 是在 config A 上可成立的
（A 的 reachability / auditGameConfig 都 0 error），而实际发布物是含 100px 墙的 config B。

### 5.2 真实 QA runner 对 A/B 的逐条结果（E3）

用 `packages/qa/dist` 的 `gameplayQaRunner` + `layerCoverageJudgement` 对 A/B 各跑一次：

```text
config A: reference-resolution=[] · reachability=[] · layer-coverage=[]
config B: reference-resolution=[] · reachability=[error: suitcase-2, suitcase-3, signal] · layer-coverage=[]
EXIT=0
```

这证明：A 的绿色在 config 敏感的判据上成立；B 只在 `reachability` 上翻红，而 gate 看不到。

### 5.3 真实历史产物复现的尝试与限制

扫描 `out/**`、`fixtures/**`、`.scratch/**` 的 29 份 `qa-report.json`：

- 26 份有 `subject`，**0 份有 `configChecksum`**；
- 26 份有兄弟 `run/v<N>/game-config.json`，3 份没有（显式/外部报告）；
- 19 份有 `delivery`（其中 `config.file` 19 份）；
- 19 份同时有 config + VDS + design 兄弟文件，3 份三者都没有；
- `out/` 与 `fixtures/` 里 **0 份**报告，29 份全在 `.scratch/`（历史证据，不是当前发布输入）。

尝试用 `.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe` 的**真实**绿报告
（0 error、7/7 checked）配同目录 pack 和由它派生的 config B：gate 确实放行
（`manifestChecksum` 逐字匹配，`outcome: "PASS"`；config B 的字节与原 config A 不同），
但该历史 config 本身在当前 `auditGameConfig` 下有 2 条 error
（`chest-1` / `chest-2` 单帧），站点装配会先拒；因此它不是「当前仍可发布的干净 A」。
这一步只证明「真实报告 + 不同 config ⇒ gate 放行」，不把它当作 clean-A 的完整发布复现。本票因此用 last-train 既有 fixture +
测试同款报告构造做完整复现，并明确标注报告是构造的、A 的绿由独立判据复算。

### 5.4 基线绿测（E2）

```text
$ pnpm exec vitest run \
    packages/pipeline/tests/publish-gate.test.ts \
    packages/cli/tests/cli-site-gate.test.ts \
    packages/mcp/tests/assemble-site-qa-gate.test.ts \
    packages/contracts/tests/reachability.test.ts \
    packages/qa/tests/gameplay.test.ts
EXIT=0
Test Files  5 passed (5)
     Tests  58 passed (58)
```

现有 58 条测试**没有一条**构造「report 属于 A、config 是 B」；`cli-site-gate.test.ts:45-54`、
`assemble-site-qa-gate.test.ts:38-46`、`publish-gate.test.ts:33-40` 的 report 工厂都只有 pack
三字段。所以 E2 既证明基线行为，也证明覆盖空缺。

---

## 6. 若修：候选判据、误报边界、修改面、替代方案

### 6.1 候选判据 A（契约式，最直接）

```text
subject.configChecksum === fileChecksum(configPath)
```

- `fileChecksum` 已存在：`publish-gate.ts:30-32`（`"sha256:" + sha256(文件字节)`）。
- 字段形状与 `manifestChecksum` 完全相同：`qa.ts:292` 的正则、`mechanic-coverage.ts:52-62`、
  `visual-review-record.ts:13-21`、`evidence-integrity.ts:73-80` 都是先例。
- 语义应写成「**报告不能证明自己属于这份 config**」，不是「这份 config 有问题」——
  与今天缺 `subject` / `manifestChecksum` 不符的处理同构（`publish-gate.ts:114-120`）。
  这检测的是**陈旧/错配报告**，不是恶意伪造（和 `manifestChecksum` 同一威胁模型）。
- 若 `configPath` 缺省：要么把 `PublishGateOptions.configPath` 改为必填（四个壳都传；测试要改），
  要么「缺省即拒」/「缺省跳过」。三种选择对应不同的兼容面，见 §6.2。

**误报边界（合法发布流会被拒的情形）**

| 流 | 结果 | 依据 |
|---|---|---|
| `build` / `create --yes` / MCP `create_game` | **不误伤**（报告就是 run config 生成的） | `create-game.ts:670,684-691` |
| `--reuse-config` | **不误伤**（复用 config 被写进 run，QA/站点都用 run 那份） | `create-game.ts:573-608` |
| standalone `site` + 手写 config | **会被拒**，除非同一 config 也有一份带 `configChecksum` 的报告 | P0 研究 §8.4（`:364`）明确预言；今天没有「给任意 pack+config 跑 QA」的命令（CLI USAGE `cli.ts:25-44` 无 QA 命令） |
| 旧报告（无 `configChecksum`） | 若**必填**：全部拒；若**可选且缺席跳过**：旧报告继续放行，洞仍在 | 语料 26 份有 subject、0 份有 configChecksum |
| TD `td-config/v1` | **不误伤**：`formatOf` 在一切检查之前返回 `undefined` | `publish-gate.ts:147`；测试 `publish-gate.test.ts:86-88` |
| 外部包 / 外部报告 | 只要报告里带同一 config 的哈希就通过；否则拒 | `publish-gate.ts:156-163` 的显式路径 |
| 语义相同但字节重排的 config | **会被拒**（字节身份，不是语义身份） | `fileChecksum` 是字节哈希 |
| 同一 config 字节、不同 design/intent/VDS | **通过**；`configChecksum` 不绑定这些 QA 输入 | `QaContext` 有 `designPath` / `intentPath` / `vdsPath`（`qa.ts:468-491`），报告无对应身份 |

### 6.2 候选判据 B（不改契约，最小）

在 gate 里对 `(configPath, packDir)` 现场重跑 **`auditReachability`**（可选再加 `auditReferences`）：

```text
filter(auditReachability(parseGameConfig(configPath), readManifest(packDir)),
       i => i.severity === "error").length === 0
```

- 判据本体就是 B-02 已裁定可写的那条：`auditReachability(...).length === 0`（`reachability.ts:44-225`；
  03 表 B-02 行）。它的「错的一定不是设计」由 `reachability.ts:1-30` 的文件头保证。
- 这是 **contract-free**：不需要 `QAReport` 新字段，不需要 CLI/MCP 新参数，只改 `publish-gate.ts`；
  手写 config 只要可达就继续可发布——正好绕开 P0 研究 §8.4 预言的「会堵死手写 config 工作流」。
- 覆盖：`reachability`。**不覆盖** `visual-config-coherence`（需要 VDS/design；gate 今天没有 runDir）。
- 代价：gate 多一次纯层 BFS + 两次 JSON 解析（无网络、无模型；§5.2 实测毫秒级）。
- 与 B-02 的关系：它把 B-02 的同一个判据拉到发布闸，但不改变 build 阶段的失败分档；
  若 B-02 另行把 `auditReachability` 纳入 `auditConfigPipeline`，两边是同一函数、不同调用点。

### 6.3 候选判据 C（不改契约，利用 out 树兄弟文件）

报告在规范 out 树里时，要求：

```text
fileChecksum(configPath) === fileChecksum(path.join(dirname(reportPath), "game-config.json"))
```

- 依据：`RUN_ARTIFACT.config` 与 `RUN_ARTIFACT.qaReport` 同在 `run/v<N>/`（`artifacts.ts:14-30`）。
- 覆盖：语料 26/29 份报告有兄弟 config；3 份没有（显式/外部报告）。
- 不覆盖：外部报告、报告被单独拷走、手写 config 无 run 目录。
- 只改 `publish-gate.ts`，不改契约。

### 6.4 候选判据 D（不改契约，利用已有 `delivery.config.file`）

若报告带 `delivery`（19/29 语料报告），gate 可把 `delivery.config.file`（相对 `outRoot`）解析出来，
与 `configPath` 做字节比较。

- 依据：`delivery.config.file` 是站点后写回的 run config 相对路径（`contracts/src/delivery.ts:144-145`；
  `pipeline/src/delivery.ts:34-44`）。
- 覆盖：build 产出的、已装配过站点的报告；不覆盖 standalone/无 delivery 的报告（10/29）。
- 只改 `publish-gate.ts`，不改契约。

### 6.5 修改面（判据 A）

| 层 | 文件 | 改动 |
|---|---|---|
| 契约 | `packages/contracts/src/qa.ts:287-293` | `subject` 新增可选 `configChecksum`（同 Sha256 正则）；更新 `:278-282` 与 `:285-286` 注释；`qa-report/v1` 是否升版需单独决定（`delivery` 的加性先例是 `:301-304` 不升版） |
| 生产者 | `packages/pipeline/src/create-game.ts:36,684-691` | 注入 `configChecksum: fileChecksum(path.join(runDir, RUN_ARTIFACT.config))`（`fileChecksum` 已从 `publish-gate` 导出；当前只 import 了 `manifestChecksumOf`） |
| 消费者 | `packages/pipeline/src/publish-gate.ts:39-49,112-121` | 比较 `subject.configChecksum` 与 `fileChecksum(configPath)`；决定 `configPath` 缺省时的策略 |
| 文档 | `docs/v2/01-contracts.md:589-604` | `qa-report/v1` 的 subject 说明补 config 身份 |
| 测试 | `pipeline/tests/publish-gate.test.ts`、`cli/tests/cli-site-gate.test.ts`、`mcp/tests/assemble-site-qa-gate.test.ts`、`pipeline/tests/create-game.test.ts:727-730` | 新增「A 报告 + B config ⇒ 拒」；「A+A ⇒ 过」；旧报告/缺字段策略；TD 跳过回归；create-game 注入断言 |
| 旁及测试 | `pipeline/tests/delivery-integration.test.ts:71`、`cli/tests/build-evidence-manifest.test.ts:45`、`pipeline/tests/evidence-manifest.test.ts:47` | 可选字段，通常无需改；若它们要断言新 subject 则补 |
| 依赖 | — | **无新增**（`node:crypto` / `fs` 已在 `publish-gate.ts:20-22`） |
| Runtime | — | **不改** |
| CLI/MCP 对外形状 | — | **不加参数、不改返回形状**；行为变严格（`site` / `assemble_site` 会拒错配 config），退出码仍 `invalid` 4 |
| 公共 API | `packages/pipeline/src/index.ts:13` | `PublishGateOptions.configPath` 若改为必填，属 pipeline 公共类型变更（库调用方受影响） |

### 6.6 修改面（判据 B / C / D）

- 只改 `packages/pipeline/src/publish-gate.ts`（加 import `parseGameConfig` / `auditReachability`
  或兄弟 config 读取）与对应 4 组测试；**不改 contracts、不改 Runtime、不改 CLI/MCP、不加依赖**。
- 失败文案与退出码：仍是 `CommandError("invalid")`（4）；文案需说清「这是当前 config 的问题」还是
  「报告不能证明属于这份 config」——判据 B 是前者，C/D 是后者。

### 6.7 四门槛事实（供 05/下一轮裁定，不在本票裁定）

| 门槛 | 判据 A（契约式） | 判据 B（gate 重跑 reachability） |
|---|---|---|
| 1 当前仍成立 | 是（§5） | 是（§5） |
| 2 判据可写 | 可写；但它是「无法证明」而非「config 错」，语义要写清 | 可写；`auditReachability(...).length === 0` 是既有判据 |
| 3 语料零误伤 | 26/29 历史报告（有 subject、无 configChecksum）在「必填」下会被拒；`out/`/`fixtures/` 0 份报告，故无当前发布输入被误伤；26 条新拒均可解释为旧报告 | 01-b-class 的 134 对 config+manifest 0 条 reachability error；本票 21 个 report/config/pack 三元组 0 条；当前语料预计 0 新 error |
| 4 修改面可控 | 契约变更（Q5 单列）+ pipeline + 测试；无新依赖、不改 Runtime/CLI/MCP 形状 | 仅 `publish-gate.ts` + 测试；无契约、无外部形状变化 |

---

## 7. 既有裁定逐字引用

### 7.1 `publish-gate.ts:10-12`

```ts
// ⚠️ **只钉 pack，不钉 config**（票 05 §8.4 的残余风险）：`reachability` /
//   `reference-resolution` 吃配置，一份绿色 pack 报告仍可给另一份手写 config 放行。
//   P0-02 的票面只要求 pack 身份；config 身份另说。
```

### 7.2 P0-02b 票 05 研究文件 §8.4（`.scratch/p0-construction-v1/research/site-qa-seam.md:362-364`）

```text
### 8.4 残余风险 / 必须写进 09 的话

1. **只钉 pack，不钉 config。** `reachability` / `reference-resolution` 吃 config；一份绿色 pack 报告可给另一份手写 config 放行。P0-02 的票面只要求 pack id+version；若要堵这个洞，需另裁 `subject.configChecksum`，但今天没有「给任意 pack+config 跑 QA」的入口，会堵死手写 config 工作流（如 `2026-10-20e-site` 的手写 config）。建议 09 明确写「本票只保证 pack 身份；config 身份不在范围内」。
```

票 05 自身的残余风险行（`.scratch/p0-construction-v1/issues/05-r1-site-qa-seam.md:65`）逐字为：

```text
**残余风险（需 09 明写）**：只钉 pack 不钉 config（`reachability` 是 config 相关）；同 id/version 的包内容被改需 `manifestChecksum` 或 P0-04 的 `verifyPack`；`incomplete` 阻断在票 08 前会让全部发布变红；旧报告无 subject 一律拒；库直调 `assembleSite` 绕过 gate；自动查找只对规范 out 树有效。
```

### 7.3 P0-02b 票 09（`.scratch/p0-construction-v1/issues/09-p0-02b-publish-gate.md:113-117`）

```text
- **只钉 pack，不钉 config**：`reachability` / `reference-resolution` 吃配置；一份绿色 pack 报告
  仍可给另一份手写 config 放行（P0-02 票面只要求 pack 身份）。
- **同 id/version 内容被改**：`manifestChecksum` 能发现 manifest 声明改动；逐文件字节完整性归
  P0-04 的 `verifyPack`（create/build 链已跑）。**standalone `site` 不重算 checksum**（本票裁定）。
- **旧报告无 subject 一律拒绝**（「无法证明」；重跑 `build` 生成带身份的报告）。
```

### 7.4 本图 03 的边界（`issues/03-disposition-ruling.md:78,175`）

`§3 B-02` 逐字：

```text
- **边界**：`publish-gate` 的 config 身份绑定是独立待核实事项，不得视为被本项自动解决；不扩展 B-02 修改范围。
```

`§7 未决事项与下一轮` 逐字：

```text
- **B-02 第二半**：`publish-gate` 只钉 pack、不钉 config；独立待核实，不并入 B-02，不视为已解决。
```

---

## 8. 归属选项（只列事实，不裁定）

### 选项 1：作为 B-02 的一部分

**支持的事实**

- `publish-gate.ts:10-12` 把它写在 B-02 同一处；01-b-class §4.1 把它作为 B-02「不只是阶段晚」的论据。
- B-02 的判据 `auditReachability(...).length === 0` 与 §6.2 的不改契约方案是同一个函数；
  若 B-02 已把 reachability 纳入 `auditConfigPipeline`，gate 复用同一入口可减少重复。
- 只开一张票可以避免两个改动同时编辑 `publish-gate.ts` / 同一组测试。

**反对的事实**

- 03 §3（`:78`）逐字禁止扩展 B-02 修改范围；03 §7（`:175`）逐字「独立待核实，不并入 B-02」。
- B-02 的修改面是 `config-audit` + `ops` + `create-game`（03 表 B-02 行）；config 身份绑定要动
  `contracts/qa.ts` + `publish-gate.ts` + `create-game.ts`，是另一组文件与一次 Q5 契约审批。
- **B-02 修完也不封住 standalone `site`**：`assembleSite` 不调用 `auditConfigPipeline`
  （`site.ts:191,205,210` 只调 `auditGameConfig` / `auditGeometry` / `auditScreenSpace`），
  合并会制造「B-02 已解决」的错觉。

### 选项 2：独立修复项

**支持的事实**

- 有独立、可写的判据（§6.1 / §6.2），独立的误报边界（手写 config / 旧报告 / TD），独立的修改面与
  契约审批点；03 已把它标为独立待核实。
- 不改契约的版本（§6.2 / §6.3）只动 `publish-gate.ts`，符合 03 对普通修复的「修改面可控」。
- 可以在不改变 B-02 失败分档的前提下，单独给 standalone `site` 补上 `reachability`。

**反对的事实**

- 与 B-02 共用 `reachability` 判据与 `reachability.ts` 实现；两个票若同时改 `publish-gate.ts`
  与 QA/config 测试，可能冲突。
- 本图 03 的统计是「4 修复 / 7 推迟」；新增一个修复项会改变该计数，属于下一轮的方案切法问题
  （03 §7 已把切法留给下一轮），不是本票能决定的。

### 选项 3：另立 effort

**支持的事实**

- config 身份在本仓已经是跨报告模式（`mechanic-coverage` / `visual-review` / evidence manifest /
  playtest / verify-mechanics 五处都有六字段或 configChecksum）；统一「报告 → config」身份
  可以顺带覆盖 `design` / `intent` / `VDS` 这些 QA 输入（今天 `QAReport` 对它们也没有身份）。
- 判据 A 的兼容边界涉及「手写 config 工作流 + 无 standalone QA 命令」这一产品问题
  （P0 研究 §8.4；CLI USAGE `cli.ts:25-44` 无 QA 命令），可能需要超出本图的决定。
- 可作为 Q8 推迟项，带交接说明进入后续 effort。

**反对的事实**

- 局部修复很小：`fileChecksum` 已存在、六字段 subject 已有四套先例、无新依赖、不改 Runtime；
  判据 B/C 甚至只动一个文件。
- 推迟的代价是：在后续 effort 启动前，standalone `site` 仍可用 A 的绿报告发布 B
  （§5 已复现）；而本图本来就停在审批门前，另立 effort 可能把它推到更远。
- 03 已把「方案票切法」留给下一轮，另立 effort 与「作为独立修复项」在流程上只差交接形态，
  本票没有足够依据替下一轮选择。

---

## 9. 新发现与风险

1. **「六条判据」是过期口径**：基线 `QA_JUDGEMENTS` 是 7 条（`qa.ts:111-160`），`assemble.ts:91-98`
   显式装配 7 个键；大量注释仍写「六条 / 6/6 / 三个族 5 条」（例如 `qa.ts:104,448`、
   `assemble.ts:12,82`、`publish-gate.ts:124`、`create-game.ts:224`）。功能按 7 条运行，
   但票面与旧注释会让人漏掉第七条。**第七条 `visual-config-coherence` 恰是 config 敏感且站点不重跑的**。
2. **`reference-resolution` 的实际弹着点小于注释**：站点 `auditGameConfig` 已用同一
   `auditReferences` 重跑（`site.ts:191` → `game-config.ts:506`），发布产物不会带引用族 error；
   真正未重跑的是 `reachability` 和 `visual-config-coherence`。
3. **历史语料 0/29 份报告有 config 身份**：26 份有 subject，0 份有 `configChecksum`；
   26 份有兄弟 config，3 份没有。任何「必填 configChecksum」方案都会让这 26 份历史报告
   不再能作为发布输入；它们都在 `.scratch/`，不是当前 `out/`/`fixtures/` 的发布输入。
4. **没有 standalone QA 命令**：CLI USAGE（`cli.ts:25-44`）与 MCP 工具表（`server.ts:82-243`）
   都没有「对任意 pack+config 跑 QA」的入口。这是判据 A 会堵死手写 config 工作流的根因，
   也是判据 B（gate 现场重跑）值得单列的原因。
5. **`qa-report` 的 `subject` 是 strict**：今天加 `configChecksum` 会被 schema 直接拒
   （实测 `Unrecognized key: "configChecksum"`），所以「先写字段、后补 schema」的渐进路径不存在；
   契约与生产者必须同一次改。
6. **`site` / `assemble_site` 不写 `delivery`**：`assembleSite` 不写 delivery（`demo/src` 无 delivery 引用），
   因此 `verify-delivery` / `playtest` / `verify-mechanics` / mechanic-coverage 这些事后 config
   对账都覆盖不到 standalone `site` 的发布物。
7. **报告构造的诚实边界**：§5.1 的绿报告是测试同款手写构造，不是 `runBuild` 真产出的；
   原因不是不能跑，而是 last-train fixture 没有 intent/design/VDS 全套输入，无法零成本重跑完整
   QA。A 的绿色已用 `auditReachability(A) === []`、`auditGameConfig(A)` 0 error 和真实
   `gameplayQaRunner` 的 A/B 对照独立复算；这不影响「gate 无法区分 A/B」的结论。

---

## 10. 验证命令与退出码

| # | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 1 | `git rev-parse HEAD`；`git diff --stat 3b1b61d -- packages fixtures docs` | 0 | HEAD `8a155f7`；diff 为空，源码=基线 |
| 2 | `pnpm exec vitest run packages/pipeline/tests/publish-gate.test.ts packages/cli/tests/cli-site-gate.test.ts packages/mcp/tests/assemble-site-qa-gate.test.ts packages/contracts/tests/reachability.test.ts packages/qa/tests/gameplay.test.ts` | **0** | 5 files / 58 tests passed |
| 3 | `TMP=/tmp/gm-pg04-wfgwEb node /tmp/gm-pg04-wfgwEb/repro.mjs` | **0** | gate PASS + assemble PASS（config B，3 条 reachability error，`auditGameConfig` 0 error） |
| 4 | `node packages/cli/dist/cli.js site fixtures/packs/last-train/v2 --config <TMP>/config-b.json --qa-report <TMP>/out/last-train/run/v1/qa-report.json --out <TMP>/out-cli2` | **0** | site 产出；`site/v1/game-config.json` 含 wall |
| 5 | `node packages/cli/dist/cli.js site fixtures/packs/last-train/v2 --config <TMP>/config-b.json --out <TMP>/out-auto`（out-auto 含 config A + 绿报告） | **0** | auto 查找也放行；`site/v1/game-config.json` 存在 |
| 6 | `node packages/qa/dist` 的 `gameplayQaRunner` + `layerCoverageJudgement` 对 A/B | **0** | A 三条全空；B 仅 reachability error |
| 7 | `QAReportSchema.safeParse`（无 / 有 `subject.configChecksum`） | **0** | `true` / `false`（`Unrecognized key: "configChecksum"`） |
| 8 | 语料扫描（29 报告 / 117 config / 26 sibling config / 0 configChecksum） | **0** | 见 §5.3 |
| 9 | 语料 21 个 report/config/pack 三元组重判 | **0** | `reachPositive: 0`；`auditPositive: 19`；`clean: 2` |

复现脚本与语料扫描脚本都在 `/tmp/gm-pg04-wfgwEb/`；脚本正文见附录 A。没有写仓库内任何
run / pack / site / fixture / 契约文件。

---

## 附录 A：复现脚本（读-only；只写 `/tmp`）

```js
// /tmp/gm-pg04-wfgwEb/repro.mjs
import fs from "node:fs";
import path from "node:path";
import { QA_JUDGEMENTS, QA_REPORT_FORMAT, parseGameConfig, parseAssetPack,
         auditGameConfig, auditReachability } from "<repo>/packages/contracts/dist/index.js";
import { assertPublishableQa, manifestChecksumOf } from "<repo>/packages/pipeline/dist/publish-gate.js";
import { assembleFromConfig } from "<repo>/packages/demo/dist/assemble.js";

const ROOT = "<repo>";
const TMP = process.env.TMP;
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const CFG_A = path.join(ROOT, "fixtures/game-configs/last-train.json");
const mp = parseAssetPack(JSON.parse(fs.readFileSync(path.join(PACK, "manifest.json"), "utf8")));
const ca = parseGameConfig(JSON.parse(fs.readFileSync(CFG_A, "utf8")));
const cfgAraw = JSON.parse(fs.readFileSync(CFG_A, "utf8"));

// config B = config A + 100px wall (reachability.test.ts recipe)
const cfgB = structuredClone(cfgAraw);
cfgB.entities.push({ id: "wall", kind: "solid", at: { x: 600, y: 250 },
  asset: "prop-luggage-pile", body: { w: 20, h: 100 } });
const cb = parseGameConfig(cfgB);
const cfgBpath = path.join(TMP, "config-b.json");
fs.writeFileSync(cfgBpath, JSON.stringify(cfgB, null, 2) + "\n");

// canonical out tree: run/v1 holds config A + green report
const out = path.join(TMP, "out");
const run = path.join(out, "last-train", "run", "v1");
fs.mkdirSync(run, { recursive: true });
fs.writeFileSync(path.join(run, "game-config.json"), JSON.stringify(cfgAraw, null, 2) + "\n");
fs.writeFileSync(path.join(run, "qa-report.json"), JSON.stringify({
  format: QA_REPORT_FORMAT, checked: [...QA_JUDGEMENTS], failures: [],
  observations: [{ source: "inspect", outcome: "ok", lines: [] },
                 { source: "review", outcome: "unavailable", reason: "repro" }],
  subject: { packId: mp.value.id, packVersion: mp.value.version,
             manifestChecksum: manifestChecksumOf(PACK) },
}, null, 2) + "\n");

// 1) gate with config B + green report for A
assertPublishableQa({ packDir: PACK, configPath: cfgBpath, outRoot: out });
// 2) site assembly with config B
assembleFromConfig({ packDir: PACK, configPath: cfgBpath,
  shellJsPath: path.join(ROOT, "packages/demo/dist/shell.js"),
  outRoot: path.join(TMP, "out-site") });
```

> 说明：脚本正文在临时目录；上面的 `<repo>` 是实际绝对路径。报告构造与
> `publish-gate.test.ts:33-40` 同款；A 的绿色由 `auditReachability(A)` / `auditGameConfig(A)`
> 与 `gameplayQaRunner` A/B 对照独立验证。

## 附录 B：语料扫描输出（E3，exit 0）

```json
{
  "reports": 29,
  "configs": 117,
  "withSubject": 26,
  "withConfigChecksum": 0,
  "siblingConfig": 26,
  "siblingVds": 19,
  "siblingDesign": 23,
  "allThree": 19,
  "none": 3,
  "withDelivery": 19,
  "withDeliveryConfigFile": 19,
  "out_reports": 0,
  "fixtures_reports": 0,
  "scratch_reports": 29
}
```

```json
{ "triples": 21, "reachPositive": 0, "auditPositive": 19, "clean": 2 }
```

## 附录 C：关键源码索引（基线 `3b1b61d`）

| 事实 | 位置 |
|---|---|
| gate 只钉 pack 的注释 | `packages/pipeline/src/publish-gate.ts:10-12` |
| `fileChecksum` / `manifestChecksumOf` | `publish-gate.ts:30-32,35-37` |
| `PublishGateOptions`（`configPath` 只识别 TD） | `publish-gate.ts:39-49` |
| `formatOf` / TD 跳过 | `publish-gate.ts:75-83,147` |
| `candidateReports`（只按 pack/out 树） | `publish-gate.ts:87-96,169-178` |
| `subjectProblem`（只比三字段） | `publish-gate.ts:112-121` |
| CLI build 闸 / 站点 | `packages/cli/src/cli.ts:281-284,288-291` |
| CLI `site` 闸 / 站点 | `packages/cli/src/cli.ts:705-727` |
| MCP `create_game` 闸 / 站点 | `packages/mcp/src/server.ts:374-378,384-387` |
| MCP `assemble_site` 闸 / 站点 | `packages/mcp/src/server.ts:433-442` |
| pipeline `createGame` 不装配 | `packages/pipeline/src/create-game.ts:761-782` |
| QA 的 `configPath` / 报告 subject 注入 | `create-game.ts:665-676,684-691` |
| `QA_JUDGEMENTS`（7 条） | `packages/contracts/src/qa.ts:111-160` |
| `QAReportSchema.subject`（strict） | `packages/contracts/src/qa.ts:283-304` |
| `buildQAReport`（不产 subject） | `packages/contracts/src/qa.ts:370-384` |
| gameplay 判据 | `packages/qa/src/gameplay.ts:71-85` |
| layer 判据 | `packages/qa/src/layers.ts:48-60` |
| visual 判据 / `visual-config-coherence` | `packages/qa/src/visual.ts:86-104,196-277` |
| intent 判据 | `packages/qa/src/intent.ts:78-94` |
| `auditGameConfig` 以 `auditReferences` 开头 | `packages/contracts/src/game-config.ts:498-511` |
| `auditReachability` | `packages/contracts/src/reachability.ts:44-225` |
| `auditConfigPipeline`（不含 reachability） | `packages/contracts/src/config-audit.ts:34-49` |
| 站点自身审计 | `packages/demo/src/site.ts:43,191,205,210-213` |
| `SiteOptions`（无 runDir/VDS/design） | `packages/demo/src/site.ts:145-156` |
| config 在 run，不在 pack | `packages/pipeline/src/artifacts.ts:14-30`；`packages/contracts/src/assetpack.ts:265-299` |
| 站点写 config / `site.json` | `packages/demo/src/layout.ts:100,114-116` |
| 六字段 subject 先例 | `mechanic-coverage.ts:54-62`；`visual-review-record.ts:13-21`；`evidence-integrity.ts:73-80` |
| 事后 config 对账 | `pipeline/src/delivery.ts:208-234`；`cli/src/playtest.ts:174-181`；`cli/src/verify-mechanics.ts:69-77` |
| QA 闸测试（无 config 用例） | `pipeline/tests/publish-gate.test.ts:33-40`；`cli/tests/cli-site-gate.test.ts:45-54`；`mcp/tests/assemble-site-qa-gate.test.ts:38-46` |
