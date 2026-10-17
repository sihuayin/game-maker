# 105. 实体交互全部绑在 1×1 替身上 —— 拾取 / 危险 / 终点在真站点里都不触发

Type: task
Status: resolved
Owner: claude (2026-10-17 · 已认领；**已施工 · 已关 · 已提交**（人裁逐字「提交 并 关票」）—— 施工记录与收口在文末)
Blocked by: —
Map: ../map.md
> 派生自 2026-10-17 **实际驱动 `site/v2`**（无头 Chrome + 真键盘输入）时的现场：
> 画面全对（背景 / 角色 / HUD / 道具），但**跑过三堆废料后 `collected` 仍是 0**，
> 尖刺穿过去也不退回，终点不触发。
> ⚠️ 立票与施工同一次点头（人裁逐字「另立两张施工票 并 实现」）；
> **不提交 · 不关票**（施工 / 提交 / 收口仍是三次独立点头）。

## 1 · 现场（运行时读数，只读）

- 站点：`raw/run-out-2026-10-17d/wasteland-scavenger-assets/site/v2/index.html`
- 驱动：无头 Chrome（960×540）+ CDP 真键盘事件；`Phaser.Game` 构造时挂一个只读探针
- 读数：
  - 跑过废料 `scrap-1/2/3`（x=180 / 260 / 340）之后：`scene.collected = 0`，
    三堆废料全部仍 `active: true`。
  - `physics.world.colliders.getActive()`：**10 条全是 `Rectangle ↔ Sprite`**；
    唯一和玩家有关的是 `Sprite ↔ StaticPhysicsGroup`（地形）。
  - 因此尖刺（x=470）穿过去不退回、宝箱 / 终点不触发。
- 截图：`/tmp/demo-shots/02-pickups.png` · `/tmp/demo-shots/17-pickups-collected.png`（后者是
  **运行时重绑 overlap 之后**的对照，不是本票施工前的行为）。

## 2 · 根因

`packages/demo/src/shell/scene.ts` 的 `create()` 先实体、后玩家：

```ts
for (const e of world.entities) this.addEntity(e);   // pickup / hazard / goal
this.addPlayer();
```

`addEntity` 的三条分支在**注册 overlap 的那一刻**调 `this.playerOrStub()`（`:164-172`）。
此时 `this.player` 还是 `undefined` ⇒ 绑定的是那个 1×1 的 `stub`（位于 `(0,0)`）。
`addPlayer()` 之后**没有任何重绑**。

⇒ 「拾取 / 碰到危险 / 到达终点」的 collide 对象从第一天起就是替身，和真玩家无关。
这不是数据问题：manifest / config 里三族引用都解得到，`draw.missing` 全为 false。

## 3 · 要改的

把 `this.addPlayer()` 移到实体循环**之前**。

理由：`playerOrStub()` 的兜底只应在「玩家画不出来」（`addPlayer` 早退、不设 `this.player`）时
生效；正常路径上先建实体等于让 stub 冒充玩家。玩家与实体的深度由 `DEPTH_PLAYER` /
`DEPTH_ENTITY` 决定，与创建顺序无关；玩家与地形的 collider 在 `addPlayer` 内注册，不依赖实体。

### 判据

1. **源码见证**（剥注释后）：`create()` 里 `this.addPlayer()` 出现在实体循环之前。
   ⚠️ `shell/scene.ts` import 不了 Phaser，与 `shell-capability-witness.test.ts` 同一条纪律。
2. ⭐ **先红后绿**：先在当前代码上跑新测试 ⇒ 必须红；改完再绿。
3. **运行时**（重装配站点后）：
   - 跑过三堆废料 ⇒ `collected = 3`，HUD 三个 pip 可见；
   - 碰到尖刺 ⇒ 退回起点（`hitHazard` 的既有语义）；
   - 集齐后碰到 goal ⇒ 「到达终点」。

## 4 · 边界（本票不做）

- **只动 `scene.ts` 的创建顺序**：`playerOrStub` / `addEntity` / `hitHazard` / `tryWin` 一行不改。
- 不改资源 / 包 / 配置 / 契约 / 提示词 / R 表 / `packages/qa` / `game-maker.local.json`。
- 不顺手修票 106 之外的东西（会动的危险物另有一票）。
- **不提交 · 不关票**。

---

## 施工记录（2026-10-17 · 人裁「另立两张施工票 并 实现」）

> ⚠️ 本节只记施工。§1–§3 的现场、根因与边界一字未动。**未提交 · 未关票**。

### 落地（逐文件）

| 文件 | 改了什么 |
| --- | --- |
| `packages/demo/src/shell/scene.ts` | `create()` 里 `this.addPlayer()` 移到实体循环**之前**；注释写明「overlap 在注册那一刻取 `playerOrStub()`」。 |
| `packages/demo/tests/shell-scene-wiring.test.ts` | 新增源码见证：剥注释后 `addPlayer()` 的位置必须小于实体循环的位置。 |

⚠️ `playerOrStub` / `addEntity` / `hitHazard` / `tryWin` 一行未改；深度、渲染顺序、HUD 未动。

### ⭐ 先红后绿

- 未改源码时：`npx vitest run packages/demo/tests/shell-scene-wiring.test.ts`
  ⇒ **1 failed / 1 passed**，红的是本条：
  `addPlayer() 必须在实体循环之前…: expected 561 to be less than 496`。
- 改 `scene.ts` 后：**2/2 绿**（同文件另一条是票 106 的见证）。

### 运行时验证（重装配 `site/v3`，零付费）

- 碰撞器：**10 条 `Sprite ↔ Sprite`**（玩家 ↔ 6 废料 / 尖刺 / 敌人 / 2 终点）+ 1 条地形 ——
  施工前是 10 条 `Rectangle ↔ Sprite`。
- 跑过前三堆废料（x=180/260/340）：`collected = 3`、`pips = 3`、场上剩 3 堆。
- 尖刺（x=470）：t≈4.8s 读数 `player.x = 117`（从 ~445 被退回起点后重新跑了 0.85s，
  `cam = 0`）—— `hitHazard` 的既有语义生效。
- 终点：集齐 6 个废料后跑到 `gate-1`（x=1850）⇒ `won = true`、`pips = 6`、
  截图出现「到达终点」（`/tmp/demo-shots3/26-win.png`）。

### 五闸（施工后）

```text
pnpm test        ✅ 89 files / 1500 tests（基线 87 / 1495 ⇒ +2 文件 / +5 条）
tsc -b --force   ✅ 干净
pnpm build       ✅ 干净
pnpm check:deps  ✅ 9 个包
pnpm check:links ✅ 332 份文档 / 2021 条链接零断裂
```

### 没做的

- ⚠️ **没提交 · 没关票** —— 施工 / 提交 / 收口仍是三次独立点头。
- ⚠️ 没有顺手改生图残留碎点（那是另一类问题，未立票）。

---

### ✅ 收口（2026-10-17 · 人裁逐字「提交 并 关票」）

> ⚠️ 本轮只做三件：① 本票 `open` → `resolved` + 本节；② 本图 `Decisions so far` 加一行、前沿改为「空」；
> ③ 提交。**源码 / 测试**在施工轮已经落地 —— 本轮**一个字节没改**。

- **收口押的是哪几条**：§3 的三条全部成立 ——
  ① 源码见证在盘上（`shell-scene-wiring.test.ts`：剥注释后 `addPlayer()` 先于实体循环）；
  ② **先红后绿**读数照实：施工前 `expected 561 to be less than 496`，施工后同文件 2/2 绿；
  ③ 运行时（重装配 `site/v3`）：碰撞器 10 条 `Sprite ↔ Sprite`；跑过前三堆废料 ⇒
  `collected=3` / 3 pip / 场上剩 3 堆；尖刺 x=470 ⇒ t≈4.8s `player.x=117`（退回起点）；
  集齐 6 个后到 gate ⇒ `won=true`、6 pip、「到达终点」。
- 全量 **89 文件 / 1500 条全绿** · `tsc -b --force` 干净 · `pnpm build` 干净 ·
  `check:deps` ✅ 9 包 · `check:links` ✅ 332 份文档 / **2025 条链接**（收口时复测）。
- ⚠️ **n=1**：运行时只验了这一份 e2e 站点 / 这一份 config；不构成对其它玩法的普查。
- ✅ **提交**：本票与票 106、两份源码 / 测试、重装配的 `site/v3/`、本图前沿注 = **同一个 commit**。
