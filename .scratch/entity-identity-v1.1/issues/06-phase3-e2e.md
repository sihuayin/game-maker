# 实施 Phase 3：真实 E2E 验收

Type: task
Status: resolved
Blocked by: 04, 05

## Question

用真实产物证明修复有效（PRD §7）。

范围：
- 先针对性单测 / 集成，再全仓测试。
- E2E-A 错误归属拒绝：真实设计规格 + 注入「`sourceIntent` 存在但语义不兼容」的映射 → 下游资源生成前失败，错误指出实体 / 引用 / 原因，无付费图片步骤。
- E2E-B 合法映射通过：合法 spec+config → 本关覆盖完整、1:N 通过、结构性实体不伪造身份、QA 第 7 判据用 `sourceIntent` 且通过。
- E2E-C 多关卡作用域：≥2 关 spec 分别编译，各关只覆盖本关必需实体，全局完整性未削弱，错误跨关引用被拒。若现有真实 E2E 只有单关，加最小多关卡 fixture。
- `empty-input` 独立：若复现，保存日志 + 运行目录，区分身份审计错误 vs 资源规划输入错误，不靠跳过审计 / 虚假资源 / 放宽校验规避；独立缺陷另立 ticket，仅当阻塞验收才纳入本票。

纪律：`create` 链含**付费 LLM 调用** —— 先书面预算 + 逐字授权才跑；不覆盖既有运行目录、不改版本编号、不破坏成本账本；归档命令 + 退出码 + 路径。

## Answer

已收口（2026-10-25）。**零付费 LLM 调用**完成全部验收 —— E2E 走的是**真实 `compileRuntime` 全路径**（真 pack + 真设计 + 重采样循环 + 业务校验），只把上游 LLM 换成 mock fetch，再加**真实 `create` 产物重判**。

落地与证据：

- **E2E-A 错误归属拒绝**（`compile-runtime.test.ts` 新增）：真 pack `last-train/v2` + 注入跨桶映射（追加 pickup 却把 `sourceIntent` 指到 enemies 桶 `e-dog`）→ 编译期 `invalid`、`不在允许集合` + `e-dog`、**不落盘**（`out/` 不存在）、**不触下游生图**（compile-runtime 本身不生图）。
- **E2E-C 多关卡作用域**（`compile-runtime.test.ts` 新增）：手写最小两关设计（level-a = `{e-a,res-a}`，level-b = `{e-b,res-b}`，票 06 明许「加最小多关卡 fixture」）—— `levelId:"level-a"` 只覆盖本关、通过；**同一份配置**编 `levelId:"level-b"` → 覆盖失败（e-b/res-b 缺失）+ `wrong-scope`（e-a/res-a 越界）被拒。证明 `compileRuntime` 确实把 `level.id` 传给了验真。
- **E2E-B 合法映射通过 + QA 第 7 判据**（真实产物重判，临时测试跑完即删）：对 V1 的 `e2e-r2` 真实 `create` 产物（`.scratch/entity-identity-v1/runs/2026-10-25-e2e-r2/wasteland-scavenger-recipe/`）——
  ① `auditEntityIdentity(design, config, "level-1")` **零 error**（resource-item 1:N→5 pickup · chest/chest-1+gate(goal) · enemy-wasteland/hazard · hazard-spikes/hazard · step/rubble 孤儿 solid）；
  ② QA `visual-config-coherence` **零身份 error**（join 键 = `sourceIntent`）。`gate(goal)→chest` 同桶误归属**仍按票 02 已知限制放行**，不误报。

验证：`pnpm typecheck` 全绿；`pnpm test` **130 文件 / 1957 测试全绿**（+3 条 E2E 集成，Phase 2 的 +7 已在）。`empty-input`（V1 票 27 上游间歇性）本图**未复现**——本次未跑 `create`/`plan-assets`（见下），身份审计 vs 资源规划输入错误本就分开，无需放宽校验规避。

**付费调用未发生**：全程 mock transport + 复用真实产物，**零 LLM 调用、零生图**。若需「新鲜 `create` 现场」（真实 LLM + 生图 ≈$0.40，或只 `compile-runtime` 文本 ≈$0.05），另行书面预算 + 逐字授权。
