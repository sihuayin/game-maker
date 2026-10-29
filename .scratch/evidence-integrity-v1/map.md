# 证据完整性与结论重算（Evidence Integrity V1）

Labels: wayfinder:map
Tracker: local-markdown
Effort: evidence-integrity-v1

> **本图 2026-10-29 开。** 输入：`docs/v7.6/验收.md`（P0 · Evidence Integrity V1：交付证据完整性与可复核验收）。
> **终点形态（用户 2026-10-29 逐字裁定 Q1 = (a)）**：**承载执行** —— 在 main 上真正落地的正式验收能力，
> 而不是停留在审计报告或规格文档：实现 + 负向测试 + 冻结 FPVS-V1 基线重验 + 新验收记录，按 §12 DoD 收口。
>
> **方向裁定 Q1–Q16（用户 2026-10-29 逐字）**：
>   Q1 **(a)** 承载执行；Q2 **(c)** 校验器通用、接受显式交付根，V1 真实重验只做冻结 FPVS-V1；
>   Q3 **(a)** 入库的期望哈希清单 = 信任锚，git 提交固定，校验器只读不回写；
>   Q4 **(a)** 产品 CLI 子命令，核心在 `packages/pipeline`，本票不扩 MCP；
>   Q5 **(a)** `07-verify-inherited.mjs` 的 27 项全部纳入并补齐（路径安全 / 可读性 / 引用解析 / 结论一致性）；
>   Q6 **(a)** 单一 JSON 清单 = 输入契约 + 唯一期望哈希来源（`roots` / `subject` / `files[]` / `records[]`）；
>   Q7 **推荐映射** 确定性矛盾 → `fail`；必需前置缺失/不可读/身份缺失 → `blocked`；清单无效 → `EXIT.invalid(4)` 且不产出正式报告；
>   Q8 **(a)** pipeline 内本地 zod schema（`delivery-verification/v1`），JSON + Markdown，目录原子分配、绝不覆盖；
>   Q9 **(a)** 清单声明多个 root，CLI 只认 `--manifest`；`--out` 位于任何声明 root 内 ⇒ `usage` 错误；
>   Q10 **(a)** `mkdtemp` 合成小 fixture 做负向测试；冻结基线重验单独作为证据运行；
>   Q11 **(a)** 退出码 `pass→0` / `fail|blocked|incomplete→1` / 用法错→`2` / 清单或交付无效→`4`；新增 `pnpm test:evidence`，不并入 `pnpm test` / `test:acceptance`；
>   Q12 **(a)** 清单 `subject` 是唯一期望身份；qa-report、两份 playtest result、FA-04 `review-record`/`capture`/`materials`、FA-09 `supplement` 必须带身份且逐字段匹配；缺 ⇒ `blocked`，不符 ⇒ `fail`；
>   Q13 **(a)** 六项检查**由当前证据逐项重导出**，不重新执行游戏/QA/试玩；`declared[]` 与 `recomputed[]` 并列；
>   Q14 **(a)** 双端 `realpath` + 规范化路径组件包含性检查；root 内链接允许，越界/悬空链接拒绝；
>   Q15 **(a)** 清单期望值、证据自述值、实际文件哈希**三方比对**，矛盾 ⇒ `fail`（只增加矛盾检测，不宣称更强防篡改）；
>   Q16 **(a)** 在 `docs/v7.6/验收.md` 末尾追加「实施裁定补充」，原文一字不改；map 只放指针。
>
> **三条实施约束（用户 2026-10-29 逐字）**：
>   ① 通用入口不等于虚构产品证据 —— CLI 接受显式交付根，但必须区分「实际存在可验证的证据 / 需明确参数提供的外部继承证据 / 当前交付模型尚不支持的证据类型」；
>      不得假定 `out/<gameId>/run/vN` 已包含 `.scratch/fpvs-v1-final` 的所有继承证据，不得为通用化修改现有 `delivery` schema；
>   ② 期望哈希清单必须先冻结、再开始负向测试 —— 只读审计 → 从冻结基线生成 → 审查并随 git 提交固定 → 校验器只读、绝不自动更新 → 隔离副本篡改验证；
>   ③ 保留 `07-verify-inherited.mjs` 的独立性 —— 正式校验器不得只调用它并继承退出码，负向测试也不得只验证 07 自身；两套结果应可比较、差异可解释。
>
> **执行边界（用户 2026-10-29 逐字）**：只在 main 增量实现；不覆盖历史验收证据；不改冻结 Demo 的 `pack/site`、Runtime、配置或资源；
> 不新增付费调用 / 不重新生图；不增加 MCP 镜像；不扩展无关 contracts；失败只报告不自动修复；结论规则统一、不得因无法判定而默认 `pass`；
> 历史限制继续如实披露（证据完整性通过 ≠ 游戏所有功能完成验收）。
>
> **执行顺序（用户 2026-10-29 逐字）**：Phase 0 只读审计 → 清单冻结 → 正式实现（pipeline + CLI + 报告 schema）→ 负向测试 → 冻结基线重验 → DoD 收口。
> **最终原则**：旧的 `pass` 是历史事实；只有当前证据完整性校验通过、六项检查从有效证据重算成功、声明与重算结论一致，才可把 `pass` 作为本次正式验收结论。

## Destination

在 `main` 上落成一条**可重复执行的正式证据完整性验收路径**：从 git 固定的期望哈希清单出发，
对显式交付根源码级重算全部必需证据的 SHA-256、校验路径安全 / 身份 / 引用 / 报告内部一致性，
并按既有 `deriveDeliveryVerdict` 规则从当前证据重导出六项交付检查（`declared` 与 `recomputed` 并列）；
用负向测试证明篡改、缺失、不可读、身份/引用错配、路径逃逸与结论过期都会让结论不再是 `pass`；
最后对冻结 FPVS-V1 完成基线重验并留下新的、不覆盖历史的验收记录，收口 `docs/v7.6/验收.md` §12 的 10 条 DoD。

## Notes

- **输入（只读）**：`docs/v7.6/验收.md` 是需求规格；Q1–Q16 裁定由票 01 追加为其末尾的「实施裁定补充」，
  原文一字不改。`CONTEXT.md` 是领域词汇唯一权威（`DeliveryCheckStatus` / `DeliveryVerdict` / `delivery` 见「交付与调用」节）。
- **验收对象**：冻结 FPVS-V1 交付 —— 只读快照 `.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/`
  （`dr-xr-xr-x`，66 文件）+ 可写工作区 `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/`
  + 继承证据（FA-04 `runs/2026-10-28-visual-review/`、FA-05 `runs/2026-10-28-final-acceptance/`、
  FA-06 `runs/2026-10-28-regression-closure/`、本轮 `.scratch/generic-playtest-v1/evidence/06-attempt-{1,2}/` 与 09 补审）。
- **信任根**：期望哈希清单位于仓库内并随 git 提交固定；能与清单比对的只有「相对清单的改动」，
  发现不了「清单随证据一起被改并提交」—— 后者由 git 提交历史与人工审查负责，报告必须如实声明这条边界。
- **现状事实（2026-10-29 E1 源码审计）**：
  ① 正式交付路径**不重算任何文件哈希**：`DeliveryReportSchema.superRefine`（`packages/contracts/src/delivery.ts:172-257`）
     只做 schema 自洽校验；`delivery.evidence` 只有 `{ref, path}`，无哈希、无身份。
  ② 证据核验全部在 effort 脚本：`.scratch/generic-playtest-v1/scripts/07-verify-inherited.mjs`（27 项）。
  ③ 六项必需检查是代码固定注册表 `DELIVERY_REQUIRED_CHECKS`；加第七项属 schema 级变更，本票不做。
  ④ 退出码表：`EXIT = { ok:0, failure:1, usage:2, upstream:3, invalid:4 }`（`packages/contracts/src/command.ts`）。
  ⑤ 报告目录版本化先例：`writeAcceptanceReport` 用 `mkdirSync` 原子分配、EEXIST 试下一个 N（`packages/assets/src/acceptance.ts:840`）。
  ⑥ `.scratch` 整体入库（fpvs-v1-final 511 文件、generic-playtest-v1 202 文件，含截图与 trace）；
     `generic-playtest-v1/evidence` 约 187MB、`fpvs-v1-final` 约 31MB —— `test:evidence` 的真实耗时必须在票面量一次。
- **六项重导出定义（Q13）**：`asset-pack`→`verifyPack`；`config`→实际哈希 vs 身份声明；`qa`→`qaVerdict(report)`；
  `site`→站点四文件 + `site.json` 引用 + 配置哈希 + `site-integrity`；`playable-smoke`→`playtestSummaryOf` + `mapPlaytest`；
  `visual-review`→记录完整性 / subject / 与 `delivery.visualReview` 一致（不重判人工结论）。**不重新执行游戏**。
- **路径安全（Q14）**：root 与目标文件都 `realpath`；包含性按规范化路径组件判断，不用字符串前缀；
  测试五类：`..` 越界、绝对路径越界、root 外符号链接、悬空链接、root 内合法链接。
- **负向测试（Q10）**：`mkdtemp` 合成 3–5 文件迷你交付 + 迷你清单；覆盖 PRD §8 全部类别 + Q14 五类 + 重复执行一致性 + 运行前后全量哈希不变。
- **报告（Q8）**：`delivery-verification/v1` 本地 zod schema；每次运行独立目录，`report.json` 与 `report.md` 描述同一次运行；
  包含输入清单 SHA-256、`subject`、`declared` vs `recomputed`、逐文件预期/实际/结果、身份/引用/一致性诊断、最终状态与退出码、信任边界、已知限制与本次检查范围。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径 + 身份）。本图收口要求 E2 + E3。
- **工作树纪律**：不改 `fixtures/`、`game-maker.local.json`；不 `reset`/`clean`；不提交/推送除非单独授权；
  测试产物只写 `out/` 或本 effort 目录；历史 `run/vN` / `pack/site/vN` / 报告零改动。
- **不做**：不修历史记录去迁就身份契约（差异如实上报，由票 03 决定纳入方式）；不因校验器无法判定而默认 `pass`；
  不把证据完整性通过解释为五态 E2E、机制覆盖或视觉审核范围已完成。

## Decisions so far

<!-- 索引：每张关闭票一行，gist + 链接；详情只在票里 -->

- [裁定归档：把 Q1–Q16 追加到 `docs/v7.6/验收.md`](issues/01-archive-rulings-in-prd.md)：**已收口** —— PRD 末尾新增 A1–A10（16 条裁定 / 三条约束 / 清单形状 / 状态映射 / 六项重导出 / 入口与退出码 / 路径与三方哈希 / 只读与负向测试 / Phase 0 前置 / 执行顺序）；原文前 20,518 字节 sha256 `780dd22a…7f0e` 逐字节不变（追加后前缀哈希一致）。
- [Phase 0 只读审计：记录 schema、证据依赖图与差距清单](issues/02-phase0-readonly-audit.md)：**已收口** —— 正式路径不重算哈希、07 为唯一核验器（27 项）；`hashes.json` 只覆盖 66 snapshot + 14 reference、work 未列且已增至 95；身份矩阵可用（`packChecksum` ↔ `manifestChecksum` 等映射）；差距 EI/AC 清单 + 最小改动方案 + 清单冻结前 D1–D12 裁定项。全案：[research/phase0-audit.md](research/phase0-audit.md)。
- [冻结期望哈希清单（唯一信任锚）](issues/03-freeze-expected-hash-manifest.md)：**已收口** —— 191 文件（147 required / 44 optional，约 18.4 MB）、13 条 records（11 条身份）、9 个 roots（out/snapshot/reference/artifacts/fa04/fa05/fa06/runs/gp）；D1–D12 落定（双 playtest 来源、work 显式枚举、reference optional、`*.log` 排除）；覆盖自检 materials 44/44 + evidence 36/36 + attempt 18/18；清单 sha256 `6efd248c…3fdf2`，随提交固定、校验器只读不回写。

## Not yet specified

- **清单再生成策略**：交付更新 / 出现第二版后，如何生成新清单、旧清单如何并存与指向（V1 只冻结一份，未定）。
- **验收报告的证据化**：`delivery-verification` 报告本身是否作为下一轮的证据登记、以及如何避免自指（未定）。
- **性能与规模**：`test:evidence` 读取约 200MB 证据的真实耗时与 CI 可用性（票 05 量，之后可能引出缓存/裁剪策略）。
- **第二个真实 Demo 的泛化验证**：PRD §R3 明确留待后续阶段，本图不做。

## Out of scope

- 生成新游戏 / 关卡 / 资源 / 运行时代码；提高生图质量或调整 Prompt（PRD §2.2）。
- 第二个真实 Demo；纵向巡逻 / 定时喷发的真实端到端验证。
- 新的人工审核工作流、截图系统或视觉评分系统；把人工审核记录自动转换为机器验证成功。
- 重构整个 QA / Playtest / Delivery 架构；修改 `delivery.playtest` / `qa-report` / `delivery` schema。
- 修改已有验收阈值让历史证据通过；新增付费模型调用或新依赖。
- 扩展为跨游戏共享知识或跨项目迁移机制。
- MCP 镜像本能力（用户 2026-10-29 裁定 Q4 = (a)：本票不做）。
- 自动修复证据 / 回写哈希清单 / 重新生成资源。
