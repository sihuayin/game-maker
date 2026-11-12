# U3-05 证据 — forbiddenInjection

| 项 | 值 |
| --- | --- |
| 票 | [U3-05 forbiddenInjection](../issues/06-u3-05-forbidden-injection.md) |
| 执行会话 | claude（U3-05 session 2026-11-12） |
| 基线 | `U3-04` @ `93ec3aa` |
| 改动（白名单内） | `packages/contracts/src/playability/temporal-gate.ts`、`packages/contracts/tests/playability-temporal-gate.test.ts` |
| 白名单外改动 | **无** |

## 1. 输入契约扩展（需 R3 关注）

`PermanentGateInput` 新增一个字段：

```ts
readonly buildGraph: (forbiddenBoxes: readonly Aabb[]) => MovementGraph | null;
```

理由与边界：

- U3-05 要求「把原始 `gateRect` 原样传给 `buildMovementGraph({ forbiddenBoxes })`」，但 U3-01 冻结的输入**不含** `GameConfig` / `AssetPackManifest`，且地图禁止本模块解析 `GameConfig`；
- 回调由调用方闭包持有 `config` / `manifest` / `profile`，本模块只传禁区盒，**不 import** `game-config.ts` / `assetpack.ts`，不新增模块依赖；
- 实现必须是 `buildMovementGraph(config, manifest, profile, { forbiddenBoxes })` 且与 `graph` 手柄同源；本模块用 `buildGraph([])` 重跑基线图并逐项校验同源，不一致即 `geometry-untrusted`。

## 2. 注入与记录

| 项 | 内容 |
| --- | --- |
| 注入对象 | 原始 `gateRect = { x: L, y: gate.y, w: gate.width, h: gate.height }`，不预扩张、不重复扩张 |
| 扩张 | 只由 `graph.ts` 完成一次；本模块只**校验**结果 |
| `expandedRect` | `{ x: gate.x − playerW/2, y: gate.y, w: gate.w + playerW, h: gate.h + playerH }`（脚点在盒底边中点） |
| 记录 | `{ gateRect, expandedRect, source: "forbiddenBoxes" }` |
| 同源校验 | 基线图 vs 传入 `graph`：`width/height/stride/coverage/blocked/solids/player/forbidden/standable` 全等；`player.size` 与 `playerSize` 一致 |
| 注入校验 | 注入图与基线的静态底座全等（含 `blocked` 不变）；`forbidden` 恰为基线掩码 ∪ `graph.ts` 公式展开的 `gateRect` 脚点格；`standable` 恰为「自由且下邻 `blocked`」重算结果 |
| 语义验证 | 不可穿越（`freeAt = false`）、不提供支撑（`standable` 只减不增）、门顶不是地板（`standable` 只看 `blocked`） |
| 不做的 | 不做图割、不调用 `assessReachability`、不产出 `graphCut`（源码断言） |

## 3. 命令与结果

| # | 命令 | 原始输出 | 退出码 | 结果 |
| --- | --- | ---: | ---: | --- |
| C1 | `pnpm typecheck` | `05-typecheck.log` | **0** | 全 workspace Done |
| C2 | `pnpm build` | `05-build.log` | **0** | `tsc -b` + bundle 全部 Done |
| C3 | `pnpm exec vitest run …playability-temporal-gate.test.ts` | `05-gate.log` | **0** | **40 / 40 passed** |
| C4 | `pnpm exec vitest run …playability-temporal-input.test.ts` | `05-temporal-input.log` | **0** | **65 / 65 passed**（架构断言保持 ✓） |

## 4. 新增定向覆盖（U3-05 段）

1. 原始 `gateRect` 原样注入、`source` 记录；
2. `expandedRect` 只扩张一次（`x−1`、`w+2`、`h+20`、`y` 不变）；
3. 建图入口先收到 `[]`、再收到原始 `gateRect`；
4. 禁区不可穿越（`(55,39)` 基线 `freeAt=true`，注入后 `false`）；
5. 注入不改 `blocked`（逐元素相等）；
6. `standable` 只减不增，门顶格不是可站立面（含悬空门场景）；
7. 预扩张 / 重复扩张 ⇒ `INCOMPLETE` + `geometry-untrusted`；
8. 图不同源（不同世界）、玩家几何不同源、建图入口不同源 ⇒ `geometry-untrusted`；
9. 模块无 `assessReachability(` 调用、无 `graphCut:` 字段。

## 5. 边界声明

- U3 门区半部至此四段齐备；仍未组装完整 `PermanentGateProof`，未产出 `graphCut` / hop / 模型闭合字段。
- 未修改 `temporal.ts` / `graph.ts` / `reach.ts` / fixture；未新增依赖或公共导出。
- 全量 `pnpm test` 留给 U3-07；未推送、未创建 PR、未合并。
