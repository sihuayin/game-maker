# 08. 真实 E2E 验收（走整条 create 主链）

Type: task
Status: resolved
Owner: claude (2026-10-25 · resolved)
Blocked by: 06, 07
Map: ../map.md

> ⚠️ **2026-10-25 · E2E 试跑（flash）失败，停在 design（阻塞）**：`create --yes` 跑到 compile-design，
> 3 发全失败（`empty-input`/`schema`/`empty-input`）；`requestedModel=deepseek-v4-pro` 但
> `model=deepseek-flash`（降级坐实）。票 13 的 `EMPTY_INPUT_ATTEMPTS=6` **只覆盖 `planAssets`**，
> compileDesign 仍是 `STRUCTURED_CALL_ATTEMPTS=3`。**0 生图、0 VDC 产物**（未到 visual-design 步）。
> 成本：text ≈ $0.002（probe $0.000135 + visual-world + intent + design×3），生图 $0。现场：
> `.scratch/visual-design-impl-v1/runs/2026-10-25-e2e/.failed-2026-10-25T04-47-29-355Z/`。
> **结论**：flash 不能跑 design 大 schema；必须 v4-pro（cc-switch 改模型）或另一 provider。票保持
> claimed（未收口）。
>
> ⚠️ **2026-10-25 · v4-pro 试跑也失败，停在 visual-world**：cc-switch 已切 v4-pro（探针 `model=deepseek-v4-pro`），
> 但 `create --yes` 在**第一步 analyze-reference** 3 发失败（`schema`/`empty-input`/`schema`），最后一次
> `camera.angle: expected number, received string`。根因：prompt↔schema 打架 —— `prompts.ts:48` 示例
> `style.camera.angle:"平视"`（字符串）误导模型把结构化 `camera.angle`（`visual-world.ts:179` `z.number()`）也吐成
> 字符串。vision 包问题（VC 范围外）、**间歇性**（intent-to-mechanics 重跑曾过这步）。现场
> `.failed-2026-10-25T05-00-01-540Z/`。

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

## Answer

**VDC 端到端真跑通了（2026-10-25 · v4-pro）** —— 修 vision prompt（`prompts.ts` 加第 4 条：结构化
`camera.angle`/`elevation` 是数字、别照 `style.camera` 的原话字符串填）后，`create --yes` **跑完整条链**：
visual-world → intent → design → character-dna → **visual-design** → recipe → pack(14 生图 0 重试失败)→ config → qa。

- **VDC 产物落盘**：`run/v1/visual-design.json` + `visual-design/svg/scene.svg` + `visual-design/preview/scene.png` ✅
- **第 7 判据真跑并抓到真缺口** ✅：`visual-config-coherence` 报 4 条 —— 设计层实体 `chest`/`enemy-wasteland`/
  `danger-hazard`/`resource-pickup`，到 config 层被 compileRuntime **改名**（`chest-1`/`enemy-1`/`pickup-1,2,3`…），
  **id 链断了**。这是交叉验证的价值：照出一个此前未知的设计→config id 缺口（与 intent-to-mechanics 票 11 同族，
  但病不同：那里是「玩家当地形/HUD 绑 sprite」，这里是「实体 id 不保真」）。

**但 E2E 的「判据全绿」未达成 —— QA 判 5 条硬失败，全在 VDC 之外**：
1. `constructive-constraint`：`enemy-wasteland.walk` 长宽比差 −34.6%（|ΔAR|≥25%）—— **生图质量**（交付图被拉伸）。
2. `visual-config-coherence` ×4：**设计→config id 不保真**（上面那条）。

**成本**：生图 14 次（2 master + 12 image；⚠️ 超了我的 ≤11 估算——模型重生成的 recipe 比 fixture 大）+ 文本
~6 发（plan-assets 6 次重试才过），合计 **≈ $0.47**；墙钟 ~21 分钟。仍在 ≤$2.10 / ≤30min 内（生图次数超了估算、金额没超）。

**结论**：V1 的 VDC（票 02–07）**真实单跑验证到位**——产物落盘、交叉验证能响、抓到真缺口。但整链 QA 不绿，
阻点全在 **VC 范围外**（生图质量 + 设计→config id 保真），各需另立 effort，不在本图顺手修。
