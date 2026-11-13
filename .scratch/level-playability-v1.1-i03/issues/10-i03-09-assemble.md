# I03-09 授权包组装与一致性审计

Type: task
Status: open
Owner: —
Blocked by: 08, 09
Map: ../map.md
Class: I-03 / TASK

## Task

把 I03-01 ～ I03-08 的裁定组装为 `docs/v7.8/移动-I03.md`，并做跨节一致性审计。**不实施、不开放公共能力。**

### 必须完成

1. 填齐授权包全部章节：范围 / 非目标、能力边界、输入、内部→公共映射、Verdict / coverage、evidence、release gate、NB / PU 准入、验收、单元 / 复核、台账 / 白名单 / 回滚、签署栏。
2. 逐项核对六条冻结边界与 Q1–Q4 裁定。
3. 生成 Authorization Ledger（`PUBLIC_NB` / `PUBLIC_PU` 状态）、逐文件白名单、STOP / 回滚规则。
4. 明确 `PUBLIC_NB` 三阶段与 `PUBLIC_PU` 独立链，禁止“接通即开放”。
5. 生成审查输入包 `.scratch/level-playability-v1.1-i03/reports/09-review-input-package.md`（验收表、证据、命令、白名单；不含作者结论）。
6. 写证据 `.scratch/level-playability-v1.1-i03/evidence/09-package.md`。
7. 不修改生产代码 / I-02 原文 / U5 结果。

### 禁止

- 把未决项伪装成已决；
- 授予实施权限 / 开放 `PUBLIC_NB` / `PUBLIC_PU`；
- 推送 / 建 PR / 合并（除非另行指令）。

### 验收

授权包完整、跨节一致、台账 / 白名单 / 回滚就绪；审查输入包就绪；产品目录零改动。

## Answer

（resolved 时填写）
