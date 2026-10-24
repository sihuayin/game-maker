# 09. moving-platform 如实标记为非 supported

Type: task
Status: open
Owner: —
Blocked by: 12
Map: ../map.md

## Question

把 `moving-platform` 如实标记为 non-supported（`experimental` / `unsupported`），并写一条 witness 测试证明
「带 motion 的 solid 不移动」，暴露这条伪支持缺口（第一轮裁定 Q4）。补实现**另立票，不在本图**。

## 现状（E1）

- `moving-platform` 在 `MECHANICS`（`vocabulary.ts:34-51`）/ `RuntimeProfile`（`runtime-profile.ts:117`）/
  config（`Motion`，`game-config.ts:59-65`）/ 可达性（`reachability.ts:67-72`）都在，但渲染器只在 `case "hazard"`
  读 `motion`（`scene.ts:154`），带 motion 的 solid 是静态体、永不移动。

## 建议

依赖 [票 12](12-registry-witness-impl.md) 的 status 落账 + 见证框架落地后：witness 测试钉住「solid+motion 不移动」→
registry 把 `moving-platform` 标 `experimental`（非 `supported`）→ 覆盖报告里它不得伪装成 satisfied。
补实现（渲染器真移动 solid）另立票，落 Out of scope。
