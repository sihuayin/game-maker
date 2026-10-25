# 03. 编译期确定性验真：身份 coverage + 悬空，硬失败进重采样

Type: task
Status: resolved
Owner: claude (2026-10-25 · resolved)
Blocked by: 01, 02
Map: ../map.md

## Question

在 `compileRuntime` 加一道**确定性身份验真**（Q2=(c) 的后半：校验守契约），仿 `auditGameConfig`
modelHard 的模式（`packages/assets/src/ops.ts` 重采样循环内，`auditGameConfig` / `auditScreenSpace`
那一族）。规则（硬失败 = 模型错，进重采样循环，模型下一发能写对）：

- **coverage**：每个设计实体（四桶，**player 除外**——票 07 已裁，player 是 config 顶层字段不进对账）
  → **至少一个** config 实体 `sourceIntent` 指向它。缺失 = 「设计画了、配置没做」。
- **悬空**：每个 config `sourceIntent`（非空）→ 必须指向设计里**真实存在**的实体 id。指向不存在的 id = 模型错。
- **孤儿合法**：无 `sourceIntent` 的 config 实体（`block`/`gate`）**不报**。
- **归属**：进**重采样循环**（模型能改对），不是 `auditLayerCoverage` 那种「重抽改不了」的确定性失败。
  `STRUCTURED_CALL_ATTEMPTS` 次后仍不过 → 最终 `CommandError`，措辞点出「缺哪几个设计实体 / 哪几个
  sourceIntent 悬空」（见 map Not yet specified 的报错口径）。

执行：落码验真函数（住 `assets` 还是 `contracts`，随 `auditGameConfig` 同处；QA 票 04 与它**不重复**——
本票是编译期 gate，票 04 是 QA 判据）+ 单元测试（coverage 缺 / 悬空 / 孤儿合法 / 1:N 共享）。

## Answer

已落码（2026-10-25）：

- **`packages/contracts/src/game-config.ts` `auditEntityIdentity(design, config)`**：返回 `ConfigIssue[]`，
  与 `auditGameConfig` 同款。规则两条（都是**模型错**，下一发能写对）：
  ① coverage —— 每个设计实体（四桶，**player 除外**）至少一个 config entity `sourceIntent` 指向它；
  ② 悬空 —— 每个 config `sourceIntent` 必须指向四桶里真实存在的 id。孤儿（无 `sourceIntent`）合法。
- **接线**（`packages/assets/src/ops.ts`）：`compileRuntime` 的重采样循环 `modelHard` 与循环后 `issues`
  都加 `...auditEntityIdentity(design, …)`，与 `auditGameConfig` 同档。重采样耗尽后的 `CommandError`
  沿用既有 `modelHard` 格式（`· entity "X": 设计实体 "X" 在配置里没有对应实体`），**报错口径就此定案**
  （map Not-yet-specified 那条「重采样退化怎么报」随之毕业）。
- **测试**：`game-config.test.ts` +5（coverage 缺 / 1:N 共享 / 悬空 / 孤儿+player / player.id 悬空）；
  `compile-runtime.test.ts` +1（config 缺 sourceIntent → 模型错、重采样、不落盘）。
- **夹具连带**：`compile-runtime.test.ts` 给 `GOOD`（真配置）补 `sourceIntent`（suitcase→r-lost ·
  carriage→e-dog · signal→i-signal · luggage 孤儿）；`fixtures/upstream/canned.json` 的 `e-drone` 实体补
  `sourceIntent: "e-drone"`（pipeline/mcp/cli 三包共用）；一条逐字节断言改为 `JSON.parse(...).toEqual`
  （契约把 `sourceIntent` 排在 `id` 后，键序不同不再误报）。
- **验证**：全仓 **1936/1936** · `pnpm typecheck` 10 包绿 · `pnpm build` 绿（`@game-maker/contracts` 的
  dist 需重建，其他包才看得见新导出 `auditEntityIdentity`）。
