# FPVS-V1 v7.6 P0 最终验收报告（07）

- **验收对象**：`wasteland-scavenger-recipe` · `pack/v1` · `site/v1` · shell `2`（FA-01 冻结）
- **报告日期**：2026-10-28
- **最终结论：`pass`**
- **推导**：`delivery.verdict` 由 `deriveDeliveryVerdict` 重算 = `pass`，且 §5.5 八项 **8/8 MET**；
  两者同时成立才判 `pass`（03 Q11 A）。历史 `pass` 没有被用来覆盖本轮失败（本轮无失败）。
- **一句话**：这个确定版本的 Demo 在冻结身份与字节不变的前提下，由真实按键试玩再次证明可完成目标；
  危险形态策略、有限终止、动作验证与证据闭环在当前 `main` 上有确定性证据；视觉六项历史审核 + 四项补审
  全部通过；继承证据 27/27 机械核对通过；回归全绿。限制均已披露，没有未解决的阻塞项。

> 本报告是**聚合与重验记录**，不手工改 `qa-report.json` / `delivery` / `playtest` 中间 JSON；
> 所有可复核证据的路径、命令、退出码与身份见 §10。产品读取路径仍不重算证据哈希（Q8(b) 明确不加固），
> 本轮由 effort 脚本机械核对（§2）。

## 1. 验收对象与身份

| 项 | 值 | 证据 |
|---|---|---|
| 包 | `wasteland-scavenger-recipe` · `pack/v1` | `artifacts/identity.json` |
| 站点 / shell | `site/v1` · shell `2` · `site.json` = pack `v1` / config `game-config.json` | `work/.../site/v1/site.json` |
| manifest | `sha256:a162942de2a65a549be6958f0739f900df0625e0fa957872425bd9a53aa7feb3` | `identity.json` |
| config | `sha256:455d9c7fc982e4d4c3c5b32ff4a94f1dd99f5e85b8adcb0f59af521f3b757dcd`（run 与站点同一份） | `identity.json` |
| 只读快照 | `artifacts/wasteland-scavenger-recipe/`（66 文件，`chmod -R a-w`） | `artifacts/hashes.json` |
| 可写工作区 | `work/wasteland-scavenger-recipe/`（site/pack/config 与快照逐字节一致） | `hashes.json` / `materials.json` |
| 交付报告 | `work/.../run/v1/qa-report.json` · `sha256:dc20e301…5ee6` | `consistency.json` |
| 本轮试玩 | `evidence/06-attempt-{1,2}/attempt-v1/result.json`（harness/rules v2） | §6 |
| 历史试玩（交付内） | `work/.../run/v1/playtest/v2/result.json`（harness/rules v1，FA-06） | `delivery.playtest.report` |

身份三方一致：`qa-report.delivery`、`playtest/v2/result.json.identity`、`artifacts/identity.json`
的 packId/packVersion/siteVersion/shellVersion/configChecksum/packChecksum 全等（FA-05 `consistency.json`）。
本轮 06 的两份新报告 identity 与同一冻结对象全等；`harnessVersion/rulesVersion=v2` 是**生产者版本**，
不是站点身份漂移（08 裁定）。

## 2. 继承证据机械核对（effort 脚本，27/27 通过）

脚本：`scripts/07-verify-inherited.mjs` · 结果：`evidence/07-inherited-verification.json`
（`checks=27 failed=0 pass=true`，exit 0）。脚本只读，不改产品路径与历史文件。

| 组 | 核对内容 | 结果 |
|---|---|---|
| 身份 | `delivery` ↔ `identity.json`：pack/version/manifest/config/site/shell；manifest 与 site config 实际文件哈希 | 6/6 pass |
| FA-04 记录 | `review-record.subject` / `capture.subject` / `materials.subject` ↔ `delivery` 身份；`review-record.overall=pass`、六项全 pass | 4/4 pass |
| 材料 | `materials.json` 44 条（17 源 + 27 生成）逐文件 sha256；reference / deliveredAssets / visualContext 与快照 `frozen match`；唯一 `frozen:"differs"` 是 `run/v1/qa-report.json`（FA-02/FA-04 预期写回） | 1/1 pass（44 条 0 失败） |
| 运行画面 | `capture.shots` 9 文件 / **8 个不同哈希**；08 与 09 同字节；site-integrity 前后一致且与当前 site 四文件哈希一致 | 3/3 pass |
| FA-05 报告 | `evidence.json` **36/36** 文件哈希；`consistency.json` **12/12** 检查 pass、`checksFailed=0`；qa-report 哈希 = `dc20e301…5ee6` | 3/3 pass |
| 历史 verdict | 六个必需检查齐备、全 pass；`deriveDeliveryVerdict` 重算 = 声明 = `pass`；visual/playtest 映射 | 2/2 pass |
| FA-06 回归 | 4 条命令 exit 0 | 1/1 pass |
| 本轮 06 | 两份 attempt identity 全等、SUCCESS、stop null、站点未改；确定性投影一致 | 2/2 pass |
| 冻结字节 | `site/v1 + pack/v1` **50 文件**当前哈希 = `06-snapshot-before` = `after-1` = `after-2` | 1/1 pass |
| 09 补审 | subject 绑定；四项全 pass、problems 空；FA-04 三份记录哈希未变；8 个不同画面、非七项全量重审 | 4/4 pass |

**结论**：FA-04 视觉记录、FA-05 报告/verdict、FA-06 回归基线与本轮 06/09 证据均可在**同一冻结对象**上继承；
无身份或哈希不一致项。

## 3. delivery 结论（确定性重算）

| 必需检查 | 状态 | 证据 |
|---|---|---|
| `asset-pack` | pass | `qa-report.delivery.checks` |
| `config` | pass | 同上 |
| `qa` | pass | 7/7 判据；2 条 warning 不阻断 |
| `site` | pass | 同上 |
| `playable-smoke` | pass · SUCCESS | 继承 FA-06 v2 报告 |
| `visual-review` | pass | 继承 FA-04 六项 + 09 四项 |

`deriveDeliveryVerdict(required)` = **pass**；声明 `delivery.verdict` = **pass**；两者一致。
`delivery.playtest.aggregate=SUCCESS`、场景 `outcome=SUCCESS`；`delivery.visualReview.status=pass`。

> 本轮 06 的 harness/rules v2 真实试玩是**独立验证证据**，没有写回 `delivery`（Q8(b)/03 Q9 A：
> 不改产品审核路径与中间 JSON）。交付内 `delivery.playtest` 仍指向 FA-06 的 v1 报告；两者身份相同、结论同为 SUCCESS。

## 4. §5.5 八项逐项判定

| # | 验收标准 | 基线（01） | 本轮 | 证据（E 级别） |
|---|---|---|---|---|
| 5.5-1 | 危险区域不再无条件持续向右推进 | PARTIAL | **MET** | E2：横向等待/跨带 + 纵向扫掠/喷发窗口（`policy.test.mjs`、`danger-forms.test.mjs`）；E3：06 真实运行 `input.jsonl` 松开/恢复右键、0 reset |
| 5.5-2 | 必要时等待，条件变化后重新评估 | PARTIAL | **MET** | E2：每观测步重算 + 120 步 `wait-limit`（`termination.test.mjs`）；E3：06 真实等待/恢复（`keyDown/keyUp ArrowRight`） |
| 5.5-3 | 跳跃有实际状态变化作为证据 | PARTIAL | **MET** | E2：3 步窗口验证、连续 3 次降级、累计 5 次停止（`termination.test.mjs`）；E3：06 `jump-verified` 9/10 次 + `jump`/`land` 事件 9/9、10/10 |
| 5.5-4 | `pickupAbove` 不盲目追逐、不绕过必需目标 | NOT MET | **MET** | E2：单跳包络 + 平台几何、不可达记 `pickup-unreachable`；E3：06 collected 6（含 scrap-2/4 平台） |
| 5.5-5 | 连续无进展和重复重置能有限终止 | NOT MET | **MET** | E2：300 步无进展 / 累计 5 次重置 / 120 步等待 / 跳跃耗尽（`termination.test.mjs`）；E3：06 成功运行未触发（`stop=null`，属成功路径） |
| 5.5-6 | 终止原因、最后状态、动作轨迹可追溯 | MET | **MET** | E1/E2：`stop{reason,atStep}` + 四条不变量 + 归因 `AGENT_LIMITATION`（contracts 测试）；E3：`result.json` / `trace.jsonl` / `strategy.json` 可读 |
| 5.5-7 | 现有确定性场景测试仍然通过 | MET | **MET** | E2：`pnpm test` 147/2207、`test:playtest` 143/10，exit 0（§8） |
| 5.5-8 | 不需要修改游戏生成协议、游戏配置契约或 Runtime | MET | **MET** | E1/E3：未改 Runtime / `GameConfig` / 站点 / 生成协议；06 50 文件哈希不变；唯一契约增量是 08 批准的 playtest 报告可选 `stop`（测量层，不是游戏契约） |

**§5.5 计数：8 MET / 0 PARTIAL / 0 NOT MET。**

## 5. 01 差距清单 9 条重验

| # | 差距 | 状态 | 证据 |
|---|---|---|---|
| 1 | `policy` 不读 `dangers`；READ_STATE 缺盒足迹/周期 | **closed** | 04：`READ_STATE` tests + `danger-forms.test.mjs` |
| 2 | `hazardModel` 仅 `axis:"x"`；纵向无窗口 | **closed** | 04：纵向模型/扫掠/窗口/回落测试 |
| 3 | `pickupAbove` 无条件起跳 | **closed** | 05：可达性 + 不可达证据；06 collected 6 |
| 4 | 无进展/重复重置不终止 | **closed** | 05：`termination.test.mjs`；`stop{reason}` 契约 |
| 5 | 等待无上限；跳跃不验证离地 | **closed** | 05：120 步 wait-limit、3 步跳跃窗口；06 `jump-verified` |
| 6 | 契约不能表达主动停止 | **closed** | 08 批准 + 05 实施 `stop?{reason,atStep}` |
| 7 | `review-record.subject` 未与 delivery 比对 | **effort-closed / 产品路径未改** | 07 脚本 §2；产品 `review-verdict` 未改（Q8(b)） |
| 8 | `delivery.evidence` 不重算哈希；视觉结论无 ref | **effort-closed / 产品路径未改** | 07 脚本 44/36/12 哈希核对；产品读取路径仍不重算（已披露） |
| 9 | 缺纵向/喷发 fixture 与全量五态 E2E；§1 过时 | **partial** | 04 已补纵向/喷发 fixture；五态 E2E 按 03 Q10 本轮不做；§1 旧 `x=813/24` 已不作为基线（见 §9） |

## 6. 本轮真实试玩（06）

| attempt | 结果 | steps | 耗时 | 动作 | 证据 |
|---|---|---|---|---|---|
| 1 | SUCCESS · 8/8 断言 pass · termination true · stop null | 452 | 17,721ms | 7 / 9 jump / 9 land | `evidence/06-attempt-1/attempt-v1/` |
| 2 | SUCCESS · 8/8 断言 pass · termination true · stop null | 451 | 17,736ms | 7 / 10 jump / 10 land | `evidence/06-attempt-2/attempt-v1/` |

- 终态：`won=true`、collected 6、chestsOpened 2、activePickups 0、`hits=0`、`reset=0`、`danger-hit=0`、`runtime-error=0`。
- 投影一致（`sameProjection=true`）；身份一致；两次 site-integrity `unchanged=true`；50 文件快照哈希不变。
- 只有 `axis:"x"` 巡逻物，无 y/danger 实体 ⇒ 纵向/喷发只有 E2 fixture 证据（见 §9）。

## 7. 视觉审核（FA-04 六项 + 09 四项）

| 来源 | 范围 | 结论 | 绑定 |
|---|---|---|---|
| FA-04 `review-record.json` | 整体风格 / 色彩与明暗 / 角色 / 场景 / 关键物件 / 实际运行效果（6 项） | 6/6 pass | pack/v1 · site/v1 · shell 2；manifest/config 哈希 |
| 09 `review-record.supplement.json` | 画面可读性 / 动画表现 / 玩法与视觉对应 / 整体完成度（4 项） | 4/4 pass · problems 空 | 同一 subject；审核者 `人（本次会话用户）`；`2026-10-28T15:42:14Z` |

- 8 个不同画面（`08-goal.png` 与 `09-final.png` 字节相同；不声称 9 个）。
- 09 是**补充记录**，不是 FA-04 七项全量重审；FA-04 三份记录零改动（哈希见 §2 与补审记录）。
- 视觉结论由 09 补审记录 + FA-04 历史记录共同支持；产品 `review-verdict` / `delivery` 未改。

## 8. 回归

| 命令 | 退出码 | 结果 | 证据 |
|---|---|---|---|
| `pnpm test` | 0 | 147 files / 2207 tests passed | `evidence/07-regression/test.exit` |
| `pnpm typecheck` | 0 | 全部 workspace Done | `evidence/07-regression/typecheck.exit` |
| `pnpm test:playtest` | 0 | self-test 4/4 + 10 files / 143 tests | `evidence/07-regression/playtest.exit` |
| `FREE_ACCEPTANCE_OUT=… pnpm test:acceptance` | 0 | 免费验收闭环 `allOk=true`：vitest / mechanic-probe / mechanic-coverage=satisfied | `evidence/07-acceptance/free-acceptance.json` |

自测运行后已 `git restore .scratch/playtest-v1/runs/2026-10-28-self-test/` 的 tracked 产物并删除本次生成的
两个 `strategy.json`；历史自测产物零改动。完整日志本地保留（`*.log` 按仓库约定不入库）。

## 9. 限制与披露

1. **产品读取路径仍不重算证据哈希**：`delivery.evidence` 仅 ref+path；本轮由 effort 脚本做 44 条材料、
   36 条 FA-05 证据、12 条 consistency 与 9 张画面的哈希核对。**没有**宣称 Q8(b) 已加固。
2. **只跑一个真实 Demo**：冻结 wasteland；没有跨游戏证据。
3. **纵向/喷发仅 E2 fixture**：冻结 Demo 只有 `axis:"x"` 巡逻物；纵向/喷发没有真实浏览器样本。
4. **五态浏览器 E2E 未做**：按 03 Q10 A，归因由契约单测覆盖，不引入浏览器端到端依赖。
5. **旧 `x=813 / 24 reset` 不可复现**：当前保留的失败样本是 `x=438 / 19 reset`（FA-02 harness-1）；
   报告不以旧叙述作基线。
6. **FA-04 六项 ≠ §7.3 七项**：补审四项来自 09，来源分开标注；未做七项全量重审。
7. **`08-goal.png` 与 `09-final.png` 字节相同**：只有 8 个不同画面。
8. **危险物接触无正向事件**：无 `hazard-hit`；`hits=0` / `reset=0` / trace 是间接判据，措辞不夸大为逐帧证明。
9. **harness/rules v1 vs v2**：交付内 FA-06 报告是 v1，本轮 06 是 v2；身份只看 pack/site/config/shell，
   版本差异不当作站点漂移；旧基线 `not-comparable`。
10. **06 未写回 delivery**：交付内 playtest 仍是 FA-06 v2 报告；本轮 06 是独立验证，不改变产品路径。
11. **只有一个人工审核者、一次补审**：09 不复核 FA-04 六项判断本身。
12. **Playtest V1 证据集不含截图**：06 没有新增截图能力；视觉材料来自 FA-04 + 09。

## 10. 最终结论与证据索引

**最终结论：`pass`。**

- `delivery.verdict`（`deriveDeliveryVerdict` 重算）= `pass`；六个必需检查全 `pass`。
- §5.5 **8/8 MET**；01 差距清单 6 条 closed、2 条 effort-closed（产品路径未改、已披露）、1 条 partial（五态 E2E 本轮不做）。
- 本轮 06 两份 attempt 均 SUCCESS；09 四项人工补审全 pass；继承证据 27/27 核对通过；四道回归命令 exit 0。
- 没有失败/阻塞项；上述 12 条限制不构成强制条件失败，已逐条披露。

**证据索引**

| 内容 | 路径 |
|---|---|
| 继承核对结果 | `evidence/07-inherited-verification.json` |
| 继承核对脚本 | `scripts/07-verify-inherited.mjs` |
| 本轮真实试玩 | `evidence/06-attempt-1/`、`evidence/06-attempt-2/` |
| 试玩复现比较 | `evidence/06-reproducibility.json` |
| 快照 50 文件哈希 | `evidence/06-snapshot-{before,after-1,after-2}.json` |
| 视觉补审记录 | `evidence/09-review-record.supplement.json` |
| 视觉材料清单 | `evidence/09-review-materials.json` |
| FA-04 历史记录 | `.scratch/fpvs-v1-final/runs/2026-10-28-visual-review/` |
| FA-05 报告/证据/一致性 | `.scratch/fpvs-v1-final/runs/2026-10-28-final-acceptance/` |
| FA-06 回归基线 | `.scratch/fpvs-v1-final/runs/2026-10-28-regression-closure/regression.json` |
| 交付报告 | `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json` |
| 本轮回归 | `evidence/07-regression/` |
| 免费验收闭环 | `evidence/07-acceptance/free-acceptance.json` |
