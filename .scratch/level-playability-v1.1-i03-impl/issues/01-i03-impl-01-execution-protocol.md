# I03-IMPL-01 执行协议与授权拓扑

Type: grilling
Status: resolved
Owner: claude (I03-IMPL-01 session 2026-11-15)
Blocked by: —
Map: ../map.md
Class: I-03-IMPL / PROTOCOL

## Question

把 Q6–Q10 的裁定落成执行会话可直接照做的协议：

1. **branch / PR 拓扑**：地图 docs-only PR → `main`；U1 / U2 / U4 / U5 / U3 各自从更新后的 `main` 建 `wayfinder/level-playability-v1.1-i03-uX`；单元 PR 顺序合入 `main`；不设长期 integration branch。
2. **逐单元增量授权**：`reports/UX-incremental-authorization.md` 模板（沿用 I-02 格式）；用户签署；授权前不得开始该单元。
3. **docs-only Ledger 例外（Q10=A）**：仅 `docs/v7.8/移动-I03.md` §12.2 目标单元行；字段 `增量授权状态 / 实施 SHA / 复核证据路径+hash / 批准人 / 日期 / 回滚目标 SHA / 回滚演练证据 / 备注`；用户或用户明确授权的 docs-only 会话执行；每单元一次 commit；记录包文件 pre/post SHA-256 与精确 diff；§1–§11、§13–§17、§12.1、产品代码与其他 docs 文件全部锁住；越界 ⇒ STOP + HITL。
4. **独立复核**：fresh 会话；输入（授权包、diff、测试证据、修改前后不变量快照）；报告路径 / 格式；逐项 `PASS / FAIL / NOT_RUN`；不得读作者总结 / PASS 结论 / 调试笔记。
5. **证据 / 回滚 / STOP**：E1 / E2 / E3；U4 / U5 / U3 必须回滚演练，U1 / U2 文档化回滚；12 条 STOP 的记录与交回用户方式；区分回滚演练与正式回滚。
6. **hand-off**：地图 + 票即交付；执行会话领取单元 brief 后另开自己的执行 effort / 分支，不在地图内改代码。

## Answer

**Q1–Q6 = A，执行协议冻结。** 协议资产：[`reports/01-execution-protocol.md`](../reports/01-execution-protocol.md) · `sha256:b9e14b5ffddf8d075fdc895bd5638eadf21b2fdbbe27e1e4aea24359a7c86fd2`。

| 题 | 冻结结果 |
| --- | --- |
| Q1 | 授权记录先 docs PR 合入 `main`，再切单元分支 |
| Q2 | fresh subagent / 独立会话 + 独立输入包 + 独立复核报告 |
| Q3 | 授权 docs PR → 单元实现 / 复核 / 签署 → 单元 PR → 独立 Ledger PR |
| Q4 | 固定证据目录、不变量 before/after、隔离回滚演练、STOP 文件 |
| Q5 | 独立 docs-only Ledger PR + 去掉目标行后 byte-compare |
| Q6 | 独立协议资产 + 统一单元 brief 清单 |

### 关键边界

- 本票只冻结协议；**不授权任何单元**、不改产品代码、不开放 `PUBLIC_NB` / `PUBLIC_PU`。
- 每单元仍需独立授权记录 + 独立复核 + 用户签署 + Ledger 更新。
- docs-only Ledger 例外仅 §12.2 目标行；§1–§11 / §13–§17 / §12.1 / 产品代码全部锁住。
- 下一 frontier：I03-IMPL-02 U1 brief。
