# 01. 阶段A 只读审计：现有报告 / 状态 / 产物关联

Type: research
Status: resolved
Owner: research subagent · 2026-10-27
Map: ../map.md

## Question

在改代码之前，只读审计现有验收/报告/状态/产物之间的实际关系，产出五件交付物（`docs/v7.3/报告.md` §7 阶段A）：

1. **现有能力清单**：qa-report.json 生成与 schema、QA 判据/观察、headless smoke、inspectPack/reviewPack、CLI/MCP 面。
2. **当前报告结构**：qa-report.json 顶层键、qaVerdict 纯函数、失败时是否仍落盘。
3. **产物版本关联图**：run/v<N> · pack/v<N> · site/v<N> · game-config · subject 绑定 · 校验和。
4. **缺失字段与状态语义清单**：BLOCKED/NOT_REQUIRED 是否存在、smoke 是否有步骤数/已知限制字段、视觉评审 verdict 是否有存储。
5. **最小改动建议**：在哪一处装配跨阶段聚合最自然。

约束：不付费生图、不改正式产物、不改版本目录/失败账本、不新增依赖、不改契约/CLI/MCP 公开接口。

## Answer

结论：`../research/audit.md`。五件交付物速答（全文见 research 文件）：

1. **能力清单**：qa-report.json 在 `create-game.ts runBuild()` QA 步生成（schema `contracts/src/qa.ts`，`qa-report/v1`）；
   `qaVerdict()` 是纯函数 `pass|fail|incomplete`；smoke 产 `result.json`（`ok/stage/reason/expected` + 截图 + console/exceptions）；
   `inspectPack`(CLI+MCP) / `reviewPack`(仅 CLI，付费诊断「只说差异、不判定不阻断」)。
2. **报告结构**：`format` + `subject?`(packId/packVersion/manifestChecksum) + `checked`(6 判据) + `failures` + `observations`；
   **无 status 字段**，verdict 纯函数；**QA 硬失败也先落盘再抛**（`create-game.ts:633-635`），但 QA 禁用/runner 抛/更早失败时不生成。
3. **版本关联**：run=`<gameId>/run/v<N>`、pack=`<id>/pack/v<N>`、site=`<gameId>/site/v<N>`、`site.json={shell,pack,config}`；
   `subject` 已绑 pack 身份；checksum=`sha256:` 逐文件。
4. **缺失**：`BLOCKED`/`NOT_REQUIRED` **不存在**（只有 `pass|fail|incomplete` + `pending|pass|fail` + `green|yellow|red` 等）；
   smoke **无**步骤数/最后成功步骤/失败步骤/已知限制字段（只有 `stage`+`reason`）；**无**跨阶段持久化聚合；
   P0-06 风格对照 verdict **无存储**（唯一 HumanVerdict 是 animation-acceptance 的冻结占位、无代码写真实 verdict）。
5. **最小改动建议**：扩展 `qa-report.json` 加「交付验收」段；自然装配缝 = `assertPublishableQa`（publish-gate，两 shell 都在 site 前调用）；
   版本绑定复用 `subject` + run/pack/site 版本号；新聚合作为新字段/新 artifact，不改现有 `CommandResult.data` 键。
