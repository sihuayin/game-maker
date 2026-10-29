# 付费 build 与 delivery

Type: task
Status: open
Blocked by: 05, 19

## Question

在 checkpoint 获用户批准后，运行 `build <runDir>`（付费生图 + config + QA + site + delivery）：

- 记录命令、退出码、耗时、账本/调用、预算消耗；
- 核对 QA、发布闸、site、production shell 是否写出 delivery；
- 保留 run/pack/site/delivery 原始现场；
- 失败即记录，不自动重试、不修代码、不补写证据；
- 若预算上限将超：停止并报告。

产物：新的 `run/pack/site` + delivery 报告 + `.scratch/p0-02-second-demo/research/06-build-evidence.md`。
