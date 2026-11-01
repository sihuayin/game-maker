# P0-04：双基线可信 CI 接入

Labels: wayfinder:map
Tracker: local-markdown
Effort: p0-04-dual-baseline-ci

> 本图 2026-11-01 开。输入：`docs/v7.6/接入.md`（P0-04 PRD，**只读冻结**，原文不改）。
> **终点形态（用户 2026-11-01 裁定 Q1 = a）**：**承载执行** —— 在 `main` 上真正落成双基线可信 CI，并完成真实 GitHub PR 红绿验收，而不是停在方案。
> **Q1–Q7、R2-Q1–R2-Q6 已收敛**；逐字记录见 [rulings-2026-11-01.md](rulings-2026-11-01.md)。本图只引用，不复述全文。
> **结构**：8 张票 —— 01 只读审计（硬门槛）、02 registry 研究、03 registry/更新通道裁定（HITL）、04 B 锚点、05 Evidence CI、06 Baseline Update、07 真实 PR 红绿、08 收口。
> **02 已收口（2026-11-01）**：研究产出 [registry-trust-boundary.md](research/registry-trust-boundary.md)；18 项待裁定问题已交给 03；关键事实（A/B 73 个路径重叠）已回灌 05/07。
> **01 已收口（2026-11-01，PASS）**：A 223/151/72/13 与 B 231/137/94/6 全部逐文件 verified；A `sha256:ba7a485b…36fd` = Anchor = 更新日志，B `sha256:07866e0e…b9ab` = final-verdict；freeze 112/112 哈希一致，2 个 chrome.log 已解释；A/B 73 路径重叠已复核；CLI A/B 均 exit 0 / pass / 0 诊断。报告：[report.md](runs/2026-11-01T12-28-50Z-baseline-audit/report.md)。
> **03 已收口（2026-11-01）**：Q1–Q11 全部裁定 —— 集中式 Registry + `freezeHashes`（B 必填）；A 保持 Manifest-only、B 全量比较；owner PR + 只读 dispatch；单 job 双 step 完整聚合；`evidence-acceptance` 可选 `baselineId`；旧 `check-manifest-updates` 零改动 + 新 wrapper；112 冻结文件全部按 required 验证；05 引入 Registry，06 依赖 05。详见 [03](issues/03-registry-shape-and-isolation-ruling.md)。

## Destination

两套**独立**冻结交付基线（A：FPVS-V1；B：P0-02 Second Demo V2）各自拥有独立 Manifest 与 SHA-256 信任锚，并同时受同一套**普通 PR 无法伪造**的可信 CI 保护：

1. **独立验收**：A/B 各自定位 Manifest、读取 Anchor、验证 151/137 个 required 文件、逐条报告 optional；A PASS 不得掩盖 B FAIL，反之亦然。
2. **Base-only 信任**：workflow、CLI、registry、Manifest、Anchor、更新日志全部从受保护 base 读取；PR head 只作为不可信数据。
3. **普通 PR 不可自证**：修改交付文件、Manifest、Anchor、registry 或验收规则，任一组合都不能让 `evidence` 通过。
4. **受控更新**：基线更新只能经 owner 专用通道；更新 A 不改变 B，更新 B 不改变 A；失败无半更新。
5. **真实红绿**：1 个 docs-only 正常 PR 全绿并合并；4 个负向 PR（A 篡改 / B 篡改 / B Manifest+Anchor 联合篡改 / 验收规则篡改）分别被拦截。
6. **零回退、零付费**：原 FPVS-V1 的 223/151/72/13、A 的 Anchor 与更新日志、四项 required checks、ruleset 行为零回退；全程零付费、零生图、零模型调用、零冻结交付修改。

## Notes

### 权威与输入

- PRD（只读）：`docs/v7.6/接入.md`。
- 裁定（冻结输入）：[rulings-2026-11-01.md](rulings-2026-11-01.md)。
- 前序已完成能力（不重写）：[`p0-03-evidence-trust/map.md`](../p0-03-evidence-trust/map.md) · [`docs/adr/0001-evidence-trust-boundary.md`](../../docs/adr/0001-evidence-trust-boundary.md)。
- 领域词汇：`CONTEXT.md` 是唯一权威；本图不新增同义词，决策不写进词汇表。
- Tracker：local-markdown（`.scratch/p0-04-dual-baseline-ci/`）。

### 已核实事实（2026-11-01，只读）

| 事实 | 值 |
|---|---|
| 当前分支 / HEAD | `main` / `25985da`；工作区仅 `docs/v7.6/接入.md` 未跟踪 |
| 基线 A Manifest | `.scratch/evidence-integrity-v1/manifest/expected-hashes.json` |
| A 规模 / 摘要 | 223 文件（151 required / 72 optional）· 13 records · 9 roots；原始字节 SHA-256 `sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd` |
| A Anchor / 更新日志 | `.scratch/evidence-integrity-v1/manifest/expected-hashes.sha256` / `MANIFEST-UPDATES.md`（最后一条 `newSha256` 与当前 Manifest 匹配） |
| 基线 B Manifest | `.scratch/p0-02-second-demo-v2/manifest/final-manifest.json` |
| B 规模 / 摘要 | 231 文件（137 required / 94 optional）· 6 records · 3 roots；原始字节 SHA-256 `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab`；66,336 B |
| B 当前验收 | `verify-delivery` **exit 0 / status=pass / diagnostics 0**（2026-11-01 01 审计复验，未带 anchor；报告 `runs/2026-11-01T12-28-50Z-baseline-audit/cli/B/`） |
| B Anchor / 更新日志 | **均不存在**（04 票新建；Q6/R2-Q6 对称布局） |
| B 冻结快照 | `.scratch/p0-02-second-demo-v2/freeze/wasteland-scavenger-recipe/`，**112 文件**（只读），逐文件哈希 `freeze-sha256.txt` |
| B 三个 root | `fa04` → `.scratch/fpvs-v1-final/runs/2026-10-28-visual-review`（28，全 required）；`oldWork` → `.scratch/fpvs-v1-final/work`（93，全 optional）；`out` → B `freeze/`（110：109 required + 1 optional）；合计约 **33 MB** |
| 冻结 vs 清单差异 | freeze **112** = 清单 `out` **110**（109 required + 1 optional）+ **2** 个旧 attempt 的 Chrome 日志（`run/v1/playtest/v1/chrome.log`、`run/v1/playtest/v2/chrome.log`）；2 个日志被 spec `excludeExt: [".log"]` 排除，仅由 `freeze-sha256.txt`（112/112 哈希一致）覆盖；成功 attempt 的 `v3/chrome.log` 由 spec 显式列为 **optional**。清单“列了但磁盘没有” = 0。**`freeze-sha256.txt` 本身未被 231 清单或 Anchor 钉住；03/05 必须裁定或显式记录。** |
| A/B 路径重叠 | **73 个绝对路径重叠**：28 个双方 required（`fa04`）、30 个 A required / B optional（`fpvs-v1-final/work`）、15 个双方 optional；B 独占 109 个 required（`out`/freeze）。01 审计复核：28 / 30 / 15，重叠文件哈希 0 不一致。**07 的 A/B 负向样本必须使用各自独占 required 路径，否则无法证明“不相互掩盖”。** |
| 01 审计 | **PASS** · [report.md](runs/2026-11-01T12-28-50Z-baseline-audit/report.md) · `facts.json`；审计前后证据/配置哈希 **0 变化**；`git status` 仅新增本 effort `runs/` 下 4 个 CLI 报告 |
| 现有 workflow | `.github/workflows/ci.yml`（check/test/typecheck）、`evidence.yml`（base-only `pull_request_target`）、`baseline-update.yml`（owner `workflow_dispatch`，只验证候选、不写回） |
| 现有 required checks | `check` / `test` / `typecheck` / `evidence`；app id `15368`；ruleset `26268801` active；owner `pull_request` bypass |
| 现有 evidence 体积 | sparse tracked 约 51–57 MiB；加 B 三个 root 约 +33 MB，仍远低于 30 分钟超时 |
| Registry 目标位置 | `.scratch/baselines/registry.json`（R2-Q3 a）：只声明基线 ID、Manifest/Anchor/更新日志路径与身份信息，**不存摘要** |
| ADR | `docs/adr/0001-evidence-trust-boundary.md` 已存在；08 票决定是否续写/新增 |
| 词汇表 | `CONTEXT.md` 目前无“交付基线 / 信任锚 / registry”词条；是否新增由 03/08 决定 |

### 信任链（Q6 + Q7 冻结）

```
受保护的 base
  ├── workflow（evidence.yml / baseline-update.yml）
  ├── verify-delivery CLI + evidence-acceptance 脚本
  ├── registry.json（只声明身份与路径，不存摘要）
  ├── Baseline A：Manifest A + Anchor A + 更新日志 A
  └── Baseline B：Manifest B + Anchor B + 更新日志 B
         │
         ▼
    可信验收执行环境
         │
         ├── 读取 PR head 的交付文件/Manifest/Anchor/registry（只读，不执行）
         ├── 分别验证 A、B 的 required 文件与 optional 状态
         └── 汇总：任一基线失败 ⇒ evidence FAIL
```

**禁止**：从 PR head 读 registry/Manifest/Anchor/验收规则；执行 PR head 的 workflow/脚本/CLI；把 PR 路径拼进 shell；提供 secrets；授予写权限；让 PR 用自己改过的 Manifest 或 registry 验证自身。

### 执行规则（裁定摘要）

- **硬门槛**：01 未 PASS，禁止进入 03 及后续；冻结身份/哈希不一致 ⇒ 停止全图，不自行修复。
- **PR 纪律**：不得直接 push `main`；每票一个 PR（R2-Q4 a）；实施 PR 满足审查 + required checks 全绿后可合并（Q4 b）；07 的负向 PR 创建前必须取得用户确认，创建后只保留失败证据、不合并。
- **Registry**：只声明身份与路径，不存摘要；CI 只从 base 读取；更新只走受控 owner 通道，并验证变更前后身份、路径与隔离关系。
- **B 锚点**：不得只写人工常量；04 必须记录完整摘要、计算对象、计算方式和冻结来源，独立复算后才写入。
- **A 零改动**：A 的 Manifest、Anchor、更新日志、223 文件、四项 required checks、ruleset 行为全部零回退；扩展 `check-manifest-updates` 必须证明 A 行为不变。
- **真实验收**：负向 PR 不得相互替代；08 必须如实报告 owner-only 限制，不得声称已证明非管理员无法绕过。
- **零付费 / 零冻结修改**：不调用模型/生图/付费上游；不改 A/B 冻结交付、不重生成 Manifest、不合并两套 Manifest、不把 optional 提升为 required。
- **提交纪律**：研究产出可写本 effort 的 `research/`；代码/配置变更一律走 PR；不提交/推送研究草稿，除非随对应票据 PR 一起。

### 票与依赖

| 票 | 内容 | 类型 | Blocked by | 证据档位 |
|---|---|---|---|---|
| [01 只读审计：A/B 身份与冻结不变性](issues/01-readonly-dual-baseline-audit.md) | 231/137/94/6、112 快照、路径安全、A 零变化 | task (AFK) | — | E2 + E3（审计报告） |
| [02 Registry 信任边界研究](issues/02-registry-trust-boundary-research.md) | 双基线独立性与 registry 自证风险 | research (AFK) | — | 研究文档（已收口） |
| [03 Registry 形状、隔离与更新通道裁定](issues/03-registry-shape-and-isolation-ruling.md) | schema、位置、更新语义、base-only 约束 | grilling (HITL) | 01, 02 | HITL 裁定 |
| [04 基线 B 独立锚点与更新日志](issues/04-baseline-b-anchor-and-update-log.md) | B Anchor + B 更新日志 + 格式校验 | task | 03 | E2 + E3（独立复算） |
| [05 Evidence CI 双基线验收](issues/05-evidence-ci-dual-baseline.md) | Registry + workflow、sparse、A/B steps、汇总、wrapper、测试 | task | 03, 04 | E2 + E3（真实 run） |
| [06 Baseline Update 双基线通道](issues/06-baseline-update-dual-channel.md) | 显式 target、身份/一致性校验、原子性、`freezeHashes` 不可被普通更新改写 | task | 03, 04, 05 | E2 + E3（dispatch） |
| [07 真实 GitHub PR 红绿验收](issues/07-real-pr-red-green-acceptance.md) | 1 绿 + 4 红，记录 URL/SHA/run/check | task (HITL) | 05, 06 | E3 |
| [08 最终验收报告、ADR 与维护文档](issues/08-final-report-adr-and-maintenance.md) | AC 矩阵、双基线结论、限制 | task | 07 | E2 + E3（汇总） |

### 依赖顺序（03 裁定）

`01, 02 → 03 → 04 → 05 → 06 → 07 → 08`；05 引入 Registry，06 依赖 05；05 的 bootstrap 由可信 base 上的旧 workflow 执行 owner dispatch 验证候选。

### 证据分级

E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径 + 身份）。本图收口要求 E2 + E3；不得用本地模拟替代真实 GitHub PR 验收。

## Decisions so far

<!-- 索引：每张关闭票一行，gist + 链接；详情只在票里。开图时为空。 -->

- [Registry 信任边界与双基线独立性研究](issues/02-registry-trust-boundary-research.md)：**已收口** —— registry 只是路由表，信任仍来自 base + 各自 Manifest/Anchor；head registry 建议字节相等 FAIL（03 待裁定）；A/B 有 73 个绝对路径重叠（28 个双方 required），07 负向样本必须用各自独占 required 路径；更新通道建议 owner PR + 只读 dispatch；18 项 OD 交给 03。研究全文：[registry-trust-boundary.md](research/registry-trust-boundary.md)。

- [只读审计：基线 A/B 身份与冻结不变性](issues/01-readonly-dual-baseline-audit.md)：**PASS** —— A 223/151/72/13、`sha256:ba7a485b…36fd`（= Anchor = 更新日志）；B 231/137/94/6、`sha256:07866e0e…b9ab`（= final-verdict）；454 个清单条目全部 verified；freeze 112/112 哈希一致，差集 2 个 chrome.log 为旧 attempt 日志（spec `.log` 排除，v3 显式 optional）；A/B 73 路径重叠（28 双方 required）；CLI A/B 均 exit 0 / pass / 0 诊断。[报告](runs/2026-11-01T12-28-50Z-baseline-audit/report.md) · [PR #11](https://github.com/sihuayin/game-maker/pull/11)。

- [Registry 形状、双基线隔离与更新通道裁定](issues/03-registry-shape-and-isolation-ruling.md)：**已收口** —— 集中式 `.scratch/baselines/registry.json` + 严格 schema + `freezeHashes`（B 必填、A 不需要）；Registry 字节相等、A 只比 Manifest、B 比 Manifest+Anchor+日志+`freezeHashes`；owner PR + 只读 dispatch，`baseline` 必填、diff 白名单、`freezeHashes` 不是普通更新目标；单 job 双 step 完整聚合 + 三份 artifact；`evidence-acceptance` 可选 `baselineId`；旧 `check-manifest-updates` 零改动 + 新 wrapper；112 冻结文件全部按 required 验证；05 引入 Registry，06 依赖 05。

## Not yet specified

- **05 合并后首次真实 B step 的探测方式**：`pull_request_target` 使“引入 B 检查的 PR”本身仍跑旧 base workflow；05 合并后用哪个 PR 做首次真实 B 探测（临时正常 PR 还是 07 的绿色 PR）取决于 05 的 E3 安排与授权。
- **08 如何披露 A/B 共享 73 个路径**：“逻辑独立、物理证据部分重叠”的具体措辞与 AC 映射，要等 07 的真实失败归属证据。

## Out of scope

- 生成第三个 Demo；修改游戏 Runtime、游戏设计、资源生成或 Playtest 流程。
- 修改 P0-02 冻结交付物或 FPVS-V1 原始交付物；重新生成正式 Manifest；合并两个 Manifest；把 Optional 提升为 Required。
- 新增第三个基线或把 registry 通用化为 N 套基线（本图只要求 A/B；扩展性不作为验收）。
- 新增 required check、修改 ruleset 或降低原有保护等级（Q5 a）。
- 引入第二非管理员账号作为真实 PR 验收前置（Q7 a；仅可选升级，不是本图交付）。
- 付费 API、生图、模型调用、新的 Provider 或 Provider Switch；修改现有游戏生成管线业务逻辑。
- 签名、外部时间戳、仓库外锚；对管理员/GitHub 管理权限/CI 执行环境被攻陷的防御。
- 自动修复证据、回写 Manifest、自动更新基线；普通 PR 获得 trust root 修改能力。
- 通过普通基线更新通道重写 B 的 `freeze-sha256.txt` 或重新冻结 112 文件快照；若未来需要，另立裁定与新的冻结版本（03 Q3 锁定）。
- 把 P0-04 解释为“第二个独立 Demo 已完成端到端生成验收”。
- 修改 `docs/v7.6/接入.md`；直接 push `main`；合并任何负向 PR。
- 将人工视觉审核自动化；把证据完整性通过解释为游戏全部功能验收。
