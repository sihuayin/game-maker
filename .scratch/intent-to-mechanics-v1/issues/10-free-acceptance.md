# 10. 免费验收闭环：playable smoke + 覆盖报告全绿

Type: task
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 04, 05, 06, 07, 08
Map: ../map.md

## Question

免费验收闭环（第一轮裁定 Q2）：`open-chest` 与 `avoid-danger` 落地后，跑 `vitest`（单元 + witness）+ `playable-smoke`
（机制 probe 全绿）+ 覆盖报告 6/6 且 per-mechanic 全 `satisfied`，证明闭环成立——**不碰生图/文本上游**。

## 现状（E1）

- 验收工具齐全：`vitest`（`package.json` test）+ `playable-smoke.mjs`（headless Chrome 运行时状态探针）+
  fixture 包（`fixtures/packs/`，零付费真包）。

## 建议

收口判据：① 单元 + witness 全过；② 机制 probe（[票 06](06-behavioral-qa-probe.md)）对 open-chest / avoid-danger
全绿；③ 覆盖报告（[票 07](07-coverage-report.md)）`checked 6/6` 且两机制三层全 `satisfied`。任一必需机制失败即
免费验收失败，留证据（命令 + 退出码 + 报告路径），**不隐藏**。

## Answer

**已实现（2026-10-23）** —— `pnpm test:acceptance`（新脚本 `packages/demo/probe/free-acceptance.mjs`）**全绿**：

- **① vitest**：1846 测试全绿（含 witness + 机制状态 + 覆盖报告 + config 漂移 + danger 相位）。
- **② 机制 probe**：`collect-pickup` / `open-chest` / `avoid-danger` 三条在真 Chrome 里全绿（`mechanic-probe.mjs`）。
- **③ 覆盖报告**：废土机制清单（run/jump/gravity/collide-terrain/collect-pickup/open-chest/avoid-danger/reach-goal）
  逐条三层；`open-chest` / `avoid-danger` **三层全 `satisfied`**，`verdict: satisfied`。

证据落 `.scratch/intent-to-mechanics-v1/runs/<今天>-free-acceptance/`：
`vitest.log`（退出码 0）· `probe/summary.json`（probe 真跑结果）· `mechanic-coverage.json`（覆盖报告）·
`free-acceptance.json`（总判据 `allOk: true`）。

**不碰生图/文本上游** —— 全部零付费（fixture 包 last-train + 手写 config）。付费 P0-FINAL 重跑是
[票 11](11-p0-final-paid-rerun.md)，单独授权。

