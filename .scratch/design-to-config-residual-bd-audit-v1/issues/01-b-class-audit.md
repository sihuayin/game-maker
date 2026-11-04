# B 类当前源码复核：Q2 / Q7 / Q10(a)(b)(c) / interactables / decor

Type: research
Status: resolved
Owner: research subagent · 2026-11-03
Blocked by: —
Map: ../map.md

## Question

在 P1 实施后的当前源码（`main` @ `3b1b61d`）上，逐原子项复核 P0 的 B 类结论是否仍成立、
是否已被 P1 改变，并给出**事实、证据与候选判据**。本票**不裁定修复去留**——裁定归 03。

### 原子项

| 编号 | 原子项 | 复核重点 |
|---|---|---|
| B-01 | Q2：sprite 内部语义 / `role` 无人读 | P1 是否增加了机读语义，还是仍只有资源形态约束 |
| B-02 | Q7：`reachability` 只在 QA | 当前 QA 覆盖是否充分；是否仍应留在 QA 层 |
| B-03 | Q10(a)：地形仅有提示词线索 | 既有裁定是否仍有效，是否存在新的契约事实 |
| B-04 | Q10(b)：layout 散文表达 | 同上 |
| B-05 | Q10(c)：斜坡无独立槽位 | 同上 |
| B-06 | `interactables` 同桶误归属 | 是否仍属于既有冻结限制，不借本图重开旧裁定 |
| B-07 | `decor` 无 kind 锁 | 同上 |

### 每项必须交付（逐条 `file:line`）

1. **当前状态**：P1 后的源码事实；写明 P1 的 `ConfigIssue.code`、`auditConfigPipeline`、
   五类实体 kind 锁是否改变了该项的成立条件。
2. **证据**：E1 源码定位；E2 既有测试（文件 + 用例名 + 断言）；E3 零付费复现或既有产物重判
   （命令 + 退出码 + 路径）。仅历史推断必须显式标注。
3. **候选判据**：若可写，给出精确判据与误报边界；若不可写，说明缺什么语义信息。
4. **语料重判**：用现有 `out/**`、`fixtures/**`、`.scratch/**` 全量扫描，报告该项一旦落判据
   的新增 error 数量与逐条解释（不得修改语料）。
5. **修改面**：涉及包、文件、契约、调用链；是否新增依赖、是否改 Runtime/CLI/MCP 形状。
6. **契约变更候选**：若有，列变更内容、必要性、至少一个不改契约的替代方案、影响面与不做后果。
7. **前置裁定**：该项是否受 `entity-identity-v1.1`、P0/P1 或 PRD 既有裁定约束；若有，逐字引用。

### 约束

- **只读**：不修改生产代码、测试、fixture、契约、历史证据；不 commit、不建分支、不推送。
- **零付费、零模型调用、零生图**；需要运行测试时只用既有测试与 fixture，记录命令与退出码。
- 不把 PRD 的槽位表当作事实来源；一切规则以源码与 Runtime 消费逻辑为准。
- 证据分级：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据。

### 产出

- 报告写入 `../research/01-b-class.md`（相对本票）。
- 本票追加 `## Answer`（一页以内：逐原子项状态表 + 证据定位 + 候选判据 + 语料重判摘要），
  `Status` 改 `resolved`。


## Answer

**结论：B-01…B-07 在 P1 后全部仍成立；P1 未消除任何一项。** `ConfigIssue.code` 三码不涉及 B 类；
`auditConfigPipeline` 未纳入 `auditReachability`，但把 `auditEntityIdentity` 扩大到 build 汇合点；
五类实体 kind 锁只锁 `sprite|animation`，不锁 `sprite` 内部语义；`decor` 显式保持无锁。
**处置未定，归 03。** 完整证据见 [`../research/01-b-class.md`](../research/01-b-class.md)。

| 项 | 当前仍成立 | 证据级别 | 关键源码位置（基线 `3b1b61d`） | 语料重判（候选判据） | 契约变更候选 |
|---|---|---|---|---|---|
| B-01 | 是 | E1+E2+E3 | `asset-spec.ts:17`、`assetpack.ts:105,167`、`game-config.ts:349-363,400-418`、`ops.ts:953-964`（横版 brief 不打印 role）vs `:1373-1378`（塔防打印） | role 非空 0；solid role 关键词 0/318；semanticClass 必填：1599 件资产缺字段 | 是：`AssetSpec`/`AssetPackEntry` 增必填 `semanticClass` |
| B-02 | 是 | E1+E2+E3 | `reachability.ts:44-225`；唯一调用 `qa/src/gameplay.ts:80`；`config-audit.ts:34-49` 未纳入；`publish-gate.ts:10-12` 只钉 pack | 134 对 config+manifest：**0** 条 reachability error | 无必须 schema；可选 `code:"unreachable"` |
| B-03 | 是 | E1+E3 | `game-design.ts:176-188`；`game-config.ts:240`（terrain 为 Rect）；`prompt.ts:985-989` | 42 对 design+recipe：38 对 layout 提地形，其中 1 对无地形资产（启发式，非精确判据） | 是：设计层结构化地形需求 |
| B-04 | 是 | E1+E2+E3 | `game-design.ts:182`（layout 为 `z.string()`）；`prompt.ts:869-870`；`compile-runtime.test.ts:370` 原样插入 | 49 设计/77 关全为 prose；严格结构化 77/77 不过 | 是：结构化 layout 表示 |
| B-05 | 是 | E1+E3 | `game-config.ts:51`（无 slope）、`:240`（Rect）；`reachability.ts:61`；`demo/src/world.ts:171` | 3/49 设计 layout 提斜坡；config 无 slope 槽位可落 | 是：slope kind / terrain shape 联合（**改 Runtime**） |
| B-06 | 是（既有冻结限制） | E1+E2+E3 | `game-design.ts:171`（type 开放）；`game-config.ts:599-608,696-710`；`config-audit.ts:41` | 已知样本 1 config（`gate` goal ← `sourceIntent:"chest"`；只读重判 `auditEntityIdentity` 返回 `[]`）；49 设计/76 条/**28** distinct type | 是：封闭子类型或独立 goal 桶；不改契约则保留限制 |
| B-07 | 是（既有冻结限制） | E1+E2+E3 | `game-config.ts:56-70,400-418,615-627`；`demo/src/shell/scene.ts:196`（decor 无行为） | decor 引用：sprite 168 / animation 117 / ui 39；锁 `sprite|animation` ⇒ 39 个 config 副本（1 件 `health-icon`）误伤；排除 background ⇒ 0 | 无必须 schema；只改表项，或随 B-01 语义类别 |

**E2（本报告复跑）**：`pnpm exec vitest run packages/contracts/tests/game-config.test.ts packages/contracts/tests/reachability.test.ts packages/contracts/tests/game-design-gate.test.ts packages/qa/tests/gameplay.test.ts packages/assets/tests/plan-coverage-gate.test.ts packages/pipeline/tests/create-game.test.ts` → **6 files / 194 tests passed，exit 0**。

**E3（只读语料）**：`out/**`、`fixtures/**`、`.scratch/**` 共 5243 JSON；`game-config/v1` 151、manifest 171、design 49、recipe 83；config↔manifest 配对 134。P1 的 `entity-state-frames = 75` 逐字复现。新增 error：B-02 0；B-03 启发式 1/42；B-06 已知 1；B-07 锁 `sprite|animation` 39 个副本 / 排除 background 0。

**既有裁定逐字约束**：P0 04 将 Q2/Q7/Q10(a)(b)(c)/Q10 补充均裁为 **B → Out of scope**；
`entity-identity-v1.1` 票 02 明写「`gate(goal)→chest` 这类同桶误归属**不在本票射程内**」并采 C 路线
「只收可严格证明的跨桶规则，不用桶矩阵制造误拒来假装解决同桶误归属」；`recipe-config-gap-v1` 票 03
裁 (c)（正向产地形 sprite + 缺时退 invisible terrain），map 明写「设计层结构化 HUD/地形需求……
不在本图；prose layout 的自由度保留」；P1 map 明写 `decor` 不加锁、B 类仍冻结/另立 effort。
