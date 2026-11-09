# I01-02 可信输入契约与 brand 机制

Type: grilling
Status: open
Owner: —
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
