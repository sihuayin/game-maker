# 实施 Phase 1：编译期 kind 兼容性校验

Type: task
Status: resolved

## Question

把票 02 裁定的兼容矩阵落进编译期 `auditEntityIdentity`，让「`sourceIntent` 存在但 kind 不兼容」的映射在编译期被确定性拒绝（早于资源生成）。

范围（PRD §5.1 + 票 02 答案）：
- **单一来源矩阵**：把 `DESIGN_BUCKET_KINDS` 从 `qa/src/visual.ts` 移到 `contracts`（供 `auditEntityIdentity` 与 QA 共用）；值按票 02 的 **C 路线** —— `interactables` **保持原样**（除 `decor` 外全部），只收跨桶规则。
- `auditEntityIdentity`（`game-config.ts`）新增第 ③ 步：对每个带 `sourceIntent` 的 config 实体，查其 `kind` 是否 ∈ 其设计桶允许集；不在 → `error`（指出运行时实体 id、`sourceIntent`、设计桶、运行时 kind、拒绝原因）。
- 保留现有 ① 覆盖、② 悬空。
- 错误定位与票 03 的作用域错误**分开**：兼容性错误只报 kind 不兼容，不掺作用域。

验收（PRD §6.1 + 票 02 C 路线回归测试）：
- 跨桶拒绝（可严格证明）：enemy → pickup、resource → hazard。
- 桶内放行：interactable → chest/pickup/goal/hazard/danger/solid 六种全通过。
- 同桶不误拒（记录限制）：interactable → goal（gate→chest）仍放行。
- 运行时实体指向不存在设计 ID（悬空）→ 仍拒绝。
- 两个兼容敌人同源 1:N → 通过。
- 合法结构性实体无 `sourceIntent` → 通过。
- 下游（资源生成）在身份错误时不启动（编译期跨桶错误早于资源生成）。

纪律：TDD；改仓库代码但不动 `fixtures/`、`game-maker.local.json`；不提交 / 推送。

## Answer

实施完成（2026-10-25）。**范围在施工中修订**：票 02 初裁「摘除 `interactables` 的 `goal`/`solid`」
在首跑全仓时误拒了真实夹具 `last-train` 的 `i-signal`(信号灯)→goal（16 处），按用户裁定改走 **C 路线**。

落地：
- 矩阵 `DESIGN_BUCKET_KINDS` 移到 `contracts`（`game-config.ts`）单一来源，`interactables` 保持原样（除 `decor` 外全部）；QA `visual.ts` 删本地副本、改 import + `bucketOf` 类型。
- `auditEntityIdentity` 新增第 ③ 步：编译期**跨桶**兼容检查，悬空的不重复报。
- 已知限制：同桶（`interactables` 内 `goal`↔`chest`）不在此射程，记录于 `DESIGN_BUCKET_KINDS` 注释与票 02 答案。

验证：`pnpm typecheck` 全绿；`pnpm test` **130 文件 / 1947 测试全绿**（+6 条兼容测试，原 V1 回归全过）。无 `fixtures/` 改动、无提交 / 推送。
