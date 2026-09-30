import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseTdConfig } from "@game-maker/contracts";
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
    const rows = (tdConfigExample as { arena: { rows: string[]; cell: number; walkChar: string } }).arena;
    expect(rows.rows).toHaveLength(18);
    expect([...new Set(rows.rows.map((r) => r.length))]).toEqual([32]);
    expect(rows.cell).toBe(15);
  });

  it("骨架的**路径落在走道格上** —— 示例自己就不能示范「走道画在哪、敌人走别处」", () => {
    const a = (tdConfigExample as { arena: { rows: string[]; cell: number; walkChar: string } }).arena;
    const pts = (tdConfigExample as { path: { points: { x: number; y: number }[] } }).path.points;
    for (const p of pts) {
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
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(GOOD);
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
    const e = await run(d, "这不是 JSON").catch((x: unknown) => x);
    const ledger = (e as CommandError).ledger;
    expect(ledger, "失败也要把账带出来").toBeDefined();
    expect(ledger![0]!.step).toBe("compile-td-game");
    expect(ledger![0]!.attempts).toBe(2);       // 两次都试过了
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

  it("**走道画偏了**（路径穿过的格不是走道砖）→ ok=false，且消息说得出是**哪一格**", async () => {
    // 这是真跑里最常出现的那一类：模型画的走道与它自己的路径对不上。
    const d = tmp();
    const bad = structuredClone(GOOD);
    bad.arena.rows[8] = "#" + ".".repeat(12) + bad.arena.rows[8].slice(13);
    const r = await run(d, bad);
    expect(r.data.ok).toBe(false);
    expect(r.summary.join("\n")).toMatch(/走道画在哪，敌人就该走哪/);
    expect(r.summary.join("\n")).toMatch(/arena\.rows\[8\]/);
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
