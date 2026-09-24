# 交付格式规格：图集与动画元数据用什么标准？

- 票：[25. 交付格式规格](../issues/25-delivery-format-spec.md)
- 日期：2026-09-24 · 版本：Phaser 3.80.1 / Aseprite 1.3.x（main）/ TexturePacker 8.3
- 约束：本文只写**一手来源可证**的事实。每条事实后面给来源。查不到的单列在第 7 节。

---

## 0. 一句话结论

**「标准图集/动画元数据」没有跨引擎标准。** 事实上的通用层是
**TexturePacker 的 JSON Hash / JSON Array 两种布局** —— Aseprite 的
`--format json-hash` / `json-array` 输出的**字段名与它们逐字相同**，
而 Phaser 3 原生就能读这两种，不需要任何转换器。

**锚点（pivot）的答案：在 Phaser 里它是图集 JSON 的每帧字段 `pivot` 或 `anchor`
（二选一，归一化到未裁剪的 `sourceSize`），不是 Aseprite 的
`meta.slices[].keys[].pivot` —— 后者 Phaser 一行都不读（我实测跑过它的 parser，
见 §4.4）。所以 drawlist 光栅化出来的图，锚点必须由**生产方**在交付时写进图集 JSON 的
每帧 `anchor`；Phaser 侧零代码即可生效，创作态是否也声明是票 24/27 的选择。**

---

## 1. 方法与来源

全部结论来自**官方文档 + 官方源码 + 官方产出的真实文件**，没有一条来自二手教程：

| 来源 | 用途 |
|---|---|
| Phaser 3.80.1 源码（npm `phaser@3.80.1` 的 `src/`，与 GitHub tag `v3.80.1` 同源） | 图集 parser、动画、锚点、九宫格的**真实行为** |
| Phaser 官方 API 文档 / `types/phaser.d.ts`（v3.80.1） | `anims.create` 与各 config 的**公开签名** |
| Aseprite `src/app/doc_exporter.cpp`（main 分支） | Aseprite JSON 的**写出方**（字段名、类型、是否带引号） |
| Aseprite 官方文档 <https://www.aseprite.org/docs/cli/>、`/docs/slices/` | 导出选项与 slice/pivot 的**语义** |
| TexturePacker 官方教程 <…/tutorials/how-to-create-sprite-sheets-for-phaser3> | Phaser 格式的官方用法 |
| **TexturePacker 生成的真实 JSON**（CodeAndWeb 官方示例仓库 `phaser-sprite-sheet-example`，分支 `phaser-3`） | 字段名与取值的**实证**（不是猜的） |

### 1.1 本文所有 JSON 示例都跑过 Phaser 的真实 parser

不是手写字段名。做法：把 `phaser@3.80.1` 的
`src/textures/parsers/JSONHash.js`、`JSONArray.js` 原样 `require` 进 Node，
用一个 stub texture 对象接住 `texture.add()` / `setTrim()` / `setScale9()`，
喂进下面的每个示例，检查产出的 frame 属性。`createFromAseprite` 同理
（逐行照抄 `src/animations/AnimationManager.js#createFromAseprite` 的函数体）。
验证结果写在每节末尾的「实测」行。

---

## 2. Q1 —— 图集（sprite atlas）描述格式有哪些事实标准？

### 2.1 首先：**没有跨引擎的通用标准**

- 不存在任何标准化组织（W3C / ISO / Khronos）发布的 2D sprite atlas 元数据规范。
  **查不到**（见 §7）。Khronos 的 glTF 是 3D 场景格式，不覆盖 2D 图集。
- 反证在 Phaser 自己的 loader 里：Phaser 3.80.1 内置了 **五种互不兼容**的图集
  filetype，每种对应一个来源生态
  （<https://github.com/phaserjs/phaser/blob/v3.80.1/src/loader/filetypes/index.js>）：

  | filetype | 加载方法 | 形状 |
  |---|---|---|
  | `AtlasJSONFile` | `this.load.atlas` | JSON **Hash** 或 JSON **Array**（TexturePacker 系） |
  | `MultiAtlasFile` | `this.load.multiatlas` | `{textures:[{image,format,size,scale,frames:[…]}]}`（TexturePacker "Phaser" 格式 / multi-pack） |
  | `AsepriteFile` | `this.load.aseprite` | Aseprite 导出的 JSON（hash 或 array 都行） |
  | `AtlasXMLFile` | `this.load.atlasXML` | Starling / Sparrow XML |
  | `UnityAtlasFile` | `this.load.unityAtlas` | Unity 的 `.txt` 文本格式 |

  一个引擎要背五种格式，这本身就是「没有通用标准」的最直接证据。

- 「引擎中立」在实践中的含义是**「至少一个第三方工具能写、至少一个引擎能读」**，
  不是「有规范」。满足这个的最宽交集就是下面这两种布局。

### 2.2 JSON Hash vs JSON Array —— 唯一的差别是 `frames` 是对象还是数组

**这是两种布局唯一的区别，字段名与语义完全相同。**
TexturePacker 的官方说法（Phaser 2 教程，措辞直接）：
> "Which of the two Phaser exporters you choose does not really matter.
> They contain the identical data with some different layout."
> —— <https://www.codeandweb.com/texturepacker/tutorials/how-to-create-sprite-sheets-for-phaser2>

（该页里两个导出器就叫 **`Phaser (JSONHash)`** 与 **`Phaser (JSONArray)`**，
这是官方命名。）

Aseprite 侧同一件事由 CLI 选项 `--format json-hash` / `--format json-array` 表达
（<https://www.aseprite.org/docs/cli/>）。

Phaser 侧怎么分流（源码
<https://github.com/phaserjs/phaser/blob/v3.80.1/src/textures/TextureManager.js>，
`addAtlas`）：

```js
//  New Texture Packer format?
if (Array.isArray(data.textures) || Array.isArray(data.frames)) {
    return this.addAtlasJSONArray(key, source, data, dataSource);
} else {
    return this.addAtlasJSONHash(key, source, data, dataSource);
}
```

即：**`frames` 是数组 → Array；`frames` 是对象 → Hash。** 顶层出现 `textures`
数组（多图集）也走 Array 分支。用户**不需要**指定是哪种，Phaser 自动判。

#### 最小 JSON Hash 示例（`this.load.atlas('hero', 'hero.png', 'hero.json')`）

```json
{
  "frames": {
    "hero_idle_0.png": {
      "frame": { "x": 0, "y": 0, "w": 32, "h": 48 },
      "rotated": false,
      "trimmed": true,
      "spriteSourceSize": { "x": 4, "y": 2, "w": 24, "h": 44 },
      "sourceSize": { "w": 32, "h": 48 },
      "pivot": { "x": 0.5, "y": 0.5 }
    },
    "hero_idle_1.png": {
      "frame": { "x": 32, "y": 0, "w": 32, "h": 48 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 48 },
      "sourceSize": { "w": 32, "h": 48 },
      "anchor": { "x": 0.5, "y": 1.0 }
    }
  },
  "meta": {
    "app": "https://www.codeandweb.com/texturepacker",
    "version": "3.0",
    "image": "hero.png",
    "format": "RGBA8888",
    "size": { "w": 64, "h": 48 },
    "scale": "1"
  }
}
```

#### 最小 JSON Array 示例（同样用 `this.load.atlas` 加载）

```json
{
  "frames": [
    {
      "filename": "hero_idle_0.png",
      "frame": { "x": 0, "y": 0, "w": 32, "h": 48 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 48 },
      "sourceSize": { "w": 32, "h": 48 },
      "pivot": { "x": 0.5, "y": 0.5 }
    },
    {
      "filename": "hero_idle_1.png",
      "frame": { "x": 32, "y": 0, "w": 32, "h": 48 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 48 },
      "sourceSize": { "w": 32, "h": 48 },
      "anchor": { "x": 0.5, "y": 1.0 }
    }
  ],
  "meta": { "app": "…", "version": "3.0", "image": "hero.png", "format": "RGBA8888",
            "size": { "w": 64, "h": 48 }, "scale": "1" }
}
```

#### Phaser 到底读哪些字段（这是唯一权威的清单）

源码 <https://github.com/phaserjs/phaser/blob/v3.80.1/src/textures/parsers/JSONHash.js>
与 `…/JSONArray.js`（两个文件除「对象 key」vs「`filename`」外**逐行相同**）：

| 字段 | Phaser 拿它干什么 |
|---|---|
| `frames` | Hash：对象，key = 帧名。Array：数组，每项用 `filename` 当帧名。**缺了直接 `console.warn` 并放弃整个文件** |
| `frame.{x,y,w,h}` | 从图集里切图的确切矩形 |
| `trimmed`（bool） | 为 `true` 才读下面两行；否则不调 `setTrim` |
| `sourceSize.{w,h}` | 未裁剪的原图尺寸 → `Frame.realWidth/realHeight` |
| `spriteSourceSize.{x,y,w,h}` | 裁剪框在原图里的偏移与大小 → `Frame.x/y` |
| `rotated`（bool） | 为 `true` 时 `Frame.rotated = true` 且 `updateUVsInverted()` |
| **`anchor` 或 `pivot`**（`src.anchor \|\| src.pivot`） | → `Frame.customPivot = true`，`pivotX/pivotY`（见 §4.4） |
| **`scale9Borders.{x,y,w,h}`** | → `Frame.setScale9(...)`（见 §5） |
| 其余所有顶层字段 | 原样拷进 `texture.customData`（含 `meta`），**不产生任何行为** |

#### 实测（用上面的示例跑真实 parser）

```
JSON Hash  → hero_idle_0.png: trimmed=true  customPivot=true pivot=(0.5,0.5) sourceSize={"w":32,"h":48}
             hero_idle_1.png: trimmed=false customPivot=true pivot=(0.5,1)
JSON Array → 同上（anchor 与 pivot 等效）
             texture.customData.meta = {"app":…,"scale":"1"}
```

### 2.3 TexturePacker 的 "Phaser" 格式 = Multi Atlas（推荐用这个）

官方教程明确说：选 **Phaser** 这一个格式，**只有它**支持 pivot 编辑、
multi-pack 单 JSON、normal map 打包；加载方式是 `this.load.multiatlas`：
> "Be careful to select the Phaser format, only this one supports pivot point editing,
> multi-pack with one single json file and normal map packing."
> —— <https://www.codeandweb.com/texturepacker/tutorials/how-to-create-sprite-sheets-for-phaser3>

MultiAtlas 的形状由 `MultiAtlasFile` 强制，源码
<https://github.com/phaserjs/phaser/blob/v3.80.1/src/loader/filetypes/MultiAtlasFile.js>：
它要 `file.data.textures` 存在，逐个 `textures[i].image` 当图片 URL 下载，
可选 `textures[i].normalMap`，最后调 `textureManager.addAtlasJSONArray(key, images, data, normalMaps)`。

#### 最小 Multi Atlas 示例（`this.load.multiatlas('hero', 'hero.json', 'assets/sprites/')`）

```json
{
  "textures": [
    {
      "image": "hero.png",
      "format": "RGBA8888",
      "size": { "w": 128, "h": 64 },
      "scale": 1,
      "frames": [
        {
          "filename": "hero_idle_0.png",
          "rotated": false,
          "trimmed": false,
          "sourceSize": { "w": 32, "h": 48 },
          "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 48 },
          "frame": { "x": 0, "y": 0, "w": 32, "h": 48 },
          "anchor": { "x": 0.5, "y": 1.0 }
        },
        {
          "filename": "ui_panel.png",
          "rotated": false,
          "trimmed": false,
          "sourceSize": { "w": 48, "h": 32 },
          "spriteSourceSize": { "x": 0, "y": 0, "w": 48, "h": 32 },
          "frame": { "x": 32, "y": 0, "w": 48, "h": 32 },
          "anchor": { "x": 0.5, "y": 0.5 },
          "scale9Borders": { "x": 12, "y": 8, "w": 24, "h": 16 }
        }
      ]
    }
  ],
  "meta": {
    "app": "https://www.codeandweb.com/texturepacker",
    "version": "3.0",
    "image": "hero.png",
    "format": "RGBA8888",
    "size": { "w": 128, "h": 64 },
    "scale": "1"
  }
}
```

#### 上面这段不是我编的 —— 这是 TexturePacker 真实产出的形状

CodeAndWeb 官方示例仓库里由 TexturePacker 8.3 真实生成的
`cityscene.json`（<https://github.com/CodeAndWeb/phaser-sprite-sheet-example/blob/phaser-3/public/assets/spritesheets/cityscene.json>）
逐字摘录：

```json
{
  "textures": [ { "image": "cityscene.png", "format": "RGBA8888",
                  "size": { "w": 943, "h": 959 }, "scale": 1, "frames": [ … ] } ],
  "meta": { "app": "https://www.codeandweb.com/texturepacker", "version": "3.0",
            "smartupdate": "$TexturePacker:SmartUpdate:…$" }
}
```
其中一个**带 9-patch 的帧**（证明 `scale9Borders` 的位置）：
```json
{ "filename": "button.png", "rotated": false, "trimmed": false,
  "sourceSize": { "w": 100, "h": 50 },
  "spriteSourceSize": { "x": 0, "y": 0, "w": 100, "h": 50 },
  "frame": { "x": 626, "y": 908, "w": 100, "h": 50 },
  "anchor": { "x": 0.5, "y": 0.5 },
  "scale9Borders": { "x": 16, "y": 14, "w": 69, "h": 22 } }
```
一个**被裁剪的帧**（证明 `anchor` 与 `trimmed` 共存）：
```json
{ "filename": "capguy/walk/0005.png", "rotated": false, "trimmed": true,
  "sourceSize": { "w": 187, "h": 324 },
  "spriteSourceSize": { "x": 33, "y": 3, "w": 139, "h": 311 },
  "frame": { "x": 803, "y": 1, "w": 139, "h": 311 },
  "anchor": { "x": 0.5, "y": 0.5 } }
```
注意三点：`anchor` 是**归一化**的（0..1，`background.png` 的左上角是 `{"x":0,"y":0}`）；
`meta` 里**只有** `app`/`version`/`smartupdate`，**没有** image/size/format —— 那些在
`textures[i]` 里；`scale` 是**数字** `1`（Aseprite 那边是字符串 `"1"`，见 §2.4）。

#### 实测

```
Multi Atlas → hero_idle_0.png: customPivot=true pivot=(0.5,1)
              ui_panel.png:    customPivot=true pivot=(0.5,0.5) scale9=true borders={"x":12,"y":8,"w":24,"h":16}
              texture.customData keys = [ 'image', 'format', 'size', 'scale' ]
```
**`scale` 落了 `texture.customData`，Phaser 拿它不做任何事** —— 见 §6。

### 2.4 Aseprite 的 JSON 长什么样

写出方是 Aseprite 自己的 `src/app/doc_exporter.cpp#createDataFile`
（<https://github.com/aseprite/aseprite/blob/main/src/app/doc_exporter.cpp>）。
以下字段名与顺序是**逐字照抄写出语句**得到的，不是照着样例猜的：

```
frames_begin: Hash → "{"   （key = 帧的 filename，escaped）
              Array → "["  （多一个 "filename" 字段）
每帧固定写出：
  frame:                 { x, y, w, h }        // 加 nonExtrudedPosition/nonExtrudedSize 修正
  rotated:               false                  // ← 硬编码 false，Aseprite 从不旋转
  trimmed:               <bool>
  spriteSourceSize:      { x, y, w, h }
  sourceSize:            { w, h }
  duration:              <int, 毫秒>            // ← Aseprite 独有，TexturePacker 没有
meta 固定写出：
  app, version
  image                  （有 textureFilename 时）
  format:                "RGBA8888" | "I8"
  size:                  { w, h }
  scale:                 "1"                    // ← 是带引号的字符串
meta 可选（对应 CLI 开关 / 导出对话框勾选项）：
  frameTags: [ { name, from, to, direction, [repeat] } ]   // 需 --list-tags / "Tags" 勾选
  layers:    [ { name, [group], opacity, blendMode, [cels] } ]  // 需 --list-layers
  slices:    [ { name, [color], keys: [ { frame, bounds, [center], [pivot] } ] } ]  // 需 --list-slices
```

#### 最小 Aseprite JSON（Hash；`aseprite -b hero.ase --sheet hero.png --data hero.json --format json-hash --list-tags --list-slices`）

```json
{
  "frames": {
    "0": {
      "frame": { "x": 0, "y": 0, "w": 32, "h": 48 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 48 },
      "sourceSize": { "w": 32, "h": 48 },
      "duration": 120
    },
    "1": {
      "frame": { "x": 32, "y": 0, "w": 32, "h": 48 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 48 },
      "sourceSize": { "w": 32, "h": 48 },
      "duration": 120
    },
    "2": {
      "frame": { "x": 64, "y": 0, "w": 32, "h": 48 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 48 },
      "sourceSize": { "w": 32, "h": 48 },
      "duration": 80
    }
  },
  "meta": {
    "app": "https://www.aseprite.org/",
    "version": "1.3.7",
    "image": "hero.png",
    "format": "RGBA8888",
    "size": { "w": 96, "h": 48 },
    "scale": "1",
    "frameTags": [
      { "name": "idle", "from": 0, "to": 1, "direction": "forward" },
      { "name": "hurt", "from": 2, "to": 2, "direction": "pingpong" }
    ],
    "layers": [ { "name": "Layer 1", "opacity": 255, "blendMode": "normal" } ],
    "slices": [
      { "name": "hero",
        "color": "#0000ffff",
        "keys": [
          { "frame": 0,
            "bounds": { "x": 0, "y": 0, "w": 32, "h": 48 },
            "center": { "x": 8, "y": 8, "w": 16, "h": 32 },
            "pivot": { "x": 16, "y": 48 } }
        ] }
    ]
  }
}
```

#### 三个容易踩的细节（都来自写出方源码）

1. **帧 key 就是 `filename`**，而 `filename` 由导出对话框的 "Item Filename" /
   CLI `--filename-format` 决定。Phaser 的 Aseprite 教程因此专门要求把它设成只有
   `{frame}`（<https://github.com/phaserjs/phaser/blob/v3.80.1/src/loader/filetypes/AsepriteFile.js>
   的 doc 注释第 5e 步："In the 'Item Filename' input box, make sure it says just `{frame}`"）。
   **不设成 `{frame}`，帧名就不是 `"0"/"1"/"2"`，`createFromAseprite` 会静默产出空动画**（见 §4.3）。
2. **`meta.scale` 是字符串 `"1"`**（写出语句是 `<< "  \"scale\": \"1\""`），
   而 TexturePacker 的 `textures[i].scale` 是数字 `1`。写解析器时别假设类型一致。
3. **`rotated` 恒为 `false`** —— Aseprite 的 JSON 写出器硬编码，永远不会是 `true`。

#### Phaser 的加载方式

`this.load.aseprite('hero', 'hero.png', 'hero.json')`，然后
`this.anims.createFromAseprite('hero')` 按 tag 名建动画
（官方文档 <https://docs.phaser.io/api-documentation/class/loader-filetypes-asepritefile>）。
Hash 与 Array **两种都能加载**，因为 `createFromAseprite` 用 `frames["0"]` 取值，
而 JS 数组的字符串下标访问等价于索引访问（实测两种都建出了正确的动画）。

#### 实测

```
Aseprite Hash → addAtlas() 走 addAtlasJSONHash；帧名 "0"/"1"/"2"
                customPivot 全部为 false  ← 关键，见 §4.4
                texture.customData.meta.slices = [ …原样躺在这里，没人读… ]
createFromAseprite → idle: 2 帧, duration=240ms, yoyo=false
                     hurt: 1 帧, duration=80ms,  yoyo=true
```

---

## 3. Q2 —— 动画元数据怎么表达

**结论：图集 JSON 里唯一被 Phaser 认的动画信息，只有 Aseprite 的 `meta.frameTags`
（且要显式调 `createFromAseprite`）。TexturePacker 的 JSON 不含任何动画信息。
Phaser 自己的动画 JSON 是另一条独立通道。**

### 3.1 Aseprite 的 `meta.frameTags`（以及它是怎么变成 Phaser 动画的）

字段（源码见 §2.4）：`name` / `from` / `to` / `direction` / 可选 `repeat`。
`direction` 的取值是**四个**固定字符串（<https://github.com/aseprite/aseprite/blob/main/src/doc/anidir.cpp>）：

```
forward | reverse | pingpong | pingpong_reverse
```

`repeat` 只在 `> 0` 时写出，而且是**带引号的字符串**：
`<< ", \"repeat\": \"" << tag->repeat() << "\""`。

`AnimationManager#createFromAseprite` 的映射（源码逐行核过，
<https://github.com/phaserjs/phaser/blob/v3.80.1/src/animations/AnimationManager.js>）：

| Aseprite | 变成什么 |
|---|---|
| `tag.name` | 动画的 `key`（Phaser 侧用这个名字 `play()`） |
| `tag.from`..`tag.to` 的每一帧 | `{ key: <图集key>, frame: "<序号字符串>", duration: <该帧的 duration> }` |
| 所有帧 `duration` 之和 | 动画的 `duration` |
| `direction === 'reverse'` | 把帧数组 `reverse()` |
| `direction === 'pingpong'` | `yoyo: true` |
| `repeat` | **不读**（被忽略） |
| `direction === 'pingpong_reverse'` | ⚠️ **不处理** —— 落进默认分支，既不 reverse 也不 yoyo，退化成普通 forward 播放 |
| 帧没写 `duration` | 用 `Number.MAX_SAFE_INTEGER` 兜底（即「几乎永远停在这帧」） |

### 3.2 Phaser 自己的动画 JSON（`this.load.animation(key, url)` / `anims.fromJSON()`）

这是**引擎专有**的形状，`toJSON()` 的产物，不是任何跨引擎标准。
类型定义：`Phaser.Types.Animations.JSONAnimations` / `JSONAnimation` / `JSONAnimationFrame`
（`types/phaser.d.ts` v3.80.1）。

```json
{
  "anims": [
    {
      "key": "idle",
      "type": "frame",
      "frames": [
        { "key": "hero", "frame": "hero_idle_0.png", "duration": 120, "keyframe": true },
        { "key": "hero", "frame": "hero_idle_1.png", "duration": 120, "keyframe": true }
      ],
      "frameRate": 8,
      "duration": 0,
      "skipMissedFrames": true,
      "delay": 0,
      "repeat": -1,
      "repeatDelay": 0,
      "yoyo": false,
      "showBeforeDelay": false,
      "showOnStart": false,
      "randomFrame": false,
      "hideOnComplete": false
    }
  ],
  "globalTimeScale": 1
}
```
（`keyframe` 字段由 `AnimationFrame#toJSON` 写出；loader 是
`this.load.animation('anims', 'anims.json')`，注册名 `'animation'`，
源码 `src/loader/filetypes/AnimationJSONFile.js`。）

### 3.3 `anims.create` 的行内形状（`Phaser.Types.Animations.Animation`）

```js
this.anims.create({
  key: 'idle',
  frames: [ { key: 'hero', frame: 'hero_idle_0.png', duration: 120 },
            { key: 'hero', frame: 'hero_idle_1.png', duration: 120 } ],
  frameRate: 8,        // 只有 duration 为 null 时才用它（默认 24）
  duration: 0,         // 给了它就以它为准（0 = 由 frameRate 推导）
  repeat: -1,          // -1 = 无限
  repeatDelay: 0,
  yoyo: false,
  delay: 0,
  skipMissedFrames: true,
  showBeforeDelay: false, showOnStart: false, hideOnComplete: false
});
```

**逐帧时长 vs fps 的关系（Phaser 侧）**：`AnimationFrame.duration` 是**增量**
（"Additional time (in ms) that this frame should appear for during playback"），
即第 i 帧实际停留 = `1000/frameRate + frames[i].duration`。
所以想表达「每帧独立时长」，标准做法是 Aseprite 那条路（`createFromAseprite`
给每帧喂 `duration` 并同时把 `duration` 加成动画总时长）。逐帧 `duration` 是
Aseprite JSON 有、TexturePacker JSON 没有的能力。

### 3.4 三种「动画元数据」载体的取舍（事实层面）

| 载体 | 表达力 | Phaser 是否需要写代码 |
|---|---|---|
| 图集 JSON 的 `anchor` | 锚点，**逐帧** | 否，自动生效（§4.4） |
| Aseprite `meta.frameTags` | 逐帧时长 + 分组 + 方向 | 需要一行 `createFromAseprite` |
| Phaser 专有 anims JSON | 最全（delay/repeatDelay/yoyo/skipMissedFrames…） | 需要 `this.load.animation` |

> **注意**：Aseprite 的 tag 与 TexturePacker 的「自动动画检测」都要求
> **帧在时间轴上是连续的一段**。R4 的四类资源里 sprite（单帧）没有动画，
> animation（多帧）才有 —— 这条对票 26 的形状有直接影响，但怎么建模是票 26 的事。

---

## 4. Q2 重点 —— pivot / 锚点到底放在哪？（下游在等这条）

### 4.1 三家各自把锚点放在哪

| 谁 | 放在哪 | 坐标系 | 谁读它 |
|---|---|---|---|
| **Aseprite** | `meta.slices[].keys[].pivot = {x, y}`，**只有勾了 `--list-slices` / "Slices" 才写出** | **整数像素**，sprite 画布坐标（`slice_window.cpp` 用 `%d` 显示，与 `bounds` 并列）；`NoPivot` 哨兵值 = `INT32_MIN` | **Phaser 不读**（见 §4.4 实测） |
| **TexturePacker** | 导出器模板里有两个可用值：`pivotPoint`（"x and y coordinates of the Pivot Point"，像素）与 `pivotPointNorm`（"relative to the sprite size"）；它的 **Phaser 格式写的是 `anchor`，归一化值** | Phaser 格式：`0..1` | **Phaser 读**（frame 级 `anchor`） |
| **Phaser** | 图集 JSON 的**每帧** `anchor` 或 `pivot`（源码是 `var pivot = src.anchor \|\| src.pivot;`） | **必须归一化到 `0..1`** | Phaser 自己 |

TexturePacker 侧的字段定义来自官方 custom exporter 文档的「Values and data types」表
（<https://www.codeandweb.com/texturepacker/documentation/custom-exporter>）：
`pivotPoint POINT` / `pivotPointNorm POINT` / `scale9Enabled BOOL` / `scale9Borders RECT` /
`scale9Paddings RECT` / `trimmed BOOL` / `rotated BOOL` / `cornerOffset POINT` /
`untrimmedSize SIZE` / `frameRect RECT` / `sourceRect RECT` / `scale FLOAT`。
该文档同时列出 `<supportsPivotPoint>`（默认 false）与 `<supportsScale9>` 两个导出器能力开关。

**没有「图集级锚点」这种东西。** 三家都是逐帧的。这是设计上的必然：裁剪之后各帧的
对齐基准不同，只有逐帧才能对齐。

### 4.2 Phaser 里 `anchor`/`pivot` 的完整生命周期（源码追踪）

```
图集 JSON 每帧的 anchor|pivot
   └─ Parser.JSONHash / JSONArray
        newFrame.customPivot = true; newFrame.pivotX = pivot.x; newFrame.pivotY = pivot.y;
             │
             ├─ Texture.setFrame()             → setOrigin(pivotX, pivotY)      // 换图时
             │    src/gameobjects/components/Texture.js:128
             │
             ├─ AnimationState.setCurrentFrame() → setOrigin(pivotX, pivotY)    // ★ 每一帧动画都重设
             │    src/animations/AnimationState.js:1600
             │
             ├─ MultiPipeline.batchSprite()     → flipX/flipY 时不走「按 realWidth 补偿」分支
             │    src/renderer/webgl/pipelines/MultiPipeline.js:356,366
             │
             └─ CanvasRenderer                  → 同上（Canvas 渲染器同样支持）
```

第 2 条是关键：**逐帧 pivot 在动画播放期间会被逐帧重新 `setOrigin`**。
所以「同一个角色的每一帧各自声明自己的锚点」是被原生支持的，不需要任何运行时补丁。

### 4.3 ★ Phaser 的 origin 是相对**未裁剪的原图框**（`sourceSize`），不是裁剪框

这条决定「锚点该写什么值」，我把它从源码推到了底：

- `setSizeToFrame`（`src/gameobjects/components/Size.js`）：
  `this.width = frame.realWidth`，而 `realWidth` 的 getter 返回 **`this.data.sourceSize.w`**
  （`src/textures/Frame.js`，注释原文："The width of the Frame in its un-trimmed,
  un-padded state, as prepared in the art package, before being packed."）。
- `updateDisplayOrigin`（`src/gameobjects/components/Origin.js`）：
  `_displayOriginX = originX * this.width`。
- 渲染时（`MultiPipeline.batchSprite`）：`x = -displayOriginX + frameX`，
  其中 `frameX = frame.x`，而对被裁剪的帧 `Frame#setTrim` 把
  **`this.x = destX`（即 `spriteSourceSize.x`）**；未被裁剪的帧 `frame.x` 保持 `0`。
- 所以被裁剪的那块内容，被**摆在原图框内的正确偏移上**。

**结论：`anchor` 的分母是 `sourceSize`（未裁剪原图尺寸），
`spriteSourceSize` 负责把裁剪块摆回原图框内的位置。** 这正好是裁剪动画不抖动的原因，
也意味着生产方只要按「锚点在原图框里的归一化位置」算就对了。

### 4.4 ★ Aseprite 的 slice pivot 对 Phaser **完全无效**（实测确认）

- `AsepriteFile.addToCache` → `textureManager.addAtlas(image.key, image.data, json.data, normalMap)`
  → 因为 Aseprite 顶层 `frames` 是对象（hash）或数组（array），走 `addAtlasJSONHash` /
  `addAtlasJSONArray` → 都是 §2.2 那两个共享 parser。
- 那两个 parser **只读帧上的 `anchor` / `pivot`**，Aseprite 的每帧对象里根本没有这两个字段
  —— Aseprite 的 pivot 挂在 `meta.slices[].keys[].pivot`，层级完全不同。
- 实测结果：喂进真实的 Aseprite JSON 后，**所有 frame 的 `customPivot` 全是 `false`**，
  `meta.slices` 只是被原样拷进 `texture.customData.meta.slices`，**没有任何代码读它**。

**所以：不能靠 Aseprite 的 slice pivot 给 Phaser 传锚点。** 要么
（a）生产方在图集 JSON 的**每帧**写 `anchor`；要么（b）运行时对每个 texture
调 `textures.get(k).get(f).setPivot(...)` 之类的补丁 —— 但这要写游戏代码，
与 R8「demo = 固定 runtime + 数据，AI 一笔代码都不写」冲突。

### 4.5 Phaser 的锚点必须是归一化值（0..1）—— 像素 pivot 会炸

源码 `var pivot = src.anchor || src.pivot; newFrame.pivotX = pivot.x;`，
之后直接当 `originX` 用（`setOrigin(pivotX, pivotY)`），而 origin 的语义是
`0..1`（`Origin.js` 的 `setOrigin` 文档原文："The values are given in the range 0 to 1."）。

**推论（不是文档明说的，是从源码读出来的）**：如果图集 JSON 里给的是 TexturePacker
通用导出器的**像素** `pivot`（例如 `{x:16, y:48}`），Phaser 会把它当成
`origin = (16, 48)`，精灵会被挪到画面外。**要用像素 pivot 必须先除以 `sourceSize`。**

> 这条我标成「源码推定」而非「文档事实」：Phaser 官方文档没有解释
> `pivot`/`anchor` 的单位，只把它当 origin。已在 §7 记一笔。

### 4.6 对「drawlist 光栅化出来的图没有锚点」这条的直接影响

事实层面可说清的只有这些：

1. **锚点只能落在图集 JSON 的每帧 `anchor` 上**，因为那是 Phaser 唯一会读的位置（§4.2/§4.4）。
2. **它的值是「锚点在未裁剪原图框里的归一化坐标」**（§4.3）。
3. **它可以逐帧不同**（§4.2），所以「角色动画各帧对齐」有原生解。
4. 创作态（drawlist）是否也声明锚点、以及交付时怎么从「创作态的声明 + 光栅化的
   裁剪结果」算出 `anchor`，是**票 24 / 27 的建模问题**，不是事实问题 —— 本文只给约束：
   - 若创作态就声明锚点，则它必须能映射到 `sourceSize` 坐标系（即锚点得定义在
     **未裁剪的资产画布**上，而不是某个具体绘制 op 的包围盒上）；
   - 若交付时才补，则必须有外部输入（例如按 AssetSpec 的 kind 给默认锚点：
     `ui` 用左上/中心、`animation` 用脚底中心），**且这个默认值规则无法从光栅化结果推出**
     —— 光栅化后的像素里不存在「哪一点是锚点」的信息。

---

## 5. Q3 —— 九宫格（nine-patch / 3-slice）

**Phaser 3 有原生支持，且元数据就写在同一份图集 JSON 的每帧 `scale9Borders` 字段里
（格式由 TexturePacker 提供）。**

- **元数据字段**：帧上的 `scale9Borders: { x, y, w, h }`，
  语义是 **9 宫格中央区域的矩形**（不是四条边的宽度）。
  parser 源码：`newFrame.setScale9(src.scale9Borders.x, src.scale9Borders.y, src.scale9Borders.w, src.scale9Borders.h)`
  （`src/textures/parsers/JSONHash.js`、`JSONArray.js`）。
  `Frame#setScale9(x, y, width, height)` 的文档原文：
  "Sets the scale9 center rectangle values… Scale9 is a feature of Texture Packer,
  allowing you to define a nine-slice scaling grid."（`src/textures/Frame.js`）
- **实际取值**：见 §2.3 里 TexturePacker 真实产出的 `button.png` →
  `"scale9Borders": { "x": 16, "y": 14, "w": 69, "h": 22 }`（帧大小 100×50）。
- **消费方**：`this.add.nineslice(x, y, texture, frame, width, height)`，
  可选 `leftWidth, rightWidth, topHeight, bottomHeight`。
  不传边框宽度时，`NineSlice.setSlices` 会**自动从 JSON 的 scale9 数据反推**
  （`src/gameobjects/nineslice/NineSlice.js`）：
  ```js
  if (frame.scale9 && !skipScale9) {
      var data = frame.data.scale9Borders;
      leftWidth   = data.x;
      rightWidth  = frame.width - data.w - data.x;
      topHeight   = data.y;
      bottomHeight= frame.height - data.h - data.y;
  }
  ```
- **3-slice vs 9-slice**：`topHeight`/`bottomHeight` 都为 0 → `is3Slice = true`；
  若帧带了 scale9 数据，`is3Slice` 由 `textureFrame.is3Slice` 覆盖。
  **不能把 9-slice 改成 3-slice 或反之**（改会 `console.warn('Cannot change 9 slice to 3 slice')`）。
- **官方教程确认这条链**："There are some more parameters that you can use to specify
  the borders manually but these are not required if you use TexturePacker to define
  the NineSlice Object." —— <https://www.codeandweb.com/texturepacker/tutorials/how-to-create-sprite-sheets-for-phaser3>
- ⚠️ **渲染器限制**：该教程同时写明 "Phaser supports 9-slice game objects in the
  **WebGL renderer only**."（Canvas 渲染器不支持；Phaser 3.80 里 NineSlice 也只在
  `src/renderer/webgl/pipelines/` 有批处理路径。）
- **Aseprite 侧的对应物**是 slice 的 `center` 字段
  （`meta.slices[].keys[].center = {x,y,w,h}`，官方文档
  <https://www.aseprite.org/docs/slices/> 原文："a 9-slices property to specify an
  internal rectangle to sub-divide the bounds into sub-slices"），
  **但 Phaser 同样不读 Aseprite 的 slices** —— 要在 Phaser 里用，必须转成
  `scale9Borders`。

---

## 6. Q4 —— 像素风的坑：最近邻缩放在元数据里怎么表达？

**短答：在图集元数据里根本不表达。Phaser 的最近邻是渲染器/纹理级设置，
不是图集 JSON 的字段。**

- **全局**：`new Phaser.Game({ render: { pixelArt: true } })`。
  源码 `src/core/Config.js`：
  ```js
  this.pixelArt = GetValue(renderConfig, 'pixelArt', this.zoom !== 1, config);
  if (this.pixelArt) { this.antialias = false; this.antialiasGL = false; this.roundPixels = true; }
  ```
  类型定义注释（`src/core/typedefs/RenderConfig.js`）：
  "Sets `antialias` to false and `roundPixels` to true. This is the best setting
  for pixel-art games."
- **纹理级**：`this.textures.get('hero').setFilter(Phaser.Textures.FilterMode.NEAREST)`
  （`FilterMode.LINEAR = 0` / `NEAREST = 1`，`src/textures/const.js`）。
  `TextureSource` 的构造函数里，`game.config.antialias` 为假时会自动
  `this.setFilter(1)`（即 NEAREST）—— 这就是 `pixelArt: true` 的生效路径。
- **图集 JSON 里没有对应字段**。Phaser 的 parser 不读任何 filter 相关字段；
  所有它不认识的顶层字段（包括 `meta`）一律进 `texture.customData`，不产生行为。

### 缩放因子（1x/2x/4x）要不要进 manifest？

- **两家的 JSON 都带 `scale`，但含义与类型不一致，而且 Phaser 都不用于渲染**：
  - TexturePacker "Phaser" 格式：`textures[i].scale`，**数字** `1`
    （实测真实产物 `"scale": 1`）。
  - Aseprite：`meta.scale`，**字符串** `"1"`（写出语句 `<< "  \"scale\": \"1\""`）。
  - 实测：Multi Atlas 加载后 `texture.customData.scale === 1`，
    **没有任何代码读它**。
- TexturePacker 的 custom exporter 文档另有一个**逐精灵**的 `scale FLOAT`：
  "The sprite's scaling factor as set in Sprite settings. Does not take
  global/variant scale in account." —— 也就是「多分辨率变体」这条路
  （TexturePacker 的 scaling variants / autoSDFiles）。
- **事实小结**：`scale` 在元数据里只是个**声明性备注**，不驱动 Phaser 的渲染。
  如果我们的资源包要表达「这份位图是 1x 还是 4x」，那是**我们自己 manifest 的字段**
  （票 24 的领域），借 TexturePacker/Aseprite 的 `scale` 字段名可以，但别指望引擎会读。
- **最近邻本身**：整包一个全局约定（Phaser 侧 `pixelArt: true`）就够，
  逐资源的差异用不上 —— 除非将来混入非像素资源，那时用纹理级 `setFilter`。

---

## 7. 明确「查不到」的清单

以下几条我**没有找到一手来源**，不用推测填充：

1. **TexturePacker 官方的 JSON 格式规范页已经不存在**。
   `https://www.codeandweb.com/texturepacker/documentation/texturepacker-json-format`
   返回 **404**，且 https://www.codeandweb.com/sitemap-0.xml 里已无此页。
   Wayback Machine 在本环境不可达（连接被重置），无法取历史版本。
   → 因此本文关于 **JSON Hash / JSON Array 字段结构**的结论，来自
   **（a）TexturePacker 官方教程的措辞与命名**、
   **（b）Aseprite 写出器的字段名**、
   **（c）TexturePacker 真实产出的 JSON 文件**、
   **（d）Phaser 官方 parser 的读取路径**，四者互证。**没有**一条直接来自
   TexturePacker 那份规范文档本身。

2. **Phaser 官方文档没有说明图集 JSON 里 `anchor` / `pivot` 的单位与参考系**。
   `types/phaser.d.ts` 里 `Frame#pivotX` 只有一句 "The horizontal pivot point of
   this Frame."，`Frame#customPivot` 只有 "Does this Frame have a custom pivot point?"。
   §4.3 的「相对 `sourceSize`」结论是我**从 4 处源码串起来推的**，不是文档明说的。

3. **TexturePacker 的 `pivotPointNorm` 归一化的分母没说清**是裁剪后尺寸还是未裁剪尺寸。
   官方 custom exporter 文档只写 "Pivot point coordinates, relative to the sprite size"。
   官方示例产物里所有被裁剪的帧的 `anchor` 都是 `0.5/0.5`（对称，无法区分），
   **所以无法从现有材料判定**。已知的硬约束只有一条（§4.3）：**Phaser 要求分母是
   `sourceSize`**。任何生成器都应按 `sourceSize` 归一化。

4. **`meta.scale` 的官方语义**（Aseprite 恒写 `"1"`；什么情况下会不是 1、非 1 时
   解析方该怎么用）**查不到**。Aseprite CLI 文档里没有 `scale` 的条目。

5. **Aseprite 的 `--split-tags` / `--tagname-format` 与 `frameTags[].name` 的精确关系**
   只查到 `tagnameFormat`（默认 `{tag}`）会作用在 `name` 上（源码
   `doc_exporter.cpp` 的 `filename_formatter(format, fnInfo)`），
   但官方文档没有描述 `--tagname-format` 的占位符全集。**部分查不到。**

6. **没有任何标准化组织（W3C / ISO / Khronos）的 2D sprite atlas 元数据规范**。
   我搜不到，且没有任何一手来源提到存在这样的规范。
   这条我更愿意表述为「查不到」而不是「不存在」。

7. **Aseprite 的 `pingpong` 与 Phaser 的 `yoyo` 语义是否完全等价，没有官方说明。**
   Phaser 把 `direction: "pingpong"` 直接映射成 `yoyo: true`（源码如此），
   但 Phaser 的 yoyo 会重复端点帧（首尾帧各多播一次），
   Aseprite 的 pingpong 是否也如此 —— **查不到**。要精确对齐得实测，本文不含实测。

8. **TexturePacker 的 `--format` 命令行参数名与导出器 id 的对应表**（例如
   `Phaser (JSONHash)` 在 CLI 里叫什么）—— 官方命令行文档页本次未取到，
   **查不到**。

---

## 8. 给下游票的输入（事实 → 推论分开标注）

**事实（可直接当约束用）**

- F1. 没有跨引擎图集标准；最宽交集是 JSON Hash / JSON Array 两种布局。
- F2. Phaser 3 原生读：JSON Hash、JSON Array、Multi Atlas、Aseprite JSON、
  Starling/Sparrow XML、Unity 文本 —— 共 6 种入口，**不需要转换器**。
- F3. Phaser 的锚点是**图集 JSON 的每帧** `anchor`/`pivot`，**归一化到 `0..1`**，
  分母是 `sourceSize`（未裁剪原图框），且**动画每帧都会重新应用**。
- F4. Aseprite 的 `meta.slices[].keys[].pivot`（像素）**Phaser 完全不读**（实测）。
- F5. 九宫格元数据 = 帧上的 `scale9Borders{x,y,w,h}`（中央矩形），
  `this.add.nineslice()` 零参数自动读取；仅 WebGL 渲染器支持。
- F6. 像素级最近邻**不在**图集元数据里，是 `pixelArt: true` 或 `Texture.setFilter(NEAREST)`。
- F7. 逐帧时长只有 Aseprite 的 `meta.frameTags` + `duration` 提供；
  TexturePacker JSON 无动画信息。
- F8. Aseprite JSON 的帧名必须由 `--filename-format "{frame}"` 生成成 `"0"/"1"/"2"`，
  否则 `createFromAseprite` 静默产出空动画。

**推论（我的判断，票 24/26/27 可以否决）**

- I1. 若交付态要「一条 JSON 同时带锚点 + 九宫格 + 多图集」，**TexturePacker "Phaser"
  格式（Multi Atlas）是唯一同时覆盖这三者的现成形状**。
- I2. 但 Multi Atlas 没有动画信息。如果资源包要交付「逐帧时长」，
  要么走 Aseprite JSON（放弃 Multi Atlas），要么在 manifest 里自带动画段
  （那就是我们自己的格式，票 24/26 决定）。
- I3. 锚点必须在**创作态或清单**里就有源头：光栅化结果里不存在这个信息（§4.6）。
- I4. 若选 Aseprite JSON 作交付格式，锚点仍**必须**由我们自己改写进每帧的
  `anchor` 字段（Aseprite 原生只给 slice pivot，Phaser 不读）——
  也就是说无论如何都要写一个「后处理：把锚点注入图集 JSON」的步骤。
