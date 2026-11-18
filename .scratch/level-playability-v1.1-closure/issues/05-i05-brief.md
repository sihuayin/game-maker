# I-05 Pipeline 验收与最终收口报告 brief

Type: grilling
Status: open
Owner: —
Blocked by: 01, 02, 04, 10
Map: ../map.md
Class: V1.1-CLOSURE / UNIT-BRIEF

## Question

冻结 I-05 的 Pipeline 验收与最终收口报告。I-05 是**验收/证据阶段**，不新增算法（Q4=A）。

必须裁定：

1. **真实案例选择**：只从现有 21 configs / 19 moving hazards 筛选（Q8=A）；至少覆盖 NB / PU / IE 各一例；给出选择规则、候选清单来源、若某类缺失如何处理（另开 fixture 授权票，不在 I-05 内新建）。
2. **Pipeline 路径口径**：当前 `create` 只接通 temporal 但不消费（legacy stub，结果被丢弃）、`publish-gate` 只作诊断不参与放行、`qa-report` 无 temporal 字段（见 `01-coverage-inventory` §2.2）。I-05 必须裁定「Pipeline 验收」是证明「诊断存在且不误伤」还是「时序结果参与决策」；后者可能超出 I-03 范围 ⇒ STOP/HITL。是否必须走付费上游（若否，用 fixture/import 路径）。
3. **证据**：每个案例的输入、命令、退出码、产物、qa-report、playability verdict、时序诊断、确定性/重复运行、构建/测试报告；证据落点与格式。
4. **最终收口报告**：固定路径 `.scratch/level-playability-v1.1-closure/reports/V1.1-closure.md`；必须包含支持范围、限制、已知问题、残余风险、能力声明、DoD 追溯矩阵引用；谁签署、签署后闭合什么。
5. **验收判据**：逐项 `PASS / FAIL / NOT_RUN`；退出码；什么情况判 INCOMPLETE；不得用通过率替代。
6. **与 I-04 / PU-ADMIT 的关系**：I-05 消费 I-04 的回归结果与 PU-ADMIT 的六条件资格，不重复跑。

产出：I-05 unit brief；不实施、不跑 Pipeline、不写最终报告。

## Context（`10-i05-temporal-fixtures` 裁定，2026-11-18）

- I-05 要求**真实时序 NB / PU / IE 各一例**；案例由收口包 **FIX 单元**（`docs/v7.8/移动-收口.md` §5.1）生产，不在 I-05 内自建。
- I-05 启动前置：I-04 合并 / 签署 / Ledger + FIX 合并 / 签署 / Ledger。
- FIX `INFEASIBLE` / 失败 ⇒ I-05 与 closure 均为 `INCOMPLETE`；DoD「Pipeline 真实流程验收通过」保持未勾选；最终报告显式写「时序能力未在真实关卡验证」。
- 禁止用静态层 NB/PU 或合成 `PU_WORLD` 冒充真实案例；同一证据只服务一个结论（FIX 的 PU witness 归 I-05）。
