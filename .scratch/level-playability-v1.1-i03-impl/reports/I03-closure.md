# I-03 实施 phase-1 关闭记录

| 项 | 值 |
| --- | --- |
| 记录类型 | phase-1 关闭记录；**不修改已签署授权包正文 / AC** |
| 签署人 | **amber** |
| 日期 | **2026-11-17** |
| 验收基线 | `main` @ `d26276e5e65d2bc4d2381d5829bd9be4410c682f`（重冻结基线合入后） |
| 验收报告 | `.scratch/level-playability-v1.1-i03/reports/I03-acceptance.md` · `sha256:56ceda4ac76d8117a041ef1c4e976b11f808b0b84973a363b3b16c3455621717` |
| 首轮 FAIL 归档 | `.scratch/level-playability-v1.1-i03/reports/I03-acceptance-run1-FAIL.md` · `sha256:7996e705110516e83f6736a53f6c33ab172b87b8bd2334e126edc914ae478ba0` |
| 验收证据归档 | 分支 `wayfinder/i03-acceptance-evidence` @ `edcd92f`（`evidence/acceptance/` 首轮 + `evidence/acceptance-run2/` 本轮） |
| 整体状态 | **INCOMPLETE**（required PASS 16 / FAIL 0 / NOT_RUN 3；验收退出码 `0`） |

## 1. 关闭事实

- U1–U5（含 U4 amendment-02、U3）全部完成独立复核、用户签署、合并、Ledger。
- 全量 `pnpm test` 178 files / 2952 tests；`pnpm build`、`pnpm check:deps`、`pnpm check:links`、`pnpm typecheck` 全绿。
- T-55–T-65 全 PASS；G1–G11 全 PASS；N1–N12 / N15 / N17 / N18 PASS。
- LP-06/07 原命令与新冻结基线逐项一致（`semanticEqual=true`；20 unique configs / 96 pairs / 19 个 x 轴移动 Hazard）。
- 跨进程确定性与冻结值一致。
- AC-07 特别复核 PASS：降级 temporal 路径为 IE / unknown，不记录 NB。
- 无未解决 STOP；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；`publicCapability="BLOCKED"` / `publicResult=null`；发布拒稿行为不变。

## 2. required NOT_RUN（已接受并披露）

| AC | 原因 |
| --- | --- |
| AC-10 | NB 十项 §8.2 准入规则 / 固定 admission 夹具未在 phase-1 实现；mapper 只消费布尔 `admission` |
| AC-12 | global gate close / 证据基线失效 / cache-history-逐关优先未在 phase-1 实现 |
| AC-14 | I03-03C 分项 PASS 消费 / probe 环境不匹配逻辑未实现 |

非 required：AC-11 `NOT_RUN`（PU 条件 2/5 `BLOCKED`）、AC-15 `NOT_RUN`（probe 未实现）。

## 3. 基线重冻结

- 授权记录：`reports/I03-acceptance-baseline-rebaseline-authorization.md`（PR #69 `d4d95b0`）。
- 重冻结记录：`reports/I03-acceptance-rebaseline.md`（PR #70 `d26276e`）。
- LP-06 语义 hash `533b78b9…` → `071ae5d5…`；LP-07 `59064484…` → `5c7d9391…`；组成不变量未变。
- 首轮 AC-21 FAIL 仅因基线滞后于已签署 U3；未修改历史 FAIL 报告。

## 4. 披露的已知偏差（非阻断）

- A1：U2 Ledger 的 audit 分支归属文字与 `9cf89db` 实际所在分支不一致；复核报告可按 SHA 解析且 hash 一致。
- A2：U1/U2 `commands.log` 被 `.gitignore` 的 `*.log` 忽略、未入 audit 分支；工作树文件存在且 SHA-256 与 `SHA256SUMS` 一致。
- L1–L8 全部披露（详见验收报告）。

## 5. 边界

- **关闭 ≠ 开放**：本记录只表示 phase-1 生产接线、证据映射、诊断接管与复核完成；不开放任何公共能力。
- AC-10 / AC-12 / AC-14（及 probe / PU 条件 2/5）需后续独立授权单元。
- 本记录不修改授权包正文、gate、发布行为或 U1–U5 证据。
