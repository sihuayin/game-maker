# 22. 视觉观察要**喂原图**：`reviewPack` 今天比的是 contact sheet，不是参考图

Type: grilling
Status: claimed
Owner: claude (2026-10-10)
Blocked by: 02, 06
Map: ../map.md
> 由 `packages/assets/src/review.ts:93` 与 `:6` 的对照量出来的缺口。
> `review.ts:6` 那条纪律（「只说差异、不说好坏」）是**本图的资产**，不是欠债。

## Question

今天 `reviewPack` 把**包里图集拼出来的 contact sheet** 发给视觉模型（`review.ts:93`），
配上 `StyleSpec` 的**文本** brief（`review.ts:80-105`）——**原参考图根本没参与**。

要答的是：**这是不是一个缺口**，以及**补它要付出什么**。

### 1. 先判：它是不是缺口

两种读法：
- **(a) 是**：`03 §21` 的 `styleSimilarity` 要「与原图比」，而今天**没有任何东西可比**
  —— 那这一条在补上之前**根本算不出来**（无论它最终是判据还是观察）。
- **(b) 不是**：`CONTEXT.md:351-362` 的 [[绘制词汇]] 裁决说参考图**没有色板摘要可摘**
  （122,240 种颜色、最高占比 1.42%），所以「与原图比」这个动作**本身可能就是错的**——
  R2 拆掉的正是这种「不准的代理量」。

⚠️ **这两条读法指向相反的结论**，本票必须判一个。判 (b) 的话，
`styleSimilarity` 就**整个取消**（不是降级成观察），并把理由写进 Answer。

### 2. 若判 (a)：原图从哪来

承 R15（原图只存**引用**）。要答：`reviewPack` 是**读 `VisualWorldSpec.references.styleImages`
指的那个文件**，还是**接收一个额外的参数**？⚠️ 后者会把「原图」变成**可选**的，
于是同一条观察**有时报得出有时报不出** —— 那要么是判据（缺图就拒绝），要么要在报告里**明说**。

### 3. 已有的纪律不许破

`review.ts:6` 那句注释是**裁决过的措辞**：

> ② **它只说差异，不说好坏。** prompt 里明确要求「描述你看到的差异」，**不要求打分**。

⚠️ 补原图时**最容易顺手做的事**就是让它顺便打个分 —— 那是 R3 明说不许的。
要答：新 prompt 的**措辞**（最好把 `review.ts:6` 那句原文保留在注释里）。

### 4. 与 `VisualWorldSpec` 的关系

票 02 之后 `VisualWorldSpec` 是**世界语法**（能约束参考图里没出现过的新事物，
`CONTEXT.md:56-62`）。要答：视觉观察是拿**原图**当参照，还是拿 **`VisualWorldSpec`** 当参照？
⚠️ 后者的好处是「新事物」也在语法里，而前者的好处是不会骗自己 —— `CONTEXT.md:56-62` 那条
「产物 A 验收第 2 条」要的正是**后者**（新事物也要像同一个世界）。

## Answer

（待解）

## Comments

⚠️ **2026-10-10 · 认领 + 第 1 轮已出**（`Status: claimed` · `Owner: claude (2026-10-10)`）。
轮次全文（自包含，供离线作答）：[`clarifications/22-review-round-1.md`](../clarifications/22-review-round-1.md)。
**3 问**（Q1 是不是缺口 · Q2 本票射程 · Q3 词表），**已拷进剪贴板**。等答案，未解。

⚠️ **出题前挖到的四条，改变了票面的形状**（逐条带出处在上面那份副本里）：

1. **票面 §1 那句引用在 `03 §21` 里没有字面** —— §21 只列七个检查**名字**，**没有一句**说「与原图比」。
2. **那七项已被[票 17](17-qa-visual-judgements.md) 全判成观察**，且「`similarity` 这个词一次都不许进契约」
   ⇒ §1 读法 (a) 里「算不出来（无论判据还是观察）」这句，**判据那一半已经不成立**。
3. ⚠️ **`reviewPack` 今天零消费者**（全仓只有 `packages/assets/tests/review.test.ts` 调它），
   而 `packages/qa/src/assemble.ts:133` 把 `qa-report.json` 的 `review` 观察**硬写 `unavailable`**，
   **理由原文就是本票的未决问题**（「它今天比的是联系表、不是参考图」）
   ⇒ **[票 20](20-qa-report-assembly.md) 把本票的开着状态写进了产物措辞**，本票一解那句话就过时。**Q2 问的就是它。**
4. **原图够得着**（`run/v<N>/reference.png` 与 `stylespec.json` 同目录，`plan-assets` 今天就在读它，
   `packages/assets/src/ops.ts:174`）⇒ 若判 (a)，「够不着」不是障碍。

⚠️ **本轮没动任何代码、没花任何钱**（`reviewPack` 零消费者，真链上一次都没跑过 ⇒ 本票到今天**零真跑读数**）。
