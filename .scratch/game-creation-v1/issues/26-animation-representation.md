# 26. 动画的表达与来源

Type: grilling
Status: open
Blocked by: 23
Map: ../map.md

> ✅ **票 24 已 resolved**（2026-09-24）。它**刻意没替你定** state 与 animation 的关系，只在 manifest 里给两者留了落点：`frames[]`（含 `state`）与 `animations[]`（含 `fps`/`loop`/帧名列表）。另外它实测发现**锚点在 drawlist 里根本没有源头**（`player` 的 `{x:0.5,y:0.92}` 是手填的），而六帧的 ink 包围盒并不一样 —— 来源规则归你。

> ✅ **两问已被上游票回答，可据此开工**（2026-09-24）。
>
> **问题 1「帧从哪来」**：[票 35](35-bitmap-provenance.md) 已定 → **drawlist 序列为主干**
> （管线唯一的自动生成路径），**人工导入的 sheet 为补充**。所以本票的重点落在
> 「这两种来源怎么统一成同一个动画契约」，而不是「该支持哪一种」。
>
> **问题 3「pivot / 锚点」**：[票 25](25-delivery-format-spec.md) 已查清交付侧的事实 ——
> **锚点是图集 JSON 里每帧的 `anchor` 字段，归一化到未裁剪的 `sourceSize`**，
> 而 Phaser 的 `setCurrentFrame` **会逐帧重设 origin**。
> 也就是说「各帧各自声明锚点」是**原生支持、零运行时代码**的（正合 R8）。
> ⚠️ 注意 Aseprite 那套 `meta.slices[].pivot` **Phaser 一行都不读**，别照着它设计。
> 本票要定的变成：**这个 `anchor` 值从哪来** —— 创作态声明？
> 还是从 drawlist 的包围盒 / 位图的 alpha 包围盒**算出来**（[票 23](23-bitmap-asset-pipeline.md) 的问题 1）？

> R4 把 **animation** 立成了四类资源之一，但现有契约里**根本没有动画这个概念** ——
> `AssetSpec.states` 是**静态外观**的枚举（tomato 的 growing/ripe/harvested），
> 不是「一组按时间播放的帧」。这是重画后最大的一块空白。

## Question

1. **帧从哪来**。两条路，且它们产出的东西形状不同：
   - **位图路径**：帧就是 sheet 里的格子（[票 23](23-bitmap-asset-pipeline.md) 问题 1 正在解决
     「wan 能不能画出对齐的网格 sheet」）。创作态是 N 张 PNG 或一张 sheet。
   - **drawlist 路径**：帧是 N 份 drawlist，各自光栅化（[票 21](21-drawlist-renderer.md)）。
     好处是帧之间的一致性**可校验**（票 22 问题 1 的多状态同一性问题在这里有解），
     代价是每帧一份 JSON。

   **要不要两条都支持**？还是规定「动画一律走位图」（那就把 drawlist 限制在静态资源上）？
   R3 说「位图是交付态、drawlist 是创作态」，那么一条纯 drawlist 的动画在交付时
   就被光栅化成一串帧再拼成 sheet —— **这在技术上等价于位图路径**，
   所以真正的分野只在**创作态**：谁来画这些帧。

2. **`state` 与 `animation` 的关系**。这是术语上的必答题，直接影响
   [票 24](24-asset-pack-contract.md) 的 manifest 与[票 09](09-game-config-contract.md) 的引用粒度。
   候选：
   - (a) **动画是 state 的一种**：`state` 从「静态外观」扩展成「可播放的东西」，
     静态 state 就是单帧动画。最小改动，但会让「idle 有 6 帧」和「ripe 是 1 张图」
     在 schema 里长得一样（可能反而是好事）。
   - (b) **animation 是独立的一类资源**，可以引用其他资源的状态当帧。
   - (c) **state 是动画的一个属性**（如攻击状态有多段），两者正交。
3. **pivot / 锚点 / 帧对齐**：一张 32×32 的帧里，角色脚底在 (16,30) —— 这个信息
   写在哪、谁保证帧与帧之间不抖？[票 23](23-bitmap-asset-pipeline.md) 问题 1 的
   「按 alpha 包围盒自动对齐裁切」是它的一个候选答案。
4. **播放参数**（fps / loop / ping-pong / 事件帧）属于资源还是属于 game-config？
   R8 之后 AI 只产数据，所以**两边都是数据** —— 但放在哪一边决定了
   「两个游戏用同一个角色时，能不能用不同的播放速度」。

## 产出要求

调用 `grilling` skill 定术语，并更新 `CONTEXT.md`（Animation / State / Frame 三个词要立住）。
若第 1 条难判，调用 `prototype` skill 用现有实验资产
（`experiments/animated-player/` 已有 6 帧走路动画 + 播放器）做出实物对比。
