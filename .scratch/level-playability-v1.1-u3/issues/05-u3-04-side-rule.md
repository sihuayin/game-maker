# U3-04 判侧规则

Type: task
Status: open
Owner: —
Blocked by: 04
Map: ../map.md
Class: U3 / IMPLEMENTATION

## Task

实现 D4 §2 冻结的**判侧规则**。只填 `sideRule`。

### 允许文件

- `packages/contracts/src/playability/temporal-gate.ts`
- `packages/contracts/tests/playability-temporal-gate.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`）

### 必须完成

1. 精确 spawn 盒：使用 D3 的整数脚点格派生盒，**不**外扩；**不得**用 `startCells()` 的宽松多起点代替。
2. `goalRegion = inflate(goalRect, 0.5)`：四边各外扩 `0.5px`；**不得**直接使用取整后的 Goal Rect。
3. 判侧：
   ```text
   左→右：spawnBox.x + spawnBox.w ≤ L ∧ goalRegion.x ≥ R
   右→左：spawnBox.x ≥ R           ∧ goalRegion.x + goalRegion.w ≤ L
   ```
4. 起点与目标同侧、目标跨门、起点不在严格一侧、无法判侧 ⇒ `gateStatus: "INCOMPLETE"` + `no-permanent-gate`；不得输出可升级的门区结论。
5. 记录 `sideRule: { direction, spawnBox, goalRegion }`，类型可无损耗嵌入 `PermanentGateProof.sideRule`。
6. 方向语义与 NB 的到达谓词相反：NB 内缩 `0.5px`，PU 目标区域外扩 `0.5px`；不得混用或复用 witness 的到达判断。
7. 定向测试：左→右 / 右→左各一正向；同侧、跨门、边界相切、未外扩 goalRect 的反例。

### 禁止

- 用取整 Goal Rect 判侧；
- 用 `startCells()` 或任何宽松起点；
- 计算图割 / hop / 完整证书；
- 修改 `temporal.ts` / `graph.ts` / `reach.ts`。

### 验收

`pnpm build` / `pnpm typecheck` exit 0；新增定向测试通过；两方向与全部 IE 情形均有断言；diff 仅白名单文件。

## Answer

（resolved 时填写）
