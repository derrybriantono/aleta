/**
 * ============================================================================
 * PENILAIAN LANJUTAN YANG TIDAK LAGI KEHABISAN WAKTU
 * ============================================================================
 *
 * Petugas melaporkan penilaian lanjutan "nge-lag atau tidak berhasil", tanpa
 * menyebut analisis yang mana - dan ada tiga puluh satu. Ketiga puluh satunya
 * dijalankan atas perkara 565/Pdt.G/2026/PA.Dgl di salinan satker, satu per
 * satu, lalu diukur:
 *
 *              analisis        sebelum     sesudah
 *              pihak          59.844 ms    1.511 ms
 *              pasangan       28.201 ms    3.652 ms
 *              profil         13.571 ms    5.982 ms
 *              wilayah        10.383 ms    2.166 ms
 *              seluruh 31    139.958 ms   40.998 ms
 *
 * Gerbang portal menyerah pada 8 detik dan ekstensi pada 9. Enam puluh detik
 * karena itu tidak terbaca sebagai "lambat" melainkan "TIDAK BERHASIL" -
 * kuerinya berhasil, hanya tidak ada lagi yang menunggunya.
 *
 * Dua sebab, dan keduanya diukur - bukan ditebak:
 *
 *   1. v_pihak_perkara dipakai sepuluh kali. Yang dibaca hanya empat kolom;
 *      tampilannya memikul tujuh belas berikut sambungan ke tabel perkara,
 *      dan subkueri berkorelasi di dalamnya menahan saringan agar tidak dapat
 *      didorong masuk. Diganti tabel turunan empat kolom: 996 ms -> 77 ms.
 *
 *   2. riwayatPihak mengulang pencarian untuk TIAP pihak - sampai 20 pihak x
 *      3 tingkat, lalu diulang untuk saksi: seratus dua puluh kueri. Dan
 *      bentuk kuerinya sendiri memaksa gabungan pihak disusun utuh, sebab
 *      `pihak.nomor_indentitas` tidak berindeks. Dicatat per kueri: satu
 *      pencarian NIK 10.939 ms, satu pencarian saksi 6.327 ms.
 *
 *      Kini satu kueri per TINGKAT, dan tiap tingkat dua langkah - `pihak`
 *      disaring sendirian, lalu `perkara_pihak1..5` disaring lewat `pihak_id`
 *      yang memang berindeks. Sembilan kueri menggantikan seratus dua puluh.
 *
 * TIDAK ada indeks baru yang ditambahkan ke basis data pengadilan. Menambah
 * indeks pada tabel SIPP adalah perubahan skema milik satker, bukan milik alat
 * yang menumpang membacanya.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const sumber = readFileSync(
  path.join(AKAR, "aleta_bot/services/analisaLanjutService.js"),
  "utf8"
).replace(/\r\n/g, "\n");

describe("tampilan v_pihak_perkara tidak dipakai lagi", () => {
  it("tidak ada satu pun kueri yang menyebutnya", () => {
    // Namanya masih boleh berdiri di dalam keterangan - di sanalah sebabnya
    // dijelaskan. Yang tidak boleh kembali FROM dan JOIN-nya.
    expect(sumber).not.toMatch(/FROM\s+v_pihak_perkara/);
    expect(sumber).not.toMatch(/JOIN\s+v_pihak_perkara/);
  });

  it("digantikan tabel turunan berisi empat kolom yang memang dibaca", () => {
    expect(sumber).toContain("const PIHAK_PERKARA = `(");
    for (const cabang of [1, 2, 3, 4, 5]) {
      expect(sumber, `cabang ${cabang}`).toContain(`FROM perkara_pihak${cabang}`);
    }
    // Empat kolom, tidak lebih: perkara_id, pihak_id, pihak_ke, nama.
    expect(sumber).toContain("SELECT perkara_id, pihak_id, 1 AS pihak_ke, nama FROM perkara_pihak1");
  });

  it("angka ukurannya ikut tercatat di sumbernya", () => {
    expect(sumber).toContain("59.844");
    expect(sumber).toContain("996 ms");
  });
});

describe("riwayat pihak tidak lagi satu kueri per pihak", () => {
  it("dicari per TINGKAT, bukan per pihak", () => {
    expect(sumber).toContain("const jalankanTingkat = async (");
    // Gelung lama - satu pencarian di dalam `for (const satu of pihak)` -
    // tidak boleh kembali.
    expect(sumber).not.toContain('cariPihak(\n        "ph.nomor_indentitas = ?');
    expect(sumber).not.toContain('cariSaksi("p5.pihak_id = ?", [idOrang])');
  });

  it("dua langkah: pihak disaring sendirian, lalu pihak_id yang berindeks", () => {
    expect(sumber).toContain("const cariOrang = (syarat, params) =>");
    expect(sumber).toContain("const perkaraOrang = (idOrang, batas) =>");
    expect(sumber).toContain("FROM perkara_pihak1 WHERE pihak_id IN (${tandaId})");
    expect(sumber).toContain("WHERE p5.pihak_id IN (${tandaId})");
  });

  it("kunci pencocokan dipulangkan supaya temuan tetap tahu miliknya siapa", () => {
    // Inilah yang dahulu dijamin oleh gelung per pihak. Tanpa ini, temuan
    // satu orang akan dicatat atas nama orang lain pada perkara yang sama.
    expect(sumber).toContain("vp.pihak_id AS pihakIdCocok");
    expect(sumber).toContain("idKeAsal.get(String(t.pihakIdCocok))");
    expect(sumber).toContain("idSaksi.get(String(row.pihakIdCocok))");
  });

  it("batasnya naik menurut jumlah pihak, dengan langit-langit", () => {
    // Batas 30 yang tetap akan membuat pihak terakhir kehabisan jatah gara-gara
    // pihak pertama, begitu pencariannya digabung.
    expect(sumber).toContain("const batasBersama = Math.min(600,");
  });

  it("tidak menambah indeks pada basis data pengadilan", () => {
    expect(sumber).not.toMatch(/\bCREATE\s+INDEX\b/i);
    expect(sumber).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(sumber).toContain("perubahan skema milik satker");
  });
});
