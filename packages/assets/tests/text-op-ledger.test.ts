// 文本那两个操作的账（票 28）：**一笔账 = 一次往返**，且失败的那笔**说得出为什么**。
//
// ⚠️ 这一族的存在理由：`derive` 与 `compileGame` 的账以前是坏的，而且是**两种不同的坏法** ——
//   `derive` 每一轮**覆盖写**、`attempts` 恒为 1（重采样在账上完全不可见）；
//   `compileGame` **一分账都不交**（因为 `LedgerStep` 枚举里**根本没有 `compile-game`**）。
//   两者都让票 27 要的那个数 —— 「首发到底成不成、不成是因为什么」—— 读不出来。
//
// ⚠️ **一格 = 一次调用**（`CONTEXT.md` 的「调用 / 往返」）：重采样**不新开一格**，
//   而是在同一格里把 `attempts` 加上去、把每次没成的原因追加进 `failures`。
//   两个都留着才同时回答得了「重试烧了多少」**和**「每次为什么重来」。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CALL_FAILURES, parseRecipe } from "@game-maker/contracts";
import { CommandError, compileGame, deriveRecipe } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const STYLE = path.join(ROOT, "fixtures/style-spec.halt-dusk.json");
const RECIPE = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/recipes/shift-change.json"), "utf8"));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const GAME_CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/game-configs/last-train.json"), "utf8"));

const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-text-ledger-"));
  fs.writeFileSync(path.join(d, "requirement.md"), "做一个横版跳跃小关卡。");
  return d;
};
/** 上游的回应体是 **Anthropic 的 messages 形状**（`callText` 读 `content[].text`），不是裸 JSON。 */
const upstream = (payload: unknown): typeof fetch =>
  (async () => new Response(
    JSON.stringify({ content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload) }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  )) as typeof fetch;

type Rec = { step: string; target: string; attempts: number; failures?: string[] };

describe("⚠️ 先验正例：夹具本身得是合法的", () => {
  it("`fixtures/recipes/shift-change.json` 过 schema —— 不然下面测的就不是账，是别的东西为什么失败了", () => {
    const r = parseRecipe(RECIPE);
    expect(r.ok, r.ok ? "" : r.errors.join("；")).toBe(true);
  });
});

describe("`derive` 的账（票 28：以前每轮覆盖写、`attempts` 恒为 1）", () => {
  const run = (d: string, fetchImpl: typeof fetch, over: Record<string, unknown> = {}) =>
    deriveRecipe({
      requirementPath: path.join(d, "requirement.md"), stylePath: STYLE, outRoot: path.join(d, "out"),
      transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl, ...over,
    });

  it("一次就成 ⇒ 账上一格，`failures` 缺席（缺席 == 一次都没失败）", async () => {
    const d = tmp();
    const r = await run(d, upstream(RECIPE));
    const ledger = r.data.ledger as Rec[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ step: "derive", target: "recipe", attempts: 1 });
    expect(ledger[0]!.failures).toBeUndefined();
  });

  it("⚠️ 第一次吐坏 JSON ⇒ `attempts` 是 2 且 `failures` 记着 `invalid-json` —— 以前这一格恒为 1、什么都不说", async () => {
    const d = tmp();
    let n = 0;
    const flaky = (async () => new Response(
      JSON.stringify({ content: [{ type: "text", text: n++ === 0 ? "这不是 JSON" : JSON.stringify(RECIPE) }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
    const r = await run(d, flaky);
    const ledger = r.data.ledger as Rec[];
    expect(ledger, "一格 = 一次调用，不是一次往返").toHaveLength(1);
    expect(ledger[0]!.attempts, "两趟往返").toBe(2);
    expect(ledger[0]!.failures, "而第一趟为什么没成，账上写得出").toEqual(["invalid-json"]);
  });

  it("全都不成 ⇒ 失败**也把账带出来**，而且**每一次**的病因都在", async () => {
    const d = tmp();
    const e = await run(d, upstream("这不是 JSON")).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    const ledger = (e as CommandError).ledger as Rec[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.attempts, "两次都试过").toBe(2);
    expect(ledger[0]!.failures, "两次都记了，且**按发生顺序**").toEqual(["invalid-json", "invalid-json"]);
  });

  it("⚠️ **上游挂了与模型吐坏数据是两个数** —— 前者当场停、记 `http`，不重采样", async () => {
    const d = tmp();
    const e = await run(d, (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch)
      .catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("upstream");
    const ledger = (e as CommandError).ledger as Rec[];
    expect(ledger, "发出去过就得记（票 46）").toHaveLength(1);
    expect(ledger[0]!.attempts, "只发了一趟 —— 上游挂了当场停，不重采样").toBe(1);
    expect(ledger[0]!.failures).toEqual(["http"]);
  });

  it("⚠️ **没配凭据 ⇒ 账上不该有这一笔**：请求压根没上路（票 46 只记真的发出去的）", async () => {
    // ⚠️ 这一档以前会被记成 `failure: "http"` —— 一个**本地配置错**被计成**上游故障**，
    //   于是「上游今天稳不稳」这个数会被自己的配置污染。
    const d = tmp();
    const e = await run(d, upstream(RECIPE), { transport: { baseUrl: "", apiKey: "" } }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("upstream");
    expect((e as CommandError).message).toMatch(/ANTHROPIC_BASE_URL/);
    expect((e as CommandError).ledger, "一次都没发出去").toBeUndefined();
  });
});

describe("`compileGame` 的账（票 28：以前**一分账都不交**）", () => {
  const run = (d: string, fetchImpl: typeof fetch, over: Record<string, unknown> = {}) =>
    compileGame({
      requirementPath: path.join(d, "requirement.md"), packDir: PACK, outRoot: path.join(d, "out"),
      transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl, ...over,
    });

  it("成了 ⇒ `data.ledger` 里有账，`step` 是 `compile-game`（它以前**一分账都不交**）", async () => {
    const d = tmp();
    const r = await run(d, upstream(GAME_CONFIG));
    const ledger = r.data.ledger as Rec[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ step: "compile-game", target: "game-config", attempts: 1 });
  });

  it("⚠️ 坏 JSON ⇒ 重采样，一格账、`attempts` 2、`failures` 记着 `invalid-json`", async () => {
    const d = tmp();
    let n = 0;
    const flaky = (async () => new Response(
      JSON.stringify({ content: [{ type: "text", text: n++ === 0 ? "{{{" : JSON.stringify(GAME_CONFIG) }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
    const r = await run(d, flaky);
    const ledger = r.data.ledger as Rec[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.attempts).toBe(2);
    expect(ledger[0]!.failures).toEqual(["invalid-json"]);
  });

  it("⚠️ 超时 ⇒ `timeout`，**不是** `http` —— 那是我们主动中止的，不是上游回了个坏应答", async () => {
    const d = tmp();
    // 一个**尊重 signal** 的假 fetch：不主动返回，等被中止
    const hang = ((_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_res, rej) => { init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))); })
    ) as unknown as typeof fetch;
    const e = await run(d, hang, { timeoutMs: 30 }).catch((x: unknown) => x);
    const ledger = (e as CommandError).ledger as Rec[];
    expect(ledger[0]!.failures).toEqual(["timeout"]);
  });

  it("⚠️ 病因**只许出自闭集** —— 否则「率」的分母会悄悄漂", async () => {
    const d = tmp();
    const e = await run(d, (async () => new Response("boom", { status: 503 })) as unknown as typeof fetch)
      .catch((x: unknown) => x);
    for (const c of (e as CommandError).ledger ?? []) {
      for (const f of c.failures ?? []) expect(CALL_FAILURES).toContain(f);
    }
  });
});
