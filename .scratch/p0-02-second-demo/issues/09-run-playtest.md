# 运行真实浏览器 Playtest

Type: task
Status: resolved
Blocked by: 08, 25

## Question

用已批准的场景目录运行 `playtest <runDir> --scenario-dir <approved>`：

- 记录命令、退出码、attempt 目录、outcome、delivery.playtest 写回；
- 核对真实浏览器证据（chrome.log、events/trace/input/console/exceptions、site-integrity）；
- 失败即保留证据并记录，不自动重试、不修代码、不补写；
- 记录预算/调用（如涉及）。

产物：`run/vN/playtest/vK/` + `.scratch/p0-02-second-demo/research/09-playtest-evidence.md`。

## Answer

**已关闭（2026-10-29）：用户裁定暂停 P0-02 / 重画范围。** 本票未执行、未授权；零付费产物保留。恢复需按重画后的新范围另开图/新票。
