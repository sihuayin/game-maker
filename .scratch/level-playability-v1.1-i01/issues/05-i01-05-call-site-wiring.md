# I01-05 三处生产调用方接线与回归影响

Type: research
Status: resolved
Owner: amber
Blocked by: 02, 04
Map: ../map.md
Class: I-01 / EVIDENCE

## Question

对每一处生产调用点，写出精确接线方案、读取次数、IE 下的行为，以及回归影响。

### 必须交付

1. **逐调用点**：
   - `packages/assets/src/ops.ts:1247,1284`（`compileRuntime` 的重采样循环与确定性校验）；
   - `packages/pipeline/src/create-game.ts:631`（汇合点）；
   - `packages/pipeline/src/publish-gate.ts:140`（`configProblem`）。
   每处写：`packDir` 从哪来、读取时机、是否需要穿透新参数、temporal 结果交给谁。
2. **读取次数**：`compileRuntime` 的重采样循环里每发 config 都会调用 `auditConfigPipeline`；必须给出一份「Atlas 只读一次 / 按需读」的方案与理由。
3. **IE 下的行为**：Q8=B 下 IE 不产 `ConfigIssue`。写出三处调用方在时序 IE 时具体发生什么（继续 / 不阻断），并证明这与今天的行为一致。
4. **公共面检查**：接线是否必须新增返回字段、参数或类型。若是 ⇒ 标记 `STOP`，不要顺手加。
5. **回归影响**：列出受影响的既有测试与语料（`playability-*`、`config-audit.test.ts`、`publish-gate.test.ts`、LP-06 / LP-07 scratch 语料），并给出每项的预期不变性。
6. **范围收集**：从 `GameConfig` 推导 `assetIds`（player + 引用的 hazard / pickup / goal）的纯函数放在哪、三处如何共享同一份实现，避免各写一遍。
7. **可行性结论**：三处是否都能在 I-00 白名单内完成接线。

### 产出

`../evidence/05-call-site-wiring.md`。**不修改任何生产文件。**

### 收口条件

- 三处都有可执行接法；
- 没有新增公共面；
- 若发现必须越界，明确写出停止结论。

## Answer

接线方案与回归影响：[`evidence/05-call-site-wiring.md`](../evidence/05-call-site-wiring.md)。

- **三处均可接线，越界清单为空**：`assets/ops.ts` 在重采样循环**之后**（`:1284` 的确定性硬校验通过后）调一次；`create-game.ts` 汇合点（`:631` 校验、`:638` 抛出之后）调一次；`publish-gate.ts` 把已有 `opts.packDir` 穿进私有 `configProblem`，在 config 解析成功且可玩性未阻断时调一次。
- **`runTemporalAudit` 必须同步**：`assertPublishableQa` 是同步 API，改成 `async` 会破坏公共签名。读取器用 `fs.readFileSync` + `createHash`。
- **读取计划 = 适用才读、每次编排读一次**：先由 contracts 纯函数 `temporalScope(config)` 判适用性；无移动 Hazard ⇒ 零读盘。适用时按 scope 去重读取 atlas JSON（`last-train` 为 `animations` + `sprites` 两个文件），同一份 bytes 做 SHA 与解析。**不在 `:1247` 的重采样循环里接**：结果被丢弃、无法影响重试，逐发读取只会重复 I/O；编译路径因此在 `compileRuntime` 与汇合点各读一次，`reuseConfig` 路径只读一次。
- **IE 行为**：三处都丢弃结果，不产 `ConfigIssue`、不改 Verdict、不阻断、不抛。今天的移动 Hazard 已是 IE（`mechanic.ts:119` ⇒ `verdict.ts:113`），而 `playabilityIssues` 只映射 PU（`api.ts:114`）⇒ 既有行为不变。读取失败 / 意外异常一律降级为 IE，保证 I-01 不改变退出码。
- **公共面**：三处接线不新增参数或返回字段；`PublishGateOptions` / `CompileRuntimeOptions` / `BuildInput` 不变。新增符号只在 I01-01 已批准的新导出集合内；`readTrustedAtlasInput` 保持模块私有，`temporalScope` 经 `api.ts` 以 `@internal` 导出，交 I01-07 审计（若被判定超范围，退化为「总是读盘、不做适用性短路」，接线不变）。
- **回归**：既有测试零改动；`publish-gate.test.ts:193` 的 `GOOD_CONFIG` 自带移动 Hazard，既有用例会自动覆盖新接线；LP-06/07 scratch 语料复跑基线 96 配对 `36/36/24`、矩阵 `19/9/11`、零新增误报。
- 对 I01-01「两处调用点接入」的收敛（只保留 `:1284`）必须由 [I01-07](07-i01-07-whitelist-audit.md) 逐项记录为计划偏离。
- 本票只收口接线证据；不构成 I-01 实施授权。
