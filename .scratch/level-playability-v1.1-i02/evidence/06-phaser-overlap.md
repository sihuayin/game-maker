# I02-06 Phaser overlap 语义直接证据

| 项 | 值 |
| --- | --- |
| 票 | [`19-i02-06-phaser-overlap.md`](../issues/19-i02-06-phaser-overlap.md) |
| 分支 | `wayfinder/level-playability-v1.1-i02` |
| 基线提交 | `a3b8a54e36a292d0dc8dbd5f5839ec35964a3858`（I-01 合并） |
| 日期 | 2026-11-10 |
| 性质 | 只读取证；只写 `.scratch/level-playability-v1.1-i02/evidence/` |
| **修改产品目录** | **否** |
| 结论 | Phaser 3.90.0 的矩形 AABB 判定为**严格不等号**：相切不算撞，零面积接触不算撞；**未推翻** `overlapsStrict` |

> 本票只取证，不裁定语义、不改票、不改 map。若下游要改 I-00 §6.1，必须在冲突登记表单独裁定。

---

## 0. 环境、输入与命令

### 0.1 环境

| 项 | 值 |
| --- | --- |
| 平台 | `darwin 24.6.0` / arm64 |
| Node | `v22.23.2` |
| pnpm | `10.7.1` |
| 仓库 | `/Volumes/shy/some-projects/game-maker` |
| HEAD | `a3b8a54e36a292d0dc8dbd5f5839ec35964a3858` |

### 0.2 输入与 SHA-256

| 输入 | SHA-256 |
| --- | --- |
| `docs/v7.8/移动-I00.md`（冻结基线，§6.1 在 `:87`） | `d9fea112a519965e7903d6c7dc9125498927880b14ff0baba9896ecd446e69eb` |
| `docs/v7.8/移动-200.md`（I-02 需求，未跟踪） | `14a3816d8d5975765e3a9301c5f06612ab03f6f14130ca4ca865550ec165b7d5` |
| `packages/contracts/src/playability/geometry.ts` | `50438491e803944c6e6319d526ce02b0bded0d061640c821ad6500aea4572266` |
| `packages/demo/src/shell/scene.ts` | `3e352958952d34588f68a15d8ffd6bfd9a09cdebb50615bff554f210b773db82` |
| `packages/demo/src/shell/entry.ts` | `0a0cddae6e58f9643f7b829761c876ad9414f164593b1a02929617056c71f2e7` |
| `packages/demo/package.json` | `e48b20971329ee5c77a556b9444ba39525cfe626ca5cc7fdc2f05a42497be412` |
| `pnpm-lock.yaml` | `072ee768b3d4cb40a616a9a97472676239fcb27e79785409f9116c88307821aa` |
| `packages/demo/node_modules/phaser/package.json` | `2761e48ade77d19cbe2560cbec3cc2c52a4c666fdaae7fe39d6949f7e1738993` |
| `phaser/src/physics/arcade/World.js` | `07749c89a8064a71bbcc04447fbca13f3c5a6c73e327fe58b8c4c4630840d8f1` |
| `phaser/src/physics/arcade/Body.js` | `4dbe7bf13105473227c6b04dfd7b6d4a68599b287bba73167eba6736d7a87717` |
| `phaser/src/physics/arcade/StaticBody.js` | `1eba22a763f3d79bedbe3513d648647e5ee0c28b2492aebbffcd3146fdf84649` |
| `phaser/src/physics/arcade/SeparateX.js` | `e87042d9e74a7c7e60ac5a5491613ff53ff606d8902f7403da8b00cacf90e517` |
| `phaser/src/physics/arcade/SeparateY.js` | `bd23bc45950799c68264ed9ea5de8c79f1b775036d90ccaecdc9c9f0691edd9f` |
| `phaser/src/physics/arcade/GetOverlapX.js` | `8c5b5d5a6874df1fab2add4d3b1477ca29ddef3d550db23b00916083b31a8bf1` |
| `phaser/src/physics/arcade/GetOverlapY.js` | `f1f860039c5a275759219e27fd6cdf589c52f10b1fcefe51995ea9a5ff1469fd` |
| `phaser/src/physics/arcade/Collider.js` | `20234336ec9079192e7182fb0171610f8b8b0758b2347de7636f722255081ce5` |

### 0.3 命令与退出码

| # | 命令 | 退出码 | 结果摘要 |
| ---: | --- | ---: | --- |
| 1 | `git rev-parse HEAD` | 0 | `a3b8a54e36a292d0dc8dbd5f5839ec35964a3858` |
| 2 | `cat packages/demo/node_modules/phaser/package.json` | 0 | `"version": "3.90.0"`，`"release": "Tsugumi"` |
| 3 | `cd packages/demo/node_modules/phaser && node -p "require('./package.json').version"` | 0 | `3.90.0` |
| 4 | `grep -n "phaser@" pnpm-lock.yaml` | 0 | `phaser@3.90.0`（`:641`、`:1086`，integrity `sha512-/cziz/5ZIn02uDkC9RzN8VF9x3Gs3XdFFf9nkiMEQT3p7hQlWuyjy4QWosU802qqno2YSLn2BfqwOKLv/sSVfQ==`） |
| 5 | `cd packages/demo && node -e "require('phaser')"` | 0（被 try/catch 捕获） | `ERR window is not defined`；完整 Phaser 不能在纯 Node 中启动（见 §7 限制 L7） |
| 6 | `node -e "<§8 探针脚本>"` | 0 | 相切/角接触/零面积接触均 `false`；1px 与 1e-9 重叠均 `true`（§3.2 表） |
| 7 | `git status --short -- packages docs fixtures` | 0 | 仅 `?? "docs/v7.8/移动-200.md"`（开图前已存在的未跟踪输入）；本次未写入产品目录 |
| 8 | `shasum -a 256 <0.2 所列文件>` | 0 | 与 0.2 表一致 |

---

## 1. 锁定的 Phaser 版本

**3.90.0。**

判定链：

1. `packages/demo/package.json:15` 声明 `"phaser": "^3.90.0"`。
2. `packages/demo/node_modules/phaser/package.json:3` 实际安装 `"version": "3.90.0"`；`:4` `"release": "Tsugumi"`。
3. `node -p "require('./package.json').version"` 输出 `3.90.0`（退出码 0）。
4. `pnpm-lock.yaml:641` / `:1086` 两处解析均为 `phaser@3.90.0`，带 integrity。
5. 本地源码哈希见 §0.2；`dist/phaser.js` 中同一判定逻辑见 §3.1 末尾。

> 说明：`node_modules/phaser` 是 pnpm 落盘的实体目录（`drwxr-xr-x`），不是指向别处的软链；`package.json` 的 `main` 指 `./src/phaser.js`，`browser` 指 `./dist/phaser.js`。demo 用 esbuild `--platform=browser` 打包（`packages/demo/package.json` 的 `bundle` 脚本），会命中 `browser` 字段；因此同时核对了 `dist/phaser.js` 的同一函数。

---

## 2. Arcade Physics 的 overlap / collide 源码位置

### 2.1 调用链

`physics.add.overlap(...)`（demo 实际用法）：

| 步骤 | 位置 |
| --- | --- |
| Factory 入口 | `phaser/src/physics/arcade/Factory.js:95-98` → `this.world.addOverlap(...)` |
| 建 `Collider(overlapOnly=true)` | `phaser/src/physics/arcade/World.js:859-869` |
| 每步执行 | `phaser/src/physics/arcade/Collider.js:144-153` → `world.collideObjects(..., this.overlapOnly)` |
| `World.overlap` | `World.js:1775-1781` → `collideObjects(..., true)` |
| 分发 | `World.js:1841-1931`（`collideObjects`）→ `World.js:1934`（`collideHandler`）→ `World.js:1954` |
| Sprite vs Sprite | `World.js:2035-2056` → `World.js:2045` 调 `separate(..., overlapOnly)` |
| 统一判定闸门 | `World.js:1379`（`separate`）；`World.js:1388-1394` 含 `!this.intersects(body1, body2)` |

`physics.add.collider(...)`（demo 用于玩家×地形）：

| 步骤 | 位置 |
| --- | --- |
| Factory 入口 | `Factory.js:76-79` → `this.world.addCollider(...)` |
| 建 `Collider(overlapOnly=false)` | `World.js:824-834` |
| `World.collide` | `World.js:1816-1822` → `collideObjects(..., false)` |
| 后续分发 / `separate` | 同上（`World.js:1934,1954,2035,2045`） |

### 2.2 overlap 与 collide 的差别

- **检测谓词完全相同**：两者都先过 `World.separate` 的 `!this.intersects(body1, body2)` 闸门（`World.js:1392`）。相切时两者都在此返回 `false`，回调不触发。
- **差别在“检测到之后做什么”**：
  - `overlapOnly=true`：`World.js:1432-1436` 仍调用 `SeparateX/SeparateY`，但只计算 `overlapX/overlapY/touching/blocked`，不移动 body、不改速度；`World.js:1464-1470` 走 `OVERLAP` 事件分支。
  - `overlapOnly=false`：真正做位置分离（`SeparateX/SeparateY` 的 `ProcessX/ProcessY`），`World.js:1471-1474` 走 `COLLIDE` 事件分支。
- 所以“相切算不算撞”的答案对 overlap 与 collide **一致**：都不算。

---

## 3. AABB 判定：严格不等号还是闭区间

### 3.1 源码（决定性代码）

`packages/demo/node_modules/phaser/src/physics/arcade/World.js:1698-1714`：

```js
    intersects: function (body1, body2)
    {
        if (body1 === body2)
        {
            return false;
        }

        if (!body1.isCircle && !body2.isCircle)
        {
            //  Rect vs. Rect
            return !(
                body1.right <= body2.left ||
                body1.bottom <= body2.top ||
                body1.left >= body2.right ||
                body1.top >= body2.bottom
            );
        }
```

上行号：`World.js:1698`（函数）、`:1707-1713`（矩形判定）。

边界 getter（`right = x + width`，`bottom = y + height`）：

- 动态 `Body`：`Body.js:2740`（`left`）、`:2757`（`right`）、`:2774`（`top`）、`:2791`（`bottom`）。
- 静态 `StaticBody`：`StaticBody.js:1052`（`left`）、`:1069`（`right`）、`:1086`（`top`）、`:1103`（`bottom`）。

语义化简（德摩根）：

```text
!(a.right <= b.left || a.bottom <= b.top || a.left >= b.right || a.top >= b.bottom)
≡ a.right > b.left && a.bottom > b.top && a.left < b.right && a.top < b.bottom
≡ a.x + a.w > b.x && a.y + a.h > b.y && a.x < b.x + b.w && a.y < b.y + b.h
```

**这是严格不等号。** 相切（`a.right === b.left` 等）使对应子项为 `true`，整个 `!(...)` 为 `false`。

`dist/phaser.js:150305-150322` 是同一函数（UMD 构建，未压缩版本），逐字一致：

```js
    intersects: function (body1, body2)
    {
        ...
            return !(
                body1.right <= body2.left ||
                body1.bottom <= body2.top ||
                body1.left >= body2.right ||
                body1.top >= body2.bottom
            );
```

### 3.2 运行时探针（直接执行安装源码）

用 Node 直接 `require` 安装目录里的 `World.js`，对 `World.prototype.intersects` 传入真实边界值调用（脚本见 §8）：

| 用例 | 构造 | `intersects` |
| --- | --- | --- |
| 右边相切 | `A=(0,0,10,10)`，`B=(10,0,10,10)` | `false` |
| 左边相切 | `A=(10,0,10,10)`，`B=(0,0,10,10)` | `false` |
| 上/下边相切 | `A=(0,0,10,10)`，`B=(0,10,10,10)` | `false` |
| 角点接触 | `A=(0,0,10,10)`，`B=(10,10,10,10)` | `false` |
| 1px 正面积重叠 | `A=(0,0,10,10)`，`B=(9,0,10,10)` | `true` |
| 1e-9 正面积重叠 | `A=(0,0,10,10)`，`B=(10-1e-9,0,10,10)` | `true` |
| 零面积接触（退化体贴边） | `A=(5,10,0,0)`，`B=(5,5,0,10)` | `false` |
| 零宽体完全落在另一盒内部 | `A=(5,2,0,6)`，`B=(0,0,10,10)` | `true`（见 §7 L5 的限制） |

`World.prototype.separate` 的闸门也实测：

| 用例 | `intersects` | `separate(..., overlapOnly=true)` |
| --- | --- | --- |
| 右边相切 | `false` | `false` |
| 1px 正面积重叠 | `true` | `true` |

结论：**边界相切不触发 overlap / collide；零面积接触（非退化盒）不触发。** 只要有一点正面积重叠（哪怕 `1e-9`）就触发。

### 3.3 补充：`SeparateX/SeparateY` 不会把相切“补”回来

- `SeparateX.js:36-39`（`SeparateY.js:36-39` 同构）：

```js
    if (overlapOnly || overlap === 0 || (body1Immovable && body2Immovable) || body1.customSeparateX || body2.customSeparateX)
    {
        //  return true if there was some overlap, otherwise false
        return (overlap !== 0) || (body1.embedded && body2.embedded);
    }
```

- 相切时 `intersects` 已经返回 `false`，`separate` 在 `World.js:1392` 提前返回，根本到不了 `SeparateX/Y`。
- 即使绕开该闸门，相切的 `overlap = body1.right - body2.x = 0`（`GetOverlapX.js:37`），`SeparateX` 也返回 `false`（除非两体都被标记 `embedded`）。
- `OVERLAP_BIAS`（`World.js:236` 默认 4）只在 `collide` 模式用于“拒绝分离”的阈值（`GetOverlapX.js:39,69` 的 `overlap > maxOverlap && !overlapOnly`），不改变 `intersects` 的相切语义；`overlap` 模式显式跳过该阈值。

### 3.4 例外：圆形 body 是闭区间

`World.js:1717-1722`（圆 vs 圆）与 `World.js:1748-1755`（圆 vs 矩形）使用 `<=`：

```js
return DistanceBetweenPoints(body1.center, body2.center) <= (body1.halfWidth + body2.halfWidth);
...
return (dx + dy) <= (circle.halfWidth * circle.halfWidth);
```

即圆 body 的“相切”算相交（闭区间）。**但本 demo 不使用圆形 body**：`grep -rn "setCircle" packages/demo/src` 无命中；所有 body 都是默认矩形。见 §7 L4。

---

## 4. 与 `geometry.ts` 的逐条对照

`packages/contracts/src/playability/geometry.ts:14-27`：

```ts
export const overlapsStrict = (a: Aabb, b: Aabb): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const overlapsInclusive = (a: Aabb, b: Aabb): boolean =>
  a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

export const touches = (a: Aabb, b: Aabb): boolean => overlapsInclusive(a, b) && !overlapsStrict(a, b);
```

`a.x`/`a.y` 对应 `left`/`top`，`a.x+a.w`/`a.y+a.h` 对应 `right`/`bottom`，逐条代入 §3.1 的德摩根化简：

| 轴/边 | Phaser `intersects` | `overlapsStrict` | 是否一致 |
| --- | --- | --- | --- |
| 右 vs 左 | `a.right > b.left` ⇒ `a.x+a.w > b.x` | `b.x < a.x+a.w` | **一致**（同一不等式换序） |
| 左 vs 右 | `a.left < b.right` ⇒ `a.x < b.x+b.w` | `a.x < b.x+b.w` | **一致** |
| 下 vs 上 | `a.bottom > b.top` ⇒ `a.y+a.h > b.y` | `b.y < a.y+a.h` | **一致** |
| 上 vs 下 | `a.top < b.bottom` ⇒ `a.y < b.y+b.h` | `a.y < b.y+b.h` | **一致** |
| 四者连接 | `&&`（德摩根后） | `&&` | **一致** |
| 相切 | `false` | `false` | **一致** |
| 正面积重叠 | `true` | `true` | **一致** |

与 `overlapsInclusive` 的对照：

| 用例 | Phaser 矩形 | `overlapsStrict` | `overlapsInclusive` | `touches` |
| --- | --- | --- | --- | --- |
| 边相切（有共线边界段） | `false` | `false` | `true` | `true` |
| 角点相切（仅一个点） | `false` | `false` | `true` | `true` |
| 1px / 1e-9 正面积重叠 | `true` | `true` | `true` | `false` |
| 完全重合 | `true` | `true` | `true` | `false` |
| 退化零宽体严格落在另一盒内部 | `true` | `true` | `true` | `false` |
| 退化零宽体贴在另一盒边界 | `false` | `false` | `true` | `true` |

结论：**Phaser 3.90.0 的矩形 AABB 语义 = `overlapsStrict`，不是 `overlapsInclusive`。** `touches` 正好描述 Phaser 判为“不算撞”的边界接触集合（对非退化盒）。

---

## 5. `packages/demo/**`（只读）中的实际调用点

全局：Arcade Physics 在 `packages/demo/src/shell/entry.ts:83` 启用：

```ts
physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
```

未传 `fps` / `fixedStep`，因此取默认 `fps=60`、`fixedStep=true`（`World.js:159,170`）。

| 位置 | 调用 | 参与的几何 |
| --- | --- | --- |
| `scene.ts:46` | `this.physics.add.staticGroup()` | 地形静态体组 |
| `scene.ts:129-132` | `addSolid`：`add.rectangle(...)` + `solids.add(r)` | 地形矩形 → `StaticBody` |
| `scene.ts:152-154` | pickup：`physics.add.existing(sprite, true)` + `physics.add.overlap(playerOrStub(), sprite, ...)` | 玩家**动态矩形 body** × pickup **静态矩形 body**（帧尺寸） |
| `scene.ts:158-163` | hazard：`physics.add.existing(sprite, true)` + `physics.add.overlap(..., () => hitHazard())` | 玩家动态 body × hazard 静态 body（帧尺寸） |
| `scene.ts:167-172` | goal：`physics.add.existing(sprite, true)` + `physics.add.overlap(..., () => tryWin())` | 玩家动态 body × goal 静态 body（帧尺寸） |
| `scene.ts:217-219` | 玩家 `physics.add.sprite(...)`，随后 `s.body!.setSize(b.w, b.h, false)` | 玩家 body 尺寸 = `world.player.box`（配置盒），不是帧尺寸 |
| `scene.ts:228` | `physics.add.collider(s, this.solids)` | 玩家动态 body × 地形静态 body（`collide` 语义，不是 hazard 判定） |
| `scene.ts:275-279` | hazard 每帧 `sprite.setPosition(...)` 后 `(body as StaticBody).updateFromGameObject()` | hazard 静态体跟随精灵锚点 |
| `scene.ts:200-207` | `playerOrStub()`：玩家未建时用 1×1 静态矩形顶替 | 仅在玩家尚未创建时参与 overlap 注册（见 §7 L8） |
| `scene.ts:287-306` | danger 命中：**不走 physics overlap**，手写 `pr.left < d.box.x + d.box.w && pr.right > d.box.x && pr.top < d.box.y + d.box.h && pr.bottom > d.box.y` | 玩家 body 的 `left/top/right/bottom` × 配置 `d.box` |
| `scene.ts:315-323` | chest 触发：手写 `pr.left < right && pr.right > left && pr.top < bottom && pr.bottom > top`，其中 `left/right/top/bottom` 是 `c.box` 四边外扩 `c.range` | 玩家 body × 配置盒外扩后的交互区 |

两个手写判据（`scene.ts:304`、`:323`）与 `overlapsStrict` **逐项同形**：

```text
pr.left < b.x + b.w && pr.right > b.x && pr.top < b.y + b.h && pr.bottom > b.y
```

即 `a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h`。这说明 Runtime 里“物理 overlap 路径”和“手写几何路径”使用的是同一套严格语义。

### 5.1 body 几何从哪里来

- 玩家：`physics.add.sprite` 先按帧 `displayWidth/displayHeight` 建 body（`Body.js:60-64`），再 `setSize(b.w, b.h, false)` 改成配置盒（`scene.ts:219`）。`center=false` 表示不改 `offset`；body 位置由 `transform` + `offset` − `displayOrigin` 决定（`Body.js:194-197`、`:1060-1061`），而 `displayOrigin` 会随图集每帧 `anchor` 变化（`scene.ts:214-216` 的注释）。
- pickup / hazard / goal：`physics.add.existing(sprite, true)` → `World.enableBody`（`World.js:516-536`）→ `new StaticBody`（`World.js:530`）。`StaticBody` 尺寸取 `gameObject.displayWidth/displayHeight`（`StaticBody.js:62-65`；每帧同步时 `:585-588` 用 `getTopLeft` + display 尺寸），即**图集帧几何 × scale**，不是配置 body 盒。
- 地形：`add.rectangle` 对象的 display 尺寸 = 配置盒 `w/h`（`scene.ts:130`）。
- danger / chest：命中判定不注册物理体，直接用配置 `box` 手写严格判据。

---

## 6. 是否推翻 `strict`：否（无 strict 冲突）

**证据没有推翻 `overlapsStrict`。** 矩形 AABB 的相切与零面积接触在 Phaser overlap / collide 两条路径上都不触发，与 I-00 §6.1（`docs/v7.8/移动-I00.md:87`）冻结的语义一致。

因此：

- **不需要**改 Runtime 语义基线（I-00 §6.1）。
- **不需要**改 I-02 的 `ε`。
- 冲突登记表 B-10（`evidence/02-conflict-register.md:37`）中“Phaser overlap 直接证据缺失”的**谓词部分**已由本证据补齐；B-10 的处置由下游裁定票完成，本票不修改登记表状态。
- 若未来证据改判，按 I-00 §6.1 的约定：改的是 **Runtime 语义基线**，不是 I-02 的 epsilon；受影响下游为 **I02-D1、I02-D3、I02-D4**（与 B-10 登记的影响面一致）。**本次没有发生这种改判。**

仍存在的、**不属于 strict/闭区间冲突**的问题：

1. 本证据只证明**谓词语义**，不证明“分析用的 AABB = 运行时实际 body”。后者的证据链仍受 C-11 / B-02 约束（Runtime hitbox 未被 I-01 逐帧证明）。
2. 圆 body 使用闭区间（§3.4），但 demo 未使用圆 body。
3. 运行时是**离散步进**采样，而 I-02 是连续时间解析求交（§7 L3）。

---

## 7. 限制

- **L1｜body 几何 ≠ 精灵渲染帧几何。** Arcade 判定用的是 Body 的 `position/width/height`，不是 `getBounds()`。玩家 body 被显式改成配置盒（`scene.ts:219`）；pickup/hazard/goal 的静态体按帧 display 尺寸生成（`StaticBody.js:62-65,585-588`）。本证据只覆盖谓词，不覆盖“分析盒 = 运行时 body”的等价性。
- **L2｜origin / offset / 逐帧 anchor。** 玩家 body 位置取决于 `displayOrigin` 与 `offset`（`Body.js:194-197,1060-1061`）；图集每帧 `anchor` 会改 `displayOrigin`（`scene.ts:214-216`）。`setSize(..., false)` 不改 `offset`。这会影响 body 的绝对落位，不影响相切语义。
- **L3｜离散步进 vs 连续时间。** `intersects` 只在每个物理 step 对当前 body 位置求值（`World.js:986-995`；`step` 中同构块 `:1045-1054`），默认 `fps=60`、`fixedStep=true`（`World.js:159,170`）。I-02 的连续时间解析求交可能得到“帧间曾穿透”的结论，而 Runtime 的离散采样可能从未观测到 `intersects=true`（穿透/隧穿）。这是**检测时机**差异，不是谓词差异。
- **L4｜圆 body 是闭区间。** `World.js:1720,1754` 用 `<=`；若未来 demo 对 hazard/player 调用 `setCircle`，相切会算相交。当前 `packages/demo/src` 无 `setCircle`（`grep` 无命中），全部为矩形。
- **L5｜退化 body 的“零面积接触”边角。** 两个**正面积**盒之间的零面积接触为 `false`；但一个零宽/零高 body 若“严格落在”另一盒内部，`intersects` 会返回 `true`（§3.2 最后一行）。玩家/ hazard 的正面积 body 不会触发此边角；I-02 的模型也不应产生零面积盒。
- **L6｜旋转。** Arcade body 的几何**始终是轴对齐矩形或圆**，不随精灵 `angle` 旋转（`Body.js:230`）。demo 未旋转实体；若布局旋转，运行时会与轴对齐模型不一致。
- **L7｜不能在纯 Node 中启动完整 Phaser。** `require('phaser')` 报 `window is not defined`（§0.3 命令 5）。本证据改为直接加载 `src/physics/arcade/World.js` 模块并调用 `World.prototype.intersects`；该模块可脱离 DOM 加载。这验证的是**安装源码中的真实函数**，不是重新实现的近似逻辑。
- **L8｜stub 注册。** `playerOrStub()` 在玩家未创建时用 1×1 静态体注册 overlap（`scene.ts:200-207`）；`shell-scene-wiring.test.ts:22-28` 要求 `addPlayer()` 先于实体循环。若顺序被破坏，overlap 会绑在 1×1 替身上——这是接线风险，不是语义风险。
- **L9｜`processCallback` / mask。** demo 未传 `processCallback`；`separate` 还会检查 `enable`、`checkCollision.none`、`collisionMask/category`（`World.js:1388-1394`）。这些条件只会进一步**减少**触发，不会把相切变成相交。

---

## 8. 复现方法

在 `/Volumes/shy/some-projects/game-maker` 下执行；退出码均为 0。

```bash
# 1) 版本
cat packages/demo/node_modules/phaser/package.json | sed -n '1,6p'
(cd packages/demo/node_modules/phaser && node -p "require('./package.json').version")
grep -n "phaser@" pnpm-lock.yaml

# 2) 决定性源码
sed -n '1698,1714p' packages/demo/node_modules/phaser/src/physics/arcade/World.js
sed -n '1379,1395p' packages/demo/node_modules/phaser/src/physics/arcade/World.js
sed -n '34,42p'    packages/demo/node_modules/phaser/src/physics/arcade/SeparateX.js

# 3) 直接执行安装源码里的 intersects / separate
node -e '
const P = "/Volumes/shy/some-projects/game-maker/packages/demo/node_modules/phaser/src/physics/arcade/World.js";
const World = require(P);
const I = World.prototype.intersects;
const mk = (x,y,w,h) => ({ isCircle:false, left:x, right:x+w, top:y, bottom:y+h });
const cases = [
  ["right-edge tangent", mk(0,0,10,10), mk(10,0,10,10)],
  ["left-edge tangent",  mk(10,0,10,10), mk(0,0,10,10)],
  ["top-edge tangent",   mk(0,0,10,10), mk(0,10,10,10)],
  ["corner touch",       mk(0,0,10,10), mk(10,10,10,10)],
  ["1px overlap",        mk(0,0,10,10), mk(9,0,10,10)],
  ["1e-9 overlap",       mk(0,0,10,10), mk(10-1e-9,0,10,10)],
  ["degenerate touching edge", mk(5,10,0,0), mk(5,5,0,10)],
  ["zero-width body inside",   mk(5,2,0,6), mk(0,0,10,10)],
];
for (const [n,a,b] of cases) console.log(n.padEnd(28), I.call({}, a, b));
// separate() 闸门
const body = (x,y,w,h) => ({
  enable:true, checkCollision:{none:false}, collisionMask:1, collisionCategory:1,
  isCircle:false, x, y, width:w, height:h, left:x, right:x+w, top:y, bottom:y+h,
  center:{x:x+w/2,y:y+h/2}, halfWidth:w/2, halfHeight:h/2,
  deltaAbsX:()=>0, deltaAbsY:()=>0, _dx:0, _dy:0,
  touching:{none:true,up:false,down:false,left:false,right:false},
  blocked:{none:true,up:false,down:false,left:false,right:false},
  embedded:false, immovable:false, customSeparateX:false, customSeparateY:false,
  physicsType:0, overlapX:0, overlapY:0, position:{x,y}, updateCenter(){},
});
const self = { intersects:I, OVERLAP_BIAS:4, forceX:false, gravity:{x:0,y:0} };
const S = World.prototype.separate;
console.log("separate tangent(overlapOnly) ", S.call(self, body(0,0,10,10), body(10,0,10,10), null, null, true));
console.log("separate 1px(overlapOnly)     ", S.call(self, body(0,0,10,10), body(9,0,10,10),  null, null, true));
'
```

实测输出：

```text
right-edge tangent           false
left-edge tangent            false
top-edge tangent             false
corner touch                 false
1px overlap                  true
1e-9 overlap                 true
degenerate touching edge     false
zero-width body inside       true
separate tangent(overlapOnly)  false
separate 1px(overlapOnly)      true
```

```bash
# 4) 产品目录未被修改
git status --short -- packages docs fixtures
# 仅输出开图前已存在的未跟踪输入：
# ?? "docs/v7.8/移动-200.md"
```

---

## 9. 一页结论

| 问题 | 答案 |
| --- | --- |
| 安装版本 | **Phaser 3.90.0**（`node_modules/phaser/package.json:3`；lockfile `pnpm-lock.yaml:641,1086`） |
| overlap 判定位置 | `World.js:1698-1714`（`intersects`），经 `separate` 的 `:1392` 闸门 |
| collide 判定位置 | 同一 `intersects` + 同一 `separate`；差别仅在 `overlapOnly` 的后续处理（`:1432-1474`） |
| 严格还是闭区间 | **严格不等号**：`!(right <= left || bottom <= top || left >= right || top >= bottom)` |
| 边界相切算撞吗 | **不算**（`false`） |
| 零面积接触算撞吗 | 非退化盒间**不算**；退化 body 的特殊边角见 L5 |
| 与 `overlapsStrict` | **逐项同形、完全一致** |
| 与 `overlapsInclusive` | 不一致；`touches` 正是 Phaser 判 `false` 的相切集合 |
| 是否推翻 strict | **否**；无 Runtime 基线冲突 |
| 下游影响 | 无需改 I-00 §6.1 / I-02 ε；B-10 的谓词证据已补齐，处置留给下游裁定票 |
