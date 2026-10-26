# 01. 增量缺口定位：E2E 路径 vs demo.md 6 条 P0 验收

Type: research
Status: resolved
Owner: research subagent · 2026-10-25
Map: ../map.md

## Question

在继承 `p0-00-audit` 已收口结论的前提下，只对「E2E 路径」按 `docs/v7.2/demo.md` 的 6 条 P0 验收
（P0-01 审计 / P0-02 生成 / P0-03 启动加载 / P0-04 操作 / P0-05 通关 / P0-06 风格接入）做**增量缺口定位**，回答三件事：

1. **6 条 P0 验收现状**：当前 E2E 路径（`create` → `build` → `site`）上，每条验收「已具备 / 有缺口」分别是什么？
2. **design→config 缺口是否仍是当前阻塞**：`intent-to-mechanics-v1` 票 11（2026-10-23）报的 5 条硬失败
   （玩家角色塞进地形块槽 / HUD 面板绑玩法 sprite 当 ui / 尺寸 72×32 vs 包内 32×24 且非九宫格），
   在 `entity-identity-v1` / `entity-identity-v1.1` / `visual-design-*` / 机制覆盖报告等后续改动之后，
   **是否仍存在**？有没有被部分/全部修复，或暴露了新缺口？
3. **其余缺口**：除 design→config 外，是否还有别的缺口挡在「可玩 Demo」前面（逐条核对 6 条 P0）。

## 边界

- 零付费：只读代码 + 读既有 run 产物 + 免费命令（`pnpm test` / `typecheck` / `check:deps`）。
- 不改代码、不跑 `create` 付费链、不手工改中间 JSON。
- 结论基于代码与真实产物（E1–E3），不基于推测。

## Answer

研究结论：`../research/incremental-gap.md`。三问速答：

1. **6 条 P0 现状**：运行时能力（P0-03/04/05）已离线验证（v7 fixture `playable-smoke` 全绿）；
   P0-02（生成）卡在 **plan-assets 文本上游**（非 design→config）；P0-06 只到视觉层产物、未到真实站点人工对照。
2. **design→config 5 条硬失败已不是当前阻塞**：被 `recipe-config-gap-v1`（2026-10-23/24）修复
   （solid→sprite kind 锁 `game-config.ts:370-372` + `hudUiGate` `ops.ts:288-302` + 业务校验重采样
   `ops.ts:1161-1179`），免费验收（票 06）已过 —— **但该 effort 不在本图 map 的「前置」链里**，
   map 里「那之后无一张图去修它」是事实错误。
3. **当前真实阻塞 = 文本上游**：`deepseek-v4-pro` 对 `emit_asset_recipe` 大 schema 的
   empty-input/schema 不可靠（约 1/8 成功率），用户 2026-10-24 暂不换 provider。其余缺口
   （R12 重采样 / drawlist 截断 / image 底色 / config 几何）均已修。
