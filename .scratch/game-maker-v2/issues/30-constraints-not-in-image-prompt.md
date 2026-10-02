# 30. 生图提示词漏了 `constraints` —— 而注释从第一天就在说它没漏

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 由[票 02](02-contract-visual-world.md) 落地时**顺手量到**（Answer §3 事实 4）。
> 票 02 判了 `constraints` **进** `VisualWorldSpec`（R1-Q5，理由是它在
> `prompt.ts` 的 `styleBrief` / `review.ts` 里有**今天就在跑**的消费者）。
> 而量那一步时发现：**它在生图那条路上根本没有消费者** —— 只是一直没人说破。

## Question

`packages/assets/src/prompt.ts:217` 的注释写着：

> 所以这里只取 **identity / material / constraints**，把 camera 换成"正交、无透视"的一句。

而紧挨着它的三张生图模板（`:295-296` / `:328-329` / `:376-377`）**只吐了前两个**：

```ts
这个世界的视觉语法：
identity: ${JSON.stringify(style.identity)}
material: ${JSON.stringify(style.material)}
```

**`constraints` 一个字都没进去。** 而那正是 `StyleSpec` 里唯一装着**可执行约束**的字段 ——
两份 fixture 里的 `"严禁使用抗锯齿与柔边"` / `"no pure black or pure white"` /
`"palette locked to desaturated teal-gray dominance; warm orange/cream accents limited to under 15% area"`
全在这儿。**它们一次都没有到过生图模型眼前。**

⚠️ **这不是回归，是从第一天就写错的注释。** `git show 593c327:packages/assets/src/prompt.ts`
（「生图路线落地」那次提交）里，注释已经这么写，而它下方的模板已经只吐 `identity` ——
⇒ 那句话描述的是一个**从未实现过的意图**。所以两个读法**都说得通**，得选一个：

1. **代码错**：`constraints` 该进去，补上。代价：**会改变现存的生图结果** ——
   而现有交付态的包是拿旧提示词产出来的（`fixtures/packs/*` 的 checksum 也会跟着变），
   这触碰「旧 fixture 不许坏」。
2. **注释错**：`constraints` 是**故意**不进去的。⚠️ 注意 `:213-216` 记的那两条**实测教训**
   说得很具体（「风格块整段给它，模型会画面板而不是物体」）—— 如果 `constraints` 是同一批
   实验里被剔掉的，那注释只是漏改了一处措辞，**代码才是对的**。
   ⇒ 那就要把注释改成实话，并把「`constraints` 只喂 drawlist 路」写成**明示**。

⚠️ **它为什么在这张图上**：票 12（Asset Planner）接提示词渲染时**必然撞上这一格**。
现在不改，就是让票 12 的人在一个**注释说 A、代码做 B** 的地方做决定。

⚠️ 一处**不要**顺手做的：**别把 `constraints` 当成判据**。它是自由文本
（票 39 Q4 已判 `constraints` 结构化「不」，理由是它有个**提示词的**消费者，不是校验器的消费者）。

## Answer

（待解）
