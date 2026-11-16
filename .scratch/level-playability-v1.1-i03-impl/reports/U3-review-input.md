# U3 独立复核输入包

> **本文件只列事实与可复跑命令，不含作者结论 / PASS 声明。**
> 复核人必须自己读 diff、重跑命令、逐项判断。

## 1. 复核对象

| 项 | 值 |
| --- | --- |
| 单元 | U3（contracts `mechanic.ts` gap 替换；temporal 层接管 moving hazard） |
| 授权记录 | `.scratch/level-playability-v1.1-i03-impl/reports/U3-incremental-authorization.md` |
| 单元 brief | `.scratch/level-playability-v1.1-i03-impl/issues/06-i03-impl-u3.md` |
| 授权包 | `docs/v7.8/移动-I03.md` · 签署前 `2f89d572…` / 签署后 `f45332be…` / 当前 `8a8349b1f26f20d08a6c7573875ed5d0a070d240158c183f1b75721b6ecaf917` |
| Base | `7b973a7` |
| Code/test head | `b02b2ce` |
| Code/test diff range | `7b973a7..b02b2ce` |
| 环境 | 见 `evidence/U3/commands.log` |

## 2. 改动文件（code/test diff，3 个）

| 文件 | 操作 |
| --- | --- |
| `packages/contracts/src/playability/mechanic.ts` | 删除 `movingHazards` 与 `moving-hazard-phase` gap；注释改述；`moving-platform-unsupported` 保留 |
| `packages/contracts/tests/playability-mechanic.test.ts` | 旧巡逻断言改写；moving-platform 回归；§U3 temporal takeover |
| `packages/contracts/tests/fixtures/playability-mechanic-matrix.json` | **仅 `wide-patrol` 行** |

只读 / 未修改：`api.ts`、`verdict.ts`、`public-verdict.ts`、U1 / U4 / U5 产品文件、`create-game.ts`、CLI / MCP、其他 fixture 行、`package.json` / lockfile / tsconfig。

## 3. 证据

| 项 | 路径 / 值 |
| --- | --- |
| 证据目录 | `.scratch/level-playability-v1.1-i03-impl/evidence/U3/` |
| 文件 hash | `evidence/U3/SHA256SUMS` |
| 目标测试 | `targeted-test-output.txt` · 1 file / 32 tests · exit 0 |
| 全量测试 | `test-output.txt` · 178 files / 2952 tests · exit 0 · 2 条 vitest-worker 告警（runner 噪声） |
| typecheck / build / deps / links | 各自日志 · exit 0 |
| 不变量 | `invariant-before.txt` / `invariant-after.txt` |
| 回滚演练 | `rollback-drill.log` · 分支 `wayfinder/i03-u3-rollback-drill` · revert `b02b2ce` + `5ecb049` 回 base `7b973a7` · 目标 25 / 全量 2945 · exit 0 |

## 4. 可复跑命令

```bash
pnpm exec vitest run packages/contracts/tests/playability-mechanic.test.ts
pnpm test
pnpm typecheck
pnpm build
pnpm check:deps
pnpm check:links
```

## 5. 复核人必须独立完成

1. 核对授权包 / 授权记录 / brief 的完整 hash；核对 `evidence/U3/SHA256SUMS`。
2. 检查 `7b973a7..b02b2ce` diff 是否**只**落在白名单三文件；`api.ts` / `verdict.ts` / `public-verdict.ts` / U1 / U4 / U5 / CLI / MCP / `create-game.ts` 零 diff；fixture 仅 `wide-patrol` 行变化（其余五行逐字不变）。
3. 逐项检查：
   - `mechanic.ts` 精确删除 `movingHazards` 与 `moving-hazard-phase`；`allHazards` / `staticHazards` / `movingSolids` 保留；`moving-platform-unsupported` 仍在；
   - `wide-patrol`：机制层 `NO_PROVEN_BLOCKER` + `coverage.mechanic="checked"` + evidence 为空；公共层经 `mapPublicVerdict` + `PHASE1_CAPABILITY_GATE` / `ADMISSION` ⇒ IE；
   - applicable + `checked` + `nb-candidate` ⇒ IE；`partial` / `unknown` ⇒ IE；applicable 无 evidence ⇒ `temporal:"unknown"` ⇒ IE；不适用 ⇒ existing 且无 temporal/geometry 字段；
   - 第一阶段 gate `BLOCKED`：nb / pu candidate 均不产公共 NB / PU；
   - synthetic temporal evidence 符合 U1 真实类型、无 `as any`；测试走真实 `mapPublicVerdict`；
   - 公共 IE 上 `playabilityIssues` 为空；temporal evidence 非阻断；
   - 其他 mechanic 语义不变：静止 hazard A、danger B、moving-platform、6 例矩阵其余行；
   - 目标 32 / 全量 2952、`pnpm typecheck` 0、build / deps / links 0；
   - 回滚演练隔离、产品树回 base、目标 25 / 全量 2945，delivery 分支未被污染。
4. 至少 2 条自选关键断言，记录理由与结果。
5. 逐项 `PASS / FAIL / NOT_RUN`；不得用总通过率替代。
6. 写 `reports/U3-review.md`：复核人 / 日期 / 环境、输入与输出 hash、diff scope、逐项结论、命令 / 退出码、未覆盖项、限制、独立签署。

## 6. 权限边界

- 复核报告 PASS **只**表示 U3 证据足以支持该单元。
- 不开放 `PUBLIC_NB` / `PUBLIC_PU`；不授权 probe / fixture 实施；不改变发布闸行为。
- 复核人不得修改产品代码 / 授权包 / 证据；只写复核报告。
