# Design-to-Config Residual Gaps P1：A 类七项实施

Labels: wayfinder:map
Tracker: local-markdown
Effort: design-to-config-residual-audit-v1-p1
Blocked by: 无（P1 已批准）
Predecessor: [`design-to-config-residual-audit-v1`](../design-to-config-residual-audit-v1/map.md)

> **2026-11-03 开图并完成。** 前置：[P0 最终报告](../design-to-config-residual-audit-v1/final-report.md) §7 的五个审批问题；
> 用户当日逐项批准：**全量七项**（Q1+Q3+Q4 → Q5 → Q6 → Q8 → Q11）与**两项契约变更**
> （`ConfigIssue.code` 三码、`GameDesignSpecSchema.resources ≥ 1`）。
>
> **实现完成、测试全绿、零付费。** 证据见 [report.md](report.md)。

## Destination

把 P0-B 的 A 类七项从方案落成生产代码与回归测试：在**不新增包、不改 Runtime、不改 CLI/MCP 对外形状**的前提下，
让「五错同族的其余形态」在正确的阶段被确定性地拦住。

## Decisions so far

- **Q1 · 实体槽位 kind 锁**：`ENTITY_ASSET_KINDS`（`contracts/src/game-config.ts`）作为单一来源；
  `solid → sprite`，`pickup/hazard/goal/chest/danger → sprite|animation`，`decor` 不加锁。
  `auditReferences` 的实体循环按它取 allowed kinds，错误带 `code: "entity-asset-kind"`。
- **Q3 · chest/danger 状态帧**：解析成功后 `frames.length < 2` ⇒ error，`code: "entity-state-frames"`。
  判据直接对应外壳的 `openFrame` / `activeFrame`（最后一帧）。
- **Q4 · 九宫格下界**：`auditPanelSize` 的九宫格分支不再直接放行；判「中央区放得进资源」与
  「声明尺寸 ≥ 边框和」，错误 `code: "hud-panel-size"`。横版与塔防共用。
- **Q5 · 统一复验入口**：新增纯函数 `auditConfigPipeline(config, ctx)`，返回
  `{ resampleable, deterministic }`；`compileRuntime` 两处审计调用改走它，
  `runBuild` 在 config 读回后的**汇合点**调 `deterministic`（`reuseConfig` 与编译两条路径同入口）。
- **Q6a · HUD 闸无条件**：`hudUiGate` 删除 `hud:screen-space` 提前返回；清单提示词同步无条件要求两件 ui。
- **Q6b · 设计至少一条 resource**：`GameDesignSpecSchema` 的 `superRefine` 增加 `resources.length === 0` ⇒
  path `["resources"]` 的 `schema` 失败（`compile-design` 现有重采样路）。
- **Q8 · 覆盖闸看 kind**：`DESIGN_BUCKET_ASSET_KINDS` 由 `DESIGN_BUCKET_KINDS` + `ENTITY_ASSET_KINDS` 派生
  （`npcs`/`decor` 豁免）；`designCoverageGate` 先判覆盖存在（原错误不变），再判覆盖者的 kind。
- **Q11 · 回归测试**：新增 27 条正/负/边界用例，覆盖 E02/E03/E04 与七项新判据。
- **Contract changes**：`ConfigIssue.code?: ConfigIssueCode`（闭集三码，不 retrofit 既有构造点）；
  `GameDesignSpecSchema.resources ≥ 1`。其余契约/CLI/MCP/落盘产物/Runtime 未改。

## Out of scope（与 P0 地图一致）

- B 类（sprite 语义/`role`、reachability 并入 compile、地形/斜坡限制）、D 类（上游诊断/盲重采样、
  viewport/role 贯通、设计 goal 桶）—— 仍冻结或另立 effort。
- 多关卡 `levelId` 贯通、site 装配期第三套口径：本图未做（`runBuild` 与 `compileRuntime` 一致取 `levels[0]`）。
- 付费链、真实生图、重新生成 Demo、推送 main。
