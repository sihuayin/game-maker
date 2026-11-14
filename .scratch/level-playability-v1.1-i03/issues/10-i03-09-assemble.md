# I03-09 授权包组装与一致性审计

Type: task
Status: resolved
Owner: claude (I03-09 session 2026-11-14)
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
**完成。** I03-01～I03-08 的裁定已组装为 `docs/v7.8/移动-I03.md`（§0–§17），并通过跨节一致性审计。**未实施、未开放公共能力、未推送 / 建 PR / 合并。**

| 项 | 结果 |
| --- | --- |
| 授权包 | `docs/v7.8/移动-I03.md` · `sha256:0edf5005d52f50ccbaa52be85f9b4ed34b904aacc6b51d7eec72be6ee2863c14` |
| 包状态 | **ASSEMBLED / PENDING INDEPENDENT REVIEW / UNSIGNED** |
| 章节 | §0 范围与非目标；§1 能力边界；§2 输入与裁定来源；§3 映射；§4 Verdict / coverage；§5 evidence；§6 几何 gate；§7 发布门；§8 NB；§9 PU；§10 验收；§11 单元 / 白名单 / 回滚；§12 Ledger；§13 停止；§14 风险；§15 证据；§16 一致性审计；§17 签署栏 |
| 审查输入包 | `.scratch/level-playability-v1.1-i03/reports/09-review-input-package.md` · `sha256:5c6e2be47207944643267dd8713c290727b087c033b641abc7289b05171b5944`（无作者结论） |
| 组装证据 | `.scratch/level-playability-v1.1-i03/evidence/09-package.md` · `sha256:0c92bf2e8841529b68a7f1940632182a046dd467e08cf8aec8bbbc75c3d1acaa` |

### 一致性审计（21 项全 PASS）

- 六条冻结边界 6/6；前沿裁定 Q1=A / Q2=分阶段 / Q3=最小面 / Q4=A 已体现；
- NB 三阶段、PU 独立链 + 六条件、条件 5 硬阻断完整；
- 几何四状态、14 正例行 / 10 负例、玩家坐标约定、I03-03C 复核标准完整；
- 公共 degradation 闭集 13 值；Verdict 映射 / 优先级 / 冲突 STOP 完整；
- 发布门拒稿输入闭集 + G1–G11 + 变异测试完整；
- AC 21 条 / required 19；负向 N1–N18（§10.3）与 V1–V10（§4.7）；
- 单元顺序 U1→U2→U4→U5→U3；逐文件白名单；STOP 12 条；五道复核门；回滚与关闭条件；
- Ledger 空白、无预填；`PUBLIC_NB` / `PUBLIC_PU` `BLOCKED`；I-03 实施 `NOT_AUTHORIZED`；
- I-02 授权包 SHA-256 未变；`packages/**` / `fixtures/**` 相对 `2b57f2a` 零 diff；
- Markdown 链接全通过（`check-links`）。

### 显式未闭合项

- PU 条件 2 / 5 `BLOCKED`；条件 5 由 I03-PU-Air-Control-Closure 独立闭合；
- AC-11 / AC-15 phase-1 `NOT_RUN`（预先非 required）；
- Runtime hitbox equality 未证；几何 probe 未实现、夹具未物化；
- LP-06/07 无 vitest、不在 CI。

### 边界

- 未修改生产代码 / `fixtures/**` / I-02 原文 / U5 结果；
- 未授权 U1–U5 开工；未开放 `PUBLIC_NB` / `PUBLIC_PU`；
- 未推送、未建 PR、未合并。

**下游**：I03-10 独立审查（输入包已就绪）；I03-11 用户签署。审查或签署均不构成单元授权或能力开放。
