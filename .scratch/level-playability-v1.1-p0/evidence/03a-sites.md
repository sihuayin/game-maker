# P0-03a 合成案例与 scratch 站点

| 项 | 值 |
|---|---|
| 日期 | 2026-11-07 |
| 分支 | `p1/level-playability-v1.1-p0` |
| 本票开始 HEAD | `920d225d0faed3ca320b48d2216e92edabd2a1a0` |
| 性质 | 只准备案例、站点、分析器输入与 harness 场景；**不做 P0-03 的案例判断** |
| 零付费 | 未调用模型、未生图、未重建付费站点 |
| 绑定包 | `fixtures/packs/last-train/v2` · manifest `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689` |

## 0. 命令与退出码

| # | 命令 | 退出码 | 产物 |
|---|---|---|---|
| 1 | `pnpm build` | 0 | `packages/demo/dist/index.js`、`packages/demo/dist/shell.js`（无源码改动） |
| 2 | `node .scratch/level-playability-v1.1-p0/tools/build-cases.mjs --force --json > .scratch/level-playability-v1.1-p0/evidence/03a-sites.json` | 0 | A/B scratch 站点 + [`03a-sites.json`](03a-sites.json) |
| 3 | `node .scratch/level-playability-v1.1-p0/tools/e3-rescan.mjs --out .scratch/level-playability-v1.1-p0/evidence/03a-e3-rescan.json --json` | 0 | [`03a-e3-rescan.json`](03a-e3-rescan.json) |
| 4 | `node .scratch/level-playability-v1.1-p0/tools/analyze-cases.mjs --out .scratch/level-playability-v1.1-p0/evidence/03a-fixture-smoke.json --json` | 0 | [`03a-fixture-smoke.json`](03a-fixture-smoke.json)（夹具自检，非 P0-03 判断） |
| 5 | `node packages/demo/probe/playtest/playtest.mjs --site .../cases/a/site-out/p0-03a-case-a/site/v1 --scenario-dir .../cases/a/scenario --out .../cases/a/smoke-run --repeat 2 --json` | 0 | A 夹具冒烟（两次投影一致） |
| 6 | `node packages/demo/probe/playtest/playtest.mjs --site .../cases/b/site-out/p0-03a-case-b/site/v1 --scenario-dir .../cases/b/scenario --out .../cases/b/smoke-run --repeat 2 --json` | 0 | B 夹具冒烟（两次投影一致） |

工具链：Node `v22.23.2`；`packages/demo/dist/index.js` `sha256:5ab06341df67601edacef6f3ec670c9daf6c1590815ec396b14366ec3d795cd0`；
`packages/demo/dist/shell.js` `sha256:d5e552d50b897f517ff068ce1ca3e00a94b7118d57419b944ebd52bfff7e322a`。

## 1. A/B scratch 站点

站点全部落在本 effort 目录；`pack/` 是 `fixtures/packs/last-train/v2` 的**拷贝**，不是原地修改。

| 案例 | config | gameId | site | pack | 警告 |
|---|---|---|---|---|---|
| A | `cases/a/game-config.json` `sha256:afba7a5265c4765c19abc119c9e6b229d9b84860517e5f07e1472790fd6565de` | `p0-03a-case-a` | `cases/a/site-out/p0-03a-case-a/site/v1` | `cases/a/site-out/p0-03a-case-a/pack/v2` | 0 |
| B | `cases/b/game-config.json` `sha256:b3c8d8ada4f694004eff2c48880db877656762740a21801cb4dfcce11de1f0fe` | `p0-03a-case-b` | `cases/b/site-out/p0-03a-case-b/site/v1` | `cases/b/site-out/p0-03a-case-b/pack/v2` | 0 |

- 站点版本：两者均 `site v1`；外壳 `v2`；包 `v2`。
- 站点树哈希：A `sha256:2b1cb4d88a859c1e62e8b01d708a7ad466d69297e07a8eda2a630ccdbacd17f0`；
  B `sha256:4bd3e497cc921d5f6cce9106dee6a42633b7780a67c24c33a1633312db764575`。
- 站点四份文件（`index.html` / `shell.js` / `site.json` / `game-config.json`）的逐文件哈希见 [`03a-sites.json`](03a-sites.json)。
- 两份站点装配都通过三族 + 几何 + HUD 屏幕空间校验，`warnings=[]`。

### 既有 fixture / 历史配置未被修改

| 检查 | 结果 |
|---|---|
| `fixtures/packs/last-train/v2/manifest.json` 前后 | 同为 `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689` |
| 资源包文件树前后 | 同为 `sha256:29673385086a9701f7d6b7209a7c1bba37a3dad4efb307a3afa9f607bf2c5478` |
| `git status --short -- fixtures` | 空 |

## 2. E3 可复现只读扫描（P0-01R 裁定）

脚本：[`tools/e3-rescan.mjs`](../tools/e3-rescan.mjs)（`p0-03a-e3-rescan/1`），只读；
`--out` 只写本 effort 的证据 JSON。**未修改**任何既有 fixture / 历史配置。

| 项 | 值 |
|---|---|
| 扫描输入 | `.scratch/level-playability-v1/corpus/inventory.json` |
| 输入基线 | `main @ fa17c14`；inventory `sha256:ba1d051a401ac70f45be5a705e2c478961ffc3fc0a6c9feb4cde09365df5f74f` |
| 过滤 | `parseOk ∧ format=game-config/v1 ∧ 按 contentHash 去重` |
| 脚本版本 | `p0-03a-e3-rescan/1` |
| 输出 | [`03a-e3-rescan.json`](03a-e3-rescan.json) |

| 指标 | P0-01 原数字 | 本次复算 | 一致 |
|---|---:|---:|:---:|
| 唯一横向 config | 21 | 21 | ✅ |
| hazard 总数 | 31 | 31 | ✅ |
| 带 motion | 19 | 19 | ✅ |
| 带 body | 0 | 0 | ✅ |
| 带 anim | 18 | 18 | ✅ |
| 移动 hazard 资源解析次数 | 19 | 19 | ✅ |
| 图集帧检查数 | 121 | 121 | ✅ |
| `badSize` | 0 | 0 | ✅ |
| `badAnchor` | 0 | 0 | ✅ |
| `missingAtlas` | 0 | 0 | ✅ |
| `missingFrame` | 0 | 0 | ✅ |
| 速度区间（px/ms） | 0.02667–0.13846 | 0.02667–0.13846 | ✅ |

- 补充：motion 全为 `axis:"x"`、`kind:"cycle"`；移动 hazard 的 manifest anchor 分布 `0.5,1 ×17` / `0.5,0.95 ×1` / `0.5,0.85 ×1`。
- **差异：无。** 因此没有需要解释的偏差，也没有静默覆盖旧报告。

### 案例 hitbox 来源

[`03a-e3-rescan.json`](03a-e3-rescan.json) 的 `caseHitboxProvenance` 逐案例记录：

| 案例 | hazard asset | 复制包 manifest | 帧 | 帧 `sourceSize` / `anchor` == manifest | atlas |
|---|---|---|---:|---|---|
| A | `prop-luggage-pile` | `cases/a/site-out/p0-03a-case-a/pack/v2/manifest.json`（`sha256:145cb28d…`） | 1 | ✅ | `delivery/atlas.sprites.json` |
| B | `hazard-sweeping-carriage` | `cases/b/site-out/p0-03a-case-b/pack/v2/manifest.json`（`sha256:145cb28d…`） | 2 | ✅ | `delivery/atlas.animations.json` |

两案例的 hitbox 来源都能追溯到**当前 accepted pack 的拷贝**；P0-03 仍需在其正式报告里复述这条审计。

## 3. 夹具冒烟（不是 P0-03 的验收证据）

| 案例 | repeat | 投影一致 | 结果 | 证据 |
|---:|---|---|---|---|
| A | 2 | ✅ | `won=true`、`reset=0`、`collected=1`、`jump=1`；步数 101/102 | `cases/a/smoke-run/` |
| B | 2 | ✅ | `won=false`、`reset=5`、`stop.reason=reset-exhaustion`；终点从未到达 | `cases/b/smoke-run/` |

- 冒烟证明：A/B 在现有 harness 下**可以执行并取得必要证据**（A 的安全通过；B 的阻塞/复位）。
- 冒烟**只作夹具可执行性检查**：没有记录 P0-03 要求的最终 `lagMs`、安全余量与正式 hitbox 审计，
  因此**不得**当作确定性结论的验收证据。
- 冒烟 trace 的观测间隔（最大 92ms）只是 harness 轮询间隔，**不是** Runtime 帧间隔，P0-03 必须按票面要求正式记录。

## 4. 分析器夹具自检（非 P0-03 判断）

[`03a-fixture-smoke.json`](03a-fixture-smoke.json) 用冻结原型跑全部分析器输入：

| 案例 / 输入 | lagMs | 三态 | 原因 |
|---|---:|---|---|
| A / `analyzer-input-lag16.67ms.json` | 16.67 | `NO_PROVEN_BLOCKER` | `witness-found`（witness 逐段验证通过） |
| A / `analyzer-input-lag200ms.json` | 200 | `NO_PROVEN_BLOCKER` | `witness-found`（witness 逐段验证通过） |
| B / `analyzer-input-lag16.67ms.json` | 16.67 | `PROVEN_UNPLAYABLE` | `permanent-gate` `[548,592]` |
| B / `analyzer-input-lag200ms.json` | 200 | `PROVEN_UNPLAYABLE` | `permanent-gate` `[548,592]` |
| C1 / `analyzer-phase-unknown.json` | 200 | `INSUFFICIENT_EVIDENCE` | `phase-uncertain` |
| C2 / `analyzer-hitbox-unverifiable.json` | 200 | `INSUFFICIENT_EVIDENCE` | `hitbox-uncertain` |

⚠️ A 的 frozen witness 是低速前进，不是静止等待；P0-03 必须在真实 Runtime 里演示「等待后通过」，
并按 trace 决定最终 `lagMs`。C 的 `lagMs=200` 不会被消费（确定性输入门先返回 IE），`16.67ms` 结果相同。

## 5. 边界与遗留

- 未修改 `fixtures/**`、`run/**`、`pack/**`、`site/**`、`packages/**` 源码；未新增第三方依赖；未推送 / 合并。
- 未新增站点观察字段；只使用现有 playtest harness 与 `setup.kind="mutate-hazard"`。
- P0-03 仍需完成（不由本票代做）：
  1. 用真实 trace 记录最大帧间隔、安全余量与最终 `lagMs`；
  2. 同时给出 `16.67ms` / `200ms` 两档敏感性；
  3. 对 A/B 正式重复运行并写 `evidence/03-case-comparison.md`；
  4. 记录 hitbox 来源审计与 lag 敏感性审计；
  5. C 用分析器侧证据确认 `INSUFFICIENT_EVIDENCE`。
