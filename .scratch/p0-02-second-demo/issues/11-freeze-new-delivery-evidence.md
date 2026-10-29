# 冻结新交付身份与证据

Type: task
Status: resolved
Blocked by: 06, 09, 10

## Question

对新交付做只读冻结：

- 对 `run/pack/site` 做只读快照与逐文件 sha256；
- 记录 delivery 身份（pack id/version/checksum、config checksum、site/shell 版本）与 Playtest attempt；
- 保留人工视觉记录；
- 运行前后校验快照零变化；
- 不覆盖历史；不生成正式证据清单、不跑 `verify-delivery`（后续缺口）。

产物：`.scratch/p0-02-second-demo/freeze/`（snapshot/hashes/identity）+ `.scratch/p0-02-second-demo/research/11-freeze.md`。

## Answer

**已关闭（2026-10-29）：用户裁定暂停 P0-02 / 重画范围。** 本票未执行、未授权；零付费产物保留。恢复需按重画后的新范围另开图/新票。
