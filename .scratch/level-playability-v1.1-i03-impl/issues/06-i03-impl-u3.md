# I03-IMPL-06 U3 执行 brief

Type: grilling
Status: open
Owner: —
Blocked by: 05
Map: ../map.md
Class: I-03-IMPL / U3

## Question

为 **U3（contracts `mechanic.ts` gap 替换）** 产出一份可交接的执行 brief，至少覆盖：

- 授权包 §11.2 的 U3 逐文件白名单；fixture 只改 `wide-patrol` 行；
- 移除 `moving-hazard-phase` gap；temporal 层完整接管原诊断责任；
- 适用 / 非适用 / 缺失时序结果均不得出现诊断空窗或错误放行；`moving-platform-unsupported` 及其余 mechanic 语义不变；
- 受影响既有测试按新语义改写并保留负向覆盖；
- U3 专属门 + **回滚演练**；
- 独立复核输入、E1 / E2 / E3、不变量快照；
- **明确：本 brief 不写代码**。

## Answer

（resolved 时填写）
