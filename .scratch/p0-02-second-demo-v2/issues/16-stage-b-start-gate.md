# 阶段 B 启动闸：预算、护栏、授权与阶段 A 证据

Type: grilling
Status: resolved
Blocked by: 15

## Question

HITL：阶段 B（第二个独立 Demo 付费试跑）的启动闸。只有以下条件**同时**满足才可启动：

1. 明确预算与单次成本上限（货币上限，不是调用次数；覆盖文本 + 生图 + 重采样）；
2. 明确付费执行授权（谁授权、覆盖哪些阶段、是否批准付费生图）；
3. 明确执行护栏与停止条件（硬拒绝/有界超射/预付费/停止阈值，以及验证方式）；
4. 确认阶段 A 交付的证据足以支撑第二个 Demo 的试跑（覆盖门禁、写回身份、失败撤销、清单/`verify-delivery` 不再有已知假绿）。

选项：
- (a) 四条件满足，授权阶段 B，进入新的执行图/票链；
- (b) 条件未满足，保持 blocked，不调用付费服务；
- (c) 用户重新裁定护栏要求（例如接受有界超射），再回到本票；
- (d) 取消阶段 B。

已知约束：旧 P0-02 的严格 $6 硬护栏未建立；LiteLLM 已被否决；本图不预拆 build/playtest/visual/freeze/verdict 详细票。

建议（阶段 A 收口后再定）：**(b) 保持 blocked**，除非四项条件同时有可复核证据；不在本票内预设金额或 provider。

产物：票内 Answer + 追加 `rulings-2026-10-29.md`。未解锁前不调用付费服务。

## Answer

**2026-10-30 HITL 收口。** 逐字裁定见 [rulings-2026-10-29.md 第 10 节](../rulings-2026-10-29.md)。

### 裁定

| 项 | 决定 |
|---|---|
| Q1 启动闸 | **(b) 保持 BLOCKED**，不调用任何付费服务 |
| Q2 下一步 | **(ii) 零付费 `buildAndSite` 壳级 dry run**（冻结副本或已有资源的新 Demo）；不引入付费 API，不改冻结证据 |
| Q3 阶段 A 证据 | **(b) 尚不足**：先补真实 `create/build → site → delivery` 链路证据，再讨论付费启动 |
| 有界超射 | 不接受 |
| LiteLLM | 不恢复 |
| $6.00 | 不是预算授权 |
| dry run 环境 | 必须验证 `ANTHROPIC_*` 不会把 text 路由到本地代理，并记录实际 provider/endpoint |
| 本轮授权 | **不授权预算、付费执行或生图调用** |

### 结论

- 阶段 B 仍 **BLOCKED**；本票关闭**不构成**任何付费授权。
- 新建 [零付费 buildAndSite 壳级 dry run](../issues/17-zero-paid-build-site-dry-run.md) 作为下一张 task 票；完成并复核后，再重新评估四项启动条件。
