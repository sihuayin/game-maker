# 05. Asset 的表达形式：「绘制代码 + 参数」具体长什么样？

Type: prototype
Status: resolved
Blocked by: —
Map: ../map.md

## Question

Q3 决定了 Asset **不是位图，而是绘制代码**；Q15 决定了 AI 只产出
「数据 + 纯函数」。这两条合起来定义了本项目最核心的产物形态，
但**具体形状完全没定** —— 而它是票 09（Game Config）、票 12（Visual QA）、
票 16（Repair）三张票的共同前置。

候选表达形式：

- **A) SVG 字符串**：AI 产出 `<svg>...</svg>` 文本。
  优点：可直接静态解析（XML parser 就能查所有 `fill`/`stroke`）、可 diff、
  浏览器和 Phaser 都能加载。缺点：动画和多状态（`states: ["idle","harvested"]`）
  表达笨拙；AI 容易产出不合法 XML。
- **B) Canvas 绘制指令数组（自定义 DSL）**：
  AI 产出 `[{op:'rect',x,y,w,h,fill:'palette:3'}, ...]` 这样的 JSON。
  优点：**天生是数据**，Zod 可校验、可 diff、静态检查零成本、
  颜色可以引用色板索引（`palette:3`）而不是硬编码 hex，
  多状态就是多组指令。缺点：需要自己写 renderer，表现力受限。
- **C) TypeScript 纯函数**：AI 产出 `(ctx, style) => void` 的函数体。
  优点：表现力最强。缺点：**是代码不是数据** —— 无法静态校验、无法安全 diff、
  要 eval 或动态 import，直接违背 Q15「数据 + 纯函数」里「可 Zod 校验」的初衷。
- **D) B + A 混合**：几何用 Canvas DSL，需要复杂路径时允许内嵌 SVG path 字符串。

必须回答的子问题：

1. **多状态怎么表达**？`AssetSpec.states: ["idle","harvested"]` 和
   `variants` 在选定的形式下如何落地？状态切换是换整份指令还是打补丁？
2. **色板绑定**：颜色是硬编码 hex 还是引用 `StyleSpec.palette` 的索引/名字？
   引用式能让「颜色 ∈ palette」成为**编译期就成立的事实**而不是运行时检查 ——
   这可能是 Q11 结构化校验能做到的最强形式。
3. **尺寸与 scale**：文档第 31 节的例子是「cow bounds = 180×160，
   GameSpec 期望 80×80，StyleSpec 参考 scale = 0.8」。
   选定形式下，这三个数从哪读、谁负责对齐？
4. **版本化的物理形态**：`assets/cow/v1`、`v2` 里存的到底是
   `.svg` 文件、`.json` 文件、还是 `.ts` 文件？（Q9 已定目录结构，
   但文件格式由本票决定。）
5. **依赖关系**：文档第 63 节说 scene 依赖 cow/barn/tree。
   选定形式下 `AssetSpec.dependencies` 怎么表达和校验？
6. **Phaser 怎么消费它**：选定的形式如何变成 Phaser 的 GameObject？
   （`this.add.image` 需要位图 —— 那是不是得先 rasterize？
   还是用 `this.add.graphics()` 直接画指令？还是 SVG 走 `this.load.svg`？）
   **这一条可能反过来否决某个候选**：如果 Phaser 消费 SVG 有硬限制，
   A 就不成立。

调用 `prototype` skill：挑一个候选，**真的用 Cozy Farm 的 cow + tomato + player
三个资源把它写出来**，让人类看着实物 react。不要停在纸面对比。
产出物链接到本票。

## Answer

**决策：采用候选 E —— 严格 DSL + 数值曲线（`drawlist+curve/v1`）。**

由人类在看过原型实物后选定（两轮：先选 B，在看到 E 的实测数据后改选 E）。

原型（一次性，已归档）：分支 `prototype/asset-representation`，
文件 `demo/PROTOTYPE-asset-representation.html`。单文件、零依赖、双击即开。
取回：`git checkout prototype/asset-representation -- demo/PROTOTYPE-asset-representation.html`

### 为什么不选 A / B / C / D

五个候选用**同一批资源**（cow / tomato / player，共 8 个 asset×state 组合）
实测对比，26 项断言在 Node 里跑通：

| | A SVG | B 严格DSL | C TS函数 | D DSL+`d` | **E DSL+curve** |
|---|---|---|---|---|---|
| 不透明字符串 | path 的 `d` | **0** | 整个函数体 | 2 | **0** |
| Zod 一层校验 | ✗ 两层 | ✓ | ✗ | ✓ | **✓** |
| 颜色绑定色板 | ✗ hex 烧死 | ✓ | 看写法 | ✓ | **✓** |
| 换色板后产物文本 | 必须重生成 | 一字不变 | 看写法 | 一字不变 | **一字不变** |
| cow/idle 包围盒 | 56×37.5 | 56×37.5 精确 | **不可知** | **50×37.5 低估** | 56×37.5 凸包 |
| scale 越界检出 | ✓ | ✓ 193% | **✗** | ⚠️ 175% | **✓ 193%** |
| 色板外颜色 | 解析后可查 | schema 拒绝 | regex 不保证全 | schema 拒绝 | **schema 拒绝** |
| 非法输入何时炸 | XML 解析期 | 解析期 | **import 期，整模块挂** | **渲染期（静默过关）** | **解析期** |
| 有机曲线 | ✓ | **✗** | ✓ | ✓ | **✓** |
| 产物体积 | 1253 B | 2272 B | 1913 B | 2477 B | **2391 B** |

- **A 出局**：颜色是硬编码 hex，换色板必须重新生成整份产物 ——
  这直接毁掉 Q11「风格一致性可证明」的根基；且校验要两层（XML 解析 + 逐节点）。
- **C 出局**：包围盒**静态不可知**，只能渲染后逐像素扫描；不可 Zod 校验；
  最致命的是非法输入在 **import 期**炸 —— 一个坏资源会让整个模块加载失败，
  而文档第 20 节 `AssetManifest.broken` 要求的是**单个资源**粒度的「哪些坏了」。
- **D 出局**：`d` 是不透明字符串，导致两个可测量的退化 ——
  ① 包围盒**系统性低估**（cow 56→50），scale 检查会**漏报**（危险方向）；
  ② 坏掉的 `d` 能通过 JSON + schema 双重校验，**到渲染期才炸**（已进 build 阶段）。
- **B 差一点**：可检查性满分，但只有 rect/circle/ellipse/poly/line，
  **画不了有机曲线**。Q5 定的 Cozy Farm 是 `shapeLanguage: ["rounded","soft"]`，
  B 会让牛尾巴成直线、帽檐成矩形、叶冠成折线 —— 整体像像素积木而非 cozy 手绘。

### E 为什么能两全

**关键洞察：曲线不必须是不透明字符串。** D 用 SVG `d` 表达曲线，
但曲线同样可以用**数值控制点列**表达：

```json
{"op":"curve",
 "points":[[52,18],[56.5,23],[55,28.5],[57,33]],
 "stroke":"palette:5","strokeWidth":2,"closed":false}
```

`points` 全是数字 —— 与 `poly` 同级，**完全可静态分析**。
渲染用 Catmull-Rom → 三次贝塞尔转换，原型里 8 行代码跑通。

E 的实测性质：**不透明字符串 0、schema 一层校验、色板引用、
换色板产物文本一字不变、包围盒可静态算出、三种故障全部在解析期拒绝并精确定位**
（`ops[1].cy = "eighteen"，期望 number`）。

**唯一代价**：包围盒从「精确」变成「点列凸包（保守上界）」。
实测 player/idle 从 20×42 变 22×42，**高估 2px**。
方向是安全的 —— 高估意味着 scale 检查**只会误报过大、不会漏报过大**；
对照 D 是低估，会漏报，那才是危险的。票 12 设阈值时要吸收这一点。

---

## 六个子问题的答复

### 1. 多状态怎么表达？

**一个 `(asset, state)` 一份 JSON 产物**，不是「一份文档挂多个状态」。
顶层结构（原型实测的形状）：

```json
{ "format": "drawlist+curve/v1",
  "id": "tomato", "state": "ripe",
  "viewBox": [0,0,32,32], "expectedSize": [32,32],
  "ops": [ ... ] }
```

状态切换 = **换整份 ops 数组，不是打补丁**。原型里 tomato 的
growing / ripe / harvested 三态差异极大（成熟果实 → 只剩土坑），
不是小修补，打补丁模型不成立。

**为什么按 state 切分产物**：票 16（Repair）要求「只重生成被点名的资源」，
按 `(asset,state)` 切分才能只重生成 `tomato.ripe` 而不动 `tomato.growing`。

⚠️ **留给票 18 的问题**：版本化目录是 `assets/<assetId>/v<N>/`，
现在一份产物是一个 state，那 `v<N>` 到底是**整个 asset 的版本**
还是**单个 state 的版本**？建议 `assets/<assetId>/<state>/v<N>.json`，
但这要票 18 定，因为它同时管 checksum 和 version 递增。

### 2. 色板绑定

**强制 `palette:N` 引用，schema 直接拒绝硬编码颜色。**

实测：注入 `#FF00FF` 后，E 的 schema 报错
`ops[1].fill = "#FF00FF" —— 不是 palette:N 引用（硬编码颜色）`，
**在解析期就拦住了**。而 A/C 是「检测」到违规 —— 已经晚了一步。

> 这不是「查得出问题」，而是**问题构造不出来**。
> 一个让非法状态无法表达的类型，胜过一万个运行时检查。

推论：**「颜色 ∈ StyleSpec.palette」在 E 下是编译期恒真的命题**，
票 12 不需要再写这个检查 —— 它应该去检查**别的东西**。

⚠️ **未定，交给票 12**：引用用**索引**（`palette:5`）还是**槽位名**
（`palette:white`）？原型用索引。索引在色板重排序时会静默错位，
名字在槽位改名时会显式失败 —— 名字更安全但更啰嗦。
`StyleSpec.palette` 的契约目前是 `z.array(z.string())`（一串 hex），
**根本没有槽位名**，要支持名字就得改契约。这个取舍留给票 12。

### 3. 尺寸与 scale

文档第 31 节的三个数在 E 下**全部静态可读**：

| 数 | 来源 | 怎么得到 |
|---|---|---|
| 实际 bounds | `ops` | `boundsOfOps()` 遍历数值图元，curve 取点列凸包 |
| 期望尺寸 | 产物自带的 `expectedSize` | 直接读 |
| 参考 scale | `StyleSpec` | 直接读 |

实测：注入 ×2.8 缩放后，E **不渲染**就算出 `155×105`，
对比 `expectedSize: [80,80]` → 超出 193%，精确复现文档第 31 节的判定。

**归属**：`expectedSize` 写在 drawlist 产物里（谁生成谁声明），
比对由票 12 的 Visual QA 做。**注意 E 的 bounds 是凸包上界**，
票 12 的容差必须允许高估方向（建议只判「过大」，不判「过小」）。

### 4. 版本化的物理形态

**`.json` 文件。** 不是 `.svg`、不是 `.ts`。
目录形态建议 `assets/<assetId>/<state>/v<N>.json`（见子问题 1 的警告，最终由票 18 定）。

理由：JSON 是 E 唯一能同时满足「Zod 一层校验 + 精确 diff + 零不透明字符串」的载体。
`.ts` 会让 C 的所有问题复活；`.svg` 会让 A 的所有问题复活。

### 5. 依赖关系

`AssetSpec.dependencies` **保持原样，drawlist 不表达资源间依赖** ——
依赖是资源之间的事，不是单个资源内部的事。

但原型暴露了一个**真实的空白**：文档第 63 节说 `scene` 依赖 cow/barn/tree，
那「场景」是不是一个 Asset？**E 的 op 集合里没有「实例化另一个资源」这种 op**，
所以场景无法用 drawlist 表达。

**结论：场景组合不是 Asset 的职责，是 Game Config 的职责**（Q15 已定
「场景布局」属于 Game Config）。已在票 09 里加了对应条目。
`AssetSpec.dependencies` 因此只用于**生成顺序**（文档第 63 节的依赖图），
不用于组合。

### 6. Phaser 怎么消费它

**不需要 rasterize。** E 是绘制指令列表，Phaser 3 的 `Graphics` 对象有对应图元
（`fillRect` / `fillCircle` / `fillEllipse` / `beginPath` / `moveTo` / `lineTo` /
`bezierCurveTo` / `fillPath` / `strokePath`），写一个**手写固定的**
`drawOps → Phaser.Graphics` 翻译器即可（约 30 行，属于 Q15 的「手写固定」清单）。

两条路，建议**先 ①，性能不够再 ②**：
1. **直接画**：每个实体一个 `this.add.graphics()`，重放 ops。
   简单、无中间产物、改 ops 立刻生效（对 repair 循环友好）。
2. **离屏渲染成 texture**：把 drawlist 画到 canvas → `game.textures.addCanvas()`
   → `this.add.image()`。性能好（GPU 精灵批处理），但多一层缓存要失效管理。

⚠️ **必须等票 02 确认**：Phaser 3 `Graphics` 的 API 名称与语义
（尤其 `bezierCurveTo` 是否存在、`fillPath` 的用法）**未实测验证**，
上面是基于既有认知的推断。已在票 02 里加了对应条目。
如果 Phaser 的 Graphics 不够用，**路 ② 一定可行**（Canvas2D 是原型已验证的路径），
所以这不会推翻 E 的选择。

---

## 可提升到真实代码的部分

原型里这几个函数是**纯模块、无 DOM 依赖**，可直接搬进 `demo/src/`：

| 原型函数 | 去处 | 作用 |
|---|---|---|
| `validateDrawList()` | `demo/src/contracts/drawlist.ts` | 改写成 Zod schema |
| `boundsOfOps()` | `demo/src/qa/visual/geometry.ts` | 票 12 的核心工具 |
| `resolveRefs()` | 同上 | palette 引用解析 + 越界检出 |
| `drawOps()` | `demo/src/game/renderer.ts` | Canvas2D 渲染器（Phaser 版另写） |
| `GEOM` 的 cow/tomato/player | `demo/projects/*/fixtures/` | 当真实 fixture 用 |

Catmull-Rom → 三次贝塞尔的 8 行转换在 `drawOps()` 的 `curve` 分支里。

---

## 对地图的影响

- **票 09（Game Config）解除阻塞**，并新增「场景组合归 Game Config」条目
- **票 12（Visual QA）解除阻塞**，方向发生重大变化：
  「颜色 ∈ palette」已成编译期恒真，不必再查；重心转向
  **凸包容差**、**palette 索引 vs 槽位名**、以及剩下的五个维度
- **票 16（Repair）仍阻塞**（等 09、12），但修复对象已明确：
  改 drawlist 的 `ops[i]` 字段 = 精确、可 diff、可回滚
- **票 02（Phaser 插件）新增条目**：确认 `Graphics` 能否重放 drawlist
- **票 18（ArtifactRef）新增条目**：版本目录是 `v<N>/` 还是 `<state>/v<N>.json`
- **票 15（StyleSpec fixture）不受影响**
