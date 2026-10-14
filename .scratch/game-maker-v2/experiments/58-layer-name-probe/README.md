# 票 58 探针：「层名不许重复」这条规矩**能放进哪一层**

**为什么要有它**：票面那句「创作侧的 `BackgroundSpec.layers`（= `Layer.extend(...)`，
与交付侧**同一个定义的镜像**）没有这一条」—— 但**把那条规矩补回创作侧**这件事，
**不是想补哪儿就补哪儿**：`Layer` 与 `BackgroundSpec` 在 zod 里都有结构约束。
本探针把「**哪些落点物理上可行**」量成读数，而不是从注释里推。

**免费**：只 `require` 已构建的 `packages/contracts/dist`，不碰网络、不跑管线、零付费。

## 怎么跑

```bash
node .scratch/game-maker-v2/experiments/58-layer-name-probe/probe58.cjs
```

原始输出在 [`raw-output.txt`](raw-output.txt)（每次重跑覆盖）。

## 量到了什么（2026-10-13 · 票 58 第一轮）

| # | 问 | 读数 |
|---|---|---|
| ① | 创作侧 `AssetSpecSchema` 收不收同名层 | ✅ **放行**（对照组层名不同也放行 ⇒ 不是别的理由绕过了） |
| ② | 那条规矩能放在 `Layer` 上吗 | ❌ `TypeError: extend is not a function` —— `LayerSpec = Layer.extend(...)`（`asset-spec.ts:96`）当场崩 |
| ② | 能放在 `BackgroundSpec`（union 成员）上吗 | ❌ `TypeError` —— `.superRefine()` 把它变成 `ZodEffects`，`discriminatedUnion` 只收 `ZodObject` |
| ② | 能放在 `AssetSpecSchema`（union 这一层）上吗 | ✅ **可以** —— 与「九宫格中央区」同一个落点 |
| ③ | 交付侧 `AssetPackEntry` 拒不拒 | ❌ **拒**：`帧名重复："bg-a.far"` · `层名重复："far"`（票 46 读数复现） |
| ④ | 模型面向的 `AssetSpecShape`（v4 镜像） | ✅ **放行** —— 镜像里一个 refine 都没有，**模型看不见这条规矩** |
| ⑤ | 真配方过不过闸 | `fixtures/recipes/last-train.json` 的 `bg-dusk-halt`（`sky/wall/ground`）改成 **`sky/wall/sky`** ⇒ `parseRecipe` **照样 `ok`** |
| ⑥ | 顺带：「九宫格中央区」是不是反向的单侧规矩 | 创作侧拒（`40 ≥ 宽度 32`）；交付侧**表达不出**「中央区空」（`w` 必须 `positive()`）⇒ **不是同类病**。⚠️ 但交付侧**不拿 `scale9Borders` 跟 `size` 对账**（`x+w=40 > size.w=32` 照样放行）—— 那是**另一条**缝，本探针只登记 |

⚠️ **探针第 1 版作废**：它漏了 `COMMON` 里必填的 `description`，① 与 ④ 的读数是无意义的
「Required」而非真读数。第 2 版补上后重跑，上表是第 2 版的。
