# 57. 资源级的 `AssetOrigin.fixture` 零生产者 —— 留、删、还是等一个生产者？

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 45](45-style-provenance-origin.md)。人类在那一票**Q2 的裁定**里把它切出来，原话：
> 「**资源级 `AssetOrigin.fixture` 与 `provenance.style.origin` 不是同一种问题。前者有明确的潜在生产场景，
> 不能仅凭当前零生产者就删除；但将其解释为「仓库内置降级件」已与降级机制退出的事实冲突。
> 本票只修正文档定义，不改变资源级枚举、派生逻辑或既有包行为。**」
> 即：**机制处置留待独立裁定**（票 45 只更正了 `CONTEXT.md` 里那句过期的话）。

## Question

票 45 删掉了 `provenance.style` 整块，顺带量到**第二个零生产者**：资源级的 `AssetOrigin.fixture`。

今天的三处（`packages/contracts/src/assetpack.ts`）：

```ts
export const AssetOrigin = z.enum(["generated", "imported", "fixture"]);   // :102
export const PackMode    = z.enum(["generated", "imported", "fixture", "mixed"]);  // :115
export function derivePackMode(...) { ...; if (allOf("fixture")) return "fixture"; }  // :121
```

⚠️ **全仓零写点**：`grep '"fixture"' packages/*/src/*.ts` 只命中**上面这三行自己** ——
枚举声明、`PackMode` 声明、`derivePackMode` 里那一个分支。**没有任何地方产出一个 `"fixture"` 资产。**
⇒ 两份签入的包（`counter-siege/v4` · `last-train/v2`）资产全是 `generated`，`mode` 也就是 `"generated"`。

⚠️ **而它和票 45 那一块不是同一种病**（Q2 依据里说的）：`provenance.style` 是「**有**一格、装有假话」，
`AssetOrigin.fixture` 是「**有一档、没人用」** —— 前者删掉不欠谁，后者删掉**可能堵死一条还没走的路**。

⚠️ **但也别把它读成「等等就会有人用」**。本仓有一个**正面先例**和一个**反面先例**，指向相反：

- **正面**（留着对）：`LedgerStep` 里的 `"derive"` / `"compile-game"` 被后继值取代了却**不删** ——
  因为**磁盘上已有的 `ledger.json` 要照旧解析得过**（闭集，`parseLedger` 用它验）。
- **反面**（留着错）：`"fixture"` **没有磁盘人口** —— 没有任何已产出的文件靠它才能解析。
  ⇒ 「为旧文件留着」这条理由**对它一个字都不成立**。

要裁决的：

1. **它有没有一个具体的生产场景？** 「仓库内置件」（直接取用 `fixtures/` 里已有的资产，
   不经这一次生成、也不是这一次的人工导入）在 V2 链上**落不落得到**？
   落得到的话，落到哪一步（配方里的哪一格？包装配期的哪一支？）—— **点得出落点，它就该留**。
2. **落点若在 `source.kind` 那一侧**：那是 `recipe.ts` 的地盘，本票与它怎么分工？
3. **`PackMode.fixture` 要不要跟着动？** 它与资源级那一档是**两处同名的东西**
   （`derivePackMode` 把二者绑在一起）—— 动一处不动另一处，`derivePackMode` 那条「两头对账」的
   `superRefine`（`assetpack.ts:280`）会不会立刻自相矛盾？
4. **若判定「留」**：§0 里那句 `CONTEXT.md` 的新写法定得住吗？要不要补一条**指得出落点**的注
   （否则下次扫「零生产者」还会把它扫出来，票 45 就是这么撞上的）。
5. **若判定「删」**：⚠️ 它是**闭枚举收窄**，与票 45 同样是**升版**（`assetpack/v3 → v4`）——
   按票 45 §0.3 那份清单走一遍（常量、注释、入库 manifest、相关测试、文档引用）。
   ⚠️ 而这次的代价**比票 45 小**：**磁盘上没有一份包用着这一档**（正是它零人口的证据）。

## Answer

（待解）
