# T-NB-01 真实交付来源追溯方案

Labels: wayfinder:map
Tracker: local-markdown
Status: planning complete · 2026-11-19

## Destination

形成可执行的 T-NB-01 真实交付来源追溯与可行性验证方案，明确真实交付和使用授权判据、搜索来源、证据链、停止条件以及无合格来源时的治理路径；本地图只规划，不执行追溯或验证。

## Notes

- 每个决策会话使用 grilling 和 domain-modeling；本地 Markdown 子票以 `Status`、`Owner` 和 `Blocked by` 表示状态、领取及依赖。
- 已有 [候选发现与准入清单](../level-playability-v1.1-i03-phase2/reports/T-NB-01-candidate-admission.md) 为阶段性证据；不重复扫描已核查的 20 个配置。
- 用户已确定：优先本仓库正式交付和历史产物；外部来源须另行确认来源、使用权限和导入授权；不宣称全仓穷尽。
- 无合格既有来源时记录范围和阻塞，指向已有 FIX 独立治理；本地图不预授权或决定新建 fixture。
- 验收目标不变：真实可信输入、两档各自完整 witness、重复执行可复现；不得以静态或合成证据替代。
- 不改变已签署 Phase-2 annex 中的几何 P2；公共能力保持 BLOCKED。

## Decisions so far

- [真实交付与来源证据的准入判据](issues/01-delivery-provenance.md)：真实目的与交付记录、可校验的 config/pack 关联为准入依据；缺证保留并标明，自动配对不是证明。
- [来源范围与使用授权的核验方式](issues/02-authority-sources.md)：优先追溯仓库交付和历史 run；按读取、验证、归档与 fixture 用途分别核权，外部来源先核准权限。
- [可行性验证的证据链与停止条件](issues/03-validation-evidence.md)：逐门核验来源、身份、几何、可信输入、双 lag 和复现；保存原始证据并区分失败与未执行。
- [无合格来源时的阻塞与治理移交](issues/04-no-source-handoff.md)：限定阻塞结论的搜索范围，列出继续追溯与独立 FIX 治理两条路径，验收标准不降。

## Not yet specified

无尚需规划的通用决策。具体来源与授权缺口在后续执行时逐项记录；本地图不预判事实。

## Out of scope

- 实际寻找或导入交付、构造 fixture、运行探针、冻结契约或 fixture、签署及实施授权。
- T-PU、预算负例、Phase-2 P2–P7 实施、公共 verdict 和能力开放。
