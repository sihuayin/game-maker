# I01-02 可信输入契约与 brand 机制

Type: grilling
Status: resolved
Owner: amber
Blocked by: 01
Map: ../map.md
Class: I-01 / DECISION

## Question

裁定「可信 Atlas 输入」的精确契约：类型、铸造路径、运行时 brand、digest 注入、失败结果形状，以及它如何喂给新时序入口。

### 必须裁定

1. **数据形状**：`TrustedAtlasInput` 携带什么？至少需要：
   - 被验证的 atlas 列表（按 `atlasId`）；
   - 每个被引用帧的 `sourceSize` 与 `anchor`；
   - 验证结论（trusted / untrusted + 原因）；
   - 绑定的 manifest 校验值来源（`files[]` 的哪一条）。
   明确「哪些资产 / 帧必须被包含」，以及不在集合内的资产如何声明（缺省 ≠ 已验证）。
2. **brand 机制**：
   - 用 `Symbol` 还是私有类字段做运行时 brand；
   - 铸造工厂放在哪、导出范围；
   - 为什么 `contracts` 源码里不出现 `node:fs` / `node:crypto`；
   - 架构测试怎么写（扫描 contracts 源码的 import）。
3. **digest 注入**：`verifyTemporalInput({ bytes, manifest, digest })` 的精确签名；`digest` 的类型（`(bytes: Uint8Array) => string`）；生产路径只允许传真实 SHA-256；测试注入不得进入生产调用路径的证明方式。
4. **TOCTOU**：哈希与 `AtlasJson` 解析必须消费**同一个** `bytes` 对象；写出可检查的约束（例如函数只接收一次 `bytes`，不得二次读盘）。
5. **失败形状**：不可信时返回什么？必须能区分：文件缺失 / SHA 不符 / JSON 无效 / 帧缺失 / `sourceSize` 不符 / `anchor` 缺失或不符。每一种都必须映射到 `INSUFFICIENT_EVIDENCE`。
6. **与入口的关系**：新时序入口接收 `TrustedAtlasInput` 还是更窄的几何表；stub 是否消费它。

### 必须写入的限制

> Runtime brand 是架构纪律与误用防护，不是同进程内的密码学安全边界，不能抵御恶意代码伪造或篡改。

### 产出

`../evidence/02-trusted-input-contract.md`。**不修改任何生产文件。**

### 停止条件

- 需要 contracts 引入 Node 内置模块；
- 需要新增第 5 项公共面加法；
- 需要改既有测试文件。

## Answer

决策记录：[`evidence/02-trusted-input-contract.md`](../evidence/02-trusted-input-contract.md)。

- **Q1–Q8 全部 A**。验证范围 = `config.player.asset` + 配置引用的 `hazard` / `pickup` / `goal` 资产；background / UI / decor / 未引用资产排除。
- **全有或全无**：判别联合；不可信时不返回部分几何。
- **一次调用验整包**：按 `atlases[].meta` 去重；SHA 来自 `files[]`；digest 与 `AtlasJson.safeParse` 消费同一份 bytes。
- **brand**：模块私有 `unique symbol`；唯一生产者是 `verifyTemporalInput`；不导出铸造工厂；运行时守卫拒绝普通对象。
- **digest**：`(bytes: Uint8Array) => string`，完整 `sha256:<hex>`；生产只允许 `assets/src/ops.ts`。
- **失败码**：8 个闭集 code + 显式 `verified` 表；不新增 `ConfigIssue.code`。后由 [I01-03](03-i01-03-frame-geometry-predicate.md) 扩到 **10** 个（新增 rotated / trimmed unsupported）。
- **入口**：`auditPlayabilityTemporal` 只认 branded 输入，无 geometry / hitbox / body / 尺寸 / 垂直规避参数。
- **Q8**：`verifyTemporalInput` 经 `api.ts` 导出并标 `@internal`；架构测试把生产调用者限制为 `assets/src/ops.ts`。**`@internal` 不是包级访问控制**。
- 真实语料：`last-train/v2` 在严格判据下零不符；`counter-siege` 无 manifest，不是有效证据。
- 本票只收口技术决策；不构成 I-01 实施授权。
