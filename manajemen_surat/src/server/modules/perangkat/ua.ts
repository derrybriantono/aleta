/**
 * Pembaca user-agent untuk jejak masuk (23 Okt 2026) - tanpa dependensi.
 *
 * ============================================================================
 * BATAS YANG HARUS DIKETAHUI PEMBACA RIWAYAT
 * ============================================================================
 *
 * - Chrome/Edge MEMBEKUKAN "Windows NT 10.0": Windows 11 tampil sebagai
 *   Windows 10. Versi yang benar hanya terbaca lewat client hints, dan client
 *   hints hanya dikirim pada https - portal kantor berjalan di http. Ekstensi
 *   (konteks aman) mengirim versi rinci dari pekerja latarnya bila terpasang.
 * - Chrome Android menyembunyikan model HP ("Linux; Android 10; K"). Model
 *   hanya tampil bila UA-nya memang memuatnya (Samsung Internet, Firefox,
 *   peramban lama).
 * - macOS dibekukan pada 10_15_7 oleh semua peramban modern.
 * - iPad dengan "Desktop website" mengaku Macintosh; tanda sentuh tidak ada di
 *   UA, jadi ia tercatat sebagai Mac.
 */

export type JenisPerangkat = "komputer" | "hp" | "tablet" | "";

export type HasilUa = {
  jenis: JenisPerangkat;
  os: string;
  osVersi: string;
  peramban: string;
  perambanVersi: string;
  model: string;
};

function versi(teks: string | undefined) {
  return String(teks ?? "").replace(/_/g, ".").trim();
}

function versiUtama(teks: string) {
  return teks.split(".").slice(0, 2).join(".").replace(/\.0$/, "");
}

const WINDOWS_NT: Record<string, string> = {
  "10.0": "10/11",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
  "6.0": "Vista",
  "5.1": "XP",
};

function bacaOs(ua: string): { os: string; osVersi: string; model: string; tablet: boolean; hp: boolean } {
  let m: RegExpMatchArray | null;
  if ((m = ua.match(/Windows NT ([\d.]+)/))) {
    return { os: "Windows", osVersi: WINDOWS_NT[m[1]] ?? m[1], model: "", tablet: false, hp: false };
  }
  if ((m = ua.match(/\biPad\b.*?OS ([\d_]+)/))) {
    return { os: "iPadOS", osVersi: versi(m[1]), model: "iPad", tablet: true, hp: false };
  }
  if ((m = ua.match(/\biPhone\b.*?OS ([\d_]+)/))) {
    return { os: "iOS", osVersi: versi(m[1]), model: "iPhone", tablet: false, hp: true };
  }
  if ((m = ua.match(/Android ([\d.]+)(?:;\s*([^;)]+))?/))) {
    let model = String(m[2] ?? "").replace(/\s*Build\/.*$/, "").trim();
    // "K" = model disembunyikan Chrome; "wv" = WebView; "Mobile" = bukan model.
    if (/^(K|wv|Mobile|[a-z]{2}[-_][A-Z]{2})$/.test(model) || /^Linux$/i.test(model)) model = "";
    const tablet = !/Mobile/.test(ua);
    return { os: "Android", osVersi: versi(m[1]), model, tablet, hp: !tablet };
  }
  if ((m = ua.match(/CrOS \S+ ([\d.]+)/))) {
    return { os: "ChromeOS", osVersi: versiUtama(m[1]), model: "", tablet: false, hp: false };
  }
  if ((m = ua.match(/Mac OS X ([\d_.]+)/))) {
    return { os: "macOS", osVersi: versi(m[1]), model: "", tablet: false, hp: false };
  }
  if (/Linux/.test(ua)) return { os: "Linux", osVersi: "", model: "", tablet: false, hp: false };
  return { os: "", osVersi: "", model: "", tablet: false, hp: false };
}

function bacaPeramban(ua: string): { peramban: string; perambanVersi: string } {
  const urutan: Array<[string, RegExp]> = [
    ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
    ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ["Opera", /(?:OPR|OPiOS|Opera)\/([\d.]+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari\//],
  ];
  for (const [nama, pola] of urutan) {
    const m = ua.match(pola);
    if (m) return { peramban: nama, perambanVersi: versiUtama(m[1]) };
  }
  return { peramban: "", perambanVersi: "" };
}

export function bacaUa(agen: string | null | undefined): HasilUa {
  const ua = String(agen ?? "");
  if (!ua.trim()) return { jenis: "", os: "", osVersi: "", peramban: "", perambanVersi: "", model: "" };
  const o = bacaOs(ua);
  const p = bacaPeramban(ua);
  const jenis: JenisPerangkat = o.tablet ? "tablet" : o.hp ? "hp" : o.os ? "komputer" : "";
  return { jenis, os: o.os, osVersi: o.osVersi, peramban: p.peramban, perambanVersi: p.perambanVersi, model: o.model };
}

const LABEL_JENIS: Record<JenisPerangkat, string> = { komputer: "Komputer", hp: "HP", tablet: "Tablet", "": "" };

export function labelJenis(jenis: string) {
  return LABEL_JENIS[(jenis as JenisPerangkat) in LABEL_JENIS ? (jenis as JenisPerangkat) : ""] || "Tidak dikenal";
}

/** "Chrome 130 · Windows 10/11" / "Samsung Internet 26 · Android 14 (SM-A546E)". */
export function namaPerangkat(h: HasilUa) {
  const peramban = [h.peramban, h.perambanVersi].filter(Boolean).join(" ");
  const os = [h.os, h.osVersi].filter(Boolean).join(" ");
  const model = h.model && h.model !== "iPhone" && h.model !== "iPad" ? ` (${h.model})` : "";
  return [peramban, os + model].filter((x) => x.trim()).join(" · ") || "Perangkat tidak dikenal";
}
