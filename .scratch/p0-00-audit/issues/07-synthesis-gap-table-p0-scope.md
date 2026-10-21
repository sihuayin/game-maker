# 07. 综合：能力差距表与 P0 范围

Type: grilling
Status: resolved
Owner: claude（2026-10-21 认领 · grilling · 综合）
Claimed: 2026-10-21
Resolved: 2026-10-21
Blocked by: 01, 02, 03, 04, 05, 06
Map: ../map.md

## Question

汇总 01–06 的证据，产出 `docs/v4/` 五件套：

1. `P0-00-capability-gap-audit.md`：完整能力差距证据表。
2. `P0-00-call-graph.md`：真实调用链与产物路径。
3. `P0-00-test-matrix.md`：现有测试、缺失测试与 fixture 覆盖矩阵。
4. `P0-00-e2e-evidence.md`：真实运行命令、产物路径、结果与截图 / 对照材料索引。
5. `P0-00-p0-scope.md`：后续 P0 需求的分流与范围裁定。

要求（第一轮 Q1 / Q8）：

- 不修改实现代码；只写文档。
- 每条存活缺口按任务书 §4 / §6 全字段：ID、能力、状态、源码证据、调用链、测试证据、
  真实产物证据、缺口、影响、建议归属、验收条件；分流为复用 / 修正 / 新增 / 补测 / 补文档 / 暂缓。
- 给出推荐执行顺序、依赖、以及「明确不应修改的范围」。
- 未进入最短交付路径的缺口一律「暂缓」并写理由。
- 视觉 Q1 / Q2 已由 [08](08-visual-comparison-rulings.md) 裁定：整体可接受（Q1 = a）；
  局部缺口 = `ceiling-lurker` 剪影可读性、`extraction-point` 像素尺度与材质分块（Q2 = b）；
  `wasteland-enemy` 不定性为漂移。按影响 / 修复成本排序，**不默认全量重生成**。
- 整体可接受 **不等于** 视觉 QA 已具备自动判断风格一致性的能力；W4 的结论不变。
- 危险物掉穿地面（W6-G1）独立保留为高优先级候选，不被视觉裁定覆盖。
- 五件套交叉引用校验通过后，再向用户申请一次性提交授权（Q6）；未获授权则留工作树。

## 验收

任务书 §9 Definition of Done 全部满足；每条结论有证据强度（E0–E3）；
不宣称 HEAD E2E 已通过；不新增未批准的 Schema / CLI / Pack 契约。

## 边界

- HITL：P0 分流与优先级由用户裁定；代理只准备证据与建议。
- 不改 `packages/**`、Schema、CLI/MCP、Pack 目录；`CONTEXT.md` 只在裁定出新术语时改词条。

## 产出

`docs/v4/` 五件套 + 本票 `## Answer`（逐字记录用户裁定）。

## Answer（2026-10-21 · grilling/HITL · 用户裁定后收口）

### 用户裁定（逐字）

> 裁定：Q1–Q10 全部选择 (a)，接受十项推荐。
> 本轮只确定后续 P0 的范围与验收口径，不实施修复。具体代码改动由后续 P0 施工票执行；
> 任何付费 E2E 均须另立票、提交书面预算并获得逐次明确授权。

| 问题 | 最终裁定 | 核心边界（逐字） |
|---|---|---|
| Q1 P0 判定口径 | (a) | 严格围绕「阻断目标」与「假成功」；质量、诊断和维护类问题原则上分流至 P1/P2 |
| Q2 可玩性验收 | (a) | P0 增加最小 headless 浏览器 smoke：启动站点、注入移动/跳跃、验证拾取与胜利可达 |
| Q3 视觉一致性 | (a) | 对已有像素完整性指标设置可回归阈值；参考图风格相似度留 P1 |
| Q4 发布闸门 | (a) | 所有发布路径必须验证当前包的 QA；补齐 6/6 判据；error 和 incomplete 均阻断发布 |
| Q5 设计语义 | (a) | P0 修复 objective.gate 假胜利与危险物软锁；多关、完整胜负原语及通用 motion 暂不纳入 |
| Q6 资源生产路线 | (a) | 修复 frames 静默折叠；import 维持暂缓；六类语义路由另行规划 |
| Q7 资产完整性 | (a) | design→recipe 覆盖闸、verifyPack 入链、空色板前移，三项均纳入 P0 |
| Q8 付费 E2E | (a) | 修复后另立付费票，作为 P0 最终验收门；未完成时不得无条件宣称 P0 全部验收通过 |
| Q9 CLI/MCP 等价 | (a) | 修复错误翻译、stylePath 相对化及 QA 失败测试；TD/review/并发参数等价留 P2 |
| Q10 基线漂移 | (a) | 五件套统一记录审计基线 ea53240，列明至 7aa98d7 的增量，并标注受影响结论 |

### 交付物（`docs/v4/` 五件套）

1. [P0-00-capability-gap-audit.md](../../../docs/v4/P0-00-capability-gap-audit.md) —— 55 条能力差距
   （13 P0 / 21 P1 / 21 P2），每条含状态、源码、调用链、测试、真实产物、缺口、影响、分流、验收条件；
   含字段消费总览、QA 8 维矩阵、阻断规则、v3 基线复核、W1–W6 覆盖对账、unknown 清单。
2. [P0-00-call-graph.md](../../../docs/v4/P0-00-call-graph.md) —— CLI/MCP 主链、13 阶段产物表、
   版本规则、退出码与失败现场、入口差异、RuntimeProfile 边界、基线漂移。
3. [P0-00-test-matrix.md](../../../docs/v4/P0-00-test-matrix.md) —— 11 类矩阵（3 existing /
   5 needs strengthening / 3 missing）、逐类证据、缺失 fixture（P1–P6 / N1–N6 / B1–B9）、
   可复现性风险、P0 测试映射。
4. [P0-00-e2e-evidence.md](../../../docs/v4/P0-00-e2e-evidence.md) —— 归档真跑 a–d、commit 漂移、
   HEAD 零付费重放（3/3 pickup · won=true）、危险物软锁复现、归档站点不可玩、QA vs 实际观察、
   W6 六项人工检查 + 08 视觉裁定、证据索引。
5. [P0-00-p0-scope.md](../../../docs/v4/P0-00-p0-scope.md) —— 10 条裁定逐字、P0 定义与非目标、
   6 个 P0 工作包 + P0-FINAL、依赖与顺序、完成判据、P1/P2/暂缓、付费 E2E 规则、授权边界、风险登记。

### 交叉引用校验

| 检查 | 结果 |
|---|---|
| `docs/v4` 内相对链接 | **0 条断裂**（五件套共 58 条相对链接逐条解析） |
| CAP ID 唯一性 / 引用 | **55 个唯一 ID；无非定义引用**（`CAP-ENTRY/SPEC/ASSET/QA/TEST/RUNTIME/E2E`） |
| 优先级计数 | **13 P0 / 21 P1 / 21 P2**，与 P0 范围文档一致 |
| W1–W6 覆盖对账 | 每个来源缺口 ID 均映射到 CAP ID 或明确标注「不构成缺口」 |
| `pnpm test`（HEAD `7aa98d7`） | **110 文件 / 1731 例，exit 0** |
| `pnpm typecheck` | **exit 0**（9 个项目全部 Done） |
| `pnpm build` | **exit 0** |
| `pnpm check:deps` | **exit 0**（9 个包） |
| `pnpm check:links` | **仅 2 条既有 `.scratch/asset-integration-v1` 断链**（非本次引入；Q8 禁止碰既有 `.scratch`，未修） |

既有断链（与 Phase 1 地图记录一致）：

- `.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/palette-curation.md:21`
- `.scratch/asset-integration-v1/runs/2026-10-21c-screening/budget-report.md:8`

### 基线漂移（Q10）

- 证据基线：`ea53240`（2026-10-20）。
- 写作时 HEAD：`7aa98d7`（2026-10-21）。增量：Phase 1 Tier 1 新增 `accept` CLI / MCP
  `accept_asset_pack`（CLI 10 → 11 命令，MCP 7 → 8 工具）；修复两处测试类型错误
  （`pnpm typecheck` 由基线 exit 2 → 当前 exit 0）；主链、退出码、产物路径未变。
- 五件套均标注基线，并在受影响处单独标注（测试矩阵 §0、调用链 §8）。

### 边界遵守

- **只写文档**：`docs/v4/` 新增五件套；本票 `## Answer`；地图更新。未改实现 / 测试 / 契约 /
  Schema / CLI / MCP / Pack / 配置。
- **零付费**：未运行任何生图 / 文本 / 视觉调用；未运行 `create/build/plan/pack/compile-*/site/review` 真实链。
- **未提交 / 未推送**：`docs/v4/` 五件套与地图/票改动留在工作树，等待**单独**提交授权（第一轮 Q6）。
- **未碰** `CONTEXT.md`、`game-maker.local.json`、无关 `.scratch` 旧 run。
- **未把 P0 范围裁定当作施工授权**：P0-01…P0-06 由后续施工票执行；任何 Schema / CLI / MCP / Pack
  变更须在施工票逐项列出并单独获批。

### 偏差 / 注意事项

1. `CAP-SPEC-17` 的「空色板前移」只能前移到**下游付费调用之前**；色板本身由 `analyzeReference`
   那一发产出，不可能在该发之前拒绝。P0 范围与能力差距表已按此口径写明。
2. `frames` 的 P0 修法推荐「明确失败」；「参数化保留 `frames`」是更大的改动，已在 P0-06 中列为备选，
   由施工票选择，但验收都要求「不得静默折叠 + sidecar 记录真实候选」。
3. P0-02 的发布闸门若需要新增 CLI flag / MCP 参数 / 契约字段才能拿到 QA 报告，必须在施工票逐项列出并
   单独获批；本审计没有做任何这类改动。
4. 归档 `run-out-2026-10-17d` 缺 `asset-recipe.plan.json`（早于 HEAD 行为），已在调用链 §9 与
   E2E 证据中标注为 E3 漂移，未据归档否定 HEAD。
5. 本票只收口审计；P0 施工与付费 E2E 是**新的 effort**，不在本图继续。

### 收口

- 07 resolved；`docs/v4/` 五件套完成并通过交叉引用校验；P0 范围为 13 条，施工包 6 + 最终付费门 1。
- 地图 `Decisions so far` 追加本票；`Not yet specified` 清空并标注后续是新 effort。
- **停在等待提交/推送授权状态**。
