# publish-gate 的 config 身份绑定：是否构成独立缺口

Type: research
Status: resolved
Owner: research subagent · 2026-11-03
Blocked by: —
Map: ../map.md

## Question

`publish-gate`（`packages/pipeline/src/publish-gate.ts`）今天只把 QA 报告绑定到 **pack**
（`subject.packId` / `packVersion` / `manifestChecksum`），不绑定 **config**；`PublishGateOptions.configPath`
只用于识别 TD（`formatOf`）。与此同时 QA 的 `reachability` / `reference-resolution` 判据吃 config。
本票核实：这是不是一个**独立于 B-02 的真实缺口**，以及若修复需要动什么。

### 必须回答

1. **当前事实**：`assertPublishableQa` 的调用点（`packages/cli/src/cli.ts:281,717`、
   `packages/mcp/src/server.ts:374,433`）在什么情况下同时持有 pack 与 config？QA 报告与站点装配
   是否**可能**使用不同的 config？逐条给 `file:line`。
2. **缺口是否真实**：能否在**零付费、确定性**条件下复现「一份属于 config A 的绿色报告，给 config B 放行」？
   最小复现只许用临时目录与既有 fixture，不改仓库语料。记录命令、退出码、路径。
3. **config 敏感性**：六条 QA 判据中哪些依赖 config？（至少核对 `packages/qa/src/gameplay.ts:71-85`
   的 `reference-resolution` / `reachability`；其余四条也逐条判。）`QAReport` 是否已有承载 config 身份的字段
   （`packages/contracts/src/qa.ts:278-300`）？
4. **既有保障**：是否有其它机制已覆盖或部分覆盖——build 一次性同时产 config/报告、out 树 run 版本、
   config 字节哈希、config 是否进 pack、`mechanic-coverage` / `visual-review` 的六字段 `subject` 先例
   （`packages/contracts/src/mechanic-coverage.ts:54`、`visual-review-record.ts`）？逐条判「覆盖 / 未覆盖」。
5. **候选判据**：若修，精确、可计算的判据是什么（例如 `subject.configChecksum === fileChecksum(configPath)`）？
   误报边界：哪些合法发布流会因此被拒（外部包、手写 config、TD 跳过、旧报告）？
6. **修改面**：涉及包/文件/契约/调用链；是否新增依赖；是否改 Runtime / CLI / MCP 对外形状。
   给出**至少一个不改契约**的替代方案。
7. **既有裁定逐字引用**：`publish-gate.ts:10-12` 的「只钉 pack，不钉 config」、
   P0-02b 票 05 §8.4、本图 03 的边界（`issues/03-disposition-ruling.md` §3 B-02、§7）。
8. **归属建议（只陈述，不裁定）**：作为 B-02 的一部分 / 独立修复项 / 另立 effort，各列出支持与反对的事实。
   不要替用户选择，也不要把它并入 B-02 的修改范围。

### 约束

- **只读**：不修改生产代码、测试、fixture、契约、历史证据；不 commit、不建分支、不推送。
- **零付费、零模型调用、零生图**；需要运行测试时只用既有测试与 fixture，记录命令与退出码。
- 证据分级：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据。
- 不把 PRD 当事实来源；一切规则以源码与 Runtime 消费逻辑为准。

### 产出

- 报告写入 `../research/04-publish-gate-config-identity.md`。
- 本票追加 `## Answer`（一页以内：事实表 + 缺口结论 + 候选判据 + 修改面 + 归属建议），`Status` 改 `resolved`。

## Answer

**结论：是独立于 B-02 的真实缺口（E1 + E2 + E3）。** 完整报告：
[`../research/04-publish-gate-config-identity.md`](../research/04-publish-gate-config-identity.md)。

### 1. 事实表

| 事实 | 证据 |
|---|---|
| gate 只比 `subject.packId` / `packVersion` / `manifestChecksum`；`configPath` 只用于 TD 识别 | `packages/pipeline/src/publish-gate.ts:112-121,42-43,147` |
| build / `create --yes` / MCP `create_game`：QA 与站点用同一个 `built.paths.config` | `packages/cli/src/cli.ts:281-291`；`packages/mcp/src/server.ts:374-387`；`packages/pipeline/src/create-game.ts:665-676,684-691` |
| CLI `site` / MCP `assemble_site`：config 任意；报告只按 pack 身份定位 | `cli.ts:705-727`；`server.ts:433-442`；`publish-gate.ts:87-96,169-178` |
| 基线判据实际 **7 条**（不是 6 条）；config 敏感 4 条 | `packages/contracts/src/qa.ts:111-160` |
| 站点重跑 `reference-resolution`（`auditGameConfig`→`auditReferences`）与 `layer-coverage`；**不重跑** `reachability` 与第七条 `visual-config-coherence` | `packages/demo/src/site.ts:191,205,210`；`game-config.ts:506`；`qa/src/visual.ts:196-277` |
| `QAReport` 不能携带 config 身份：`subject` 是 strict 的 `{packId,packVersion,manifestChecksum?}`；塞 `configChecksum` 被 schema 拒 | `qa.ts:283-304`；E3 `Unrecognized key: "configChecksum"` |
| 既有机制均未在 gate 上覆盖：run 兄弟 config 不读、config 不进 pack、六字段 subject 都是站点后/独立命令 | 报告 §4 |
| **零成本复现**：CLI `site` 用 config A 的绿报告发布带 100px 墙的 config B，exit 0；B 有 3 条 reachability error，`auditGameConfig` 0 error | 报告 §5（explicit + auto 两条，均 exit 0） |
| 语料：29 份 qa-report，26 有 subject，**0 有 configChecksum**；26 有兄弟 config；`out/`/`fixtures/` 0 份 | 报告 §5.3 |

### 2. 缺口结论

**独立真实缺口。** 实际弹着点比 `publish-gate.ts:10-12` 写的窄：`reference-resolution` 已被站点
装配用同一 `auditReferences` 重跑；真正能在「绿报告属于 A、实际发布 B」时漏过去的是
**`reachability`** 与 **`visual-config-coherence`**。B-02 修完也不封住它：B-02 的修改面是
`config-audit` + `ops` + `create-game`，而 `assembleSite` 不调用 `auditConfigPipeline`，
standalone `site` 仍只跑 `auditGameConfig` / `auditGeometry` / `auditScreenSpace`。
反过来，config 身份也不替代 B-02（build 期的重采样/失败分档是另一件事）。

### 3. 候选判据（未实施，未裁定）

- **A（契约式）**：`subject.configChecksum === fileChecksum(configPath)`。`fileChecksum` 已存在
  （`publish-gate.ts:30-32`）；六字段 subject 有四套先例。误报边界：旧报告（26/29 会被拒）、
  手写 config（无 standalone QA 命令，P0 研究 §8.4 预言会堵死）、字节重排的等价 config 被拒、
  TD 不受影响；它不绑定 design/intent/VDS。
- **B（不改契约）**：gate 现场重跑 `auditReachability(configPath, packDir)`，error ⇒ 拒。
  保住手写 config 工作流，只动 `publish-gate.ts`；不覆盖 `visual-config-coherence`。
- **C（不改契约）**：报告在规范 out 树时，比较 `configPath` 与报告兄弟 `game-config.json` 的字节
  （语料 26/29 可覆盖；外部/显式报告 3/29 不行）。D（利用已有 `delivery.config.file`）覆盖 19/29。

### 4. 修改面

- **A**：`contracts/src/qa.ts:287-293`（可选字段）＋ `pipeline/src/create-game.ts:36,684-691`（注入）＋
  `pipeline/src/publish-gate.ts:39-49,112-121`（比较/缺省策略）＋ 4 组测试 ＋
  `docs/v2/01-contracts.md:589-604`。无新依赖、不改 Runtime、不加 CLI/MCP 参数；行为变严格；
  契约变更须 Q5 单列审批。
- **B/C/D**：只改 `publish-gate.ts` ＋ 测试；无契约、无外部形状变化。

### 5. 归属选项（事实，不裁定）

- **并入 B-02**：支持——同一残余注释、同一 `reachability` 判据、避免两次改 gate；反对——03 §3/:78
  禁止扩展 B-02 修改范围，03 §7/:175 明写不并入，且 B-02 修完仍不封 standalone `site`。
- **独立修复项**：支持——独立判据/误报边界/契约审批点，B/C 只动一个文件，03 已标独立；
  反对——与 B-02 共用 `reachability` 与 gate/测试，新增第五个修复项会改 03 的 4 项计数（切法归下一轮）。
- **另立 effort**：支持——config/design/intent/VDS 身份是跨报告模式，手写 config 工作流需产品决定，
  可走 Q8 交接；反对——局部修复很小、无新依赖，推迟期间洞仍在，切法本来就留给下一轮。

**新发现（需带进下一轮）**：①「六条判据」是过期口径，基线 7 条，第七条 `visual-config-coherence`
config 敏感且站点不重跑；②`reference-resolution` 已被站点重跑，注释的并列说法需修正；③29 份历史
报告 0 份有 config 身份；④没有「给任意 pack+config 跑 QA」的命令。

**约束确认**：未修改生产代码、测试、fixture、契约、历史证据；未 commit / 建分支 / 推送；零付费、
零模型调用、零生图。唯一写入是 `research/04-publish-gate-config-identity.md` 与本票。
