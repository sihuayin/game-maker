# 生成并检查参考图

Type: task
Status: open
Blocked by: 15

## Question

按票 15 的裁定生成/获取参考图（零付费、确定性）：

- 若选 (a)：新建 effort-local 生成脚本，输出 480×270 PNG；
- 若选 (b)：复制 `fixtures/reference/halt-dusk.png` 并核对 provenance；
- 若选 (c)：核验用户提供的 PNG；
- 记录命令、退出码、sha256、尺寸、palette、provenance、可复现方式；
- 不调用付费生图服务；不改生产代码/历史实验。

产物：`.scratch/p0-02-second-demo/inputs/reference/`（PNG + provenance JSON）+ `research/16-reference-image.md`。
