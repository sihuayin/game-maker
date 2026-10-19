# 06. 整包风格迁移：10/19 个 drawlist 资源怎么办

Type: task
Status: resolved
Owner: claude (2026-10-19 · 人裁「只裁定」→「关票」)
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

## Answer

**一句话**：10 个 drawlist 走**混合路线** —— 7 个环境/道具从图 43 **裁切导入**，3 个 UI **保留 drawlist**；
零新增生图、预算维持 21；不扩 `create` 的 `existingAssets`、不改 planner 全局规则。

### 逐字裁定（人裁 2026-10-19）

**Q1 = D · 采用混合路线。** `collapsed-floor`、`tile-floor`、`metal-platform`、`vent-duct`、
`concrete-step`、`wooden-crate`、`broken-wall` 共 7 个环境/道具资源采用图 43 裁切导入；
`hud-panel`、`scrap-icon`、`health-icon` 共 3 个 UI 资源保留 drawlist。
此次迁移不新增生图调用，预算维持 21 次，不扩展 `create` 的 `existingAssets`，不修改 planner 全局规则。

**Q2 = A · 只裁定。** 写入 Answer、关票、更新地图；不制作裁切表、PNG 或迁移配方，
不修改源码，也不运行构建或生成流程。实际施工须另行授权。

**裁定依据（逐字）**：迁移的目标是提高资源对目标风格的保真度，而不是统一资源的技术实现方式。
图 43 已有明确对应的环境与道具，且现有 `pack` 导入管线能够处理 import 资源，因此优先复用已有视觉资产；
三个小尺寸 UI 则保留 drawlist，避免裁切、透明背景清理和降采样造成不必要的清晰度损失。

**边界明确（逐字）**：本轮只确定路线，不代表 7 张资源已经完成裁切，也不代表迁移配方已经落地。
后续施工需要单独授权；任何付费生成或上游调用均不在本轮授权范围内。

### 依据（查到的）

- 10 个 drawlist：`collapsed-floor 64×32` · `tile-floor 64×64` · `metal-platform 96×48` ·
  `vent-duct 96×40` · `concrete-step 64×48` · `wooden-crate 48×48` · `broken-wall 64×96` ·
  `hud-panel 48×48` · `scrap-icon 16×16` · `health-icon 16×16`。
- 图 43 里十个都有直接对应物：Floors 的碎砖/泥地/裂纹地砖、Platforms 的金属格栅与楼梯、
  通风口、木箱、破损墙板、空的 UI 格/血条、健康与装备图标。
  色板本来就是从这张图确定性提取的（票 04），裁切导入后量化几乎无损。
- **`pack` 今天就支持 `source: { kind: "import", ref: "..." }`**（`pack.ts` 导入支：
  trim → 降采样 → alpha 二值化 → 量化到世界色板）；`existingAssets` 在
  `packAssets` / `planAssets` 里也有，只是 create 链传空。
  ⇒ 一份迁移配方 + `pack` 不需要改源码；「扩 create 的 existingAssets」只在要求
  `create` 命令也自动走 import 时才需要。
- 导入的代价：图 43 的底是深色网格（两色），不是可键出的纯色；
  要产出透明 PNG（或显式给 background），这是一次性裁切/清理。
- 留 drawlist 的 3 个 UI：drawlist 提示词已经要求 1px 深色描边 + dither 材质；
  在 16×16 / 48×48 下比降采样裁切更清晰。

### 没有做 / 边界

- 没有制作裁切表、透明 PNG 或迁移配方；没有改源码；没有运行构建/生成流程。
- 没有新增生图调用；下一轮预算仍是 **21 次**。
- 没有扩 `create` 的 `existingAssets`；没有改 planner 全局规则。
- 后续施工另立票 09（免费施工，待授权）；真实 pack 另立票 10（付费，需另出报告 + 逐字点头）。
