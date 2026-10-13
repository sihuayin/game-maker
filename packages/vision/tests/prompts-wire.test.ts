// 票 64 的判据 · **线级**：断言 `analyzeReference` **实际构造并交给 `fetchImpl` 的请求体**。
//
// ⚠️ **为什么不满足于 `prompts.test.ts` 那几条**（票 64 的 Q5、照票 61 的 Q13 纪律）：
//   那几条断言的是**源码里的常量**（`TOOL_DESCRIPTION`、`visionPrompt(...)` 的返回值）。
//   常量在 ≠ 模型读到的就是它 —— 它是**怎么被拼进 body 的**（拼接顺序、模板变量、被谁覆盖）
//   一个字都没管。而本票要治的病，恰恰是「**模型手上那一份**」里的措辞（第十三次真跑那三发
//   逐字都是 `palette: Invalid input: expected object, received array`）。
//   ⇒ 这里抓的是**链上真发出去的那一份**：`fetchImpl` 收到的 `init.body`。
// ⚠️ **零上游调用、零花费**：`fetchImpl` **抓完就抛**（与探针 `palette-prose-ab-probe.mjs` 同一手）。
//
// ⚠️ **这两处散文不是文风**（票 64 立案现场，2026-10-13）：
//   第十三次真跑（段 A）三发全灭，读出来的是 —— 模型把它刚写下的那份 `style.palette`
//   **逐字节抄进了顶层 `palette`**（而 `materials.*.color` 里的 `palette:N` 全对 ⇒ 引用语法它懂，
//   只是把**色值的家**摆到了**桶**的位置）。A/B 探针（一个变量、两臂各 6 发）：
//   这一件事 **A 臂 5/6 → B 臂 0/6**（超几何双侧 p=0.0152）。
//   ⇒ 下面断的就是**那次探针测过的那段措辞**（落进源码的与它**逐字节相同**，已核过）。
import { describe, expect, it } from "vitest";
import { PALETTE_BUCKETS } from "@game-maker/contracts";
import { TOOL_NAME, analyzeReference, type AnalyzeReferenceInput } from "../src/index.js";

const REFS = [{ path: "fixtures/reference/halt-dusk.png" }];

/**
 * 抓**链上真发出去的那一份请求体** —— 抓完就让 `fetchImpl` 抛 ⇒ **一次上游调用都不发生**。
 * ⚠️ `analyzeReference` 会按 R16 重采样（这里每一发的 body 都相同，抓到哪一发都一样）。
 */
async function capture(over: Partial<AnalyzeReferenceInput> = {}) {
  let body: string | undefined;
  const input: AnalyzeReferenceInput = {
    styleReferences: REFS,
    requirementText: "做一个末班车小站的横版过关",
    styleId: "halt-dusk",
    transport: { baseUrl: "http://upstream.test", apiKey: "k" },
    fetchImpl: (async (_u: string, init: RequestInit) => {
      body ??= String(init.body); // 只留第一发，够用
      throw new Error("capture-only（本判据不发这一发）");
    }) as unknown as typeof fetch,
    ...over,
  };
  await analyzeReference(input).then(
    (ok) => { throw new Error(`这一步**应当抛**（抓包的 fetchImpl 抛了），但它成功了：${JSON.stringify(ok)?.slice(0, 160)}`); },
    () => undefined, // 预期：抓完就抛
  );
  if (body === undefined) throw new Error("没抓到请求体 —— `analyzeReference` 的构造路径变了？");
  const parsed = JSON.parse(body);
  return {
    body: parsed,
    /** 工具描述 —— 三件「模型看不见的事」唯一的家。 */
    toolDesc: parsed.tools?.[0]?.description as string,
    /** 用户轮那段文本（图之后那一格）。 */
    userText: parsed.messages?.[0]?.content?.find?.((c: { type: string }) => c.type === "text")?.text as string,
  };
}

/**
 * 请求体里**反引号括起来的、像标识符的、含 `palette` 的那些** —— 用来查「有没有发明新键名」。
 * ⚠️ 收窄成标识符形状（`[A-Za-z][A-Za-z0-9_:.*]*`）：散文里的 `palette`（「两个都叫 palette 的东西」、
 *    `style` 封键清单里那个裸词）**不是标识符**，不该被当成键名。
 */
const paletteTokens = (text: string): string[] =>
  [...text.matchAll(/`([A-Za-z][A-Za-z0-9_:.*]*)`/g)]
    .map((m) => m[1]!)
    .filter((t) => t.includes("palette"));

describe("线级：发给模型的那一份里，两个 `palette` 被分开了（票 64）", () => {
  it("工具描述点名「有两个都叫 palette 的东西」，并说死**顶层那个是对象、不是数组**", async () => {
    const { toolDesc } = await capture();
    expect(toolDesc).toContain("两个都叫 palette 的东西，形状不一样");
    // ⭐ 这一句是整条修复的枪口：把「顶层是个对象」与「不是数组」**摆在同一句里**，
    //    而不是像旧版那样在同一句里引出两个同名键、却对顶层那个的形状一个字不说。
    expect(toolDesc).toContain("顶层的 `palette`** 是一个**对象**（**不是数组**）");
  });

  it("⭐ 六个桶名**从契约派生**（`PALETTE_BUCKETS`）—— 契约改了名字，这条就红", async () => {
    const { toolDesc } = await capture();
    expect(toolDesc).toContain(PALETTE_BUCKETS.join(" / ")); // 提示词里的写法就是 `a / b / …`
    for (const b of PALETTE_BUCKETS) expect(toolDesc, `工具描述漏了桶 ${b}`).toContain(b);
  });

  it("色值的家被点名在 `style.palette`，且点破了最常见的错法（把整个数组搬上去）", async () => {
    const { toolDesc } = await capture();
    expect(toolDesc).toContain("**色值**住在 **`style.palette`** 里");
    expect(toolDesc).toContain("有序数组");
    expect(toolDesc).toContain("原样搬到顶层"); // 第十三次真跑那三发的**逐字**形状
  });

  it("用户轮那半句**带上了限定** —— 不再是不加限定的「`palette` 的选择标准」", async () => {
    const { userText } = await capture();
    expect(userText).toContain("**`style.palette`**（就是上面那个**色值数组**");
    expect(userText).toContain("与顶层那个六桶的 `palette` 不是同一个东西");
    expect(userText).toContain("的选择标准是**能不能画出这个世界里的东西**");
  });

  it("⚠️ **阴性**：旧的不加限定的那两处，请求体里一个字都不剩", async () => {
    const { toolDesc, userText } = await capture();
    expect(toolDesc).not.toContain("六桶（`palette.primary` 等）"); // 旧第 3 条的开头
    expect(userText).not.toContain("palette 的选择标准是");          // 旧用户轮那句的开头
  });

  it("⚠️ **阴性 · 三条措辞约束**（Q4 §1.3）：不写真色值 · 不写六桶 JSON 字面量 · 不发明新键名", async () => {
    const { toolDesc, userText } = await capture();
    // ① 只出现 `#rrggbb` 这个**形式**，不许出现任何一个真色值（`#` + 六位十六进制）。
    expect(toolDesc).not.toMatch(/#[0-9a-f]{6}/);
    expect(userText).not.toMatch(/#[0-9a-f]{6}/);
    expect(toolDesc).toContain("`#rrggbb`"); // 而形式本身在
    // ② 不写六桶的 JSON 字面量 —— 那等于给出一份会被照抄的桶分配，而桶分配是世界相关的。
    expect(toolDesc).not.toContain('"primary"');
    // ③ 限定称呼只用「顶层 `palette`」与 `style.palette`，**不许发明新键名**：
    //    所有反引号括起来的含 palette 的标识符，必须落在下面这个闭集里。
    expect(new Set([...paletteTokens(toolDesc), ...paletteTokens(userText)]))
      .toEqual(new Set(["palette", "style.palette", "palette:N"]));
  });

  it("⚠️ **反空洞**：抓到的确实是链上那一次（工具名 / 强制调用 / 需求文本 / `style.id` 都在）", async () => {
    const { body, userText } = await capture();
    expect(body.tools[0].name).toBe(TOOL_NAME);
    expect(body.tool_choice).toEqual({ type: "tool", name: TOOL_NAME });
    expect(userText).toContain("末班车小站的横版过关");           // 需求文本真进去了
    expect(userText).toContain("halt-dusk");                      // `style.id` 照抄那一句也在
    expect(userText).toContain("不要**按画面占比从高到低排序");     // 票 39 那两条实测纠正没被这次改动带歪
  });

  it("⚠️ 两处散文各落在**该落的那一格**：形状说明在工具描述，选色标准在用户轮", async () => {
    const { toolDesc, userText } = await capture();
    expect(toolDesc).toContain("形状不一样");
    expect(userText).not.toContain("形状不一样");                  // 工具描述那一句**没有**溢到用户轮
    expect(userText).toContain("选择标准是");
    expect(toolDesc).not.toContain("选择标准是");                  // 用户轮那一句**没有**溢到工具描述
  });

  // ⚠️ **不在这里断「逐字节 == 探针 B 臂那份」**：那是一次性核过的（落进源码的与探针测过的
  //    8826 字节逐字节相同），而把它钉成常驻判据会把本包的测试**绑死在 `.scratch/` 的
  //    实验现场**上（那批 raw 是靠不住的），还会被任何无关改动（`max_tokens` 等）连带弄红。
  //    措辞本身由上面那几条**内容级**判据看着，够了。
});
