# 预算授权 v2（货币上限 + 成本护栏）

Type: grilling
Status: open
Blocked by: 13

## Question

HITL：基于票 13 的成本模型，重新裁定付费执行：

1. 给出**可核实的货币上限**（金额/币种），以及它覆盖的阶段（checkpoint / build / 全量）；
2. 确认 provider（沿用冻结 run 的文本/生图 provider），并确认执行前可用性检查方式（不读取密钥内容）；
3. 明确批准/不批准在上限内进行**付费生图**；
4. 确认超限前停止机制（provider 硬限额 / effort watcher / 其他），以及“无法保证下一次不超限就停”的规则；
5. 确认第二次完整运行仍须另行 HITL 批准；只换输入、不改代码、不拼接两次运行。

若本票仍不授权，P0-02 执行保持阻塞；不得以“22 次调用”代替货币上限。

产物：票内 Answer + `.scratch/p0-02-second-demo/rulings-2026-10-29.md`（追加逐字裁定）。
