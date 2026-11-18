# 01 · 存量覆盖盘点：I-04 / I-05 / PU 条件 2/5 的证据差集

| 项 | 值 |
| --- | --- |
| 票 | `01-coverage-inventory`（research，AFK 事实盘点） |
| 基线 | `main` @ `16c0375f1df726c13c58a8e1febbb6b77dfac942`（本盘点开始时；只读） |
| 盘点方式 | 只读文件 / grep / 小脚本；**未执行 vitest、未执行 LP-06/07、未运行 probe、未调用上游** |
| 性质 | 事实差集；不做范围裁定、不修改产品代码 / `fixtures/**` / 其他票或地图 |
| 产物 | 本文件（唯一允许写入的路径） |

> 记号：`PASS` = 现有证据已覆盖该要求；`PARTIAL` = 有实质证据但不足以直接签收；`MISSING` = 未找到所需证据；`NOT_RUN` = 明确未执行。**`NOT_RUN` 不写成 `PASS`；「测试存在」不自动等于「要求已覆盖」。**

---

## 0. 语料与基线口径（先钉事实）

1. **21 vs 20**：
   - `inventory.json` 的 `counts.uniqueHorizontalConfigs = 21`（`.scratch/level-playability-v1/corpus/inventory.json`，`counts` 对象；口径见 `.scratch/level-playability-v1.1-i02/evidence/01-code-facts.md:381-395`）。
   - 进入 LP-06 复判的是 **20 个唯一 config**（`usableForRejudgment` 去重后）。第 21 个唯一内容是空世界 `out/__probe/empty/site/v1/game-config.json` / `packages/demo/fixtures/empty-world.json`，无可用 manifest、无 moving hazard。
   - 20 个可用唯一 config 中 **16 个含至少一个移动 Hazard**，共 **19 个 `kind:"hazard"` + `motion.cycle` + `axis:"x"` 实体**。依据：`01-code-facts.md:52,381-395`；`.scratch/level-playability-v1.1-i02/evidence/05-performance.md:53`；`.scratch/level-playability-v1.1-i03/reports/I03-acceptance.md:219`（150 usable / 96 pairs / 20 unique / 19 moving in 16 configs）。
   - 本盘点用只读 Python 复核了同一结论（读 `inventory.json` 的 `configs[]` 与其 `path`，按 `contentHash` 去重后解析 `entities[].motion`）：20 unique usable、16 含 motion、19 个 `cycle/x` mover；参数范围 `distance 40–200`、`periodMs 2500–4000`。
2. **真实目标 config**：`fixtures/game-configs/last-train.json`（`sha256:d2786ee3…`，`contentHash:sha256:303efaa6…`）含 `carriage`（`distance=200, periodMs=4000`）；它与 `out/__probe/last-train/site/v1/game-config.json` 内容相同，是 LP-06 的 `baseline-last-train` 与 publish-gate G1/G4 使用的真实输入。
3. **当前 HEAD 与 I-03 验收基线**：I-03 验收报告基于 `d26276e`；本盘点执行 `git diff --stat d26276e..HEAD -- packages fixtures package.json pnpm-lock.yaml tsconfig* scripts .github`，输出为空 ⇒ 产品面自验收后零 diff。该事实只支持「验收报告仍针对同一产品代码」，**不**等于 I-04 已重新验收。
4. **I-03 验收日志状态**：报告引用的 `.scratch/level-playability-v1.1-i03-impl/evidence/acceptance-run2/` **在当前工作树不存在**（该目录下只有 `U1/ U2/ U3/`）。报告本身是 tracked；其日志 hash 无法在本盘点中复算。见 §5。

### 盘点摘要（先看这里）

| 块 | 条目数 | 现状 |
| --- | ---: | --- |
| I-04 | 13 条要求 | PASS 6（G-02 / G-06 / 伪造几何否定侧 / 错误 lag / V1 回归 / 确定性）；PARTIAL 7（G-01 / G-03 / G-04 / G-05 / G-07 / 未知相位 / 19 关无误拒） |
| I-05 | 19 mover / 16 config 候选 + 6 条 Pipeline 路径 | 真实 IE 案例 19 个；时序 NB = 0、时序 PU = 0；V1 既有层内三态候选为 NB 11 / PU 3 / IE 2（均为静态层）。Pipeline 证据 PARTIAL；最终报告 MISSING |
| PU 六条件 | 6 条 | 1/3/4/6 在合成 `PU_WORLD` 上 PASS；2/5 硬 `BLOCKED`；ADMITTED 资格 MISSING |
| PU-C5 C1–C17 | 17 条 + A/B + E1/E2/E3 | PASS 3（C8/C9/C17）；PARTIAL 9（C1–C7/C14/C15）；MISSING 4（C10–C13）；NOT_RUN 1（C16）；A/B 证明与 probe 整体 MISSING |

---

## 1. I-04 差集矩阵（负向与回归验收）

PRD I-04 交付与验收：`docs/v7.8/移动.md:399-408`；七项硬门槛定义：`docs/v7.8/移动.md:198-252`；G-01～G-07 验证方案落位：`docs/v7.8/移动-I00.md:135-143`；I-04 范围：`docs/v7.8/移动-I00.md:201`。

### 1.1 逐要求矩阵

| # | 要求 | 已有证据（路径:行 / test 名 / evidence） | 覆盖判定 | 缺口 | 候选单元 |
| --- | --- | --- | --- | --- | --- |
| I04-01 | **G-01 Hitbox 来源可信**：帧几何来自真实 pack + manifest；拒绝缺失帧 / anchor / 哈希不符 / 验收后改写 | `packages/contracts/tests/playability-temporal-input.test.ts`：T-01（`:113`）、T-06 文件缺失（`:151`）、T-07 SHA 不符（`:156`）、T-11 同路径两份字节（`:182`）、T-13 帧缺失（`:199`）、T-14/T-15 sourceSize（`:207/:213`）、T-16/T-17 anchor（`:219/:225`）、T-19 anchor 容差外（`:236`）、T-26 digest 与解析同一字节（`:296`）、T-27 不访问磁盘（`:310`）、T-28/T-29 验收后改写（`:321/:332`）；T-65 入口无几何 / 规避声明参数（`:644`）。P1 夹具：14 正例 / 11 负例，manifest `sha256:dd880628…`，独立复核 PASS（`.scratch/level-playability-v1.1-i03-phase2/reports/P1-review.md:12,65-78`；`P1-signature.md:5-16`） | **PARTIAL** | 负例完整，但 G-01 的核心「真实 pack 帧几何 ↔ 运行时 body」仍需 P2 probe + P3 复核；I-03 `AC-15` 非 required `NOT_RUN`（`I03-acceptance.md:114`），`AC-14` required `NOT_RUN`（`:113`） | I-04 |
| I04-02 | **G-02 Lag 来源明确**：显式 / 可审计；两档敏感性；非法 / 缺省 / 两档不一致 ⇒ IE | `playability-temporal-input.test.ts`：T-37 缺省（`:394`）、T-38 null/字符串/NaN/±Inf/负数（`:403`）、T-39 0 合法（`:414`）、T-40 非法 lag 优先（`:420`）、T-41/42 两档适用性（`:428/:432`）、T-44 两档不一致（`:450`）、T-45 优先级（`:457`）、T-63 无默认值（`:631`）。`playability-temporal.test.ts`：A–J I（`:786`）、U5-05 双档隔离（`:892-1040`） | **PASS** | 无实质缺口；需在 I-04 汇总为逐条证据，而不是重复实现 | I-04 |
| I04-03 | **G-03 时间行为确定**：未知相位 + U9 不成立 ⇒ IE；不得用墙钟判据；页面暂停 / 后台行为有支持范围 | 相位 / U9：`playability-temporal-witness.test.ts:779`（U9 四项）、`:918`（Hazard 覆盖 spawn ⇒ residual-wait 失败）、`:931`（无等待格 ⇒ failed `no-waiting-cell`，仍只 IE）；`playability-temporal.test.ts:686`（A–J C：证据不足 ⇒ IE）。墙钟：`:307`（`wallClockMs` 不进确定性签名）、`:498`（注入时钟才 abort）。相位事实证据：`.scratch/level-playability-v1.1-integration/evidence/03-phase-time-origin.md` §1–§2（`t=0` / 首帧 `delta₁ ≤ 200ms`） | **PARTIAL** | 没有以「未知相位」命名的端到端负例；页面暂停 / 后台 RAF 派发次数在 `07-gate-matrix.md` G-03 仍标 U1 未解除；当前语义是「相位自由 + U9」，不是「证明任意页面时间行为」 | I-04 |
| I04-04 | **G-04 垂直规避必须有真实证据**：不得信 `verticalEvasionImpossible`；不能证明 ⇒ 不得 PU | `playability-temporal-input.test.ts:364` T-34（伪造 hitbox/body/尺寸/垂直规避 ⇒ IE，analyzer 不调用）；`:644` T-65（入口无规避声明参数）；`playability-temporal.test.ts:761` A–J G（垂直规避 ⇒ permanent-gate INCOMPLETE）；`playability-temporal-evasion.test.ts:232,445`（`midAirHits` 只作否决）；`temporal-evasion.ts:35,304`；`temporal-evidence.ts:87` / `temporal.ts:515-518`（`movementModelClosure="not-proven-air-control"` 恒 BLOCKED） | **PARTIAL** | 负向拒绝已有；「当前运动模型下真实不存在垂直规避」的正向证据 / 条件 5 A/B 证明未产出（归 PU-C5）。I-04 只能证明「不伪造」，不能证明「已闭合」 | I-04（负向） / PU-C5（闭合） |
| I04-05 | **G-05 运动模型边界严格**：y 轴 / 多移动 Hazard / moving platform / danger 联合 / 非 cycle ⇒ IE，不得近似 | `playability-temporal.test.ts:144`（Y 轴 + 多移动 Hazard ⇒ `model-out`）；`playability-temporal-input.test.ts:482` T-49、`:490` T-50；`temporal.ts:404-421`（moving solid、danger strike 分支源码）；`game-config.ts:80`（`motion.kind` 只允许 `"cycle"`） | **PARTIAL** | Moving platform 与 Danger `strike` 两个 `model-out` 分支**实现了但没有直接测试**：`.scratch/level-playability-v1.1-i02/reports/U5-final-audit.md:158` 明示；`U5-final-audit.md:29` 同项列为覆盖缺口 | I-04 |
| I04-06 | **G-06 判定语义受限**：保留 V1 三态；IE 不得提升；NB 不得当 PU；瞬时 / 局部 ≠ 永久 | `playability-public-verdict.test.ts:87,96,104,111,116,124,132,146,187`；`playability-mechanic.test.ts:302,320,331,338,347`；`pipeline/tests/publish-gate.test.ts:300,309,327,339`；I-03 AC-05/06/07/09/13 PASS（`I03-acceptance.md:100-106,112`）；N1–N12 全 PASS（`I03-acceptance.md:150-161`） | **PASS** | 无实质缺口；需在 I-04 报告逐条引用而不是重跑全部 | I-04 |
| I04-07 | **G-07 生产集成独立验收**：独立测试 / 审查 / V1 回归 / 构建打包 / 旧静态行为不回退 / 可审计证据 | I-03 独立验收报告：`I03-acceptance.md`（整体 **INCOMPLETE**：required PASS 16 / FAIL 0 / NOT_RUN 3）；全量 vitest 178 files / 2952 tests（`:95,178`）；`pnpm build` / `check:deps` / `check:links` exit 0（`:178-182`）；LP-06/07 语义一致（`:225-233`）；U3–U5 回滚演练（`:70-86` 表） | **PARTIAL** | 报告本身为 I-03 验收，不是 I-04 验收；`AC-10 / AC-12 / AC-14` 仍 required `NOT_RUN`（`I03-acceptance.md:344-357`）；没有 I-04 独立复核 / 签署；`acceptance-run2` 日志不在工作树 | I-04 |
| I04-08 | **伪造几何拒绝** | 同 I04-01：T-34（`:364`，伪造 hitbox/body/size/verticalEvasionImpossible ⇒ IE 且 analyzer 不调用）；T-30–T-33（`:347-360`，普通对象 / 同名 Symbol / structuredClone / 真 brand）；T-28/T-29（`:321/:332`，验收后改写） | **PASS**（否定侧） | 不证明真实帧几何等于运行时 body；该正向 / 交叉核对属 G-01 + P3 | I-04 |
| I04-09 | **未知相位拒绝** | 语义落点：U9 失败 ⇒ IE（`playability-temporal-witness.test.ts:918,931`）；A–J C（`playability-temporal.test.ts:686`）；`07-gate-matrix.md` G-03 负例定义（相位不可确定且无安全等待格 ⇒ IE） | **PARTIAL** | 没有单独的 `unknown-phase` 测试名 / 夹具；页面暂停、后台计时、隐藏期 RAF 行为未测（U1 未解除） | I-04 |
| I04-10 | **错误 lag 拒绝** | 同 I04-02：T-37/38/40/44/45/63；双档隔离 U5-05（`playability-temporal.test.ts:892-1040`）；I-03 AC-04（`I03-acceptance.md:103`） | **PASS** | 无实质缺口 | I-04 |
| I04-11 | **V1 完整回归**：既有 vitest 全绿 + LP-06/07 原样 scratch 复跑 | `I03-acceptance.md:95,178`（178 files / 2952 tests，exit 0）；`:183-184`（LP-06 20 configs / 96 pairs；LP-07 39 cases）；`:225-233`（语义 hash 一致，0 changed pairs/cases，组成 20/96/19 不变）；`:326` L1 明示 LP-06/07 无 vitest、不在 CI。MCP / pipeline 侧另有 `publish-gate`、`create-game`、`assemble-site-qa-gate` 测试（见 §2） | **PASS**（带已知限制） | I-04 必须在自己的基线上原样复跑并记录「未采信 I-03 报告」；LP-06/07 非 CI、复跑会临时改写 tracked 证据（`I03-acceptance.md:274,326`） | I-04 |
| I04-12 | **确定性 / 重复执行** | `playability-temporal.test.ts:296`（同输入重复签名 / 序列化一致）、`:307`（wallClock 不进签名）、`:498`（注入时钟确定性 abort）、`:529/:546`（wallClock / detail 不进签名）、`:570`（4 world × 3 lag 重复一致）、`:827`（A–J J）；`assets/tests/ops.test.ts:440`（公共 evidence 可重放）；跨进程：`I03-acceptance.md:236-246`（last-train / compact NB × 3 进程）、`.scratch/level-playability-v1.1-u5/evidence/04-cross-process.json`；U5 性能 JSON `crossProcess.equal=true`（`.scratch/level-playability-v1.1-u5/evidence/06-performance.json`） | **PASS**（进程内 + scratch 跨进程） | 跨进程是 scratch，不在 CI（I-03 L7）；I-04 需记录「非 CI」并原样复跑 | I-04 |
| I04-13 | **19 个 moving-hazard config 无误拒** | 语料：19 mover / 16 config 全部在时序层 IE 早退（`.scratch/level-playability-v1.1-u5/evidence/06-performance.json` 的 `configs[].first/second`；20 个 config 层面的原因分布 11 `goal-not-representable` / 7 `model-out` / 2 `spawn-not-on-lattice`；其中 19 个 mover 的时序结果分别为 11 / 6 / 2，全部 IE，见 `U5-final-audit.md:47,128` 与 `06-performance.json`）；publish-gate 真实 `last-train` 放行且 temporal IE（`publish-gate.test.ts:264` G1/G4）；G2/G3 candidate + gate BLOCKED 仍放行（`:300,:309`）；G10 / 源级不消费 temporal（`:327,:402`）；LP-06 回归 0 changed pairs（`I03-acceptance.md:228`） | **PARTIAL** | 没有对 19 个 config **逐个**跑 publish-gate 的现成证据；LP-06 测的是 auditPlayability 的 verdict，不是发布闸放行；「无误拒」目前由「temporal 不参与放行」的源级测试 + last-train 样本支撑，不是 19 关扫描 | I-04 |

### 1.2 三个重点负例子矩阵（与 I-04 票面一致）

| 类别 | 现有测试 | 判定 | 缺口 |
| --- | --- | --- | --- |
| 伪造几何 | `playability-temporal-input.test.ts:364`（T-34）、`:347-360`（T-30–T-33）、`:321/:332`（T-28/T-29）、`:151-192`（T-06–T-12） | **PASS（否定侧）** | 真实帧几何 ↔ Runtime body 的交叉核对未跑（P3） |
| 未知相位 | `playability-temporal-witness.test.ts:918,931`；`playability-temporal.test.ts:686` | **PARTIAL** | 无具名「unknown-phase」用例；页面暂停 / 后台时间行为未测 |
| 错误 lag | `playability-temporal-input.test.ts:394-471`；`playability-temporal.test.ts:786-834,892-1040` | **PASS** | 需 I-04 汇总与 fresh 复跑 |

---

## 2. I-05 差集矩阵（Pipeline 验收 + 最终收口）

PRD I-05 交付与验收：`docs/v7.8/移动.md:410-420`；DoD：`docs/v7.8/移动.md:514-523`；I-00 计划：`docs/v7.8/移动-I00.md:202,219`；`09-implementation-plan.md` 的 I-05 / Q2 明确要求「真实 `NO_PROVEN_BLOCKER` / `PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE` 各一例；不足时新建 fixture 需 R2 单独批准」。

### 2.1 现有 19 个 moving hazard 的候选案例

> 说明：下表「既有公共/层内状态」来自 LP-06（`auditPlayability`）；「时序结果」来自 U5 性能证据（`06-performance.json`）。**所有 19 个 mover 在时序层都是 `insufficient-evidence`；没有任何真实 config 进入相位网格 / 搜索**（`U5-final-audit.md:128,141`）。

| # | 代表 config | mover（id / distance / periodMs） | 既有公共 / 层内状态（LP-06） | 时序内部结果 | 证据档次 | 可作 I-05 候选？ |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `fixtures/game-configs/last-train.json`（同内容：`out/__probe/last-train/site/v1/game-config.json`） | carriage / 200 / 4000 | LP-06 `NO_PROVEN_BLOCKER` | IE `goal-not-representable` | 真实生产 fixture + 真实 pack `last-train/v2`；publish-gate G1/G4 已用（`publish-gate.test.ts:264`） | **IE 首选** |
| 2 | `out/last-train/game-configs/v1.json` | sweeping-carriage / 180 / 2600 | `NO_PROVEN_BLOCKER` | IE `goal-not-representable` | 真实站点 config（非 probe） | IE |
| 3 | `.scratch/entity-identity-v1/runs/2026-10-25-e2e-r2/wasteland-scavenger-recipe/run/v1/game-config.json` | enemy-1 / 180 / 3600 | `NO_PROVEN_BLOCKER`（LP-06 `final=PROVEN_UNPLAYABLE`，来自既有审计缺陷） | IE `goal-not-representable` | 真实 run 产物 | IE（NB 仅限静态层） |
| 4 | `.scratch/recipe-config-gap-v1/runs/2026-10-23-p0-final/wasteland-scavenger-assets/run/v1/game-config.json` | enemy-1 / 160 / 3600 | `NO_PROVEN_BLOCKER`（final PU） | IE `goal-not-representable` | 真实 run 产物 | IE（NB 仅限静态层） |
| 5 | `.scratch/asset-integration-v1/runs/2026-10-20e-site/game-config-mid.json` | enemy-patrol / 40 / 3000 | `NO_PROVEN_BLOCKER` | IE `spawn-not-on-lattice` | 真实 run 产物 | IE |
| 6 | `.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r2/wasteland-scavenger-assets/run/v1/game-config.json` | enemy-1 / 100 / 3000；enemy-2 / 120 / 3500 | `NO_PROVEN_BLOCKER` | IE `model-out`（多 mover） | 真实 run 产物 | IE（模型外） |
| 7 | `.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r3/wasteland-scavenger-recipe/run/v1/game-config.json` | enemy-1 / 120 / 3000；enemy-2 / 100 / 2500 | `NO_PROVEN_BLOCKER` | IE `model-out` | 真实 run 产物 | IE（模型外） |
| 8 | `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/game-config.json` | enemy-patrol-1 / 120 / 3000 | `PROVEN_UNPLAYABLE`（历史真实缺陷：`pickup-water-4` / `goal-1`） | IE `goal-not-representable` | 历史真实缺陷（LP-06 `historicalDefects`） | **PU 仅限静态既有结论**，不能作时序 PU 证据 |
| 9 | `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-17d/wasteland-scavenger-assets/run/v1/game-config.json` | enemy-1 / 60 / 3000 | `PROVEN_UNPLAYABLE`（历史真实缺陷：`scrap-4/5/6` / `gate-1`） | IE `spawn-not-on-lattice` | 历史真实缺陷 | 同上 |
| 10 | `.scratch/visual-design-impl-v1/runs/2026-10-25-e2e-v4pro-promptfix/wasteland-scavenger/run/v1/game-config.json` | enemy-1 / 120 / 3600 | `PROVEN_UNPLAYABLE`（历史真实缺陷：`pickup-3` / `chest-1` / `gate`） | IE `goal-not-representable` | 历史真实缺陷 | 同上 |
| 11 | `.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/run/v1/game-config.json` | patroller-1 / 100 / 3000；patroller-2 / 120 / 3500 | `NO_PROVEN_BLOCKER`（LP-06 final PU） | IE `model-out` | 真实 run 产物 | IE（模型外；NB 仅限静态层） |
| 12 | `out/__p03-smoke/negative-gate/config-gate-missing.json` | enemy-patrol / 40 / 3000 | `INSUFFICIENT_EVIDENCE` | IE `goal-not-representable` | smoke / negative gate | IE（非真实关卡首选） |
| 13 | `out/__p03-smoke/out/ruin-scavenger-extraction-assets/site/v1/game-config.json` | enemy-patrol / 40 / 3000 | `NO_PROVEN_BLOCKER` | IE `goal-not-representable` | smoke | IE |
| 14 | `.scratch/fpvs-v1-final/runs/2026-10-28-regression-closure/self-test-run/gate/config-gate-missing.json` | enemy-patrol / 40 / 3000 | `INSUFFICIENT_EVIDENCE`（final PU） | IE `goal-not-representable` | self-test gate | IE |
| 15 | `out/__probe-timeout/last-train/game-configs/v1.json` | mover / 160 / 4000 | `NO_PROVEN_BLOCKER`（LP-06 `probeExcluded`） | IE `goal-not-representable` | probe fixture（排除） | 不建议 |
| 16 | `out/__probe-timeout/last-train/game-configs/v2.json` | sweeper / 160 / 3000 | `NO_PROVEN_BLOCKER`（`probeExcluded`） | IE `goal-not-representable` | probe fixture（排除） | 不建议 |

**候选结论（按 I-05 的「时序能力」口径）**：

- **IE：存在且充足**。首选 `fixtures/game-configs/last-train.json`（真实 fixture + 真实 pack + publish-gate 已覆盖）。
- **NB：MISSING（时序层）**。所有 19 个 moving hazard 的 `internalResult` 都是 `insufficient-evidence`；没有任何真实 config 产生 `nb-candidate`。表内 `NO_PROVEN_BLOCKER` 是 V1 静态层 / LP-06 层内结论，**不是**时序 capability 的 NB。
- **PU：MISSING（时序层）**。没有任何真实 config 产生 `pu-candidate`；3 个 `PROVEN_UNPLAYABLE` 是 V1 历史静态缺陷，不是时序 PU。
- 若 I-05 只要求「正式流程能承载 V1 既有三态的真实关卡」，则 NB / PU / IE 候选分别存在（见上表 #2/#3 等、#8–#10、#1）；但这不能证明新时序能力产出了 NB / PU。该口径必须由 `05-i05-brief` 裁定。
- 若需要真正的时序 NB / PU 真实案例：现有 21 / 19 语料不足，**必须新开 fixture 授权票**（`09-implementation-plan.md` Q2；map Q8 / Q14）。I-05 不自建 fixture。

### 2.2 Pipeline 路径证据现状

| 路径 | 现有一致性 / 证据 | 判定 | 缺口 |
| --- | --- | --- | --- |
| `create`（`createGame`） | `packages/pipeline/src/create-game.ts:647` 调用 `runTemporalAudit({config, manifest, packDir})`；但 `assets/src/ops.ts:1099-1109` 对无 `existingAudit` 的调用只走 legacy stub，**结果被丢弃**、不阻断、不落盘。测试：`pipeline/tests/create-game.test.ts:129-195`（pack/config 产出）、`:674-808`（QA 默认跑 / 落盘 / 硬失败）、`assets/tests/ops.test.ts:370-378`（create-game 路径 legacy-only） | **PARTIAL** | 无「create 路径消费时序结果」的验收；当前设计就是只接通不消费（`create-game.ts:647-650` 注释）。I-05 若要求 create 证据，只能证「不误伤」，不能证「时序结论有效」 |
| `build` / `pack` | `pipeline/tests/create-game.test.ts:129-195`（`pack/v1` + `run/v1/game-config.json`）；`pnpm build` exit 0（`I03-acceptance.md:180`）；pack/QA 测试广泛存在 | **PARTIAL** | 与 temporal 无直接集成断言；I-05 的「最终测试和构建报告」可复用 I-03 报告，但尚未以 I-05 身份产出 |
| `publish-gate` | `pipeline/src/publish-gate.ts:153-183` 现场重跑 `auditPlayability` + `runTemporalAudit`；`:261-268` 返回 `temporal` 诊断；测试 G1/G4 真实 last-train（`publish-gate.test.ts:264`）、G2/G3 candidate + gate BLOCKED（`:300,:309`）、G6/G7/G10/G11（`:277/:286/:327/:339`）、G5/G8/G9（`:357/:370/:389`）、源级不消费（`:402`）；I-03 AC-16/17 PASS（`I03-acceptance.md:115-116`） | **PARTIAL** | temporal 仅诊断、**不参与放行**；没有公共 NB / PU；没有对 19 个 config 的发布闸扫描；MCP/CLI 入口虽有 `configPath` 接线，但无 temporal 断言 |
| `qa-report` | `pipeline/src/create-game.ts:704-718` 写 `run/v<N>/qa-report.json`；`pipeline/tests/create-game.test.ts:674-808`（默认跑、`qa:null` 缺席、报告先落盘、incomplete 拒）；`packages/pipeline/src/artifacts.ts:24`；`packages/contracts/src/qa.ts` 无 temporal 字段 | **PARTIAL** | qa-report 不含时序字段；I-05 若要「qa-report 证据」，只能证明 QA 层未回退，不能证明时序诊断随报告交付 |
| MCP / CLI | `mcp/tests/assemble-site-qa-gate.test.ts:92,125,136,148`；`mcp/tests/create-game-qa-failure.test.ts:112`；AC-17 明示 temporal 不进 CLI / MCP（`I03-acceptance.md:118`）；`create-game.test.ts` / `publish-gate.test.ts` 断言零改动 | **PARTIAL** | 入口不暴露 lag / 几何参数；I-05 只能证明「不扩大承诺」，不能证明「用户可用性」 |
| 最终收口报告 | 目标路径由 `05-i05-brief` 冻结为 `.scratch/level-playability-v1.1-closure/reports/V1.1-closure.md`（票面；**当前不存在**） | **MISSING** | 报告、DoD 追溯、签署、支持范围 / 限制 / 残余风险全部未产出 |

### 2.3 最终报告需要的输入（I-05 消费清单）

1. **I-04 结果**：既有 vitest 全绿 + LP-06/07 复跑 + 逐条 G-01～G-07 负向判定；当前只有 I-03 的 INCOMPLETE 报告可作前置，不等于 I-04 PASS。
2. **PU-ADMIT 资格**：六条件逐项 `PASS / BLOCKED / IE / NOT_RUN`；条件 2（P3/P6）与条件 5（PU-C5）当前未闭合。
3. **真实案例**：至少 NB / PU / IE 各一例（或按裁定接受「时序层仅 IE」并写已知限制）；首选真实 config 见 §2.1。
4. **Pipeline 证据**：`create` / `build` / `qa-report` / `publish-gate` 的命令、退出码、产物、`qa-report`、playability verdict、temporal 诊断、确定性 / 重复运行。
5. **构建 / 测试报告**：`pnpm test`、`pnpm build`、`pnpm check:deps`、`pnpm check:links`、T-55–T-65、LP-06/07、跨进程确定性。
6. **支持范围 / 限制 / 已知问题 / 残余风险**：LP-06/07 非 CI、PU 条件 5 未闭合、条件 2 未闭合、`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`、Runtime body 未验证、模型外边界。
7. **DoD 追溯矩阵**：PRD §12 十项 checkbox ↔ 单元 / 证据 / 验收（`09-closure-dod.md`）。
8. **能力声明边界**：只声明单 X 轴 moving hazard 的受限时序分析；不得声称通用动态障碍物。
9. **签署链**：I-04 / PU-ADMIT / PU-C5 / I-05 的 fresh 复核与用户签署。

---

## 3. PU 条件 2/5 差集矩阵（U5 六条件）

六条件定义：`docs/v7.8/移动-I03.md:730-747`；条件 5 合同：`.scratch/level-playability-v1.1-i03/issues/18-i03-pu-air-control.md`；`PUBLIC_PU` 当前 `BLOCKED`：`docs/v7.8/移动-I03.md:72-79,1046`。

### 3.1 六条件逐项

| # | 条件 | PASS 证据位置 / 现状 | 判定 | 缺口 | 候选单元 |
| ---: | --- | --- | --- | --- | --- |
| 1 | 永久门区证明（全周期闭式 + 判侧 + forbidden 注入完整） | 源码 `temporal.ts:476-498`（`gatePass = gateStatus COMPLETE && gate !== null && periodCoverage !== null`）；测试 `playability-temporal.test.ts:233-236`（PU_WORLD 的 `gate-coverage=PASS`）；`playability-temporal-gate.test.ts:133-362`（闭式几何 / 全周期 / 判侧 / forbidden） | **PASS（合成世界）** | 只在 `PU_WORLD` 合成夹具上断言；真实 config 无 `pu-candidate`（全部 IE 早退） | PU-ADMIT |
| 2 | 几何可信（hazard / player / graph 全部 checked） | 源码 `temporal.ts:500-503`：**硬编码 `BLOCKED`**，`blockedReason="runtime-body-unverified; coverage=partial"`；`temporal.ts:248-251` 的 `GEOMETRY_COVERAGE` 恒 `manifest+atlas-metadata / unverified / partial`；I-03 `AC-14` required `NOT_RUN`、`AC-15` 非 required `NOT_RUN`（`I03-acceptance.md:113-114`） | **MISSING / BLOCKED** | P2 probe 未实施、P3 复核报告不存在、P6 几何消费未授权；见 §3.2 | PU-ADMIT（消费） / P6（生产） |
| 3 | 图割证明（完整、可信、无可达路径；模型内） | 源码 `temporal.ts:505-506`（`graphPass`）；测试 `playability-temporal.test.ts:237`（`graph-cut=PASS`）；`playability-temporal-evasion.test.ts:206-239`（精确 spawn / 可达 / 不可达 / mid-air 否决）；`:429-476`（反例 5/7–12） | **PASS（合成世界）** | 同样只在合成夹具；不证明 Runtime 不可达（`midAirHits` 只否决） | PU-ADMIT |
| 4 | Hop 采样（双档完整一致，无预算问题） | 源码 `temporal.ts:509-513`（`hopPass` 依赖 `hopDoubling` + `hopSamplingCoverage`）；测试 `playability-temporal.test.ts:238`；`playability-temporal-evasion.test.ts:290-347`（两档完整 / F1⊆F2 / cap / budget） | **PASS（合成世界）** | 真实语料 `hopSamplesChecked=0`（`U5-final-audit.md:129`）；无真实 hop 证据 | PU-ADMIT |
| 5 | 模型外规避闭合（独立 PASS） | 源码 `temporal.ts:515-518`：**硬编码 `BLOCKED`**，`blockedReason="movement-model-not-proven-air-control"`；`temporal-evasion.ts:147` / `temporal-evidence.ts:87` 恒 `not-proven-air-control`；合同 `18-i03-pu-air-control.md` 明示「本票不产生证据、不闭合条件 5」 | **MISSING / BLOCKED** | C1–C17 仅有零散 E1/E2；A/B 证明与 Phaser 探针未产出；无独立复核报告。见 §3.3 | PU-C5 |
| 6 | Lag 证明（构造性 invariant + 两档） | 源码 `temporal.ts:520-523`（`lag-consistent=PASS`）；测试 `playability-temporal.test.ts:240,786-834,892-1040`；`playability-temporal-input.test.ts:394-471`；`temporal-evidence.ts:101-116`（`lagInvariantByConstruction`） | **PASS（合成世界）** | 「同一输入两档完整但结论不同」的真实世界未找到；用两个完整单档结果直接调合并函数（`U5-final-audit.md:130,138`） | PU-ADMIT |
| — | **六项全 PASS ⇒ ADMITTED 资格** | 不存在：2 / 5 硬阻断（`I03-acceptance.md:110` AC-11 非 required `NOT_RUN`；`docs/v7.8/移动-I03.md:747`） | **MISSING** | 没有 `assessPuAdmission` / PU-ADMIT 报告；没有真实关卡判定 | PU-ADMIT |

**结论**：条件 1/3/4/6 的 PASS 证据存在，但只在**内存合成 `PU_WORLD`** 上；条件 2 与条件 5 仍 `BLOCKED`，故 `ADMITTED` 资格不可达。`PUBLIC_PU` gate 不变。

### 3.2 条件 2 依赖的 P3 / P6 证据现状

| 依赖 | 现状 | 证据 |
| --- | --- | --- |
| P2 probe 实施 | **未授权 / 未实施** | `docs/v7.8/移动-I03-phase2.md:230-233`（§12 Ledger：P2 空白 / 未授权）；map `Status: P1–P6 实施待各自增量授权`（`.scratch/level-playability-v1.1-i03-phase2/map.md:10`） |
| P3 独立复核 | **MISSING**：报告 `P3-probe-review.md` 不存在 | 查找路径 `.scratch/level-playability-v1.1-i03-phase2/reports/`（只有 `00-*` 与 `P1-*`）；固定路径要求见 `移动-I03-phase2.md:102` |
| P6 几何证据消费 | **未授权 / 未实施**；brief 已冻结（`issues/06-p6-ac14-consumption.md`），但前置为 P3 PASS + 用户签署（`:30`） | `docs/v7.8/移动-I03-phase2.md:230-233`；`06-p6-ac14-consumption.md:24-30` |
| P1 夹具 | **CLOSED，但不是 probe 证据**：14 正例 / 11 负例、manifest `dd880628…`、独立复核 PASS 12/12 | `reports/P1-review.md:12,65-78`；`reports/P1-signature.md:5-16`；`docs/v7.8/移动-I03-phase2.md:230` |
| 当前 AC-14 / AC-15 | required `AC-14 = NOT_RUN`；非 required `AC-15 = NOT_RUN` | `I03-acceptance.md:113-114,344-357` |

### 3.3 条件 5 的 C1–C17 覆盖矩阵

| # | 场景 | 现有证据（E1 源码 / E2 测试） | 判定 | 缺口 |
| ---: | --- | --- | --- | --- |
| C1 | 地面左右移动 | E1 `packages/demo/src/shell/scene.ts:89`（每帧 `setVelocityX`）；E2 `packages/demo/tests/shell-mechanic-witness.test.ts:24`（`run` needle） | **PARTIAL** | 只有源码 / 见证，不是 Phaser 逐帧探针 E3 |
| C2 | 空中水平控制 | E1 `scene.ts:89`：`setVelocityX(...)` 在 `update()` 内无条件执行，不依赖 `onFloor` | **PARTIAL** | 无探针逐帧记录；合同要求 E3 |
| C3 | 跳跃仅 `onFloor` | E1 `scene.ts:90-91`（`onFloor = body.blocked.down`；`if (jump && onFloor) setVelocityY(-m.jumpVelocity)`）；E2 witness needle `:25` | **PARTIAL** | 无探针验证「空中再按不产生 vy」 |
| C4 | y 轴输入 / 下穿不存在 | E1 `scene.ts:85-91` 只读 left / right / jump，无 down / y 输入 | **PARTIAL** | 只有源码阅读，无探针 |
| C5 | 二段跳 / 冲刺 / 墙跳 / 梯子不存在 | E1 `scene.ts:85-91`；`packages/contracts/src/vocabulary.ts:41`（单跳，无二段） | **PARTIAL** | 只有源码 / 词表；无探针 |
| C6 | walk-off 漂移 | E1 `scene.ts:89`（下落中仍每帧水平控制） | **PARTIAL** | 无探针弧线 / 逐帧记录 |
| C7 | moving solid 不作落点 | E1 `packages/demo/src/world.ts:104,114`（只把不带 `motion` 的 solid 当落点）；E2 `shell-mechanic-witness.test.ts:76-78`（moving-platform 为 `experimental`） | **PARTIAL** | 无运行时探针证明 solid 不移动 / 不落地 |
| C8 | y 轴 Hazard ⇒ `model-out` | E2 `playability-temporal.test.ts:144`（Y 轴 ⇒ IE + `model-out`）；`playability-temporal-input.test.ts:482` T-49 | **PASS** | 无 |
| C9 | 多个移动 Hazard ⇒ `model-out` | E2 `playability-temporal.test.ts:144`（多 mover ⇒ IE + `model-out`）；`playability-temporal-input.test.ts:490` T-50 | **PASS** | 无 |
| C10 | Danger + strike ⇒ `model-out` | E1 `packages/contracts/src/playability/temporal.ts:418`（`danger && strike ⇒ model-out`） | **MISSING（测试）** | 无直接测试；`U5-final-audit.md:158` 明示该分支未直接覆盖 |
| C11 | 门区高度 < 跳跃包络（可跳过）⇒ 条件 5 FAIL | 无 A 证明；`temporal-gate.ts:162-172` 只检查门宽 + Hazard 盒 y 区间与 spawn 盒**严格重叠**，不检查 `maxJumpHeight` | **MISSING** | A 垂直包容证明未实现；C11 负例不存在 |
| C12 | 门区覆盖跳跃包络 ⇒ 可 PASS | 无 A 证明；同 C11 | **MISSING** | 无 |
| C13 | 门区边缘空中绕行 ⇒ 弧线扫掠拒绝或证明不可行 | `reach.ts:190-205` 的 mid-air 采样是模型内 60Hz 保守保护；`temporal-evasion.ts:247` 只在 hop 采样中使用 `maxJumpHeight`；无 B 保守弧线扫掠证明 | **MISSING** | B 证明未实现；mid-air 只作否决，不是条件 5 正面证据 |
| C14 | 世界边界 / 无 physics bounds | E1 `reach.ts:199`（世界外采样点当自由空间）；E3 `.scratch/level-playability-v1.1-i02/evidence/04-graph-cut-hop.md:86`（小世界探针 17 个界外点被跳过） | **PARTIAL** | 需要 Phaser 探针实测；当前只有代码事实 / 小世界 scratch |
| C15 | 同环境重跑不一致 ⇒ IE | 确定性测试：`playability-temporal.test.ts:296,570`；跨进程 `.scratch/level-playability-v1.1-u5/evidence/04-cross-process.json`；但这些不是条件 5 探针的同环境重跑 | **PARTIAL** | 无探针重跑；无法判定 probe 环境一致性 |
| C16 | probe 未运行 / 证据缺失 ⇒ IE / `NOT_RUN` | 无 probe | **NOT_RUN** | 条件 5 只能 `NOT_RUN` / `BLOCKED` |
| C17 | `midAirHits=0` 当条件 5 正面证据 ⇒ 禁止 | E2 `playability-temporal-evasion.test.ts:232,445`；I-03 N12 PASS（`I03-acceptance.md:161`） | **PASS** | 无 |
| — | **A 垂直包容 / B 保守弧线扫掠** | 合同要求：`18-i03-pu-air-control.md:77-90`；产品无实现；`movementModelClosure` 恒 `not-proven-air-control`（`temporal-evasion.ts:147`、`temporal-evidence.ts:87`） | **MISSING** | A/B 证明、probe、E1/E2/E3、独立复核报告全部未产出 |
| — | **E3 probe / 独立复核 / 用户签署** | 合同要求 `18-i03-pu-air-control.md:121-128`；报告路径 `pu-air-control-closure-review.md`（不存在） | **MISSING** | 无 probe 输出、无 `SHA256SUMS`、无 fresh reviewer、无签署 |

**条件 5 小结**：C1–C7 只有 E1 源码 / 少量 E2，缺 E3 探针；C8/C9/C17 有测试；C10 仅源码；C11/C12/C13 缺失（A/B 证明未实现）；C14/C15 部分；C16 `NOT_RUN`；条件 5 整体 **MISSING**，不得记为 PASS。

---

## 4. 明确判断

| 问题 | 判断 | 依据行（摘要） |
| --- | --- | --- |
| **I-04 是否已有足够证据？** | **PARTIAL** | 负向与回归证据大量存在（§1：G-02/G-06/G-07 的 vitest 层、伪造几何、错误 lag、确定性、V1 全量回归均有强证据；I-03 全量 178 files / 2952 tests、LP-06/07 语义一致）。但：G-01 真实帧几何 ↔ Runtime body 依赖 P3（`I03-acceptance.md:113-114`）；G-03 页面 / 后台时间行为未测（`07-gate-matrix.md` G-03）；G-05 moving platform / danger strike 分支未直接测试（`U5-final-audit.md:29,158`）；G-07 只有 I-03 的 INCOMPLETE 验收（`I03-acceptance.md:344-357`）；19 关无误拒没有逐 config 发布闸扫描；LP-06/07 非 CI（`I03-acceptance.md:326`）。尚缺 I-04 自己的 fresh 验收报告与签署 |
| **I-05 是否至少 NB / PU / IE 各一例？** | **MISSING（时序能力口径）** | 19/19 moving hazard 的时序内部结果均为 `insufficient-evidence`（mover 层面 11 `goal-not-representable` / 6 `model-out` / 2 `spawn-not-on-lattice`；20 个 config 层面为 11/7/2；`U5-final-audit.md:47,128`；`06-performance.json`）。没有真实 `nb-candidate` 或 `pu-candidate`。真实 IE 案例充足（首选 `fixtures/game-configs/last-train.json`）。若按 V1 既有层内三态：NB（11 个 `NO_PROVEN_BLOCKER`）/ PU（3 个历史 `PROVEN_UNPLAYABLE`）/ IE（2 个）候选存在，但它们不由时序层产生。I-05 整体 **PARTIAL**：Pipeline 路径证据存在（publish-gate G1–G11、create/QA 测试），但缺 I-05 验收报告、真实时序 NB/PU 案例、最终收口报告 |
| **PU-C5 的 C1–C17 缺口** | **MISSING** | C8/C9/C17 PASS；C1–C7 只有 E1/E2、缺 E3 探针；C10 无直接测试；C11/C12/C13 的 A/B 证明未实现；C14/C15 PARTIAL；C16 `NOT_RUN`；C1–C17 全 required PASS + A/B + 独立复核 + E1/E2/E3 才能 PASS（`18-i03-pu-air-control.md:136`），当前条件 5 恒 `BLOCKED` |
| **PU 条件 2** | **MISSING** | `temporal.ts:500-503` 硬编码 `BLOCKED`；P2/P3/P6 未授权 / 未实施（`移动-I03-phase2.md:230-233`；`P3-probe-review.md` 不存在）；`AC-14` required `NOT_RUN`（`I03-acceptance.md:113`） |
| **PU 条件 1/3/4/6** | **PASS（仅合成 `PU_WORLD`）** | `playability-temporal.test.ts:233-240` 逐项断言 `gate-coverage / graph-cut / hop-doubling / lag-consistent = PASS`；源码 `temporal.ts:476-523`；U5 独立复核 A1（`U5-final-audit.md:114`）。**不等于 ADMITTED / OPEN** |

---

## 5. 限制、未能确认项与不要在盘点阶段推断的项

1. **未执行任何验收**：本盘点未运行 vitest、LP-06/07、probe、`pnpm build`、跨进程脚本；所有「PASS」都是对现有报告的转述，不是本会话现场复算。
2. **I-03 acceptance-run2 证据缺失**：`I03-acceptance.md` 引用的 `.scratch/level-playability-v1.1-i03-impl/evidence/acceptance-run2/`（`pnpm-test.log`、`lp-comparison.json` 等）在当前工作树不存在；只能引用报告中的 hash，无法复算。查找路径：`.scratch/level-playability-v1.1-i03-impl/evidence/`（仅 `U1/ U2/ U3/`）。
3. **票面来源清单与实际不一致**：`.scratch/level-playability-v1.1-i02/evidence/**` 中不存在 A–J、G1–G11、N1–N18、T-55–T-65、LP-06/07 的独立文档；A–J 在 `packages/contracts/tests/playability-temporal.test.ts`，T-55–T-65 在 `playability-temporal-input.test.ts`，N1–N18 / G1–G11 在 `.scratch/level-playability-v1.1-i03/reports/I03-acceptance.md`，LP-06/07 在 `.scratch/level-playability-v1-p1/`。本盘点已按实际位置引用。
4. **真实语料时序结果的状态是「早退 IE」**：19/19 未进入相位网格 / 搜索；因此不能从现有语料推断搜索预算、hop 采样、真实 NB/PU 的生产行为（`U5-final-audit.md:128-129,141`）。
5. **`21 configs` 与 `20 unique usable` 不可混用**：21 是 `uniqueHorizontalConfigs`；20 是 LP-06 可复判去重口径；19 是 20 中的 moving hazard 实体数（16 config）。
6. **`fixtures/game-configs/last-train.json` 是生产 fixture，不是「新建 fixture」**；它与 `out/__probe/last-train/site/v1/game-config.json` 同内容。I-05 若使用它，不违反 Q8；但若为了 NB/PU 改造它，则属于新建 / 修改 fixture，需单独授权。
7. **「无误拒」的定义未冻结**：I-04 票面要求「19 个 moving-hazard config 无误拒」，但当前证据只能证明 temporal 不参与放行（G10 / 源级测试）和 last-train 放行；没有 19 config × publish-gate 的扫描。不要在盘点阶段把「LP-06 全 IE」推断成「发布闸全放行」。
8. **PU 条件 1/3/4/6 的 PASS 不是公共 ADMITTED**：它们只在合成 `PU_WORLD` 上成立，且 `PUBLIC_PU` 恒 `BLOCKED`；不得据此推断任何关卡可 PU。
9. **条件 5 的 C1–C7 只有源码 / 见证，不是 E3**：`shell-mechanic-witness` 只证明「那一行存在」，不证明运行时逐帧行为；A/B 证明也未实现。不得把 C1–C7 的 E1 当作条件 5 能力证据。
10. **未确认项**：
    - P3 / P6 / P4 / P5 的实际实施状态（当前只有 brief / annex；无产品代码、无 P3 报告）。
    - 页面暂停 / 后台 RAF 派发次数（`07-gate-matrix.md` G-03 的 U1 未解除）。
    - Runtime body 与 manifest 帧几何的等式（AC-14 未闭合）。
    - LP-06/07 在 CI 中的行为（它们不在 CI）。
11. **不要在本阶段推断**：
    - 不要把 `NO_PROVEN_BLOCKER` 当成「可玩保证」；也不要把 `INSUFFICIENT_EVIDENCE` 推导成 NB / PU。
    - 不要把「测试存在」等同于「I-04 已验收」；不要把 I-03 的 INCOMPLETE 验收当成 I-04 的 PASS。
    - 不要因为 I-05 有真实静态三态候选，就推断时序能力已覆盖 NB / PU。
    - 不要在盘点阶段决定是否新建 fixture；该决定归 `05-i05-brief` / 用户授权。

---

## 6. 候选单元 / 证据落点（只建议，不裁定）

| 缺口 | 候选单元 | 建议证据落点（未来单元决定） |
| --- | --- | --- |
| I-04 负向矩阵汇总、19 config 发布闸扫描、G-01/G-03/G-05 补证、V1 回归 fresh 复跑 | **I-04** | `.scratch/level-playability-v1.1-closure/evidence/I04-*.md`；逐项 `PASS/FAIL/NOT_RUN` 报告 |
| I-05 真实案例、create/build/publish-gate/qa-report 证据、最终报告 | **I-05** | `.scratch/level-playability-v1.1-closure/reports/V1.1-closure.md`（票面固定路径）+ 逐案例证据目录 |
| 条件 5 C1–C17、A/B 证明、Phaser 探针、E1/E2/E3、独立复核 | **PU-C5** | 按 `18-i03-pu-air-control.md` 的 `pu-air-control-closure-review.md` 路径与 `SHA256SUMS` |
| 六条件 ADMITTED 资格（消费 1/3/4/6 + 条件 2 的 P6 + 条件 5 的 PU-C5） | **PU-ADMIT** | PU-ADMIT 报告；逐项 `PASS/BLOCKED/IE/NOT_RUN`；不改 gate |
| 条件 2 几何证据生产 | Phase-2 **P2 / P3 / P6**（前置单元，不属本图执行） | `.scratch/level-playability-v1.1-i03-phase2/reports/P3-probe-review.md`；P6 证据目录 |
| 新建时序 NB / PU 真实 fixture（若 I-05 需要） | **独立 fixture 授权票**（不在 I-05 内） | 需用户 / R2 单独批准；不得由 I-05 自行新建 |

---

## 7. 引用索引（本盘点实际读取的关键文件）

- `docs/v7.8/移动.md:198-252,399-420,514-523`
- `docs/v7.8/移动-I00.md:135-143,194-202,219`
- `docs/v7.8/移动-I03.md:72-79,730-747,836-861,1046`
- `docs/v7.8/移动-I03-phase2.md:91-106,139-188,225-233`
- `.scratch/level-playability-v1.1-integration/evidence/07-gate-matrix.md`（G-01～G-07）
- `.scratch/level-playability-v1.1-integration/evidence/09-implementation-plan.md`（I-04 / I-05 / Q2）
- `.scratch/level-playability-v1.1-i03/issues/18-i03-pu-air-control.md`（C1–C17 / A / B / E1–E3）
- `.scratch/level-playability-v1.1-i03/reports/I03-acceptance.md:95,100-123,148-166,178-189,210-246,326-330,344-357`
- `.scratch/level-playability-v1.1-i03-phase2/reports/P1-review.md:12,65-78`；`P1-signature.md:5-16`
- `.scratch/level-playability-v1.1-i03-phase2/map.md:10`；`issues/06-p6-ac14-consumption.md:24-30`
- `.scratch/level-playability-v1.1-i02/evidence/01-code-facts.md:52,381-395`；`05-performance.md:53`；`04-graph-cut-hop.md:86`
- `.scratch/level-playability-v1.1-i02/reports/U5-completion.md:76,89,115`；`U5-final-audit.md:29,47,114,128-130,141,158`
- `.scratch/level-playability-v1.1-u5/evidence/06-performance.json`；`04-cross-process.json`
- `.scratch/level-playability-v1-p1/evidence/06-corpus-regression.json`；`06-matrix-acceptance.json`；`06-corpus-acceptance.md`
- `packages/contracts/tests/playability-temporal-input.test.ts`；`playability-temporal.test.ts`；`playability-temporal-evasion.test.ts`；`playability-temporal-gate.test.ts`；`playability-temporal-witness.test.ts`；`playability-temporal-evidence.test.ts`；`playability-public-verdict.test.ts`；`playability-mechanic.test.ts`
- `packages/contracts/src/playability/temporal.ts`；`temporal-gate.ts`；`temporal-evasion.ts`；`temporal-evidence.ts`；`temporal-result.ts`；`reach.ts`；`profile.ts`
- `packages/assets/src/ops.ts:1073-1160`；`packages/assets/tests/ops.test.ts:334-443`
- `packages/pipeline/src/create-game.ts:620-720`；`packages/pipeline/src/publish-gate.ts:130-200,240-280`；`packages/pipeline/tests/create-game.test.ts`；`packages/pipeline/tests/publish-gate.test.ts`
- `packages/mcp/tests/assemble-site-qa-gate.test.ts`；`packages/mcp/tests/create-game-qa-failure.test.ts`
- `packages/demo/src/shell/scene.ts:85-91`；`packages/demo/src/world.ts:104,114`；`packages/demo/tests/shell-mechanic-witness.test.ts:24-25,76-78`
