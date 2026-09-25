# 21. drawlist → PNG 光栅化器（交付态生成器）

Type: task
Status: resolved
Blocked by: 24, 29, 07, 37
Map: ../map.md

> 🔴 **本票还不能开工：`packages/` 尚不存在**（2026-09-24 补连的边）—— 目的地 `packages/assets/` 的形态由 [票 29](29-monorepo-layout.md) 定，`29 → 21` 补上了。

> ✅ **票 24 已 resolved**（2026-09-24）。交付态图集的形状已定：**按 kind 各一份** TexturePacker JSON Hash + PNG（`delivery/atlas.<kind>.json`），每帧带 `anchor`，`ui` 的帧带 `scale9Borders`。量化与光栅化共用同一份实现。草案里那四份 `lib/*.mjs` 已在票 21 resolving 时**删除** —— 实现落进 `packages/assets/src/`，实验脚本改为 import 真实现。

> 📌 **两条上游约束已确定**（2026-09-24）。
>
> 1. **量化规则与[票 23](23-bitmap-asset-pipeline.md) 共用**。票 35 选了 (c)+(a) 之后，
>    票 23 的「问题 5（像素网格后处理）」原样保留并转移到本票的射程内 ——
>    「量化到 `StyleSpec.palette` + 最近邻缩放到目标尺寸」对**光栅化产出的图**和
>    **人工导入的图**是同一个要求，**不要写两份**。而它现在更刚需了：
>    人给的图颜色**不受色板约束**。
> 2. **图集组装按[票 25](25-delivery-format-spec.md) 的事实来**：
>    产出 **TexturePacker JSON Hash/Array**（Phaser 原生读、零转换器），
>    每帧带 `anchor`（归一化到 `sourceSize`）与 `scale9Borders`（UI 九宫格）。
>    这让本票的产出直接对接[票 26](26-animation-representation.md) 的锚点与
>    [票 33](33-runtime-assembly.md) 的装配，中间不需要任何转换代码。

> ⚠️ **范围已重画**（2026-09-24，R3）：**从两条消费路径收窄成一条，但这条的分量重了。**
>
> 上一版问「Canvas2D 直画还是离屏渲染成 texture，Phaser 的 Graphics 够不够用」。
> R3 之后这个问题**消失了**：交付态是 PNG，产物 B 直接加载 PNG，
> **Phaser 根本不需要认识 drawlist** —— 所以 Phaser Graphics 那条路不用走了，
> 「票 02 确认 Phaser Graphics API」这个阻塞也随之作废。
>
> 收窄成一条之后它反而变成了**交付态的唯一生产者**：drawlist 是创作态，
> 所有非位图资源（道具、关卡几何、UI 图元、背景图元）都**必须**经过这个光栅化器
> 才能变成包里那张 PNG。它不是渲染器，是**编译器后端**。
>
> **新增的硬要求**：
> 1. **确定性**：同一份 drawlist 两次光栅化必须**逐字节相同**。否则 checksum（[票 18](18-artifact-ref-consistency.md)）
>    不成立、「换色板后产物文本不变」的性质也传导不到交付态。
> 2. **目标尺寸与像素格**：交付的是「像素风」资源，光栅化必须支持最近邻缩放到
>    32px 之类的网格（与[票 23](23-bitmap-asset-pipeline.md) 问题 5 的后处理是同一件事）。
> 3. **图集组装**：多张 drawlist 输出拼进一张 atlas PNG + 元数据，拼法由[票 25](25-delivery-format-spec.md) 定。
> 4. 失败必须**报告是哪个 asset 的哪个 op**，不能让整批崩掉。

## Question

票 05 定了 Asset 是 `drawlist+curve/v1`（纯数值图元 + `curve` 用 Catmull-Rom）。
现在要把它变成屏幕上的像素。按 Q15，renderer 属于**手写固定**代码，不由 AI 生成。

**为什么阻塞在票 02**：Phaser 3 的 `Graphics` API 能否重放 drawlist **尚未实测**
（`bezierCurveTo` 是否存在、ellipse 参数是宽高还是半径、颜色是 number 还是 string）。
票 02 的第 9 条会给出答案，那决定走哪条路。

两条路（票 05 子问题 6 的结论）：

1. **直接画**：每个实体一个 `this.add.graphics()`，重放 ops。
   简单、无中间产物、改 ops 立刻生效 —— **对 repair 循环友好**
   （票 16 改一个数字就能看到效果，不用等 texture 重建）。
2. **离屏渲染成 texture**：drawlist → Canvas2D → `game.textures.addCanvas()`
   → `this.add.image()`。性能好（GPU 精灵批处理），但多一层缓存要失效管理。

**建议先 ①，性能不够再上 ②。** 但 ② 有一个 ① 没有的好处：
它产出的 canvas 可以被 Playwright 截图，也可以被
`measureInk()`（原型里那个「渲染后扫像素」的函数）用来**实测真实包围盒**，
进而校准票 12 的凸包容差。这个用途值不值得让 ② 提前？

要落地：

1. **`demo/src/game/renderer.ts`**：`drawOps(ctx, ops, palette)` 的 Canvas2D 实现。
   原型里已有一份可用的（含 Catmull-Rom → 三次贝塞尔的 8 行转换），直接搬。
2. **Phaser 版翻译器**（若票 02 确认 `Graphics` 够用）：
   同一个 `drawOps` 抽象，换一套后端调用。**两者必须产出视觉一致的结果** ——
   要不要一个对照测试（同一份 drawlist 分别渲染，比对像素）？
3. **palette 解析**：`palette:N` → hex。这个函数与票 20 的
   `resolveRefs()` 是同一个东西，**不要写两份**。
4. **错误处理**：原型实测过 D 候选的失败模式 ——「坏数据通过校验、到渲染才炸」。
   E 格式下 schema 已经拦住了绝大部分，但 renderer 仍要能
   **报告是哪个 asset 的哪个 op 渲染失败**（对应
   `RuntimeHealthReport.assetLoadErrors` 与 `AssetManifest.broken`），
   而不是让整个游戏崩掉。
5. **性能基线**：一次渲染 8 个 asset × 若干实体要多久？
   这个数字要进票 19 的时间账本。

不要在本票里做的事：Runtime Bridge（票 10）、场景组合（票 09 的 Game Config）、
Visual QA 的检查逻辑（票 12）。

## Answer

_（待填）_

## Answer

**结论：交付态光栅化器已落进 `packages/assets/`，73 条测试全绿、`check` / `typecheck` 全过。
它逐字节复现了[票 24](24-asset-pack-contract.md) 那个包，并在移植过程中修掉了草案里一个
把人工导入的位图**读成灰度**的 bug。**

### 0. 票面正文有两条已作废，我没有按字面执行

| 票面条目 | 处置 |
|---|---|
| ① `demo/src/game/renderer.ts` —— Canvas2D 实现 | **作废**。交付态是 PNG，产物 B 直接加载 PNG，**Phaser 根本不认识 drawlist**（抬头已写明）。浏览器端那一套不需要了 |
| ② Phaser 版翻译器 + 两者像素对照测试 | **作废**，理由同上；票 02 的阻塞也随之作废 |
| ③ palette 解析不写两份 | ✅ 见 §3 |
| ④ 失败要报 asset + op | ✅ 见 §2.4 |
| ⑤ 性能基线 | ✅ 见 §5 |

真正交付的不是「渲染器」，是**编译器后端**：Node 端跑，零 DOM / 零 Canvas 依赖。

### 1. 落地清单

| 文件 | 内容 |
|---|---|
| `packages/assets/src/raster.ts` | `rasterize()` · `rasterizeToGrid()` · `RasterError` |
| `packages/assets/src/image.ts` | `RasterImage` · `resizeNearest()` · `inkBBox()` · `paletteExactness()` |
| `packages/assets/src/png.ts` | PNG 编解码 —— **光栅化产出与人工导入共用一份** |
| `packages/assets/src/quantize.ts` | `quantizeToPalette()` —— 同样两条通道共用 |
| `packages/assets/src/atlas.ts` | `buildAtlas()` —— 货架打包 + TexturePacker JSON Hash |
| `packages/assets/tests/raster.test.ts` | 73 条测试 |

### 2. 票面四条硬要求，逐条

**① 确定性** —— 三条测试守着：同一 drawlist 两次光栅化逐字节相同 · 两次 PNG 编码相同 ·
两次图集打包的矩形分配与 PNG 相同。做法是逐像素取中心点做二值覆盖判定（**不抗锯齿**）+
浮点累积 + 末次量化。抗锯齿不只是「像素风不要」—— 它会在色板色之间插值，产出色板**外**颜色。

**② 目标尺寸与像素格** —— `resizeNearest()` 整块放大，`rasterizeToGrid()` 一步到位。
**不用小数缩放重绘**：那会让几何落在半像素上、插值出色板外颜色。
有一条测试专门守着「2×/3×/4× 放大后仍然没有色板外颜色」。

**③ 图集组装** —— TexturePacker JSON Hash（票 25 查清的事实形状），只写 Phaser **真的会读**的字段：
`frame` / `rotated` / `trimmed` / `spriteSourceSize` / `sourceSize` / **`anchor`** / **`scale9Borders`**。
另有一条测试**逐像素**核对「每一帧都落在它声明的矩形上」。

**④ 失败报 asset + op** —— `RasterError` 带 `assetId` 与 `opIndex`。测试里那条正是
「**坏数据通过 schema、到渲染才炸**」：`palette:99` 格式合法但索引越界，schema 拦不住它
（schema 只保证「是 palette 引用」，不保证「引用得到」），必须由光栅化器定位。实测报错：

```
drawlist "tomato" ops[1]: 颜色引用 "palette:99" 越界（色板只有 9 项）
```

### 3. 「不写两份」—— 票面条目 3

`palette:N` → 色值的解析，**全仓库只有 `paletteColor()` 一处**（在 `packages/contracts`），
`resolveRefs()`（统计用色）与光栅化器（取色）都走它 —— 否则两者迟早对「越界怎么算」给出不同答案。

同理，**量化与 PNG 编解码对「光栅化产出」与「人工导入」是同一份实现**（票 21 抬头的硬要求）。

### 4. 🔴 移植过程中修掉的一个真 bug

把草案那四份实现换成生产版之后重跑票 24 的包，**除了 `meta.app` 改名，唯一不同的文件是
`delivery/atlas.backgrounds.png`** —— 而且不是漂移，是修复：

草案的 `decodePNG` **按通道数分支**，而 colorType 4（灰度+alpha）与 6（RGBA）的通道数
**都是 4** —— 于是人工导入的 `test.png`（RGBA）被当成灰度读，背景**整张变成了灰的**：

| | 颜色数 |
|---|---|
| 旧包（草案解码器） | **5 种** —— R=G=B 坍塌了 |
| 新包（生产解码器，按 colorType 分支） | **9 种** |

> 我上一轮看那张 `preview.png` 时觉得「量化到 9 色居然还能看」，其实那是 bug 的效果。
> 修完之后整个包从灰度变成青灰 + 奶油 + 橙，背景是那间真的反乌托邦商店，招牌的 CRT 是青的。

**换实现之后，包里所有由 drawlist 光栅化出来的 PNG 逐字节没变** —— 这同时证明了移植是忠实的。
另有一条测试专门守着这个分支：编码 → 解码逐字节回到原样。

### 5. 性能基线（票面条目 5，进[票 19](19-latency-budget.md) 的时间账本）

| 场景 | 单次 | 一轮（12 份真实产物） |
|---|---|---|
| 真实产物（163 ops，几乎全是 4 顶点的 `rect`） | **0.074 ms** | 0.88 ms |
| 原型 fixtures（83 ops，含 `ellipse` / `circle`） | **0.758 ms** | 6.06 ms |
| 真实 12 份 **+ PNG 编码**（deflate level 9） | — | **1.85 ms** |

**代价几乎完全由多边形的顶点数决定**：`circle` / `ellipse` 展开成 64 边形、`curve` 是 24 段，
而真实产物几乎全是 4 顶点的 `rect`。最坏情况按 ~1 ms/资源估。

> **结论：光栅化不是瓶颈。** 20 个资源约 20 ms，而一次 LLM 调用实测 **9 s** —— 差三个数量级。
> map 的 fog 里那条「一次要生 20 个资源，串行可能要几分钟」的瓶颈**全在 LLM 那一侧**。

### 6. 发现一个无主缺口 → 建[票 38](38-asset-pack-assembly.md)

票 21 交付的是**编译器后端**，票 24 定的是包的**形状**，票 37 落的是包的 **schema** ——
但**没有任何票负责把三者拼起来真的产出一个包目录**：读 recipe、逐资源光栅化或导入、
按 kind 打包图集、写 `manifest.json`、把创作态拷进 `authoring/`、逐文件算 checksum。

已有的参照实现在 [`experiments/asset-pack-draft/build.mjs`](../experiments/asset-pack-draft/build.mjs)
（它已经能产出通过校验的真包），但它用的是一份写死在脚本里的 recipe 假设。

→ 已建[票 38「资源包的组装」](38-asset-pack-assembly.md)，阻塞于 `21 / 23 / 28`
（正式 recipe schema 在票 28）。

### 7. 连带修掉的重复实现

实验目录里的 `lib/*.mjs`（raster / png / atlas / quantize 四份草案实现）**已全部删除** ——
它们已经落进 `packages/assets`，`build.mjs` 与 `preview.mjs` 改为 import 真实现。
两份并存的实现必然漂移，与票 37 删掉 `schema.mjs` 是同一个理由。
EOF
cd /Volumes/shy/some-projects/game-maker/.scratch/game-creation-v1/issues && python3 - <<'PY'
import io
p='21-drawlist-renderer.md'; s=io.open(p,encoding='utf-8').read()
s=s.replace('Status: claimed','Status: resolved',1)
io.open(p,'w',encoding='utf-8').write(s.rstrip('\n')+'\n'+io.open('/tmp/answer21.md',encoding='utf-8').read())
print('✓ answer21 written')
PY
python3 - <<'PY'
import io
p='/Volumes/shy/some-projects/game-maker/.scratch/game-creation-v1/map.md'; s=io.open(p,encoding='utf-8').read()
old = """## Decisions so far

<!-- 一行一张已关闭的票：够判断相关性即可，细节去票里看 -->

- [把资源包 manifest 契约落进 packages/contracts](issues/37-assetpack-manifest-landing.md)："""
new = """## Decisions so far

<!-- 一行一张已关闭的票：够判断相关性即可，细节去票里看 -->

- [drawlist → PNG 光栅化器](issues/21-drawlist-renderer.md)：交付态光栅化器落进 `packages/assets`
  （raster / image / png / quantize / atlas 五块，**73 条测试全绿**）。票面正文里的
  Canvas2D 与 Phaser 翻译器**两条都作废**（交付态是 PNG，Phaser 不认识 drawlist），
  真正交付的是**编译器后端**：Node 端跑、零 DOM 依赖。
  四条硬要求全落地：**逐字节确定**（不抗锯齿 + 浮点累积 + 末次量化，三条测试守着）·
  **最近邻放大不引入插值色** · **TexturePacker JSON Hash**（只写 Phaser 真读的字段，
  逐像素核对帧落位）· **失败报 asset + op**（`palette:99` 格式合法但越界，schema 拦不住，
  必须由光栅化器定位）。`paletteColor()` 全仓库只此一处，量化与 PNG 对两条通道共用。
  🔴 **移植时修掉一个真 bug**：草案的 `decodePNG` 按**通道数**分支，而 colorType 4（灰度+alpha）
  与 6（RGBA）通道数都是 4 —— 人工导入的 `test.png` 被当成灰度读，**背景整张变灰**（只剩 5 色）。
  按 colorType 分支后解出 9 色，整个包从灰度变成青灰+奶油+橙。换实现后所有
  drawlist 光栅化的 PNG 逐字节没变 —— 移植忠实。
  **性能基线**：真实产物 0.074 ms/份，一轮 12 份含 PNG 编码 1.85 ms；最坏 ~1 ms/份。
  **光栅化不是瓶颈** —— 20 个资源约 20 ms vs 一次 LLM 调用 9 s。
  连带删掉实验里那四份重复实现（`lib/*.mjs`）。**建票 38**（包组装）。

- [把资源包 manifest 契约落进 packages/contracts](issues/37-assetpack-manifest-landing.md)："""
assert old in s; io.open(p,'w',encoding='utf-8').write(s.replace(old,new,1)); print('✓ map.md')
PY
pnpm check 2>&1 | grep "✅" && pnpm test 2>&1 | grep -E "Tests +[0-9]|Test Files"