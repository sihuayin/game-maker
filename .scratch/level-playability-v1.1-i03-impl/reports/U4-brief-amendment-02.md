# U4 brief amendment-02：降级路径 publicVerdict 修复

| 项 | 值 |
| --- | --- |
| 记录类型 | U4 修订授权；**独立记录**；不修改已签署授权包正文 |
| 签署人 | **amber** |
| 日期 | **2026-11-17** |
| 触发 | U3 独立复核 FAIL（`reports/U3-review.md` · `sha256:57607f39a67356eb8ba997047bb4722654f4ff39d1715c730f0bab5c0e77163d`） |
| 用户裁定 | 在「修 U4 降级路径（推荐）／显式接受诊断降级／STOP U3」中选择 **修 U4 降级路径** |
| 授权依据 | 已签署 U1–U5；当前授权包 `8a8349b1f26f20d08a6c7573875ed5d0a070d240158c183f1b75721b6ecaf917`；U3 brief §8；授权包 §4.2 / §4.4 / §4.5 / §7.1 / AC-07 |
| 授权范围 | **仅 U4 降级路径修复**（`temporalFailure` 的 `publicVerdict`） |
| 执行分支 | `wayfinder/level-playability-v1.1-i03-u4-amendment-02`，从 `main` @ `7b973a7` |

## 1. 缺陷事实

`packages/assets/src/ops.ts` 的 `temporalFailure(existingAudit, legacy?)` 返回：

```ts
publicVerdict: existingAudit
```

U3 移除 `moving-hazard-phase` gap 后，`wide-patrol` 的 existing 层结果由 IE 变为 `NO_PROVEN_BLOCKER`；当 trusted 输入不可用或真实 analyzer 抛错时，降级报告因此出现：

- `coverage: "unknown"`
- `evidence: []`
- `publicVerdict.verdict: "NO_PROVEN_BLOCKER"`

这违反授权包 §4.2（temporal 缺失 ⇒ `unknown` ⇒ IE）、§4.4 / §4.5（gate `BLOCKED`、含移动 Hazard ⇒ IE）、§7.1（捕获失败 ⇒ unknown / IE）与 AC-07。

## 2. 允许文件（逐文件）

| 文件 | 操作 |
| --- | --- |
| `packages/assets/src/ops.ts` | 修改：`temporalFailure` 的 `publicVerdict` 改用 `mapPublicVerdict({ existing: existingAudit, temporal: { applicable: true }, gate: PHASE1_CAPABILITY_GATE, admission: PHASE1_CAPABILITY_ADMISSION })`；legacy `verdict` / `degradation` 字段与兜底 catch 不变 |
| `packages/assets/tests/ops.test.ts` | 修改：补 trusted 失败 / analyzer 抛错且 existing NB ⇒ publicVerdict IE、coverage unknown、evidence [] 的回归 |

- **不修改**：`publish-gate.ts` / contracts / CLI / MCP / `create-game.ts` / U1 / U2 / U3 产品文件 / fixtures / 新依赖 / 授权包正文。
- U3 分支在本修订合入后需 merge `main`、刷新证据并重新复核，不另开 U3 授权。

## 3. 验收与复核

- 目标测试：`packages/assets/tests/ops.test.ts`（含新增回归）。
- 全量 `pnpm test` + `pnpm typecheck` + `pnpm build` + `pnpm check:deps` + `pnpm check:links`。
- 证据：`evidence/U4-amendment-02/`（commands / targeted / full / invariant / rollback drill / SHA-256）。
- fresh 独立复核：`reports/U4-amendment-02-review.md`；逐项 `PASS / FAIL / NOT_RUN`。
- **必须回滚演练**：隔离 drill 分支 revert 修复，目标测试 + 全量通过。
- 用户签署后合并；Ledger §12.2 U4 行追加 amendment-02 说明（docs-only）。

## 4. 明确不放行

- U3 签署 / 合并 / Ledger（待本修订完成并重新复核后另行推进）。
- 能力开放；`PUBLIC_NB` / `PUBLIC_PU`；gate 变更；probe / fixture 实施。
- 白名单外文件、新依赖、`.scratch` 证据进入产品 PR。
