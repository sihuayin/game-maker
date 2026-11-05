# LP-00 Runtime 语义核验（P1–P4 源码证据）

Type: research
Status: resolved
Owner: research subagent · 2026-11-05
Blocked by: —
Map: ../map.md

## Question

在代码基线上，从 `packages/demo` 源码核实 PRD §4.1 的 P1–P4 四项 Runtime 语义，形成 LP 后续算法可用的语义边界与证据档案。本票 AFK，由 research subagent 执行；只读，不改生产代码。

| 编号 | 核验内容 | 必须回答的问题 |
|---|---|---|
| P1 | 资源尺寸、锚点与碰撞几何 | manifest 标称 `size` 与资源 `anchor` 如何决定实体的实际空间占用？逐帧 atlas 与标称尺寸的误差边界是什么（本轮不解决，只记录）？ |
| P2 | EntityKind 与 body | solid / chest / danger 的 `body` 是否实际生效？pickup / hazard / goal 是否忽略 `body`？判断分支在哪个文件、哪一行？ |
| P3 | Chest 交互范围 | 实际交互检测代码是什么？交互盒是否等于 `body ?? size` 外扩 `range`？ |
| P4 | 出生点与静态几何 | 出生点与地形重叠时，Runtime 的实际初始化与碰撞处理顺序、分离语义是什么？ |

### 必须交付

1. **`../research/01-runtime-semantics.md`**：每项语义的 `file:line`、公式或条件、涉及实体类型、正反例 fixture / 测试、语义变化时受影响的判据。
2. **适用性矩阵**：P1–P4 各自标 `CONFIRMED` / `CONTRADICTED` / `INSUFFICIENT_EVIDENCE`；后者必须写明缺什么证据、影响哪些判据。
3. **判据边界**：LP-01～LP-04 哪些算法可以基于哪项语义；哪项语义缺失时必须降级为 `INSUFFICIENT_EVIDENCE`。
4. 本票 `## Answer` 摘要（结论 + 缺口 + 对后续票的影响）。

### 证据

- E1：`file:line`；E2：既有测试名 + 断言或新增只读检查；E3：零付费复跑（命令、退出码、路径）。
- 不得用推测补齐缺失语义；无法确认即 `INSUFFICIENT_EVIDENCE`。

### 边界

- 只读；不修改 `packages/**`、测试、fixture、历史语料。
- 不裁定判据是否上线或是否硬拒；那是 02 复核票的事。
- 零付费；不调用模型、不生图、不重建站点。

### 通过标准

- P1–P4 每项有源码证据，或明确标记为 `INSUFFICIENT_EVIDENCE` 并写明影响。
- 证据可复现：命令 / 测试名 / 退出码或精确 `file:line`。

## Answer

**2026-11-05 完成（research subagent；AFK）。只读；未改 `packages/**` / 测试 / fixture / 历史语料；
未 commit / 推送；零模型调用、零生图、零站点重建。**

基线：`wayfinder/level-playability-v1` @ `8b8e45a`；生产代码基线 `main` @ `fa17c14`
（`git diff --stat fa17c14 HEAD -- packages fixtures` 为空）。完整报告：
[`../research/01-runtime-semantics.md`](../research/01-runtime-semantics.md)。

### P1–P4 结论

| # | Verdict | 结论与关键锚点 |
|---|---|---|
| P1 | **CONFIRMED（带边界）** | 纯层盒 = `entityBox(at, body ?? manifest.size, manifest.anchor)`（`world.ts:176-187`；`game-config.ts:151-158`）；solid / chest / danger / player 的碰撞几何由它决定。pickup / hazard / goal 的物理体由 Phaser 按图集帧 `sourceSize` + 帧 origin 创建（`scene.ts:151-174`；`StaticBody.js:56-62,171`）。逐帧 ↔ 标称尺寸的等式**不在 schema 里**，由 pack acceptance 强制（`acceptance.ts:306-310,341-345`）；冻结语料 35 份唯一 v4 manifest / 343 资源 / 1068 帧，漂移 **0**。审计输入看不到图集 JSON ⇒ 依赖逐帧几何的严格判定无法确认时 `coverage.partial`。 |
| P2 | **CONFIRMED** | `solid` / `chest` / `danger` 吃 `e.body`（`scene.ts:150`、`175-195`）；`pickup` / `hazard` / `goal` 忽略 `e.body`（`scene.ts:151-174` 只 `physics.add.existing(sprite, true)`，没有 `setSize(e.body)`）；`decor` 无碰撞。`world.ts:178-182` 仍为所有 kind 算 `e.box`，但运行时只对 solid / chest / danger 消费它。无单元测试直接钉“忽略”分支；21 份唯一 config 中 body 只出现在 danger（1 个），pickup / hazard / goal / solid / chest 均 0。 |
| P3 | **CONFIRMED** | chest 交互盒 = `e.box = entityBox(at, body ?? size, anchor)` 四边各外扩 `range`（缺省 0），与玩家 Phaser body 的 AABB 每帧严格相交；不要求落地；一次性（`scene.ts:315-325`；`world.ts:186`）。玩家 body 坐标为小数、chest 盒取整 ⇒ 有 ≤0.5px 的取整边界。既有测试只钉 `range` 搬运（`world.test.ts:172-178`），几何行为无单元测试。 |
| P4 | **CONTRADICTED（作为 profile 假设）** | Runtime **没有**出生点专用处理。初始化顺序：static group → terrain（`scene.ts:52`）→ player + `collider(player, solids)`（`:58,228`）→ entities（`:61`；后加的 solid 仍被每步 group 检查）。Phaser 只分离“重叠量 ≤ 本帧位移 + `OVERLAP_BIAS(4)`”的那一轴；深垂直重叠、静止时水平重叠被判 `embedded` / `overlap=0`，**不分离**（`World.js:236`；`GetOverlapY.js:26-42`；`GetOverlapX.js:25-41`；`SeparateY.js:27-56`）。`floorY` 只在 hazard/danger 复位时使用（`scene.ts:355-362`），初始出生不使用。描述性语义可确认，但 `plan.md` §2.7 的 `"unstick-from-static-geometry"` 与 `research/03` §1.3 P4 的“碰撞分离把玩家推出”过宽。 |

### 矛盾 / 规格偏差

1. **P4 “unstick” 过宽**：深埋与静止轴不分离；不能以“会被推出”证明出生点可玩。
2. **P1 措辞**：`plan.md` P1 行写 `"manifest-nominal-size+asset-anchor"`；pickup / hazard / goal 的运行时体实际来自图集帧。二者只在 acceptance 不变量下相等；P1 行应写明该不变量。
3. **既有 spawn-in-solid 是点测试**：`game-config.ts:553-561` 只测 `player.at` 点是否在 `solid` 盒内，不测 player body AABB、不测 terrain；不能当作 terrain 掩埋 / body 重叠的覆盖。
4. **`EntityDesc.box` 全 kind 用 body**：`world.ts:178-182` + `site.ts:139`；运行时 pickup / hazard / goal 不用它。直接复用会在声明 `body` 时产生审计 / 运行时分歧。
5. **`range` 静默忽略**：schema 允许任意实体带 `range`，运行时只给 chest（`world.ts:186`）。
6. **plan 的 hazard-body 保守降级是策略而非语义缺口**：源码已证 hazard `body` 被忽略；几何来源（帧尺寸）确定。
7. **plan P4 的语料依据错配**：03 §3.4 的“纯盒重叠 11/20 误伤”证明的是判据要窄，不证明运行时分离。

### 对 LP-01～LP-04 的影响

- **LP-01**：可用 P1 / P2 / P3 建几何；必须按 kind 取盒（pickup / hazard / goal 忽略 `body`）。逐帧 acceptance 不变量不可由审计输入复核 ⇒ 严格 overlap / BLOCKED 在未验证时 `coverage.partial`。**不得**把 P4 的“spawn 自动分离”写进移动图。
- **LP-02**：空间判据可用 P1 / P2 / P3；chest 依赖 P3，目标盒必须忽略 pickup / goal 的 `body`。`PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` **必须降级为 `INSUFFICIENT_EVIDENCE`**（或收窄为纯观察），因为 P4 不证明深埋不可玩。
- **LP-03**：hazard 命中体按帧尺寸（忽略 `body`），danger 命中体按 `e.box`（`body` 生效）；P2 未写入 profile 时相关判据 `INSUFFICIENT_EVIDENCE` / `partial`。hazard 复位的 `floorY` 校正可依赖；初始 spawn 分离不可依赖。
- **LP-04**：chest 作为必需收集物的交互范围依赖 P3；目标盒依赖 P1 / P2。任何“出生即不可完成 / 出生在危险内”的断言必须 `INSUFFICIENT_EVIDENCE`。

### 证据复现

```bash
npx vitest run \
  packages/demo/tests/world.test.ts \
  packages/demo/tests/shell-scene-wiring.test.ts \
  packages/demo/tests/shell-mechanic-witness.test.ts \
  packages/contracts/tests/game-config.test.ts
# EXIT=0；4 files / 138 tests passed
```

语料只读扫描：35 份唯一 v4 manifest / 343 资源 / 1068 帧，`sourceSize` 与 manifest `size`
不一致 0、帧 `anchor` 与 manifest `anchor` 不一致 0；21 份唯一 config 中 `body` 仅 danger 1 个。
完整脚本与全部 `file:line` 见报告 §8、§9。
