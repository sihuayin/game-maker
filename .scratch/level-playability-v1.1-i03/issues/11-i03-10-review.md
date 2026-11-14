# I03-10 授权包独立审查

Type: task
Status: resolved
Owner: claude (I03-10 session 2026-11-14)
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

**完成。** 由 `/clear` 后的独立会话（未参与 I03-00～I03-09 的撰写 / 组装）完成审查；
独立审查阶段未修改授权包 / 产品代码 / 测试 / 冻结证据；随后按用户裁定完成 **F2 修正**（授权包 §6.6 / AC-15 / §16、审查输入包、fixture manifest / build script / evidence 03b2）。产品代码仍零 diff；未开放公共能力、未启动实施。

| 项 | 结果 |
| --- | --- |
| 审查报告 | [`reports/I03-review.md`](../reports/I03-review.md) · `sha256:40af4b4b243abf1fbaac5a794cf1a8ccaf32b65e3c7ed29278e1d21502feed09`（含 F2 修正） |
| 授权包（审查对象） | `docs/v7.8/移动-I03.md` · `sha256:2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e`（F2 修正后；原 `0edf5005…`） |
| 审查输入包 | `reports/09-review-input-package.md` · `sha256:1227d1f3c78dda382cd4f6c6560740f512ac3fc4a131a33a35b436da5fda7abd`（F2 修正后） |
| F2 修正证据 | [`evidence/10-f2-correction.md`](../evidence/10-f2-correction.md) · `sha256:17ea5f9137b9dbf3dbf7ab715fc26e598c0ee419ff94794a9b974584086a8c2a` |
| 逐项结果 | **23 / 23 PASS；0 FAIL；0 NOT_RUN** |
| 独立验证 | 5 条（D9 20→13 映射、夹具 hash/行数重建、冻结输入零 diff、LP-06/07 语义一致、当前源码事实逐条核对） |
| 复跑命令 | `pnpm test`（176 files / 2877 tests，退出 0）· `pnpm build`（0）· `pnpm check:deps`（0）· `pnpm check:links`（0）· LP-06 / LP-07（0，语义与冻结 evidence 一致；已复原 tracked 证据）· `python3 …/build-fixtures.py`（0；14 rows / 11 negatives） |
| 发现 | 6 项发现：F1 编号命名空间 / “I03-02 原始编号”措辞；**F2 §6.6 负例组成与 `body-bounds-mismatch` 覆盖（中 → 已按用户裁定修正：11 负例 = 10 geometry-mismatch + 1 missing-evidence）**；F3 §7.2 throw 闭集措辞；F4 `docs/**` 与 Ledger 流程歧义；F5 “19 关”与 LP-06 `uniqueConfigs=20`；F6 evidence 03b2 的旧行（已一并修正） |
| 结论 | **PASS**：未发现会改变冻结语义、能力状态或实施授权边界的阻断性缺陷；F2 / F6 已修正，F1 / F3 / F4 / F5 为非阻断 |

### 边界

- 审查 PASS 只表示授权包适合交付用户签署；**不**授权 U1–U5、**不**授权 probe / fixture 实施、**不**开放 `PUBLIC_NB` / `PUBLIC_PU`、**不**设置 `coverage.geometry`。
- `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；I-03 实施仍 `NOT_AUTHORIZED`。
- 未推送、未建 PR、未合并。

**下游**：I03-11 用户签署。F2 已按用户裁定修正（负例 11，含 `body-bounds-mismatch`）；F1 / F3 / F4 / F5 为非阻断，不影响签署。

## Comments

- **2026-11-14 用户裁定（选择 1）**：先修正 F2，再进入 I03-11 签署；暂不接受将其作为已知限制带入签署。
- **F2 修正完成**：新增 `body-bounds-mismatch` recipe（player body bounds x +0.5 px，size/offset 不变）；负例 10 → 11（10 geometry-mismatch + 1 missing-evidence）；包 §6.6 / §10.2 AC-15 / §16 第 7 行、审查输入包 item 10、fixture manifest / build script / evidence 03b2 同步。详见 [`evidence/10-f2-correction.md`](../evidence/10-f2-correction.md)。
- **F6 一并修正**：evidence 03b2 的命令结果行改为 14 rows / 11 negatives。
- 未改产品代码 / I-02 / 公共能力；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；I-03 实施仍 `NOT_AUTHORIZED`。
