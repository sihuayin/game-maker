# 25. 交付格式规格：图集与动画元数据用什么标准？

Type: research
Status: resolved
Blocked by: —
Map: ../map.md

> R3 定了**交付态是位图**，但「位图 + 标准图集/动画元数据」里的**标准是哪个**没定。
> 这是纯事实题：市面上有哪几种图集/动画描述格式、各自长什么样、
> 谁消费它们、Phaser 3 原生读哪种。事实查清之后，选哪个是[票 24](24-asset-pack-contract.md) 的事。

## Question

1. **图集（sprite atlas）描述格式**有哪些事实标准？至少查清：
   - TexturePacker 的 JSON Hash / JSON Array 两种布局的**字段结构**与差异
   - Aseprite 导出的 JSON（含 frame tags / 动画）长什么样
   - Phaser 3 原生加载的是哪种（`this.load.atlas` vs `this.load.multiatlas`，
     各自要求的 JSON 形状），是否接受第三方格式或需要转换器
   - 是否存在一个**引擎中立**的通用格式（还是说「图集元数据」根本没有跨引擎标准，
     每个引擎自己一套）
2. **动画元数据**怎么表达？逐帧时长 / fps / loop / ping-pong / pivot（锚点）——
   这些在 Aseprite JSON 里、在 Phaser 的 `anims.create` 里分别是什么形状？
   **pivot 尤其重要**：R4 的四类资源里，角色动画需要锚点对齐，
   而 drawlist 光栅化出来的图（[票 21](21-drawlist-renderer.md)）**天然没有锚点信息**——
   锚点该在创作态就声明，还是交付时补？
3. **九宫格（nine-patch / 3-slice）**：Phaser 3 有没有原生支持？
   UI 资源（R4）要用它的话，元数据写在图集 JSON 的哪个字段？
4. **像素风特有的坑**：最近邻缩放在图集元数据里怎么表达？
   缩放因子（如 1x/2x/4x）要不要进 manifest？

## 产出要求

调用 `research` skill。**以官方文档与规范为准**（Phaser 3 官方 API 文档、
TexturePacker 文档、Aseprite 导出格式文档），不要凭印象。
产出写到 `.scratch/game-creation-v1/research/delivery-format-spec.md`，
并在本票 `## Answer` 里给出一句话结论 + 指向该文件的链接。

**必须给出可执行的形状**：每种候选格式给一段**真实的最小示例 JSON**
（能直接被 Phaser 读进去的那种），而不是字段名罗列。

## Answer

**一句话结论：「标准图集/动画元数据」没有跨引擎标准；事实上的通用层是
TexturePacker 的 JSON Hash / JSON Array 两种布局（Aseprite 的 `--format json-hash`
/ `json-array` 输出的字段名与它们逐字相同），Phaser 3 原生就能读，不需要转换器。
而锚点（pivot）在 Phaser 里是图集 JSON 的每帧 `anchor` 字段，归一化到未裁剪的
`sourceSize` —— Aseprite 的 `meta.slices[].keys[].pivot` Phaser 一行都不读（实测）。**

完整调研（含 5 段经真实 Phaser parser 跑过的可解析最小 JSON、全部来源 URL、
逐条「查不到」清单）：
**[../research/delivery-format-spec.md](../research/delivery-format-spec.md)**

### 关键事实摘要

**图集格式**

- **无标准**。Phaser 3.80.1 自己内置 **5 种互不兼容**的图集 filetype
  （`atlas` / `multiatlas` / `aseprite` / `atlasXML`(Starling) / `unityAtlas`），
  这本身就是「没有通用标准」的证据。无 W3C/ISO/Khronos 级别的 2D 图集规范（查不到）。
- **JSON Hash vs JSON Array 的唯一差别**：`frames` 是**对象**（key = 帧名）还是**数组**
  （每项多一个 `filename`）。字段名、语义完全相同。TexturePacker 官方原话：
  "They contain the identical data with some different layout."
  Phaser 的 `addAtlas()` 用 `Array.isArray(data.frames)` 自动判别，
  用户不必指定。两者都用 `this.load.atlas` 加载。
- Phaser 的 parser 只读这些帧字段：`frame.{x,y,w,h}` / `rotated` / `trimmed` /
  `sourceSize` / `spriteSourceSize` / **`anchor` 或 `pivot`** / **`scale9Borders`**。
  其余一切（含 `meta`）原样进 `texture.customData`，**不产生任何行为**。
- **TexturePacker 的 "Phaser" 数据格式 = Multi Atlas**（`this.load.multiatlas`），
  只有它支持 pivot 编辑 + multi-pack 单 JSON + normal map。
  形状：`{textures:[{image,format,size,scale,frames:[…]}], meta:{…}}`。
  已用 CodeAndWeb 官方示例仓库里**真实生成**的 `cityscene.json` 核对过字段与取值。
- **Aseprite JSON** 独有 `frames[].duration`（逐帧毫秒）与 `meta.frameTags`。
  两个坑：`meta.scale` 是**字符串** `"1"`（TP 那边是数字）；`rotated` **恒为 false**。

**动画元数据**

- `anims.create({key, frames:[{key, frame, duration}], frameRate, duration, repeat,
  repeatDelay, yoyo, delay, skipMissedFrames, …})`；另有 Phaser 专有的
  `anims.fromJSON` / `this.load.animation` 形状（`{anims:[…], globalTimeScale}`）。
- `anims.createFromAseprite(key)` 把 `frameTags` 映射成动画：
  `from..to` → 帧序列、逐帧 `duration` 之和 → 动画 duration、
  `direction:'reverse'` → 帧数组翻转、`direction:'pingpong'` → `yoyo:true`。
  ⚠️ `direction:'pingpong_reverse'` **不被处理**，退化成普通 forward；
  `repeat` **被忽略**。
- ⚠️ Aseprite 帧名必须由 `--filename-format "{frame}"` 生成成 `"0"/"1"/"2"`，
  否则 `createFromAseprite` **静默产出 0 帧动画**（Phaser 官方导出说明第 5e 步正是这条）。

**★ 锚点（下游在等的那条）**

- **三家都是逐帧的，没有「图集级锚点」。**
- **Aseprite**：`meta.slices[].keys[].pivot = {x,y}`，**整数像素**，需勾 `--list-slices`。
  **Phaser 完全不读**（实测：喂进真实 Aseprite JSON，所有 frame 的
  `customPivot` 全是 `false`，`meta.slices` 只是躺在 `texture.customData` 里没人读）。
- **TexturePacker**：导出器模板里 `pivotPoint`（像素）/ `pivotPointNorm`（归一化）两个值；
  它的 Phaser 格式写的是 **`anchor`（归一化）**。
- **Phaser**：每帧 `anchor` 或 `pivot`（源码是 `src.anchor || src.pivot`）→
  `Frame.customPivot=true`。**必须是归一化 0..1**，因为直接当 origin 用。
- **归一化的分母是 `sourceSize`（未裁剪的原图框），不是裁剪框** —— 从 4 处源码串起来
  推出的（`setSizeToFrame` 用 `frame.realWidth` = `sourceSize.w`；`setTrim` 把
  `frame.x = spriteSourceSize.x` 负责把裁剪块摆回原图框内的位置）。**官方文档没写这条**，
  见「查不到 2/3」。
- **逐帧 pivot 在动画播放期间会被逐帧重新 `setOrigin`**
  （`AnimationState.setCurrentFrame`）→ 「角色各帧各自声明锚点」是原生支持的，
  **不需要任何运行时代码**。这正好满足 R8（demo 只有数据、不写代码）。
- **对「drawlist 光栅化没有锚点」的直接影响**：光栅化结果里**不存在**「哪一点是锚点」
  的信息，锚点必须在创作态或清单里就有源头，最终**必须被写进图集 JSON 的每帧 `anchor`**。
  是否需要「后处理：把锚点注入图集 JSON」这一步，取决于票 24/26/27 怎么建模 ——
  但**这一步无论如何都要有**（Aseprite/TexturePacker 都不会替我们算锚点）。

**九宫格**

- Phaser 3 **原生支持**，元数据就在同一份图集 JSON 的每帧
  **`scale9Borders:{x,y,w,h}`（9 宫格中央区域的矩形）**。
  `this.add.nineslice(x,y,texture,frame,w,h)` 不传边框宽度时**自动读它**。
  **仅 WebGL 渲染器支持**（官方教程明说）。
- Aseprite 侧的对应物是 slice 的 `center` 字段，但**Phaser 同样不读**，必须转成 `scale9Borders`。

**像素风**

- **最近邻缩放不在图集元数据里**。两条路：全局 `render: { pixelArt: true }`
  （= `antialias:false` + `roundPixels:true`），或纹理级
  `textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST)`。
- `scale` 字段两家都有（TP 数字 `1`、Aseprite 字符串 `"1"`），
  但 **Phaser 全部无视**（实测落进 `customData`，无代码读）。
  「1x/2x/4x」要进 manifest 就是**我们自己 manifest 的字段**（票 24），别指望引擎读。

### 查不到的（已明确记录，未用推测填空）

1. **TexturePacker 官方的 JSON 格式规范页已 404**（且不在其 sitemap 里），
   Wayback 在本环境不可达 → Hash/Array 字段结构的结论由
   「官方教程措辞 + Aseprite 写出器字段名 + TP 真实产物 + Phaser parser」四者互证，
   **没有**一条直接来自那份规范文档。
2. Phaser 官方文档**没说明**图集 JSON 里 `anchor`/`pivot` 的单位与参考系（§4.3 是源码推定）。
3. TexturePacker `pivotPointNorm` 归一化的分母是裁剪前还是裁剪后尺寸，**文档没说清**，
   官方示例的取值又都是对称的 `0.5`，**无法判定**（已知硬约束：Phaser 侧必须是 `sourceSize`）。
4. Aseprite `meta.scale` 的官方语义（何时不为 1、非 1 时怎么用）**查不到**。
5. `--tagname-format` 的占位符全集 **查不到**（只知道默认 `{tag}`）。
6. Aseprite `pingpong` 与 Phaser `yoyo` 是否语义等价（端点帧是否重复）**查不到**。
7. TexturePacker `--format` CLI 参数名与导出器 id 的对应表 **查不到**（该文档页未取到）。

### 给下游票的事实输入（推论与事实已分开标注）

- **F1** 无跨引擎标准，最宽交集是 JSON Hash / JSON Array。
- **F2** Phaser 原生读 6 种入口，**不需要转换器**。
- **F3** 锚点 = 图集 JSON 每帧 `anchor`，归一化到 `sourceSize`，动画逐帧重设。
- **F4** Aseprite slice pivot 对 Phaser **无效**（实测）。
- **F5** 九宫格 = 每帧 `scale9Borders`，`add.nineslice()` 零参数自动读，只支持 WebGL。
- **F6** 最近邻**不在**图集元数据里。
- **F7** 逐帧时长只有 Aseprite `frameTags`+`duration` 提供，TP JSON 无动画信息。
- **F8** Aseprite 帧名必须是 `"0"/"1"/"2"`，否则静默空动画。
- **I1（推论）** 要「一条 JSON 同带锚点 + 九宫格 + 多图集」，
  TexturePacker "Phaser"（Multi Atlas）是唯一全覆盖的现成形状 —— 但它**没有动画信息**。
  逐帧时长怎么交付，是票 24/26 的建模决定。
