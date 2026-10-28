# 07 继承证据重验与最终聚合

Type: task
Status: resolved
Assignee: claude
Blocked by: 06, 09

## Question

汇总本轮试玩证据 + 继承的视觉审核与历史 verdict，产出最终验收报告。

必须完成：

1. **继承证据机械比对（Q8(b)，不改产品代码）**：用 effort 脚本核对
   `review-record.json` 的 `subject`、`capture.json` 的 pack/site/shell/checksum、`delivery` 身份、
   实际文件哈希、历史 `delivery.verdict` 是否属于同一冻结对象。身份或哈希不一致 ⇒ 不得继承。
2. **逐项重验**：按 01 的差距清单，确认本轮修复是否关闭对应验收项；未关闭的如实记录。
3. **回归**：`pnpm test`、`pnpm typecheck`、`pnpm test:playtest`、必要的 acceptance 命令全绿；日志留档。
4. **最终报告**：身份 / QA / 试玩 / 归因 / 视觉 / 聚合，逐项列强制条件 → 结论 → 证据（路径/命令/退出码/身份）；
   结论允许 `pass` / `fail` / `blocked` / `incomplete`，由 `deriveDeliveryVerdict` 或现有聚合确定，不手工改中间 JSON。
5. **限制披露**：明确记录「产品读取路径未重算证据哈希」「只跑一个真实 Demo」「纵向/喷发仅 fixture 证据」等限制；
   不得宣称已解决 Q8(b) 排除的问题。

## 03 裁定（已锁定，2026-10-28）

- **继承比对（effort 脚本，不改产品路径）**：`review-record.subject` ↔ delivery 身份；materials/capture 逐文件 sha256；`site-integrity` 四文件哈希；QA evidence 36/36 哈希；历史 `delivery.verdict` 是否属于同一冻结对象。身份或哈希不一致 ⇒ 不得继承。
- **视觉**：吸收 [09 补审](09-visual-review-supplement.md) 的四项追加记录；FA-04 六项按原样继承，不改历史记录。
- **最终结论**：交付 verdict 由 `deriveDeliveryVerdict` 确定性计算；另给 §5.5 八项逐项 `MET`/`PARTIAL`/`NOT MET`（横向可用 E2 + 冻结 Demo E3，纵向/喷发用 E2 fixture）；两者均通过才 `pass`，否则按 `fail` > `blocked` > `incomplete` 落；不新建第二套状态模型，不手工改中间 JSON。
- **必须披露**：产品读取路径仍不重算哈希；只跑一个真实 Demo；纵向/喷发仅 fixture 证据；五态 E2E 未做；旧 `x=813 / 24 reset` 不可复现（当前样本 `x=438 / 19`）；FA-04 六项与 §7.3 七项的映射及补审来源；`08-goal.png` 与 `09-final.png` 字节相同（8 个不同画面）。
- 06 失败时不得用历史 `pass` 覆盖本轮失败；报告须列出分歧。

## 08 裁定（已批准，2026-10-28）

- 07 汇总时从 `result.json` 读取场景级 `stop.reason` / `stop.atStep`，作为 §5.5「终止原因、最后状态、动作轨迹可追溯」的证据；交付摘要 `delivery.playtest` 不含 stop。
- 确定性：`playtestProjectionOf` 已含 `stopReason`；重复运行比较与将来基线晋升都要记录它。旧报告无 stop ⇒ `stopReason: null`。
- 身份：新报告 `identity.harnessVersion/rulesVersion` 为 v2；冻结对象的 delivery 身份只到 pack/site/config/shell，**不得**把 harness/rules 版本差异当成站点身份漂移。历史 FA-02 报告仍为 v1，可读、可继承为历史证据。
- 归因：执行器 stop ⇒ `AGENT_LIMITATION`（在游戏失败/环境失败/SUCCESS 之后）；报告措辞不得把主动停止写成场景超时。

## Answer

**2026-10-28 已收口。最终结论：`pass`。** 该结论由 `deriveDeliveryVerdict` 对既有六项必需检查重算（`pass`）与 §5.5 八项逐项判定（**8/8 MET**）共同得出；没有手工改 `qa-report.json` / `delivery` / playtest 中间 JSON，也没有新建第二套状态模型。历史 `pass` 没有被用来覆盖本轮失败（本轮无失败）。

### 一、交付物

- **最终报告**：`.scratch/generic-playtest-v1/evidence/07-final-acceptance.md`
- **机器可读最终结论**：`.scratch/generic-playtest-v1/evidence/07-final-verdict.json`
  （`finalVerdict=pass`、`delivery.declared=recomputed=pass`、§5.5 8/8、gapList、limitations）
- **继承核对结果**：`.scratch/generic-playtest-v1/evidence/07-inherited-verification.json`（27/27，exit 0）
- **继承核对脚本**：`.scratch/generic-playtest-v1/scripts/07-verify-inherited.mjs`（只读，不改产品路径）

### 二、继承证据机械核对（Q8(b)）

脚本 27 项全部通过：

| 组 | 核对 | 结果 |
|---|---|---|
| 身份 | `delivery` ↔ `identity.json`（pack/version/manifest/config/site/shell）+ 实际文件哈希 | 6/6 |
| FA-04 | `review-record` / `capture` / `materials` 的 subject ↔ delivery；六项全 pass | 4/4 |
| 材料 | 44 条（17 源 + 27 生成）逐文件 sha256；快照 `frozen match`；`qa-report.json` 的 `differs` 是预期写回 | 44/44 |
| 画面 | 9 文件 / **8 个不同哈希**（08=09）；site-integrity 与当前 site 四文件一致 | 3/3 |
| FA-05 | `evidence.json` **36/36**；`consistency.json` **12/12**；qa-report `dc20e301…5ee6` | 3/3 |
| verdict | 六个必需检查全 pass；重算 = 声明 = `pass` | 2/2 |
| FA-06 | 4 条回归命令 exit 0 | 1/1 |
| 本轮 06 | 两份 attempt 身份全等 / SUCCESS / stop null / 站点未改；投影一致 | 2/2 |
| 冻结字节 | site+pack **50 文件**：before = after-1 = after-2 = 当前 | 1/1 |
| 09 | subject 绑定；四项全 pass；FA-04 三份记录哈希未变；8 画面、非七项全量重审 | 4/4 |

### 三、§5.5 八项（8 MET / 0 PARTIAL / 0 NOT MET）

| # | 项 | 基线 → 本轮 |
|---|---|---|
| 5.5-1 | 危险区域不再无条件向右 | PARTIAL → **MET**（横向 E2/E3 + 纵向/喷发 E2） |
| 5.5-2 | 必要时等待并重新评估 | PARTIAL → **MET**（120 步 wait-limit + 06 真实等待） |
| 5.5-3 | 跳跃有实际状态变化证据 | PARTIAL → **MET**（3 步验证 + 06 jump-verified 9/10） |
| 5.5-4 | `pickupAbove` 不盲追、不绕过必需目标 | NOT MET → **MET**（单跳包络 + 06 collected 6） |
| 5.5-5 | 连续无进展/重复重置有限终止 | NOT MET → **MET**（300 步 / 5 重置 / 120 等待 / 跳跃耗尽） |
| 5.5-6 | 终止原因/最后状态/轨迹可追溯 | MET → **MET**（`stop{reason,atStep}` + trace + strategy.json） |
| 5.5-7 | 现有确定性场景测试通过 | MET → **MET**（147/2207、143/10，exit 0） |
| 5.5-8 | 不改生成协议/配置契约/Runtime | MET → **MET**（未改 Runtime/GameConfig/站点；唯一增量是 08 批准的 playtest 报告可选 `stop`） |

### 四、01 差距清单 9 条

- **closed（6）**：1 dangers/READ_STATE、2 axis:y、3 pickupAbove、4 无进展/重置终止、5 等待上限/跳跃校验、6 契约表达。
- **effort-closed（2）**：7 审核记录↔delivery 比对、8 证据哈希重算 —— 07 脚本完成；**产品读取路径未改**（Q8(b)），已披露。
- **partial（1）**：9 纵向/喷发 fixture 已由 04 补；五态浏览器 E2E 按 03 Q10 本轮不做；§1 旧 `x=813/24` 不再作为基线。

### 五、本轮真实试玩与视觉

- 06：两次全新目录 attempt 均 SUCCESS（452 / 451 steps，约 17.7s；won、collected 6、chests 2、0 reset、0 hazard-hit、0 runtime-error；投影一致；50 文件哈希不变）。
- 09：人类补审四项全 pass（可读性 / 动画 / 玩法-视觉对应 / 完成度），`problems=[]`；FA-04 六项按原样继承；8 个不同画面，不是七项全量重审。

### 六、回归（全 exit 0）

| 命令 | 结果 |
|---|---|
| `pnpm test` | 147 files / 2207 tests passed |
| `pnpm typecheck` | 全部 workspace Done |
| `pnpm test:playtest` | self-test 4/4 + 10 files / 143 tests |
| `pnpm test:acceptance` | `allOk=true`（vitest / mechanic-probe / mechanic-coverage=satisfied） |

证据：`evidence/07-regression/`（`.exit` 入库；`*.log` 本地保留）、`evidence/07-acceptance/free-acceptance.json`。自测后已 restore tracked 产物，历史自测目录零改动。

### 七、限制披露（12 条，详见报告 §9）

产品读取路径仍不重算证据哈希（Q8(b) 未加固）· 只跑一个真实 Demo · 纵向/喷发仅 E2 fixture · 五态 E2E 未做 ·
旧 `x=813/24` 不可复现（当前失败样本 `x=438/19`）· FA-04 六项 ≠ §7.3 七项 · 08/09 截图同字节（8 个不同画面）·
危险物接触无正向事件 · 交付内 FA-06 报告是 harness v1、本轮 06 是 v2 · 06 未写回 delivery · 单审核者/单补审 ·
Playtest V1 证据集不含截图。

**结论**：没有未解决的阻塞项；`pass`。地图目的地（P0-01～04 在当前 main 上有证据成立 + 最终报告能诚实回答）已达。
