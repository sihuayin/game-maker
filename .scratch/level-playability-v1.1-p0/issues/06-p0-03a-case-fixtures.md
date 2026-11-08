# P0-03a 合成案例与 scratch 站点

Type: task
Status: resolved
Owner: agent（AFK）· 2026-11-07
Blocked by: 01
Map: ../map.md

## Question

构造 A/B/C 三个受控合成案例，并用 `fixtures/packs/last-train` 生成可在真实 Runtime 中运行的 scratch 站点。本票只准备案例与运行器输入，不做判断，不写分析结论。

### 案例定义

| 案例 | 场景 | 预期 |
|---|---|---|
| A | 移动 Hazard 周期经过通道；玩家可以等待后通过 | 分析器识别安全窗口；真实 Runtime 中玩家等待后通过且未被命中 |
| B | 移动 Hazard 始终封锁唯一通道 | 只有当算法能**证明**不存在合法通过路径时才判不可玩；有限试玩失败不算证明 |
| C | 时间相位或碰撞边界无法可靠确定 | 分析器返回 `INSUFFICIENT_EVIDENCE` |

### 必须交付

- `cases/a/`、`cases/b/`、`cases/c/`：每个案例的 `game-config.json`、预期说明、以及与现有 `fixtures/packs/last-train` 的绑定方式。
- `evidence/03a-sites.md`：站点构造命令、退出码、站点 / 包路径、校验和；证明没有修改既有 fixture / 历史配置。
- 使用现有 playtest harness 的场景 JSON（必要时用 `setup.kind = "mutate-hazard"`）；**不新增站点观察字段**。
- C 案例只需分析器输入；不强制构造 Runtime 站点。

### E3 可复现交付（P0-01R 裁定）

P0-03a 建站时必须提供**可重复执行的只读扫描脚本**（落盘到本 effort 目录），并重新记录：

- hazard 总数与 moving 数量；
- frames 数量；
- `badSize`、`badAnchor`；
- 速度区间；
- 扫描范围、输入基线 SHA 和脚本版本。

新扫描结果与 [`../evidence/01-moving-hazard-semantics.md`](../evidence/01-moving-hazard-semantics.md) 的原数字不一致时，**必须解释差异**，不得静默覆盖旧报告。

### 边界

- 不改 `fixtures/**`、`run/**`、`pack/**`、`site/**`；所有新产物写入本 effort 目录。
- 不调用模型、不生图、零付费。
- 若 A/B 在现有 harness 下无法取得必要证据，停止并提交 P0-03R 裁定，不得静默扩展 harness。

## Answer

**2026-11-07 完成（agent，AFK）。** 只准备案例、站点、分析器输入与 harness 场景；未做 P0-03 的案例判断，未修改 Runtime / 生产判据 / 既有 fixture。

| 交付 | 结果 |
|---|---|
| A 案例 | [`../cases/a/`](../cases/a/)：`game-config.json`、两份分析器输入（16.67 / 200ms）、`scenario/case-a.json`、预期说明 |
| B 案例 | [`../cases/b/`](../cases/b/)：`game-config.json`、两份分析器输入、`scenario/case-b.json`、永久封锁门 `[548,592]` 的预期说明 |
| C 案例 | [`../cases/c/`](../cases/c/)：`phase-unknown` / `hitbox-unverifiable` 两份分析器输入；不强制站点 |
| scratch 站点 | `cases/a/site-out/p0-03a-case-a/site/v1`、`cases/b/site-out/p0-03a-case-b/site/v1`；均 site v1 / shell v2 / pack v2，`warnings=[]` |
| 建站工具 | [`../tools/build-cases.mjs`](../tools/build-cases.mjs)（`p0-03a-build-cases/1`） |
| E3 复扫工具 | [`../tools/e3-rescan.mjs`](../tools/e3-rescan.mjs)（`p0-03a-e3-rescan/1`），只读；产物 [`../evidence/03a-e3-rescan.json`](../evidence/03a-e3-rescan.json) |
| 分析器自检 | [`../tools/analyze-cases.mjs`](../tools/analyze-cases.mjs)；产物 [`../evidence/03a-fixture-smoke.json`](../evidence/03a-fixture-smoke.json) |
| 证据报告 | [`../evidence/03a-sites.md`](../evidence/03a-sites.md) + [`../evidence/03a-sites.json`](../evidence/03a-sites.json) |

### 命令与退出码

| 命令 | 退出码 |
|---|---|
| `pnpm build` | 0 |
| `node .scratch/level-playability-v1.1-p0/tools/build-cases.mjs --force --json > .scratch/level-playability-v1.1-p0/evidence/03a-sites.json` | 0 |
| `node .scratch/level-playability-v1.1-p0/tools/e3-rescan.mjs --out .scratch/level-playability-v1.1-p0/evidence/03a-e3-rescan.json --json` | 0 |
| `node .scratch/level-playability-v1.1-p0/tools/analyze-cases.mjs --out .scratch/level-playability-v1.1-p0/evidence/03a-fixture-smoke.json --json` | 0 |
| A playtest 夹具冒烟（`--repeat 2`） | 0 |
| B playtest 夹具冒烟（`--repeat 2`） | 0 |

### 关键结果

- **建站**：A/B 均通过三族 + 几何 + HUD 屏幕空间校验；包从 `fixtures/packs/last-train/v2` 拷贝，建站前后
  manifest `sha256:145cb28d…` 与文件树 `sha256:2967338…` 不变；`git status --short -- fixtures` 为空。
- **E3 复扫**：21 unique configs / 31 hazards / 19 moving / 0 body / 18 anims / 19 asset resolutions / 121 frames /
  `badSize=badAnchor=0` / 速度 `0.02667–0.13846 px/ms`，与 P0-01 §0.2 **逐项一致**，无差异需解释。
  扫描输入 inventory `sha256:ba1d051a…`，基线 `main @ fa17c14`，脚本版本 `p0-03a-e3-rescan/1`。
- **hitbox 来源**：A `prop-luggage-pile` 1 帧、B `hazard-sweeping-carriage` 2 帧，帧 `sourceSize` / `anchor`
  均等于复制包 manifest；来源可追溯到当前 accepted pack 拷贝。
- **harness 可行性冒烟**（不是验收证据）：A 两次均 `won=true` / `reset=0` / `collected=1`；
  B 两次均 `reset=5` / `won=false` / `stop.reason=reset-exhaustion`；`--repeat 2` 投影一致。
  结论：A/B 在现有 harness 下可以取得必要证据，不需要新增观察字段；无需 P0-03R 提前裁定。
- **分析器夹具自检**：A 两档 lag 均 `NO_PROVEN_BLOCKER`；B 两档 lag 均 `PROVEN_UNPLAYABLE`（门 `[548,592]`）；
  C 分别 `phase-uncertain` / `hitbox-uncertain` → `INSUFFICIENT_EVIDENCE`。
  注意 A 的冻结 witness 是低速前进而非静止等待，P0-03 必须在真实 Runtime 演示等待窗口。

### 边界

- 未修改 `fixtures/**`、`run/**`、`pack/**`、`site/**`、`packages/**` 源码；未新增依赖；零付费；未推送 / 合并。
- 站点、工具与证据全部落 `.scratch/level-playability-v1.1-p0/`。
- 冒烟未记录 P0-03 要求的最终 `lagMs`、安全余量与正式 hitbox / lag 审计，**不得**作为确定性结论的验收证据。

### 提交与回退

- 本票工作提交：`34e053e2804e482d2c7e5e38c137c7609a16d405` — `P0-03a: synthetic A/B/C cases, scratch sites, and reproducible E3 rescan`
- 回退点：本票开始前 HEAD `920d225d0faed3ca320b48d2216e92edabd2a1a0`。
