# LP-00 Runtime 语义核验（P1–P4 源码证据）

- **Date**：2026-11-05
- **Baseline**：`wayfinder/level-playability-v1` @ `8b8e45a15ace345c5ffb5de19e0ad54171b4dd58`；
  生产代码基线 `main` @ `fa17c14`（`git diff --stat fa17c14 HEAD -- packages fixtures` 为空；
  相对基线只有 `CONTEXT.md` 的 24 行文档增补）。
- **Nature**：只读研究。未修改 `packages/**`、测试、fixture、历史语料；未 commit / 推送；
  零模型调用、零生图、零站点重建。只额外写了本文件与本票 `## Answer`。
- **Input**：本票、`map.md`、`framework.md`、`research/02-capability-gap-audit.md` §3、
  `plan.md` §2.7、`research/03-spatial-layout-judgments.md` §1.3 / §3.4 / §3.11。
- **证据级别**：E1 = `file:line`；E2 = 既有测试名 + 断言 + 退出码；E3 = 零付费只读复跑 / 语料扫描。
- **运行时依赖**：`phaser@3.90.0`（`packages/demo/node_modules/phaser/package.json`）。
  该库源码随仓库安装、被 `packages/demo/src/shell/scene.ts:7` import，属于本票可核验的“被 import 的代码”。

---

## 0. 结论速览

| # | 语义 | Verdict | 一句话结论 |
|---|---|---|---|
| P1 | 资源尺寸 / 锚点 / 碰撞几何 | **CONFIRMED（带边界）** | 纯层盒 = `entityBox(at, body ?? manifest.size, manifest.anchor)`；solid / chest / danger / player 的碰撞几何由它决定。pickup / hazard / goal 的**物理体**由 Phaser 按图集帧 `sourceSize` + 帧锚点创建；只有在“帧尺寸 / 帧锚点 == manifest 标称值”时才与纯层盒一致。该等式由 pack acceptance 强制、当前语料 0 漂移，但**不在 manifest schema 里**，且 LP 审计输入看不到图集 JSON。 |
| P2 | EntityKind 与 `body` | **CONFIRMED** | `solid` / `chest` / `danger` 吃 `e.body`；`pickup` / `hazard` / `goal` 忽略 `e.body`（物理体来自 sprite 帧）；`decor` 无碰撞。判断分支在 `scene.ts:150,151-174,175-195`，取盒在 `world.ts:178-182`。 |
| P3 | Chest 交互范围 | **CONFIRMED** | 交互盒 = `entityBox(at, body ?? size, anchor)` 四边各外扩 `range`（缺省 0），与玩家 Phaser body 的 AABB 每帧做严格相交；不要求落地。`scene.ts:315-325`。 |
| P4 | 出生点与静态几何 | **CONTRADICTED（作为 profile 假设）** | Runtime **没有**出生点专用处理。Arcade 只分离“重叠量 ≤ 本帧位移 + `OVERLAP_BIAS=4`”的那一轴；更深的垂直重叠、以及静止时的水平重叠被判 `embedded` / `overlap = 0`，**不分离**。描述性语义（“无显式 spawn 处理、分离量有界”）可确认；`plan.md` 的 `"unstick-from-static-geometry"` 不是普遍语义。 |

> P4 的“CONTRADICTED”针对 `plan.md` §2.7 / `research/03` §1.3 的既有假设，不是“源码读不出来”。
> 源码足以描述实际行为；但“出生点重叠 ⇒ 玩家会被推出 ⇒ 可继续判可玩性”这个推理链不成立。

---

## 1. 基线与方法

### 1.1 基线核验

```bash
git rev-parse HEAD
# 8b8e45a15ace345c5ffb5de19e0ad54171b4dd58
git rev-parse --abbrev-ref HEAD
# wayfinder/level-playability-v1
git diff --stat fa17c14 HEAD -- packages fixtures CONTEXT.md package.json pnpm-lock.yaml
#  CONTEXT.md | 24 ++++++++++++++++++++++++
# 1 file changed, 24 insertions(+)
```

⇒ `packages/**` 与 `fixtures/**` 相对生产基线 `fa17c14` 无变化；本报告的 `file:line` 可直接按当前树读。

### 1.2 方法

1. 从 `packages/demo/src`（纯层 `world.ts` / `draw.ts`、渲染物理层 `shell/scene.ts`、`hazard.ts`）
   追每个 EntityKind 的实际消费分支。
2. 从 `packages/contracts/src` 追 `GameConfig` / `AssetPackManifest` 的字段与取盒公式。
3. 从 `packages/demo/node_modules/phaser/src/physics/arcade` 读 Phaser 3.90 的静态体 / 动态体 /
   分离 / 重叠偏差源码，用来判定 P4 的“分离语义”边界。
4. 用既有 vitest 套件钉纯层行为；用只读 Node 脚本扫冻结语料的逐帧尺寸 / 锚点与 `body` 使用。
5. 不推测：源码没有的分支一律写“无”，并标出缺什么证据。

---

## 2. P1：资源尺寸、锚点与碰撞几何

### 2.1 数据来源

| 输入 | 定义 | 证据 |
|---|---|---|
| `AssetPackEntry.size` | **标称尺寸**。注释明写“各帧真实尺寸在 `delivery/atlas.*.json` 里，这里只是这个资源的标称尺寸”。 | `packages/contracts/src/assetpack.ts:171-174` |
| `AssetPackEntry.anchor` | 资源级归一化锚点，`x` / `y ∈ [0,1]`。 | `packages/contracts/src/assetpack.ts:73,175` |
| `Entity.body` | 可选 `Size`（正整数），注释：“`body` 省略时就是资源的 `size`，给了就覆盖”。 | `packages/contracts/src/game-config.ts:107,121` |
| `Entity.at` | 锚点落点，不是左上角。 | `packages/contracts/src/game-config.ts:107,530-531` |

### 2.2 纯层取盒路径（唯一公式）

`packages/demo/src/world.ts:176-187`：

```ts
const draw = resolveDraw(pack, e.at, { asset: e.asset, ...(e.anim ? { anim: e.anim } : {}) },
  issues, `entity "${e.id}"`, e.asset, e.body);
const size = e.body ?? assetSize(pack, e.asset) ?? FALLBACK_SIZE;
const anchor = anchorOf(pack, e.asset);
...
  id: e.id, kind: e.kind, box: boxAt(e.at, size, anchor), draw,
...
  ...(e.kind === "chest" ? { range: e.range ?? 0 } : {}),
```

- `anchorOf` 取的是 **manifest 资源级 anchor**，不是图集 JSON 的逐帧 anchor；
  `draw.ts:118-126` 的注释把这条分界写死：“碰撞/占位盒要的是稳定，逐帧锚点归 Phaser 自己逐帧 `setOrigin`”。
- `boxAt` 就是契约的 `entityBox`（`draw.ts:133`）。
- 玩家盒：`world.ts:192-193` 取 manifest 的 player `size` / `anchor`，
  `world.ts:207-211` 生成 `playerBox` 与 `floorY`；玩家**没有** `body` 覆盖。

`packages/contracts/src/game-config.ts:151-158`：

```ts
export const entityBox = (at, size, anchor) => ({
  x: Math.round(at.x - anchor.x * size.w),
  y: Math.round(at.y - anchor.y * size.h),
  w: size.w, h: size.h,
});
```

⇒ 盒的左上角取整（最多 ±0.5px），宽高不取整。`at` 是“锚点落在哪”。

### 2.3 运行时按 kind 的取几何路径

| EntityKind | 运行时使用的几何 | 代码 |
|---|---|---|
| `solid` | `e.box`（= `body ?? manifest.size` + manifest.anchor） | `scene.ts:150` `this.addSolid(e.box)`；`scene.ts:129-133` 用盒中心 + 宽高建静态矩形，StaticBody 与 `e.box` 重合 |
| `chest` | `e.box`；无 physics body，`advanceChests` 手动 AABB | `scene.ts:180,315-325` |
| `danger` | `e.box`；无 physics body，`advanceDangers` 手动 AABB | `scene.ts:189,300-307` |
| `player` | body 尺寸 = `world.player.box.w/h`；body 位置 = `at - displayOrigin`（displayOrigin = origin × 当前帧真实尺寸） | `scene.ts:217-219`；`Body.js:1060-1061` |
| `pickup` / `hazard` / `goal` | Phaser `StaticBody`，宽高 = sprite 帧真实尺寸（图集 `sourceSize`），位置 = sprite 位置 − 帧尺寸 × origin | `scene.ts:151-174`；`StaticBody.js:56-62,171` |

关键 Phaser 事实：

- `Frame.realWidth/realHeight` = 图集 JSON 的 `sourceSize`：`Frame.js:857-879`。
- `displayWidth/displayHeight` = `scaleX × frame.realWidth`：`Size.js:64-79`。
- `StaticBody` 构造时 `width = gameObject.displayWidth`，`position = x − width × originX`：
  `StaticBody.js:56-62,171`。
- 图集帧的 `anchor` 被 JSONHash 解析器写成 `customPivot`：`JSONHash.js:80-86`；
  动画换帧时 `setCurrentFrame` 会把 sprite origin 改成该帧 pivot：`AnimationState.js:1577-1604`。
- `hazard` 每帧 `updateFromGameObject()`，静态体跟随当前帧的 `displayWidth/Height` 与
  `getTopLeft`：`scene.ts:270-281`、`StaticBody.js:579-600`。
- `pickup` / `goal` 创建静态体后**不再**调用 `updateFromGameObject()`；即使动画换帧改变视觉 origin，
  静态体保持创建时的帧几何。

### 2.4 逐帧 atlas vs 标称尺寸：误差边界

1. **契约层不校验**：`AssetPackEntry.size` 只要求正整数（`assetpack.ts:174`）；
   `AtlasFrame.sourceSize` 也只要求正整数（`contracts/src/atlas-json.ts:34-40`）。
   两者之间没有 schema 级对账。
2. **验收工具校验**：`packages/assets/src/acceptance.ts:306-310` 对每帧报
   `atlas.frame.source-size-mismatch`（`sourceSize` ≠ 资源 `size`）；
   `acceptance.ts:341-345` 报 `atlas.frame.anchor-mismatch`（帧 `anchor` ≠ manifest `anchor`）。
   既有测试：`packages/assets/tests/acceptance.test.ts:324-338`
   “锚点 / 尺寸不一致 ⇒ 两条各定位到帧”，断言两条 finding 都是 `severity: "error"`。
3. **冻结语料实测**：35 份唯一 `assetpack/v4` manifest、343 个资源、1068 个帧，
   `sourceSize` 与 manifest `size` 不一致 **0**，帧 `anchor` 与 manifest `anchor` 不一致 **0**
   （E3，脚本见 §8）。
4. **如果等式被破坏**（绕过 acceptance 的包 / 手改 manifest）：
   - `pickup` / `hazard` / `goal`：物理体宽高直接差 `Δ = frame.sourceSize − manifest.size`；
     body 位置也按帧尺寸重算。误差**无上界**（schema 只要求正整数）。
   - `player`：body **宽高**仍是标称值（`setSize`），但 body 左上角 =
     `at − anchor × frameSize`，会按 `anchor × Δ` 平移；`entityBox` 的取整盒不再对齐真实 body。
   - `solid` / `chest` / `danger`：碰撞仍用 `e.box`，图集帧尺寸只影响画面，不影响碰撞。
   - 外壳**不会**报 issue：`resolveDraw` 只在资源解析失败时报警；帧尺寸漂移没有检查点。
5. **对 LP 审计的含义**：审计输入只有 `(GameConfig, AssetPackManifest)`，看不到图集 JSON，
   也无法从 manifest 证明该包过了 acceptance。因此 P1 可以作为 profile 假设写入
   （“accepted pack 的标称尺寸 / 资源锚点 = 逐帧几何”），但凡是**依赖逐帧几何的严格判定**，
   在无法确认 acceptance 时应把 coverage 降为 `partial`。本轮不解决该边界，只记录。

### 2.5 测试 / fixture 锚点

| 证据 | 断言 |
|---|---|
| `packages/demo/tests/world.test.ts:101-107` “玩家：逐帧锚点来自资源、盒子由锚点推出来” | last-train 玩家 `size 32×48`、anchor `{.5,.95}`、`at (40,250)` ⇒ `player.box = {x:24,y:204,w:32,h:48}` |
| `packages/demo/tests/world.test.ts:117-126` “实体：盒子由锚点推出来” | `luggage` 盒 `{x:480,y:210,w:40,h:40}`，盒底 = 地面 250 |
| `packages/contracts/tests/game-config.test.ts:301-335` “`at` 是锚点落点 / 锚点决定盒子从哪边长” | 盒由 `entityBox` 与锚点推导，不把 `at` 当左上角 |
| `packages/assets/tests/acceptance.test.ts:324-338` | 帧 anchor / sourceSize 漂移各产一条 error finding |

### 2.6 Verdict：**CONFIRMED（带边界）**

- 纯层盒公式、运行时按 kind 的取几何路径、逐帧边界均已由源码确认。
- “manifest 标称 size + 资源 anchor 决定实际空间占用”这一句话必须加上限定：
  **仅对 solid / chest / danger 的碰撞盒、以及 player 的 body 尺寸直接成立**；
  pickup / hazard / goal 的物理体来自图集帧，二者相等依赖 acceptance 不变量。
- 当前语料 0 漂移；schema 不强制；审计输入无法复核。因此不是 `INSUFFICIENT_EVIDENCE`，
  但依赖逐帧几何的判定必须保留 `partial` 降级路径。

---

## 3. P2：EntityKind 与 `body`

### 3.1 分支表

`packages/demo/src/world.ts:178-182` 对所有 kind 都先算：

```ts
const size = e.body ?? assetSize(pack, e.asset) ?? FALLBACK_SIZE;
const anchor = anchorOf(pack, e.asset);
...
box: boxAt(e.at, size, anchor)
```

但 `EntityDesc.box` 是否被运行时消费，按 kind 分叉：

| kind | 运行时分支 | `body` 是否生效 | 实际几何来源 |
|---|---|---|---|
| `solid` | `scene.ts:150` `this.addSolid(e.box)` | **生效** | `e.box`（`body ?? size` + anchor） |
| `pickup` | `scene.ts:151-155`：`physics.add.existing(sprite, true)` + `physics.add.overlap`；没有 `setSize(e.body)` | **忽略** | sprite 帧真实尺寸 + sprite origin |
| `hazard` | `scene.ts:157-165`：同上；`advanceHazards` 只移动 sprite 并 `updateFromGameObject()` | **忽略** | 帧真实尺寸 + 当前帧 origin；运动起点用 `d.at`，不用 `e.box` |
| `goal` | `scene.ts:166-174`：同上；只有 `wins` 的 goal 注册 `tryWin` | **忽略** | sprite 帧真实尺寸 + sprite origin |
| `chest` | `scene.ts:175-185`：`this.chests.push({ sprite, box: e.box, range: e.range ?? 0, ... })` | **生效** | `e.box`；`advanceChests` 手动 AABB |
| `danger` | `scene.ts:186-195`：`this.dangers.push({ sprite, box: e.box, ... })` | **生效** | `e.box`；`advanceDangers` 手动 AABB |
| `decor` | `scene.ts:196` `case "decor": break;` | 无碰撞语义 | 只画 |

补充事实：

- `physics.add.existing(sprite, true)` 的静态体宽高取 `gameObject.displayWidth/Height`
  （`StaticBody.js:56-62`），Sprite 未调用 `setSize`；因此 `e.body` 不进入 pickup / hazard / goal 的碰撞体。
- `hazard` 的 `motion` 也只作用于 sprite 位置：`start = e.motion?.axis === "y" ? d.at.y : d.at.x`
  （`scene.ts:159`），`advanceHazards` 用 `hazardAnchor` 设置 sprite 位置并更新静态体
  （`scene.ts:270-281`）。`e.box` / `e.body` 不参与。
- `world.ts` 仍为所有 kind 计算 `e.box`（含 `body`）；`packages/demo/src/site.ts:139`
  在装配期用它做 `pokeOut` 警告。这不是运行时消费。
- schema 允许 `body` 出现在任何 EntityKind 上（`game-config.ts:121`），没有 `superRefine`
  把 `body` 限制到 solid / chest / danger。
- `range` 同理：schema 允许任意实体（`game-config.ts:123-124`），但运行时只把它搬给 chest
  （`world.ts:186`）。

### 3.2 测试 / fixture

- **没有单元测试直接钉“pickup / hazard / goal 忽略 body”**。最接近的测试只钉 schema / 纯层盒：
  - `packages/contracts/tests/game-config.test.ts:30` 用 `solid` + `body 40×40` 做合法 config；
  - `packages/contracts/tests/reachability.test.ts:66,87,142` 用 `solid` + `body` 测可达性；
  - `packages/demo/tests/world.test.ts:117-126` 只测无 `body` 的实体盒。
- 语料：21 份唯一 config 中，`body` 只出现在 `danger`（1 个）；`pickup` / `hazard` / `goal` /
  `solid` / `chest` 的 `body` 覆盖均为 **0**。⇒ P2 的“忽略”分支在真实语料里**未被行使**，
  只能靠源码（E1）证明，不能靠 fixture 回归。
- 反向：`danger` 的 `body` 在 `packages/demo/probe/mechanic-probe.mjs:152-153` 被用来
  把打击盒扩到 120×60；这是浏览器探针，不是 vitest。

### 3.3 Verdict：**CONFIRMED**

源码分支明确：solid / chest / danger 吃 `body`；pickup / hazard / goal 忽略 `body`；
decor 无碰撞。E2 缺口（无单元测试、无语料覆盖）不影响语义结论，但下游判据若依赖“忽略 body”
应有自己的合成用例，不能声称有既有回归保护。

---

## 4. P3：Chest 交互范围

### 4.1 实际检测代码

`packages/demo/src/shell/scene.ts:315-325`：

```ts
private advanceChests(): void {
  if (!this.player || this.won) return;
  const b = this.player.body as Phaser.Physics.Arcade.Body;
  const pr = { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
  for (const c of this.chests) {
    if (c.opened) continue;
    const left = c.box.x - c.range, right = c.box.x + c.box.w + c.range;
    const top = c.box.y - c.range, bottom = c.box.y + c.box.h + c.range;
    if (pr.left < right && pr.right > left && pr.top < bottom && pr.bottom > top) this.openChest(c);
  }
}
```

- `c.box` 来自 `scene.ts:180` 的 `e.box`；`e.box` 来自 `world.ts:178-182` 的
  `body ?? manifest.size` + manifest.anchor，左上角取整。
- `c.range` 来自 `world.ts:186`：`...(e.kind === "chest" ? { range: e.range ?? 0 } : {})`；
  schema 缺省即 0（`game-config.ts:123-124`）。
- 交互盒 = **实体盒四边各外扩 `range`**（不是只扩水平/垂直，也不是从中心扩）。
- 玩家侧用 Phaser body 的 `left/top/right/bottom`（真实物理 AABB），不是 `world.player.box`。
- 相交用**严格不等号**：边贴边（恰好相切）不算命中。
- 每帧检查，不要求玩家 `blocked.down`；空中碰到也算。
- 一次性：`opened` 后跳过；`openChest` 只做 `collected += 1` + 切帧 + 刷新 HUD
  （`scene.ts:327-332`）。
- `range` 若出现在非 chest 实体上，运行时静默忽略（`world.ts:186` 的 kind 条件）。

### 4.2 与 `body ?? size` 的关系

是。`e.box` = `entityBox(e.at, e.body ?? assetSize(...) ?? FALLBACK_SIZE, anchorOf(...))`
（`world.ts:178-182`）。因此：

```
chestInteractionBox = expand(entityBox(at, body ?? manifest.size, manifest.anchor), range)
```

但有两个精度边界：

1. `entityBox` 对 x/y 取整（`game-config.ts:151-158`）；玩家 body 的左上角是
   `at − anchor × frameSize`（`Body.js:1060-1061`），anchor 非整数时是小数。玩家 AABB 与
   chest 盒之间存在 **≤0.5px 的取整差**（外加 P1 的帧漂移差）。严格相切附近的命中/不命中
   可能与拿 `world.player.box` 算的结果不同。
2. P1 的 acceptance 不变量若被破坏，chest 盒仍用标称/`body`，而玩家 body 位置会按帧尺寸漂移。

### 4.3 测试 / fixture

- `packages/demo/tests/world.test.ts:172-178`：只钉 `range` 的搬运与缺省 0
  （`expect(chest.range).toBe(12)`；`draw.missing` 不影响 kind/range）。
  **没有单元测试钉“四边外扩 / 严格相交 / 不要求落地”**。
- `packages/demo/probe/mechanic-probe.mjs:116-138` 用浏览器探针验证 `open-chest` 机制；
  `packages/demo/tests/shell-mechanic-witness.test.ts:32` 只钉 `this.openChest(c)` 这行行为串还在。
- 语料：21 份唯一 config 中 6 个 chest，1 个带 `range`；没有 chest 专属几何回归。

### 4.4 Verdict：**CONFIRMED**

交互盒公式、扩展方式、严格相交、触发时机、一次性语义均由源码确认；
E2 只有 `range` 搬运测试，几何行为本身没有单元测试。

---

## 5. P4：出生点与静态几何

### 5.1 初始化顺序

`packages/demo/src/shell/scene.ts`：

1. `create()`：建静态组 `this.solids = this.physics.add.staticGroup()`（`:46`）。
2. 背景（不影响碰撞）。
3. **地形**：`for (const t of world.terrain) this.addSolid(t)`（`:52`）——不可见静态矩形，
   加入 `this.solids`。
4. **玩家**：`this.addPlayer()`（`:58`）：
   - sprite 在 `world.player.at` 创建，origin = manifest 资源锚点（`:217`）；
   - `s.body!.setSize(b.w, b.h, false)`（`:219`）——body 宽高 = 纯层 `player.box` 的标称尺寸，
     `center=false` 不改 offset（`Body.js:1479-1519`；Body 构造时 offset 为 0，`Body.js:185`）；
   - `s.setGravityY(world.player.move.gravity)`（`:220`）；
   - `this.physics.add.collider(s, this.solids)`（`:228`）。
5. **实体**：`for (const e of world.entities) this.addEntity(e)`（`:61`）。
   `solid` 实体在这里才加入同一个 `this.solids` 组（`:150`）。
6. HUD / 相机 / 输入。
7. `update()` 每帧：先跑 hazard/danger/chest 逻辑，再设玩家水平速度、跳跃、重力
   （`:79-96`）；物理步由 Phaser 在场景 update 之后执行。

**初始化顺序不影响“后加入的 solid 是否碰撞”**：`Collider` 每步调用
`world.collideObjects(object1, object2, ...)`（`Collider.js:142-152`），而
`collideSpriteVsGroup` 每步读取 group 当前 children（`World.js:2073-2100`）。
玩家先建、实体 solid 后加入同一 group，仍会被检查。

### 5.2 碰撞分离语义（Phaser 3.90）

- 静态体 `immovable = true`（`StaticBody.js:316`）；玩家是 dynamic body。
- `World.separate` 先做 Y 或 X（`World.js:1379,1429`）；Y 优先取决于重力方向。
- 重叠计算以 `maxOverlap = deltaAbs + OVERLAP_BIAS` 为上限，`OVERLAP_BIAS` 缺省 **4**
  （`World.js:236`；`GetOverlapY.js:26-42`；`GetOverlapX.js:25-41`）。
- 若重叠量 > `maxOverlap` 或该轴未开启碰撞，`overlap = 0`，**不分离**。
- 若两个 body 在该轴都没有位移（`_dx === 0 && _dy === 0`），两者标记 `embedded`，
  `overlap = 0`，**不分离**。
- 只有一轴重叠被接受时，`SeparateY` / `SeparateX` 才移动 dynamic body
  （`SeparateY.js:27-56`；`ProcessY.js:376-397`）。
- 结论：**分离量有界**。垂直浅埋（≤ 本帧下落位移 + 4px）会被推回；更深的垂直重叠不会；
  水平重叠在玩家静止时不会推，只有玩家有水平位移且重叠量 ≤ 本帧位移 + 4px 时才会分离。

### 5.3 出生点相关代码有没有“专用处理”？

- **没有**。`scene.create()` / `addPlayer()` 里没有 spawn overlap 检测、重定位、告警或 `reset`。
- `buildWorld` 计算了 `player.floorY`（`world.ts:109-121,211`），但 `floorY` **只在
  hazard / danger 命中复位时使用**：
  `hitHazard()` 先把 body `reset(x, y)` 到 `world.player.at`，再按 `floorY` 校正脚线
  （`scene.ts:355-362`）。初始出生不调用这段。
- 纯层 `floorYOf` 只把“水平覆盖玩家盒子、顶边在脚底 −4px 以内、不带 motion、画得出来”的
  terrain / solid 顶边当落点（`world.ts:106-121`）。这是“浅埋 4px”的显式兜底，不是出生分离。
- 既有 `auditGameConfig` 的 spawn-in-solid 检查是**点测试**：
  `inside(config.player.at, boxOf(e.at, s, e.asset))`，只遍历 `kind === "solid"`，
  **不查 terrain、不查玩家 body 的 AABB 重叠**（`game-config.ts:553-561`；
  测试 `packages/contracts/tests/game-config.test.ts:287-293`）。

### 5.4 可证明 / 不可证明

**可证明（E1 + 库源码）**：

1. 地形与 `solid` 是静态碰撞体；玩家有 `collider(player, solids)`。
2. 初始出生不经过任何分离 / 重定位代码。
3. Phaser 对浅重叠（≤ 本帧位移 + 4px）会沿运动/重力轴分离；对深重叠与静止轴不分离，
   只标记 `embedded`。
4. hazard 复位路径才使用 `floorY`；初始出生不使用。
5. 既有 spawn-in-solid 错误只测 `player.at` 点是否落在某个 solid 盒内。

**不可证明（不能从源码推出）**：

1. 深埋出生点是否“卡死”。深埋时碰撞不分离，但玩家仍可按输入移动/跳跃；是否能离开、是否掉出世界，
   取决于地形形状、输入和后续帧。源码不能给出“一定不可玩”。
2. 静止时水平重叠的墙是否会永久阻挡；没有运行时观察或测试钉它。
3. 不同帧率下的分离量（`deltaAbs` 随帧时长变化）与穿透；没有固定步长保证。
4. 出生点与 terrain 重叠时的“正确”游戏语义；Runtime 没有定义，只有 Arcade 的默认行为。

因此：

- **描述性语义 CONFIRMED**：无显式 spawn 处理；分离有界。
- **profile 假设 CONTRADICTED**：`plan.md` §2.7 的
  `spawnSeparation: "unstick-from-static-geometry"` 以及 `research/03` §1.3 P4 的
  “运行时由碰撞分离把玩家推出”过宽。
- **任何把“出生点埋在 terrain”直接映射为 `PROVEN_UNPLAYABLE` 的判据：INSUFFICIENT_EVIDENCE**，
  除非把判据收窄到纯观察（例如“body 与静态几何重叠且无 nearby standable”，仍不能证明不可玩）。

### 5.5 测试 / fixture

- **没有测试**钉出生点与静态几何的分离行为。
- `packages/demo/tests/world.test.ts:357-390` 钉的是 `floorY` 纯层语义
  （last-train 盒底 252 被抬回地面 250；箱顶；浅埋 ≤4px；坑里回落脚线）。
- `packages/demo/tests/shell-scene-wiring.test.ts:51-56` 钉 `hitHazard` 用 `body.reset`
  并按 `floorY` 校正，不是初始 spawn。
- `packages/contracts/tests/game-config.test.ts:287-293` 钉“出生点卡在 solid 里”的**点测试**。

---

## 6. 适用性矩阵（LP-01 ～ LP-04）

> “可用”= 可以基于该语义写确定性算法；“降级”= 该语义未写入 profile / 无法验证时，
> 对应 coverage 必须为 `partial` 或 verdict 必须为 `INSUFFICIENT_EVIDENCE`。

| 判据层 | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| **LP-01 基础几何** | **可用**：用 `entityBox(at, body ?? size, anchor)`；solid / chest / danger 用 `body ?? size`，player 用标称 size + anchor。pickup / hazard / goal 的运行时体按帧尺寸，必须依赖 acceptance 不变量；无法验证时严格重叠 / BLOCKED 用 `partial` | **可用**：按 kind 取盒；pickup / hazard / goal **不得**把 `body` 当碰撞体。若 LP-01 统一套用 `body ?? size`，对这三类会产生与 Runtime 不符的盒 | **可用**：chest 交互盒原语 = `expand(entityBox(body ?? size), range)` | **不可用**：不得把“spawn 会自动分离”写进移动图；需要时只能作为观察 / coverage-gap |
| **LP-02 空间可达** | **可用**；严格 overlap / `*_BLOCKED` / chest reachability 依赖 P1。P1 未写入或 acceptance 不可验证 ⇒ 这些判据 `coverage.partial`，不得仅凭标称盒出 `PROVEN_UNPLAYABLE` | **可用**；目标盒必须忽略 pickup / goal 的 `body`。若用 `body` 判可达：body 更大时漏报，body 更小时误报（`research/03` §3.11 已给合成例） | **可用**；`PLAYABILITY_SPATIAL_CHEST_*` 依赖 `range` 外扩。P3 未写入 ⇒ chest 判据 `coverage.partial` | **必须降级**：`PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` 只能 `INSUFFICIENT_EVIDENCE`（或收窄为纯观察）；不能以“分离会推出”作为可玩性证明 |
| **LP-03 机制可通行** | **可用**：hazard 命中体 = 帧尺寸（accepted pack 下 = manifest size）；danger 命中体 = `e.box`（`body ?? size`） | **可用**：hazard `body` **被忽略**，danger `body` **生效**；声明了 `body` 的 hazard 不能按 `body` 扩张打击盒。若 P2 未写入 ⇒ 相关机制判据 `INSUFFICIENT_EVIDENCE` / `partial` | 不直接依赖（chest 不是机制层输入） | **部分可用**：hazard 复位的落点校正（`floorY`）可依赖；初始 spawn 的分离不可依赖。任何“出生点在 hazard / danger 内”的安全窗口判据仍应 `INSUFFICIENT_EVIDENCE` |
| **LP-04 关卡完成** | **可用**：目标盒 / chest 盒依赖 P1；P1 未验证 ⇒ 目标覆盖 `partial` | **可用**：chest `body` 生效、pickup / goal `body` 忽略；影响“必需收集物是否可取得”的几何 | **可用**：chest 作为必需收集物的交互范围依赖 P3；P3 未写入 ⇒ chest 相关完成性 `coverage.partial` | **降级**：spawn 状态不可证；任何“出生即不可完成 / 出生在危险内”的完成性断言必须 `INSUFFICIENT_EVIDENCE` |

**必须降级的判据（最小集合）**：

1. `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` —— P4 被证伪为“普遍 unstick” ⇒ 不得出
   `PROVEN_UNPLAYABLE`；只能 `INSUFFICIENT_EVIDENCE` / 观察。
2. 所有严格 overlap / `*_BLOCKED` / chest reachability —— P1 的 acceptance 不变量不可由
   审计输入复核 ⇒ 无法确认时 `coverage.partial`。
3. 带 `body` 的 pickup / hazard / goal 目标 —— P2 明确“忽略 body”；按 `body` 判会偏；
   若实现没有把 P2 写入 profile ⇒ `INSUFFICIENT_EVIDENCE`。
4. chest 交互范围 —— P3 未写入 profile ⇒ chest 判据 `coverage.partial`。
5. 任何依赖“出生点会被自动推出 / 出生在 hazard 内一定死”的完成性 / 机制判据 ——
   P4 + framework 的 hazard 复位语义不足以静态证明，降级。

---

## 7. 发现的矛盾 / 规格偏差

### C1. P4 的“unstick-from-static-geometry”是过宽的（**真矛盾**）

- 规格：`plan.md` §2.7 的 `spawnSeparation: "unstick-from-static-geometry"`；
  `research/03` §1.3 P4：“运行时由碰撞分离把玩家推出”。
- 源码：只有重叠量 ≤ 本帧位移 + `OVERLAP_BIAS(4)` 的那一轴会分离；
  深重叠与静止轴不分离（`GetOverlapY.js:26-42`、`GetOverlapX.js:25-41`、
  `SeparateY.js:27-56`、`World.js:236`）。Runtime 没有出生点专用代码。
- 影响：`SPAWN_IN_TERRAIN` 不能基于“会被推出”做确定性判决；必须降级或收窄。

### C2. P1 的“manifest 标称尺寸 + 资源锚点 = 碰撞几何”只对部分 kind 的字面成立（**限定条件**）

- 规格：`plan.md` §2.7 P1 行写 `"manifest-nominal-size+asset-anchor"`；
  `research/03` §1.3 P1 写“碰撞几何 = manifest 的标称 size + 资源级 anchor”。
- 源码：solid / chest / danger 的碰撞盒确实如此；**pickup / hazard / goal 的物理体**由
  Phaser 从 sprite 帧 `sourceSize` + 帧 origin 创建（`scene.ts:151-174`、
  `StaticBody.js:56-62,171`）。二者只有在 acceptance 强制“帧 == manifest”时才相等。
- 影响：P1 profile 应写明“accepted pack 的帧几何 == 标称尺寸 + 资源锚点”，
  不能写成“Runtime 直接读 manifest 的标称尺寸”。`plan.md` 的 P1 行与 P2 行本身已经隐含这个
  条件（P2 行写了“物理体来自 sprite 帧”），但 P1 行没有写，容易在下游被误读。

### C3. `auditGameConfig` 的 spawn-in-solid 是点测试，不是 body 重叠（**语义偏差**）

- 规格：`framework.md` §7.2 把“出生点卡在 `solid`”列为既有 `auditGameConfig` error；
  `research/03` §3.4 把 spawn-in-solid 归既有检查。
- 源码：`game-config.ts:553-561` 只测 `config.player.at` 点是否落在 `solid` 的盒内；
  不测玩家 body AABB，不测 terrain。测试 `game-config.test.ts:287-293` 也只覆盖点测试。
- 影响：LP-02 不能把“既有 spawn-in-solid”当作 body 重叠 / terrain 掩埋的覆盖；
  两件事必须分开登记，避免重复报告或漏报。

### C4. `EntityDesc.box` 对所有 kind 都用 `body`，但运行时只对部分 kind 消费（**潜在审计/运行时分歧**）

- 源码：`world.ts:178-182` 对所有 kind 用 `body ?? size` 建 `e.box`；
  `site.ts:139` 用 `e.box` 做装配期 `pokeOut`；运行时 pickup / hazard / goal 不用 `e.box`。
- 当前语料 0 个 pickup / hazard / goal / solid / chest `body`，所以暂无实际分歧；
  但合成 config 一旦声明，`e.box` 与运行时物理体不同。
- 影响：LP-01 若直接复用 `EntityDesc.box` / `auditGameConfig` 的 `boxOf`，必须按 kind 覆写
  pickup / hazard / goal 的取盒规则；不能“统一 body ?? size”。

### C5. `range` schema 不限制 kind，但只有 chest 消费（**静默忽略**）

- `game-config.ts:123-124` 允许任意实体带 `range`；`world.ts:186` 只给 chest 搬。
- 影响：LP-02 不应把非 chest 的 `range` 当成交互外扩；如需告警，属于新的 observation，
  不是 Runtime 语义。

### C6. `plan.md` 对“声明了 body 的 hazard”选择保守降级，源码其实可证明其体被忽略（**非矛盾，偏保守**）

- `plan.md` §2.7 P2 行：“04 对**声明了 `body` 的 hazard** 仍保守落 `INSUFFICIENT_EVIDENCE`
  （几何来源不确定）”。
- 源码：hazard 的 `body` 被忽略，命中体来自帧尺寸；在 acceptance 不变量下等于 manifest size。
  几何来源是确定的（`scene.ts:157-165`、`StaticBody.js:56-62`），不是“不确定”。
- 影响：这不是 spec 矛盾；是可以在 LP-03 收紧的空间。若维持保守策略，应把它写成“策略性降级”，
  不要写成“语义未知”。

### C7. `plan.md` P4 引用的语料证据不证明运行时分离（**证据错配**）

- `plan.md` §2.7 P4 行引用“03 §3.4 语料证据（纯盒重叠 11/20 误伤）”。
- 该语料证据证明的是“纯盒重叠会误伤 11/20，因此 spawn 判据要窄”，
  **不证明**运行时会把玩家推出。分离语义只能由 Phaser 源码 / 运行时测试证明。
- 影响：P4 profile 的“依据”列应改为源码 / 库行为，而不是语料误伤统计。

---

## 8. 复现命令与退出码

### 8.1 基线 / 生产代码未变

```bash
git rev-parse HEAD
# 8b8e45a15ace345c5ffb5de19e0ad54171b4dd58
git rev-parse --abbrev-ref HEAD
# wayfinder/level-playability-v1
git diff --stat fa17c14 HEAD -- packages fixtures
# （空）
```

### 8.2 关键源码检索

```bash
rg -n 'e\.body|body \?\?|setSize|physics\.add\.existing|advanceChests|advanceDangers|addSolid|addPlayer|collider\(' packages/demo/src
rg -n 'entityBox|anchorOf|assetSize|range: e\.range|floorY' packages/contracts/src packages/demo/src
rg -n 'maxOverlap|embedded|OVERLAP_BIAS|immovable|updateFromGameObject' \
  packages/demo/node_modules/phaser/src/physics/arcade/{GetOverlapY.js,GetOverlapX.js,World.js,StaticBody.js,SeparateY.js}
rg -n 'sourceSize|anchor-mismatch|source-size-mismatch' packages/assets/src/acceptance.ts packages/assets/tests/acceptance.test.ts
```

### 8.3 既有测试（E2）

```bash
npx vitest run \
  packages/demo/tests/world.test.ts \
  packages/demo/tests/shell-scene-wiring.test.ts \
  packages/demo/tests/shell-mechanic-witness.test.ts \
  packages/contracts/tests/game-config.test.ts
# EXIT=0
# Test Files  4 passed (4)
# Tests       138 passed (138)
```

其中与本票直接相关的用例：

- `world.test.ts`「玩家：逐帧锚点来自资源、盒子由锚点推出来」；
- `world.test.ts`「实体：盒子由锚点推出来」；
- `world.test.ts`「`range` 缺省 0（交互区 = 实体盒子本身），给了就照实带」；
- `world.test.ts`「可站立点：last-train 的盒子底 252 被抬回地面 250」等 `floorY` 用例；
- `shell-scene-wiring.test.ts`「create() 里玩家先于实体创建」「hitHazard 用 body.reset …」；
- `game-config.test.ts`「出生点卡在 solid 里 → 报出来」。

### 8.4 只读语料扫描（E3）

**逐帧 sourceSize / anchor vs manifest（35 份唯一 v4 manifest）**：

```bash
node - <<'EOF'
const fs=require('fs'),path=require('path');
const root=process.cwd();
const inv=JSON.parse(fs.readFileSync('.scratch/level-playability-v1/corpus/inventory.json','utf8'));
const seen=new Set(); let manifests=0,assets=0,framesChecked=0,badSize=0,badAnchor=0;
for(const m of inv.manifests){
  if(m.schema!=='assetpack/v4'||seen.has(m.contentHash)) continue;
  seen.add(m.contentHash); manifests++;
  const man=JSON.parse(fs.readFileSync(path.join(root,m.path),'utf8'));
  const dir=path.dirname(path.join(root,m.path));
  const F={};
  for(const at of man.atlases||[])
    Object.assign(F, JSON.parse(fs.readFileSync(path.join(dir,at.meta),'utf8')).frames||{});
  for(const a of man.assets||[]){
    if(!a.size||!a.frames) continue;
    assets++;
    for(const f of a.frames){
      framesChecked++;
      const r=F[f.name]; if(!r) continue;
      const s=r.sourceSize||r.frame;
      if(s.w!==a.size.w||s.h!==a.size.h) badSize++;
      if(r.anchor && (r.anchor.x!==a.anchor.x || r.anchor.y!==a.anchor.y)) badAnchor++;
    }
  }
}
console.log({manifests,assets,framesChecked,badSize,badAnchor});
EOF
# { manifests: 35, assets: 343, framesChecked: 1068, badSize: 0, badAnchor: 0 }
```

**entity `body` / `range` 的语料覆盖（21 份唯一 config）**：

```bash
node - <<'EOF'
const fs=require('fs'),path=require('path');
const root=process.cwd();
const inv=JSON.parse(fs.readFileSync('.scratch/level-playability-v1/corpus/inventory.json','utf8'));
const seen=new Set(); const byKind={};
for(const c of inv.configs){
  const key=c.contentHash||c.path; if(seen.has(key)) continue; seen.add(key);
  const j=JSON.parse(fs.readFileSync(path.join(root,c.path),'utf8'));
  for(const e of j.entities||[]){
    byKind[e.kind]??={total:0,withBody:0,withRange:0}; byKind[e.kind].total++;
    if(e.body) byKind[e.kind].withBody++;
    if(e.range!=null) byKind[e.kind].withRange++;
  }
}
console.log(JSON.stringify(byKind,null,1));
EOF
# solid/pickup/hazard/goal/chest 的 withBody 均为 0；danger total 1 / withBody 1；
# chest total 6 / withRange 1；其余 withRange 0。
```

> 扫描是只读的，不写任何文件；退出码 0。

---

## 9. 证据索引（最常用的一条线）

| 语义 | 证据 |
|---|---|
| 纯层实体盒 | `world.ts:176-187`；`game-config.ts:151-158` |
| 玩家盒 / floorY | `world.ts:192-211`；`world.ts:106-121` |
| 锚点取 manifest 级 | `draw.ts:118-130` |
| solid 用 `e.box` | `scene.ts:129-133,150` |
| pickup / hazard / goal 用 sprite 帧体 | `scene.ts:151-174`；`StaticBody.js:56-62,171` |
| chest 用 `e.box` + range | `scene.ts:175-185,315-325`；`world.ts:186` |
| danger 用 `e.box` | `scene.ts:186-195,300-307` |
| 玩家 body / collider | `scene.ts:217-228` |
| hazard 每帧同步静态体 | `scene.ts:270-281`；`StaticBody.js:579-600` |
| 复位到 spawn + floorY | `scene.ts:355-362` |
| 既有 spawn-in-solid 点测试 | `game-config.ts:553-561`；`game-config.test.ts:287-293` |
| 帧尺寸 / 锚点验收 | `assets/src/acceptance.ts:306-310,341-345`；`acceptance.test.ts:324-338` |
| Arcade 分离上限 / embedded | `World.js:236`；`GetOverlapY.js:26-42`；`GetOverlapX.js:25-41`；`SeparateY.js:27-56` |
