// @vitest-environment node
/**
 * 21 OKT 2026 (rilis 1.205.25) - tuntutan "karena jabatan" dan rentang tanggal Blangko ABT by Derry.
 *
 * Temuan pengguna (blangko cerai akibat cerai lengkap, "tidak ada yang diminta, 6 tidak diminta"): hampir semua kartu tuntutan tetap
 * tampil dengan lencana "muncul karena ditetapkan karena jabatan". SEBAB: nilai yang dibaca dari jendela ABT adalah BAWAAN
 * (default_data) bila belum ada yang tersimpan - keputusan 4100-4105 = daftar semua pilihan, harta bersama = kerangka "2.1 ... _ m2",
 * nama anak = hitungan SIPP - lalu dianggap "keputusan sudah dipilih" / "sudah berisi".
 *
 *   A  keputusan dipilih hanya bila TEPAT SATU pilihan sah (boleh + ": alasan"); daftar pilihan bawaan bukan pilihan
 *   B  kerangka bawaan bukan "terisi"
 *   C  golongan tampil: tidak diminta + tanpa saklar = bagian "Tuntutan yang tidak diminta" (juga isian yang tertulis langsung)
 *   D  sebab lencana "muncul karena": hanya diminta petitum / saklar hakim / keputusan ex officio
 *   E  Pilih tanggal: satu tanggal cukup, terbalik ditukar, kosong bukan galat, bawaan selalu Sidang hari ini
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";

import { susunIsian, TUNTUTAN_CERAI, type ButirIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/lain/", runScripts: "outside-only" });
const w = dom.window as unknown as { eval: (s: string) => void; aletaBlangkoDerryIsian: any; aletaBlangkoDerry: any; chrome: unknown };
w.chrome = { storage: { local: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener() {} } }, runtime: { id: "uji" } };
const JS_ISIAN = readFileSync(path.join(EKSTENSI, "blangko-derry-isian.js"), "utf8");
const JS_DERRY = readFileSync(path.join(EKSTENSI, "blangko-derry.js"), "utf8");
w.eval(JS_DERRY);
w.eval(JS_ISIAN);
afterAll(() => dom.window.close());
const M = () => w.aletaBlangkoDerryIsian.murni;
const R = () => w.aletaBlangkoDerry.murni;

const FX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "tuntutan-sinkron-21okt.json"), "utf8")) as {
  blangko: Array<{ berkas: string; penandaAbt: string[] }>;
  katalog: Record<string, { nama: string; jenis: string; sql: string; bawaan: string }>;
};
const KATALOG = new Map<string, Definisi>(Object.entries(FX.katalog).map(([kode, d]) => [kode, { kode, ...d }]));
const blangko = (awal: string) => {
  const b = FX.blangko.find((x) => x.berkas.startsWith(awal));
  if (!b) throw new Error(`fixture tanpa ${awal}`);
  return b;
};
const CG01 = "1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap).rtf";
const CT_MI = "1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah";

const DAFTAR_KEP = "dikabulkan seluruhnya\ndikabulkan sebagian\nditolak\ntidak dapat diterima\ndiberikan secara ex officio (tidak dituntut)";
const EX = "diberikan secara ex officio (tidak dituntut)";
const KEP = (kode: string, pilihan = DAFTAR_KEP.split("\n")) => ({ kode, pilihan, bawaan: DAFTAR_KEP, saran: DAFTAR_KEP });

describe("A. keputusan dipilih = tepat satu pilihan sah", () => {
  it("daftar pilihan bawaan (bergabung / berbaris) BUKAN pilihan; kosong bukan pilihan", () => {
    const b = KEP("4102");
    expect(M().keputusanDipilihMurni(b, DAFTAR_KEP)).toBe(false);
    expect(M().keputusanDipilihMurni(b, DAFTAR_KEP.replace(/\n/g, " / "))).toBe(false);
    expect(M().keputusanDipilihMurni(b, "dikabulkan seluruhnya dikabulkan sebagian ditolak")).toBe(false);
    expect(M().keputusanDipilihMurni(b, "")).toBe(false);
    expect(M().daftarPilihanMurni(b, DAFTAR_KEP)).toBe(true);
    expect(M().daftarPilihanMurni(b, "ditolak")).toBe(false);
  });
  it("satu pilihan (juga + alasan sesudah titik dua; juga 4100-4105 tanpa daftar pilihan dari server) = dipilih", () => {
    const b = KEP("4103");
    for (const v of ["dikabulkan sebagian", "ditolak", "  Ditolak  ", "ditolak: istri terbukti nusyuz", EX]) expect(M().keputusanDipilihMurni(b, v), v).toBe(true);
    expect(M().keputusanDipilihMurni({ kode: "4103", pilihan: [] }, "tidak dapat diterima")).toBe(true);
    expect(M().keputusanDipilihMurni(b, "mungkin dikabulkan")).toBe(false);
  });
  it("hanya 'diberikan secara ex officio (tidak dituntut)' yang berarti karena jabatan", () => {
    expect(M().keputusanExOfficioMurni(EX)).toBe(true);
    expect(M().keputusanExOfficioMurni("ditolak")).toBe(false);
    expect(M().keputusanExOfficioMurni(DAFTAR_KEP)).toBe(false);
  });
});

describe("B. kerangka bawaan bukan terisi", () => {
  it("kerangka dengan _ / ..., daftar pilihan, bawaan itu sendiri, dan kosong", () => {
    const b = { kode: "8730", bawaan: "2.1 Sebidang tanah ... seluas _ m2 ...", saran: "", pilihan: [] };
    expect(M().kerangkaBawaanMurni(b, "2.1 Sebidang tanah ... seluas _ m2 terletak di ...")).toBe(true);
    expect(M().kerangkaBawaanMurni(b, "Sebidang tanah seluas _ m2")).toBe(true);
    expect(M().kerangkaBawaanMurni(b, "")).toBe(true);
    expect(M().kerangkaBawaanMurni(KEP("4100"), DAFTAR_KEP)).toBe(true);
    expect(M().kerangkaBawaanMurni({ kode: "9999", bawaan: "isi contoh", pilihan: [] }, "Isi  contoh")).toBe(true);
  });
  it("isian sungguhan tetap terisi", () => {
    const b = { kode: "6054", bawaan: "", saran: "", pilihan: [] };
    for (const v of ["Rp3.000.000,00", "sebidang tanah seluas 200 m2 di Jalan Mawar", "ex_officio_x"]) expect(M().kerangkaBawaanMurni(b, v), v).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// C. Golongan tampil - ctx meniru ctxGolongan() layar: keputusan dan terisiTuntutan memakai fungsi murni yang SAMA
// ----------------------------------------------------------------------------
type Keadaan = { menyala?: string[]; jabatan?: string[]; isi?: Record<string, string>; bawaanAbt?: Record<string, string> };
function golongan(awal: string, k: Keadaan = {}) {
  const b = blangko(awal);
  const s = susunIsian(b.penandaAbt.filter((x) => /^\d{3,5}$/.test(x)), KATALOG);
  const isi = k.isi || {};
  // Nilai di kotak = tersimpan petugas ATAU bawaan dari jendela ABT
  const nilai = (kode: string) => (isi[kode] !== undefined ? isi[kode] : (k.bawaanAbt || {})[kode] || "");
  const butir = (kode: string) => s.isian.find((x) => x.kode === kode) || { kode };
  const keputusan = (p: string) => {
    const kode = TUNTUTAN_CERAI.find((t) => t.pemicu === p)?.keputusan || "";
    return Boolean(M().keputusanDipilihMurni(butir(kode), nilai(kode)));
  };
  const ctx = {
    dikenal: (p: string) => TUNTUTAN_CERAI.some((t) => t.pemicu === p),
    perkara: { prodeo: false, ghaib: false, lewatEcourt: true, kuasaP: false, kuasaT: false },
    menyala: (p: string) => (k.menyala || []).includes(p),
    // bawaan ABT dihitung "terisi" oleh terisi() lama (itulah sebab galatnya) - terisiTuntutan tidak
    terisi: (x: ButirIsian) => Boolean(String(nilai(x.kode)).trim()),
    terisiTuntutan: (x: ButirIsian) => {
      const v = nilai(x.kode);
      if (M().kerangkaBawaanMurni(x, v)) return false;
      return x.pilihan.length ? M().keputusanDipilihMurni(x, v) : Object.prototype.hasOwnProperty.call(isi, x.kode);
    },
    jabatan: (p: string) => (k.jabatan || []).includes(p),
    keputusan,
    opsional: (x: ButirIsian) => Boolean(x.opsional),
    jenisCerai: b.berkas.startsWith("1a Perceraian CT") ? "ct" : "cg",
  };
  const g = new Map<string, string>(s.isian.map((x) => [x.kode, M().golonganIsianMurni(x, ctx) as string]));
  const utama = [...g.entries()].filter(([, v]) => v === "utama").map(([kode]) => kode);
  return { s, g, utama, ctx };
}
// Bawaan ABT yang dikembalikan jendela edit_data bila belum ada isian tersimpan (daftar pilihan, kerangka, nama anak hitungan SIPP)
const BAWAAN: Record<string, string> = {
  "4100": DAFTAR_KEP,
  "4101": DAFTAR_KEP,
  "4102": DAFTAR_KEP,
  "4103": DAFTAR_KEP,
  "4104": DAFTAR_KEP,
  "4105": DAFTAR_KEP,
  "4106": "belum mumayyiz (belum berumur 12 tahun)\nmumayyiz (berumur 12 tahun atau lebih)",
  "4109": "sebelum ikrar talak\nsebelum akta cerai\ntidak disyaratkan (istri tidak keberatan)",
  "8730": "2.1 Sebidang tanah ... seluas _ m2 terletak di ...",
  "8603": "Ahmad bin Budi",
  "4107": "wiraswasta",
  "4108": "...",
};
const TUNTUTAN_KODE = ["4100", "4101", "4102", "4103", "4104", "4105", "4106", "4107", "4108", "4109", "8730", "8603", "6054", "6055", "7120", "6071", "6072", "9050", "9740", "9741", "2004", "9711", "9712", "9713", "9715"];

describe("C. tidak diminta + tanpa saklar = bukan daftar utama, walau ABT memberi bawaan", () => {
  it("CG [01]: semua kartu tuntutan (keputusan 4100-4105, kini anak, mumayyiz, dasar kemampuan, waktu bayar, nama anak, harta bersama, kenaikan) = bagian tidak diminta", () => {
    const h = golongan(CG01, { bawaanAbt: BAWAAN });
    expect(h.g.has("4100") && h.g.has("8730") && h.g.has("4105")).toBe(true);
    for (const k of TUNTUTAN_KODE) if (h.g.has(k)) expect(["tuntutan", "lanjutan"], `${k}: ${h.g.get(k)}`).toContain(h.g.get(k));
    for (const k of ["4100", "4101", "4102", "4103", "4104", "4105", "8730", "8603", "4107", "4109"]) if (h.g.has(k)) expect(h.g.get(k), k).toBe("tuntutan");
    expect(h.utama.filter((k) => TUNTUTAN_KODE.includes(k))).toEqual([]);
  });

  it("blangko yang menulis isian tuntutan LANGSUNG (CT Mut'ah Iddah): tidak diminta = tetap bagian tidak diminta", () => {
    const h = golongan(CT_MI, { bawaanAbt: BAWAAN });
    expect(h.s.isian.find((x) => x.kode === "6055")?.langsung).toBe(true);
    for (const k of ["6054", "6055", "4102", "4103"]) if (h.g.has(k)) expect(h.g.get(k), k).toBe("tuntutan");
  });

  it("saklar hakim (karena jabatan) -> kartu mut'ah tampil; yang lain tetap disembunyikan", () => {
    const h = golongan(CG01, { bawaanAbt: BAWAAN, jabatan: ["4143"] });
    expect(h.utama).toEqual(expect.arrayContaining(["4103"]));
    expect(h.g.get("4105")).toBe("tuntutan");
    expect(h.g.get("4102")).toBe("tuntutan");
  });

  it("keputusan TERSIMPAN tepat satu pilihan -> kartunya tampil (kartu tuntutan lain tidak ikut)", () => {
    const h = golongan(CG01, { bawaanAbt: BAWAAN, isi: { "4102": "ditolak: istri nusyuz" } });
    expect(h.utama).toEqual(expect.arrayContaining(["4102"]));
    expect(h.g.get("4101")).toBe("tuntutan");
    expect(h.g.get("4105")).toBe("tuntutan");
    expect(golongan(CG01, { bawaanAbt: BAWAAN, isi: { "4103": EX } }).utama).toEqual(expect.arrayContaining(["4103"]));
  });

  it("diminta petitum -> tampil seperti aturan lama; status tuntutan tidak terbaca (dikenal tak ada) tidak menyembunyikan kartu langsung", () => {
    expect(golongan(CG01, { bawaanAbt: BAWAAN, menyala: ["4142"] }).utama).toEqual(expect.arrayContaining(["4102"]));
    const h = golongan(CT_MI);
    const x = h.s.isian.find((y) => y.kode === "6055")!;
    expect(M().golonganIsianMurni(x, { ...h.ctx, dikenal: undefined })).not.toBe("tuntutan");
  });
});

describe("D. layar: sebab lencana dan pemilih keputusan", () => {
  it("keputusan dipilih = pilihan tunggal; 'karena jabatan' hanya saklar atau ex officio; daftar pilihan bawaan tidak dimuat ke kotak", () => {
    expect(JS_ISIAN).toMatch(/function keputusanTuntutan\(p\) \{[^}]*keputusanDipilihMurni\(/);
    expect(JS_ISIAN).toMatch(/function keputusanKarenaJabatan\(p\) \{[\s\S]*keputusanExOfficioMurni\(/);
    expect(JS_ISIAN).toContain("!daftarPilihanMurni(b, v.teks)");
    expect(JS_ISIAN).toMatch(/jabatanMenyala\(p\) \|\| keputusanKarenaJabatan\(p\)\)\s*\?\s*"ditetapkan karena jabatan"/);
    expect(JS_ISIAN).not.toMatch(/jabatanMenyala\(p\) \|\| keputusanTuntutan\(p\)\)/);
    expect(JS_ISIAN).toContain('data-keputusan="1"');
    expect(JS_ISIAN).toContain("pilih keputusan majelis…");
    expect(JS_ISIAN).toMatch(/\(ctx\.terisiTuntutan \|\| ctx\.terisi\)\(b\)/);
  });
});

describe("E. Pilih tanggal (Blangko ABT by Derry, bagian Perkara)", () => {
  it("satu tanggal cukup; kosong = null (petunjuk, bukan galat); terbalik ditukar; format peramban diterima", () => {
    expect(R().rentangDari("2026-10-21", "")).toEqual({ dari: "2026-10-21", sampai: "2026-10-21" });
    expect(R().rentangDari("", "2026-10-22")).toEqual({ dari: "2026-10-22", sampai: "2026-10-22" });
    expect(R().rentangDari("", "")).toBeNull();
    expect(R().rentangDari("  ", undefined)).toBeNull();
    expect(R().rentangDari("2026-10-25", "2026-10-21")).toEqual({ dari: "2026-10-21", sampai: "2026-10-25" });
    expect(R().rentangDari("21/10/2026", "25-10-2026")).toEqual({ dari: "2026-10-21", sampai: "2026-10-25" });
    expect(R().rentangDari("2026-10-21", "bukan tanggal")).toEqual({ dari: "2026-10-21", sampai: "2026-10-21" });
    expect(R().isoTanggalRentang("2026-02-30")).toBe("");
    expect(R().isoTanggalRentang("2026-3-5")).toBe("2026-03-05");
  });
  it("bawaan panel = Sidang hari ini: mode tersimpan TIDAK dipulihkan; tanpa tanggal tidak ada permintaan ke server", () => {
    expect(JS_DERRY).toContain('mode: "hari",');
    expect(JS_DERRY).not.toMatch(/S\.mode = d\.mode/);
    expect(JS_DERRY).toMatch(/async function muatDaftar\(paksa\) \{[\s\S]{0,260}!rentangDari\(S\.dari, S\.sampai\)[\s\S]{0,200}return;/);
    expect(JS_DERRY).toContain("Pilih tanggal dulu - cukup satu tanggal untuk melihat satu hari.");
  });
});
