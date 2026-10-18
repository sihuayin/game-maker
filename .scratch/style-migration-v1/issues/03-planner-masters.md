# 03. Asset Planner 不再产出角色母版：0 masters

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自 B 阶段（`runs/2026-10-18d/`）：19 个资源、18 次预计生图、**母版 0 张**。
> 旧 v2 配方（`run-out-2026-10-17d`）有 2 张母版。C 探针手工补了一张才测到 DNA→母版→动画。
> ⚠️ **立票 ≠ 批准施工**。

## 1 · 证据

- B 清单：`animation×6 · sprite×9 · background×1 · ui×3`；`imageCallBreakdown.master = 0`。
- 三个 `characterId`（`scavenger-actor` / `wasteland-enemy` / `ceiling-lurker`）都没有 `masterAsset`，
  `authoring[]` 为空。
- 旧配方有 `master-player-scavenger` / `master-enemy-wasteland`，动画 spec 带 `masterAsset`。
- 探针 `probe-player-recipe.json` 手工补 master 后，pack 能走通母版→动画。

## 2 · 要做什么

- 查清 v3 planner 是否**有意**去掉母版，还是提示词/后处理漏了。
- 若是漏了：让 planner 为每个有 `characterId` 的动画资源生成 `authoring[]` 母版条目并写 `masterAsset`。
- 若不是漏了：在票面记录理由，并更新测试/文档，避免“角色一致性靠 DNA 直出”成为未声明行为。

## 3 · 验收

1. 一份 fixture 设计 → plan 产出中，每个角色至少一张母版、每个动画 `masterAsset` 指向它。
2. 先红后绿。
3. 不改变旧清单的行为（无 `masterAsset` 仍可跑）。

## 4 · 边界

- 不跑付费上游；不写 `game-maker.local.json`。
- 不改变 master 比例判据（另票 / 雾）。
