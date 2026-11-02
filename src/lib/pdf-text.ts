/**
 * Minimalny odczyt tekstu z PDF-a — bez zależności, na potrzeby biletów (KOLEO: WeasyPrint, fonty CID
 * z mapą ToUnicode). Obsługuje: strumienie FlateDecode, strumienie obiektów (ObjStm), fonty z ToUnicode
 * (bfchar / bfrange), operatory tekstu Tj / TJ / ' / " i pozycję Tm / Td / TD / T* (podział na linie).
 * Nie jest ogólnym parserem PDF — czego nie zrozumie, po prostu pomija.
 * `inflate` podaje wywołujący: na serwerze zlib, w przeglądarce DecompressionStream.
 */

export type Inflate = (data: Uint8Array) => Promise<Uint8Array>;

type Obj = { dict: string; stream?: Uint8Array };

const latin1 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
};

/** Wszystkie obiekty pliku (też z ObjStm), strumienie już rozpakowane. */
async function readObjects(file: Uint8Array, inflate: Inflate) {
  const text = latin1(file);
  const objs = new Map<number, Obj>();
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    const end = text.indexOf("endobj", start);
    if (end < 0) break;
    const body = text.slice(start, end);
    const s = body.search(/stream\r?\n/);
    if (s < 0) {
      objs.set(Number(m[1]), { dict: body });
      continue;
    }
    const dict = body.slice(0, s);
    const dataStart = start + s + body.slice(s).match(/stream\r?\n/)![0].length;
    const len = Number(dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/)?.[1] ?? -1);
    const dataEnd = len >= 0 ? dataStart + len : text.indexOf("endstream", dataStart);
    let data: Uint8Array = file.subarray(dataStart, dataEnd);
    if (/\/FlateDecode/.test(dict)) {
      try {
        data = await inflate(data);
      } catch {
        continue;
      }
    }
    objs.set(Number(m[1]), { dict, stream: data });
    re.lastIndex = Math.max(re.lastIndex, dataEnd);
  }
  // Obiekty spakowane w strumieniach obiektów.
  for (const o of [...objs.values()]) {
    if (!o.stream || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const first = Number(o.dict.match(/\/First\s+(\d+)/)?.[1] ?? 0);
    const s = latin1(o.stream);
    const nums = s.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      const from = first + nums[i + 1];
      const to = i + 3 < nums.length ? first + nums[i + 3] : s.length;
      if (!objs.has(nums[i])) objs.set(nums[i], { dict: s.slice(from, to) });
    }
  }
  return objs;
}

const ref = (s: string | undefined) => (s ? Number(s.match(/(\d+)\s+\d+\s+R/)?.[1]) : NaN);

/** Wartość klucza słownika: odwołanie „12 0 R” albo słownik w miejscu „<< … >>” (z zagnieżdżeniami). */
function entry(dict: string, key: string, objs: Map<number, Obj>): string | null {
  const i = dict.search(new RegExp(`/${key}(?![A-Za-z0-9])`));
  if (i < 0) return null;
  const rest = dict.slice(i + key.length + 1).trimStart();
  if (rest.startsWith("<<")) {
    let depth = 0;
    for (let j = 0; j < rest.length; j++) {
      if (rest.startsWith("<<", j)) {
        depth++;
        j++;
      } else if (rest.startsWith(">>", j) && --depth === 0) return rest.slice(0, j + 2);
    }
    return rest;
  }
  const r = rest.match(/^(\d+)\s+\d+\s+R/);
  if (r) return objs.get(Number(r[1]))?.dict ?? null;
  return rest.match(/^\[[^\]]*\]|^\S+/)?.[0] ?? null;
}

/** Mapa ToUnicode: kod (hex) → tekst. */
function parseCMap(cmap: string) {
  const map = new Map<string, string>();
  const hexText = (h: string) => {
    let out = "";
    for (let i = 0; i + 4 <= h.length; i += 4) out += String.fromCharCode(parseInt(h.slice(i, i + 4), 16));
    return out;
  };
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const [, code, uni] of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(code.toLowerCase(), hexText(uni));
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const [, lo, hi, uni] of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const a = parseInt(lo, 16);
      const b = parseInt(hi, 16);
      const u = parseInt(uni, 16);
      for (let c = a; c <= b && c - a < 0x10000; c++) map.set(c.toString(16).padStart(lo.length, "0"), String.fromCharCode(u + c - a));
    }
  }
  return map;
}

type Font = { twoByte: boolean; map: Map<string, string> | null };

function fontsFor(page: string, objs: Map<number, Obj>) {
  const fonts = new Map<string, Font>();
  const resources = entry(page, "Resources", objs);
  const fontDict = resources ? entry(resources, "Font", objs) : null;
  if (!fontDict) return fonts;
  for (const [, name, num] of fontDict.matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)) {
    const f = objs.get(Number(num))?.dict ?? "";
    const tu = objs.get(ref(f.match(/\/ToUnicode\s+(\d+\s+\d+\s+R)/)?.[1]));
    fonts.set(name, { twoByte: /\/Type0/.test(f) || /Identity-H/.test(f), map: tu?.stream ? parseCMap(latin1(tu.stream)) : null });
  }
  return fonts;
}

/** Tokeny strumienia treści: liczby, nazwy, napisy (…) i <…>, tablice, operatory. */
function* tokens(s: string): Generator<string> {
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) i++;
    else if (c === "%") while (i < s.length && s[i] !== "\n") i++;
    else if (c === "(") {
      let depth = 0;
      let j = i;
      for (; j < s.length; j++) {
        if (s[j] === "\\") j++;
        else if (s[j] === "(") depth++;
        else if (s[j] === ")" && --depth === 0) break;
      }
      yield s.slice(i, j + 1);
      i = j + 1;
    } else if (c === "<" && s[i + 1] !== "<") {
      const j = s.indexOf(">", i);
      yield s.slice(i, j + 1);
      i = j + 1;
    } else if (c === "[" || c === "]") yield s[i++];
    else if (s.startsWith("<<", i) || s.startsWith(">>", i)) {
      yield s.slice(i, i + 2);
      i += 2;
    } else {
      const m = s.slice(i).match(/^\/?[^\s()<>[\]{}/%]+/);
      const t = m ? m[0] : c;
      yield t;
      i += t.length;
    }
  }
}

/** Napis z PDF (literal albo hex) → bajty. */
function stringBytes(t: string) {
  if (t.startsWith("<")) {
    const h = t.slice(1, -1).replace(/\s/g, "");
    return Uint8Array.from({ length: Math.ceil(h.length / 2) }, (_, k) => parseInt(h.slice(k * 2, k * 2 + 2).padEnd(2, "0"), 16));
  }
  const body = t.slice(1, -1);
  const out: number[] = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "\\") {
      out.push(body.charCodeAt(i) & 0xff);
      continue;
    }
    const n = body[++i];
    const esc: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 };
    if (n in esc) out.push(esc[n]);
    else if (/[0-7]/.test(n)) {
      const oct = body.slice(i).match(/^[0-7]{1,3}/)![0];
      out.push(parseInt(oct, 8));
      i += oct.length - 1;
    }
  }
  return Uint8Array.from(out);
}

function decode(t: string, font: Font | undefined) {
  const b = stringBytes(t);
  let out = "";
  const step = font?.twoByte ? 2 : 1;
  for (let i = 0; i < b.length; i += step) {
    const code = step === 2 ? ((b[i] << 8) | (b[i + 1] ?? 0)) : b[i];
    const key = code.toString(16).padStart(step * 2, "0");
    out += font?.map?.get(key) ?? (step === 1 ? String.fromCharCode(code) : "");
  }
  return out;
}

/** Tekst strony: fragmenty pogrupowane w linie po pozycji pionowej, w linii — od lewej. */
function pageText(content: string, fonts: Map<string, Font>) {
  const chunks: { x: number; y: number; text: string }[] = [];
  const stack: string[] = [];
  let font: Font | undefined;
  let leading = 0;
  // Pozycja początku linii (Tm / Td) — wystarcza do podziału na linie i kolejności w linii.
  let lx = 0;
  let ly = 0;
  for (const t of tokens(content)) {
    switch (t) {
      case "BT":
        lx = ly = 0;
        stack.length = 0;
        break;
      case "Tf":
        font = fonts.get(stack[stack.length - 2]?.slice(1));
        stack.length = 0;
        break;
      case "TL":
        leading = Number(stack.pop());
        stack.length = 0;
        break;
      case "Tm": {
        const [, , , , e, f] = stack.slice(-6).map(Number);
        lx = e;
        ly = f;
        stack.length = 0;
        break;
      }
      case "Td":
      case "TD": {
        const [tx, ty] = stack.slice(-2).map(Number);
        if (t === "TD") leading = -ty;
        lx += tx;
        ly += ty;
        stack.length = 0;
        break;
      }
      case "T*":
        ly -= leading;
        stack.length = 0;
        break;
      case "Tj":
      case "'":
      case '"': {
        if (t !== "Tj") ly -= leading;
        chunks.push({ x: lx, y: ly, text: decode(stack[stack.length - 1] ?? "()", font) });
        stack.length = 0;
        break;
      }
      case "TJ": {
        const open = stack.lastIndexOf("[");
        let text = "";
        for (const part of stack.slice(open + 1)) {
          if (part === "]") continue;
          if (part.startsWith("(") || part.startsWith("<")) text += decode(part, font);
          else if (Number(part) < -200) text += " "; // duży odstęp w TJ = spacja
        }
        chunks.push({ x: lx, y: ly, text });
        stack.length = 0;
        break;
      }
      default:
        if (/^[A-Za-z*'"]+$/.test(t) && !t.startsWith("/")) stack.length = 0;
        else stack.push(t);
    }
  }
  const lines: { y: number; parts: { x: number; text: string }[] }[] = [];
  for (const c of chunks) {
    if (!c.text.trim()) continue;
    const line = lines.find((l) => Math.abs(l.y - c.y) < 2);
    if (line) line.parts.push(c);
    else lines.push({ y: c.y, parts: [c] });
  }
  return lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.text.trim()).join(" ")).join("\n");
}

/** Tekst wszystkich stron PDF-a (linie oddzielone \n, strony pustą linią). */
export async function pdfText(file: Uint8Array, inflate: Inflate) {
  const objs = await readObjects(file, inflate);
  const pages = [...objs.values()].filter((o) => /\/Type\s*\/Page(?!s)/.test(o.dict));
  const out: string[] = [];
  for (const page of pages) {
    const fonts = fontsFor(page.dict, objs);
    const contents = entry(page.dict, "Contents", objs);
    const refs = [...(page.dict.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)?.[1] ?? "").matchAll(/(\d+)\s+\d+\s+R/g)].map((m) => Number(m[1]));
    const streams = refs.map((r) => objs.get(r)?.stream).filter((s): s is Uint8Array => !!s);
    if (!streams.length && contents) continue;
    out.push(pageText(streams.map(latin1).join("\n"), fonts));
  }
  return out.join("\n\n");
}

