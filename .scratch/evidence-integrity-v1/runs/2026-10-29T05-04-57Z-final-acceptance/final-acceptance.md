# Evidence Integrity V1 · 最终验收记录

- 结论：**pass**
- 时间：2026-10-29T06:12:22.974Z
- 对象：wasteland-scavenger-recipe · pack v1 · site v1 · shell 2
- 清单：`.scratch/evidence-integrity-v1/manifest/expected-hashes.json` · 223 文件（required 151 / optional 72）· 19.3 MB · sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd
- 报告：`report.json`（sha256:7f1bb1525a78c5e4429ba99f21550b683773ddb5a2c54c63cabea9a2105bdda2）/ `report.md`

## 证据完整性重算

- status **pass** · CLI exit 0 · 1546ms
- 文件 223/223 verified · 身份 11/11 verified · 一致性 144/144 verified
- records 13 · diagnostics 0
- declared **pass** / recomputed **pass** · verdictMatch=true · 六项 checks 全 match=true

## 回归（退出码）

| 命令 | exit | 耗时 | 证据 |
|---|---|---|---|
| `pnpm test` | 0 | 25.0s | `regression/test.exit`（详细日志本地） |
| `pnpm typecheck` | 0 | 10.0s | `regression/typecheck.exit`（详细日志本地） |
| `pnpm test:playtest` | 0 | 33.0s | `regression/playtest.exit`（详细日志本地） |
| `FREE_ACCEPTANCE_OUT=<run>/acceptance pnpm test:acceptance` | 0 | 32.0s | `regression/acceptance.exit`（详细日志本地） |
| `pnpm test:evidence -- --out <run>/evidence` | 0 | 1.5s | `regression/evidence.exit`（详细日志本地） |
| `EI_OUT=<run>/07-inherited-copy.json node .scratch/evidence-integrity-v1/scripts/07-verify-inherited-copy.mjs` | 0 | — | `regression/07-crosscheck.exit`（详细日志本地） |

## DoD 10 条

### 1. 正式验收入口会重新计算所有范围内必需证据的哈希 — **MET**

- report.results.files: 223/223 verified（required 151）
- 入口：`verify-delivery --manifest`（CLI）与 `pnpm test:evidence`；CLI exit 0
- 清单 sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd

### 2. 证据缺失、篡改和不可读取均可被发现 — **MET**

- 负向测试：内容篡改 → hash-mismatch/fail；必需文件缺失 → missing/blocked；目录冒充文件 → unreadable/blocked
- `packages/pipeline/tests/evidence-integrity.test.ts` 18 个用例，全部在 `pnpm test` 内通过

### 3. 身份、引用及关键报告的一致性得到正式校验 — **MET**

- report.results.identities: 11/11 verified；report.results.consistency: 144/144 verified
- 13 条 records 全部解析；diagnostics=0
- 负向测试：身份不符/字段缺失、报告引用错 attempt、材料集合不一致、三方哈希矛盾

### 4. 最终结论从当前有效检查重新计算，而非直接继承历史声明 — **MET**

- declared=pass · recomputed=pass（由当前证据重导出，deriveDeliveryVerdict）
- 负向测试「结论过期：声明 pass，当前必需证据失效 → 不再 pass」

### 5. 声明结论与重算结论的差异可被定位 — **MET**

- report.comparison.verdictMatch=true；六项 check 逐项 declared/recomputed/match
- 失败诊断带 root/path/rule（hash-mismatch、path-invalid、reference-invalid、unreadable…），非笼统 verification failed

### 6. 负向测试覆盖篡改、缺失、错配、路径逃逸和结论过期 — **MET**

- 18 个 pipeline 用例：篡改 / 缺失 / 身份不符 / 身份缺 / 三方矛盾 / verdict 不一致 / `..` 越界 / 不可读 / root 外链接 / 悬空链接 / root 内合法链接 / 绝对路径 / 引用错 attempt / 材料集合 / 结论过期 / 只读性 / 确定性
- 6 个 CLI 用例：usage/invalid/--out 越界/blocked 落盘/fail 定位/目录不覆盖

### 7. 测试证明原始证据、历史记录和受保护交付未被修改 — **MET**

- 312 个受保护文件运行前后逐文件 sha256 零变化（snapshot 66 · pack/site 50 · reference 14 · FA-04 29 · FA-05 10 · FA-06 162 · 06 attempts 28 · 09 2 · work qa-report 1）
- 证据目录 `git status` 零改动（fpvs-v1-final / generic-playtest-v1 / manifest）

### 8. 当前冻结 Demo 通过正式基线重验，或对任何差异作出明确、可审计的解释 — **MET**

- 本次重验 status=pass · exit 0 · 1546ms · 223 文件（required 151）· 13 records · diagnostics=0
- 07 独立交叉：27 项 / failed 0

### 9. `pnpm test`、`pnpm typecheck`、`pnpm test:playtest`、`pnpm test:acceptance` 全部通过 — **MET**

- pnpm test exit 0（149 文件 / 2231 用例）
- pnpm typecheck exit 0
- pnpm test:playtest exit 0（self-test 4/4；10 文件 / 143 用例）
- pnpm test:acceptance exit 0（vitest + mechanic-probe + coverage satisfied，allOk=true）
- pnpm test:evidence exit 0（pass）

### 10. 不新增付费调用、不覆盖历史版本、不降低验收阈值 — **MET**

- 本次只运行本地命令：vitest / tsc / Chrome 探针 / verify-delivery；无生图或文本上游调用
- 历史 run/v1、pack/site、FA-04/05/06、06 attempts、09 补审零改动；新记录写入新目录
- 未修改 contracts 阈值或结论规则；本轮源码改动为零

## 只读性

- 312 个受保护文件运行前后逐文件 sha256 **零变化**（snapshot 66 · packSite 50 · reference 14 · fa04 29 · fa05 10 · fa06 162 · gp06 28 · gp09 2 · workQa 1）
- 证据目录 `git status` 零改动；历史 run/pack/site/验收记录未被覆盖。

## 已知限制

- 信任边界：哈希清单能发现相对清单的改动；发现不了清单与被验证据一起被改并提交 —— 后者由 git 提交历史与人工审查负责。三方哈希核对只增加内部矛盾检测，不增加防篡改强度。
- 单 Demo：V1 真实重验只覆盖冻结 FPVS-V1；第二个 Demo 的泛化验证留待后续（PRD §R3）。
- visual-review 机器边界：只校验审核记录的存在性、格式、subject 与材料一致性，不重判人工视觉结论；人工审核结果仍由既有审核流程提供。
- 不重新执行：本入口由已有证据重导出六项检查，不重新构建游戏、不重新执行 QA、不重新启动浏览器试玩。
- MCP 未做：本版未把 verify-delivery 镜像到 MCP（用户裁定 Q4 = (a)）。
- 可选日志：清单中 `*.log` 为 required:false，不在 git 信任边界内。
- 回归详细日志（`regression/*.log`、`chrome.log`）按 `.gitignore` 不入库，本地可复跑；入库的判据是 `regression/*.exit` 退出码与各 summary/报告 JSON。
- 耗时（本机实测墙钟）：pnpm test 25s · typecheck 10s · test:playtest 33s · test:acceptance 32s · test:evidence 1.5s（CLI 计时）· 证据读取约 19.3 MB。不作性能门槛。
- 历史限制继续披露：证据完整性通过 ≠ 五态真实 E2E、机制覆盖或视觉审核范围已完成。

## 最终原则

旧的 `pass` 是历史事实；本次 `pass` 来自当前证据完整性校验通过、六项检查有效、声明与重算一致。
