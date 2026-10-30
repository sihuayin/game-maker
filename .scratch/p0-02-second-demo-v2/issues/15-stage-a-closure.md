# 阶段 A 收口：回归、冻结与逐缺口结论

Type: task
Status: resolved
Blocked by: 08, 09, 10, 11, 12, 13, 14

## Question

阶段 A 收口，不以修复数量为验收标准，按证据给逐缺口结论：

1. 汇总票 08–14 的红/绿测试、真实免费运行、身份一致与历史零改动证据；任何未完成/失败项明确记录为 `fail` / `blocked` / `incomplete`，不默认通过。
2. 跑回归三件套：`pnpm test`、`pnpm typecheck`、证据验收（`pnpm build && node scripts/evidence-acceptance.mjs --out .scratch/p0-02-second-demo-v2/runs/evidence`）。超时隔离重跑并记录环境，不静默宣称全绿。
3. 冻结阶段 A 的可写副本：只读快照 + 逐文件 sha256 + 交付身份；用票 13 的生产清单生成器生成正式清单，并用 `verify-delivery` 校验；记录命令/退出码/结论。
4. 写 `final-report.md`：六项缺口逐项列「闭 / 部分闭 / blocked / 明确不做」+ 证据（路径/命令/退出码/身份）+ 已知限制；写 `final-verdict.json`（不新增契约字段，effort-local）。
5. 证明旧 effort、旧 work、历史 run/pack/site/delivery、冻结快照零改动；零付费；未提交/未推送（除非另行授权）。
6. 只有全部完成后，票 16 才解锁；解锁不等于授权付费。

产物：`final-report.md` + `final-verdict.json` + `freeze/` + `runs/evidence/`。若阶段 A 有项失败，照实收口，不扩大范围修到通过。

## Answer

**2026-10-30 阶段 A 收口。** 最终报告：[final-report.md](../final-report.md)；机器可读结论：[final-verdict.json](../final-verdict.json)。

- 逐缺口：7 项（六项缺口，其中写回身份/失败撤销拆为 2 项）全部 **closed**；限制逐条列在 final-report §5。
- 回归：`pnpm test` 155 文件 / 2279 tests exit 0；`pnpm typecheck` exit 0；历史证据验收 exit 0（223 文件 / 13 records / 诊断 0）。
- 冻结：`freeze/wasteland-scavenger-recipe/` 112 文件只读；逐文件 sha256 `freeze-sha256.txt`；交付身份 pack v1 / site v1 / shell 2 / v3 playtest / harness+rules v2 / verdict pass。
- 正式清单：`manifest/final-manifest.json` 231 文件（required 137）/ 6 records；sha256 `07866e0e…b9ab`；`verify-delivery` **pass** / 诊断 0。
- 历史：旧 work 95/95、冻结快照 66/66 未变；旧 effort 未写；零付费；未提交/未推送。
- 阶段 B：票 16 解锁但**未授权付费**；仍需 HITL 满足预算、授权、护栏与阶段 A 证据四项条件。
