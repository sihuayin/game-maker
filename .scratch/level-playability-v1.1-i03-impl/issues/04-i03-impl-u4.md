# I03-IMPL-04 U4 执行 brief

Type: grilling
Status: open
Owner: —
Blocked by: 03
Map: ../map.md
Class: I-03-IMPL / U4

## Question

为 **U4（assets `runTemporalAudit` 接入真实分析并产出证据）** 产出一份可交接的执行 brief，至少覆盖：

- 授权包 §11.2 的 U4 逐文件白名单；T-58 只按批准语义改写，保留禁止路径；
- `analyzeTemporalInternalTwoLag` 经 U1 适配器接入；`runTemporalAudit` 保持同步 / 不抛 / 不改退出码；
- 双档运行、确定性证据、AC-10 / AC-18 / AC-19、T-56 / T-57 / T-58 / T-60 / T-61 / T-62 / T-64；
- U4 专属门：T-58 允许路径 + 禁止路径；stub 负向覆盖；双档可重放确定性；
- **消费 U1 adapter + U2 `mapPublicVerdict` + 第一阶段常量**：gate / admission 显式传 `PHASE1_CAPABILITY_GATE` / `PHASE1_CAPABILITY_ADMISSION`，不得默认，不得把 `OPEN` 解释为 admission；
- **真实 analyzer → U1 adapter 集成 smoke（必需，来自 I03-IMPL-02 Q4）**：必须证明 `analyzeTemporalInternalTwoLag` 的真实结果可被 U1 `toPublicTemporalEvidence` 直接消费；不得用测试专用转换层掩盖类型 / 字段漂移；在 U4 的 assets 授权范围内完成；
- **回滚演练**（revert 后跑相关测试，保留日志与 hash）；
- 独立复核输入、E1 / E2 / E3、不变量快照；
- **明确：本 brief 不写代码**。

## Answer

（resolved 时填写）

## Comments

- 2026-11-15 I03-IMPL-02 Q4 裁定：真实 analyzer → adapter smoke 从 U1 移入 U4，作为 U4 必需验收项；U1 不引入跨包依赖。
- 2026-11-15 I03-IMPL-03 Q1/Q4：U4 必须显式传第一阶段 gate/admission 给 U2 mapper；`gate=OPEN` ≠ admission。
