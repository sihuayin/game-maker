# 08. v7 第一份验收报告与集成验证

Type: task
Status: resolved
Owner: task 子代理 · 2026-10-21
Blocked by: 06, 07
Map: ../map.md

## Question

在 01–07 完成后：

1. `pnpm build`（允许，只写 gitignored `dist/`）。
2. 用 CLI `accept` 对 v7 包 + baseline 生成第一份报告：
   - 包：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
   - baseline：`fixtures/animation-baselines/scavenger-idle/`
   - 输出默认 `out/ruin-scavenger-extraction-assets/acceptance/v1/`（或等价 `--out`）。
3. 校验：exit 0（结构无 error）；`report.json` 过 `parseAnimationAcceptance`；
   findings 中不得有结构 error；runtime 状态为 `unverified`（Tier 1 无 CDP）；
   记录 baseline 指标与 v7 读数。
4. 通过 MCP 的测试/调用路径确认 `accept_asset_pack` 与 CLI 同源（不要求真 MCP 进程；
   现有 server 测试模式即可）。
5. 确认包与 fixture 未被修改（前后 sha256/mtime）。

## 验收

- 报告路径、exit code、findings 摘要、baseline 指标、运行时状态均记录。
- 包 / baseline 未被修改；未写 `out/` 之外的产物（测试/报告除外）。
- 不提交；不付费。

## 边界

- 不跑 `create` / `pack` / `site` 生成链；不改运行时；不提交。
- 不碰 `CONTEXT.md` / 无关 `.scratch`；不写 `map.md`。

## 产出

本票 `## Answer`：报告路径、exit code、findings/metrics 摘要、MCP 同源证据。


## Answer

**结论：v7 第一份 `animation-acceptance/v1` 报告已生成，结构全绿（0 findings），CLI exit 0；MCP 与 CLI 的 `data` 逐字段一致；包与 fixture 逐字节未变。**

### 构建

- `pnpm build` → **exit 0**。写入仅限各包 gitignored 的 `dist/`（`tsc -b` 产物 +
  esbuild bundle：`packages/demo/dist/shell.js`、`packages/cli/dist/cli.mjs`、`packages/mcp/dist/server.mjs`）；
  `git status` 未出现 `dist` 或新的源码改动。

### CLI 验收

- 命令：`node packages/cli/dist/cli.mjs accept .scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7 --baseline fixtures/animation-baselines/scavenger-idle --out out`
- **exit code = 0**（首次运行因 zsh `PIPESTATUS` 取值失败未记到码；以同一输入的 `--json` 复跑测得 0，
  且 `out/` 中仅有 v1，未被复跑污染 —— 复跑写到 `/tmp` 临时目录，验证后已删）。
- 报告：
  - `out/ruin-scavenger-extraction-assets/acceptance/v1/report.json`
  - `out/ruin-scavenger-extraction-assets/acceptance/v1/report.md`
- `parseAnimationAcceptance(report.json)` → **ok: true**；`format: animation-acceptance/v1`，13 个动画。
- **findings：0 条**（error 0 / warning 0 / info 0）。
- `human.verdict: "pending"`，7 项 human items 齐全且全 pending、`reviewer/reviewedAt` 为 null。
- `runtime.status: "unverified"`，`evidence` / `declaredVsActual` 为空（Tier 1 无 CDP）。
- checksum 核对：
  - `pack.manifestChecksum = sha256:e620cd7eed22dda5b2316a70db006b0a84a1b6d58853f4733f1abaeeffd38326`
    == v7 `manifest.json` 实测 sha256（也与 `baseline.json` 的 `manifest.checksum` 一致）。
  - `baseline.checksum = sha256:6a65beeea6de4206f7fe44c04f91ece411e2b319d023e736135a7b3a571b63ba`
    == `fixtures/animation-baselines/scavenger-idle/baseline.json` 实测 sha256。
- baseline 指标（`baseline.json.expectedMetrics`）与 v7 idle 读数**逐项相等**：
  alpha 0.4% / bbox 0.2% / position 0.4% / backgroundL1 3 / paletteCountMin 18 /
  offPalette 0 / boundaryDark 87.4% → **verdict green**。
- 其余 12 个动画均有 metrics + verdict，读数按动画内部 raw 帧差异计算（非 baseline 对照），
  结果为 red（如 scavenger-actor.run alpha 33% / bbox 30.8%）；它们**不是 findings**，
  报告结构仍全绿。这是票 05 已记录的语义（metrics 是「被验收包自身」的读数），此处如实记录。

### MCP 同源

- `pnpm vitest run packages/mcp/tests/server.test.ts` → **exit 0，11/11 通过**
  （含 v7+baseline 正例、error findings → `_exitCode 1`、坏包 → `_exitCode 4`）。
- 直接驱动 `handle()`（`accept_asset_pack`，同一 pack/baseline）：
  `structuredContent.command = "accept"`、`isError = false`、`_exitCode = undefined`；
  其 `structuredContent.data` 与 CLI `--json` 的 `data` **JSON 字符串逐字段相等**：
  `{packId:"ruin-scavenger-extraction-assets", packVersion:7,
   baselineId:"scavenger-actor.idle.v7.2026-10-19", hasErrors:false,
   findings:{total:0,errors:0,warnings:0,info:0}, reportVersion:1,
   reportDir:"ruin-scavenger-extraction-assets/acceptance/v1",
   report:".../report.json", reportMarkdown:".../report.md"}`。
  两壳的 artifacts kind 同样为 `acceptance-report` / `acceptance-report-markdown`。

### 包 / fixture 未变

- 运行前后 sha256（及 mtime）对以下文件全部一致（`diff` 无输出）：
  v7 `manifest.json` + 4 张 `delivery/atlas.*.png`；baseline 全 18 个文件
  （`baseline.json`、raw 4、delivery 4、prompts 8、README）。
- 未跑 `create` / `pack` / `site`；未改运行时；未提交；零付费；
  `CONTEXT.md`、`map.md`、无关 `.scratch` 均未触碰。
- 偏差：无实质偏差；唯一操作偏差是首次 CLI 运行的退出码未直接捕获，已用等价的 `--json` 复跑补齐
  （`out/` 内仍只有 v1，临时产物已删除）。
