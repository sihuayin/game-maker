# U2-09 修复后回归、审计与 R2 重审输入

Type: task
Status: resolved
Owner: claude (U2-09 audit session 2026-11-12)
Blocked by: 11
Map: ../map.md
Class: U2 / AUDIT

## Task

对 U2-08 的修复做回归与范围审计，更新实现报告并准备 R2 重审输入包。**不推送、不创建 PR、不合并。**

### 必须完成

1. 全量命令：`pnpm build`、`pnpm typecheck`、U2 witness 定向、input 定向、`pnpm test`；记录退出码与计数。若出现环境超时，区分超时与断言失败并至少重跑一次。
2. `git diff 23a2027..HEAD` 逐文件审计：
   - 产品路径仍只允许 U2 白名单 3 文件；
   - 无 U3–U5 / 其它产品文件 / 新依赖 / JSON fixture / barrel 改动；
   - 授权包 SHA `797cd6fc…` 不变。
3. 架构断言 T-55 / T-57 / T-58 / T-61 / T-62 / T-64；新模块无禁用模式；`temporal-witness.ts` 不 import `temporal.ts`。
4. 写 `.scratch/level-playability-v1.1-u2/reports/08-fix-implementation.md`：
   - 修复内容与选择（对称 pad / 精确滑动窗口）；
   - R2 §4.3 反例修复前后的复现结果；
   - 命令、退出码、计数、`git diff --stat`；
   - 白名单核对表、未覆盖项 / 已知限制；
   - “产品目录只改 U2 白名单”声明；
   - R2 重审输入包：首次 R2 FAIL 报告路径、修复 diff / head SHA、命令、证据路径。
   - 不覆盖 `.scratch/level-playability-v1.1-i02/reports/R2-review.md`（首次 FAIL 保留）。
5. 不推送 / 不建 PR / 不合并；不启动 R2 重审。

### 停止条件

- 任一白名单外文件 / 新依赖 / 公共导出 ⇒ STOP；
- 任一架构断言失败 ⇒ STOP；
- 全量测试有断言失败 / 重跑后仍失败 ⇒ 记录 FAIL，票保持 open；
- 需要扩 D9 闭集 / `BudgetProfile` ⇒ STOP + HITL。

### 验收

报告完整；全量测试通过；diff 仍只含 U2 白名单；R2 重审输入包可交付。

## Answer

### 结论：PASS（修复后回归 / 白名单范围 / 架构断言）

审计对象：U2 base `23a2027` → 修复 head `1fe09ef`（U2-08）；本票 claim 提交 `918103b`。
授权包 `docs/v7.8/移动-I02.md` SHA-256 仍为 `797cd6fc…`；首次 FAIL 报告
`.scratch/level-playability-v1.1-i02/reports/R2-review.md` 未修改
（`sha256:2f684568…`）。

### 命令与计数

| 命令 | 退出码 | 计数 |
| --- | --- | --- |
| `pnpm build` | 0 | 全部 workspace 构建 / bundle 完成 |
| `pnpm typecheck` | 0 | 全部 package Done |
| witness 定向 | 0 | **73/73** |
| witness 定向 `-t "R2-FIX"` | 0 | **5 passed / 68 skipped** |
| input 定向 | 0 | **65/65** |
| input 定向 `--reporter=verbose` | 0 | **65/65**（T-55～T-65 逐条 ✓） |
| `pnpm test`（第 1 次） | 0 | **173 files / 2747 tests passed**；`Errors 5`（均为 vitest worker `onTaskUpdate` RPC 超时）；216.86s |
| `pnpm test`（第 2 次复跑） | 0 | **173 files / 2747 tests passed**；`Errors 5`（同上）；195.95s |

两次全量的 `Errors` 全是工具层 `[vitest-worker]: Timeout calling "onTaskUpdate"`：无
`test timed out`、无 `FAIL` / `AssertionError`，测试计数 2747/2747 全过；与 U2-07 / U2-08
已记录的已知环境限制同源，不构成断言失败。

### R2 §4.3 反例（修复前 / 后）

- 修复前：cell 39（`[195,200]`、下降段）单侧向左 pad `8.335` ⇒ padded 盒右缘最大 `12.5`，
  玩家盒 `[14,16]` 不交 ⇒ `verified:true`（与 R2 §4.3 一致）。
- 修复后：对称 pad ⇒ padded 宽度 `26.67`、`anchor.x=0.5`，盒覆盖 `[p−13.335, p+13.335]`，
  玩家盒相交 ⇒ 产品测试断言 `verified:false` / `failure:"hazard"`。
- 独立复算（`evidence/09-r2-section4-repro.log`，直接调用构建产物 `intersectContinuous`）：
  旧 pad 盒无正宽度区间（`verified:true`）；新对称 pad 盒正宽度区间 `[195,200]`
  （`verified:false`）。精确 `∃δ` 见证：`hazardBoxAt(200)` 不重叠、`hazardBoxAt(211.6)`
  正宽度重叠；`[0,16.67]` 每 `0.01ms` 扫描得 367 个碰撞时刻（首个 `δ=13.01`）。
- `lagMs=200` 变体、W/U9 跨折返点 move 边、残差等待整格覆盖、W cell 39 未覆盖：
  对应 5 条 `[R2-FIX]` 测试存在且通过。
- 读代码确认 S2（`:787`）/ 残差等待（`:940-941`）/ U9 停留（`:1601-1604`）共用
  `conservativeLagPad` + `lagPaddedHazardBox`，无第二套方向性 pad。

### diff 范围 / 白名单

`git diff --name-only 23a2027..1fe09ef` 分类：`PRODUCT-WHITELIST 3`（
`temporal-witness.ts` +2604、`playability-temporal-witness.test.ts` +1409、
`playability-temporal-fixtures.ts` +264 纯增）、`SCRATCH-U2 15`、`AUTH-RECORD 2`、
`OUT-OF-SCOPE 0`。无 `packages/demo/**` / `ops.ts` / `graph.ts` / `profile.ts` /
`temporal*.ts`（入口 / 预算 / 结果 / 运动）/ barrel / `package.json` / lockfile /
新依赖 / JSON fixture 改动；`docs/` 零 diff。

### 架构断言

T-55 / T-56 / T-57 / T-58 / T-59 / T-60 / T-61 / T-62 / T-63 / T-64 / T-65 全 PASS
（input verbose 65/65）。新代码 / 测试无 `analyze:` / `auditPlayabilityTemporal(` /
`Symbol(` / `TEMPORAL_LAG_*` / `node:fs` / `node:crypto`；`temporal-witness.ts` 不 import
`temporal.ts`；无公共 barrel 导出；未扩 D9 闭集 / `BudgetProfile`（两者零 diff）。

### 产物

- 报告：`.scratch/level-playability-v1.1-u2/reports/08-fix-implementation.md`
  （含 R2 重审输入包：首次 FAIL 报告路径与 SHA、修复 diff / head、命令、证据路径、
  重审结论落点 `R2-review-rerun.md`）。
- 证据：`.scratch/level-playability-v1.1-u2/evidence/09-*.log`（`*.log` 被忽略）。

### 未覆盖项 / 已知限制

沿用 U2-08 Answer 的 4 条（对称 pad 为保守超集；U9 停留段无可区分失败回归；
无「W/U9 仅由一条跨折返点边 complete→failed」隔离用例；W 编码未绑定 hazard / lag），
以及 R2 §6–§7 的残留风险（W 编码来源绑定、RPC 超时、D9 映射偏宽、未跑真实语料 / 性能）。
R2 §7 第 1 条（lag 跨折返点无测试）已由本次 5 条回归关闭。

### 边界

未推送 / 未建 PR / 未合并；**未启动 R2 重审**；未改 `R2-review.md`。U2 仍未完成，
U2-SIGN 继续被新的独立 R2 重审阻塞。
