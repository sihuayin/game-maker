# 重新选择硬护栏路径（不用 LiteLLM）

Type: grilling
Status: resolved
Blocked by: （无）

## Question

用户已裁定不用 LiteLLM。请重新选择付费执行的硬护栏路径：

- (a) **保持 BLOCKED**：只接受 provider 强制硬限；当前不存在。P0-02 付费执行继续阻塞。
- (b) **OpenRouter $5.80 cap**：非严格（image 不在在飞预留；需要验证生图路由/PNG）；只有你明确接受“cap < $6 以吸收在飞缺口”时才可考虑。
- (c) **effort-local 计量代理**：不改生产代码，但信任根是自建代码；需实现、离线验证、HITL 批准。
- (d) **你提供的其他网关/provider**：必须能按次硬拒绝或提供可验证硬限额；给出 endpoint 主机名与文档（不传密钥）。
- (e) **暂停 P0-02 / 重画范围**。

产物：票内 Answer + `rulings-2026-10-29.md`（追加逐字裁定）。

## Answer

**已收口（2026-10-29，HITL）：用户裁定 (e) 暂停 P0-02 / 重画范围。**

- 付费执行保持 BLOCKED；不运行任何付费命令。
- 剩余执行/场景/视觉/冻结/最终结论票全部关闭；不推进 LiteLLM / OpenRouter / 自建代理。
- 零付费产物保留（参考图、provider 核验、成本/网关研究、LiteLLM 模板仅作研究记录）。
- 恢复需重画范围，另行开图；本图不恢复执行。
