# I03-03 几何 / Runtime hitbox 证据 gate

Type: grilling
Status: open
Owner: —
Blocked by: 01, 02
Map: ../map.md
Class: I-03 / DECISION

## Question

把 `coverage.geometry` 从 `partial` 提升到 `checked` 需要哪些证据、由谁产生、如何验证？NB 与 PU 是否共用同一 gate？

### 必须裁定

- Runtime body / 帧几何 / atlas 元数据 / Phaser hitbox 一致性的证据来源；
- 现有 `profile.ts` / `graph.ts` coverage 的边界，哪些可复用、哪些必须新增证据；
- 证据采集方式（运行时 probe / atlas JSON / 构建期校验 / 截图对照）及其可信度；
- 失败 / 缺失时的 `coverage` 与 `degradation`；
- 该 gate 如何阻断 `PUBLIC_NB` 与 `PUBLIC_PU`；
- 是否允许修改 Runtime / `graph.ts` / `profile.ts`；若需要，必须作为独立授权项列出。

### 禁止

- 把 manifest 标称尺寸当 Runtime hitbox 证明；
- 用接线成功替代几何 `checked`；
- 未经授权修改 Runtime / 只读几何模块。

### 验收

几何证据 gate 表：证据 / 产生者 / 验证方式 / 失败降级 / 对 NB/PU 的阻断；未闭合项显式列出。

## Answer

（resolved 时填写）
