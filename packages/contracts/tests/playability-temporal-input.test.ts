// I-01：可信 Atlas 输入 + 双档 lag 编排的测试矩阵。
//
// ⚠️ 这是 I01-06 的 65 条矩阵（T-01～T-65）。夹具**零新增**：正向只读真包
//   `fixtures/packs/last-train/v2`；负向在内存里改 JSON，并把 `files[]` 重绑到
//   改后字节的真实 sha256 —— 否则所有负向都会先撞 checksum mismatch，几何失败码
//   永远得不到执行（测试会假绿）。
// ⚠️ 测试文件可以用 `node:fs` / `node:crypto`；架构扫描只扫 `packages/contracts/src/**`。
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import { parseAssetPack, type AssetPackManifest } from "../src/assetpack.js";
import { parseGameConfig, type GameConfig } from "../src/game-config.js";
import {
  auditPlayabilityTemporal, resolveTwoLagResults, stubTemporalAnalyzer,
  TEMPORAL_LAG_BASELINE_MS, TEMPORAL_LAG_MS, temporalScope,
  type TemporalAnalyzer, type TemporalAuditResult,
} from "../src/playability/temporal.js";
import {
  isTrustedAtlasInput, verifyTemporalInput,
  type TemporalInputFailure, type TemporalInputResult, type VerifyTemporalInputInput, type TrustedAtlasInput,
} from "../src/playability/temporal-input.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const ANIMATIONS = "delivery/atlas.animations.json";
const SPRITES = "delivery/atlas.sprites.json";
const MANIFEST_RAW = JSON.parse(fs.readFileSync(path.join(PACK, "manifest.json"), "utf8")) as Record<string, unknown>;

const parseManifest = (raw: unknown): AssetPackManifest => {
  const parsed = parseAssetPack(raw);
  if (!parsed.ok) throw new Error("manifest fixture：" + parsed.errors.join("；"));
  return parsed.value;
};
const parseConfig = (raw: unknown): GameConfig => {
  const parsed = parseGameConfig(raw);
  if (!parsed.ok) throw new Error("config fixture：" + parsed.errors.join("；"));
  return parsed.value;
};

const MANIFEST = parseManifest(MANIFEST_RAW);
const CONFIG = parseConfig(JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/game-configs/last-train.json"), "utf8")));
const SCOPED_ASSETS = temporalScope(CONFIG).assetIds;

const sha = (bytes: Uint8Array): string => "sha256:" + createHash("sha256").update(bytes).digest("hex");
const readBytes = (rel: string): Uint8Array => fs.readFileSync(path.join(PACK, rel));
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const atlasOf = (rel: string): any => JSON.parse(decode(readBytes(rel)));
const bytesOf = (json: unknown): Uint8Array => Buffer.from(JSON.stringify(json));
const baseAtlases = (): VerifyTemporalInputInput["atlases"] => [
  { path: ANIMATIONS, bytes: readBytes(ANIMATIONS) },
  { path: SPRITES, bytes: readBytes(SPRITES) },
];

/** 改 JSON 字节，并把 manifest 的 files[] 重绑到改后字节的真实 sha256。 */
const manifestFor = (
  entries: readonly (readonly [string, Uint8Array])[],
  mutate?: (raw: any) => void,
): AssetPackManifest => {
  const raw = structuredClone(MANIFEST_RAW) as any;
  mutate?.(raw);
  for (const [rel, bytes] of entries) {
    const file = (raw.files as any[]).find((f) => f.path === rel);
    if (file === undefined) throw new Error(`manifest files[] 没有 ${rel}`);
    file.checksum = sha(bytes);
    file.bytes = bytes.byteLength;
  }
  return parseManifest(raw);
};

const mutateAtlas = (rel: string, mutate: (json: any) => void): Uint8Array => {
  const json = atlasOf(rel);
  mutate(json);
  return bytesOf(json);
};

const verify = (over: Partial<VerifyTemporalInputInput> = {}): TemporalInputResult =>
  verifyTemporalInput({
    manifest: MANIFEST,
    assetIds: SCOPED_ASSETS,
    atlases: baseAtlases(),
    digest: sha,
    ...over,
  });

const valueOf = (result: TemporalInputResult): TrustedAtlasInput => {
  if (!result.ok) throw new Error("expected ok，实际失败：" + JSON.stringify(result.failures));
  return result.value;
};
const failuresOf = (result: TemporalInputResult): readonly TemporalInputFailure[] => {
  if (result.ok) throw new Error("expected failures，实际 ok");
  return result.failures;
};
const codesOf = (result: TemporalInputResult): string[] => failuresOf(result).map((f) => f.code);
const trusted = (): TrustedAtlasInput => valueOf(verify());

const configWithoutMotion = (): GameConfig => {
  const c = structuredClone(CONFIG);
  const carriage = c.entities.find((e) => e.id === "carriage")!;
  delete (carriage as { motion?: unknown }).motion;
  return c;
};

const tempDirs: string[] = [];
afterAll(() => { for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true }); });

const spyOf = (result: TemporalAuditResult): TemporalAnalyzer => vi.fn(() => result);

// ─────────────────────────────────────────────────────────────────────────────
describe("A. 正向与验证范围", () => {
  it("T-01 正常 Atlas 读取与 SHA 校验", () => {
    const value = valueOf(verify());
    expect(value.frames.size).toBe(15);
    expect([...value.assets].sort()).toEqual([...SCOPED_ASSETS].sort());
    expect(value.files.map((f) => f.path)).toEqual([ANIMATIONS, SPRITES]);
    expect(value.files.find((f) => f.path === ANIMATIONS)!.checksum)
      .toBe((MANIFEST_RAW.files as any[]).find((f) => f.path === ANIMATIONS)!.checksum);
    expect(value.frames.get("player-traveler/player-traveler.idle1")!.anchor).toEqual({ x: 0.5, y: 0.95 });
    expect(value.frames.get("player-traveler/player-traveler.idle1")!.atlasId).toBe("animations");
  });

  it("T-02 范围只含 player + 引用 hazard/pickup/goal", () => {
    const value = valueOf(verify());
    const ids = new Set(SCOPED_ASSETS);
    for (const frame of value.frames.values()) expect(ids.has(frame.assetId)).toBe(true);
    expect([...value.frames.keys()].some((k) => k.startsWith("bg-dusk-halt/"))).toBe(false);
    expect([...value.frames.keys()].some((k) => k.startsWith("hud-"))).toBe(false);
  });

  it("T-03 多资产共用 atlas 去重", () => {
    const value = valueOf(verify());
    expect(value.files).toHaveLength(2);
    expect(value.files.filter((f) => f.path === ANIMATIONS)).toHaveLength(1);
  });

  it("T-04 未引用资产损坏不影响", () => {
    const atlases = [...baseAtlases(), { path: "delivery/atlas.backgrounds.json", bytes: Buffer.from("{bad") }];
    expect(valueOf(verify({ atlases })).files).toHaveLength(2);
  });

  it("T-05 引用资产缺失", () => {
    const result = verify({ assetIds: [...SCOPED_ASSETS, "ghost-asset"] });
    expect(failuresOf(result)).toContainEqual(expect.objectContaining({ code: "asset-unverified", assetId: "ghost-asset" }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("B. 文件、checksum 与 schema", () => {
  it("T-06 文件缺失", () => {
    const result = verify({ atlases: [{ path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(failuresOf(result)).toContainEqual(expect.objectContaining({ code: "atlas-file-missing", atlasPath: ANIMATIONS }));
  });

  it("T-07 SHA 不符", () => {
    const result = verify({ digest: () => "sha256:" + "0".repeat(64) });
    const failures = failuresOf(result);
    expect(failures).toHaveLength(2);
    expect(failures.every((f) => f.code === "atlas-checksum-mismatch")).toBe(true);
  });

  it("T-08 JSON 无效", () => {
    const bad = Buffer.from("{ 这不是 JSON");
    const result = verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(codesOf(result)).toEqual(["atlas-json-invalid"]);
  });

  it("T-09 顶层多余字段", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => { json.extra = true; });
    const result = verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(codesOf(result)).toEqual(["atlas-json-invalid"]);
  });

  it("T-10 PNG checksum 不参与 JSON 校验", () => {
    const manifest = manifestFor([[ANIMATIONS, readBytes(ANIMATIONS)]], (raw) => {
      raw.atlases.find((a: any) => a.id === "animations").checksum = "sha256:" + "1".repeat(64);
    });
    expect(valueOf(verify({ manifest })).files).toHaveLength(2);
  });

  it("T-11 同一路径两份不同字节", () => {
    const other = Buffer.from(decode(readBytes(ANIMATIONS)) + "\n");
    const result = verify({ atlases: [{ path: ANIMATIONS, bytes: readBytes(ANIMATIONS) }, { path: ANIMATIONS, bytes: other }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(codesOf(result)).toEqual(["atlas-checksum-mismatch"]);
  });

  it("T-12 meta 路径逃逸", () => {
    const raw = structuredClone(MANIFEST_RAW) as any;
    raw.atlases.find((a: any) => a.id === "animations").meta = "../atlas.json";
    expect(parseAssetPack(raw).ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("C. 逐帧几何", () => {
  const frame = (rel: string, name: string): any => atlasOf(rel).frames[name];

  it("T-13 帧缺失", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => { delete json.frames["hazard-sweeping-carriage.sweep2"]; });
    const result = verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(failuresOf(result)).toContainEqual(expect.objectContaining({
      code: "frame-missing", assetId: "hazard-sweeping-carriage", frameName: "hazard-sweeping-carriage.sweep2",
    }));
  });

  it("T-14 sourceSize 不符（单帧）", () => {
    const bad = mutateAtlas(SPRITES, (json) => { json.frames["pickup-suitcase"].sourceSize.w += 1; });
    const result = verify({ manifest: manifestFor([[SPRITES, bad]]), atlases: [{ path: ANIMATIONS, bytes: readBytes(ANIMATIONS) }, { path: SPRITES, bytes: bad }] });
    expect(codesOf(result)).toEqual(["frame-source-size-mismatch"]);
  });

  it("T-15 sourceSize 不符（多帧第 2 帧）", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => { json.frames["hazard-sweeping-carriage.sweep2"].sourceSize.h += 1; });
    const result = verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(failuresOf(result)).toContainEqual(expect.objectContaining({ code: "frame-source-size-mismatch", frameName: "hazard-sweeping-carriage.sweep2" }));
  });

  it("T-16 anchor 缺失", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => { delete json.frames["player-traveler.idle1"].anchor; });
    const result = verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(codesOf(result)).toEqual(["frame-anchor-missing"]);
  });

  it("T-17 anchor 不符", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => { json.frames["player-traveler.idle1"].anchor.x += 0.01; });
    const result = verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(codesOf(result)).toEqual(["frame-anchor-mismatch"]);
  });

  it("T-18 anchor 容差内", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => { json.frames["player-traveler.idle1"].anchor.x += 5e-10; });
    expect(valueOf(verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] })).frames.size).toBe(15);
  });

  it("T-19 anchor 容差外", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => { json.frames["player-traveler.idle1"].anchor.x += 2e-9; });
    const result = verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(codesOf(result)).toEqual(["frame-anchor-mismatch"]);
  });

  it("T-20 rotated: true", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => { json.frames["player-traveler.idle1"].rotated = true; });
    const result = verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(codesOf(result)).toEqual(["frame-rotated-unsupported"]);
  });

  it("T-21 trimmed: true", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => { json.frames["player-traveler.idle1"].trimmed = true; });
    const result = verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(codesOf(result)).toEqual(["frame-trimmed-unsupported"]);
  });

  it("T-22 rotated/trimmed 省略 ⇒ 默认 false", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => {
      const f = json.frames["player-traveler.idle1"];
      delete f.rotated; delete f.trimmed;
    });
    expect(valueOf(verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] })).frames.size).toBe(15);
    expect(frame(ANIMATIONS, "player-traveler.idle1").rotated).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("D. 累积、去重与全有或全无", () => {
  it("T-23 多失败累积并按 (code, atlasPath, assetId, frameName) 排序", () => {
    const anim = mutateAtlas(ANIMATIONS, (json) => {
      json.frames["hazard-sweeping-carriage.sweep2"].sourceSize.h += 1;
      json.frames["signal-endlight.red1"].anchor.x += 0.01;
    });
    const sprite = mutateAtlas(SPRITES, (json) => { delete json.frames["pickup-suitcase"]; });
    const manifest = manifestFor([[ANIMATIONS, anim], [SPRITES, sprite]]);
    const result = verify({ manifest, atlases: [{ path: ANIMATIONS, bytes: anim }, { path: SPRITES, bytes: sprite }] });
    expect(codesOf(result)).toEqual(["frame-anchor-mismatch", "frame-missing", "frame-source-size-mismatch"]);
  });

  it("T-24 全有或全无", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => { delete json.frames["player-traveler.idle1"]; });
    const result = verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(result.ok).toBe(false);
    expect("value" in result).toBe(false);
  });

  it("T-25 同一帧同时 sourceSize + anchor 错 ⇒ 两个 code 各一条", () => {
    const bad = mutateAtlas(ANIMATIONS, (json) => {
      json.frames["player-traveler.idle1"].sourceSize.w += 1;
      json.frames["player-traveler.idle1"].anchor.x += 0.01;
    });
    const result = verify({ manifest: manifestFor([[ANIMATIONS, bad]]), atlases: [{ path: ANIMATIONS, bytes: bad }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(codesOf(result)).toEqual(["frame-anchor-mismatch", "frame-source-size-mismatch"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("E. TOCTOU 与纯函数边界", () => {
  it("T-26 digest 与解析消费同一份字节对象", () => {
    const anim = readBytes(ANIMATIONS);
    const sprite = readBytes(SPRITES);
    const spy = vi.fn((bytes: Uint8Array) => sha(bytes));
    expect(valueOf(verifyTemporalInput({
      manifest: MANIFEST, assetIds: SCOPED_ASSETS,
      atlases: [{ path: ANIMATIONS, bytes: anim }, { path: SPRITES, bytes: sprite }],
      digest: spy,
    })).files).toHaveLength(2);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0]![0]).toBe(anim);
    expect(spy.mock.calls[1]![0]).toBe(sprite);
  });

  it("T-27 不访问磁盘：路径不存在但提供了字节", () => {
    const fakePath = "delivery/atlas.does-not-exist.json";
    const raw = structuredClone(MANIFEST_RAW) as any;
    raw.atlases.find((a: any) => a.id === "animations").meta = fakePath;
    const file = (raw.files as any[]).find((f) => f.path === ANIMATIONS);
    file.path = fakePath;
    const manifest = parseManifest(raw);
    const anim = readBytes(ANIMATIONS);
    expect(valueOf(verify({ manifest, atlases: [{ path: fakePath, bytes: anim }, { path: SPRITES, bytes: readBytes(SPRITES) }] })).files).toHaveLength(2);
  });

  it("T-28 文件替换：旧字节 + 旧 digest ⇒ 仍通过", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-temporal-"));
    tempDirs.push(d);
    const p = path.join(d, "atlas.json");
    const a = readBytes(ANIMATIONS);
    fs.writeFileSync(p, a);
    const bytesA = fs.readFileSync(p);
    fs.writeFileSync(p, Buffer.from(decode(a) + "\n"));
    expect(valueOf(verify({ atlases: [{ path: ANIMATIONS, bytes: bytesA }, { path: SPRITES, bytes: readBytes(SPRITES) }] })).files).toHaveLength(2);
  });

  it("T-29 文件替换：新字节 + 旧 digest ⇒ checksum mismatch", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-temporal-"));
    tempDirs.push(d);
    const p = path.join(d, "atlas.json");
    const a = readBytes(ANIMATIONS);
    fs.writeFileSync(p, a);
    fs.writeFileSync(p, Buffer.from(decode(a) + "\n"));
    const bytesB = fs.readFileSync(p);
    const result = verify({ atlases: [{ path: ANIMATIONS, bytes: bytesB }, { path: SPRITES, bytes: readBytes(SPRITES) }] });
    expect(failuresOf(result)).toContainEqual(expect.objectContaining({ code: "atlas-checksum-mismatch", atlasPath: ANIMATIONS }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("F. brand 与伪造声明", () => {
  it("T-30 普通对象冒充 ⇒ false", () => {
    expect(isTrustedAtlasInput({ frames: new Map(), assets: new Set(), files: [] })).toBe(false);
  });

  it("T-31 同名 Symbol 冒充 ⇒ false", () => {
    expect(isTrustedAtlasInput({ [Symbol("game-maker.trusted-atlas-input")]: true, frames: new Map(), assets: new Set(), files: [] })).toBe(false);
    expect(isTrustedAtlasInput({ [Symbol.for("game-maker.trusted-atlas-input")]: true, frames: new Map(), assets: new Set(), files: [] })).toBe(false);
  });

  it("T-32 structuredClone 丢失 brand ⇒ false", () => {
    expect(isTrustedAtlasInput(structuredClone(trusted()))).toBe(false);
  });

  it("T-33 真 brand ⇒ true", () => {
    expect(isTrustedAtlasInput(trusted())).toBe(true);
  });

  it("T-34 伪造 hitbox/body/尺寸/垂直规避 ⇒ IE，analyzer 不被调用", () => {
    const spy = spyOf({ applicable: true, verdict: "PROVEN_UNPLAYABLE" });
    const forged = {
      [Symbol.for("game-maker.trusted-atlas-input")]: true,
      frames: new Map(), assets: new Set(), files: [],
      hitbox: { w: 1, h: 1 }, body: { w: 999, h: 999 }, size: { w: 1, h: 1 }, verticalEvasionImpossible: true,
    };
    const result = auditPlayabilityTemporal(CONFIG, MANIFEST, {
      lagMs: TEMPORAL_LAG_MS, trustedInput: forged as unknown as TrustedAtlasInput, analyze: spy,
    });
    expect(result).toStrictEqual({ applicable: true, verdict: "INSUFFICIENT_EVIDENCE" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("T-35 阳性对照：真 brand + PU analyzer ⇒ PU", () => {
    const spy = spyOf({ applicable: true, verdict: "PROVEN_UNPLAYABLE" });
    expect(auditPlayabilityTemporal(CONFIG, MANIFEST, { lagMs: TEMPORAL_LAG_MS, trustedInput: trusted(), analyze: spy }))
      .toStrictEqual({ applicable: true, verdict: "PROVEN_UNPLAYABLE" });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("T-36 阳性对照：真 brand + NB analyzer ⇒ NB", () => {
    const spy = spyOf({ applicable: true, verdict: "NO_PROVEN_BLOCKER" });
    expect(auditPlayabilityTemporal(CONFIG, MANIFEST, { lagMs: TEMPORAL_LAG_MS, trustedInput: trusted(), analyze: spy }))
      .toStrictEqual({ applicable: true, verdict: "NO_PROVEN_BLOCKER" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G. lagMs 与两档降级", () => {
  it("T-37 lagMs 缺失 ⇒ IE + lag-invalid，analyzer 不被调用", () => {
    const spy = spyOf({ applicable: true, verdict: "NO_PROVEN_BLOCKER" });
    const result = auditPlayabilityTemporal(CONFIG, MANIFEST, {
      lagMs: undefined as unknown as number, trustedInput: trusted(), analyze: spy,
    });
    expect(result).toStrictEqual({ applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-invalid" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("T-38 null / 字符串 / NaN / ±Infinity / 负数 ⇒ IE + lag-invalid", () => {
    for (const bad of [null, "16.67", Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
      const spy = spyOf({ applicable: true, verdict: "NO_PROVEN_BLOCKER" });
      const result = auditPlayabilityTemporal(CONFIG, MANIFEST, {
        lagMs: bad as unknown as number, trustedInput: trusted(), analyze: spy,
      });
      expect(result).toStrictEqual({ applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-invalid" });
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("T-39 0 合法", () => {
    const spy = spyOf({ applicable: true, verdict: "NO_PROVEN_BLOCKER" });
    expect(auditPlayabilityTemporal(CONFIG, MANIFEST, { lagMs: 0, trustedInput: trusted(), analyze: spy }))
      .toStrictEqual({ applicable: true, verdict: "NO_PROVEN_BLOCKER" });
  });

  it("T-40 非法 lag 优先于适用性", () => {
    const spy = spyOf({ applicable: true, verdict: "NO_PROVEN_BLOCKER" });
    const result = auditPlayabilityTemporal(configWithoutMotion(), MANIFEST, {
      lagMs: Number.NaN, trustedInput: trusted(), analyze: spy,
    });
    expect(result).toStrictEqual({ applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-invalid" });
  });

  it("T-41 两档都不适用", () => {
    expect(resolveTwoLagResults({ applicable: false }, { applicable: false })).toStrictEqual({ applicable: false });
  });

  it("T-42 一档适用一档不适用", () => {
    expect(resolveTwoLagResults(
      { applicable: true, verdict: "INSUFFICIENT_EVIDENCE" },
      { applicable: false },
    )).toStrictEqual({ applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-disagreement" });
  });

  it("T-43 两档 verdict 相同 ⇒ 保留", () => {
    expect(resolveTwoLagResults(
      { applicable: true, verdict: "NO_PROVEN_BLOCKER" },
      { applicable: true, verdict: "NO_PROVEN_BLOCKER" },
    )).toStrictEqual({ applicable: true, verdict: "NO_PROVEN_BLOCKER" });
    expect(resolveTwoLagResults(
      { applicable: true, verdict: "INSUFFICIENT_EVIDENCE" },
      { applicable: true, verdict: "INSUFFICIENT_EVIDENCE" },
    )).toStrictEqual({ applicable: true, verdict: "INSUFFICIENT_EVIDENCE" });
  });

  it("T-44 两档 verdict 不同 ⇒ IE + lag-disagreement", () => {
    expect(resolveTwoLagResults(
      { applicable: true, verdict: "NO_PROVEN_BLOCKER" },
      { applicable: true, verdict: "PROVEN_UNPLAYABLE" },
    )).toStrictEqual({ applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-disagreement" });
  });

  it("T-45 lag-invalid 优先于 lag-disagreement", () => {
    expect(resolveTwoLagResults(
      { applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-invalid" },
      { applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-disagreement" },
    )).toStrictEqual({ applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-invalid" });
  });

  it("T-46 只比 verdict", () => {
    expect(resolveTwoLagResults(
      { applicable: true, verdict: "NO_PROVEN_BLOCKER" },
      { applicable: true, verdict: "NO_PROVEN_BLOCKER", degradation: undefined },
    )).toStrictEqual({ applicable: true, verdict: "NO_PROVEN_BLOCKER" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H. 适用性与范围", () => {
  it("T-47 无移动 Hazard ⇒ applicable false", () => {
    expect(temporalScope(configWithoutMotion()).applicable).toBe(false);
  });

  it("T-48 X 轴移动 Hazard ⇒ applicable true", () => {
    expect(temporalScope(CONFIG).applicable).toBe(true);
  });

  it("T-49 Y 轴移动 Hazard ⇒ applicable true，stub 返回 IE", () => {
    const c = structuredClone(CONFIG);
    c.entities.find((e) => e.id === "carriage")!.motion!.axis = "y";
    expect(temporalScope(c).applicable).toBe(true);
    expect(auditPlayabilityTemporal(c, MANIFEST, { lagMs: TEMPORAL_LAG_MS, trustedInput: trusted(), analyze: stubTemporalAnalyzer }))
      .toStrictEqual({ applicable: true, verdict: "INSUFFICIENT_EVIDENCE" });
  });

  it("T-50 多个移动 Hazard ⇒ applicable true，stub 返回 IE", () => {
    const c = structuredClone(CONFIG);
    const carriage = c.entities.find((e) => e.id === "carriage")!;
    c.entities.push({ ...structuredClone(carriage), id: "carriage-2" });
    expect(temporalScope(c).applicable).toBe(true);
    expect(auditPlayabilityTemporal(c, MANIFEST, { lagMs: TEMPORAL_LAG_MS, trustedInput: trusted(), analyze: stubTemporalAnalyzer }))
      .toStrictEqual({ applicable: true, verdict: "INSUFFICIENT_EVIDENCE" });
  });

  it("T-51 只有静止 Hazard ⇒ applicable false", () => {
    expect(temporalScope(configWithoutMotion()).applicable).toBe(false);
  });

  it("T-52 范围排除 solid / danger / chest / decor", () => {
    const c = structuredClone(CONFIG);
    c.entities.push(
      { id: "extra-solid", kind: "solid", at: { x: 10, y: 200 }, asset: "prop-luggage-pile" },
      { id: "extra-danger", kind: "danger", at: { x: 20, y: 200 }, asset: "prop-awning-steps", strike: { periodMs: 1000, activeMs: 100 } },
      { id: "extra-chest", kind: "chest", at: { x: 30, y: 200 }, asset: "prop-luggage-pile" },
      { id: "extra-decor", kind: "decor", at: { x: 40, y: 200 }, asset: "prop-luggage-pile" },
    );
    const ids = temporalScope(c).assetIds;
    expect(ids).not.toContain("prop-luggage-pile");
    expect(ids).not.toContain("prop-awning-steps");
  });

  it("T-53 去重与稳定排序", () => {
    const c = structuredClone(CONFIG);
    c.entities.push({ id: "pickup-2", kind: "pickup", at: { x: 50, y: 200 }, asset: "pickup-suitcase" });
    const ids = temporalScope(c).assetIds;
    expect(ids.filter((id) => id === "pickup-suitcase")).toHaveLength(1);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });

  it("T-54 stub 永不 PU / NB", () => {
    const c = structuredClone(CONFIG);
    c.entities.find((e) => e.id === "carriage")!.motion!.axis = "y";
    for (const config of [CONFIG, c]) {
      expect(stubTemporalAnalyzer({ config, manifest: MANIFEST, lagMs: TEMPORAL_LAG_MS, trustedInput: trusted() }))
        .toStrictEqual({ applicable: true, verdict: "INSUFFICIENT_EVIDENCE" });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 架构扫描：结构 tripwire，不是行为证明。
const REL = (p: string): string => path.relative(ROOT, p).split(path.sep).join("/");
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  if (d.name === "node_modules" || d.name === "dist" || d.name === ".git") return [];
  const p = path.join(dir, d.name);
  return d.isDirectory() ? walk(p) : d.name.endsWith(".ts") ? [p] : [];
});
const PROD_SRC = walk(path.join(ROOT, "packages")).filter((p) => REL(p).includes("/src/"));
const SRC_TEXT = new Map(PROD_SRC.map((p) => [REL(p), fs.readFileSync(p, "utf8")] as const));
const textOf = (rel: string): string => {
  const text = SRC_TEXT.get(rel);
  if (text === undefined) throw new Error(`missing source ${rel}`);
  return text;
};
const extractBalanced = (source: string, start: number): string => {
  const open = source.indexOf("{", start);
  if (open < 0) throw new Error("missing {");
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") { depth--; if (depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error("unbalanced braces");
};
const extractFunction = (source: string, name: string): string => {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing function ${name}`);
  return extractBalanced(source, start);
};
const extractType = (source: string, name: string): string => {
  const start = source.indexOf(`export type ${name} = {`);
  if (start < 0) throw new Error(`missing type ${name}`);
  return extractBalanced(source, start);
};

describe("I. 架构与结构断言", () => {
  it("T-55 contracts 源码不含 node:fs / node:crypto", () => {
    for (const [rel, text] of SRC_TEXT) {
      if (!rel.startsWith("packages/contracts/src/")) continue;
      expect(text, rel).not.toMatch(/from\s+["'](?:node:)?(?:fs|crypto)["']/);
      expect(text, rel).not.toMatch(/require\s*\(\s*["'](?:node:)?(?:fs|crypto)["']\s*\)/);
    }
  });

  it("T-56 verifyTemporalInput 生产调用者只有 ops.ts", () => {
    expect(PROD_SRC.filter((p) => textOf(REL(p)).includes("verifyTemporalInput(")).map(REL).sort())
      .toEqual(["packages/assets/src/ops.ts", "packages/contracts/src/playability/temporal-input.ts"]);
  });

  it("T-57 auditPlayabilityTemporal 生产调用者只有 ops.ts", () => {
    expect(PROD_SRC.filter((p) => textOf(REL(p)).includes("auditPlayabilityTemporal(")).map(REL).sort())
      .toEqual(["packages/assets/src/ops.ts", "packages/contracts/src/playability/temporal.ts"]);
  });

  it("T-58 生产 analyze 实参只有 stubTemporalAnalyzer", () => {
    const hits = PROD_SRC
      .filter((p) => REL(p) !== "packages/contracts/src/playability/temporal.ts")
      .flatMap((p) => [...textOf(REL(p)).matchAll(/analyze:\s*([A-Za-z_$][\w$]*)/g)]
        .map((m) => ({ file: REL(p), value: m[1] })));
    expect(hits).toEqual([{ file: "packages/assets/src/ops.ts", value: "stubTemporalAnalyzer" }]);
    expect(textOf("packages/contracts/src/playability/temporal.ts")).toMatch(/export function stubTemporalAnalyzer\(/);
  });

  it("T-59 readTrustedAtlasInput 不是 export", () => {
    const ops = textOf("packages/assets/src/ops.ts");
    expect(ops).toMatch(/function readTrustedAtlasInput\(/);
    expect(ops).not.toMatch(/export\s+(?:async\s+)?function\s+readTrustedAtlasInput/);
    expect(ops).not.toMatch(/export\s+const\s+readTrustedAtlasInput/);
  });

  it("T-60 runTemporalAudit 与 assertPublishableQa 保持同步", () => {
    expect(textOf("packages/assets/src/ops.ts")).toMatch(/export function runTemporalAudit\(/);
    expect(textOf("packages/assets/src/ops.ts")).not.toMatch(/export async function runTemporalAudit\(/);
    expect(textOf("packages/pipeline/src/publish-gate.ts")).toMatch(/export function assertPublishableQa\(/);
    expect(textOf("packages/pipeline/src/publish-gate.ts")).not.toMatch(/export async function assertPublishableQa\(/);
  });

  it("T-61 三处生产接线各至少一次", () => {
    expect(PROD_SRC.filter((p) => /runTemporalAudit\s*\(/.test(textOf(REL(p)))).map(REL).sort())
      .toEqual(["packages/assets/src/ops.ts", "packages/pipeline/src/create-game.ts", "packages/pipeline/src/publish-gate.ts"]);
  });

  it("T-62 常量唯一且不复用 FRAME_MARGIN_MS", () => {
    expect(PROD_SRC.filter((p) => /export const TEMPORAL_LAG_MS\s*=/.test(textOf(REL(p)))).map(REL))
      .toEqual(["packages/contracts/src/playability/temporal.ts"]);
    expect(PROD_SRC.filter((p) => /export const TEMPORAL_LAG_BASELINE_MS\s*=/.test(textOf(REL(p)))).map(REL))
      .toEqual(["packages/contracts/src/playability/temporal.ts"]);
    expect(textOf("packages/contracts/src/playability/temporal.ts")).not.toContain("FRAME_MARGIN_MS");
    expect(textOf("packages/assets/src/ops.ts")).toContain("TEMPORAL_LAG_MS");
    expect(textOf("packages/assets/src/ops.ts")).toContain("TEMPORAL_LAG_BASELINE_MS");
    expect(TEMPORAL_LAG_MS).toBe(16.67);
    expect(TEMPORAL_LAG_BASELINE_MS).toBe(200);
  });

  it("T-63 lagMs 无默认值", () => {
    const fn = extractFunction(textOf("packages/contracts/src/playability/temporal.ts"), "auditPlayabilityTemporal");
    expect(fn).not.toMatch(/lagMs\s*=\s*[^,}\s]/);
  });

  it("T-64 brand Symbol 只在 temporal-input.ts 铸造", () => {
    expect(textOf("packages/contracts/src/playability/temporal-input.ts")).toContain("Symbol(");
    for (const [rel, text] of SRC_TEXT) {
      if (rel !== "packages/contracts/src/playability/temporal-input.ts") expect(text, rel).not.toContain("Symbol(");
    }
    expect([...SRC_TEXT.values()].some((t) => t.includes("mintTrustedAtlasInput"))).toBe(false);
  });

  it("T-65 入口没有几何 / 规避声明参数", () => {
    const forbidden = ["geometry", "hitbox", "body", "size", "vertical"];
    const verifyInput = extractType(textOf("packages/contracts/src/playability/temporal-input.ts"), "VerifyTemporalInputInput");
    for (const bad of forbidden) expect(verifyInput).not.toMatch(new RegExp(`\\b${bad}\\b`));
    const fn = extractFunction(textOf("packages/contracts/src/playability/temporal.ts"), "auditPlayabilityTemporal");
    const signature = fn.slice(0, fn.indexOf(": TemporalAuditResult"));
    for (const bad of forbidden) expect(signature).not.toMatch(new RegExp(`\\b${bad}\\b`));
  });
});
