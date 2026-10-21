# 票 06 证据：Phaser Arcade `body.reset` 语义与本仓物理设置

- 日期：2026-10-21 · 只读调查（零付费、未启动站点、未改代码）
- 对应票：`issues/06-r2-phaser-body-reset.md`；服务对象：票 07（危险物软锁）、票 10（浏览器 smoke）
- 证据分级：E1 = 逐行读源码；E3 = 既有归档运行痕迹。本文件没有新的运行时读数。
- 外部语义的**唯一事实源**：仓库里安装的 `phaser@3.90.0` 原始源码
  （`node_modules/.pnpm/phaser@3.90.0/node_modules/phaser/src/...`，与官方 npm 包同字节）。
  官方文档页在本环境被网络策略挡住（`docs.phaser.io` / `photonstorm.github.io` / `raw.githubusercontent.com`
  均无法抓取），所以下面每条语义都落到源码行号；文末给出对应的官方文档链接供复核。

## TL;DR（给票 07 的四句话）

1. **根因不是「没清速度」**。现行代码是 `setPosition(...).setVelocity(0, 0)`（`packages/demo/src/shell/scene.ts:266`），
   速度确实清零了。缺的是**物理体位置与 prev 状态**：`setPosition` 只动 GameObject，body 还在旧位置；
   同一帧的 `postUpdate` 又会把 body 这一步的位移 `dy = body.position.y - prevFrame.y` **加到刚刚传送过的
   GameObject 上**（`Body.js:1236-1277`）⇒ 玩家被放到地面下方 `dy` 像素处。
2. 落地分离有**防穿透窗口**：`overlap > |body._dy| + World.OVERLAP_BIAS(默认 4)` 时，
   `GetOverlapY` 把 overlap 强制归零、**拒绝分离**（`GetOverlapY.js:26,39`；`World.js:236`）。
   本仓 900 px/s² / 60 Hz 下，重置瞬间下落速度 **≳225 px/s**（偏移 >4 px）就会掉穿；复现轨迹里重置前
   `vy=300`，偏移 5.25 px，正好越界。
3. 正确做法：`body.reset(x, y)`（它会 `stop()`、同时摆 GameObject 与 body、重设 `prev/prevFrame/autoFrame`、
   清 `touching/blocked/embedded/overlap`，`Body.js:1576-1618`），再按**重置后实际的 `body.bottom`**
   把脚底对齐到由 `world.terrain`（+ 静态 `solid` 实体盒）算出的地面顶边。**不要**只 `setPosition`。
4. 归档读数 `y=262.5` 不是传送目标（目标仍是 `spawn.y=250`），而是**重置后自由下落若干物理步的采样**。
   按 Phaser 公式复算，带 5.25 px 初始偏移的轨迹在 7 个物理步后到 `262.25`、9–10 步到 `261–264`
   （见 §3.4），落在归档采样窗口内；真正硬的证据是 **5.25 px > 4 px 的防穿透窗口**（§3.2）。

## 1. Q1 · 本仓事实（`path:line`）

### 1.1 Phaser 版本

| 事实 | 证据 |
|---|---|
| 依赖声明 `"phaser": "^3.90.0"` | `packages/demo/package.json:15` |
| 锁文件解析为 `phaser@3.90.0` | `pnpm-lock.yaml:619`、`pnpm-lock.yaml:1064` |
| 实际安装 3.90.0 | `node_modules/.pnpm/phaser@3.90.0/node_modules/phaser/package.json:3` |

### 1.2 Arcade Physics 配置

`packages/demo/src/shell/entry.ts:75-85`：

- `physics.default = "arcade"`；
- `gravity: { x: 0, y: 0 }`（世界重力为 0），`debug: false`（`entry.ts:83`）；
- **没有** `fps`、**没有** `fixedStep`、没有 `overlapBias` ⇒ 全部取 Phaser 默认：
  - `fps = 60`（`World.js:159`），`_frameTime = 1/60`（`World.js:190`）；
  - `fixedStep = true`（`World.js:170`）；
  - `OVERLAP_BIAS = 4`（`World.js:236`）。
- 固定步长的追帧循环见 `World.js:936-1013`（一帧可跑多个 1/60 s step）。

玩家的重力**不在世界配置里**，而是每帧由 body 自己承担：
`s.setGravityY(world.player.move.gravity)`（`scene.ts:188`）。有效竖直加速度 = body 重力 + 世界重力 = 900 px/s²。

### 1.3 玩家 body 的创建

`packages/demo/src/shell/scene.ts:179-197`：

| 项 | 值 / 代码 | 证据 |
|---|---|---|
| 创建 | `this.physics.add.sprite(world.player.at.x, world.player.at.y, …)` | `scene.ts:185` |
| 初始 origin | `d.anchor`（资源锚点；真包是 `{0.5,1}`）；之后每帧由帧的 `customPivot` 接管 | `scene.ts:182-185`（注释） |
| body 尺寸 | `s.body!.setSize(b.w, b.h, false)`，`b = world.player.box` | `scene.ts:186-187`；`world.ts:164` |
| body offset | **保持 `(0,0)`**：`center=false` 不走 `offset.set(...)` 分支 | `Body.js:1509-1515`；默认 offset `Body.js:185` |
| body 重力 | `setGravityY(world.player.move.gravity)` | `scene.ts:188` |
| 世界边界碰撞 | **未调用** `setCollideWorldBounds`；`Body.collideWorldBounds` 默认 `false` | 全仓 grep 无命中；`Body.js:766` |
| 速度上限 | **未设置**；`Body.maxVelocity` 默认 `(10000, 10000)` | `Body.js:497` |
| 水平速度 | 每帧 `setVelocityX(left ? -m.speed : right ? m.speed : 0)` | `scene.ts:85` |
| 跳跃 | `if (jump && onFloor) setVelocityY(-m.jumpVelocity)` | `scene.ts:86-87` |
| 手感值 | 默认 `{ speed: 90, jumpVelocity: 330, gravity: 900 }`，可被 config 覆盖 | `packages/contracts/src/game-config.ts:90`；`world.ts:165` |
| 碰撞 | `this.physics.add.collider(s, this.solids)` | `scene.ts:196` |
| 地形固体 | `staticGroup` + `add.rectangle(...)` 后 `solids.add(r)` | `scene.ts:44, 50, 125-128`；`solid` 实体同样进组 `scene.ts:145` |

要点：**body 的 top-left 直接由 sprite 的 top-left 推出来**（`updateFromGameObject`：

`position = transform + scale × (offset - displayOrigin)`，`Body.js:1054-1064`）。offset 为 0、
资源锚点 y=1 时，`body.bottom === sprite.y`（脚线就是 `at.y`）。锚点 y=0.95 时脚线会低
`0.05 × 高`（见 §4）。

### 1.4 `hitHazard()` 现状

`packages/demo/src/shell/scene.ts:263-267`：

```ts
/** 碰到危险物 → **退回起点、计数保留**（票 09 裁决 12；无血量）。 */
private hitHazard(): void {
  if (!this.player || this.won) return;
  this.player.setPosition(world.player.at.x, world.player.at.y).setVelocity(0, 0);
}
```

- 危险物 overlap 的注册在 `scene.ts:152-156`（`this.physics.add.overlap(this.playerOrStub(), sprite, () => this.hitHazard())`）。
- 票面说「只 `setPosition`」并不完全准确：还有 `setVelocity(0,0)`。**但两者都没有碰 body 的位置/prev/flags**，
  所以结论不变（见 §2、§3）。

### 1.5 既有 E3 读数

`docs/v4/P0-00-e2e-evidence.md:92-99` 与归档
`.scratch/p0-00-audit/runs/2026-10-20a-head-replay/hazard-repro-trace.json`：

- 序列：木箱顶（y≈202）起跳 → 空中 x≈393 撞 `hazard-terrain` → `hitHazard()` 退回起点；
- 重置前最后采样：`t=4424ms, x=395, y=196.8, vy=300, onFloor=false`；
- 下一采样：`t=4579ms, x=52, y=262.5, vy=105, onFloor=false`；
- 之后 y 持续增大，驱动在 `y>400` 处截断（`fell-through-floor` 记录 `y=413, vy=525`）。

## 2. Q2 · `body.reset(x, y)` 的官方语义

### 2.1 源码（Phaser 3.90.0）

`Body.reset`（`Body.js:1576-1618`）依次做：

1. `this.stop()`（`1578`）—— 清零：
   `velocity`、`acceleration`、`speed`、`angularVelocity`、`angularAcceleration`（`Body.js:1628-1637`）。
2. `gameObject.setPosition(x, y)`（`1584`），并把 `rotation/preRotation` 对齐到 `gameObject.angle`（`1586-1587`）。
3. 用 `gameObject.getTopLeft(pos)` 计算 body 的 `position`（`1592-1599`）——
   所以 **`x,y` 是 GameObject 的原点（锚点）坐标，不是 body 左上角，也不是脚线**。
4. `this.prev.copy(pos)`、`this.prevFrame.copy(pos)`、`this.autoFrame.copy(pos)`（`1601-1603`）。
5. `updateBounds()` / `updateCenter()`（`1607-1610`）；`collideWorldBounds` 为真时再 `checkWorldBounds()`（`1612-1615`）。
6. `resetFlags(true)`（`1617`）—— 清碰撞状态：
   `wasTouching` / `touching` / `blocked` 全置为 `none=true, up/down/left/right=false`，
   `overlapR/X/Y = 0`，`embedded = false`（`Body.js:1076-1108`；`SetCollisionObject.js:20-38`）。

JSDoc 原文（`Body.js:1564-1575`）：

> Sets this Body's parent Game Object to the given coordinates and resets this Body at the new coordinates.
> If the Body had any velocity or acceleration it is lost as a result of calling this.

`updateFromGameObject` 的 JSDoc 还专门写着（`Body.js:1049`）：

> To resynchronize the Body with its Game Object, use `reset()` instead.

`body.reset` **不会**重置：`gravity`、`drag`、`bounce`、`mass`、`size/offset`、`enable`、
`collideWorldBounds`、`maxVelocity`、`checkCollision`、`allowGravity`、`customSeparateX/Y`。
它只是「把人和体一起摆到新位置，并把这一步的运动/碰撞记忆清干净」。
它**也不会**把 body 从固体里推出来——它不做任何分离。

### 2.2 与 `setPosition` / `body.stop()` / 手动清速度的差异

| 状态 | `GameObject.setPosition(x,y)` | `body.stop()` | `body.velocity.set(0,0)` | `body.reset(x,y)` |
|---|---|---|---|---|
| GameObject 位置 | ✅ 立即 | ❌ | ❌ | ✅ 立即 |
| body `position/center` | ❌ 要等下一帧 `preUpdate → updateFromGameObject`（`Body.js:1124-1131, 1054-1064`） | ❌ | ❌ | ✅ 同帧（`Body.js:1592-1610`） |
| velocity / acceleration / speed / angular | ❌ | ✅ `Body.js:1630-1634` | 只 velocity | ✅（经 `stop()`） |
| `prev` / `prevFrame` / `autoFrame` | ❌ | ❌ | ❌ | ✅ `Body.js:1601-1603` |
| `touching` / `blocked` / `wasTouching` | ❌ | ❌ | ❌ | ✅ 清空 `Body.js:1617, 1090-1102` |
| `embedded` / `overlapX/Y/R` | ❌ | ❌ | ❌ | ✅ 清空 `Body.js:1104-1108` |
| 本帧 `postUpdate` 是否还会把旧 body 位移加到新位置上 | **会**（`Body.js:1240-1241, 1276-1277`） | 会 | 会 | **不会**（`prevFrame` 已重设，dx/dy=0） |

关键差异就是最后一行，也是本次 bug 的真凶：

- 碰撞回调（hazard overlap）发生在这一帧 `body.update()` 之后、`postUpdate()` 之前
  （`World.js:936-1013`，`World.postUpdate` 挂在 Scene `POST_UPDATE`：`ArcadePhysics.js:145`）。
- `setPosition` 只改了 sprite；`body.position` 还停留在旧位置。
- `postUpdate` 随后执行 `gameObject.x/y += body.position - prevFrame`（`Body.js:1240-1241, 1274-1277`），
  把「旧 body 这一步的位移」加到刚传送的 sprite 上。
- 下一帧 `preUpdate` 再用被加过的 sprite 反推 body（`Body.js:1124-1131`）⇒ body 进入地面 `dy` 像素。

`body.stop()` 和手动清速度都只动速度，位置/prev 的污染一样在，所以单独用它们不能修这个 bug。

### 2.3 官方文档链接

- Body API（含 `reset` / `stop` / `resetFlags` / `updateFromGameObject`）：
  <https://docs.phaser.io/api-documentation/3.88.2/class/physics-arcade-body#reset>
  （3.88.2 是检索到的可访问版本；3.90.0 的同名 API 与本机源码一致，语义以 §2.1 源码为准）
- Arcade Physics 概念（`fps` / `fixedStep` / 固定步长）：
  <https://docs.phaser.io/phaser/concepts/physics/arcade>
- World API（`fps` / `fixedStep` / `OVERLAP_BIAS`）：
  <https://docs.phaser.io/api-documentation/3.88.2/class/physics-arcade-world>
- 官方源码（v3.90.0，可直接对照本文件行号）：
  - <https://github.com/phaserjs/phaser/blob/v3.90.0/src/physics/arcade/Body.js#L1576>
  - <https://github.com/phaserjs/phaser/blob/v3.90.0/src/physics/arcade/World.js#L936>
  - <https://github.com/phaserjs/phaser/blob/v3.90.0/src/physics/arcade/GetOverlapY.js#L26>
- 注：本环境无法抓取以上页面（网络策略），所有语义均已在本机 3.90.0 源码逐行核对。

## 3. Q3 · 重置到空中 / 固体内部 / 地面以下

### 3.1 重置到空中

正常：`body.reset` 后速度为 0，下一步开始受 900 px/s² 重力，自由下落；没有接触就没有分离。
只要落点与地面之间没有东西，最终会落地。**空中的重置本身没有问题**，问题出在「落点被 postUpdate
偏移到了地面内部」（§2.2）。

### 3.2 重置到固体内部：会不会被推出来

Arcade 的分离不是「只要重叠就推出」，而是有防穿透窗口（`GetOverlapY.js:26-42`）：

```js
var maxOverlap = body1.deltaAbsY() + body2.deltaAbsY() + bias;   // bias = World.OVERLAP_BIAS = 4
...
overlap = body1.bottom - body2.y;                                 // body1 = 玩家, body2 = 静态地形
if (overlap > maxOverlap && !overlapOnly) overlap = 0;            // ⇒ 不分离
```

- 静态地形的 `deltaAbsY()` 恒为 0；玩家每步的 `|_dy|` 在 60 Hz 下约 `v/60`。
- 刚 `body.reset`（速度 0）后的下一步，`|_dy| ≈ 900/3600 = 0.25 px` ⇒
  下一步 `overlap = p + 0.25`、`maxOverlap = 0.25 + 4 = 4.25`，所以**重置时埋入 p ≤ 4 px 会被推出，
  p > 4 px 会被拒绝**。
- 若重置后脚底已经在地面顶边以下 **超过 ~4 px**，分离被拒绝；之后每一步穿透更深，永远追不上，
  于是继续往下「沉」并穿过。`embedded` 也救不了：它只在双方 `_dy === 0` 时才置位
  （`GetOverlapY.js:28-32`），玩家受重力，`_dy` 不为 0。

数值复算（与 Phaser 公式同构，见 §3.4）——`body.reset` 到不同 y、地面顶边 250、体高 64：

| 重置后脚底 y | 结果 |
|---|---|
| 245（高于地面 5 px） | 第 6 帧落地，静止在 250 |
| 250（齐平） | 第 1 帧被分离，静止在 250 |
| 252 / 253 / 254（埋入 2–4 px） | 第 1 帧被推出，回到 250 |
| 255（埋入 5 px） | **不分离，掉穿**（4–5 px 之间是边界，4.0 px 仍可纠正） |
| 270 / 300（更深） | **不分离，掉穿** |

结论：**重置可以「浅埋」，不能「深埋」**。推荐把脚底放在地面顶边（0 穿透），把 4 px 留给锚点/
取整误差。

### 3.3 重置到地面以下（与地形完全不相交）

没有 overlap ⇒ 没有碰撞响应 ⇒ 一直自由下落。本仓 `collideWorldBounds=false`（`Body.js:766`；
全仓未调用 `setCollideWorldBounds`），世界底部**不是地板**（同类口径见
`packages/contracts/src/reachability.ts:108-112`）⇒ 掉出世界后不可恢复。这正是 E3 的终态。

### 3.4 「重复重置累积下沉」的准确说法

- 现行 `setPosition` 路径不是「每重置一次固定下沉 N 像素」，而是**每次重置都把上一物理步的位移
  `dy` 加到新位置上**。`dy` 随重置瞬间的 `vy` 增大（`dy ≈ (vy + g·dt)·dt`），所以**下落越快越容易一次掉穿**；
  同一落点重复重置，只要每次都在下落，每次都可能重新引入同样的坏状态。
- 在 60 Hz、`OVERLAP_BIAS=4` 下，分离能否发生由 `dy ≤ 4 + 0.25` 决定 ⇒
  **重置瞬间 `vy ≳ 225 px/s` 就会掉穿**（900 px/s² 下约 0.25 s 的自由落体）。
  E3 重置前 `vy=300`，`dy = 315/60 = 5.25 px`，已越界。
- 用 `body.reset` 的绝对重置则**每次结果完全相同**（位置来自不可变的地形/出生数据，速度归零，
  `prevFrame` 重设），N 次重置 = 同一条脚线，**不累积**。若实现成「相对当前位置挪一点」或
  「只 setPosition + 手动 y 补偿」，才可能累积。

#### 数值复算（模型，不是 Phaser 运行时）

按 Phaser 3.90 的公式逐帧复算：`preUpdate` 同步 body → `v += g·dt`、`y += v·dt`、
`_dy = v·dt` → 地形分离用上面的 `maxOverlap` 规则 → `postUpdate` 把 `body.pos - prevFrame`
加回 GameObject。

| 帧 | 现行 `setPosition` 路径（重置前 vy=300） | `body.reset` 路径 |
|---|---|---|
| 重置帧 | GO y = 250 + 5.25 = **255.25** | GO y = **250** |
| 第 1 帧 | 255.50（穿透 5.5 > 4.25 ⇒ 不分离） | 250（分离，站稳） |
| 第 2 帧 | 256.00 | 250 |
| 第 3 帧 | 256.75 | 250 |
| … | … | 250 |
| 第 7 帧 | **262.25** | 250 |

归档在上一采样（`vy=300`）之后 155 ms 采到 **262.5**；复算轨迹从 255.25 起在 7 个物理步后为 262.25、
9–10 步为 261–264 —— 数值落在采样窗口内。这是对根因模型的吻合（E1 模型 + E3 归档，
不是新的浏览器运行）；真正的判据仍是 5.25 px > 4 px 的防穿透窗口，而不是这个半像素级对时。

## 4. Q4 · `spawn` 从哪来、能不能保证可站立

### 4.1 来源

- 配置字段：`player.at`（`packages/contracts/src/game-config.ts:154-155`，注释：「出生点。锚点落在这一点上
  （角色的**脚**在这里）」）。
- 进纯层：`world.ts:164` `at: cfg.player.at`，同一个对象同时生成 `box: boxAt(cfg.player.at, playerSize, playerAnchor)`。
- 进渲染层：`scene.ts:185`（建 sprite）与 `scene.ts:266`（`hitHazard` 的传送目标）。
- `boxAt` 就是契约的 `entityBox`（`packages/demo/src/draw.ts:133`；`game-config.ts:107`），
  **盒底 = 脚线**（取整后）。

### 4.2 保证吗？不保证

- `at` 是**锚点**，不一定是脚：真包 `scavenger-actor` 的锚点是 `{0.5,1}`（脚= at.y），
  而 `last-train` 的 `player-traveler` 是 `{0.5,0.95}`、高 48 ⇒ 脚线 `at.y + 0.05×48 = at.y+2.4`
  （见 `reachability.ts:75-86` 的同一段解释）。`fixtures/game-configs/last-train.json:8-10`
  的 `at.y=250`、地面顶边也是 250，所以这个 fixture 的脚线实际埋进土里 2.4 px（由物理推出，见 §3.2）。
- 构建期只校验：`player.at` 在世界内（`game-config.ts:429`）且**不在 `solid` 实体的盒子内**
  （`game-config.ts:443-450`）。**没有**校验「脚下有地形」「脚在地面以上」「不是悬空」「不在 terrain 里」。
- 纯层**有足够数据**算可站立点：
  - `world.terrain: Box[]`（`world.ts:66`；由 `cfg.terrain` 映射，`world.ts:131`；schema 注释见
    `game-config.ts:195`：「只有看不见的碰撞（地面线、关卡边界、隐形墙）」）；
  - `solid` 实体的 `EntityDesc.box`（`world.ts:140`；渲染层进同一 `solids` 组，`scene.ts:145`）；
  - 契约层已有「站得住 = 脚点自由且正下方一格是实心」的定义与网格算法
    （`reachability.ts:103-114`），并明确「世界的底不是地板」（`reachability.ts:108-112`）。
    但它是 `auditReachability` 的内部逻辑，没有作为可复用 helper 暴露给外壳。
- 结论：**地面数据存在，但「spawn 可站立」不是被校验出来的**；外壳应在重置时自己从 `world.terrain`
  （+ 静态 `solid`）算出落点，并在没有落点时走显式兜底（见 §5、§7）。

## 5. Q5 · 推荐的重置序列

### 5.1 纯层：先把「可站立点」算成数据（建议放 `world.ts`，可 vitest）

```ts
// 输入：cfg.player.at / 玩家资源 size+anchor / world.terrain / kind==="solid" 且无 motion 的实体盒
const footY = player.at.y + (1 - anchor.y) * playerSize.h;   // 与 reachability.ts:83-86 的 footOf 同式
const x0 = player.box.x, x1 = player.box.x + player.box.w;

const tops = [
  ...terrain.map(t => ({ x: t.x, w: t.w, top: t.y })),
  ...entities.filter(e => e.kind === "solid" && !e.motion)
              .map(e => ({ x: e.box.x, w: e.box.w, top: e.box.y })),
]
  .filter(s => s.x < x1 && s.x + s.w > x0)   // 水平覆盖玩家盒子
  .map(s => s.top)
  .filter(top => top >= footY - 4)           // 脚下（或允许 4px 的「浅埋」）；4 = OVERLAP_BIAS
  .sort((a, b) => a - b);

player.floorY = tops[0] ?? footY;            // 没有落点 ⇒ 回退到作者写的脚线（显式兜底，见风险）
```

要点：

- 用**脚线**（`at.y + (1-anchor.y)·h` 或 `box.y + box.h`）而不是 `at.y` 直接当地面——
  `last-train` 的 `{0.5,0.95}` 锚点会差 2.4 px。
- 只把**静态** `solid` 当落点；带 `motion` 的实体会移走，不适合当重置落点。
- 选「脚线以下最近的一条顶边」（`top >= footY - 4` 里最小的）。这样出生在地面、平台、箱顶都能落到
  该表面；出生悬空时落到下方地面；出生浅埋（≤4px）时被抬回地面。
- 无落点（坑/空 terrain）⇒ 回退 `footY`，并在 `issues` 留一条 warning（如果票 07 不想新增诊断，
  至少在代码注释里写明这是已知兜底，不要让玩家静默卡死）。

### 5.2 外壳层：`hitHazard()` 的推荐序列（伪代码）

```ts
private hitHazard(): void {
  if (!this.player || this.won) return;

  const b = this.player.body as Phaser.Physics.Arcade.Body;
  const { x, y } = world.player.at;        // 作者写的锚点坐标（GameObject 坐标）

  b.reset(x, y);                            // ① stop + 同时摆 GO/body + 重设 prev/prevFrame + 清 flags
  const dy = world.player.floorY - b.bottom; // ② 用重置后的真实 body.bottom 对齐脚线（锚点/取整无关）
  if (Math.abs(dy) > 1e-3) b.reset(x, y + dy);

  // ③ setVelocity(0, 0) 已是冗余：reset → stop() 已清零 velocity/acceleration。
  //    保留也无害，但它不是修复项。
}
```

为什么这样能保证不累积下沉：

1. `reset` 把 GameObject 与 body **同帧**摆到同一处（`Body.js:1584-1610`），不存在「sprite 先走、
   body 下一帧才跟」的窗口。
2. `reset` 重设 `prev / prevFrame / autoFrame`（`Body.js:1601-1603`）⇒ 本帧 `postUpdate` 的
   `dx/dy = 0`（`Body.js:1240-1241, 1274-1277`），**不会再出现「传送 + 旧位移」的叠加**（根因消除）。
3. `stop()` 清零 velocity/acceleration（`Body.js:1630-1634`），`resetFlags(true)` 清掉
   `touching/blocked/embedded/overlap`（`Body.js:1617, 1076-1108`），下一步从干净状态开始。
4. 第二次 `reset` 用 `b.bottom` 做**绝对脚线校正**：不管资源锚点是 1.0 还是 0.95、body offset 是多少、
   `entityBox` 取整差多少，脚底都正好落在 `floorY` ⇒ 0 穿透（或最多 4px 浅埋，仍在分离窗口内）。
5. 每次重置的输入都是**不可变的** `world.player.at` + `world.terrain`/静态 solid，不读取当前 body 状态
   ⇒ 第 N 次重置与第 1 次结果逐像素相同。**重复重置不累积**。

替代写法（不想二次 reset）：在纯层直接算 `spawnSpriteY = floorY - (1 - anchor.y) * size.h`，然后
`b.reset(spawn.x, spawnSpriteY)`。它在本仓的整数坐标 + `{0.5,1}` 锚点下等价；但 `b.bottom` 校正对
「逐帧锚点/缩放/取整」更稳，推荐前者。

### 5.3 不要做的事

- 不要只 `setPosition`（哪怕后面再 `setVelocity(0,0)`）。
- 不要用「`setPosition` 后把 y 减 1–2 px」这类相对补偿：方向对，但仍没清 `prev/prevFrame`，
  下一个 `postUpdate` 仍会叠加旧位移，且补偿量随速度失效。
- 不要把 `floorY` 选成带 `motion` 的实体顶边。
- 不要动 `advanceHazards`（票 07 边界明确不改运动轨迹）。

## 6. Q6 · 可测试性：纯逻辑 / 外壳测试，还是必须浏览器 smoke

### 6.1 纯逻辑能钉住什么

`packages/demo` 的纯层 `world.ts` / `draw.ts` 零 Phaser、零 DOM（`world.ts:1-4`；`index.ts:3-6`），
可以在 vitest 里直接测。建议把 §5.1 的「可站立点」做成纯函数/字段并测：

- 真包锚点 `{0.5,1}`：`at.y=250`、地面 `terrain[0].y=250` ⇒ `floorY=250`；
- `last-train` 锚点 `{0.5,0.95}`：脚线 252.4、地面 250 ⇒ `floorY=250`（必须抬回地面，而不是 252.4）；
- 土埋 3 px / 悬空 / 箱顶 / 无地形（坑）各一条用例；
- 断言 `floorY` 是纯函数结果，不依赖当前 body。

现有测试的入口：`packages/demo/tests/world.test.ts:8-22`（从 `src/index.js` 导入、读 `fixtures/` 真包/真配置）。

### 6.2 外壳级只能做「见证」，测不到物理行为

`packages/demo/src/shell/scene.ts:8` `import Phaser from "phaser"`，在 Node 里 import 会失败
（实测：`require('phaser')` → `window is not defined`；仓库没有 jsdom/happy-dom 依赖，
`pnpm test` 默认无浏览器）。现有两条测试的纪律就是**读剥掉注释后的源码文本**：

- `packages/demo/tests/shell-scene-wiring.test.ts:1-19`（`between(...)` 截活代码）；
- `packages/demo/tests/shell-capability-witness.test.ts:7-10, 44-63`（`stripComments` + 行为串）。

票 07 可以照这个模式加一条「见证」：

```ts
const hit = between("private hitHazard(", "private tryWin(");
expect(hit).toContain(".reset(");        // 必须同步物理体
expect(hit).not.toContain("setPosition"); // 不允许只动 GameObject
```

它能在旧代码上红、新代码上绿，但它**只证明实现选了 `reset`，不证明运行时不再掉穿**。

### 6.3 真正的行为证据必须靠票 10 的浏览器 smoke

`pnpm test` 无浏览器依赖（map Q8 A），唯一能跑真实 Arcade 的是票 10 的 CDP smoke
（`issues/10-p0-03-headless-playable-smoke.md:14-22`）。建议在票 10 加一条 W6 用例：

1. 复用 `repro-hazard.mjs` 的状态读取（`.scratch/p0-00-audit/runs/2026-10-20a-head-replay/repro-hazard.mjs`
   的 `STATE` 表达式已经读 `x/y/vx/vy/onFloor/blockedRight/collected/won`，见该文件第 25 行附近）；
2. 驱动「木箱顶起跳 → 空中撞 hazard → 重置」；
3. 重置后连续采样（例如 30 帧 / 500 ms）：断言 `body.bottom <= floorY + 1`、`onFloor` 变真、
   `y` 不落到世界高（270）以下、`won`/`collected` 不变；
4. **重复触发两次**，断言两次静止脚线相同（不累积下沉）；
5. 负例：把 `terrain` 挪走 5 px（或人为 `setPosition` 旧实现）⇒ 该用例必须红。

### 6.4 结论

| 层 | 能验证 | 不能验证 |
|---|---|---|
| vitest 纯逻辑 | 可站立点/脚线/回退策略、config→world 数据 | 任何 Arcade 时间步行为 |
| vitest 源码见证 | `hitHazard` 用了 `body.reset`、没退回 `setPosition` | 运行时是否真的不掉穿 |
| 票 10 浏览器 smoke | 重置后位置/`onFloor`/重复重置不累积、完整可玩循环 | 像素/风格（不在 P0-03） |

⇒ **两者都要**：票 07 用纯逻辑 + 见证钉住「选对了」，票 10 用 CDP 钉住「真的管用」。
票 07 的验收原文允许「自动化测试（或票 10 smoke 的对应用例）」，本结论与之一致。

## 7. 风险清单

1. **没有落点**：出生点悬在坑上 / `terrain` 为空 ⇒ 纯层回退到作者脚线，玩家仍会下落。
   这是数据问题；至少留 warning 或代码注释，不要假装已可站立。本仓 `empty-world.json` 的
   `terrain: []` 且玩家资源不存在（stub），`hitHazard` 因 `this.player` 为空直接 return，不会触发。
2. **落点被实体占据**：构建期只查 `player.at` 是否在 `solid` 实体的盒子里（`game-config.ts:443-450`），
   没查整个 body 宽度；若重置列的 `floorY` 上方正好压着一个 `solid`，会重置进墙。
   可选：在纯层把「与玩家盒子相交的静态 solid」排除或另选最近空列（票 07 边界内，但会增加复杂度）。
3. **逐帧锚点**：`scene.ts:182-185` 说明帧的 `anchor` 会经 `Frame.customPivot` 逐帧设置 origin。
   若某动画帧的锚点与资源级锚点不同，body 脚线会随帧变化。用 `b.bottom` 做最终校正
   （§5.2 ②）而不是写死 `(1-anchor.y)*h`，可消掉这一层；但每次重置都应按当时帧的 body 实际值对齐。
4. **`body.reset` 不重置 gravity/drag/size**：这是我们要的（`setGravityY(900)` 保留）；但不要误以为
   它会把 body 复原成「刚创建」的样子。
5. **固定步长追帧**：`fixedStep=true` 时一帧可能跑多个 step（`World.js:936-1013`），现行 bug 的 `dy`
   会按步数放大；`body.reset` 因重设 `prevFrame` 不受影响。不要为了让「看起来稳」而改 `fixedStep`/`fps`
   ——那会改变整个手感与既有 e2e 的物理，超出本票。
6. **移动 solid 当落点**：`motion` 实体会走开；§5.1 已排除。
7. **不要用世界底兜底**：`collideWorldBounds=false` 且契约明确「世界的底不是地板」
   （`reachability.ts:108-112`）；把 `y >= world.h` 当「站住」会把每条沟都变成可通行。
8. **票 07 的另一半（gate 绑定）与物理无关**：本文件的序列只作用于 `hitHazard`，不改
   `tryWin`/`objective.gate` 的修复。

## 8. 引用清单

### 8.1 本仓（E1）

- `packages/demo/package.json:15` — Phaser `^3.90.0`
- `pnpm-lock.yaml:619`、`pnpm-lock.yaml:1064` — 锁定 3.90.0
- `packages/demo/src/shell/entry.ts:83` — Arcade `gravity {0,0}`，无 fps/fixedStep
- `packages/demo/src/shell/scene.ts:44, 50, 125-128, 145, 196` — 静态固体与 collider
- `packages/demo/src/shell/scene.ts:179-197` — 玩家 body 创建（`setSize(...,false)`、`setGravityY`）
- `packages/demo/src/shell/scene.ts:85-87` — 每帧速度/跳跃
- `packages/demo/src/shell/scene.ts:263-267` — `hitHazard` 现状
- `packages/demo/src/world.ts:66, 131, 140, 164-165` — `terrain` / 实体盒 / `player.at` / `box` / `move`
- `packages/contracts/src/game-config.ts:90` — 默认 `speed 90 / jumpVelocity 330 / gravity 900`
- `packages/contracts/src/game-config.ts:107` — `entityBox`（盒底=脚线）
- `packages/contracts/src/game-config.ts:154-155, 196` — `player.at`、`terrain` schema
- `packages/contracts/src/game-config.ts:429, 443-450` — 出生点只查世界内 / 不在 solid 实体里
- `packages/contracts/src/reachability.ts:75-86, 103-114, 177-197` — 脚点定义 / 站得住定义 / 不信任出生点
- `packages/demo/tests/world.test.ts:8-22` — 纯层测试入口
- `packages/demo/tests/shell-scene-wiring.test.ts:1-19`、`shell-capability-witness.test.ts:7-10, 44-63`
  — 源码见证纪律
- `fixtures/game-configs/last-train.json:8-10` — `at.y=250` / 地面顶边 250 / 锚点 0.95 的真 fixture
- `node_modules/.pnpm/phaser@3.90.0/node_modules/phaser/src/physics/arcade/Body.js`
  - `1576-1618` `reset`；`1628-1637` `stop`；`1076-1108` `resetFlags`
  - `1049, 1054-1064` `updateFromGameObject`；`1124-1151` `preUpdate`
  - `1236-1279` `postUpdate`（`1240-1241` dx/dy，`1274-1277` 加回 GameObject）
  - `1479-1520` `setSize`（`1509-1515` 仅 `center=true` 时改 offset）
  - `185` offset 默认 `(0,0)`；`497` `maxVelocity` 默认 10000；`766` `collideWorldBounds` 默认 false
- `.../World.js:159, 170, 190, 236` — fps 60 / fixedStep true / frameTime / OVERLAP_BIAS 4
- `.../World.js:936-1013` — 固定步长更新与追帧
- `.../GetOverlapY.js:26-42` — `maxOverlap` 防穿透窗口
- `.../ArcadePhysics.js:145` — `World.postUpdate` 挂 Scene `POST_UPDATE`

### 8.2 归档运行证据（E3，未重新运行）

- `docs/v4/P0-00-e2e-evidence.md:92-99` — 失败样例叙述
- `.scratch/p0-00-audit/runs/2026-10-20a-head-replay/hazard-repro-trace.json` — 轨迹（重置前 vy=300，
  下一采样 y=262.5，最终 y=413）
- `.scratch/p0-00-audit/runs/2026-10-20a-head-replay/repro-hazard.mjs` — 状态读取与驱动（票 10 可复用）

### 8.3 外部（官方文档/源码链接，供复核）

- Body API：<https://docs.phaser.io/api-documentation/3.88.2/class/physics-arcade-body#reset>
- World API：<https://docs.phaser.io/api-documentation/3.88.2/class/physics-arcade-world>
- Arcade Physics 概念：<https://docs.phaser.io/phaser/concepts/physics/arcade>
- v3.90.0 源码：<https://github.com/phaserjs/phaser/blob/v3.90.0/src/physics/arcade/Body.js#L1576>
  · <https://github.com/phaserjs/phaser/blob/v3.90.0/src/physics/arcade/World.js#L936>
  · <https://github.com/phaserjs/phaser/blob/v3.90.0/src/physics/arcade/GetOverlapY.js#L26>

> 本环境无法抓取上述页面（网络策略）；§2–§5 的每条语义均以本机安装的 3.90.0 源码行号为准。
