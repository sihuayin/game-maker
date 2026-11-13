# U5-08 白名单审计与完成报告 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u5` |
| base | `b41f076`（i02，含 U1–U4） |
| 审计时 HEAD | `3b9f732`（U5-07；本票 docs 提交前） |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未变） |
| 实现票 | [U5-08](../issues/09-u5-08-audit-report.md) |

## 产品 diff（`b41f076..HEAD -- packages docs fixtures`）

```text
M packages/contracts/src/playability/temporal.ts
M packages/contracts/src/playability/temporal-budget.ts
M packages/contracts/src/playability/temporal-evasion.ts
M packages/contracts/src/playability/temporal-witness.ts
M packages/contracts/tests/playability-temporal-budget.test.ts
M packages/contracts/tests/playability-temporal-fixtures.ts
A packages/contracts/tests/playability-temporal.test.ts
```

| 文件 | 改动 | 归属 / 理由 | sha256（HEAD） |
| --- | --- | --- | --- |
| `temporal.ts` | +773 / −3 | U5-01 组装、U5-02 原因映射、U5-04 双档合并、U5-05 two-lag 入口 | `6df8475822717d7e06a611e2e539785a3f8c9f67719e93d07e03d6373ef7ce53` |
| `temporal-budget.ts` | +3 / −0 | U5-02 `maxBranching` 非安全整数 ⇒ overflow | `d84bdfc96068325692fb8635317540a21b834bd5b43d364afe1c56efb4746992` |
| `temporal-evasion.ts` | +52 / −6 | U5-02 `maxHopSamples` 生效与结构下限降级 | `8712da87e6e08e37e3c437106ee8f4b28707b51cee4522ceb1fb2f9b4799d773` |
| `temporal-witness.ts` | +13 / −1 | U5-02 单次 cut 预算映射为 `BudgetStop` | `aa8f17e7f92cfacc66e231c9eb1e0b219fc9bb7fbccb517a433bcc969594e607` |
| `playability-temporal-budget.test.ts` | +71 / −0 | U5-02 预算闭合测试 | `c9a38ef6ea50f70c23eadd15c9397b47ce070d4ae75a531798d19ffe9e33e44c` |
| `playability-temporal-fixtures.ts` | +11 / −0 | `TEST_ONLY` `trustedInputFixture`（U5-01） | `3c3f2af9ddb870efbe57054f59713e6da1f0bc29a99172089182be82f72eac2c` |
| `playability-temporal.test.ts` | 新建 1059 行 | U5-01 / U5-03 / U5-04 / U5-05 测试 | `60adeba1fe2dc16c1f4fc8ced4419e527607e072c9f506e0259126a91827679a` |

- `temporal-result.ts` / `temporal-gate.ts` / `temporal-motion.ts`：**零 diff**（F 裁定选择 `none`，未改 D9 类型）。
- `graph.ts` / `reach.ts` / `profile.ts` / `targets.ts` / `game-config.ts` / `geometry.ts` / `spatial.ts` / `completion.ts` / `mechanic.ts` / `api.ts` / `assets/ops.ts`：**零 diff**。
- `packages/pipeline` / `packages/cli` / `packages/mcp` / `packages/demo`：**零 diff**。
- `fixtures/packs/**` / `docs/**`：**零 diff**。
- `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` / `packages/contracts/package.json`：**零 diff**。
- 新增产品 JSON：**无**（新增 JSON 只在 `.scratch` 证据目录）。
- 公共 barrel：`packages/contracts/src/playability/index.ts` / `packages/contracts/src/index.ts` **零 diff**；`analyzeTemporalInternal` / `resolveTwoLagInternalResults` / `analyzeTemporalInternalTwoLag` / `TemporalTwoLagInternalResult` **均不在 barrel 或 `api.ts`**。
- 结论：产品改动**严格落在授权包 §5.2 白名单**；无新增依赖 / fixture / 公共导出。

## 架构断言

命令：`pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose`

| 断言 | 结果 |
| --- | --- |
| T-55 contracts 源码不含 `node:fs` / `node:crypto` | ✓ |
| T-57 `auditPlayabilityTemporal` 生产调用者只有 `ops.ts` | ✓ |
| T-58 生产 `analyze` 实参只有 `stubTemporalAnalyzer` | ✓ |
| T-61 三处生产接线各至少一次 | ✓ |
| T-62 常量唯一且不复用 `FRAME_MARGIN_MS` | ✓ |
| T-64 brand `Symbol` 只在 `temporal-input.ts` 铸造 | ✓ |
| 合计 | **65 / 65 passed** |

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `playability-temporal-input.test.ts --reporter=verbose` | **0** | 65 / 65 |
| `pnpm test` | **0** | **176 files / 2877 tests passed**；2 条 `onTaskUpdate` RPC 超时（工具层，非断言失败） |

原始输出：`08-{build,typecheck,architecture,test}.log`（本地保留，不入库）。

| 日志 | sha256 |
| --- | --- |
| `08-build.log` | `aad08a01d1f1f84719f3ff7c5a166da726261b582c7cffcfbe441f3b02d61bb5` |
| `08-typecheck.log` | `97c638b9f15a18ee4f0c74bbddd9e32eff630a77a2b3c1bc8bcadf100b47cd95` |
| `08-architecture.log` | `3326cf0a6ac0893bd84f2f33503503cb89dafac6ef5dc54f28b15374b978062b` |
| `08-test.log` | `7bb78c591e7e24b71763409bba0137576e9e8c894e0a11502b5cbd99510665cb` |

## 交付物

- 完成报告（唯一权威）：`.scratch/level-playability-v1.1-i02/reports/U5-completion.md`（本票创建）
- 最终审计输入包：`.scratch/level-playability-v1.1-u5/reports/09-audit-input-package.md`（本票创建）
- Draft PR 描述：`.scratch/level-playability-v1.1-u5/reports/09-draft-pr.md`（本票创建，**未推送 / 未创建**）
- 本证据：`.scratch/level-playability-v1.1-u5/evidence/08-audit.md`

## 状态

白名单 / 架构 / 全量测试审计完成；最终审计（AC-12 / AC-13）输入就绪。**未推送 / 未建 PR / 未合并。**
