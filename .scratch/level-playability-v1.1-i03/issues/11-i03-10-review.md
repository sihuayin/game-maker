# I03-10 授权包独立审查

Type: task
Status: open
Owner: —
Blocked by: 10
Map: ../map.md
Class: I-03 / AUDIT

## Task

由**未参与 I-03 授权包撰写**的独立会话审查授权包。**不是实施复核，不授权任何实施单元。**

### 必须完成

1. 只依据授权包、审查输入包、I-02 / U5 冻结材料与源码事实工作；自己重跑能重跑的命令、检查引用、逐项判断。
2. 逐项审查：范围 / 非目标、内部→公共映射、Verdict / coverage、evidence、release gate、NB / PU 准入、验收、单元 / 白名单 / 回滚。
3. 逐项 `PASS / FAIL / NOT_RUN`；不得用总通过率替代。
4. 独立验证至少 2 条关键断言（自选并记录理由）。
5. 写 `.scratch/level-playability-v1.1-i03/reports/I03-review.md`：逐项结论、证据、未覆盖项、限制、独立签署。
6. 不改授权包 / 产品代码；不开放公共能力；不启动实施。

### 禁止

- 以作者总结替代自己的复核；
- 修改产品代码 / 授权包 / 证据；
- 宣称 `PUBLIC_NB` / `PUBLIC_PU` 获准。

### 验收

审查报告完整；逐项结论；证据与 hash；未覆盖项显式；审查会话独立。

## Answer

（resolved 时填写）
