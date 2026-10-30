# 证据完整性验收报告

- 结论：**pass**（退出码 0）
- 生成时间：2026-10-30T04:54:52.237Z
- 清单：`.scratch/p0-02-second-demo-v2/manifest/final-manifest.json`
  sha256：`sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab`
- subject：wasteland-scavenger-recipe v1 · site v1 · shell 2
- 范围：231 文件（required 137 / optional 94）· 6 条记录

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

## 身份（6）

- [verified] `out:wasteland-scavenger-recipe/run/v1/qa-report.json`
- [verified] `out:wasteland-scavenger-recipe/run/v1/playtest/v3/result.json`
- [verified] `out:wasteland-scavenger-recipe/run/v1/mechanic-coverage.json`
- [verified] `fa04:review-record.json`
- [verified] `fa04:materials.json`
- [verified] `fa04:capture.json`

## 一致性（73）


## 诊断（0）


## 信任边界

能发现相对清单的改动；发现不了清单与被验证据一起被改并提交 —— 后者由 git 提交历史与人工审查负责。三方哈希核对只增加内部矛盾检测，不增加防篡改强度。

## 已知限制

- 本报告由已有证据重导出，不重新构建游戏、不重新执行 QA、不重新启动浏览器试玩。
- visual-review 只校验记录完整性与一致性，不重判人工视觉结论。
- 信任边界：能发现相对清单的改动；发现不了清单与被验证据一起被改并提交。
- 本版不做：五态真实 E2E、第二个 Demo 的泛化、MCP 镜像。
