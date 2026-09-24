# asset-pack-draft —— 票 24 的「把草案填一遍」

**这不是生产实现。** 生产实现要等票 24 的契约落地 + 票 29 的 monorepo 骨架。

存在的唯一理由：票 24 的产出要求写明「用现有实验里那 6 份真实资源把草案填一遍，
**纸上推演不算**」。这个目录就是那一遍 —— 它跑得起来，包是真的。

## 跑

```bash
node build.mjs           # → out/dystopian-shop/v1/
node validate.mjs        # 用 schema.mjs 校验 manifest + 跑 9 条反例
node preview.mjs         # → out/dystopian-shop/v1/preview.png（放大联系表，供人眼）
```

`build.mjs` / `preview.mjs` 只用 Node 内置模块。`validate.mjs` 需要 **zod 3.25.x**
（与 `demo/package.json` 的 `^3.25.76` 对齐）—— 本机没有装，用软链顶上了：

```bash
mkdir -p node_modules && ln -sfn /path/to/zod@3.25.76 node_modules/zod
```

`out/` 是产物，已 gitignore；软链的 `node_modules/` 被仓库根 `.gitignore` 覆盖。

## 输入（全是仓库里已有的真实产物，没有一个是现造的）

| 来源 | 用途 |
|---|---|
| `../../experiments/style-transfer-from-test-png/stylespec.json` | 色板与风格（票 22 实验的真实产出） |
| `../../experiments/style-transfer-from-test-png/drawlist.*.json` | platform / pickup / hazard / bg_sign 4 份 |
| `../../experiments/animated-player/frame.*.json` | player 六帧（单次调用生成、帧间同一性实测有效的那套） |
| `../../../../demo/test.png` | 人工导入通道的场景尺度位图（1218×685） |
| `recipe.json` | 资源清单。草案形状，正式 schema 归票 28 |

## 文件

| 文件 | 作用 |
|---|---|
| `build.mjs` | 主脚本：recipe → 光栅化/量化 → 按 kind 打包图集 → 写 manifest + checksum |
| `schema.mjs` | **`assetpack/v1` 的 Zod 草案 —— 本目录真正的产物**。票 29 resolved 后落进 `packages/contracts` |
| `validate.mjs` | 校验刚生成的 manifest，并跑 9 条反例（硬编码色/绝对路径/谎报 fixture/…） |
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
4. **契约是可解析的，不只是「看起来对」** —— `validate.mjs` 让 manifest 过 Zod，
   并验证 9 条反例**全部被拒**：硬编码色 / 版本号 0 / 指向不存在的图集 / 动画引用不存在的帧 /
   绝对路径 / `files[]` 漏文件 / 色板重复色 / `unbound` 不记降级 / **fixture 包谎报自己是 generated**。
   最后一条是由「`provenance.mode` 必须等于 `assets[].origin` 的派生值」这条规则抓到的 ——
   它让「诚实」成为**结构性**要求而不是约定。

## 它暴露的（写进票 24 的 Answer，别让它们消失）

1. **`opacity` 击穿了「颜色 ∈ 色板」的构造恒真性。** `hazard` 用了 4 个 `opacity: 0.35` 的
   `poly`，alpha 混合在色板内产生了两个色板外颜色（`#7a6c5d` ×24px、`#898f78` ×8px）。
   构造恒真只在「没有 opacity」时成立 —— 这会逼出一个 schema 决策。
2. **量化不是免费的。** 把 1218×685 的场景图量化到 9 色，**100.00% 的非透明像素被改色**。
   成品能看（见 `preview.png`），但它已经不是原图了 —— `paletteBinding: "quantized"`
   必须让调用方**看得见**这件事。
3. **锚点没有源头。** drawlist 里根本不存在「哪一点是锚点」的信息，`player` 的
   `{x:0.5, y:0.92}` 是这次手填的。票 26 必须给出它的来源规则。
4. **`expectedSize` 与实际包围盒的比对时机**：这里放在光栅化后立刻做（凸包上界只判过大），
   与票 27 的搬家规则一致。
