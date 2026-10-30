# 补齐 HEAD harness/rules v2 写回 E3

Type: task
Status: resolved
Blocked by: 01, 10, 11, 12

## Question

用当前 HEAD 的 CLI + harness/rules v2，在阶段 A 可写副本上跑一次真实、零付费的 Playtest 写回，补齐 P0-01 的 G2-2 证据缺口。要求：

1. 使用票 01 的副本与备份；不使用冻结快照（无 `delivery`、只读），不改旧 work / 历史。
2. 场景按票 06 的裁定选择：默认 wasteland 场景可用则用默认；否则用 `--scenario-dir` 指向冻结 Demo 的验收场景（`.scratch/fpvs-v1-final/scenarios/acceptance/acceptance-win-wasteland-v1.json`）或阶段 A 新场景。
3. 记录：命令、cwd、退出码、耗时、attempt 版本、`result.json`、`qa-report.json` 写回前后差异、`delivery.playtest` / `playable-smoke` / `verdict`、`site-integrity.json`、身份哈希（pack/site/config/shell/harness/rules）。
4. 证明：写回确实由生产 CLI 完成；旧 `playtest-*` 证据引用按既有规则替换；历史快照/旧 work/历史 run 零改动；零付费。
5. 若写回失败或结果不是 SUCCESS，按真实证据记录，不修到通过；失败本身也是 E3。

产物：`research/14-playtest-v2-writeback-e3.md` + 运行产物目录（本 effort `runs/`）。不改生产代码（除非发现阻塞性缺陷，另开票）。

## Answer

**2026-10-30 收口。** 证据：[research/14-playtest-v2-writeback-e3.md](../research/14-playtest-v2-writeback-e3.md)。

- 命令：`node packages/cli/dist/cli.mjs playtest <副本>/run/v1 --out <副本根>`；cwd 仓库根。
- 退出码 **0**；耗时 **20s**；attempt **v3**；默认 `success-basic` SUCCESS、断言 pass、终止达成。
- 身份：pack `wasteland-scavenger-recipe` v1 · site v1 · shell 2 · packChecksum `a162…` · configChecksum `455d…` · harness/rules v2；site-integrity unchanged=true。
- 写回：qa-report `dc20e301…5ee6` → `ac7fda43…dcf`；撤销先置 blocked，成功后 `playable-smoke=pass`、`verdict=pass`、`delivery.playtest.report` 指向 v3；旧 `playtest-*` 引用被 v3 引用替换；visualReview/QA 层未变。
- 历史：副本原 95 文件仅 qa-report 变化；旧 work / 冻结快照 / 旧 v2 attempt 零改动；覆盖报告未变；零付费、未提交。
- 失败/非 SUCCESS：无（本次为 SUCCESS）。
