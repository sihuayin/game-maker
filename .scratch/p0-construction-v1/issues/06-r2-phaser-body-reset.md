# 06. [research] Phaser Arcade `body.reset` 语义与本仓物理设置

Type: research
Status: resolved
Owner: research 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

为票 07（危险物软锁修复）提供物理事实：当前 `hitHazard()` 只 `setPosition(spawn)`，
实测重置后 y=262.5（地面顶 250）继续下落到 413+，掉穿地面。要修对，先要知道 Phaser 的真实语义。

1. 本仓 `packages/demo` 用的 Phaser 版本、Arcade Physics 配置（gravity / fps / fixedStep）、
   玩家 body 的创建方式（size / offset / collideWorldBounds / velocity 上限），给 `path:line`。
2. `body.reset(x, y)` 的官方语义：它重置哪些状态（position / velocity / acceleration / touching /
   blocked / embedded / prev）？与 `setPosition`、`body.stop()`、手动清零 velocity 的差异？
   引用 Phaser 官方文档或源码（允许联网查官方文档）。
3. 重置到「空中」「固体内部」「地面以下」分别会发生什么？会不会隧道 / 下沉？
4. 本仓 `spawn` 点从哪来、是否保证可站立？config / world 里有没有地面数据可用于判定可站立位置？
5. 给出推荐的 `hitHazard()` 重置序列（伪代码级），并说明为什么能避免「重复重置累积下沉」。
6. 这些行为能否在纯逻辑 / 外壳测试里验证，还是必须靠票 10 的浏览器 smoke？

## 验收

- 事实表 + 带 `path:line` 的本仓证据；外部语义引用官方文档链接。
- 推荐重置序列 + 风险清单 + 可测试性结论。
- 证据文件 `.scratch/p0-construction-v1/research/phaser-body-reset.md`；票内 `## Answer` 摘要。

## 边界

- 只读代码与文档；不改代码 / 测试；不跑真实站点（可跑只读检查）；零付费；不提交。
- 不扩大为运行时重构；只回答「怎么把玩家安全重置回可站立位置」。

## Answer

完整证据（含逐行源码引用、数值复算、风险清单）：
[`research/phaser-body-reset.md`](../research/phaser-body-reset.md)。

### 1. 本仓物理事实

| 项 | 值 | 证据 |
|---|---|---|
| Phaser | 3.90.0（声明 `^3.90.0`，锁文件锁定） | `packages/demo/package.json:15`；`pnpm-lock.yaml:619,1064` |
| Arcade | 世界重力 `{x:0,y:0}`；未设 fps / fixedStep / overlapBias ⇒ 默认 **60 Hz、fixedStep=true、OVERLAP_BIAS=4** | `packages/demo/src/shell/entry.ts:83`；`World.js:159,170,236` |
| 玩家重力 | body 级 `setGravityY(900)`（默认 `gravity 900 / speed 90 / jumpVelocity 330`） | `packages/demo/src/shell/scene.ts:188`；`packages/contracts/src/game-config.ts:90` |
| body 创建 | `physics.add.sprite` → `body.setSize(box.w, box.h, false)`；`center=false` ⇒ **offset 保持 (0,0)** | `scene.ts:185-187`；`Body.js:1509-1515,185` |
| 世界边界 | **未启用** `collideWorldBounds`（默认 false）⇒ 掉出世界无地板 | 全仓 grep；`Body.js:766` |
| 速度 | 每帧 `setVelocityX(±90)`；跳跃 `setVelocityY(-330)`；**无 maxVelocity 上限**（引擎默认 10000） | `scene.ts:85-87`；`Body.js:497` |
| 碰撞 | 玩家 vs `solids` 静态组（`terrain` 矩形 + `solid` 实体盒） | `scene.ts:44,50,125-128,145,196` |

现行 `hitHazard()` 实际是 `setPosition(...).setVelocity(0,0)`（`scene.ts:264-267`）——**速度已清零**，
缺的不是速度，而是 body 位置与 `prev/prevFrame` 同步。

### 2. `body.reset(x,y)` 语义（官方源码）

`Body.reset`（`Body.js:1576-1618`）= `stop()` + `gameObject.setPosition(x,y)` + 由
`getTopLeft` 重算 body `position` + 重设 `prev/prevFrame/autoFrame` + `updateBounds/updateCenter`
+ `resetFlags(true)`。

- `stop()` 清零 `velocity`、`acceleration`、`speed`、`angularVelocity`、`angularAcceleration`（`Body.js:1628-1637`）；
- `resetFlags(true)` 清 `touching`、`blocked`、`wasTouching`、`overlapX/Y/R`，`embedded=false`（`Body.js:1076-1108,1617`）；
- `x,y` 是 **GameObject 原点（锚点）坐标**，不是 body 左上角/脚线（`Body.js:1592-1599`）；
- **不**重置 gravity / drag / bounce / size / offset / enable / collideWorldBounds（这些保持不变）。

对照：

| | `setPosition` | `body.stop()` | 手动 `velocity.set(0,0)` | `body.reset(x,y)` |
|---|---|---|---|---|
| GameObject 位置 | ✅ | ❌ | ❌ | ✅ |
| body 位置 | ❌ 下一帧才同步 | ❌ | ❌ | ✅ 同帧 |
| velocity/acceleration | ❌ | ✅ | 仅 velocity | ✅ |
| `prev/prevFrame/autoFrame` | ❌ | ❌ | ❌ | ✅ |
| `touching/blocked/embedded/overlap` | ❌ | ❌ | ❌ | ✅ |

**根因**：overlap 回调在 `body.update()` 之后、`postUpdate()` 之前（`World.js:936-1013`；
`ArcadePhysics.js:145`）。`setPosition` 只动 sprite，body 还在旧处；随后 `postUpdate` 执行
`gameObject.y += body.position.y - prevFrame.y`（`Body.js:1240-1241,1274-1277`），把旧 body
这一步的位移叠到刚传送的 sprite 上，使脚底落入地面 `dy` 像素。若 `dy` 超过防穿透窗口
`|body._dy| + 4`（`GetOverlapY.js:26,39`），分离被拒绝，永久下坠。

官方文档（本环境无法抓取，语义已逐行对照本机 3.90.0 源码）：
- <https://docs.phaser.io/api-documentation/3.88.2/class/physics-arcade-body#reset>
- <https://docs.phaser.io/phaser/concepts/physics/arcade>
- <https://docs.phaser.io/api-documentation/3.88.2/class/physics-arcade-world>
- <https://github.com/phaserjs/phaser/blob/v3.90.0/src/physics/arcade/Body.js#L1576>
- <https://github.com/phaserjs/phaser/blob/v3.90.0/src/physics/arcade/GetOverlapY.js#L26>

### 3. 重置到空中 / 固体内部 / 地面以下

- **空中**：正常；速度 0 后自由落体，无异常。
- **固体内部**：只有穿透 ≤ `|_dy| + OVERLAP_BIAS(4)` 才会被推出。静止/刚 reset 后
  `|_dy|≈0.25 px`（900 px/s²、60 Hz）⇒ 可纠正 **≤4 px** 的浅埋；**超过约 4 px 的埋入（>4 px）则拒绝分离并继续下沉**。
  `embedded` 也救不了（只在双方 `_dy===0` 时置位，`GetOverlapY.js:28-32`）。
- **地面以下（不相交）**：无碰撞、自由落体；`collideWorldBounds=false`，**永不可恢复**。
- **重复重置**：现行 `setPosition` 路径每次把上一物理步的 `dy` 叠到新位置，`dy≈(vy+g·dt)·dt`；
  60 Hz 下 **重置瞬间 `vy ≳225 px/s`（约 0.25 s 自由落体）就会掉穿**。E3 重置前 `vy=300`
  ⇒ `dy=5.25 px`，正好越界。
- 归档 `y=262.5` 是**重置后若干物理步的采样**，不是传送目标（目标仍是 250）。按 Phaser 公式复算，
  带 5.25 px 初始偏移的轨迹在 7 步后为 **262.25**、9–10 步为 **261–264**，落在 155 ms 采样窗口内
  （模型 + E3，非新运行）；硬判据是 5.25 px > 4 px 的防穿透窗口。

### 4. `spawn` 与可站立数据

- `spawn = cfg.player.at`（`packages/contracts/src/game-config.ts:154-155` → `world.ts:164` →
  `scene.ts:185,266`）。`at` 是**锚点**：真包 `scavenger-actor` 锚点 `{0.5,1}`（脚=at.y=250），
  `last-train` 是 `{0.5,0.95}`、高 48 ⇒ 脚线 `at.y+2.4`（见 `reachability.ts:75-86`）。
- **可站立数据存在**：`world.terrain: Box[]`（`world.ts:66,131`）、`solid` 实体盒（`world.ts:140`）；
  契约层已有「站得住 = 脚点自由且正下方一格实心」的算法（`reachability.ts:103-114`）。
- **但不保证**：构建期只查 `player.at` 在世界内（`game-config.ts:429`）且不在 `solid` 实体盒内
  （`game-config.ts:443-450`）；不查脚下是否有地形/是否悬空/是否在 terrain 里。
  ⇒ 外壳必须自己算落点，并显式处理「没有落点」。

### 5. 推荐 `hitHazard()` 重置序列

纯层（建议 `world.ts`，可 vitest）先算出 `player.floorY`：

```ts
const footY = player.at.y + (1 - anchor.y) * playerSize.h;   // 或 player.box.y + player.box.h
const tops = [
  ...terrain.map(t => ({ x: t.x, w: t.w, top: t.y })),
  ...entities.filter(e => e.kind === "solid" && !e.motion).map(e => ({ x: e.box.x, w: e.box.w, top: e.box.y })),
].filter(s => s.x < player.box.x + player.box.w && s.x + s.w > player.box.x)
 .map(s => s.top).filter(top => top >= footY - 4).sort((a, b) => a - b);
player.floorY = tops[0] ?? footY;   // 无落点 ⇒ 回退作者脚线（需显式告警/注释）
```

外壳（`scene.ts`）：

```ts
private hitHazard(): void {
  if (!this.player || this.won) return;
  const b = this.player.body as Phaser.Physics.Arcade.Body;
  const { x, y } = world.player.at;
  b.reset(x, y);                              // ① 同步 GO+body、清零速度、重设 prev/flags
  const dy = world.player.floorY - b.bottom;  // ② 按真实 body.bottom 对齐脚线（锚点/取整无关）
  if (Math.abs(dy) > 1e-3) b.reset(x, y + dy);
  // setVelocity(0,0) 已冗余（reset→stop 已清零）
}
```

为什么不再累积下沉：`reset` 同帧摆 GO+body 并重设 `prev/prevFrame/autoFrame`（根因消除）、
`stop()` 清零速度/加速度、`resetFlags(true)` 清碰撞记忆；第二次 reset 用不可变的 `floorY` 与
**重置后实际 `body.bottom`** 做绝对对齐 ⇒ 脚底 0 穿透（或 ≤4 px 浅埋，在分离窗口内），
每次输入相同、结果逐像素相同。

### 6. 可测试性

- **纯逻辑可测**：落点/脚线/回退策略放 `world.ts`（零 Phaser/DOM，`world.ts:1-4`），
  在 `world.test.ts` 用真包（锚点 1.0）与 `last-train`（锚点 0.95）各测：地面、浅埋、悬空、
  箱顶、无地形。
- **外壳只能做源码见证**：`scene.ts:8` import Phaser，Node 里 `require('phaser')` 直接
  `window is not defined`；既有测试靠读剥注释后的源码（`shell-scene-wiring.test.ts:1-19`、
  `shell-capability-witness.test.ts:7-10,44-63`）。可加「`hitHazard` 含 `.reset(`、不含
  `setPosition`」的红→绿见证。
- **真实物理行为必须靠票 10 的浏览器 smoke**：复用
  `.scratch/p0-00-audit/runs/2026-10-20a-head-replay/repro-hazard.mjs` 的状态读取，跑 W6 序列
  （木箱顶起跳 → 空中撞 hazard → 重置），断言重置后脚底回到地面、`onFloor=true`、不掉出世界；
  **重复触发两次**断言静止脚线相同。票 07 的纯逻辑 + 见证证明「选对了」，票 10 证明「真的管用」。

### 风险（详见证据文件 §7）

1. 出生点悬空 / `terrain` 为空 ⇒ 无落点，只能回退，需显式告警，不能假装可站立。
2. 落点列上方可能压着 `solid`（构建期只查 `player.at` 一点，不查整个 body 宽度）。
3. 帧级 `anchor` 可能与资源锚点不同（`scene.ts:182-185`）⇒ 用 `body.bottom` 校正，不写死偏移。
4. `reset` 不重置 gravity/drag/size（这里正需要保留 900 重力）；不要误用为「完全重建体」。
5. 不要改 `fps/fixedStep` 来掩盖问题（会改变手感与既有 e2e 物理）；`reset` 对追帧免疫。
6. 排除 `motion` 实体作为落点；不要把世界底当地板。

**结论**：票 07 应采用「纯层算 `floorY` + `body.reset` 两次对齐脚线」；现行 `setPosition` 即使
清零速度也必然在 `vy ≳225 px/s` 时掉穿。零付费、未改代码、未运行站点。
