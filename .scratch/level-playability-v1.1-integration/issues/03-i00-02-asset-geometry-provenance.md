# I00-02 AssetPack 几何证据来源

Type: research
Status: resolved
Owner: research subagent · 2026-11-09
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

## Answer

- **信任链今天止于 manifest。** `verifyPack` 只证「字节 == `files[]`」（`ops.ts:1916-1980`）；`manifestChecksum` 只把 QA/delivery 钉到 manifest 字节（`publish-gate.ts:30-38`、`delivery.ts:29,41,203-206`）；逐帧比对只在 acceptance（`acceptance.ts:306-347,654-670`），而 `auditPlayability(config, manifest)` 拿不到 atlas、也没有任何 acceptance 消费者（`api.ts:64-68`、`config-audit.ts:53`、`publish-gate.ts:140`）。`site`/外部包路径连 `verifyPack` 都不跑（`site.ts:169-226`；`publish-gate.ts:15-17`）。
- **传递性成立需 6 个前提**：同一份包字节（manifest + 每张图集 meta/image 身份）、干净且检查集可解释的报告、消费方复核身份而非只看文件存在、anchor 在场、acceptance 后未被就地改写、审计与运行时消费同一对 manifest/atlas。缺一即不能当「已证明事实」。
- **最关键的负向发现：干净报告不等于逐帧 anchor 已核对。** anchor 比对是条件式（`acceptance.ts:341`）；删掉某帧 anchor 后 `verifyPack` + acceptance 仍全绿（实验 `pack-d`）。size 则是无条件比对（`:306`）。
- **acceptance 证的是「包内部自洽」，不是艺术真值。** 把 atlas 与 `manifest.asset.size` 一起改写并刷新 `files[]` 后仍 PASS+CLEAN（`pack-c2`）；只说 verify 通过则不能证几何一致（`pack-b` 只有 acceptance 报错）。
- **`profile.ts:18-25` 的 `partial` 理由仍成立**：审计输入只有 manifest、schema 不含逐帧等式、acceptance 结果无通道；但今天 `partial` 不参与整关聚合（`api.ts:87-92`、`verdict.ts:104-115`），所以只加 coverage 不会产生 G-01 要求的 IE。
- **四选项各有代价**：读 atlas 最接近真值但需 contracts 新入参（contracts 仅依赖 zod，不能读文件）；复用 acceptance 报告最省概念但报告默认在 gitignored `out/`、无 accepted 布尔、`toolVersion` 恒 `"0.0.0"`、实存样本已是孤立报告；扩展 manifest 违反「不重复图集内容」原则并需 `assetpack/v4→v5`；调用方复验最兼容 G-01 但要改 `site`/publish 的「不重验」约定与公开入口。
- **`accepted pack` 在生产代码中不存在**：没有类型/字段/注册表/消费者。P0 文档里的它实际指 `fixtures/packs/last-train/v2`（E3 扫描背书），该 fixture 没有 acceptance 报告。若集成需要，最小路径是复用 `verifyPack` + `animation-acceptance/v1` + 身份复核（非新概念，但仍是新代码/公开参数）；新造 accepted 状态则是新契约 + 持久化。任何触及 contracts/pipeline/CLI/MCP/公开参数者，需 I00-R1 契约冻结 + I00-R2 白名单 + PRD §9.2 的独立实施授权。
- **必须落 IE 的情形**已分组列在证据 §5：输入/字节不可用、报告缺失或身份不符、atlas 缺失/帧缺失/尺寸或 anchor 不符、anchor 缺失、trim/rect/PNG 异常、跨资源重名、调用方伪造 hitbox/body、acceptance 后改写、自洽改写（若要求真实性）。

证据：[`evidence/02-geometry-provenance.md`](../evidence/02-geometry-provenance.md)（含信任链逐跳表、前提 T1–T9、四选项对比、IE 清单与复现命令）。脚本：[`scripts/geometry-provenance-probe.mjs`](../scripts/geometry-provenance-probe.mjs)、[`scripts/geometry-mutation-probe.sh`](../scripts/geometry-mutation-probe.sh)。复现结果：原包 verify PASS / acceptance CLEAN（31 文件 0 不符）；acceptance 单测 18/18 通过（EXIT=0）；四个反例的退出码与 findings 见证据 §2.3。未修改 `packages/**`、`docs/**`、`fixtures/**`，未 commit/push。
