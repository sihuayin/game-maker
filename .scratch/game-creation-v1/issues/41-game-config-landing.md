# 41. 把 game-config 契约落进 packages/contracts

Type: task
Status: resolved
Blocked by: —
Map: ../map.md

> ✅ **2026-09-28 已决议**（本票由上一 session 搁下 48 小时后被接手 —— 见 Answer §0）。
> ⚠️ 施工抓到**五处**，其中一处是 **A 侧的洞**：`resolvePackRef` 解不开**任何**分层背景，
> 而 `scene.background` 的形状就是只给 `asset` 的。已修，并写进 Answer §1。


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

---

## Answer

**契约落地了。** `packages/contracts` 导出 `GameConfigSchema` + `auditGameConfig` + 三族校验器；
`game-config.test.ts` **21 条**全绿；全套 **295 条**绿；`pnpm check` 绿。
**票 09 的十五条裁决一条都没有重开** —— 形状照抄，本票只把它变成代码。

### 0. 这是一张**接手**来的票

⚠️ 上一个 session 停在 **2026-09-26 20:50**：claim 写上去了但**没提交**，
`game-config.ts` / `tests/game-config.test.ts` 躺在工作区、**5 条测试是红的**，停了 48 小时。
本 session 接手补完。⚠️ **票面「要产出的东西」那一节的形状全是对的** —— 下面五处全是施工时才露出来的。

### 1. 施工抓到的五处（本票真正的产出）

**① `resolvePackRef` 解不开任何一个分层背景 —— 这是 A 侧的洞，不是 config 的。**
`bg-dusk-halt` 是 `kind: "background"` / `animations: []` / `frames: [sky, wall, ground]`。
`resolvePackRef` 在「没给 anim」那一支只有两条出路：`animations.length === 1`，或 `frames.length === 1`
—— **两条都不成立**，于是它报「有多个可画的动画，引用必须指明 anim」。
而票 09 的形状里 **`scene.background` 正是只给 `asset` 的**，**背景根本没有 anim 可指**。
⇒ **任何一个分层背景都解不开**，报出来的消息还把人指向一个不存在的出路。
已在 `assetpack.ts` 加一支：**背景的多帧不是「多个可画的动画」，是叠在一起的一摞层**
（第 i 层 = 第 i 帧 —— `Layer` 的注释早就写明了这条对应，它们**同时**画出来），
所以 `{ asset }` 本来就无歧义。
⚠️ **票 37 的测试没盖到这个格子**：它夹具里那个 `shop` 背景只有一帧。
⚠️ 这条本会挡住[票 44](44-implement-runtime-shell.md) —— 外壳要画背景，而背景解不开。

**② `ref()` 必须「先判种类、后解引用」。** 反过来的话，把三层背景当玩家引用时，
`resolvePackRef` 会先撞上「必须指明 anim」并返回，**种类核对永远跑不到** ——
于是「你拿背景当玩家了」被报成「缺 anim」。后者才是人能动手改的那句话；
前者会把人指向一个不存在的出路。

**③** 「这个 id 是不是一个 animation」与「这个引用画的是哪一帧」**是两个问题**。
玩家资源按定义有三个动画，拿 `{ asset }` 去解它必然撞上「必须指明 anim」——
而这里问的根本不是 anim。已把 `kindOf()`（只看种类）与 `ref()`（解引用）**分开**，
玩家的种类核对走前者、三个动作名走后者。合并成一个 `ref()` 的写法，
会让**种类核对永远跑不到**（同 ②）。

**④ 夹具里 HUD 面板的算术就是错的。** `at` 是**左上角**（与 `terrain` 的 `Rect`、
实体的 `body` 同一套），**不是下边缘** —— 而夹具写了 `y: 262`、面板高 32 ⇒ 跨 **262..294**，
而世界只有 **270** 高。「底边留 8px」的正确写法是 `270 - 32 - 8 = 230`。
已改夹具，**没有削弱任何一条检查**。

**⑤ 两处测试断言找错了字段。** `ConfigIssue` 把「哪里」与「怎么了」拆成 `where` / `message`
（**一个事实只有一个家**，不存在两份），位置**不在** `message` 里。
测试加了 `line()`：`` `${i.where}: ${i.message}` `` —— 那正是两个壳要渲染的形状。
⚠️ 没有改实现去把位置塞进 `message`：那会让同一个事实住在两个字段里，正是本仓库反复吃的那个亏。

### 2. 一条**没做**的发现 → 已写进[票 33](33-runtime-assembly.md) 的抬头

⭐ **`hud.*` 活在屏幕空间，而它现在是对 `world.size` 校验的。**
票 09 §4 的自洽族原话是「坐标是整数且落在 `world.size` 内」，**本票照做了**。
但 `kind: "ui"` = 屏幕空间（票 42 删 `UiSpec.screenSpace` 时把这条讲死了：它是同义反复），
而世界宽 **1440**、视口宽 **480** —— 一个摆在 `x: 1000` 的 HUD
**过得了世界校验、却在屏幕外**。y 那一维碰巧是对的（裁决 13「关卡单屏高」⇒ `world.h === 视口高`），
**x 这一维是真的松**。

对的那个尺子（视口 **480×270**）是**外壳的常量**（票 32），票 09 的表里没有它 ——
所以这条**不能在契约层修**，只能落进[票 33](33-runtime-assembly.md) 的
**第五族：几何可行性**（它已经管着「不平铺的层必须 ≥ 视口」那条同族的检查）。
已写进票 33 的抬头，**不在本票里改**（那会重开票 09 的一条裁决）。

### 3. 顺带完成的删除

票 09 裁决 4 判的三个零消费者 schema（`GameSpecSchema` / `RequirementSchema` /
`CreationProjectSchema`）已删，原处各留一行注释说明**为什么删**。
查过 `packages/*/tests`：**无残留断言**。
⚠️ 删掉它们顺带**消解了票面第 1 问** —— 「两个真相来源」不复存在，因为其中一个被删掉了。

### 4. 完成条件逐条

| 条件 | 状态 |
|---|---|
| `packages/contracts` 导出 `GameConfigSchema` + 校验器 | ✅ 另导出 `pickupCount` / `playerMoveOf` / `maxJumpHeight` |
| `pnpm check` 绿 | ✅ 依赖图 + `tsc -b` + bundle |
| 全部测试绿 | ✅ **295 / 295** |
| 反例逐条落成测试 | ✅ 见下 |
| 校验不过**是失败不是降级** | ✅ `auditGameConfig` 只判定、`severity: "error"`；票 30 那个「校验不过返回 0」的坑没踩 |

反例清单（票 09 十五条裁决里可测的那些）：逃生舱被拒 · **非整数坐标被拒** · `kind` 拼错被拒 ·
`motion.kind` 拼错被拒 · 实体 id 重复被拒 · `objective` 带 `count` 被拒 ·
`player.move` 可省且**默认值只有一处来源** · `pickupCount` 从实体派生 ·
悬空的 `gate` 被拒 · 引用了包里没有的资源被拒 · 资源种类不对被拒 · 动作名逐个解被拒 ·
一个 pickup 都没有被拒 · 出生点卡在 solid 里被拒 · 坐标出世界被拒 ·
**可通关那条的正反两个例子**（台阶 100px 对 60.5px 顶点；给了 `player.move` 判决跟着变）·
周期运动越界报警告。

⚠️ **真实 Config 实例（last-train 那份）不在本票** —— 归[票 33](33-runtime-assembly.md)，
它依赖外壳的视口尺寸。本票的夹具是**按真包的资源 id 与动画名**写的，不是现造的。
（夹具是**测试里的字面量**，不是产品产物 —— 它随测试走。）

### 5. 解锁的下游

- **[票 44（实现固定 runtime 外壳）](44-implement-runtime-shell.md) 现在解锁了** ——
  它是本票唯一的直接下游。⚠️ 而且上面①那条洞就是它要先撞上的：**外壳要画背景**。
- 票 33 多了一条输入：**第五族 · hud 的屏幕空间边界**。
