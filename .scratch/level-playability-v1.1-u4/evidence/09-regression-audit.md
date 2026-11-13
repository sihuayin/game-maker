# U4-09 回归 / 白名单审计 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u4` @ `d14481c` |
| U4 diff 范围 | `b884a35..d14481c` |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（复算一致） |

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| evasion 定向 | **0** | 36 / 36 |
| gate 回归 | **0** | 48 / 48 |
| graph 回归 | **0** | 11 / 11 |
| temporal-input（verbose） | **0** | 65 / 65 |
| `pnpm test` | **0** | **175 files / 2831 tests passed**；2 条 `onTaskUpdate` RPC 超时（工具层，非断言失败） |

原始输出：`09-{build,typecheck,evasion,gate,graph,architecture,test}.log`（本地保留，不入库）。

## 白名单审计

```text
A packages/contracts/src/playability/temporal-evasion.ts
M packages/contracts/tests/playability-temporal-evasion.test.ts
```

- `graph.ts`：`13b4e3b..HEAD` 零 diff（只来自 PR #37）。
- `temporal.ts` / `reach.ts` / `docs/` / `fixtures/`：零 diff。
- 依赖 / 锁文件 / `*.json`：零 diff。
- 公共 barrel：`playability/index.ts` 与 `src/index.ts` 均不含 `temporal-evasion`。

## 架构断言（T-55 / T-57 / T-58 / T-61 / T-62 / T-64）

全部 ✓（verbose 输出逐条见 `09-architecture.log`）。

## 文件 hash

| 文件 | sha256 |
| --- | --- |
| `temporal-evasion.ts` | `09ca8c5907ed5e530f4c2395ed5854bfc90336f8e797518aed6fb28e499fe54f` |
| evasion 测试 | `3839288b33fe623b9c3f420767c6b92b741729fee1bc494f70078013ecc30817` |
| fixtures | `20b56290fbb76a978a849422fa91fcf1573426172c2d186f75889fc1c2a2b481` |
| `graph.ts` | `85346d6fdada472c4e35bc2574d85fd42ad3bb3145fa09950940cef98e0228b0` |
| 授权包 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |

## 交付物

- 实现报告：[`../reports/09-implementation.md`](../reports/09-implementation.md)
- R4 输入包：[`../reports/09-r4-input-package.md`](../reports/09-r4-input-package.md)
- Draft PR 描述：[`../reports/09-draft-pr.md`](../reports/09-draft-pr.md)（**未推送、未创建**）

## 状态

R4 复核已 unblocked；R4 报告落 `.scratch/level-playability-v1.1-i02/reports/R4-review.md`。U4-09 未推送 / 未建 PR / 未合并。
