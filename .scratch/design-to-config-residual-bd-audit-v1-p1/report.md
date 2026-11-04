# Design-to-Config Residual B/D P1 — 验收与实施报告

- **日期**：2026-11-04
- **代码基线**：`main` @ `3b1b61d`；P1 起点 `11f0b0a`
- **分支**：`p1/design-to-config-residual-bd-audit`（已推送；PR 未开）
- **授权**：[final-report.md](../design-to-config-residual-bd-audit-v1/final-report.md) §3；路线：[plan.md](../design-to-config-residual-bd-audit-v1/plan.md)
- **性质**：零付费验收报告。未调用模型、未生图、未重建站点。

## 0. 结论

五项修复全部实施并验收，组合结果通过：`pnpm build` / `pnpm typecheck` / `pnpm test`
（162 文件 / 2425 测试）全绿；逐项测试批次 1–5 全绿；全局语料重判**新增 error 0、包根因 0**。
未发现需要停止链条的失败。剩余风险见 §7。

## 1. 修改面

生产代码（10 个文件）：

| 项 | 文件 |
|---|---|
| D-02 | `packages/assets/src/ops.ts`（`roleNote` + 两份清单） |
| B-02 | `packages/contracts/src/config-audit.ts`、`packages/assets/src/ops.ts`（确定性文案）、`packages/pipeline/src/create-game.ts`（汇合点文案） |
| publish-gate | `packages/pipeline/src/publish-gate.ts`（`configProblem`） |
| D-01 | `packages/pipeline/src/create-game.ts`、`packages/demo/src/{assemble,site,world}.ts`、`packages/demo/src/td/{site,world}.ts`、`packages/assets/src/ops.ts`（注释） |
| D-03 | `packages/contracts/src/config-audit.ts`（`classifyConfigIssues`）、`packages/assets/src/ops.ts`（编译循环） |

测试（13 个文件）：`assets/tests/{compile-runtime,compile-td-game,plan-background-gate}.test.ts`、
`contracts/tests/{config-audit（新增）,reachability}.test.ts`、
`pipeline/tests/{create-game,publish-gate,delivery-integration}.test.ts`、
`demo/tests/{world,site,td-site}.test.ts`、`qa/tests/{gameplay,layers}.test.ts`、
`cli/tests/{cli-create,cli-site-gate}.test.ts`、`mcp/tests/{assemble-site-qa-gate,create-game-qa-failure}.test.ts`。

总 diff：23 个文件、+983/−96（不含 `.scratch` 验收记录）。

## 2. 契约变更

| 项 | 状态 |
|---|---|
| D-01 `UnderstandingInput.viewport?` / `AssembleOptions.viewport?` / `SiteOptions.viewport?` / `TdSiteOptions.viewport?` / `buildWorld`、`buildTdWorld` opts.viewport | **已批准并实施**（纯可选、默认值不变） |
| B-02 `ConfigIssue.code: "unreachable"` | **未加** |
| publish-gate `subject.configChecksum` | **未加** |
| D-03 对外归因码 | **未加**；`classifyConfigIssues` 为内部纯函数 |
| CLI / MCP 参数与返回形状 | 未变 |
| Runtime / 落盘产物 / `site.json` | 未变 |

## 3. 逐项测试证据

### 3.1 构建与类型

| 命令 | 结果 |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm typecheck` | exit 0 |

### 3.2 分批测试（`plan.md` §7.2）

| 批次 | 文件 | 结果 |
|---|---|---|
| 1 | `assets/tests/compile-runtime`、`compile-td-game` | exit 0 · 68 tests |
| 2 | `contracts/tests/reachability`、`config-audit`；`assets/tests/compile-runtime`；`pipeline/tests/create-game`；`qa/tests/gameplay` | exit 0 · 146 tests |
| 3 | `pipeline/tests/publish-gate`；`cli/tests/cli-site-gate`；`mcp/tests/assemble-site-qa-gate` | exit 0 · 34 tests |
| 4 | `pipeline/tests/create-game`；`demo/tests/{world,site,td-site}`；`assets/tests/plan-background-gate`；`qa/tests/layers` | exit 0 · 159 tests |
| 5 | `contracts/tests/config-audit`；`assets/tests/compile-runtime`；`pipeline/tests/create-game` | exit 0 · 114 tests |
| 最终 | `pnpm test` | exit 0 · **162 文件 / 2425 tests passed** |

### 3.3 逐项要点

- **D-02**：横版 / 塔防每条资产行都印 manifest `role`；同包 parity；换行折叠、空值占位；负向检查（去掉 `roleNote`）会红。
- **B-02**：reachability error 进 `deterministic`、不进 `resampleable`；编译 / 汇合点硬拒（`invalid` 4）；
  编译只发 1 趟；语料 151/151 config **0 条** reachability error。
- **publish-gate**：非 TD + `configPath` 存在 ⇒ 现场重跑 reachability；四个发布入口均传参；
  不可达 config（含绿报告）退 4、站点不产；TD / 缺省 / 解析失败跳过。
- **D-01**：自定义视口 400×240（`createGame`）贯通 VDS / 规划提示词 / 编译提示词；
  `buildWorld` / `buildTdWorld` 的世界描述、背景 fallback、HUD fallback；
  `assembleSite` 500×270 屏幕空间审计；`assembleTdSite` 500×280 世界尺寸审计；默认仍 480×270。
- **D-03**：`classifyConfigIssues` 11 条归因单测；编译循环 4 条（包根因 1 发硬拒、config 可修带摘要、
  schema 摘要、`bad` 不喂回）；语料新分类器 **0 条包根因**。

## 4. 全局语料重判（只读 `/tmp/p1-acceptance-scan.mjs`）

扫描范围：`out/**`、`fixtures/**`、`.scratch/**`，跳过 `node_modules` / `.git`；共 **5243** 份 JSON。

| 指标 | 预测 | 实测 | 说明 |
|---|---|---|---|
| config `game-config/v1` | 151 | **151** | — |
| manifest `assetpack/*` | 171 | **171** | — |
| design `game-design/v1` | 49 | **49** | — |
| config↔manifest 配对 | 134 对（17 跳过） | **151/151 配对** | 本口径为「最近前缀 + 同层取最高 pack 版本」；研究口径更严（134/17）。两者 **0 新增 error**，差异不影响结论 |
| **B-02 reachability 新增 error** | 0 | **0** | 无新增，无需逐条解释 |
| **D-01 `world.size.h`** | 117/117 = 270 | **151/151 = 270** | 语料比预测多出的 config 也全是 270 |
| **D-02 role 非空 / 换行** | 982/982、0 换行 | **1599/1599 非空、0 换行** | 全量 manifest 资产（1599）；186 个不同取值、最长 32 字符、共 24,951 字符 |
| **D-03 resampleable** | 86（71 + 15） | **146（71 state-frames + 75 无码）** | 多出的无码项来自本口径纳入的合成负例 / 原始实验 config（引用包里不存在的 id、身份族）；全部为 **config 可修** |
| **D-03 新分类器包根因** | 0 | **0** | 无需逐条解释；包根因行为由 fabricated「无 ui」临时包见证 |
| **publish-gate 三元组** | 21 组、正例 0 | **23 组、0** | 5 份报告无同目录 config 跳过 |
| **QA 报告** | 29 份；26 subject；0 `configChecksum` | **31 份；28 subject；0 `configChecksum`** | 报告契约未改；`checked` 长度 7（第七条已存在），与 plan 的「六条」表述是历史口径 |

所有新增指标均为 0；没有需要按 §8.2 解释的新增拒绝。

## 5. 五项组合结果（不是只汇总单项）

| 组合 | 结论 | 证据 |
|---|---|---|
| **B-02 × D-03** | reachability 只在 `deterministic`，D-03 分类器只看 `resampleable` ⇒ 不可达**不会**进入反馈；包根因硬拒与 reachability 硬拒互不冒充 | `contracts/tests/config-audit.test.ts`（reachability 不进 resampleable）、`assets/tests/compile-runtime.test.ts`（B-02 / D-03 两组）、全仓绿 |
| **B-02 × publish-gate** | 同一份不可达 config：`build` 汇合点（`create-game` reuseConfig 用例）与 standalone `site` / `assemble_site` 各自独立拒绝 | `pipeline/tests/create-game.test.ts`、`cli/tests/cli-site-gate.test.ts`、`mcp/tests/assemble-site-qa-gate.test.ts` |
| **D-01 × D-02 × 站点/QA** | 自定义视口贯通理解 / 构建 / 站点；两份清单 role 同组（parity）；QA 与站点审计用同一视口 | `pipeline/tests/create-game.test.ts`（400×240）、`assets` role parity、`demo/tests/{site,td-site}` |
| **D-02 × B-01** | 只证明 `role` **可见**；未新增语义分类、未改 schema（B-01 仍推迟） | 契约无 diff；`plan.md` §1.2 |
| **publish-gate × D-01** | 站点屏幕空间 / 世界尺寸用调用方 viewport；reachability 与视口无关（判据不吃 viewport），不因自定义视口误伤 | `demo/tests/site.test.ts`、`td-site.test.ts`、`pipeline/tests/publish-gate.test.ts` |

## 6. fixture 同步

- **未修改任何 fixture、历史 run / pack / site、`.scratch` 既有产物。**
- 新增测试里的临时包副本只写在 `/tmp`（如 D-03 的「无 ui」包、D-01 的加宽背景包）。
- `git status` 只含本票的验收记录与 `report.md`（见 §8）。

## 7. 已知限制

1. **D-03 的付费效果未验证**：零付费只证明 plumbing（反馈进入下一发、包根因 1 发硬拒）。
   模型是否因此改对，需要 07 的 go/no-go 与 ≤6 次文本调用单独验证；未通过时只回退反馈部分。
2. **D-03 只改编译循环**：规划循环 / 塔防循环的盲重采样仍按 Q8 交接，不在本图。
3. **D-01 运行时外壳**：CLI/MCP 仍按外壳常量 480×270 构建；自定义 viewport 是程序化 API 增量，
   由理解 / 构建 / 站点装配消费。未写 `site.json`、未改 Runtime（按批准边界）。
4. **publish-gate 报告身份**：仍只钉 pack；本项只保证「当前 config 自身可达」，
   `subject.configChecksum` 保持不做（按批准）。
5. **B-02 失败阶段前移**：不可达 config 现在在编译 / 汇合点失败，QA 不再看到它；
   QA 的 reachability 判据本身保留（`qa/tests/gameplay.test.ts`）。
6. **语料配对口径**：本报告用「最近前缀 + 同层最高 pack 版本」；research 的 134/17 口径更严。
   两套口径下关键指标（新增 error / 包根因 / 三元组拒绝）均为 0。

## 8. 失败与回退记录

| 项 | 事件 | 处置 |
|---|---|---|
| B-02 | 全仓回归发现 3 个集成测试以「不可达 config 在 QA 失败」为前提（CLI / MCP / delivery-integration），不在原允许测试清单内 | **F3 裁定点**：用户 2026-11-03 明确授权更新；改为断言新的失败阶段（CLI/MCP）或注入合法失败报告（delivery），不变量保留 |
| B-02 | 既有票 48 锚点用例把 40×40 实心块悬空 40px，现被 reachability 判真实挡路 | 按锚点语义改回贴地（仍能抓住 `at.y + h` 旧 bug）；记录于 B-02 Answer |
| D-01 | `site.test.ts` 自定义视口首版用 480×280，触发层覆盖失败（背景高 270） | 改为 500×270 + 临时包副本加宽 sky 的标称宽；不移除任何既有判据 |
| D-03 | schema 失败实际落在 `bad` 档（工具入参不过线形状），首版只在 `truth.ok` 分支追加摘要 | 按 `once.failure === "schema"` 在 `bad` 档追加；其余 `bad` 仍不喂回 |
| D-03 | 语料配对曾把 `run/v1` 配到半成品 `pack/v1`，制造 8 条假包根因 | 按「run 版本 ≠ pack 版本」取同层最高 pack 版本；重跑 0 条 |

没有未处置的失败；五项均未触发全局停止条件。

## 9. 授权核对

- 未调用模型 / 未生图 / 未重建站点 / 未使用付费链。
- 未推送 `main`；未合并 PR；未发布生产版本。
- 未修改历史 run / pack / site / fixture；未 `reset` / `clean`。
- CLI/MCP 对外参数与返回形状未变；退出码语义未变。
- 本地分支已推送（用户 2026-11-04 指示提前推送）；PR 仍留到 07。

## 10. 提交索引

| 项 | 实施 commit | 验收记录 commit |
|---|---|---|
| D-02 | `09e2b53` | `c3fca50` |
| B-02 | `2377716` | `2be43e7` |
| publish-gate | `4e6d866` | `c36e17c` |
| D-01 | `f1e8925` | `61b5394` |
| D-03 | `42a9fca` | `8e4d624` |
| 06 | — | 本报告 |
