# T-NB-01 可行性记录

状态：**BLOCKED / 未证明可行** · 2026-11-19

## dist 归属与既有候选筛选（2026-11-19）

以当前工作树 `ebdc7786e2438ac738d60b5bf40fe7c613cef2bd` 的 contracts 源码、Node `v22.23.2` 和 TypeScript `5.9.3`，运行 `pnpm exec tsc -p packages/contracts/tsconfig.json --outDir /tmp/tnb01-source-build --incremental false --composite false --declarationMap false --sourceMap false`，退出码 0。逐一比较新编译的 65 个 JS 文件与此前执行使用的 `packages/contracts/dist`：仅移除 sourceMappingURL 尾注并忽略末尾空白后，**65/65 相同**。这是当前源码及本地工具链能生成相同 JS 的证据，不证明原 dist 当初何时或由谁构建，也不验证 source map。源码 `temporal.ts` hash `6df8475822717d7e06a611e2e539785a3f8c9f67719e93d07e03d6373ef7ce53`，`temporal-input.ts` hash `fb72c781287d2b0bdc4caaa81dd05810c01f4e4216840431d7ece25e32982e08`；dist hash 见下方原始核验记录。比较覆盖所有 contracts JS，不只两个入口；无生产文件写入。

只读筛选 `.scratch/level-playability-v1.1-u5/evidence/06-performance.json` 所列 **20 个去重 config 记录**：两档均 IE；主因分布为 11 `goal-not-representable`、7 `model-out`、2 `spawn-not-on-lattice`。这 20 是 config 记录而非 20 个 moving hazard；此前盘点的 19 mover 对应 11 / 6 / 2。记录含历史 smoke/negative 案例及自动配对 manifest，不能全部当作真实正向候选；历史分析脚本使用测试占位 trusted input，**只能作早退筛选线索，不能证明真实 Atlas 信任或当前输入结论**。语料 inventory hash `ba1d051a401ac70f45be5a705e2c478961ffc3fc0a6c9feb4cde09365df5f74f`；分析文件 hash 见下。

已由本次真实可信链核验的 last-train 明确在目标走廊处早退；现有盘点中没有已知通过前置的真实正向候选。此筛选不是全仓完备性证明，也不排除新发现的历史输入；不得将 20 个历史结果直接判作当前可信重跑。若继续，应先核对新候选真实 pack/config 配对、文件 hash 和前置条件；若需构造新真实 fixture，则先解决独立 fixture 治理授权。

## 2026-11-19 真实候选只读核验

用户授权本次只读可行性核验；选用仓库追踪的 `fixtures/game-configs/last-train.json` 与 `fixtures/packs/last-train/v2/`，此前 P1 与真实案例盘点均使用该资产。此授权仅覆盖本次本地读取与核验，不代表对外使用或另行创建 fixture 的授权。未修改输入或生产代码。

执行 `node /tmp/tnb01-check.mjs`，退出码 0；脚本及完整原始输出保存于 [`tnb01-feasibility-run-20261119-01/`](tnb01-feasibility-run-20261119-01/)。脚本 SHA-256 `4a72282ca2fcbce133dbc2444c41772bd2450b35e90ffba9e1ed120521a60421`；输出 SHA-256 `c12027f3b7529dc6e5b5820e6387630ef141845d33c11e6677467aa02fb9f456`。调用本地已构建 `dist`：`temporal.js` hash `33aa2581a044fbce7181f677986d0279744588fdddb02d221e97a0ba4c64cef2`，`temporal-input.js` hash `d96197fb780dc95a1bb60c6f6072ce760d48e72cb002e70b54ef4f4eac8412df`；未独立验证 dist 与当前源码逐字节对应，结果受此限制。

`temporalScope` 返回 applicable、4 个资产；正式 `verifyTemporalInput` 使用原始 JSON 字节及真实 SHA-256 返回 `ok: true`、15 帧。动画 Atlas `6874ae923c2ee8287e4d4e534e8498b0ef5e108460364151e39d4dcfb766c86d`；sprites Atlas `51b7fbca9718e2b839b3086108f736b9fd0c999595336735ca59efc4d875b554`。验证覆盖 Atlas JSON 元数据和 checksum，不能代替 Runtime 碰撞几何证明。

模型检查使用真实验证返回值调用 `analyzeTemporalInternalTwoLag`（16.67 / 200 ms），两档均为 `insufficient-evidence`、`certificate.kind=none`，主因 `goal-not-representable`，详细原因 `witness-space: goal-outside-corridor`；两档搜索工作与 witness 转移数均为 0。预算状态 complete，公共能力 BLOCKED、公共结果 null。双档 wrapper 在一次调用内完成；这是确认早退，不是成功 witness 证据。由于第 3 步失败，未进行后续正向证书或重复确定性检查。原始输出保留两档和合并结果。

结论：该具体候选无法满足 T-NB-01；不能推断所有真实候选不可行。下一步须依治理规则寻找其他可用真实输入或取得构造真实 fixture 的独立授权。

本记录只评估独立时序草案的 T-NB-01；不冻结契约或 fixture，不授权、实施或签署 TP1，也不认定模型不存在可行输入。草案 `docs/v7.8/移动-I03-temporal-probe.md` 当前 SHA-256 `aec84f83062455e6b485f8e5a15a8a31aadac8a168bae84c1dfd5850548e904b`，仍为 DRAFT。

## 目标与判据

需要具体、可复算的 config、manifest、Atlas 字节和 digest，经 `verifyTemporalInput` 取得可信输入；在现有模型及预算内，以冻结 lag 双档独立分析，各自产生 `nb-candidate`、`witness` / `COMPLETE` 和可复核的全相位证据，重复执行保留输入、输出、命令与摘要。此目标是内部模型证据，不是公共 NB 或 P3 签署。若用于 I-05 的真实案例，还须满足该独立 effort 对真实 pack、正式流程、双档确定性的要求，不能以合成内存 fixture 或单点调用替代。

## 当前候选与证据

| 项目 | 事实及局限 |
| --- | --- |
| 真实候选 | `fixtures/game-configs/last-train.json` SHA-256 `d2786ee38793c47f682be58f13f2f4912ca811684fad0bc7356212d79bf011e3`；`fixtures/packs/last-train/v2/manifest.json` SHA-256 `145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689`。这是已有真实 pack/config，并非本次构造的新 fixture。 |
| 历史分析 | `.scratch/level-playability-v1.1-closure/evidence/01-coverage-inventory.md` 的案例表记录该候选时序结果为 IE `goal-not-representable`，归类为 IE 候选；引用的 `.scratch/level-playability-v1.1-u5/evidence/06-performance.json` 当前 SHA-256 `0263a5e2a5710f9e1d36c470b9f587c68daee5fac401052c0a7d71141175eba9`。这是历史盘点，不是本次重新执行或对可信链的独立验证；原因的具体子项尚未核实。 |
| 合成正向参考 | `packages/contracts/tests/playability-temporal.test.ts` 的 `NB_WORLD`（hazardY=20）断言 Winning Set、完整 witness 与双 lag NB。本次评审运行 `pnpm exec vitest run packages/contracts/tests/playability-temporal.test.ts -t '全相位 Winning Set 成立|两档各自'`：2 passed、41 skipped、退出码 0。测试使用内存 manifest 与 `trustedInputFixture()` 测试占位，**未证明真实 Atlas 可信输入**。 |
| 正式路径 | `packages/assets/src/ops.ts` 中 `runTemporalAudit` 在真实路径通过 `readTrustedAtlasInput` 调用 `verifyTemporalInput`，且仅在提供 `existingAudit` 时运行双档内部分析；legacy 路径使用 stub。源码存在不等于已对候选完成重跑或保留内部 witness。 |
| 早退定位 | `packages/contracts/src/playability/temporal-witness.ts` 的 `goal-not-representable` 可对应 goal 缺失、asset 几何缺失或目标不落在走廊；仅凭历史主原因无法选定具体子项。 |

## 未满足项

1. 尚无被指定为 T-NB-01 的真实输入、版本化 manifest、Atlas 原始 hash 与预期值；未验证该候选的实际可信输入链。
2. 尚无该候选经真实可信输入运行 D9 双档的本次原始输出、两档完整 witness、预算与相位覆盖；亦无可供复核的重复执行记录。
3. 已有 19 个 mover 的历史盘点全为 IE；这不证明所有可能的真实输入均不可行。合成正向结果也不证明真实输入可行。
4. 不得更改现有生产输入来伪装既有案例，不得伪造可信品牌或把静态 NB 作为时序证据。是否可另行构造真实 pack/config，须遵守对应 fixture 治理与授权，不能由本记录默认授权。

## 结论与后续门槛

**BLOCKED，不是 INFEASIBLE。** 现有证据未建立 T-NB-01 的真实正向可行性；因此时序契约和 fixture 不应冻结或签署。下一步限于确定可合法使用的真实候选及其资产来源，核对具体前置和治理权限；在获得适用权限后运行可信验证与双档分析，保存原始证据并重复验证。若候选失败，记录实际字段与原因；若需要创建新真实 fixture 或改变模型/契约，先走相应独立治理，不能降低 T-NB-01 的断言。
