# P0-01F 前半 · 第二个 Demo 候选比较（只读证据综合）

| 属性 | 值 |
|---|---|
| 生产代码基线 | `2c1a9d55c1ac94bc5271318514897b9485587bec`（`2c1a9d5`，分支 `main`） |
| 审计时 HEAD | `264bda0334602e515a44a6baa84c02faed56a5ce`（`264bda0`）；`git diff 2c1a9d5..HEAD -- packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json` 为空 |
| 工作区 | 仅本票（`issues/07-second-demo-candidates.md`）与未跟踪 PRD `docs/v7.6/管线.md`；本票只新增本文件并改票 07 |
| 输入 | `research/01-baseline.md`、`02-safe-commands.md`、`03-real-pipeline.md`、`04-capability-matrix.md`、`05-mechanism-observability.md`、`06-playtest-visual-evidence.md`；`docs/v7.6/管线.md` §P0-01F；`CONTEXT.md` |
| 方法 | 只读 shell（`git` / `rg` / `find` / `ls` / `sed` / `cat` / `wc` / `node -e` 读 JSON）；**未运行** `create/build/plan/pack/compile-*`、`playtest`、`test:playtest`、`review`、`review-verdict`、`playtest-baseline`、浏览器探针、`pnpm install` |
| 结论边界 | 本票只做 2–3 个候选的比较，**不做最终裁定**；唯一候选由票 08 的 HITL 决定。可以比较证据强弱/风险高低，但不宣布赢家 |

> 本票按地图 Q8：候选比较先于候选裁定。P0-01F 的「只推荐一个优先候选」由票 08/09 收口时满足；本文件提供比较依据，不替代 HITL。

---

## 0. 结论先行

1. **当前生产链只支持一种运行时：`platformer/v1`（横版、单屏高、只横向滚动）**。`RUNTIME_PROFILES` 只有 `PLATFORMER_V1`（`packages/contracts/src/runtime-profile.ts:114-123`）；`CAPABILITIES` 只有 `camera:side-scroll` / `camera:parallax` 等横版能力（`packages/contracts/src/vocabulary.ts:130-147`）；配置编译器明确要求 `world.size.h` 等于视口高 270、只横向滚动（`packages/assets/src/ops.ts:1101`）；`Objective` 只有一个变体 `collect-then-reach`（`packages/contracts/src/game-config.ts:203-214`）。
2. **因此「候选」首先是「当前运行时下能表达什么」的问题，不是「想做哪种游戏」的问题。** 在现有运行时内，玩法差异只能来自：关卡布局/视觉世界、10 条机制中哪些被作为核心、以及资源与 HUD 的取舍；胜负条件与移动方式不变。类型级差异（俯视角解谜、战斗、潜行、推箱、对话等）需要新运行时场景与新契约，不是一份新 `game-config`。
3. **本票提出 3 个候选：**
   - **A. 平台探索/收集（现有机制域内的第二个关卡与视觉世界）**：以拾取/可选宝箱/到达终点为核心，不使用巡逻或定时危险；证据最强、改动最小，但玩法差异主要是内容级。
   - **B. 危险时序（巡逻 + 定时喷发）**：把 `hazard-contact` 与 `avoid-danger` 变成核心挑战；机制已实现、有 fixture probe，但「声明→配置→覆盖→试玩判定」链有实证断点；玩法差异是机制重心级，改动中等。
   - **C. 塔防（counter-siege 型）**：类型差异最大，运行时已有纯层实现与 fixture 渲染证据，但**不在设计/QA/delivery/Playtest 链上**；`compile-td-game` 存在不等于端到端支持，当前无法按同一交付标准认证；改动是平台级。
4. **证据强弱：A > B > C。** A 的核心机制 `collect-pickup` / `open-chest` / `reach-goal` 有交付级 E3（research 05 §3.5/3.8/3.9、§7）；B 的 `hazard-contact` 只有真实发生无正向判定、`avoid-danger` 只有 fixture probe（research 05 §3.7/3.10）；C 的 TD 玩法是 `UNKNOWN`、`compile-td-game` 无真实模型输出 E3（research 04 §2.5/§4.1）。
5. **风险高低：C > B > A。** A 的最大风险是关卡几何不可通关与交付信封无壳级 E3；B 的最大风险是「覆盖报告假 satisfied + 配置里没有 danger + 试玩没有断言」造成的假绿；C 的最大风险是整条交付/试玩链不存在。
6. **玩法差异与管线验证价值是两把不同的尺子。** 若 HITL 的首要目标是「验证当前管线能产出第二个可交付 Demo」，A 的证据最强；若首要目标是「验证管线能强制它声称支持的机制」，B 最有诊断价值；若首要目标是「类型级差异」，当前运行时给不出低成本候选，必须先决定是否扩展运行时或接入 TD 链——这是平台级决策，不应伪装成第二个 Demo 的选择。
7. **俯视角探索解谜在本次证据下不是候选，而是运行时扩展。** 它需要新的相机/移动/交互/目标机制、新的运行时场景与纯层、新的配置形状、新的 Playtest 观测与动作；当前 `platformer/v1` 的机制词表、配置字段与场景都不承载它。本票把它列为 `BLOCKED` 的非候选（见 §7），不预先锁定、也不假装它可由一份新配置实现。
8. **免费验证只能证明「运行时行为」与「测试事实」，不能证明「生成链能产出并交付这份 Demo」。** `pnpm test` / `test:mechanic` / 直接 harness + 手写 config 可以免费跑；`create/build/plan/pack/compile-*` 会调模型上游（付费），`build` 每次都会重新 `packAssets` 与 `compileRuntime`（`packages/pipeline/src/create-game.ts:515,547`），无法用手写 run 绕过；`playtest` 是浏览器重跑且要求 delivery。
9. **所有候选共享同一个单样本约束**：完整真实 E3 只有 `wasteland-scavenger-recipe` 一个横版 Demo、一个设计样本、一次成功 Playtest（外加 harness v2 两次直跑）；不能把该样本外推为「管线普遍支持第二个玩法」（research 04 §0-2/§5-3；research 05 §0-10）。

---

## 1. 口径与证据分层

### 1.1 本票使用的状态词

| 状态 | 本票含义 | 映射 |
|---|---|---|
| `E2E_VERIFIED` | 有命令 + 退出码 + 路径 + 产物身份的真实运行，且覆盖该条声明 | E3 + 交付身份 |
| `TESTED` | 有可核实的测试断言，但没有充分真实 E2E，或 E2E 只覆盖不同场景/版本 | E2 |
| `IMPLEMENTED` | 能定位生产实现，但没有可核实测试或真实 E2E | E1 |
| `UNKNOWN` | 证据不足，不能判 | 证据不足 |
| `BLOCKED` | 当前运行时/入口不存在，无法产生该场景的证据 | 审计/能力边界 |

### 1.2 四条纪律

- **实现不等于验收**：`moving-platform` 有 `Motion` 配置表达但没有运行时实现，是 `BLOCKED` 的反例（research 05 §3.6/§4.2）。
- **配置字段存在不等于机制发生**：冻结交付的设计声明了 `avoid-danger`，config 里 `danger` 实体数为 0，覆盖报告仍 `satisfied`（research 05 §0-4/§3.10/§4.3）。
- **fixture / probe 不等于交付 E3**：`avoid-danger` 的 probe 使用 `fixtures/packs/last-train/v2` + 合成 config，只证明「danger 会喷发并命中」，不证明「某个设计生成的交付能规避」（research 05 §3.10）。
- **单一成功样本不外推**：所有横版 E3 只对 `wasteland-scavenger-recipe` v1 的 pack/site/config/shell 身份成立（research 04 §3、§5-3）。

---

## 2. 候选总表

### 2.1 玩法、机制、资源、缺口

| 维度 | A. 平台探索/收集 | B. 危险时序 | C. 塔防 |
|---|---|---|---|
| **1. 与原 Demo 的玩法差异** | 同运行时（`platformer/v1`）、同胜负条件（`collect-then-reach`）；差异来自关卡布局、视觉世界、节奏与「无失败态」的探索感；**不是类型级差异**。原 Demo 的交付实际是「收集 + 巡逻危险」，A 把危险移出核心，强调路线/平台/收集。 | 同运行时、同胜负条件；差异是**机制重心**：巡逻危险与定时喷发成为核心，玩家必须读安全窗口；把原 Demo 设计中声明但未落地的 `avoid-danger` 变成真实玩法。仍是平台收集类，**不是类型级差异**。 | 类型级差异：建造/升级机关、波次、经济、守住核心；输入循环是建造与开波，不是跑跳收集。**但 TD 不在当前设计/QA/delivery/Playtest 链上**，不是「已支持的第二种玩法」。 |
| **2. 所需机制及真实证据** | 必需：`collect-pickup`（`E2E_VERIFIED`，research 05 §3.5）、`reach-goal`（`E2E_VERIFIED`，§3.8）、`run`/`jump`/`gravity`/`collide-terrain`（`TESTED`，只有间接 E3，§3.1–§3.4）。可选：`open-chest`（`E2E_VERIFIED`，§3.9）。不使用 `hazard-contact`/`avoid-danger`/`moving-platform`。 | 必需：`collect-pickup`/`reach-goal`（`E2E_VERIFIED`）、`hazard-contact`（`TESTED`；真实发生 `reset=10`，但无正向断言，§3.7）、`avoid-danger`（`TESTED` + fixture probe E3；交付级 `UNKNOWN`，§3.10）、`run`/`jump`/`gravity`/`collide-terrain`（`TESTED`，间接）。不使用 `moving-platform`（`BLOCKED`）。 | TD 9 类构念（建造/升级/波次/单体/AOE/索敌/减速/护甲/漏怪）有纯层实现与 `td-sim`/`td-winnable` 测试（research 05 §2.3/§5）：`TESTED`。TD 真实玩法 `UNKNOWN`（research 04 §2.6 D6-5）。`compile-td-game` 无真实模型输出 E3（research 03 §3.9；04 §2.5）。 |
| **3. 所需资源与关卡要求** | 玩家动画（`idle`/`run`/`jump` 三路不同）、≥480×270 背景、`solid` 平台 sprite、pickup sprite、goal 资源、HUD panel + pip；若用宝箱再加 chest 动画（closed/open）。世界高固定 270；跳跃顶点约 60.5px、同高横跨约 66px（`game-config.ts:255-272`），平台落差/间距必须在此范围内；至少 1 个 pickup；`pickupCount` = pickup + chest 条数；gate 必须存在且在收集齐后可达。 | 在 A 的资源上增加：巡逻 hazard 动画（≥1 帧）、danger 动画（idle/active 两帧；外壳取首帧 idle、末帧 active，`shell/scene.ts:183-191`）、`strike{periodMs,activeMs}` 参数。关卡必须让玩家能在巡逻间距/安全窗口内通过；danger 打击盒不能封死唯一通路；HUD 槽位仍按 pickup+chest 计数。 | 图块集（floor/walk/shelf/wall/door）、slot、3 座机关、fx、projectile、3 种敌人动画、core、HUD bar/按钮/图标；fixture `counter-siege/v4` 有 21 个资源。`td-config/v1` 需要 arena 网格、path 折线、slots、towers（两级）、enemies、waves、economy、lives、HUD；装配期要过 `auditTdConfig` + `auditTdWorldSize` + `auditTdGeometry` + `auditWinnable`（research 05 §5）。 |
| **4. 当前管线缺口** | ① 主链完整 E3 只有一个 Demo/一个设计样本（research 04 §0-2）；② delivery 写回无 CLI/MCP 壳级 E3，冻结 Demo 的 delivery 是 effort 脚本初始化（research 03 §0-8/§3.10）；③ Playtest 默认场景写死 4 pickup / 6 collected / site v1，且没有场景生成器（research 05 §4.4）；④ HEAD 的 v2 CLI 归因/写回无 E3（research 06 §0-1/§4）；⑤ 没有平台跳跃可通关求解器，只有跳跃顶点 warning（`game-config.ts:494-506`）；⑥ 若把宝箱当核心，config 提示词的 `kind` 列表漏 `chest`/`danger`，骨架也没有 chest（`packages/assets/src/ops.ts:1103`；research 05 §4.1）；⑦ 人工视觉记录与 `review-verdict` 无强绑定（research 06 §11-1）。 | A 的全部缺口，外加：① config 编译器提示词不读 `design.mechanics`，`designBrief` 不含 `mechanics[]`（`packages/assets/src/prompt.ts:854-872`；`ops.ts:1132`；research 05 §4.1）；② `kind` 列表漏 `danger`/`chest`，骨架没有 `danger`/`strike`/`range`（`ops.ts:1103`；research 05 §4.1）；③ 机制覆盖门禁只读 design、生产不传 probeResults、未探测默认全 passed，且报告不落盘（`mechanic-coverage.ts:74-112`；`create-game.ts:647-650`；research 05 §4.3）；④ 默认 Playtest 场景/断言不含 `danger-hit`/`danger-erupt`/`reset`，场景动作也没有「等危险安全窗口」（`playtest.ts:371-382`；research 05 §4.4）；⑤ `hazard-contact` 没有 probe、没有正向断言；`avoid-danger` 的 probe 只证明命中，不证明规避（research 05 §3.7/§3.10）；⑥ `reset>=3` 会被归因成 `AGENT_LIMITATION`（research 05 §3.7；06 §3）；⑦ 失败重跑不撤销旧 pass（research 06 §7/§11-3）。 | ① 没有设计层：`compile-td-game` 从需求文本 + 包直接产 `td-config`，不经 `GameIntentSpec`/`GameDesignSpec`/机制覆盖（research 03 §3.9）；② 没有 QA：`publish-gate` 对 TD 显式返回 `undefined`，跳过 QA 闸（`packages/pipeline/src/publish-gate.ts:145-147`；research 05 §5）；③ 没有 delivery：独立 `site` 不写 delivery，TD 站点无法满足 `playtest` 的 delivery/site pass 前置（research 03 §3.7/§3.9；`cli/playtest.ts:116-125`）；④ 不能 Playtest：`READ_STATE` 写死 `scene('shell')`（`probe-harness.mjs:207-210`），TD 场景 key 是 `td`（`td/scene.ts:45`）；⑤ `compile-td-game` 没有真实模型 E3，且空凭据检查缺失（`ops.ts:1412` vs `:1080`；research 03 §7-B7）；⑥ MCP 无 TD 工具，`assemble_site` 只能装横版（research 03 §4.2）；⑦ 真实浏览器证据只有 fixture 渲染（E-11，Canvas 回退、HUD 溢出），不是编译产物、不是通关（research 04 §2.5/§2.6）；⑧ 无 TD 视觉审核与交付证据。 |

### 2.2 代码变更、接口、免费验证、失败风险

| 维度 | A. 平台探索/收集 | B. 危险时序 | C. 塔防 |
|---|---|---|---|
| **5. 预计代码变更（粗粒度）** | **主路径预计无生产代码变更**：`platformer/v1` + `collect-pickup`/`reach-goal` 已支持；新增的是设计/资源/关卡数据与一个自定义场景目录。若把**宝箱**当核心，需要补 config 提示词的 `kind`/骨架（小改，`ops.ts:1103`；research 05 §4.1）。共享的 delivery/v2 写回 E3 属于平台级验证缺口，不是 A 独有。 | **中等、边界清晰**：① config 提示词/`designBrief` 纳入 `design.mechanics`，`kind` 补 `danger`/`chest`，骨架补 `strike`/`range`；② 机制覆盖门禁读 config（或校验声明机制在 config 中有实体/参数）；③ 加 `hazard-contact` probe；④ Playtest 场景补 `danger-hit`/`danger-erupt`/`reset` 断言，并解决「等安全窗口」的动作/策略（新增 scenario action 或 policy 增强）；⑤ 相应测试。**不需要改外壳运行时**（两条机制已实现）。 | **大、平台级**：要么把 TD 接入设计层（新 RuntimeProfile `td/v1`、TD 机制/能力词表、R12、编译），要么为 TD 单独补 QA/delivery/Playtest 链；至少涉及 TD 观测/状态/动作契约、QA 等价判据、delivery 映射、`build` 整合、CLI `playtest` 的 TD 分派、MCP TD 工具；再加 `compile-td-game` 空凭据闸与真实 E3。不是一份 Demo 的改动量。 |
| **6. 是否新增契约/CLI/MCP/依赖** | **否**。不需要新契约、CLI、MCP 或依赖；场景是数据文件，不是公共契约。若补 chest 提示词只是文本修改。 | **条件性**：若「等危险安全窗口」需要新的 scenario action 或新的 state path，则要改 Playtest 场景契约（`packages/contracts/src/playtest.ts:332-425`）；若只用 policy 内部增强，则**不需要新公共契约**。不需要新 CLI/MCP/依赖；不需要新 RuntimeProfile。 | **需要**：TD 的 Playtest 观测/状态/动作契约（现有 state path 只有 collected/won/hits/chestsOpened/activePickups 等，`playtest.ts:332-365`，没有 TD 的 scrap/lives/wave）；TD 的 QA/delivery 语义；很可能需要新的 RuntimeProfile/设计支持；CLI 需要 TD 的 build/playtest 路径；MCP 需要 `compile_td_game`/`assemble_td_site`/TD playtest 等工具。**不需要外部依赖**。 |
| **7. 免费验证可行性** | **可免费验证运行时行为，不可免费验证完整生成/交付**。免费：`pnpm test`；`test:mechanic` 的 collect/open-chest probe（真 Chrome，fixture pack + 合成 config）；用手写 config + `assembleSiteForProbe`（`probe-harness.mjs:463-469`）+ 直接 harness 跑自定义场景，验证拾取/到达/几何。**付费**：`create --yes`/`build` 生成真实 pack/config/QA/site/delivery；**浏览器重跑**：`playtest` 产 delivery E3。独立 `site --out` 需要该包的 QA 报告，fixture 包没有。 | **可免费验证 probe 与手写关卡的运行时行为，不可免费验证声明→配置链**。免费：`pnpm test`；`test:mechanic --only avoid-danger`（已有 probe）；手写 config + 直接 harness 可观察 `danger-hit`/`reset`/`danger-erupt`；新增 hazard probe 后也可免费跑。**付费**：`create/build` 看模型真实产出；**浏览器重跑**：带自定义场景的 `playtest`。**「能规避」需要新的策略/动作并重跑**，现有 probe 只证明「会命中」。 | **可免费验证纯层仿真与 fixture 站点渲染，不可免费验证编译产物/玩法/交付**。免费：`pnpm test` 的 td-sim/td-winnable/td-site；用 fixture pack + fixture td-config 走 `site --out`（TD 跳过 QA 闸）或 `assembleTdSite`；浏览器渲染；`td-sweep`/`td-balance` probe。**付费**：`compile-td-game` 的真实模型输出。**当前无法用 Playtest 验证 TD 玩法**；需要新观测/动作契约 + 浏览器重跑。 |
| **8. 主要失败风险** | ① 关卡几何不可通关（没有平台求解器，只有跳跃顶点 warning；LLM 布局可能超出 60.5px/66px）；② 设计声明了 config 没实现的机制（覆盖门禁假绿）；③ 默认场景常量不匹配导致「假失败」；④ delivery 壳级 E3 缺失，可能出现「测试全绿但交付信封没被证明」；⑤ 新视觉世界/资源可能过不了 QA/层覆盖；⑥ 若硬要求「实质差异」，A 在同运行时内不满足（最大需求风险）。 | ① **假绿**：模型把「躲避危险」映射成 `hazard` 巡逻而不是 `danger`（冻结 Demo 正是如此），config 无 danger，覆盖仍 `satisfied`；② 修好门禁后首跑可能被拒，需要先做代码变更；③ 定时窗口与 speed 90/jump 330/gravity 900 不匹配，关卡不可通过或过于苛刻；④ agent 复位 ≥3 次被判 `AGENT_LIMITATION`，机制失败被误归因；⑤ 轮询漏采（danger 状态窗口短）；⑥ 改动面比 A 大，回归风险更高；⑦ 仍不是类型级差异。 | ① **当前无法按同一标准认证**：没有 QA/delivery/Playtest，交付结论无从产生；② `compile-td-game` 无真实 E3，模型输出可能不过 schema/不可通关；③ 空凭据缺陷可能把本地配置错记成 upstream；④ 参考玩家只判 `killed===0`，难度/平衡仍是观察；⑤ HUD/布局在真实浏览器已有溢出证据（E-11）；⑥ MCP/CLI 能力不对称；⑦ 若选 C，实际是「接入 TD 平台」，不是「生成第二个 Demo」，成本与风险最高。 |

---

## 3. 候选 A：平台探索/收集（现有机制域内的第二个关卡与视觉世界）

### 3.1 玩法差异

- 与原 Demo 同属 `platformer/v1`、同用 `collect-then-reach`（`game-config.ts:203-214`），移动仍是左右跑 + 单跳 + 重力（`game-config.ts:140-147`）。
- 差异来自：关卡布局（横向世界内的多层平台、跳跃路线）、视觉世界（新参考图 → 新 `VisualWorldSpec`/`StyleSpec`/资源包）、节奏（无巡逻/定时危险的失败态，强调路线与收集）。
- **诚实标注**：这是内容级/关卡级差异，不是类型级差异。原 Demo 的实际交付虽然声明了 `avoid-danger`，config 里没有 danger（research 05 §3.10）；A 进一步移除 hazard，使「无失败态探索」成为核心。

### 3.2 所需机制与真实支持证据

| 机制 | 本候选角色 | 证据分层 | 结论 |
|---|---|---|---|
| `collect-pickup` | 核心 | 交付级 E3：冻结 Demo `pickup=4`、`collected=6`、`activePickups=0`、`won=true`；harness v2 重跑同身份（research 05 §3.5；E-03/E-04） | `E2E_VERIFIED`（仅该交付场景） |
| `reach-goal` | 核心 | 交付级 E3：`win=1`、`won=true`、`playerX=1371`；配置→运行时→观测→Playtest 全链成立；但设计 `mechanics[]` 未声明（research 05 §3.8） | `E2E_VERIFIED`（配置起；新设计应显式声明） |
| `open-chest`（可选） | 可选核心 | 交付级 E3：`chest-open=2`、`chestsOpened=2`、`collected=6`（research 05 §3.9） | `E2E_VERIFIED`（若使用） |
| `run` / `jump` / `gravity` / `collide-terrain` | 基础移动 | 实现 + witness；真实运行只有间接观测（`playerX=1371`、9 次 jump/land），没有机制级断言（research 05 §3.1–§3.4） | `TESTED`（实现事实）；机制验收 `UNKNOWN` |
| `hazard-contact` / `avoid-danger` | 不使用 | — | 不纳入候选核心 |
| `moving-platform` | 不使用 | 无运行时实现（research 05 §3.6） | `BLOCKED` |

### 3.3 所需资源与关卡要求

- 资源：玩家动画（`idle`/`run`/`jump` 三路不同，`game-config.ts:140-147` + `PlayerAnimsShape`）；至少 480×270 背景（视口 480×270，`packages/demo/src/draw.ts:15`）；`solid` 平台 sprite；pickup sprite；goal 资源；HUD panel + pip。若用宝箱：chest 动画（closed/open 两帧，`shell/scene.ts:172-181`）。
- 关卡硬约束：`world.size.h` 必须等于 270（`ops.ts:1101`）；世界宽自定；地面/平台用 `terrain`/`solid`；跳跃顶点 `330²/(2×900)=60.5px`，同高横跨约 `90×660/900=66px`（`game-config.ts:255-272`）；平台落差/间距不得超过这两条；至少 1 个 pickup（`ops.ts:1111`）；`pickupCount` 数到 pickup + chest（`game-config.ts:380`）；gate 必须是 `kind:"goal"`（`game-config.ts:203-214`）。
- QA/装配约束：三族校验 + 几何 + HUD 屏幕空间（`packages/demo/src/site.ts:167-250`）；背景覆盖/层覆盖由包内 `coverage.json` 读（`site.ts` 的 coverage 分支）。

### 3.4 当前管线缺口

1. 主链只有一组完整 E3（`040b907` generate / `5b8283f` freeze）；A 是第二个设计样本，但历史 E3 不能外推（research 04 §0-2）。
2. delivery 写回只有 E1 + 分层 E2，没有 CLI/MCP 壳级 E3；冻结 Demo 的 delivery 由 `.scratch/fpvs-v1-final/acceptance/init-delivery.mjs` 初始化（research 03 §0-8/§3.10）。
3. Playtest 默认 `success-basic` 写死 `siteVersion=1`、`initialActivePickups=4`、`collected=6`（`packages/demo/probe/playtest/scenarios/five-state/success-basic.json:8-73`；research 05 §4.4）；A 的 pickup 数不同就会假失败，需要自定义 `--scenario-dir`，而仓库没有场景生成器。
4. HEAD 的 `playtest` CLI × harness/rules v2 组合没有 E3；交付内报告是 v1（research 06 §0-1/§4；research 04 §2.7）。
5. 没有平台跳跃可通关求解器；`auditGameConfig` 只对台阶高于跳跃顶点报警告（`game-config.ts:494-506`），不拒绝不可达布局。
6. 若把宝箱当核心：config 提示词 `kind` 列表漏 `chest`/`danger`，骨架没有 chest（`ops.ts:1103`；research 05 §4.1）。冻结 Demo 的宝箱是「设计 interactable 有 chest 载体」才落地的，不能保证每次生成都有。
7. `create` 只收 1 张 PNG 参考图；多图/非 PNG 未实现（research 03 §3.1）——A 不要求，但会限制视觉输入形态。
8. 人工视觉仍是必要条件，但 `review-verdict` 不校验截图/材料/身份（research 06 §5/§11-1）；A 需要重新做一次人工审核。

### 3.5 预计代码变更（粗粒度）

- **主路径：无生产代码变更**。`platformer/v1` 的机制、配置、QA、站点装配都覆盖 A 的必要机制。
- **可选小改**：若宝箱是核心，补 config 提示词的 `kind`/骨架（`ops.ts:1103`）与相应测试；这是提示词层面的小改，不是运行时改。
- **数据/测试**：新增一个自定义场景目录（按 A 的 pickup 数/gate 写断言），可复用 `move_to`/`wait_until won`；新增 E2 测试覆盖场景常量。
- **共享验证缺口（非 A 独有）**：delivery 壳级 E3、v2 Playtest 写回 E3、平台可通关求解器；这些属于 P0-02 的平台级工作，不是 A 的候选前置。

### 3.6 契约 / CLI / MCP / 依赖

- 不需要新契约、CLI、MCP 或依赖。
- 场景文件是 `playtest-scenario/v1` 数据，已有 schema；`--scenario-dir` 已是现有 CLI 参数（`cli/playtest.ts:348`）。

### 3.7 免费验证可行性

- **可免费**：
  - `pnpm test`（E2；不启动浏览器）。
  - `test:mechanic` 的 `collect-pickup` / `open-chest` probe（真 Chrome；使用 `fixtures/packs/last-train/v2` + 合成 config；`mechanic-probe.mjs`）。
  - 手写 `game-config` + `assembleSiteForProbe`（`probe-harness.mjs:463-469`）+ 直接跑 playtest harness + 自定义场景：验证拾取/到达/几何；这是免费浏览器路径，但不经过 QA/发布闸/delivery。
- **必须付费**：`create --yes` / `build` 生成真实 pack/config/QA/site/delivery；`build` 每次都重新 `packAssets` + `compileRuntime`（`create-game.ts:515,547`），不能用「手写 run + build」绕过。
- **浏览器重跑**：`playtest` 产 `delivery.playtest` / `playable-smoke`，需要系统 Chrome + 已构建 `dist/shell.js`（research 03 §7-D18/19）。
- **不可免费**：完整交付 E3；`verify-delivery` 只能验冻结清单，不验新交付（research 03 §3.10；06 §6）。

### 3.8 主要失败风险

1. **几何不可通关**：没有平台求解器；LLM 布局可能把平台/缺口摆到 60.5px/66px 之外，QA 只报警告。
2. **假绿**：设计声明了 config 没实现的机制，覆盖门禁仍 `satisfied`（research 05 §4.3）；A 若只声明已实现机制，风险较低，但仍应核对 config。
3. **场景常量不匹配**：默认 4/6/site v1 会让 A 假失败；必须自带场景。
4. **交付信封未证明**：测试/站点绿不等于 delivery 写法已被壳级 E3 证明；冻结 Demo 的 delivery 是 effort 脚本补的。
5. **视觉/资源**：新参考图 → 新风格/资源，可能过不了层覆盖、背景覆盖、HUD 屏幕空间或人工视觉。
6. **需求风险**：如果「实质差异」是硬门槛，A 不满足；它不是类型级差异。

### 3.9 A 能验证什么 / 不能验证什么

- **能**：验证当前生产链能否把**第二个输入/设计/关卡/视觉世界**走成 pack/config/QA/site/delivery（在付费运行后）；验证 `collect-pickup`/`open-chest`/`reach-goal` 的第二个交付样本；验证默认场景之外的场景数据能否正确表达新关卡。
- **不能**：不能验证新机制、类型级玩法、`avoid-danger`/`hazard-contact`/`moving-platform`，也不能证明平台几何的普遍可通关性。

---

## 4. 候选 B：危险时序（巡逻 + 定时喷发）

### 4.1 玩法差异

- 同运行时、同胜负条件；核心挑战从「路线/收集」转为「读巡逻相位、等安全窗口、在喷发间隔穿过」。
- 这是**机制重心级**差异：把原 Demo 设计声明但 config 未实现的 `avoid-danger` 变成真实玩法，同时把 `hazard-contact` 从「背景危险」提升为核心失败条件。
- 仍是平台收集类；不是类型级差异。

### 4.2 所需机制与真实支持证据

| 机制 | 本候选角色 | 证据分层 | 结论 |
|---|---|---|---|
| `hazard-contact` | 核心 | 实现 + `hazard.test.ts` + witness；真实失败样本 `reset=10`（harness v1，冻结身份），但运行被判 `AGENT_LIMITATION`；没有正向断言/probe（research 05 §3.7） | `TESTED`（实现事实）；机制验收 `UNKNOWN` |
| `avoid-danger` | 核心 | 实现 + `hazard.test.ts` 周期测试 + 真 Chrome probe（fixture pack + 合成 config，`passed=true`，57 采样）；交付 config 无 danger；probe 只判「会喷发并命中」，不判「能规避」（research 05 §3.10） | `TESTED`；交付级 `UNKNOWN` |
| `collect-pickup` / `reach-goal` | 胜利条件 | 交付级 E3（research 05 §3.5/§3.8） | `E2E_VERIFIED`（仅冻结交付场景） |
| `run` / `jump` / `gravity` / `collide-terrain` | 基础移动/躲避 | 只有间接 E3（research 05 §3.1–§3.4） | `TESTED`；机制验收 `UNKNOWN` |
| `moving-platform` | 不使用 | 无运行时实现（research 05 §3.6） | `BLOCKED` |

### 4.3 所需资源与关卡要求

- 资源：A 的资源 + 巡逻 hazard 动画（≥1 帧）+ danger 动画（idle/active 两帧；外壳取 `frames[0]` 为 idle、`frames[last]` 为 active，`shell/scene.ts:183-191`）+ `strike{periodMs,activeMs}`。danger 的打击盒 = 实体盒（`game-config.ts:68-82,106-107`）。
- 关卡：巡逻 hazard 带 `motion{kind:"cycle",axis,distance,periodMs}`（`game-config.ts:60-66`）；danger 必须带 `strike`（schema superRefine，`game-config.ts:225-233`）；安全窗口 = `periodMs`，喷发 = `activeMs`，完整周期 = 两者之和，喷发落在最后 `activeMs`（`game-config.ts:68-82`）；玩家 speed 90 / jump 330 / gravity 900，窗口与间距必须匹配；danger 不能封死唯一通路；HUD 槽位按 pickup+chest 计数。
- Playtest：场景动作只有 `move_to`（gate/pickup）、`jump_over`（hazard）、`wait_until`（won/collected）、`reach_goal`、`assert_state`（`playtest.ts:371-382`）；**没有「等 danger idle」动作**，需要新增动作或增强 policy。

### 4.4 当前管线缺口

1. **声明→配置不可机械保证**：config 提示词不带 `design.mechanics`；`designBrief` 只列 title/genre/camera/核心循环/player/world/四桶/levels，没有 `mechanics[]`（`packages/assets/src/prompt.ts:854-872`；`ops.ts:1132`；research 05 §4.1）。
2. **`kind` 列表漏 danger/chest**；骨架只有 pickup/solid/hazard/goal，没有 danger/strike/range（`ops.ts:1103`；research 05 §4.1）。工具 schema 其实接受 7 种 kind（`config-tool.ts:39,44-46`），所以是提示词漂移，不是契约缺失。
3. **覆盖门禁只读 design**：`buildMechanicCoverage(design)` 只遍历 `design.mechanics`；生产不传 `probeResults`，未探测默认全 passed；报告不落盘；`not-tested` 不阻断（`mechanic-coverage.ts:74-112`；`create-game.ts:647-650`；research 05 §4.3）。→ `avoid-danger` 可以在没有任何 danger 实体的交付上拿 `satisfied`。
4. **默认 Playtest 场景不含 danger/hazard 断言**：`success-basic` 只断言 initialActivePickups/collected/won；`failure-missing-pickup` 是 `required:false`；默认没有 `danger-hit`/`danger-erupt`/`reset` 断言（research 05 §4.4；`success-basic.json:29-73`）。
5. **`hazard-contact` 没有 probe**；`QA_PROBED_MECHANICS` 只有 collect-pickup/open-chest/avoid-danger（`vocabulary.ts:114-118`）；`avoid-danger` probe 只证明命中，不证明规避（research 05 §3.10）。
6. **复位阈值**：`reset>=3` 会被 `playtest.ts:237-241` 归因为 `AGENT_LIMITATION`；高复位关卡可能被读成执行器限制，而不是游戏失败（research 05 §3.7/§4.7）。
7. **瞬时事件**：danger 状态/命中靠轮询快照差分；短窗口可能漏采；`hits` 单调较稳，`danger-erupt` 起止同窗口可漏（research 06 §2）。
8. **失败重跑不撤销旧 pass**；v2 CLI 写回无 E3；delivery 壳级 E3 缺失（research 06 §7/§11；research 04 §2.7）。
9. **人工视觉绑定弱**：`review-verdict` 不校验截图/材料/身份（research 06 §5/§11-1）。

### 4.5 预计代码变更（粗粒度）

- **提示词/设计输入**：把 `design.mechanics` 或其映射纳入 config 提示词/`designBrief`；`kind` 补 `danger`/`chest`；骨架补 `danger` + `strike` + `range`（`ops.ts:1103`；research 05 §4.1）。
- **覆盖门禁**：`buildMechanicCoverage` 读 config（检查声明的机制在 config 中有对应实体/参数），或把 probeResults 传入；决定是否把报告落盘（若落盘，涉及 QA/delivery 契约；不落盘则内部签名变更）。
- **probe**：新增 `hazard-contact` probe 到 `QA_PROBED_MECHANICS` + `mechanic-probe.mjs`；保持 probe 清单同源断言。
- **Playtest**：新增 danger/hazard 场景与断言（`danger-erupt gte 1`、`danger-hit eq 0` 或按设计意图、`reset` 上限）；为「等安全窗口」新增 scenario action 或增强 policy（二者选一；前者是契约变更）。
- **测试**：config 提示词/门禁/probe/scenario 的 E2；可能需要一条真实失败演练（不可免费完全验证）。
- **不需要改外壳**：hazard/danger 的运行时已存在（`shell/scene.ts:157-161,183-191,267-306`）。

### 4.6 契约 / CLI / MCP / 依赖

- **条件性契约变更**：若新增「等 danger idle」动作或新的 state path，需要改 `playtest-scenario/v1` 的 action/state 枚举（`playtest.ts:332-425`）；若用 policy 增强，则不需要公共契约变更。
- **不需要新 CLI/MCP**：现有 `playtest --scenario-dir`、`test:mechanic` 足够；不需要新依赖。
- **不需要新 RuntimeProfile**：两条机制都在 `platformer/v1`。

### 4.7 免费验证可行性

- **可免费**：
  - `pnpm test`（hazard/danger 单测、witness、coverage 测试）。
  - `test:mechanic --only avoid-danger`（真 Chrome；fixture pack + 合成 config）。
  - 手写 config + `assembleSiteForProbe` + 直接 harness + 自定义场景：观察 `danger-erupt`/`danger-hit`/`reset`；验证「会命中」与关卡几何。
  - 新增 hazard probe 后，`test:mechanic` 可免费验证 hazard 接触复位；`test:acceptance` 也可跑。
- **必须付费**：`create/build` 看真实模型是否按设计生成 danger；`build` 每次重新 pack/compile（`create-game.ts:515,547`）。
- **浏览器重跑**：`playtest` 产 delivery E3；「能规避」需要新策略/动作后重跑。
- **不可免费**：完整的声明→配置→覆盖→试玩判定链；这需要代码变更 + 付费生成 + 浏览器重跑。

### 4.8 主要失败风险

1. **最大风险：假绿。** 模型把「躲避危险/敌人」映射成 `hazard` 巡逻而不是 `danger`（冻结 Demo 正是如此：设计 `avoid-danger`，config 0 个 danger，2 个 hazard；research 05 §3.10）。覆盖报告仍 `satisfied`，门禁放行，Playtest 也可能 SUCCESS——但声明的机制一次都没发生。
2. **修好门禁后首跑被拒**：这是预期行为，但意味着 B 的前置是 P0-02 的代码变更，不是直接开生成。
3. **时序不可行/不公平**：没有求解器；窗口、巡逻距离、平台间距与 speed 90/jump 330/gravity 900 可能不匹配；玩家/agent 可能过不去。
4. **归因误判**：`reset>=3` → `AGENT_LIMITATION`；机制失败被读成执行器限制。
5. **观测漏采**：danger 状态窗口短，轮询可能漏 `danger-erupt`；`danger-hit` 单调较稳，但也不是帧级日志。
6. **改动面较大**：提示词/门禁/probe/场景/策略五处；回归风险高于 A。
7. **仍不是类型级差异**：如果「实质差异」是硬门槛，B 也不满足。

### 4.9 B 能验证什么 / 不能验证什么

- **能**：验证「机制声明 → 配置表达 → 覆盖门禁 → 运行时 → 观测 → Playtest 判定」这条链路是否是真正的判据，而不只是报告字段；验证 `hazard-contact`/`avoid-danger` 能否在交付级被证明；验证门禁能否拒绝「声明了但没发生」的配置。
- **不能**：不能验证类型级新玩法；不能在没有代码变更的情况下证明 `avoid-danger` 的交付级规避；不能证明时序关卡的普遍可玩性。

---

## 5. 候选 C：塔防（counter-siege 型）

### 5.1 玩法差异

- 类型级差异：建造/升级机关、波次、经济、索敌、守住核心；输入循环是建造与开波，不是左右跑跳。
- 但 TD 是**并行运行时/旁路**，不是 `platformer/v1` 的配置变体：`td-config/v1` 与 `game-config/v1` 是兄弟格式（`packages/contracts/src/td-config.ts:1-35`）；`RUNTIME_PROFILES` 不含 TD（`runtime-profile.ts:123`）；设计层无法表达 TD（research 03 §3.9）。

### 5.2 所需机制与真实支持证据

| TD 构念 | 实现/测试 | 真实 E3 | 结论 |
|---|---|---|---|
| 建造机关 / 升级 / 波次 / 单体 / AOE / 索敌 / 减速 / 护甲 / 漏怪 | `td/sim.ts:107-249`；`td-sim.test.ts`、`td-winnable.test.ts`、`td-world.test.ts`、`td-site.test.ts`（research 05 §2.3/§5） | 无真实玩法 E3；只有 fixture 站点渲染（E-11） | `TESTED`（实现事实）；玩法 `UNKNOWN` |
| TD 站点装配 | `assembleTdSite`（`td/site.ts:92-175`）；`publish-gate.ts:145-147` 跳过 QA | E-11：fixture pack + fixture td-config，真 Chrome，Canvas 回退、`canNine=false`、HUD 溢出 | `E2E_VERIFIED`（仅 fixture 装配/渲染） |
| `compile-td-game` | `ops.ts:1405-1570`；测试 `compile-td-game.test.ts` | 无真实模型输出 E3；`counter-siege-v4.json` 是 `inspect` 输出，不是 compile 输出 | `TESTED`；编译真实 E3 `UNKNOWN` |
| TD 玩法（真实浏览器通关/失败） | 参考玩家 `td-winnable` 只判 `killed===0`（`winnable.ts:84-123`） | 无 | `UNKNOWN` |

### 5.3 所需资源与关卡要求

- 资源：fixture `counter-siege/v4` 有 21 个资源（图块 floor/walk/shelf/wall/door、slot-socket/slot-ring、3 座塔、fx-shock、proj-nail/proj-beam、3 种敌人动画、core-counter、HUD bar/按钮/图标）。生成路径需要 `compile-td-game` 从需求文本 + 包产 `td-config`。
- 关卡：`td-config/v1` 的 arena 网格、path 折线、slots、towers（两级）、enemies、waves、economy、lives、HUD；装配期 `auditTdConfig` + `auditTdWorldSize` + `auditTdGeometry` + `auditWinnable`；参考玩家只提供可通关下界（`killed===0` 是唯一判据）。
- 需求输入：`compile-td-game --requirement <需求.md> --pack <包目录>`；没有 `GameIntentSpec`/`GameDesignSpec`。

### 5.4 当前管线缺口

1. **没有设计层**：需求文本 + 包 → `compile-td-game` → `td-config`；没有意图/设计/机制覆盖（research 03 §3.9）。
2. **没有 QA**：`publish-gate` 显式跳过 TD（`publish-gate.ts:145-147`）；没有 `qa-report.json`。
3. **没有 delivery**：独立 `site` 不写 delivery；TD 站点无法满足 `playtest` 的 delivery/site pass 前置（`cli/playtest.ts:116-125`；research 03 §3.7/§3.9）。
4. **不能 Playtest**：`READ_STATE` 写死 `scene('shell')`（`probe-harness.mjs:207-210`），TD key 是 `td`（`td/scene.ts:45`）；state path 只有横版字段（`playtest.ts:332-365`）；action 只有 move_to/jump_over/wait_until won/collected/reach_goal/assert_state（`playtest.ts:371-382`），没有建造/开波。
5. **compile 无真实 E3**：没有跟踪的「模型真实产出 td-config」；只有 fixture td-config（research 03 §3.9；04 §2.5）。
6. **空凭据缺陷**：`compileTdGame` 只判 `!opts.transport`，没有像 `compileRuntime` 那样检查 `baseUrl===""`/`apiKey===""`（`ops.ts:1412` vs `:1080`；research 03 §7-B7）。
7. **MCP 无 TD**：没有 `compile_td_game`，`assemble_site` 只调横版 `assembleSite`（research 03 §4.2）。
8. **真实浏览器证据只有 fixture 渲染**：E-11 是 fixture pack + fixture td-config，Canvas 回退、`canNine=false`、HUD `start` 声明 28 实际 44.5、右边缘出屏（research 04 §2.5）；不是 compile 产物、不是通关。
9. **无 TD 视觉审核/交付证据**：人工视觉记录只覆盖 wasteland；delivery/evidence-integrity 的六项没有 TD 语义。

### 5.5 预计代码变更（粗粒度）

- **平台级、多票**：决定 TD 是否进入生产链；若进入，需要新的 `RuntimeProfile`（`td/v1`）、TD 机制/能力词表、设计层支持或单独 TD 设计路径、R12 扩展、QA 等价判据、delivery 映射、`build` 整合、Playtest 观测/状态/动作契约、CLI `playtest` TD 分派、MCP TD 工具。
- **较小但必要的修复**：`compile-td-game` 空凭据闸；真实编译 E3；TD HUD/布局校验；TD 站点装配的 QA/delivery 语义。
- **不涉及外部依赖**：纯本地契约/CLI/MCP/运行时整合。
- **本票不设计实现**：以上只是范围估计，不是方案。

### 5.6 契约 / CLI / MCP / 依赖

- **需要**：TD 的 Playtest 观测/状态/动作契约；TD 的 QA/delivery 语义；可能的新 RuntimeProfile/设计支持；CLI TD build/playtest；MCP `compile_td_game`/`assemble_td_site`/TD playtest。
- **不需要外部依赖**：没有新增包/锁文件需求。
- **是否新增 MCP**：若第二 Demo 走 MCP，必须新增；当前 MCP 完全不能走 TD（research 03 §4.2）。

### 5.7 免费验证可行性

- **可免费**：
  - `pnpm test`：`td-sim`/`td-winnable`/`td-world`/`td-site` 纯层测试（E2）。
  - 用 fixture `counter-siege/v4` + fixture `td-configs/counter-siege.json` 走 `site --out`（TD 跳过 QA 闸）或 `assembleTdSite`；浏览器渲染（真 Chrome）；这是免费站点/渲染验证。
  - `td-sweep`/`td-balance` probe（如果与当前实验脚本兼容）。
- **必须付费**：真实 `compile-td-game` 模型输出（文本上游）。
- **浏览器重跑**：TD 玩法/通关需要新的观测与动作契约 + 浏览器；当前 harness 读不到 TD 场景，不能直接跑。
- **不可免费**：TD 交付级 E3、QA、delivery、visual review；这些当前不存在。

### 5.8 主要失败风险

1. **无法认证**：没有 QA/delivery/Playtest，第二个 Demo 无法按 Demo 1 的标准产生交付结论。
2. **范围失控**：选 C 实际是「接入 TD 平台」，不是「生成第二个 Demo」；需要多张票和新的契约/CLI/MCP。
3. **编译产物不可用**：没有真实 E3；模型输出可能不过 schema/不可通关；空凭据缺陷可能误记 upstream。
4. **平衡/难度不可判**：参考玩家只判 `killed===0`；难度是观察，不是判据。
5. **渲染/布局**：E-11 已显示 HUD 声明与实际绘制不一致、右边缘出屏；真实九宫格/WebGL 路径未验证（Canvas 回退）。
6. **能力不对称**：MCP 无 TD，CLI 只有 compile/site；交付链末端缺失。

### 5.9 C 能验证什么 / 不能验证什么

- **能**：验证 TD 纯层仿真、fixture 站点装配/渲染、`td-config` 校验与参考玩家下界；如果完成平台接入，可验证第二种运行时。
- **不能**：在当前基线上验证 TD 的真实生成、真实玩法、交付与视觉；不能证明 `compile-td-game` 能端到端产出可交付 Demo。

---

## 6. 跨候选比较（不做最终裁定）

### 6.1 证据强弱

| 候选 | 最强证据 | 最弱环节 | 证据结论 |
|---|---|---|---|
| A | `collect-pickup` / `open-chest` / `reach-goal` 交付级 E3；移动机制有实现 + witness | 移动机制只有间接 E3；单样本；delivery 壳级 E3 缺失 | **最强**：核心机制有交付级证据，无新机制/契约；风险主要是几何与场景常量 |
| B | `hazard-contact` / `avoid-danger` 有实现 + probe/真实复位；机制链可被直接检验 | `avoid-danger` 交付级 `UNKNOWN`；覆盖门禁假绿；无正向断言 | **中等**：机制已实现，但「声明→配置→覆盖→判定」链正是已知断点；诊断价值最高、假绿风险最高 |
| C | TD 纯层仿真/测试；fixture 站点渲染 E3 | 无设计/QA/delivery/Playtest；compile 无真实 E3；玩法 `UNKNOWN` | **最弱**：只有实现/测试/fixture 证据，不能按同一交付标准认证 |

### 6.2 风险与成本

| 轴 | A | B | C |
|---|---|---|---|
| 代码变更 | 无/极小 | 中等 | 大（平台级） |
| 新契约/CLI/MCP | 无 | 条件性（可能一个 scenario action） | 需要 |
| 付费生成依赖 | 有（一次 create/build） | 有（一次 create/build） | 有（compile-td-game；且链路未通） |
| 浏览器重跑 | 有（playtest） | 有（带自定义场景） | 当前不可；需新观测/动作 |
| 主要风险 | 几何不可通关、交付未证明、需求差异不足 | 假绿、时序不可行、归因误判、改动面 | 无法认证、范围失控、编译/平衡/渲染 |
| 风险等级 | 中 | 高 | 最高 |

### 6.3 玩法差异 vs 管线验证价值

- **玩法差异**：C（类型级）> B（机制重心级）> A（内容/关卡级）。
- **管线验证价值（针对当前审计发现的断点）**：B（机制声明→配置→覆盖→判定）> A（第二样本/生成泛化）> C（另一运行时，但需要先造链）。
- **证据强度**：A > B > C。
- **实现成本**：A < B < C。

### 6.4 与「实质差异」要求的张力

- P0-01F 的示例是俯视角探索解谜，但当前运行时只有 `platformer/v1`（`runtime-profile.ts:114-123`），配置只有 `collect-then-reach`（`game-config.ts:203-214`），机制词表只有 10 条（`vocabulary.ts:38-59`）。
- 因此：
  - 若「实质差异」= **类型级差异**：A/B 都不满足；C 满足但当前不可交付；俯视角解谜需要运行时扩展（`BLOCKED`）。最小阻塞不是「选哪个关卡」，而是「是否扩展运行时/接入 TD 链」的平台级决策。
  - 若「实质差异」= **关卡/机制重心的可感差异**：A/B 可满足；B 的机制差异更明显，但代价与假绿风险更高。
- 本票不替 HITL 定义「实质差异」的阈值；这是票 08 需要明确的第一件事。

### 6.5 给票 08 的决策问题（不是裁定）

1. 第二 Demo 的首要目标是「验证当前管线能产出第二个**可交付** Demo」，还是「验证一个**类型级不同**的玩法」？
2. 若选 A/B，是否接受「同运行时、同胜负条件，差异来自关卡/机制重心/视觉世界」作为第二 Demo 的差异标准？
3. 若选 B，是否把「声明→配置→覆盖→试玩判定」的修复列为 P0-02 的最小需求（中等改动），并接受首跑可能被新门禁拒绝？
4. 若选 C，是否把「TD 接入 QA/delivery/Playtest」作为独立平台 effort，而不是第二 Demo 本身？
5. 若要求类型级差异且不接受 TD 接入，是否先立「新运行时 profile/场景」的探索票，而不是在本期强行选一个平台收集关卡？

---

## 7. 非候选与被证据排除的方向

### 7.1 俯视角探索解谜（`BLOCKED`）

- **为什么不是候选**：当前 `RUNTIME_PROFILES` 只有 `platformer/v1`（`runtime-profile.ts:114-123`）；`CAPABILITIES` 只有 `camera:side-scroll`/`camera:parallax` 等横版能力（`vocabulary.ts:130-147`）；`game-config/v1` 的 `PlayerMove` 只有 speed/jump/gravity（`game-config.ts:140-147`），`Objective` 只有 `collect-then-reach`（`:203-214`）；配置编译器要求世界单屏高、只横向滚动（`ops.ts:1101`）；机制词表没有俯视移动、交互、推箱、门/开关、对话等（`vocabulary.ts:38-59`）。
- **需要什么**：新相机能力（top-down）、四向移动、交互/推箱/门/开关等机制、新的配置形状或新格式、新的运行时场景 + 纯层 + 分派、设计层 R12 与机制词表扩展、Playtest 观测/动作扩展、视觉资源与关卡。**这是新运行时，不是一份新 `game-config`。**
- **结论**：`BLOCKED`。若 HITL 要求它，应先做运行时扩展的探索/决策，而不是把它列为第二 Demo 的候选。

### 7.2 其他被排除的方向

| 方向 | 为什么不是当前候选 | 状态 |
|---|---|---|
| 二段跳 / 冲刺 / 攻击 / 血量 / 敌人 AI / 对话 | 不在 `MECHANICS` 封闭词表；设计层填不出来，R12 拒绝（`vocabulary.ts:38-59`；research 05 §8-4） | `BLOCKED` |
| 移动平台作为核心 | `moving-platform` 无运行时实现；设计层 R12 拒绝；手写 `solid+motion` 可静默绕过但外壳不移动（research 05 §3.6/§4.2） | `BLOCKED` |
| 多关卡/关卡选择 | `game-config` 一个文件 = 一个关卡；多关卡索引形状未定（`game-config.ts` 文件头注释；research 03 §3.5） | `BLOCKED` / 契约未定义 |
| 游戏内计时/限时 | 没有计时机制；Playtest 的 `TIMEOUT` 是 harness 超时，不是游戏规则（research 06 §3） | `BLOCKED` |
| 分支结局/多终点 | `Objective` 只有一个 gate；额外 goal 只画不判（`shell/scene.ts:163-170`；`game-config.ts:203-214`） | `BLOCKED` |
| 纯 import/复用资源路线 | `import` 路线只有 E2/fixture 证据，无真实交付包（research 04 §2.4） | `TESTED`，但可作为 A 的资源来源选项，不是独立玩法候选 |

---

## 8. 证据索引

### 8.1 研究文件

| 来源 | 本票使用的内容 |
|---|---|
| `research/01-baseline.md` §1–§3 | 基线 `2c1a9d5`、包结构、测试规模、工作区纪律 |
| `research/02-safe-commands.md` §2–§4 | 命令 allowlist；`create/build/plan/pack/compile-*`、`playtest`、`test:playtest`、`review` 等禁止/条件 |
| `research/03-real-pipeline.md` §0、§2、§3.1、§3.5–§3.10、§4、§6.3、§7 | 两条生产链；横版主链；TD 旁路；delivery/verify 边界；入口差异；E3 缺口 |
| `research/04-capability-matrix.md` §0、§2.1–§2.10、§3、§4.1、§5 | 52 行能力矩阵；E2E/TESTED/UNKNOWN；E-01–E-15；单样本与测试约束 |
| `research/05-mechanism-observability.md` §0、§2、§3.1–§3.10、§4、§5、§6、§7、§8 | 10 条机制的分层证据；三处系统性断点；TD 边界；交付级 E3 3/10；对第二 Demo 的机制含义 |
| `research/06-playtest-visual-evidence.md` §0、§1–§4、§5–§7、§9–§11 | Playtest 真实浏览器/轮询/归因/身份；人工视觉；verify-delivery；负向覆盖；风险排序 |
| `docs/v7.6/管线.md` §P0-01F | 候选评估的 8 个维度与「不得凭 compile-td-game 认定端到端支持」 |
| `CONTEXT.md` 交付与调用 / Playtest V1 | `RuntimeProfile` / `Runtime Shell` / `Mechanic Status` / `Mechanic Coverage` / `DeliveryCheckStatus` / `Playtest` 的权威语义 |

### 8.2 代码与契约（基线 `2c1a9d5`）

| 主题 | 路径:行 |
|---|---|
| 唯一 RuntimeProfile / 注册表 | `packages/contracts/src/runtime-profile.ts:114-123` |
| 机制词表 10 条 / 运行时见证 9 条 / probe 3 条 | `packages/contracts/src/vocabulary.ts:38-59,89-99,114-118` |
| 能力词表 8 条（side-scroll/parallax） | `packages/contracts/src/vocabulary.ts:130-147` |
| `EntityKind` 7 种 / `Motion` / `Strike` | `packages/contracts/src/game-config.ts:29-40,60-66,68-82` |
| `PlayerMove` 默认值 / 跳跃顶点 / 横跨 | `packages/contracts/src/game-config.ts:115,140-147,255-272` |
| `Objective = collect-then-reach` | `packages/contracts/src/game-config.ts:203-214` |
| `pickupCount` 数到 chest | `packages/contracts/src/game-config.ts:380` |
| config 提示词：单屏高 270 / kind 列表漏 chest/danger / 至少 1 pickup | `packages/assets/src/ops.ts:1101,1103,1111` |
| `designBrief` 不含 `mechanics[]` | `packages/assets/src/prompt.ts:854-872`；`packages/assets/src/ops.ts:1132` |
| R12 机制状态拒绝 | `packages/game-design/src/build-design.ts:136-158` |
| 机制覆盖门禁只读 design / 默认 probe 全过 | `packages/contracts/src/mechanic-coverage.ts:74-112`；`packages/pipeline/src/create-game.ts:647-650` |
| `runBuild` 每次 pack/compile | `packages/pipeline/src/create-game.ts:515,547` |
| `buildAndSite` delivery 写回 | `packages/cli/src/cli.ts:247-297` |
| TD 跳过 QA 闸 | `packages/pipeline/src/publish-gate.ts:145-147` |
| Playtest 默认场景/六项准备/delivery 前置 | `packages/cli/src/playtest.ts:23,88-101,106-163` |
| Playtest 场景动作/状态路径 | `packages/contracts/src/playtest.ts:332-425` |
| Playtest harness/rules v2 | `packages/contracts/src/playtest.ts:23-24` |
| `READ_STATE` 写死 `scene('shell')` | `packages/demo/probe/probe-harness.mjs:207-210` |
| `assembleSiteForProbe`（免费探针装配） | `packages/demo/probe/probe-harness.mjs:463-469` |
| TD 场景 key `td` | `packages/demo/src/shell/td/scene.ts:45` |
| 外壳机制分支（hazard/danger/chest/goal） | `packages/demo/src/shell/scene.ts:150,157-161,163-181,183-191,267-337,352-366` |
| TD 纯层仿真 | `packages/demo/src/td/sim.ts:107-249` |
| TD 可通关判据 `killed===0` | `packages/demo/src/td/winnable.ts:84-123` |
| TD 站点装配/校验 | `packages/demo/src/td/site.ts:92-175` |
| 格式分派 | `packages/demo/src/assemble.ts:17,53-66`；`packages/demo/src/shell/entry.ts:54-87` |
| 默认场景常量 | `packages/demo/probe/playtest/scenarios/five-state/success-basic.json:8-73` |
| 免费验收硬编码 wasteland 机制 | `packages/demo/probe/free-acceptance.mjs:43-48` |
| package scripts | `package.json:13-18` |

### 8.3 真实证据（E3）

| 证据 | 来源 / 适用边界 | 本票用途 |
|---|---|---|
| E-01 / E-02：`040b907` create、`5b8283f` 冻结 demo | 一个横版 Demo、一个设计样本；delivery 由 effort 脚本初始化 | A/B 的 collect/open/reach 交付级 E3；delivery 壳级 E3 缺口 |
| E-03：交付内 playtest v1/v2（harness/rules v1） | `5b8283f`；SUCCESS；pickup 4/chest 2/win 1 | 机制验收的样本；不能外推到 v2 CLI 写回 |
| E-04：06-attempt-1/2（harness/rules v2，直跑） | `5f29592`/`8e92c69`；未归因 | 证明 v2 harness 能跑；不证明 v2 CLI 写回 |
| E-07：人工视觉记录 | `f458beb`；9 张截图；身份匹配 | A/B 需要重新做人工审核；机器不重判 |
| E-08/E-09：证据完整性最终验收 / 本审计重跑 | `2c1a9d5`；223 文件、13 records、六项 match、只读 | 只证明冻结证据完整性，不证明新交付 |
| E-11：TD fixture 站点渲染 | `d3e9137`；fixture pack + fixture td-config；Canvas 回退、HUD 溢出 | C 的站点/渲染证据；不是 compile/玩法证据 |
| E-13：机制覆盖报告（fixture） | `2c1a9d5`；8 条机制；`avoid-danger` satisfied 但交付 config 无 danger | B 的「假 satisfied」实证 |

---

## 9. `UNKNOWN` / `BLOCKED` 清单

### 9.1 `BLOCKED`

| 项 | 为什么 | 解除需要 |
|---|---|---|
| 俯视角探索解谜作为第二 Demo 候选 | 当前运行时没有 top-down 相机、四向移动、交互/推箱/门/开关等机制；`game-config` 只有 side-scroll + collect-then-reach | 新 RuntimeProfile/运行时场景/纯层/配置形状/机制词表/Playtest 扩展；平台级决策 |
| `moving-platform` 作为核心机制 | 无运行时实现；设计 R12 拒绝；手写 `solid+motion` 外壳不移动（research 05 §3.6/§4.2） | 外壳实现 + witness + probe + Playtest 断言；新运行时能力 |
| 多关卡/关卡选择 | 一个配置文件 = 一个关卡；多关卡索引未定义（`game-config.ts` 文件头） | 新契约/索引形状；平台级 |
| 游戏内计时/限时、战斗、血量、AI、对话、分支结局 | 不在机制词表/配置枚举；R12 或 schema 拒绝 | 新机制 + 运行时 + Playtest 观测；平台级 |
| TD 作为「当前已支持的第二玩法」 | 无设计/QA/delivery/Playtest；compile 无真实 E3；Playtest 读不到 `td` 场景 | TD 交付链 + 观测/动作契约 + QA/delivery 语义；平台级 |

### 9.2 `UNKNOWN`

| 项 | 缺什么 | 为什么现在不能判 |
|---|---|---|
| TD 真实玩法（通关/失败） | 真实浏览器 Playtest | 只有 `td-sim`/参考玩家；E-11 是渲染，不是玩法 |
| `compile-td-game` 真实模型输出 | 一次真实编译 E3 | 只有 fixture td-config；无跟踪的 compile 输出 |
| HEAD 的 v2 CLI Playtest 归因/写回 | 一次 v2 CLI 真实运行 | 交付内报告是 v1；06 attempts 是直跑未归因（research 06 §4） |
| 当前 `buildAndSite` 的 delivery 壳级 E3 | 一次 `create --yes`/`build` 的真实交付信封 | 冻结 Demo 的 delivery 由 effort 脚本初始化（research 03 §0-8） |
| 平台跳跃关卡的普遍可通关性 | 平台求解器/真实多关卡运行 | 只有跳跃顶点 warning（`game-config.ts:494-506`） |
| 新 Demo 的人工视觉独立性/可重复性 | 第二次人工审核记录 | 只有一次记录；reviewer 是自由字符串（research 06 §5） |
| 免费路径能否验证完整生成/交付 | — | 生成需付费模型；`build` 每次 pack/compile；`playtest` 需 delivery + 浏览器 |
| 第二 Demo 的实际成本/工期 | — | 本票只估范围；无模型调用预算/时间数据 |
| A/B 的真实模型行为（是否按设计产出） | 付费真实生成 | 历史单样本不能外推；模型输出依赖真实上游 |

---

## 10. 审计限制与未完成事项

1. **只读**：未运行 `create/build/plan/pack/compile-*`、`playtest`、`test:playtest`、`review`、`review-verdict`、`playtest-baseline`、浏览器探针、`pnpm install`；未写历史/受跟踪目录；未提交/推送。
2. **没有新增真实证据**：所有 E3 都是既有产物；本票没有产生新的浏览器运行、模型调用或交付。
3. **单样本**：完整真实 E3 只覆盖 `wasteland-scavenger-recipe` 一个横版 Demo、一个设计、一个 site v1；不能外推到第二个玩法/设计/关卡（research 04 §5-3；05 §0-10）。
4. **历史 E3 不是 HEAD 重跑**：`040b907` / `5b8283f` / `f458beb` / `5f29592` / `d3e9137` 各有其来源 commit 与适用边界；生产代码在 `2c1a9d5..HEAD` 未变（本票已核对 `git diff` 为空），但历史运行仍不是 HEAD 重跑。
5. **行号以 `2c1a9d5` 为准**；当前 HEAD `264bda0` 只有审计 effort 文件（本票已核对生产路径 diff 为空）。
6. **没有做成本/工期估算**：本票只给「无/小/中/大」的范围；没有模型调用量、价格、时间数据，均为 `UNKNOWN`。
7. **没有替 HITL 定义「实质差异」阈值**：A/B 的差异是内容级/机制重心级，C 是类型级但当前不可交付；是否接受 A/B 由票 08 决定。
8. **没有设计实现**：B/C 的代码变更只列范围与受影响面，不是方案；C 的 RuntimeProfile/QA/delivery/Playtest 具体形状需要另立需求。
9. **免费验证可行性是静态判断**：本票没有执行 `test:mechanic`/`test:acceptance`/直接 harness；实际能否跑通取决于系统 Chrome、`dist/shell.js`、Node 22 与仓库布局（research 03 §7-D18/19；06 §1）。
10. **P0-01F 的「只推荐一个」不在本票完成**：地图 Q8 把比较与裁定分开；唯一候选由票 08 的 HITL 决定，P0-01F 的验收在 08/09 收口时满足。

---

## 11. 本票断言

- 未修改生产代码、契约、测试、fixtures、历史产物；只新增本文件并改票 07。
- 未运行任何生成/试玩/付费/浏览器命令。
- 所有候选都从当前运行时与机制支持度推导；没有按游戏类型偏好预设赢家。
- 没有宣布唯一候选；A/B/C 的证据强弱、风险高低与差异层级已列，最终选择留给票 08。
