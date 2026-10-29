# 票 16 · 生成并检查参考图

| 属性 | 值 |
|---|---|
| 结果 | **已生成**；待票 17 用户视觉验收 |
| 脚本 | `.scratch/p0-02-second-demo/tools/generate-reference.mjs`（新建，effort-local） |
| 命令 | `node .scratch/p0-02-second-demo/tools/generate-reference.mjs` → exit 0 |
| 产物 | `.scratch/p0-02-second-demo/inputs/reference/rooftop-dusk.png` |
| Provenance | `.scratch/p0-02-second-demo/inputs/reference/rooftop-dusk.provenance.json` |
| 尺寸 | 480 × 270 RGBA |
| 文件大小 | 3.1 KiB |
| sha256 | `sha256:1b926a5bb052bd434893007b7ccc21f580c597a7c857ce582dbd8b4ad719f6f2` |
| 色板 | 18 个命名槽位 / **16 个唯一色**；图上 16/16 使用；每像素都在色板内、alpha 全不透明 |
| 确定性 | 连续两次运行 PNG sha 相同（`1b926a5b…f6f2`） |
| 付费 | 零；无外部生图调用 |
| 生产代码 | 零修改；未改现有 `generate.mjs`、`draw.mjs`、fixtures 或历史实验 |

## 视觉检查（代理侧）

生成图可见：

- 黄昏天空：深蓝 → 蓝绿 → 橙 → 暖奶油四层硬边色带；
- 落日与光晕，被远景城市剪影部分遮挡；
- 远景高低塔楼 + 天线；中景建筑带暖色窗格；
- 前景屋顶：水塔、天线、管道、通风口、绿色植栽；
- 右侧钟楼（goal 视觉锚点）；
- 一名信使剪影（头/身体/腿/挎包）；
- 无文字、无 UI。

## 限制

- 它是程序化插图，不是真实游戏截图；不代表最终画面密度。
- **视觉验收尚未通过**；票 17 由用户本人确认接受/拒绝。
- 上游重编码仍可能让提取出的 palette 有偏差；本图的 16 色自检只证明源文件像素干净。
- 若用户拒绝，回到票 15/16 调整；不得直接进入 `create` checkpoint。

## 复现

前置：`packages/assets/dist/` 存在（干净 clone 先跑 `pnpm build`；只写被忽略的 `dist/`）。

```bash
node .scratch/p0-02-second-demo/tools/generate-reference.mjs
# → inputs/reference/rooftop-dusk.png
# → inputs/reference/rooftop-dusk.provenance.json
```
