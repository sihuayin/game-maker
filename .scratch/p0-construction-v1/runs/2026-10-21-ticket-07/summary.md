# 票 07 证据：P0-01 运行时胜利判定与危险物软锁

- 日期：2026-10-21 · 零付费 · 未启动浏览器
- 对应票：`issues/07-p0-01-runtime-win-hazard.md`；物理事实：`research/phaser-body-reset.md`
- 结论：**程序级判据全绿**；真实不掉穿的行为证据按票 06 §6.3 归票 10 的 CDP smoke。

## 改动（4 个文件）

| 文件 | 改动 |
|---|---|
| `packages/demo/src/world.ts:43,59,105,177,203` | `EntityDesc.wins`（只有 `id === objective.gate` 的 goal 为真）· `PlayerDesc.floorY`（可站立地面顶边，`floorYOf` 纯函数） |
| `packages/demo/src/shell/scene.ts:158-165,275-282` | goal 只在 `e.wins` 上注册 `tryWin()`；`hitHazard` 改 `body.reset(x,y)` + 按 `body.bottom` 对 `floorY` 二次校正 |
| `packages/demo/tests/world.test.ts:257` | 9 条纯层用例（胜利绑定 4 + 可站立点 5） |
| `packages/demo/tests/shell-scene-wiring.test.ts:43` | 2 条外壳见证用例（`wins` 守卫在 `tryWin()` 之前；`reset` + `floorY`，无 `setPosition` / `setVelocity`） |

未改：`GameConfig` / `contracts` / CLI / MCP / 依赖 / `fixtures/` / v7 包。

## 红 → 绿

红运行：把 `world.ts` / `scene.ts` 临时换回 `HEAD`（`git show HEAD:…`），保留新测试，跑完立即恢复。

| 运行 | 命令 | exit | 结果 | 日志 |
|---|---|---|---|---|
| 红 | `pnpm vitest run packages/demo/tests/world.test.ts packages/demo/tests/shell-scene-wiring.test.ts --reporter=verbose` | **1** | **11 failed / 25 passed** | `red-demo-tests.log` · `red-demo-tests.exit` |
| 绿 | 同一条命令 | **0** | **36 passed** | `green-demo-tests.log` · `green-demo-tests.exit` |

11 条新用例**全部**在旧代码上红，无「恒真」用例。

## 全量验证

| 命令 | exit | 结果 | 日志 |
|---|---|---|---|
| `pnpm test --reporter=dot` | 0 | 1755 passed / 113 files（票 02 后 1744 + 本票 11） | `full-test.log` · `full-test.exit` |
| `pnpm typecheck` | 0 | 全 workspace + shell tsconfig | `typecheck.log` · `typecheck.exit` |
| `pnpm build` | 0 | tsc -b + 各包 bundle | `build.log` · `build.exit` |
| `pnpm check:deps` | 0 | — | `check-deps.log` · `check-deps.exit` |

⚠️ **环境事故（非本票代码问题）**：第一次全量 `pnpm test` 有 1 条 `ENOSPC`（`/var/folders/...` 磁盘 100%）。
根因是本仓 CLI 测试每次运行泄漏一个 ~89 MB 的 `gm-cli-accept-findings-*` 临时目录（`mkdtempSync` 后不清理）；
清理 41 个既有泄漏目录（1.8 GB）后重跑全绿。**本票不修该测试卫生问题**（不在 P0 范围），已记录给后续。

## 诚实边界

- **纯层与见证证明「选对了实现」，不证明「运行时真的不掉穿」**（票 06 §6.2/§6.3）。
  票 10 必须加 W6 CDP 用例：重置后 `body.bottom <= floorY + 1`、`onFloor` 为真、重复两次脚线相同。
- `floorYOf` 的兜底：脚下无地形 ⇒ 退回作者脚线（显式注释）；带 `motion` 或 `draw.missing` 的 solid 不当落点
  （后者在外壳里没有碰撞体）。
- `WorldDescription` 新增两个字段（demo 纯层导出的内部类型），不是 `contracts` 契约变更；按 Q5 无需另行报批。
