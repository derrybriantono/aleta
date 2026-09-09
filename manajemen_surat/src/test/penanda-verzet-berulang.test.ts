// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * SATU PERKARA DAPAT DILAWAN LEBIH DARI SEKALI
 * ============================================================================
 *
 * Pembacanya dulu berbunyi:
 *
 *   SELECT ... FROM perkara_verzet v WHERE v.perkara_id = ? LIMIT 1
 *
 * LIMIT 1 tanpa ORDER BY. Pada perkara yang dilawan dua kali, baris mana yang
 * terbaca ditentukan MySQL sendiri - dan MySQL tidak menjanjikan apa pun tanpa
 * ORDER BY. Tanggal yang tergambar pada penanda VERZET karena itu dapat
 * berpindah antar-pembacaan pada perkara yang persis sama, tanpa satu pun
 * galat, tanpa satu pun uji yang menuduh.
 *
 * Kelas kekeliruan yang sama dengan ['0']->id di ABT yang membuat keterangan
 * saksi terbaca dari sidang yang salah.
 *
 * ============================================================================
 * KENAPA BASIS DATANYA DIPALSUKAN, BUKAN DISENTUH
 * ============================================================================
 *
 * Yang diuji di sini kueri yang DIKIRIM dan hasil yang DISUSUN - keduanya
 * keputusan kita, bukan perilaku MySQL. Menyambung ke SIPP sungguhan hanya
 * akan menguji MySQL, dan menuntut perkara yang kebetulan dilawan dua kali
 * ada di sana.
 */

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");

type BarisVerzet = {
  daftar: string | null;
  sidang: string | null;
  putusan: string | null;
};

type Catatan = { sql: string; params: unknown[] };

/**
 * Memuat penandaSippService dengan basis data dan pembaca skema palsu.
 *
 * Keduanya disuntikkan lewat require.cache SEBELUM layanannya dimuat, sebab
 * layanan itu menyimpan keduanya di dalam const saat berkasnya dijalankan -
 * mengganti sesudahnya tidak berpengaruh apa pun.
 */
function muatLayanan(baris: BarisVerzet[], punyaKolomJejak = true) {
  const Module = require_("module") as unknown as new (id: string) => {
    filename: string;
    loaded: boolean;
    exports: unknown;
  };

  const jalurDb = require_.resolve(path.join(akarBot, "db_config"));
  const jalurSkema = require_.resolve(path.join(akarBot, "services/sippSkemaService"));
  const jalurLayanan = require_.resolve(path.join(akarBot, "services/penandaSippService"));

  const catatan: Catatan = { sql: "", params: [] };

  const pasang = (jalur: string, isi: unknown) => {
    const m = new Module(jalur);
    m.filename = jalur;
    m.loaded = true;
    m.exports = isi;
    (require_.cache as Record<string, unknown>)[jalur] = m;
  };

  pasang(jalurDb, {
    query: (sql: string, params: unknown[], balik: (g: unknown, h: unknown) => void) => {
      catatan.sql = sql;
      catatan.params = params;
      balik(null, baris);
    },
  });

  pasang(jalurSkema, {
    tabelAda: async () => true,
    kolomAda: async () => punyaKolomJejak,
  });

  // Layanannya sendiri dibuang dari cache supaya ia dimuat ulang dan memungut
  // kedua palsuan di atas.
  delete (require_.cache as Record<string, unknown>)[jalurLayanan];
  const layanan = require_(jalurLayanan) as {
    verzet: (perkaraId: number) => Promise<{
      ada: boolean;
      jumlah: number;
      tanggalDaftar: string;
      sidangPertama: string;
      sudahPutus: boolean;
      sebelumnya: Array<{ tanggalDaftar: string; sudahPutus: boolean }>;
    } | null>;
  };

  return { layanan, catatan };
}

/** Dua perlawanan atas satu perkara, yang terbaru lebih dahulu. */
const DUA_KALI: BarisVerzet[] = [
  { daftar: "2026-08-03", sidang: "2026-08-17", putusan: null },
  { daftar: "2026-02-11", sidang: "2026-02-25", putusan: "2026-04-06" },
];

describe("kueri yang dikirim ke SIPP", () => {
  it("tidak lagi memotong pada satu baris", async () => {
    // LIMIT 1 itulah seluruh kekeliruannya: ia membuang barisnya sebelum ada
    // yang tahu jumlahnya lebih dari satu.
    const { layanan, catatan } = muatLayanan(DUA_KALI);
    await layanan.verzet(510);
    expect(catatan.sql).not.toContain("LIMIT 1");
  });

  it("mengurutkan dari yang terbaru, dengan pemutus bila tanggalnya sama", async () => {
    const { layanan, catatan } = muatLayanan(DUA_KALI, true);
    await layanan.verzet(510);
    expect(catatan.sql).toContain("ORDER BY v.tanggal_pendaftaran_verzet DESC");
    expect(catatan.sql).toContain("v.diinput_tanggal DESC");
    expect(catatan.params).toEqual([510]);
  });

  it("tidak mengurutkan atas kolom jejak bila SIPP-nya tidak punya", async () => {
    // ALETA dapat dipasang di satker lain, dan SIPP berbeda antar versi.
    // Mengurutkan atas kolom yang tidak ada melempar galat - dan galat di
    // sini ditelan aman(), sehingga penandanya lenyap tanpa sebab yang
    // terbaca. Itu lebih buruk daripada urutan yang kurang tajam.
    const { layanan, catatan } = muatLayanan(DUA_KALI, false);
    await layanan.verzet(510);
    expect(catatan.sql).toContain("ORDER BY v.tanggal_pendaftaran_verzet DESC");
    expect(catatan.sql).not.toContain("diinput_tanggal");
  });
});

describe("hasil yang disusun untuk perlawanan berulang", () => {
  it("menyebut jumlahnya, dan memakai yang TERBARU", async () => {
    const { layanan } = muatLayanan(DUA_KALI);
    const hasil = await layanan.verzet(510);

    expect(hasil).toBeTruthy();
    expect(hasil!.jumlah).toBe(2);
    // Yang tenggangnya sedang berjalan adalah perlawanan terbaru; yang lama
    // sudah menjadi sejarah dan putusannya sudah ada.
    expect(hasil!.tanggalDaftar).toBe("2026-08-03");
    expect(hasil!.sidangPertama).toBe("2026-08-17");
    expect(hasil!.sudahPutus).toBe(false);
  });

  it("perlawanan lama tetap disebutkan, tidak dibuang", async () => {
    // "Ini perlawanan kedua" mengubah cara majelis membaca berkasnya. Yang
    // dibuang diam-diam tidak dapat diketahui siapa pun.
    const { layanan } = muatLayanan(DUA_KALI);
    const hasil = await layanan.verzet(510);

    expect(hasil!.sebelumnya).toHaveLength(1);
    expect(hasil!.sebelumnya[0].tanggalDaftar).toBe("2026-02-11");
    expect(hasil!.sebelumnya[0].sudahPutus).toBe(true);
  });

  it("perkara yang dilawan sekali tetap seperti semula", async () => {
    // Yang jarang tidak boleh mengubah yang lazim. Hampir seluruh perkara
    // verzet hanya dilawan sekali, dan bentuknya harus tetap sama.
    const { layanan } = muatLayanan([DUA_KALI[1]]);
    const hasil = await layanan.verzet(510);

    expect(hasil!.jumlah).toBe(1);
    expect(hasil!.sebelumnya).toEqual([]);
    expect(hasil!.tanggalDaftar).toBe("2026-02-11");
  });

  it("perkara tanpa perlawanan tidak menghasilkan penanda", async () => {
    const { layanan } = muatLayanan([]);
    expect(await layanan.verzet(510)).toBeNull();
  });
});

describe("penandanya di panel SIPP menyebutkan angkanya", () => {
  const konten = () =>
    readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/konten.js"), "utf8");

  it("label berubah menjadi VERZET ke-N saat lebih dari satu", () => {
    // Selama labelnya berbunyi "VERZET" saja, perlawanan kedua tampak persis
    // sama dengan yang pertama - dan tidak ada yang punya sebab untuk
    // memeriksanya.
    const isi = konten();
    expect(isi).toContain("jumlah > 1 ? `VERZET ke-${jumlah}` : \"VERZET\"");
  });

  it("tanggal perlawanan sebelumnya ikut disebut di keterangannya", () => {
    expect(konten()).toContain("Perlawanan sebelumnya:");
  });
});
