# 02. `VisualWorldSpec` 落地：新契约与 `StyleSpec` 并存，六桶不进取值域

Type: grilling
Status: resolved
Owner: amber
Blocked by: —
Map: ../map.md
> 依据 **R6**（Q7b）。这一票把 `docs/v2/01-contracts.md` 第 2 节**逐字段**落成
> `packages/contracts/src/visual-world.ts`，并把「与 `StyleSpec` 的关系」钉死。
> ⚠️ **2026-10-01（票 28）：本票造的是 V2 契约 —— 请用 `import { z } from "zod/v4"` 写**（不是 `from "zod"`）。
> 理由与代价见[票 28 的 Answer](28-structured-call-substrate.md)：`toolInputSchema` 只能转 v4 的 schema，而 v3/v4 的 schema **不许互相嵌套**。
> 另：**封口用 `z.strictObject`** —— 普通的 `z.object` 不产出 `additionalProperties: false`。

## Question

R6 已定的三条：**新契约** · **`StyleSpec` 原样保留** · **六桶不进取值域**。
剩下的全是**逐字段的形状**，这才是这一票要答的。

### 1. 硬冲突的那两处，具体怎么并存

今天 `StyleSpecSchema`（`packages/contracts/src/index.ts:22-37`）：

```ts
id: string;  identity: string[];  camera: z.record(z.unknown()).default({});
composition: z.record(z.unknown()).default({});  palette: PaletteSchema.default([]);
lighting: z.record(z.unknown()).default({});  shapeLanguage: string[];  material: string[];
environment: string[];  characterStyle: string[];  constraints: string[];  confidence: number
```

`index.ts:20-21` 那条注释是**不变式**，不是约定：

> ⚠️ `palette` 是**有序数组**，drawlist 用 `palette:<下标>` 引用它。**有序是硬约束**：
> 换掉整个色板时，创作态文本必须**一字不变**。

- **`palette`**：`VisualWorldSpec.palette` 是六桶；**取值域仍是 `StyleSpec.palette` 那份有序数组**。
  要答的是：六桶与那份数组**怎么建立对应**？是「六桶各自指向数组里的下标」，
  还是「六桶是独立的描述、与数组**不互指**」？前者给下游一个可校验的映射，后者更松。
  ⚠️ **票 39 的裁决**（`.scratch/game-creation-v1/issues/39-palette-role.md:10`）：
  「**选**色对、**排**色错」，且**不设任何色板校验** —— 六桶是「排」，所以它**不能**成为校验对象。
- **`identity`**：今天 `string[]`，V2 要 `{styleName?, keywords[], description}`。
  同名不同型 ⇒ **必须改名或并存**（`VisualWorldSpec.identity` 与 `StyleSpec.identity` 是两个东西）。
- **`camera` / `composition` / `lighting`**：今天是 `z.record(z.unknown())`（自由文本），
  V2 要给类型。**收紧会不会让磁盘上的旧 `stylespec.json` 解析不了？**
  （`z.object` 非 strict ⇒ 未知键被 strip，但**类型不符会直接红**。）

### 2. 今天有、V2 没有的两个字段怎么办

`shapeLanguage: string[]` 与 `constraints: string[]` 在 `VisualWorldSpec` 里**没有对应物**。
⚠️ `constraints` **有一个消费者**（`prompt.ts` 的 `styleBrief` 喂进生成提示词，票 39 Q4 记着）
⇒ 按 **R7 的门**，它**不能因为 V2 没列就删**。要答：它们去哪。

### 3. 原图（R15 + R18）

⚠️ **R18 已定**：`references.styleImages` 按**复数**写，每一项带 `role`：

```ts
styleReferences: { path: string; role: string }[]
```

**第一阶段 `maxItems === 1`**；多给了就**拒绝**（退出码 2）并明说这条限制。
多图怎么合并、`role` 是不是封闭枚举 —— 全部推迟到
[票 26](26-multiple-style-references.md)。

原图（R15）

`VisualWorldSpec.references.styleImages` **只存引用**（路径），二进制不进 JSON。
要答：`styleImages` 存**什么形式的路径**（相对谁解析）—— 仓库里已有 `InputPath`
这套规则（`recipe.ts` 的 `styleRef` / `source.ref` 都相对**配方文件**解析），照它还是另立？

### 4. 与 §5 兼容要求的关系

`03 §5` 要求旧 fixtures 继续能解析。这一票的**判据**就是它：
`fixtures/style-spec.json` 与 `fixtures/style-spec.halt-dusk.json` **一字不改**仍然解析通过，
而两个 fixture 包（`fixtures/packs/{last-train,counter-siege}`）的 `authoring/stylespec.json` 同理。

## Answer

**结论：`VisualWorldSpec` 落地成 `packages/contracts/src/visual-world.ts`（v4），与 `StyleSpec` 并存 ——
但它不是「翻新版」，是**两层叠在一起的一份文档**：新视图给代码读，内嵌的 `style` 子树给提示词与旧链读。
判据两条全绿：**漂移测试 25/25**（四处 v4 镜像 vs v3 原件）· **§4 四份 fixture 一字不改仍解析通过**。
套件 **587/587** · `tsc -b` 干净 · `check:deps` / `check:links` 绿。**

### 0. 25 条裁决

| # | 轮 | 裁决 | 落点 |
|---|---|---|---|
| 1 | R1-Q1 | **内嵌**：`VWS.style` 是一份完整的 `StyleSpec` 形 | 形状 |
| 2 | R1-Q2 | 六桶装 **`PaletteRef`**，不产生第二套颜色来源 | `visual-world.ts` |
| 3 | R1-Q3 | `identity` → **`styleIdentity`**（VWS 侧改，`StyleSpec` 不动） | 同上 |
| 4 | R1-Q4 | **只收紧 VWS**；`StyleSpec` 一个字不改 | 同上 |
| 5 | R1-Q5 | `shapeLanguage` / `constraints` **进**（有活消费者） | 同上 |
| 6 | R1-Q6 | 复用 **`InputPath`** 规则，基准 = 文档自身 | `StyleReferencePath` |
| 7 | R1-Q7 | **`format: z.literal("visual-world/v1")`**，不用自由 `schemaVersion` | 同上 |
| 8 | R1-Q8 | 只加 §4 回归测试；裸 cast **另开票** | [票 29](29-stylespec-parse-gate.md) |
| 9 | R1-Q9 | `characterImages` / `materialImages` / `animation` / `readability` **不进** | 形状 |
| 10 | R2-Q1 | 模型**一次吐全**（`style` 与视图同一发调用），**不做代码投影** | 形状 |
| 11 | R2-Q2 | 六桶**平级**于 `VWS.palette`，数组住 `VWS.style.palette` | 同上 |
| 12 | R2-Q3 | palette 越界 = **判据**；identity 漂移 = **观察** | 见 §2 |
| 13 | R2-Q4 | **R6 优先**：R7 的门只管新字段，不管原样搬运的旧子树 | 文件头 |
| 14 | R2-Q5 | 只钉 `run/v<N>/visual-world.json`；**包内 VWS 归[票 15](15-pipeline-create-game.md)** | doc |
| 15 | R3-Q1 | **v4 镜像**（四处），漂移测试以 v3 为准 | `visual-world.ts` |
| 16 | R3-Q2 | 删 `description` 逃生口 —— 原话住 `VWS.style.camera` | 同上 |
| 17 | R3-Q3 | **新视图权威**；`style` 是兼容/提示词载体 | 文件头 |
| 18 | R3-Q4 | 摊平成 **`styleReferences[]`** | 同上 |
| 19 | R3-Q5 | `confidence` **不进**（零消费者 + 长得像分数） | 同上 |
| 20 | R3-Q6 | `rendering` **不进**（消费者是「将来会有」） | 同上 |
| 21 | R4-Q1 | `style.id` 由**调用方注入**，模型照抄、解析后强制覆盖 | 见 §3 |
| 22 | R4-Q2 | 六桶**必填、允许 `[]`**、**不用** `.default([])` | `visual-world.ts` |
| 23 | R4-Q3 | `maxItems === 1` **不写进 schema**，调用方执行 | 同上 |
| 24 | R4-Q4 | `camera.mode` **必填**、保留 **`"other"`** | 同上 |
| 25 | R5-Q1 | `materials.*.color` 也改成 **`PaletteRef[]`** | 同上 |

### 1. 为什么是「两层」而不是「两个版本」

R6 说 `StyleSpec`「**降格成它的一小块**」—— 落成内嵌之后，这份文档里**并排两个 `camera`、两个 `palette`、两个 `composition`**。
所以文件头第一条就是给读者的：**它们各有各的消费者**，不是同一件事的粗细两版。

```
styleIdentity / camera / palette / …   ← 新视图。封闭枚举、PaletteRef、结构化 —— 给代码读。
style                                  ← 完整的 StyleSpec 形 —— 给提示词与旧链读。
```

**新视图权威**（R3-Q3），`style` **不是第二事实源**；两者不一致**不设判据** ——
两份都由模型的**同一次调用**填出，不一致是措辞差异，够不上 R3 的「错了一定不是设计」。

⇒ 这条也反过来废掉了第一轮我自己的建议：Q4 我说「每个封闭枚举配一个 `description` 记原话」，
但原话**已经**住在 `style.camera` 里 ⇒ R3-Q2 把它删了。**不删就是同一个意思的第三份。**

### 2. 判据与观察（R2-Q3）

| | 判 | 落点 |
|---|---|---|
| **palette 越界**（`palette:9` 对着 8 个色） | **判据** —— 构建期阻断 | 复用既有 `resolveRefs()` 的 `off`（`geometry.ts:67`），**不新造** |
| **identity / 其余两视图漂移** | **观察** —— 只报 | 暂无落点（真要报时进 `inspect`，不走闸） |

分界线就是 R3 那条：**越界的引用画不出任何东西，没有「另一条路」这回事**；
而模型把 `"dystopian"` 写成 `"dystopia"` 够不上。⚠️ 票 39 立的规矩在这儿挡了一次「反正能算」的升级冲动。

### 3. 落地时量到的五条事实（写进来是为了别人不用再量）

1. ⚠️ **`StyleSpecSchema` 今天没有解析过任何真实文件。** `ops.ts:63` 与 `:840` 都是
   `JSON.parse(...) as StyleSpec` —— 裸 cast；而 **`parseWith` 全仓库零调用者**。
   四份 fixture 里 **`fixtures/style-spec.json` 没有任何测试读过它**；两个包内那份只被
   **逐文件 checksum** 盖住 —— 那证明的是**字节没变**，不是**它是一份合法的 `StyleSpec`**。
   ⇒ 这也是本票 §4 那条判据**此前没有落点**的原因。[票 29](29-stylespec-parse-gate.md) 接着办。
2. **`StyleSpec` 的 12 个字段里有 6 个零读取**（`camera` · `composition` · `lighting` · `environment` ·
   `characterStyle` · `confidence`），其中 `camera` 被 `prompt.ts:217` 明确写下「故意不读」、
   `characterStyle` 还有**反向断言**盯着它不许被读（`generate.test.ts:140-143`）。
   ⇒ 这正是 R2-Q4 那条边界要挡的事：**R7 的门拿这 6 个字段一点办法都没有**（它们在旧链里也是零读取）。
3. ⚠️ **`StyleSpec.composition.layout` 与 `lighting.ambience` 在 `VisualWorldSpec` 里根本没有家** ——
   两份真实 fixture 都在用（`"横向分层平行构图"` / `"冷调黄昏氛围"`）。**这一条直接判了 R2-Q1 的生死**：
   代码投影是**有损**的，而且丢的是真实数据。顺带：`material: string[]` → `materials: Record<…>`、
   `environment` / `characterStyle` 同样是**结构性换形**。
4. ⚠️ **`prompt.ts:217` 的注释与它旁边的代码不一致，而且从一开始就不一致。** 注释说生图提示词
   「只取 identity / material / **constraints**」，而三张模板（`:295-296` / `:328-329` / `:376-377`）
   **只吐了 identity + material** —— `constraints` 在生图那条路上**被静默丢掉**。
   `git show 593c327` 证明写注释的那一刻代码就已经是这样了 ⇒ 它描述的是一个**从未实现过的意图**。
   ⇒ [票 30](30-constraints-not-in-image-prompt.md)。
5. **`PaletteRef` 只做正则、不带范围**（`/^palette:\d+$/`）—— 越界是**运行时**才由 `resolveRefs` 发现的。
   契约层不拦（要拦就得知道数组长度），这一点继承自 drawlist，**不在本票改**。

### 4. 明确**不做**的

- **不动 `StyleSpecSchema` 一个字节**（R6）。四份 fixture 也**一个字节没动**。
- **不把 v3 契约迁到 v4**（R3-Q1 的 (b)）：`StyleSpec.palette` 引用 `PaletteSchema`，而后者被**整个
  drawlist 契约**用着 —— 迁它就是把票 28 刚划干净的边界再搅一次。
- **不做 `projectStyleSpec` 投影函数**（R2-Q1）：见事实 3。
- **不在 schema 里限 `styleReferences` 的条数**（R4-Q3）：那是阶段限制，不是契约形状。
- **不改 `ops.ts` 的裸 cast**（R1-Q8）：行为变更，另开票。
- **不给 `role` 定封闭枚举**、**不动 `pack.ts` 的目录形状**（归票 26 / 票 15）。

### 5. 产出

- ⭐ **`packages/contracts/src/visual-world.ts`（新）** —— `VisualWorldSpecSchema` +
  `VISUAL_WORLD_FORMAT` · `CAMERA_MODES` · `PALETTE_BUCKETS` · 四处 v4 镜像
  （`StyleSpecShape` / `PaletteShape` / `PaletteColorShape` / `PaletteRefShape` / `StyleReferencePath`）。
  文件头三条：**两层各司其职** · **R7 不管旧子树** · **镜像的代价与封口例外**。
- ⭐ **`packages/contracts/tests/visual-world.test.ts`（新，25 条）** ——
  漂移判据（**用行为比对**，不碰两套 zod 的 introspection）+ §4 回归 + 形状 + **可被 `toolInputSchema` 消费**
  （R3-Q1 的存在性证明：镜像若不是真的 v4，那条会当场抛）。
- `packages/contracts/src/index.ts` —— 一处再导出，带「V2 契约一律 v4」的边界注释。
- **`docs/v2` 按 R17 改**（R 表赢、doc 改）：`01-contracts.md §2` 整节重写（两层的说明 + 逐字段 +
  删掉项的清单 + 镜像的代价）；`02-implementation-plan.md` 的 Vision Prompt 清单**与契约对齐**
  （删 `rendering` / `animation` / `readability`）· 两处 `references.styleImages` → `styleReferences`；
  `03-claude-code.md §8` 同理。

### 6. 播给下游的

- **[票 03](03-contract-intent-and-design.md) / 04 / 05 / 06**：R2-Q4 那条边界（**R7 只管新字段**）
  会在这四张票上被同一条理由反复撞 —— 已经写进 `visual-world.ts` 的文件头，别再各自推导一遍。
- **[票 08](08-vision-analyze-reference.md)**：`style.id` 是**调用方注入**（R4-Q1）——
  提示词把 `<styleId>` 递给模型让它照抄（先例 `ops.ts:86`），**解析后强制覆盖**。
- **[票 15](15-pipeline-create-game.md)**：**包内要不要带一份 VWS 未定**（R2-Q5）—— 别在 `pack.ts` 里补，
  那是这张票的地盘。
- **[票 12](12-asset-planner.md)**：`constraints` **在 VWS 里**（R1-Q5），而它今天在生图路上被丢掉了
  （事实 4）—— 接提示词渲染时先看[票 30](30-constraints-not-in-image-prompt.md)。
