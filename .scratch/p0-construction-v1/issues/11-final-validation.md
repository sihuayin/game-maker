# 11. 最终验证与完工总结

Type: task
Status: resolved
Owner: main session · 2026-10-22
Blocked by: 01, 02, 03, 04, 07, 08, 09, 10
Map: ../map.md

## Question

按 `docs/v4/P0-00-p0-scope.md` §5 的完成判据做全量验证，交付书面总结。
只做验证与记录；发现缺口时登记，不擅自扩范围修复。

1. 跑并记录：`pnpm test`、`pnpm typecheck`、`pnpm build`、`pnpm check:deps`、`pnpm check`、
   `pnpm test:playable`、v7 `accept`。
   `pnpm check` 的 2 条既有 `.scratch` 断链单独记录，不算本图引入。
2. 逐条核对 12 条非 `CAP-E2E-01` 的完成判据，给「CAP → 测试 / 命令 → 证据路径 → 结论」表。
3. 核对工作树：v7 包与 `fixtures/` 的 sha256 / mtime 未变；`game-maker.local.json` 未变；
   既有 `CONTEXT.md` 改动未被碰。
4. 书面总结：施工范围、偏差、未完成项；**必须写明「单跑 E2E（P0-FINAL）未完成」**，
   不得出现无条件的「P0 全部验收通过」。

## 验收

- 每条判据都有可复跑的命令与证据路径。
- 若某项未达成：记录阻塞点与最小补充条件，不把它写成通过。
- 证据落 `.scratch/p0-construction-v1/runs/<date>-final/`。
- 不提交、不推送；停在等待单独授权状态。

## 边界

- 只验证与记录；不修补缺口（缺口登记后由新票或用户裁定）。
- 不跑真实上游 / 付费链；不改 v7 包与 `fixtures/`；不碰 `game-maker.local.json` 与无关 `.scratch`。
- **P0-FINAL 不在本票**。

## 产出

`## Answer`：命令与退出码表、12 条判据对照表、工作树校验、书面总结链接。

## Answer

**已收口（验证）** —— 全量命令、12 条判据、工作树校验均已完成。结论**不是**「全部通过」：

> **11 / 12 条非 `CAP-E2E-01` 判据通过；`CAP-ASSET-01` 部分达成；
> `CAP-E2E-01`（P0-FINAL 单跑）未完成。**
> 不得出现无条件的「P0 全部验收通过」。

完整书面总结（含每条的详细证据与残余风险）：
[`runs/2026-10-22-final/summary.md`](../runs/2026-10-22-final/summary.md)。

### 命令与退出码

| 命令 | 退出码 | 结果 | 证据 |
| --- | --- | --- | --- |
| `pnpm test` | **0** | 119 files / **1810 tests passed** | `runs/2026-10-22-final/test.txt` |
| `pnpm vitest run <15 个 P0 定向文件>` | **0** | 15 files / **186 tests passed** | `targeted-p0.txt` |
| `pnpm typecheck` | **0** | 全包通过 | `typecheck.txt` |
| `pnpm build` | **0** | `tsc -b` + bundle 全通过 | `build.txt` |
| `pnpm check:deps` | **0** | 依赖图合法（9 个包） | `check-deps.txt` |
| `pnpm check` | **1** | `check:links` 报 **2 条既有 `.scratch` 断链**；非本图引入 | `check.txt` |
| `pnpm test:playable`（正例 / 三负例） | **0** / **1**×3 | 正例 3/3、软锁两次重置 × 30 帧、旧实现负例按预期红；gate=`assemble`、pickup=`win`、input=`move` 各 exit 1 | `test-playable.txt` · `playable/summary-positive.json` · `negative-*.txt/.exit` |
| v7 `verify` | **0** | **157** 个文件 checksum 全部对上 | `verify-v7.txt` |
| v7 `accept` | **0** | **13 个动画 · 0 条 findings** | `accept-v7.txt` · `accept-v7/.../report.json` |

票 11 / 12 / 地图文档更新后复跑 `pnpm check:links`（`check-links-post-edit.txt`），仍只报同 2 条、无新增。

两条既有断链（只记录，不修）：
`.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/palette-curation.md:21 → ../issues/04-palette-coat-review.md`；
`.scratch/asset-integration-v1/runs/2026-10-21c-screening/budget-report.md:8 → ../research/alternative-animation-models-2026-10-21.md`。

### 12 条非 E2E 判据

（命令均可复跑；详细用例名与证据见 `summary.md` §3。）

| CAP | 结论 | 关键证据 |
| --- | --- | --- |
| `CAP-SPEC-01` 两 goal 只有 gate 能赢；旧红新绿 | **通过** | `world.test.ts` / `shell-scene-wiring.test.ts`；票 07 `red-demo-tests.log`（11 failed / 25）+ 绿跑 |
| `CAP-RUNTIME-01` 危险物重置不掉穿、可恢复、有自动化 | **通过** | 同 #1 + `test:playable` 的 `hazard-reset` / `hazard-legacy` |
| `CAP-QA-01` 6/6、干净包 `checked=6`、`incomplete` 阻断 | **通过** | `qa/tests/assemble.test.ts`、`layers.test.ts`、`pipeline/create-game.test.ts` |
| `CAP-QA-08` create/build、site、MCP 各发布路径不能绕过 QA | **通过** | `publish-gate.test.ts`、`cli-site-gate.test.ts`、`assemble-site-qa-gate.test.ts`、`create-game-qa-failure.test.ts`、`cli-create.test.ts` |
| `CAP-QA-07` 最小 headless smoke；负例会红 | **通过** | `test:playable` 正例 + 本目录三负例（`assemble` / `win` / `move`，各 exit 1；`negative-*.txt/.exit`） |
| `CAP-SPEC-12` 四桶覆盖闸、缺资源被拒、豁免可测试 | **通过** | `plan-coverage-gate.test.ts`、`create-game.test.ts`；用户裁定严格全覆盖、无豁免 |
| `CAP-ASSET-06` `verifyPack` 入链、坏包在 config/QA/site 前失败 | **通过** | `create-game.test.ts` 篡改用例、`cli.test.ts` verify 篡改、v7 `verify` |
| `CAP-SPEC-17` 空色板在下游付费前拒、0 次下游调用 | **通过** | `plan-coverage-gate.test.ts`、`create-game.test.ts` |
| `CAP-QA-02` 至少一条像素判据能阻断、阈值有依据 + 正负例 | **通过** | `qa/tests/pixel.test.ts`、`create-game.test.ts`；用户裁定两坏例只 observation |
| `CAP-ASSET-01` `frames` 不静默折叠；sidecar 记录真实候选 | **部分** | 折叠已修 + 测试断言不落 sidecar；§5 的 sidecar 子项未达成；§3/§5 冲突 → 票 12 |
| `CAP-ENTRY-01/02` MCP 4/3/2；绝对 `stylePath` 同输入同结果 | **通过** | `mcp/tests/error-semantics.test.ts`、`create-game-no-digest.test.ts` |
| MCP QA 失败路径 `isError` / 4 / 无站点 / 报告在盘 | **通过** | `mcp/tests/create-game-qa-failure.test.ts` |

**另计**：`CAP-E2E-01` —— **未完成**。本图不做 P0-FINAL；须另立付费票
（书面预算 + 逐次授权），完成后才能说「单跑 E2E 已验证」。

### 工作树校验

| 项 | 结果 |
| --- | --- |
| v7 包 | manifest sha256 `e620cd7e…38326`；tree sha256 `64b74b0e…1baff`；mtime 均 Oct 20 17:17:57；**0 个文件**晚于 2026-10-21；`verify` 157/157；`accept` 0 findings |
| `fixtures/` | 工作树 `git status` / `git diff` 均干净；基线以来唯一已批准改动 = `fixtures/upstream/canned.json` +21 行（`e-drone`，票 01，commit `5a6e77a`）。19 个文件的 mtime 晚于 10-21：`canned.json` 是上述改动；`animation-baselines/*` 是基线自带的已跟踪文件，`70631af..HEAD` 无提交、工作树无 diff |
| `game-maker.local.json` | sha256 `97ac7e7c…fa981`；mtime Oct 19 12:44（早于本图）⇒ 未动 |
| `CONTEXT.md` | sha256 `3ede3deb…ee46`；mtime Oct 22 11:03（早于本会话）⇒ 既有改动未被碰 |
| 无关 `.scratch` | 只新增 `runs/2026-10-22-final/`；既有未跟踪 run 原样保留 |

### 未完成 / 缺口

1. **`CAP-ASSET-01` 的 sidecar 子项**：`frames` 明确失败时未记录模型真实候选；
   §3「测试」与 §5 判据冲突。已立 **[票 12](12-cap-asset-01-frames-sidecar.md)**（grilling，待裁定），
   本票不修。最小补充见 `summary.md` §4。
2. **`CAP-E2E-01` / P0-FINAL**：真实单跑未做；另立付费 effort。
3. `pnpm check` 的 2 条既有断链与 `pnpm test` 的 `gm-cli-accept-findings-*` 泄漏是既有问题，
   已记录 / 本次泄漏已清理，不在 P0 范围。

### 证据

`.scratch/p0-construction-v1/runs/2026-10-22-final/`：`summary.md`、命令 `.txt/.exit`、
`targeted-p0.txt`、`worktree.txt`、`verify-v7.txt`、`accept-v7/`、`playable/`（smoke 结果与截图）。

本票只验证与记录；未修缺口、未提交、未推送；停在等待单独授权状态。
