# 08. 真实 E2E 验收（走整条 create 主链）

Type: task
Status: open
Owner: —
Blocked by: 06, 07
Map: ../map.md

## Question

用 fixtures 废土风格图 + 意图走**现有 `create` 链**跑一条真实 E2E，作为本图终点（Q1=b）的验收证据。**不是只调
`compiler`，而是整条主链**（用户约束 #3）。

- **输入**：`fixtures/e2e/wasteland-platformer/style.png` + `intent.md`（sha256 与 `p0-final-v1` W6 同款，跑前核对哈希）。
- **链**：`create` → `visual-world` → `intent` → `design` → `character-dna` → **`visual-design`（本图新增）** →
  `recipe` → `pack` → `config` → `qa`。
- **必查产物（约束 #3 全项）**：
  1. 包注册 + 依赖方向（`pnpm check` / `check:deps` 不破）；
  2. GameDesignSpec → VDS 的**真实输入连接**（不是合成数据）；
  3. `run/vN/visual-design.json` + `visual-design/scene.svg` + `visual-design/preview/scene.png` + `qa-report.json` 落盘；
  4. VDS↔GameConfig 交叉验证（第 7 判据）实际执行且 `role↔kind` 一致；
  5. run 版本号 + 原子提交行为（`commitRun` 单次 rename；失败不占号）。
- **记录证据**（`p0-final-v1` 同款）：命令 + 退出码 + run/pack/site 路径 + ledger/成本 + QA 报告 + 截图 + 失败与重试。
- **付费闸（HITL）**：`create` 链含**付费 LLM 调用**（`analyzeReference`/`compileDesign`/`planAssets`/`compileRuntime`）。
  先出**书面预算**（Stage 数、请求上限、费用上限、墙钟），**逐字授权**后才跑；本票 `Status: open`，动手要另一次点头。
- **失败处置**：失败即保存现场（`.scratch/visual-design-impl-v1/runs/…`）、登记缺口；**不得把失败重试成成功**。

结论落 `## Answer`：成功 ⇒ 可宣告「V1 单跑 E2E 已验证」；失败 ⇒ 登记真实阻塞，不掩盖。
