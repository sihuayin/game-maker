# 证据完整性验收报告

- 结论：**fail**（退出码 1）
- 生成时间：2026-10-31T13:48:22.333Z
- 清单：`/home/runner/work/game-maker/game-maker/pr/.scratch/evidence-integrity-v1/manifest/expected-hashes.json`
  sha256：`sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd`
- subject：wasteland-scavenger-recipe v1 · site v1 · shell 2
- 信任锚点：**matched**（digest+base）
  expected：`sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd`
  actual：`sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd`
  base manifest：`.scratch/evidence-integrity-v1/manifest/expected-hashes.json` · sha256 `sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd` · byteEqual true
- 范围：223 文件（required 151 / optional 72）· 13 条记录

## 声明 vs 重算

| 检查 | 声明 | 重算 | 一致 |
|---|---|---|---|
| asset-pack | — | pass | ✗ |
| config | — | blocked | ✗ |
| qa | — | blocked | ✗ |
| site | — | pass | ✗ |
| playable-smoke | — | blocked | ✗ |
| visual-review | — | blocked | ✗ |

- 声明 verdict：—
- 重算 verdict：blocked

## 文件（29 项非 verified）

- [hash-mismatch] `out:wasteland-scavenger-recipe/run/v1/qa-report.json`

## 身份（11）

- [unreadable] `out:wasteland-scavenger-recipe/run/v1/qa-report.json` —— hash-mismatch
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

## 一致性（133）

- [fail] record.parse：out:wasteland-scavenger-recipe/run/v1/qa-report.json：hash-mismatch
- [fail] materials.self-hash：实际文件 hash-mismatch（.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json）
- [fail] evidence.self-hash：实际文件 hash-mismatch（.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json）
- [fail] consistency.report-hash：实际文件 hash-mismatch（/home/runner/work/game-maker/game-maker/pr/.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json）
- [blocked] references.report：qa-report 没有 delivery
- [blocked] playtest.summary：qa-report 没有 delivery

## 诊断（9）

- [fail] file.hash-mismatch：out:wasteland-scavenger-recipe/run/v1/qa-report.json —— hash-mismatch
- [blocked] identity.record：记录不可用：out:wasteland-scavenger-recipe/run/v1/qa-report.json（hash-mismatch）
- [fail] record.parse：out:wasteland-scavenger-recipe/run/v1/qa-report.json 不可用（hash-mismatch）
- [fail] materials.self-hash.actual：实际文件不可验证：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json（hash-mismatch）
- [fail] evidence.self-hash.actual：实际文件不可验证：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json（hash-mismatch）
- [fail] consistency.report-hash.actual：实际文件不可验证：/home/runner/work/game-maker/game-maker/pr/.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json（hash-mismatch）
- [blocked] references.report：无法核对 qa-report 的引用：没有 delivery
- [blocked] playtest.summary：无法核对 delivery.playtest：没有 delivery
- [blocked] verdict.declared：交付没有声明 verdict

## 信任边界

能发现相对清单的改动；发现不了清单与被验证据一起被改并提交 —— 后者由 git 提交历史与人工审查负责。三方哈希核对只增加内部矛盾检测，不增加防篡改强度。若启用 trust.anchor，另行记录当前清单与外部摘要的匹配结果；摘要来源的可信性由调用方（CI/base）负责。

## 已知限制

- 本报告由已有证据重导出，不重新构建游戏、不重新执行 QA、不重新启动浏览器试玩。
- visual-review 只校验记录完整性与一致性，不重判人工视觉结论。
- 信任边界：能发现相对清单的改动；发现不了清单与被验证据一起被改并提交。
- 锚点校验只证明当前清单匹配给定摘要；摘要本身的可信来源由 CI/base 负责。
- 本版不做：五态真实 E2E、第二个 Demo 的泛化、MCP 镜像。
