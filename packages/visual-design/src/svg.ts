// SVG 派生视图 + 最小白名单解析器（visual-design-impl-v1 票 03）。
//
// ⚠️ **SVG 是 VDS 的派生视图，不是第二个语义来源**（visual-design-v1 票 05 三岔裁定）：
//   `serializeVds` 只把 VDS 的 `bounds`/`fill`/`layer` 画成平涂 `<rect>`，语义（role/sourceIntent）
//   一律留在 VDS。确定性：排序全序（`layer` 升序）+ 唯一颜色解析（`paletteColor`）+ 整数坐标 ⇒
//   同一 VDS（+ 同一色板）逐字节同一 SVG。
//
// ⚠️ **白名单（机械判）**：元素 `<svg>/<g>/<rect>`；属性 `xmlns/width/height/viewBox`(svg) +
//   `id`(g) + `x/y/width/height/fill`(rect) = **10 个**。其余全拒 ⇒ PRD §6.3 的禁项
//   （JS / foreignObject / 外部引用 / 外部字体 / 动态内容）全部自动落在白名单外。
//
// ⚠️ **约束 #1（用户逐字）**：零依赖**不代表**用脆弱的字符串检查。`parseWhitelistedSvg` 是**字符级
//   状态机**，正确处理 XML 基本语法、属性解析（单/双引号、实体转义）、**重复属性**、**非法结构**；
//   不靠正则找 `<rect>` 和 `id`。
import { paletteColor, type VisualDesignSpec } from "@game-maker/contracts";

export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// ── 序列化 ─────────────────────────────────────────────────────────────────────

/** 属性值转义：`&` `<` `>` `"` → 实体（保证 id 含特殊字符时 SVG 仍是良构的）。 */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * VDS → SVG 字符串（确定性）。
 *
 * 顺序 = `layer` 升序（稳定排序，`layer` 相同保持 `objects[]` 数组序）；`layer` **不进**属性，
 * 它就是文档顺序本身。每个 object 画一个 `<g id>` 包一个 `<rect>`，`fill` 经 `paletteColor` 解析成 hex。
 *
 * @throws fill 越界（`palette:N` 的 N ≥ 色板长度）时抛错 —— 序列化无法从无效 fill 产出合法 SVG。
 */
export function serializeVds(vds: VisualDesignSpec, palette: readonly string[]): string {
  const sorted = [...vds.objects].sort((a, b) => a.layer - b.layer);
  const { w, h } = vds.viewport;
  const lines = [`<svg xmlns="${SVG_NAMESPACE}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`];
  for (const o of sorted) {
    const fill = paletteColor(o.fill, palette);
    if (fill === undefined) throw new Error(`fill "${o.fill}" 越界（色板长度 ${palette.length}）`);
    lines.push(
      `  <g id="${escapeAttr(o.id)}"><rect x="${o.bounds.x}" y="${o.bounds.y}" width="${o.bounds.w}" height="${o.bounds.h}" fill="${fill}"/></g>`,
    );
  }
  lines.push("</svg>");
  return lines.join("\n") + "\n";
}

// ── 最小白名单解析器 ───────────────────────────────────────────────────────────

export interface ParsedSvgRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

export interface ParsedSvg {
  viewport: { w: number; h: number };
  rects: ParsedSvgRect[];
}

const ELEMENTS = new Set(["svg", "g", "rect"]);
const ATTRS_BY_ELEMENT: Readonly<Record<string, ReadonlySet<string>>> = {
  svg: new Set(["xmlns", "width", "height", "viewBox"]),
  g: new Set(["id"]),
  rect: new Set(["x", "y", "width", "height", "fill"]),
};

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const NUMERIC_ENTITY = /^#(\d+)|^#x([0-9a-fA-F]+)$/;

/** 解实体：`&amp;` 等 5 个命名实体 + `&#NNN;`/`&#xHHH;` 数字引用；未知实体 / 裸 `<` 一律拒。 */
function decodeEntities(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; ) {
    const c = raw[i]!;
    if (c !== "&") {
      if (c === "<") throw new Error("属性值里不允许 <");
      out += c;
      i++;
      continue;
    }
    const semi = raw.indexOf(";", i + 1);
    if (semi === -1) throw new Error(`未闭合的实体引用：${raw.slice(i)}`);
    const entity = raw.slice(i + 1, semi);
    if (entity in NAMED_ENTITIES) { out += NAMED_ENTITIES[entity]!; i = semi + 1; continue; }
    const num = NUMERIC_ENTITY.exec(entity);
    if (num) {
      const cp = num[1] ? Number.parseInt(num[1], 10) : Number.parseInt(num[2]!, 16);
      if (cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) throw new Error(`非法字符引用 &#${entity};`);
      out += String.fromCodePoint(cp);
      i = semi + 1;
      continue;
    }
    throw new Error(`未知实体 &${entity};`);
  }
  return out;
}

const isWs = (c: string | undefined): boolean => c === " " || c === "\t" || c === "\n" || c === "\r";
const isNameChar = (c: string): boolean => /[A-Za-z0-9_.:-]/.test(c);

/** 解析一个白名单 SVG。⻓度不设上限，只收 `<svg>`（根）→ `<g id>` → `<rect/>` 这一种结构。 */
export function parseWhitelistedSvg(svg: string): ParsedSvg {
  let i = 0;
  const s = svg;
  const err = (msg: string): never => { throw new Error(`SVG 解析失败（偏移 ${i}）：${msg}`); };

  const skipWs = () => { while (i < s.length && isWs(s[i])) i++; };
  const name = (): string => {
    const start = i;
    while (i < s.length && isNameChar(s[i]!)) i++;
    if (i === start) err("期望名称");
    return s.slice(start, i);
  };
  const expect = (c: string) => { if (s[i] !== c) err(`期望 "${c}"`); i++; };

  /** 解析一组属性，直到 `>`（或 `/>` 前的 `/`）。白名单外 / 重复属性 / 值未加引号 / 裸 `<` 都拒。 */
  const attrs = (allowed: ReadonlySet<string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (;;) {
      skipWs();
      if (s[i] === ">" || s[i] === "/") break;
      const n = name();
      if (!allowed.has(n)) err(`属性 "${n}" 不在白名单`);
      if (n in out) err(`重复属性 "${n}"`);
      skipWs();
      expect("=");
      skipWs();
      const q = s[i];
      if (q !== '"' && q !== "'") err("属性值必须加引号");
      i++;
      const vStart = i;
      while (i < s.length && s[i] !== q) i++;
      if (i >= s.length) err("属性值未闭合");
      const raw = s.slice(vStart, i);
      i++; // 右引号
      out[n] = decodeEntities(raw);
    }
    return out;
  };

  /** 解析开标签。进入时 `s[i] === '<'`。返回属性 + 是否自闭合。 */
  const openTag = (expectedTag: string, allowed: ReadonlySet<string>) => {
    i++; // '<'
    const tag = name();
    if (tag !== expectedTag) err(`期望 "<${expectedTag}>"，遇到 "<${tag}>"`);
    const a = attrs(allowed);
    skipWs();
    if (s[i] === "/") { i++; expect(">"); return { attrs: a, selfClosing: true }; }
    expect(">");
    return { attrs: a, selfClosing: false };
  };

  const closeTag = (expectedTag: string) => {
    expect("<"); expect("/");
    const tag = name();
    if (tag !== expectedTag) err(`期望 "</${expectedTag}>"，遇到 "</${tag}>"`);
    skipWs();
    expect(">");
  };

  const int = (raw: string | undefined): number | undefined => {
    if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
    return Number.parseInt(raw, 10);
  };

  // ── 顶层：恰好一个 `<svg>` 根 ──
  skipWs();
  if (i >= s.length) err("空文档");
  const root = openTag("svg", ATTRS_BY_ELEMENT.svg!);
  if (root.selfClosing) err("svg 不能自闭合（须含 <g>）");
  if (root.attrs.xmlns !== SVG_NAMESPACE) err(`xmlns 必须是 "${SVG_NAMESPACE}"`);
  const w = int(root.attrs.width);
  const h = int(root.attrs.height);
  if (w === undefined || w <= 0) err("svg 缺合法的 width（正整数）");
  if (h === undefined || h <= 0) err("svg 缺合法的 height（正整数）");
  if (root.attrs.viewBox !== undefined && !/^\d+\s+\d+\s+\d+\s+\d+$/.test(root.attrs.viewBox)) err("viewBox 必须是 4 个整数");

  // ── 内容：零或多个 `<g id>`，每个含恰一个 `<rect/>` ──
  const rects: ParsedSvgRect[] = [];
  for (;;) {
    skipWs();
    if (i >= s.length) err("文档未闭合（缺 </svg>）");
    if (s[i] === "<" && s[i + 1] === "/") break; // </svg>
    if (s[i] !== "<") err("svg 内只允许空白或 <g>");
    const g = openTag("g", ATTRS_BY_ELEMENT.g!);
    if (g.selfClosing) err("<g> 不能自闭合（须含一个 <rect>）");
    const id = g.attrs.id;
    if (id === undefined || id.length === 0) err("<g> 缺 id");

    skipWs();
    if (s[i] !== "<") err("<g> 内只允许一个 <rect>");
    const r = openTag("rect", ATTRS_BY_ELEMENT.rect!);
    if (!r.selfClosing) err("<rect> 必须自闭合");
    const x = int(r.attrs.x);
    const y = int(r.attrs.y);
    const rw = int(r.attrs.width);
    const rh = int(r.attrs.height);
    const fill = r.attrs.fill ?? "";
    if (x === undefined) err("<rect> 缺合法的 x（非负整数）");
    if (y === undefined) err("<rect> 缺合法的 y（非负整数）");
    if (rw === undefined || rw <= 0) err("<rect> 缺合法的 width（正整数）");
    if (rh === undefined || rh <= 0) err("<rect> 缺合法的 height（正整数）");
    if (!/^#[0-9a-fA-F]{6}$/.test(fill)) err(`<rect> fill 必须是 #rrggbb，收到 "${fill}"`);
    rects.push({ id: id!, x: x!, y: y!, width: rw!, height: rh!, fill });

    skipWs();
    if (s[i] === "<" && s[i + 1] !== "/") err("<g> 内只能有一个 <rect>");
    closeTag("g");
  }
  closeTag("svg");

  skipWs();
  if (i !== s.length) err("根元素之后有多余内容");

  return { viewport: { w: w!, h: h! }, rects };
}
