# 57. 资源级的 `AssetOrigin.fixture` 零生产者 —— 留、删、还是等一个生产者？

Type: grilling
Status: resolved
Owner: claude (2026-10-13)
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

### ✅ 裁定回来了（2026-10-14 · **设计裁定** —— 原话逐字，未删改）

> ⚠️ **这一节只是裁定的抄录。** 它**不是施工授权** · **不代表**已修改源码 / 测试 / 文档或地图 ·
> **不授权**真跑 / 付费调用 / 提交代码 · **也不等于关票**（`Status` 仍为 `claimed`）。

| 题 | 你的裁定 |
| --- | --- |
| Q1 是否存在明确落点 | (b) 删除。当前材料没有指出 L1–L5 之外可成立的生产落点；L1 已由 `imported` 正确表达。 |
| Q2 与 `recipe.ts` 的分工 | 不适用，仅在 Q1 选 (a) 且落点属于 L2 时回答。 |
| Q3 若保留，如何处理文档与扫描 | 不适用，仅在 Q1 选 (a) 时回答。 |
| Q4 删除的代价 | (a) 按清单升级 `assetpack/v3 → v4`。 |
| Q5 `PackMode.fixture` 是否同步删除 | (a) 与 `AssetOrigin.fixture` 一起删除；同步清理 `derivePackMode` 对应分支。 |

#### 补充裁定与边界（原话逐字）

- 删除 `AssetOrigin.fixture` 与 `PackMode.fixture`，并按附件清单处理契约、测试、文档和两份入库包的 `format` 字段；不修改 `assets/src/pack.ts` 写入侧。
- `CONTEXT.md` 的 `Fixture Asset Pack` 词条中，依赖已出局的「降级标注」机制的理由必须重写。无论 Q1 选哪一支，都要处理这处过期理由；理由应改为产物 B 的验收需要一份不依赖生图的输入。
- 不在本票增加全仓「零生产者」扫描；如需防止类似问题再出现，另立票。
- 不动 R 表、提示词、`packages/qa` 或 `game-maker.local.json`；本裁定不授权实施。

⚠️ **一条读票时容易漏的（本 session 的读法，不是裁定原文）**：Q3 那一行标着「不适用」，
而补充裁定第 2 条把 **`CONTEXT.md` 的 `Fixture Asset Pack` 词条重写**独立于 Q1 的分叉**要求了**
⇒ **施工时那一处不能因为「Q3 不适用」而跳过**。
⚠️ **派生票**：补充裁定第 3 条说「零生产者扫描……如需……**另立票**」—— 那是**有条件的**，
本 session **没有**据此开票。**没有施工、没有提交、没有关票。**

---

### ✅ 施工放行 + 落地记录（2026-10-14 · 第二轮）

> ⚠️ **本节新增的只有两样**：**施工授权**与**它落地成了什么**。上面那张裁定表**一字未动**。
> ⚠️ **不关票** —— 人裁原话：「本轮批准的是决策与有限施工范围，**不是**付费运行许可、
> **提交许可**或**关票许可**。」⇒ `Status` 仍为 `claimed`。

#### 授权原话（逐字）

| 题 | 你的裁定 | 理由与边界 |
| --- | --- | --- |
| A3：放行施工 | **(a) 57 与 58 放行；62 与 22 先开票** | 57、58 按既定裁定范围施工；22 的接线和 62 的改动必须先经各自派生票裁定。 |

补充边界第 5 条原话逐字：

> 票 57： 按既定范围删除 `AssetOrigin.fixture`、`PackMode.fixture`，升级 `assetpack/v3 → v4`，
> 更新相关契约、测试、文档及两份入库包的 `format` 字段，并重写 `CONTEXT.md` 的 `Fixture Asset Pack` 理由；
> 不改写入侧、不加全仓零生产者扫描。

#### 落地了什么（逐处 · 全部盘上可查）

| 处 | 文件 | 改了什么 |
| --- | --- | --- |
| 契约 | `packages/contracts/src/assetpack.ts` | `AssetOrigin` 去掉 `"fixture"` · `PackMode` 去掉 `"fixture"` · `derivePackMode` 里 `allOf("fixture")` 那一行删 · `ASSET_PACK_FORMAT` `v3 → v4` · 文件头加一段带日期的理由（含**为什么是删、不是留**：零生产者 **+ 磁盘人口为零**，对比 `LedgerStep."derive"` 留着的那条理由——它**有磁盘人口**） |
| 契约注释 | 同上 · `provenance.mode` | 「谎报」举的例子从 `fixture` 换成 `imported`（原例子已不在枚举里） |
| 测试 | `packages/contracts/tests/assetpack.test.ts` | `format` 改 v4 · 删两条 `derivePackMode(["fixture", …])` 断言 · **换成一条「枚举不收 `fixture`」的钉子** · 两处过期测试名 + 版本注释改 |
| 测试 | `packages/contracts/tests/recipe.test.ts` | 一处样例字面 `assetpack/v3 → v4` |
| 测试 | `packages/assets/tests/ledger.test.ts` | 一处 `format` 断言改 v4，并加一句注释说明这次升版与账无关 |
| 入库包 | `fixtures/packs/counter-siege/v4/manifest.json` · `fixtures/packs/last-train/v2/manifest.json` | 第 2 行 `format` 改 `assetpack/v4`（**只动这一行**） |
| 词条 | `CONTEXT.md` | [[AssetPackManifest]] 版本沿革补 v4 · [[Provenance]] 两处枚举去掉 `fixture`，并记下「票 45 当年没裁这一格、那一票就是本票」 · **[[Fixture Asset Pack]] 的理由整段重写**（原话**两半都过期**：降级链 2026-09-25 已出局、`fixture` 档位 2026-10-14 已删） |

#### ✅ 闸门（2026-10-14 · 零付费）

`pnpm build` 干净 · `pnpm typecheck` 9 包干净 · `pnpm check:deps` ✅ 9 包 ·
`pnpm check:links` ✅（262 份文档 · 1446 条链接）· `pnpm test` **83 文件 / 1426 测试全绿**。

#### 边界（照实记）

- ✅ **`packages/assets/src/pack.ts` 最终 diff 里零改动** —— 写入侧那条边界守住了。
  ⚠️ 但要照实说一句：施工中曾为**一句过期的版本号注释**（`pack.ts:84` 写着
  「加一格就是升版（`assetpack/v3 → v4`）」）改过一行又**撤回**。那句话今天确实过期了
  （**v4 就是今天**），但它在**写入侧**，而边界原话是「不改写入侧」⇒ 撤回，只在此记一笔。
  **动那一行要另一次授权**（它不是行为改动，是一句注释）。
- ✅ **没加全仓零生产者扫描**（补充裁定第 3 条：如需，**另立票**）—— 本轮**没有**据此开票。
- ✅ 不动 R 表 · 不动提示词 · `packages/qa` 一行没碰 · `game-maker.local.json` 一个字没动 · **零付费**。
- ⚠️ **提交与关票都没做**（人裁原话）。

---

### ✅ 收口（2026-10-17 · 人裁逐字「收口剩余的 claimed 票」）

> ⚠️ 本轮只做两件：① 本票 `claimed` → `resolved` + 这一节；② 本图 `## Decisions so far` 加一行。
> **源码 / 测试 / 契约 / 提示词 / `packages/qa` 一个字节没动**。

- **裁定**：Q1 (b) 删除 · Q4 (a) `assetpack/v3 → v4` · Q5 (a) `PackMode.fixture` 一起删。
- **施工已落地（2026-10-14）**：`assetpack.ts` 删两档枚举 + 升 v4 · 两份入库包 `format` 改 v4 ·
  `CONTEXT.md` 的 `Fixture Asset Pack` 理由重写 · 相关测试同步。
- ⚠️ **一处照旧没动**：`pack.ts:84` 那句过期版本注释（在写入侧，边界逐字「不改写入侧」）——
  要动它须**另一次授权**。
- ⚠️ **没加全仓零生产者扫描**（补充裁定第 3 条：如需另立票）。
