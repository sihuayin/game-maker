# P0-02 v2：冻结 Demo 零付费正确性收敛（阶段 A）

Labels: wayfinder:map
Tracker: local-markdown
Effort: p0-02-second-demo-v2

> **本图 2026-10-29 开。** 旧图 [`p0-02-second-demo`](../p0-02-second-demo/map.md) 已按用户裁定 (e) 暂停并保持只读；本图不改写旧图、旧 effort 或任何历史产物。
> **终点形态（用户 2026-10-29 逐字裁定 Q1 = b）**：**承载阶段 A 的零付费执行** —— 在冻结 `wasteland-scavenger` Demo 上收敛六项正确性/证据链缺口；阶段 B（第二个独立 Demo 付费试跑）作为下游阻塞，本图不调用付费服务。
> **方向裁定 Q1–Q9（用户 2026-10-29 逐字）**：Q1 b · Q2 b · Q3 b · Q4 a · Q5 a · Q6 a · Q7 a · Q8 a · Q9 a。逐字记录见 [rulings-2026-10-29.md](rulings-2026-10-29.md)；本图只引用，不复述全文。
> **三条约束（用户 2026-10-29 逐字）**：① 免费测试不等于真实生成证据；② 不以修复数量作为验收标准；③ 不扩大本轮范围（Q3(b) 之外的 P1 不并入）。

## Destination

**阶段 A 完成**：在冻结 `wasteland-scavenger` Demo 上，以零付费方式收敛 P0-01 标记的六项正确性/证据链缺口 ——
覆盖门禁核验 config + probe 并落盘；hazard 真实正向断言；写回前校验 Demo 身份且失败重跑不遗留旧 pass；
HEAD harness/rules v2 写回 E3；默认 Playtest 场景与废土常量解耦；正式证据清单与 `verify-delivery` 生产路径。
每项有决策、红→绿测试、按需真实免费运行、身份一致与历史零改动证据。
**阶段 B**（第二个独立 Demo 付费试跑）由一张 blocked 启动闸控制，本图不调用付费服务。

## Notes

### 输入与权威

- P0-01 主文档：`docs/v7.6/p0-01-readonly-capability-audit.md`
- P0-01 决策报告：`.scratch/p0-01-audit/research/09-decision-report.md`
- 旧 P0-02 图（只读）：`.scratch/p0-02-second-demo/map.md` 与 `rulings-2026-10-29.md`
- 领域词汇：`CONTEXT.md` 是唯一权威；本图不新增同义词。
- 事实快照：[research/00-stage-a-facts.md](research/00-stage-a-facts.md)（2026-10-29 三组只读探查，含 file:line）。

### 基线（由票 01 冻结）

- 生产代码 HEAD：`f0411e6`（`main`，2026-10-29）；工作区干净。
- 旧 P0-02 基线：`4f3bc69`；P0-01 基线：`2c1a9d5`。`4f3bc69..f0411e6` 生产代码 diff 为空。
- 冻结 Demo 只读快照：`.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/`（66 文件，只读）。
- 可写工作副本：`.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/`；本图复制到 `.scratch/p0-02-second-demo-v2/work/`，不原地修改旧 work。
- 交付身份：`pack/v1/manifest.json`、`site/v1/site.json`、`run/v1/game-config.json`、`run/v1/qa-report.json` 的 `delivery`。
- 零付费事实：playtest 是本地 Chrome/CDP + 本地 HTTP，无模型调用；`pnpm build` 只写 `.gitignore` 的 `dist/` 与 `*.tsbuildinfo`。
- `pnpm test:evidence` 默认 `--out` 指向旧 effort；阶段 A 用 `pnpm build && node scripts/evidence-acceptance.mjs --out .scratch/p0-02-second-demo-v2/runs/evidence`，避免写历史。

### 阶段 A 范围清单（Q3 = b）

| # | 缺口 | P0-01 ID | 决策票 | 实施票 | 证据档位 |
|---|---|---|---|---|---|
| 1 | 覆盖门禁核验 config + probe，并落盘可审计报告 | G3-2 / G4-2 | [覆盖门禁输入与报告契约](issues/02-coverage-gate-inputs-and-report.md) | [覆盖门禁实施](issues/08-coverage-gate-implementation.md) | E2 + E3（probe 真实运行） |
| 2 | hazard 真实、明确的正向断言 | G3-5 / G4-1 | [hazard 正向断言](issues/03-hazard-positive-assertion.md) | [hazard 断言实施](issues/09-hazard-assertion-implementation.md) | E2 + E3（真实浏览器） |
| 3 | 写回前校验 Demo 身份；失败重跑不遗留旧 pass | G3-9 / G5-2 | [写回身份范围](issues/04-writeback-identity-scope.md) · [失败重跑撤销语义](issues/05-rerun-revocation-semantics.md) | [写回身份实施](issues/10-writeback-identity-implementation.md) · [失败重跑撤销实施](issues/11-rerun-revocation-implementation.md) | E2 + E3（成功/失败两次真实写回） |
| 4 | 补齐 HEAD harness/rules v2 写回 E3 | G2-2 | — | [Playtest v2 写回 E3](issues/14-playtest-v2-writeback-e3.md) | E3（真实 playtest 写回） |
| 5 | 默认 Playtest 场景与废土常量解耦 | G3-3 | [默认场景常量](issues/06-default-scenario-constants.md) | [默认场景实施](issues/12-default-scenario-implementation.md) | E2（+ 按裁定补 E3） |
| 6 | 正式证据清单 + `verify-delivery` 生产路径 | G5-3 | [清单生产路径](issues/07-manifest-production-path.md) | [清单生产实施](issues/13-manifest-production-implementation.md) | E2 + E3（清单 + verify-delivery） |
| — | 基线、工作副本与证据工作区 | — | — | [冻结阶段 A 基线](issues/01-freeze-stage-a-baseline.md) | E2（基线回归） |
| — | 阶段 A 收口与报告 | — | — | [阶段 A 收口](issues/15-stage-a-closure.md) | E2 + E3 |
| — | 阶段 B 启动闸（blocked） | — | [阶段 B 启动闸](issues/16-stage-b-start-gate.md) | — | HITL 裁定 |

E2 = 可复现测试；E3 = 真实免费运行 + 命令 / 退出码 / 路径 / 身份。决策票本身不产生 E3。

### 里程碑

- **M0 基线就绪**：票 01 关闭（HEAD / 身份 / 工作副本 / 备份 / 基线回归）。
- **M1 决策锁定**：票 02–07 关闭；任何契约/CLI 扩展已在票内明确批准或拒绝。
- **M2 修复转绿**：票 08–13 关闭（红→绿 + 目标测试）。
- **M3 真实免费证据**：票 14 关闭；写回 E3、身份一致、历史零改动。
- **M4 阶段 A 收口**：票 15 关闭；逐缺口结论 + 冻结快照 + `verify-delivery`；票 16 解锁（但仍需 HITL 裁定才可付费）。

### 执行规则（Q5–Q9）

- **代码授权（Q5 a）**：可改 `packages/**` 生产代码与测试；公共契约、CLI/MCP 接口、依赖保持不变。某项必须扩契约/CLI 时，在对应决策票内单独请求批准；不得隐式扩展。
- **证据标准（Q6 a）**：每项先红后绿；涉及写回、失败重跑、Playtest E3、清单的票必须有真实免费运行记录；身份一致；历史零改动。不是每项都要浏览器。
- **回归门禁（Q7 a）**：每票跑目标测试；收口跑 `pnpm test` / `pnpm typecheck` / 证据验收（`--out` 指向本 effort）。超时隔离重跑并记录命令/环境/退出码，不判能力失败、不静默宣称全绿。
- **工作树纪律**：不 `reset` / `clean`；不改旧 effort、旧 `work/`、历史 `run/vN`、`pack/site/vN`；真实运行只用本 effort 的可写副本；产物只写本 effort 目录或 `out/`。
- **零付费**：不调用模型/生图/付费上游；`playtest` 与本地测试免费。
- **提交纪律**：本图执行期间不提交、不推送；收口后单独请求授权。
- **人工视觉（Q9 a）**：阶段 A 不新增人工视觉审核；旧 PASS 只作历史身份绑定参考，不声称本轮新视觉通过。

### 阶段 B 启动闸（票 16）

只有同时满足才可启动：明确预算与单次成本上限；明确付费执行授权；明确执行护栏与停止条件；确认阶段 A 证据足以支撑第二个 Demo 试跑。条件满足前不调用付费服务，也不预拆 build / playtest / visual / freeze / verdict 详细票。

### 证据分级

E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径 + 身份）。阶段 A 的 E3 只证明冻结 Demo 上实际覆盖的行为，不外推到第二个独立 Demo。

## Decisions so far

<!-- 索引：每张关闭票一行，gist + 链接；详情只在票里。开图时为空。 -->
- [冻结阶段 A 基线、工作副本与证据工作区](issues/01-freeze-stage-a-baseline.md): 2026-10-29 冻结 HEAD `f0411e6`，生产代码与 `4f3bc69`/`2c1a9d5` 零 diff；95 文件可写副本与旧 work 全等、51 个身份文件与冻结快照 sha256 全等；基线 `pnpm test`（2231/2231）、`typecheck`、证据验收均 exit 0；旧 work/快照/历史零改动，零付费。
- [覆盖门禁：config + probe 输入与报告契约](issues/02-coverage-gate-inputs-and-report.md): 独立 `verify-mechanics` 跑 probe，`create` 只阻断 design/runtime/config 且不依赖 Chrome；`mechanic-coverage/v2`（subject + config 层 + probe 块），报告落 `run/vN/` 并进正式清单；`verify-delivery` 新增内容核验；同一 run 重跑 `build` 重置 probe；缺 probe 结果判 `failed`；API 直接升级、不保留 v1。
- [hazard 真实正向断言：事件、场景与契约](issues/03-hazard-positive-assertion.md): 定为 **probe-only**——hazard 运行时命中计数 + `READ_STATE` 暴露 hits + `hazard-contact` probe 进闭集；断言 hits≥1 且复位到 spawn（±5px）、无 console 错误；不扩 Playtest 事件/场景/证据规则；E3 = 生产 probe + 只读快照上的 effort-local 脚本（原样冻结 config）。
- [写回前校验 Demo 身份：范围与落点](issues/04-writeback-identity-scope.md): Playtest 写回要求 config/pack checksum 必须存在并重算比对、harness/rules 对常量比对，缺失/不符 exit 4；`review-verdict` 必填 `visual-review-record/v1`（记录权威，移除 `--reviewer`/`--note`），比对 subject 与交付及实际字节，要求 `delivery.site`，删除无 delivery 初始化分支；不改 PlaytestIdentity/DeliveryReport schema、不校验截图。
- [失败重跑不遗留旧 pass：撤销语义](issues/05-rerun-revocation-semantics.md): 采用「撤销 + 预失效」——run 可读且带 delivery 即移除 `delivery.playtest`、旧 `playtest-*` 引用并把 `playable-smoke` 置 `blocked`；成功写回恢复，有报告按 `mapPlaytest` 重算，无新摘要保持 blocked；新增 `playtest/invalidations/` 审计记录；不扩 delivery schema。
- [默认 Playtest 场景与废土常量解耦](issues/06-default-scenario-constants.md): 非默认 Demo 必须显式 `--scenario-dir`；CLI 用显式常量 `wasteland-scavenger-recipe` v1 + 现有 siteVersion 校验，未传目录且不匹配即 exit 4，诊断列出实际身份与所需断言；显式目录绕过检查；依票 05 旧 pass 先撤销为 blocked。
- [正式证据清单与 `verify-delivery` 的生产路径](issues/07-manifest-production-path.md): 新增 `build-evidence-manifest --spec <spec> --out <manifest> [--force]`；spec 声明 roots/subject/entries/records，生成器确定性展开、重算身份并原子写盘；任何缺失/record 不在 files/覆盖冲突/out 在 root 内均 exit 4；阶段 A 纳入旧 `fa04` 视觉记录作历史证据 + 覆盖报告 required record。
- [覆盖门禁实施：config + probe + 可审计报告](issues/08-coverage-gate-implementation.md): `mechanic-coverage/v2` 四层矩阵 + config 映射 + probe 块 + subject；create 门禁只阻断 design/runtime/config，站点装配后写 executed=false 报告；`verify-mechanics` 真跑 probe（exit 0/1/4）；`verify-delivery` 对 `role=mechanic-coverage` 做内容核验；E2 90 tests、E3 14s exit 0、qa-report 未改、历史零改动。
- [hazard 断言实施](issues/09-hazard-assertion-implementation.md): probe-only 落地——hazard 命中计数 + `READ_STATE.hazards[*].hits` + `hazard-contact` probe 进闭集；生产 probe 4/4，冻结脚本在只读快照上原样 config 命中并复位（exit 0 / 9s），快照零改动；不扩事件/场景/证据规则。
- [写回身份实施](issues/10-writeback-identity-implementation.md): Playtest 写回强制 config/pack checksum 存在并重算、harness/rules 对 v2 常量；`review-verdict` 必填 `visual-review-record/v1`（记录权威，移除 `--reviewer`/`--note`），校验 subject/overall，删除无 delivery 初始化；负向旧 v1 报告被拒，正向真实 v2 写回 exit 0 / 24s。
- [失败重跑撤销实施](issues/11-rerun-revocation-implementation.md): run 可读且带 delivery 即先撤销——移除 `delivery.playtest` 与旧 `playtest-*` 引用、`playable-smoke=blocked`、重算 verdict、写 `playtest/invalidations/`；准备拒绝 E3 exit 4 已先撤销，成功恢复 E3 exit 0 / 19s；无结果/硬崩溃由单元测试覆盖。
- [默认场景实施](issues/12-default-scenario-implementation.md): 默认五态目录只服务 `wasteland-scavenger-recipe` v1；未传 `--scenario-dir` 且身份不符即 exit 4，诊断列出实际 pack/site/pickup/chest 并提示提供匹配场景；显式目录绕过；非默认 E3 exit 4、默认 wasteland E3 exit 0 / 19s。
- [清单生产实施](issues/13-manifest-production-implementation.md): 新增 `build-evidence-manifest --spec/--out [--force]` 与 spec 生成核心（确定性、subject 实算校验、out 在 root 外、拒绝覆盖）；阶段 A 清单 217 文件 / 6 records，`verify-delivery` exit 0 / 诊断 0；纳入旧 fa04 视觉记录与 `mechanic-coverage` record。
- [Playtest v2 写回 E3](issues/14-playtest-v2-writeback-e3.md): 阶段 A 可写副本上真实 playtest **exit 0 / 20s / attempt v3**；默认 `success-basic` SUCCESS；身份六字段 + harness/rules v2；撤销后恢复 `playable-smoke=pass`、`verdict=pass`；旧 v2 引用被 v3 替换；历史零改动。
- [阶段 A 收口：回归、冻结与逐缺口结论](issues/15-stage-a-closure.md): 7 项缺口全部 closed（限制见 final-report §5）；回归三件套全绿；freeze 112 文件只读 + 最终清单 231 文件 / 6 records + `verify-delivery` pass / 诊断 0；旧 work/快照/旧 effort 零改动；零付费、未提交；票 16 解锁但未授权付费。

## Not yet specified

- **阶段 B 的具体执行链**：新 intent、参考图、资源包、`create` checkpoint、付费 `build`、Playtest 场景、人工视觉、冻结与最终 verdict；只保留票 16 启动闸，细节等阶段 A 结果与新输入。
- **清单生成器与 `test:evidence` / CI 的集成方式**：是否把阶段 A 冻结交付纳入正式回归；生成器形状已由票 07 定死，集成方式由票 13 / 15 决定。
- **阶段 A 结果后的 P1 排序**：可通关求解器、moving-platform 全链、全面错误语义、nonce/版本强制；不预切。
- **是否在阶段 A 后重访旧 P0-02 的付费范围**：由票 16 与后续 HITL 决定。

## Out of scope

- 本图内的一切付费模型/生图调用；阶段 B 的 `build` 与新独立 Demo 生成。
- 改写旧 `p0-02-second-demo` effort、旧 work、历史 run/pack/site/delivery/验收报告。
- Q3(b) 之外的 P1：可通关求解器、moving-platform 全链、全面错误语义治理、nonce/版本强制；阶段 A 结果后再单独排序。
- 把 B 作为 Demo 候选；本图只处理 B 假绿链中的 correctness 半边（hazard / 覆盖门禁），不重开 B 试跑。
- MCP 镜像 `verify-delivery` / 清单生成。
- 未经单票批准的公共契约、CLI/MCP 接口、依赖变更。
- 对冻结 Demo 的重复人工视觉审核（Q9）。
- 执行期间提交/推送；任何未获授权的付费调用。
- 用历史 E3 替代阶段 A 的新证据；把测试绿、fixture 或冻结 Demo 证据外推为第二个独立 Demo 的 E2E。
