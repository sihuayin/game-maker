# U4-02 `graph.ts` 尾参实现与默认行为回归 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-12 |
| 独立分支 | `wayfinder/level-playability-v1.1-u4-graph-hop` |
| 分支 base | `wayfinder/level-playability-v1.1-i02` @ `c0d6981`（PR 目标基点） |
| 本地 commit | `13b4e3b`（`U4-02: graph.ts HopSampling tail param and default regression`） |
| 推送 / PR | **无**（U4-03 才可在明确指令下执行） |
| `graph.ts` 变更前 SHA-256 | `def3fa7132b9142e5f9441f1b5b6f5b6e4d8ef97096bd0db0b2c5b620445e55b` |
| `graph.ts` 变更后 SHA-256 | `85346d6fdada472c4e35bc2574d85fd42ad3bb3145fa09950940cef98e0228b0` |
| 新测试文件 SHA-256 | `4152a720378a6e3c38986c97786178a8ea17960129e6506f425f58f8aeef80f2` |

## 改动面（白名单审计）

```text
 M packages/contracts/src/playability/graph.ts
?? packages/contracts/tests/playability-temporal-evasion.test.ts
```

- `reach.ts` / `temporal.ts` / docs / fixtures / 其他产品文件：**零 diff**。
- 未改跳跃公式、既有采样语义、其他导出或调用语义。
- `reachableCells` 未参数化。
- 实现与 U4-01 批准的提案一致（命名导出 `HopSampling`）。

## 回归断言（5 条）

`packages/contracts/tests/playability-temporal-evasion.test.ts`：

1. 夹具起点至少一条跳跃弧；
2. `hopSamples` 无参 ≡ 显式 `{60,120}` ≡ `{hz:60}` ≡ `{maxSamples:120}`；
3. `hopEdges` / `hopTargets` 显式默认与无参一致；
4. 默认档结果稳定序列化（重复调用逐字节一致）；
5. 倍档 `{120,240}` 在长弧上采样更密、端点不变（不要求精确 2×）。

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `pnpm exec vitest run …/playability-graph.test.ts` | **0** | 1 file / **11 tests passed** |
| `pnpm exec vitest run …/playability-temporal-evasion.test.ts` | **0** | 1 file / **5 tests passed** |
| `pnpm exec vitest run …/playability-temporal-input.test.ts` | **0** | 1 file / **65 tests passed** |
| `pnpm test` | **0** | **174 files / 2752 tests passed** |

> 计数说明：graph-hop 分支基于 `c0d6981`（i02，未含 U3），因此全量为 2752（基线 2747 + 新增 5）；U3 的 48 条 gate 测试不在本分支。

原始输出：`02-{build,typecheck,graph,evasion,architecture,test}.log`（本地保留，不入库）。

## 状态

实现与本地回归完成，**未推送**。U4 执行门仍 `BLOCKED`，直到 U4-03 在用户明确指令下合并该独立 PR。
