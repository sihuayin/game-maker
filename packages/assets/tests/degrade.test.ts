import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { parseAssetPack, paletteBindingOf, type AssetSpec, type AssetRecipe, type StyleSpec } from "@game-maker/contracts";
import { buildPackResilient, explainDegradation, proceduralGenerator, probeEndpoint } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const STYLE: StyleSpec = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const FULL: AssetRecipe = JSON.parse(readFileSync(ROOT + "fixtures/recipes/shift-change.json", "utf8"));
const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "degrade-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

/**
 * 只留两个**单帧**的生成型资源，跑得快。
 * ⚠️ 必须挑 sprite —— 清单里的 player-odin 有 14 帧，桩给 14 帧才不触发帧数不符（第一版就栽在这）。
 */
const recipe = (): AssetRecipe => ({ ...FULL, assets: FULL.assets.filter((a) => a.source.kind === "generate" && a.spec.kind === "sprite").slice(0, 2) });

const okJson = (n = 1) => ({   // 测试里的资源都是单帧 sprite
  content: [{ type: "text", text: JSON.stringify({ frames: Array.from({ length: n }, (_, i) => ({ name: `f${i}`, ops: [{ op: "rect", x: 0, y: 0, w: 4, h: 4, fill: "palette:1" }] })) }) }],
  stop_reason: "end_turn",
});
/** 探测请求（max_tokens 8）与真实生成请求要能分开处理。 */
const fetchBy = (onProbe: () => Response | Promise<Response>, onGenerate: () => Response | Promise<Response>): typeof fetch =>
  (async (_u: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    return body.max_tokens <= 8 ? onProbe() : onGenerate();
  }) as unknown as typeof fetch;
const res200 = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as Response;
const res403 = (msg: string) => ({ ok: false, status: 403, json: async () => ({ error: msg }), text: async () => JSON.stringify({ error: { message: msg } }) }) as Response;
const boom = () => { throw new Error("ECONNREFUSED"); };

describe("probeEndpoint —— 必须发真实请求（票 01：鉴权根本不校验）", () => {
  it("200 → ok", async () => {
    const r = await probeEndpoint({ baseUrl: "http://x", apiKey: "k", endpoint: "messages", fetchImpl: (async () => res200({})) as unknown as typeof fetch });
    expect(r.ok).toBe(true);
  });
  it("403 → 不 ok，且带上上游的错误体（否则只看到一个状态码）", async () => {
    const r = await probeEndpoint({ baseUrl: "http://x", apiKey: "k", endpoint: "chat-completions", fetchImpl: (async () => res403("Insufficient account balance")) as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/403.*Insufficient account balance/);
  });
  it("连不上 → 不 ok，也不抛", async () => {
    const r = await probeEndpoint({ baseUrl: "http://x", apiKey: "k", endpoint: "messages", fetchImpl: (async () => boom()) as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/ECONNREFUSED/);
  });
});

describe("降级链 —— 三层，整包降级", () => {
  it("首选可用 → 用首选，零切换、零降级", async () => {
    const r = await buildPackResilient({
      recipe: recipe(), style: STYLE, outDir: tmp(), transport: { baseUrl: "http://x", apiKey: "k" },
      fetchImpl: fetchBy(() => res200({}), () => res200(okJson())),
    });
    expect(r.used).toBe("messages");
    expect(r.manifest.provenance.transport).toMatchObject({ preferred: "messages", used: "messages", switches: [] });
    expect(r.manifest.provenance.degradations).toEqual([]);
  });

  it("⚠️ 首选 403、备用可用 → 换端点，**那不算降级**，但要记一笔", async () => {
    const calls: string[] = [];
    const spy = (async (u: string, init: RequestInit) => {
      const b = JSON.parse(init.body as string);
      if (b.max_tokens <= 8) { calls.push(u.includes("chat") ? "probe-chat" : "probe-msg"); return u.includes("chat") ? res403("Insufficient account balance") : res200({}); }
      calls.push(u.includes("chat") ? "gen-chat" : "gen-msg");
      return res200(okJson());
    }) as unknown as typeof fetch;
    const r = await buildPackResilient({
      recipe: recipe(), style: STYLE, outDir: tmp(), transport: { baseUrl: "http://x", apiKey: "k" },
      endpoints: ["chat-completions", "messages"], fetchImpl: spy,
    });
    expect(r.used).toBe("messages");
    expect(r.manifest.provenance.degradations).toEqual([]);          // ← 不是降级
    expect(r.manifest.provenance.transport!.switches).toHaveLength(1);
    expect(r.manifest.provenance.transport!.switches[0]).toMatchObject({ from: "chat-completions", to: "messages" });
    expect(calls).not.toContain("gen-chat");                         // 从没往死端点发过真生成请求
  });

  it("⚠️ 全部不可达 → 程序化兜底，包**仍然完全合法**", async () => {
    const r = await buildPackResilient({
      recipe: recipe(), style: STYLE, outDir: tmp(), transport: { baseUrl: "http://x", apiKey: "k" },
      fetchImpl: (async () => boom()) as unknown as typeof fetch,
    });
    expect(r.used).toBe("procedural");
    const p = parseAssetPack(r.manifest);
    expect(p.ok, p.ok ? "" : p.errors.join(" / ")).toBe(true);
    expect(r.audit).toEqual([]);                                     // 尺寸/帧数/动画名全对
    expect(r.manifest.provenance.degradations).toHaveLength(1);
    expect(r.manifest.provenance.degradations[0]).toMatchObject({ stage: "drawlist", fellBackTo: "procedural" });
    // 兜底产物仍然是色板内的（programmatic 只用 palette:N）
    expect(r.manifest.palette.coverage.unbound).toBe(0);
    expect(r.manifest.palette.coverage.exact).toBe(r.manifest.assets.length);
  });

  it("⚠️ 抖动先被**有界重试**吸收，重试也救不回来才降级", async () => {
    // 第一次生成失败 → 生成器自己重试一次 → 成功。**降级链不该被这种抖动惊动。**
    let transient = 0;
    const ok = await buildPackResilient({
      recipe: recipe(), style: STYLE, outDir: tmp(), transport: { baseUrl: "http://x", apiKey: "k" },
      fetchImpl: fetchBy(() => res200({}), () => { transient++; return transient === 1 ? boom() : res200(okJson()); }),
    });
    expect(ok.used).toBe("messages");
    expect(ok.manifest.provenance.degradations).toEqual([]);

    // 连着两次都失败（重试额度用完）⇒ 整包退到兜底
    let stuck = 0;
    const r = await buildPackResilient({
      recipe: recipe(), style: STYLE, outDir: tmp(), transport: { baseUrl: "http://x", apiKey: "k" },
      fetchImpl: fetchBy(() => res200({}), () => { stuck++; return stuck <= 2 ? boom() : res200(okJson()); }),
    });
    expect(r.used).toBe("procedural");                               // 第一层挂了 ⇒ 整包退到兜底
    expect(r.manifest.provenance.transport!.switches.some((s) => s.to === "procedural")).toBe(true);
    expect(parseAssetPack(r.manifest).ok).toBe(true);
  });

  it("离线模式：不探测、直接兜底", async () => {
    const r = await buildPackResilient({ recipe: recipe(), style: STYLE, outDir: tmp(), offline: true, transport: { baseUrl: "", apiKey: "" } });
    expect(r.used).toBe("procedural");
    expect(r.probes).toEqual([]);
    expect(parseAssetPack(r.manifest).ok).toBe(true);
  });

  it("失败的那次既不留工作目录、也不吃版本号", async () => {
    const out = tmp();
    await buildPackResilient({ recipe: recipe(), style: STYLE, outDir: out, transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl: (async () => boom()) as unknown as typeof fetch });
    const dirsOnDisk = readFileSync; // 占位，避免 lint 抱怨未用
    void dirsOnDisk;
    expect(r0(out)).toEqual(["v1"]);
  });
});
import { readdirSync } from "node:fs";
const r0 = (out: string) => readdirSync(path.join(out, FULL.id, "pack")).sort();

describe("程序化兜底生成器", () => {
  const spec: AssetSpec = FULL.assets.find((a) => a.spec.kind === "animation")!.spec;
  it("帧数与 spec 声明一致，尺寸与锚点来源一致", () => {
    const frames = proceduralGenerator(spec, STYLE);
    const want = spec.kind === "animation" ? spec.animations.reduce((s, a) => s + a.frames, 0) : 1;
    expect(frames).toHaveLength(want);
    for (const f of frames) {
      expect(f.viewBox).toEqual([0, 0, spec.size.w, spec.size.h]);
      expect(f.expectedSize).toEqual([spec.size.w, spec.size.h]);
    }
  });
  it("确定性：同一份 spec 两次得到同样的 ops", () => {
    expect(JSON.stringify(proceduralGenerator(spec, STYLE))).toBe(JSON.stringify(proceduralGenerator(spec, STYLE)));
  });
  it("只用色板引用，不含硬编码色 —— 所以兜底资源也是 exact", () => {
    for (const f of proceduralGenerator(spec, STYLE)) {
      expect(paletteBindingOf(f.ops)).toBe("exact");
      expect(JSON.stringify(f)).not.toMatch(/#[0-9a-fA-F]{6}/);
    }
  });
});

describe("explainDegradation —— 票 30 的义务：调用方必须看得见", () => {
  it("降级与传输切换分开说", async () => {
    const r = await buildPackResilient({ recipe: recipe(), style: STYLE, outDir: tmp(), offline: true, transport: { baseUrl: "", apiKey: "" } });
    const lines = explainDegradation(r.packDir);
    expect(lines.some((l) => /⚠️ 降级（drawlist）/.test(l))).toBe(true);
  });
  it("没降级时返回空数组", async () => {
    const r = await buildPackResilient({
      recipe: recipe(), style: STYLE, outDir: tmp(), transport: { baseUrl: "http://x", apiKey: "k" },
      fetchImpl: fetchBy(() => res200({}), () => res200(okJson())),
    });
    expect(explainDegradation(r.packDir)).toEqual([]);
  });
});
