# 106. 会动的危险物每帧被抬高半个身位 —— 敌人 7 秒后飞到 `y=-21838`

Type: task
Status: resolved
Owner: claude (2026-10-17 · 已认领；**已施工 · 已关 · 已提交**（人裁逐字「提交 并 关票」）—— 施工记录与收口在文末)
Blocked by: —
Map: ../map.md
> 派生自 2026-10-17 **实际驱动 `site/v2`** 时的现场：敌人（`enemy-1`，配置 `at.y=250`）
> 在画面里从来没出现过。运行时读到的精灵位置是 **`y = -21838`**，而且还在继续飞。
> ⚠️ 立票与施工同一次点头（人裁逐字「另立两张施工票 并 实现」）；
> **不提交 · 不关票**。

## 1 · 现场（运行时读数，只读）

- 站点 / 驱动同票 105。
- `enemy-1` 配置：`at {x:620,y:250}` · 资源 `enemy-wasteland` · 锚点 `{x:0.5,y:1}` ·
  `motion {kind:"cycle", axis:"x", distance:60, periodMs:3000}`。
- 站点跑约 7 秒后读取场景对象：`x=686`（在 620..680 的行程内，正常）、
  **`y=-21838`**（应为 250），`visible=true` ⇒ 不在画面上，也不会与玩家相交。
- 运行时把 `advanceHazards` 冻住、把精灵摆回 `(580,250)` 后，敌人正常渲染
  （`/tmp/demo-shots/16-enemy-in-scene.png`）。

## 2 · 根因

`packages/demo/src/shell/scene.ts` 的 `advanceHazards()`：

```ts
const b = h.sprite.body as Phaser.Physics.Arcade.StaticBody;
if (h.axis === "x") b.reset(p + b.halfWidth, b.center.y); else b.reset(b.center.x, p + b.halfHeight);
h.sprite.setPosition(b.center.x, b.center.y);
```

资源的锚点是 **`{0.5,1}`（底边中心）** ⇒ `body.center.y` 比精灵原点（底部）**高半个身位**：

1. `b.reset(...)` 把精灵按锚点换算后的位置写一遍；
2. `sprite.setPosition(b.center.x, b.center.y)` 又把精灵的原点写成**盒心** —— 等于把精灵
   再往上抬 `h/2`；
3. 下一帧 `b.reset` 从新的精灵位置重算盒心 ⇒ 又高 `h/2`。

⇒ **每帧净漂移 `h/2`**（敌人 88 高 ⇒ 44px/帧）。7 秒 ≈ 420 帧 × 44 ≈ 18,480px，
与实测 `y=-21838` 同量级。轴正确、三角波公式正确 —— 错的是**盒心与锚点的往返**。

## 3 · 要改的

1. 新增**纯函数** `packages/demo/src/hazard.ts` 的 `hazardAnchor(start, distance, periodMs, elapsedMs)`：
   返回**锚点**应在的那个世界坐标（三角波；不碰 Phaser、不碰盒子）。
2. `advanceHazards` 改为：
   ```ts
   const p = hazardAnchor(h.start, h.distance, h.periodMs, h.t0);
   if (h.axis === "x") h.sprite.setPosition(p, h.sprite.y); else h.sprite.setPosition(h.sprite.x, p);
   (h.sprite.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
   ```
   删掉 `b.reset` / `b.center` 的往返。

### 判据

1. **纯函数测试**：0 / ¼ / ½ / ¾ / 1 个周期的读数；扫一整个周期不越界；
   `distance` / `periodMs` 为 0 或负数 ⇒ 原地不动。
2. **源码见证**（剥注释后）：`advanceHazards` 里出现 `hazardAnchor(` 与 `updateFromGameObject()`，
   **不出现** `b.reset(` / `.center` —— 后两者正是本 bug 的形状。
3. ⭐ **先红后绿**：新测试先在当前代码上跑 ⇒ 必须红；改完再绿。
4. **运行时**：重装配站点后，敌人的 `y` 恒为 250，`x` 在 620..680 之间往返；可见、可碰撞。

## 4 · 边界（本票不做）

- 只动 `advanceHazards` + 新增 `src/hazard.ts`。
- 不改 hazard 的 `start` 语义（仍是「锚点坐标」）、不改轴切换、不改 `motion` 契约。
- 不改资源 / 包 / 配置 / 契约 / 提示词 / R 表 / `packages/qa` / `game-maker.local.json`。
- 不顺手修票 105 之外的接线。
- **不提交 · 不关票**。

---

## 施工记录（2026-10-17 · 人裁「另立两张施工票 并 实现」）

> ⚠️ 本节只记施工。§1–§3 的现场、根因与边界一字未动。**未提交 · 未关票**。

### 落地（逐文件）

| 文件 | 改了什么 |
| --- | --- |
| `packages/demo/src/hazard.ts`（新） | 纯函数 `hazardAnchor(start, distance, periodMs, elapsedMs)`：返回**锚点**位置（三角波），零 Phaser / 零 DOM。 |
| `packages/demo/src/shell/scene.ts` | `advanceHazards` 改为 `hazardAnchor(...)` + `sprite.setPosition(...)` + `StaticBody.updateFromGameObject()`；删掉 `b.reset` / `b.center` 往返。 |
| `packages/demo/tests/hazard.test.ts`（新） | 3 条：0 / ¼ / ½ / ¾ / 1 周期读数 · 扫多个周期不越界 · distance / periodMs ≤ 0 原地不动。 |
| `packages/demo/tests/shell-scene-wiring.test.ts` | 源码见证：`advanceHazards` 里有 `hazardAnchor(` 与 `updateFromGameObject()`，没有 `b.reset(` / `.center`。 |
| `packages/demo/tests/shell-capability-witness.test.ts` | `motion:cyclic` 的见证从 `scene.ts` 的 `h.t0 % h.periodMs` 跟到 `hazard.ts` 的 `elapsedMs % periodMs`（三角波搬家了）。 |

### ⭐ 先红后绿

- 未改源码时：
  - `hazard.test.ts` **整个文件红**（`../src/hazard.js` 还不存在）；
  - `shell-scene-wiring.test.ts` ⇒ **1 failed / 1 passed**：
    `expected 'private advanceHazards(delta: number)…' to contain 'hazardAnchor('`。
- 改完后先全绿；**但全量测试当场抓到一处漏改**：
  `shell-capability-witness.test.ts` 的 `motion:cyclic` 还指着 `h.t0 % h.periodMs` ⇒
  **1 failed / 1499 passed**。把见证改指 `hazard.ts` 后 ⇒ **89 文件 / 1500 条全绿**。
- 这条漏改照实记：它正是「能力词表指得到实现」那条判据在起作用，不是噪音。

### 运行时验证（重装配 `site/v3`，零付费）

- 敌人（`enemy-1`）在 t = 初始 / 3.6 / 4.8 / 10.0 / 11.6 秒的读数：
  **`y` 始终 = 250**（施工前 7 秒就是 `-21838`），`x` 在 **625..676** 之间往返（配置 620..680），
  `visible = true`。
- 截图：`/tmp/demo-shots3/27-enemy-visible.png`（玩家 x=500、敌人 x=635，敌人正常出现在画面里）。

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
- ⚠️ 没改 `motion` 契约、没改 hazard 的 `start` 语义 / 轴切换。

---

### ✅ 收口（2026-10-17 · 人裁逐字「提交 并 关票」）

> ⚠️ 本轮只做三件：① 本票 `open` → `resolved` + 本节；② 本图 `Decisions so far` 加一行、前沿改为「空」；
> ③ 提交。**源码 / 测试**在施工轮已经落地 —— 本轮**一个字节没改**。

- **收口押的是哪几条**：§3 的四条全部成立 ——
  ① 纯函数测试 3 条在盘上（0 / ¼ / ½ / ¾ / 1 周期 · 扫多个周期不越界 · ≤0 原地不动）；
  ② 源码见证：`advanceHazards` 有 `hazardAnchor(` / `updateFromGameObject()`，无 `b.reset(` / `.center`；
  ③ **先红后绿**读数照实：施工前见证红 + `hazard.test.ts` 文件红；施工后绿；
  ⚠️ 施工后全量当场抓到 `motion:cyclic` 的能力见证仍指旧位置（**1 failed / 1499 passed**），
  改指 `hazard.ts` 后 **89 文件 / 1500 条全绿**；
  ④ 运行时（`site/v3`）：敌人 `y` 在全部采样点恒为 250，`x` 在 625..676 往返、可见
  （`/tmp/demo-shots3/27-enemy-visible.png`）。
- `tsc -b --force` 干净 · `pnpm build` 干净 · `check:deps` ✅ 9 包 · `check:links` ✅ 332 份文档 / **2025 条链接**（收口时复测）。
- ⚠️ **n=1**：只验了这一份 e2e 站点里的一个会动危险物。
- ✅ **提交**：与票 105 同一个 commit（含 `src/hazard.ts`、`scene.ts`、两份测试、能力见证的迁移）。
