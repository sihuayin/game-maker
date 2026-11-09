# I00-04 lagMs 来源与传递路径

Type: research
Status: resolved
Owner: research subagent · 2026-11-09
Blocked by: 01
Map: ../map.md
Class: I-00 / EVIDENCE

## Question

G-02 要求 `lagMs` 显式、可审计、保留两档敏感性，且不得把研究假设当成已测的生产延迟。P0 用 `lagMs = 200ms` 锚定 Phaser `delta ≤ 200ms`；现有 auditor 没有任何 lag 入口。

### 必须回答

1. **200ms 依据是否仍成立**：`minFps=5` 与 `smoothStep` 的源码位置与 Phaser 版本；当前 `packages/demo/node_modules/phaser` 版本是否与 P0 核验时一致。
2. **可达输入**：auditor 能从哪里拿到帧间隔上界——`FixedRuntimeProfile`、game config、运行期配置、还是只能由调用方传参？逐条给 `file:line`。
3. **两档取值**：16.67ms 与 200ms 分别代表什么（标称 60fps vs 源码上界）？应如何解释给使用者？是否应改为「必填 + 默认」。
4. **若必须扩展公共输入**：扩展面有多大（`auditPlayability` 签名 / `auditConfigPipeline` / CLI / MCP / publish gate / `compile-runtime`），哪些步骤需要 PRD §9.2 的独立授权。
5. **误判方向**：lag 取得过小会假阳（把可通行的关卡判成永久封锁），取得过大会假阴。用 P0 的 B 门（`[548,592]`）说明这个权衡的敏感度。

### 产出

`evidence/04-lagms-source.md`：源码依据 + 可达输入矩阵 + 扩展面清单。**不实施。**

## Answer

调查已收口；证据见 [`evidence/04-lagms-source.md`](../evidence/04-lagms-source.md)，重算脚本 [`scripts/lagms-sensitivity.mjs`](../scripts/lagms-sensitivity.mjs)。未做裁定（留给 I00-R1）。

- **200ms 依据仍成立且未漂移**：`packages/demo/node_modules/phaser` 为 `3.90.0`，`pnpm-lock.yaml:641` 与 P0 记录（`../level-playability-v1.1-p0/evidence/01-moving-hazard-semantics.md:17`）一致；`c6424c2..HEAD` 对 `packages/demo/src`、`pnpm-lock.yaml`、`packages/demo/package.json` 的 diff 为空。外壳 `packages/demo/src/shell/entry.ts:75-85` 未提供 `fps`，故走 Phaser 默认 `minFps=5`（`TimeStep.js:99`）⇒ `_min=200ms`（`:174`）⇒ `smoothDelta` 截断（`:576-585`）。
- **200ms 的准确语义是「默认 smoothStep 下、单次 `scene.update` 的 game-time delta 上界」**，不是墙钟帧间隔上界，也不是生产实测延迟。16.67ms 是标称 60fps（`TimeStep.js:113,186`，也是失焦 clamp 值 `:569-574`）；94ms 只是 P0 四轮 trace 的观测间隔（`03-case-comparison.md:29-37`）。三者不是同一量。
- **今天 auditor 没有任何生产可达的 lag 输入**：`FixedRuntimeProfile`（`profile.ts:37-47`）只有碰撞语义；`GameConfig`（`game-config.ts:234-244`）无 fps；运行期 `fps` 不可由契约读取；`auditPlayability`（`api.ts:64-68`）与 `auditConfigPipeline`（`config-audit.ts:28-37`）都没有 lag 参数。唯一能确定 200 的路径是「读 Phaser 默认值 + 读外壳未覆盖 fps」的人工推导，不可机读、不可覆盖。现有唯一帧时间实现值是 `FRAME_MARGIN_MS = 1000/60`（`mechanic.ts:62`，用于 `:226,:245`），它既不是 lag 上界，也正是 FR-04:151 要避免的「隐式写死」形态。
- **两档是敏感性支架，不是点估计**：16.67ms = 标称/乐观档，200ms = 源码上界/保守档；结论应报告「在 16.67–200ms 区间内是否翻转」。在类型层「必填」与「默认」互斥（有默认即可选）；可在层级上共存，至少三种分层方案（核心必填 / 核心默认 200 / 产品边界必填+核心显式），代价与 G-02、PRD:149、PRD:344 的取舍已列在证据 §3.2。
- **扩展面收敛但全在 §9.2 授权范围**：`auditPlayability` 只有 2 个直调点（`config-audit.ts:53`、`publish-gate.ts:140`），`auditConfigPipeline` 只有 3 个（`assets/ops.ts:1247,1284`、`pipeline/create-game.ts:631`）；但任一签名/输出变化都落在 contracts，并牵动 Pipeline、CLI、MCP（清单见证据 §4）。**不需要新依赖**；也**不需要**改 Runtime（除非要声称 lag 来自运行期配置而非 Phaser 默认值）。最小面是「contracts + 输出」，全链面还需 CLI/MCP 公开 flag。
- **误判方向取决于交集/并集，不能混用**：P0 的永久封锁门不读 `lagMs`，B 门 `[548,592]` 在 0–200ms 全区间不翻转；若把扫掠带 pad 错并进交集门，门宽为 `44 − 2·pad`，200ms 时仍有 36px（归零需 1100ms），结论仍不翻。任务书「取小假阳 / 取大假阴」对应的是「pad 并入交集门」这一反事实；P0 实际的安全 witness（并集）方向相反：lag 过小会漏掉真实碰撞（假阴），过大才会误判不可玩。证据 §5.1 已把三种方向并列，供 I00-R1 对齐口径。
- **元信息**：本票未修改 `packages/**`、`docs/**`、`fixtures/**`、P0 目录、其他票或 `map.md`；未 commit / push；零付费。重算脚本退出码 0，命令与版本见证据 §6。
