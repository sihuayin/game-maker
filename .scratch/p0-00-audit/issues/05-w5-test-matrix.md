# 05. W5 测试与 fixture 代表性

Type: research
Status: resolved
Owner: claude（2026-10-20 认领 · research 子代理）
Blocked by: —
Map: ../map.md

## Question

建立测试矩阵，覆盖任务书 W5 的 11 类：

1. 合法输入成功路径。
2. 缺失字段与非法枚举。
3. 资源路线选择与不支持路线。
4. 上游模型输出结构合法但语义错误。
5. 参考图没有出现、但游戏需求要求生成的新实体。
6. 资源文件存在但内容 / 尺寸 / 帧数不符合预期。
7. 资源包成功但游戏构建失败。
8. 游戏可以启动但关键机制不可执行。
9. QA 发现阻断问题时，发布不会被误报成功。
10. CLI / MCP 对同一输入的关键行为一致。
11. 失败不消耗版本号，临时目录与失败产物遵循既有契约。

每项标注 `existing` / `missing` / `needs strengthening`，给出测试路径与用例名（如已确认），
并区分「断言字段存在」与「断言行为」。另列缺失的正例、负例、边界 fixture。

## 验收

矩阵完整、路径与用例名可查；缺失项明确写出；不得把未运行的测试写成通过。

## 边界

- 只读；零付费；不改源码 / 测试 / fixture；只写 `research/w5-test-matrix.md`。
- 可运行 `pnpm test`（本地、零付费），记录命令、退出码、失败摘要。
- 9 个包当前共 105 个 `*.test.ts`（assets 39 · contracts 29 · demo 10 · game-design 8 ·
  vision 5 · pipeline 4 · qa 4 · cli 3 · mcp 3），可作为起点。

## 产出

`research/w5-test-matrix.md`：11 类 × existing / missing / needs strengthening 矩阵 + `## Answer`。

## Answer

研究文件：[../research/w5-test-matrix.md](../research/w5-test-matrix.md)

- **11 类判定**：`existing` 3 类（合法输入成功路径、缺失字段/非法枚举、上游结构合法但语义错误）；`needs strengthening` 5 类（资源路线、文件内容/尺寸/帧数、pack 成功但构建失败、QA 阻断、失败不消耗版本/现场契约）；`missing` 3 类（参考图缺席的新实体、游戏启动后机制不可执行、CLI/MCP 一致性）。
- **证据等级**：`existing` / `needs strengthening` 的核心结论均为 **E2**（`pnpm test`：105 文件 / 1640 用例 / 退出 0，全部离线假上游或本地桩）；`missing` 为 **E1**（源码或 fixture 存在、无测试）；W5 不使用 E3，真实交付证据归 W6。
- **最大空白**：
  1. 类别 5：`fixtures/e2e/wasteland-platformer` 的错配 fixture 已存在，但没有任何测试断言「参考图里没有、需求要求的新实体」被生成、使用色板或进入配置。
  2. 类别 8：没有任何启动站点 / 注入输入 / 观察机制的测试；`td-sim` 是纯领域模拟，`qa/gameplay.ts` 明说不跑游戏，仓库未安装/未使用 Playwright/Puppeteer/jsdom（`pnpm-lock.yaml` 里只有 vitest 的可选 peer 条目）。
  3. 类别 10：没有 CLI/MCP 同输入对照测试。源码已有实质差异：MCP `create_game` / `assemble_site` 直接调 `assembleSite`，CLI 用 `assembleFromConfig` 按 `format` 分派（`packages/mcp/src/server.ts:287,319` vs `packages/cli/src/cli.ts:241,584`）；MCP 返回 `data` 缺少 `runDir/packDir/config/ambiguity/imageCalls`；MCP 不校验必填参数；MCP 未传 `hudLineHeight`（今天默认值同为 10，暂不可观察）。
  4. 类别 7：只有组件级 site 校验失败测试，没有「pack 成功 → site 构建失败」的 CLI/MCP 全链用例。
  5. 类别 3：第四个合法 `source.kind = "frames"` 没有 planner / resolver / sidecar 测试；`ops.ts:372` 将其候选折叠为 image。
- **强项**：CLI 两段式产物逐字节等价；run/pack 失败现场与版本不消耗；pack 帧数/尺寸/空格/横带对账；QA 硬失败「报告先落盘、再阻断、站点不产」；契约负例与 R12 拒绝。
- **测试环境**：`pnpm test` 退出 0；`pnpm typecheck` 退出 **2**，失败于 `packages/assets/tests/pack-sheet-grid.test.ts:150`（`ImageGenCall.requestedSize` 缺失）与 `packages/assets/tests/prompt.test.ts:257`（`Cannot find name 'CharacterDNA'`）。`pnpm test` 绿不覆盖类型正确性。
- **边界遵守**：只读；零付费；未运行任何 create/build/plan/pack/compile-runtime/compile-td-game/site 真实命令；未改 `game-maker.local.json`。
