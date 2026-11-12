# U1-00 基线证据

日期：2026-11-11
执行：claude（wayfinder U1 会话）
对应票：[U1-00 初始化、基线与白名单确认](../issues/01-u1-00-init.md)
状态：**PASS**（基线成立，可进入 U1-01 / U1-02）

---

## 1. 分支与基线

| 项 | 值 | 命令 |
| --- | --- | --- |
| 当前分支 | `wayfinder/level-playability-v1.1-u1` | `git rev-parse --abbrev-ref HEAD` |
| HEAD | `553cdc3ae6a39b682aa26202643fd58f9a85adb4` | `git rev-parse HEAD` |
| 基线分支 `wayfinder/level-playability-v1.1-i02` | `ed02339a57ca1c1d9d2df5c553ca92a863492e92`（2026-11-11 21:04:45 +0800） | `git rev-parse wayfinder/level-playability-v1.1-i02` |
| 基线是否为 HEAD 祖先 | 是（`git merge-base --is-ancestor ed02339 HEAD` exit 0） | 同左 |
| 建图后新增提交 | 仅 `553cdc3 docs(wayfinder): chart I02-U1 implementation map` | `git log --oneline ed02339..HEAD` |
| 建图后 diff | 9 个文件 / +460 行，**全部位于 `.scratch/level-playability-v1.1-u1/`** | `git diff --stat ed02339..HEAD` |
| 工作区（开工前） | 干净 | `git status --porcelain` |

结论：分支确从 `ed02339` 创建；建图提交未触碰产品目录。

## 2. 授权包 SHA 复算

```bash
shasum -a 256 docs/v7.8/移动-I02.md
797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56  docs/v7.8/移动-I02.md
```

与地图 `Authority:` 及签署记录一致（`797cd6fc…`）。首次签署仅放行 U1，未变。

## 3. U1 白名单逐文件状态（开工时）

授权包 §5.2 U1 行 + 共享 `TEST_ONLY` helper，共七个文件：

| 文件 | 开工时状态 | 行数 | 负责票 |
| --- | --- | --- | --- |
| `packages/contracts/src/playability/temporal.ts` | 存在（I-01 现状） | 115 | U1-03（只增） |
| `packages/contracts/src/playability/temporal-result.ts` | 不存在 | — | U1-01 |
| `packages/contracts/src/playability/temporal-budget.ts` | 不存在 | — | U1-01 |
| `packages/contracts/src/playability/temporal-motion.ts` | 不存在 | — | U1-02 |
| `packages/contracts/tests/playability-temporal-motion.test.ts` | 不存在 | — | U1-04 |
| `packages/contracts/tests/playability-temporal-budget.test.ts` | 不存在 | — | U1-04 |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | 不存在 | — | U1-04 |

与票面预期**逐文件一致**；授权包 §5.2 的白名单外文件（`temporal-witness.ts` / `temporal-gate.ts` / `temporal-evasion.ts` / `graph.ts` / 其余四个测试文件）均**不属于 U1**，本单元不创建。

## 4. 基线命令（只读复跑）

环境：macOS 24.6.0 (darwin arm64)、Node `v22.23.2`、pnpm `10.7.1`、Vitest `3.2.7`。

| 命令 | 退出码 | 结果 | 日志 |
| --- | --- | --- | --- |
| `pnpm build` | 0 | `tsc -b` + 10 个工作区 bundle 全部完成 | `logs/00-baseline-build.log` |
| `pnpm typecheck` | 0 | 10 个工作区 typecheck 全部 Done | `logs/00-baseline-typecheck.log` |
| `pnpm test` | 0 | **170 test files / 2616 tests passed** | `logs/00-baseline-test.log` |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts` | 0 | 1 file / 65 tests passed | `logs/00-baseline-arch-assertions.log` |

### `pnpm test` 附注（如实记录）

日志末尾出现 2 条 `[vitest-worker]: Timeout calling "onTaskUpdate"` 的 runner RPC 超时；`Test Files 170 passed (170)`、`Tests 2616 passed (2616)`、退出码 0。该 flake 已记录于仓库 `vitest.config.ts` 注释与 I-02 基线（`dangerouslyIgnoreUnhandledErrors: true`），与 I-02 基线（170 / 2616）完全一致，非产品差异。测试本身无失败。

## 5. 基线架构断言

命令：`pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose`

| 断言 | 结果 | 逐项证据 |
| --- | --- | --- |
| T-57 `auditPlayabilityTemporal(` 生产调用者只有 `ops.ts` | PASS | `✓ … > I. 架构与结构断言 > T-57 …` |
| T-58 生产 `analyze:` 实参只有 `stubTemporalAnalyzer` | PASS | `✓ … > T-58 …` |
| T-61 三处生产接线各至少一次 | PASS | `✓ … > T-61 …` |
| T-62 `TEMPORAL_LAG_*` 常量唯一且不复用 `FRAME_MARGIN_MS` | PASS | `✓ … > T-62 …` |
| T-64 brand `Symbol(` 只在 `temporal-input.ts` 铸造 | PASS | `✓ … > T-64 …` |

同类断言 T-56 / T-59 / T-60 / T-63 / T-65 亦在同一 65 测试批次中通过。

## 6. 日志完整性

```text
434228dbb80acb6b0cfe6bbe8f90e5887dfe1025cc57ec294b8bcc18b750fac5  00-baseline-arch-assertions-verbose.log
c3aa3454047b51d0ded627aa9cf67bd596ce42a52daf08633bb163cb013d064d  00-baseline-arch-assertions.log
bd8920701b7dcfb1625f2ebb328ccf192eabcd6f4664d7159a31234ac2cfc38a  00-baseline-build.log
664d9d1189d75c978da0c4b36cd97b8a6d0793b8ec04bc0c1da1ee6a7db58b61  00-baseline-test.log
c69f7bc1e6733166b70fcdcdf4bccb18da1e496aba60c10d668683dba5a351b6  00-baseline-typecheck.log
```

## 7. 范围声明

- **产品目录未修改**：本票只读取并运行命令；`packages/**` 零改动。
- `git status --porcelain` 除 `.scratch/level-playability-v1.1-u1/`（票认领 + 本证据）外无变化；`pnpm build` 产物位于 gitignore 覆盖的 `dist/`。
- 未新增依赖、未修改测试配置、未修改授权包或 I-00 / I-02 原文。
- 未推送、未创建 PR、未合并。

## 8. 结论

基线成立：分支与授权包 SHA 可追溯，白名单与授权包逐文件一致，全量命令与五项架构断言全部通过。**放行 U1-01 与 U1-02（二者可并行）。**
