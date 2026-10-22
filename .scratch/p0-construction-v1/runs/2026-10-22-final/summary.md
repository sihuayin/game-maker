# P0 施工 · 最终验证与完工总结（2026-10-22）

> **结论先行：P0 未全部验收通过。**
> 12 条非 `CAP-E2E-01` 的完成判据中，**11 条通过、1 条部分达成**（`CAP-ASSET-01`：
> `frames` 已不再静默折叠，但 §5 要求的「sidecar 记录真实候选」未落 —— §3 测试项与 §5 判据
> 自相矛盾，已立票 12 待裁定）。**单跑 E2E（P0-FINAL）未完成**（本图明确不含，须另立付费票）。
> 任何「P0 全部验收通过」的表述都不成立。

## 0. 输入与基线

| 项 | 值 |
| --- | --- |
| 分支 | `p0-construction-v1`（基线 `70631af`；本图施工 commits `5a6e77a` / `e6ac0ba` / `9d68560`） |
| 范围文档 | `docs/v4/P0-00-p0-scope.md` §5；能力差距表 / 测试矩阵 / 调用链 / E2E 证据 |
| v7 包 | `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/` |
| v7 config | `.scratch/asset-integration-v1/runs/2026-10-20e-site/game-config.json` |
| 环境 | Chrome **155.0.8059.85** · Node **v22.23.2** · macOS |

零付费：本票只跑只读 / 本地测试与结构验收；**无生图、无文本上游、无视觉模型、无 `review`**。

## 1. 命令与退出码

| 命令 | 退出码 | 结果 | 证据 |
| --- | --- | --- | --- |
| `pnpm test` | **0** | **119 files / 1810 tests passed**（24.13 s） | `test.txt` · `test.exit` |
| `pnpm vitest run <15 个 P0 定向文件>` | **0** | **15 files / 186 tests passed**（4.81 s） | `targeted-p0.txt` · `targeted-p0.exit` |
| `pnpm typecheck` | **0** | 全包通过 | `typecheck.txt` · `typecheck.exit` |
| `pnpm build` | **0** | `tsc -b` + 全部 bundle 通过 | `build.txt` · `build.exit` |
| `pnpm check:deps` | **0** | 依赖图合法（9 个包） | `check-deps.txt` · `check-deps.exit` |
| `pnpm check` | **1** | `check:links` 报 **2 条既有断链**；不是本图引入 | `check.txt` · `check.exit` |
| `pnpm test:playable` | **0** | 正例 + 软锁专项 + 旧实现负例全绿（见 §2） | `test-playable.txt` · `test-playable.exit` · `playable/summary-positive.json` |
| `node packages/cli/dist/cli.mjs verify <v7>` | **0** | **157 个文件 checksum 全部对得上**；包内账 0 次调用 | `verify-v7.txt` |
| `node packages/cli/dist/cli.mjs accept <v7> --out <本目录>/accept-v7` | **0** | **13 个动画 · 0 条 findings**；报告落盘 | `accept-v7.txt` · `accept-v7/.../acceptance/v1/report.json` |

`pnpm check` 的两条既有断链（只记录，不修）：

- `.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/palette-curation.md:21` → `../issues/04-palette-coat-review.md`
- `.scratch/asset-integration-v1/runs/2026-10-21c-screening/budget-report.md:8` → `../research/alternative-animation-models-2026-10-21.md`

`pnpm check` 在 `check:links` 处失败，因此同一条命令里的 `build` 没有跑到；`pnpm build` 已单独跑并 exit 0。
票 11 / 12 / 地图文档更新后复跑 `pnpm check:links`（`check-links-post-edit.txt`），**仍只报同 2 条既有断链、无新增**。

## 2. `pnpm test:playable` 明细

| 场景 | 耗时 | 结果 |
| --- | --- | --- |
| `playable` | 6.4 s | 启动 → 移动 → 跳跃 → **3/3 pickup** → gate → `won=true`（x=548.0） |
| `hazard-reset` | 10.3 s | 「木箱顶起跳 → 空中撞 hazard → 重置」两次；每次 30 帧采样，`bottom ≤ floorY+1`、`onFloor` 真、`collected/won` 不变；静止脚线 **250.00 / 250.00** |
| `hazard-legacy` | 5.3 s | 页面会话内换回旧 `hitHazard`（`setPosition`）⇒ 按预期红：`bottom` 最大 **387.50 > 251.00**、`onFloor` 未变真 |

截图 / 轨迹：smoke OUT `playable/` 下的场景子目录 `playable/`、`hazard-reset/`、`hazard-legacy/`，
每个 `result.json` 含轨迹、`*.png` 为截图。负例 `gate|pickup|input` 在本目录各自 exit 1 并报阶段：`negative-*.txt` / `negative-*.exit`
（票 10 的同名证据在 `.scratch/p0-construction-v1/runs/2026-10-22-ticket-10/`）。

## 3. 12 条非 `CAP-E2E-01` 判据对照

> 命令都可复跑；`<15 文件>` 指 `targeted-p0.txt` 那次列出的 15 个测试文件。
> 结论里「通过」= 满足 §5 原文；「部分」= 有明确未达成子项；「未完成」= 本图不做。

| # | CAP / 判据 | 可复跑命令 / 关键用例 | 证据 | 结论 |
| --- | --- | --- | --- | --- |
| 1 | **CAP-SPEC-01** 两 goal 只有 gate 能赢；旧代码红、新代码绿 | `pnpm vitest run packages/demo/tests/world.test.ts packages/demo/tests/shell-scene-wiring.test.ts`；「两个 goal：只有 gate…」「gate 指向哪个 goal…」「goal 只在 `wins` 标记…」 | `targeted-p0.txt`；票 07 `red-demo-tests.log`（11 failed / 25 passed）· `green-demo-tests.log` | **通过** |
| 2 | **CAP-RUNTIME-01** 危险物重置不掉穿；复现序列可恢复；自动化覆盖 | 同 #1 + `pnpm test:playable`；「hitHazard 用 body.reset…」+ `hazard-reset` / `hazard-legacy` | `targeted-p0.txt` · `test-playable.txt` · `playable/hazard-reset/result.json` · `playable/hazard-legacy/result.json` | **通过** |
| 3 | **CAP-QA-01** 6/6 真跑；干净包 `checked=6`；`incomplete` 阻断 | `pnpm vitest run packages/qa/tests/assemble.test.ts packages/qa/tests/layers.test.ts packages/pipeline/tests/create-game.test.ts`；「checked 六条…」「干净包 6/6」「incomplete ⇒ 拒」 | `targeted-p0.txt`；票 08 / 09 证据 | **通过** |
| 4 | **CAP-QA-08** `create/build`、`site`、MCP `assemble_site` 不能绕过 QA；各有测试 | `pnpm vitest run packages/pipeline/tests/publish-gate.test.ts packages/cli/tests/cli-site-gate.test.ts packages/mcp/tests/assemble-site-qa-gate.test.ts packages/mcp/tests/create-game-qa-failure.test.ts packages/cli/tests/cli-create.test.ts packages/pipeline/tests/create-game.test.ts` | `targeted-p0.txt`；票 09 `runs/2026-10-22-ticket-09/summary.md` | **通过**（残余见 §5） |
| 5 | **CAP-QA-07** 最小 headless smoke；负例会红 | `pnpm test:playable`；`pnpm test:playable --negative gate|pickup|input` | `test-playable.txt` · `playable/summary-positive.json` · `negative-*.txt/.exit`（票 10 同名证据） | **通过** |
| 6 | **CAP-SPEC-12** 四桶覆盖闸；缺资源被拒；豁免可测试 | `pnpm vitest run packages/assets/tests/plan-coverage-gate.test.ts packages/pipeline/tests/create-game.test.ts`；四桶缺件 / 改名 / NPC / 拾取物缺件均拒 | `targeted-p0.txt`；票 01 证据 | **通过**（用户裁定严格全覆盖、无豁免；「豁免可测试」由该裁定取代） |
| 7 | **CAP-ASSET-06** `verifyPack` 入 `runBuild`；坏包在 config/QA/site 前失败 | `pnpm vitest run packages/pipeline/tests/create-game.test.ts packages/cli/tests/cli.test.ts`；篡改包用例 + CLI `verify` 篡改用例；v7 `verify` | `targeted-p0.txt` · `verify-v7.txt`；票 01 证据 | **通过**（CLI 端到端篡改无注入口，退 4 由共享映射 + CLI verify 用例佐证） |
| 8 | **CAP-SPEC-17** 空色板在下游付费前拒；0 次下游调用 | `pnpm vitest run packages/assets/tests/plan-coverage-gate.test.ts packages/pipeline/tests/create-game.test.ts`；VWS 空色板 / `plan` 入口 | `targeted-p0.txt`；票 01 证据 | **通过** |
| 9 | **CAP-QA-02** 至少一条像素判据能阻断；阈值有测量依据 + 正负例 | `pnpm vitest run packages/qa/tests/pixel.test.ts packages/pipeline/tests/create-game.test.ts`；25% 长宽比 / 25% 色板外 error、边界用例、v7 已知坏例 observation | `targeted-p0.txt`；票 03 / 04 证据 | **通过**（用户裁定 `health-icon` / `tile-wall` 只 observation） |
| 10 | **CAP-ASSET-01** `frames` 不再静默折叠；sidecar 记录真实候选 | `pnpm vitest run packages/assets/tests/plan-frames-candidate.test.ts`；`frames` ⇒ `invalid`/4、不重采样、**不落 recipe / sidecar** | `targeted-p0.txt`；票 02 证据；`P0-00-p0-scope.md` §3「测试」第 1 条 vs §5 判据 | **部分达成**（见 §4 / 票 12） |
| 11 | **CAP-ENTRY-01/02** MCP 错误码与 CLI 一致；绝对 `stylePath` 同输入同结果 | `pnpm vitest run packages/mcp/tests/error-semantics.test.ts packages/mcp/tests/create-game-no-digest.test.ts`；4 / 3 / 2；绝对路径全链成功 | `targeted-p0.txt`；票 02 证据 | **通过** |
| 12 | **MCP QA 失败路径** `isError` / 退 4 / 站点不产 / 报告在盘 | `pnpm vitest run packages/mcp/tests/create-game-qa-failure.test.ts` | `targeted-p0.txt` | **通过** |
| — | **CAP-E2E-01**（另计，不在 12 条内）HEAD 单跑「风格图 + 意图 → 可玩 Demo」 | 本图不做；须另立付费票（书面预算 + 逐次授权） | — | **未完成** |

## 4. CAP-ASSET-01 的缺口（本票唯一「部分」项）

- 已达成：`frames` 候选不再折成 `image`；`planAssets` 在路线决策前 `invalid`/4；一发就收、
  不重采样、不写 recipe / sidecar；测试 `plan-frames-candidate.test.ts` 覆盖并明确断言
  「清单与 sidecar 一个都不落」。
- 未达成：§5 / 能力差距表要求「**sidecar 记录真实候选**」。当前实现**没有**任何失败侧记录
  （错误消息里点名了 id 与 `frames`，包内账记了这次花费，但不是 sidecar）。
- 文档自相矛盾：§3「建议范围」要求「并让 sidecar 记录模型真实候选」；同一节「测试」第 1 条
  却写「明确失败（推荐）**且不落 sidecar**」；票 02 按后者实现。
- **最小补充条件**（二选一，需人裁定）：
  A. 以 §3「测试」为准：修正 §3 建议范围与 §5 / 能力差距表的措辞，明确失败路不落 sidecar；
  B. 以 §5 为准：在明确失败前落一份失败侧记录（如 `plan-attempts.json` / 失败版 sidecar），
     记录模型原始候选；不重采样、不产 recipe；补测试。
- 已立 **票 12**（grilling）承载该裁定；本票不修。

## 5. 工作树校验

| 项 | 结果 |
| --- | --- |
| v7 包 | `manifest.json` sha256 `e620cd7e…38326`（与票 10 记录一致）；**0 个文件** mtime 晚于 2026-10-21；manifest / 目录 mtime 均为 **Oct 20 17:17:57**；tree sha256 `64b74b0e…1baff`；`verify` 157/157；`accept` 0 findings |
| `fixtures/` | `git status --porcelain -- fixtures` 空；`git diff --exit-code -- fixtures` 0 ⇒ **工作树无改动** |
| `fixtures/` 基线以来 | 唯一已批准改动：`fixtures/upstream/canned.json` +21 行（补 `e-drone`，票 01，用户逐字批准，commit `5a6e77a`）；`animation-baselines` 在 `70631af..HEAD` 无提交、工作树干净 |
| `fixtures/` mtime | 19 个文件 mtime 晚于 2026-10-21（`canned.json` + `animation-baselines/*`）：前者是上述已批准改动；后者是基线 `70631af` 自带的已跟踪文件，`70631af..HEAD` 无提交、工作树无 diff，**mtime 不是本图改动** |
| `game-maker.local.json` | sha256 `97ac7e7c…fa981`；mtime **Oct 19 12:44:58**（早于本图）⇒ 未动 |
| `CONTEXT.md` | sha256 `3ede3deb…ee46`；mtime **Oct 22 11:03:10**（早于本会话）⇒ 既有改动未被碰；`git diff --stat` 仍为 14+/2- |
| 无关 `.scratch` | 本票只新增 `runs/2026-10-22-final/`；既有未跟踪 run 原样保留 |

## 6. 偏差、残余风险与未完成项

### 已裁定的偏差（不是缺口）

- **像素阈值**：`health-icon`（41 px / 16.02%）与 `tile-wall`（29 px / 12.89%）**只作 observation**；
  长宽比 `|ΔAR| ≥ 25%` 与色板外 `share ≥ 25% 且 pixels ≥ 16` 仍 error（票 03 用户裁定）。
- **覆盖闸**：用户裁定**严格全覆盖、无豁免**（票 01），取代 §5 的「豁免可测试」。
- **TD 发布闸**：`td-config/v1` 显式跳过 QA 闸（P2，票 09 裁定）。

### 残余风险（已记录、不阻断本图）

- `CAP-ASSET-06`：CLI 没有「篡改包」注入口，端到端 CLI 未直接跑；退 4 由共享映射 +
  `cli.test.ts` 的 verify 篡改用例 + `cli-create.test.ts` 的 build invalid 用例佐证。
- `CAP-QA-08`：库调用方（直接调 `assembleSite` / `assembleFromConfig`）不受闸；
  standalone `site` 不跑 `verifyPack`；out 树之外的包必须显式给 `--qa-report`。
- `CAP-QA-01`：正常链上 `compile-runtime` 会先拒绝坏层，`layer-coverage` 的负例只能手工改包构造
  （票 08 的「诚实边界」）。
- `CAP-QA-07`：只覆盖横版 `game-config/v1`；塔防 P2；依赖系统 Chrome。
- `pnpm check`：2 条既有 `.scratch` 断链，不属本图。
- `pnpm test` 的 CLI `accept` 负例仍会泄漏 `gm-cli-accept-findings-*`（~89 MB/次）；
  本票跑完后清理了 2 个（map Notes 既有问题，测试卫生不在 P0 范围）。

### 未完成项

1. **CAP-ASSET-01 的 sidecar 子项** —— 见 §4；已立票 12。
2. **CAP-E2E-01 / P0-FINAL** —— 真实「风格图 + 意图 → 可玩 Demo」单跑未做；
   须另立付费 effort（书面预算 + 逐次授权）。**这是「P0 未全部验收通过」的首要限定。**

## 7. 最终结论

- 程序级：`pnpm test` / `typecheck` / `build` / `check:deps` / `test:playable` / v7 `verify` /
  v7 `accept` 全绿；`pnpm check` 仅剩 2 条既有断链。
- 判据：**11 / 12 通过；CAP-ASSET-01 部分；CAP-E2E-01 未完成。**
- 因此：**不得出现无条件的「P0 全部验收通过」**。准确表述是：
  「P0 程序级判据 11/12 通过，CAP-ASSET-01 尚有 sidecar 子项待裁定（票 12）；
  **单跑 E2E（P0-FINAL）未完成**。」
- 本票只验证与记录，未修缺口、未提交、未推送；工作树停在等待单独授权状态。

## 8. 2026-10-22 补记（票 12 裁定 A 后）

- `CAP-ASSET-01` 的完成判据统一为：「`frames` 不再静默折叠；失败消息点名资源 id 与真实候选
  （`frames`），不落 recipe / sidecar；花费随异常回报。」
- 按修订口径，**非 `CAP-E2E-01` 判据 = 12 / 12 通过**（上文「11 通过 / 1 部分」是票 11 收口时的
  原始记录，保留不倒写）。
- **`CAP-E2E-01` / P0-FINAL 仍未完成**；不得无条件宣称「P0 全部验收通过」。
- 裁定与证据：`../../issues/12-cap-asset-01-frames-sidecar.md` · `../2026-10-22-ticket-12/`。
