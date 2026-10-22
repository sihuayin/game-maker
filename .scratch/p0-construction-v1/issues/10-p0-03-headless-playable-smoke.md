# 10. P0-03 · 可玩性 headless smoke

Type: task
Status: open
Owner: —
Blocked by: 07
Map: ../map.md

## Question

新增**最小** headless 浏览器 smoke：真实启动站点、注入状态感知输入、验证拾取与胜利可达。
对应 `CAP-QA-07`，范围见 `docs/v4/P0-00-p0-scope.md` §3 P0-03。

- 优先复用 W6 的 CDP 脚本思路（系统 Chrome 155 + CDP），**不新增 Playwright / Puppeteer 依赖**；
  若确需新依赖，按 Q5 交逐项清单获批后才动。
- 流程：启动本地静态服务 → 打开站点 → 注入**状态感知**的移动 / 跳跃
  （读 x / y / onFloor / blockedRight / collected，不写死时序）→ 断言至少一个 pickup 被收集 →
  到达 gate → `won=true`。
- 用 fixture pack + config（优先 v7 + 已验收 config）离线运行；零付费。
- 负例：`objective.gate` 指错 / 拿掉一个 pickup / 破坏输入 ⇒ smoke 必须红，并指出失败阶段。
- **票 07 的软锁专项用例**（票 06 §6.3）：「木箱顶起跳 → 空中撞 hazard → 重置」后连续采样 30 帧，
  断言 `body.bottom <= floorY + 1`、`onFloor` 变真、`won` / `collected` 不变；**重复触发两次**脚线相同。
- 命令：新增独立 `pnpm test:playable`（Q8 A）；默认 `pnpm test` 保持无浏览器依赖；
  最终验证票必须跑它。浏览器不可用时**失败并记录**，不得静默跳过成绿。

## 验收

- 正常 fixture：启动、移动、跳跃、至少 1 个 pickup、到达 gate、`won=true`；exit 0。
- 负例三类各自非 0，并指出失败阶段。
- 运行记录：命令、Chrome 版本、站点目录、截图 / 轨迹路径、耗时；零付费。
- 与票 07 的软锁复现共用同一驱动或至少同一状态读取方式。
- `pnpm test` / `pnpm typecheck` 全绿（`test:playable` 单独跑）。

## 边界

- 不做视觉质量 / 风格相似度判断；不做全机制 / 难度 / 多关覆盖；不引入 CI 重构；
  不改变站点运行时行为（只加验收）。
- 状态感知优先，不接受固定 `sleep` 时序；超时 / 重试策略必须在票内写清。
- 不改 v7 包与 `fixtures/`；测试产物写 `.scratch/p0-construction-v1/runs/`；不提交。

## 产出

`## Answer`：脚本位置、`pnpm test:playable` 实际运行结果（含 Chrome 版本与耗时）、
正例 / 负例证据路径、状态读取接口说明。
