# I03-03B2a 玩家脚点 / 锚点坐标约定裁定

Type: grilling
Status: resolved
Owner: claude (I03-03B2a session 2026-11-14)
Blocked by: —
Map: ../map.md
Class: I-03 / DECISION

## Question

`config.player.at` 到底表示**锚点落点**还是**脚点**？D2 自身两句话冲突（`08-i02-d2…:96` 用 `footOf`，`:97` 说 `at` 按脚点），`profile.ts` / demo 与 `temporal-witness.ts` 各按一边；last-train 的 anchor `.95` 使 player / graph 的几何行在零容差下无法冻结。

### 必须裁定

- 规范约定：`at` = 锚点（`footOf`） / `at` = 脚点（`boxFromFoot(at)`） / 新增显式 `playerFoot` / `playerBox`；
- player audit box 的派生公式与取整规则（D2 说不取整）；
- `temporal-witness` 的 spawn 是否改为 `footOf`；若改，需列出受影响的测试与真实关卡；
- runtime body 与 audit box 的零容差比较；若 Phaser 取整导致 delta，是否 STOP（推荐 STOP，不引入容差）；
- 是否需要在 I-03 实施单元中修正 `temporal-witness.ts`，以及该修正是否超出 `temporal*.ts` 白名单；
- 不修改 I-02 原文；只在 I-03 授权包里记录裁定与影响。

### 禁止

- 在本票自行选择归一化方式继续 B2；
- 修改产品代码 / fixture / Runtime / `profile.ts` / `graph.ts`；
- 开放公共能力 / 推送 / PR / 合并。

### 验收

规范约定、公式、取整规则、测试影响、实施边界、负向场景；B2 可据此继续。

## Answer

**Q1=A / Q2=A / Q3=A。** 冻结玩家几何的规范约定；**不修改任何产品代码 / fixture / Runtime / `profile.ts` / `graph.ts`**，实施留给 I-03 实施单元。

### 1. 规范约定（Q1=A）

- `config.player.at` = **锚点落点**（draw anchor），不是脚点。
- `foot = footOf(at, size, anchor)`（`profile.ts:77`）。
- `playerBox = boxFromFoot(foot, size)`，**不取整**（与 `runtimePlayerGeometry` 一致）。
- last-train 实例：`at=(40,250)`、size `32×48`、anchor `.95` ⇒ `foot=(40,252.4)`、`playerBox=(24,204.4,32,48)`。
- **D2 冲突处理**：`08-i02-d2…:96`（`footOf` / `boxFromFoot`）为规范；`:97` 的“`player.at` 按脚点解释”在 I-03 范围内**被本裁定取代**。不修改 D2 / I-02 原文；在 I-03 授权包记录本裁定与影响。
- demo `world.player.box`（`entityBox` 取整，`(24,204,32,48)`）是**绘制盒**，不是 body / audit 的期望；probe 必须分别记录 sprite bounds 与 body world AABB，不能用 `world.player.box` 直接当 body 期望。

### 2. `temporal-witness` 修正（Q2=A）

- 修正放在 **I-03 实施单元**，`temporal-witness.ts` 必须逐文件列入 I03-07 白名单；不修改 I-02 原文。
- `resolveWitnessSpace` 不再把 `player.at` 直接当脚点；使用 `footOf(at, size, anchor)` 派生玩家盒。
- **整数格与分数脚点**：状态格仍以整数 `at` 为 lattice anchor；玩家盒用 `foot` 的**常量偏移**从 lattice 点派生。不得把 `foot` 截断 / 取整成整数状态，也不得把分数 foot 直接塞进 `spawn.footX/footY`。
- 若模型无法在整数格上表达该常量偏移 ⇒ **STOP + HITL**；不得静默取整或换 lattice。
- 回归：新增 anchor `.95` / last-train 玩家回归；U2/U5 现有 `.5,1` 夹具不受影响；必须确认没有删除 / 放宽既有安全断言。

### 3. 零容差与 runtime body（Q3=A）

- audit player box **不取整**；Phaser body world AABB 与它**零容差**。
- sprite world bounds 与 body world AABB **分开记录**；不得用绘制盒 / `world.player.box` 代替 body。
- 若 Phaser 取整 / offset 导致任何非零 delta ⇒ **STOP**；不引入 ±0.5px 或字段容差。
- `body size / offset / bounds / foot` 逐项记录；`delta` 只作诊断，不参与放宽判定。

### 4. 影响

- player 分项：canonical box `(24,204.4,32,48)`；witness 旧 box `(24,202,32,48)` 是 at-as-foot 的结果，必须修正。
- graph 分项：`graph.player` 来自 `runtimePlayerGeometry`（已用 `footOf`），与 canonical box 一致；无需改公式，但需 probe 验证 body。
- hazard 分项：不受玩家约定影响。
- U2/U5 内存夹具 anchor `.5,1`，`footOf(at)=at`，不受影响；last-train / `.95` 需要新回归。
- 不修改产品代码；B2 可继续冻结 canonical player 行。

### 5. 边界

- 本票不实现修正、不写 probe、不改 fixture / Runtime / 产品代码。
- 全部进入 I-03 授权包；I03-09 必须记录本裁定、D2 冲突处理、`.95` 回归、零容差与分数 foot 的 lattice 约束。
- 不开放 `PUBLIC_NB` / `PUBLIC_PU`；不改变 publish rejection。

### 6. 下游

- **I03-03B2**：解除阻塞；player / graph 行使用 canonical box `(24,204.4,32,48)`，并记录 foot / offset。
- **I03-03C**：复核清单必须包含 anchor `.95` / 分数 foot / body 零容差。
- **I03-04 / I03-05**：几何准入继续通过 B2 / C；不因本裁定直接通过。
- **I03-07**：`temporal-witness.ts` 逐文件白名单 + 受影响测试清单。
