# U3 / R3 输入包（供独立复核会话使用）

> 本包只提供**复核输入**：白名单、验收表、证据路径、测试命令与必要原始输入。
> 它**不包含**作者结论；所有验收项一律留空，由复核人自行判定 `PASS` / `FAIL` / `NOT_RUN`。

## 1. 复核对象

| 项 | 值 |
| --- | --- |
| 单元 | U3（I02-03：永久门区证明） |
| 授权记录 | [`.scratch/level-playability-v1.1-i02/reports/04-u3-incremental-authorization.md`](../../level-playability-v1.1-i02/reports/04-u3-incremental-authorization.md) |
| 授权包 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |
| base | `wayfinder/level-playability-v1.1-i02` @ `c0d6981170967f0145a26901425835dd8df7ba1e` |
| diff 范围 | `c0d6981..<R3 复核时 HEAD>`（复核人自行 `git rev-parse HEAD` 固定） |
| 正式报告落点 | `.scratch/level-playability-v1.1-i02/reports/R3-review.md` |

## 2. 白名单与文件 hash（复核时现场复算）

| 文件 | 性质 | sha256（U3-07 时点） |
| --- | --- | --- |
| `packages/contracts/src/playability/temporal-gate.ts` | 新增（U3） | `03ec5ef656815028afb9ef5bb7b9d19b5f7e02e1b63a7c095721d2eebf9913a2` |
| `packages/contracts/tests/playability-temporal-gate.test.ts` | 新增（U3 / R3） | `3303b7f25468f713e5c0b9d8dc049e57f4652b67c1db606bb93087689035d58d` |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | 既有 `TEST_ONLY` | 本单元未修改（`git diff` 应为空） |

期望：产品路径 diff **只有**上表前两个新增文件；`temporal.ts` / `graph.ts` / `reach.ts` / `docs/` / `fixtures/` 零 diff；无新依赖、无锁文件变更、无 JSON fixture、无公共 barrel 导出。

## 3. R3 验收表（复核人逐项填写）

来源：授权包 §9.3；另加输出边界与范围项。

| # | 验收项 | 通过条件 | 结论 |
| --- | --- | --- | --- |
| R3-01 | 门区闭式 | `L/R` 公式、`w−d>ε`、全周期交集、无 pad |  |
| R3-02 | 全相位覆盖 | `∀φ0` 交集；不得用幸运相位或整段扫掠区 |  |
| R3-03 | 侧规则 | 左→右 / 右→左 的 spawn 与 `goalRegion` 条件；`goalRegion` 外扩 `0.5px` |  |
| R3-04 | `forbiddenInjection` | 原始 `gateRect` 原样注入、只扩张一次、不进 `blocked`、门顶不是地板 |  |
| R3-05 | 反例 | D4 §11 的 1–4、6、13 全覆盖 |  |
| R3-06 | 输出边界 | 未生成 / 伪造 `graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure` / 完整 `PermanentGateProof` / `TemporalInternalResult` |  |
| R3-07 | 范围 | 未实现 U4 / U5；未修改 `temporal.ts` / `graph.ts` / `reach.ts`；`temporal.ts` 零 diff |  |
| R3-08 | 独立验证 | 复核人自选 ≥2 条关键反例 + 1 条边界值，记录理由与结果 |  |

复核结论只写 `PASS` / `FAIL` / `NOT_RUN`；不得用总通过率替代逐项结论；未运行项不得推定通过。

## 4. 复核命令

```bash
pnpm build
pnpm typecheck
pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts
pnpm test
```

另建议独立检查：

```bash
git diff --name-status c0d6981..HEAD -- packages/ docs/ fixtures/
git diff --name-only c0d6981..HEAD -- '**/package.json' pnpm-lock.yaml
git diff --name-only c0d6981..HEAD -- '*.json'
grep -n "temporal-gate" packages/contracts/src/playability/index.ts packages/contracts/src/index.ts
grep -nE "from \"\\./temporal(\\.js|-witness\\.js)\"" packages/contracts/src/playability/temporal-gate.ts
```

## 5. 必要原始输入

| 输入 | 路径 |
| --- | --- |
| 冻结语义 D4 | [`.scratch/level-playability-v1.1-i02/issues/10-i02-d4-gate-graphcut.md`](../../level-playability-v1.1-i02/issues/10-i02-d4-gate-graphcut.md) |
| D9 契约 | `.scratch/level-playability-v1.1-i02/issues/15-i02-d9-internal-result-contract.md`；实现 `packages/contracts/src/playability/temporal-result.ts` |
| 授权包相关条款 | `docs/v7.8/移动-I02.md` §3.2 / §3.6 / §5.2 / §5.3 / §6.3 / §9.3 |
| 运动原语 | `packages/contracts/src/playability/temporal-motion.ts`（ε、三角波、Hazard 盒） |
| 建图与禁区语义 | `packages/contracts/src/playability/graph.ts`（`forbiddenBoxes` 展开公式、`standable`） |

## 6. 复核会话隔离

- 复核人必须未参与 U3 实现；
- **不得**读取 `.scratch/level-playability-v1.1-u3/reports/`、`.scratch/level-playability-v1.1-u3/map.md`、`.scratch/level-playability-v1.1-u3/issues/` 下除 `09-u3-r3-review.md` 外的任何票；
- 证据目录 `.scratch/level-playability-v1.1-u3/evidence/` 只作**原始输出对照**，不得作为结论依据；
- 不修改产品代码；不推送 / 建 PR / 合并；不把 R3 结论扩展为 U4 授权。
