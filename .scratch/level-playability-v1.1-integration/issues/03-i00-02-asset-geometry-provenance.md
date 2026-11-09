# I00-02 AssetPack 几何证据来源

Type: research
Status: open
Owner: —
Blocked by: 01
Map: ../map.md
Class: I-00 / EVIDENCE

## Question

G-01 要求「Hazard 的实际碰撞几何必须来自真实 Asset Pack 帧和可信 Manifest」，且「不得只信任调用方提供的 hitbox 声明」。现有事实是：manifest 不含逐帧几何，逐帧几何在 atlas JSON，pack acceptance 已做比对，但审计路径看不到。

### 必须回答

1. **现有信任链的完整形状**：逐文件 sha256（`assetpack.ts:69-70,298-299`）→ `verifyPack`（`ops.ts:1918-1960`）→ `manifestChecksumOf`（`publish-gate.ts:30-38`）→ delivery 钉住（`delivery.ts:29,41,203-206`）→ acceptance baseline（`acceptance.ts:198-201,508-519`）。这条链能证明什么、不能证明什么。
2. **传递性证据是否成立**：若 pack 已通过 acceptance，auditor 只读 manifest 时，「帧几何 == manifest 标称值」能否作为**已证明事实**使用？边界在哪（pack 被就地改写、manifest 与 atlas 不同源、非 accepted pack）？`profile.ts:18-25` 判 `partial` 的理由是否仍然成立。
3. **审计取得帧几何的选项**：(a) 读 atlas JSON；(b) 引入「已验收包」清单 / 证据文件；(c) 扩展 manifest 承载逐帧几何；(d) 只接受调用方传入已校验的 pack 目录并在分析时复验。逐项给出：需要改动的模块、是否触及公共契约 / 公开参数、对性能与调用方的影响、失败时如何降级为 IE。
4. **「accepted pack」概念**：它目前只存在于 scratch 文档（指 `fixtures/packs/last-train/v2`），生产代码无此类型。若集成需要它，这是不是 PRD 授权外的新概念？需要什么级别的授权？
5. **负向条件**：列出所有必须落 `INSUFFICIENT_EVIDENCE` 的几何来源情形（缺失帧、帧数不符、sourceSize / anchor 不符、pack 未验收、调用方伪造 hitbox）。

### 产出

`evidence/02-geometry-provenance.md`：信任链图、选项对比表、每项的授权需求。**不实施。**

### 边界

只读；零付费；可复用 `../level-playability-v1.1-p0/tools/e3-rescan.mjs` 的思路在 `scripts/` 重写，不改 P0 目录。
