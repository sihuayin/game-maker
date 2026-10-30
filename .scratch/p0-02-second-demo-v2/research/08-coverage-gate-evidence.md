# 票 08 · 覆盖门禁实施证据（config + probe + 可审计报告）

- 日期：2026-10-30
- 票：[覆盖门禁实施](../issues/08-coverage-gate-implementation.md)
- 上游裁定：[票 02](../issues/02-coverage-gate-inputs-and-report.md) · `rulings-2026-10-29.md` 第 4 节
- 结论：**实现 + E2 全绿 + E3（真实免费 probe）通过**。零付费；未提交；旧 work / 冻结快照 / 历史清单零改动。

## 1. 红：改动前的缺陷

改动前的事实（[00-stage-a-facts.md](00-stage-a-facts.md) §4 / §8，HEAD `f0411e6`）：

- `buildMechanicCoverage(design)` 只读 `design.mechanics`，不读 config；生产调用 `create-game.ts:647` 不传 probe。
- `probeResults` 为空时 `defaultProbed` 把 `QA_PROBED_MECHANICS` 全当 `passed`（旧 `mechanic-coverage.ts:79-81`）。
- 门禁只在 design/runtime 非 satisfied 或 qa failed 时阻断；`not-tested` 不阻断，但空缺被默认 passed 掩盖。
- `verify-delivery` 没有 `mechanic-coverage` 角色的内容核验。

本轮新增的测试把上述行为逐条取反（config 缺失、未跑 probe、probe 结果缺失、内容核验失败）。
⚠️ 诚实说明：实现与测试在同一会话完成，**没有保留改前代码的独立失败运行日志**；红状态由上述事实快照（file:line）与测试断言共同固定，不以「测试从红变绿」的数量作为验收。

## 2. 绿：实现内容

### 2.1 契约（`packages/contracts/src/mechanic-coverage.ts`）

- 升到 `mechanic-coverage/v2`：`subject`（六字段）+ `mechanics[{design,runtime,config,qa}]` + `probe{executed,ranAt?,summaryPath?,results}` + `verdict`。
- config 层：`{status: satisfied|missing|not-tested, requiredEntityKinds, found}`；映射：
  - `run/jump/gravity` 空要求；`collide-terrain`→terrain；`collect-pickup`→pickup；`moving-platform`→motion:cycle；
  - `hazard-contact`→hazard；`reach-goal`→goal + objective:collect-then-reach；`open-chest`→chest；`avoid-danger`→danger 或 hazard。
- `buildMechanicCoverage(design, config, probeResults?)`：
  - 不传 probeResults ⇒ `probe.executed=false`、所有机制 `qa=not-tested`，**不再默认 passed**；
  - 传 probeResults（含空数组）⇒ `executed=true`；设计声明的 `QA_PROBED_MECHANICS` 机制缺结果 ⇒ `qa=failed`。
- 门禁：design/runtime 非 satisfied、config `missing`、qa `failed` 阻断；`not-tested` 不阻断。
- 生产代码不保留 v1 解析器。

### 2.2 生产接线

- `create-game.ts`：门禁调用改为 `buildMechanicCoverage(design, config.value)`；`BuildResult.coverage` 返回核心。
- `cli.ts` `buildAndSite`：站点装配成功后写 `run/vN/mechanic-coverage.json`（v2，`probe.executed=false`），再由 `verify-mechanics` 原子重写；重跑 build 一律重置 probe。
- 新 `packages/pipeline/src/mechanic-coverage.ts`：subject 计算（pack checksum 用 `manifestChecksumOf` 重算）、报告原子写/读、probe 摘要复制、subject 比对。
- 新 `packages/cli/src/verify-mechanics.ts` + CLI 命令：
  - 读 run 的 pack/config/design/site，重算并校验身份；不合法 ⇒ exit 4，不写报告；
  - 跑 `mechanic-probe.mjs`（last-train 夹具、本地 Chrome、零付费）；probe 摘要复制到 `run/vN/mechanic-probe/summary.json`；
  - 写报告；probe 失败/缺结果/verdict failed ⇒ exit 1，报告照写；全绿 ⇒ exit 0。
- `evidence-integrity.ts`：当清单出现 `role=mechanic-coverage` 记录时，核验 `format=v2`、`probe.executed=true`、`verdict=satisfied`、subject 六字段与清单 subject 一致；不一致 ⇒ consistency fail。
  - ⚠️ 记录**缺席**时不判失败：历史清单没有该角色，强制要求会把历史验收打红；正式清单生成（票 13）负责写入 required record。

### 2.3 测试

- `packages/contracts/tests/mechanic-coverage.test.ts`：13 tests（四层矩阵、config 映射、no probe/缺结果、v2 schema）。
- `packages/pipeline/tests/create-game.test.ts`：新增构建返回覆盖核心、`probe.executed=false`、config 读数来自实际 config（50 tests 全绿）。
- `packages/pipeline/tests/evidence-integrity.test.ts`：新增 3 条内容核验负例 + 默认 fixture 含合法 coverage record（21 tests 全绿）。
- `packages/cli/tests/verify-mechanics.test.ts`：6 tests（用法/缺 qa/无 delivery/无 site/包身份不符，均在 probe 前失败，不启 Chrome）。
- `free-acceptance.mjs`：更新 v2 调用（fixture config + 四层检查），输出改为 `mechanic-coverage.core.json`（核心无 subject）。

## 3. E3：真实免费运行

命令（cwd = 仓库根，`pnpm build` 之后）：

```
node packages/cli/dist/cli.mjs verify-mechanics \
  .scratch/p0-02-second-demo-v2/work/wasteland-scavenger-recipe/run/v1 \
  --out .scratch/p0-02-second-demo-v2/work
```

- 退出码：**0**；耗时：14s；日志：`runs/ticket08-verify-mechanics.log`
- 报告：`.scratch/p0-02-second-demo-v2/work/wasteland-scavenger-recipe/run/v1/mechanic-coverage.json`
- 摘要：`.../run/v1/mechanic-probe/summary.json`（`allOk=true`，Chrome 156.0.8078.48）
- 身份（与冻结快照一致）：
  - `packId=wasteland-scavenger-recipe` · `packVersion=1` · `siteVersion=1` · `shellVersion=2`
  - `manifestChecksum=sha256:a162942de2a65a549be6958f0739f900df0625e0fa957872425bd9a53aa7feb3`
  - `configChecksum=sha256:455d9c7fc982e4d4c3c5b32ff4a94f1dd99f5e85b8adcb0f59af521f3b757dcd`
- 结果：`verdict=satisfied`；probe 3/3 通过（collect-pickup / open-chest / avoid-danger）。
- 四层读数：
  - `collect-pickup`：config pickup=4，qa satisfied
  - `open-chest`：config chest=2，qa satisfied
  - `avoid-danger`：config danger=0 / hazard=2（任一即满足），qa satisfied
  - `run` / `jump`：config 空要求 satisfied，qa not-tested
- `qa-report.json` 写回前后 sha256 均为 `dc20e3013044ddac0f9dc6c720384945448628dd628db369da4d6b98d66c5ee6`（**未改 qa-report**）。

## 4. 回归三件套

| 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|
| `pnpm test` | 0 | 29s | 150 文件 / 2248 tests 全绿 |
| `pnpm typecheck` | 0 | 10s | 全部 package 通过 |
| `node scripts/evidence-acceptance.mjs --out .scratch/p0-02-second-demo-v2/runs/evidence` | 0 | 2s | 223 文件 / 19.3 MB / 13 records / 诊断 0；历史清单无 coverage record，仍 pass（向后兼容） |

定向测试：4 文件 / 90 tests 全绿（contracts 13 · evidence-integrity 21 · create-game 50 · verify-mechanics 6）。

## 5. 历史与零付费

- 旧 work 95/95、冻结快照 66/66 逐文件 sha256 未变；本 effort 可写副本原 95 文件全未变。
- verify-mechanics 在副本新增两个文件：`run/v1/mechanic-coverage.json`、`run/v1/mechanic-probe/summary.json`；未改 pack/site/config/qa-report。
- 未调用模型/生图/付费上游；probe 只用本地 Chrome 与 last-train 夹具。
- 未提交、未推送。

## 6. 已知限制

1. `create`/`build` 报告写盘路径由代码 + pipeline 集成测试覆盖；**没有在冻结副本上重跑 build**（会触碰生成链/付费上游），因此本轮 E3 只覆盖 `verify-mechanics`，不声称 create 写盘路径的 E3。
2. `verify-delivery` 的内容核验只在清单声明 `role=mechanic-coverage` 时生效；历史清单缺席时不判失败。阶段 A 正式清单（票 13）负责写入 required record。
3. probe 使用 last-train 夹具与合成 config（票 02 Q7），证明外壳能力；不直接证明冻结 Demo 的 2 个 hazard（hazard 专项由票 09 的冻结脚本补 E3）。
4. 设计未声明的机制不进入报告；probe 仍会运行 `QA_PROBED_MECHANICS` 全部条目，失败会以 exit 1 暴露，但报告 verdict 只按设计声明机制计算。

## 7. 变更文件

- `packages/contracts/src/mechanic-coverage.ts`
- `packages/contracts/tests/mechanic-coverage.test.ts`
- `packages/pipeline/src/artifacts.ts`
- `packages/pipeline/src/create-game.ts`
- `packages/pipeline/src/mechanic-coverage.ts`（新）
- `packages/pipeline/src/evidence-integrity.ts`
- `packages/pipeline/src/index.ts`
- `packages/pipeline/tests/create-game.test.ts`
- `packages/pipeline/tests/evidence-integrity.test.ts`
- `packages/cli/src/cli.ts`
- `packages/cli/src/verify-mechanics.ts`（新）
- `packages/cli/tests/verify-mechanics.test.ts`（新）
- `packages/demo/probe/free-acceptance.mjs`
