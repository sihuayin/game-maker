// 票 29 的 Q3 收口：`parseWith` **连同它的再导出一起没了**，而 `formatIssues` 留着。
//
// ⚠️ 人类 2026-10-11 的裁定原话：「删除 `parseWith`，保留 `formatIssues` 的再导出。
//   `parseWith` 没有调用者，且其签名与 V2 的 Zod v4 契约不兼容。不要为没有实际使用场景的
//   辅助函数保留空壳。」
//
// ⚠️ 为什么要有这个文件：删掉的东西**没有编译期见证者**。删错了、或者过两天有人
//   「顺手补回来」，`tsc` 一声不吭，全仓测试也一声不吭 —— 唯一的见证就是这条负判据。
//   本仓库已经在票 09（`GameSpec`）与票 18（`ArtifactRef`）处死过两次同类空壳。
//
// ⚠️ 故意查**导出面**（运行时命名空间）而不是源码文本：文本 grep 会被注释里的
//   `parseWith` 骗到（`zod-issues.ts` 的墓碑注释里就写着这个词）。
import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as drawlist from "../src/drawlist.js";
import * as zodIssues from "../src/zod-issues.js";

describe("票 29 · `parseWith` 已删（负判据）", () => {
  it("`zod-issues.ts` 不再导出它", () => {
    expect("parseWith" in zodIssues).toBe(false);
  });

  it("`drawlist.ts` 那条**再导出**也没了 —— 不是只在原地删了本体", () => {
    // ⚠️ 两处都要查：只删本体、留下 `export { parseWith } from "./zod-issues.js"`
    //   会得到一个**编译就不过**的包，但反过来（本体留着、只删再导出）tsc 是查不出来的。
    expect("parseWith" in drawlist).toBe(false);
  });
});

describe("票 29 · `formatIssues` 留着，而且**还能用**", () => {
  // 「还在」不等于「还能用」—— 票 28 把它从 `drawlist.ts` 搬走、票 29 又动了它的兄弟，
  // 两次手术都可能把它弄成半死。所以这里不只查存在，还喂一个**真** Zod 错误给它。
  it("两个入口都还导得出它", () => {
    expect(typeof zodIssues.formatIssues).toBe("function");
    expect(typeof drawlist.formatIssues).toBe("function");
    // 同一条再导出关系：两边**必须是同一个函数**，不是各抄一份。
    expect(drawlist.formatIssues).toBe(zodIssues.formatIssues);
  });

  it("喂真错误 → 摊平成**可定位**的 `ops[1].cy: …`（R2 之后这是唯一留下的质量控制）", () => {
    const r = z.object({ ops: z.array(z.object({ cy: z.number() })) }).safeParse({ ops: [{ cy: 1 }, { cy: "nope" }] });
    expect(r.success).toBe(false);
    const lines = zodIssues.formatIssues(r.error!);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^ops\[1\]\.cy: /);
  });
});
