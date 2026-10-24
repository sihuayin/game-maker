# 03 资产：Visual Design Spec 正式契约草案（v1，待反应）

> **原型，不是定稿。** 本草案把 PRD §5.3 的「概念示例」推成一份**可反应的契约**：
> 概念级 JSON shape + 每字段约束 + 判据/观察标注。落地的判据/观察分界沿用
> `CONTEXT.md` [[观察 / 判据]]：**判据 = 精确可算 + 错了一定不是设计（构建期硬失败）；观察 = 只报不阻断。**
>
> 本草案**不落代码**；实现者接手时再译成 `contracts/*` 的 zod `.strict()` 形态（本仓**现有**技术，票 03 不许另起一套）。
> 末尾的「开放决策」是留给人反应的岔口。

---

## 0. 一句总览

VDS 是「这个设计的**视觉构图**」：每个对象在**视口（屏幕空间）坐标**里说清「我是谁、在哪、多大、几层、什么色、
对应哪个设计实体」。它**不**：重写色板（色只有 `palette:N` 一个来源）、不声明玩法几何的精确落点
（那是 GameConfig 的活）、不指向 SVG（SVG 是 VDS 的**派生视图**，见三岔裁定）。

---

## 1. 顶层 shape

```ts
// 概念级（译成 zod 时：z.strictObject，format 用 z.literal）
VisualDesignSpec = {
  format:   "visual-design/v1",          // 判别式（本仓惯例，替换 PRD 的 schemaVersion:1）
  viewport: { w: int>0, h: int>0 },      // = 外壳 VIEWPORT（480×270），由外壳注入
  style:    StyleRef,                     // 色板/风格出处指针，**不重写色板**
  objects:  VDSObject[]                   // 视觉构图本体
}
```

### 1.1 `format` —— 判据

`z.literal("visual-design/v1")`。PRD §5.3 的 `"schemaVersion": 1` 是自由数字，**判别式写不出来**
（`visual-world.ts:51` 的那条注释）；全仓四处（drawlist / recipe / assetpack / game-config）都是
`format: "<name>/v1"` 这个形状。**判据**：`format` 不是 `"visual-design/v1"` ⇒ parse 拒。

### 1.2 `viewport` —— 判据

`{ w, h }`（本仓形状，不是 PRD 的 `width/height`）。**值 = 外壳 `VIEWPORT`（480×270）**，
由外壳注入（票 01 结论）。**判据**：`viewport !== VIEWPORT` ⇒ 构建期拒 —— 任何别的值都逼出
非整数下采样（1280→480 = ×0.375）、打破「整数从创作态一路到屏幕不被重采样」的不变量
（`CONTEXT.md:611`、`game-config.ts:21-24`、`raster.ts:121`）。PRD 示例里的 `1280×720` 是
**非规范占位**，必须归一化掉（`docs/v7/中间svg.md:333` 自认不是契约）。

### 1.3 `style` —— 判据（引用不越界）【已裁定：留出处指针】

**只做出处指针，不重写色板**（色只有一个来源 = VisualWorldSpec，R1-Q6 / R5-Q1）：

```ts
StyleRef = {
  visualWorldFormat: "visual-world/v1"   // 判别式：这份 VDS 读的是哪个世界的风格
}
```

- 对象用色一律 `palette:N`（指向 visual-world.json 的 `style.palette` 有序数组），**不是** hex。
  hex 只在 `visual-world.json` 的 `style.palette` 里那一处有（`PaletteColor` = `#rrggbb`）。
- **判据**：`palette:N` 的 `N` 落在 visual-world 那份 palette 的长度内（`paletteColor()` 越界 =
  悬空引用，同 `visual-world.ts` 顶层那条 `superRefine`）。**跨文件**，所以这条在**装配/QA 步**
  判（parse 时 VDS 自己看不见 visual-world.json），与「`levels[].entities[]` 解得到」那条
  引用族判据同形。
- **观察**：某个色板色没人用（`palette:N` 全集 ≠ 0..len-1 全集）—— 黄昏世界的最暗色占大头可能正是对的，
  只报。

### 1.4 `objects` —— 数组非空（判据）

空的 `objects` 一定是生成失败（同 `DrawListSchema.ops.min(1)`）。

---

## 2. `VDSObject` shape

```ts
VDSObject = {
  id:          string.min(1),           // VDS 内唯一
  role:        Role,                     // 封闭枚举（见 §3）
  bounds:      { x, y, w, h },           // 视口坐标，int，非负（见 §4）
  layer:       int,                       // z 序（见 §5）
  fill:        palette:N,                 // 预览用色（见 §6）
  sourceIntent: string.min(1)?           // → GameDesignSpec 实体/机制 id（见 §7）
}
```

| 字段 | 缺失/非法 | 判据 or 观察 |
|---|---|---|
| `id` | 缺失 / 空 / **重复** | **判据**（parse 拒；重复 = 语义含糊） |
| `role` | 不在枚举 | **判据**（封闭枚举，parse 拒） |
| `bounds` | 非整数 / 负 / 越出 viewport | **判据**（`auditScreenSpace` 同款，四条边都查） |
| `layer` | 非整数 | **判据**（非整数 z 序无意义） |
| `fill` | 不在 `palette:N` 形 / 越界 | **判据**（悬空引用） |
| `sourceIntent` | 指向设计里没有的 id | **判据**（悬空引用，跨文件，装配/QA 步判） |

---

## 3. `role` 封闭枚举【已裁定：EntityKind 对齐，11 值】

**草案推荐值**（11 个）：

```
player | solid | pickup | hazard | goal | chest | danger | decor | background | ui-panel | ui-pip
```

**对齐理由**：`role` 是 VDS 与 GameConfig **共享的身份子集**（票 07 交叉验证判的就是它）。它 =
`{ player } ∪ EntityKind ∪ { background, ui-panel, ui-pip }`：

| VDS `role` | GameConfig 对家 | GameDesignSpec 对家（经 `sourceIntent` 的 id） |
|---|---|---|
| `player` | `player`（顶层字段，非 `entities[]`） | `player.id` |
| `solid` / `pickup` / `hazard` / `goal` / `chest` / `danger` / `decor` | `entities[].kind`（`EntityKind` 封闭枚举，`game-config.ts:50`） | 四桶里某个实体 id（桶由 id 落在哪桶定，`intent-coverage.ts`） |
| `background` | `scene.background` | （无，世界背景不是实体） |
| `ui-panel` / `ui-pip` | `hud.panel` / `hud.pip` | （无，HUD 不是实体） |

- **`npc`/`enemy`/`interactable`/`resource` 不进 `role`**：它们是**设计桶**，由 `sourceIntent` 的 id
  落桶表达（`ENTITY_BUCKETS`）。VDS 的 `role` 说的是**视觉/身份**那一层，不是设计桶那一层。一只
  `enemy` 在画面里视觉上要么是 `hazard`（碰了就死）、要么 `decor`（纯背景味）、要么 `solid`（挡路的障碍）——
  那正是 GameConfig `EntityKind` 要决定的；VDS 不该越界替它决定，只**提前声明**一个 role 供票 07 对账。
- **`terrain` 不进 `role`**：[[地形]] 是「**只有碰撞、没有画面**」（`CONTEXT.md:409-411`），
  而 VDS 是视觉构图 ⇒ **看不见的进地形、看得见的进实体**，看不见的地形**根本不该有 VDS 对象**。
  看得见的「地面/台阶」是 `background`（画的背景）或 `solid`（可见碰撞块）。
- **`objective-marker` 并入 `goal`**：终点的红/绿是「是否已捡齐」的显示（`CONTEXT.md:418`），
  它**就是** `goal` 实体，不另立 role。

---

## 4. `bounds` —— 判据

`{ x, y, w, h }` = `game-config.ts` 的 `Rect` 形状（`Coord = int().nonnegative()`，`w/h = int().positive()`），
但**尺子是视口（屏幕空间），不是 `world.size`**（票 01）。这就是 VDS 与 GameConfig「粗略 bounds」交叉验证
（票 07）里 VDS 那一侧的数；GameConfig 那一侧是 `at`+`anchor`+`size` 推出的盒子（`entityBox`）。

- **判据**：bounds 四条边都在 viewport 内（`auditScreenSpace` 同款；负数或越界 = 硬失败）。
- 与 GameConfig 几何的**漂移 = 观察**（票 07 已裁：几何漂移只报、不暗示「错」）。

---

## 5. `layer` —— 判据【已裁定：逐对象 z 序】

`int`，z 序。**已裁定**：**逐对象 z 序，越大越在上（后画）**。SVG 派生（票 05）按 `layer` 升序排文档顺序
（SVG 同 stacking context 内没有 `z-index`，顺序即层级）。

- **判据**：非整数 ⇒ 拒。
- **观察**：同一 layer 上多个对象重叠（可算，但「谁压谁」可能是设计）。
- 与现有**视差 `layers`**（`camera:parallax`，`setScrollFactor`）**拆开**：VDS 的 `layer` 是
  **逐对象** z 序（构图需要），视差是**背景层**的滚动因子，两把尺子。

---

## 6. `fill` —— 判据（引用不越界）

`palette:N`（`PaletteRef`，`drawlist.ts:23` 同款），指向 visual-world 的 `style.palette`。这是 VDS 里
**唯一**的颜色入口：SVG 的 `fill`（票 05）直接派生自它 ⇒ **同一 VDS（+ 同一 visual-world）⇒ 逐字节同一 SVG**。

- **判据**：`fill` 不在 `palette:N` 形 / `N` 越界 ⇒ 拒（悬空引用，同 §1.3）。
- **观察**：某色从未被任何 `fill` 引用（见 §1.3）。

---

## 7. `sourceIntent` —— 判据（跨文件悬空）+ 票 04 的锚点

`string.min(1)`，**原样**引用 GameDesignSpec 的实体/机制 id（票 02 §4：不改名、不新造 id 空间）。
可选：**纯装饰**（`decor`/`background`）可以没有 `sourceIntent`。

- **判据**（装配/QA 步，跨文件）：`sourceIntent` 指向的 id 在 GameDesignSpec 里**不存在** ⇒ 悬空引用。
- 票 04 的「语义覆盖」就**按这个 id 判**：GameDesignSpec 里哪些实体**必须**在 VDS 有 `sourceIntent`
  对家，`sourceIntent` 是那个集合差的键（沿用 `intent-coverage.ts` 的「只按 id 判」）。
- **VDS 多出设计没有的对象**（纯装饰）**允许**，不需追来源 —— 与「设计多出意图 = 补全」同向。

---

## 8. 一个工作示例（480×270，废土寻宝）

```json
{
  "format": "visual-design/v1",
  "viewport": { "w": 480, "h": 270 },
  "style": { "visualWorldFormat": "visual-world/v1" },
  "objects": [
    { "id": "bg-wasteland", "role": "background", "bounds": { "x": 0, "y": 0, "w": 480, "h": 270 }, "layer": 0, "fill": "palette:0" },
    { "id": "e-player",   "role": "player",   "bounds": { "x": 40, "y": 190, "w": 24, "h": 40 }, "layer": 10, "fill": "palette:1", "sourceIntent": "player" },
    { "id": "e-scrap-01", "role": "pickup",   "bounds": { "x": 180, "y": 230, "w": 16, "h": 16 }, "layer": 20, "fill": "palette:2", "sourceIntent": "e-scrap-01" },
    { "id": "e-chest",    "role": "chest",    "bounds": { "x": 380, "y": 224, "w": 24, "h": 20 }, "layer": 20, "fill": "palette:3", "sourceIntent": "e-chest" },
    { "id": "e-spike",    "role": "hazard",   "bounds": { "x": 260, "y": 250, "w": 20, "h": 12 }, "layer": 20, "fill": "palette:4", "sourceIntent": "e-spike" },
    { "id": "e-gate",     "role": "goal",     "bounds": { "x": 440, "y": 150, "w": 24, "h": 80 }, "layer": 20, "fill": "palette:5", "sourceIntent": "e-gate" },
    { "id": "ui-panel",   "role": "ui-panel", "bounds": { "x": 8, "y": 8, "w": 160, "h": 24 }, "layer": 100, "fill": "palette:6" },
    { "id": "ui-pip",     "role": "ui-pip",   "bounds": { "x": 16, "y": 16, "w": 12, "h": 8 }, "layer": 110, "fill": "palette:7" }
  ]
}
```

> `bounds` 是**粗略**的构图盒，不是 GameConfig 的精确碰撞盒 —— 漂移归票 07 的**观察**。
> `fill` 的 `palette:N` 指向 `visual-world.json` 的 `style.palette`（此处不列 hex，因为 hex 只住那一份）。

---

## 9. 已裁定（人裁 2026-10-24）

1. **`role` 枚举** = `{ player } ∪ EntityKind ∪ { background, ui-panel, ui-pip }`（11 值）。
   `npc/enemy/interactable/resource` 由 `sourceIntent` 落桶表达；`terrain` 不进 VDS；`objective-marker` 并入 `goal`。
2. **`style`** = 只留 `visualWorldFormat` 出处指针，色板不重写。
3. **`visualRef`** = **砍掉**（V1）。P2「SVG→AssetRecipe」再补。
4. **`layer`** = 逐对象 z 序，越大越在上；与视差 `layers` 拆开。
