# 08. H · 测试体系与安全执行清单

Type: task
Status: resolved
Owner: research 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

检查测试框架、测试命令、现有资源相关测试、测试样本位置、CI 配置（如有）、需要外部模型或凭据的测试、
会产生文件 / 网络请求 / 费用的测试。

回答任务书 §4.8 的 7 个问题：

1. 哪些测试可以在本地无凭据执行？
2. 哪些测试需要外部模型或网络？
3. 哪些测试可能产生费用？
4. 哪些测试可能覆盖资源或生成产物？
5. 如何安全运行资源验收回归测试？
6. 如何将确定性检查与外部服务测试分开？
7. 当前是否能通过已有测试框架构建 Phase 1 的回归测试？

**必须实际执行**（记录完整命令、退出码、结果）：

- `pnpm test`
- `pnpm typecheck`

不得执行 `pnpm check` / `pnpm build` / 任何写 `out/` 的命令。

## 验收

- 安全执行清单：命令 · 测试范围 · 前置条件 · 是否写文件 · 是否访问网络 · 是否可能产生费用 ·
  实际执行结果或未执行原因。
- 实测的测试文件数 / 用例数 / 绿红分布 / 退出码；失败项的完整摘要。
- 动画 / 资源相关测试清单：文件、覆盖的检查、正例 / 反例 / 边界、是否使用真实资源样本。
- 明确哪些测试写仓库内文件（核实是否只写临时目录）、哪些需要凭据 / 网络（默认不运行）。
- 明确现有框架能否承载 Phase 1 回归测试；需要补哪些测试（给建议，不写测试）。

## 边界

- 只读调查；不改测试 / 测试配置 / 业务代码。
- 允许 `pnpm test` 与 `pnpm typecheck`；禁止 `pnpm check` / `pnpm build` / 任何写 `out/` 的命令。
- 测试若意外写仓库内文件，立即记录并停止，不要清理或提交。
- 零付费；不跑任何真实上游调用。
- 不写 `map.md`；只写本票与 `research/h-test-inventory.md`；不提交。

## 产出

`research/h-test-inventory.md`：安全执行清单 + 实测结果 + 资源相关测试矩阵 + Phase 1 补测建议。
完成后在本票追加 `## Answer`（10–20 行摘要），`Status: resolved`。

## Answer

- 基线 `f0dac01` · `pnpm test` **EXIT 0**：105 个文件 / 1647 个用例全绿（15.89s），0 红 / 0 跳过；运行前后 `git status --porcelain` 逐行相同，测试只写 `os.tmpdir()`。
- `pnpm typecheck` **EXIT 2**：根 `tsc -b` 通过；`@game-maker/assets` 的 `pack-sheet-grid.test.ts:150`（TS2322，假 generator 的 `call` 缺 `requestedSize`）与 `prompt.test.ts:257`（TS2304，`CharacterDNA` 未导入）红。no-bail 复跑确认其余 8 包 Done。
- 框架：vitest 3.2.7（根脚本 `vitest run --passWithNoTests`），无 `vitest.config.*`，根级自动发现全部 105 个文件；无 CI（无 `.github/`）。
- 零凭据 / 零外网 / 零费用：24 个测试文件、177 处 `fetchImpl` 注入；仅 2 个文件绑 `127.0.0.1` 临时端口（`cli.test.ts`、`build-pack-stdio.test.ts`，后者在测试内 esbuild + spawn 子进程）。
- 动画/资源矩阵已盘点：契约 `assetpack`（40 例）、建包 `pack`（43）、切帧 `sheet-grid`/`pack-sheet-grid`/`pack-ground-band`（10/5/9）、导入 `import`+fixture（38/1）、真实模型图 `model-paint`（17）与 `despill`（16）、真包观察/校验 `inspect`/`ledger`（9/10）、装配 `site`/`td-site`（24/23）。
- 关键缺口：`verifyPack` 只验 schema + 文件大小 + sha256，**不解码 PNG、不查图集帧矩形越界**（`packages/assets/src/ops.ts:1662`）。
- 验收基准 v7 包（19 资源 / 76 帧，`scavenger-actor` idle 4 帧 @6fps、run 8、jump 4，锚点 `{0.5,1}`）158 个文件已入库，但**零测试引用**；无基线冻结、候选比较、运行时播放、验收报告测试。
- 框架承载力：Phase 1 确定性回归可直接新增 vitest 测试（`decodePNG`/`encodePNG` 已导出、临时目录隔离成熟）；浏览器回归不支持（无 Playwright/Puppeteer/jsdom）；外部服务隔离目前只有「注入假 fetch」约定，无 project/tag 门控。
- 补测建议（只建议未写）：冻结基准 + 图集几何 + 帧像素不变量 + golden metrics + 基线/候选 diff + 像素/几何反例 fixture + 基准 checksum；运行时与外部模型测试显式 opt-in。
- 证据：`.scratch/animation-acceptance-v1/research/h-test-inventory.md`（安全执行清单、矩阵、缺口、补测建议；运行日志关键行在其 §2）。
- 未验证：v7 包当前 checksum（未跑 `verify`）、完全禁网沙箱下的测试表现、Phase 1 是否引入浏览器自动化（地图 Not yet specified）。
