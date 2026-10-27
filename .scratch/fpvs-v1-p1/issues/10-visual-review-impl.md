# 10. 视觉评审写入实施（CLI 命令 + visualReview 落盘）

Type: task
Map: ../map.md
Blocked by: 08

## Question

落地票 06 裁定的视觉评审写入（实施）：

1. **CLI 命令**：新增 `game-maker review-verdict <runDir> --verdict pass|fail [--note "..."] [--reviewer "..."]`（仅 CLI、不加 MCP）。
   - **校验归属**：确认 runDir 是有效 run、qa-report.json 存在、`--verdict` 合法；
   - 写 `delivery.visualReview = { status, reviewer（默认 git user）, reviewedAt: now, note }`，**原子更新**（沿用现有原子替换方式，不就地覆写）；
   - 不 touch QA 层字段；缺 delivery 时初始化（不伪造站点版本）。
2. **状态**：复用 `HumanVerdict` 三值 `pending|pass|fail`；不加「取消/无效/重新评审」。
3. **默认 pending**：每个 run 的 `delivery.visualReview.status` 默认 `pending`，禁止跨 run 复制结论（版本绑定保证，新报告每次重写）。
4. **P0-06 写回**：阶段C 从票 02 Answer **转录** `{status:"pass", reviewer:人类, reviewedAt:2026-10-27, note:无}` 进 E2E 报告，不冒充重新评审。
5. **测试**：pass/fail 写入、归属校验（非法 runDir/缺 qa-report 拒绝）、原子更新不覆盖 QA 层、默认 pending、跨 run 不继承。

边界：复用 HumanVerdict、不加 MCP、评审字段最小化（参考图/截图走 evidence[]、包版本走 pack、执行走 runId）。票 06 裁定全文见 issues/06-visual-review-mechanism.md。
