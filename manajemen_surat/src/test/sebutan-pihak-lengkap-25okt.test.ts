// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import {
  daftarSebutanBerurut,
  paraSebutan,
  perkaraPermohonan,
  sebutanBerurut,
  sebutanLengkap,
  sebutanPihakPerkara,
  sebutanSatuPihak,
  urutanRomawi,
  type BahanSebutan,
} from "@/lib/sebutan-pihak";
import { isiTanda } from "@/lib/set-pertanyaan-saksi";

/**
 * ============================================================================
 * 25 OKT 2026 - RANTAI D, BUTIR D5: SEBUTAN PIHAK LENGKAP (U15)
 * ============================================================================
 *
 * Sebutan pihak ditulis di SATU sumber (src/lib/sebutan-pihak.ts) dan disalin ke bot, katalog saksi ekstensi, dan panel juru sita
 * ekstensi karena ketiganya tidak dapat memuat TypeScript. Yang dijaga:
 *   1. aturan per ALUR dan jenis (tabel kasus): gugatan 15, permohonan 16, gugatan sederhana 17, jinayat 122/123, cerai talak 346 dan
 *      izin poligami 341 bernomor /Pdt.G/, PERLAWANAN (Pelawan/Terlawan) dan BANTAHAN (Pembantah/Terbantah) yang kini dikenal;
 *   2. KEEMPAT salinan (TS, bot, katalog saksi, juru sita) menjawab sama atas tabel yang sama;
 *   3. pelaku (#0047#) = Tergugat/Termohon (Terlawan/Terbantah) pada tiap alur;
 *   4. pihak jamak (Para Pemohon, Pemohon I/II) dan rekonvensi dari satu tempat; katalog saksi memakainya;
 *   5. perilaku lama tidak berubah: tabel NAMA_NYATA lama tetap.
 */

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const bot = require_(path.join(AKAR, "aleta_bot", "services", "sebutanPihakService.js")) as {
  sebutanPihakPerkara: (b?: BahanSebutan) => { satu: string; dua: string; surat: string; sumber: string };
  sebutanLengkap: (b?: BahanSebutan) => Record<string, unknown>;
  paraSebutan: (s: string, n: unknown) => string;
  sebutanBerurut: (s: string, u: number, n: unknown) => string;
  daftarSebutanBerurut: (s: string, n: unknown) => string[];
  urutanRomawi: (n: number) => string;
};
const katalog = require_(path.join(AKAR, "ekstensi-sipp", "blangko-derry-katalog.js")) as {
  sebutanPihak: (p: Record<string, unknown>) => { P: string; T: string; surat: string; sumber: string };
};
const baca = (berkas: string) => readFileSync(path.join(AKAR, "ekstensi-sipp", berkas), "utf8").replace(/\r\n/g, "\n");
function muatJurusita() {
  const w = new JSDOM("", { runScripts: "outside-only" }).window as any;
  w.eval(`${baca("panel-alat.js")}\n;\n${baca("jurusita.js")}\n;window.__j = { sebutan: jurusitaSebutan };`);
  return w.__j.sebutan as (nomor: string, jenis: string, alur: number | null, jenisId: number | null) => { pertama: string; kedua: string; k1: string; k2: string };
}
const jurusita = muatJurusita();

type Kasus = { nama: string; bahan: BahanSebutan; satu: string; dua: string; surat: string; sumber?: string };
const KASUS: Kasus[] = [
  // ── gugatan, permohonan, gugatan sederhana ─────────────────────────────────
  { nama: "alur 15 cerai gugat", bahan: { alurPerkaraId: 15, jenisPerkaraId: 347, jenisPerkaraNama: "Cerai Gugat", nomorPerkara: "679/Pdt.G/2026/PA.Dgl" }, satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "alur" },
  { nama: "alur 15 harta bersama", bahan: { alurPerkaraId: 15, jenisPerkaraId: 348, jenisPerkaraNama: "Harta Bersama", nomorPerkara: "12/Pdt.G/2026/PA.Dgl" }, satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "alur" },
  { nama: "alur 16 itsbat nikah", bahan: { alurPerkaraId: 16, jenisPerkaraId: 360, jenisPerkaraNama: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "247/Pdt.P/2026/PA.Dgl" }, satu: "Pemohon", dua: "Termohon", surat: "permohonan", sumber: "alur" },
  { nama: "alur 17 gugatan sederhana", bahan: { alurPerkaraId: 17, jenisPerkaraId: 370, jenisPerkaraNama: "Ekonomi Syariah", nomorPerkara: "3/Pdt.G.S/2026/PA.Dgl" }, satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "alur" },
  { nama: "cerai talak bernomor Pdt.G tetap Pemohon", bahan: { alurPerkaraId: 15, jenisPerkaraId: 346, jenisPerkaraNama: "Cerai Talak", nomorPerkara: "517/Pdt.G/2026/PA.Dgl" }, satu: "Pemohon", dua: "Termohon", surat: "permohonan", sumber: "jenis" },
  { nama: "izin poligami bernomor Pdt.G tetap Pemohon", bahan: { alurPerkaraId: 15, jenisPerkaraId: 341, nomorPerkara: "9/Pdt.G/2026/PA.Dgl" }, satu: "Pemohon", dua: "Termohon", surat: "permohonan", sumber: "jenis" },
  { nama: "alur 122 jinayat", bahan: { alurPerkaraId: 122 }, satu: "Penuntut Umum", dua: "Terdakwa", surat: "dakwaan", sumber: "alur" },
  { nama: "alur 123 jinayat", bahan: { alurPerkaraId: 123 }, satu: "Penuntut Umum", dua: "Terdakwa", surat: "dakwaan", sumber: "alur" },
  // ── tanpa alur: nama lalu nomor ────────────────────────────────────────────
  { nama: "tanpa alur: nama Cerai Talak", bahan: { jenisPerkaraNama: "Cerai Talak" }, satu: "Pemohon", dua: "Termohon", surat: "permohonan", sumber: "kata" },
  { nama: "tanpa alur: nomor Pdt.P", bahan: { nomorPerkara: "220/Pdt.P/2026/PA.Dgl" }, satu: "Pemohon", dua: "Termohon", surat: "permohonan", sumber: "nomor" },
  { nama: "tanpa alur: nomor Pdt.G", bahan: { nomorPerkara: "220/Pdt.G/2026/PA.Dgl" }, satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "nomor" },
  { nama: "tanpa keterangan", bahan: {}, satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "bawaan" },
  // ── PERLAWANAN ─────────────────────────────────────────────────────────────
  { nama: "perlawanan atas putusan verstek (nama), alur 15", bahan: { alurPerkaraId: 15, jenisPerkaraNama: "Perlawanan Terhadap Putusan Verstek", nomorPerkara: "5/Pdt.G/2026/PA.Dgl" }, satu: "Pelawan", dua: "Terlawan", surat: "perlawanan", sumber: "kata" },
  { nama: "verzet (nama), alur 15", bahan: { alurPerkaraId: 15, jenisPerkaraNama: "Verzet" }, satu: "Pelawan", dua: "Terlawan", surat: "perlawanan", sumber: "kata" },
  { nama: "derden verzet (nama), tanpa alur", bahan: { jenisPerkaraNama: "Derden Verzet" }, satu: "Pelawan", dua: "Terlawan", surat: "perlawanan", sumber: "kata" },
  { nama: "perlawanan eksekusi (nomor Pdt.Plw), alur 15", bahan: { alurPerkaraId: 15, nomorPerkara: "5/Pdt.Plw/2026/PA.Dgl" }, satu: "Pelawan", dua: "Terlawan", surat: "perlawanan", sumber: "nomor" },
  { nama: "perlawanan (nomor Pdt.Plw), tanpa alur", bahan: { nomorPerkara: "6/Pdt.Plw/2026/PA.Dgl" }, satu: "Pelawan", dua: "Terlawan", surat: "perlawanan", sumber: "nomor" },
  // ── BANTAHAN ───────────────────────────────────────────────────────────────
  { nama: "bantahan (nama), alur 15", bahan: { alurPerkaraId: 15, jenisPerkaraNama: "Bantahan" }, satu: "Pembantah", dua: "Terbantah", surat: "bantahan", sumber: "kata" },
  { nama: "bantahan (nomor Pdt.Bth), alur 15", bahan: { alurPerkaraId: 15, nomorPerkara: "4/Pdt.Bth/2026/PA.Dgl" }, satu: "Pembantah", dua: "Terbantah", surat: "bantahan", sumber: "nomor" },
  // ── perlawanan/bantahan TIDAK mengalahkan nomor yang lebih pasti ───────────
  { nama: "alur permohonan menang atas kata perlawanan", bahan: { alurPerkaraId: 16, jenisPerkaraNama: "Perlawanan" }, satu: "Pemohon", dua: "Termohon", surat: "permohonan", sumber: "alur" },
  { nama: "jenis cerai talak menang atas kata verzet", bahan: { alurPerkaraId: 15, jenisPerkaraId: 346, jenisPerkaraNama: "Verzet Cerai Talak" }, satu: "Pemohon", dua: "Termohon", surat: "permohonan", sumber: "jenis" },
  { nama: "jinayat menang atas semuanya", bahan: { alurPerkaraId: 122, jenisPerkaraNama: "Perlawanan" }, satu: "Penuntut Umum", dua: "Terdakwa", surat: "dakwaan", sumber: "alur" },
];

describe("aturan per alur dan jenis (TS)", () => {
  for (const k of KASUS) {
    it(k.nama, () => {
      const h = sebutanPihakPerkara(k.bahan);
      expect([h.satu, h.dua, h.surat]).toEqual([k.satu, k.dua, k.surat]);
      if (k.sumber) expect(h.sumber).toBe(k.sumber);
    });
  }

  it("pelaku (#0047#) selalu pihak KEDUA: Tergugat/Termohon/Terlawan/Terbantah/Terdakwa", () => {
    for (const k of KASUS) expect(sebutanSatuPihak(2, k.bahan), k.nama).toBe(k.dua);
    for (const k of KASUS) expect(sebutanSatuPihak(1, k.bahan), k.nama).toBe(k.satu);
    expect(sebutanSatuPihak("T", { jenisPerkaraNama: "Verzet" })).toBe("Terlawan");
  });

  it("kuasa memakai sebutan yang diwakilinya, juga Pelawan/Pembantah", () => {
    expect(sebutanSatuPihak(1, { jenisPerkaraNama: "Verzet" }, "kuasa")).toBe("Kuasa Pelawan");
    expect(sebutanSatuPihak(2, { nomorPerkara: "4/Pdt.Bth/2026/PA.Dgl" }, "kuasa")).toBe("Kuasa Terbantah");
  });

  it("perkaraPermohonan: perlawanan dan bantahan bukan permohonan", () => {
    expect(perkaraPermohonan({ jenisPerkaraNama: "Verzet" })).toBe(false);
    expect(perkaraPermohonan({ nomorPerkara: "4/Pdt.Bth/2026/PA.Dgl" })).toBe(false);
    expect(perkaraPermohonan({ alurPerkaraId: 16 })).toBe(true);
  });

  it("perilaku lama tidak berubah: nama nyata SIPP tetap (cerai gugat, itsbat, wali adhol, P3HP, dispensasi)", () => {
    const lama: Array<[string, string, string]> = [
      ["Pengesahan Perkawinan/Istbat Nikah", "Pemohon", "Termohon"],
      ["Cerai Talak", "Pemohon", "Termohon"],
      ["Dispensasi Kawin", "Pemohon", "Termohon"],
      ["P3HP/Penetapan Ahli Waris", "Pemohon", "Termohon"],
      ["Wali Adhol", "Pemohon", "Termohon"],
      ["Cerai Gugat", "Penggugat", "Tergugat"],
      ["Harta Bersama", "Penggugat", "Tergugat"],
      ["Kewarisan", "Penggugat", "Tergugat"],
    ];
    for (const [nama, satu, dua] of lama) expect(sebutanPihakPerkara({ jenisPerkaraNama: nama })).toMatchObject({ satu, dua });
  });
});

describe("keempat salinan menjawab sama atas tabel yang sama", () => {
  it("bot (CommonJS) = TS: satu, dua, surat, sumber", () => {
    for (const k of KASUS) expect(bot.sebutanPihakPerkara(k.bahan), k.nama).toEqual(sebutanPihakPerkara(k.bahan));
  });

  it("katalog saksi ekstensi = TS: P/T/surat/sumber (nama jenis dan id dikirim seperti ekstensi)", () => {
    for (const k of KASUS) {
      const hasil = katalog.sebutanPihak({ ...k.bahan, jenisPerkara: k.bahan.jenisPerkaraNama ?? "", jenisPerkaraId: k.bahan.jenisPerkaraId ?? "" });
      const ts = sebutanPihakPerkara(k.bahan);
      expect([hasil.P, hasil.T, hasil.surat], k.nama).toEqual([ts.satu, ts.dua, ts.surat]);
    }
  });

  it("panel juru sita ekstensi = TS: pertama/kedua", () => {
    for (const k of KASUS) {
      const h = jurusita(String(k.bahan.nomorPerkara ?? ""), String(k.bahan.jenisPerkaraNama ?? ""), (k.bahan.alurPerkaraId as number | undefined) ?? null, (k.bahan.jenisPerkaraId as number | undefined) ?? null);
      const ts = sebutanPihakPerkara(k.bahan);
      expect([h.pertama, h.kedua], k.nama).toEqual([ts.satu, ts.dua]);
    }
  });

  it("kunci pemetaan juru sita untuk Pelawan/Pembantah jatuh ke kunci umum (tanpa blangko khusus)", () => {
    const h = jurusita("5/Pdt.Plw/2026/PA.Dgl", "Perlawanan", 15, null);
    expect([h.k1, h.k2]).toEqual(["pelawan", "terlawan"]);
  });
});

describe("pihak jamak dan urutan dari satu tempat", () => {
  it("romawi 1..20 lalu angka biasa", () => {
    expect([1, 2, 3, 4, 9, 10, 14, 19, 20, 21].map(urutanRomawi)).toEqual(["I", "II", "III", "IV", "IX", "X", "XIV", "XIX", "XX", "21"]);
  });

  it("para / berurut / daftar: seorang tetap tanpa angka, lebih dari seorang berurut", () => {
    expect(paraSebutan("Pemohon", 1)).toBe("Pemohon");
    expect(paraSebutan("Pemohon", 2)).toBe("para Pemohon");
    expect(paraSebutan("Pemohon", undefined)).toBe("Pemohon");
    expect(sebutanBerurut("Pemohon", 1, 1)).toBe("Pemohon");
    expect(sebutanBerurut("Pemohon", 2, 2)).toBe("Pemohon II");
    expect(daftarSebutanBerurut("Pemohon", 2)).toEqual(["Pemohon I", "Pemohon II"]);
    expect(daftarSebutanBerurut("Penggugat", 3)).toEqual(["Penggugat I", "Penggugat II", "Penggugat III"]);
    expect(daftarSebutanBerurut("Pelawan", 1)).toEqual(["Pelawan"]);
    expect(daftarSebutanBerurut("Pemohon", 0)).toEqual(["Pemohon"]);
    expect(daftarSebutanBerurut("Pemohon", 999)).toHaveLength(20);
  });

  it("bot = TS untuk pihak jamak", () => {
    for (const n of [undefined, 0, 1, 2, 3, "2"]) {
      expect(bot.paraSebutan("Pemohon", n)).toBe(paraSebutan("Pemohon", n as number | string | undefined));
      expect(bot.sebutanBerurut("Pemohon", 2, n)).toBe(sebutanBerurut("Pemohon", 2, n as number | string | undefined));
      expect(bot.daftarSebutanBerurut("Penggugat", n)).toEqual(daftarSebutanBerurut("Penggugat", n as number | string | undefined));
    }
    expect([1, 2, 5, 20, 21].map(bot.urutanRomawi)).toEqual([1, 2, 5, 20, 21].map(urutanRomawi));
  });

  it("katalog saksi (isiTanda) memakai bentuk jamak dari sumber yang sama: itsbat dua pemohon", () => {
    expect(isiTanda("{Pp} datang bersama {P1} dan {P2}", "itsbat", { sebutanP: "Pemohon", sebutanT: "Termohon", jumlahP: 2 })).toBe("Para Pemohon datang bersama Pemohon I dan Pemohon II");
    // seorang pemohon: tanpa angka; {P2} jatuh ke pihak kedua seperti dulu
    expect(isiTanda("{Pp} dan {P1} dan {P2}", "itsbat", { sebutanP: "Pemohon", sebutanT: "Termohon", jumlahP: 1 })).toBe("Pemohon dan Pemohon dan Termohon");
    // Pelawan dengan dua orang
    expect(isiTanda("{Pp} / {P1} / {P2}", "cg", { sebutanP: "Pelawan", sebutanT: "Terlawan", jumlahP: 2 })).toBe("Para Pelawan / Pelawan I / Pelawan II");
  });
});

describe("rekonvensi: kedudukan ganda hanya di dalam gugatan", () => {
  it("cerai gugat dengan rekonvensi: Penggugat Konvensi/Tergugat Rekonvensi dan Tergugat Konvensi/Penggugat Rekonvensi", () => {
    const h = sebutanLengkap({ alurPerkaraId: 15, jenisPerkaraId: 347, rekonvensi: true });
    expect(h).toMatchObject({ satu: "Penggugat", dua: "Tergugat", rekonvensi: true, satuLengkap: "Penggugat Konvensi/Tergugat Rekonvensi", duaLengkap: "Tergugat Konvensi/Penggugat Rekonvensi" });
  });

  it("cerai talak dengan rekonvensi (hak asuh/nafkah dituntut Termohon): Pemohon Konvensi/Tergugat Rekonvensi", () => {
    const h = sebutanLengkap({ alurPerkaraId: 15, jenisPerkaraId: 346, rekonvensi: true });
    expect(h).toMatchObject({ satu: "Pemohon", dua: "Termohon", rekonvensi: true, satuLengkap: "Pemohon Konvensi/Tergugat Rekonvensi", duaLengkap: "Termohon Konvensi/Penggugat Rekonvensi" });
  });

  it("tanpa rekonvensi, atau perkara yang tidak mengenalnya: sebutan dasar, bendera rekonvensi mati", () => {
    expect(sebutanLengkap({ alurPerkaraId: 15, jenisPerkaraId: 347 })).toMatchObject({ rekonvensi: false, satuLengkap: "Penggugat", duaLengkap: "Tergugat" });
    for (const bahan of [{ alurPerkaraId: 16 }, { alurPerkaraId: 122 }, { jenisPerkaraNama: "Verzet" }, { nomorPerkara: "4/Pdt.Bth/2026/PA.Dgl" }] as BahanSebutan[]) {
      const h = sebutanLengkap({ ...bahan, rekonvensi: true });
      expect(h.rekonvensi, JSON.stringify(bahan)).toBe(false);
      expect(h.satuLengkap).toBe(h.satu);
    }
  });

  it("sebutanPihakPerkara tidak berubah oleh bendera rekonvensi (pemanggil lama tetap memperoleh pasangan dasar)", () => {
    expect(sebutanPihakPerkara({ alurPerkaraId: 15, rekonvensi: true })).toEqual(sebutanPihakPerkara({ alurPerkaraId: 15 }));
  });

  it("bot = TS untuk sebutanLengkap", () => {
    const bahan: BahanSebutan[] = [{ alurPerkaraId: 15, jenisPerkaraId: 347, rekonvensi: true }, { alurPerkaraId: 15, jenisPerkaraId: 346, rekonvensi: true }, { alurPerkaraId: 16, rekonvensi: true }, { jenisPerkaraNama: "Verzet", rekonvensi: true }, {}];
    for (const b of bahan) expect(bot.sebutanLengkap(b), JSON.stringify(b)).toEqual(sebutanLengkap(b));
  });
});

describe("penjaga kembaran: pola dan nomor sama huruf demi huruf", () => {
  const ts = baca("../manajemen_surat/src/lib/sebutan-pihak.ts");
  const js = readFileSync(path.join(AKAR, "aleta_bot", "services", "sebutanPihakService.js"), "utf8");

  it("pola perlawanan dan bantahan sama di TS dan bot", () => {
    for (const potongan of ["POLA_PERLAWANAN = /perlawanan|verzet|derden/i", "POLA_BANTAHAN = /bantahan/i", "Pdt\\.Plw\\b", "Pdt\\.Bth\\b"]) {
      expect(ts, `TS: ${potongan}`).toContain(potongan);
      expect(js, `bot: ${potongan}`).toContain(potongan);
    }
    expect(baca("blangko-derry-katalog.js")).toContain("POLA_PERLAWANAN = /perlawanan|verzet|derden/i");
    expect(baca("jurusita.js")).toContain("/perlawanan|verzet|derden/i");
  });
});
