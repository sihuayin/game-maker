# P0-02 起始基线

| 属性 | 值 |
|---|---|
| 仓库 | `https://github.com/sihuayin/game-maker.git` |
| 分支 | `main` |
| **P0-02 起始 HEAD** | **`4f3bc69cb820f3690b0932c6959cfe279dc00e6a`**（`4f3bc69`，2026-10-29 18:43:25 +0800，P0-01 收口） |
| P0-01 生产代码基线 | `2c1a9d55c1ac94bc5271318514897b9485587bec`（`2c1a9d5`） |
| 审计时间 | 2026-10-29T10:54:19Z |
| 工作区 | 仅未跟踪 `.scratch/p0-02-second-demo/` 与 `docs/v7.6/管线.md`；无 tracked 修改；无 merge/rebase |
| 结论 | **P0-02 起始代码基线 = `4f3bc69`；与 P0-01 基线 `2c1a9d5` 的生产代码零差异。** |

## 1. 基线关系

```
$ git diff --stat 2c1a9d5..HEAD -- packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json
（空）
$ git diff --stat 2c1a9d5..HEAD
 21 files changed, 3078 insertions(+)   # 全部是 P0-01 审计文档/effort，无生产代码
```

- `2c1a9d5` → `4f3bc69` 之间只新增了 P0-01 的主文档、地图、票与 research 文件。
- P0-02 的 effort 目录当前未提交；提交后会新增 HEAD，但**生产代码基线仍为 `4f3bc69`**，后续票必须以生产代码 diff 为空来证明未改实现。

## 2. 工作区状态（审计开始时）

```
$ git status --porcelain
?? .scratch/p0-02-second-demo/
?? "docs/v7.6/管线.md"
```

- 无未提交的生产代码改动；无 merge/rebase。
- `docs/v7.6/管线.md`（P0-01 PRD）仍为未跟踪工作区输入，sha256 `9ac9e120…f4a7`（14,724 bytes）。
- 未读 `game-maker.local.json` 内容（仅确认存在）；不输出密钥。

## 3. 结构规模

`packages/`（10 个）：`assets` · `cli` · `contracts` · `demo` · `game-design` · `mcp` · `pipeline` · `qa` · `vision` · `visual-design`

- 受跟踪文件：6,886
- 测试文件：149（`*.test.ts` / `*.test.mjs`）

## 4. 输入与证据绑定（sha256）

| 输入 | sha256 |
|---|---|
| P0-01 主文档 `docs/v7.6/p0-01-readonly-capability-audit.md` | `62536d3a50a041d79e2098beac6f390ce6b291934660d08546df61aec36d53a6` |
| P0-01 逐字裁定 `.scratch/p0-01-audit/rulings-2026-10-29.md` | `ad1956081f28524bb28c6f7f5220ea281e442d36568dfaa93b59fc0920aafce4` |
| P0-01 决策报告 `.scratch/p0-01-audit/research/09-decision-report.md` | `db6d3d08e684b00be56b5f3f2df7f5156daf01b8c6824ab7ca59af54a7606eb6` |
| P0-01 PRD `docs/v7.6/管线.md` | `9ac9e1206b25973a612504a025b6f861ba5114e635bc1d531a1a537ee392f4a7` |
| 冻结 run ledger `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/ledger.json` | `42ed224e4a6356b1db94dac749d0b5502d7e24976d9e5154932823ffa2921a4d` |
| 证据完整性清单 `.scratch/evidence-integrity-v1/manifest/expected-hashes.json` | `ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd` |

**证据路径**：`.scratch/fpvs-v1-final/`（冻结交付与历史运行）、`.scratch/generic-playtest-v1/evidence/`（playtest attempts）、`.scratch/evidence-integrity-v1/runs/2026-10-29T05-04-57Z-final-acceptance/`（证据完整性重验）。

## 5. 本票读取与排除

- 读取：git 元数据、`packages/` 目录、`package.json`、`.gitignore`、P0-01 主文档/裁定/决策报告、冻结 ledger、证据清单。
- 排除：本地凭据 `game-maker.local.json` 内容；`out/` 与 `packages/*/dist/`（被 `.gitignore` 忽略，不作为基线）；未启动浏览器、未调用付费上游、未运行生成命令。
- 未遇到不可读文件；后续若遇到，按 `BLOCKED` 记录。

## 6. 零生产修改断言

- `2c1a9d5..4f3bc69` 的生产代码 diff 为空。
- P0-02 effort 只写 `.scratch/p0-02-second-demo/`；PRD 保持未跟踪。
- 本票未修改生产代码、契约、测试、fixtures 或历史产物。
