# 41. 把 game-config 契约落进 packages/contracts

Type: task
Status: open
Blocked by: —
Map: ../map.md

> 🔴 **2026-09-26（[票 40](40-last-train-fixture-pack.md)）—— 票 09 的一条形状**建不出来**，落地时要改。**
> 票 09 写的是 `hud: { panel:{…}, slot:{asset, anims:{empty, filled}} }`，而
> **`ui` 类不允许声明动画**（票 27：动画只归 `animation` 类），一个 ui 资源**只有一张图** ——
> 所以「一个两态的槽位资源」在契约里不存在。
> 落地时改成**两个 ui 资源的引用**。票 40 的真产物就是这么做的：
> `hud-lost-slots`（九宫格面板，画着三个空槽）+ `hud-pip`（点亮标记，叠上去）。
> ⚠️ 顺带确认一条**能用**的写法：**信号灯是 `animation` 类带 `red`/`green` 两个动画** ——
> 票 26「一个状态就是一个单帧动画」（番茄 growing/ripe/harvested）那条先例，
> 对**世界空间**的东西成立。判据仍然是票 27 那句「它活在屏幕空间还是世界空间」。

> 由[票 09](09-game-config-contract.md) 毕业。它把形状定死了，本票把形状变成代码。
> 与[票 37](37-assetpack-manifest-landing.md)（把 manifest 契约落地）同构。

## Question

把 `game-config/v1` 落进 `packages/contracts/src/game-config.ts`，
连同它在**装配期的三族校验器**。**不是决策票** —— 形状全部来自票 09 的 Answer，本票不重开任何一条。

### 要产出的东西

1. **`GameConfigSchema`** —— 顶层七块（`format`/`world`/`scene`/`player`/`terrain`/`entities`/`hud`/`objective`），
   逐块 `.strict()`，**没有逃生舱**（票 27 已为同一理由删过 `visual`/`geometry`）。
   - `kind` 是**封闭判别联合**：`solid` / `pickup` / `hazard` / `goal` / `decor`。
   - `motion` 是任意实体可选的一块，**V1 只实现 `cycle` 一个值** —— 枚举的存在是为了让
     「加一种运动」= 加一个枚举值 + 外壳里一个分支，**而不是改 schema 的形状**。
   - 坐标一律 `z.number().int()`（票 09 裁决 13：`x: 10.5` 会**静默**糊掉像素网格）。
2. **`objective` 不带数量** —— 由 `kind:"pickup"` 的实体数派生；HUD 槽位数是同一个数。
   派生的实现只此一处，写入侧与校验侧共用（票 24 的 `derivePackMode` 是同一个教训：
   两边各写一份必然漂移，而漂移的后果是**合法的 config 被判为矛盾**）。
3. **三族校验器**，跑在装配期：
   - **引用族（硬失败）**：复用 `resolvePackRef()` 解每个实体的 `asset`/`anim`、
     `objective.gate`、`hud.slot` 的两个动画名。⚠️ **不重写解析逻辑** —— 票 37 已立过
     「两份并存的 schema 必然漂移」这条规矩，这里是同一个接口的另一侧。
   - **自洽族（硬失败）**：id 唯一 · 出生点不卡在 solid 里 · 坐标落在 `world.size` 内。
   - **可通关族（警告）**：**跳跃能力越不越得过最高的那块台阶** —— 给定 `player.move`
     的抛物线顶点是**精确可算**的，但它**不构成判决**（越不过去可能是设计）。
     这条与票 27 的 `checkSize()` 同族：**精确的硬失败、上界的报警告**。
4. **测试**：形状的每一条裁决至少一条反例（逃生舱被拒 · 非整数坐标被拒 · 悬空的 `gate` 被拒 ·
   `kind` 拼错被拒…），以及可通关那条的**正反两个例子**。

### 完成条件

- `packages/contracts` 导出 `GameConfigSchema` + 校验器，`pnpm check` 与全部测试绿。
- 反例逐条落成单元测试 —— **票 09 的十五条裁决里可以变成测试的那几条，都要有**。
- ⚠️ **校验不过必须是失败不是降级**（票 30 的教训：`verify` 曾经在校验不过时退出码返回 0，
  于是篡改过的包骗过了校验脚本 —— 同一个坑不踩第二次）。

### 不归本票

- **真实 Config 实例**（last-train 那份）—— 归[票 33](33-runtime-assembly.md)，它依赖外壳的视口尺寸。
- **外壳** —— 归票 32 / 33。
- **三个零消费者的 schema 的删除**（`GameSpec`/`Requirement`/`CreationProject`）—— 见下。

### ⚠️ 已由票 42 做完的一条

`UiSpec.screenSpace` 原计划归本票删（它是同义反复：`kind: "ui"` 就是「屏幕空间」），
**票 42 顺手删掉了** —— 它当时正在改同一个文件、同一条 `.strict()` 的测试，分开做只会把
一个文件的改动切成两半。本票**不要再删一次**。

### ⚠️ 顺带要做的删除

票 09 裁决 4 判了 `GameSpecSchema` / `RequirementSchema` / `CreationProjectSchema` **全删**
（三个都零 import，是票 07 那轮清理漏掉的）。删它们**顺带消解票面第 1 问**——
「两个真相来源」不复存在，因为其中一个真相被删掉了。
删完查一遍 `packages/contracts/tests/` 里有没有引用它们的断言。
