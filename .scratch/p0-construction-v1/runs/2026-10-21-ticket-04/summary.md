# 票 04 证据：P0-05b 像素阈值判据落地（票 03 裁定 A+）

- 日期：2026-10-21 · 零付费 · 未提交 · 未启动浏览器
- 对应票：`issues/04-p0-05b-pixel-threshold-criteria.md`；裁定原文：`issues/03-p0-05a-pixel-metrics-measurement.md` 的 `## 裁定`
- 结论：**程序级判据全绿**；未新增判据、未改契约 / CLI / MCP / 依赖 / `inspectPack` 输出。

## 阈值表（唯一落点：`packages/qa/src/pixel.ts:26`）

| 指标 | 数值 | 落点 | 来源 / 理由 |
|---|---|---|---|
| 长宽比 | `\|ΔAR\| ≥ 25%` ⇒ **error**；`24.9%` 不触发、`25.0%` 触发；全部 `sourceSizes`（背景层不豁免） | `constructive-constraint` | 票 03；7 包 / 47 样本；已验收最大 2.70%，正常帧间 ≤ 9.1% |
| 色板外 error | `share ≥ 25%` **且** `不透明像素 ≥ 16` ⇒ **error** | `palette-binding` | 票 03 A+（低风险档）；7 包 / 89 资产 |
| 色板外 observation | `10% ≤ share < 25%` **且** `不透明像素 ≥ 16` ⇒ **observation**（不阻断） | `inspect` 观察行 | `health-icon` 41/256（16.02%）、`tile-wall` 29/225（12.89%） |
| 色板外不判 | `< 10%` 或 `< 16` 个不透明像素 | — | 票 03 边界 |
| 背景层覆盖率 | **不新增 P0 数值阈值** | 保持 observation | 装配期 `auditLayerCoverage` + 票 08 的 `layer-coverage` 已承担 |
| unavailable | 无 `sourceSizes` ⇒ 「没跑（unavailable）」，不得记绿 | `inspect` 观察行 | 票 03 裁定 5 |

## 改动

| 文件 | 改动 |
|---|---|
| `packages/qa/src/pixel.ts`（新） | 唯一阈值表 + `pixelIntegrity()`（度量 → error findings / observation lines）+ `withPixelFindings()`（用 `buildQAReport` 重建，不另造投影） |
| `packages/qa/src/index.ts:25` | 导出 `pixel.js` |
| `packages/pipeline/src/create-game.ts:31,554-575` | 把 `inspectData` 喂给 `pixelIntegrity`；观察行追加到 `inspect` 观察；用 `withPixelFindings` 把 error 挂回 QA 报告（在 `QAReportSchema` 校验之前） |
| `packages/qa/tests/pixel.test.ts`（新，13 条） | 24.9/25.0、-25.0、背景层、9.9/10.0、15/16 px、v7/tile-wall 观察档、unavailable、合并重复 |
| `packages/pipeline/tests/create-game.test.ts:876`（4 条） | 52.4% ⇒ error + 发布被拒 + 报告落盘；30% 色板外 ⇒ error；16.02% ⇒ 只观察、不阻断；无 sourceSizes ⇒ 「没跑」 |

### 测试夹具修正（只改测试，不改生产 / 真 fixtures）

新阈值**正确**地把三个包里的假上游判为坏例：它固定回 512×270 / 480×256，而提示词明确要求按目标比例出图
（实测 -29.7% / -62.5%）。假上游改为按提示词里的目标尺寸/比例出图：
`pipeline/tests/upstream.ts:49` · `cli/tests/cli-create.test.ts:33` · `mcp/tests/create-game-no-digest.test.ts:46`。
这是**夹具在模仿守规矩的上游**，不是放宽判据。

## 红 → 绿

| 运行 | 命令 | exit | 结果 | 日志 |
|---|---|---|---|---|
| 红（临时还原生产改动） | `pnpm vitest run packages/qa/tests/pixel.test.ts packages/pipeline/tests/create-game.test.ts` | **1** | **17 failed / 44 passed** | `red-demo-tests.log` · `red-demo-tests.exit` |
| 绿 | 同一条命令 | **0** | **61 passed** | `green-demo-tests.log` · `green-demo-tests.exit` |

17 条新用例**全部**在旧代码上红，无恒真用例。生产文件在红运行后已逐字节恢复（`cmp` 三条均 same）。

## 全量验证

| 命令 | exit | 结果 | 日志 |
|---|---|---|---|
| `pnpm test --reporter=dot` | 0 | **1772 passed / 114 files** | `full-test.log` · `full-test.exit` |
| `pnpm typecheck` | 0 | 全 workspace + shell tsconfig | `typecheck.log` · `typecheck.exit` |
| `pnpm build` | 0 | tsc -b + 各包 bundle | `build.log` · `build.exit` |
| `pnpm check:deps` | 0 | qa → contracts、pipeline → qa 均在白名单 | `check-deps.log` · `check-deps.exit` |

## 契约 / 批准状态

- **无** contracts / CLI / MCP / 依赖 / `inspectPack` 输出变更。
- 新增的是 `@game-maker/qa` 的工作区导出（`pixelIntegrity` / `withPixelFindings` / `PIXEL_INTEGRITY_THRESHOLDS`）；
  `pipeline → qa` 这条边本来就在 `check-deps.mjs` 白名单里。按 Q5 无需另行报批。
- 发布闸门未改：`assertQaPassed` 仍是唯一闸，只看 `severity: "error"`（票 09 的活）。

## 诚实边界

- **A+ 的 observation 档落在 `inspect` 观察行**：QA 契约的 `observations` 每个来源恰好一条，
  加第二个结构化来源会是契约变更；追加在既有 `inspect` 观察里既可见、又不影响裁决。
- `unavailable` 行只在 inspect **成功但没有 `sourceSizes`** 时出现；inspect 抛错时整条观察就是
  `outcome: "unavailable"` + reason（原有语义）。
- `checked` 仍为 5/6、`qaVerdict` 仍为 `incomplete`（第六条归票 08）；本票不碰。
- 未对真实包重跑阈值外的 `create`（零付费）；阈值分布依据票 03 的 7 包只读测量。
