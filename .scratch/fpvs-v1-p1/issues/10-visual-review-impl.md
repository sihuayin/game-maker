# 10. 视觉评审写入实施（CLI 命令 + visualReview 落盘）

Type: task
Status: resolved
Owner: main session · 2026-10-27
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

## Answer（实施 · 2026-10-27）

- **CLI 命令**：`game-maker review-verdict <runDir> --verdict pass|fail [--reviewer <名字>] [--note "..."]`（仅 CLI、
  不加 MCP）。归属校验三连：runDir 是 `v<N>` 形状 / `qa-report.json` 存在 / `--verdict` 合法（pass|fail）。
- **写回**：`packages/pipeline/src/delivery.ts` 新增 `writeVisualReviewToReport(outRoot, runDir, review)` —— 读回报告、
  把评审**只并进 `delivery` 那三处**（`visualReview` 对象 / `visual-review` 检查项 / `verdict` 重算），其余字段与 QA 层
  一个字不碰；缺 `delivery` 时初始化一份（身份从 `subject` + runDir 推，**不伪造站点版本**）。**原子替换**（先写 `.tmp` 再 rename）。
- **纯函数**：`packages/contracts/src/delivery.ts` 新增 `visualReviewToCheck`（pending→incomplete、pass→pass、fail→fail）
  与 `applyVisualReview`（经 `buildDeliveryReport` 重算 verdict，不会漏「视觉从 pending 改 pass 后 verdict 没跟上」的假绿）。
- **状态**：复用 `DeliveryVisualReviewStatus` 三值 `pending|pass|fail`（值同 HumanVerdict，不加取消/无效/重评）。
- **默认 pending**：`buildDeliveryReport` 缺省 `visualReview = { status:"pending" }`（票 08 已定）；每个 run 独立初始化，
  结论不跨 run 复制（版本绑定保证）。
- **测试**：`contracts/tests/delivery.test.ts`（+4）· `pipeline/tests/delivery.test.ts`（+4）· `cli/tests/review-verdict.test.ts`
  （新，6 条）—— pass/fail 写入、归属校验（非法 runDir / 缺报告 / verdict 非法 → exit 2）、不覆盖 QA 层、初始化不伪造站点、
  原子替换无 .tmp 残留、跨 run 不继承。

**验证**：`pnpm vitest run`（contracts 35 / pipeline 12 / cli review-verdict 6）绿；`pnpm test` 全仓 **2054/2054** 绿；
`pnpm typecheck` 全绿。

**范围注**：P0-06 写回（票 10 项 4）**留待阶段C** —— 从票 02 Answer 转录 `{status:"pass", reviewer:人类, reviewedAt:2026-10-27}`
进 E2E 报告，不冒充重新评审（见地图 `Not yet specified` 的「阶段C 真实产物验收」）。
