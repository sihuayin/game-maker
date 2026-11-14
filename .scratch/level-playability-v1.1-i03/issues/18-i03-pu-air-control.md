# I03-PU-Air-Control-Closure — 空中控制与模型外规避闭合证据

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
Class: I-03 / DECISION

## Question

`PUBLIC_PU` 条件 5「模型外规避已排除」需要哪些证据、由谁产生、如何独立复核？在它闭合前，`PUBLIC_PU` 必须保持 `BLOCKED`；U4 的 conditional 图割与 `midAirHits = 0` 都不构成正面证据。

### 必须裁定

1. 必须排除的模型外规避行为：空中水平控制、walk-off 漂移、moving platform、y 轴、其他未建模运动。
2. 需要的 Runtime / 控制能力证据（源码、探针、运行时观测、负向测试）。
3. 证据产生者与产生方式；是否新增依赖 / 是否修改 Runtime / `reach.ts` / `scene.ts`。
4. 负向测试矩阵：哪些行为必须被证明不可达 / 不可规避。
5. 独立复核人与复核标准；E1 / E2 / E3 证据格式。
6. `PASS / FAIL / INSUFFICIENT_EVIDENCE` 判定规则与停止条件。

### 禁止

- 用 U4 conditional 图割、`midAirHits=0`、NB 结果替代条件 5；
- 在本票之外开放 `PUBLIC_PU`；
- 修改 Runtime / 产品代码 / 已签署 I-02 原文；
- 推送 / PR / 合并。

### 验收

条件 5 的可执行判据、证据来源、负向矩阵、独立复核标准、PASS / FAIL / IE 规则；未闭合项显式列出。

## Answer

（resolved 时填写）
