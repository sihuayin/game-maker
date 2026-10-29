# P0-01A · 冻结审计基准

| 属性 | 值 |
|---|---|
| 仓库 | `https://github.com/sihuayin/game-maker.git` |
| 分支 | `main` |
| **生产代码审计基线** | **`2c1a9d55c1ac94bc5271318514897b9485587bec`**（`2c1a9d5`，2026-10-29 14:12:37 +0800，Evidence Integrity V1 票 08 收口） |
| 当前 HEAD（含本期 effort 文件） | `e5dc05e5526fd8d5e122a50f70f04e3cbfe100ba`（`e5dc05e`，2026-10-29 15:35:34 +0800，P0-01 开图） |
| 审计时间 | 2026-10-29T07:41:23Z |
| 审计方式 | 只读 shell（`git` / `ls` / `wc` / `shasum` / `node -e` 读 `package.json`）；未运行 `pnpm test` / `build` / `typecheck` / playtest / site / create / pack |
| 结论 | **基线已冻结；`2c1a9d5` 与 `e5dc05e` 之间生产代码零差异。** |

## 1. 基线为什么是 `2c1a9d5` 而不是当前 HEAD

用户 Q3 裁定：冻结生产代码 HEAD `2c1a9d5`；PRD 作为未提交工作区输入，不改变审计基线。

开图后把 `.scratch/p0-01-audit/` 入库产生了 `e5dc05e`，但该提交**只新增审计 effort 文件**，没有改生产代码。证据：

```
$ git diff --stat 2c1a9d5..HEAD -- packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json
（空）
$ git diff --stat 2c1a9d5..HEAD
 12 files changed, 684 insertions(+)   # 全部在 .scratch/p0-01-audit/
```

因此后续所有能力/机制判定仍以 `2c1a9d5` 为代码基线；`e5dc05e` 只作为审计产物的提交锚点。

## 2. 工作区状态（审计开始时）

```
$ git status --porcelain
 M .scratch/p0-01-audit/issues/01-freeze-audit-baseline.md   # 本票认领（Status: claimed）
?? "docs/v7.6/管线.md"                                       # PRD，未跟踪工作区输入
```

- 无未提交的生产代码改动；无 merge/rebase 进行中。
- PRD 未入库，故以内容哈希绑定：`sha256:9ac9e1206b25973a612504a025b6f861ba5114e635bc1d531a1a537ee392f4a7`（14,724 bytes）。
- 审计地图：`sha256:92318529bd5db94095833f9a2818d7b2ead1d613b693ccf127db3eb2f22ade9a`。
- 票 03 研究文件：`sha256:fdb1babac5bfcd6dd3d3fc5def12f2106e17784c6d70b911ef7978bf387e456f`。

## 3. 关键目录与包结构

`packages/`（10 个）：

`assets` · `cli` · `contracts` · `demo` · `game-design` · `mcp` · `pipeline` · `qa` · `vision` · `visual-design`

`docs/`：`文档.md`、`counter-siege.md`、`stylespec-extraction.md`、`td-requirement.md`，以及 `v2`–`v7.6` 各阶段目录；本期输入为 `docs/v7.6/管线.md`，参照 `docs/v7.6/验收.md`、`docs/v7.6/验证.md`、`docs/v7.5/demo.md` 与 `docs/v4/P0-00-*` 的审计先例。

仓库规模：6,877 个受跟踪文件；149 个 `*.test.ts` / `*.test.mjs` 测试文件。

`package.json` 脚本（审计相关）：

- `test` = `vitest run --passWithNoTests`
- `typecheck` = `tsc -b && pnpm -r --if-present typecheck`
- `test:playtest` / `test:acceptance` / `test:evidence` / `test:mechanic`（均先 `pnpm build`，可能启动浏览器或读证据，需先经「核实安全审计命令」票确认）

## 4. 本票读取的来源

- `docs/v7.6/管线.md`（PRD；未提交，已于上文绑定 sha256）
- `.scratch/p0-01-audit/map.md`（本 effort 地图）
- `.scratch/p0-01-audit/issues/01–10*.md`（票面）
- `.scratch/p0-01-audit/research/03-real-pipeline.md`（已收口的真实管线研究）
- `package.json`、`.gitignore`
- `CONTEXT.md`（词汇权威，按需查阅）
- `docs/v7.6/验收.md` / `docs/v7.6/验证.md` / `docs/v7.5/demo.md` / `docs/v4/P0-00-*.md`（结构与先例；本票只读标题与相关段落）
- `git` 元数据（remote / branch / rev-parse / status / diff / log）

## 5. 不可读、未读取与排除项

- **未读取本地凭据**：`game-maker.local.json` 存在，含本地上游凭据，按仓库纪律不读、不入库、不作为审计证据。
- **未将构建产物当作基线**：`out/` 与 `packages/*/dist/` 被 `.gitignore` 忽略（`.gitignore:10`、`.gitignore:5`）；它们的存在不代表功能完整，也不属于可复核的代码基线。
- **历史证据按需读取**：`.scratch/` 下历史运行证据体积大，本票只读取与基线相关的索引；具体证据的适用边界由票 06 与后续能力矩阵逐条绑定。
- **未遇到不可读文件**；若后续票遇到权限/格式问题，按 `BLOCKED` 记录，不用推测补齐。
- 无网络读取、无付费调用、无浏览器启动。

## 6. 未修改生产实现的断言

- 工作区与 `2c1a9d5` 之间生产代码零差异（上文命令输出为空）。
- 本票及已收口的票 03 只写 `.scratch/p0-01-audit/`；PRD 保持未跟踪。
- 未执行任何会写历史目录、更新账本或触发外部调用的命令。
