# 37. 把资源包 manifest 契约落进 packages/contracts

Type: task
Status: resolved
Blocked by: 20
Map: ../map.md

> 本票是[票 07](07-project-workspace.md) 施工时**发现的无主缺口**：
> [票 24](24-asset-pack-contract.md) 定了 `assetpack/v1` 的 manifest 形状（grilling，只定形状不落代码），
> 但**没有任何票负责把它变成真实的 Zod schema** ——
> [票 20](20-drawlist-contract.md) 只管 drawlist，[票 28](28-recipe-compilation.md) 只管 Recipe（输入清单）。
> 而它是产物 A 与产物 B 之间**唯一的接口**，不落地就等于没有。
>
> ⚠️ 下文引用的 `experiments/asset-pack-draft/schema.mjs` **已在本票 resolving 时删除** ——
> 它已落进 `packages/contracts/src/assetpack.ts`。两份并存的 schema 必然漂移，
> 所以草案不保留，只保留它跑出来的那个包（`out/`，gitignored）与实验脚本。

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

## Answer

**结论：`assetpack/v1` 的契约已落进 `packages/contracts/src/assetpack.ts`。49 条测试全绿
（drawlist 21 + assetpack 28），且[票 24](24-asset-pack-contract.md) **真跑出来的那个包原样通过**新契约。
草案那份 `schema.mjs` 已删除 —— 两份并存的 schema 必然漂移。**

### 0. 落地清单

| 文件 | 动作 |
|---|---|
| `packages/contracts/src/assetpack.ts` | **新增** —— 契约本体 + `resolvePackRef()` |
| `packages/contracts/src/drawlist.ts` | 改：`PaletteBinding` → `DrawListPaletteBinding`（避让命名冲突）；新增 `PaletteColor` / `PaletteSchema` |
| `packages/contracts/src/index.ts` | 改：`StyleSpecSchema.palette` 收紧成**规范化色板** |
| `packages/contracts/tests/assetpack.test.ts` | **新增** 28 条 |
| `experiments/asset-pack-draft/schema.mjs` | **删除** |
| `experiments/asset-pack-draft/validate.mjs` | 改为 import **真契约** |
| `issues/21-drawlist-renderer.md` | 补连 `37 → 21`（光栅化器要写 manifest） |

### 1. 票面五项逐条

1. ✅ `AssetPackManifestSchema` + 全部子类型（`AssetKind` / `AssetPackEntry` / `AtlasEntry` /
   `FrameRef` / `Animation` / `PaletteRef` / `PackPath` / `Checksum` / `Anchor` / `NinePatch`）
2. ✅ superRefine 交叉校验**一条没简化**：引用完整性 · `files[]` 覆盖 · 色板唯一性 ·
   `paletteBinding` ↔ 降级记录 · **`provenance.mode` 由 `origin` 唯一派生**
3. ✅ `AssetPackRef` 三段式（`{asset, state?, anim?}`），`.strict()`
4. ✅ `paletteBinding` 的静态判定 —— **直接复用票 20 的 `paletteBindingOf()`，没有写第二份**
5. ✅ 票 24 那 9 条反例原样变成单元测试，另加 8 条

### 2. 三处「不写两份」

- `PaletteRef` 从 `drawlist.ts` 复用（草案里它被重复声明了一遍）
- `formatIssues()` 复用（报错摊平）
- `paletteBindingOf()` 复用

**顺带解掉一个命名冲突**：票 20 导出过 `type PaletteBinding = "exact" | "composited"`，
而 manifest 里那个字段是**四值**。两个不同的东西共用一个名字迟早出错 —— 现在分成
`DrawListPaletteBinding`（drawlist 资源的静态判定**只可能**是那两个值）与
`PaletteBinding`（manifest 字段，多出的 `quantized` / `unbound` 只可能来自人工导入路径）。

### 3. 顺手把 `StyleSpecSchema.palette` 规范化了（票 24 Q3 留下的缺口）

票 24 定了「小写 `#rrggbb` + 不得重复色」，但**一直没落**。它不能留到以后 ——
manifest 的 `palette.values` 有同一个正则，两边不一致就会出现
「StyleSpec 说 `#7C968E`、manifest 说 `#7c968e`」这种漂移。现在 `StyleSpecSchema.palette`
直接用 `PaletteSchema`。

⚠️ **实测的色板是大写**（`experiments/style-transfer-from-test-png/stylespec.json`），
所以这要求**生产方在入库时规范化**。那张是模型的原始输出、作为证据归档，**我不改它** ——
规范化的责任在写 fixture 的那一步（[票 15](15-stylespec-fixture.md)）。

### 4. 票面没要求、但不得不加的一件事：`resolvePackRef()`

票 24 §4 说「引用失败必须**构建期静态解析 + fail fast**」，但只给了类型 ——
一份没有解析器的引用类型等于没有约束。所以补上 `resolvePackRef(ref, manifest)`：

- **只给 `asset` 但资源有多个可画的东西 → 失败**。这是最容易漏的一类：
  默认放过去，运行时就会静默画错。
- 引用不存在的 asset / state / anim → 各自给出可定位的错（并列出可选值）。

理由是[票 03](03-phaser-vite-playwright-chain.md) 实测的：Phaser 的 loader 静默失败，
**构建期是唯一还能报错的地方**。

### 5. 验收

| # | 检查 | 结果 |
|---|---|---|
| ① | **票 24 真跑出来的那个包**过新契约 | ✅ 6 resources / 4 atlases / 20 files · `provenance.mode=mixed` · coverage `{exact:4, composited:1, quantized:1, unbound:0}` |
| ② | 单元测试 | ✅ **49 passed**（drawlist 21 + assetpack 28） |
| ③ | 票 24 的 9 条反例 | ✅ 全部被拒 |
| ④ | `pnpm check` / `pnpm typecheck` | ✅ |

第 ① 条是这次最有分量的证据：契约不是拿我现造的 fixture 自证，而是**票 24 那个真包原样通过**。

### 6. 留给下游

- **`AssetPackRef` 与[票 09](09-game-config-contract.md) 是同一个接口的两侧** ——
  票 24 在 A 侧先定，**票 09 请采纳或提出异议**。这是本票唯一一处「我先替你定了」。
- [票 21](21-drawlist-renderer.md)（光栅化器）现在可以直接 import `AssetPackManifest` 来写包。
- [票 30](30-cli-and-mcp-surface.md) 的「校验一个已有资源包」这个动作，现在就是 `parseAssetPack()`。
