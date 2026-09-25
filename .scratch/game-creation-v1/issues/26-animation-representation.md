# 26. 动画的表达与来源

Type: grilling
Status: resolved
Blocked by: 23
Map: ../map.md

> 🔴 **票 20 施工时挖出来的新问题**（2026-09-24）：真实产物里**同时存在两种创作态形状** ——
> **A**：一个 `(asset, state)` 一份 `{format,id,state,viewBox,expectedSize,ops}`（Q20 定的，style-transfer 实验 6/6 是这个）；
> **B**：一个 asset 一份 `{format,id,viewBox,expectedSize,states:{"<帧名>":{ops}}}`（animated-player 实验产出的是这个，
> 也**正是[票 22](22-asset-generator.md) 问题 1 证明「单次调用才能保证帧间同一性」的那个生成形状**）。
> 票 20 把 A 定为**唯一的落盘形态**、B 判为生成期的暂存形态（落盘前摊平），并把 `state` 定为必填。
> **你要裁决的是**：B 该不该也成为一种落盘形态？若应该，`state` 就得变成可选、`states` 需要一个正式 schema。
> 证据与那段摊平代码的 bug 见票 20 的 Answer。

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

## Answer

**结论：四条裁决全部落定，并已把 schema 后果落进代码 —— 97 条测试全绿、端到端复跑的那个真包仍然合法。
`state` 这个词在**三个地方**被收掉：drawlist 的字段、manifest 的 `frames[].state`、引用语法的中间那段。**

### 0. 四条裁决

| 问题 | 裁决 |
|---|---|
| ① `state` 与 `animation` 的关系 | **动画是唯一的分组概念**；「状态」退化为**单帧动画** |
| ② 锚点从哪来 | **逐资源声明一个**（不是逐帧，也不是自动推） |
| ③ 播放参数放哪 | **资源给默认，Game Config 可逐引用覆盖** |
| ④ 创作态形状 A / B | **维持票 20 的裁定：A 唯一落盘**，B 是生成期暂存形态 |

### 1. ② 这一问是被实测判掉的，不是被讨论掉的

裁决前先量了 `experiments/animated-player/` 六帧的实际包围盒：

```
帧       ink 包围盒底边    按 bbox 推的锚点 y
idle          28            0.875
walk1-4       28            0.875
jump          26            0.813     ← 只有它不同
```

**如果按 ink 包围盒自动推锚点，jump 帧的脚会被钉回地面 —— 腾空动作直接消失，
而其余五帧看起来完全正常。** 这正是票 23 问题 1 提的那个候选答案（「按 alpha 包围盒自动对齐裁切」），
它错得不显眼：没有任何一帧会报错，只有人眼看动画时才可能发现角色不跳了。

所以锚点**必须被声明**。它写进图集 JSON 的**每一帧**（交付格式支持逐帧，我们只是不需要逐帧变），
归一化到 `sourceSize` —— 这条事实由[票 25](25-delivery-format-spec.md) 查清，
而 Phaser 的 `setCurrentFrame` 会逐帧重设 origin，所以「逐帧声明同一个值」是原生支持、零运行时代码的。

### 2. ① 的落点：`state` 在三个地方被收掉

**收掉它的直接理由**：`state` 这个词在**真实产物里已经被用在两件事上** ——
style-transfer 的 `player.idle` 是静态外观，animated-player 的 `walk1` 是帧名
（`player.states.json` 那六个键就是帧名），两者却写进同一个字段。同一个词指两件事，
迟早有人在 schema 里把它们当成两套东西。

| 位置 | 之前 | 之后 |
|---|---|---|
| 创作态 drawlist（[票 20](20-drawlist-contract.md)） | `state: "idle"` | **`frame: "idle"`** |
| manifest 的帧（[票 37](37-assetpack-manifest-landing.md)） | `frames: [{name, state?}]` | **`frames: [{name}]`** —— 「有哪些动画」= `animations[].name` |
| 引用语法（票 24 / [票 09](09-game-config-contract.md)） | `{asset, state?, anim?}` | **`{asset, anim?}`** |

新增一条**结构性规则**（在 `AssetPackEntry` 的 superRefine 里）：
**多于一帧的资源，每一帧都必须至少属于一个动画** —— 否则那一帧是**不可达**的
（画不出来，也没人引用得到）。单帧资源不需要分组：它本身就是「一个单帧动画」。

这条规则**当场就抓到了东西**：复跑票 24 那个真包时，`player.jump` 不属于任何动画，
被拒了。补了一个 `jump(1帧 @1fps 不循环)` 分组之后才通过 —— 这不是测试造出来的场景，
是那份真实 recipe 里一直存在的漏洞。

### 3. 落地清单

| 文件 | 动作 |
|---|---|
| `CONTEXT.md` | **Frame / Animation / State / Anchor 四个词立住**（State 明确标注「已降格」） |
| `packages/contracts/src/drawlist.ts` | `state` → `frame` |
| `packages/contracts/src/assetpack.ts` | `FrameRef` 去 `state` · `AssetPackRef` → `{asset, anim?}` · 新增「每帧必须可分组」规则 · `resolvePackRef()` 重写 |
| `fixtures/drawlist/*.json`（8 份） | 字段同步 |
| `packages/contracts/tests/*.ts` | 97 条，含 4 条新测试（分组规则正反例、引用不再有 state） |
| `experiments/asset-pack-draft/{recipe.json,build.mjs}` | 去掉 `state`、给 `jump` 补分组、manifest 只写 `name` |
| 票 27 / 28 / 09 | 各加一条抬头，写明本票对它们的直接影响 |

### 4. 验收

| # | 检查 | 结果 |
|---|---|---|
| ① | 全部测试 | ✅ **97 passed**（contracts 53 + assets 44）|
| ② | 票 24 的真包端到端复跑 | ✅ 通过校验；`player` 6 帧归成 **walk(4帧@8fps) · idle(1帧@1fps) · jump(1帧@1fps 不循环)** |
| ③ | 静态资源（单帧、无分组） | ✅ `platform` / `pickup` / `hazard` / `bg_sign` / `shop_interior` 都合法 |
| ④ | `pnpm check` / `typecheck` | ✅ |

### 5. ④ 维持票 20 的裁定 —— 以及它欠的那笔债

形状 A（一个 `(asset, frame)` 一份）是唯一落盘形态，B 是生成期暂存形态。
理由：A 的 diff 粒度更小（改一帧只动一个文件），且**生成粒度与落盘粒度解耦本来就是对的**。

但这笔债是真的：把 B 摊平成 A 的那一步**上次就写错过**（`gen_player.mjs` 忘了写帧名，
六份产物全缺）。现在这个错误**会在解析期被抓住** —— `frame` 是必填的。

### 6. 本票没有替下游定的

- **`AssetSpec` 里的 `states: string[]` 怎么改** → [票 27](27-asset-spec-kinds.md)（已加注：换成 `animations`）
- **recipe 的形状**（含每 asset 的 `anchor`） → [票 28](28-recipe-compilation.md)（已加注）
- **Game Config 的引用语法** → [票 09](09-game-config-contract.md)（已加注：必须采纳 `{asset, anim?}`）
- **`importBitmap()` 不产出锚点** —— 按裁决它是**声明**的，不是算出来的。
  人在 recipe 里给（[票 28](28-recipe-compilation.md)），管线不发明它。
