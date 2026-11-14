# I03-10 F2 修正证据（`body-bounds-mismatch`）

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-14 |
| 触发 | 用户裁定：**选择 1，先修正 F2，再进入 I03-11 签署；暂不接受将其作为已知限制带入签署。** |
| 范围 | 授权包 §6.6 / §10.2 AC-15 / §16；审查输入包 item 10；fixture manifest / build script / evidence 03b2 |
| 边界 | 只修正证据与描述；**未改产品代码 / I-02 / 公共能力**；未授权 probe 实现、未开放 `PUBLIC_NB` / `PUBLIC_PU` |

## 1. 修正内容

1. **新增 `body-bounds-mismatch` 负例 recipe**：`target="player"`，`body.bounds={x:24.5,y:204.4,w:32,h:48}`（canonical box 为 `(24,204.4,32,48)`，仅 x +0.5 px，size / offset 不变）；expected `affected=["player","graph"]`、`coverage={hazard:"checked",player:"partial",graph:"partial"}`、`summary="untrusted"`。
2. **负例总数 10 → 11**：10 个 `geometry-mismatch` + 1 个 `missing-evidence`（`atlas-missing`）。
3. **授权包 §6.6** 的“7 个 geometry-mismatch”组成描述更正为“10 个 geometry-mismatch + 1 个 missing-evidence”，并加入 F2 修正说明。
4. **授权包 §10.2 AC-15 / §16 第 7 行**的负例计数 10 → 11。
5. **审查输入包 item 10**同步为 11。
6. **`evidence/03b2-fixture-manifest.md`** 的负例表、脚本 / manifest hash、命令结果（13 rows → 14 rows；10 negatives → 11 negatives）同步。

## 2. Hash 变更

| 项 | I03-09 组装时 | I03-10 F2 修正后 |
| --- | --- | --- |
| 授权包 `docs/v7.8/移动-I03.md` | `sha256:0edf5005d52f50ccbaa52be85f9b4ed34b904aacc6b51d7eec72be6ee2863c14` | `sha256:2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e` |
| 审查输入包 `reports/09-review-input-package.md` | `sha256:5c6e2be47207944643267dd8713c290727b087c033b641abc7289b05171b5944` | `sha256:1227d1f3c78dda382cd4f6c6560740f512ac3fc4a131a33a35b436da5fda7abd` |
| 重建脚本 `build-fixtures.py` | `sha256:1b58e35ea5e6e21432334e77ac0881b7740067e0b9b9ea77b359e031e725304f` | `sha256:4253bbbb4c849d94654239f90c074e7d3161d07c97a8ed7beb3ba5a4c7a3ea66` |
| fixture manifest `fixtures/manifest.json` | `sha256:3b7196b3cefb48caba46b6a4d9319814a3d58e9dc6d9d6170b17388af6028278` | `sha256:dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b` |
| 归一化 manifest | `sha256:19f4da6fb9bf25b96b48b96e2e44bb1773ad0c1222dc865f72e77a56fc85cb98` | **未变** |
| normalization 记录 | `sha256:e88f5a350a8cb596884b46cd0ffe8620691ab22cf8004e8b6e41eed0ec70d227` | **未变** |
| 源 pack tree / manifest | `570535de…` / `145cb28d…` | **未变** |

## 3. 复跑与验证

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `python3 .scratch/level-playability-v1.1-i03/evidence/geometry-probe/scripts/build-fixtures.py` | **0** | `rows 14 negative 11 basePackHash sha256:570535de…`；manifest 写出 |
| manifest 解析 | **0** | `negative` 共 11 条：`geometry-mismatch=10`、`missing-evidence=1`；新增 `body-bounds-mismatch` |
| `node scripts/check-links.mjs` | **0** | 相对链接零断裂（见本次修正后的全量检查） |
| `git diff --stat 2b57f2a -- packages fixtures` | — | 空（产品 / 产品 fixture 零 diff） |

## 4. 下游

- **I03-10 审查报告**：F2 由“建议签署前修正”更新为“已修正”；F6 一并修正；审查对象 hash 更新为上表新值。
- **I03-11 用户签署**：基于修正后的授权包 hash 进行；签署仍只建立后续实施依据，**不**自动授权 U1–U5、**不**开放 `PUBLIC_NB` / `PUBLIC_PU`。
- **I03-03B2 / I03-03B / I03-03C / I03-08 / I03-09**：在原 Answer 下追加 `## Comments` 修正记录，不改写历史裁定。
