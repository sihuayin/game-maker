# P0-01 移动 Hazard Runtime 增量语义核验

> 以 LP-00 报告为**冻结基线**，只核验移动 Hazard 特有的 Runtime 时序语义。
> 不重做全量 Runtime 审计；LP-00 已明确回答的事实直接引用并标注，LP-00 没有回答的
> 由本报告的 E1（源码 `file:line`）/ E2（既有测试）/ E3（只读语料扫描）给出，不把
> “源码没写”写成“已确认”。

## 0. 文首记录

| 项 | 值 |
|---|---|
| 日期 | 2026-11-06（核验）& 2026-11-07（落盘） |
| 当前分支 | `p1/level-playability-v1.1-p0` |
| 基线 HEAD SHA | `ed0c4341308ef635932c57e2d228ad3315cb8948` |
| 冻结基线（LP-00） | `.scratch/level-playability-v1-p1/research/01-runtime-semantics.md` @ `8b8e45a15ace345c5ffb5de19e0ad54171b4dd58` |
| Runtime 代码未变 | `git diff --stat 8b8e45a HEAD -- packages/demo/src packages/contracts/src/game-config.ts packages/demo/node_modules/phaser/src` 为空；`git diff --stat main -- packages fixtures` 为空 |
| Phaser 版本 | `phaser@3.90.0`（`packages/demo/node_modules/phaser/package.json`） |
| 调查范围 | 仅移动 Hazard：三角波轨迹 / `start` 来源 / 时间推进 / 位置更新与碰撞顺序 / 碰撞体 / 与 `danger.periodMs` 的区别 |
| 性质 | 只读研究。未修改 Runtime、测试、fixture、历史 run/pack/site；未 commit / push；零模型调用、零生图、零站点重建 |
| 证据级别 | E1 = `file:line`；E2 = 既有测试名 + 断言 + 退出码；E3 = 零付费只读语料扫描 |

### 0.1 与 LP-00 的分工

| LP-00 编号 | 已答内容 | 本报告处理 |
|---|---|---|
| P1（§2.3 / §2.4） | pickup / hazard / goal 的物理体由 Phaser 按图集帧创建；`StaticBody` 宽高 = `displayWidth/Height`，位置 = sprite 位置 − 帧尺寸 × origin；accepted pack 下帧几何 == manifest 标称 size + 资源 anchor | 直接引用，补充“移动时每帧 `updateFromGameObject()`”的跟随语义 |
| P2（§3.1） | `hazard` 忽略 `e.body`；`advanceHazards` 只移动 sprite 并同步静态体；运动起点用 `d.at`，不用 `e.box` | 直接引用，补充起点/轴/锚点的逐行取值 |
| P4（§5.3） | `hitHazard()` 把玩家 `body.reset` 到出生点并做 `floorY` 校正；不涉及 hazard 状态 | 直接引用，补充“玩家复位不影响 hazard 时钟” |
| — | LP-00 **没有回答**：三角波周期语义、`start` 来源、时间推进/隐藏页/大 delta、Arcade 步与碰撞回调顺序、`danger.periodMs` 的区别 | 本报告新增 E1/E2/E3 |

### 0.2 命令与退出码

| # | 命令 | 关键输出 | 退出码 |
|---|---|---|---|
| 1 | `git rev-parse HEAD` | `ed0c4341308ef635932c57e2d228ad3315cb8948` | 0 |
| 2 | `git diff --stat 8b8e45a HEAD -- packages/demo/src packages/contracts/src/game-config.ts packages/demo/node_modules/phaser/src` | （空） | 0 |
| 3 | `git diff --stat main -- packages fixtures` | （空） | 0 |
| 4 | `npx vitest run packages/demo/tests/hazard.test.ts packages/demo/tests/shell-scene-wiring.test.ts` | `Test Files 2 passed (2)` / `Tests 10 passed (10)` | 0 |
| 5 | E3 扫描：21 份唯一横向 config 的 hazard 清单 | `{configs:21, hazards:31, withMotion:19, withBody:0, anims:18}`；motion 全部 `axis:"x"`、`kind:"cycle"` | 0 |
| 6 | E3 扫描：移动 hazard 资源的图集帧 vs manifest | `{movingHazardAssets:19, framesChecked:121, badSize:0, badAnchor:0, missingAtlas:0, missingFrame:0}` | 0 |
| 7 | E3 扫描：motion / anchor / 速度 / 交叉字段 | `motionByKind:{hazard:19}`；`anchors:{0.5,1:27, 0.5,0.85:1, 0.5,0.9:1, 0.5,0.95:1, 0.5,0.5:1}`；速度 `0.02667–0.13846 px/ms`（60fps 下 `0.44–2.31 px/frame`）；`hazardWithStrike:0, dangerWithMotion:0` | 0 |
| 8 | `git status --short`（落盘前） | ` M .scratch/level-playability-v1.1-p0/issues/02-p0-01-moving-hazard-semantics.md`（主会话的 claimed 修改，非本 agent 所改） | 0 |

> E3 全部是只读 `node - <<'EOF'` 脚本，读 `.scratch/level-playability-v1/corpus/inventory.json` 及其指向的 config / manifest / atlas JSON；不写文件、不改站点。

---

## 1. Q1：`hazardAnchor(start, distance, periodMs, elapsedMs)` 的轨迹

| # | 事实 | 结论 | 证据（E1 `file:line`） |
|---|---|---|---|
| 1.1 | 轨迹是三角波：`phase = ((elapsedMs % periodMs)+periodMs)%periodMs / periodMs`，`k = phase<0.5 ? 2*phase : 2-2*phase`，返回 `start + k*distance` | **CONFIRMED** | `packages/demo/src/hazard.ts:14-19` |
| 1.2 | `periodMs` 是**往返整周期**，不是单程：`t=0 → start`、`t=periodMs/2 → start+distance`、`t=periodMs → start`；单程耗时 = `periodMs/2` | **CONFIRMED** | `hazard.ts:16-18`；E2 `packages/demo/tests/hazard.test.ts:11-18`（620/650/680/650/620 @ 0/750/1500/2250/3000，distance 60、period 3000） |
| 1.3 | `t=0` 落在 `start`，并且从 `t=0` 起向 **+axis** 方向出发（`k` 在 `phase∈[0,0.5)` 单调增） | **CONFIRMED** | `hazard.ts:17-18`；`packages/demo/src/shell/scene.ts:161,272,276` |
| 1.4 | 两端点**不停留**；速度大小恒为 `2*distance/periodMs`（px/ms），在 `phase=0.5` 瞬时反向 | **CONFIRMED**（由公式直接推出） | `hazard.ts:16-18` |
| 1.5 | `elapsedMs` 超过一个周期会取模；扫过多个周期不累积偏移 | **CONFIRMED** | `hazard.ts:15-16`；E2 `hazard.test.ts:20-26` |
| 1.6 | `distance<=0` 或 `periodMs<=0` ⇒ 原地不动；但 schema 要求二者为正整数，合法 config 不会进入该分支 | **CONFIRMED（边界）** | `hazard.ts:15`；`packages/contracts/src/game-config.ts:83-84` |
| 1.7 | 无 `motion` 的 hazard 运行时是静态：`axis` 默认 `"x"`、`distance=0`、`periodMs=1000` | **CONFIRMED** | `scene.ts:161` |
| 1.8 | 运行时**不读** `motion.kind`；schema 只允许 `"cycle"` | **CONFIRMED** | `scene.ts:161`；`game-config.ts:79-85` |
| 1.9 | 轨迹是纯解析的，不受 terrain / solid / 世界边界约束；hazard 只注册了“玩家 × hazard”的 `overlap`，没有 `collider`，也没有 world-bounds 处理 | **CONFIRMED** | `scene.ts:157-165`（仅 `overlap`）；`scene.ts:270-280`（只 `setPosition` + `updateFromGameObject`） |
| 1.10 | 所有 hazard 都在同一次 `create()` 中创建、`t0` 均初始化为 0，并且每帧加上**同一个** `delta` ⇒ 正常运行时所有 hazard 的 `t0` 恒等，整张关卡共享**一个全局时钟 T**；`Motion` schema 没有 phase / offset 字段 | **CONFIRMED** | `scene.ts:61,161,271-276`；`game-config.ts:79-85` |
| 1.11 | 第一次**渲染**不是 `t=0`：`create()` 时精灵在 `start`，第一个 `update()` 先 `t0 += delta` 再渲染；帧 1 渲染的是 `P(delta1)` | **CONFIRMED（边界）** | `scene.ts:79-80,270-280`；`packages/demo/node_modules/phaser/src/core/Game.js:474-514`（`scene.update` 在 `scene.render` 之前） |
| 1.12 | `Motion` 在 schema 上与 `kind` 正交，但运行时只有 `case "hazard"` 消费它；带 `motion` 的 solid 不会动（`moving-platform` 被标为 `experimental`） | **CONFIRMED** | `game-config.ts:122`；`scene.ts:149-197`；`packages/contracts/src/vocabulary.ts:85-96`；E2 `packages/demo/tests/shell-mechanic-witness.test.ts:23-31,76-79` |

**示例（last-train，E3/fixture）**：`at=(800,250)`、asset `hazard-sweeping-carriage`（size 64×48、anchor {0.5,1}）、`distance=200`、`periodMs=4000`。
`t=0` 盒 = `{x:768,y:202,w:64,h:48}`；`t=1000`（phase 0.25）盒 x=868；`t=2000`（phase 0.5）盒 x=968；`t=4000` 回到 x=768。
（`fixtures/game-configs/last-train.json` 的 `carriage` 实体；`fixtures/packs/last-train/v2/manifest.json` 的 `hazard-sweeping-carriage`。）

---

## 2. Q2：`start` 的来源、`axis` 与锚点 `{0.5,1}`

| # | 事实 | 结论 | 证据（E1 `file:line`） |
|---|---|---|---|
| 2.1 | `start` 取 `e.draw.at` 的**轴分量**（`axis==="y" ? d.at.y : d.at.x`），**不是** `e.box` | **CONFIRMED** | `scene.ts:161`；`packages/demo/src/world.ts:176`；`packages/demo/src/draw.ts:143-163` |
| 2.2 | `Draw.at` 原样等于 config 的 `entity.at`（`resolveDraw` 只复制 `{x: at.x, y: at.y}`，不做盒子换算） | **CONFIRMED** | `draw.ts:144,162`；`world.ts:176` |
| 2.3 | `axis` 取 `motion.axis`（枚举 `x`/`y`）；无 motion 时运行时默认 `"x"` | **CONFIRMED** | `scene.ts:161`；`game-config.ts:81` |
| 2.4 | 运动只改一个轴；另一个轴保持 `d.at` 的初值（`setPosition(p, sprite.y)` / `setPosition(sprite.x, p)`） | **CONFIRMED** | `scene.ts:277-278` |
| 2.5 | 精灵创建在 `(d.at.x, d.at.y)`，origin = `d.anchor`（资源级 manifest anchor） ⇒ **精灵位置就是锚点落点**，不是中心、不是左上角 | **CONFIRMED** | `scene.ts:139`；`draw.ts:73,158,162` |
| 2.6 | `anchor={0.5,1}` 时 `at` 是**底边中心**：x 轴运动时底边中心沿轨迹走；y 轴运动时是**底边**（不是中心）沿轨迹走 | **CONFIRMED** | `scene.ts:139,277-279`；`phaser/src/physics/arcade/StaticBody.js:64-65,171`；`phaser/src/gameobjects/components/GetBounds.js:96-104` |
| 2.7 | 静态体左上角 = sprite 位置 − `anchor × frameSize`；因此 `{0.5,1}` 时 body 的底边中心 = 轨迹点 | **CONFIRMED** | `StaticBody.js:171,579-595`；`GetBounds.js:96-104` |
| 2.8 | `e.body` 不参与 hazard 的运动起点或命中体（LP-00 P2 已答） | **CONFIRMED（引用 LP-00 §3.1）** | `scene.ts:157-165`；`world.ts:178-182` |
| 2.9 | 纯层 `e.box = entityBox(at, body ?? manifest.size, manifest.anchor)` 并**四舍五入**；hazard 运行时**不使用**它 | **CONFIRMED（引用 LP-00 §2.3/§3.1）** | `world.ts:176-182`；`game-config.ts:151-158` |
| 2.10 | 运动终点 = `at + distance`；既有 audit 只检查这个**锚点终点**是否越过世界上限（warning），不检查盒子半宽/半高探出 | **CONFIRMED（边界）** | `game-config.ts:580-583`；`packages/demo/src/site.ts:139-141`（`pokeOut` 只 warning） |
| 2.11 | anchor 不必是 `{0.5,1}`：任意 anchor 使用同一公式；当前语料 19 个移动 hazard 中 17 个 `{0.5,1}`、1 个 `{0.5,0.95}`、1 个 `{0.5,0.85}` | **CONFIRMED** | `scene.ts:139,161`；`StaticBody.js:171`；E3 扫描 #7 |
| 2.12 | y 轴运动由源码支持（`axis:"y"`），但当前语料 **0 个** y 轴实例、也没有测试覆盖 | **CONFIRMED（边界：语料 / 测试未行使）** | `scene.ts:161,278`；`game-config.ts:81`；E3 扫描 #7 |

**要点**：`start` 是“锚点落点”，所以 `distance` 是**锚点**的位移，也等于盒子的位移；但起点不是盒子的左边/上边。对 `{0.5,1}`，x 轴运动等价于“底边中心从 `at` 走到 `at+distance` 再回来”。

---

## 3. Q3：时间推进（`h.t0 += delta`）

| # | 事实 | 结论 | 证据（E1 `file:line`） |
|---|---|---|---|
| 3.1 | `delta` 的单位是 **ms**；`h.t0` 的单位也是 ms；`hazardAnchor` 的 `elapsedMs` / `periodMs` 都是 ms | **CONFIRMED** | `scene.ts:79,272,276`；`hazard.ts:14`；`phaser/src/core/TimeStep.js:711-739` |
| 3.2 | 每帧 `h.t0 += delta`，**永不重置**，也没有 overflow/取模写回 | **CONFIRMED** | `scene.ts:272` |
| 3.3 | 传给 `scene.update` 的 `delta` 是 Phaser **平滑后**的值：默认 `target=60fps` / `minFps=5` / `smoothStep=true` / `deltaHistory=10`；`delta > 200ms` 时用 history 值；失焦 / cooldown 时 clamp 到 `1000/60≈16.67ms` | **CONFIRMED** | `TimeStep.js:99,113,174,186,379,435,563-585,711-739`；`packages/demo/src/shell/entry.ts:75-85`（未覆盖 `fps` 配置） |
| 3.4 | 默认配置（`smoothStep=true`）下，单次 `scene.update` 收到的 `delta` **≤ 200ms**（`_min`） | **CONFIRMED（边界：默认配置）** | `TimeStep.js:174,576-585` |
| 3.5 | 页面隐藏：`Game.onHidden` 只调 `loop.pause()` 记录时刻；`visible` 时 `loop.resume()` → `TimeStep.resume()` → `resetDelta()`。**没有按隐藏时长补帧** | **CONFIRMED（边界）** | `Game.js:590-594,629-634`；`TimeStep.js:468-486,494-517` |
| 3.6 | 隐藏期间 `t0` 不会按隐藏时长跳变；但它究竟是“严格冻结”还是“按被 clamp 的 delta 慢走”，取决于浏览器是否仍派发 RAF —— 这一点源码不能证明 | **边界条件 / UNCONFIRMED（跨浏览器调度）** | `TimeStep.js:563-585`；`scene.ts` 中无任何 visibility / pause 处理 |
| 3.7 | 玩家命中 `hitHazard()` **只 reset 玩家 body**（到 `world.player.at`，再按 `floorY` 校正脚线），**不碰 hazard 的 `t0` / sprite / body** | **CONFIRMED** | `scene.ts:355-362`；LP-00 §5.3 |
| 3.8 | 玩家复位后 hazard **继续按全局时钟运动**；没有 i-frames / cooldown。若出生点与 hazard 的 AABB 重叠，下一次物理步会再次触发 overlap（可反复复位） | **CONFIRMED（边界：多物理步/重复命中计数未测试）** | `scene.ts:163,271-280,355-362` |
| 3.9 | 站点运行时代码没有任何 hazard 重置 / 场景重启路径；唯一写 `t0` 的是 create 时的 `0` 与每帧 `+= delta`。外部 playtest probe 会注入 `h.t0=0`，但它不在站点 bundle 中 | **CONFIRMED** | `scene.ts:161,272`；`packages/demo/probe/playtest/runner.mjs:135-148`；`entry.ts:13-19,65-84` |
| 3.10 | 所有 hazard 共享同一 `delta` 序列且起点相同 ⇒ 正常运行时 `t0` 恒等；玩家复位不改变任何 hazard 相位 | **CONFIRMED** | `scene.ts:161,271-276` |

**时间语义总结**：`T = Σ smoothedDelta`，单位 ms；它是**游戏时钟**，不是墙钟。`T` 从站点场景 `create` 起算，页面隐藏会停/慢、卡帧会被平滑掉、玩家复位不影响它。

---

## 4. Q4：位置更新与碰撞检测的先后（一帧偏差）

### 4.1 帧内顺序（Phaser 3.90）

```text
Scene Systems.step(time, delta)                      Systems.js:356-366
  1) PRE_UPDATE
       UpdateList.update（处理待激活对象；无 hazard 逻辑）        UpdateList.js:125-130
  2) UPDATE
       UpdateList.sceneUpdate → sprite.preUpdate → anims.update  UpdateList.js:145-158
       ArcadePhysics World.update:
         body.preUpdate（重力 / 速度积分）
         colliders.update() → collideObjects → overlap 回调（hazard 命中）
                                                          World.js:936-1008; ArcadePhysics.js:142
  3) scene.update(time, delta)                        scene.ts:79-96
       advanceHazards(delta)        ← hazard 本帧移动在这里发生        scene.ts:80,270-281
       advanceDangers(delta)                                       scene.ts:81,287-309
       advanceChests()                                             scene.ts:82,315-325
       读输入 → setVelocityX/Y（下一次物理步生效）                  scene.ts:84-91
  4) POST_UPDATE
       World.postUpdate（动态 body → GameObject 同步）              ArcadePhysics.js:145; World.js:1083-1104
  5) render                                                       Game.js:498-514
```

### 4.2 事实表

| # | 事实 | 结论 | 证据（E1 `file:line`） |
|---|---|---|---|
| 4.1 | 帧内物理步与碰撞回调发生在 `scene.update` **之前**；`advanceHazards` 是 `scene.update` 的第一行 | **CONFIRMED** | `phaser/src/scene/Systems.js:356-366`；`ArcadePhysics.js:142,145`；`scene.ts:79-82` |
| 4.2 | 重力在 Arcade 物理步内积分，**早于** `advanceHazards` | **CONFIRMED** | `scene.ts:220`；`phaser/src/physics/arcade/Body.js:1122-1151`；`World.js:936-1000` |
| 4.3 | 当前帧读取的输入在 `advanceHazards` **之后**才 `setVelocity`，因此作用于**下一次**物理步 | **CONFIRMED** | `scene.ts:80,85-91`；`Systems.js:356-366` |
| 4.4 | hazard 的 overlap 回调在 `World.update` 内触发，因此**早于本帧** `advanceHazards` | **CONFIRMED** | `ArcadePhysics.js:142`；`World.js:936-1008`；`scene.ts:163,270-280` |
| 4.5 | ⇒ 帧 N 的碰撞检测使用 hazard 在帧 N−1 **结束时**的位姿 `P(T_{N-1})`；帧 N 渲染出的 `P(T_N)` 要到帧 N+1 的物理步才会被检测 | **CONFIRMED** | 4.1 顺序 + `scene.ts:272-279` + `Game.js:498-514` |
| 4.6 | 这就是「先判碰撞后移动」的**一帧偏差**：hazard 的碰撞位姿落后渲染一帧；玩家的动态 body 在帧 N 的物理步后同步，渲染与碰撞同帧 | **CONFIRMED（边界：滞后量 = 一帧 delta，随帧率/平滑变化）** | 4.1 / 4.5；`TimeStep.js:563-585` |
| 4.7 | hazard 是 `StaticBody`（`immovable=true`），用 `physics.add.overlap` 而非 `collider` ⇒ 它**不推动、不阻挡**玩家，只触发复位 | **CONFIRMED** | `scene.ts:158,163`；`StaticBody.js:316`；`World.js:2035-2051` |
| 4.8 | `overlapOnly` 路径**不做** `maxOverlap` / `OVERLAP_BIAS` 拒绝：只要 `intersects` 为真，结果就为真（含双方静止的 `embedded` 情况） | **CONFIRMED** | `World.js:1379-1400,1459`；`GetOverlapX.js:26,39`；`GetOverlapY.js:26,39`；`SeparateX.js:36-39`；`SeparateY.js:36-39` |
| 4.9 | `intersects` 是**严格 AABB**：边贴边（`right==left` 等）不算命中 | **CONFIRMED** | `World.js:1698-1713` |
| 4.10 | **没有 swept collision**；若 hazard 在相邻两次采样之间的位移跨过玩家 AABB，则不会命中 | **CONFIRMED（边界）** | `World.js:936-1008`（只在采样点做 AABB）；无 swept 逻辑 |
| 4.11 | Arcade 是固定步长 60Hz，可在一帧内跑 0/1/多步；hazard 每帧只移动一次 ⇒ 同一帧的多个物理步共用**同一个** hazard 位姿 | **CONFIRMED（边界）** | `World.js:954-1008`；`scene.ts:270-280` |
| 4.12 | 在默认 200ms 上限下，单次 hazard 位移上界 = `speed × 200ms`；当前语料最大 `0.13846 px/ms × 200ms ≈ 27.7px`（60fps 时最大 `2.31px`） | **CONFIRMED（E3 数值 + 边界）** | `TimeStep.js:576-585`；E3 扫描 #7 |

**回答“是否存在先判碰撞后移动的一帧偏差”**：**是**，且方向明确 —— hazard 的**碰撞位姿比渲染位姿晚一帧**（帧 N 检测的是帧 N−1 的 hazard 位置）。这不是“玩家与 hazard 都滞后”；玩家的动态 body 在帧 N 的物理步内更新，渲染与碰撞一致；只有 hazard 因为“物理步在前、移动在后”而滞后一格。

---

## 5. Q5：碰撞体（图集帧 vs `entity.body`；`updateFromGameObject()`）

| # | 事实 | 结论 | 证据（E1 `file:line`） |
|---|---|---|---|
| 5.1 | hazard 命中体 = `physics.add.existing(sprite, true)` 创建的 `StaticBody`；宽高 = `displayWidth/displayHeight`（= 帧 `sourceSize` × scale；scale 恒为 1），**不是** `entity.body` | **CONFIRMED（LP-00 P1/P2 已答）** | `scene.ts:158`；`StaticBody.js:56-65,171`；LP-00 §2.3/§3.1 |
| 5.2 | body 初始位置 = `sprite.x − width*originX` / `sprite.y − height*originY` | **CONFIRMED** | `StaticBody.js:171`；`GetBounds.js:96-104` |
| 5.3 | 每帧 `updateFromGameObject()`：从 `staticTree` 移除 → `getTopLeft(position)` → `width/height = displayWidth/Height` → 更新 center → 重新插入 `staticTree` | **CONFIRMED** | `scene.ts:279`；`StaticBody.js:579-596` |
| 5.4 | 命中体几何 = `{P(t) − anchor∘size, size}`（float），`P(t)` 是轴上的**锚点**位置；accepted pack 下 `size/anchor` = manifest 的标称值 | **CONFIRMED（边界：依赖 acceptance 不变量）** | `StaticBody.js:64-65,171,579-595`；`draw.ts:158,162`；`scene.ts:161,277-279` |
| 5.5 | 运行时**不做** `entityBox` 的四舍五入；模型若用 `entityBox` 采样会有 **≤0.5px** 差异 | **CONFIRMED（边界）** | `hazard.ts:18`；`scene.ts:277`；`game-config.ts:151-158`；`GetBounds.js:100-101` |
| 5.6 | 动画换帧时 origin 可能随帧 `customPivot` 变化；acceptance 强制“帧 anchor == manifest anchor、帧 sourceSize == 资源 size”；若被破坏，body 几何变化**无上界** | **CONFIRMED（LP-00 P1 边界）** | LP-00 §2.3/§2.4；`packages/assets/src/acceptance.ts:306-310,341-345`；`scene.ts:142-147` |
| 5.7 | 当前语料几何可复核：21 份唯一横向 config / 31 个 hazard / 19 个移动（全 `x`）/ 0 个 `body` / 19 个移动 hazard 资源 / 121 帧 → `badSize=0`、`badAnchor=0`；31 个 hazard 的 manifest size+anchor 全部可解析 | **CONFIRMED（E3）** | E3 扫描 #5/#6；LP-00 §8.4（35 份 v4 manifest / 1068 帧，0/0） |
| 5.8 | 本 effort 的 P0 scratch 站点尚不存在（`cases/`、`prototype/` 只有 `.gitkeep`），因此没有 P0 scratch 站点输入可复核；当前证据是冻结语料 + fixtures | **边界条件（范围事实）** | `.scratch/level-playability-v1.1-p0/cases/.gitkeep`、`prototype/.gitkeep` |
| 5.9 | `entity.body` 对所有 kind 都会进入纯层 `e.box`，但 hazard 运行时不消费；若声明了 body，纯层盒与运行时命中体不同 | **CONFIRMED（LP-00 P2 / C4）** | `world.ts:178-182,185`；`scene.ts:157-165`；LP-00 §3.1/§7 C4 |

**当前语料明细（E3）**：
- 31 个 hazard，19 个带 `motion`，**0 个带 `body`**，18 个带 `anim`。
- 19 个移动 hazard：`axis` 全为 `x`，`kind` 全为 `"cycle"`，`distance ∈ [40,200]`，`periodMs ∈ [2500,4000]`。
- 锚点分布：全部 hazard 中 `{0.5,1}` 27 个、`{0.5,0.5}` 1 个、`{0.5,0.9}` 1 个、`{0.5,0.95}` 1 个、`{0.5,0.85}` 1 个；其中移动 hazard 为 `{0.5,1}` 17 个、`{0.5,0.95}` 1 个、`{0.5,0.85}` 1 个。
- 速度 `2*distance/periodMs ∈ [0.02667, 0.13846] px/ms`（60fps 下 `0.44–2.31 px/frame`）。
- `hazard` 带 `strike` 0 个；`danger` 带 `motion` 0 个。

**结论**：对**当前语料**，hazard 的运动轨迹与命中体几何完全可由 `(GameConfig, AssetPackManifest)` 重建（再用 121 帧图集扫描确认标称几何）；对**任意输入**，帧几何 == manifest 的等式只是 acceptance 不变量，不在 schema 里，审计输入看不到图集 JSON（LP-00 P1 已答）。

---

## 6. Q6：与 `danger.periodMs` 的语义区别（不得混用）

| # | 事实 | 结论 | 证据（E1 `file:line`） |
|---|---|---|---|
| 6.1 | `danger.periodMs` = **idle / 安全窗口长度**；完整周期 = `periodMs + activeMs`；`active` 落在周期**最后** `activeMs`；`t=0` 从 `idle` 开始 | **CONFIRMED** | `packages/demo/src/hazard.ts:21-33`；`game-config.ts:90-99`；E2 `hazard.test.ts:38-53` |
| 6.2 | `hazard.periodMs` = **往返运动整周期**；不是安全窗口，hazard 也没有 `idle/active` 状态 | **CONFIRMED** | `hazard.ts:11-19`；`scene.ts:157-165` |
| 6.3 | hazard 在它的 AABB 内**永远致命**；danger 只在 `active` 窗口致命 | **CONFIRMED** | `scene.ts:163`（hazard overlap 无条件复位） vs `scene.ts:302-308`（仅 `d.state==="active"` 才判命中） |
| 6.4 | danger 命中盒 = 纯层 `e.box`（`body ?? size` + 资源 anchor），手动 AABB；hazard 命中盒 = 图集帧 `StaticBody` | **CONFIRMED（LP-00 已答 danger 部分）** | `scene.ts:186-195,300-307`；LP-00 §2.3/§3.1 |
| 6.5 | `strike` 挂在 hazard 上、`motion` 挂在 danger 上，schema 都允许，但运行时**静默忽略**（hazard 分支不读 `strike`；danger 分支不读 `motion`） | **CONFIRMED（边界）** | `scene.ts:157-165,186-195`；`game-config.ts:121-126` |
| 6.6 | danger 缺 `strike` 会被 schema `superRefine` 拒绝；hazard 缺 `motion` 合法（=静态） | **CONFIRMED** | `game-config.ts:249-253`；`scene.ts:161` |
| 6.7 | 两者都调用 `hitHazard()` 复位玩家；复位不影响任一计时器 | **CONFIRMED** | `scene.ts:163,306,355-362` |

**一句话**：同名字段 `periodMs` 在两个 kind 上**含义不同** —— hazard 的是“开始→远端→回到开始”的**整周期**，danger 的是“两次喷发之间的**安全窗口**”；danger 的完整周期还要再加 `activeMs`。

---

## 7. 对算法建模的含义

### 7.1 可直接作为精确模型的事实（当前语料 / accepted pack）

| 事实 | 用法 |
|---|---|
| 轨迹 `P(T) = at + tri(((T mod periodMs)+periodMs) mod periodMs) * distance`，沿 `axis`；另一轴 = `at` | 直接实现三角波；`t=0` 在 `at`、`t=period/2` 在 `at+distance`、`t=period` 回到 `at` |
| `periodMs` = 往返整周期，单程 = `periodMs/2`；无端点停留；速度大小 `2*distance/periodMs` | 计算“穿过某个 x 区间需要多久”“在某个位置等多久” |
| `start = entity.at` 的轴分量；`axis` 来自 `motion.axis`；`{0.5,1}` 时 `at` 是底边中心 | 轨迹端点 = `at` / `at+distance`；不是 `e.box.x` / `e.box.x + w` |
| 所有 hazard 共享一个全局时钟 `T`（`t0` 恒等；无 phase 字段） | 状态空间是 **1 维全局时间 T**，不是 N 个独立 hazard 相位；不同 `periodMs` 只影响折叠后的相位 |
| 命中体 = 帧几何 = accepted pack 下的 manifest `size` + `anchor`；忽略 `e.body`；float 坐标 | `H(T) = {x: P(T)−anchor.x*w, y: P(T)−anchor.y*h, w, h}`（x 轴；y 轴把 `P` 放到 y） |
| 接触 = overlap-only、严格 AABB、不推不挡；命中 → 立即复位到出生点（`floorY` 校正），无 i-frames，hazard 继续 | 把 hazard 当“移动的复位区”，不是 solid，也不是“死亡”；复位后不改变 T |
| hazard 在其 AABB 内任何时刻都致命（无 idle/active） | 不需要为 hazard 建“安全窗口”；只有 danger 需要 |

### 7.2 可直接作为**上界**（过近似危险；用来证明“安全”）

1. **扫掠带**：hazard 只可能在 `[at, at+distance]`（沿 axis）× 完整横截面的并集里。把整条带当成常驻禁区，是对所有相位、所有帧的**过近似**。若玩家 AABB 在所有时刻都离开这条带，则运行时不会命中（在 accepted pack 与玩家自身几何精确的前提下）。
2. **全相位**：玩家到达时刻的 `T` 不是关卡静态输入能确定的；证明“安全”时应对 `T` 取所有相位（或等价地取扫掠带），而不是假设某个 `T`。
3. **一帧滞后的包络**：碰撞位姿 `P(T−δ)` 仍在轨迹上，因此扫掠带已经覆盖它；若用离散时间模型，则在相邻采样位姿之间取**整段**（而不是只取端点），即可覆盖“先判碰撞后移动”的一帧滞后。
4. **危险期**：hazard 没有 idle 窗口，所以“危险 = 在 AABB 内”是精确的，不需要再放大时间窗口。
5. **接触后果**：把 overlap 视为“复位到出生点”是精确的；不要额外加“阻挡/推开”语义（Runtime 没有）。

### 7.3 只能作为**下界 / 欠近似**（用于存在性搜索，不能用来证明安全）

1. **轨迹线段本身**是 hazard 必然经过的集合（连续观察）；但它不等于“运行时一定会命中某个点”——碰撞是采样式 AABB，不是连续扫掠。
2. **固定 60fps 网格采样**（`P(k*16.67ms)`）只是模型假设。Runtime 的 `delta` 是平滑的、可被 200ms 上限截断、且 Arcade 一帧可跑多步；因此固定网格采样可能高估或低估命中，只能作为候选搜索，不能作为“安全/不安全”的证明。
3. **连续轨迹与玩家 AABB 的瞬时相交**只能证明“几何上会相遇”，不能证明“运行时一定命中”；要证明命中，需要玩家 AABB 在至少一个完整采样间隔内始终与 `H(t)` 相交（更强的条件）。
4. **全局时钟共享**是一个精确的结构事实，可用作建模下界：不同 hazard 的相对相位不是独立的；若已知 `T`，所有 hazard 的相位都可精确导出。

### 7.4 **不可用**（会静默出错）

| 不可用假设 | 为什么 |
|---|---|
| 用 `danger.periodMs` 的“安全窗口”语义解释 `hazard.periodMs` | hazard 的是往返整周期；danger 的是 idle 窗口，完整周期还得加 `activeMs` |
| 用 `entity.body` 作为 hazard 命中体 | hazard 运行时忽略 `e.body`；命中体来自图集帧 |
| 用 `e.box` 的四舍五入坐标当作运行时命中体 | 运行时 body 位置是 float；`e.box` 只用于纯层 / 装配告警 |
| 用墙钟时间（`Date.now` / 真实秒数）推 hazard 相位 | `T` 是 game-time：隐藏页会停/慢、卡帧被平滑、失焦被 clamp；`T` 与墙钟不保证一致 |
| 假设玩家复位/死亡时 hazard 暂停或重置 | `hitHazard()` 只 reset 玩家 body；hazard 的 `t0` 不变 |
| 假设 hazard 会推动/阻挡玩家，或有 i-frames / cooldown | 用的是 `overlap` + `StaticBody`；命中只触发复位，没有物理分离，也没有冷却 |
| 假设 hazard 轨迹会被 terrain / solid / 世界边界截断 | 没有任何 hazard-vs-solid collider；轨迹是纯解析三角波 |
| 假设每个 hazard 有独立 phase offset | `Motion` schema 没有 phase 字段；所有 hazard 在同一帧创建，`t0` 恒等 |
| 用“某一瞬间几何相交”断言“这一帧必然命中/必然不命中” | 碰撞只在 Arcade 物理步的离散采样点发生；没有 swept collision |

### 7.5 给 P0-02 的最小假设集合

| # | 假设 | 状态 |
|---|---|---|
| A1 | Hazard 轨迹 = `at` 起、沿 axis 的三角波；`periodMs` 是往返整周期；`t=0` 在 `at`；所有 hazard 共享全局 `T` | CONFIRMED（E1） |
| A2 | `T` 是 game-time（场景 create 起累加的平滑 delta，ms），不是墙钟；隐藏/卡帧会削弱实时性 | CONFIRMED（E1，跨浏览器细节为边界） |
| A3 | 命中体 = manifest `size` + `anchor` 的 AABB；忽略 `body`；坐标 float；每帧跟随 `P(T)` | CONFIRMED（当前语料 + accepted pack） |
| A4 | 碰撞在物理步采样，hazard 位姿比渲染晚一帧；严格 AABB；无 swept collision | CONFIRMED（E1） |
| A5 | 接触 = 复位到出生点（`floorY`），无 i-frames；hazard 继续；无阻挡/推开 | CONFIRMED（E1） |
| A6 | hazard 无 idle/active，AABB 内恒致命；`periodMs` 不是安全窗口 | CONFIRMED（E1） |
| A7 | 轨迹不受 terrain/solid/世界边界约束；可探出世界 | CONFIRMED（E1） |
| A8 | `danger.periodMs` = idle 窗口；完整周期 = `periodMs+activeMs`；active 在最后 | CONFIRMED（E1） |
| A9 | 任意 pack 的帧几何 == manifest 标称值 | 边界：当前语料 E3 通过；非当前语料不可由审计输入复核 |
| A10 | y 轴运动语义与 x 轴同构 | CONFIRMED（源码）；语料/测试未行使 |

---

## 8. 未确认事项（每条都给出对 P0-02 的降级要求）

| # | 未确认事项 | 为什么无法从本仓库源码确认 | 若无法确认，对应判据只能 |
|---|---|---|---|
| U1 | 页面隐藏期间 `t0` 是严格冻结，还是按被 clamp 的 delta 慢走（取决于浏览器是否仍派发 RAF、`visibilitychange` / `blur` 的顺序） | Phaser 源码只证明“`onHidden` 记录 pause、`onVisible` resetDelta、delta 被平滑/clamp”；浏览器调度不在仓库内 | 任何依赖**墙钟时间**的 hazard 相位/安全窗口判据 → `INSUFFICIENT_EVIDENCE`；只能用 game-time `T` |
| U2 | 单帧碰撞采样的精确时刻 / 一帧滞后的具体毫秒数（取决于 smoothed delta、渲染帧率、Arcade 累加器） | 源码证明**顺序**与**上界**（≤200ms/帧），不证明某台机器某帧的精确 delta | 任何“在精确时刻 t 命中/不命中”的判据 → `INSUFFICIENT_EVIDENCE`；只能给扫掠带 / 采样包络的保守边界 |
| U3 | 任意资源包的“帧 sourceSize/anchor == manifest size/anchor” | schema 不强制；acceptance 只在构建工具里；审计输入看不到 atlas JSON（LP-00 P1） | 对非当前语料的严格 hazard 命中体 → `INSUFFICIENT_EVIDENCE` / `coverage.partial`；当前语料 E3 通过 |
| U4 | y 轴运动没有语料实例，也没有单元/探针测试 | 源码支持，但 E2/E3 均未行使 | 若 P0-02 的判据专门依赖垂直 mover 的**实测**行为 → 证据缺口；只能声称源码级 CONFIRMED，不能声称有回归保护 |
| U5 | 同一帧多个 Arcade 物理步下，hazard overlap 回调次数、重复复位的精确计数 | `World.update` 可在一帧跑多步；没有测试钉住 hits 计数 | 任何依赖 `hits` 计数 / “单帧命中几次”的判据 → `INSUFFICIENT_EVIDENCE`；接触**存在性**不受影响 |
| U6 | 动画帧切换对命中体几何的影响在非 accepted pack 下的上界 | accepted pack 下帧几何恒定；非 accepted 时无上界（同 U3） | 非 accepted pack 的动画 hazard 命中体 → `INSUFFICIENT_EVIDENCE` |
| U7 | P0 scratch 站点的输入几何 | 本 effort 的 `cases/` / `prototype/` 仍是 `.gitkeep`；尚无 P0 scratch 站点 | 对“P0 scratch 站点输入”的几何复核 → `INSUFFICIENT_EVIDENCE`（当前只能用冻结语料 + fixtures） |
| U8 | 首次渲染的相位（`P(delta1)`）在真实浏览器中的具体值 | 源码证明“第一次渲染前先 `t0 += delta`”，但 `delta1` 未被测量 | 任何假设“玩家第一次看到 hazard 时它恰好在 `t=0`”的判据 → `INSUFFICIENT_EVIDENCE`；应把到达时刻/相位当自由变量 |

### 8.1 对 P0-02 的影响摘要

1. **必须用 game-time `T`，不能用墙钟**：`t0` 是场景 `create` 起的平滑 delta 累加；隐藏页/卡帧/失焦都会让它偏离真实时间。
2. **安全证明用扫掠带 / 全相位**：Runtime 的碰撞是离散采样且 hazard 位姿落后一帧；只检查某个精确时刻的瞬时相交不能证明安全。
3. **不要给每个 hazard 独立相位**：所有 hazard 共享同一个 `T`，这是 P0-02 可以做的重要降维。
4. **当前语料的几何可以直接建模**（E3 121 帧 0 漂移）；对任意新包必须把 acceptance 不变量当假设，严格判据要 `partial`。
5. **y 轴 mover 只能按源码建模**：没有语料/测试回归，P0-02 若要出 y 轴案例需自己标注证据缺口。
6. **危险语义不要混**：hazard 的 `periodMs` 是运动整周期；danger 的 `periodMs` 是 idle 窗口。

---

## 9. 关键证据索引

| 语义 | 证据 |
|---|---|
| 三角波 / 周期 | `packages/demo/src/hazard.ts:11-19`；`packages/demo/tests/hazard.test.ts:11-31` |
| `start` / `axis` / 锚点 | `packages/demo/src/shell/scene.ts:139,161,277-279`；`packages/demo/src/draw.ts:143-163`；`packages/demo/src/world.ts:176` |
| `t0` 累加 / 全局时钟 | `scene.ts:161,271-276` |
| 帧内顺序 | `phaser/src/scene/Systems.js:356-366`；`ArcadePhysics.js:142,145`；`UpdateList.js:125-130,145-158`；`World.js:936-1008,1083-1104` |
| delta 单位 / 平滑 / 上限 | `phaser/src/core/TimeStep.js:99,113,174,186,379,435,563-585,711-739`；`Game.js:474-514` |
| 隐藏 / 失焦 | `Game.js:590-594,629-634,665-684`；`TimeStep.js:468-486,494-517` |
| 命中体 / 静态体跟随 | `scene.ts:158,279`；`StaticBody.js:56-65,171,316,579-596`；`GetBounds.js:96-104` |
| overlap 语义 | `World.js:1379-1400,1459,1698-1713,2035-2051`；`GetOverlapX.js:26,39`；`GetOverlapY.js:26,39`；`SeparateX.js:36-39`；`SeparateY.js:36-39` |
| 玩家复位 | `scene.ts:355-362`；LP-00 §5.3 |
| danger 周期 | `hazard.ts:21-33`；`game-config.ts:90-99`；`hazard.test.ts:38-53` |
| schema | `packages/contracts/src/game-config.ts:79-85,117-126,151-158,249-253,580-583` |
| E3 语料 | 本报告 §0.2 命令 5/6/7；LP-00 §8.4 |

---

## Answer

- **报告路径**：`.scratch/level-playability-v1.1-p0/evidence/01-moving-hazard-semantics.md`
- **命令与退出码**：见 §0.2（全部 `EXIT=0`；vitest 2 files / 10 tests passed；E3 三个只读扫描均 0 退出）。
- **HEAD SHA**：`ed0c4341308ef635932c57e2d228ad3315cb8948`
- **未修改**：`packages/**`、`fixtures/**`、测试、历史 run/pack/site、`.scratch/level-playability-v1.1-p0/issues/**`、`map.md`。
- **落盘后 `git status --short`**（实际）：
  ```text
   M .scratch/level-playability-v1.1-p0/issues/02-p0-01-moving-hazard-semantics.md   # 主会话的 claimed 修改，非本 agent
  ?? .scratch/level-playability-v1.1-p0/evidence/01-moving-hazard-semantics.md       # 本报告
  ```
