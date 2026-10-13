# 58. 「层名不许重复」只住在交付侧 —— 创作侧那份镜像漏了它，于是走到**花完钱之后**才被拒

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 46「`buildAssetPack` 从不验自己的产物」](46-buildassetpack-self-validation.md)的 **Q6**。
> 人类在那一票的 Q6 **明确把它划出去**，原话：
> 「**本票只接线；契约收紧另开票。**自校验是通用的提交前防线，契约收紧则是在花费之前拒绝已知非法输入，
> 两者解决不同层次的问题。**不能把契约变更混进本票**，避免改变范围、混淆测试判据，
> 也遵守 **R6/R17** 的变更纪律。」
> ⇒ 票 46 **故意没做**，只把自校验那道**提交前的兜底**接上（`pack.ts:1147` 与 `:1175` 之间）。

## Question

**票 46 量到的那条进路，根因不在「生产者没验」，而在「一条规矩只住在一半」。**

```
交付侧  packages/contracts/src/assetpack.ts   AssetPackEntry.superRefine   ✅ 层名重复："…"
创作侧  packages/contracts/src/asset-spec.ts  BackgroundSpec.layers         ❌ 没有这一条
        （= Layer.extend(...)，与上面**同一个定义的镜像**）
配方闸  packages/contracts/src/recipe.ts      superRefine                  ❌ 没查层名
        （查了：assets[].id 重复 · authoring[].id 重复 · masterAsset 指得着 · reference×masterAsset 打架）
```

⇒ 一份「两层同名」的配方**过得了** `parseRecipe`、**过得了** `readStyle`，然后：
**先花钱把图生成出来**，最后才被票 46 新加的那道自校验拒掉。

⚠️ **这不是纸上谈兵、也不是罕见形状**：真实包里分层背景是常态
（`bg-dusk-halt` 的 `sky/wall/ground` · `counter-siege` 的 `floor/fittings` · `last-train` 十几个版本都是三层）。
今天盘上那些**恰好**层名互不相同 —— **是运气，不是闸**。

**要裁决的**（留给下一轮 grill，此处只列边界）：

1. **补在哪一层？** 创作侧的 `BackgroundSpec.layers`（`Layer` 是**共用的**一个定义，加在这里要小心
   `Layer` 还被 manifest 侧用着）· 还是配方闸 `recipe.ts` 的 `superRefine` · 还是两处都补？
2. **这是「收紧契约」还是「让同一个定义的两半说同一句话」？** 交付侧那条一旦成立，
   创作侧允许 `[far, far]` 就是**一份产不出合法包的配方**（不可满足）⇒ 拒它算不算**新增约束**？
   ⚠️ 这一问直接决定走不走 **R6/R17**。
3. **还有没有**别的「只住在一半」的规矩？（票 46 只量到了这一条，**没有全量证否**——
   与票 44 那句诚实交代同款。）
4. **代价对照**：免费探针（票 46 的 `experiments/46-self-validation-probe/`）能证明修法是**不误杀**的；
   「模型读到新散文之后是不是真的不再写重复层名」**只能真跑**（属票 23，另出报告 + 逐次明确同意）。

⚠️ **与票 46 的边界**：票 46 的自校验**留着**（它兜的是**任何一条**、且是**离开进程之前**的最后一道）；
本票**不得**以「反正票 46 已经兜住了」为由收窄范围，也**不得**反过来把票 46 那道闸说成多余 ——
两者解决的是**不同层次**（这是 Q6 裁定原话）。

## Answer

（待解）
