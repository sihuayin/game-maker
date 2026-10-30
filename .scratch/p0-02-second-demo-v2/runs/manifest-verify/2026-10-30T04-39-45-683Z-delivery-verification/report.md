# 证据完整性验收报告

- 结论：**fail**（退出码 1）
- 生成时间：2026-10-30T04:39:45.683Z
- 清单：`.scratch/p0-02-second-demo-v2/manifest/stage-a-manifest.json`
  sha256：`sha256:96d88f1849f567c90fbeb1fbaa225316bf18c1ca92e5d18c92499905c32b0725`
- subject：wasteland-scavenger-recipe v1 · site v1 · shell 2
- 范围：125 文件（required 125 / optional 0）· 6 条记录

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
- [verified] `out:wasteland-scavenger-recipe/run/v1/playtest/v2/result.json`
- [verified] `out:wasteland-scavenger-recipe/run/v1/mechanic-coverage.json`
- [verified] `fa04:review-record.json`
- [verified] `fa04:capture.json`
- [verified] `fa04:materials.json`

## 一致性（73）

- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.animations.png
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.animations.json
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.sprites.png
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.sprites.json
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.backgrounds.png
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.backgrounds.json
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.ui.png
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.ui.json
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/manifest.json
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/authoring/stylespec.json
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/authoring/visual-world.json
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/game-design.json
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/visual-world.json
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/stylespec.json
- [fail] materials.self-hash：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json
- [fail] references.report：evidence.playtest-chrome → wasteland-scavenger-recipe/run/v1/playtest/v2/chrome.log 不在清单里

## 诊断（16）

- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.animations.png
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.animations.json
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.sprites.png
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.sprites.json
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.backgrounds.png
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.backgrounds.json
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.ui.png
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/delivery/atlas.ui.json
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/manifest.json
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/authoring/stylespec.json
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/pack/v1/authoring/visual-world.json
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/game-design.json
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/visual-world.json
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/stylespec.json
- [fail] materials.self-hash.reference-invalid：自述路径不在清单里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json
- [fail] references.report.reference-invalid：evidence.playtest-chrome 引用的文件不在清单里：wasteland-scavenger-recipe/run/v1/playtest/v2/chrome.log

## 信任边界

能发现相对清单的改动；发现不了清单与被验证据一起被改并提交 —— 后者由 git 提交历史与人工审查负责。三方哈希核对只增加内部矛盾检测，不增加防篡改强度。

## 已知限制

- 本报告由已有证据重导出，不重新构建游戏、不重新执行 QA、不重新启动浏览器试玩。
- visual-review 只校验记录完整性与一致性，不重判人工视觉结论。
- 信任边界：能发现相对清单的改动；发现不了清单与被验证据一起被改并提交。
- 本版不做：五态真实 E2E、第二个 Demo 的泛化、MCP 镜像。
