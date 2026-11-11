# I02-D6 文件白名单增量与模块布局裁定

Type: grilling
Status: open
Owner: —
Blocked by: 09, 10, 11
Map: ../map.md
Class: I-02 / DECISION

## Question

冻结 I-02 的生产文件白名单增量与模块布局，使授权包能明确「允许改什么、禁止改什么、什么需要额外审批」。

### 必须裁定

1. **模块布局**：算法是全部塞进现有 `temporal.ts`，还是新增内部模块（例如 `temporal-motion.ts` / `temporal-witness.ts` / `temporal-gate.ts` / `temporal-evasion.ts` / `temporal-search.ts`）。给出取舍：可审性、循环依赖、I-03 接线面。
2. **新增文件**是否在 I-00 §11 白名单内：白名单只列了 `temporal.ts` 与 `temporal-input.ts`；新增模块是否构成白名单外改动，需要什么授权。
3. **测试文件**：`packages/contracts/tests/playability-temporal.test.ts`；只增不改；夹具位置。
4. **`graph.ts` hop 参数化**：按 D4 的裁定，是否进入 I-02 白名单；若进入，需要 I-00 R2 之外的什么审批。
5. **`profile.ts`**：是否需要改；I-00 将其列为「需单独裁定」。
6. **`mechanic.ts` / `api.ts` / `verdict.ts` / `index.ts`**：I-02 是否动；I-03 才接线。
7. **明确禁止**：`game-config.ts`、`assetpack.ts`、`playability/{geometry,graph?,reach,spatial,completion,targets}.ts`（按 D4 调整）、`packages/demo/**`、`packages/cli/**`、`packages/mcp/**`、既有断言删除/放宽、新依赖。
8. **公共面**：是否需要导出新的内部类型；`@internal` 约定；不新增公共参数/持久化字段。
9. **fixtures**：内存夹具优先；`fixtures/packs/**` 需单独裁定。
10. **授权边界声明**：本图只产出授权包，不授权实现。

### 产出

票内 `## Answer`：白名单增量表（允许 / 禁止 / 需单独裁定）+ 模块布局图。

### 下游

I02-AUTH。

## 相关证据

- [I02-03 连续时间求交可行性实验](../evidence/03-continuous-intersection.md)：实现应在局部坐标帧内计算，否则 `|x| ~ 1e9` 时 `1e-9` 重叠不可表示（F7）；这可能影响是否需要新增内部模块/辅助文件。
- [I02-04 图割与 hop 加倍可行性实验](../evidence/04-graph-cut-hop.md)：若 D4 裁定 hop 参数化进产品，最小改动是给 `hopSamples`/`hopEdges`/`hopTargets` 加向后兼容的尾参；`graph.ts` 在 I-00「需单独裁定」名单，授权形态归本票。

## 上游裁定（D2）

- [I02-D2 运动模型与输入契约裁定](08-i02-d2-motion-input-contract.md)：三角波 canonical 公式放 contracts 内部模块（demo 不动）；只读 cross-check 只防漂移、不作正确性证明；内部模块不得新增公共导出/schema；具体文件、导出边界、测试路径与白名单由本票裁定，批准前不构成修改授权。

## 上游裁定（D4，2026-11-11）

[I02-D4](10-i02-d4-gate-graphcut.md) 对 `graph.ts` 的授权边界：

1. `graph.ts` 必须进入 I-02 白名单。
2. 增量审批独立于 I-00 R2，不得以 R2 已批准推定。
3. 只允许 `hopSamples` / `hopEdges` / `hopTargets` 的可选尾参 `HopSampling = { hz?, maxSamples? }`；`reachableCells` 仅在逐项列明时包含。
4. 默认 `{ hz: 60, maxSamples: 120 }`，默认行为不变；不得顺带改跳跃公式、采样语义或其他导出。
5. `reach.ts` 不在本次授权范围。

## 上游裁定（D8，2026-11-11）

白名单必须按 U1–U5 分单元列出；`graph.ts` 尾参单独审批；预算接口 / 降级骨架是 U1 前置，不单列 U0 或第六个实施单元。


## 上游裁定（D5，2026-11-11）

预算常量是模块级常量，不进 `GameConfig` / profile / 公开 API；白名单必须容纳预算接口与 `wall-clock-abort` 的独立原因。U1–U2 完整预算验收待 [I02-D5B](21-i02-d5b-cut-budget-benchmark.md)。
