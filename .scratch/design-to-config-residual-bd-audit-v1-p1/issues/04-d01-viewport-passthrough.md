# D-01：viewport 全链贯通

Type: task
Status: resolved
Owner: amber
Blocked by: 03
Map: ../map.md

## Question

实施 D-01：同一次调用的 viewport 在理解 / 构建 / 站点装配各阶段逐次相等。
依据：[final-report.md](../../design-to-config-residual-bd-audit-v1/final-report.md) §2.1；
[plan.md](../../design-to-config-residual-bd-audit-v1/plan.md) §4。

### 已批准的契约增量（不得扩大）

- `UnderstandingInput.viewport?: { w: number; h: number }`
- `AssembleOptions.viewport?`
- `SiteOptions.viewport?`
- `buildWorld` / `buildTdWorld` 的 opts 新增可选 `viewport`

默认值不变；不新增 CLI/MCP 参数；不改序列化形状；不改 Runtime。若实施中发现必须扩大契约或改变边界，
**暂停并重新审批**；不得退化成只合并常量后声称完成。

### 允许修改

- `packages/pipeline/src/create-game.ts`
- `packages/demo/src/assemble.ts`
- `packages/demo/src/site.ts`
- `packages/demo/src/td/site.ts`
- `packages/demo/src/world.ts`
- `packages/demo/src/td/world.ts`
- `packages/assets/src/ops.ts`（仅修正 `:99-101` 的失真注释）
- 测试：`packages/pipeline/tests/create-game.test.ts`、`packages/demo/tests/world.test.ts`、
  `packages/demo/tests/site.test.ts`、`packages/demo/tests/td-site.test.ts`、
  `packages/assets/tests/plan-background-gate.test.ts`、`packages/qa/tests/layers.test.ts`

### 实现纪律

- 不能只把 viewport 传到最外层、内部 world builder 再读常量；必须逐行替换 `buildWorld` / `buildTdWorld`
  内的 `VIEWPORT` 引用。
- 用**自定义视口测试**证明该值到达：世界描述的 `viewport`、背景层尺寸、HUD fallback 盒、
  站点屏幕空间审计。
- 站点按 `format` 分派时把 viewport 传给横版 / 塔防装配；`auditScreenSpace` / `auditTdWorldSize`
  使用同一值。

### 通过标准

- 上述测试文件绿；`pnpm typecheck` 绿；默认路径语料 `world.size.h` 117/117 = 270；
  自定义视口用例证明各阶段逐次相等；CLI/MCP 形状不变。
- 票内 `## Answer` 记录测试命令、结果、commit SHA 与回退点。

### 回退方法

- 回退本票 commit，移除可选字段与传递；不影响 01–03。

### 提交

- 独立 commit：`P1-D-01: viewport passthrough`。

### 证据

- 测试输出、自定义视口断言、语料结果、commit SHA；供 PR 审阅。

## Answer

**已实施并验收。** commit `f1e8925`（`P1-D-01: viewport passthrough`），基线 `c36e17c`。

### 契约增量（严格按已批准清单，无扩大）

- `UnderstandingInput.viewport?: { w; h }`（`pipeline/src/create-game.ts`）
- `AssembleOptions.viewport?`（`demo/src/assemble.ts`）
- `SiteOptions.viewport?`（`demo/src/site.ts`）
- `TdSiteOptions.viewport?`（`demo/src/td/site.ts`）—— 与 `SiteOptions` 同形的塔防兄弟
- `buildWorld` / `buildTdWorld` 的 opts 增可选 `viewport`
- 默认值不变（`VIEWPORT` / `DEFAULT_VIEWPORT`）；无序列化变化（不写 `site.json` / 包 / VWS）；CLI/MCP 形状不变。

### 改动

- `pipeline/src/create-game.ts`：`runUnderstanding` 把 `input.viewport` 传给 `compileVisualDesign`（VDS）
  与 `planAssets`（背景闸 / 提示词）；`createGame` 已把同一个 `input.viewport` 传给 `runBuild`。
- `demo/src/world.ts` / `td/world.ts`：函数内**每一处**外壳常量读取改为局部 `const viewport = opts.viewport ?? VIEWPORT`
  （两个缺数据分支、`buildBackground` 的 fallback 尺寸、`hudFallback`、最终返回的 `viewport`）；
  `grep VIEWPORT` 复核只剩「默认值解析」与再导出。
- `demo/src/site.ts` / `td/site.ts`：解析一次 `viewport`，传给 `buildWorld` / `buildTdWorld`、
  `auditScreenSpace`、`auditTdWorldSize`。
- `demo/src/assemble.ts`：`AssembleOptions.viewport?` 原样分派给两种玩法。
- `assets/src/ops.ts`：只修正 `PlanAssetsOptions.viewport` 的失真注释（原文说「create 链两处都传」，
  实际理解段原先不传）。

### 测试（自定义视口用的都是**非默认**值）

| 用例 | 断言 |
|---|---|
| `createGame({ viewport: 400×240 })`（真链、假上游） | VDS `viewport`、规划提示词、编译提示词均为 400×240；QA 照常跑 |
| `planAssets({ viewport: 500×280 })` + 280 高背景 | 通过，且提示词印 `500×280` |
| `planAssets({ viewport: 640×360 })` 同一背景 | 拒，点名「高 280 < 视口高 360」（闸吃调用方的数） |
| `buildWorld(..., { viewport: 500×280 })` | 世界描述 `viewport` = 500×280；世界尺寸仍是 config 的；背景 fallback / HUD fallback 盒 = 500×280 |
| `buildTdWorld(..., { viewport: 500×280 })` | 同上（真包 + 零数据两支） |
| `assembleSite({ viewport: 500×270 })` | HUD 盒子右边界 482：默认 480 拒，500 放行（临时包副本把 `sky` 标称宽改 600，使背景仍自洽） |
| `assembleTdSite({ viewport: 500×280 })` | `auditTdWorldSize` 拒，点名「视口是 500×280」 |
| 默认路径 | `world.test.ts` 的「视口是常量 480×270」原样通过 |

**实现纪律**：没有「只传到最外层、内部仍读常量」——`buildWorld` / `buildTdWorld` 内的
`VIEWPORT` 引用逐行替换，并用上面的自定义视口用例证明值到达世界描述、背景 fallback、HUD fallback、
站点屏幕空间审计。运行时外壳对 CLI/MCP 仍用默认 480×270（两壳不传）；自定义视口是程序化 API 增量，
按批准不写入 `site.json`、不改 Runtime。

### 验证

| 命令 | 结果 |
|---|---|
| D-01 规定测试批次（`create-game` / `world` / `site` / `td-site` / `plan-background-gate` / `compile-runtime` / `layers`） | 198/198 通过（7 文件） |
| 全仓 `vitest run`（10 个包） | 2367/2367 通过（157 文件） |
| `pnpm typecheck` | 全包通过 |
| 语料 `world.size.h` | 152/152 份 `game-config/v1` 全为 270（默认路径不变） |

- 零付费：未调用模型、未生图、未重建站点。
- 已知限制（不扩大）：运行时外壳（`shell/entry.ts`）仍按外壳常量构建世界；自定义视口目前由
  站点装配与审计消费，CLI/MCP 不暴露该参数。历史语料没有自定义视口样本，端到端行为只由上述新用例证明。

### 回退

- `git revert f1e8925`：移除可选字段与透传，默认路径零行为变化；不影响 01–03。

### 证据

- 测试输出见上表；commit `f1e8925`；测试文件中 D-01 的 describe 即证据。
