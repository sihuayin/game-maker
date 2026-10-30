# 覆盖门禁实施：config + probe + 可审计报告

Type: task
Status: resolved
Blocked by: 01, 02

## Question

按票 02 的裁定实施，不再让门禁默认全过。最低不变量：

1. **先红**：新增失败测试，证明当前缺陷至少两条 ——
   - 设计声明 `avoid-danger` 但 config 无 `danger`/`hazard` 实体时，覆盖仍判 `satisfied`；
   - 不传 probe 结果时，`collect-pickup / open-chest / avoid-danger` 仍被默认 `passed`；
   - `verify-delivery` 面对 `probe.executed=false` 或 `verdict=failed` 的 `mechanic-coverage` 记录仍判通过。
2. **实施**：按裁定接入 config 层与 probe 结果；缺 probe 时 `not-tested`，不得默认 `satisfied`；门禁阻断规则按裁定调整。
3. **落盘与核验**：按票 02 写 `run/vN/mechanic-coverage.json`（`mechanic-coverage/v2`：subject + config 层 + probe 块）与 `run/vN/mechanic-probe/summary.json`；实现 `verify-mechanics`（身份不符 exit 4、probe 失败 exit 1 仍写报告、全绿 exit 0；声明的受 probe 机制缺结果 ⇒ `qa=failed`）；实现 `verify-delivery` 对 `role=mechanic-coverage` 的内容核验（format v2 / `probe.executed=true` / `verdict=satisfied` / subject pack+config 与清单一致）。不静默新增未纳管产物。
4. **测试**：补单元测试 + pipeline 集成测试（断言生产调用真的传入 probe/报告）+ 必要的 CLI 测试；不删除既有五态/枚举测试。
5. **真实证据（若裁定走独立命令/probe）**：在阶段 A 可写副本上运行 probe/`verify-mechanics`，记录命令、退出码、报告路径、身份；零付费。
6. **回归**：目标测试 + `pnpm typecheck`；不修改历史产物。

产物：代码 + 测试 + `research/08-coverage-gate-evidence.md`（红/绿/真实证据/身份/历史零改动）。未获票 02 裁定前不开工。

## Answer

**2026-10-30 实施收口。** 证据：[research/08-coverage-gate-evidence.md](../research/08-coverage-gate-evidence.md)。

### 实现

- `mechanic-coverage/v2`：`subject` + 四层 `mechanics[{design,runtime,config,qa}]` + `probe{executed,ranAt?,summaryPath?,results}` + `verdict`；config 层按票 02 的全套映射检查实际 config。
- `buildMechanicCoverage(design, config, probeResults?)`：缺 probe ⇒ `executed=false` / 全部 `qa=not-tested`，绝不默认 passed；传 probe 时缺声明机制的结结果 ⇒ `qa=failed`；门禁阻断 design/runtime 非 satisfied、config missing、qa failed。
- `create`/`build`：`runBuild` 返回覆盖核心；CLI 在站点装配成功后写 `run/vN/mechanic-coverage.json`（`probe.executed=false`），重跑 build 重置 probe。
- 新 `verify-mechanics <runDir>`：重算并校验身份（不符 exit 4、不写报告），跑本地 Chrome probe，复制摘要，写 v2 报告；probe 失败/缺结果/verdict failed ⇒ exit 1 照写失败报告；全绿 exit 0。
- `verify-delivery`：清单出现 `role=mechanic-coverage` 时核验 v2 / `probe.executed=true` / `verdict=satisfied` / subject 六字段与清单一致；历史清单无该记录时保持向后兼容。
- `free-acceptance.mjs` 更新 v2 调用与四层检查。

### 证据

- 定向测试 4 文件 / **90 tests** 全绿；全量 `pnpm test` **150 文件 / 2248 tests** 全绿；`pnpm typecheck` exit 0；历史证据验收 exit 0（223 文件 / 13 records / 诊断 0）。
- E3：`verify-mechanics` 在阶段 A 可写副本上 **exit 0 / 14s**；报告 `verdict=satisfied`，probe 3/3 通过（collect-pickup / open-chest / avoid-danger）；冻结身份六字段一致；`qa-report.json` sha256 前后不变（`dc20e301…5ee6`）。
- 旧 work 95/95、冻结快照 66/66、副本原 95 文件哈希未变；只新增报告与 probe 摘要；零付费、未提交。

### 已知限制

1. 未在冻结副本上重跑 `create`/`build`（会触碰生成链/付费上游）；create 写盘路径由代码 + pipeline 集成测试覆盖，E3 只覆盖 `verify-mechanics`。
2. `verify-delivery` 内容核验仅在清单声明 `mechanic-coverage` record 时生效；阶段 A 正式清单由票 13 写入 required record。
3. probe 使用 last-train 夹具与合成 config（票 02 Q7），冻结 Demo 的 hazard 专项由票 09 补。
