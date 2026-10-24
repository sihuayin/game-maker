# 06. 免费验收闭环

Type: task
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 04, 05
Map: ../map.md

## Question

免费验收（Q2=a+b）：对废土寻宝这一真实设计，`auditGameConfig` + `auditScreenSpace` +
`auditLayerCoverage` 零硬失败；offline E2E 可玩（site 产出 + smoke/probe 全绿）。不碰生图/付费。

## 边界

- config 业务校验全过是判据核心（确定性、可测、零付费）。
- offline E2E 的具体跑法等票 01/02 摸清接缝后定（fixture 包复用 vs mock transport）。
- 任一必需判据失败即免费验收失败，留证据（命令 + 退出码 + 路径），不隐藏。

## Answer

**已收口（2026-10-23）** —— 免费验收两判据都绿，零付费：

- **① config 业务校验全过**（`packages/contracts/tests/recipe-config-acceptance.test.ts`，新）：
  对一份合法配置（`fixtures/game-configs/last-train.json` + `fixtures/packs/last-train/v2`）跑
  `auditGameConfig` + `auditScreenSpace` + `auditLayerCoverage` 三批，**零硬失败**。这是票 04/05 修复的
  **正向证明**（hudUiGate 放行的 ui、solid→sprite kind 锁放行的地形，都过三批校验，没有误伤合法配置）。
- **② offline E2E 可玩**（`pnpm test:playable` = build + `playable-smoke.mjs`）：v7 fixture 站点装配
  「三族 + 第四族 + 第五族全过」→ `playable` collected=3/3 · `hazard-reset` 全绿 · `hazard-legacy` 负例按预期失败。
  证据 `.scratch/p0-construction-v1/runs/2026-10-23-ticket-10`。

**⚠️ 这次验收抓到一处真回归**：票 05 初版把 `decor` 也锁成 `sprite`，`playable-smoke` 直接红——v7 的 `decor`
实体合法引用 `ceiling-lurker`（animation）与 `health-icon`（ui）。已修：kind 锁**只锁 `solid`、`decor` 不加锁**
（详见票 05 的修正注）。这正说明「免费 E2E」这条判据不是摆设——它拦住了单元测试没覆盖到的误伤。

**判据**：`pnpm test` 1853/1853 绿（123 文件）；`pnpm test:playable` 全绿。零生图、零付费。
