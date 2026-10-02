# 29. `stylespec.json` 从来没有被 schema 验过 —— 要不要给它一道闸

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 由[票 02](02-contract-visual-world.md) 的 **R1-Q8** 毕业。票 02 只加了**回归测试**
> （`packages/contracts/tests/visual-world.test.ts` 里四处 `safeParse`），
> **没有**动 `ops.ts` 的裸 cast —— 因为那是**行为变更**，不该夹带进契约票。
> ⚠️ 本票面积**比票面看上去大**：`parseWith`（`zod-issues.ts:44`）**全仓库零调用者**，
> 也就是说「Zod 错误 → 人可读」这个入口本身也还挂着。

## Question

**`StyleSpec` 有一份 schema，而磁盘上没有任何一份 `stylespec.json` 走过它。**

今天读 `stylespec.json` 的两处**运行时代码**都是裸 cast：

```ts
// packages/assets/src/ops.ts:63   （derive 的输入）
const style = JSON.parse(fs.readFileSync(opts.stylePath, "utf8")) as StyleSpec;

// packages/assets/src/ops.ts:840 （pack 的输入，styleRef 指向的那份）
const style = JSON.parse(fs.readFileSync(styleAbs, "utf8")) as StyleSpec;
```

`as StyleSpec` 是**编译期的谎**：它一个字段都不验。而 `StyleSpecSchema` 是有真内容的 ——
`palette` 必须是规范化的**小写 `#rrggbb`**、**不得重复色**、`confidence ∈ [0,1]`。
一份 `{"id":"x","identity":[],"confidence":2}` 今天能**一路走到生图**。

⚠️ 但这条**不是**「谁忘了写一行」，是**判据没有落点**：票 02 立 §4 判据时才发现，
`fixtures/style-spec.json` **没有任何测试读过它**，两个包内那份只被**逐文件 checksum** 盖住 ——
那证明的是**字节没变**，不是**它是一份合法的 `StyleSpec`**。

要裁决的：

1. **加不加这道闸？** 加了，`derive` / `pack` 会在**今天悄悄通过**的坏文件上开始报错 ——
   这正是 R16「旧路径不动」要小心的地方：**先量一下有多少存量会被拒**（仓库里能找到的
   每一份 `stylespec.json` 都跑一遍 `safeParse`），别让修复本身变成破坏。
2. **闸放在哪一层？** ① `ops.ts` 两处裸 cast 就地改成 `parseWith(StyleSpecSchema, …)`；
   ② 再往外一层，在 CLI 入口收（`--style` 与 `styleRef` 各自解析的时机）；
   ③ 只在**新链**（票 15 的 pipeline）收，旧的两处**认了**。
3. **`parseWith` 那笔账**：它零调用者。是顺手让它上岗，还是承认它是个为将来留的空壳、
   连同 `formatIssues` 的再导出一起清掉？（`drawlist.ts:14-16` 那条再导出注释说它是为了
   「免得既有调用方一行都要改」—— 但既有调用方**一个都没有**。）
4. ⚠️ **与 R6 的边界**：票 02 刚把 `StyleSpecSchema` 钉死为**一个字不改**。
   本票若真要「改它才能加闸」（例如收紧某个字段），那就是**撞 R6** —— 得重新开票，不能由本票覆盖（R17）。

## Answer

（待解）
