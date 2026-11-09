# I00-04 lagMs 来源与传递路径

Type: research
Status: open
Owner: —
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
