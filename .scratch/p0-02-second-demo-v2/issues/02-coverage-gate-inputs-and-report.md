# 覆盖门禁：config + probe 输入与报告契约

Type: grilling
Status: resolved
Blocked by: （无）

## Question

HITL：覆盖门禁当前只读 `design.mechanics`，生产调用不传 probe，缺省把 `collect-pickup / open-chest / avoid-danger` 当 `passed`，不读 config，也不落盘（`packages/pipeline/src/create-game.ts:644-650`；`packages/contracts/src/mechanic-coverage.ts:74-101`）。请裁定三件耦合的事：

1. **probe 结果从哪里来？**
   - (a) 生产 `create` 内运行浏览器 probe；需要在站点装配前拿到 probe，可能改变门禁时序。
   - (b) 独立 `verify-mechanics` 命令在站点装配后运行 probe，写覆盖报告；`create`/发布闸消费报告；缺报告时 qa 为 `not-tested`，绝不再默认 `passed`。
   - (c) 生产不跑 probe；缺 probe 一律 `not-tested`，只保留 design/runtime/config 三层。
2. **config 层怎么表达？**
   - (a) `mechanic-coverage/v2` 增加 `config` 层（机制 → 必需 entity kind 的检查结果），显式可审计。
   - (b) 保持 `mechanic-coverage/v1`，另出独立 config 检查产物。
   - (c) 把 config 结论折进现有 `runtime` / `qa` 状态，不新增层。
3. **报告落在哪里？**
   - (a) `run/vN/mechanic-coverage.json`，并显式列入证据清单，供 `verify-delivery` 核验。
   - (b) `qa-report.json` 顶层新增字段（`QAReportSchema` 是 strict，属于契约变更）。
   - (c) 只放进 `delivery.evidence[]`，不单独落报告。
4. **契约/CLI 批准**：若选择需要扩 `mechanic-coverage` schema 或新增 `verify-mechanics` CLI，是否在本票明确批准？（Q5 边界：默认不改公共契约/CLI。）

已知事实：`mechanic-coverage/v1` 与 `qa-report/v1` 都是 strict schema；新增独立 `run/vN/mechanic-coverage.json` 不改 qa-report schema，但会改变运行产物清单，必须显式进证据清单才会被核验；probe 需要已装配站点，而门禁位于站点装配之前。

建议（待裁定）：**1(b) + 2(a) + 3(a) + 4 批准** —— 独立 `verify-mechanics` 在站点装配后运行 probe，写 `mechanic-coverage/v2`（design/runtime/qa/config + probe 证据）到 `run/vN/`；`create`/发布闸消费报告，缺 probe 时 `not-tested`，不再默认 `passed`。理由：既真正核验 config 与 probe，又不把 Chrome 依赖塞进 `create`，且报告可审计、可进清单。

产物：票内 Answer + 追加 `rulings-2026-10-29.md`。未裁定前不写生产代码。

## Answer

**2026-10-29 HITL 收口。** 逐字裁定见 [rulings-2026-10-29.md 第 4 节](../rulings-2026-10-29.md)。

### 事实修正

`mechanic-probe.mjs` 自带夹具（`fixtures/packs/last-train/v2` + 合成 config），只依赖 `packages/demo/dist` 与系统 Chrome，**不依赖本游戏装配出的 site**。因此时序不是主要约束；选 (b) 的真正理由是 Chrome 不应进入 `create` 的生成路径。

### 已定契约

| 项 | 决定 |
|---|---|
| probe 来源 | 独立 `verify-mechanics`；`create` 不跑 Chrome |
| 门禁分工 | `create` 门禁阻断 design/runtime/config；缺 probe → `qa=not-tested`，绝不默认 `passed` |
| 发布强制 | 声称 pass 的交付必须携带 probe 报告，由正式清单 + `verify-delivery` 强制 |
| 报告格式 | `mechanic-coverage/v2`：`subject` + `mechanics[{mechanic,design,runtime,config{status,requiredEntityKinds,found},qa}]` + `probe{executed,ranAt?,summaryPath?,results}` + `verdict` |
| 报告位置 | `run/vN/mechanic-coverage.json`；probe 摘要 `run/vN/mechanic-probe/summary.json` |
| config 状态 | 仅 `satisfied` / `missing`；未映射机制记 `not-tested`（不阻断、可见） |
| 机制映射 | `run`/`jump`/`gravity` 空要求；`collide-terrain`→terrain 非空；`collect-pickup`→≥1 pickup；`moving-platform`→≥1 motion.kind=cycle；`hazard-contact`→≥1 hazard；`reach-goal`→≥1 goal 且 objective=collect-then-reach；`open-chest`→≥1 chest；`avoid-danger`→≥1 danger 或 ≥1 hazard |
| verdict | 沿用 v1：design/runtime/config 非 satisfied 或 qa failed ⇒ failed；`not-tested` 不阻断；是否跑过 probe 由 `probe.executed` 单独表达 |
| create 写报告 | 门禁处内存计算；站点装配成功后写 v2（`probe.executed=false`、`qa=not-tested`）；同一 run 重跑 `build` 一律重置，不复用旧 probe |
| verify-mechanics | `game-maker verify-mechanics <runDir> [--json]`；身份不符/缺失 → exit 4 且不写报告；probe 环境失败或任一 probe 红 → exit 1 且写真失败报告；全绿 → exit 0 |
| 缺 probe 结果 | 设计声明了 `QA_PROBED_MECHANICS` 中的机制但 summary 缺对应结果 ⇒ `qa=failed` + exit 1；`not-tested` 只用于本来没有行为级 probe 的机制 |
| API | `buildMechanicCoverage(design, config, probeResults?)` 直接升级返回 v2；同步更新调用方与测试；生产代码不保留 v1 解析器 |
| verify-delivery | 新增 `mechanic-coverage` 角色内容核验：`format=mechanic-coverage/v2`、`probe.executed=true`、`verdict=satisfied`、`subject` 中 pack/config 身份与清单 subject 一致；缺失/格式/身份/语义任一不符 ⇒ fail |
| 批准例外（Q5 边界内） | ① `mechanic-coverage/v2`；② 新增 `verify-mechanics` CLI；③ 不改 `qa-report` schema、不扩 MCP、不新增依赖；④ `verify-delivery` 仅新增 `mechanic-coverage` 角色的内容核验 |

### 实现义务（已回写下游票）

- [覆盖门禁实施](../issues/08-coverage-gate-implementation.md)：v2 计算/落盘、`verify-mechanics`、缺 probe 结果判 failed、`verify-delivery` 内容核验、先红测试。
- [清单生产实施](../issues/13-manifest-production-implementation.md)：正式清单把 `run/vN/mechanic-coverage.json` 列为 required，并登记 `role=mechanic-coverage` 的 record。
