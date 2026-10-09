# 35. 多帧动画 + 生成的图 ⇒ `background` **事实上必填**，而契约说可选、提示词一个字没提

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 23「E2E fixture + 真跑一次」](23-e2e-fixture-wasteland.md) 的第二次真跑（2026-10-09）。
> ⚠️ **它今天挡着整条链的 `pack` 段**：18/19 件资源都出图成功了，最后卡在多帧那 5 件上。
> 现场：`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out/wasteland-scavenger-run/`。

## Question

### 现象

`create` 跑到 `pack` 段，19 件资源里 **18 件出图成功**，然后**当场抛**：

```text
资源 "scavenger-idle" 的动画 "idle" 是多帧，但 source 没给 `background` ——
分块靠的是抠掉背景之后的 alpha，不抠就切不开（实测会把一整排 4 个角色判成 1 块）。
```

### ⚠️ 它不是偶发：**5/5 全中**

那份配方里只有 5 件是多帧动画，**五件的 `source.background` 全是 `null`**：

| 资源 | 动画 | `source.background` |
|---|---|---|
| `scavenger-idle` | `idle: 2` | `null` |
| `scavenger-run` | `run: 4` | `null` |
| `scavenger-jump` | `jump: 2` | `null` |
| `enemy-idle` | `idle: 2` | `null` |
| `enemy-patrol` | `patrol: 4` | `null` |

**一件都没填 ⇒ 不是模型这次手滑，是它压根不知道有这回事。** 而单帧那 14 件**一件没挂**
（它们走 `frames === 1` 那条分支，`background` 用不上）。

### 三处对得上，这才是病根

1. **抛点**：`packages/assets/src/pack.ts:617` ——
   `if (u.frames === 1) … else { if (!src.background) throw … }`。
   ⚠️ 这个 `throw` 是**对的**（见下「不许糊过去」），错的是**它今天必被触发**。
2. **契约说可选**：`packages/contracts/src/recipe.ts:74`
   —— `background: z.object({ tolerance: … }).strict().optional()`，
   而且**没有任何跨字段规则**把「`animations[].frames > 1`」与它连起来。
3. **⚠️ 提示词一个字没提**：`packages/assets/src/prompt.ts` 里那段的示例把 `source` 写成
   `{"kind":"drawlist|image|import"}` —— **`background` 从头到尾没出现过**。
   ⚠️ 契约里那句自白（`recipe.ts:69-72`）说得很清楚：**这个上游没有透明底（返回纯 RGB），
   所以多半得抠**。⇒ **模型不在场的那件事，它不会去填。**

⚠️ 注意 `import` 那条路的同名字段**语义不一样**（`recipe.ts:102`：「不给就假定人已经给了透明底」）
—— 人给的 PNG 可能自带 alpha，**生成的那张不可能**。⇒ 这个字段在两条路上的**必要性不同**，
而契约没区分。

### ⚠️ 不许糊过去（写清楚，免得下一手顺手加个默认）

- `keyBackground` 是**全局比色、不是连通域**（`recipe.ts:69-72`）：**底色若同时是主体用色，会把主体抠穿**。
  而实测「同类角色的一帧有 73% 的像素就是世界色板的最暗色」⇒ **四角取样在这里是错的**
  （`pack.ts:634-637` 为背景层专门写过这一条：背景层的角上就是内容本身，四角取样会**整层抠光**）。
- `pack.ts:624-629` 那条姊妹 `throw`（帧数对不上）也明说了**不静默取前 N 个** ——
  同一套纪律：**猜出来的切片会让 manifest 的帧名与动画分组对不上**。
⇒ **「给个默认值」不是选项**，除非能说清那个默认凭什么是对的。

### 这一票要答的

1. **收口在哪一层**？
   - **(a) 契约加跨字段规则**（`frames > 1` ⇒ `background` 必填，限 `kind: "image"`）——
     ⚠️ **有已知的坑**：`toJSONSchema` **静默丢掉 `superRefine`**（票 08 实测，本仓库记过多次）
     ⇒ 模型**看不见这条规则** ⇒ 光加它会把「模型不知道」变成「模型每次都挂」。
   - **(b) 提示词里把这件事说明白**（例子里写上 `background`，并说清**多帧就必须要**）。
   - **(c) 计划阶段就不许生成图做多帧**（`frames` 恒 1，动画面另走母版 / import 那条路）。
   - **(d) 别的。**
   ⚠️ (a)(b) 不互斥 —— 契约是**判据**、提示词是**教**，本仓库两条都要的习惯（见票 09 的 ③）。
2. **两条路的必要性不同，要不要在契约里分开**（`image` 必填 / `import` 可选）？
   还是说 `import` 那条也该收紧？
3. **今天先怎么办** —— 这条链**在任何带多帧动画的 fixture 上都会挂**。
   票 23 要的「跑到站点」卡在这儿；是否接受**临时让它出单帧**先把终点走通，还是先修这个再跑？
   ⚠️ 那是**票 23 的验收问题**，但取舍在这里。

### 顺带（本票撞上的第二件事，够不够开票由本票判）

⚠️ **生图那本账只在成功时落盘** —— `pack.ts:880` 写 `ledger.json`，而它排在 `617` 那个抛点的**后面**
⇒ 这一次 19 张图的**调用数 / 往返数 / 上游自报 token / 张数，一条都没留下来**
（现场只剩 `authoring/generated/*.png` 与 `.prompt.txt`，那是**图**的证据，不是**账**的证据）。
⚠️ 这与[票 20](20-qa-report-assembly.md) 立的那条**正好相反**：那里专门做成了
「**落盘在阻断之前** —— 判据说不行了，正是最该读它的时候」。
