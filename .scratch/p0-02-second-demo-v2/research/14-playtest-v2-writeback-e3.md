# 票 14 · Playtest v2 写回 E3 证据

- 日期：2026-10-30
- 票：[Playtest v2 写回 E3](../issues/14-playtest-v2-writeback-e3.md)
- 上游：[票 04](../issues/04-writeback-identity-scope.md) / [票 05](../issues/05-rerun-revocation-semantics.md) / [票 06](../issues/06-default-scenario-constants.md)
- 结论：**HEAD CLI + harness/rules v2 在阶段 A 可写副本上真实写回成功**。零付费；未提交；旧 work / 冻结快照 / 历史零改动。

## 1. 运行

- cwd：仓库根 `/Volumes/shy/some-projects/game-maker`
- 副本：`.scratch/p0-02-second-demo-v2/work/wasteland-scavenger-recipe/`
- 命令：

```
node packages/cli/dist/cli.mjs playtest \
  .scratch/p0-02-second-demo-v2/work/wasteland-scavenger-recipe/run/v1 \
  --out .scratch/p0-02-second-demo-v2/work
```

- 退出码 **0**；耗时 **20s**；attempt **v3**；日志 `runs/ticket14-playtest.log`。
- 场景：默认 `success-basic`（票 06 身份门禁通过）；`SUCCESS`、断言 pass、终止达成。
- harness 命令（result.json 内）：`node …/packages/demo/probe/playtest/playtest.mjs --site …/site/v1 --scenario-dir …/.tmp-…/scenarios --out …/.tmp-…/harness`；exitCode 0。

## 2. 身份

`run/v1/playtest/v3/result.json`：

```
scenarioFormatVersion: playtest-scenario/v1
siteVersion: 1 · shellVersion: 2
packId: wasteland-scavenger-recipe · packVersion: 1
packChecksum: sha256:a162942de2a65a549be6958f0739f900df0625e0fa957872425bd9a53aa7feb3
configChecksum: sha256:455d9c7fc982e4d4c3c5b32ff4a94f1dd99f5e85b8adcb0f59af521f3b757dcd
harnessVersion: playtest-harness/v2
rulesVersion: playtest-rules/v2
```

- pack manifest 实际 sha256 与 `packChecksum` 一致；run config 实际 sha256 与 `configChecksum` 一致。
- `site/v1/site.json` sha256 `e220ca28…0896`（shell 2 / pack v1）。
- `site-integrity.json`：`unchanged=true`，before == after。

## 3. 写回差异

- qa-report sha256：`dc20e301…5ee6` → `ac7fda43…dcf`。
- 撤销（attempt 开始前）：invalidation 记录 1 条；`playable-smoke pass → blocked`、`verdict pass → blocked`；移除 8 条旧 `playtest-*` 引用（含 v2 的 result/site-integrity/chrome + 5 个 acceptance 证据）。
- 成功后：
  - `playable-smoke=pass (SUCCESS)`、`delivery.verdict=pass`；
  - `delivery.playtest.report = …/playtest/v3/result.json`、`aggregate=SUCCESS`；
  - 新 `playtest-success-basic-*` 证据引用替换旧引用；
  - `visualReview` 与 QA 层（checked/failures/observations）字节级未变。
- attempt v3 文件：`result.json`、`site-integrity.json`、`chrome.log`、`harness-*`、`success-basic/{events,trace,input,console,exceptions,setup,strategy}.json(l)`。

## 4. 历史与零付费

- 阶段 A 副本原有 95 文件中**只有 `run/v1/qa-report.json` 变化**；其他文件未变。
- 新增：`run/v1/playtest/v3/**`、`run/v1/playtest/invalidations/<ts>.json`。
- 旧 work 95/95、冻结快照 66/66 哈希未变；旧 v2 attempt 文件保留在磁盘，只是不再被 delivery 引用。
- 覆盖报告 `run/v1/mechanic-coverage.json` sha256 `5d206589…c2d9` 未变（票 08 产物）。
- playtest 只启动本地 Chrome；零模型/付费调用；未提交、未推送。

## 5. 结论

- 写回确实由生产 CLI 完成（headless Chrome + harness/rules v2）；
- 身份六字段一致；旧证据引用按规则替换；
- 失败重跑撤销在成功路径上先失效再恢复；
- 阶段 A 现在拥有一份 HEAD 版本的 v2 写回 E3，可用于票 15 重建正式清单。
