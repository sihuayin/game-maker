# 02. `VisualWorldSpec` 落地：新契约与 `StyleSpec` 并存，六桶不进取值域

Type: grilling
Status: open
Owner: —
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

（待解）
