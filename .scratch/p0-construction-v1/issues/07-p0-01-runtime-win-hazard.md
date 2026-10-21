# 07. P0-01 · 运行时胜利判定与危险物软锁

Type: task
Status: open
Owner: —
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
