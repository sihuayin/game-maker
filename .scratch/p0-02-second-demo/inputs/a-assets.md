# A · 屋顶信使 · 资源清单

> 这是给资源规划/生图的输入草案，不是最终 `asset-recipe`。最终以模型规划与 `pack/v1` 为准。

## 参考图要求（供票 04 批准）

- 一张 PNG；黄昏城市天际线：蓝绿天空、暖色窗光、屋顶/天线/水塔剪影；
- 明确的 16 色左右色板，便于 `stylespec` 提取；
- 不包含 UI、文字或复杂角色特写；角色风格由资源生成阶段决定。

## 资源表

| 资源 ID | 种类 | 目标尺寸 | 动画/帧 | 用途 |
|---|---|---|---|---|
| `player-courier` | character | 24×32 | `idle` 2 / `run` 4 / `jump` 2 | 玩家 |
| `bg-sky-dusk` | background | 480×270 | 1 | 天空层 |
| `bg-city-far` | background | 480×270 | 1 | 远景城市 |
| `bg-city-mid` | background | 480×270 | 1 | 中景建筑 |
| `solid-rooftop` | solid | 32×16 | 1 | 屋顶/地面 |
| `solid-awning` | solid | 32×16 | 1 | 雨棚/平台 |
| `solid-watertower` | solid | 32×32 | 1 | 水塔平台 |
| `solid-antenna` | solid | 16×32 | 1 | 天线平台 |
| `pickup-letter` | pickup | 12×12 | 1 | 信件（4 个） |
| `goal-clocktower` | goal | 32×48 | 1 | 钟楼门/信标 |
| `hud-panel` | ui | 96×24 | 1 | HUD 底板 |
| `hud-pip` | ui | 8×8 | 1 | 收集计数点 |
| `chest-mailbox`（可选） | chest | 16×16 | `closed` / `open` 2 | 可选信箱 |

## 图集

- `atlas.sprites`：玩家、pickup、solids、goal、可选 chest；
- `atlas.backgrounds`：三层背景；
- `atlas.ui`：HUD panel + pip。

## 约束

- 来源：`generated`（新参考图 → 新视觉世界），不复用冻结 wasteland 包；
- 所有资源使用 16 色左右统一色板，色板外像素应为 0；
- 背景长宽比必须精确匹配 480:270；玩家动画必须有 `idle` / `run` / `jump`；
- 不要求宝箱；若模型未生成 `chest`，不视为失败（Q3 = c）。
