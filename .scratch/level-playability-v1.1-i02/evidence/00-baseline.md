# I02-00 基线、权威输入与停止线

| 项 | 值 |
| --- | --- |
| 票 | [`01-i02-00-effort-init.md`](../issues/01-i02-00-effort-init.md) |
| 日期 | 2026-11-10 |
| 分支 | `wayfinder/level-playability-v1.1-i02` |
| 基线提交 | `a3b8a54e36a292d0dc8dbd5f5839ec35964a3858`（I-01 合并） |
| 前置实现提交 | `f6a7de935af697fc221bffeba79053534e7e5d74`（I-01） |
| 性质 | 初始化 / 冻结记录；不改产品目录 |
| 修改产品目录 | **否** |

## 1. 权威输入与 SHA-256

| 输入 | 路径 | SHA-256 | 状态 |
| --- | --- | --- | --- |
| I-02 需求（只读） | `docs/v7.8/移动-200.md` | `14a3816d8d5975765e3a9301c5f06612ab03f6f14130ca4ca865550ec165b7d5` | git 未跟踪；本 effort 冻结其字节，不修改 |
| I-00 冻结包（只读，已签署） | `docs/v7.8/移动-I00.md` | `d9fea112a519965e7903d6c7dc9125498927880b14ff0baba9896ecd446e69eb` | 已跟踪 |
| 父 PRD（只读） | `docs/v7.8/移动.md` | `3598cc19889b10a9fabf3a4f6f28ae7cee43a22355b639d8d61298e6d459cea9` | 已跟踪；与 I-00 记录的权威输入哈希一致 |
| 领域词汇（唯一权威） | `CONTEXT.md` | `c623d01890f73abdbe6823d06c4e3594306ef0f56031348cd01e0b4df2ac0bc7` | 已跟踪 |
| P0 结论包（只读证据） | `.scratch/level-playability-v1.1-p0/evidence/04-final-report.md` | — | 已收口；不重开结论 |
| P0 模型（只读） | `.scratch/level-playability-v1.1-p0/prototype/MODEL.md` | — | `verticalEvasionImpossible` 在 I-00 中作废 |
| I-00 证据索引 | `.scratch/level-playability-v1.1-integration/` | — | R1/R2/R3 均已签署 |

> `docs/v7.8/移动-200.md` 在本次记录时是**未跟踪文件**；基线提交 `a3b8a54` 不包含它。冻结以本文件记录的 SHA 为准，不以提交为准。

## 2. 用户 2026-11-10 裁定

| 问题 | 裁定 | 约束 |
| --- | --- | --- |
| Q1 终点 | (a) | 交付完整 I-02 实施授权包 `docs/v7.8/移动-I02.md`，不是直接实施算法。 |
| Q2 执行承载 | (a) | 允许 scratch 原型、只读实验和证据采集；禁止生产代码修改。 |
| Q3 放行形态 | (a) | 一个包覆盖五个单元；首次签署只授权 I02-01，其余 `PLANNED`。 |
| Q4 冻结冲突 | (a) | I-00 已签署语义优先；冲突必须单独裁定并记录，不得静默择一。 |

### 五单元授权状态（目标形态）

| 单元 | 授权包定义 | 首次签署后的状态 |
| --- | --- | --- |
| I02-01 连续时间求交 | 完整定义 | `AUTHORIZED` |
| I02-02 安全通过 Witness | 完整定义 | `PLANNED` |
| I02-03 永久封锁证明 | 完整定义 | `PLANNED` |
| I02-04 垂直规避图割 | 完整定义 | `PLANNED` |
| I02-05 预算与确定性 | 完整定义 | `PLANNED` |

`PLANNED` 不等于隐含授权；I02-01 复核通过也不能自动启动其余单元。

### 硬复核点

- **R1**：I02-01 完成后。复核运动模型、AABB 语义、连续时间求交、epsilon、数值稳定性及反例测试。未通过不得进入 I02-02。
- **R2**：I02-02 完成后、进入 I02-04 前。复核 Witness 完整性、连续时间安全性和证明健全性。后续单元仍需增量授权。

## 3. 执行边界

**允许**（只在 `.scratch/level-playability-v1.1-i02/` 内写）

- `scripts/`、`evidence/`、`experiments/`、`reports/`。
- 三角波与 AABB 连续时间解析求交试算。
- P0 既有模型与 I-00 冻结模型的差异复核。
- 图割和 hop 加倍的反例试算。
- 现有语料上的性能基线采集。
- 独立测试脚本和可复现证据。

**禁止**

- 修改 `packages/**`、Runtime、CLI、MCP、公共 Contract。
- 修改生产 stub 或生产分析器。
- 接入最终 Playability Verdict。
- 新增依赖。
- 修改 `docs/v7.8/移动-200.md`、`docs/v7.8/移动-I00.md` 或历史验收证据。
- 将 scratch 实验结果表述为生产验收通过。

**停止线**：零付费、产品目录只读、不接生产。

## 4. 环境与测试口径

| 项 | 值 |
| --- | --- |
| 平台 | `Darwin 24.6.0 arm64` |
| CPU | Apple M4（10 核） |
| 内存 | 16 GiB |
| Node | `v22.23.2` |
| pnpm | `10.7.1` |
| Vitest | `3.2.7` |

### 已验证命令（本 effort 内只读复跑）

| 命令 | 退出码 | 结果 | 日志 |
| --- | ---: | --- | --- |
| `pnpm test` | 0 | 170 test files / 2616 tests passed；2 条 Vitest worker `onTaskUpdate` 超时被 `dangerouslyIgnoreUnhandledErrors` 忽略 | `evidence/logs/i02-01-pnpm-test.log` |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts` | 0 | 1 file / 65 tests | `evidence/logs/i02-01-temporal.log` |
| `pnpm exec vitest run packages/contracts/tests/playability-{api,completion,geometry,graph,mechanic,spatial,temporal-input}.test.ts` | 0 | 7 files / 190 tests | `evidence/logs/i02-01-playability.log` |
| `git diff --stat -- packages docs fixtures` | 0 | 空 | — |

> 以上日志由 I02-01 研究子代理在 `a3b8a54` 上采集；本票只引用，不重复运行。

## 5. 已知风险与未确认项（只登记）

- 相位语义（全称 / 存在 / 保守降级）尚未裁定：见 [I02-D1](../issues/07-i02-d1-phase-semantics.md)。
- I-00 / I-02 已知冲突尚未登记成表：见 [I02-02](../issues/03-i02-02-conflict-register.md)。
- Phaser overlap 直接证据缺失：见 [I02-06](../issues/19-i02-06-phaser-overlap.md)。
- `graph.ts` hop 参数化、`profile.ts`、`fixtures/packs/**` 仍是 I-00「需单独裁定」项。
- P0 的 `verticalEvasionImpossible` 声明在 I-00 中作废，P0 的 B 案例不能直接复用。

## 6. 复现

```bash
cd /Volumes/shy/some-projects/game-maker
shasum -a 256 docs/v7.8/移动-200.md docs/v7.8/移动-I00.md docs/v7.8/移动.md CONTEXT.md
git rev-parse HEAD
git branch --show-current
node --version && pnpm --version && pnpm exec vitest --version
git diff --stat -- packages docs fixtures
```
