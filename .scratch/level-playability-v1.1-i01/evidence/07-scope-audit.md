# I01-07 白名单与 R2 一致性审计

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-10 |
| 票 | [I01-07](../issues/07-i01-07-whitelist-audit.md) |
| 依据 | [`移动-I00.md`](../../../docs/v7.8/移动-I00.md) §11；[I00-R2](../level-playability-v1.1-integration/issues/13-i00-r2-whitelist-authorization.md) 签署记录；[`08-file-impact.md`](../level-playability-v1.1-integration/evidence/08-file-impact.md) §2 / §4；[I01-01](01-file-plan.md)、[I01-05](05-call-site-wiring.md)、[I01-06](06-test-matrix.md) |
| 基线 | `main @ 29ea1d1`（`main` 是当前 HEAD 的祖先） |
| 性质 | **审计证据，不是实施授权**；授权在 [I01-R1](../issues/08-i01-r1-authorization.md) |
| 修改产品目录 | **否**（本票只写预期 diff，不产生生产 diff） |

## 0. 结论摘要

- **逐文件：全部落在 I-00 §11 白名单内，越界清单为空。** 实施阶段预期只改 **7 个文件**（3 新增、4 修改）。
- **既有测试：零改动、零删除、零放宽。** 唯一新增测试是 `packages/contracts/tests/playability-temporal-input.test.ts`。
- **公共面：没有第 5 项功能类别。** R2 第 2–4 项（`ConfigAuditContext` / `coverage.temporal` / `PlayabilityEvidence`）**一项都不用**；R2 第 1 项（`auditPlayability` 第三参数）由新时序入口**替代**，不是原样执行，也不是第 5 项。
- **必须逐符号签署的边界项**：`stubTemporalAnalyzer` 与 `temporalScope` 是新模块内部导出，不在 I01-01 的逐项枚举里。本审计判定它们属于「第 1 项替代集合」，**不是**新的公共面类别；但 I01-R1 必须逐符号列出并签署。若签署人或 R2 授权人认为任何新符号都算第 5 项 ⇒ 本项转为 `STOP → I-00 R2`，不得自行视为已批准。
- **对 I-00 冻结计划的 5 项显式偏离 + 1 项 I01-05 收敛**全部落在白名单文件内，逐项见 §5，必须进 R1 的偏离清单。
- **无新依赖、无 lockfile、无 `fixtures/packs/**`、无 `ConfigIssue.code`、无持久化 schema、无 CLI/MCP 参数、无 `game-config.ts` / `assetpack.ts` 改动。**
- **I-01 不触发 R2 Q6 的发布行为变化**：生产 stub 只返回 IE，不返回 `PROVEN_UNPLAYABLE`。Q6 的「可能被拒」留给 I-04。

## 1. 审计基线

| 约束 | 内容 |
| --- | --- |
| 白名单 | `docs/v7.8/移动-I00.md` §11（`:145-165`） |
| R2 裁定 | 2026-11-09 签署：照单批准 §4「允许」；三个「需单独裁定」项不预先批准；公共面只批 4 项；I-01 单独先行、独立 PR；既有断言删除 / 放宽直接阻断 |
| 基线 | `main @ 29ea1d1` |
| 实施形态 | I-01 独立 PR；本图不实施 |
| 上位约束 | I-00 冻结包与 R2 授权边界不得自行放宽 |

## 2. 逐文件审计

### 2.1 预期改动（实施阶段）

| # | 文件 | 状态 | 改动性质 | 白名单条目 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 1 | `packages/contracts/src/playability/temporal.ts` | **A** | 纯函数：`temporalScope`、`auditPlayabilityTemporal`、`stubTemporalAnalyzer`、`resolveTwoLagResults`、两档常量 | §11 新文件（逐字列出） | **允许** |
| 2 | `packages/contracts/src/playability/temporal-input.ts` | **A** | 纯函数：`verifyTemporalInput`、运行时 brand、失败码与 verified 表 | §11 新文件（逐字列出） | **允许** |
| 3 | `packages/contracts/src/playability/api.ts` | **M** | **只加导出**；不改 `auditPlayability` / `playabilityIssues` 的任何既有签名或实现 | §11 允许 | **允许（只加导出）** |
| 4 | `packages/contracts/tests/playability-temporal-input.test.ts` | **A** | 新测试文件（I01-06 的 65 条矩阵） | §11 `packages/contracts/tests/playability-*.test.ts`（只增不改） | **允许（只增）** |
| 5 | `packages/assets/src/ops.ts` | **M** | 私有 `readTrustedAtlasInput`（唯一读盘 + 真实 SHA）+ 导出 `runTemporalAudit`（同步）+ `compileRuntime` 一处接线 | §11 允许 | **允许** |
| 6 | `packages/pipeline/src/create-game.ts` | **M** | 汇合点一处 `runTemporalAudit` 调用 | §11 允许 | **允许** |
| 7 | `packages/pipeline/src/publish-gate.ts` | **M** | 私有 `configProblem` 增加 `packDir` 形参；调用点传入 `opts.packDir`；一处 `runTemporalAudit` 调用 | §11 允许 | **允许** |

### 2.2 明确不改

| 文件 / 范围 | 理由 | 结论 |
| --- | --- | --- |
| `packages/contracts/src/config-audit.ts` | 三处调用方直接调 `runTemporalAudit`，不经过 `ConfigAuditContext` | 不改 |
| `packages/contracts/src/playability/mechanic.ts` | `moving-hazard-phase` gap 消解是 I-03 | 不改 |
| `packages/contracts/src/playability/verdict.ts` | `coverage.temporal` 与证据字段是 I-03 | 不改 |
| `packages/contracts/src/playability/index.ts` | 测试直接 import `playability/*.js`；`api.ts` 也直接相对 import | 不改 |
| `packages/contracts/src/index.ts` | **不在白名单**；`index.ts:150` 已 `export * from "./playability/api.js"` | 不改 |
| `packages/pipeline/tests/publish-gate.test.ts` | I01-06 裁定不需要只增用例；`:193` 已穿过新接线 | 不改 |
| `packages/contracts/src/playability/profile.ts` / `graph.ts` | R2 的「需单独裁定」项；I-01 不碰 | 不改，不需要单独裁定 |
| `fixtures/packs/**` | R2 的「需单独裁定」项；I01-06 夹具零新增 | 不改，不需要单独裁定 |
| `packages/contracts/src/game-config.ts` / `assetpack.ts` | §11 明确禁止；不新增 config / manifest 字段 | 不改 |
| `packages/demo/**` / `packages/cli/**` / `packages/mcp/**` | §11 明确禁止；无 Runtime / CLI / MCP 参数 | 不改 |
| `packages/*/package.json` / `pnpm-lock.yaml` | 无新依赖；pipeline → assets 边已存在（`packages/pipeline/package.json:14`） | 不改 |
| 任意既有测试文件 | R2 Q4：删除 / 放宽既有断言直接阻断 | 不改 |

## 3. 公共面审计

### 3.1 对照 R2 已批准的 4 项

| R2 项 | 原批准内容 | I-01 实际 | 结论 |
| --- | --- | --- | --- |
| 1 | `auditPlayability` 增第三个 `options` 参数（`lagMs` + Atlas 来源） | **不用原形态**；由新导出 `auditPlayabilityTemporal` 等替代；`auditPlayability` 签名一字不改 | **替代**（见 §3.2 / §3.4） |
| 2 | `ConfigAuditContext` 增可选 `packDir` / `lagMs` | **不用**；`config-audit.ts` 不改 | 未使用，未超范围 |
| 3 | `PlayabilityVerdict.coverage` 增 `temporal` | **不用**；`verdict.ts` 不改 | 未使用，未超范围 |
| 4 | `PlayabilityEvidence` 增可选字段 | **不用**；`verdict.ts` 不改 | 未使用，未超范围 |

R2 的「不批」项逐条核对：

| R2 不批项 | I-01 是否触碰 |
| --- | --- |
| CLI 参数 | **否** |
| MCP 工具 | **否** |
| `ConfigIssue.code` | **否**（仍是既有 3 个值） |
| 持久化 schema | **否** |
| 新依赖 | **否** |

### 3.2 经 `api.ts` 转出的新符号

| 符号 | 种类 | 谁需要 | 分类 |
| --- | --- | --- | --- |
| `verifyTemporalInput` | function | `assets/ops.ts` 唯一读取器 | 第 1 项替代集合 |
| `auditPlayabilityTemporal` | function | `runTemporalAudit` 两档调用 | 第 1 项替代集合 |
| `resolveTwoLagResults` | function | `runTemporalAudit` 比较 | 第 1 项替代集合 |
| `stubTemporalAnalyzer` | function | `runTemporalAudit` 显式生产 stub（I01-04） | 第 1 项替代集合（**边界项，R1 逐符号签署**） |
| `temporalScope` | function | `runTemporalAudit` 判适用性 + 收集 scope（I01-05） | 第 1 项替代集合（**边界项，R1 逐符号签署**） |
| `TEMPORAL_LAG_MS` | const | 两档常量之一 | 第 1 项替代集合 |
| `TEMPORAL_LAG_BASELINE_MS` | const | 两档常量之一 | 第 1 项替代集合 |
| `TrustedAtlasInput` | type | `auditPlayabilityTemporal` 入参 | 第 1 项替代集合 |
| `TemporalAuditResult` | type | 入口 / 编排器返回 | 第 1 项替代集合 |
| `TemporalAnalyzer` | type | `analyze` 形参 | 第 1 项替代集合 |

**建议不经过 `api.ts` 转出**（减少公共面；测试直接 import 内部模块）：

- `isTrustedAtlasInput`（`auditPlayabilityTemporal` 内部使用；assets 不需要）
- `TemporalInputResult` / `TemporalInputFailure` / `TemporalInputFailureCode` / `FrameGeometry` / `VerifiedFile`（除非声明生成需要；测试直接 import）
- `ANCHOR_EQUAL_EPSILON`（I01-03 内部常量）
- brand `unique symbol`（**永不导出**）

### 3.3 assets 包的新增公共面

| 符号 | 种类 | 状态 |
| --- | --- | --- |
| `runTemporalAudit` | function | **导出**（pipeline 两处调用） |
| `readTrustedAtlasInput` | function | **模块私有，不导出**（I01-05；减少公共面） |

`packages/assets/src/index.ts:29` 的 `export * from "./ops.js"` 会把 `runTemporalAudit` 暴露到包公开面；这是 I01-01 已列、I01-07 本条登记的范围。

### 3.4 「第 5 项」判定

**判定：没有第 5 项功能类别。**

理由：

1. 没有新增 `ConfigIssue.code`、持久化字段、CLI / MCP 参数、新依赖。
2. 没有修改任何既有导出类型 / 签名的字段（`auditPlayability`、`ConfigAuditContext`、`PlayabilityVerdict`、`PlayabilityEvidence` 全部不动）。
3. 新增的是**新时序模块的入口与内部导出**，整体替代 R2 第 1 项；I01-01 已裁定「新导出替代第 1 项，不是第 5 项」，本审计确认该裁定的落地形态。
4. `stubTemporalAnalyzer` / `temporalScope` 是 I01-04 / I01-05 为了「生产显式 stub」与「适用才读盘」**结构性必需**的符号；它们不是新的公共面**类别**，但确实是 I01-01 未逐项枚举的符号 ⇒ 列入 R1 的逐符号签署清单。

**条件性 STOP**：若 R1 签署人或 R2 授权人把上述任一符号视为第 5 项（即：不承认「第 1 项替代集合」可以包含新函数），则本授权包**不得签署**，必须 `STOP → I-00 R2` 重新裁定。不得把「替代」解释成自动批准。

### 3.5 公共面的净变化

- **改**：无（既有导出签名 / 字段零改动）。
- **增**：contracts 新时序模块的 10 个符号（§3.2）+ assets 的 `runTemporalAudit`（§3.3）。
- **删**：无。
- **`@internal` 不是访问控制**：I01-02 的限制原样成立；`api.ts` 的导出对包外可见，真正限制来自架构测试与代码评审。

## 4. 测试审计

| 项 | 结论 | 证据 |
| --- | --- | --- |
| 新增测试文件 | 1 个，匹配 §11 的 `playability-*.test.ts` 只增模式 | `packages/contracts/tests/playability-temporal-input.test.ts` |
| 既有测试文件修改 | **0** | 预期 `git diff --name-only main...HEAD -- 'packages/**/tests/**'` 只有上述 1 个 `A` |
| 既有断言删除 / 放宽 | **0** | 预期 `git diff --name-status` 无 `D`；既有测试文件不在 diff |
| 三个点名文件 | `playability-api.test.ts` / `config-audit.test.ts` / `publish-gate.test.ts` **零改动** | I01-06 §4.1 裁定；`publish-gate.test.ts:193` 已覆盖发布闸非阻断路径 |
| 回归门槛 | 既有 vitest 全绿 + LP-06/07 scratch 复跑一致 | R2 Q4；I01-06 §4 / §5 |
| 测试计数 | 全仓用例数 = 基线 + 新文件用例数；既有用例数不减少 | `pnpm test` 输出 |

## 5. 偏离审计

### 5.1 map 的显式偏离（对 I-00 冻结计划）

| # | I-00 原计划 | I-01 实际落点 | 涉及文件 / 签名 | 白名单 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 1 | Atlas 读取在 contracts `temporal-input.ts` | 读取在 `assets/ops.ts`；contracts 只做纯验证 | `ops.ts` 私有 `readTrustedAtlasInput`；`temporal-input.ts` 收 `bytes` | 均在允许清单 | **允许** |
| 2 | 几何提取 + 验证都在 contracts | contracts 纯函数验证；assets 负责可信读取与真实 SHA | `temporal-input.ts` + `ops.ts` | 均在允许清单 | **允许** |
| 3 | 扩展 `auditPlayability` options | 新增独立入口 `auditPlayabilityTemporal`；旧签名不动 | `api.ts` 只加导出；`api.ts` 的 `auditPlayability` 零改动 | `api.ts` 允许 | **允许（第 1 项替代；R1 明列）** |
| 4 | `config-audit.ts` 增 `packDir` / `lagMs` | 不改 `config-audit.ts`；三处调用方直接调编排器 | `config-audit.ts` 零改动 | 允许但未用 | **允许** |
| 5 | `coverage.temporal` / `PlayabilityEvidence` 字段 | I-01 内部结果；公共证据字段留给 I-03 | `verdict.ts` 零改动 | 允许但未用 | **允许** |

### 5.2 I01-05 的接线收敛

| 项 | I-00 / I01-01 原形态 | I-01 实际 | 结论 |
| --- | --- | --- | --- |
| `compileRuntime` 调用点 | `:1247`（重采样循环）与 `:1284`（确定性校验）两处 | **只接 `:1284`**；循环内不接（结果丢弃、无法影响重试、逐发读取重复 I/O） | **允许**；I01-07 本条登记为计划偏离，R1 必须列明 |

### 5.3 I01-06 的测试收敛

| 项 | I01-01 原形态 | I-01 实际 | 结论 |
| --- | --- | --- | --- |
| `publish-gate.test.ts` 只增用例 | 「仅在 I01-05 证明需要时新增」 | I01-06 裁定**不新增**：`:193` 已穿过新接线，新增不提高证明力 | **允许**；不是偏离白名单，只是不加 |

### 5.4 未触发的「需单独裁定」项

| 项 | 是否需要单独裁定 | 理由 |
| --- | --- | --- |
| `profile.ts` | **否** | 不改；`coverage.temporal` 留给 I-03 |
| `graph.ts`（hop 采样参数化） | **否** | 不改；I-01 不做时序搜索 |
| `fixtures/packs/**` | **否** | 不改；I01-06 夹具零新增 |

## 6. 越界结论

**白名单外文件：无。既有测试改动：无。新依赖：无。**

需要 R1 逐项列明、但不构成越界的边界项：

1. **第 1 项替代形态**：`auditPlayabilityTemporal` 等新导出替代 R2 第 1 项。R1 必须逐符号列出，不能写成「按 R2 原样执行」。
2. **`stubTemporalAnalyzer` / `temporalScope`**：新模块内部导出，属替代集合，但不在 I01-01 的逐项枚举里。R1 必须逐符号签署；若被判定为第 5 项 ⇒ `STOP → I-00 R2`。
3. **`compileRuntime` 只接 `:1284`**：对 I-00 / I01-01「两处调用点」的收敛。R1 必须写明。
4. **生产读取器无独立单元测试、三处接线只能结构证明**（I01-06 §6）：R1 必须原文收录。

**没有需要回 I-00 R2 的硬越界。** 上述 4 条是签署时必须显式处理的边界，不是可以悄悄放过的偏离。

## 7. 实施阶段的 diff 预期形状

本票**不产生生产 diff**；下面是实施 PR 必须满足的形状（基线 `main @ 29ea1d1`）。

### 7.1 期望文件集合

```text
A  packages/contracts/src/playability/temporal-input.ts
A  packages/contracts/src/playability/temporal.ts
A  packages/contracts/tests/playability-temporal-input.test.ts
M  packages/assets/src/ops.ts
M  packages/contracts/src/playability/api.ts
M  packages/pipeline/src/create-game.ts
M  packages/pipeline/src/publish-gate.ts
```

- **3 个 A + 4 个 M = 7 个文件。**
- **无 `D`**；无既有测试文件；无 `package.json` / `pnpm-lock.yaml`；无 `fixtures/**`；无 `docs/v7.8/**`；无 `packages/demo|cli|mcp/**`。

### 7.2 命令与逐项检查

```bash
git diff --name-status main...HEAD
git diff --stat main...HEAD
git diff main...HEAD -- packages/contracts/src/playability/api.ts
git diff main...HEAD -- 'packages/**/tests/**'
```

| 检查 | 期望 |
| --- | --- |
| `--name-status` | 严格等于 §7.1 的 7 行；任何额外 `A/M/D` ⇒ 停止 |
| `api.ts` diff | **只有新增 import / export 行**；`auditPlayability` / `playabilityIssues` 的实现与签名零改动 |
| `tests/**` diff | 只有 `A packages/contracts/tests/playability-temporal-input.test.ts` |
| `ops.ts` diff | 只增私有读取器、`runTemporalAudit`、`compileRuntime` 一处调用；不改既有函数行为 |
| `create-game.ts` diff | 只增一处 `runTemporalAudit` 调用 |
| `publish-gate.ts` diff | 只改私有 `configProblem` 的形参与其调用点，并增一处 `runTemporalAudit` 调用；不改 `PublishGateOptions` |
| 全仓命令 | `pnpm build` / `pnpm typecheck` / `pnpm test` / `pnpm check:deps` / `pnpm check:links` 全部 exit 0 |
| 语料 | LP-06/07 scratch 复跑与基线零差异 |

### 7.3 本票自身的 diff

本票只改 `.scratch/level-playability-v1.1-i01/`：`issues/07-...md`、`map.md`、`evidence/07-scope-audit.md`。`packages/**`、`docs/**`、`fixtures/**` 零改动。可用：

```bash
git status --short
git diff --stat -- packages docs fixtures
```

最后一条应为空。

## 8. 残余风险（进 R1）

1. **替代形态不是 R2 原样批准**：R2 只批准了「`auditPlayability` 第三参数」，I-01 用新入口替代。R1 必须逐符号签署；若签署人要求 R2 再确认，停止，不自行放行。
2. **边界导出**：`stubTemporalAnalyzer` / `temporalScope` 不在 I01-01 的逐项枚举里。R1 明列；若被判定为第 5 项 ⇒ `STOP → I-00 R2`。
3. **生产读取器无独立单元测试**（I01-06 §6.1）：资产侧读取器的文件 I/O 只能由类型形状、纯函数同字节测试、架构扫描与集成非回归共同约束。
4. **三处接线丢弃结果**（I01-06 §6.2）：「已消费」只能结构证明，不能运行时观察。
5. **`publish-gate.ts` 新增 `@game-maker/assets` import**：文件与依赖边都在白名单（pipeline → assets 已存在），但这让发布闸在运行时加载 assets 包；若未来要拆薄发布路径，需另立票，不在 I-01 处理。
6. **架构扫描是 tripwire**：源码文本形状变化可能误红 / 漏红；真正的边界仍由 §11、R2、R1 与代码评审兜底。

## 9. 事实来源

- 白名单：`docs/v7.8/移动-I00.md:145-165`。
- R2 签署：`.scratch/level-playability-v1.1-integration/issues/13-i00-r2-whitelist-authorization.md`（`State: SIGNED`，2026-11-09）。
- I-00 文件影响与公共面 4 项：`.scratch/level-playability-v1.1-integration/evidence/08-file-impact.md` §2 / §4。
- 公开路径：`packages/contracts/src/index.ts:150`。
- assets 公开路径：`packages/assets/src/index.ts:29`。
- pipeline → assets 依赖：`packages/pipeline/package.json:14`。
- 依赖方向守卫：`scripts/check-deps.mjs` 的 `ALLOWED`（pipeline 允许 assets）。
- 基线：`git rev-parse --short main` = `29ea1d1`；`main` 是 HEAD 的祖先。
- 既有测试零改动裁定：`evidence/06-test-matrix.md` §4.1；`publish-gate.test.ts:193`。
- 接线收敛：`evidence/05-call-site-wiring.md` §1.1。
- 偏离表：`map.md` 的「对 I-00 冻结计划的显式偏离」。
