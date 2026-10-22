# 07. P0-01 · 运行时胜利判定与危险物软锁

Type: task
Status: resolved
Owner: main session · 2026-10-21
Blocked by: 06
Map: ../map.md

## Question

修两个直接命中 P0 定义的运行时缺陷。对应 `CAP-SPEC-01` / `CAP-RUNTIME-01`，
范围见 `docs/v4/P0-00-p0-scope.md` §3 P0-01；物理事实以票 06 的结论为准。

1. **胜利绑定只认 `GameConfig.objective.gate` 指向的实体**：其他 `kind:"goal"` 实体不再绑
   `tryWin()`；`objective.gate` 不再是「赋值后从未读」。
2. **`hitHazard()` 重置时同步物理体**：位置、速度、`body.reset()` / 等价手段，
   并保证重置点在可站立位置；重复重置不累积下沉。
3. 测试：两 goal 只有 gate 赢；单 goal 旧 config 行为不变；W6「木箱顶起跳 → 空中撞 hazard → 重置」
   序列可恢复；gate 指向不存在 id 时上游校验仍拒绝。

## 验收

- `CAP-SPEC-01`：两个 goal 的测试**在旧代码上失败、新代码通过**（记录红→绿证据）。
- `CAP-RUNTIME-01`：复现序列不再掉穿；有自动化测试（或票 10 smoke 的对应用例）；
  重置后玩家在地面以上、可继续移动并完成核心循环。
- `pnpm test` / `pnpm typecheck` 全绿；零付费。

## 边界

- 不新增 `GameConfig` 字段；不实现 HP / 失败态 / 多关；不改变 `entities[].kind` 枚举；
  不改变 `objective.kind`；不改变危险物运动轨迹（`advanceHazards` 语义不变）。
- 若票 06 表明只能靠浏览器验证，本票仍需一条纯逻辑 / 外壳级测试钉住「只有 gate 能赢」。
- 不改 v7 包与 `fixtures/`；不提交。

## 产出

`## Answer`：改动 `path:line`、红→绿证据、测试文件名与用例数、票 06 结论的采用情况。

## Answer

**已收口（施工）** —— 两个缺陷均修复，程序级判据全绿；真实「重置后不掉穿」的行为证据按票 06 §6.3 归票 10 的 CDP smoke。

### 1. 胜利只认 `objective.gate`

- 纯层把「哪个 goal 算赢」变成数据：`EntityDesc.wins`，只有 `kind === "goal" && id === objective.gate` 为真
  （`packages/demo/src/world.ts:177`）。其他 `kind:"goal"` 实体照画，但不参与判定。
- 外壳只在 `e.wins` 上注册 `tryWin()`（`packages/demo/src/shell/scene.ts:162`）——
  「选哪个 goal」是 `buildWorld` 的裁决，壳只铺开。
- `objective.gate` 悬空的既有上游校验不变：`packages/contracts/tests/game-config.test.ts:129`；
  纯层同时断言此时没有任何实体被标记 `wins`。

### 2. `hitHazard()` 同步物理体

- 按票 06 的根因与推荐序列：`body.reset(x, y)`（连 GameObject、body、`prev/prevFrame` 一起摆，
  清 velocity/acceleration 与碰撞标志），再用**重置后真实的 `body.bottom`** 对纯层算出的 `floorY`
  做第二次 `reset` 校正脚线（`packages/demo/src/shell/scene.ts:275-282`）。
  不再出现 `setPosition` / `setVelocity`。
- `PlayerDesc.floorY` 由纯函数 `floorYOf` 给出（`packages/demo/src/world.ts:105`）：
  玩家盒底 → 地形与静态 `solid` 的顶边（排除带 `motion` 与 `draw.missing` 的 solid —— 后者在外壳里没有碰撞体）；
  允许 4px 浅埋（`OVERLAP_BIAS`）；脚下无落点时退回作者脚线（显式兜底，注释写明）。
- 输入全部是不可变数据 ⇒ 重复重置逐像素相同，不累积下沉。

### 3. 测试

- `packages/demo/tests/world.test.ts:257`：9 条 —— 单 goal 行为不变、两个 goal 只有 gate 赢、
  gate 改指向另一个 goal、悬空 gate、last-train 锚点抬回地面、箱顶落点、画不出来的 solid 不当落点、
  4px 浅埋抬回、坑兜底。
- `packages/demo/tests/shell-scene-wiring.test.ts:43`：2 条源码见证 —— `wins` 守卫在 `tryWin()` 注册之前；
  `hitHazard` 含 `reset` + `floorY`，不含 `setPosition` / `setVelocity`。
- **红 → 绿**：把两个源文件临时换回 `HEAD`（备份 + 立即恢复），11 条新用例**全部红**（exit 1，11 failed / 25 passed）；
  新代码 36/36 绿。

### 验证

`pnpm test` 1755 passed / 113 files（exit 0）· `pnpm typecheck` exit 0 · `pnpm build` exit 0 · `pnpm check:deps` exit 0。
零付费、未启动浏览器；未改 `GameConfig` / contracts / CLI / MCP / 依赖 / `fixtures/` / v7 包。

⚠️ **环境事故**：第一次全量跑有 1 条 `ENOSPC`（磁盘 100%）。根因是既有 CLI `accept` 测试每次泄漏一个
~89 MB 的 `gm-cli-accept-findings-*` 临时目录；清理 41 个既有泄漏（1.8 GB）后重跑全绿。
该测试卫生问题不在 P0 范围，未修，已记入地图 Notes 的「既有问题」。

### 诚实边界

- 纯层 + 源码见证只证明**实现选对了**，不证明运行时真的不掉穿（票 06 §6.2）。
  **票 10 必须加 W6 用例**：木箱顶起跳 → 空中撞 hazard → 重置后 `body.bottom <= floorY + 1`、
  `onFloor` 为真、连续两次重置脚线相同。
- `WorldDescription` 新增 `wins` / `floorY` 两个字段，属于 demo 包纯层导出的内部类型，
  **不是 `contracts` 契约变更**，按 Q5 无需另行报批。

### 证据

`runs/2026-10-21-ticket-07/`（`summary.md` · red/green/full-test/typecheck/build/check-deps 日志与退出码）
