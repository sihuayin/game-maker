import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseTdConfig, tdDerivePath, type TdConfig } from "@game-maker/contracts";
import { CommandError, compileTdGame, tdConfigExample } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
/** ⚠️ **真产物**：跑过完整资源管线的那一份包 + 手写的那一关（它本身就是一份合法正例）。 */
const PACK = path.join(ROOT, "fixtures/packs/counter-siege/v4");
const GOOD = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/td-configs/counter-siege.json"), "utf8"));

const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-compile-td-"));
  fs.writeFileSync(path.join(d, "requirement.md"), "做一个守着柜台的塔防小关卡，五波，敌人从卷帘门进来。");
  return d;
};
/** 上游的回应体是 **Anthropic 的 messages 形状**（`callText` 读 `content[].text`），不是裸 JSON。 */
const upstream = (payload: unknown): typeof fetch =>
  (async () => new Response(
    JSON.stringify({ content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload) }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  )) as typeof fetch;
const run = (d: string, payload: unknown, over: Record<string, unknown> = {}) =>
  compileTdGame({
    requirementPath: path.join(d, "requirement.md"), packDir: PACK, outRoot: path.join(d, "out"),
    transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl: upstream(payload), ...over,
  });

describe("⚠️ 提示词里的骨架**必须自己先过 schema**", () => {
  it("`tdConfigExample` 是一份合法的 td-config —— 示例错了，模型就会以「看起来没问题」的方式错", () => {
    // 与 `gameConfigExample` 同一条守门人（票 40 抓到过三条「提示词教模型写一个会被自己拒收的形状」）。
    const r = parseTdConfig(tdConfigExample);
    expect(r.ok, r.ok ? "" : r.errors.join("；")).toBe(true);
  });

  it("骨架里那张地图**行长正好 32、行数正好 18** —— 那是它最值钱的一段", () => {
    // ⚠️ 逐字给出「一行多长、五个字符怎么摆」比任何文字描述都准；写错一个字符就白给。
    const rows = (tdConfigExample as unknown as { arena: { rows: string[]; cell: number; walkChar: string } }).arena;
    expect(rows.rows).toHaveLength(18);
    expect([...new Set(rows.rows.map((r) => r.length))]).toEqual([32]);
    expect(rows.cell).toBe(15);
  });

  it("骨架的走道**自己就是一条单线、派得出路径** —— 示例不能示范「分叉」或「走道画歪」", () => {
    // ⚠️ 票 12 之后这张地图多了一条要满足的性质：走道必须是**一条一折再折的单线**
    //   （否则派生不出唯一的那条路）。示例错了，模型就会以「看起来没问题」的方式错 ——
    //   第 5 行最左那五个走道格原本把 `(6,4)` 顶成一个 T 字口，就是这么被抓出来的。
    const a = (tdConfigExample as unknown as { arena: { rows: string[]; cell: number; walkChar: string } }).arena;
    const d = tdDerivePath(tdConfigExample as unknown as TdConfig);
    expect(d.ok, d.ok ? "" : d.error).toBe(true);
    if (!d.ok) return;
    expect(d.points.length).toBeGreaterThanOrEqual(2);
    for (const p of d.points) {
      const ch = [...a.rows[Math.floor(p.y / a.cell)]!][Math.floor(p.x / a.cell)]!;
      expect(ch, `路径点 (${p.x},${p.y}) 落在格 "${ch}" 上`).toBe(a.walkChar);
    }
  });
});

describe("编译：一次调用 → 一份落盘的关卡", () => {
  it("上游给一份合法关卡 → 落盘 v1，且校验全过", async () => {
    const d = tmp();
    const r = await run(d, GOOD);
    const file = path.join(d, "out", "counter-siege", "td-configs", "v1.json");
    expect(fs.existsSync(file)).toBe(true);
    expect(r.command).toBe("compile-td-game");
    expect(r.data.ok).toBe(true);
    expect(r.data.version).toBe(1);
    // ⚠️ 断言的是**内容相同**，不是**字节相同** —— `parseTdConfig` 会按 schema 的键序重建对象，
    //   所以逐字节比对会被键序绊倒，而那与「落盘的就是上游给的那一份」是两件事。
    // ⚠️ **除 `path` 那一块**（票 12）：路径**一律**由编译那一步从地图派生（`{ fromMap: true }`），
    //   上游写没写它都**不看** —— 所以那句话现在的准确形式是「除 `path` 外逐字段相同」。
    const written = JSON.parse(fs.readFileSync(file, "utf8")) as { path: unknown };
    expect({ ...written, path: null }).toEqual({ ...GOOD, path: null });
    const derived = tdDerivePath(GOOD as TdConfig);
    expect(derived.ok, derived.ok ? "" : derived.error).toBe(true);
    if (derived.ok) expect(written.path).toEqual({ points: derived.points });
  });

  it("⚠️ **上游不写 `path`**（票 12：模型本来就不写它）→ 落盘的那一份里路径是**派生的**", async () => {
    // ⚠️ 这是这条链上最大的那个缺口被补上的地方：产物**看起来没变**（`path.points` 还在），
    //   而**写它的不再是模型** —— 「路径与地图对不上」于是结构上不可能。
    const d = tmp();
    const draft = structuredClone(GOOD) as Record<string, unknown>;
    delete draft.path;
    const r = await run(d, draft);
    expect(r.data.ok, r.summary.join("\n")).toBe(true);
    const written = JSON.parse(fs.readFileSync(path.join(d, "out", "counter-siege", "td-configs", "v1.json"), "utf8"));
    expect(written.path.points.length).toBeGreaterThanOrEqual(2);
    // 派生的那一份**只落在走道格上**（把地图画对，路径就是对的）
    const a = written.arena as { rows: string[]; cell: number; walkChar: string };
    for (const p of written.path.points as { x: number; y: number }[]) {
      const ch = [...a.rows[Math.floor(p.y / a.cell)]!][Math.floor(p.x / a.cell)]!;
      expect(ch, `路径点 (${p.x},${p.y}) 落在格 "${ch}" 上`).toBe(a.walkChar);
    }
  });

  it("⚠️ **走道画得派生不出路径** → 不崩、不落一份坏关卡，而是有一条说得清的硬失败", async () => {
    // ⚠️ 这条是写测试时抓出来的**真 bug**：`coreAt` 取 `pts[pts.length - 1]!`，
    //   而路径派生不出来时 `pts` 是空的 ⇒ `entityBox(undefined)` **抛** ——
    //   校验器把「说得出哪儿不对的失败」变成了崩溃。
    const d = tmp();
    const draft = structuredClone(GOOD) as Record<string, unknown>;
    delete draft.path;
    (draft.arena as { rows: string[] }).rows[7] = ":" + (draft.arena as { rows: string[] }).rows[7]!.slice(1);
    const r = await run(d, draft);
    expect(r.data.ok).toBe(false);
    expect(r.summary.join("\n")).toMatch(/派生不出路径/);
  });

  it("**绝不覆盖**：再编译一次就是 v2，v1 原样还在", async () => {
    const d = tmp();
    await run(d, GOOD);
    expect((await run(d, GOOD)).data.version).toBe(2);
    expect(fs.existsSync(path.join(d, "out", "counter-siege", "td-configs", "v1.json"))).toBe(true);
  });

  it("⚠️ **落账**（票 06 的 Q4）：花了什么得有地方记着 —— 与 `derive` 同款，进 `data.ledger`", async () => {
    const d = tmp();
    const r = await run(d, GOOD);
    const ledger = r.data.ledger as { step: string; ms: number; target: string }[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.step).toBe("compile-td-game");
    expect(ledger[0]!.target).toBe("td-config");
  });

  it("⚠️ **重试在账里看得见**（`attempts` 是**累计往返**，不是每次覆盖成 1）", async () => {
    // ⚠️ `CONTEXT.md` 的「调用 / 往返」写着：**重试烧掉的额度要能单独看见，否则失败的归因是错的**。
    //   第一版在循环里覆盖成一个 —— 于是「第一次吐了坏 JSON」这件事在账里**根本不显形**。
    const d = tmp();
    let n = 0;
    const flaky = (async () =>
      new Response(JSON.stringify({ content: [{ type: "text", text: n++ === 0 ? "这不是 JSON" : JSON.stringify(GOOD) }] }),
        { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const r = await run(d, GOOD, { fetchImpl: flaky });
    expect(r.data.ok).toBe(true);
    expect((r.data.ledger as { attempts: number }[])[0]!.attempts).toBe(2);
  });

  it("⚠️ **失败时已经花掉的那几笔跟着异常一起走**（票 46 的纪律）", async () => {
    const d = tmp();
    const e = await run(d, "这不是 JSON", { attempts: 2 }).catch((x: unknown) => x);
    const ledger = (e as CommandError).ledger;
    expect(ledger, "失败也要把账带出来").toBeDefined();
    expect(ledger![0]!.step).toBe("compile-td-game");
    expect(ledger![0]!.attempts).toBe(2);       // 两次都试过了（次数是显式给的，不钉默认值）
  });

  it("⚠️ **校验不过也重采样** —— 真跑量下来「一次就过」只有 ~1/4，而重采样不是修复循环", async () => {
    // ⚠️ **不把错误喂回去**（那会是修复循环，R2 判过它出局）—— 只是**重采样**同一份提示词。
    const d = tmp();
    const bad = structuredClone(GOOD);
    bad.arena.rows[8] = "#" + ".".repeat(12) + bad.arena.rows[8].slice(13);   // 走道画偏一格
    let n = 0;
    const flaky = (async () => new Response(
      JSON.stringify({ content: [{ type: "text", text: JSON.stringify(n++ === 0 ? bad : GOOD) }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
    const r = await run(d, GOOD, { fetchImpl: flaky });
    expect(r.data.ok, "第二次过了").toBe(true);
    expect((r.data.ledger as { attempts: number }[])[0]!.attempts).toBe(2);
  });

  it("⚠️ 重采样**全失败**也照常落盘最后那一份（人过目的前提是他看得到哪儿不对）", async () => {
    const d = tmp();
    const bad = structuredClone(GOOD);
    bad.arena.rows[8] = "#" + ".".repeat(12) + bad.arena.rows[8].slice(13);
    const r = await run(d, bad);
    expect(r.data.ok).toBe(false);
    expect(fs.existsSync(path.join(d, "out", "counter-siege", "td-configs", "v1.json"))).toBe(true);
    expect((r.data.ledger as { attempts: number }[])[0]!.attempts).toBe(3);   // 默认三次都试了
  });

  it("回报里给出下一步（而「能通关吗」判在 `site` —— 票 11）", async () => {
    const d = tmp();
    const r = await run(d, GOOD);
    expect(r.summary.join("\n")).toMatch(/game-maker site/);
    expect(r.summary.join("\n")).toMatch(/这一关通不通.*判在那一步|几何族与「这一关通不通」判在那一步/);
  });
});

describe("⚠️ 坏关卡**照常落盘**（票 06/09 的裁决：人过目的前提是他看得到哪儿不对）", () => {
  it("引用解不到 → ok=false，但 v1.json 还在，且消息点名到格号", async () => {
    const d = tmp();
    const bad = structuredClone(GOOD);
    bad.towers[0].asset = "__没有__";
    const r = await run(d, bad);
    expect(r.data.ok).toBe(false);
    expect(fs.existsSync(path.join(d, "out", "counter-siege", "td-configs", "v1.json"))).toBe(true);
    expect(r.summary.join("\n")).toMatch(/包里没有资源/);
  });

  it("**走道画偏了**（地图上那条走道与门口连不成一条）→ ok=false，且消息说得出是**哪一格**", async () => {
    // 这是真跑里最常出现的那一类：模型画的地图有问题。
    // ⚠️ 票 12 之后它在**编译这条路上**不从「路径穿过的格不是走道砖」响了 ——
    //   路径是**从地图算出来**的，它**没机会**与地图对不上。现在响的是**派生**那一条，
    //   而这里断言的是：**它同样说得出格号**（说得清才有得改）。
    const d = tmp();
    const bad = structuredClone(GOOD);
    bad.arena.rows[8] = "#" + ".".repeat(12) + bad.arena.rows[8].slice(13);
    const r = await run(d, bad);
    expect(r.data.ok).toBe(false);
    expect(r.summary.join("\n")).toMatch(/端头|走道断了/);
    expect(r.summary.join("\n")).toMatch(/\(\d+,\d+\)/);
  });

  it("⚠️ **上游写了 `path` 也不看它** —— 一律从地图派生，那一族失败才真的「结构上不可能」", async () => {
    // ⚠️ 这条是**补上的一处缺口**：只写一句「请不要写 path」是不够的（票 12 量过，
    //   「把话说硬」的上限很低）。只要还「尊重」模型写的路径，模型写一份与地图对不上的，
    //   这条失败就原封不动地回来了 —— 而它是 20 次真调用里失败原因的绝大多数。
    const d = tmp();
    const bogus = structuredClone(GOOD);
    bogus.path.points[1] = { x: 999, y: 999 };            // 与它自己的地图毫无关系的一条路
    const r = await run(d, bogus);
    expect(r.data.ok, r.summary.join("\n")).toBe(true);   // ⇒ 被无视，不是被拒
    const written = JSON.parse(fs.readFileSync(path.join(d, "out", "counter-siege", "td-configs", "v1.json"), "utf8"));
    const good = tdDerivePath(GOOD as TdConfig);
    expect(good.ok).toBe(true);
    if (good.ok) expect(written.path).toEqual({ points: good.points });
  });
});

describe("失败的路", () => {
  it("两次都吐坏 JSON → invalid（不是把半截东西落盘）", async () => {
    const d = tmp();
    const e = await run(d, "这不是 JSON").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).kind).toBe("invalid");
    expect(fs.existsSync(path.join(d, "out"))).toBe(false);
  });

  it("凭据是空串（生产里真会发生的那条路）→ upstream，且说得出要哪两个环境变量", async () => {
    const d = tmp();
    const e = await run(d, GOOD, { transport: { baseUrl: "", apiKey: "" } }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("upstream");
    expect((e as CommandError).message).toMatch(/ANTHROPIC_BASE_URL/);
  });

  it("不是一个资源包 → usage", async () => {
    const d = tmp();
    const e = await run(d, GOOD, { packDir: d }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("usage");
  });

  it("上游不响应 → 超时 → upstream（超时值可注入，见票 06）", async () => {
    const d = tmp();
    const hang = ((_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_res, rej) => { init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))); })) as unknown as typeof fetch;
    const e = await run(d, GOOD, { fetchImpl: hang, timeoutMs: 30 }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("upstream");
    expect((e as CommandError).message).toMatch(/超时|没回应/);
  });
});
