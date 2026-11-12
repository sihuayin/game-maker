# U3 Draft PR 描述（未推送、未创建）

> 本文件只是 Draft PR 文本。U3-07 **不推送、不创建 PR、不合并**。

## Title

`U3: permanent gate half (I02-03)`

## Target

`wayfinder/level-playability-v1.1-i02` ← `wayfinder/level-playability-v1.1-u3`

## Summary

- 新增 `packages/contracts/src/playability/temporal-gate.ts`：`computePermanentGate(...)` 实现 D4 门区半部
  - `gate`：闭式 `L = at + d − anchorX·w`、`R = at + (1−anchorX)·w`、`width = w − d`；`width > ε`；Hazard 与玩家 y 区间严格重叠
  - `periodCoverage`：闭式极值 `at` / `at+d`，两段解析半周期区间
  - `sideRule`：精确 spawn 盒 + `goalRegion = inflate(goalRect, 0.5)`，左右两方向
  - `forbiddenInjection`：原始 `gateRect` 经 `buildGraph` 注入一次，`expandedRect` 记录
- 新增 `packages/contracts/tests/playability-temporal-gate.test.ts`：48 条测试，含 D4 §11 反例 1–4、6、13
- 失败原因只用 D9 闭集 `no-permanent-gate` / `geometry-untrusted`；不新增原因码

## Explicitly out of scope

- `graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure`（U4 / U5）
- 完整 `PermanentGateProof` / `TemporalInternalResult` 组装
- `temporal.ts` / `graph.ts` / `reach.ts` 修改（零 diff）
- 公共 barrel 导出、新依赖、JSON fixture、I-03 接线

## Evidence

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | 0 | `tsc -b` + bundle Done |
| `pnpm typecheck` | 0 | 全 workspace Done |
| `pnpm exec vitest run …playability-temporal-gate.test.ts` | 0 | 48 / 48 passed |
| `pnpm exec vitest run …playability-temporal-input.test.ts` | 0 | 65 / 65 passed |
| `pnpm test` | 0 | 174 / 174 files，2795 / 2795 tests passed；2 条已知 vitest RPC 超时（非断言失败） |

`git diff --name-status c0d6981..HEAD -- packages/ docs/ fixtures/`：

```text
A  packages/contracts/src/playability/temporal-gate.ts
A  packages/contracts/tests/playability-temporal-gate.test.ts
```

## Review gate

R3 独立复核 + 用户签署均通过前，不合并。
