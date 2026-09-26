// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENJAGA USULAN PERKARA LAIN (DK, PERWALIAN, ASAL USUL, HARTA BERSAMA)
 * ============================================================================
 *
 * Menjalankan abtUsulanLainService.dariPositaLain (kontrak K6) atas posita
 * contoh berbentuk templat PA Donggala. Nama diganti pengganti ('Xxxa'),
 * KUA dan kecamatan diganti ('Aaaa'), tanpa NIK dan alamat.
 *
 * Pagar yang dijaga: TIDAK SATU variabel pun diusulkan sebelum lulus gerbang
 * ukur (presisi >= 0,9 DAN n >= 10 atas isian manusia). Yang tidak lulus
 * ada di belumSiap beserta presisi dan n-nya - tidak diusulkan, dan tidak
 * hilang diam-diam.
 */

type UsulanLain = {
  kode: string;
  nama: string;
  nilai: string;
  keyakinan: string;
  sumber: { saksi: number; asal: string; kalimat: string }[];
  siap: boolean;
};
type HasilLain = {
  ok: boolean;
  jenis: string;
  usulan: UsulanLain[];
  belumSiap: { kode: string; alasan: string; presisi: number | null; n: number }[];
  alasan?: string;
  catatan?: string;
};
type LayananLain = {
  JENIS_LAIN: { kunci: string; jenisPerkaraId: number }[];
  ATURAN_LAIN: Record<string, { kode: string }[]>;
  GERBANG: { presisiMinimal: number; nMinimal: number };
  HASIL_UKUR: Record<string, Record<string, { n: number; presisi: number | null }>>;
  VARIABEL_SIAP: Record<string, string[]>;
  kenaliJenis: (jenis: unknown) => { kunci: string } | null;
  dariPositaLain: (posita: string, opsi: { jenisPerkara?: unknown; alur?: unknown }) => HasilLain;
};

const require_ = createRequire(import.meta.url);
const lain = require_(path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanLainService.js")) as LayananLain;

const DK_ANAK_PEREMPUAN = [
  "Bahwa para Pemohon telah menikah pada tanggal 26 September 2004 di Kantor Urusan Agama Kecamatan Aaaa, Kabupaten Bbbb, dan pernikahan tersebut telah dikaruniai 2 (dua) orang anak yang masing-masing bernama :",
  "Xxxa Yyya binti Zzza, umur 16 tahun",
  "Xxxc binti Zzza, umur 14 tahun",
  "Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Xxxa Yyya binti Zzza (calon mempelai wanita) dengan seorang laki-laki yang bernama Muh. Xxxb bin Zzzb (calon mempelai laki-laki), umur 21 tahun;",
  "Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Cccc, Kabupaten Dddd, guna mencatatkan pernikahan anak para Pemohon tersebut, namun ditolak dengan alasan belum cukup umur;",
  "Bahwa anak para Pemohon tersebut telah saling mengenal selama 1 tahun, dan hubungan mereka telah sedemikian eratnya;",
].join("\n");

// Anak para Pemohon laki-laki: urutan nama di kalimat menikahkan terbalik, dan
// umurnya hanya ada di kalimat "masih berumur 15 dan 16 tahun".
const DK_ANAK_LAKI = [
  "Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Xxxb bin Zzzb dengan Xxxa Yyya binti Zzzc;",
  "Bahwa syarat perkawinan anak para Pemohon bernama Xxxb bin Zzzb dan Xxxa Yyya binti Zzzc belum terpenuhi persyaratan umurnya, sampai saat ini masih berumur 15 dan 16 tahun;",
  "Bahwa para Pemohon telah melapor ke Kantor Urusan Agama Kecamatan Eeee, Kabupaten Ffff, guna mencatatkan pernikahan tersebut, namun ditolak;",
].join("\n");

const PERWALIAN =
  "Bahwa Pemohon adalah istri dari Alm. Xxxa bin Yyya (Suami Pemohon) yang telah meninggal dunia pada tanggal 3 Maret 2020; " +
  "Bahwa Pemohon hendak menjadi wali atas anak yang bernama Xxxc binti Xxxa untuk mengurus balik nama sertifikat tanah;";

const nilai = (h: HasilLain) => Object.fromEntries(h.usulan.map((u) => [u.kode, u.nilai]));

describe("dariPositaLain - dispensasi kawin", () => {
  it("anak perempuan: nama, umur, dan KUA yang MENOLAK (bukan KUA tempat orang tua menikah)", () => {
    const h = lain.dariPositaLain(DK_ANAK_PEREMPUAN, { jenisPerkara: 362 });
    expect(h.ok).toBe(true);
    expect(h.jenis).toBe("dispensasi-kawin");
    expect(nilai(h)).toEqual({
      "0606": "Xxxa Yyya binti Zzza",
      "0600": "Muh. Xxxb bin Zzzb",
      "0607": "16 tahun",
      "0601": "21 tahun",
      "3333": "Cccc, Kabupaten Dddd",
    });
    for (const u of h.usulan) {
      expect(u.siap).toBe(true);
      expect(u.sumber[0]).toMatchObject({ saksi: 0, asal: "posita" });
      expect(u.sumber[0].kalimat).not.toBe("");
    }
  });

  it("anak laki-laki: jenis kelamin dari bin/binti, umur dibagi menurut urutan nama", () => {
    const h = lain.dariPositaLain(DK_ANAK_LAKI, { jenisPerkara: "Dispensasi Kawin" });
    expect(nilai(h)).toMatchObject({
      "0606": "Xxxa Yyya binti Zzzc",
      "0600": "Xxxb bin Zzzb",
      "0607": "16 tahun",
      "0601": "15 tahun",
      "3333": "Eeee, Kabupaten Ffff",
    });
  });

  it("variabel yang gagal gerbang ada di belumSiap beserta angkanya, tidak diusulkan", () => {
    const h = lain.dariPositaLain(DK_ANAK_PEREMPUAN, { jenisPerkara: "dispensasi-kawin" });
    expect(h.belumSiap).toEqual([
      { kode: "5178", alasan: "n<10", presisi: 0.75, n: 8 },
      { kode: "1666", alasan: "n<10", presisi: 0.5, n: 8 },
    ]);
    expect(h.usulan.map((u) => u.kode)).not.toContain("1666");
  });
});

describe("gerbang ukur - berlaku untuk SEMUA jenis", () => {
  const CONTOH: Record<string, string> = {
    "dispensasi-kawin": DK_ANAK_PEREMPUAN,
    perwalian: PERWALIAN,
    "asal-usul": "Bahwa Pemohon telah menikah dengan wali nikah yaitu Xxxa (Ayah Kandung Pemohon) dan dihadiri saksi nikah bernama Xxxc dan Xxxd;",
    "harta-bersama": "Bahwa selama perkawinan Penggugat dan Tergugat memperoleh harta bersama berupa sebidang tanah;",
  };

  it.each(Object.keys(CONTOH))("%s: usulan hanya yang lulus, sisanya belumSiap, tidak ada yang hilang", (jenis) => {
    const h = lain.dariPositaLain(CONTOH[jenis], { jenisPerkara: jenis });
    expect(h.ok).toBe(true);
    const { presisiMinimal, nMinimal } = lain.GERBANG;
    for (const u of h.usulan) {
      const ukur = lain.HASIL_UKUR[jenis][u.kode];
      expect(ukur.n).toBeGreaterThanOrEqual(nMinimal);
      expect(ukur.presisi).toBeGreaterThanOrEqual(presisiMinimal);
    }
    for (const b of h.belumSiap) {
      const lulus = b.n >= nMinimal && b.presisi !== null && b.presisi >= presisiMinimal;
      expect(lulus, `${jenis}:${b.kode}`).toBe(false);
      expect(b.alasan).not.toBe("");
    }
    const semua = [...h.usulan.map((u) => u.kode), ...h.belumSiap.map((b) => b.kode)].sort();
    expect(semua).toEqual(lain.ATURAN_LAIN[jenis].map((a) => a.kode).sort());
  });

  it("daftar siap = hasil ukur 26 September 2026 (DK lima, jenis lain kosong)", () => {
    expect(lain.VARIABEL_SIAP).toEqual({
      "dispensasi-kawin": ["0606", "0600", "0607", "0601", "3333"],
      perwalian: [],
      "asal-usul": [],
      "harta-bersama": [],
    });
  });

  it("perwalian: n < 10 tetap belum siap walau presisinya 1", () => {
    const h = lain.dariPositaLain(PERWALIAN, { jenisPerkara: 354 });
    expect(h.usulan).toEqual([]);
    expect(h.belumSiap).toContainEqual({ kode: "0712", alasan: "n<10", presisi: 1, n: 5 });
  });

  it("harta bersama tanpa aturan terukur - disebut di catatan, bukan jawaban kosong diam-diam", () => {
    const h = lain.dariPositaLain(CONTOH["harta-bersama"], { jenisPerkara: 348 });
    expect(h.usulan).toEqual([]);
    expect(h.catatan).toMatch(/Harta Bersama/);
  });
});

describe("dariPositaLain - masukan yang tidak dilayani", () => {
  it("jenis perkara lain ditolak dengan alasan", () => {
    const h = lain.dariPositaLain(DK_ANAK_PEREMPUAN, { jenisPerkara: 346 });
    expect(h).toMatchObject({ ok: false, alasan: "jenis_perkara_tidak_dilayani", usulan: [] });
  });

  it("posita kosong ditolak dengan alasan", () => {
    expect(lain.dariPositaLain("  ", { jenisPerkara: 362 })).toMatchObject({ ok: false, alasan: "posita_kosong" });
  });

  it("jenis dikenali dari id SIPP, nama, atau kunci", () => {
    expect(lain.kenaliJenis(362)?.kunci).toBe("dispensasi-kawin");
    expect(lain.kenaliJenis("Perwalian")?.kunci).toBe("perwalian");
    expect(lain.kenaliJenis("asal-usul")?.kunci).toBe("asal-usul");
    expect(lain.kenaliJenis("Harta Bersama")?.kunci).toBe("harta-bersama");
    expect(lain.kenaliJenis("Cerai Gugat")).toBeNull();
  });
});
