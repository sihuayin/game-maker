# 证据完整性验收报告

- 结论：**pass**（退出码 0）
- 生成时间：2026-10-30T04:54:40.367Z
- 清单：`.scratch/evidence-integrity-v1/manifest/expected-hashes.json`
  sha256：`sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd`
- subject：wasteland-scavenger-recipe v1 · site v1 · shell 2
- 范围：223 文件（required 151 / optional 72）· 13 条记录

## 声明 vs 重算

| 检查 | 声明 | 重算 | 一致 |
|---|---|---|---|
| asset-pack | pass | pass | ✓ |
| config | pass | pass | ✓ |
| qa | pass | pass | ✓ |
| site | pass | pass | ✓ |
| playable-smoke | pass | pass | ✓ |
| visual-review | pass | pass | ✓ |

- 声明 verdict：pass
- 重算 verdict：pass

## 文件（0 项非 verified）

- 全部文件 verified

## 身份（11）

- [verified] `out:wasteland-scavenger-recipe/run/v1/qa-report.json`
- [verified] `out:wasteland-scavenger-recipe/run/v1/playtest/v2/result.json`
- [verified] `gp:06-attempt-1/attempt-v1/result.json`
- [verified] `gp:06-attempt-2/attempt-v1/result.json`
- [verified] `fa04:review-record.json`
- [verified] `fa04:capture.json`
- [verified] `fa04:materials.json`
- [verified] `fa05:evidence.json`
- [verified] `gp:09-review-record.supplement.json`
- [verified] `gp:09-review-materials.json`
- [verified] `artifacts:identity.json`

## 一致性（144）


## 诊断（0）


## 信任边界

能发现相对清单的改动；发现不了清单与被验证据一起被改并提交 —— 后者由 git 提交历史与人工审查负责。三方哈希核对只增加内部矛盾检测，不增加防篡改强度。

## 已知限制

- 本报告由已有证据重导出，不重新构建游戏、不重新执行 QA、不重新启动浏览器试玩。
- visual-review 只校验记录完整性与一致性，不重判人工视觉结论。
- 信任边界：能发现相对清单的改动；发现不了清单与被验证据一起被改并提交。
- 本版不做：五态真实 E2E、第二个 Demo 的泛化、MCP 镜像。
