# T-NB-01 真实候选发现与准入清单

状态：**无通过预筛选的候选 / BLOCKED** · 2026-11-19

## 阶段性收口与下一阶段：真实交付来源追溯

用户决定将本轮 20 个历史去重配置的筛选作为阶段性证据收口，不重复同类扫描；这不改变双 lag 完整 witness 验收要求或 Phase-2 几何 P2 范围。

后续仅做只读发现：搜索 `out/`、`.scratch/`、`fixtures/`、`packages/demo/fixtures/` 下名为 `game-config.json` 的文件，筛选 `game-config/v1`、包含移动 hazard，排除旧 inventory 已记录的路径或原始 SHA-256。发现 20 个路径：4 个属于 P0 案例 A/B 及其站点副本，16 个属于 `level-playability-v1/fixtures/07-matrix` 人工矩阵。A、B 的 README 明确标为合成夹具；矩阵是测试 fixture，未发现可证明其为真实交付场景的来源。它们均不作为真实正向候选，也未对其运行时序分析。

本轮没有找到来源和授权明确的新真实场景；仅检查上述固定文件名和目录，未覆盖其他命名配置、仓库外资产或未来新增产物。下一阶段称为**真实交付来源追溯**：先证明 config、pack 与 manifest 的交付关系、来源及使用授权，记录原始文件和 Atlas 身份，再决定能否进入几何预筛选与正式可信链验证。符合几何条件本身不能证明交付来源或授权。如需要新建真实 fixture，应先遵守 `docs/v7.8/移动-收口.md` §1.4 / §5.1 的独立 FIX 治理，不自行新建。验收目标保持为真实可信输入、两档各自完整 witness、重复执行可复现，不接受合成或静态结果替代。

## 搜索范围与来源

以 `.scratch/level-playability-v1.1-u5/evidence/06-performance.json` 的 20 个去重 config / audit manifest 配对为索引，另列仓库追踪的 `fixtures/game-configs/last-train.json` + `fixtures/packs/last-train/v2/manifest.json`，共 21 条记录（最后一条与索引内 last-train 有重复内容，不计为新增独立案例）。未扫描索引之外的全仓数据或外部来源。具体路径、当前文件 hash、Atlas JSON 文件路径 / 实际 hash / manifest checksum、历史原因、运动参数和结果见 [机器可读目录](tnb01-candidate-discovery-20261119-01/tnb-candidates.json)，SHA-256 `f597b14d9ed791c2790dfd9819eb0270bc4116810c66dfa4fa8574e335b987dc`。

仓库跟踪的 last-train fixture 已获用户本次本地只读检查授权；其他记录来自项目已有 run、`out` 或 scratch 产物，本次本地只读检查获用户授权，但其配对是否为正式交付关系、是否可用作新冻结 fixture 及进一步使用权限均**未核实**。历史索引可能按覆盖关系 fallback 配对，不能将关联路径视作真实性或授权证明。smoke、negative、合成案例及缺失正式来源者不作为真实正向准入；本清单保留它们用于解释筛选覆盖，未将其包装为真实案例。

## 方法与结果

执行目录内 [只读脚本](tnb01-candidate-discovery-20261119-01/tnb-candidates.mjs)（SHA-256 `5bba1a8419c42a15f9f5a1d676d2bb5d18e1bd6234e50a58f21719dc387915a4`），读取已有 config、manifest 和相关 Atlas JSON。先按 config 的移动 hazard 数量 / 轴做必要条件粗筛，再调用既有 `resolveWitnessSpace`、默认预算及该 hazard 周期；不调用时序搜索、`verifyTemporalInput` 或测试可信占位。采用已在可行性记录中比对过源码的本地 dist。5 条旧版 manifest 为筛选而在内存按既有历史规则归一化为 v4；保留原文件及格式，结果不代表该变换获准用于正式 fixture。Atlas hash 匹配仅是字节检查，不等同正式可信链验证。

| 分类 | 记录数 | 含义 |
| --- | ---: | --- |
| 移动模型粗筛未通过 | 7 | 非单一 x 轴移动 hazard；不进入几何检查。 |
| spawn 盒与 solid 重叠 | 2 | `spawn-box-overlaps-solid`。 |
| goal 不在可达走廊 | 10 | `goal-outside-corridor`；包含额外列出的 last-train 重复内容。 |
| goal 实体缺失 | 2 | `gate-missing`，均属历史负例。 |
| 几何预筛选通过 | 0 | 暂无可进入下一门的候选。 |

21 条中需要的 Atlas JSON 均可读且其字节 hash 与相应 manifest 条目一致；未做 frame / anchor、PNG、Runtime 几何或可信品牌验证。每条的哈希和配对见 JSON；manifest 的关联位置是历史索引给出的，不保证是权威交付配对。

`resolveWitnessSpace` 按 spawn、走廊、相位网格、goal 顺序早退；输出失败时只暴露第一个原因，不暴露中间 corridor / goal 的数值。因此 `spawn-box-overlaps-solid` 行的 corridor 和 goal 为**未评估**，`goal-outside-corridor` 行能确定走廊目标不相交，但函数未返回数值范围，不能伪造；粗筛行的三项均未评估。若未来出现成功项，JSON 会保留 spawn、corridor、goal box 和目标格。此检查也不覆盖模型适用性全部规则，不是 NB/PU 判定。

## 后续准入门

仅在发现通过粗筛与几何前置的候选后，核实 config 与 pack 的真实交付配对、使用授权、文件 hash 和所需旧格式处理权限，再使用正式 `verifyTemporalInput`；可信链通过后才能执行双 lag 分析及重复验证。缺少任一项保持未准入；不得修改历史输入、伪造可信品牌或由静态结论推断时序 NB。

未覆盖：索引生成后新增的配置、索引未收录位置、其他仓库或外部资产、非单 x 轴模型、真实运行时几何以及全局 fixture 来源权利。搜索不是全仓穷尽，也不证明不存在可行候选。未冻结契约或 fixture，未授权 TP1，未改变 Phase-2 几何 P2 与公共 gate。
