# P0-01G · 开发决策报告与缺口分类

| 属性 | 值 |
|---|---|
| 生产代码基线 | `2c1a9d55c1ac94bc5271318514897b9485587bec`（`2c1a9d5`，`main`） |
| 输入 | `research/01-baseline.md` … `research/07-second-demo-candidates.md`；`rulings-2026-10-29.md`；`docs/v7.6/管线.md` §P0-01G |
| 方法 | 只读证据综合；不运行生成/试玩/付费/浏览器命令；不修改生产代码/契约/测试/历史 |
| 结论边界 | 本报告把审计发现折成六类缺口，并给出**一个**下一步优先事项；不替代 P0-02 的真实运行证据 |

---

## 0. 结论先行

1. **第二个 Demo 可以进入实施：唯一候选 A（平台探索/收集），另立 P0-02 付费试跑。** 这是用户 2026-10-29 的 HITL 裁定（`rulings-2026-10-29.md` Q2 = a），**不是**“A 已验证交付”。付费执行必须另行取得明确预算授权；未获授权则暂停，不得降级复用旧包。
2. **下一步唯一优先事项 = P0-02 A 试跑**（见 §4）。理由是：A 的核心机制有交付级 E3、主路径不需要新运行时/契约，且它是唯一能直接检验“第二条交付链能否成立”的最小实验；B 的假绿链是独立缺口，不应混入 A。
3. **审计没有证明“管线普遍支持第二个 Demo”。** 真实交付级 E3 只有 `wasteland-scavenger-recipe` 一个横版 Demo、一个设计样本、一次成功 Playtest；A 是新设计样本，必须重新产生证据。
4. **最高风险的五个缺口**（按对 A 的影响排序）：
   - `buildAndSite` 的 delivery 信封**没有壳级 E3**（冻结 Demo 的 delivery 由 effort 脚本初始化）；
   - HEAD 的 **v2 Playtest CLI 写回没有 E3**（交付内是 harness/rules v1）；
   - Playtest **默认场景写死 wasteland 常量**（4 pickup / 6 collected / site v1），A 的计数不同会假失败；
   - 没有平台可通关求解器，几何可能不可通关，QA 只报警告；
   - 新交付没有正式证据清单 / `verify-delivery` 路径（清单生成器是 effort 工具，不在 `packages/`）。
5. **B 的假绿链是独立缺口，不阻塞 A**：设计声明 `avoid-danger`、config 无 danger、覆盖门禁仍 `satisfied`、Playtest 无正向断言。A 不把 hazard/avoid-danger 作为核心，因此不把这条链伪装成 A 的验收项。
6. **六类缺口计数**（详见 §2）：已具备 6 项 · 已实现需补证据 7 项 · 生产实现缺口 10 项 · 机制不可观测/判定 6 项 · 证据/身份/版本管理缺口 7 项 · 证据不足 7 项。

---

## 1. 分类口径

按 PRD §P0-01G 的六类：已具备无需改动 / 已实现需补真实验收证据 / 生产实现明确缺口 / 机制存在但不可有效观测或判定 / 证据身份版本管理缺口 / 证据不足暂不能判断。

每条缺口记录：观察到的事实、对应证据、影响的验收目标、最小建议动作、是否需要独立审批、是否阻塞第二个 Demo、建议优先级及理由。优先级：`P0` = 阻塞 A 或影响结论正确性；`P1` = 不阻塞 A，但应在下一轮补证据/修复；`P2` = 命名/文档/未来工作。

---

## 2. 六类缺口

### 2.1 已具备，无需改动（6 项）

| ID | 事实 | 证据 | 影响的验收目标 | 最小动作 | 审批 | 阻塞 A | 优先级 |
|---|---|---|---|---|---|---|---|
| G1-1 | 正式证据完整性入口可重复执行：223 文件（151 required / 72 optional）、13 records、六项 declared↔recomputed 全 match、diagnostics 0；HEAD 独立重跑 pass，1,035 个受保护文件零变化 | `research/04 §0-6`；`research/06 §6/§8`；`runs/2026-10-29T05-04-57Z-final-acceptance/` | EI-04/05/07；AC-01/02/09 | 无需行动；继续作为冻结证据的只读校验 | 否 | 否 | — |
| G1-2 | Playtest 真跑系统 Chrome/CDP、真实键盘、本地只读 HTTP，站点字节前后哈希不变 | `research/06 §1` | EI-07/AC-09 | 无需行动 | 否 | 否 | — |
| G1-3 | 横版主链有一组完整真实 E3：输入→理解六步→规划→pack→verify→config→QA→site（`040b907`；冻结 `5b8283f`） | `research/03 §6.2`；`research/04 §0-2` | AC-01/AC-08；P0-01B | 作为单样本基线；不外推 | 否 | 否 | — |
| G1-4 | `collect-pickup` / `open-chest` / `reach-goal` 有交付级 E3（冻结身份绑定） | `research/05 §3.5/§3.8/§3.9` | P0-01D | A 的核心验收只用这三条 | 否 | 否 | — |
| G1-5 | 版本目录原子分配、绝不覆盖；历史 run/pack/site 有零改动证据 | `research/04 §2.10`；`research/06 §6` | EI-07/AC-09 | 无需行动 | 否 | 否 | — |
| G1-6 | 免费回归与负向测试可用：`pnpm test`、`typecheck`、`test:evidence`；验收器 18 + CLI 6 个负向用例 | `research/02`；`research/06 §8.1` | AC-08 | P0-02 前后复跑；不把并发负载下的超时当能力失败 | 否 | 否 | — |

### 2.2 已实现，但需要补充真实验收证据（7 项）

| ID | 事实 | 证据 | 影响的验收目标 | 最小动作 | 审批 | 阻塞 A | 优先级 |
|---|---|---|---|---|---|---|---|
| G2-1 | `buildAndSite` 的 delivery 写回只有 E1 + 分层 E2；冻结 Demo 的 delivery 由 `.scratch/fpvs-v1-final/acceptance/init-delivery.mjs` 初始化 | `research/03 §3.10/§6.3`；`research/04 §0-3` | EI-04；FR-05；A 的交付证据 | P0-02 真实运行后核对 delivery 是否由生产壳写出；若无，记缺口，不补脚本冒充 | 是（若需修） | **是（结论性）** | P0 |
| G2-2 | Playtest v1 有 CLI 写回 E3；HEAD 的 v2 CLI 归因 + 写回组合无 E3 | `research/04 §0-4`；`research/06 §0-1` | P0-2/FR-02；A 的 Playtest 证据 | P0-02 用 HEAD v2 跑一次，保存命令/退出码/attempt | 否 | **是（结论性）** | P0 |
| G2-3 | MCP 只有 `create_game` 能走完横版全链，且无真实 E3；手工组合会被 QA 发布闸拒绝 | `research/03 §4.2/§7A`；`research/04 §0-8` | P0-01B/E；入口矩阵 | 不阻塞 A（A 走 CLI）；若后续要求 MCP，需另立需求 | 是 | 否 | P1 |
| G2-4 | TD `compile-td-game` 无“模型真实产出 td-config”的 E3；TD 站点/渲染是 fixture E3；TD 玩法 UNKNOWN | `research/03 §3.9`；`research/04 §0-7/§4.1` | P0-01B/D；候选 C | 不阻塞 A；若选 C 需平台级接入 | 是 | 否 | P1 |
| G2-5 | 人工视觉只有一次可追溯记录（`f458beb`）；`review-verdict` 不校验截图/材料/身份；独立性与可重复性 UNKNOWN | `research/06 §5/§11`；`research/04 §4.1` | P0-3；A 的视觉证据 | P0-02 重新做一次人工审核，记录 reviewer/时间/材料；不把机器校验当人工结论 | 否（人工） | 是（A 的视觉门槛） | P1 |
| G2-6 | `playtest-baseline` 无入库基线；`fixtures/playtest-baselines/` 只有 README | `research/04 §2.7`；`research/03 §7D` | P0-2 | 不阻塞 A；若 A 需要基线，先晋升一份 | 是 | 否 | P1 |
| G2-7 | 非 SUCCESS 的真实 E3 只有一次 `AGENT_LIMITATION` 沙箱；失败/超时/环境故障主要靠 E2 | `research/06 §0-3/§3` | P0-2/FR-02 | P0-02 若失败，保留真实失败证据；不要用成功样本代替失败路径 | 否 | 否 | P1 |

### 2.3 生产实现存在明确缺口（10 项）

| ID | 事实 | 证据 | 影响的验收目标 | 最小动作 | 审批 | 阻塞 A | 优先级 |
|---|---|---|---|---|---|---|---|
| G3-1 | config 编译器提示词不读 `design.mechanics`；`kind` 铁律只列 solid/pickup/hazard/goal/decor，漏 chest/danger；骨架无 chest/danger | `research/05 §4.1`；`ops.ts:1103` 附近 | P0-01D；机制声明→配置 | 另立需求：把设计机制纳入配置生成与校验；A 不依赖 chest/danger | 是 | 否（A 核心机制不受影响） | P1 |
| G3-2 | 机制覆盖门禁只读 `design.mechanics`；生产调用不传 probe 结果，QA 层默认全 passed；覆盖报告不落盘 | `research/05 §4.3` | P0-01D；覆盖门禁 | 另立需求：覆盖门禁读 config + probe，并持久化 | 是 | 否（但影响“机制已验证”声明） | P0（正确性） |
| G3-3 | Playtest 默认场景写死 `siteVersion=1`、`initialActivePickups=4`、`collected=6`；仓库无场景生成器；默认不断言 chest/hazard/danger/moving | `research/05 §4.4` | P0-2；A 的 Playtest | P0-02 用现有 `--scenario-dir` 提供 A 的场景数据；通用生成器另立需求 | 否（场景数据）/是（生成器） | 是（不提供场景会假失败） | P0 |
| G3-4 | `moving-platform` 无运行时实现；带 `motion` 的 solid 不会移动，schema 不拒；手写 `solid+motion` 可静默绕过 | `research/05 §3.6/§4.2` | P0-01D | 另立需求：要么实现，要么拒绝/降级；A 不使用 | 是 | 否 | P1 |
| G3-5 | `hazard-contact` 有真实 `reset=10` 但无正向断言；`avoid-danger` 只有 fixture probe，冻结 config 无 danger，覆盖仍 `satisfied` | `research/05 §3.7/§3.10/§4.6` | P0-01D；B 的假绿链 | 独立开发决策：补正向断言 + config/覆盖核对；不混入 A | 是 | 否 | P0（正确性） |
| G3-6 | `runBuild` 清单/身份错误抛普通 Error 退 1 而非 4；`compile-td-game` 缺空凭据闸；`publish-gate` 只钉 pack 不钉 config；`create --yes` 测试依赖未入库 `dist/shell.js` | `research/03 §7B/§7D` | 失败语义/可复现性 | 另立小需求修复；A 试跑前只需 build 产物存在 | 是 | 否 | P1 |
| G3-7 | 没有平台跳跃可通关求解器；`auditGameConfig` 只对台阶高于跳跃顶点报警告，不拒绝不可达布局 | `research/04 §2.6`；`research/07 §3.4-5` | A 的可通关性 | P0-02 接受该风险；失败则记录；求解器另立需求 | 是（求解器） | **是（可能失败）** | P1 |
| G3-8 | 独立 `site` 不写 delivery，而 `playtest` 要求 delivery + site pass ⇒ 手工 `plan/pack/compile/site` 不可试玩；MCP `assemble_site` 只装横版；TD 不在设计/QA/delivery/Playtest 链上 | `research/03 §4.2/§7A`；`research/04 §0-7/§0-8` | 入口矩阵；A 只用 create/build | A 走 `create --yes` / `build`；其余入口另立需求 | 是 | 否 | P1 |
| G3-9 | `review-verdict` 不校验截图/材料/身份；Playtest 失败重跑不撤销旧 pass | `research/06 §7/§11` | P0-3；EI-07 | 另立需求：写回前校验、失败重跑撤销/标记旧 pass | 是 | 否（A 需人工审核） | P0（正确性） |
| G3-10 | 无 runId/attempt nonce；harness/rules 版本只记录不强制等于当前常量 | `research/06 §4` | 身份/版本管理 | 另立需求：nonce + 版本强制 | 是 | 否 | P1 |

### 2.4 机制存在但不可有效观测或判定（6 项）

| ID | 事实 | 证据 | 影响的验收目标 | 最小动作 | 审批 | 阻塞 A | 优先级 |
|---|---|---|---|---|---|---|---|
| G4-1 | `hazard-contact` 真实发生（reset=10）但无正向断言；成功样本 reset=0，未接触 | `research/05 §3.7` | P0-01D | 与 G3-5 合并处理；不混入 A | 是 | 否 | P0（正确性） |
| G4-2 | `avoid-danger` 仅 fixture probe；冻结设计声明而 config 无 danger；覆盖仍 satisfied | `research/05 §3.10/§4.6` | P0-01D；B | 独立开发决策 | 是 | 否 | P0（正确性） |
| G4-3 | `moving-platform` 无运行时；配置可静默写入 | `research/05 §4.2` | P0-01D | 与 G3-4 合并 | 是 | 否 | P1 |
| G4-4 | `run`/`jump`/`gravity`/`collide-terrain` 只有间接观测（9 jump/land、到 gate）；gravity/collide 未在设计声明 | `research/05 §3.1–§3.4` | P0-01D | A 不要求机制级断言；若要，补 witness/场景 | 否 | 否 | P1 |
| G4-5 | TD 无 Playtest；探针写死 `scene('shell')`，塔防 key 是 `td`，结构性读不到 | `research/05 §5` | 候选 C | 若选 C 才处理 | 是 | 否 | P2 |
| G4-6 | `reach-goal` 在 `design.mechanics[]` 未声明，只在 `winConditions` 自由文本；但 config 与 Playtest 实现完整 | `research/05 §3.8` | P0-01D；声明完整性 | A 的新设计应显式声明 `reach-goal`；不改代码 | 否 | 否 | P1 |

### 2.5 证据、身份或版本管理存在缺口（7 项）

| ID | 事实 | 证据 | 影响的验收目标 | 最小动作 | 审批 | 阻塞 A | 优先级 |
|---|---|---|---|---|---|---|---|
| G5-1 | 无 runId/attempt nonce；harness/rules 版本不强制 | `research/06 §4` | EI-03/AC-06 | 另立需求 | 是 | 否 | P1 |
| G5-2 | 失败重跑不撤销旧 pass；`review-verdict` 不校验身份/材料 | `research/06 §7/§11` | EI-05/AC-07 | 另立需求；A 的成功必须由新运行证据决定 | 是 | 否 | P0（正确性） |
| G5-3 | 新交付没有正式证据清单 / `verify-delivery` 路径；清单生成器是 effort 工具 | `research/04 §4.1`；`research/07 §3.4-2` | EI-01/EI-06 | P0-02 之后另立“新交付证据清单”需求 | 是 | 否（但 A 的正式证据不完备） | P0（后续） |
| G5-4 | 信任边界：清单与被验证据一起改并提交无法自证；靠 git 历史/人工审查 | `research/06 §6` | EI-07 | 报告如实声明；不宣称更强防篡改 | 否 | 否 | P2 |
| G5-5 | 历史 E3 只有一个 Demo；06 两份 v2 attempt 未归因 | `research/04 §0-2`；`research/06 §0-1` | AC-01 | A 必须产生新证据；历史只作参考 | 否 | 是（结论性） | P0 |
| G5-6 | `publish-gate` 只钉 pack 不钉 config | `research/03 §7B` | 站点/发布身份 | 另立小需求 | 是 | 否 | P1 |
| G5-7 | 单一成功样本不能外推普遍支持 | `research/04 §0-2/§5`；`research/05 §0-10` | AC-01/AC-04 | 报告与主文档明确单样本边界 | 否 | 是（结论性） | P0 |

### 2.6 证据不足，暂不能判断（7 项）

| ID | 事实 | 证据 | 影响的验收目标 | 最小动作 | 审批 | 阻塞 A | 优先级 |
|---|---|---|---|---|---|---|---|
| G6-1 | 当前管线能否生成 A（第二个设计/视觉世界/关卡并交付） | `research/07 §3.9` | P0-01 完成定义 | **P0-02 真实付费运行**；不预设通过 | 是（预算） | 是（这正是 P0-02） | P0 |
| G6-2 | 人工视觉的独立性/可重复性 | `research/04 §4.1`；`research/06 §5` | P0-3 | P0-02 重新人工审核并记录 | 否（人工） | 是（A 的视觉门槛） | P1 |
| G6-3 | TD 玩家控制/目标达成 | `research/04 §4.1` | 候选 C | 若选 C 才处理 | 是 | 否 | P2 |
| G6-4 | 非 SUCCESS 的真实 E3（失败/超时/环境） | `research/06 §0-3` | P0-2 | P0-02 保留真实失败证据；不补造 | 否 | 否 | P1 |
| G6-5 | MCP 全链真实 E3 | `research/04 §0-8` | 入口矩阵 | 另立需求 | 是 | 否 | P2 |
| G6-6 | WebGL / 九宫格真实运行 | `research/03 §7D` | 视觉/渲染 | 需要时再验；A 不依赖 | 否 | 否 | P2 |
| G6-7 | 并发版本分配/多进程写入 | `research/04 §4.1` | 版本隔离 | 若 A 需要并行生成才处理 | 是 | 否 | P2 |

---

## 3. 与能力矩阵的一致性

- 能力矩阵 52 行：`E2E_VERIFIED` 31 · `TESTED` 17 · `UNKNOWN` 4 · `BLOCKED` 0。本报告的 G6 对应其中 4 个 `UNKNOWN`（TD 玩法、视觉独立性、清单生产入口、并发），并补充 A 特有的“第二个 Demo 未运行”作为 `UNKNOWN`。
- 机制矩阵：10 条机制、9 条有实现、3 条有交付级 E3（严格闭集全链 2 条）。本报告不把实现、fixture probe 或覆盖报告升级为交付验收。
- Playtest/证据审计：本报告把“证据存在 / 有效 / 真实”分开处理；历史 E3 不替代 A 的新证据。

---

## 4. 下一步唯一优先事项

**P0-02：A（平台探索/收集）付费试跑。**

选择依据：

1. 用户 2026-10-29 HITL 裁定 Q2 = a：A 进入实施；B 的假绿链是独立缺口，C/D 不进入本期。
2. A 的核心机制（`collect-pickup` + `reach-goal`，`open-chest` 可选）有交付级 E3；主路径不需要新运行时、新契约或生产代码改动。
3. 它是当前证据下唯一能直接检验“第二条交付链能否成立”的最小实验；其他候选要么是平台级接入（C），要么需要新运行时（D）。
4. 它能同时补上 G2-1（delivery 壳级 E3）、G2-2（v2 playtest 写回）、G6-1（第二个 Demo 未运行）三个关键 `UNKNOWN`/`TESTED`；失败也会留下可审计的失败证据。
5. 它不会掩盖 B 的假绿链：A 不使用 hazard/avoid-danger，B 的缺口按 G3-2/G3-5/G4-1/G4-2 独立处理。

**最小解除方案（进入 P0-02 前）**：

- **预算授权**：文本 + 生图 + 浏览器试跑的明确预算；未获授权则暂停，不降级复用旧包。
- **输入**：新 intent 文本、新参考图（新视觉世界）、A 的自定义 Playtest 场景数据（现有 `--scenario-dir`，不手改中间 JSON）。
- **执行**：`create --yes`（或 `create` + `build`）→ `playtest --scenario-dir` → 保存命令 / 退出码 / 路径 / 新交付身份；不改生产代码、不手改中间 JSON。
- **证据**：真实运行 + delivery 报告 + 真实浏览器 Playtest；新交付的正式清单与 `verify-delivery` 明确留作后续缺口。
- **成功判据**：由新交付的冻结身份、真实运行结果和可追溯 Playtest 证据共同决定；不得用历史 E3 替代，也不得把壳级 delivery E3 / v2 playtest 写回 / 正式清单缺失默认为已通过。
- **失败处理**：几何不可通关、QA/视觉/Playtest 失败都按真实证据记录；不修到通过。

---

## 5. 第二个 Demo 能否进入实施

**能：A，进入 P0-02，但条件性。** 条件：

- 明确预算授权（否则暂停）；
- 只新增输入，不改生产代码、不手改中间 JSON、不新增运行时/契约；
- 核心验收 `collect-pickup` + `reach-goal`；`open-chest` 可选；
- 新参考图 → 新视觉世界/资源包；
- 真实运行 + delivery + 真实浏览器 Playtest；正式清单/`verify-delivery` 后续补齐；
- 不把历史 E3、壳级 delivery E3、v2 写回或清单缺失当作已通过。

**不进入实施的情况**：预算未授权；或用户另行裁定改为 b（复用旧包）——但那已不是 Q4(a) 的“独立 Demo”，需要重新裁定。

---

## 6. 证据索引

- 基线：`research/01-baseline.md`（`2c1a9d5`）
- 命令边界：`research/02-safe-commands.md`
- 真实管线：`research/03-real-pipeline.md`（§3–§7）
- 能力矩阵：`research/04-capability-matrix.md`（§0、§2、§4、§5）
- 机制矩阵：`research/05-mechanism-observability.md`（§3、§4、§5）
- Playtest/视觉/证据：`research/06-playtest-visual-evidence.md`（§0–§11）
- 候选比较：`research/07-second-demo-candidates.md`（§3–§6）
- HITL 裁定：`rulings-2026-10-29.md`
- 冻结证据重验：`.scratch/evidence-integrity-v1/runs/2026-10-29T05-04-57Z-final-acceptance/`

## 7. 审计限制

- 本报告是证据综合，不新增真实运行；A 的“能否生成”仍未验证，必须由 P0-02 回答。
- 历史 E3 只证明来源 commit + 交付身份 + 实际覆盖场景；单一 Demo 不外推。
- 整仓 `pnpm test` 在并发审计负载下两次超时、超时用例隔离重跑全过；历史最终验收记录整仓绿；本报告不据此判生产能力失败，也不宣称本次复现了整仓绿。
- 人工视觉只能核对记录/身份/材料一致性，不能机器重判“人确实看了”。
- 信任边界：清单与被验证据一起改并提交无法自证；靠 git 历史与人工审查。
- 本报告不修改生产代码、契约、测试或历史；不提交、不推送。
