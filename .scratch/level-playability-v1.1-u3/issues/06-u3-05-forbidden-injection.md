# U3-05 forbiddenInjection

Type: task
Status: open
Owner: —
Blocked by: 05
Map: ../map.md
Class: U3 / IMPLEMENTATION

## Task

实现 D4 §3 的 `forbiddenBoxes` 注入与记录。只填 `forbiddenInjection`；**不做图割**。

### 允许文件

- `packages/contracts/src/playability/temporal-gate.ts`
- `packages/contracts/tests/playability-temporal-gate.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`）
- 只读 import `graph.ts`（`buildMovementGraph` / 既有图类型），不得修改

### 必须完成

1. 把**原始 `gateRect`** 原样传给 `buildMovementGraph({ forbiddenBoxes: [gateRect] })`；扩张只由 `graph.ts` 完成一次；**不预外扩、不重复扩张、不写入 `blocked`**。
2. 从构建结果记录 `expandedRect`，并输出：
   ```ts
   forbiddenInjection: { gateRect, expandedRect, source: "forbiddenBoxes" }
   ```
   类型可无损耗嵌入 `PermanentGateProof.forbiddenInjection`。
3. 验证并记录 `forbiddenBoxes` 语义（只读消费既有实现）：
   - 不可穿越；
   - 不提供支撑；
   - 门顶不是地板（`standable` 只看 `blocked`）。
4. 图与空间层必须使用**同一份**静态 solids、玩家几何与 profile；若输入不一致或无法确认 ⇒ `INCOMPLETE` + `geometry-untrusted`。
5. 本票**不**执行图割、不调用 `assessReachability`、不产生 `graphCut` 字段。
6. 定向测试：原始矩形注入、`expandedRect` 只扩张一次、门顶不可站立、不可穿越；预扩张 / 重复扩张反例必须被拒绝或不得产生 `COMPLETE`。

### 禁止

- 修改或参数化 `graph.ts` / `reach.ts`；
- 把整段扫掠区注入 `forbiddenBoxes`；
- 手工预扩张后再交给 graph；
- 计算图割 / hop / 完整证书。

### 验收

`pnpm build` / `pnpm typecheck` exit 0；新增定向测试通过；`expandedRect` 与 graph 既有扩张一致；diff 仅白名单文件（`graph.ts` 零 diff）。

## Answer

（resolved 时填写）
