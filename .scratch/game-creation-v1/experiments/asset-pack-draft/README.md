# asset-pack-draft —— 票 24 的「把草案填一遍」

**这不是生产实现。** 生产实现要等票 24 的契约落地 + 票 29 的 monorepo 骨架。

存在的唯一理由：票 24 的产出要求写明「用现有实验里那 6 份真实资源把草案填一遍，
**纸上推演不算**」。这个目录就是那一遍 —— 它跑得起来，包是真的。

## 跑

```bash
node build.mjs           # → out/dystopian-shop/v1/
pnpm build && node validate.mjs   # 用**已落地的契约**校验刚生成的包（反例测试在 packages/contracts/tests/ 里）
node preview.mjs         # → out/dystopian-shop/v1/preview.png（放大联系表，供人眼）
```

`build.mjs` / `preview.mjs` 只用 Node 内置模块。`validate.mjs` import 的是
`packages/contracts/dist` —— 先 `pnpm build`。

> ⚠️ **这里曾经有一份 `schema.mjs` 草案，已删除。** `assetpack/v1` 的契约现在只有一处：
> `packages/contracts/src/assetpack.ts`（票 37 落的）。两份并存的 schema 必然漂移。

`out/` 是产物，已 gitignore；软链的 `node_modules/` 被仓库根 `.gitignore` 覆盖。

## 输入（全是仓库里已有的真实产物，没有一个是现造的）

| 来源 | 用途 |
|---|---|
| `../../experiments/style-transfer-from-test-png/stylespec.json` | 色板与风格（票 22 实验的真实产出） |
| `../../experiments/style-transfer-from-test-png/drawlist.*.json` | platform / pickup / hazard / bg_sign 4 份 |
| `../../experiments/animated-player/frame.*.json` | player 六帧（单次调用生成、帧间同一性实测有效的那套） |
| `../../../../fixtures/reference/test.png` | 人工导入通道的场景尺度位图（1218×685） |
| `recipe.json` | 资源清单。草案形状，正式 schema 归票 28 |

## 文件

| 文件 | 作用 |
|---|---|
| `build.mjs` | 主脚本：recipe → 光栅化/量化 → 按 kind 打包图集 → 写 manifest + checksum |
| `validate.mjs` | 用 **`packages/contracts` 里那份真契约**校验刚生成的包（`pnpm build` 之后跑） |
| `lib/png.mjs` | 最小 PNG 编解码（解码 test.png 用；编码图集用） |
| `lib/raster.mjs` | drawlist → RGBA8 的确定性光栅化器（逐像素中心判定、无抗锯齿、无缩放） |
| `lib/atlas.mjs` | 货架打包 + TexturePacker JSON Hash 写出（含 `anchor` / `scale9Borders`） |
| `lib/quantize.mjs` | 最近邻色量化 + 「每个非透明像素是否 ∈ 色板」的扫像素验证 |
| `preview.mjs` | 联系表 PNG，仅供人眼 |

## 它证明的

1. **契约装得下真实产物** —— 四类资源、六帧动画、九宫格、人工导入位图，全都进了同一份 manifest。
2. **交付态与创作态分层成立** —— `delivery/` 里只有 PNG + TexturePacker JSON（引擎直接吃），
   `authoring/` 里只有 drawlist 与导入原图（本项目读）。两者靠 manifest 的 `assetId` 联结。
3. **逐字节确定** —— 连跑两次 `build.mjs`，`diff -r` 除 `preview.png` 外无差异（PNG 字节也一样）。
   这是 checksum 成立、以及「换色板后创作态文本不变」能传导到交付态的前提。
4. **契约是可解析的，不只是「看起来对」** —— `validate.mjs` 让这个包过**已落地的契约**
   （`packages/contracts/src/assetpack.ts`）。反例测试（9 条 + 新增 8 条）在
   `packages/contracts/tests/assetpack.test.ts` 里，全部被拒。
   其中最关键的一条是 **fixture 包谎报自己是 generated** —— 由「`provenance.mode` 必须等于
   `assets[].origin` 的派生值」抓住，让「诚实」成为**结构性**要求而不是约定。

## 它暴露的（写进票 24 的 Answer，别让它们消失）

1. **`opacity` 击穿了「颜色 ∈ 色板」的构造恒真性** —— 已由[票 36](../../issues/36-opacity-and-palette-invariant.md) 裁决。
   `hazard` 用了 4 个 `opacity: 0.35` 的 `poly`，alpha 混合在色板内产生了两个色板外颜色
   （`#7a6c5d` ×24px、`#898f78` ×8px）。裁决是**保留 `opacity`、把不变量说准**：
   来源 ∈ 色板（构造恒真）∧ 复合色是色板的确定函数（构造恒真），
   失效的只是「渲染后像素 ∈ 色板」这个更强的说法。
   结果是 `paletteBinding` 由 3 值扩成 4 值（新增 `composited`），
   且对 drawlist 资源变成**解析期静态可判** —— `build.mjs` 现在就是静态判的，
   扫像素退化成对它的测试（见运行输出最后两行）。
2. **量化不是免费的。** 把 1218×685 的场景图量化到 9 色，**100.00% 的非透明像素被改色**。
   成品能看（见 `preview.png`），但它已经不是原图了 —— `paletteBinding: "quantized"`
   必须让调用方**看得见**这件事。
3. **锚点没有源头。** drawlist 里根本不存在「哪一点是锚点」的信息，`player` 的
   `{x:0.5, y:0.92}` 是这次手填的。票 26 必须给出它的来源规则。
4. **`expectedSize` 与实际包围盒的比对时机**：这里放在光栅化后立刻做（凸包上界只判过大），
   与票 27 的搬家规则一致。
