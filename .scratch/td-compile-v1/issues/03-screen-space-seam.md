# 03. 「HUD 在屏幕空间内」那条检查的缝在哪

Type: grilling
Status: open
Owner: —
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
