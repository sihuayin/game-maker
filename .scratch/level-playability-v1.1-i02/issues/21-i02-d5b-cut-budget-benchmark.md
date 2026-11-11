# I02-D5B 累计 cut 预算基准

Type: task
Status: open
Owner: —
Blocked by: 11
Map: ../map.md
Class: I-02 / EVIDENCE

## Question

用 scratch 基准确定 `maxCutsPerBranch` 的默认值与硬上限，并复核 `maxWitnessBytes` / `maxWitnessTransitions` 的实测依据。**不写生产代码，不做生产验收声明。**

### 必须产出

1. 每条 edge / check 的 cut 数分布（p50 / p90 / max）。
2. U2 每档 lag 的累计 cut 分布（语料 + 合成最坏用例）。
3. `maxCutsPerBranch` 的建议默认值与硬上限。
4. `maxWitnessTransitions` / `maxWitnessBytes` 的实测复核（当前暂定 `1M` / `64 MiB`）。
5. 命令、输入 SHA、原始输出摘要、复现方法。
6. 是否修改产品目录（必须为否）。

## 相关证据

- [I02-D5 预算、确定性与降级裁定](11-i02-d5-budget-determinism.md)：§3.1 累计 cut 预算、§9.2 基准证据清单。
- [I02-03 连续时间求交可行性实验](../evidence/03-continuous-intersection.md)：单次求交代价 O(切点数)。
- [I02-05 性能与预算基线采集](../evidence/05-performance.md)：语料状态容量与墙钟。

## 下游

D7、D9、AUTH。
