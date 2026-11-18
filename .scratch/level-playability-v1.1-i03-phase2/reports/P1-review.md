# P1 独立复核报告

| 项 | 值 |
| --- | --- |
| 票 | P1 · probe 契约冻结与夹具物化 |
| 复核者 | **fresh 独立复核会话**（未参与 P1 的任何实施、未参与 P1 brief / 授权 / 脚本书写） |
| 复核日期 | 2026-11-17 |
| 环境 | macOS 15.7.9 · Darwin 24.6.0 arm64 · Python 3.13.3 · Node v22.23.2 · git 2.39.5 (Apple Git-154) |
| 审计分支 | `wayfinder/i03-phase2-probe-evidence` @ `0b2198481a0e2301a4621c6c3985756ae74abeb2`（remote 同名 ref 亦为 `0b21984`） |
| base `main` | `324ca13166662b309069c43599047a5c1d9b692f` |
| 复核方式 | 独立 worktree `/tmp/p1-review-wt`；临时输出 `/tmp/p1-review/`；主工作树保持干净、未切换分支、未改产品文件、未提交 / 推送 |
| **结论** | **PASS** |

## 0. 复核者独立性声明

- 本会话由用户指派为 P1 的 fresh 独立复核者，**未参与 P1 的实施、brief、授权记录、脚本或证据生成**。
- 本报告所有 PASS 均由本会话现场重跑或独立复算得出，**不采信实施者 `summary.md` / `verify.log` 的结论**；实施者证据仅作为被核对对象。
- 复核期间只读审计分支；主工作树 `git status --porcelain` 为空，未修改产品文件，未提交或推送，未修改审计分支。
- 复核过程未使用 GitHub（本地分支与 remote ref 已一致，无需 fetch）。

## 1. 输入 hash（现场复算）

| 输入 | 期望 / 来源 | 现场复算 | 判定 |
| --- | --- | --- | --- |
| 审计分支 HEAD | `0b21984` | `0b2198481a0e2301a4621c6c3985756ae74abeb2` | 一致 |
| fixtures / scripts commit | `8a0bb67` | `8a0bb6758efa9d71148ac67c0dd0e5253306e061` | 一致 |
| base `main` | `324ca13` | `324ca13166662b309069c43599047a5c1d9b692f` | 一致 |
| P1 授权记录 | `8b3f6b3a…` | `8b3f6b3a3fa1abd6f4c2401545606c44298ff7dc6c1013217da087cddce00342` | 一致 |
| Phase-2 annex | `100d0221…`（SIGNED） | `100d0221db759cf2ce64835665691c410c76e6223ee8f9049655db6021537b21` | 一致 |
| `evidence/p1/summary.md` | `51f14402…` | `51f14402a5da8052b2367b3a72c99fbc67f1eb4fe62785893a2f85c1df5829ac` | 一致 |
| `evidence/p1/SHA256SUMS` | `39f08e84…` | `39f08e848258e2f6954a38520f81535f6fd9f436b5c50189f060f320a0dda966` | 一致 |
| P1 brief | 无冻结 hash | `8f693304f520d67807cf90cd1b6d177102b5211e71af229b036c2a59f4faac41` | 记录 |

> `reports/P1-review-input.md` 只存在于 `main`（PR #81，晚于审计分支 base）；复核时从主工作树读取，未将其纳入审计分支核对。

## 2. 独立重跑命令与退出码

为避免污染审计 worktree，`build-fixtures.py` 在**隔离根目录** `/tmp/p1-review/r1`、`/tmp/p1-review/r2` 中重跑：复制 `fixtures/packs/last-train/v2`、`fixtures/game-configs/last-train.json` 与 `geometry-probe/`，保持脚本到根目录的相对深度一致，然后运行两次。脚本只读产品 pack / config，只写 `geometry-probe/fixtures/`。

| # | 命令 | 退出码 | 结果 |
| --- | --- | ---: | --- |
| R1 | `cd /tmp/p1-review/r1 && python3 -I .scratch/level-playability-v1.1-i03-phase2/geometry-probe/scripts/build-fixtures.py` | 0 | `rows 14 negative 11 basePackHash sha256:570535…` |
| R2 | `cd /tmp/p1-review/r2 && python3 -I .scratch/level-playability-v1.1-i03-phase2/geometry-probe/scripts/build-fixtures.py` | 0 | 同上 |
| R3 | `diff` R1/R2 的 `manifest.json`、`normalization.json`、`last-train-v4/manifest.json` | 0 | 三次文件全部逐字节一致（空输出） |
| R4 | `diff` R1 输出 vs `evidence/p1/rebuild-1/`、`rebuild-2/` 同名文件 | 0 | 6 组比较全部一致 |
| R5 | `shasum -a 256` R1 输出 | 0 | `dd880628…` / `e88f5a35…` / `19f4da6f…`，与冻结值一致 |
| R6 | `shasum -a 256 -c evidence/p1/SHA256SUMS` | 0 | 73 行 OK / 0 FAILED |
| R7 | `git diff 324ca13..0b21984 -- packages fixtures` | 0 | 0 行输出 |
| R8 | `git diff --exit-code 324ca13 HEAD -- fixtures/packs/last-train/v2` | 0 | 产品原始 pack 未改 |

独立复算的 tree hash（自写实现：排序相对路径 + `\0` + `sha256:` 前缀逐文件拼接后取 SHA-256）：

```
fixtures/source/last-train-v2  sha256:570535deff5c2f4e1626b2680a4b555f631e51d6d87721507a0a1f6e2feb7383
fixtures/last-train-v4         sha256:245df97e0b7abd257da466a9a87c4eaab2f4ec7ec8fc7c8c674618d75114a83d
fixtures/recipes              sha256:2f1cffe2bdb43baf6e62355754c859e51a15b6bd256754213d7deae9bb9a1dd3
contract                      sha256:91bd30c0ffad278c453f0e02a22c73cd8c72ee444dc5ac8bdd9f54f4e95c5551
scripts                       sha256:a4bd1b3d2e106b9e343f5a3c57ce290597b160b20b23f61ca99c5ed543220672
```

## 3. 逐项判定表

| # | 检查项 | 判定 | 独立证据 |
| ---: | --- | --- | --- |
| 1 | `fixtures/manifest.json` 逐字节 = `dd880628…` | **PASS** | 现场 `shasum -a 256` = `dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b`；独立重跑输出相同 |
| 2 | 正例 14：hazard 2 / player 9（8 帧 + body 1）/ graph 3；逐行 expected 无遗漏、无新增 | **PASS** | 14 行；维度计数 `{player: 9, graph: 3, hazard: 2}`；player 帧行 8 + body 行 1；帧顺序与 pack manifest 的 `frames` 顺序一致；14 行 expected **全部由复核者独立公式重算，0 处不符**（见 §4 A1） |
| 3 | 负例 11：10 `geometry-mismatch` + 1 `missing-evidence`；含 `body-bounds-mismatch`；不回退旧 10 口径 | **PASS** | 11 个；class 计数 `geometry-mismatch=10 / missing-evidence=1`；`body-bounds-mismatch` 存在且 class=`geometry-mismatch`；code 列表完整（11 个唯一 code） |
| 4 | 独立重跑两次，manifest / normalization / v4 manifest 逐字节一致且 = 冻结 hash | **PASS** | 两次隔离运行 exit 0；三文件 `diff` 为空；hash = `dd880628…` / `e88f5a35…` / `19f4da6f…`；且与 `rebuild-1/`、`rebuild-2/` 逐字节一致 |
| 5 | 源 pack tree `570535…`、v4 manifest `19f4da…`、normalization `e88f5a…` | **PASS** | 三者均现场复算一致；源 manifest 亦 = `145cb28d…`；config = `d2786ee3…`（与 manifest `base` 记录一致） |
| 6 | `git diff 324ca13..0b21984 -- packages fixtures` 为空；原始 `fixtures/packs/last-train/v2` 未被写入 | **PASS** | 命令输出 0 行、exit 0；`fixtures/packs/last-train/v2` 相对 base 无 diff；主工作树与复核 worktree 的 `git status` 均为空 |
| 7 | 审计提交只含 `geometry-probe/**`，白名单外文件数为 0 | **PASS** | `324ca13..0b21984` 共 74 个新增文件，全部在 `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/` 下；两个提交分别检查，白名单外文件均为 0；无 `package.json` / lockfile / tsconfig 变化 |
| 8 | `build-fixtures.py` 对 `ROOT` 与冻结路径字符串的调整是否必要、是否仍输出冻结字节；是否超出「只修正 docstring」 | **PASS（附注）** | 见 §5 专项判断：调整必要、无逻辑变更、输出字节冻结；但**字面上超出「只修正 docstring」**，属透明记录的必要路径适配，未触发 STOP |
| 9 | `contract/I03-03A-probe-format.md` 与源文件逐字节一致（`f22bbd…`） | **PASS** | `diff -q` 无输出；副本与源文件 hash 均为 `f22bbde58ffbb0d78a6c77d417de4af10a3ddf93757752fbb8c0eca59840983d` |
| 10 | `fixtures/recipes/` 11 个文件与冻结 manifest `negative` 对象逐项一致 | **PASS** | 11 个文件名集合 = negative code 集合；逐文件 `json.load` 与对应 negative 对象**完全相等**；独立重放每个变异均复现声明的 input/output hash（见 §4 A2） |
| 11 | `fixtures/last-train-v4/delivery/` 8 个文件与源 pack 同名文件逐字节一致 | **PASS** | 8 个文件 `diff` 全部一致；且各自 hash = 冻结 manifest `base.atlasHashes` 对应值 = 源 pack 文件 |
| 12 | `SHA256SUMS` 73/73 通过；审计 HEAD、证据 hash 与复核输入包一致 | **PASS** | `shasum -a 256 -c` exit 0，73 OK / 0 FAILED；覆盖集合恰为「74 个文件减去 `SHA256SUMS` 自身」；HEAD `0b21984`、summary `51f144…`、SHA256SUMS `39f08e…` 均与输入包一致 |

**逐项统计：PASS 12 / FAIL 0 / NOT_RUN 0。** 未触发任何 STOP 条件。

## 4. 复核者自选关键断言

### A1（自选）独立重算全部 14 行 expected —— 0 处不符

不复用 `build-fixtures.py` 的任何函数；直接读取产品 `fixtures/packs/last-train/v2/manifest.json`、`delivery/atlas.animations.json` 与 `fixtures/game-configs/last-train.json`，按语义独立实现 `entityBox` / `footOf` / `boxFromFoot`：

```
player_foot = (40 + (0.5-0.5)*32, 250 + (1-0.95)*48) = (40.0, 252.4)
player_box  = {x: 40-32/2, y: 252.4-48, w: 32, h: 48} = {24.0, 204.4, 32, 48}
hazard_box  = {800-0.5*64, 250-1*48, 64, 48} = {768, 202, 64, 48}
luggage_box = {500-0.5*40, 250-1*40, 40, 40} = {480, 210, 40, 40}
terrain_box = {0, 250, 1440, 20}
```

逐行比较 `manifest.positive.rows[i].expected` 与重算值，**14/14 完全相等，errors=0**；body 行恰 1 行且不与帧行重复；hazard / player 帧顺序与 pack manifest 的声明顺序一致。这独立确认「无遗漏、无新增、无错值」。

### A2（自选）独立重放全部 11 个负例配方

按 `negative[i].mutation` 的描述自行重放，而非读取 `output` 字段：

- 6 个 atlas 变异（`delete-frame`、`set-frame-sourceSize`、`set-frame-anchor`、`trimmed`、`rotated`、`mutate-atlas-meta-leave-manifest-checksum`）：自行应用变异、按 `indent=2, sort_keys=True, ensure_ascii=False` 重序列化，必要时更新 v4 manifest 中 `delivery/atlas.animations.json` 的 checksum，再独立计算 `atlasHash` / `manifestHash` —— **全部等于配方声明值**。
- `atlas-missing`：`output.atlasHash=null`、`output.manifestHash` = 基线 v4 manifest hash —— 一致。
- 4 个 `runtime-override`：`input.baseManifestHash` / `input.baseAtlasHash` 与基线一致；`output.recipeHash = sha256(dump({code, override}))` 复算一致。

结果：**11/11 独立重放通过**。其中 `body-bounds-mismatch` 的 override bounds `x=24.5` 与正例 body bounds `x=24.0` 确有偏差（y/w/h 相同），说明它是真实的 bounds 偏差，而非空操作或重复的 size/offset 用例。

### A3（自选附加）v4 归一化语义独立核对

`fixtures/last-train-v4/manifest.json` 必须等于「源 v2 manifest + `format="assetpack/v4"` + `provenance={"mode": <原 mode>}`」：**相等**；其字节 hash = `19f4da6f…`；`fixtures/normalization.json` 与冻结 manifest 的 `base.normalization` **完全相等**。

### A4（自选附加）source 副本完整性

`fixtures/source/last-train-v2` 与产品 `fixtures/packs/last-train/v2` 的 32 个文件路径集合完全一致、逐文件内容零差异；tree hash = `570535…`。

## 5. 专项判断：`script-diff.txt` 与「只修正 docstring」边界

`script-diff.txt` 相对冻结脚本（`4253bbbb…`）的全部改动为：

1. docstring：`10 negative` → `11 negative`；Rebuild 路径更新。**属 brief 明确允许的 docstring 修正。**
2. `ROOT = Path(__file__).resolve().parents[5]` → `parents[4]`。**必要**：Phase-2 的 `geometry-probe/` 比 Phase-1 的 `.scratch/level-playability-v1.1-i03/evidence/geometry-probe/` 浅一层；不改则 `ROOT` 指向 `.scratch`，读不到 `fixtures/packs/…`。
3. 新增常量 `RECORDED = ".scratch/level-playability-v1.1-i03/evidence/geometry-probe"`，并把 `normalizedManifestPath` 与 `storage.{positive,manifest,rebuild}` 改为基于 `RECORDED` 的字符串。**必要**：冻结 manifest 的字节包含这些路径字符串；若沿用原 `relative_to(ROOT)` 表达式，重定位后字符串会变成 Phase-2 路径，`manifest.json` 将不再等于 `dd880628…`。`RECORDED` 的值恰等于 Phase-1 位置下原表达式会产生的字符串。

除上述外**无任何逻辑 / 数值 / 顺序改动**；两次独立重跑输出与冻结 manifest / normalization / v4 manifest 逐字节一致。

**独立判断：** 该调整在字面上超出了 brief 的「只修正 docstring」，但它是在新位置执行脚本、同时保持冻结字节所**不可省略**的路径适配，不改变任何行为或契约语义，且已在 `summary.md` §5 与 `script-diff.txt` 中透明记录。它不触发授权 §3 / §6 的任何「明确不放行」或 STOP 条件，也不构成扩大白名单或修改契约语义。因此判定 **PASS**，但作为需用户知情的事项列入残余风险（见 §6）。若治理上要求严格按字面「docstring-only」，则应视为流程措辞待补（建议后续授权措辞写成「docstring + 必要的路径适配」），而非要求重做 P1。

## 6. 限制与残余风险

1. **未在真实产品路径原地重跑**：为保持审计分支与产品 fixture 只读，重跑在 `/tmp/p1-review/r{1,2}` 隔离副本中进行；输入从审计分支/主工作树复制，使用 `python3 -I`。相对深度与脚本路径保持一致，结论不受影响。
2. **manifest 的 `storage` / `normalizedManifestPath` 仍指向 Phase-1 记录路径**：这是冻结字节的一部分。现场核对 Phase-1 对应路径存在且内容逐字节相同（`dd880628…` / `e88f5a35…` / `19f4da6f…`），因此风险低；但 P2 消费时应显式使用 Phase-2 路径，不应把 `storage` 字段当作当前物化位置。
3. **scope 措辞**：如 §5，脚本改动非字面「docstring-only」，建议用户在签署时知情；未发现行为或契约影响。
4. **不在 P1 范围**：未验证 probe 运行、未启动浏览器、未消费 probe 输出、未检查 `coverage.geometry` / 公共 Verdict / `PUBLIC_NB` / `PUBLIC_PU`（P1 明确不做）。
5. **证据自洽性**：`SHA256SUMS` 不含自身（73 条覆盖全部 73 个非自身文件），符合常见惯例；本报告已独立重算全部关键 hash，未仅依赖该清单。
6. 本复核只看行为/字节与授权边界，不对 annex 正文语义或后续 P2–P7 设计作结论。

## 7. 结论

**P1 独立复核结论：PASS。**

- 12/12 复核项 PASS，0 FAIL，0 NOT_RUN；未触发任何 STOP。
- P1 仍**未闭合**：需用户签署本报告后，P1 才算完成；P2 不得在本签署完成前启动。
- 本次签署**不授权 P2–P7**，也不改变 `PUBLIC_NB` / `PUBLIC_PU` 或任何产品行为。

## 8. 用户签署（未签署）

> 复核会话不得代替用户签署。以下签署行保持空白，由用户填写后才生效；签署仅确认 P1 复核结论，不授权 P2。

**用户签署：__________________________　日期：____________**
