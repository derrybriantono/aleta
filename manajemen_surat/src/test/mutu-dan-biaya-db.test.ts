import { afterEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { perluDijalankan, riwayatKeajekan } from "@/server/modules/aleta-ecourt/keajekan-berkala";
import {
  batasDariSumber,
  catatDenganTarif,
  perkiraanToken,
  setelTarif,
  tarifModel,
  bulanDari,
  catatPemakaian,
  daftarkanSumber,
  izinPanggil,
  keadaanPagu,
  keberhasilanPustaka,
  rincianBiaya,
  setelPagu,
  sumberTerdaftar,
  temuanSuntingan,
} from "@/server/modules/aleta-ecourt/mutu-dan-biaya";

/**
 * Mutu, biaya, dan perluasan di basis data (K1-K7).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Tiga hal yang tidak dapat diuji tanpa basis data:
 *
 *   - panggilan yang GAGAL tetap terhitung ke pagu. Penyedia tetap menagih
 *     permintaan yang jawabannya tidak terpakai, dan pagu yang hanya
 *     menghitung yang berhasil akan selalu lebih kecil daripada tagihannya;
 *   - draf dihitung memakai model bila butirnya berasal dari butir buatan
 *     model - bukan dari tabel pemakaian, sebab satu percakapan yang tidak
 *     masuk draf mana pun akan menandai draf itu keliru; dan
 *   - sumber yang terdaftar tetapi belum AKTIF tidak boleh ruasnya ikut
 *     melonggarkan penyaring J5.
 */

let db: AletaDatabase | null = null;

async function basisData() {
  db = await createAletaDatabase({ useInMemory: true, seed: false, runMigrations: false });
  return db;
}

afterEach(async () => {
  await db?.close?.();
  db = null;
});

const SEKARANG = new Date().toISOString();

function pemakaian(lebih: Partial<Parameters<typeof catatPemakaian>[1]> = {}) {
  return {
    pekerjaan: "tarikFakta" as const,
    tingkat: "hemat" as const,
    penyedia: "penyedia-uji",
    model: "model-hemat",
    tokenMasuk: 1_000_000,
    tokenKeluar: 0,
    tarifMasukPerJuta: 100_000,
    tarifKeluarPerJuta: 0,
    berhasil: true,
    ...lebih,
  };
}

describe("pagu dan biaya", () => {
  it("pagu belum disetel berarti tidak dibatasi", async () => {
    const basis = await basisData();
    const keadaan = await keadaanPagu(basis);
    expect(keadaan.tingkat).toBe("aman");
    expect(keadaan.pesan).toContain("belum disetel");
  });

  it("menyetel pagu menuntut atas perintah siapa", async () => {
    const basis = await basisData();
    expect((await setelPagu(basis, { paguRupiah: 500_000, oleh: "Admin", atasPerintah: "" })).ok).toBe(false);
    expect(
      (await setelPagu(basis, { paguRupiah: 500_000, oleh: "Admin", atasPerintah: "Ketua" })).ok
    ).toBe(true);
  });

  it("pemakaian terjumlah dan mengubah keadaan pagu", async () => {
    const basis = await basisData();
    await setelPagu(basis, { paguRupiah: 500_000, oleh: "Admin", atasPerintah: "Ketua" });
    await catatPemakaian(basis, pemakaian());
    await catatPemakaian(basis, pemakaian({ tokenMasuk: 2_600_000 }));

    const keadaan = await keadaanPagu(basis);
    expect(keadaan.terpakai).toBe(360_000);
    expect(keadaan.tingkat).toBe("peringatan");
    expect(keadaan.persen).toBe(72);
  });

  it("panggilan yang GAGAL tetap terhitung ke pagu", async () => {
    // Penyedia tetap menagih permintaan yang jawabannya tidak terpakai.
    const basis = await basisData();
    await setelPagu(basis, { paguRupiah: 500_000, oleh: "Admin", atasPerintah: "Ketua" });
    await catatPemakaian(basis, pemakaian({ berhasil: false }));

    const rincian = await rincianBiaya(basis);
    expect(rincian.total).toBe(100_000);
    expect(rincian.biayaGagal).toBe(100_000);
  });

  it("biaya dipecah per pekerjaan supaya dapat ditindaklanjuti", async () => {
    // "Rp 340.000 bulan ini" tidak dapat ditindaklanjuti; "Rp 290.000 di
    // antaranya untuk penyusunan pertimbangan" menunjuk langsung ke pekerjaan
    // yang pustakanya belum cukup terisi.
    const basis = await basisData();
    await catatPemakaian(basis, pemakaian({ pekerjaan: "tarikFakta", tokenMasuk: 500_000 }));
    await catatPemakaian(
      basis,
      pemakaian({ pekerjaan: "susunPertimbangan", tingkat: "kuat", model: "model-kuat", tokenMasuk: 2_900_000 })
    );

    const rincian = await rincianBiaya(basis);
    expect(rincian.perPekerjaan[0].pekerjaan).toBe("susunPertimbangan");
    expect(rincian.perPekerjaan[0].biaya).toBe(290_000);
    expect(rincian.perModel.map((item) => item.model)).toContain("model-kuat");
  });

  it("izin panggil menolak model kuat lebih dulu daripada model hemat", async () => {
    const basis = await basisData();
    await setelPagu(basis, { paguRupiah: 500_000, oleh: "Admin", atasPerintah: "Ketua" });
    await catatPemakaian(basis, pemakaian({ tokenMasuk: 4_600_000 }));

    expect((await izinPanggil(basis, "susunPertimbangan")).boleh).toBe(false);
    expect((await izinPanggil(basis, "tarikFakta")).boleh).toBe(true);
  });

  it("bulan lain tidak ikut terhitung", async () => {
    const basis = await basisData();
    await catatPemakaian(basis, pemakaian());
    await basis.run(`UPDATE aleta_ai_pemakaian SET bulan = '2020-01'`);
    expect((await keadaanPagu(basis)).terpakai).toBe(0);
    expect((await rincianBiaya(basis, "2020-01")).total).toBe(100_000);
  });

  it("pagu ditimpa per bulan, bukan ditumpuk", async () => {
    const basis = await basisData();
    await setelPagu(basis, { paguRupiah: 500_000, oleh: "Admin", atasPerintah: "Ketua" });
    await setelPagu(basis, { paguRupiah: 700_000, oleh: "Admin", atasPerintah: "Ketua" });
    expect(await basis.queryAll(`SELECT id FROM aleta_ai_pagu WHERE bulan = '${bulanDari()}'`)).toHaveLength(1);
    expect((await keadaanPagu(basis)).pagu).toBe(700_000);
  });
});

// ── K4 keberhasilan pustaka ────────────────────────────────────────────────

async function tanamButir(basis: AletaDatabase, id: string, dibuatOleh: string) {
  await basis.run(
    `INSERT INTO aleta_pertimbangan_butir
       (id, sidik, teks, jenis_perkara, isu, syarat, jumlah_pemakaian, keadaan, atas_perintah, versi, dibuat_oleh, dibuat_at, diubah_at)
     VALUES (?, ?, 'Menimbang, bahwa ...', 'Cerai Gugat', '', '{}', 1, 'disahkan', 'Ketua', 1, ?, ?, ?)`,
    [id, `sidik-${id}`, dibuatOleh, SEKARANG, SEKARANG]
  );
}

async function tanamDraf(basis: AletaDatabase, drafId: string, butirId: string[]) {
  await basis.run(
    `INSERT INTO aleta_putusan_draf
       (id, perkara_id, nomor_perkara, versi, jenis_naskah, keadaan, naskah, siap, dibuat_at, diubah_at)
     VALUES (?, ?, '', 1, 'PUTUSAN', 'draf', '', 0, ?, ?)`,
    [drafId, `p-${drafId}`, SEKARANG, SEKARANG]
  );
  for (const [urutan, butir] of butirId.entries()) {
    await basis.run(
      `INSERT INTO aleta_putusan_draf_butir (id, draf_id, kunci_bagian, butir_id, urutan, teks_saat_itu, versi_butir, alasan)
       VALUES (?, ?, 'pertimbangan', ?, ?, '', 1, '[]')`,
      [`${drafId}-${urutan}`, drafId, butir, urutan]
    );
  }
}

describe("ukuran keberhasilan pustaka", () => {
  it("draf yang butirnya buatan model dihitung memakai model", async () => {
    // Dihitung dari asal butirnya, bukan dari tabel pemakaian: satu
    // percakapan yang tidak masuk draf mana pun akan menandai draf itu keliru.
    const basis = await basisData();
    await tanamButir(basis, "b-hakim", "");
    await tanamButir(basis, "b-model", "model:penyedia/model-kuat");
    await tanamDraf(basis, "d1", ["b-hakim"]);
    await tanamDraf(basis, "d2", ["b-hakim", "b-model"]);
    await tanamDraf(basis, "d3", []);

    const hasil = await keberhasilanPustaka(basis, "2000-01-01T00:00:00.000Z", "2100-01-01T00:00:00.000Z");
    expect(hasil.jumlahDraf).toBe(3);
    expect(hasil.tanpaModel).toBe(1);
    expect(hasil.denganModel).toBe(1);
    expect(hasil.tanpaButir).toBe(1);
    expect(hasil.persenTanpaModel).toBe(50);
  });
});

// ── K5 belajar dari suntingan ──────────────────────────────────────────────

describe("belajar dari suntingan", () => {
  it("butir yang sering ditolak muncul beserta alasan penolakannya", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "");
    for (let nomor = 0; nomor < 10; nomor += 1) {
      await basis.run(
        `INSERT INTO aleta_putusan_draf_butir
           (id, draf_id, kunci_bagian, butir_id, urutan, teks_saat_itu, versi_butir, alasan, keadaan, alasan_tolak)
         VALUES (?, ?, 'pertimbangan', 'b1', 0, '', 1, '[]', ?, ?)`,
        [
          `baris-${nomor}`,
          `draf-${nomor}`,
          nomor < 8 ? "ditolak" : "diterima",
          nomor < 8 ? "tidak sesuai fakta perkara" : "",
        ]
      );
    }

    const temuan = await temuanSuntingan(basis);
    expect(temuan).toHaveLength(1);
    expect(temuan[0].persenDitolak).toBe(80);
    expect(temuan[0].alasan).toContain("tidak sesuai fakta perkara");
  });

  it("butir yang jarang dipakai tidak muncul meski selalu ditolak", async () => {
    const basis = await basisData();
    await tanamButir(basis, "b1", "");
    await basis.run(
      `INSERT INTO aleta_putusan_draf_butir
         (id, draf_id, kunci_bagian, butir_id, urutan, teks_saat_itu, versi_butir, alasan, keadaan, alasan_tolak)
       VALUES ('x', 'd', 'pertimbangan', 'b1', 0, '', 1, '[]', 'ditolak', 'keliru')`
    );
    expect(await temuanSuntingan(basis)).toEqual([]);
  });
});

// ── K7 sumber aplikasi baru ────────────────────────────────────────────────

const SUMBER = {
  kode: "db_surat",
  nama: "Manajemen Surat",
  asal: "MySQL db_surat",
  hanyaBaca: true,
  umurWajarJam: 24,
  ruas: [{ nama: "db_suratNomor", batas: "samar" as const, keterangan: "Nomor surat menunjuk berkas nyata." }],
  didaftarkanOleh: "Pranata Komputer",
  atasPerintah: "Sekretaris",
};

describe("pendaftaran sumber aplikasi", () => {
  it("sumber lengkap terdaftar, tetapi BELUM aktif", async () => {
    // Pendaftaran adalah pernyataan niat; penyalaan adalah keputusan.
    const basis = await basisData();
    expect((await daftarkanSumber(basis, SUMBER)).ok).toBe(true);

    const baris = await basis.queryOne<Record<string, unknown>>(
      `SELECT aktif FROM aleta_sumber_aplikasi WHERE kode = 'db_surat'`
    );
    expect(Number(baris?.aktif)).toBe(0);
  });

  it("sumber yang belum aktif TIDAK melonggarkan penyaring J5", async () => {
    const basis = await basisData();
    await daftarkanSumber(basis, SUMBER);
    expect(await batasDariSumber(basis)).toEqual([]);

    await basis.run(`UPDATE aleta_sumber_aplikasi SET aktif = 1 WHERE kode = 'db_surat'`);
    const aturan = await batasDariSumber(basis);
    expect(aturan.map((item) => item.ruas)).toContain("db_suratNomor");
  });

  it("sumber yang tidak memenuhi syarat DITOLAK, tanpa menyisakan baris", async () => {
    const basis = await basisData();
    const hasil = await daftarkanSumber(basis, { ...SUMBER, hanyaBaca: false });
    expect(hasil.ok).toBe(false);
    expect(await basis.queryAll(`SELECT id FROM aleta_sumber_aplikasi`)).toHaveLength(0);
  });

  it("kode yang sama tidak dapat didaftarkan dua kali", async () => {
    const basis = await basisData();
    await daftarkanSumber(basis, SUMBER);
    const ulang = await daftarkanSumber(basis, SUMBER);
    expect(ulang.ok).toBe(false);
    expect(ulang.halangan.join(" ")).toContain("sudah terdaftar");
  });

  it("ruasnya terbaca kembali apa adanya", async () => {
    const basis = await basisData();
    await daftarkanSumber(basis, SUMBER);
    const daftar = await sumberTerdaftar(basis);
    expect(daftar[0].ruas[0].nama).toBe("db_suratNomor");
    expect(daftar[0].hanyaBaca).toBe(true);
  });
});

// ── K6 pemeriksaan keajekan berkala ────────────────────────────────────────

describe("pemeriksaan keajekan berkala", () => {
  it("belum pernah dijalankan berarti perlu dijalankan, dengan sebabnya", async () => {
    const basis = await basisData();
    const hasil = await perluDijalankan(basis);
    expect(hasil.perlu).toBe(true);
    expect(hasil.sebab).toContain("belum pernah");
  });

  it("baru dijalankan berarti belum perlu, dan sebabnya menyebut berapa hari", async () => {
    // "true" tidak dapat ditindaklanjuti; "sudah 9 hari" dapat.
    const basis = await basisData();
    await basis.run(
      `INSERT INTO aleta_keajekan_jalan (id, dijalankan_at, dijalankan_oleh, jumlah_perkara)
       VALUES ('j1', ?, 'aktor', 0)`,
      [new Date().toISOString()]
    );
    const hasil = await perluDijalankan(basis, 7);
    expect(hasil.perlu).toBe(false);
    expect(hasil.sebab).toContain("hari lalu");
  });

  it("lewat jaraknya berarti perlu dijalankan lagi", async () => {
    const basis = await basisData();
    const lama = new Date(Date.now() - 9 * 86_400_000).toISOString();
    await basis.run(
      `INSERT INTO aleta_keajekan_jalan (id, dijalankan_at, dijalankan_oleh, jumlah_perkara)
       VALUES ('j1', ?, 'aktor', 0)`,
      [lama]
    );
    const hasil = await perluDijalankan(basis, 7);
    expect(hasil.perlu).toBe(true);
    expect(hasil.sebab).toContain("9 hari");
  });

  it("riwayatnya terbaca terbaru lebih dulu", async () => {
    const basis = await basisData();
    for (const [nomor, hari] of [1, 5, 3].entries()) {
      await basis.run(
        `INSERT INTO aleta_keajekan_jalan (id, dijalankan_at, dijalankan_oleh, jumlah_perkara)
         VALUES (?, ?, 'aktor', 0)`,
        [`j${nomor}`, new Date(Date.now() - hari * 86_400_000).toISOString()]
      );
    }
    const riwayat = await riwayatKeajekan(basis);
    expect(riwayat).toHaveLength(3);
    expect(new Date(riwayat[0].dijalankanAt).getTime()).toBeGreaterThan(
      new Date(riwayat[2].dijalankanAt).getTime()
    );
  });
});

describe("tarif model - tanpanya pagu selamanya nol", () => {
  it("model tanpa tarif menghasilkan biaya nol, dan itu DISEBUT terpisah", async () => {
    // Cacat yang pernah ada: pagu dibangun tetapi tidak pernah dikonsultasikan,
    // dan biayanya selalu nol karena tarif tidak pernah ada. Rp 0 yang terbaca
    // sebagai hemat adalah pagu yang tidak pernah memperingatkan apa pun.
    const basis = await basisData();
    await catatDenganTarif(basis, {
      pekerjaan: "percakapan",
      tingkat: "hemat",
      penyedia: "p",
      model: "model-tanpa-tarif",
      teksMasuk: "x".repeat(4000),
      teksKeluar: "y".repeat(400),
      berhasil: true,
    });

    const rincian = await rincianBiaya(basis);
    expect(rincian.total).toBe(0);
    expect(rincian.tanpaTarif).toBe(1);
    expect(rincian.perkiraan).toBe(true);
  });

  it("sesudah tarif disetel, biayanya terhitung", async () => {
    const basis = await basisData();
    expect((await setelTarif(basis, { model: "m1", masukPerJuta: 100_000, keluarPerJuta: 0, oleh: "Admin" })).ok).toBe(true);

    await catatDenganTarif(basis, {
      pekerjaan: "percakapan",
      tingkat: "hemat",
      penyedia: "p",
      model: "m1",
      // 4.000.000 huruf ≈ 1.000.000 token perkiraan.
      teksMasuk: "x".repeat(4_000_000),
      teksKeluar: "",
      berhasil: true,
    });

    const rincian = await rincianBiaya(basis);
    expect(Math.round(rincian.total)).toBe(100_000);
    expect(rincian.tanpaTarif).toBe(0);
  });

  it("tarif ditimpa per model, bukan ditumpuk", async () => {
    const basis = await basisData();
    await setelTarif(basis, { model: "m1", masukPerJuta: 100, keluarPerJuta: 0, oleh: "A" });
    await setelTarif(basis, { model: "m1", masukPerJuta: 200, keluarPerJuta: 0, oleh: "A" });
    expect(await basis.queryAll(`SELECT id FROM aleta_ai_tarif WHERE model = 'm1'`)).toHaveLength(1);
    expect((await tarifModel(basis, "m1")).masuk).toBe(200);
  });

  it("tarif negatif ditolak", async () => {
    const basis = await basisData();
    expect((await setelTarif(basis, { model: "m1", masukPerJuta: -1, keluarPerJuta: 0, oleh: "A" })).ok).toBe(false);
  });

  it("perkiraan token dari panjang naskah, dan disebut perkiraan", () => {
    // Perkiraan yang disajikan sebagai angka pasti akan dibandingkan dengan
    // tagihan penyedia lalu dianggap kekeliruan sistem.
    expect(perkiraanToken("x".repeat(400))).toBe(100);
    expect(perkiraanToken("")).toBe(0);
  });
});
