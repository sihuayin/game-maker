# 38. 资源包的组装：recipe + StyleSpec → 一个完整的包目录

Type: task
Status: resolved
Blocked by: 21, 23, 28
Map: ../map.md

> 本票是[票 21](21-drawlist-renderer.md) 施工时**发现的无主缺口**：
> 票 21 交付的是「**编译器后端**」（drawlist → PNG、图集组装），
> [票 24](24-asset-pack-contract.md) 定的是包的**形状**、[票 37](37-assetpack-manifest-landing.md)
> 落的是包的 **schema** —— 但**没有任何票负责把三者拼起来真的产出一个包目录**：
> 读 recipe、逐资源光栅化或导入、按 kind 打包图集、写 `manifest.json`、把创作态拷进
> `authoring/`、逐文件算 checksum。

## Question

把「一个完整的资源包目录」这一步落进 `packages/assets`（它的公开 API 出口），
让产物 A 真的能端到端跑出来。

已知的输入与约束：

- 包的形状与 manifest schema：[票 24](24-asset-pack-contract.md) / [票 37](37-assetpack-manifest-landing.md)
- 编译器后端（光栅化 / 量化 / 图集 / PNG）：[票 21](21-drawlist-renderer.md)，已在 `packages/assets`
- 人工导入通道与来源标注：[票 23](23-bitmap-asset-pipeline.md)
- **recipe 的正式 schema**：[票 28](28-recipe-compilation.md) —— **本票阻塞在它**
  （草稿在 [`../experiments/asset-pack-draft/recipe.json`](../experiments/asset-pack-draft/recipe.json)）
- **绝不覆盖式生成**：`v<N>` 递增，旧版本永久保留（[票 18](18-artifact-ref-consistency.md) 定细则）
- 输出路径：仓库根 `out/<gameId>/pack/v<N>/`（[票 29](29-monorepo-layout.md)）
- `createdAt` 会破坏「同一输入两次生成逐字节相同」—— 需要一个像 `SOURCE_DATE_EPOCH`
  的开关，让可复现性可以被测试（草稿里已经有这个做法）

现成的参照实现：[`../experiments/asset-pack-draft/build.mjs`](../experiments/asset-pack-draft/build.mjs) ——
它已经能产出一个通过校验的真包（逐字节可复现），但它用的是一份写死在脚本里的 recipe 假设。
本票要做的是让它成为有类型、有测试、被 CLI/MCP 调用的公开 API。

## Answer

_（待填）_

## Answer

**结论：产物 A 的组装链路端到端通了。`buildAssetPack()` 落进 `packages/assets`，
从真实推导出的清单产出一个通过校验、逐字节可复现、能被任何引擎直接吃掉的包。
153 条测试全绿。**

### 0. 一个必须先说的设计决定：生成器是**注入的端口**

`source.kind === "generate"` 的资源需要 drawlist 生成器，而那是[票 22](22-asset-generator.md) 的东西（**还没做**）。
所以本票把它做成一个**注入的端口**：

```ts
export type DrawListGenerator = (spec: AssetSpec, style: StyleSpec) => DrawList[] | Promise<DrawList[]>;
```

两条理由，第二条更重要：

1. 组装逻辑因此可以**完全离线测试**；
2. **把网络调用埋在组装里，「包为什么长这样」就无法被测试** —— 而组装是产物 A 的出口，
   它恰恰是最该被测清楚的那一段。票 22 也因此有了一个明确的插口，而不是「往组装里塞一段调用」。

**所以本票交付的是组装，不是生成。** `generate` 那条路目前跑的是桩（见
[`../experiments/pack-assembly/`](../experiments/pack-assembly/)），真生成器归票 22。

### 1. 端到端实测（票面的产出要求）

用**真实推导出来的**清单（`fixtures/recipes/shift-change.json`，8 个资源）+ 真实产出的 StyleSpec：

```
清单 ✅ · manifest 过 schema ✅ · 对账（spec ↔ 产物）0 问题
215 ms · 28 个文件 · 1106 KiB → out/shift-change-assets/pack/v1/
```

```
交付态  delivery/atlas.{animations,backgrounds,sprites}.{json,png}
创作态  authoring/drawlist/*.json（20 份）· authoring/imported/*.png · authoring/stylespec.json
入口    manifest.json
```

**两条路都跑到了**：7 个资源走生成（`paletteBinding: exact`）、1 个背景走人工导入（`quantized`）。
`provenance.mode = mixed`，`coverage = {exact:7, composited:0, quantized:1, unbound:0}`。

### 2. 验过的四件事

| | 结果 |
|---|---|
| **确定性** | 同一 epoch 两次构建，manifest 与包内 **28 个文件（含 PNG）逐字节相同** |
| **可消费性** | 图集是 TexturePacker JSON Hash（`frames` 是**对象**），帧字段恰好是 Phaser 真读的那 6 个 —— `anchor, frame, rotated, sourceSize, spriteSourceSize, trimmed` |
| **可搬走** | 包内路径全是相对 POSIX |
| **绝不覆盖** | 同一个 `outDir` 再跑落在 `v2`，`v1` 还在（`nextPackVersion()` 扫描已有版本） |

### 3. 🔴 施工中抓到的两件事

**① `original` 用了 `process.cwd()` —— 于是 manifest 会随 cwd 变。**
「同一输入两次生成逐字节相同」是 checksum 成立的前提，而 cwd 是个隐式输入。
改成直接用清单里那个仓库相对路径。

**② 图集文件名与契约不一致。** 我一开始写成 `delivery/sprites.json`，
而[票 24](24-asset-pack-contract.md) 定的是 `delivery/atlas.sprites.json`（草案实验也是）。
是**验证脚本报文件不存在**时暴露的 —— 契约里写着的形状与代码里写着的形状，只有真去读才会发现不一致。

### 4. 落地清单

| 文件 | 内容 |
|---|---|
| `packages/assets/src/pack.ts` | **新增** —— `buildAssetPack()` · `DrawListGenerator` 端口 · `nextPackVersion()` |
| `packages/assets/tests/pack.test.ts` | **新增** 9 条（结构 / files[] 覆盖 / 确定性 / 绝不覆盖 / 派生的一致性 / 色板规范化 / 帧数不符 / 重复色 / 导入端到端） |
| `experiments/pack-assembly/` | 全量端到端脚本 + 可消费性验证（可复跑） |

| # | 检查 | 结果 |
|---|---|---|
| ① | 全部测试 | ✅ **153 passed** |
| ② | 全量端到端 + 对账 | ✅ 28 文件 / 0 问题 |
| ③ | 确定性（含 PNG 逐字节） | ✅ |
| ④ | `pnpm check` / `typecheck` | ✅ |

### 5. 产物 A 现在离完成还差什么

**只差[票 22](22-asset-generator.md)（drawlist 生成）** —— 组装链路、契约、光栅化、导入通道、清单全齐了，
但 `source.kind === "generate"` 还没有真的生成器。这是产物 A 的**最后一环**。

另外[票 15](15-stylespec-fixture.md)（参考图 → StyleSpec）是**入口那一侧**的最后一环；
它阻塞在票 04，而视觉路径现在通了（见票 28 的 Answer §9），技术上可做。

### 6. `paletteBinding: "unbound"` 恒为 0

包里的 `coverage.unbound` **恒为 0**：这条管线只有两条路 —— drawlist（`exact` / `composited`）
与导入（`quantized`）。`unbound` 是契约留给**别的**生产者的逃生舱（票 24），本管线不用它。
代码里写死了这个 0 并注明理由，免得以后有人以为它是漏算的。

### 7. 传给[票 18](18-artifact-ref-consistency.md) 的一条事实

版本递增现在是 `nextPackVersion()` **扫描目录取 max+1**（票 18 的问题 1 列了三个候选，
这是其中之一）。本票没有加锁 —— 并发写同一个 `outDir` 会撞。票 18 收口时要决定要不要防。
