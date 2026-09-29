# 03. 「HUD 在屏幕空间内」那条检查的缝在哪

Type: grilling
Status: resolved
Owner: amber（2026-09-29 认领）
Blocked by: —
Map: ../map.md
> 这条是**结构**问题，不是玩法问题：同一个判据今天在仓库里有两个半副本。

## Question

`compile-td-game` 要在**构建期**判「HUD 摆没摆到屏幕外」。而：

- `auditTdConfig`（contracts）判的是**世界**，它看不到视口；
- `auditTdGeometry`（demo）有这一条 —— 但 `compile-*` 住在 **assets** 包里，
  而依赖图是 `assets → contracts`，**assets 不依赖 demo**（`scripts/check-deps.mjs` 的允许图写死）。
- `compileGame` 的做法是**在 `ops.ts:326–352` 里又写了一遍**（第三个副本）。

要定的是缝在哪：

1. **提到 contracts 做成参数化纯函数**（视口传进去），compile 两条 + demo 的几何族都调它 ——
   ⚠️ 代价是动 `compileGame` 约 15 行（**纯提取**，它那 9 个测试是回归网）。
2. 与 `compileGame` 对齐，**在 compile 里再写一遍**（第四个副本）。
3. compile 不跑这条，留给 `site`。

**要答的**：选哪条、签名是什么（`auditScreenHud(viewport, items)`？`items` 的形状？）、
它算哪一族（引用 / 自洽 / 几何）、以及**它返回 error 还是 warning**
（横版那边是硬失败，理由是「HUD 摆到看不见的地方几乎不可能是设计，而且精确可算」）。

⚠️ 判据的门槛是仓库那条：**精确可算 + 错了一定不是设计**。这条同时满足，所以是硬失败。

## Answer

（未决）

## Answer

**✅ 2026-09-29 已决议。** 缝开在 **contracts**，而共享的不只是那条判断 —— **「有哪些 HUD 项」也共享**。

### 三条决议与依据

| # | 决定 | 依据 |
|---|---|---|
| Q1 | **(b) 连「有哪些 HUD 项」也共享**：contracts 里每个玩法一个 `hudScreenBoxes(config, manifest)` | 那条裂缝**不是假想的 —— 这一票量出来了**（见下）。两份列表可以**各漏各的**，于是 compile 放过去、site 也放过去，**谁也拦不住** —— 而 `site` 正是最后一道闸 |
| Q2 | `hudScreenBoxes(config, manifest) → {where, at, box}[]`（**一个函数喂两边**：`at` 给渲染摆精灵，`box` 给校验）+ `auditScreenSpace(viewport, items) → ConfigIssue[]`（共用一份） | 判断那两行**两个副本一模一样**，差的是措辞与输出形状（compile 是带 `❌/⚠️` 的 `string[]`，demo 是 `ConfigIssue[]`）。统一成 `ConfigIssue[]` 之后，`compileGame` 只是多一次映射 —— 与它现在对 `auditGameConfig` 做的事**一模一样**，几乎不花代价 |
| Q3 | 算**第五族「HUD 屏幕空间」，与第四族（几何）分开**；**硬失败** | 它的**尺子是视口不是世界** —— 与几何族混在一起，正是那条消息本身在警告的事（横版的 `site.ts` 早就把两者分开命名了）。硬失败的理由票面写了：**精确可算 + 错了一定不是设计** |

### ⚠️ 这一票量出来的那个洞（Q1 选 (b) 的直接依据）

塔防的 `hud` 有**五个**顶层成员，而 `fitViewport` 只覆盖三个：

```
✅ hud.panel      ✅ hud.buttons      ✅ hud.start
❌ hud.readout    ❌ hud.icons
```

⇒ **「图标摆到屏幕外」与「读数摆到屏幕外」今天没有任何东西会检查。**
横版那边是查全的（`panel` + 每一个 `pip`）—— 也就是说，**这份「有哪些项」的名单从加塔防那天起就是漏的，而且没有任何东西会告诉你**。

### 代价要说准：比票面估的「约 15 行」大

除了 `compileGame`，**两种玩法的纯层**也要改成从 `hudScreenBoxes` 取盒子。不这么做的话，demo 里盒子会算两遍，而「校验过的」与「外壳要画的」就不再是同一份描述了 —— 那正是票 48 记下的那个亏。
⚠️ 另一条约束票面没提，这一票确认了：**`compileGame` 必须自己算盒子**，它拿不到 demo 的纯层（依赖图写死 `assets → contracts`）。所以 `hudScreenBoxes` **住在 contracts** 不是偏好，是唯一放得下的地方。

### 一个结构性的例外：`hud.readout` 进不了这个机制

`readout` 在契约里是 `{ at, step }` —— **没有尺寸**（它画出来是外壳的三行文字，大小由外壳的字号决定）。
而 `hudScreenBoxes` 按定义要返回一个 `box`。⇒ **它结构性地进不去**，不是漏了。
已毕业成新票（见下）。

### 连带：改了另一张票的正文

[`arena` 的砖尺寸要不要校验](07-arena-tile-size.md) 的正文里写着「⚠️ 注意几何族住在 demo 包里，
而 `compile-td-game` 在 assets 包里 —— 依赖图是 `assets → contracts`（**这正是票 03 要解的同一个结**）」。
那个结**已经解了**（校验函数住在 contracts、参数化）。所以那张票的第 2 问不再是
「它放得下吗」，只剩「它算哪一族」—— 已改。

### 产物

没有文件产物 —— 这一票产出的是**决定**。

---

### ⚠️ 2026-09-29 就地更正（由[票 09](09-dimensionless-hud-items.md) 顶出来）

本票 Q2 定下的签名是 `hudScreenBoxes(config, manifest) → { where, at, box }[]`，
以及「**它按定义要返回一个 `box`**」。**那两条已被票 09 改掉**：

- 名字改成 **`hudScreenItems`** —— 它返回的**不再都是有盒子的东西**；
- `box` 变成**可选**：`hud.readout` 是纯文字、**宽度取决于运行时的数字、构建期不可知**，
  所以它只有「**起点 + 高度**」可查。

⇒ 读到本节上面那几处 `hudScreenBoxes` 时，**以票 09 为准**。
