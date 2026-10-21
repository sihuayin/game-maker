# 05. [research] site / assemble_site 与 QA 的接缝

Type: research
Status: resolved
Owner: research 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

为票 09（发布闸门统一）提供事实底座：**发布路径在发布那一刻，能拿到什么、缺什么**。
只读调查，不改代码。

1. CLI `site` 与 MCP `assemble_site` 的入参和上下文：config 路径 / pack 目录 / run 目录分别可得吗？
   调用签名与 `path:line` 证据。
2. QA 真正需要哪些上下文（design / spec / recipe / pack / inspect observation），
   与 site 装配拿到的上下文重合多少？**就地在发布路径重跑 QA** 是否可行、成本多大？
3. 发布路径能否从现有入参定位 `run/v<N>/qa-report.json`？如果只能拿到 pack 目录，能推出 run 目录吗？
4. 「当前包」的身份用什么钉住最可靠：`manifest.id + version`？`files[].checksum`？
   run ledger 的 `packVersion`？现有 `qa-report/v1` 有哪些字段可承载身份、哪些必须新增？
5. 对以下三种方案给出对比矩阵（可行性 / 需要的新字段或 flag / 兼容性 / 风险）：
   - A：报告携带包身份，发布路径查找并校验匹配；
   - B：发布路径就地重跑 QA；
   - C：显式参数传入 QA 报告路径（`--qa-report` / MCP 参数）。
6. 旧手工工作流（先 build、再手工 `site`；没有 run 目录的 site）在 A/B/C 下分别会怎样。
7. 归档证据：`2026-10-20e-site` 没有 `qa-report.json`，确认这是路径问题还是流程问题。

## 验收

- 事实表：入口 / 入参 / 可得的 QA 上下文 / 证据 `path:line`。
- A/B/C 对比矩阵，含最小契约 / CLI / MCP 变更清单。
- 明确推荐一个方案并说明理由与兼容方案。
- 证据文件 `.scratch/p0-construction-v1/research/site-qa-seam.md`；票内 `## Answer` 摘要。

## 边界

- 只读源码 / 文档 / 归档；不改代码、契约、包或站点；不跑真实 `create/pack`；零付费。
- 不提交；不写 `out/`。

## Answer

事实全文与逐项证据：[`research/site-qa-seam.md`](../research/site-qa-seam.md)。

1. **入口与入参**：CLI `site` 只收 `packDir + --config + --shell/--out/--game-id`，调 `assembleFromConfig`，**没有 runDir**（`packages/cli/src/cli.ts:29,90-96,633-649`）；MCP `assemble_site` 只收 `packDir/configPath/shellPath/outDir/gameId`，直接调 `assembleSite`，**没有 runDir**（`packages/mcp/src/server.ts:196-213,386-393`）。`create --yes` / `build` / MCP `create_game` 则都有 runDir，因为 `buildAndSite` / `create_game` 先调 `runBuild`（`packages/cli/src/cli.ts:235-259`、`packages/mcp/src/server.ts:336-361`）。
2. **QA 要什么 vs site 有什么**：`QaContext` 需要 `runDir + packDir + configPath + intentPath + designPath + recipePath + gameId + 可选 inspectObservation`（`packages/contracts/src/qa.ts:436-458`）；site 只有 pack/config/gameId。QA 三族只读 JSON、零上游（`packages/qa/src/visual.ts:84-91`、`gameplay.ts:71-74`、`intent.ts:81-87`）；重跑 QA 本身 24–125ms、`inspectPack` 对 89MB 包 0.58s（E3），**成本不是问题，缺的是 run 里的三份文书**。只有 pack+config 时默认合成器会因缺 recipe/intent/design 直接抛（最多也只到 2/6、必 `incomplete`），所以 B 必须新增 runDir，独立 site 无法从现有入参重跑。
3. **能否定位 `run/v<N>/qa-report.json`**：规范 out 树可从 `packDir` 取 `<out>/<gameId>` 再扫 `run/v*/`，但 `runVersion ≠ packVersion`（`packages/pipeline/src/create-game.ts:437-441`）；真实 18a 是 `run/v1 + pack/v1 + pack/v2`，同一份 `run/v1/qa-report.json` 无法说是哪个包（E3：对 pack v1 重跑得 1 条 error，对 v2 得 0 条）。外部包（如 `2026-10-20e-site`）根本没有 run 可反推；manifest 的 `generator.run` 全仓无人写（`packages/contracts/src/assetpack.ts:270`、`packages/assets/src/pack.ts:1179`）。
4. **包身份**：最可靠是 `manifest.id + manifest.version`（`packages/contracts/src/assetpack.ts:265-269`；site 自己也用它，`packages/demo/src/site.ts:183-184`）；`files[].checksum` 是内容指纹（`assetpack.ts:298-299`），但 manifest 自身不在 `files[]`；包 ledger 有 `packId/packVersion`（`packages/contracts/src/ledger.ts:156-159`），`coverage.json` 同（`coverage.ts:25-30`）。**`run/v<N>/ledger.json` 没有 `packVersion`**（`run-ledger.ts:19-34`、`create-game.ts:603-613`），不能当身份源。`qa-report/v1` 今天只有 `format/checked/failures/observations`（`qa.ts:266-320`），**没有任何身份字段**；`observations.source` 是 `inspect|review` 闭集，塞不进去。需新增可选 `subject { packId, packVersion, manifestChecksum? }`（建议复用 `packId/packVersion` 这两个既有名字）。
5. **A/B/C**：A 可行性高、正常链路零新 flag、能精确拒旧包；需契约字段 `subject` + 一个共享 gate。B 技术可行且免费，但需要 run 里的 intent/design/recipe，独立 site / 无 run 手工流无解，TD 还会在 `parseGameConfig` 抛（`packages/qa/src/gameplay.ts:73`），不推荐作默认。C 自身不能证明身份（只是「信调用方」），但对外部包是唯一可用定位口。**推荐 A + C**：A 写身份并按规范 out 树自动查找，C 用 `--qa-report` / `qaReportPath` 定位外部包的报告，二者都强制校验 subject。
6. **旧工作流**：A 下「build 成功再手工 site」自动放行；「build 失败再手工 site」找到 error 报告 ⇒ 拒（有意）；无 run 的 site 找不到报告 ⇒ 拒，除非 C 指一份属于该包的报告。B 下无 run 的 site 永远不可用。C 下没有报告就拒；必须与 A 合用才有证明力。TD 在 P0 应显式跳过 gate（P2）。
7. **`2026-10-20e-site` 根因**：**流程问题，不是路径问题**。该 out 树只有 `pack/v6`、`pack/v7`、`site/v1..v3`，**没有 `run/`**；源包目录也只有 `pack/v6`；报告写明是用 `site` 从外部 v6 包 + 手写 config 装配（`site-report.md:3-4,28-31`）。`site` 从不跑/读 QA（`cli.ts:633-649`、`demo/src/site.ts` 无 QA 引用），`pack` 也不跑（`cli.ts:582-600`）；QA 只在 `runBuild` 里跑（`create-game.ts:507-544`）⇒ 这份归档不可能有 `qa-report.json`。

**推荐方案：A + C**。理由：直接兑现 P0-02 的「QA 报告必须与 pack id + version 对应」；正常 `create/build/site` 不需要新 flag；外部/手工包有显式定位口；不新增第三本账；B 的成本虽低但上下文不成立且对旧手工流无兼容。

**最小变更清单**（均待票 09 按 Q5 逐项报批，本票未落地）：
1. `packages/contracts/src/qa.ts:266-320`：`QAReportSchema` 新增可选 `subject {packId, packVersion, manifestChecksum?}`；保持 `qa-report/v1` 与既有字段语义。
2. `packages/pipeline/src/create-game.ts:533-544`：由 pipeline 从 `manifest.value` 注入并覆盖 subject 后再 `safeParse` + 落盘（唯一来源）。
3. `packages/pipeline/src/create-game.ts:215-226`：发布闸在 error 之外增加 `incomplete`（`checked < QA_JUDGEMENTS.length`）阻断；依赖票 08。
4. 新 `packages/pipeline/src/publish-gate.ts`（并导出）：`findQaReport` + `assertPublishableQa`，校验 subject / error / incomplete，失败抛 `CommandError("invalid")`（4），且在任何目录创建之前。
5. `packages/cli/src/cli.ts:90-96,29,633-649`：`--qa-report`；`site` 在 `assembleFromConfig` 前过 gate；TD 显式跳过（P2）。
6. `packages/cli/src/cli.ts:235-259`：`buildAndSite` 在 `assembleFromConfig` 前过同一 gate。
7. `packages/mcp/src/server.ts:203-213,386-393`：`assemble_site` 加可选 `qaReportPath`，调 gate 后再 `assembleSite`；`create_game`（`:348-361`）同 gate，并补 QA 失败路径测试。
8. 测试：CLI `site` 与 MCP `assemble_site` 各补「缺报告 / 旧 pack / error / incomplete / 全绿」；MCP `create_game` 补 `isError`、`_exitCode=4`、站点不产、报告在盘。测试用临时目录手写报告，零付费。
9. 文档：`docs/v2/01-contracts.md` §9、CLI USAGE / README；写清 TD 的 P2 例外与「无 run 手工 site 被拒」的兼容口径。

**残余风险（需 09 明写）**：只钉 pack 不钉 config（`reachability` 是 config 相关）；同 id/version 的包内容被改需 `manifestChecksum` 或 P0-04 的 `verifyPack`；`incomplete` 阻断在票 08 前会让全部发布变红；旧报告无 subject 一律拒；库直调 `assembleSite` 绕过 gate；自动查找只对规范 out 树有效。
