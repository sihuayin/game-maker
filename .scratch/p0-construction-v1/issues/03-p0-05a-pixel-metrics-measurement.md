# 03. P0-05a · 像素指标免费测量与阈值提案

Type: task
Status: claimed
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

## Answer（提案已出 · 等待用户裁定）

**测量完成、提案已交，按票面要求停住**（Q7 A：阈值由人逐字裁定，04 才落实现）。
本票不落地任何阈值代码；`Status` 保持 open（claimed），等裁定后由票 04 承接。

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
