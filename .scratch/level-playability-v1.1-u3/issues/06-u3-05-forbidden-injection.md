# U3-05 forbiddenInjection

Type: task
Status: resolved
Owner: claude (U3-05 session 2026-11-12)
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

**完成。** `forbiddenInjection` 落地；门区半部四段齐备，未做图割。

| 项 | 结果 |
| --- | --- |
| 注入 | 原始 `gateRect` 原样交给 `buildGraph([gateRect])`；扩张只由 `graph.ts` 一次完成，不预扩张、不重复扩张 |
| 记录 | `{ gateRect, expandedRect, source: "forbiddenBoxes" }` |
| `expandedRect` | `{ x: gate.x − playerW/2, y: gate.y, w: gate.w + playerW, h: gate.h + playerH }` |
| 同源校验 | 基线图 vs 传入 `graph` 全等（含 `blocked` / `solids` / `player` / `coverage`）；玩家几何一致 |
| 注入校验 | 注入图静态底座与基线全等（`blocked` 不变）；`forbidden` 恰为展开公式结果；`standable` 按「自由且下邻 `blocked`」重算 |
| 语义 | 不可穿越、不提供支撑、门顶不是地板（`standable` 只看 `blocked`） |
| 反例 | 预扩张 / 重复扩张、图不同源、玩家几何不同源、建图入口不同源 ⇒ `geometry-untrusted` |
| 图割 | 未调用 `assessReachability`、无 `graphCut` 字段 |

**输入契约扩展（需 R3 关注）**：`PermanentGateInput` 新增 `buildGraph(forbiddenBoxes) => MovementGraph | null`。原因是 U3-05 要求以原始 `gateRect` 调用 `buildMovementGraph`，而 U3-01 的输入不含 `GameConfig` / `AssetPackManifest`，地图又禁止本模块解析 `GameConfig`；该回调由调用方闭包持有 config/manifest/profile，本模块不新增模块依赖。同源性由 `buildGraph([])` 重跑基线图逐项校验。

| 项 | 结果 |
| --- | --- |
| `pnpm build` / `pnpm typecheck` | 退出码 **0** / **0** |
| 定向 gate 测试 | 退出码 **0**；**40 / 40 passed** |
| `playability-temporal-input.test.ts` | 退出码 **0**；**65 / 65 passed** |
| 白名单外改动 | **无**；STOP **未触发** |

证据：[`../evidence/05-forbidden-injection.md`](../evidence/05-forbidden-injection.md)。

**下游**：U3-06（测试矩阵与 D4 反例）已 **unblocked**。本票未启动 U3-06。
