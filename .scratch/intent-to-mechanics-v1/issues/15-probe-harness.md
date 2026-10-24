# 15. QA probe harness：机制化 playable-smoke + probe 结构

Type: task
Status: resolved
Owner: main session · 2026-10-23
Blocked by: —
Map: ../map.md

## Question

落地 [票 06](06-behavioral-qa-probe.md) 的裁定，把 `packages/demo/probe/playable-smoke.mjs` 从「写死 v7 fixture」
机制化成「每机制一个 probe」：

1. 定义 probe 结构：`{ mechanicId, config 夹具, 驱动脚本, 运行时断言 }`（断言读 CDP 运行时状态）。
2. 抽出一个可复用 harness：启动 headless Chrome → 注入状态探针（`READ_STATE`）→ 跑驱动脚本 → 读状态 → 逐条断言。
3. probe 结果产出 QA 覆盖层数据：`{ mechanicId, passed, failures[] }`，供覆盖报告（[票 07](07-coverage-report.md)）消费。

## 现状（E1）

- `playable-smoke.mjs` 已有 headless Chrome CDP 状态探针（player x/y/onFloor、collected、won、pickups[]、hazards[]、
  gate、solids、scrollX）+ 截图 + console 错误 + trace，但 `DEFAULT_PACK`/`DEFAULT_CONFIG` 写死 v7 fixture。

## 建议

- 先抽 harness（驱动 + 状态探针 + 断言运行器），再做具体 probe；**用已有机制 `collect-pickup` 做一条冒烟 probe** 验证
  harness 跑得通，不必等 13/14。
- 具体 open-chest / avoid-danger 场景脚本等 [票 13](13-open-chest-impl.md) / [票 14](14-avoid-danger-impl.md) 落地后补
  （软依赖，不阻塞 harness 本身）。
- probe 结果**不并进** `QA_JUDGEMENTS` 第 7 判据（`pixel.ts:56` 政策），做独立 QA 覆盖层。

## Answer

**已实现（2026-10-23）** —— 三条机制 probe **全绿**（真 Chrome 里读运行时状态断言）。

1. **probe 结构**（`packages/demo/probe/mechanic-probe.mjs`）：`{ mechanicId, config(), run(page), assert(samples) }`。
   `config` 产一份合法 game-config（夹具取自 last-train 包，零付费）；`run` 驱动 + 采样（读 `READ_STATE`）；
   `assert` 返回 `failures[]`（空 = 过）。结果 `{ mechanicId, passed, failures[] }` 落 `result.json` + `summary.json`。
2. **可复用 harness**（`packages/demo/probe/probe-harness.mjs`）：从 `playable-smoke.mjs` 抽出的 Chrome/CDP/状态探针机器
   （`findChrome` / `launchChrome` / `connectCdp` / `makePage` / `READ_STATE` / `PHASER_HOOK` / `startServer` /
   `assembleSiteForProbe`），`READ_STATE` 加了 `chests`（opened）与 `dangers`（state + hits）。
3. **三条 probe**：`collect-pickup`（冒烟：走→捡→赢）、`open-chest`（进范围→opened→collected+1→驻留不再涨）、
   `avoid-danger`（状态 idle↔active 循环 + active 窗口命中 hits>0）。实测全绿（`pnpm test:mechanic`，`--only` 可挑单条）。
4. **danger 的 `hits` 记离散喷发窗口**（`scene.ts`：进入 active 时重置 `hitThisWindow`，窗口内只 +1）——
   否则每帧 +1，400ms 喷发会数成 ~24 次。

**欠账（不在本票范围）**：`playable-smoke.mjs` **暂未迁移**到这份 harness，仍带抽出前的旧拷贝（`probe-harness.mjs`
文件头已如实标注）。迁移是独立清理，不阻塞 harness 本身。

