import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AtlasJson, type AtlasJson as Atlas } from "../src/index.js";

/** v7 交付态四张图集 —— 正例用**真产物**，不用手搓的迷你 JSON。 */
const DELIVERY = fileURLToPath(new URL(
  "../../../.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/delivery/",
  import.meta.url
));

const ATLASES = [
  "atlas.animations.json",
  "atlas.backgrounds.json",
  "atlas.sprites.json",
  "atlas.ui.json"
] as const;

type RawRect = { x: number; y: number; w: number; h: number };
type RawFrame = {
  frame: RawRect;
  rotated?: boolean;
  trimmed?: boolean;
  spriteSourceSize: RawRect;
  sourceSize: { w: number; h: number };
  anchor?: { x: number; y: number };
  scale9Borders?: RawRect;
};
type RawAtlas = { frames: Record<string, RawFrame>; meta?: Record<string, unknown> };

const read = (name: (typeof ATLASES)[number]): RawAtlas =>
  JSON.parse(readFileSync(DELIVERY + name, "utf8")) as RawAtlas;

const BASE = "atlas.animations.json";

/** 每次变异都从一份合法的真图集深拷 —— 反例才有意义。 */
function valid(): RawAtlas {
  return structuredClone(AtlasJson.parse(read(BASE)) as Atlas);
}

const firstFrame = (doc: RawAtlas): RawFrame => doc.frames[Object.keys(doc.frames)[0]!]!;

function rejects(input: unknown, expected: RegExp): void {
  const r = AtlasJson.safeParse(input);
  expect(r.success, "本该被拒，却通过了").toBe(false);
  if (r.success) return;
  const messages = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  expect(messages).toMatch(expected);
}

describe("AtlasJson —— v7 四张图集必须通过", () => {
  for (const name of ATLASES) {
    it(`${name} 解析通过，帧键一个不少`, () => {
      const raw = read(name);
      const r = AtlasJson.safeParse(raw);
      expect(r.success, r.success ? "" : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" / ")).toBe(true);
      if (!r.success) return;
      expect(Object.keys(r.data.frames).sort()).toEqual(Object.keys(raw.frames).sort());
      expect(Object.keys(r.data.frames).length).toBeGreaterThan(0);
    });
  }

  it("animations 图集的 61 帧、anchors 与默认值都保留", () => {
    const r = AtlasJson.parse(read(BASE));
    expect(Object.keys(r.frames)).toHaveLength(61);
    expect(r.frames["scavenger-actor.idle1"]?.anchor).toEqual({ x: 0.5, y: 1 });
    expect(r.frames["scavenger-actor.idle1"]?.rotated).toBe(false);
    expect(r.frames["scavenger-actor.idle1"]?.trimmed).toBe(false);
  });

  it("ui 图集的 scale9Borders 被读出", () => {
    const r = AtlasJson.parse(read("atlas.ui.json"));
    expect(r.frames["hud-panel"]?.scale9Borders).toEqual({ x: 8, y: 8, w: 32, h: 32 });
  });

  it("省略 rotated / trimmed 时默认 false", () => {
    const doc = valid();
    Reflect.deleteProperty(firstFrame(doc), "rotated");
    Reflect.deleteProperty(firstFrame(doc), "trimmed");
    const r = AtlasJson.safeParse(doc);
    expect(r.success).toBe(true);
    if (!r.success) return;
    const f = r.data.frames[Object.keys(doc.frames)[0]!];
    expect(f?.rotated).toBe(false);
    expect(f?.trimmed).toBe(false);
  });
});

describe("AtlasJson —— 坏图集必须被拒", () => {
  it("缺 frame 字段", () => {
    const doc = valid();
    Reflect.deleteProperty(firstFrame(doc), "frame");
    rejects(doc, /frame.*Required|Required.*frame/);
  });

  it("缺 sourceSize 字段", () => {
    const doc = valid();
    Reflect.deleteProperty(firstFrame(doc), "sourceSize");
    rejects(doc, /sourceSize.*Required|Required.*sourceSize/);
  });

  it("帧宽为负", () => {
    const doc = valid();
    firstFrame(doc).frame.w = -1;
    rejects(doc, /frame\.w.*greater than 0/);
  });

  it("帧高为 0", () => {
    const doc = valid();
    firstFrame(doc).frame.h = 0;
    rejects(doc, /frame\.h.*greater than 0/);
  });

  it("spriteSourceSize 的 x 为负", () => {
    const doc = valid();
    firstFrame(doc).spriteSourceSize.x = -4;
    rejects(doc, /spriteSourceSize\.x.*greater than or equal to 0/);
  });

  it("类型错：frame.x 是字符串", () => {
    const doc = valid();
    Object.assign(firstFrame(doc).frame, { x: "0" });
    rejects(doc, /frame\.x.*Expected number/);
  });

  it("类型错：rotated 是字符串", () => {
    const doc = valid();
    Object.assign(firstFrame(doc), { rotated: "false" });
    rejects(doc, /rotated.*Expected boolean/);
  });

  it("未知的帧字段不被 .passthrough() 吞掉", () => {
    const doc = valid();
    Reflect.set(firstFrame(doc), "pivot", { x: 0, y: 0 });
    rejects(doc, /Unrecognized key/);
  });

  it("未知的顶层字段被拒（顶层 strict）", () => {
    const doc = valid();
    Reflect.set(doc, "textures", []);
    rejects(doc, /Unrecognized key/);
  });

  it("frames 必须是对象而不是数组", () => {
    rejects({ frames: [] }, /frames.*Expected object|Expected record/);
  });
});
