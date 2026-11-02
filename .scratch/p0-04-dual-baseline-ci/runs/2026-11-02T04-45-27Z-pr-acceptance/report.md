# P0-04 票 07 · 真实 GitHub PR 双基线红绿验收

- 生成时间：2026-11-02T04:56:56Z（UTC）
- 结论：**PASS**

## 1. 绿色 PR

- [#19 green docs-only](https://github.com/sihuayin/game-maker/pull/19)：base `f126406` → head `e8869c7` → merged `eedd15b`。
- evidence run：[41390243462](https://github.com/sihuayin/game-maker/actions/runs/41390243462)；`check`/`test`/`typecheck`/`evidence` 全 pass。

## 2. 负向 PR

| PR | 场景 | Base → Head | evidence | Aggregate / 诊断 | PR 状态 |
|---|---|---|---|---|---|
| [#20](https://github.com/sihuayin/game-maker/pull/20) | A 篡改 | `eedd15b` → `1d39563` | [41390763321](https://github.com/sihuayin/game-maker/actions/runs/41390763321) FAIL | A fail / B pass / freeze 112 → aggregate fail；`fa05:regression/test.exit` hash-mismatch | **BLOCKED / OPEN** |
| [#21](https://github.com/sihuayin/game-maker/pull/21) | B 篡改 | `eedd15b` → `934aedb` | [41390771481](https://github.com/sihuayin/game-maker/actions/runs/41390771481) FAIL | A pass / B fail / freeze 111/112 → aggregate fail；`setup.json` hash-mismatch | **BLOCKED / OPEN** |
| [#22](https://github.com/sihuayin/game-maker/pull/22) | B Manifest + Anchor 联合篡改 | `eedd15b` → `520ea4b` | [41390785603](https://github.com/sihuayin/game-maker/actions/runs/41390785603) FAIL | 可信配置 FAIL：`B Manifest differs from base Manifest`；A skipped / B fail / aggregate fail | **BLOCKED / OPEN** |
| [#23](https://github.com/sihuayin/game-maker/pull/23) | 验收规则篡改（D1：规则绕过 + A 篡改） | `eedd15b` → `66f8ced` | [41390792355](https://github.com/sihuayin/game-maker/actions/runs/41390792355) FAIL | base workflow 执行；head bypass 未执行；A fail / B pass / aggregate fail | **BLOCKED / OPEN** |

## 3. 不相互掩盖

- 负向 A：B step success、freeze 112/112，A step failure，aggregate fail ⇒ **B PASS 不掩盖 A FAIL**。
- 负向 B：A step success，B step failure、freeze 111/112，aggregate fail ⇒ **A PASS 不掩盖 B FAIL**。
- 负向 C：trust-config 在 A/B 执行前拦截 B Manifest 篡改；A skipped、B fail、aggregate fail。
- 负向 D：run 的 steps 是 base workflow；head `evidence.yml` 的 bypass 未执行；A 篡改仍被 base 规则拦截。

## 4. 纪律与限制

- 绿色 PR 已合并；四个负向 PR 均未合并，仅保留失败证据。
- 负向样本使用 03 Q11 的独占 required 路径；`test.exit` 与 `setup.json` 均复核为各自基线独占 required。
- owner-only：owner 仍有 bypass；报告不声称已证明非管理员无法绕过。

## 5. 机器可读

- `facts.json`；各负向 aggregate/freeze/summary 已复制到本目录。
