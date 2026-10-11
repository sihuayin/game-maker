# 44. 色板缺席时闸放行 —— 失败落在**花钱之后**，而报错指向 drawlist

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 29「`stylespec.json` 从来没有被 schema 验过 —— 要不要给它一道闸」](29-stylespec-parse-gate.md)。
> 人类在那一票的 **Q1 边界**里把它**明确划出去**，原话：
> 「`palette` 缺失时，schema 的 `.default([])` 可能使校验通过，但后续代码仍可能因缺少色板而报错。
> 不要把 schema 校验通过误认为业务数据必然可用。**本票是否额外要求拒绝缺失色板，应依据现有契约和消费者要求，
> 不擅自扩大校验范围。**」
> ⇒ 票 29 **故意没做**，并把它**钉成一条 characterization 测试**（`style-gate.test.ts` 最后一个 describe）记死今天的后果。

## Question

票 29 的闸今天拦得住 8 类坏 `stylespec.json`（**全在花钱之前**，退出码 4），
**唯独拦不住「色板缺席」这一类**：`StyleSpecSchema.palette` 带 `.default([])`
⇒ `{"id":"x","identity":[],"confidence":0.9}`（**整个 `palette` 键都不在**）**过闸**。

票 29 量到它今天有**两条**去路，取决于这份 drawlist 用没用色板引用：

- **(a) 用了 `palette:N`**（实测最常见）⇒ 光栅化器先炸，且**上游已经被调过（钱花了）**；
  而报错是 `drawlist "c" ops[0]: 颜色引用 "palette:0" 越界（色板只有 0 项）`
  —— **指向 drawlist，指错了方向**：病根在 stylespec，它一个字不提。
- **(b) 一个色板引用都没用** ⇒ **包被写出来了**，`palette.size = 0`。⚠️ 而 `pack.ts`
  **从不校验自己产出的清单**（`parseAssetPack` 只在**读**既有包时调：`ops.ts:598 / 902 / 1262 / 1383`）
  ⇒ 一份**违反自己契约**的包落了盘 —— `assetpack.ts:241` 写的是 `size: z.number().int().positive()`，
  且 `:246` 还会查 `values.length === size`。要等下一次 `verify` 才被发现。

要裁决的：

1. **加不加这条闸？** 人类给的判据是「依据**现有契约和消费者**要求」。契约那一侧今天**是明确的**
   （`palette.size` 必须 `positive` ⇒ 空色板包**本就是非法产物**）；**消费者那一侧要人判**
   —— 也就是「有没有哪条路**故意**要一份空色板的包」（今天没量到，但这是设计问题，不是清点问题）。
2. **加在哪一层？** ① `readStyle` 里（与票 29 的闸同一处，判据 `style.palette.length === 0`）；
   ② 更靠后 —— `buildAssetPack` 写完清单后**自校验**（顺带补上「`pack.ts` 从不验自己的产物」这个更大的洞）；
   ③ 不加，认了（先例：`derivePackMode` 把「fixture 包谎报 generated」做成**解析不通过**而非约定）。
3. ⚠️ **与 R6 的边界**：`StyleSpecSchema` 被票 02 钉死为**一个字不改**。若修法是「去掉 `palette` 的
   `.default([])`」，那是**撞 R6** ⇒ 得走 R17 另开票，**不能由本票覆盖**。
4. **报错该指向谁？** 无论选哪条路，(a) 那条**指错方向**的报错都要单独处理 ——
   它是「错得安静」的近亲：报错是真的，但指向的是**受害者**而不是病根。

## Answer

（待解）
