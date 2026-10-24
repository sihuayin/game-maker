# 03. 地形 prop：recipe 产 decor vs compile-runtime 退化

Type: grilling
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 02
Map: ../map.md

## Question

地形 props 从哪来、缺的时候怎么办？（[票 02](02-terrain-solid-decor-status.md) 已钉死：audit 现在对 solid/decor
实体**没有 kind 锁**，`solid` 引 animation 只弱失败在「多动画缺 anim」；高杠杆修法 = 给 solid/decor 加 `["sprite"]`
kind 锁，这是**确定性修复、无论下面怎么选都要做**。）所以真正要你裁的是**清单要不要产地形 sprite**：

- (a) **recipe 产地形 sprite**：关卡 layout 明确要地形（碎石堆/斜坡/台阶）时，plan-assets 产出一件
  terrain/decor 用的 sprite（有 `tile-floor`/`metal-platform`/`prop-luggage-pile` 现成先例）——
  视觉丰富、solid 有合法资源可引，但**多一次生图**（进 Stage B 的 imageCalls）。
- (b) **清单不产、compile-runtime 退化 invisible terrain**：不加 kind 锁后，清单没有地形 sprite ⇒
  solid 实体无处可引，模型只用 `terrain`（看不见的碰撞）搭地面 —— 零生图，但关卡变平、少了碎石/斜坡。
- (c) **两者**：layout 要地形时 recipe 产地形 sprite，compile-runtime 兜底退化（缺地形 sprite 时退 terrain）。

## 需要你裁的点

- 生图成本（a 每次 +1 生图）vs 关卡视觉丰富度，取哪个？
- 是否允许「清单没有地形 prop 时关卡可以更平」（b 的代价可接受吗）？
- 这条是平台化通用规则，还是只针对废土寻宝这一关先做最小闭环？

## Answer

**选 (c) —— 两者兼备（2026-10-23 用户裁）**：

1. **正向路径 = (a)**：关卡 layout 明确要地形（碎石堆/斜坡/台阶）时，recipe 产出一件地形 sprite
   （照 `tile-floor` / `metal-platform` / `prop-luggage-pile` 先例），solid 有合法资源可引、视觉丰富。
2. **安全网 = (b)**：solid/decor → `["sprite"]` 的 kind 锁（确定性，进票 05）+ 提示词规则「清单没地形
   sprite 时用看不见的 `terrain` 搭地面，**禁止拿玩家/动画资源当 solid**」。缺 sprite 时退 terrain，模型永远
   没有「拿玩家当地形」这条路。

两条都写；kind 锁是底线，recipe 产 sprite 是正向丰富，退 terrain 是兜底。落点 → [票 05](05-compile-runtime-tighten.md)
（kind 锁 + 提示词收紧 + 地形 sprite 触发），票 04（ui 侧）不受影响。
