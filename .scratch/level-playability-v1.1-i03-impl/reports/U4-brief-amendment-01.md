# U4 brief 修订 01（用户裁定 A）

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-16 |
| 单元 | U4 |
| 触发 | U4 CI `test` 中两个既有 `compile-runtime.test.ts` 用例 20s 超时；原因是 `create-game` 的 `runTemporalAudit` 也跑真实时序分析 |
| 用户裁定 | **A**：真实分析只在 `existingAudit` 存在时运行；`create-game` 保持 legacy-only；不扩白名单 |
| 产品 head | `ce6ce63`（原 `9b21f2d`） |
| 影响 | U4 brief Q3/Q4 的“无 existingAudit ⇒ 内部 auditPlayability fallback”被本裁定取代；U5 必须把 publish-gate 已有 audit 传入 `runTemporalAudit({ existingAudit })`，才能得到真实公共 evidence / verdict |
| 不变 | 不扩 U4 白名单；不改 U1/U2/U5/U3；不开放 `PUBLIC_NB` / `PUBLIC_PU`；T-57 / T-58 / T-61 边界不变 |
| 验证 | 定向 129 tests / 全量 178 files 2933 tests / build / deps / links 全绿；U4 回滚演练重做 |
