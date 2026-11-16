# U2 独立复核输入包

> **本文件只列事实与可复跑命令，不含作者结论 / PASS 声明。**
> 复核人必须自己读 diff、重跑命令、逐项判断。

## 1. 复核对象

| 项 | 值 |
| --- | --- |
| 单元 | U2（contracts 能力门 + 公共 Verdict 映射） |
| 授权记录 | `.scratch/level-playability-v1.1-i03-impl/reports/U2-incremental-authorization.md` |
| 单元 brief | `.scratch/level-playability-v1.1-i03-impl/issues/03-i03-impl-u2.md` |
| 授权包 | `docs/v7.8/移动-I03.md` · 签署前 `2f89d572…` / 签署后 `f45332be…` |
| 独立审查报告 | `.scratch/level-playability-v1.1-i03/reports/I03-review.md` · `40af4b4b…` |
| Base | `848dedb` |
| Code/test head | `8a81f62` |
| Code/test diff range | `848dedb..8a81f62` |
| 环境 | 见 `evidence/U2/commands.log`（OS / Node / pnpm） |

## 2. 改动文件（code/test diff）

| 文件 | 操作 |
| --- | --- |
| `packages/contracts/src/playability/public-verdict.ts` | 新增：能力门 + 公共 Verdict 映射 + 第一阶段常量 + 冲突异常 |
| `packages/contracts/src/playability/api.ts` | 修改：U2 `@internal` 导出 + `isBlocking` 排除 `PLAYABILITY_TEMPORAL_EVIDENCE` |
| `packages/contracts/tests/playability-public-verdict.test.ts` | 新增：U2 矩阵 |

只读 / 未修改：`verdict.ts` / U1 adapter / `temporal.ts` / `temporal-result.ts` / `ops.ts` / `publish-gate.ts` / `mechanic.ts` / fixtures。

**`api.ts` 私有改动事实**：`isBlocking` 由 `!SPATIAL_NON_BLOCKING.has(id)` 改为 `id !== "PLAYABILITY_TEMPORAL_EVIDENCE" && !SPATIAL_NON_BLOCKING.has(id)`；既有 evidence id 的阻断映射不变，新增 temporal evidence 非阻断。复核人应独立判断这是否符合授权包 §4.6。

## 3. 可复跑命令

```bash
pnpm exec vitest run packages/contracts/tests/playability-public-verdict.test.ts
pnpm test
pnpm build
pnpm check:deps
pnpm check:links
```

退出码与输出摘要见 `evidence/U2/commands.log`、`evidence/U2/test-output.txt`、`evidence/U2/targeted-test-output.txt`。

## 4. 不变量输入

- `evidence/U2/invariant-before.txt`：base `848dedb` 的 `publicCapability` / `publicResult`、文件 hash、旧 `isBlocking`。
- `evidence/U2/invariant-after.txt`：工作树同一检查、`temporal.ts` / `temporal-result.ts` 零 diff、`api.ts` diff。
- 复核人应自行复算并比较，不以 before/after 文件作为 PASS 依据。

## 5. 复核人必须独立完成

1. 现场核对授权包 / 审查报告 / U2 授权记录完整 hash；核对 `evidence/U2/SHA256SUMS`。
2. 检查 `848dedb..8a81f62` 的 code/test diff 是否逐文件落在 U2 白名单；U1 / U4 / U5 / U3 文件零 diff。
3. 逐项检查：
   - gate / admission 双重检查；NB / PU 独立；`OPEN` ≠ admission；
   - existing PU / IE 优先级；not applicable；missing / partial / unknown；checked + candidate；
   - NB / PU candidate 的 BLOCKED / OPEN+admitted / OPEN+未准入；
   - 冲突：existing PU + **NB 或 PU** candidate + 对应 gate OPEN + admitted ⇒ `PublicVerdictConflictError`；gate OPEN + admission false 不冲突；摘要不含原始 D9；
   - evidence 替换旧 temporal、只追加一次、applicable:false 也移除、无 mutation；
   - coverage 三维取 existing；temporal / geometry 语义；缺 evidence 不伪造 geometry；不沿用旧 temporal geometry；
   - `playabilityIssues` 既有 evidence 映射不变；temporal evidence 非阻断；
   - 第一阶段常量冻结；U2 导出可用。
4. 至少 2 条自选关键断言，记录理由与结果。
5. 逐项 `PASS / FAIL / NOT_RUN`；不得用总通过率替代。
6. 写 `reports/U2-review.md`：复核人 / 日期 / 环境、输入与输出 hash、diff scope、逐项结论、命令 / 退出码、未覆盖项、限制、独立签署。

## 6. 权限边界

- 复核报告 PASS **只**表示 U2 证据足以支持该单元。
- 不授权 U4 / U5 / U3，不开放 `PUBLIC_NB` / `PUBLIC_PU`，不授权 probe / fixture 实施。
- 复核人不得修改产品代码 / 授权包 / 证据；只写复核报告。
