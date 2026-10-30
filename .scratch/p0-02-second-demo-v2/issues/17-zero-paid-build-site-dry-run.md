# 零付费 buildAndSite 壳级 dry run

Type: task
Status: resolved
Blocked by: （无）

## Question

阶段 B 仍 BLOCKED；先补一次**零付费**的 `buildAndSite` 壳级真实链路证据。要求：

1. **输入**：使用冻结 Demo 的独立可写副本（或一个已有完整资源、无需新生成的新 Demo）；不改冻结快照、旧 work、旧 effort、历史 run/pack/site/delivery。
2. **零付费护栏**：
   - 不调用任何付费文本/生图/重采样上游；
   - 在执行前检查并记录 `ANTHROPIC_*` 等环境变量不会把 text 请求路由到本地代理（`127.0.0.1:15721`）；
   - 记录实际 text/image provider 与 endpoint 主机名（不记录密钥）；
   - 若任何付费调用被尝试，必须 fail-closed 并留下记录，不得静默继续。
3. **真实链路**：在副本上跑一次 `build`（或 `create` 使用已有资源），完成 `pack → config → QA → site → delivery`，记录：
   - 命令、cwd、退出码、耗时；
   - `run/vN/qa-report.json` 的 delivery（checks / verdict / site / config / evidence）；
   - pack/site/config 身份与 checksum；
   - ledger 中是否出现任何付费调用（期望 0）；
   - 与历史证据的零改动核对。
4. **产物**：`research/17-build-site-dry-run.md` + 本 effort `runs/17-build-site-dry-run/`；不提交、不推送（除非另行授权）。
5. 若 `build` 因资产/上游不可用而无法零付费完成，照实记录失败与阻塞点，不扩大范围、不调用付费服务。

## Answer

**2026-10-30 尝试收口：dry run 被阻塞，零付费。** 证据：[research/17-build-site-dry-run.md](../research/17-build-site-dry-run.md)。

- 独立副本上运行 `build`；用本地 fail-closed stub 覆盖 text/image（原始 `ANTHROPIC_BASE_URL=http://127.0.0.1:15721` 已检测并覆盖）。
- 退出码 **1** / 1s；`build` 试图重新生成资产：15 次 `POST /images/edits` + 8 次 `POST /v1/messages`，全部被 stub 以 503 拒绝；**没有真实 provider 调用、零付费**。
- 失败现场保留 `failed-2026-10-30T05-12-23-196Z/`；冻结快照/旧 work/阶段 A freeze 哈希未变。
- 根因：`packAssets` 总会重新生成 image/drawlist；`pack.ts` 已有 `reuseFrom` 但未暴露给 `packAssets`/CLI；主资产不支持 `import`。
- 下一步：[零付费 buildAndSite：复用已有资源的路径](../issues/18-zero-paid-build-reuse-path.md)（HITL 决策）。
