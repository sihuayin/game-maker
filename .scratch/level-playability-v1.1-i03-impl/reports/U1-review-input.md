# U1 独立复核输入包

> **本文件只列事实与可复跑命令，不含作者结论 / PASS 声明。**
> 复核人必须自己读 diff、重跑命令、逐项判断。

## 1. 复核对象

| 项 | 值 |
| --- | --- |
| 单元 | U1（contracts 公共 temporal 类型 + 纯适配器） |
| 授权记录 | `.scratch/level-playability-v1.1-i03-impl/reports/U1-incremental-authorization.md` |
| 单元 brief | `.scratch/level-playability-v1.1-i03-impl/issues/02-i03-impl-u1.md` |
| 授权包 | `docs/v7.8/移动-I03.md` · 签署前 `2f89d572…` / 签署后 `f45332be…` |
| 独立审查报告 | `.scratch/level-playability-v1.1-i03/reports/I03-review.md` · `40af4b4b…` |
| Base | `c432409` |
| Code/test head | `25e8d78` |
| Code/test diff range | `c432409..25e8d78` |
| 环境 | 见 `evidence/U1/commands.log`（OS / Node / pnpm） |

## 2. 改动文件（code/test diff）

| 文件 | 操作 |
| --- | --- |
| `packages/contracts/src/playability/verdict.ts` | 公共 temporal 类型 + coverage / witness / evidence 加法字段 |
| `packages/contracts/src/playability/temporal-evidence.ts` | 纯适配器 |
| `packages/contracts/src/playability/api.ts` | U1 导出 + U4 所需 internal 入口 |
| `packages/contracts/tests/playability-temporal-evidence.test.ts` | 新增：适配器矩阵 |
| `packages/contracts/tests/playability-api.test.ts` | U1 API / 非时序回归 |

只读 / 未修改：`temporal.ts`、`temporal-result.ts`、`graph.ts`、`profile.ts`、`ops.ts`、`publish-gate.ts`、`mechanic.ts`、fixtures。

## 3. 可复跑命令

```bash
pnpm exec vitest run packages/contracts/tests/playability-temporal-evidence.test.ts packages/contracts/tests/playability-api.test.ts
pnpm test
pnpm build
pnpm check:deps
pnpm check:links
```

退出码与输出摘要见 `evidence/U1/commands.log`、`evidence/U1/test-output.txt`、`evidence/U1/targeted-test-output.txt`。

## 4. 不变量输入

- `evidence/U1/invariant-before.txt`：base `c432409` 的 `publicCapability` / `publicResult` 与文件 hash。
- `evidence/U1/invariant-after.txt`：工作树的同一检查 + `temporal.ts` / `temporal-result.ts` 零 diff。
- 复核人应自行复算并比较，不以本文件或 before/after 文件作为 PASS 依据。

## 5. 复核人必须独立完成

1. 现场核对授权包 / 审查报告 / U1 授权记录 hash（完整 hash，不只前缀）。
2. 检查 `c432409..25e8d78` 的 code/test diff 是否逐文件落在 U1 白名单；`temporal.ts` / `temporal-result.ts` / 产品调用点零 diff。
3. 逐项检查：
   - 20 个 D9 码 → 13 个公共值完整覆盖；未知码不原样透传；
   - `secondary` 去重 + 字典序；`COMPLETE` ⇒ null / []；
   - `coverage.temporal` checked / partial / unknown；`lag-disagreement` + 两档 complete 的边界；
   - `perLag` 恰好两项、顺序、lagMs、不含 witness；
   - `limits`、`hopSamplesChecked=0`、不冒充 `maxHopSamples`；
   - 公共输出不含完整 proof / Witness / Stats / 内部专用原因码；
   - 非时序 evidence 不携带 `model/lag/degradation/limits`；
   - 输入不可变；`assetId` 有/无；invalid lag ⇒ RangeError；
   - `PlayabilityWitness` temporal 变体、`certificate.kind="none"` ⇒ INCOMPLETE。
4. 至少 2 条自选关键断言，记录理由与结果。
5. 逐项 `PASS / FAIL / NOT_RUN`；不得用总通过率替代。
6. 写 `reports/U1-review.md`：复核人 / 日期 / 环境、输入与输出 hash、diff scope、逐项结论、命令 / 退出码、未覆盖项、限制、独立签署。

## 6. 权限边界

- 复核报告 PASS **只**表示 U1 证据足以支持该单元。
- 不授权 U2 / U4 / U5 / U3，不开放 `PUBLIC_NB` / `PUBLIC_PU`，不设置 `coverage.geometry`，不授权 probe / fixture 实施。
- 复核人不得修改产品代码 / 授权包 / 证据；只写复核报告。
