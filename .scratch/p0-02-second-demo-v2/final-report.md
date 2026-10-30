# P0-02 v2 · 阶段 A 最终报告

- 日期：2026-10-30
- 地图：[map.md](map.md)
- 代码基线：HEAD `f0411e676309fede8f20b79d9f8e44e5ac479ef6` + 本 effort 未提交的工作树改动（按地图提交纪律，收口前未 commit / push）。
- 最终冻结：`freeze/wasteland-scavenger-recipe/`（112 文件，只读）
- 正式清单：`manifest/final-manifest.json`（231 文件 / 6 records，sha256 `07866e0e…b9ab`）
- verify-delivery：**pass**，诊断 0（`runs/final-verify/2026-10-30T04-54-52-237Z-delivery-verification/report.json`）
- 最终结论：**阶段 A 关闭（含已知限制）；阶段 B 仍 blocked，未授权付费。**

## 1. 逐缺口结论

| # | 缺口 | 状态 | 关键证据 |
|---|---|---|---|
| 1 | 覆盖门禁核验 config + probe，并落盘可审计报告 | **closed** | `mechanic-coverage/v2`（config 层 + probe 块 + subject）；`verify-mechanics` E3 exit 0 / 14s；冻结 Demo 读数 pickup=4 / chest=2 / hazard=2；probe 3/3；`verify-delivery` 内容核验（[08](research/08-coverage-gate-evidence.md)） |
| 2 | hazard 真实、明确的正向断言 | **closed** | probe-only：hazard 命中计数 + `READ_STATE.hits` + `hazard-contact`；生产 probe exit 0 / 2s、全量 4/4；冻结脚本原样 config exit 0 / 9s，hits=1、复位、快照零改动（[09](research/09-hazard-assertion-evidence.md)） |
| 3a | 写回前校验 Demo 身份 | **closed** | Playtest 写回强制 config/pack checksum + harness/rules v2；旧 harness v1 报告被拒；`review-verdict` 必填 `visual-review-record/v1`、记录权威、subject/overall 校验（[10](research/10-writeback-identity-evidence.md)） |
| 3b | 失败重跑不遗留旧 pass | **closed** | 撤销 + 预失效：移除 `delivery.playtest`/旧 `playtest-*`、`playable-smoke=blocked`、invalidation 记录；准备拒绝 E3 exit 4 已先撤销；成功恢复 E3 exit 0 / 19s（[11](research/11-rerun-revocation-evidence.md)） |
| 4 | 补齐 HEAD harness/rules v2 写回 E3 | **closed** | 阶段 A 副本真实 playtest exit 0 / 20s / attempt v3；`harnessVersion=playtest-harness/v2`、`rulesVersion=playtest-rules/v2`；`site-integrity.unchanged=true`；`playable-smoke=pass`、`verdict=pass`（[14](research/14-playtest-v2-writeback-e3.md)） |
| 5 | 默认 Playtest 场景与废土常量解耦 | **closed** | 默认目录只服务 `wasteland-scavenger-recipe v1`；非默认 Demo E3 exit 4 + 诊断；默认 wasteland E3 exit 0 / 19s（[12](research/12-default-scenario-evidence.md)） |
| 6 | 正式证据清单 + `verify-delivery` 生产路径 | **closed** | `build-evidence-manifest` + spec 生成核心；最终清单 231 文件 / 6 records；`verify-delivery` exit 0 / pass / 诊断 0；声明↔重算六项一致（[13](research/13-manifest-production-evidence.md)） |

## 2. 回归三件套

| 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|
| `pnpm test` | 0 | 30s | 155 文件 / **2279 tests** 全绿 |
| `pnpm typecheck` | 0 | 10s | 全部 package 通过 |
| `node scripts/evidence-acceptance.mjs --out .scratch/p0-02-second-demo-v2/runs/evidence` | 0 | 2s | 历史清单 223 文件 / 13 records / 诊断 0 |

无超时，未触发隔离重跑。

## 3. 冻结与交付身份

- 冻结快照：`freeze/wasteland-scavenger-recipe/`，**112 文件**，`chmod -R a-w`；逐文件 sha256：`freeze-sha256.txt`（112 行）。
- 交付身份（freeze 内 qa-report）：
  - `packId=wasteland-scavenger-recipe` · `packVersion=1` · `siteVersion=1` · `shellVersion=2`
  - `manifestChecksum=sha256:a162942d…7feb3` · `configChecksum=sha256:455d9c7f…7dcd`
  - `delivery.playtest.report=…/playtest/v3/result.json` · `playable-smoke=pass` · `verdict=pass`
  - 结果身份：`harnessVersion=playtest-harness/v2` · `rulesVersion=playtest-rules/v2`
- 正式清单：`manifest/final-manifest.json`，231 文件（required 137 / optional 94）· 6 records；sha256 `07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab`。
- `verify-delivery`：pass，diagnostics fail 0 / blocked 0；声明 pass ↔ 重算 pass；六项一致。
- `mechanic-coverage` record：format v2 / `probe.executed=true` / `verdict=satisfied` / subject 与清单一致。

## 4. 历史零改动与零付费

- 旧 work：95/95 文件哈希未变；冻结快照：66/66 未变。
- 阶段 A 可写副本原有 95 文件中仅 `run/v1/qa-report.json` 被票 14 写回改变；旧 v2 attempt 保留，v3 新增，invalidation 记录新增。
- 覆盖报告 `run/v1/mechanic-coverage.json` 未变（票 08 产物）。
- 未写旧 `p0-02-second-demo` effort、历史 run/pack/site/delivery、冻结快照。
- 零模型/生图/付费调用：playtest/probe 只用本地 Chrome；`pnpm build` 只写 gitignored `dist/` 与 `*.tsbuildinfo`。
- 未提交、未推送。

## 5. 已知限制

1. 阶段 A 的 E3 只证明冻结 `wasteland-scavenger` Demo；不外推到第二个独立 Demo。
2. 阶段 A 不做新人工视觉（Q9）；清单中的 `visual-review` 是旧 effort 记录的历史身份绑定，不声称本轮新视觉通过；`review-verdict` 只有 E2。
3. `create`/`build` 的覆盖报告写盘路径由代码 + pipeline/CLI 测试覆盖；未在冻结副本上重跑 `create/build`（会触碰生成链/付费上游），没有该路径的真实 E3。
4. 无结果 / 硬崩溃的撤销由单元测试覆盖；真实 E3 覆盖准备拒绝与成功恢复。
5. probe 使用 last-train 夹具与合成 config；冻结脚本用只读快照的原样 config。
6. `verify-delivery` 的 `mechanic-coverage` 内容核验只在清单声明该 record 时生效；阶段 A 最终清单已声明。
7. 最终清单纳入旧 work 94 个 optional 历史材料（`materials.json` 自述）；不是本轮新产物。
8. 默认场景身份是 `packId + packVersion + siteVersion`；同版本内容漂移不在识别范围。
9. 未把阶段 A 正式清单接入 `test:evidence` / CI；仍属后续集成决策。

## 6. 阶段 B

- 票 16「阶段 B 启动闸」因本票关闭而**解锁**，但**未授权付费**。
- 启动仍需 HITL 同时满足：明确预算与单次成本上限、明确付费执行授权、明确执行护栏与停止条件、确认阶段 A 证据足以支撑第二个 Demo 试跑。
- 本图未调用任何付费服务。
