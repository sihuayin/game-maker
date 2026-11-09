# I01-05 三处生产调用方接线与回归影响

Type: research
Status: open
Owner: —
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
6. **可行性结论**：三处是否都能在 I-00 白名单内完成接线。

### 产出

`../evidence/05-call-site-wiring.md`。**不修改任何生产文件。**

### 收口条件

- 三处都有可执行接法；
- 没有新增公共面；
- 若发现必须越界，明确写出停止结论。
