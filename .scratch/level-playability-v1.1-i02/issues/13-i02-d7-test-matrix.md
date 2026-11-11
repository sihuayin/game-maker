# I02-D7 测试矩阵与证据口径裁定

Type: grilling
Status: open
Owner: —
Blocked by: 09, 10, 11
Map: ../map.md
Class: I-02 / DECISION

## Question

冻结 I-02 的测试矩阵、夹具、命令、性能与回归口径，使授权包中的验收条件可执行、可复核。

### 必须裁定

1. **核心场景矩阵**：I-02 §6.1 的 A–J 逐项落成测试意图、输入、预期结论。
2. **数值与边界测试**：严格重叠、相切、零面积接触、ε 两侧、方向切换、周期起终点/折返点、同速/近速、极短窗口、极短通道、临界门宽、负时间、无效周期、非有限数值、网格约束、预算刚好达上限。
3. **证明健全性反例**：网格细化、hop 加倍、部分路径、局部封锁、采样漏检。
4. **双档 lag 测试**：16.67ms / 200ms 分别完整分析；一致/不一致；不允许只保留乐观档。
5. **夹具策略**：内存合成 config / manifest / atlas vs 新 fixture pack；复用现有测试 helper；不得删除或放宽既有断言。
6. **命令**：`pnpm test`、定向 vitest、scratch 复现命令；CI 落位（若授权包不接 CI，写明）。
7. **性能口径**：语料、阈值、环境；区分「证据」与「验收」；P0 数字不得当预算。
8. **回归口径**：既有 vitest 全绿；LP-06/07 scratch 复跑一致；不转 vitest 的已知限制。
9. **AC 映射**：I-02 §9 的 AC-01～AC-13 逐条对应测试证据。
10. **证据格式**：E1/E2/E3；不落盘生产证据链。

### 产出

票内 `## Answer`：测试矩阵表 + 命令清单 + AC 映射。

### 下游

I02-AUTH。

## 上游裁定（D8，2026-11-11）

测试矩阵按 R1–R4 逐项映射；每道复核门必须有可执行命令、退出码与逐项 PASS/FAIL；R2 PASS 不等于 U3/U4 授权；R4 PASS 不等于公共 NB/PU 能力授权。


## 上游裁定（D5，2026-11-11）

测试矩阵必须覆盖：工作预算触顶、墙钟 abort、`phaseGridCapped`、非法预算 / 派生上界溢出、双档「不完整」与「不一致」分开、确定性复跑（关闭墙钟）、累计 cut、Witness 体积。基准证据按 [I02-D5](11-i02-d5-budget-determinism.md) §9.2 记录；`maxCutsPerBranch` 由 [I02-D5B](21-i02-d5b-cut-budget-benchmark.md) 提供。

## 上游裁定（D6，2026-11-11）

- 测试文件：新增 `packages/contracts/tests/playability-temporal*.test.ts`，**只新增**；可拆成 `playability-temporal-motion.test.ts` / `-witness.test.ts` 等，便于 R1–R4 逐单元定位；不得修改 `playability-temporal-input.test.ts`（含 T-55～T-65 与 I-01 矩阵）。
- 夹具内存优先；需真包时只读复用 `fixtures/packs/last-train/v2`；不新增 `fixtures/packs/**`（需单独 HITL）。
- 三角波 cross-check 可在测试中用 `node:fs` 只读 `packages/demo/src/hazard.ts` 文本。
- I-02 不接生产：测试直接调用内部 analyzer，`ops.ts` / T-57 / T-58 / T-61 原样。
- 新模块须避开文本扫描陷阱：不得出现 `analyze:` 属性标签（T-58）、不得调用 `auditPlayabilityTemporal(`（T-57）、不得出现 `Symbol(`（T-64）、不得导出 `TEMPORAL_LAG_*` 同名常量（T-62）。
