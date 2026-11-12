# I-02 独立增量审批 06 — `graph.ts` `HopSampling` 可选尾参

| 项 | 值 |
| --- | --- |
| 记录类型 | **独立书面增量审批**（D4 §5、D6 §3；独立于 I-00 R2） |
| 审批人 | **amber** |
| 日期 | **2026-11-12** |
| 审批对象 | `packages/contracts/src/playability/graph.ts` @ `sha256:def3fa7132b9142e5f9441f1b5b6f5b6e4d8ef97096bd0db0b2c5b620445e55b` |
| 提案正文 | [`../level-playability-v1.1-u4/evidence/01-graph-approval-proposal.diff`](../level-playability-v1.1-u4/evidence/01-graph-approval-proposal.diff) @ `sha256:3213ecfe85d344a9a3617ed9d648f7000c437f4992edbacf31fd0f463444c62f` |
| 授权上下文 | [05-u4-incremental-authorization.md](./05-u4-incremental-authorization.md)（U4 实施 + R4；`graph.ts` 审批为执行门前置） |
| 结论 | **批准（命名导出 `HopSampling`）** |

## 1. 审批对象与范围

只允许给 `hopSamples` / `hopEdges` / `hopTargets` 增加**可选尾参** `HopSampling = { hz?: number; maxSamples?: number }`。默认 `{ hz: 60, maxSamples: 120 }`。

## 2. 允许面核对（D4 §5 / D6 §3）

| 约束 | 提案是否满足 |
| --- | --- |
| 只动 `hopSamples` / `hopEdges` / `hopTargets` | ✅ 只改这三个导出与一个内部 helper |
| 默认 `{ hz: 60, maxSamples: 120 }` | ✅ 缺省逐项回落；`n = max(6, min(120, ceil(t·60)))` 与原式逐字一致 |
| 不改跳跃公式 | ✅ `t` / `disc` / `dx` / 抛物线公式零改动 |
| 不改既有采样语义 | ✅ 仅把常量 `120` / `60` 换成参数，默认值相同 |
| 不改其他导出 / 调用语义 | ✅ `reachableCells`、`reach.ts:129`、`completion.ts:220` 的 4 参调用不受影响 |
| 不改 `reach.ts` | ✅ 零 diff |
| `reachableCells` 不参数化 | ✅ 未加参数（仅在未来逐项列明时才允许） |
| 回归：显式默认 = 无参 | 计划见 §6，U4-02 落地 |
| 稳定序列化一致 | 计划见 §6 |

## 3. 提案摘要

1. 新增导出类型 `HopSampling`；新增内部常量 `DEFAULT_HOP_SAMPLING` 与 `resolveHopSampling()`。
2. `hopSamples(..., move, sampling?)`：`n = max(6, min(maxSamples, ceil(t·hz)))`。
3. `hopEdges(..., move, sampling?)`：把 `sampling` 透传给 `hopSamples`。
4. `hopTargets(..., move, sampling?)`：把 `sampling` 透传给 `hopEdges`。
5. 无参调用路径与现行实现逐点一致。

逐行 diff：见提案正文（hash 见上表）。

## 4. 明确不改变

- 跳跃弧公式、可达性语义、`hopSamples` 返回的 `Vec[]` 形状与取整规则；
- `reach.ts`（含 mid-air 60Hz 行为）、`completion.ts`、`spatial.ts`；
- `reachableCells` 的签名与行为；
- 任何既有测试文件（`playability-graph.test.ts` 等）。

## 5. 公共面影响（须审批人明确知悉）

- `graph.ts` 被 `packages/contracts/src/playability/index.ts` 以 `export *` 导出 ⇒ 新类型 `HopSampling` 会成为该 **internal barrel** 的可见符号（barrel 文件文本不变）。
- `packages/contracts/src/index.ts` **不**再导出 `playability/index.ts`（只导出 `api.js`）；`package.json` 的 `exports` 只暴露 `.` ⇒ **不新增包根公共导出**。
- 若不希望 `HopSampling` 出现在 `playability/index.ts` 的可见面，备选方案是**内联结构类型**（`sampling?: { hz?: number; maxSamples?: number }`），代价是与 D4 的命名 `HopSampling` 不一致。

## 6. 回归计划（U4-02 执行）

落点：`packages/contracts/tests/playability-temporal-evasion.test.ts`（U4 白名单、**新建**，本 PR 只放默认等价断言）。

1. 无参 vs `{ hz: 60, maxSamples: 120 }`：`hopSamples` / `hopEdges` / `hopTargets` 结果深相等。
2. 单项缺省：`{ hz: 60 }`、`{ maxSamples: 120 }` 与无参深相等。
3. 稳定序列化：上述结果 `JSON.stringify` 逐字节相等。
4. 倍档正常性：`{ hz: 120, maxSamples: 240 }` 在 `t·60 > 6` 的弧上采样数约为默认档 2×（不要求精确 2×）。
5. 既有 `playability-graph.test.ts`（11 tests）与 `playability-temporal-input.test.ts`（65 tests）原样通过。

命令：

```bash
pnpm build
pnpm typecheck
pnpm exec vitest run packages/contracts/tests/playability-graph.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-evasion.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts
pnpm test
```

## 7. 审批边界

- 本审批**独立于 I-00 R2**，不得以「已列入白名单」或「U4 已授权」推定。
- 未获批准并合并前，U4 实施保持 `BLOCKED`。
- 不得用临时改动、测试专用实现、复制实现或其他路径绕过。
- 变更走独立分支、独立 PR；先审批、合并，再由 U4 PR 引用。
- 本 PR 文件面：`packages/contracts/src/playability/graph.ts` + `packages/contracts/tests/playability-temporal-evasion.test.ts`（仅默认等价断言）。
- 超出 `HopSampling` 尾参的任何 `graph.ts` 改动 ⇒ 重新审批。

## 8. 用户结论

```text
审批结论：        [x] 批准（命名导出 HopSampling）
                  [ ] 批准（改用内联结构类型）
                  [ ] 修改后批准 / 拒绝（说明：________________）
审批人：          amber
日期：            2026-11-12
备注：            范围仅 HopSampling 可选尾参；独立 PR 先合并；未合并前 U4 实施保持 BLOCKED。
                  已知悉 HopSampling 会经 playability/index.ts 的 export * 可见（包根不新增导出）。
```

## 9. 生效与失效

- 生效：用户书面结论填写且 `U4-01` 关闭之时。
- 失效：U4 签署完成后耗尽；若实现偏离本提案（超出尾参范围）⇒ 本审批自动失效，回到 U4-01。
