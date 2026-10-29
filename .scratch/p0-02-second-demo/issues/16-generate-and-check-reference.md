# 生成并检查参考图

Type: task
Status: resolved
Blocked by: 15

## Question

按票 15 的裁定生成/获取参考图（零付费、确定性）：

- 若选 (a)：新建 effort-local 生成脚本，输出 480×270 PNG；
- 若选 (b)：复制 `fixtures/reference/halt-dusk.png` 并核对 provenance；
- 若选 (c)：核验用户提供的 PNG；
- 记录命令、退出码、sha256、尺寸、palette、provenance、可复现方式；
- 不调用付费生图服务；不改生产代码/历史实验。

产物：`.scratch/p0-02-second-demo/inputs/reference/`（PNG + provenance JSON）+ `research/16-reference-image.md`。

## Answer

**已生成（2026-10-29，零付费、确定性）。** 产物：`.scratch/p0-02-second-demo/inputs/reference/rooftop-dusk.png` + provenance JSON。

- 脚本：`.scratch/p0-02-second-demo/tools/generate-reference.mjs`（新建 effort-local，复用 `draw.mjs`；未改现有 `generate.mjs`/`draw.mjs`/fixtures/历史实验）。
- 尺寸 480×270 RGBA；3.1 KiB；18 命名槽位 / **16 唯一色**；每像素在色板内、alpha 全不透明。
- sha256 `1b926a5b…f6f2`；连续两次运行 sha 相同。
- 视觉：黄昏城市、落日、远景/中景建筑、暖窗、水塔、天线、钟楼、信使剪影；无文字/UI。
- **视觉验收尚未通过**；票 17 由用户接受/拒绝。零付费、零生产修改。

详见 [../research/16-reference-image.md](../research/16-reference-image.md)
