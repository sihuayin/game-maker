# Registry 信任边界与双基线独立性研究

- 票据：`.scratch/p0-04-dual-baseline-ci/issues/02-registry-trust-boundary-research.md`
- 日期：2026-11-01
- 状态：研究产出，供 03（HITL）裁定；**本文件不替用户做架构决策**
- 输入：`docs/v7.6/接入.md`（只读冻结）、`rulings-2026-11-01.md`、`map.md`、P0-03 map 与 ADR 0001、现有 workflow/CLI/scripts、A/B Manifest 与 A 的 Anchor/更新日志
- 只读声明：本研究未修改代码、workflow、Manifest、Anchor、更新日志或 git 历史；除本文件外未写入仓库。未运行 `pnpm install`、构建或测试，未调用付费服务。

## 0. 结论摘要

1. **只存身份与路径的 registry 不是信任根。** 它只是“基线 ID → Manifest / Anchor / 更新日志路径”的路由表；真正的信任仍来自受保护 base 上的 workflow、验收脚本、各基线 Manifest、各基线 Anchor，以及防止普通 PR 改写 base 的 ruleset。registry 不含摘要，因此不能替代 Anchor，也不会制造第二个互相矛盾的期望值。`[E1]`
2. **base-only 读取可以阻止 PR 自证。** CI 从 base 读取 registry、Manifest、Anchor、更新日志；PR head 只作为待验证据。PR 改自己的 Manifest/Anchor/registry 不会改变本次验收使用的可信副本。`[E1]`
3. **head registry 与 base registry 不同时的处置是策略问题，不是安全问题。** 安全上“base-only + 忽略 head”已经足够；但从“明确失败”和防止有写权限的协作者通过 PR 合并 registry 变更的角度，**推荐普通 PR 要求 registry 字节相等，不同即 FAIL**，owner 更新走专用通道。忽略策略会把这个判断留给人工审查，诊断策略更弱。`[E1-doc]`（required check 与分支保护语义见 §2.4）
4. **集中式 `.scratch/baselines/registry.json` 是三种形状中综合最优的候选。** 它已由 R2-Q3(a) 选定位置；A 的三个文件可原样引用；A/B 的交叉绑定与重复路径可在同一个校验器里检查；第三套基线只需增加一个 entry。代价是 schema、路径校验和汇总逻辑要写在一起，且 registry **不能直接驱动 `actions/checkout` 的 sparse 路径**（需额外 checkout/分阶段，见 §4.1.5、§11 OD-15）。`[E1]` `[E1-doc]`
5. **A/B 的 Manifest / Anchor / 更新日志 / 结果 / artifact 可以做到逻辑隔离，但底层证据并非完全物理独立。** 本地只读复算发现 A、B Manifest 有 **73 个绝对路径重叠**：28 个在两边都是 required（`fa04`），30 个在 A required、B optional（`oldWork`），15 个两边都 optional。因此 07 的“A 篡改”和“B 篡改”负向样本必须选各自独占的 required 路径，不能用共享的 `fa04` 文件，否则一个篡改会同时打红两套基线，无法证明“A PASS 不掩盖 B FAIL”。`[E3-本地]`
6. **更新通道推荐继续沿用 P0-03 的“owner PR 改目标文件 + `workflow_dispatch` 验证候选”**，dispatch 保持只读、不写 base。这样失败时 base 完全不变；一个候选 PR 的合并是原子的；更新记录可由 dispatch artifact + PR/commit 承载。**workflow 自动写回**需要新的写权限 actor，且“提交成功后再检查失败”会留下已经生效的坏状态，回滚仍需 revert PR；它与本图 Out of scope 的“自动更新基线”冲突，不建议。`[E1]`
7. **单 job 双 step 的汇总必须显式检查 A/B 的真实 `outcome`、`summary.json`、`report.json`、`status`、Anchor 结果和期望 Manifest 路径/摘要，再用 `exit 1` 汇总。** `if: always()` 只保证执行，不产生判定；被跳过的 step 的 `outcome=skipped`，必须由汇总判 FAIL。**绝不能**加 job 级 `if` 或 paths 过滤：required check 文档明确“conditional 跳过的 job 报 Success”，而 paths 过滤会让 check 停在 Pending。`[E1-doc]`
8. **A 兼容可以做到零文件改动。** `scripts/check-manifest-updates.mjs` 已经用 `--log` / `--manifest` 参数化，最简单的扩展是“调用两次”，A 的命令与语义完全不变；若需要严格字段校验，建议新增 wrapper/可选模式，保持原调用的旧行为。A 的日志没有 `baselineId`/`operator`/`commitSha` 等字段，任何严格 schema 都不能把这些设为 A 的必填项。`[E1]`
9. **`verify-delivery` 当前报告没有 `baselineId`，且 A/B 的 `input.subject` 完全相同**（同一 pack / version / shell），报告只能靠 `input.manifest.path`、`input.manifest.sha256`、`trust.expectedSha256` 区分。P0-04 不必为此改 CLI；用独立 OUT 目录、独立 artifact 名、registry 驱动的期望路径/摘要校验即可。若 03 要一等身份，建议加**可选** `input.baselineId` 或仅在 `evidence-acceptance` 的 `summary.json` 加 ID，不能改成必填（否则旧报告/A 报告不合法）。`[E1]` `[E1-doc]`
10. **本票没有新增 E2/E3-CI 证据。** 本文件主要是 E1（仓库源码/配置阅读）与 E1-doc（GitHub 官方文档/action README）；只有 Manifest 摘要、A 更新日志一致性、A/B 路径重叠是本地只读复算（E3-本地），不等于 CI/真实 PR 证据。`[E1]` `[E3-本地]`

## 1. 输入、方法与证据档位

### 1.1 读过的仓库文件

| 类别 | 文件 | 用途 |
|---|---|---|
| PRD | `docs/v7.6/接入.md` §3.1–3.3、§4 P0-04-02/03/04、§5 | 需求与约束 |
| 裁定 | `.scratch/p0-04-dual-baseline-ci/rulings-2026-11-01.md` | Q1–Q7、R2-Q1–R2-Q6 |
| 地图 | `.scratch/p0-04-dual-baseline-ci/map.md` | 目的地、已核实事实、执行规则 |
| 票据 | `issues/01`、`issues/03`、`issues/04`、`issues/05`、`issues/06` | 后续实施边界；本研究据此避免越界 |
| 前序信任模型 | `.scratch/p0-03-evidence-trust/map.md`、`docs/adr/0001-evidence-trust-boundary.md` | 威胁模型、base-only、owner 边界 |
| Workflow | `.github/workflows/evidence.yml`、`baseline-update.yml`、`ci.yml` | 现有执行路径、权限、sparse、artifact |
| 脚本 | `scripts/evidence-acceptance.mjs`、`scripts/check-manifest-updates.mjs` | 报告生成与更新日志校验 |
| CLI/核心 | `packages/cli/src/evidence.ts`、`packages/cli/src/cli.ts`、`packages/pipeline/src/evidence-integrity.ts` | `trust.anchor`、报告 schema、锚点模式、路径安全 |
| 基线 A | `.scratch/evidence-integrity-v1/manifest/{expected-hashes.json,expected-hashes.sha256,MANIFEST-UPDATES.md}` | A 的 Manifest/Anchor/更新日志 |
| 基线 B | `.scratch/p0-02-second-demo-v2/manifest/final-manifest.json`（Anchor/日志尚不存在） | B 的 Manifest 与 roots |
| 前序外部研究 | `.scratch/p0-03-evidence-trust/research/github-trust-mechanics.md` | 已有 GitHub 机制核实与来源链接 |

### 1.2 本地只读复算（E3-本地）

```text
$ shasum -a 256 \
    .scratch/evidence-integrity-v1/manifest/expected-hashes.json \
    .scratch/p0-02-second-demo-v2/manifest/final-manifest.json
ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd  .scratch/evidence-integrity-v1/manifest/expected-hashes.json
07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab  .scratch/p0-02-second-demo-v2/manifest/final-manifest.json
exit=0

$ node scripts/check-manifest-updates.mjs \
    --log .scratch/evidence-integrity-v1/manifest/MANIFEST-UPDATES.md \
    --manifest .scratch/evidence-integrity-v1/manifest/expected-hashes.json
MANIFEST-UPDATES：最后一条 newSha256 与当前 Manifest 一致（sha256:ba7a485b...36fd）
exit=0
```

另外用只读 Python 解析两个 Manifest，得到：

| 事实 | A | B |
|---|---|---|
| Manifest 路径 | `.scratch/evidence-integrity-v1/manifest/expected-hashes.json` | `.scratch/p0-02-second-demo-v2/manifest/final-manifest.json` |
| 原始字节摘要 | `sha256:ba7a485b...36fd` | `sha256:07866e0e...b9ab` |
| 文件数 / required / optional | 223 / 151 / 72 | 231 / 137 / 94 |
| records | 13 | 6 |
| `format` | `delivery-evidence-manifest/v1` | `delivery-evidence-manifest/v1` |
| `subject` | pack `wasteland-scavenger-recipe` v1；site v1；shell 2 | 同上（**完全相同**） |
| roots | 9 个（out/snapshot/reference/artifacts/fa04/fa05/fa06/runs/gp） | 3 个（fa04/oldWork/out） |
| Anchor | `expected-hashes.sha256` = A 摘要 | **不存在**（04 创建） |
| 更新日志 | `MANIFEST-UPDATES.md`，最后一条匹配 | **不存在**（04 创建） |

这些结果与 `map.md` 的已核实事实一致。它们是本地只读复算，不是 CI 真实运行；本票不声称 E2/E3-CI。

### 1.3 证据档位定义（本文件使用）

- **E1**：仓库源码/配置/文档阅读；能定位到具体文件与行号。
- **E1-doc**：GitHub 官方文档或 action 官方 README 的一手文本；给出 URL 与原文要点。
- **E2**：测试；本票未新增。
- **E3-本地**：本地只读命令 + 退出码 + 输出（摘要、日志校验、路径重叠计算）；不等于 CI/真实 PR 证据。
- **E3-CI**：真实 GitHub Actions run / PR 产物；本票未新增。
- **E3-继承**：P0-03 已完成的真实运行结论（见 `.scratch/p0-03-evidence-trust/map.md`），本文件只引用。

## 2. 威胁模型

### 2.1 受保护资产

1. A、B 两套冻结交付证据的内容与哈希。
2. A、B 各自的 Manifest、Anchor、更新日志。
3. registry 所声明的基线集合、ID 与路径映射。
4. `evidence` 的验收逻辑：workflow、`verify-delivery` CLI、`evidence-acceptance`、`check-manifest-updates`。
5. `evidence` required check 的结论，以及更新记录/审计线索。
6. 受保护 `main` 与 ruleset 本身。

### 2.2 对手与能力

| 对手 | 能力 | 能达成什么 | P0-04 的应对 | 是否在防御范围 |
|---|---|---|---|---|
| 普通 PR 作者（fork / 无写权限） | 可提交任意 PR 内容；可修改 PR head 的 delivery/Manifest/Anchor/registry/workflow/脚本；可 force-push head；不能改 base、ruleset、仓库设置；可读 public 仓库 | 试图用改过的 Manifest/Anchor 自证；篡改 required 文件；伪造 registry；在 PR 元数据中注入 shell | `pull_request_target` 使用 base workflow；base 读取 registry/Manifest/Anchor/日志；PR head 只检出为数据；Manifest（及建议的 Anchor/日志/registry）字节比较；head SHA 回验；不执行 head 代码；只读 token、无 secrets | **在范围内** |
| 非 owner 但有 write 权限的协作者（如果存在） | 可创建分支/PR；可触发 `workflow_dispatch`（官方要求 write access）；在 required checks 全绿且 ruleset 不要求 approval 时可合并 PR；不能绕过 required checks，不能直接 push/force/delete `main` | 通过“先合并 workflow/registry 变更，再由后续 PR 利用”两阶段修改信任配置；若 evidence 忽略 head registry，可合并一个削弱 registry 的 PR | 对 registry/Manifest/Anchor/日志做字节相等即 FAIL，使其无法在 checks 绿的情况下合并；但 **workflow/脚本变更** 在旧 base 下仍可能通过 evidence，需 review/CODEOWNERS 才能挡住（本图不新增 review 规则） | **部分在范围内**；当前仓库实际只有 owner，08 必须如实说明 |
| owner（ruleset bypass） | 可在 PR 上绕过 required checks 合并；可通过 PR 改 base 的 workflow/registry/Manifest/Anchor；不能直接 push/force push/删除 `main`（ruleset 只给 `pull_request` bypass） | 恶意或误操作地重定义信任根；合并红色 PR；绕过更新隔离 | owner 更新走专用 dispatch + PR；dispatch 只读、记录操作者/目标/旧新摘要/SHA/时间；更新后 evidence 仍会检查；无法技术阻止 owner | **不在技术防御范围**；只做可追溯与最小化 |
| 仓库管理员 / GitHub 管理权限被攻陷 | 可改 ruleset、Actions policy、workflow、base、可见性；可关闭 Actions；可读/改仓库 | 完全重定义信任根；让任何检查失效 | 无技术防线；签名/外部时间戳也不解决这类问题（ADR 明确不做） | **明确不在范围** |
| CI runner / action 供应链被攻陷 | 可篡改运行环境、读取 token（当前只读）、伪造输出 | 伪造 evidence 结果 | 只读 token、无 secrets、PR 代码不执行可降低影响；不声称防御 runner 被攻陷 | **不在范围** |

### 2.3 本图明确 In / Out of scope

**In scope（P0-04 要证明的）**

- 普通 PR 修改交付文件、Manifest、Anchor、更新日志、registry 或验收规则中的任意组合，都不能让 `evidence` 通过。
- A/B 各自独立定位、独立校验、独立报告；A PASS 不能掩盖 B FAIL，B PASS 不能掩盖 A FAIL。
- owner 更新目标基线时只能改目标基线；更新失败不产生半更新；更新记录可追溯。
- 普通 PR 的信任输入全部来自 base；head 只作为数据。
- 真实 GitHub PR 红绿证据（07）。

**Out of scope（不得声称已防御）**

- 恶意 owner、仓库管理员、GitHub 管理权限被攻陷。
- CI 执行环境/runner/action 供应链被攻陷。
- 签名、外部时间戳、仓库外锚。
- 普通 PR 通过 compute/超时/大文件对 CI 做 DoS（只能靠 concurrency/timeout 限流）。
- 非 owner 写权限协作者的 review 门禁（本图不新增 CODEOWNERS/required review）；如果该协作者能合并 workflow 变更，这是既有分支保护的边界，不是 registry 能解决的。
- 把证据完整性通过解释为游戏功能、视觉审核或端到端生成验收。

### 2.4 对“普通 PR 作者”的一个必要澄清

P0-03 ADR 的定义是“可以提交任意 PR 内容，但不能修改受保护分支、仓库保护设置或可信 CI 的执行逻辑”。在当前 ruleset 中：

- `evidence` 及其他 required checks 会挡住未通过的 PR；
- owner 有 `pull_request` bypass；
- ruleset 的 required approvals 为 0，且没有 CODEOWNERS；
- 当前只有 owner 一个 collaborator（`map.md`）。

因此，“普通 PR 作者”在当前仓库实际上就是无写权限的外部/ fork 贡献者；**如果未来加入非 owner 的 write 协作者**，他们可以合并“checks 绿但修改了 workflow/脚本”的 PR（旧 base 的 evidence 不会检查新 workflow 本身），这是本图不能仅靠 registry 修复的边界。本研究把它列为残留风险，而不是声称 P0-04 已防御。`[E1]`

### 2.5 GitHub 机制事实（E1-doc）

- `pull_request_target` “runs in the context of the default branch of the base repository, rather than in the context of the merge commit”；workflow 以及**不指定 `ref` 的 checkout** 来自 base/default branch，而不是 PR。`[E1-doc]` [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target)、[Securely using pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)
- 官方安全文档明确：checkout 本身不执行不可信代码；漏洞由**下一步执行 head 中的代码**完成。`[E1-doc]` 同上。
- `actions/checkout@v7` 在 `pull_request_target` / `workflow_run` 下默认拒绝 checkout fork PR 代码；需要显式 `allow-unsafe-pr-checkout: true`，且只应在“检出后绝不执行”的前提下使用。`[E1-doc]` [actions/checkout v7 README](https://github.com/actions/checkout/blob/v7.0.1/README.md)
- 公开仓库的 `pull_request_target` 默认 event policy 会阻断；仓库已有 P0-03 创建的显式 policy 10162，仅允许 `evidence.yml` 使用该事件（`map.md`，E3-继承）。若该 policy 被移除或失效，evidence 会无法运行；这是平台前置，不是本票新风险。`[E1-doc]` [Securely using pull_request_target: Default policy](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)

## 3. Registry 为什么不成为新的自证信任根

### 3.1 registry 只存什么

R2-Q3(a) 已定位置为 `.scratch/baselines/registry.json`；Q6(b) 已定它**只声明基线身份与路径，不存摘要**。这是正确的边界：

- 存：基线 ID、显示名、Manifest 路径、Anchor 路径、更新日志路径、必要的身份字段（如 `packId` / `packVersion` / `siteVersion` / `shellVersion`）、`manifestFormat`。
- 不存：Manifest 的 SHA-256、文件级哈希、文件数量作为通过/失败阈值、任何可变的期望值。

如果 registry 存了摘要，就会出现两个“期望值来源”：registry 和 Anchor。两者不一致时谁优先？更新时是否必须同时改两处？这会让 registry 变成第二个可被误改的信任根，却没有增加任何密码学强度。**每个基线的唯一摘要来源应保持为它自己的 Anchor**。`[E1]`

### 3.2 信任仍然来自哪里

对每个基线 `b`，可信验收的输入与等式是：

```text
Rb = base_registry[b]                     # 只给出路径，不给出期望值
Mb_base = base.read(Rb.manifest)          # base 上的 Manifest
Ab_base = base.read(Rb.anchor)            # base 上的 Anchor
Lb_base = base.read(Rb.updateLog)         # base 上的更新日志

Mb_head = head.read(Rb.manifest)          # PR head 上的同名文件，仅作数据
Eb_head = head.read(evidence paths)       # PR head 上的交付证据

检查 1：bytes(Mb_head) == bytes(Mb_base)  # 普通 PR 不得改期望值（A 现有规则）
检查 2：sha256(bytes(Mb_base)) == Ab_base # Anchor 绑定 Manifest 原始字节
检查 3：check_manifest_updates(Lb_base, Mb_base) == ok
检查 4：verify_delivery(Mb_base, Eb_head) == pass
```

`Rb` 只出现在“去哪里读”的位置，不参与“期望值是什么”。因此：

- **PR 改 head 的 Manifest**：检查 1 失败；即使不做检查 1，检查 2 也会失败（base Anchor 仍指向 base Manifest）。
- **PR 同时改 head 的 Manifest + Anchor**：检查 1 失败；base Anchor 从不来自 head。
- **PR 改 head 的 Anchor**：base 验收根本不读它；检查 2 用 base Anchor。若不做显式比较，这个 PR 可能“无害通过”，但绝不会让被篡改的 Manifest 通过。
- **PR 改 head 的 registry**：base 验收根本不读它；`Rb` 来自 base。若不做显式比较，PR 可以携带一个无效 registry 通过，但不会影响本次结果。
- **PR 改交付文件**：检查 4 的文件哈希失败。
- **PR 改 workflow/脚本/CLI**：`pull_request_target` 使用 base 版本，head 版本不执行。
- **PR 改可选文件**：按现有规则报告 optional 状态，不把 optional 提升为 required；这是设计行为，不是自证。

所以，registry 不存摘要不会削弱信任；相反，它避免了“registry 摘要 vs Anchor 摘要”的双重来源。**信任根是 base commit + ruleset + base workflow/CLI/scripts + 各基线 Anchor/Manifest；registry 只是索引。**

### 3.3 base-only 读取保证什么、不保证什么

**保证：**

1. 本次运行使用哪几套基线、每套用哪个 Manifest/Anchor/日志，由 base 决定；PR 无法增删基线或重定向路径。
2. 本次运行的 Anchor 与 Manifest 来自 base；PR 不能用自己的 Anchor 验证自己的 Manifest。
3. 本次运行的验收逻辑来自 base；PR 不能修改自己的验收规则并立即生效。
4. head 只作为数据；head SHA 可回验，head 移动会被发现（现有 workflow 已做）。
5. 在 `permissions: contents: read`、无 secrets、不执行 head 代码的前提下，普通 PR 无法借 workflow 获得写权限。

**不保证：**

1. **base 本身可信**：owner/admin 可以改 base；这是信任边界外。
2. **路径安全**：registry 里的路径可能越界、指向符号链接、指向另一个基线；必须在可信 base 脚本中校验。
3. **Anchor 新鲜**：Anchor 可能过期；需要更新日志或 digest 一致性检查。
4. **基线集合完整**：base registry 可能遗漏 B；需要“必须包含 A/B”的集合断言，或把 registry 完整性视为 owner 责任。
5. **sparse checkout 覆盖完整**：只检出 Manifest 而漏掉交付文件会制造虚假 PASS；必须校验每个 manifest root 都实际被检出。
6. **head registry 差异可见**：base-only 会忽略它；是否显式 FAIL 是策略选择（见 §3.4）。
7. **owner/管理员/runner**：不在范围。

### 3.4 head registry 与 base registry 不同时：拒绝、忽略还是诊断

三种策略：

| 策略 | 行为 | 优点 | 缺点 | 适用前提 |
|---|---|---|---|---|
| **拒绝（推荐）** | 普通 PR 的 `head registry` 与 `base registry` 不字节相等 ⇒ `evidence` FAIL，诊断 `registry.head-diff` | 明确失败；防止“带 registry 变更的 PR 在 checks 绿时被合并”；与 Manifest 的字节相等规则一致；审查者能看到信任配置变更 | owner 更新 registry 的 PR 会红，需要专用 dispatch + bypass；首次引入 registry 时有 bootstrap 特例 | 接受 owner 更新 PR 通常走 bypass/dispatch 的既定模式 |
| **忽略** | 只用 base registry；head registry 完全不参与，最多打一条 annotation | 不增加 owner 更新 PR 的摩擦；安全上不会自证 | 有写权限的协作者可能合并一个削弱 registry 的 PR（checks 仍绿）；变更不可见；与“明确失败”目标不符 | 只有 owner 能合并 PR，且接受靠人工 review |
| **仅诊断** | 发现差异只警告，不改变 `evidence` 结论 | 信息可见 | 最弱；required check 仍绿，合并仍可能；警告容易被忽略 | 不建议作为门禁策略 |

**推荐：拒绝（字节相等）作为默认**，理由：

- 与 A 现有 `cmp -s PR_MANIFEST BASE_MANIFEST` 的模型一致；普通 PR 不得改自己的期望值，registry 是同一类信任配置。
- required checks 是唯一技术门禁；在 0 approvals 的 ruleset 下，“忽略”会把 registry 变更的合并安全性完全交给 review。
- 诊断明确：`PR registry differs from base registry; ordinary PRs may not change baseline configuration.`
- owner 更新 registry 时，本 PR 的 `evidence` 会红；这与 owner 更新 Manifest 的现有模式一致：`baseline-update` dispatch 先验证候选，owner 再合并。必须把这个限制写进 06 的说明，并由 08 如实报告。

**Bootstrap 特例（需 03 裁定）**：如果 base 根本没有 registry（首次引入），`head registry` 出现不能被“字节相等”判定。可选：

- 把“新增 registry”视为一次性 implementation PR，由 owner 通过 dispatch 验证候选后合并；base 合并后，后续普通 PR 一律字节相等。
- 或者 base 无 registry 时直接 FAIL，要求先以 owner 通道建立 registry；这会多一个 PR，但语义最干净。

### 3.5 建议同时比较的其它信任配置

Manifest 之外，Anchor 和更新日志也是信任配置。当前 A 的 evidence 只比较 Manifest，不比较 head Anchor/更新日志；这意味着“只改 Anchor/日志”的 PR 可能无害通过（base 不读 head 副本）。如果目标是“修改任一信任配置都给出明确失败”，建议扩展为每套基线比较：

```text
bytes(head.Manifest)  == bytes(base.Manifest)
bytes(head.Anchor)    == bytes(base.Anchor)
bytes(head.UpdateLog) == bytes(base.UpdateLog)
bytes(head.Registry)  == bytes(base.Registry)   # 若 base 有 registry
```

代价是改变 A 的失败面（现在只改 A Anchor 的 PR 不会红），因此这是 03 的开放决策，而不是本研究的定论。若不扩展，安全性仍然成立（base 副本不被覆盖），只是“明确失败”较弱。`[E1]`

## 4. 三种 registry 形状对比

### 4.1 集中式 `.scratch/baselines/registry.json`（R2-Q3 已选位置）

#### 4.1.1 候选 schema（研究建议，不是实施）

```json
{
  "format": "baseline-registry/v1",
  "baselines": [
    {
      "id": "fpvs-v1",
      "name": "FPVS-V1",
      "manifestFormat": "delivery-evidence-manifest/v1",
      "manifest": ".scratch/evidence-integrity-v1/manifest/expected-hashes.json",
      "anchor": ".scratch/evidence-integrity-v1/manifest/expected-hashes.sha256",
      "updateLog": ".scratch/evidence-integrity-v1/manifest/MANIFEST-UPDATES.md",
      "identity": {
        "packId": "wasteland-scavenger-recipe",
        "packVersion": 1,
        "siteVersion": 1,
        "shellVersion": "2"
      }
    },
    {
      "id": "p0-02-second-demo-v2",
      "name": "P0-02 Second Demo V2",
      "manifestFormat": "delivery-evidence-manifest/v1",
      "manifest": ".scratch/p0-02-second-demo-v2/manifest/final-manifest.json",
      "anchor": ".scratch/p0-02-second-demo-v2/manifest/expected-hashes.sha256",
      "updateLog": ".scratch/p0-02-second-demo-v2/manifest/MANIFEST-UPDATES.md",
      "identity": {
        "packId": "wasteland-scavenger-recipe",
        "packVersion": 1,
        "siteVersion": 1,
        "shellVersion": "2"
      }
    }
  ]
}
```

注意：A/B 的 `identity` **相同**；因此 ID 和路径必须是唯一区分器，不能用 subject 区分基线。`[E3-本地]`

#### 4.1.2 字段与严格校验规则（候选）

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| `format` | string | 是 | 固定 `baseline-registry/v1`；未知格式拒绝 |
| `baselines` | array | 是 | 至少 1 项；ID 唯一；顺序不影响语义（但诊断按稳定排序） |
| `id` | string | 是 | 例如 `^[a-z0-9][a-z0-9._-]{0,63}$`；与 workflow 的 `baseline` 输入一致 |
| `name` | string | 是 | 人类可读；不参与安全判定 |
| `manifestFormat` | string | 是 | 必须等于目标 Manifest 的 `format`；A/B 都是 `delivery-evidence-manifest/v1` |
| `manifest` / `anchor` / `updateLog` | string | 是 | 仓库根相对 POSIX 路径；不得绝对、不得 `..`、不得反斜杠、不得空 |
| `identity` | object | 是 | 只含 `packId` / `packVersion` / `siteVersion` / `shellVersion`；与 Manifest `subject` 对应字段一致；**不存摘要** |
| （禁止）`sha256` / `expectedManifestSha256` / `files` / `counts` | — | — | 拒绝未知字段；摘要只在 Anchor；数量只由 Manifest 统计，不能作为门槛 |

严格校验还应包括：

1. **未知字段拒绝**（等价于现有 Manifest 的 `strictObject` 思路）。
2. **ID 重复拒绝**；**Manifest / Anchor / 更新日志路径跨 entry 重复拒绝**。
3. **目录绑定**：对 A/B，强制 `dirname(manifest) == dirname(anchor) == dirname(updateLog)`，且不同基线的目录不同；这样 A 的 Anchor 不能指向 B 的 Manifest，反之亦然。若未来允许拆目录，需要显式 `allowedScope`，不能在 P0-04 里放开。
4. **路径解析**：以 base/head 仓库根为界，`path.resolve` 后必须仍在根内；`realpath` 后也必须仍在根内；拒绝符号链接逃逸；必须是普通文件（不是目录、设备、FIFO）。
5. **文件存在**：Manifest / Anchor / 更新日志都必须存在；缺一即 FAIL，不能把“缺失”当成“无差异”。
6. **Manifest 校验**：`format` 匹配；`identity` 与 `subject` 匹配；`files` / `records` 结构由现有 `readEvidenceManifest` 校验。
7. **Anchor 校验**：严格 `sha256:<64 lowercase hex>`，可选单个换行；A 现有格式必须原样接受（不能要求 `baselineId`）。
8. **更新日志校验**：按 04/03 的严格规则；A 现有条目字段必须通过。
9. **registry 自身位置**：`.scratch/baselines/registry.json` 不在任何基线证据 root 内；`--out` 必须由现有 `assertOutOutsideRoots` 拒绝落在任何 root 内。

#### 4.1.3 base / head 双份比较

- **读取**：base registry 是唯一权威；head registry 只用于“是否发生信任配置变更”的诊断。
- **普通 PR**：若 base registry 存在，要求 `bytes(head.registry) == bytes(base.registry)`；不同 ⇒ FAIL（见 §3.4）。
- **每个基线**：用 base registry 的路径读取 base Manifest/Anchor/日志；用同一路径读取 head Manifest/Anchor/日志（若同时做 Anchor/日志比较）。
- **head 缺失**：`head.manifest` / `head.anchor` / `head.log` 不存在 ⇒ 明确 `missing` 诊断并 FAIL；不能当作“未修改”。
- **bootstrap**：base 无 registry 时按 §3.4 的特例处理；一旦 base 有 registry，后续一律字节相等。

#### 4.1.4 更新通道

- registry 与目标基线文件走同一个 owner 通道：owner PR + `workflow_dispatch` 验证候选。
- dispatch 只读；候选 commit 作为数据；验证候选 registry 的 schema、路径、身份、A/B 交叉绑定；若只更新目标基线，非目标 entry 必须与 base 完全一致。
- registry 的变更历史由 PR/commit/review/dispatch artifact 承载；registry 本身不需要 digest 或第二份更新日志。是否需要单独的 registry 更新记录，见 §11 OD-07/OD-08。

#### 4.1.5 兼容 A 的现有文件

- `manifest` / `anchor` / `updateLog` 精确指向 A 的三个文件；不复制、不改写、不改格式。
- A 的 Anchor 只有一行摘要，没有 `baselineId`；registry entry 的 `id` + 路径提供身份，不要求 A 文件增加字段。
- A 的更新日志现有条目没有 `baselineId`/`operator`/`commitSha`；严格 parser 不能把这些设为必填（详见 §8）。
- A 的 Manifest `subject` 与 B 相同；registry 不能按 subject 去重，必须按 `id` 和路径。

#### 4.1.6 失败诊断（候选规则名）

| 诊断 | 触发 | 人类可读 |
|---|---|---|
| `registry.parse` | JSON/schema 失败 | `[registry] 不合法：baselines[1].manifest ...` |
| `registry.duplicate-id` | 两个 entry 同 ID | `[registry] baseline id 重复：...` |
| `registry.path-invalid` | 绝对路径 / `..` / 反斜杠 / 越界 / 符号链接逃逸 | `[registry] baseline B 的 manifest 路径不合法：...` |
| `registry.file-missing` | Manifest/Anchor/日志不存在 | `[registry] baseline A 缺少 anchor：...` |
| `registry.cross-binding` | A 的 Anchor 指向 B 的 Manifest/目录，或路径重复 | `[registry] baseline A 与 B 的 anchor/manifest 路径交叉` |
| `registry.identity-mismatch` | registry identity 与 Manifest subject 不一致 | `[registry] baseline B 的 identity 与 final-manifest.json 不一致` |
| `registry.head-diff` | head registry 与 base 不同 | `[registry] PR 修改了 baseline registry；普通 PR 不允许改信任配置` |
| `registry.baseline-missing` | 必需基线不在 registry | `[registry] 缺少必需基线：B` |
| `registry.sparse-missing` | registry 指向的路径/manifest root 未被 checkout | `[registry] baseline B 的 root 未被 sparse checkout：...` |

所有诊断都应带 `baselineId`（如果该诊断属于某基线），并在汇总 artifact 中保持 A/B 可区分。

#### 4.1.7 第三套基线的扩展成本（只比较）

- 增加一个 entry；创建该基线的 Manifest/Anchor/更新日志；在 workflow 的 sparse 列表增加其目录；增加一个 verify step 或在 registry 循环中自动多一轮；测试矩阵增加第三组正/负例。
- **不需要**改 schema、汇总的 AND 语义、artifact 命名规则（按 ID 生成）。
- 仍需人工确认第三套基线的身份/来源；registry 不能替代“谁批准了这个基线”。
- 若 workflow 选择“硬编码 A/B 的必需集合”，第三套基线还要改 workflow；若完全 registry 驱动，则只加 entry。后者更省，但“registry 被删条目”风险更高（需要集合断言兜底）。

### 4.2 每基线一个 descriptor 文件

形状：`.scratch/baselines/fpvs-v1.json`、`.scratch/baselines/p0-02-second-demo-v2.json`；每个文件是一个 entry（字段同上）。

**schema / discovery**

- 每个文件 `strictObject`；字段与 4.1.2 相同，但 `id` 可以来自文件名或文件内字段（必须一致）。
- 发现方式：
  - 目录 glob（`*.json`）：固定排序；但“目录里有哪些文件”本身成为信任配置；base-only 读取可以防止 PR 增删，但 base 目录可能混入临时/重复文件。
  - 或一个显式 `index.json` 列出 descriptor 文件名；这样又多一个索引，接近集中 registry。
- 必须断言“必需基线集合”（A/B）；否则删除一个 descriptor 就能少检查一套基线（base-only 下这是 base/owner 行为，但普通 PR 通过 head 不能影响；仍有配置完整性风险）。

**路径校验**

- 每个 descriptor 内路径规则同 4.1.2；跨文件需要读取全部 descriptor 后检查 ID/路径唯一、目录不交叉、A/B 不交叉。
- 单文件校验器可以先跑，再做一次集合校验；诊断要指出“哪个文件 + 哪个 baseline”。

**base/head 比较**

- 普通 PR 要求 base 目录的 descriptor 集合与 head 集合**逐文件字节相等**；新增/删除/改名都 FAIL。
- 需要确定“目录内容”如何比较（`find` + `cmp`）；空目录/无关文件要拒绝或忽略，必须显式规则。
- 若 base 没有 descriptor 而 head 新增，按 bootstrap 特例处理。

**更新通道**

- 单个 descriptor 的更新天然是“目标基线”的：owner PR 只改一个文件；dispatch 读目标 descriptor + 目标 Manifest/Anchor/日志。
- 天然隔离好；但跨文件不变量（重复 ID、路径交叉、必需集合）需要单独的集合校验；一个 descriptor 的错误可能让另一套基线的交叉检查失败，诊断要分清。
- 更新记录仍建议用 dispatch artifact + PR；descriptor 不存摘要。

**A 兼容**

- A descriptor 引用 A 的三件文件；A 文件零改动；与集中式相同。
- 不需要把 A 的文件移到 `.scratch/baselines`；路径可以指向原目录。

**诊断**

- 文件级 parse/path/identity 诊断；集合级 duplicate/cross-binding/missing 诊断。
- 文件缺失时，“少一套基线”可能比“registry 少 entry”更隐蔽；必须有必需集合断言。

**第三套基线成本**

- 增加一个 descriptor 文件 + 该基线文件 + sparse + verify；**最低的文件级成本**。
- 但发现/集合校验/交叉检查的代码复杂度高于集中式；第三套也需要改“必需集合”断言。

### 4.3 Workflow 内显式硬编码两套路径

形状：`evidence.yml` 直接写 A/B 的 Manifest/Anchor/日志路径和输出目录，不引入 registry 文件。

- **schema**：YAML 本身就是 schema；字段散落在 `env` / step `run` 中；没有机器可读的基线列表。
- **路径校验**：`test -f`、`cmp`、`dirname` 等 shell 检查；容易漏掉交叉绑定/重复路径；路径拼 shell 有注入风险（必须用固定 env，不插入 PR 内容）。
- **base/head 比较**：workflow 来自 base，路径天然可信；但没有“head registry 差异”诊断，因为 head 没有 registry；普通 PR 修改 head 路径不生效。
- **更新通道**：修改路径/新增基线 = 修改 workflow；owner PR + dispatch 验证；workflow 变更是信任逻辑变更，需要 review/owner；普通 PR 不能执行 head workflow。
- **A 兼容**：最容易；A 的路径原样保留；B 新增 step。
- **失败诊断**：step 名 + shell 错误；没有统一的 registry 诊断；A/B 结果依赖 step 顺序和汇总脚本。
- **第三套基线成本**：最高；要改 workflow 的 sparse、env、step、汇总、测试；容易漏改一处导致虚假 PASS。
- **优点**：无新解析器、无新文件、审查直观、部署最小。
- **缺点**：与 Q6(b) 的 registry 方向冲突；基线配置散落在 workflow；A/B 交叉检查靠人工；第三套扩展差；无法在 workflow 之外做统一 schema 校验。

### 4.4 对比表

| 维度 | 集中 registry | 每基线 descriptor | workflow 硬编码 |
|---|---|---|---|
| 位置 | `.scratch/baselines/registry.json`（R2-Q3 已选） | `.scratch/baselines/<id>.json` | `.github/workflows/evidence.yml` |
| schema | 一个 strict JSON，易校验 | 每文件 strict JSON + 集合规则 | YAML，散落 |
| 基线发现 | 一个数组，顺序稳定 | 目录/索引；需处理集合 | step 列表 |
| 路径校验 | 统一校验器，易做交叉/重复 | 单文件 + 集合校验 | shell，易漏 |
| base/head 比较 | 一个文件字节比较 + 每条目比较 | 集合逐文件比较 | 无 head registry；路径来自 base |
| registry 更新通道 | owner PR + dispatch；可逐 entry diff | owner PR 改单文件；集合仍要校验 | 改 workflow；owner PR |
| A 兼容 | 精确引用三文件，零改动 | 同左 | 最直接 |
| 失败诊断 | 统一 `registry.*` + `baselineId` | 文件级 + 集合级 | step/shell 文本 |
| 第三套基线成本 | 加 entry + 文件 + sparse + 测试 | 加文件 + 文件 + sparse + 测试 | 改 workflow 多处 |
| sparse 驱动 | 不能直接驱动；需硬编码 union + 覆盖断言 | 同左 | 本身就是硬编码 |
| 审查面 | 一个文件看全 A/B | 分散但每文件小 | workflow diff 与逻辑混在一起 |
| 与 Q6(b) | 一致 | 可解释为“每基线独立 registry” | 冲突 |

### 4.5 研究建议（供 03 取舍）

- **建议集中式 registry**：位置已定；A/B 交叉绑定、重复路径、必需集合、第三套扩展都集中在一个校验器里；A 三文件可零改动引用；与 P0-03 的 base-only/字节比较模型同构。
- **不建议 workflow 硬编码**：它虽最容易落地，但把信任配置散进 YAML，第三套基线成本高，且与 Q6(b) 冲突；只能作为 registry 方案被否决后的回退。
- **descriptor 文件是可接受的备选**：如果 03 更重视“每次只改一个基线文件”的隔离，descriptor 更自然；但必须加显式索引/必需集合断言，否则“删一个 descriptor 就少一套检查”的风险比集中式更隐蔽。
- **无论哪种形状，sparse 路径都要在 workflow 中硬编码或分阶段生成**；registry 不能直接改变 `actions/checkout` 的 sparse 输入（可先用最小 checkout 读 registry，再分阶段 checkout；见 §11 OD-15）。必须加“registry 指向的每个 Manifest/Anchor/日志和每个 manifest root 都已检出”的覆盖断言，否则可能“只检出 Manifest、漏交付文件”制造虚假 PASS。

## 5. 双基线独立性

### 5.1 逻辑隔离矩阵

| 对象 | A | B | 隔离方式 | 失败是否互相掩盖 |
|---|---|---|---|---|
| Manifest | `.scratch/evidence-integrity-v1/manifest/expected-hashes.json` | `.scratch/p0-02-second-demo-v2/manifest/final-manifest.json` | 两个文件；registry 两条 entry；不合并、不拼接、不互相复制 | A step 与 B step 各自 exit；汇总 AND；不会 |
| Anchor | A 的 `expected-hashes.sha256` | B 新建 `expected-hashes.sha256`（04） | 两个文件；各自绑定本 Manifest 原始字节；registry 目录绑定防交叉 | 各自 anchor 检查；不会 |
| 更新日志 | A 的 `MANIFEST-UPDATES.md` | B 新建 `MANIFEST-UPDATES.md`（04） | 两个文件；各自最后一条 `newSha256` 等于本 Manifest；不共享 | 各自 `check-manifest-updates`；不会 |
| 检查结果 | A 的 `summary.json` / `report.json` | B 的 `summary.json` / `report.json` | 不同 OUT 目录（建议 `$RUNNER_TEMP/evidence-runs/A`、`.../B`）；报告内 `input.manifest.path/sha256` 不同 | 汇总按 baseline 读；不会 |
| Artifact | `evidence-A-<pr>`（或 `evidence/<pr>/A/`） | `evidence-B-<pr>`/`.../B/` | 不同 artifact 名或不同子目录；artifact 名唯一，不能同名覆盖 | 各自上传；不会 |
| 更新操作 | target=A 的 Manifest/Anchor/日志 + registry A entry | target=B 的对应文件 | dispatch 必填 target；diff scope 限定目标；非目标字节相等 | 不会 |
| 验收逻辑 | 同一套 base CLI/scripts | 同一套 base CLI/scripts | 共享只读逻辑，但每基线独立调用、独立参数、独立输出 | 不会（共享逻辑 bug 会同时影响，属于代码缺陷，不是基线互相覆盖） |

### 5.2 物理证据重叠：一个必须写进报告的事实

用本地只读 Python 对两个 Manifest 的 `roots` + `files[].path` 做绝对路径归一化，得到：

| 重叠类别 | 数量 | 说明 |
|---|---:|---|
| A `fa04` / B `fa04`，两边 required | 28 | 同一目录 `.scratch/fpvs-v1-final/runs/2026-10-28-visual-review` |
| A `out` required / B `oldWork` optional | 30 | 同一目录 `.scratch/fpvs-v1-final/work`；A required、B optional |
| A `out` optional / B `oldWork` optional | 15 | 同上 |
| 合计绝对路径重叠 | **73** | 共享文件的 SHA-256 在两边 Manifest 中一致（0 个不一致） |
| B 独占 required | 109 | 全部在 B 的 `out` root（`.scratch/p0-02-second-demo-v2/freeze`，110 文件 = 109 required + 1 optional）；A 不包含该 root，与 A 无重叠 |

注：B 的 137 required = 28 共享 `fa04` + 109 B 独占 `out`；A 的 151 required = 28 共享 `fa04` + 30 共享 `work`（B optional）+ 93 A 独占其他 root。上表只列重叠；B 的 required 中 28 个与 A 共享。

**含义：**

1. **逻辑独立成立**：A/B 各有 Manifest/Anchor/日志/结果，A 的 PASS/FAIL 不改变 B 的判定。
2. **物理证据不独立**：篡改一个共享的 `fa04` required 文件会同时打红 A 和 B；这不违反“两套基线独立验收”，但会让 07 的负向样本失去归因力。
3. **07 负向样本必须选独占路径**：
   - A 篡改：选 A 独占 required 文件（例如 A `snapshot` / `gp` / `runs` 等 root 下的文件），不要用 `fa04` 或 `fpvs-v1-final/work`。
   - B 篡改：选 B `out` root（`.scratch/p0-02-second-demo-v2/freeze/...`）下的 required 文件，最好选 B 独占的 109 个 required 之一。
   - 若用共享文件，A/B 同时失败，只能证明“整体 FAIL”，不能证明“A PASS 不掩盖 B FAIL”。
4. **更新隔离不受影响**：基线更新只改 Manifest/Anchor/日志（以及必要时 registry），不改共享交付文件；A 更新不动 B 的三件文件。若有人改共享交付文件，那是交付变更，不是 baseline update，A/B 可能同时受影响，需在 07/08 说明。

### 5.3 更新隔离的物理与逻辑边界

- **物理**：A/B 的 Manifest/Anchor/日志位于不同目录；registry 两条 entry；结果/artifact 不同目录/名；没有共享可写状态。
- **逻辑**：dispatch 的 `baseline` 输入是必填枚举/ID；候选 diff 必须在目标路径集合内；非目标基线的 Manifest/Anchor/日志必须与 base 字节相等；registry 的非目标 entry 必须与 base 相同；汇总按 baseline 分别读结果。
- **共享只读输入**：base 的 CLI/scripts/依赖安装是共享的，但只读；A/B 不写同一临时目录；`pnpm install/build` 只发生在 base，不影响候选/head。
- **共享证据文件**：见 5.2；独立的是“验收记录与信任锚”，不是“所有底层字节”。

## 6. 更新通道语义

### 6.1 现状

`baseline-update.yml` 当前：

- `workflow_dispatch`，输入 `candidate_sha`；
- `permissions: contents: read`；
- base 从 `main` 检出，候选 commit 作为数据检出；
- 验证候选 Manifest/Anchor/日志一致性，跑 `verify-delivery --anchor-mode baseline-update`；
- 只上传 artifact，不合并、不写 base；
- 不是 required check（`workflow_dispatch` 的 check 不出现在 PR checks，也不满足 required check）。`[E1]` `[E1-doc]`

### 6.2 方案 1：owner PR 改目标文件 + dispatch 验证候选

**流程**

```text
owner 创建候选分支
  -> 提交目标基线的 Manifest + Anchor + 更新日志（必要时 registry 目标 entry）
  -> workflow_dispatch(baseline=<A|B>, candidate_sha=<40 hex>, ref=main)
  -> base workflow 读取 base registry / base 当前文件
  -> 检出 candidate 为数据，回验 SHA
  -> 校验候选目标三件一致；非目标基线字节相等；registry 目标 entry 合法
  -> 产出 validation artifact + update record（不写 base）
  -> owner 审查并合并 PR（必要时使用既有的 pull_request bypass）
  -> 合并后 evidence 用新 base 重新验收 A/B
```

**仅更新目标基线**

- dispatch 必填 `baseline`（或 registry ID）；未指定/未知/不匹配 ⇒ 拒绝。
- candidate 的目标 Manifest/Anchor/日志必须属于目标 entry 的路径；非目标基线的三件文件与 base 字节相等；registry 非目标 entry 与 base 完全相等。
- 候选 diff 的路径白名单：目标三件 + （可选）registry 目标 entry；任何其他文件变更 ⇒ 拒绝或至少标记“不是纯基线更新”，交 owner 决定；建议拒绝，避免“顺手改 B”。
- 目标身份与 registry `identity`/Manifest `subject` 一致；A/B 不交叉（anchor 不指向对方 manifest）。

**失败无半更新**

- dispatch 是只读的：验证失败时 base 完全不变；候选分支上的部分提交不是 base 状态。
- owner PR 的合并是单个 git 操作：目标三件 + registry 变更一起进入 base，或者都不进入；不会出现“Manifest 已更新、Anchor 未更新”的 base 状态。
- 如果 owner 分多个 PR 更新同一目标（先 Manifest、后 Anchor），那是人为制造半更新；策略要求“一次更新一个 PR”，并在 06 的 E2/E3 中验证。
- 合并后如果 evidence 发现新基线失败，base 已经是新状态；这不能靠“回滚 force push”解决（ruleset 禁 force push/删除），只能再走一个修复 PR。因此 dispatch 候选验证必须尽量在合并前覆盖所有会失败的条件；这是“先验证后合并”的核心价值。

**可追溯记录**

最低字段（PRD P0-04-04）：

| 字段 | 来源 | 备注 |
|---|---|---|
| 操作者 | dispatch `github.actor` + `github.actor_id`；PR author；`github.triggering_actor` | re-run 时 `github.actor` 是初始触发者，re-run 使用其权限；两者都记录 |
| 目标基线 | `inputs.baseline` + registry entry `id` | 必填 |
| 旧摘要 | base Manifest 原始字节 SHA-256（或 base Anchor 值，应相等） | 校验前记录 |
| 新摘要 | candidate Manifest 原始字节 SHA-256 | 校验后记录 |
| 提交 SHA | `candidate_sha`（候选）；合并后再记录 merge commit SHA | dispatch 只能看到候选；PR/commit 提供 merge SHA |
| 时间 | dispatch run 时间 / artifact `generatedAt` / PR 日志日期 | 记录 UTC |
| 运行 ID / workflow / 结果 | `GITHUB_RUN_ID`、`GITHUB_WORKFLOW`、验证结论 | artifact 30 天；PR/check run 长期 |
| 基线与候选路径 | 目标三件 + registry 路径 | 便于复核 |

记录位置建议：

- **dispatch artifact** 写 `baseline-update-meta.json`（全字段、机器可读），与验证报告一起保留 30 天；
- **PR body/说明** 写人可读摘要（目标、旧/新摘要、候选 SHA、dispatch run URL）；
- **目标更新日志** 追加一条（A 现有格式的 reason/subject/oldSha256/newSha256/evidence/verifiedBy/recordedIn）；新增字段（`baselineId`/`operator`/`commitSha`/`recordedAt`）可以作为**可选**字段，不能要求 A 旧条目具备；
- 若 03 想要“日志即完整记录”，需要扩展日志 schema；这会与 A 零改动/严格 parser 冲突，需 03 明示（见 §8/§11）。

**操作者约束**

- `workflow_dispatch` 官方要求 **write access**；当前仓库只有 owner 一个 collaborator，但“owner-only”不是 dispatch 自动保证的。`[E1-doc]` [Manually running a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- 若要严格 owner-only，可在 workflow 里检查 `github.actor_id`（稳定）或 `github.actor` 白名单；注意 re-run 的权限使用 `github.actor`，记录 `github.triggering_actor` 以区分实际点击者。`[E1-doc]` [Contexts](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)
- 这是 06/03 的开放决策：仅靠“write access”是否足够，还是加 actor allowlist/Environment protection。个人仓库没有组织 audit log；记录以 PR/commit/check run/dispatch artifact 为主（P0-03 Q20）。

### 6.3 方案 2：workflow 自动写回

**流程（假设）**

```text
owner dispatch(baseline, ...)
  -> 可信 base workflow 计算目标 Manifest 新摘要
  -> 生成/改写目标 Anchor + 更新日志
  -> 以 contents: write commit 到 main（或推分支/开 PR）
  -> 更新记录写入 artifact / commit message
```

**问题**

1. **新增特权 actor**：自动写回需要 `contents: write`；如果 dispatch 可被非 owner write 协作者触发，就多了一条写 base 的路径。必须加 actor 限制，且该限制本身是新的信任逻辑。
2. **与 Out of scope 冲突**：本图 Out of scope 明确“自动修复证据、回写 Manifest、自动更新基线”；ADR 0001 也选择 owner 通道而非自动写回。除非用户重新裁定，方案 2 不应落地。
3. **“无半更新”不能只靠“一个 commit”**：如果 workflow 在 commit 成功后才跑 evidence/后置检查，检查失败时 base 已经被改；ruleset 禁止 force push/删除，回滚只能再开 revert PR，期间线上信任根是坏的。这比方案 1 的“先验证后合并”弱。
4. **可追溯性更弱**：自动 commit 的 author/committer 是 bot/actions，operator 需要额外记录；没有 PR 审查；artifact 30 天后，历史只剩 commit。
5. **若自动写回改为“推分支 + 开 PR”**：那又回到方案 1，只是多了一个 bot 作者；没有实质收益，却增加权限与复杂度。

**结论**：方案 2 技术上可以在“单 commit/单 PR”层面做到原子，但无法在“提交后再验证失败”时保证 base 不受影响；它扩大写权限面，并违反本图 Out of scope。除非 03 明确推翻该 Out of scope，否则不推荐。

### 6.4 方案对比

| 维度 | 方案 1：owner PR + dispatch | 方案 2：自动写回 |
|---|---|---|
| 谁写 base | owner 通过 PR 合并 | workflow token / bot |
| 需要的权限 | dispatch 触发权（write 用户可触发）；合并权限 | `contents: write` + ruleset bypass 或 bot PR |
| 目标隔离 | dispatch target + diff scope + 非目标字节相等 | 代码分支 per target；仍需显式 target |
| 失败无半更新 | 验证失败 base 不变；合并原子 | commit 前失败可无变化；commit 后失败 base 已变 |
| 人工审查 | 有（PR） | 无（直接 commit）或有（bot PR，等同方案 1） |
| 更新记录 | artifact + PR + 日志 | artifact + commit；operator 需额外记录 |
| 与 P0-03/ADR | 一致 | 冲突 |
| 与 Out of scope | 一致 | 冲突（自动更新基线） |
| 风险 | owner bypass/单账号审计限制 | 特权 workflow、写 token、回滚困难 |

### 6.5 研究建议

采用方案 1，并把 dispatch 保持为**只读验证器**：

- `baseline` 必填；`candidate_sha` 必填；未知目标/缺省目标拒绝。
- 验证候选目标三件一致 + 非目标基线字节相等 + registry 目标 entry 合法。
- 输出完整 `baseline-update-meta.json` 和验证报告 artifact；不写 base。
- owner 合并 PR；合并后 evidence 重新验收。
- 若 03 决定 registry 变更也必须走同一通道，则在候选 diff 白名单中加入 registry 目标 entry，并要求非目标 entry 字节相等。

## 7. 汇总判定：单 job 双 step 如何不误判 PASS

### 7.1 推荐结构

```text
job: evidence (name 不变，仍是 required check)
  steps:
    1. 校验 base 分支为 main
    2. checkout trusted base（含 packages/scripts/.scratch/baselines/A manifest dir/B manifest dir）
    3. checkout PR head as data（含 A roots/B roots/A manifest dir/B manifest dir/.scratch/baselines）
    4. 回验 base SHA / head SHA
    5. 读取 base registry；校验 schema/路径/必需基线/交叉绑定/覆盖
    6. 比较 head registry/manifest/anchor/log（按 §3.4 策略）
    7. Verify baseline A        (id: verify-a; 独立 OUT)
    8. Verify baseline B        (id: verify-b; if: always(); 独立 OUT)
    9. Aggregate                (id: aggregate; if: always(); 检查 A/B outcome + 文件 + status)
   10. Upload A artifact         (if: always())
   11. Upload B artifact         (if: always())
   12. Upload aggregate artifact (if: always())
```

“单 job、双 step”指**两个验证 step**；checkout/汇总/上传是辅助 step，不新增 job、不新增 required check。

### 7.2 逐场景判定

| 场景 | step 结果 | 汇总应做什么 | 整体 |
|---|---|---|---|
| A PASS, B PASS | verify-a/b = success；summary pass；report pass | 确认两者 manifest 路径/摘要/anchor matched；exit 0 | PASS |
| A FAIL, B PASS | A step failure；B success | 看到 A outcome=failure ⇒ 打印 A 诊断并 exit 1 | FAIL（B PASS 不掩盖 A） |
| A PASS, B FAIL | A success；B failure | B outcome=failure ⇒ exit 1 | FAIL |
| A FAIL, B 被跳过 | A failure；B outcome=skipped（无 `if: always()`） | 检查 outcome != success ⇒ exit 1 | FAIL，且暴露“B 未执行” |
| A FAIL, B 仍执行并 PASS | A failure；B success | A failure ⇒ exit 1；B 结果单独报告 | FAIL |
| 验证脚本崩溃/找不到 CLI | step failure；可能无 summary | outcome=failure + summary 缺失 ⇒ exit 1 | FAIL |
| `summary.json` 缺失 | step 可能 success（例如脚本缺陷） | 文件检查失败 ⇒ exit 1 | FAIL |
| `report.json` 缺失或 `status != pass` | step 可能 success | 读 report 检查 ⇒ exit 1 | FAIL |
| `status=blocked`/`incomplete` | step 可能 exit 1（现有 CLI 非 pass 即 exit 1） | 检查 `status == pass`、`exitCode == 0` | FAIL |
| Anchor mismatch | CLI exit 1；报告 `trust.result=mismatch` | 检查 outcome + trust.result | FAIL |
| artifact 未生成 | 上传 step 可能成功（默认 `warn`） | 汇总先检查磁盘文件；上传用 `if-no-files-found: error` 或显式 pre-check | FAIL（不能让 warn 变 PASS） |
| step 被 `if` 条件跳过 | outcome=skipped | 汇总必须把 skipped 当 FAIL | FAIL |
| 整个 job 被 job 级 `if` 跳过 | required check 可能报 Success | **禁止 job 级 `if`/paths 过滤**；否则无法在 job 内补救 | 可能 PASS（必须避免） |
| job 被取消 | conclusion=cancelled | required check 不满足；汇总可能不运行 | FAIL/blocked，不会 PASS |
| `continue-on-error: true` | outcome=failure，conclusion=success | 汇总用 **outcome** 而不是 conclusion；且不要设置 continue-on-error | FAIL（若用 outcome） |
| 两个 step 写同一个 OUT 目录 | 报告可能互相覆盖/最新报告误取 | 每个基线独立 OUT；汇总按路径读 | 设计上避免 |
| A/B 报告被交换 | 两份都 pass，但身份错配 | 汇总校验 `report.input.manifest.path` / `sha256` 与 base registry/Anchor 期望一致 | FAIL（身份错配） |

### 7.3 关键平台语义（E1-doc）

- **step 默认条件**：未写 status check function 时，GitHub 自动应用 `success()`；前序失败则后续 step 跳过。要让 B 在 A 失败时仍执行，B 必须 `if: always()` 或 `if: !cancelled()`（并保留显式判定）。`[E1-doc]` [Expressions: status check functions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions)
- **`always()` 只保证执行，不保证成功**：它“Causes the step to always execute, and returns true, even when canceled”；汇总仍要读真实结果。`[E1-doc]` 同上。
- **job 失败**：step 失败默认使 job 失败；`continue-on-error: true` 才会“allow a job to pass when this step fails”。`[E1-doc]` [Workflow syntax: jobs.<job_id>.steps[*].continue-on-error](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- **step outcome vs conclusion**：`outcome` 是应用 `continue-on-error` 之前的结果；`conclusion` 是之后的结果。汇总应使用 `steps.<id>.outcome`，这样即使有人误加 `continue-on-error` 也能发现 failure。`[E1-doc]` [Contexts: steps](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#steps-context)
- **required check**：成功状态包括 `success`、`skipped`、`neutral`；**job 被 conditional 跳过会报 Success**；workflow 被 path/branch filtering 跳过的 check 会停在 Pending 并阻塞合并。`[E1-doc]` [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
- **artifact**：`if-no-files-found` 默认 `warn`（action 成功但警告），可设 `error`；同名 artifact 不能在同一 job/多 job 中修改，名字必须唯一。`[E1-doc]` [actions/upload-artifact README](https://github.com/actions/upload-artifact)
- **workflow_dispatch check** 不出现在 PR checks，也不满足 required check；它只能作为 owner 验证器。`[E1-doc]` 同上 troubleshooting 页。

### 7.4 汇总脚本的伪代码（研究建议，不是实施）

```bash
# 环境变量由 workflow 以固定路径传入；不要把文件内容拼进 shell。
node base/scripts/dual-baseline-aggregate.mjs \
  --a-outcome "$A_OUTCOME" \
  --b-outcome "$B_OUTCOME" \
  --a-summary "$OUT_A/summary.json" \
  --b-summary "$OUT_B/summary.json" \
  --a-report   "$OUT_A/report-dir/report.json" \
  --b-report   "$OUT_B/report-dir/report.json" \
  --registry   "$BASE_REGISTRY" \
  --out        "$OUT_SUMMARY"
```

脚本逻辑（全部在 base）：

1. 读 registry；按 ID 找 A/B 的期望 Manifest 路径、Anchor 摘要。
2. `A_OUTCOME === "success"` 且 `B_OUTCOME === "success"`；否则 FAIL。
3. `summary.json` 存在且 `pass === true`、`status === "pass"`、`exitCode === 0`；否则 FAIL。
4. `report.json` 存在且 `status === "pass"`、`input.manifest.path` / `input.manifest.sha256` 与 registry/Anchor 期望一致、`trust.result === "matched"`；否则 FAIL。
5. 可选：检查 `summary.trustAnchor` / `summary.manifestSha256` 与 base Anchor 一致。
6. 写 `aggregate.json`（A/B outcome、期望/实际 Manifest 路径与摘要、报告路径、总体结论、诊断），并打印人类可读 summary。
7. 任何一项不满足 ⇒ `process.exitCode = 1`；绝不 `|| true`、绝不 `continue-on-error`。

**注意**：汇总脚本本身必须来自 base；不能读 head 的脚本。若汇总脚本缺失/构建失败，job 失败，required check 不会绿。

## 8. A 兼容：registry 引用与 `check-manifest-updates` 扩展

### 8.1 A 的三件文件如何被 registry 引用

- registry entry 精确写 A 的三个路径；不复制、不移动、不改名。
- A 的 Anchor 是单行 `sha256:<64 hex>`；A 的更新日志是 markdown，最后一条 `- newSha256:` 匹配 Manifest。
- A 的 Manifest `format` 是 `delivery-evidence-manifest/v1`；registry 的 `manifestFormat` 与它一致。
- A 的 `subject` 与 B 相同，所以 registry 的 `id` + 路径是唯一身份；不要按 `subject` 去重或分组。
- A 的 223/151/72/13、Anchor、更新日志在 P0-04 中零改动；registry 是新增文件，不触碰 A。

### 8.2 现有 `check-manifest-updates` 的行为

`scripts/check-manifest-updates.mjs`：

- 必需 `--log` 和 `--manifest`；缺参 `exit 2`；
- 读日志，匹配 `^\s*-\s*newSha256:\s*(\S+)\s*$`，取最后一条；
- 校验 `sha256:[0-9a-f]{64}`，并与 Manifest **原始字节** SHA-256 比较；
- 失败 `exit 1`；成功打印一条消息。
- 它已经参数化，**B 可以直接用同一脚本**；A 的现有调用 (`evidence.yml`) 完全不变。`[E1]`

### 8.3 扩展形状与 A 回归风险

| 方案 | 做法 | A 回归风险 | 适用 |
|---|---|---|---|
| **A. 不修改脚本，调用两次** | A step 保持原命令；B step 用 B 的 `--log/--manifest` | 最低；A 命令与代码均不变 | 04/05 的最小实现；推荐作为基线 |
| **B. 新增 wrapper** | `check-baselines.mjs --registry <registry>` 读 registry，逐条调用现有脚本；严格的“缺失/重复字段”校验放 wrapper；现有脚本不动 | 低；A 走同一核心；wrapper 需要测试 | 03 要 registry 驱动/严格字段时 |
| **C. 修改现有脚本增加可选模式** | 保留原 `--log/--manifest` 分支行为；新增 `--registry`/`--baseline` 分支；严格 parser 只在 registry 模式启用 | 中；必须证明原分支输出/exit 不变；A 现有日志字段不能被新规则误伤 | 只在 03 明确要求时 |

**严格 parser 的兼容要求（来自 04 票）：**

- 拒绝缺失字段、重复字段、非法摘要格式、最后一条与 Manifest 不匹配；
- 支持 A/B 两个日志；
- A 的现有调用与行为不变。

A 的现有条目字段：

```text
- reason: ...
- subject: ...
- oldSha256: none (initial freeze)
- newSha256: sha256:...
- evidence: ...
- verifiedBy: ...
- recordedIn: ...
```

这些字段不是“PRD 更新记录”的全部字段（没有 `baselineId`/`operator`/`commitSha`/独立时间）。因此：

- 若严格 parser 要求 `baselineId`/`operator`/`commitSha`，**A 现有条目会失败**，违反 A 零改动。
- 正确做法：把 A 现有字段设为“基线必需”，新字段设为“可选”；或者在 wrapper 里按 registry 的 `id` 注入上下文，不要求日志字段。
- 若要为 B 的初始 freeze 条目采用同样字段，B 日志与 A 对称；新字段可在后续更新条目中逐步加入；parser 必须允许可选字段和未知字段（或显式白名单）。
- 重复字段（同一 key 在一个条目内出现两次）应拒绝；A 当前没有重复。

### 8.4 不回退证明计划（供 04/05 执行）

**E1（本票已做）**

- A 的 Manifest/Anchor/日志路径、字节、最后一条 `newSha256` 匹配；A 摘要与 `map.md` 一致。
- 现有脚本逻辑只依赖 `--log/--manifest`，与基线 ID 无关。

**E2（04/05 必须做）**

1. A 正例：用 A 的真实文件运行 `check-manifest-updates`，断言 exit 0、输出包含同一摘要。
2. A 负例：缺失条目、格式错误、Manifest 篡改（只读 fixture 或临时副本）、重复字段，断言 exit 1/2 与具体消息。
3. B 正例：B 的新 Anchor/日志/Manifest；断言 exit 0。
4. B 负例：同样矩阵。
5. 如果新增 wrapper：A 的调用路径与直接调用结果一致；registry 驱动循环中 A 的期望/实际摘要一致；B 失败不影响 A 的诊断输出。
6. 汇总测试：A fail/B pass、A pass/B fail、双 fail、B skipped、summary 缺失、status != pass、anchor mismatch、report 缺失。

**E3（04/05/07 必须做）**

- 合并后真实 `evidence` PR run：A 仍 151 required / 72 optional / 13 records / diagnostics 0 / `trust.anchor=matched`；B 137/94/6 / pass；A 的 Manifest/Anchor/日志字节零变化。
- 真实 dispatch：target=A、target=B、缺省 target、目标身份不匹配；记录 run URL、退出状态、artifact。
- 真实红绿：07 的 1 绿 + 4 红；A/B 负向样本选独占路径（见 §5.2）。

### 8.5 A 兼容的额外注意

- **不要**把 A 的更新日志改成新 schema；04 只新增 B 的文件。
- **不要**把 A 的 Anchor 改成 JSON 或加 `baselineId`；registry 的路径绑定提供身份。
- **不要**把 A 的 Manifest 复制到 `.scratch/baselines`；registry 只引用原路径。
- 如果 workflow 用 registry 循环替代 A 的 step，A 的 step 名称/诊断/输出顺序可能变化；05 必须证明 A 的 summary/report 字段不变，且 A 的失败诊断仍可定位。建议保留显式 A step，B 用并列 step，汇总统一；这样 A 回归面最小。
- A 的日志校验目前在 evidence job 的单独 step 中；如果改成 registry 循环，要保留“base A 日志必须匹配”的检查，且不能用 head 日志替代 base 日志。

## 9. 报告身份：`verify-delivery` 是否需要 `baselineId`

### 9.1 现状

`DeliveryVerificationReportSchema` 是严格对象，当前字段：

- `format: "delivery-verification/v1"`
- `input.manifest.path`、`input.manifest.sha256`
- `input.subject`（A/B **完全相同**：同一 pack/site/shell）
- `trust`（可选；`expectedSha256` / `actualSha256` / `mode` / `result` / 可选 `baseManifest`）
- `scope`、`declared`、`recomputed`、`comparison`、`results`、`diagnostics`、`status`、`exitCode`、`limitations`

**没有 `baselineId`。** A/B 只能靠 `input.manifest.path`、`input.manifest.sha256`、`trust.expectedSha256` 区分。`[E1]`

### 9.2 风险

1. **同名 artifact/同一目录**：如果 A/B 都写到同一个 OUT 目录，`evidence-acceptance.mjs` 通过“最新 `*-delivery-verification` 目录”找报告；两个基线的报告可能被混淆/最新覆盖（虽然 CLI 本身不会覆盖历史目录，但“最新”选择会取错）。`[E1]`
2. **人工审查**：两份报告 `subject` 相同，打开后第一眼可能分不清 A/B；数量 223/231 不同，但不是显式身份。
3. **汇总**：如果汇总只检查“存在一个 pass 报告”，A 的报告可能被当成 B 的；必须按 `manifest.path/sha256` 与 registry/anchor 比对。
4. **artifact**：同名 artifact 冲突/覆盖；artifact 名必须区分基线。`[E1-doc]`

### 9.3 方案

| 方案 | 做法 | 代码影响 | 兼容性 | 评价 |
|---|---|---|---|---|
| **A. CLI 加可选 `--baseline-id`** | `verify-delivery` 增加可选 flag；报告 `input.baselineId` 可选；`--baseline-id` 不传时旧行为 | pipeline schema + CLI + renderMarkdown + tests | 旧报告仍合法（字段可选）；需决定是否升 `format` 版本 | 一等身份；改动最大 |
| **B. wrapper 加 `--baseline-id`** | `evidence-acceptance.mjs` 增加可选参数，写入 `summary.json` 的 `baselineId`；报告不变 | 一个脚本 + 测试 | A 旧调用不带参数时 summary 多一个 `null` 字段；若严格 schema 不允许新字段，需允许或只在传参时加 | 低风险；推荐 P0-04 |
| **C. 仅 CI 层区分** | 独立 OUT 目录、独立 artifact 名；汇总用 registry 的期望 `manifest.path/sha256` 校验每份报告 | workflow/汇总脚本 | 无 CLI/脚本改动 | 安全上足够；人工可读性靠目录/artifact 名 |
| **D. 加必填 `baselineId`** | 报告必须有 ID | schema/CLI/所有调用 | **破坏旧报告/A 现有行为** | 不推荐 |

### 9.4 研究建议

- **P0-04 不需要改 CLI 就能保证安全**：报告里的 `input.manifest.path/sha256` + `trust.expectedSha256` 已足以绑定身份；汇总只要与 registry/base Anchor 比对，不靠“最新报告”或 subject。
- **推荐 B + C**：`evidence-acceptance` 的 `summary.json` 增加可选 `baselineId`（由 CI 传入）；独立 OUT/artifact；汇总按 ID + 期望路径/摘要校验。这样不改 `verify-delivery` 的严格 schema，也不影响 A 的报告。
- **如果 03 要一等身份**：再考虑 A，把 `baselineId` 作为**可选**字段加入 `DeliveryVerificationReportSchema.input`，保留 `format` 或明确升版；旧报告/A 的无 ID 报告仍合法。不要做 D。
- 无论选哪种，**不能**用 `input.subject` 区分 A/B；两者完全相同。

## 10. 引用与来源

### 11.1 仓库内权威

- `docs/v7.6/接入.md`（P0-04 PRD，只读）
- `.scratch/p0-04-dual-baseline-ci/rulings-2026-11-01.md`
- `.scratch/p0-04-dual-baseline-ci/map.md`
- `.scratch/p0-03-evidence-trust/map.md`
- `docs/adr/0001-evidence-trust-boundary.md`
- `.github/workflows/evidence.yml`
- `.github/workflows/baseline-update.yml`
- `.github/workflows/ci.yml`
- `scripts/evidence-acceptance.mjs`
- `scripts/check-manifest-updates.mjs`
- `packages/pipeline/src/evidence-integrity.ts`（`DeliveryVerificationReportSchema`、`verifyDeliveryEvidence`、`AnchorOptions`、`writeVerificationReport`、路径安全）
- `packages/cli/src/evidence.ts`、`packages/cli/src/cli.ts`
- `.scratch/evidence-integrity-v1/manifest/{expected-hashes.json,expected-hashes.sha256,MANIFEST-UPDATES.md}`
- `.scratch/p0-02-second-demo-v2/manifest/final-manifest.json`
- `.scratch/p0-03-evidence-trust/research/github-trust-mechanics.md`

### 11.2 一手外部来源（E1-doc）

1. GitHub Docs, “Events that trigger workflows” — `pull_request_target`、`workflow_dispatch`：  
   <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target>  
   <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch>
2. GitHub Docs, “Securely using pull_request_target”（含默认 event policy、checkout/执行边界）：  
   <https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target>
3. GitHub Docs, “Evaluate expressions in workflows and actions” — status check functions（`success`/`always`/`failure`、默认 `success()`）：  
   <https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions>
4. GitHub Docs, “Workflow syntax for GitHub Actions” — `jobs.<job_id>.steps[*].if`、`continue-on-error`：  
   <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax>
5. GitHub Docs, “Contexts reference” — `steps.<id>.outcome`/`conclusion`、`github.actor`/`github.triggering_actor`：  
   <https://docs.github.com/en/actions/reference/workflows-and-actions/contexts>
6. GitHub Docs, “Troubleshooting required status checks” — skipped job 报 Success、path filtering 停 Pending、`workflow_dispatch` check 不满足 required check：  
   <https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks>
7. GitHub Docs, “Manually running a workflow” — write access required：  
   <https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow>
8. GitHub Docs, “About Actions policies”（`pull_request_target` 默认 policy）：  
   <https://docs.github.com/en/actions/concepts/about-actions-policies>
9. actions/checkout v7 README — `allow-unsafe-pr-checkout`、`sparse-checkout`、`sparse-checkout-cone-mode`、`path`：  
   <https://github.com/actions/checkout/blob/v7.0.1/README.md>
10. actions/checkout v7 `unsafe-pr-checkout-helper.ts`（默认拒绝 fork PR）：  
    <https://github.com/actions/checkout/blob/v7.0.1/src/unsafe-pr-checkout-helper.ts>
11. actions/upload-artifact README — `if-no-files-found`、artifact 唯一性/不能修改同名 artifact：  
    <https://github.com/actions/upload-artifact>
12. Git, “git-sparse-checkout”（cone mode）：  
    <https://git-scm.com/docs/git-sparse-checkout>

### 11.3 本文件中的 E3-本地命令

```text
$ shasum -a 256 .scratch/evidence-integrity-v1/manifest/expected-hashes.json \
    .scratch/p0-02-second-demo-v2/manifest/final-manifest.json
# exit=0；输出见 §1.2

$ node scripts/check-manifest-updates.mjs \
    --log .scratch/evidence-integrity-v1/manifest/MANIFEST-UPDATES.md \
    --manifest .scratch/evidence-integrity-v1/manifest/expected-hashes.json
# exit=0；输出见 §1.2
```

A/B 路径重叠由只读 Python 解析两个 Manifest 的 `roots` + `files[].path` 后计算；未写任何文件。结果：73 个绝对路径重叠（28 双方 required、30 A required/B optional、15 双方 optional），0 个共享路径哈希不一致。`[E3-本地]`

## 11. 交给 03 的待裁定问题（OPEN DECISIONS）

以下每一项都列出选项、权衡与研究建议；**最终由 03 HITL 裁定，本票不替用户做架构决策**。

### OD-01 Registry schema 的字段与严格度

- 选项：最小（id + 3 路径）/ 加 identity / 加 manifestFormat / 加可选 display/counts。
- 权衡：字段越多，registry 越像“第二份配置”；identity 有助于交叉检查，但 A/B subject 相同，不能靠它区分；counts 若作为门槛会制造第二期望值。
- 建议：id + name + manifestFormat + 3 路径 + identity；**不存摘要、不存文件哈希、不把 counts 作为门槛**；strict 拒绝未知字段。
- 待定：`identity` 是否必填；`counts` 是否只作诊断；是否允许 notes。

### OD-02 基线 ID 与身份映射

- 选项：`fpvs-v1` / `p0-02-second-demo-v2`；或 `A` / `B`；或使用 PRD 名称。
- 权衡：稳定 ID 用于 workflow `baseline` 输入、artifact 名、诊断；`A/B` 简短但语义弱；中文名不适合作为机器 ID。
- 建议：使用稳定 ASCII ID（如 `fpvs-v1`、`p0-02-second-demo-v2`），A/B 仅作人类简称；由于 A/B `subject` 相同，**禁止用 subject 作为 ID/去重键**。

### OD-03 路径校验规则与允许范围

- 选项：只允许 `.scratch/` 下相对路径 / 只允许各基线 manifest 目录 / 允许任意 repo 相对路径但 realpath 限制在仓库内。
- 权衡：过窄会限制未来布局；过宽需要更严的交叉/符号链接校验。
- 建议：repo 根相对 POSIX；拒绝绝对/`..`/反斜杠/空；`realpath` 必须在仓库内；Manifest/Anchor/日志必须是普通文件；A/B 三件同目录；跨 entry 路径唯一；不允许 symlink 逃逸。是否允许 manifest 目录外 Anchor，需 03 明确。

### OD-04 “必需基线集合”如何保证

- 选项：workflow 硬编码 `["A","B"]` 并断言 registry 含两者 / 完全 registry 驱动 / 只在测试中检查。
- 权衡：硬编码能防止 base registry 误删 B，但第三套基线要改 workflow；完全驱动更通用，但“少一套”可能静默。
- 建议：workflow 或 base 校验脚本显式断言 A/B 两个 ID 存在（P0-04 只要求 A/B）；第三套基线扩展时再决定是否改为配置。这样 Registry 不是唯一“记得检查几套”的地方。

### OD-05 head registry 差异：拒绝 / 忽略 / 诊断

- 选项与权衡见 §3.4。
- 建议：普通 PR 要求 **字节相等，不同即 FAIL**（`registry.head-diff`）；owner 更新走 dispatch + PR；首次引入 registry 用 bootstrap 特例。
- 待定：bootstrap 特例的精确条件；registry 变更 PR 是否必须 bypass，还是允许 owner actor 白名单（不建议在 evidence 里按 actor 放行，会削弱“head 不可信”）。

### OD-06 head Anchor / 更新日志是否也做字节相等

- 选项：只比较 Manifest（现状）/ Manifest + Anchor + 日志 / 全部 + registry。
- 权衡：只比 Manifest 时，单独改 Anchor/日志的 PR 可能无害通过；扩展比较能给出“明确失败”，但改变 A 的失败面（A 零回退口径）。
- 建议：若 03 接受“A 行为增强但不改变正常路径”，对 A/B 都做 Manifest + Anchor + 日志比较；若坚持 A 行为完全不变，则至少对 B 做三件比较，A 保持现状，并在 08 说明“A 的 Anchor/日志单独变更不会显式失败，但不会被使用”。推荐前者以获得一致的明确诊断。

### OD-07 Registry 更新通道与目标隔离

- 选项：与目标基线更新同一个 owner PR + dispatch / registry 单独 owner PR / 自动写回。
- 权衡：同一个 PR 最省，但 registry diff 需要非目标 entry 字节相等；单独 PR 更清晰但多一次合并；自动写回见 §6.3。
- 建议：同一个 owner PR + dispatch，`baseline` 必填；候选 diff 仅允许目标三件 + registry 目标 entry；非目标 entry/文件字节相等；registry-only 变更（新增/删除基线）不在 P0-04 范围。

### OD-08 更新记录的规范位置与字段

- 选项：目标更新日志为唯一规范记录 / dispatch artifact + PR 为规范记录 / 两者都写。
- 权衡：A 日志没有 `operator`/`commitSha`/独立时间；要求这些字段会破坏 A 旧条目；artifact 30 天会过期；PR/commit 长期。
- 建议：dispatch artifact（`baseline-update-meta.json`）+ PR body 作为完整记录；更新日志按 A 现有字段追加，新增字段可选；A 旧条目不动。若 03 要求日志为唯一规范，需接受 A 旧条目迁移或扩展 parser（不建议在 P0-04 做）。

### OD-09 owner-only 的强制执行方式

- 选项：只依赖 `workflow_dispatch` 的 write access / actor ID allowlist / GitHub Environment 保护 / 不额外限制。
- 权衡：write access 不区分 owner 与其他 write 协作者；actor allowlist 简单但硬编码账号；Environment 保护更强但增加平台配置；re-run 使用 `github.actor` 权限。
- 建议：至少记录 `github.actor_id`/`github.triggering_actor`；若 03 要求严格 owner-only，加 actor ID 检查（并测试 re-run 行为）；当前单账号仓库可在 08 说明实际边界。

### OD-10 汇总 step 的判定细节

- 选项：只检查 `outcome` / `outcome + summary.json` / `outcome + summary + report + status + anchor` / 再加 expected manifest 路径与摘要。
- 权衡：检查越少越容易误判 PASS；检查越多越依赖报告 schema；artifact 上传默认 warn 不能当判据。
- 建议：`outcome==success` + `summary.pass/status/exitCode` + `report.status` + `report.input.manifest.path/sha256` + `trust.result=matched` + 文件存在；artifact 用 `if-no-files-found: error` 或汇总前 pre-check。**禁止 job 级 `if`/paths 过滤**；汇总 `if: always()`；不要 `continue-on-error`。

### OD-11 Artifact 布局与命名

- 选项：A/B 两个 artifact + 汇总一个 / 一个 artifact 下 A/B 子目录 / 只保留汇总。
- 权衡：两个 artifact 独立、易下载；一个 artifact 便于整体查看；只保留汇总会丢失单基线证据。
- 建议：A/B 各自 artifact（含 `report.json`/`report.md`/`summary.json`）+ 一个 aggregate artifact；名字含 PR 号与基线 ID；保留 30 天；不要让同名 artifact 覆盖。

### OD-12 报告身份：CLI `baselineId` / wrapper summary / CI-only

- 选项见 §9.3。
- 建议：P0-04 用 wrapper summary + 独立源/artifact + 汇总按期望路径/摘要校验；若 03 要一等身份，CLI 加**可选** `input.baselineId`，不改必填、不破坏旧报告。不要用 `subject` 区分。

### OD-13 `check-manifest-updates` 扩展形状

- 选项：不修改/调用两次；新增 wrapper；修改现有脚本加 registry 模式。
- 权衡：不修改风险最低；wrapper 适合 registry 驱动；修改脚本要证明 A 旧路径零回归；严格字段校验与 A 旧日志字段冲突。
- 建议：04 先用“A 原命令 + B 并列调用”；若 03 要统一 registry 驱动，新增 wrapper，现有脚本不动；严格 parser 只在 wrapper/新模式启用，A 旧字段作为必需，新字段可选。

### OD-14 B Anchor 的格式与身份绑定

- 选项：与 A 完全对称的单行 `sha256:<hex>`；或 JSON `{baselineId, manifestSha256}`；或注释行加 ID。
- 权衡：对称最简单，A 零改动；JSON 有显式身份但 B/A 不对称，且要改校验脚本；A 的 Anchor 无法加 ID。
- 建议：B 用与 A 相同的单行格式，身份由 registry 的 `id` + 路径绑定；若 03 要求 Anchor 自身带 ID，则 B 用 JSON，但必须保留 A 单行格式兼容（不能要求 A 改）。

### OD-15 Sparse checkout 的覆盖与漂移检测

- 选项：workflow 硬编码 A/B union + 覆盖断言 / 分阶段 checkout + 动态 sparse / 全量 checkout（太重）。
- 权衡：硬编码简单但第三套基线要改；动态 sparse 复杂且有二次 checkout 风险；全量 checkout 体积大/慢。
- 建议：P0-04 硬编码 A/B union；base 脚本读取 registry 与 Manifest roots，断言每个 Manifest/Anchor/日志和每个 root 都存在（不存在 ⇒ `registry.sparse-missing` FAIL，不能当“无差异”）；第三套基线再决定是否动态化。

### OD-16 Bootstrap 与实施顺序

- 选项：registry + B Anchor/日志 + workflow 在同一个 PR / 拆 PR / 先用 dispatch 验证候选再合并。
- 权衡：同一 PR 的影响面大；拆 PR 更易审查但中间状态可能没有 B gate；`pull_request_target` 用 base workflow，所以新增 B 检查的 PR 本身不会跑新逻辑。
- 建议：先由 04 落 B Anchor/日志，再由 05 落 registry + workflow；05 的候选 PR 用 `baseline-update` dispatch 验证 B，合并后立即用真实 PR 跑一次；07 再做正式红绿。具体拆分由 03/05 决定，但**必须承认“新增 B 检查的 PR 本身通常不会执行新的 B step”**（因为 base workflow 还是旧的），需要 dispatch 或合并后探测补足证据。

### OD-17 Registry 是否纳入 `pnpm check` / `check:links` / 测试

- 选项：纳入 schema 测试 / 只由 CI registry 校验器检查 / 两者都做。
- 权衡：纳入 `pnpm check` 能早期发现格式错误，但会让每个 PR 的 check 依赖 registry；registry 尚不存在时需条件处理。
- 建议：至少加单元测试（schema/路径/重复/交叉/缺基线）；是否进 `pnpm check` 由 03/05 决定；不要在 registry 尚未合并时让 `check` 失败。

### OD-18 07 负向样本的路径选择

- 选项：A 篡改用共享 `fa04` 文件 / A 篡改用 A 独占 required；B 篡改用 B `freeze` 独占 required / 共享文件。
- 权衡：共享文件会同时打红 A/B，无法证明“独立验收”；独占文件能证明 A/B 不互相掩盖。
- 建议：A 用 A 独占 required（`snapshot`/`gp`/`runs` 等）；B 用 B `out` freeze 下的独占 required；B Manifest+Anchor 联合篡改用 B Manifest 自身；验收规则篡改用 workflow/script 变更。此建议依赖 01 审计确认具体文件，不在 02 直接指定。
