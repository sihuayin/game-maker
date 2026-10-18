// 票 51「`not-sent` 那一档两头都不准」的见证（4 条 + 同一族的表驱动补刀）。
//
// ⚠️ 这三个事实**各自独立**，任何一条都不许从另一条推出来（人类给的附加约束 1）：
//   ① **错在哪一档**（类别 · 退出码）· ② **钱花了没有**（账）· ③ **请求上路了没有**（往返数）。
//   本文件把它们**分开钉**：同一份 200 的非 JSON 体，①说它是上游的锅、②说这一笔真花了、
//   ③说它**只发了一趟**（不是三趟）。
//
// ⚠️ 钉的是[票 51](../../../.scratch/game-maker-v2/issues/51-not-sent-lies-both-ways.md) 底下那两条病的**修好之后**：
//   · 病一：`callText` 里那两处没设防的抛点（`res.json()` 的 `SyntaxError`、取 `usage`/`filter` 的
//     `TypeError`）过去被 `onceThrough` 的**兜底**记成「我们没发出去」⇒ **账整笔丢掉**。
//     现在判据翻过来了：只有凭据那一处点名落 `not-sent`，其余默认落 `upstream`/`http`。
//   · 病二：`not-sent` 那一档过去照 `trip({})` ⇒ `record()` 交出一格 `{attempts: 1, ms}` 的**幻影**
//     （一个请求都没上路）。现在它**不 `trip`** ⇒ `trips` 恒 0 ⇒ 账**结构性地**不可能有那一格。
//
// ⚠️ 零真调用：全部走 `fetchImpl` 桩（票面「测量不用人类的钱」那条）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { exitCodeOfError, ledgerOfError, type GameDesignSpec, type VisualWorldSpec } from "@game-maker/contracts";
import { CommandError, compileRuntime, compileTdGame, planAssets } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const PACK = path.join(ROOT, "fixtures/packs/counter-siege/v4");
const GOOD = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/td-configs/counter-siege.json"), "utf8"));

const tmp = (prefix: string) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

/** **逐字节**回一个响应体 —— 这一族量的是「body 用不了」，所以不许经过 `JSON.stringify(对象)` 那一层。 */
const rawReply = (body: string, status = 200): typeof fetch =>
  (async () => new Response(body, { status, headers: { "content-type": "text/plain" } })) as typeof fetch;

/** 数**往返**（一次 HTTP 一次）—— 账上那个 `attempts` 说的就是它（`CONTEXT.md` 的「调用 / 往返」）。 */
const counting = (f: typeof fetch) => {
  let n = 0;
  const wrapped = (async (...args: Parameters<typeof fetch>) => { n += 1; return f(...args); }) as typeof fetch;
  return { fetchImpl: wrapped, calls: () => n };
};

/** 接住抛出来的那个 —— 这一族全是**抛**，不是返回值。 */
const threw = (p: Promise<unknown>): Promise<unknown> => p.catch((e: unknown) => e);

type Rec = { step: string; target: string; attempts: number; failures?: string[] };

// ── 旧文本链（`compileTdGame` —— 它**是** `not-sent` 唯一的生产者，见票 51 的 M1） ──
const runTd = (d: string, fetchImpl: typeof fetch, over: Record<string, unknown> = {}) =>
  compileTdGame({
    requirementPath: path.join(d, "requirement.md"), packDir: PACK, outRoot: path.join(d, "out"),
    transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl, ...over,
  });
const tdDir = () => {
  const d = tmp("gm-not-sent-td-");
  fs.writeFileSync(path.join(d, "requirement.md"), "做一个守着柜台的塔防小关卡，五波，敌人从卷帘门进来。");
  return d;
};

// ── 工具链（R16 —— `onceThroughTool` 一条实现，`planAssets` 与 `compileRuntime` 共用） ──
const DESIGN: GameDesignSpec = {
  format: "game-design/v1",
  game: { title: "拾荒者", genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } },
  coreLoopSteps: ["探索废墟"],
  player: { id: "p-scavenger", role: "拾荒者", abilities: ["跑"], goals: ["在天黑前抵达"] },
  enemies: [{ id: "e-drone", behavior: "沿月台巡逻", threat: "接触即伤" }],
  npcs: [], interactables: [], resources: [],
  world: { theme: "废土", setting: "废墟", structure: "三段式" },
  levels: [{ id: "l-1", purpose: "教学", layout: "左到右", entities: ["e-drone"] }],
  progression: { model: "linear", description: "三关" },
  mechanics: [{ id: "m-jump", mechanic: "jump" }],
  winConditions: ["抵达终点"], loseConditions: [], runtimeRequirements: ["input:keyboard"]
};
/** `planAssets` 吃的是**两份文件的路径**，所以先把它们写进 tmp（`compileRuntime` 只要设计那一份）。 */
const stage = () => {
  const d = tmp("gm-not-sent-plan-");
  const world: VisualWorldSpec = {
    format: "visual-world/v1",
    styleIdentity: { keywords: ["低饱和"], description: "黄昏的铁路小站" },
    camera: { mode: "side" },
    composition: { foreground: "铁轨", midground: "月台", background: "远山" },
    lighting: {}, character: {}, environment: {},
    palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
    materials: {}, shapeLanguage: [], constraints: [],
    styleReferences: [{ path: path.relative(d, path.join(ROOT, "fixtures/reference/halt-dusk.png")) }],
    style: {
      id: "halt-dusk", identity: [], camera: {}, composition: {}, palette: ["#112233", "#445566"],
      lighting: {}, shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [], confidence: 0.5
    }
  };
  fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(DESIGN));
  fs.writeFileSync(path.join(d, "visual-world.json"), JSON.stringify(world));
  return d;
};
const runPlan = (d: string, fetchImpl: typeof fetch) =>
  planAssets({
    designPath: path.join(d, "game-design.json"), visualWorldPath: path.join(d, "visual-world.json"),
    outRoot: path.join(d, "out"), transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl,
    imageTransport: { protocol: "gemini", baseUrl: "http://x", apiKey: "k" },
  });
const runRuntime = (d: string, fetchImpl: typeof fetch) =>
  compileRuntime({
    designPath: path.join(d, "game-design.json"), packDir: PACK, outRoot: path.join(d, "out"),
    transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl,
  });

describe("① 200 + body 不是 JSON（旧文本链）—— 「上游没给一个可用的应答」，而这一笔**真花了**", () => {
  it("落 `upstream` / 3，账上**一格、一趟、原因 http** —— 三个事实各说各的", async () => {
    // ⚠️ 以前这一发落的是 `not-sent`（「我们没发出去」）—— 而 200 都回来了，钱**已经花了**。
    //   账面于是整个缺席：一个花了钱的失败被记成「没上路」，人看不到自己付过这笔。
    const up = counting(rawReply("这不是 JSON，这是代理塞回来的一页 HTML"));
    const e = await threw(runTd(tdDir(), up.fetchImpl));

    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).kind).toBe("upstream");              // ① 类别：上游的锅，不是我们的 bug
    expect(exitCodeOfError(e)).toBe(3);                             // ① 退出码：3 = 上游死活
    const ledger = ledgerOfError(e) as Rec[] | undefined;
    expect(ledger).toHaveLength(1);                                 // ② 账：一格里……
    expect(ledger![0]!.failures).toEqual(["http"]);                 // ② ……写着**为什么**重来
    expect(ledger![0]!.attempts).toBe(1);                           // ③ 往返：**只发了一趟**，不是三趟
    expect(up.calls()).toBe(1);                                     // ③ 桩那一侧点头（账自己说的不算数）
    // ⚠️ 文案要说得出是**上游**回的东西不对 —— 不是原始 `SyntaxError` 直出（那会把人引去查自己的代码）。
    expect((e as CommandError).message).toMatch(/上游回的不是 JSON/);
  });
});

describe("② 200 + 合法 JSON 但**不是一个对象**（形状那一族）—— 同一条裁决", () => {
  // ⚠️ 这一族比①更隐蔽：连「不是 JSON」都不需要，`null` 是**合法 JSON**，
  //   而它过去在 `j.usage` 那里炸成 `TypeError`、同样被兜底记成「我们没发出去」。
  it.each([["null", "null"], ["一个数组", "[]"], ["一个数", "123"], ["一个字符串", '"abc"']])(
    "body 是 %s ⇒ upstream / 3 + 账里一笔 `http`（不是 not-sent、账不缺席）",
    async (_what, body) => {
      const up = counting(rawReply(body));
      const e = await threw(runTd(tdDir(), up.fetchImpl));

      expect((e as CommandError).kind).toBe("upstream");
      expect(exitCodeOfError(e)).toBe(3);
      const ledger = ledgerOfError(e) as Rec[] | undefined;
      expect(ledger![0]!.failures).toEqual(["http"]);
      expect(ledger![0]!.attempts).toBe(1);
      expect(up.calls()).toBe(1);
      expect((e as CommandError).message).toMatch(/不是一个 messages 应答/);
    });

  it("⚠️ 但它**只收「不是对象」**：`{\"content\":5}`（是对象、字段形状不对）照旧落 4，不许被顺手收进来", async () => {
    // 这条钉的是「设防的边界」——形状族收得太宽会把「模型吐了坏数据、值得重采样」也判成上游死活。
    const up = counting(rawReply('{"content":5}'));
    const e = await threw(runTd(tdDir(), up.fetchImpl));
    expect((e as CommandError).kind).toBe("invalid");
    expect(exitCodeOfError(e)).toBe(4);
    expect(up.calls()).toBe(3);                                     // 仍然重采样三趟（这一族**没有**变）
  });
});

describe("③ 空凭据 —— **真 `not-sent`**：账必须缺席，因为一个请求都没上路", () => {
  it("`upstream` / 3（对外口径不变），而账上**一格都没有** —— 不许为「试过」伪造一笔往返", async () => {
    const up = counting(rawReply("{}"));
    const e = await threw(runTd(tdDir(), up.fetchImpl, { transport: { baseUrl: "", apiKey: "" } }));

    expect((e as CommandError).kind).toBe("upstream");              // ⚠️ 对外仍报「上游不可达」（既有测试钉着这一句）
    expect(exitCodeOfError(e)).toBe(3);
    expect(ledgerOfError(e)).toBeUndefined();                       // ② 账缺席
    expect(up.calls()).toBe(0);                                     // ③ 而且**真的一趟都没发**（这才是缺席的理由）
    expect((e as CommandError).message).toMatch(/ANTHROPIC_BASE_URL/);
  });
});

describe("⑤ 判据**本身** —— 走的是「点名」那一臂，不是「兜底」那一臂", () => {
  it("一个**没被设防**的抛点（头回来了、读 body 时才断）也默认落上游，且这一笔照样带账", async () => {
    // ⚠️ 这一条钉的是 Q1(d) 翻转的**那一臂**，而不是某一张脸：①② 钉的脸都被 `callText` 的守卫
    //   提前收成了 `UpstreamCallError`，所以「判据是点名还是兜底」在它们身上**看不出来** ——
    //   只有让一个抛点**绕过**守卫，那一臂才真正跑到。
    // ⚠️ 场景是真的：HTTP 头回来了（500）、读那个错误页读到一半连接断了 ⇒ `res.text()` 拒绝 ——
    //   而 `callText` 那句 `throw new UpstreamCallError("http", … await res.text() …)` 根本来不及构造完。
    //   ⇒ 这就是那句注释说的「**将来任何一个没设防的抛点**」：请求**已经上路、已经花钱**。
    //   兜底若还是「不是 `UpstreamCallError` ⇒ 我们没发出去」，这一笔会被记成**没上路**、账整笔丢掉。
    const broken: typeof fetch = (async () => new Response(
      new ReadableStream({ start(c) { c.error(new Error("连接在读到一半断了")); } }),
      { status: 500 },
    )) as typeof fetch;
    const e = await threw(runTd(tdDir(), broken));

    expect((e as CommandError).kind).toBe("upstream");              // 默认那一臂 = 上游没给可用的应答
    expect(exitCodeOfError(e)).toBe(3);
    const ledger = ledgerOfError(e) as Rec[] | undefined;
    expect(ledger![0]!.failures).toEqual(["http"]);
    expect(ledger![0]!.attempts).toBe(1);
  });
});

describe("④ 两条路对齐 —— 同一个事实不许判成两档（票 51 的 Q3 = (B)）", () => {
  it("body `null`：旧文本链与工具链**同类别 · 同退出码**（3），且工具链只发一趟", async () => {
    // ⚠️ 工具链以前把这一族当**可重采样的线形状失败**：`invalid`/4、**重试 3 趟**、每次都是一样的
    //   坏 body ⇒ 白花两趟钱。现在它落 `upstream`/`http`、**一趟就收**（代价已记入票 51 的 `## Answer`）。
    const td = counting(rawReply("null"));
    const tdErr = await threw(runTd(tdDir(), td.fetchImpl));
    const tool = counting(rawReply("null"));
    const toolErr = await threw(runRuntime(stage(), tool.fetchImpl));

    expect((tdErr as CommandError).kind).toBe("upstream");
    expect((toolErr as CommandError).kind).toBe("upstream");
    expect(exitCodeOfError(tdErr)).toBe(exitCodeOfError(toolErr));
    expect(tool.calls()).toBe(1);                                   // ⚠️ 往返 3 → 1，这是本票明确裁定的代价
    expect(ledgerOfError(toolErr) as Rec[] | undefined).toHaveLength(1);
  });

  it("同一族的**另一个命令**（`planAssets` 共用那条实现）也落同一档", async () => {
    const up = counting(rawReply("null"));
    const e = await threw(runPlan(stage(), up.fetchImpl));
    expect((e as CommandError).kind).toBe("upstream");
    expect(exitCodeOfError(e)).toBe(3);
    expect(up.calls()).toBe(1);
  });

  it("⚠️ 对齐是**双向**的：`{\"content\":5}` 两边都落 4（不许为了对齐把工具链那一档也拉过来）", async () => {
    const tool = counting(rawReply('{"content":5}'));
    const toolErr = await threw(runRuntime(stage(), tool.fetchImpl));
    expect((toolErr as CommandError).kind).toBe("invalid");
    expect(exitCodeOfError(toolErr)).toBe(4);
  });
});
