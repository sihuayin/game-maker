# 06. 整包风格迁移：10/19 个 drawlist 资源怎么办

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自 B 阶段清单：19 个资源里 10 个是 drawlist（地板/平台/通风管/台阶/木箱/破墙/坍塌地板 + 3 个 UI）。
> drawlist 是平涂矩形/椭圆，结构上达不到图 43 的细节。
> ⚠️ **立票 ≠ 批准施工**。

## 1 · 证据

- B 清单：`collapsed-floor` / `tile-floor` / `metal-platform` / `vent-duct` / `concrete-step` /
  `wooden-crate` / `broken-wall` / `hud-panel` / `scrap-icon` / `health-icon` 均为 drawlist。
- 图 43 的道具/瓦片有明显的描边、3–4 级明暗、锈/污/破损。
- create 链今天**不支持** `existingAssets`（v3 边界）⇒ 从图 43 裁切导入不能直接进主链。

## 2 · 要做什么

三选一（需人裁）：

1. **转 image**：每个资源 +1 次生图；风格统一，成本增加。
2. **drawlist 加细节**：零生图，但要在代码里堆矩形，仍没有描边/明暗。
3. **导入裁切**：最像、零生图，但要扩 create 链的 `existingAssets`（更大改动）。

## 3 · 验收

- 选定路线后，10 个资源逐项有明确来源与测试。
- 若转 image：清单/包/站点不回归；预计生图调用数在票面写死。
- 若导入：引用族 gate 与原子发布语义不变。

## 4 · 边界

- 本票不跑付费上游。
- 不改变 AssetPack 目录结构。
