# 03. P0-05a · 像素指标免费测量与阈值提案

Type: task
Status: resolved
Owner: main session · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

在**不写实现**的前提下，把 `inspectPack` 已算的像素完整性指标测出分布，给出一份可裁定的阈值提案。
对应 `CAP-QA-02`，口径见 `docs/v4/P0-00-p0-scope.md` §3 P0-05。

1. 对既有包跑只读 `inspect`（v7、`fixtures/packs/last-train/v2`、counter-siege 等实际存在的包，
   以及任何团队已接受的 baseline），记录每个指标的分布：色板外像素、源图→目标长宽比、
   背景层覆盖率（以实际 available 的指标为准）。
2. 每项指标给出：建议阈值、选择理由、误伤样本（正常动画帧间差异）、漏放样本
   （已知坏例：`player-scavenger.run` 长宽比差 **+52.4%**、v7 `health-icon` **41 个色板外像素**）。
3. 明确哪些指标风险高、P0 只选低风险指标；其余继续作 observation 并写清。
4. 边界值：刚好在阈值内 / 外的样例。
5. 产出提案后**停住**，交用户逐字裁定（Q7 A）；本票不落地任何阈值代码。

## 验收

- 分布表：指标 / 样本包 / 样本数 / min / p50 / max / 已知坏例位置。
- 阈值提案：指标 / 建议阈值 / 理由 / 误伤例子 / 漏放例子 / 边界样例。
- 证据文件 `.scratch/p0-construction-v1/research/pixel-metrics-distribution.md`。
- 命令、退出码、输入包只读证据（运行前后 sha256 / mtime 未变）。
- 零付费；不写 `out/` 生成链。

## 边界

- 只读 `inspect`；不调用付费视觉模型 / `review`；不改 `inspectPack`、不改 QA、不改契约。
- 不改 v7 包与 `fixtures/`；不提交。
- 裁定表必须逐项可勾选（每个指标一行）。

## 产出

`## Answer`：提案摘要 + 指向证据文件；**`Status` 保持 open**，等用户裁定后由 04 承接。

## Answer（提案已出 · 裁定已出，见文末）

**测量完成、提案已交，按票面要求停住**（Q7 A：阈值由人逐字裁定，04 才落实现）。
本票不落地任何阈值代码；裁定已于 2026-10-21 给出（原文见文末「裁定」）。
✅ 按用户单独授权，**本票于 2026-10-21 关票**；票 04 待开工（尚未实施）。

### 语料与只读证据

- 7 个可用包：v7（已验收）、`last-train/v2`、`counter-siege/v4`、e2e 10-17d、e2e 10-18a、
  10-19j、10-19k；共 **89 个资产样本 / 47 条长宽比样本 / 17 层覆盖样本**。
- 3 个旧 `assetpack/v3` 包（`out/shift-change-mixed/v7`、`out/last-train/v17`、e2e 10-13h）
  `inspect` exit 4（schema 旧），**不参与分布**；这是既有兼容事实，不是本票引入。
- 运行前后对 7 个包 **605 个文件**做 `sha256 + size + mtimeMs` 快照：**零漂移**。
- 命令：`game-maker inspect <pack> --json` ×10（7 次 exit 0 / 3 次 exit 4，后者为旧包）；零付费。

### 关键读数

| 指标 | n | min | p50 | max | 已知坏例 |
|---|---|---|---|---|---|
| 色板外 share / 资源 | 89 | 0 | 0（非零样本 p50 7.99%） | **16.02%**（v7 `health-icon` 41/256） | v7 `health-icon` 41 px；counter-siege `tile-wall` 29 px（12.89%） |
| 长宽比 \|ΔAR\| | 47 | 0 | 1.59% | **107.79%**（10-17d `enemy-wasteland.patrol`） | `player-scavenger.run` **+52.4%**；背景四层 **+103.2%** |
| 背景层覆盖率 | 17 | **17.43%** | 81.74% | 100% | — |

- `last-train/v2` 与 `counter-siege/v4` **没有 `sourceSizes`**（包内无 authoring 位图）⇒ 长宽比
  指标 **unavailable**，票 04 必须记「没跑」而不是绿。

### 阈值提案（详见证据文件）

1. **长宽比**：建议 `|ΔAR| ≥ 25% ⇒ error`（低风险）。已验收且有数据的包最大 2.70%；
   正常帧间差异 ≤ 9.1%；+52.4% / +103.2% / +107.8% 全中。边界建议 24.9% / 25.0% 两条 fixture。
2. **色板外**：**票 04 的「v7 通过」与「抓住 health-icon」不可兼得**，须人裁定：
   - **A（推荐 · 低风险）**：`share ≥ 25% 且 pixels ≥ 16 ⇒ error`；7 个包全过；health-icon 与 tile-wall 漏放（作 observation）。
   - **B（严格）**：`share ≥ 10% 且 pixels ≥ 16 ⇒ error`；抓住两件已知坏例，但 **v7、counter-siege v4、10-19j 会失败**。
3. **背景层覆盖率**：建议 **P0 不设 QA 阈值**，保持 observation —— 装配期 `auditLayerCoverage` 已有硬判据，
   票 08 的 `layer-coverage` 又是第 6 条 QA 判据；再加一条是第三个判据，且语料没有能区分好坏的数字。

逐项裁定表见证据文件 §5。**裁定后请逐字回复四项决议**，票 04 据此落地。

### 证据

- 提案与全部分布：`research/pixel-metrics-distribution.md`
- 原始数据与只读快照：`runs/2026-10-21-ticket-03/`（`raw/` · `measurements.json` · `readonly-check.json` · `measure.py`）

## 裁定（2026-10-21，用户逐字 · 原文）

> 以下为用户的书面裁定原文，未改写、未摘要。

本轮裁定如下，可直接记录到票 03 的 Answer。本次选择 A+，而不是 A：阻断阈值保持保守，同时让已知坏例在 QA 报告中可见。

| # | 问题                | 我的裁定                             |
| - | ----------------- | -------------------------------- |
| 1 | 长宽比阈值             | A：采用 25%，背景层不豁免                  |
| 2 | 色板外像素             | A+：25% 为 error，10% 为 observation |
| 3 | 背景层覆盖率            | A：保持 observation，不新增 P0 数值阈值     |
| 4 | `sourceSizes` 不可用 | A：标记 unavailable（没跑），不得记绿        |

### 依据与边界（原文记录）

#### 裁定依据与边界（2026-10-21）

1. **长宽比：采用 25% 阻断阈值。** 对全部 `sourceSizes` 条目生效，包括背景层、母版、精灵和动画，不豁免背景层。`|ΔAR| >= 25%` 产生 `error`；`24.9%` 不触发，`25.0%` 触发。无可用 `sourceSizes` 时不得判绿。
2. **色板外像素：采用 A+，不采用 B。** `share >= 25% && pixels >= 16` 产生 `error`；`share >= 10% && pixels >= 16` 产生 `observation`。`15/16 px` 与 `24.9%/25.0%` 必须有边界 fixture。对于 observation 阈值，还必须覆盖 `9.9%/10.0%` 边界。小于 10% 的样本不由本规则产生 observation；不足 16 个不透明像素的样本不由本规则产生 error 或 observation。
3. **已知坏例的明确处置。** `health-icon` 的 16.02% 色板外像素与 `tile-wall` 的 12.89% 色板外像素不会因本规则阻断发布，但必须作为 observation 可见。这是对 P0-00 §3「至少覆盖已观测到的真实坏例（+52.4%、41 像素）」中“41 像素”风险项的明确降级：该风险保留在报告中，作为 observation / P1 收紧对象，不作为 P0 阻断条件。本裁定不豁免长宽比已知坏例；`+52.4%`、`+103.2%`、`+107.8%` 仍应触发 error。
4. **背景层覆盖率：不新增 P0 数值阈值。** 该指标保持 observation，不独立阻断发布。现有装配期 `auditLayerCoverage` 和票 08 的 `layer-coverage` QA 判据继续承担相应验收责任，不以重复阈值替代既有判据。
5. **unavailable 不等于通过。** 包内没有可用 `authoring` 位图时，长宽比指标报告为「没跑（unavailable）」，不得记为通过、不得计入绿色通过数。`last-train/v2` 和 `counter-siege/v4` 属于已知需要明确呈现该状态的样本。
6. **票 04 实施边界。** 阈值应集中定义一处，注明来源为本票裁定，并添加对应边界 fixture。未获裁定的其他指标不得新增阻断阈值。票 04 只能落地本裁定，不得借机扩大到其他 QA、发布策略、契约或依赖变更。

### 票 04 的验收条件

- 长宽比：`24.9%` 不触发 error；`25.0%` 触发 error；背景层同样适用。
- 色板外像素：覆盖 `24.9% / 25.0%`、`15 / 16 px`，以及 `9.9% / 10.0%` 的 observation 边界。
- `health-icon` 与 `tile-wall` 在 QA 报告中产生 observation，但不因此阻断发布。
- 背景层覆盖率不新增 P0 阈值。
- unavailable 明确显示「没跑（unavailable）」，不得计绿。
- 阈值集中定义一处，并保留测试和报告证据。

状态说明： 这是书面裁定，不代表仓库中的票 03 已实际关闭或票 04 已解锁、实施。执行这些操作仍需在仓库中核验；本轮不修改代码、不运行命令、不产生付费调用。

---

**台账状态（本会话 2026-10-21）**：裁定原文已记入本票；按用户**单独授权**，**票 03 于 2026-10-21 关票**
（`Status: resolved`），地图 `Decisions so far` 已追加索引、像素阈值 fog 已清除。**票 04 尚未开工 / 实施。**
本轮未改代码、未运行命令、未产生付费调用。
