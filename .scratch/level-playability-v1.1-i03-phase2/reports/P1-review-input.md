# P1 独立复核输入包

| 项 | 值 |
| --- | --- |
| 票 | P1 · probe 契约冻结与夹具物化 |
| 送审日期 | 2026-11-17 |
| 实施者 | claude（P1 实施会话） |
| 复核者 | **fresh 独立会话**（不得是实施者；不得参与 P1 实现） |
| 复核报告固定路径 | `.scratch/level-playability-v1.1-i03-phase2/reports/P1-review.md` |
| 状态 | **待复核 / 待用户签署**；P1 尚未闭合，P2 不得启动 |

> 本输入包只列复核所需的入口与断言。**所有 PASS 必须由复核会话现场重跑或独立复算**，不得采信实施者摘要。

## 1. 授权与边界

| 项 | 值 |
| --- | --- |
| P1 授权记录 | [`P1-incremental-authorization.md`](P1-incremental-authorization.md) · `sha256:8b3f6b3a3fa1abd6f4c2401545606c44298ff7dc6c1013217da087cddce00342`（SIGNED 2026-11-17，amber） |
| Phase-2 annex | `docs/v7.8/移动-I03-phase2.md` @ `sha256:100d0221db759cf2ce64835665691c410c76e6223ee8f9049655db6021537b21`（SIGNED） |
| P1 brief | [`issues/02-p1-probe-fixtures.md`](../issues/02-p1-probe-fixtures.md) |
| 执行协议 | [`reports/00-execution-protocol.md`](00-execution-protocol.md) §4 |
| 白名单 | `geometry-probe/**` 与 `reports/P1-*`；产品 `packages/**` / `fixtures/**` 零改动 |

## 2. 审计分支与提交

| 项 | 值 |
| --- | --- |
| 分支 | `wayfinder/i03-phase2-probe-evidence`（remote 同名） |
| base `main` | `324ca13166662b309069c43599047a5c1d9b692f` |
| fixtures / scripts commit | `8a0bb6758efa9d71148ac67c0dd0e5253306e061` |
| evidence commit / 当前 HEAD | `0b21984` |
| 提交范围 | 仅 `geometry-probe/**`；产品路径零提交 |

## 3. 复核入口

| 产物 | 路径 |
| --- | --- |
| 证据摘要 | `geometry-probe/evidence/p1/summary.md`（`sha256:51f14402a5da8052b2367b3a72c99fbc67f1eb4fe62785893a2f85c1df5829ac`） |
| 逐文件 hash | `geometry-probe/evidence/p1/SHA256SUMS`（`sha256:39f08e848258e2f6954a38520f81535f6fd9f436b5c50189f060f320a0dda966`） |
| 命令与退出码 | `geometry-probe/evidence/p1/commands.log` |
| 独立验证输出 | `geometry-probe/evidence/p1/verify.log` |
| 两次重建输出 | `geometry-probe/evidence/p1/rebuild-1/` · `rebuild-2/` |
| 重建 diff | `geometry-probe/evidence/p1/rebuild-diff.txt`（应为空） |
| 脚本 diff | `geometry-probe/evidence/p1/script-diff.txt` |
| tree hash | `geometry-probe/evidence/p1/tree-hashes.txt` |
| 产品零 diff | `geometry-probe/evidence/p1/product-zero-diff.txt` |

## 4. 必须逐项复核

1. **manifest hash**：`geometry-probe/fixtures/manifest.json` 必须逐字节等于
   `sha256:dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b`。
2. **正例 14**：hazard 2 / player 9（8 帧 + body 1）/ graph 3；逐行 expected 与冻结 manifest 一致，无遗漏、无新增。
3. **负例 11**：10 `geometry-mismatch` + 1 `missing-evidence`；必须包含 `body-bounds-mismatch`；不得回退旧 10 口径。
4. **两次重建字节一致**：独立重跑 `build-fixtures.py` 两次，比较 manifest / normalization / v4 manifest。
5. **源 / v4 hash**：源 pack tree `570535…`；v4 manifest `19f4da…`；normalization `e88f5a…`。
6. **产品零改动**：`git diff 324ca13..0b21984 -- packages fixtures` 为空；原始 `fixtures/packs/last-train/v2` 未被写入。
7. **白名单**：提交只含 `geometry-probe/**`；无产品文件、无新依赖、无 lockfile / tsconfig 变化。
8. **路径说明**：Phase-2 `build-fixtures.py` 对 `ROOT` 与冻结路径字符串的调整是否必要且不改变冻结字节；核对 `script-diff.txt`。
9. **契约副本**：`contract/I03-03A-probe-format.md` 与源文件逐字节一致（`sha256:f22bbd…`）。
10. **配方物化**：`fixtures/recipes/` 11 个文件与冻结 manifest `negative` 对象逐项一致。
11. **delivery 副本**：`fixtures/last-train-v4/delivery/` 8 个文件与源 pack 同名文件逐字节一致。

## 5. 建议的独立重跑

```bash
git fetch origin
git checkout wayfinder/i03-phase2-probe-evidence
cd .scratch/level-playability-v1.1-i03-phase2/geometry-probe

# 1. 逐文件 hash
shasum -a 256 -c evidence/p1/SHA256SUMS

# 2. 冻结 manifest / normalization
shasum -a 256 fixtures/manifest.json fixtures/normalization.json fixtures/last-train-v4/manifest.json

# 3. 两次重建（独立副本或原地重跑后比较）
python3 scripts/build-fixtures.py
python3 scripts/build-fixtures.py
# 与 evidence/p1/rebuild-1、rebuild-2 比较

# 4. 计数 / 类别
python3 -c 'import json;m=json.load(open("fixtures/manifest.json"));print(len(m["positive"]["rows"]),len(m["negative"]),sorted({n["class"] for n in m["negative"]}))'

# 5. 产品零改动
cd /path/to/repo
git diff 324ca13166662b309069c43599047a5c1d9b692f..0b21984 -- packages fixtures
```

## 6. 复核结论格式

复核报告必须逐项给出 `PASS / FAIL / NOT_RUN`，并包含：

- 复核者独立性声明（未参与 P1 实现）；
- 日期 / 环境（OS、Node、Python）；
- 输入 hash 现场复算；
- 独立重跑命令与退出码；
- 至少 2 条复核者自选的关键断言（不得只引用实施者证据）；
- 限制与残余风险；
- 结论：P1 PASS / FAIL；
- 用户签署行（签署后才算 P1 闭合；签署不授权 P2）。

## 7. STOP

- manifest hash 不一致、正例 ≠ 14、负例 ≠ 11、缺 `body-bounds-mismatch`。
- 两次重建不一致。
- 产品路径出现 diff。
- 白名单外文件进入 audit 提交。
- 复核者无法独立复算任何关键 hash。
- 任何需要扩大白名单或修改契约语义的情形 ⇒ STOP + HITL。
