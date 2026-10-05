# 探针：`toolInputSchema(VisualWorldSpecSchema)` 真能产出可用的 `input_schema` 吗

**纯本地，零网络。** 没有 fetch、没有凭据、不写 packages/。
回答的是票 28 那句「转换器不替契约作者表态」到底成不成立，以及**票 27 那 4/5 量的到底是不是这份契约**。

跑法：
```
node .scratch/game-maker-v2/experiments/vws-schema-probe/run.mjs
```
（`packages/contracts/dist/` 必须是新的；如过期先 `npx tsc -b packages/contracts`。）

⚠️ `.scratch/` 不在任何包的 `node_modules` 底下，裸 `import "zod/v4"` resolves 不了 ——
探针借 contracts 的 `createRequire` 去 resolve，再按绝对路径 import。这是唯一一处小机巧。

## 结论（一句话）

**`toJSONSchema` 一声没吭，产出的是一份结构上完整、可直接当 `input_schema` 用的 JSON Schema** ——
13 个顶层键全在、`strictObject` 的封口全在、`materials` 的开集也没被转换器擅自封上。
唯一的**实质损失**是 `.superRefine()`（两处：重复色、路径合法性）被**静默丢弃** ——
而它们的 Zod 校验在 `safeParse` 那一侧照旧生效，只是**模型看不见**。
**但票 27 那发 4/5 用的不是这份 schema**（见 §8b）：那份是手抄的，12 键里只有 5 键同真契约对得上。

## 逐条判据

| 问 | 答 |
|---|---|
| `toJSONSchema` 抛了吗 | **没抛**，stderr 0 字节，无 warning |
| 顶层 `additionalProperties: false` | ✅ |
| 嵌套 `strictObject` 封口 | ✅ 契约里 **11 个 `z.strictObject` 一个不落**全拿到 `additionalProperties: false`（逐个点名见下）；另外 4 处是**故意开集**的 `z.record`，转换器**没有**把它们封上 |
| 开集那 4 处 | `$.materials`（键开集、**值仍封口**）· `$.style.camera` · `$.style.composition` · `$.style.lighting`（后三者 `additionalProperties: {}`，真开集） |
| `materials` 开集 | ✅ 保住了：`{type:"object", propertyNames:{type:"string"}, additionalProperties:{…值形状…}}` —— 键名任意，**值封口**。转换器**没有**替契约作者表态 |
| `PaletteShape.superRefine` | ⚠️ **整段丢掉**。`style.palette` 仍是 `{type:"array", items:{type:"string", pattern:"^#[0-9a-f]{6}$"}}`（外加 `default: []`），**没有 `uniqueItems`**，「不得重复色」在模型那份提示里**不存在** |
| `StyleReferencePath.superRefine` | ⚠️ 同样丢掉，`styleReferences[].path` 只剩 `{type:"string", minLength:1}`（`.min(1)` 活下来了，三条路径检查没活） |
| `z.literal("visual-world/v1")` | `{type:"string", const:"visual-world/v1"}` —— 是 `const`，**不是** `enum` |
| `z.enum` | `{type:"string", enum:[…]}` ✅ |
| `.optional()` | ✅ 不进 `required`（`styleIdentity.required = ["keywords","description"]`，`styleName` 缺席；`camera.required = ["mode"]`） |
| `.default()` + `io:"input"` | ✅ 如设计：`style.camera/composition/lighting/palette/…` **不进 `style.required`**（只有 `id`/`identity`/`confidence` 必填）。同一份 schema 用 `io:"output"` 它们就全进 `required` |
| `$ref` / `$defs` / 环 | **零个 `$ref`、无 `$defs`**。zod 把结构**全部内联**，所以既没有环也没有复用。深度 7 |
| 顶层 `$schema` | 已被 `toolInputSchema` 摘掉（顶层键 = `type, properties, required, additionalProperties`） |
| 守卫 | 喂 v3 的 `ZodObject` **当场抛**（`toolInputSchema 只吃 zod/v4…`）✅ |


逐个点名（探针 §3a 只走 `properties`/`items`，下面这份是把每个 `strictObject` 直接点出来）：

```
false    $ 顶层                    false    $.character
false    $.styleIdentity           false    $.environment
false    $.camera                  false    $.styleReferences[]
false    $.composition             false    $.style
false    $.palette                 false    $.materials.*（值形状）
false    $.lighting
开放     $.materials（本身）· $.style.camera · $.style.composition · $.style.lighting
```

## 体积 / token

| | 字节（`JSON.stringify`） | 缩进 2 落的盘 | token 粗估 |
|---|---|---|---|
| 全量 13 键 | **3956** | 7541 B / 367 行 | **~990–1100** |
| `.omit({style:true})` 瘦身版 12 键 | **2952** | 5524 B | **~740–820** |

`style` 子树占 **1004 B（25.4%）**；单字段最肥的是 `palette`（624 B，六个桶各抄一遍 `^palette:\d+$`）。

⚠️ token 是**估的**：本机没装任何 tokenizer（无 `tiktoken` / `@anthropic-ai/tokenizer`），
只给了 `bytes/4` 与 `chars/3.6` 两个界。要真数得走 `count_tokens` —— 而本探针不联网。

## ⚠️ 与票 27 的关系（最要紧的一条）

票 27 那发探针的 `VWS_SCHEMA` 是**手抄的**（它自己的注释写着「逐键照抄 docs/v2/01-contracts.md §2」）。
键集对比：**12 键，只有 5 键与真契约同名**（`camera/palette/materials/character/environment`）。

- 只有票 27 有：`schemaVersion · identity · rendering · animation · readability · references · confidence`
- 只有真契约有：`format · styleIdentity · composition · lighting · shapeLanguage · constraints · styleReferences · style`

⇒ **4/5 这个数不能搬给这份契约**。两份 schema 的键、嵌套深度、必填集都不同，量到的是两张不同的表。
（复现那份数需要重跑 `../tool-choice-probe/run.mjs` 并把 `VWS_SCHEMA` 换成 `raw/visual-world.tool.json` ——
那要联网，本探针不做。）

## 产物

- `raw/visual-world.tool.json` —— 全量转换结果（可直接贴进 `tools[].input_schema`）
- `raw/visual-world-slim.tool.json` —— 去掉 `style` 的瘦身版

## 没量到的（诚实清单）

- **真实 Anthropic API / 代理收不收这份 schema**：`const` / `propertyNames` / `additionalProperties: {}`
  都是 draft 2020-12 的合法关键字，但**代理对未知关键字的处理已实测是「收下并静默忽略」**
  （票 27 第 6/7 发）。本探针**不联网**，所以这一档一条都没验。
- **schema 本身是不是合法 JSON Schema**：本机没装 ajv，没跑过 meta-schema 校验。
