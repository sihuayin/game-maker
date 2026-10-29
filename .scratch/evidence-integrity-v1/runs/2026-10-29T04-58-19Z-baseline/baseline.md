# 冻结 FPVS-V1 基线重验

- 结论：**pass**（CLI exit 0）
- 清单：`.scratch/evidence-integrity-v1/manifest/expected-hashes.json` · 223 文件（required 151）· sha sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd
- 命令：`node scripts/evidence-acceptance.mjs --out .scratch/evidence-integrity-v1/runs/2026-10-29T04-58-19Z-baseline`
- 耗时：5766ms · 读取约 19.3 MB · 报告 `.scratch/evidence-integrity-v1/runs/2026-10-29T04-58-19Z-baseline/2026-10-29T04-58-45-516Z-delivery-verification/report.json`
- declared / recomputed：pass / pass；六项全 match；diagnostics=0
- 只读：312 文件前后一致（66 snapshot · 50 pack/site · 29 FA-04 · 10 FA-05 · 162 FA-06 · 28 06 attempts · 2 09 · 1 work qa-report）
- 07 交叉：27 项 / failed 0 / pass=true；与既有 27 项 check id 集合一致=true

## 差异说明

- 07 的 27 项覆盖身份/材料/截图/站点/FA-05/FA-06/06 attempt/50 文件快照/09 补审；新校验器独立重算同一批证据，并额外校验路径安全、引用解析、可选日志、六项 declared↔recomputed。
- 07 的 `snapshot.50-files` 用冻结时的 before/after 快照比较；本票的只读快照覆盖 312 文件（含 FA-04/05/06、06 attempts、09、work qa-report），前后一致。
- 07 的 `supplement.fa04-unmodified` 由补审记录的自述哈希核对；新校验器用三方哈希（清单/自述/实际）+ 材料集合再做一遍。
- 两者结论一致（27/27 与 diagnostics=0、六项全 match），没有需要解释的矛盾。

## 已知限制

- 单 Demo；视觉结论只校验记录完整性，不重判人工判断。
- `*.log` 为清单中的 optional 项，不在 git 信任边界内。
- 本票据不重跑浏览器/QA；六项检查由当前证据重导出。
