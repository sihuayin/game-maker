# FA-01D 验收场景进入交付链

Type: grilling
Status: resolved
Owner: main session · 2026-10-28
Map: ../map.md
Blocked by: 01

## Question

FA-01A 发现：验收场景放 effort `scenarios/` 时，`playtest.mjs --scenario-dir` 能跑，
但 `game-maker playtest <run>` 硬编码五态目录且只收 `required:true` 场景，所以验收场景进不了
CLI 归因/写回链，`delivery.playtest` 拿不到这次证据。裁定如何让本轮证据进入交付报告：

- **(a) 给 CLI 增加场景目录/场景选择参数**：公开 CLI 输入变更，需审批；不改场景协议。
- **(b) 直接跑 harness，另写本 effort 的验收脚本组装 `delivery` 与报告**：不改 CLI/协议，
  但 CLI 与报告不是同一路径，FA-05 必须证明二者一致。
- **(c) 把验收场景放进五态目录**：不推荐——污染自测与交付必需项。
- **(d) 其他**。

**已发现的具体前置**：FA-01 冻结出的 work 区 `run/v1/qa-report.json` 是历史 QA 层报告，
**没有 `delivery`**；`game-maker playtest` 的六项准备校验会直接拒绝。因此本轮必须先决定如何初始化
**本轮** delivery 信封：用 `buildDeliveryReport` 从本快照新鲜构建（asset-pack/config/qa/site 来自本快照，
playable-smoke 未跑、visual-review 未审），还是复制历史 stage-c 信封后覆盖——两者都必须避免继承历史
`visual-review: pass`。

**必须同时裁定**：
1. 若选 (b)，`delivery.playtest` 摘要由谁生成、如何保证与 CLI 路径同源（复用同一 `mapPlaytest` /
   `buildDeliveryReport` 纯函数），以及 CLI/MCP 是否仍显示「尚无试玩证据」。
2. 若选 (a)，变更是否触碰「CLI 公开输入输出」审批红线；是否只加可选参数、默认行为不变。
3. 无论哪条，FA-05 的一致性检查如何覆盖「CLI / MCP / 交付报告 / Markdown 报告」四条路径。

推荐：**(b)** 为默认；只有在「必须由 CLI 产出 delivery」时才提 (a) 审批。

## Answer（裁定 + 实施 · 2026-10-28）

### 裁定

| 项目 | 裁定 |
|---|---|
| 验收场景入口 | **(a) `--scenario-dir`**（仅增加可选参数） |
| Delivery 初始化 | **(E1)** `buildSiteSuccessDelivery` + `writeDeliveryToReport` 新鲜构建 |
| 路径解析 | 相对路径按 `cwd`，绝对路径原样 |
| 场景选择 | 保留 `harnessCondition:"none"` + `required:true` |
| 错误语义 | 缺值 = usage（exit 2）；目录/场景无效 = invalid（exit 4） |
| 测试 | `parseArgs` + 纯函数，本轮不启动 Chrome |
| 输出/协议 | 不新增输出字段，不改 MCP，不改 `playtest-scenario/v1` |

### 实施

- `packages/cli/src/playtest.ts`：新增 `selectScenarios(dir, siteVersion)`（只读、无副作用；
  目录/schema/siteVersion/必需场景校验；保留原过滤语义）；`resolveTarget` 接受 `scenarioDir`
  （默认 `SCENARIO_DIR`）；`runPlaytestCommand` 接受可选 `scenarioDir`，相对路径按 `cwd` 解析。
- `packages/cli/src/cli.ts`：`--scenario-dir <目录>` 加入 usage、help、`takesValue` 和 playtest 分支；
  默认仍是五态目录。
- 测试：`packages/cli/tests/playtest-scenario-dir.test.ts` 9 条（有效 required / required+诊断混合 /
  只有诊断 / 空目录 / schema 不过 / siteVersion 不匹配 / 目录不存在 / 不是目录 / 默认五态只选 `success-basic`）
  + `packages/cli/tests/cli.test.ts` 的 `parseArgs` 1 条。
- 错误码实测：缺值 → `parseArgs` 用法错（exit 2）；目录不存在 → CLI 进程 **exit 4**；
  只有诊断场景 → **exit 4**（错误信息带目录路径与原因）。
- 默认行为：`selectScenarios(packages/demo/probe/playtest/scenarios/five-state, 1)` 只返回
  `success-basic`，五态默认不变。

### E1：delivery 信封已初始化

`acceptance/init-delivery.mjs` 在 work 区调用 `buildSiteSuccessDelivery` + `writeDeliveryToReport`：

- 六项检查：`asset-pack/config/qa/site = pass`；`playable-smoke/visual-review = incomplete`。
- `verdict = incomplete`；`visualReview = { status: "pending" }`；`delivery.playtest` 尚未写入。
- QA 层字段（`subject/checked/failures/observations`）与快照逐字一致；快照零写入。
- work 与快照的差异仅 `run/v1/qa-report.json`（新增 delivery）；`site` 4/4、`pack` 46/46、
  `run/v1/game-config.json` 字节一致。

### 回归

- `pnpm test`：144 个测试文件、**2142 个测试全过**。
- `pnpm typecheck`：绿。
- `pnpm build`：绿。
- 未重跑 `pnpm test:playtest` 的 self-test：它默认覆盖已跟踪的历史证据（FA-01B 已记录并恢复过一次）；
  本票未改 harness，self-test 在 FA-01B 已绿。FA-06 需先隔离其输出。

### 范围合规

只增加一个可选 CLI 参数及其必要测试；未新增命令、未改 MCP、未改协议、未新增输出字段、
默认五态行为不变。E1 使用现有 pipeline API，无新契约。

→ **FA-02 解除阻塞**；work 区 delivery 信封已就位。
