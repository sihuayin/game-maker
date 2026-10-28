# 验收对象冻结审计（FA-01）

- 日期：2026-10-27
- 票：`.scratch/fpvs-v1-final/issues/01-freeze-acceptance-object.md`
- 性质：只读源 + 创建只读快照/可写工作区；未改 `packages/`、`fixtures/`、`game-maker.local.json`；
  未启动 Chrome；未写最终报告。
- 证据分级：E1 = 源文件/哈希；E3 = 真实产物。

## 1. 冻结结果

| 角色 | 路径 | 文件数 | 写入性 |
|---|---|---:|---|
| 源（只读） | `.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/wasteland-scavenger-recipe/` | 66 | 未改动 |
| 只读快照 | `.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/` | 66 | `chmod -R a-w`，0 个可写条目 |
| 可写工作区 | `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/` | 66 | 可写（`playtest` 写在此处） |
| 历史证据参考 | `.scratch/fpvs-v1-final/artifacts/reference/` | 14 | `chmod -R a-w` |

- 身份记录：`.scratch/fpvs-v1-final/artifacts/identity.json`
- 哈希清单：`.scratch/fpvs-v1-final/artifacts/hashes.json`
- 冻结脚本：`.scratch/fpvs-v1-final/freeze.mjs`（可复跑，`--force` 才替换）

## 2. 身份结论

- `packId` / `packVersion`：`wasteland-scavenger-recipe` / `1`
- `siteVersion` / `shellVersion`：`1` / `"2"`
- `site.json`：`{ "shell": "2", "pack": "v1", "config": "game-config.json" }`
- `pack/v1/manifest.json` 原始 sha256 = `sha256:a162942d…feb3`，与
  `run/v1/qa-report.json` 的 `subject.manifestChecksum` **一致**。
- `run/v1/game-config.json` 与 `site/v1/game-config.json` 的 sha256 **完全一致**
  （`sha256:455d9c7f…7dcd`），即 run 配置与站点实际消费的配置同字节。
- 历史试玩 `result.json` 的 `identity` 与快照一致：`siteVersion=1`、`packId=wasteland-scavenger-recipe`、
  `packVersion=1`、`packChecksum=sha256:a162…`、`configChecksum=sha256:455d…`、`shellVersion="2"`。
  ⇒ 历史试玩确实跑在同一份字节上，但它是**参考证据**，不是本轮验收证据。

**结论**：快照内部身份自洽，并与历史试玩的身份绑定一致；本轮所有新证据应绑定到该快照。

## 3. 字节一致性与只读证明

- `snapshot vs source`：66/66 文件哈希一致，0 mismatch；`diff -rq` 无输出。
- `work vs snapshot`：66/66 一致（冻结时刻）。
- `source before vs after`：哈希一致，冻结过程未改源。
- 只读：`artifacts/` 下 `find -perm -222` 为 **0**；`touch` 快照文件被拒绝；
  `work/` 下 `touch` 成功。
- **限制**：`chmod` 是本地权限控制，拥有者仍可改回；更强的证明是哈希清单。
  FA-06 必须重新哈希快照并与 `hashes.json` 比对，证明验收期间零改动。

## 4. 哈希清单覆盖规则

- 算法：`sha256`；每条记录 `{ role, path, relativePath, bytes, sha256 }`。
  `path` 相对 effort 根，`relativePath` 相对角色根。
- 条目：快照 66 + 参考 14 = **80** 条。
- 关键文件检查：24 项（18 个精确路径 + 6 个模式）全部命中，`missing` 为空：
  - site：`site.json` / `index.html` / `shell.js` / `game-config.json`
  - run：`game-config.json` / `qa-report.json` / `intent.md` / `reference.png` / `style.png` /
    `game-design.json` / `game-intent.json` / `stylespec.json` / `visual-world.json`
  - pack：`manifest.json` / `ledger.json` / `coverage.json` / `authoring/stylespec.json` /
    `authoring/visual-world.json`
  - 模式：`delivery/atlas.*.json`（4）、`delivery/atlas.*.png`（4）、`authoring/drawlist/*.json`（2）、
    `authoring/generated/*`（5）、`authoring/masters/*`（5）、`run/v1/visual-design/**`（2）
- 缺失处理：关键模式零命中会写入 `missing` 并让冻结脚本失败；**不静默跳过**。
- 不在清单内：`work/`（可写、会变化；只在冻结时刻记录 `workVsSnapshot` 比较）、`out/`、其他 effort 目录。

## 5. 快照 / 工作区边界

- `artifacts/`：只读；任何验收证据不得写回。
- `work/`：可写；`playtest` 的 attempt、`events/trace/input`、`qa-report.json` 写回都在这里。
- 每次试玩后应重新哈希快照（或至少核对 `site/` 与 `run/v1/game-config.json`），证明站点字节未改。
- 若 FA-03 产出新版本产物：新版本另建快照目录/版本号，旧快照保留，不覆盖。

## 6. 新发现的前置（不影响冻结，但阻塞 FA-02 的 CLI 写回）

工作区的 `run/v1/qa-report.json` 是历史 QA 层报告（`format/subject/checked/failures/observations`），
**没有 `delivery` 对象**。`game-maker playtest <run>` 的六项准备校验会以
「这份 QA 报告没有 delivery —— 不能试玩一个身份不明的交付」拒绝
（`packages/cli/src/playtest.ts:56-59`）。

因此 FA-02 之前必须先决定如何初始化**本轮**的 delivery 信封（不是把历史 stage-c 的
`visual-review: pass` 直接继承）。候选：用现有 `buildDeliveryReport` 重建（asset-pack/config/qa/site
来自本快照；playable-smoke 未跑、visual-review 未审），或按 FA-01D 的裁定另走一条。
这一条已补进 FA-01D 与 FA-02 的问题。

## 7. 已知限制

- 快照的 `run/v1/qa-report.json` 是 QA 层报告，不含 delivery；历史 stage-c 交付报告只作参考，
  其 `visual-review: pass` **不得**升级为本轮视觉结论。
- 历史试玩 `success-basic` 是 `AGENT_LIMITATION`（collected 3/6）；它是参考证据，不是本轮验收证据。
- 哈希清单证明冻结时刻的字节；不能证明源在冻结之前从未被改过，但与 qa-report/manifest checksum
  和历史试玩身份相互印证。
- `artifacts/reference/prior-delivery-stage-c/qa-report.json` 是历史交付报告副本，仅作对照；
  本轮最终报告不复用它作为 verdict 来源。

## 8. 复跑

```bash
node .scratch/fpvs-v1-final/freeze.mjs --force
```

`--force` 会替换快照/工作区/参考目录；仅在确认要重新冻结时使用。
