# P0-04 双基线维护说明

- 适用：`main` 上 A=`fpvs-v1`、B=`p0-02-second-demo-v2` 两套冻结交付基线。
- 权威：`docs/adr/0001-evidence-trust-boundary.md`、`docs/adr/0002-dual-baseline-trust-boundary.md`、本文。
- 原则：base-only 执行；普通 PR 只作为数据；更新只走 owner PR + 只读 dispatch；不自动写回。

## 1. 文件与路径

| 对象 | 路径 |
|---|---|
| Registry | `.scratch/baselines/registry.json` |
| A Manifest / Anchor / 日志 | `.scratch/evidence-integrity-v1/manifest/expected-hashes.json` / `.sha256` / `MANIFEST-UPDATES.md` |
| B Manifest / Anchor / 日志 | `.scratch/p0-02-second-demo-v2/manifest/final-manifest.json` / `expected-hashes.sha256` / `MANIFEST-UPDATES.md` |
| B 冻结 hash list | `.scratch/p0-02-second-demo-v2/freeze-sha256.txt` |
| B 冻结快照 | `.scratch/p0-02-second-demo-v2/freeze/wasteland-scavenger-recipe/`（112 文件） |
| Evidence workflow | `.github/workflows/evidence.yml` |
| Baseline update workflow | `.github/workflows/baseline-update.yml` |

Registry 只存身份与路径，不存摘要/counts；摘要只在各基线的 Anchor。

## 2. 日常验证命令

```bash
node scripts/validate-baseline-registry.mjs \
  --registry .scratch/baselines/registry.json --repo-root . \
  --require-ids fpvs-v1,p0-02-second-demo-v2 --exact-ids

node scripts/check-baseline-updates.mjs \
  --registry .scratch/baselines/registry.json --repo-root .

node scripts/verify-freeze-snapshot.mjs \
  --registry .scratch/baselines/registry.json \
  --baseline-id p0-02-second-demo-v2 --repo-root . --head-root . \
  --out /tmp/freeze-verification.json

pnpm test && pnpm typecheck && pnpm check:links
```

A/B 交付验收（本地，base=head 时用于回归）：

```bash
node scripts/evidence-acceptance.mjs --manifest .scratch/evidence-integrity-v1/manifest/expected-hashes.json \
  --expected-manifest-sha "$(tr -d '\r\n' < .scratch/evidence-integrity-v1/manifest/expected-hashes.sha256)" \
  --base-manifest .scratch/evidence-integrity-v1/manifest/expected-hashes.json --baseline-id fpvs-v1 --out /tmp/evidence-a

node scripts/evidence-acceptance.mjs --manifest .scratch/p0-02-second-demo-v2/manifest/final-manifest.json \
  --expected-manifest-sha "$(tr -d '\r\n' < .scratch/p0-02-second-demo-v2/manifest/expected-hashes.sha256)" \
  --base-manifest .scratch/p0-02-second-demo-v2/manifest/final-manifest.json \
  --anchor-mode digest+base --baseline-id p0-02-second-demo-v2 --out /tmp/evidence-b
```

## 3. 诊断 A/B 失败

1. 打开 `evidence` run，下载 `evidence-a-<PR>`、`evidence-b-<PR>`、`evidence-aggregate-<PR>` artifacts。
2. 先读 `aggregate.json`：
   - `outcomes`：A/B/BFreeze 的真实 step outcome；
   - `problems`：具体失败项；
   - `pass` 必须为 true。
3. 再看对应 summary/report：
   - `summary.pass/status/exitCode`；
   - `report.status`、`trust.result=matched`、`input.manifest.path/sha256`。
4. 常见诊断：
   - `file.hash-mismatch`：required 交付文件被改；
   - `registry.head-diff`：PR 改了 Registry；
   - `B Manifest/Anchor/update log/freeze differs from base`：PR 改了 B 信任配置；
   - `B-freeze mismatched`：112 冻结文件中有哈希不符（含 2 个 Manifest 外 `chrome.log`）；
   - `candidate.freezeHashes-changed`：更新候选试图改写冻结 hash list；
   - `registry.identity-mismatch` / `registry.path-*`：Registry 身份或路径不合法。
5. 判断是否互相掩盖：
   - A fail / B pass ⇒ 证明 B PASS 不掩盖 A FAIL；
   - A pass / B fail ⇒ 证明 A PASS 不掩盖 B FAIL；
   - 任一 A/B outcome 非 success、summary/report 缺失或 anchor 不匹配，aggregate 必须 FAIL。

## 4. 更新一套基线（owner 通道）

1. 从 `main` 创建候选分支；只改目标基线的 Manifest、Anchor、更新日志，以及（如身份变化）Registry 的目标 entry。
2. 不得改另一套基线、非目标 Registry entry、`freeze-sha256.txt` 或交付文件；普通更新不重新冻结 112 快照。
3. 候选校验：

```bash
node scripts/validate-baseline-candidate.mjs \
  --base-root . --candidate-root <candidate checkout> \
  --baseline <fpvs-v1|p0-02-second-demo-v2> \
  --changed-paths <git diff --name-only 输出> --out /tmp/candidate.json
```

4. owner dispatch：

```bash
gh workflow run baseline-update.yml --ref main \
  --field baseline=<baseline-id> \
  --field candidate_sha=<40 lowercase hex>
```

5. 检查 run 的 `baseline-update-meta.json`、`candidate-validation.json` 与 evidence summary/report；`result` 必须为 `pass`。
6. dispatch 只读、不写回 base；验证通过后由 owner 合并候选 PR，合并后再确认 `evidence` 用新 base 通过。
7. 失败时 base 不变；不要用 force push 回滚，必要时走修复 PR。

## 5. 新增第三套基线（P0-04 范围外）

当前 workflow 显式断言集合恰为 A/B；新增基线至少需要：

- Registry 新 entry（身份 + Manifest/Anchor/更新日志，按需 `freezeHashes`）；
- 独立的 Manifest/Anchor/更新日志与冻结快照；
- `evidence.yml` 的必需集合断言、sparse 路径、验证 step 与 aggregate 判定；
- `baseline-update.yml` 的 target 验证与测试；
- 新的真实 PR 红绿验收与裁定记录。

在此图范围内不实施；新增基线属于新的 effort。

## 6. 负向 PR 验收步骤

- 创建前取得 owner 确认；负向 PR 只保留失败证据，不合并。
- 使用各自独占 required 路径，避免共享 `fa04` / `oldWork`：
  - A：`fa05:regression/test.exit`（A-only required）；
  - B：`out:.../v3/success-basic/setup.json`（B-only required）；
  - B Manifest + Anchor 联合；
  - 规则篡改（D1：head workflow 绕过 + A 篡改），证明 base workflow 仍执行。
- 每个 PR 记录 PR URL、base/head SHA、evidence run URL、required checks、关键诊断、`mergeStateStatus=BLOCKED`、最终结论。
- 参考 07 的运行：`runs/2026-11-02T04-45-27Z-pr-acceptance/`。

## 7. 权限与限制

- `workflow_dispatch` 需要 write access；记录 `github.actor_id`/`triggering_actor`；不增加 actor allowlist。
- owner 仍有 PR bypass；本机制不防御管理员、GitHub 管理权限或 CI runner 被攻陷。
- A 的 head Anchor/日志不显式比较（A 只比 Manifest）；B 比较 Manifest+Anchor+日志+`freezeHashes`。这是有意的非对称。
- A/B 有 73 个路径重叠（28 双方 required）；逻辑独立，物理证据部分重叠。
- Optional 94 = `oldWork` 93 + `v3/chrome.log` 1；Optional 缺失只报告，不拉红 required。
- 证据完整性通过不等于游戏功能、机制覆盖或人工视觉审核完成。

## 8. 参考

- [ADR 0001](../../docs/adr/0001-evidence-trust-boundary.md) · [ADR 0002](../../docs/adr/0002-dual-baseline-trust-boundary.md)
- [P0-04 最终报告](final-report.md) · [final-verdict.json](final-verdict.json)
- [P0-04 地图](map.md)
