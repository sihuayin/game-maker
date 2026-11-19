# P2 独立增量实施授权记录（草稿 · 未签署 · 阻塞）

> 本文仅供审阅，**不构成实施授权**。当前需求的时序目标与已冻结的几何 probe 契约存在范围差异，须先澄清并按治理流程解决；不得以本草稿补充或修改冻结契约。

## 1. 依据与基线核对

| 项 | 核对结果 |
| --- | --- |
| Phase-2 annex | `docs/v7.8/移动-I03-phase2.md`：2026-11-17 签署；签署后原始 hash `100d0221db759cf2ce64835665691c410c76e6223ee8f9049655db6021537b21`；P1 Ledger 更新后当前文件 hash `e08da453885208db467133e7100580ce63648684b5f9c6791d4d86ed9a1c179c`。§3 要求逐单元签署、docs-only PR 合入 main 后再切实施分支。 |
| P1 | annex §12 记为 CLOSED；独立复核 `reports/P1-review.md` hash `2ae8d427f741189b6da7d6e5e2f301ee19c2aa8d635bf691775daeb856278931`，签署详见 `reports/P1-signature.md`。报告正文保留当时未签署状态，独立签署记录记载 2026-11-18 签署。 |
| P1 audit 基线 | `wayfinder/i03-phase2-probe-evidence` 本地与现有远端跟踪 ref 均为 `0b2198481a0e2301a4621c6c3985756ae74abeb2`；未联网核验远端。fixtures/scripts 提交 `8a0bb6758efa9d71148ac67c0dd0e5253306e061`。 |
| 契约 | 上述 audit ref 的 `geometry-probe/contract/I03-03A-probe-format.md`，实际文件 SHA-256 `f22bbde58ffbb0d78a6c77d417de4af10a3ddf93757752fbb8c0eca59840983d`；版本 `i03-geometry-probe/v1`。 |
| fixture manifest | 上述 audit ref 的 `geometry-probe/fixtures/manifest.json`，实际 SHA-256 `dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b`。14 条正例行：hazard 2、player 9、graph 3；11 个负例：10 `geometry-mismatch`（含 `body-bounds-mismatch`）及 1 `missing-evidence`。14 条是行，不应自行宣称为 14 个独立游戏配置。 |
| 其他冻结身份 | 源 pack tree `570535deff5c2f4e1626b2680a4b555f631e51d6d87721507a0a1f6e2feb7383`；归一化 manifest `19f4da6fb9bf25b96b48b96e2e44bb1773ad0c1222dc865f72e77a56fc85cb98`；contract tree `91bd30c0ffad278c453f0e02a22c73cd8c72ee444dc5ac8bdd9f54f4e95c5551`，后者来自 P1 独立复核，实施前须重验。 |
| 规划依据 | `issues/03-p2-probe-implementation.md`；签署 annex §5；`reports/00-execution-protocol.md`。准备草稿时 main 为 `ebdc7786e2438ac738d60b5bf40fe7c613cef2bd`，不是未来实施基线。 |

P1 manifest 的 `storage` 和 `normalizedManifestPath` 是冻结的 Phase-1 路径字符串；实施时必须显式定位 Phase-2 audit 副本并核对 hash，不得修改这些冻结字节，也不得直接将其当作当前物化位置。以上两项文件 hash 已从本地 audit ref 重新计算；其余 P1 证据与树 hash 引用已签署复核，启动前仍须独立核验完整清单。

## 2. 当前阻塞：时序目标与冻结契约

需求要求时序模型、时序探测及有效 / 不适用 / 证据不足 / 执行失败的可区分结果。已核对的 I03-03A 是 **几何**证据契约：Atlas / PNG 与 Phaser 几何对比、`expected / actual / delta / pass`、几何维度及其闭集失败码；14 正例也是几何行，11 负例是几何变异。该契约没有定义本需求所称的时序模型、时序探测输入与输出，不能证明时序 NB / PU。

**状态：STOP，待契约问题处理。** 用户已明确选择路径 2：先单独制定并冻结时序契约及对应 fixture，再准备对应独立授权记录。既有几何 P2 brief 不构成时序实施授权；未经相应决策与治理批准，不得自行增加字段、模型、证据类型、枚举或对外接口，也不得把几何结果或静态候选写成时序证明。本文中的几何范围仅作现有基线核对，不能直接用于签署时序 P2 授权。

## 3. 拟授权范围与白名单（均未生效）

以下仅记录现有 P2 brief 的上限；解决 §2 后须重新确认其与最终授权对象一致。只允许消费冻结的 P1 输入，使用真实浏览器与现有 demo，且只读复用 `packages/demo/probe/probe-harness.mjs`；不复制 harness、不改产品代码、不新增依赖或付费调用。CDP 采集与页面会话内负例变异分离；不可观察项标明缺失，不从预期值推导实际值。DevTools console fallback 不代替正式证据。

| 路径 | 拟允许操作 |
| --- | --- |
| `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/scripts/` | 新增 P2 必要的 probe / runner；P1 已冻结文件只读，不覆盖。 |
| `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/evidence/p2/` | 新增独立版本化证据目录、raw、commands、hashes；保留所有失败尝试，不覆盖，失败不占正式成功版本号。具体命名须在启动前明确且避免冲突。 |
| `.scratch/level-playability-v1.1-i03-phase2/reports/P2-*` | 新增实施报告与证据索引；历史报告不覆盖。 |

`contract/`、`fixtures/`、`evidence/p1/`、既有 P1 脚本及产品 `packages/**` / `fixtures/**` 只读。不得修改公共 API、公共 verdict、`ConfigIssue.code`、生产配置、Runtime / Pipeline / CLI / MCP、依赖及锁文件；遵守 `PLAYABILITY_DISABLED`。P3–P7 的实施和公共能力开放不在本次实施范围。P3 为后续 fresh 独立复核及用户签署，不由 P2 自行完成。

## 4. 冻结契约下的证据要求

几何契约要求同一运行输出 `i03-geometry-probe/v1` JSON，分 build / runtime、逐适用帧及 body 保存 expected、实际值、delta、pass、failure 和原始输入 hash；sprite bounds 与 body AABB 分开，坐标归一化后零容差。每个负例保存冻结 ID / code、预期和实际类别、变异前后及单变量证明。未执行项必须逐项记录原因，异常不能默认为有效证明。

输出须保留原始数据、输入身份、版本、命令与退出码、环境和 runner、失败原因、复核入口，以及逐 fixture 与批次统计。批次应区分有效证据、证据不足、不适用、执行失败和环境异常；如冻结输出契约无法表达某一需求状态，应 STOP 提交契约问题，不擅自扩充枚举或推断对应关系。`all-checked` 只是生成器局部结果，不是公共 `coverage.geometry=checked`，退出码 0 也不是通过证明。

同 fixture、runner 和环境重复运行，按冻结规则对规范化结果逐字段比较并比较语义 hash：对象键排序、数组保序，排除 `generatedAt`、`durationMs`、`environment`、`runner`、`hashes`；环境及 runner 仍须记录并检查一致性。不得排除其他关键字段以掩盖差异；不一致须定位字段并 STOP。保留原始文件、hash 链及未执行明细；证据完整性不能靠数量或测试通过率宣称。

实施报告须列出变更清单、14＋11 逐项结果、状态统计、失败及 IE 原因、重复执行差异、证据索引、限制、契约差异和既有行为回归核验；不得将 P3 状态写为 PASS。P3 的固定复核入口为 `reports/P3-probe-review.md`，由未参与 P1/P2 的 fresh reviewer 独立重跑并逐项记录 `PASS / FAIL / NOT_RUN`；只有 P3 PASS 且用户签署后，P6 才可按其独立授权消费。

## 5. 启动门与 STOP

启动前：解决 §2；核验 P1 Ledger、签署记录、完整 P1 hash 清单、冻结 fixture 及允许修改范围；确定不覆盖的产物目录和失败版本规则；用户签署本独立授权，docs-only PR 合入 `main` 后，从更新后的 `main` 规划 audit 分支并以 P1 audit ref 为只读证据基线。若合入基线与 P1 audit 历史不兼容，停止并提交差异，不覆盖 P1 证据。

任一情况立即停止相关实施并记录问题、证据与最小修订建议：

1. 契约、代码或输入 hash 不一致，契约不足，坐标约定不明确，或 fixture 预期存在争议。
2. 需扩展冻结输入、模型、证据、枚举或接口；需修改生产包、公共 API、Runtime / Pipeline 或 P1 冻结产物。
3. 需新增依赖、付费调用、绕过关闭开关，或将静态候选 / 几何结果解释为时序证明。
4. harness 不能取得必要证据、无法证明负例单变量、证据不完整或重复运行不稳定。
5. 需要提前实施 P3–P7，或在 P3 未签署时由 P6 消费 probe。

## 6. 签署与移交

签署人：________________　日期：____________　签署对象 hash：________________

**当前状态：UNSIGNED / BLOCKED；P2 未授权、未实施。** 按用户决定，须先形成并冻结时序契约及 fixture，并核对其与签署 annex 的关系，再起草对应授权；本几何基线草稿不得签署为时序授权。签署与 docs-only PR 合入均为实施启动条件。P2 产物只能提交给 P3 独立复核，P2 完成不等于 Phase-2 验收或公共能力开放。
