# 37. 把资源包 manifest 契约落进 packages/contracts

Type: task
Status: open
Blocked by: 20
Map: ../map.md

> 本票是[票 07](07-project-workspace.md) 施工时**发现的无主缺口**：
> [票 24](24-asset-pack-contract.md) 定了 `assetpack/v1` 的 manifest 形状（grilling，只定形状不落代码），
> 但**没有任何票负责把它变成真实的 Zod schema** ——
> [票 20](20-drawlist-contract.md) 只管 drawlist，[票 28](28-recipe-compilation.md) 只管 Recipe（输入清单）。
> 而它是产物 A 与产物 B 之间**唯一的接口**，不落地就等于没有。

## Question

把 `experiments/asset-pack-draft/schema.mjs` 里那份已经跑通校验的 Zod 草案
落进 `packages/contracts/src/`。

草案的出处与实测证据（已通过 manifest 解析 + 9 条反例全部被拒）：

- [`../experiments/asset-pack-draft/schema.mjs`](../experiments/asset-pack-draft/schema.mjs)
- [`../experiments/asset-pack-draft/validate.mjs`](../experiments/asset-pack-draft/validate.mjs)
- [`../experiments/asset-pack-draft/build.mjs`](../experiments/asset-pack-draft/build.mjs) —— 真实产出一个包

要落地的：

1. `AssetPackManifestSchema`（`format: "assetpack/v1"`）与它引用的全部子类型：
   `AssetKind` / `AssetPackEntry` / `AtlasEntry` / `FrameRef` / `Animation` /
   `PaletteRef` / `PackPath` / `Checksum` / `Anchor` / `NinePatch`。
2. 那几条 **superRefine 交叉校验**（引用完整性、`files[]` 覆盖、色板唯一性、
   `paletteBinding` 与降级记录的一致性、`provenance.mode` 由 `origin` 唯一派生）——
   它们是 R2 留下的「生成路径上的确定性校验」的集中落点，**不要简化掉**。
3. `AssetPackRef`（B 侧引用的三段式 `{asset, state?, anim?}`）。
   **必须与[票 09](09-game-config-contract.md) 给出同一个答案**，两票共用一个类型。
4. **`paletteBinding` 的静态判定函数**（票 36 的结论）：走一遍 drawlist 的 ops 看有没有
   `opacity`，不需要渲染。所以本票阻塞在票 20 —— 判定函数要 import 它的 ops 类型。
5. 把票 24 的 9 条反例**原样变成单元测试**。它们现在只是脚本里的断言，
   而它们是这份契约唯一的质量证明。

不要在本票里做的事：实现光栅化或图集打包（票 21）、写 Recipe（票 28）、
版本化策略（票 18）。

## Answer

_（待填）_
