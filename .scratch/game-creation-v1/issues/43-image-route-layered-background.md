# 43. 生图路线支持分层背景，并产出 last-train 的对照包

Type: task
Status: open
Blocked by: —
Map: ../map.md

> 由[票 40](40-last-train-fixture-pack.md) 毕业。票 40 的第 7 项（「顺带产一个生图版对照包」）
> 撞出来的不是上游不稳，而是**这条路根本走不通**。

## Question

`pack.ts` 的生图支对非 animation 资源**只出一张图**（`units` 那一支），
而分层背景的 `plan` 有 N 项 ⇒ `results[i]` 越界成 `undefined`，一路带到 `buildAtlas`
才炸成一个说不清是哪里错的 `TypeError`。票 40 已在那一支加了显式拒绝，**本票把它做出来**。

### 要做出来的

1. **一层一次调用** —— 与 drawlist 路线的 `framePlan` 那支对称：分层背景按 `layers` 展开成
   N 个 unit，每个 unit 出一张图，落盘 `authoring/generated/<id>.<层名>.png`。
2. **提示词要说清「只画这一层」** —— `imagePrompt(spec, style, animName?)` 要能接层名，
   并交代两件事：**当前画的是哪一层**，以及**这一层没有东西的地方留空**。
   ⚠️ 生图路线有一样天然的好处：它本来就要**抠底色**（`keyBackground`），
   所以「没东西的地方」抠完就是透明的 —— 与「每层画满整块画布、靠透明叠出层次」
   那条契约**天然对得上**。这条要在实现里确认，别浪费它。
3. **对照组包**：同一份清单（`fixtures/recipes/last-train.json`）+ 同一份 StyleSpec，
   走生图路线再产一个包，留在 `out/`（**不进 `fixtures/`** —— 它带外部依赖，
   而 fixture 包存在的理由就是「不碰生图能力」）。
4. ⚠️ **不阻塞任何东西**：上游不可达就是不做，**不要为它引入任何回退**（R10 修正已拆掉降级链）。
   若真做出来了，它兑现的是 R6 的「**换包不重建**」—— 同一个 game-config 吃两个包，
   游戏代码一个字不动。**那需要票 33 先在地**（它才产 game-config）。

### 已知的上游状况（别再重查）

2026-09-26 实测：krill 中转跑成一个包**两分钟后两个端点整段挂 ≥10 分钟**（秒回 500）。
因此 `openai` 那一支**刻意不做退避**（3 次重试共 5 秒，救不了 600 秒量级的故障）。
详见 `out/` 与票 40 的 Answer。
