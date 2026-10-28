# 06 冻结 Demo 真实试玩取证

Type: task
Status: resolved
Assignee: claude
Blocked by: 04, 05

## Question

在冻结的 wasteland Demo（`pack/v1 · site/v1 · shell 2`）上，用改进后的策略跑真实浏览器试玩并保留完整证据。

要求：

- 零付费；不重生成资源；不改站点字节；身份必须与冻结快照一致（pack/site/shell/checksum）。
- 最多 3 轮有记录的策略迭代；每轮保留 `result.json`、`events.jsonl`、`trace.jsonl`、`input.jsonl`、console/exceptions、`site-integrity.json`。
- 每轮使用全新的输出目录或新的版本化 attempt；不得复用同一 `--out`（01 审计发现直接复用会重写 `attempt-v<i>`，覆盖上一轮证据）。
- 记录：是否进入场景、最远有效推进、必需收集物、危险碰撞/重置、是否完成目标、耗时与动作数、最终分类。
- 失败时如实归因（游戏失败 / 环境 / 执行器能力不足 / 超时 / 证据不足），保留失败样本；不通过改判据、移危险物或改配置制造通关。
- 若 3 轮仍不能完成，输出失败证据与阻塞点，交 07 汇总；不得把 `SUCCESS` 当作本票的硬性目标。

## 03 裁定（已锁定，2026-10-28）

- 同一冻结 Demo 的**一次取证活动**，最多 3 轮有记录的策略迭代（Q6(a)/Q9(a)）；每轮新 attempt/输出目录，保留 `result/events/trace/input/console/exceptions/site-integrity`。
- 成功不是硬目标；失败按五态如实归因，保留失败样本；不得改判据/移危险物/改配置制造通关。
- 使用 04/05 收敛后的策略；阈值与停止原因见 [03 的 Answer](03-gap-triage-and-strategy-ruling.md#answer)。
- 不得回退到历史 `pass` 冒充本轮成功；06 失败时 07 的总结论必须反映本轮失败。

## 08 裁定（已批准，2026-10-28）

- 新报告可带可选 `stop?: { reason, atStep }`；06 必须把 harness 写出的 `stop` **原样保留**在 `result.json`，不得删除、改写或手填。
- 失败样本的停止原因（`no-progress` / `reset-exhaustion` / `wait-limit` / `jump-exhaustion`）与 `atStep` 是 07 逐项重验的输入；不得只保留最终 outcome 而丢掉 stop。
- 交付摘要 `delivery.playtest` 不含 stop（Q4 A）；07 直接读 `result.json`。

## Answer

**2026-10-28 已收口。** 在冻结 wasteland Demo（`pack/v1 · site/v1 · shell 2`，只读快照）上用 04/05 收敛后的策略跑真实浏览器试玩：**两次 attempt 均自动 `SUCCESS`**（`won=true` / collected 6 / chests 2 / 0 reset / 0 hazard-hit / 0 runtime-error），站点与 pack 字节零变化，身份与 `artifacts/identity.json` 一致；零付费、未重生成资源、未改站点/配置/Runtime。**第一轮即成功，没有策略迭代，也没有需要保留的失败样本。**

### 一、运行

命令（两次都使用全新输出目录，未复用 `--out`）：

```bash
node packages/demo/probe/playtest/playtest.mjs \
  --site .scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/site/v1 \
  --scenario-dir .scratch/fpvs-v1-final/scenarios/acceptance \
  --out .scratch/generic-playtest-v1/evidence/06-attempt-<N>
```

| attempt | 结果 | steps | duration | 证据 |
|---|---|---|---|---|
| 1 | **SUCCESS** · 断言 8/8 pass · termination true · stop null | 452 | 17,721ms | `evidence/06-attempt-1/attempt-v1/` |
| 2（复现） | **SUCCESS** · 断言 8/8 pass · termination true · stop null | 451 | 17,736ms | `evidence/06-attempt-2/attempt-v1/` |

- 两次都进入场景（`scene-ready=1` / `spawn=1`），最远有效推进 `maxX≈1370`（attempt 1 x=1371 / attempt 2 x=1369.5，gate.x=1380），
  必需收集物全部拿到（4 pickup + 2 chest = collected 6，activePickups=0），`win` 事件各 1 次。
- 动作数：attempt 1 **7 个动作 / 9 jump / 9 land**；attempt 2 **7 个动作 / 10 jump / 10 land**。
- 危险物/重置：`danger-hit=0`、`hits=0`、`reset=0`；两个 attempt 均无 `stop`（未触发 05 的四种主动停止）。
- 两次的确定性投影（`playtestProjectionOf`）**完全一致**（`sameProjection=true`），身份字符串一致；
  steps / 跳跃次数 / 末位置有 1–2 的时序抖动，这是真实浏览器轮询的正常抖动，`determinism.json` 与投影比较均通过。
  记录：`evidence/06-reproducibility.json`。

### 二、身份与字节完整性

- `result.json.identity`：`siteVersion=1`、`packId=wasteland-scavenger-recipe`、`packVersion=1`、
  `packChecksum=sha256:a162942d…feb3`、`configChecksum=sha256:455d9c7f…5dcd`、`shellVersion="2"`、
  `harnessVersion=playtest-harness/v2`、`rulesVersion=playtest-rules/v2` —— pack/config/site/shell 与
  `artifacts/identity.json` 全等；harness/rules 的 v2 是本轮生产者版本，**不是站点身份漂移**（08 口径）。
- `site-integrity.json` 两次均 `unchanged=true`（index.html / shell.js / site.json / game-config.json 前后哈希相同）。
- 额外机械核对：`site/v1` + `pack/v1` 共 **50 个文件**，运行前后 sha256 清单一致
  （`evidence/06-snapshot-before.json`、`06-snapshot-after-1.json`、`06-snapshot-after-2.json`，三次 `sameAsBefore=true`）。
- `exceptions.json` 为空；`console.json` 仅 Phaser 启动日志、shell v2 日志和一条已知的 Canvas 九宫格回退警告
  （`hud.panel` 不支持 nineslice，属渲染器能力提示，不是 runtime-error）。

### 三、归因与分类

- 场景 `assertionAggregate=pass`（8/8：initial-pickups / all-collected / chests-opened / pickups-cleared /
  pickup-events / chest-events / won / win-event），`terminationReached=true`，终态 `won=true`。
- `result.json` 的场景级 `outcome` 为 `null` —— **harness 按设计不做五态归因**（README 明确）；本轮结论按真实观测
  记为 **SUCCESS（自动试玩成功）**，五态归因与 `delivery` 映射留给 07，不在这里手写中间 JSON。
- 无失败样本（第一轮成功）；未通过改判据、移危险物、改配置制造通关。

### 四、给 07 的事实

- 这是同一冻结对象的**一次取证活动**、2 个 attempt（≤3），**0 次策略迭代**（两次之间没有代码改动）。
- `stop=null` 是成功运行的正常值；07 不应把「无 stop」误读为缺证据。
- 冻结 Demo 只含 `axis:"x"` 巡逻物（`patroller-1` / `patroller-2`），**没有 y 巡逻与定时喷发实体** ⇒
  本票真实运行覆盖横向巡逻 + 05 有限终止/动作验证；04 的纵向/喷发仍是 E2 fixture 证据，报告须按 03 口径披露。
- 危险物接触没有正向事件（无 `hazard-hit`），本轮的「未撞危险物」由 `hits=0` / `reset=0` / trace 间接支持，
  措辞不得夸大成「直接观测到碰撞/规避」。
- 历史 FA-02/FA-06 报告是 harness/rules v1，本轮是 v2 ⇒ **not-comparable**；继承比对必须按版本差异披露。

### 五、限制

- Playtest V1 的 E3 证据集不含截图；本轮没有新增截图能力，最终视觉结论仍继承 FA-04 + 09 补审。
- 只跑了一个真实 Demo、一次取证活动；纵向/喷发形态没有真实样本。
- 步骤数的轻微抖动（452 vs 451）不影响确定性投影，但说明真实浏览器运行不是逐位可复现。
