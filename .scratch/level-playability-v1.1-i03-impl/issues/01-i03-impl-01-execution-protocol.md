# I03-IMPL-01 执行协议与授权拓扑

Type: grilling
Status: open
Owner: —
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

（resolved 时填写）
