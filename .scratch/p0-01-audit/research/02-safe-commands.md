# P0-01A / §7 · 审计命令副作用核实与 allowlist

| 属性 | 值 |
|---|---|
| 基线 | 生产代码 `2c1a9d5` |
| 方法 | 静态读 `package.json`、`packages/cli/src/cli.ts`、各命令实现与测试；本票只运行 `git` / `rg` / `sed` / `grep` 等只读命令，**未执行任何候选命令** |
| 结论 | 审计允许：只读 shell、`pnpm test`、`pnpm typecheck`、`verify`、`inspect`、`accept --out <tmp>`、`verify-delivery --out <tmp>`、`test:evidence --out <tmp>`、`site --out <tmp>`；浏览器探针仅按条件允许；生成/写历史命令一律禁止 |

## 1. 判定规则

- `SAFE`：不写仓库内任何文件；不触发网络、浏览器或付费调用。
- `SAFE_WITH_TEMP_OUTPUT`：会写文件，但可把输出重定向到 `out/` 或专用临时目录，且不触碰历史/受跟踪产物。
- `FORBIDDEN`：会写历史目录、受跟踪 fixture、run/pack/site 版本；或触发付费模型、真实浏览器试玩、账本更新；或无法重定向输出。
- 额外约束（用户补充裁定 ②）：即使命令名看似只读，也必须按实现核实；不满足 Q7 的命令不得运行。

## 2. 命令矩阵

| 命令 | 判定 | 实际副作用 | 证据 |
|---|---|---|---|
| `git status/log/diff/show/ls-files/rev-parse/check-ignore` | `SAFE` | 只读元数据 | 本票实测；无写操作 |
| `rg` / `find` / `ls` / `sed` / `grep` / `cat` / `wc` / `shasum` / `node -e`（只读 JSON） | `SAFE` | 无写入 | 本票实测 |
| `pnpm test`（`vitest run`） | `SAFE` | 测试用 `mkdtemp`/`os.tmpdir()` 写临时目录；假 `fetch`，无网络/付费 | `package.json:13`；`packages/qa/tests/visual.test.ts:29-34`、`packages/demo/tests/site.test.ts:14-24`、`packages/cli/tests/cli-create.test.ts:20-24` |
| `pnpm typecheck` | `SAFE_WITH_TEMP_OUTPUT`（忽略产物） | `tsc -b` 写 `dist/` 与 `*.tsbuildinfo`；均被 `.gitignore` 忽略 | `package.json:18`；`.gitignore:5,10` |
| `pnpm build` | `SAFE_WITH_TEMP_OUTPUT`（忽略产物） | `tsc -b` + bundle 写 `packages/*/dist/`；不碰受跟踪文件 | `package.json:8`；`.gitignore:5` |
| `pnpm check:deps` / `check:links` | `SAFE` | 只读 `package.json` / 文档并输出；无写入 | `scripts/check-deps.mjs`、`scripts/check-links.mjs`（只 `readFileSync`） |
| `verify`（`verifyPack`） | `SAFE` | 读 manifest/文件并核 checksum；无写入 | `packages/assets/src/ops.ts:1836` |
| `inspect`（`inspectPack`） | `SAFE` | 读包并诊断；无写入 | `packages/assets/src/ops.ts:2102` |
| `accept ... --out <tmp>`（`acceptAnimationPack` + `writeAcceptanceReport`） | `SAFE_WITH_TEMP_OUTPUT` | 读包/基线，写 `acceptance/v<N>/report.json|md` 到 `outRoot` | `packages/assets/src/acceptance.ts:758-850`；`packages/cli/src/cli.ts:716-729` |
| `verify-delivery --manifest ... --out <tmp>` | `SAFE_WITH_TEMP_OUTPUT` | 只读证据、原子分配报告目录并写 `report.json|md`；无模型/浏览器 | `packages/cli/src/evidence.ts:15-31`；`packages/pipeline/src/evidence-integrity.ts:1156-1169` |
| `test:evidence -- --out <tmp>` | `SAFE_WITH_TEMP_OUTPUT` | 先 `pnpm build`（忽略 dist），再跑 `verify-delivery`；输出可重定向；无浏览器/付费 | `package.json:17`；`scripts/evidence-acceptance.mjs:23,41` |
| `site <pack> --config <cfg> --out <tmp>` | `SAFE_WITH_TEMP_OUTPUT` | 读包 + QA 报告，装配 `site/v<N>` 到 `outRoot`；无模型/浏览器 | `packages/cli/src/cli.ts:680-704`；`packages/demo/src/site.ts:167` |
| `test:mechanic`（可设 `MECHANIC_PROBE_OUT`） | `SAFE_WITH_TEMP_OUTPUT`（条件） | 启动真实 Chrome 做机制探针；输出可重定向；不写历史 | `package.json:15`；`packages/demo/probe/mechanic-probe.mjs:48,231` |
| `test:acceptance`（可设 `FREE_ACCEPTANCE_OUT`） | `SAFE_WITH_TEMP_OUTPUT`（条件） | 跑 `pnpm test` + Chrome 机制探针；输出可重定向；不写历史 | `package.json:16`；`packages/demo/probe/free-acceptance.mjs:40` |
| 纯 Vitest 子集（`test:playtest` 里的 6 个测试路径） | `SAFE` | 只跑测试，不启动 self-test/浏览器 | `package.json:14` 去掉 `pnpm build && node ...self-test.mjs` 后 |
| `test:playtest`（整条） | `FORBIDDEN` | self-test 固定写 `.scratch/playtest-v1/runs/<date>-self-test`（非 out/、非临时），并启动 Chrome 跑试玩自测 | `package.json:14`；`packages/demo/probe/playtest/self-test.mjs:18,175` |
| `playtest <runDir>` | `FORBIDDEN` | 启动浏览器 harness，写 `run/v<N>/playtest/v<k>` 与 delivery 写回；写历史 | `packages/cli/src/playtest.ts:345-420` |
| `review <runDir>` | `FORBIDDEN` | 调视觉/文本模型（`fetch`），并写 `run/v<N>/ledger.json` | `packages/pipeline/src/review.ts:76-110` |
| `review-verdict <runDir>` | `FORBIDDEN` | 写 `run/v<N>/qa-report.json` 的 `delivery.visualReview` | `packages/cli/src/cli.ts:775-819` |
| `playtest-baseline promote ...` | `FORBIDDEN` | 默认写受跟踪目录 `fixtures/playtest-baselines/` | `packages/cli/src/cli.ts:730-764` |
| `create` / `build` | `FORBIDDEN` | 调文本/视觉/生图上游，写 `run/v<N>`、`pack/v<N>`、`site/v<N>` | `packages/cli/src/cli.ts:576-612`；`packages/pipeline/src/create-game.ts` |
| `plan` | `FORBIDDEN` | 调文本模型（`onceThroughTool`），写规划产物 | `packages/assets/src/ops.ts:370-430` |
| `pack` | `FORBIDDEN` | 调生图/文本上游（付费），写 `pack/v<N>` | `packages/assets/src/ops.ts:1681`；`ops.ts:145,683` |
| `compile-runtime` | `FORBIDDEN` | 调文本模型，写 `run/v<N>/game-config.json` | `packages/assets/src/ops.ts:1039`；`packages/game-design/src/compile-design.ts:223` |
| `compile-td-game` | `FORBIDDEN` | 调文本模型，写 `td-config` | `packages/assets/src/ops.ts:1405` |
| `pnpm install` / 任何依赖变更 | `FORBIDDEN` | 网络 + lockfile 变更 | PRD §7 |

## 3. 审计 allowlist（推荐调用）

```bash
# 纯只读
git status --porcelain && git rev-parse HEAD
rg / find / sed / grep / cat / head / tail / wc / shasum
node -e "JSON.parse(require('fs').readFileSync('…','utf8'))"

# 测试（只写 OS 临时目录）
pnpm test

# 类型检查（写 .gitignore 的 dist/*.tsbuildinfo）
pnpm typecheck

# 只读包诊断
node packages/cli/dist/cli.mjs verify <packDir>
node packages/cli/dist/cli.mjs inspect <packDir>

# 需要输出时，一律落到专用临时目录
TMP="$(mktemp -d)"
node packages/cli/dist/cli.mjs accept <packDir> --out "$TMP"
node packages/cli/dist/cli.mjs verify-delivery --manifest <manifest> --out "$TMP"
node packages/cli/dist/cli.mjs site <packDir> --config <config> --out "$TMP"
node scripts/evidence-acceptance.mjs --out "$TMP"
```

条件允许（仅当后续票确实需要新的浏览器观测，且**不是**在生成试玩证据）：

```bash
MECHANIC_PROBE_OUT="$TMP" node packages/demo/probe/mechanic-probe.mjs
FREE_ACCEPTANCE_OUT="$TMP" node packages/demo/probe/free-acceptance.mjs
```

纯 Vitest 子集（替代整条 `test:playtest`）：

```bash
pnpm build && pnpm exec vitest run \
  packages/contracts/tests/playtest-attribution.test.ts \
  packages/contracts/tests/playtest-baseline.test.ts \
  packages/contracts/tests/playtest.test.ts \
  packages/pipeline/tests/playtest.test.ts \
  packages/pipeline/tests/playtest-baseline.test.ts \
  packages/demo/probe/playtest/tests
```

## 4. 禁止清单（本审计不运行）

- `create` / `build` / `plan` / `pack` / `compile-runtime` / `compile-td-game`
- `playtest` / `test:playtest`（整条）/ `review` / `review-verdict` / `playtest-baseline`
- `pnpm install`、任何依赖或 lockfile 变更、任何网络/付费调用
- 任何 `git add/commit/push/reset/clean`（提交需 Q9 的单独授权）
- 任何把输出写入 `run/v<N>`、`pack/v<N>`、`site/v<N>`、`fixtures/`、`.scratch/…/runs/` 的命令

## 5. 需要用户确认的两个例外

1. **`pnpm build` / `typecheck` 写 `.gitignore` 的 `dist/` 与 `*.tsbuildinfo`**：不是严格的 `out/` 或临时目录，但都是被忽略的构建产物、不碰受跟踪文件。若按 Q7 字面不接受，则 `test:evidence` 的 build 步骤也需单独批准；否则建议按 `SAFE_WITH_TEMP_OUTPUT` 处理。
2. **Chrome 机制探针**（`test:mechanic` / `test:acceptance`）：不是 Playtest，输出可重定向、不写历史；但会启动真实浏览器。建议只在后续票明确需要新的行为观测时使用，并逐次记录命令与输出目录。

## 6. 本票的断言

- 未执行任何候选命令；只做静态核实与本票的只读 shell。
- 未修改生产代码、测试、fixtures 或历史产物。
