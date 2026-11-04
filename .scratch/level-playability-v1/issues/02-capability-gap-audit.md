# 现有可玩性能力与缺口源码审计

Type: research
Status: resolved
Owner: research subagent · 2026-11-04
Blocked by: —
Map: ../map.md

## Question

在代码基线 `main` @ `fa17c14` 上，只读审计当前**与关卡可玩性相关**的能力与缺口，为后续候选判据提供事实底座。不得修改生产代码。

### 必须交付

1. **调用链**：`create → compile-runtime → auditConfigPipeline / QA → site → playtest / delivery` 中，哪些检查在何时跑、吃什么输入、产出什么、失败如何分档。
2. **现有判据清单**：逐个列出 `auditReachability`、`auditGameConfig`（尤其台阶高/行程越界警告）、`auditLayerCoverage`、`auditScreenSpace`、`auditReferences`、`auditEntityIdentity`、机制覆盖、QA 玩法族、Playtest 归因；每条给 `file:line`、输入、输出、severity、已知误报/漏报边界。
3. **Runtime 实际消费语义**：`packages/demo/src` 中玩家的移动/跳跃/落地、碰撞、`motion`、`hazard`、`danger`、`chest`、`goal` 的真实行为；哪些是判据可依赖的「实际可走」语义，哪些是观测不到的。
4. **缺口清单**：现有判据抓不到、但规格可能精确判定的问题；逐条标注「可写 / 需新语义 / 不可写」。
5. **重复与分档**：候选判据与既有警告/error 的重叠；若新增判据，是否会重复报告或改变失败阶段。
6. **P1 影响**：B-02 / publish-gate / D-01 / D-03 对可玩性检查的影响（已有事实，不重开裁定）。

### 证据

- E1：`file:line`；E2：既有测试名 + 断言；E3：零付费复跑或语料重判（命令、退出码、路径、计数）。
- 仅历史推断必须显式标注。

### 输出

- `../research/02-capability-gap-audit.md`。
- 本票 `## Answer` 摘要；更新 map 的 Decisions so far。

### 边界

- 只读；不修改任何生产文件或历史语料。
- 不裁定哪些判据该实施；那是 03–05 与 10 的事。
- 不重开 B-02 / D-01 / D-03 等已收口裁定。

## Answer

**2026-11-04 完成（research subagent；父级复核后收口）。只读；未改生产代码 / 测试 / fixture / 历史语料；未 commit / 推送；零付费。**

### 结论

- 现有可玩性判据只有 `auditReachability`（只报「够不到」）加 `auditGameConfig` 的台阶高 / 行程越界 **warning**；其余是引用、身份、HUD、背景、机制存在性。
- 它能证明「从出生点到不了某个 pickup / gate」，不能证明「关卡可完成」；空数组 ≠ 可玩。
- 最大漏报：chest 不是 target；只从出生点出发、不检查收集后能否返回 gate；出生点埋 terrain 不报；moving solid 当整段行程；hazard / danger 当空气。
- 最大误报：低天花板 / 走路走廊（BFS 只建跳跃弧、不建走路边）；已用 gap probe 复现。
- 三态 `PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` 全仓不存在；严格三态需要新结果形状（Q5 审批点）。
- QA 实际 7 条判据（不是多处注释写的 6 条）；`QA_JUDGEMENTS.length` 决定 gate。
- 历史语料不能直接重判：171 份 manifest 中 81 份不是 v4；152 份 config 中 21 份唯一、96 份配对（20 份唯一）；reachability 新增 error 0；0 moving solid、0 非 hazard motion、0 pickup/hazard/goal `body` 覆盖；53 个 chest 实例 / 5 份唯一 config。
- 发布闸只重跑 `auditReachability`；新判据若不在该函数内，standalone `site` / `assemble_site` 不会执行。

### 证据

- 报告：[02-capability-gap-audit.md](../research/02-capability-gap-audit.md)（§0 速览、§1 调用链、§2 判据清单、§3 Runtime 语义、§4 缺口、§5 分档、§7 E1/E2/E3、§8 父级事实）。
- 只读分析脚本：[02-corpus-scan.mjs](../research/02-corpus-scan.mjs)（exit 0；152 config / 21 unique / 96 paired / 81 旧 manifest）、[02-gap-probes.mjs](../research/02-gap-probes.mjs)（exit 0；probe A–F）。
- 父级复核：重跑 gap probes exit 0；重跑 corpus scan exit 0，`uniqueConfigs=21`、`paired=96`；`QA_JUDGEMENTS` 7 项；`publish-gate.ts:140` 只调 `auditReachability`；`reachability.ts` 的边为跳跃弧、targets 无 chest。
- 修正一处笔误：报告 §8 原写「20 份唯一内容」，已按扫描结果改为「21 份唯一内容，96 份能配对（20 份唯一）」。

### 对下游票的影响

- 03 / 04 / 05 已补入本次审计的具体缺口（chest、单向路径、低天花板误报、moving solid、时序、`body`）。
- 06 / 08 必须定义旧 manifest 的归一化 / 迁移 / 排除口径；不能把 parser 失败当成不可玩。
- 01 必须裁定三态是否值得新增结果形状；09 必须裁定新判据是并进 `auditReachability` 还是另起函数。
- 未创建新票：现有 03–09 已覆盖这些缺口。
