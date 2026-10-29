# 梳理真实生成管线与入口（P0-01B）

Type: research
Status: resolved
Blocked by: （无）

## Question

从真实入口追踪当前代码（基线 `2c1a9d5`）的实际调用关系，覆盖：

`输入 → 设计与意图 → 资源规划与生成 → AssetPack → GameConfig → Runtime → Playtest → 交付验证`

并逐一记录分支 / 条件路径 / 入口：CLI 全部命令、MCP 工具、`compile-td-game` 旁路等。每个阶段给出：

- 入口与关键实现文件；
- 输入 / 输出契约；
- 实际调用的下游模块；
- 失败处理与产物位置；
- 对应自动化测试；
- 已有真实运行证据；
- 未覆盖的路径。

必须明确区分真实调用链与文档预期流程；标记仅存在于 fixture 或测试替身中的路径；不得把目录存在误判为功能完整。

产物：`.scratch/p0-01-audit/research/03-real-pipeline.md`（含证据索引与 file:line）。


## Answer

研究文件（分阶段调用链、入口差异表、真实/文档/fixture 区分、测试与证据索引、未覆盖路径、审计限制）：[../research/03-real-pipeline.md](../research/03-real-pipeline.md)

- 真实生产链有两条：横版 `create/build → runUnderstanding（六步）→ runBuild（pack→verify→config→QA→机制覆盖）→ 壳层发布闸 → site → delivery`；塔防是 `需求+包 → compile-td-game → td-config → site` 旁路，无设计层、无 QA、无 delivery、不能 playtest。
- CLI 15 命令 / MCP 8 工具：MCP 缺 `build`、`compile-td-game`、`playtest`、`review`、`review-verdict`、`playtest-baseline`、`verify-delivery`；MCP 手工组合 `plan_assets→build_asset_pack→compile_runtime→assemble_site` 因无 QA 产出工具，会被横版发布闸拒绝；`assemble_site` 也只能装横版。
- 独立 `site` 不写 delivery，而 `playtest` 要求 delivery+site pass ⇒ 手工 `plan/pack/compile/site` 路线不可试玩；`createGame()+onRecipe` 检查点仅测试使用，生产壳自行串联两段。
- 真实 E3 是 `040b907` 生成、`5b8283f` 冻结的 wasteland 横版（pack/site v1 · shell 2）：playtest v1/v2 由 CLI 写出但 harness/rules 为 v1（HEAD 已 v2）；冻结 delivery 由 effort 脚本 `init-delivery.mjs` 初始化，不是当前 `buildAndSite` 的 E3；HEAD `2c1a9d5` 的 `verify-delivery` 只重算冻结证据（223 文件 / 13 records / 六项全 match）。
- 主要未覆盖：MCP 无法组成完整横版链、MCP/TD 无 QA-delivery-playtest、HEAD v2 CLI playtest 写回、`review` 与基线无 E3、TD 生成式编译无 E3、WebGL/九宫格真实运行未验证；另有 `runBuild` 清单/身份错误退 1 而非 4、TD 空凭据闸缺失、QA “六条”文案 vs 7 条数组等线索（不在本轮修复）。
