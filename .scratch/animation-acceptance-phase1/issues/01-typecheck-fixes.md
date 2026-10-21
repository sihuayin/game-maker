# 01. 修复 typecheck 两处测试类型错误

Type: task
Status: resolved
Owner: task 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

修复 HEAD 上 `pnpm typecheck` exit 2 的两处**测试专用**类型错误：

1. `packages/assets/tests/pack-sheet-grid.test.ts:150` — TS2322：`ImageGenerator` 的假 generator
   返回值缺 `requestedSize`。先读 `ImageGenerator` 的真实类型定义，按契约补字段；
   不要用 `as any` / `@ts-ignore`。
2. `packages/assets/tests/prompt.test.ts:257` — TS2304：`CharacterDNA` 未导入。
   从 `@game-maker/contracts` 导入类型。

## 验收

- `pnpm typecheck` exit 0。
- 只改这两个测试文件；不改生产代码、不改测试断言语义。
- 记录命令、退出码、改动行。

## 边界

- 不改业务代码 / 其他测试 / 契约 / 配置；不提交；不写 `out/`；零付费。
- 不碰 `CONTEXT.md` 与无关 `.scratch`。
- 不写 `map.md`；只写本票与 `## Answer`。

## 产出

本票 `## Answer`：两处改动的 `path:line`、`pnpm typecheck` 实际结果。

## Answer

**改动（只动两个测试文件，均为类型级补全，断言语义未变）**

- `packages/assets/tests/pack-sheet-grid.test.ts:161` —— 假 generator 的 `call` 补上
  `requestedSize: \`${w}x${h}\``。依据：`packages/assets/src/image-gen.ts:34`
  `ImageGenCall.requestedSize` 为**必填** `string`（契约文档注明「请求的尺寸，`宽*高` 这种字符串形式」），
  与同文件 `:91` 及 `pack.test.ts` / `pack-frames.test.ts` 等处假生成器的写法一致。
  （TS 报错位置 `:150` 是 `const gen: ImageGenerator` 赋值处，缺字段的返回语句在 `:161`。）
- `packages/assets/tests/prompt.test.ts:8` —— `import type` 增加 `CharacterDNA`，
  来源 `@game-maker/contracts`（`packages/contracts/src/character-dna.ts:198` 导出）；
  `:257` 的 `const DNA: CharacterDNA` 因此解析成功。
- 未使用 `as any` / `@ts-ignore`；未改生产代码、契约、配置。

**命令与结果**

| 命令 | 退出码 | 摘要 |
| --- | --- | --- |
| `pnpm typecheck`（改前基线） | `2` | `pack-sheet-grid.test.ts(150,11)` TS2322 缺 `requestedSize`；`prompt.test.ts(257,14)` TS2304 `CharacterDNA` 未定义 |
| `pnpm typecheck`（改后） | `0` | 9 个 workspace 项目全部 `Done`，无错误 |
| `pnpm vitest run packages/assets/tests/pack-sheet-grid.test.ts packages/assets/tests/prompt.test.ts` | `0` | 2 个文件 / 36 个测试全部通过（prompt 31、pack-sheet-grid 5） |

未提交；未写 `out/`；零付费调用。
