# U4 amendment-02 独立复核输入包

> **本文件只列事实与可复跑命令，不含作者结论 / PASS 声明。**

## 1. 复核对象

| 项 | 值 |
| --- | --- |
| 单元 | U4 amendment-02（降级路径 `publicVerdict` 修为 IE） |
| 授权记录 | `.scratch/level-playability-v1.1-i03-impl/reports/U4-brief-amendment-02.md` |
| 触发报告 | `.scratch/level-playability-v1.1-i03-impl/reports/U3-review.md` · `sha256:57607f39a67356eb8ba997047bb4722654f4ff39d1715c730f0bab5c0e77163d` |
| 授权包 | `docs/v7.8/移动-I03.md` · 当前 `8a8349b1f26f20d08a6c7573875ed5d0a070d240158c183f1b75721b6ecaf917` |
| Base | `90eb81c` |
| Code/test head | `ea29cd9` |
| Code/test diff range | `90eb81c..ea29cd9` |

## 2. 改动文件（2 个）

| 文件 | 操作 |
| --- | --- |
| `packages/assets/src/ops.ts` | `temporalFailure` 的 `publicVerdict` 改用 `mapPublicVerdict({ existing, temporal: { applicable: true }, gate, admission })` |
| `packages/assets/tests/ops.test.ts` | trusted 失败 / analyzer 抛错 ⇒ publicVerdict IE + `coverage.temporal="unknown"` + evidence [] |

只读 / 未修改：contracts、`publish-gate.ts`、`create-game.ts`、CLI / MCP、U3 文件、fixtures、授权包。

## 3. 证据

| 项 | 路径 / 值 |
| --- | --- |
| 证据目录 | `.scratch/level-playability-v1.1-i03-impl/evidence/U4-amendment-02/` |
| 文件 hash | `evidence/U4-amendment-02/SHA256SUMS` |
| 目标测试 | 1 file / 21 tests · exit 0 |
| 全量 | 178 files / 2945 tests · exit 0 · 5 条 runner 告警 |
| typecheck / build / deps / links | exit 0 |
| 回滚演练 | `rollback-drill.log` · revert `ea29cd9` + `d8002df` 回 base `90eb81c` · 目标 21 / 全量 2945 |

## 4. 可复跑命令

```bash
pnpm exec vitest run packages/assets/tests/ops.test.ts
pnpm test
pnpm typecheck
pnpm build
pnpm check:deps
pnpm check:links
```

## 5. 复核人必须独立完成

1. 核对授权包 / 授权记录 / U3 FAIL 报告 hash；核对 `evidence/U4-amendment-02/SHA256SUMS`。
2. 检查 `90eb81c..ea29cd9` 只改两文件；其余产品文件零 diff。
3. 逐项检查：
   - `temporalFailure` 不再返回 `existingAudit` 原对象；改用真实 `mapPublicVerdict`，`temporal:{applicable:true}` 无 evidence ⇒ `temporal:"unknown"` ⇒ IE；
   - existing `NO_PROVEN_BLOCKER` + trusted 失败 / analyzer 抛错 ⇒ publicVerdict IE，coverage unknown，evidence []；
   - existing PU / IE 的优先级不被削弱；legacy `verdict` / `degradation` 字段与兜底 catch 不变；
   - 无 `as any`；测试走真实函数；发布闸 / U3 行为不变；
   - 目标 21 / 全量 2945 / typecheck / build / deps / links；
   - 回滚演练隔离、回 base、21 / 2945。
4. 至少 2 条自选关键断言。
5. 逐项 `PASS / FAIL / NOT_RUN`。
6. 写 `reports/U4-amendment-02-review.md`：复核人 / 日期 / 环境、hash、diff scope、逐项结论、命令 / 退出码、限制、独立签署。

## 6. 权限边界

- PASS 只表示 amendment-02 证据足以支持该修复；不授权 U3 合并、不开放能力、不授权 probe/fixtures。
