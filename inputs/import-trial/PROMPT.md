# import 通道试件：用生图模型产出真图，走管线进包

这是**不重开任何被锁决策**的一条路：图由你在会话里（合规的交互式工具）产出，
管线**只读不调 API**。R10 / 票 35 的裁决原样成立。

## 世界

黄昏的山间列车小站 —— 与 `fixtures/reference/halt-dusk.png` 同一个世界。
风格规格是 `fixtures/style-spec.halt-dusk.json`（从那张图提取的），要点：

```
identity      极简像素风 · 扁平色块 · 低饱和度 · 几何构成 · 复古游戏
camera        2D 正交侧面视角 · 平视
shapeLanguage 横平竖直 · 矩形主导 · 无描边色块 · 像素点阵边缘
material      哑光纯色 · 无渐变 · 无高光
constraints   严禁写实材质与纹理 · 严禁抗锯齿与柔边 · 严禁高饱和渐变 ·
              必须正交侧视 · 保持像素级清晰边缘
```

**色板（8 色，生成时请显式给出这几个 hex）**：

```
#3a3f5c  #6b4a3a  #9e9ea6  #1c1c28  #d4a64a  #e0c08a  #4a5a7a  #5a6a8a
```

---

## 第一轮：两张单帧图（先跑通通道）

### ① `station-keeper.png` —— 站务员

```
极简像素风格游戏角色立绘，正面站立，单个角色居中，完整全身。

主体：一位小站站务员。厚呢大衣、戴檐帽、手里提一盏信号灯。姿态安静、正面朝向镜头。

画风要求（必须严格遵守）：
- 扁平纯色色块，边缘为硬边像素阶梯，绝对不要抗锯齿、不要柔边、不要模糊
- 绝对不要渐变、不要高光、不要写实纹理、不要阴影过渡
- 只用下面这 8 个颜色，一个不多：
  #3a3f5c #6b4a3a #9e9ea6 #1c1c28 #d4a64a #e0c08a #4a5a7a #5a6a8a
- 背景：一整片纯色 #1c1c28，不要任何背景元素、不要地面、不要装饰

构图：角色占满画面高度，四周留少量空白。比例偏矮壮（约 3 头身），不要写实人体比例。
```

**存成** `inputs/import-trial/station-keeper.png`

### ② `station-signboard.png` —— 站牌

```
极简像素风格游戏道具，正面朝向镜头，单个物体居中。

主体：一块木制站牌（悬在短横杆下），木牌边缘磨损，牌面留白（不要写字）。

画风要求（同上，一字不改地遵守）：
- 扁平纯色色块，硬边像素阶梯，不要抗锯齿、不要柔边、不要模糊
- 不要渐变、不要高光、不要写实木纹、不要阴影过渡
- 只用这 8 个颜色：#3a3f5c #6b4a3a #9e9ea6 #1c1c28 #d4a64a #e0c08a #4a5a7a #5a6a8a
- 背景：一整片纯色 #1c1c28，不要背景元素

构图：**横向长条**，宽约为高的 4 倍。物体左右留少量空白。
```

**存成** `inputs/import-trial/station-signboard.png`

---

## 第二轮：一张 4 帧行走 sheet（考「帧一致性」）

⚠️ **这轮才是有价值的那个实验** —— 票 23 的**问题 1（帧一致性 / 网格 sheet 能否切）
至今没有答案**。它当年不是被解决了，是被「生成那一半出局」**溶解**掉了
（配额 + 条款）。生图一旦回来，这个问题原样回来。

drawlist 路线靠两个手腕拿到帧一致性：「一个 asset 的全部帧一次调用生成」+
「不属于动作的部分原样复用」。生图模型没有等价手段 —— 请照下面写，
并在拿到图后**自己先看一眼四帧是不是同一个角色**。

```
极简像素风格游戏角色的 4 帧行走动画序列图，横向排列成一排 4 格，每格等宽。

主体：同一位小站站务员（厚呢大衣、檐帽、信号灯），同一角色在 4 个连续行走瞬间。
四格中：头部、大衣、帽子、信号灯必须**逐像素完全一致**，只有腿与手臂的位置不同。
第 1 格迈左腿、第 2 格并拢、第 3 格迈右腿、第 4 格并拢。正面朝向镜头。

画风要求（同上）：
- 扁平纯色色块，硬边像素阶梯，不要抗锯齿、不要柔边、不要模糊
- 不要渐变、不要高光、不要写实纹理
- 只用这 8 个颜色：#3a3f5c #6b4a3a #9e9ea6 #1c1c28 #d4a64a #e0c08a #4a5a7a #5a6a8a
- 背景：一整片纯色 #1c1c28

构图：整图**横向长条**，四格等宽，每格内角色居中、占满该格高度，格与格之间不要分隔线。
```

**存成** `inputs/import-trial/station-keeper-walk.png`，
然后**告诉我这张图的实际像素尺寸**（我按它填 sheet 的网格参数 —— 网格必须精确，
`sliceGrid` 会按 `columns/rows/frameWidth/frameHeight` 硬切）。

---

## 跑起来

图放好之后（至少第一轮的两张）：

```bash
pnpm build                 # 只改了源码才需要
node packages/cli/dist/cli.mjs pack --recipe inputs/import-trial/recipe.json --out out
node packages/cli/dist/cli.mjs inspect out/import-trial/pack/v1
node .scratch/game-creation-v1/experiments/real-generation/preview.mjs out/import-trial/pack/v1
open /tmp/pack-preview.png
```

`preview.mjs` 把包里的帧拼成一张联系表，人眼直接看效果。

**从仓库根跑**（`node_modules` 在根上）。清单里的 `ref` 相对**配方文件**解析 ——
`"ref": "station-keeper.png"` 指的是这个目录里的那张图，与你在哪个目录跑无关。

**不需要 `--offline`**：清单里所有资源都是 `import`，管线**根本不会去碰上游** ——
不探测、不降级、不记传输事实。这一点在 2026-09-25 修好之前不是这样的（见下）。

## 跑起来之后该看到什么

```
资源包：import-trial/pack/v1（v1）
2 个资源 · 1 张图集 · 5 个文件
来源：imported                      ← 纯导入就是 imported
→ import-trial/pack/v1
```

**没有 ⚠️ 降级那一行，也没有「传输切换」那一行** —— 上游一次都没参与。
`outcome` 是 `ok`，`--json` 里的 `transportUsed` 是 `"none"`。

## 2026-09-25：跑这个试件时抓到的三个 bug（已修）

这三条都是**只有真跑一个纯导入的包才会暴露**的 —— 仓库里此前的包要么全是 `generate`，
要么导入资源的 `ref` 恰好写成了 cwd 相对才碰巧能跑。

1. **`source.ref` 相对 cwd 而不是相对配方文件。** `pack.ts` 里是 `path.resolve(src.ref)`，
   而 `recipe.ts` 的 `InputPath` 文档写的是「统一约定：**相对于配方文件**解析」，
   `styleRef` 也**确实**遵守了 —— 同一个文件里两条路径两种规则，`ref` 是错的那一个。
   → 现在 `buildAssetPack` 收一个**必填**的 `recipeDir`，两条路径一条规则。
2. **纯导入的包会记一条完全虚假的降级。** 无论上游死活，`--offline` 分支都会写
   `{stage:"drawlist", reason:"以离线模式构建", fellBackTo:"procedural"}` ——
   而这个包里一个资源都没走生成器。它还让 `outcome` 变成 `degraded`，按它分支的脚本会被骗。
   → 现在清单里没有 `generate` 型资源时，**整条降级链不启动**：不探测（省下两次真实推理请求）、
   不记降级、不记传输，`used` 是 `"none"`。
3. **纯导入的包在结构上无法诚实。** `provenance.mode` 只有 `generated / fixture / mixed`
   三个值，而 `origin` 有三个 —— 全 `imported` 的包既不是 generated 也不是 fixture，
   唯一的合法写法是 `mixed`，可包里根本没有「混」这回事。
   → 契约补了 `"imported"`，派生规则收成**唯一一处**（`derivePackMode`），
   写入侧与校验侧共用。
