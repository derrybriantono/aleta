// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * EMPAT PERMINTAAN TENTANG SAKLAR, JEDA, DAN PENARIKAN e-COURT
 * ============================================================================
 *
 *   17. saklar centang yang tidak menyala sampai dimatikan lalu dinyalakan
 *   18. seluruh saklar diperiksa, bukan hanya yang dilaporkan
 *   19. jeda antar-perkara pada Antrian Sidang yang tampak bertengkar
 *   20. penarikan e-Court: seluruh berkas, 200 terbaru, dan tidak terbaca bot
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const konten = baca("ekstensi-sipp/konten.js");
const abt = baca("ekstensi-sipp/abt.js");
const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const jarakLib = baca("manajemen_surat/src/lib/jarak-antar-sidang.ts");
const tarik = baca("aleta_bot/tools/ecourt-bridge/run.js");

// ===========================================================================
// BUTIR 17
// ===========================================================================

describe("butir 17 - saklar tercentang tetapi tidak menyala", () => {
  /**
   * segarkan() keluar lebih awal ketika nomor perkara dan borangnya sama.
   * Halaman perkara SIPP memuat isinya BERTAHAP - baris Jadwal Sidang, Data
   * Relaas, dan Data Persidangan datang lewat AJAX sesudah panel digambar -
   * sehingga penanda dan sisipan hanya pernah terpasang pada isi yang sudah
   * ada saat penggambaran pertama.
   *
   * Mematikan lalu menyalakan saklarnya menempuh jalur LAIN (pendengar
   * chrome.storage memanggil terapkanTanda langsung), dan itulah sebabnya ia
   * "baru muncul setelah dimatikan dulu".
   */
  it("penandaan diulang ketika isi halaman bertambah", () => {
    expect(konten).toContain("if (konteksTerakhir) await terapkanTanda(konteksTerakhir);");
  });

  it("pengulangannya di dalam pagar borang-sama, bukan menggantikan pagarnya", () => {
    // Panelnya TIDAK digambar ulang dan konteksnya TIDAK diminta ulang ke
    // portal - yang diulang hanya penandaannya.
    const i = konten.indexOf("const borang = tandaBorang();");
    const blok = konten.slice(i, i + 2000);
    expect(blok).toContain("if (borang === borangTerakhir) {");
    expect(blok).toContain("await terapkanTanda(konteksTerakhir);");
  });
});

// ===========================================================================
// BUTIR 18
// ===========================================================================

describe("butir 18 - seluruh saklar, bukan hanya yang dilaporkan", () => {
  it("salinan saklar disegarkan sekali tiap putaran penggambaran", () => {
    // Salinan di memori dapat basi tanpa berbunyi: tab yang dibekukan tidak
    // menerima onChanged, dan ekstensi yang dimuat ulang meninggalkan tab
    // lama tanpa pendengar sama sekali.
    expect(konten).toContain("async function muatSaklar(paksa = false)");
    expect(konten).toContain("if (saklar.siap && !paksa) return saklar;");
    expect(konten).toContain("await muatSaklar(true);");
  });

  it("kelima saklar punya pendengar atau pembacaan ulang", () => {
    // aktif, tandaiHalaman, sisipJadwal - lewat muatSaklar yang disegarkan.
    for (const kunci of ["aktif", "tandaiHalaman", "sisipJadwal"]) {
      expect(konten, kunci).toContain(`perubahan.${kunci}`);
    }
    // cetakTigaBerkas dan suntingLangsungAbt - dibaca ULANG sebelum dipakai,
    // sebab keduanya menentukan perbuatan yang tidak dapat diurungkan.
    expect(abt).toContain("async function saklarCetakSekarang()");
    expect(abt).toContain("async function suntingLangsungSekarang()");
    expect(abt).toContain("if (!(await suntingLangsungSekarang())) return;");
  });

  it("gagal membaca saklar perbuatan dianggap MATI, bukan menyala", () => {
    const i = abt.indexOf("async function suntingLangsungSekarang()");
    const blok = abt.slice(i, abt.indexOf("\n}", abt.indexOf("return suntingLangsungNyala;", i)));
    expect(blok).toContain("return false;");
  });
});

// ===========================================================================
// BUTIR 19
// ===========================================================================

describe("butir 19 - jeda yang tampak bertengkar", () => {
  /**
   * Dari tangkapan layar pengguna: antrian 1 bertulis "→35", antrian 2 tepat
   * di bawahnya bertulis "+4" - padahal 09:22 ke 10:01 berjarak 39 menit.
   * Keduanya benar; ada perkara yang dipanggil 09:57 di ruang yang sama dan
   * tidak ikut tergambar.
   */
  it("tetangganya dapat disebut namanya", () => {
    expect(jarakLib).toContain("export function petaTetanggaSebelum(");
    expect(jarakLib).toContain("export function petaTetanggaBerikut(");
  });

  it("layar menyebut nomor antrian tetangganya", () => {
    expect(layar).toContain("nomorSebelum={nomorPerKunci[tetanggaSebelum[kunci]]}");
    expect(layar).toContain("nomorBerikut={nomorPerKunci[tetanggaBerikut[kunci]]}");
    expect(layar).toContain("antrian ${nomorSebelum} dipanggil");
  });

  it("tetangga yang TIDAK tampil dikatakan, bukan didiamkan", () => {
    // Justru keadaan itulah yang membuat dua angka yang benar terbaca
    // sebagai bertengkar.
    expect(layar).toContain("TIDAK tampil pada daftar yang sedang disaring ini");
  });

  it("hitungannya sendiri TIDAK diubah", () => {
    // Yang diperbaiki cara membacanya, bukan angkanya. Mengubah angkanya
    // berarti mengganti satu kebingungan dengan kebingungan lain.
    expect(jarakLib).toContain("hasil[deret[i].kunci] = deret[i].menit - deret[i - 1].menit;");
    expect(jarakLib).toContain("hasil[deret[i].kunci] = deret[i + 1].menit - deret[i].menit;");
  });
});

// ===========================================================================
// BUTIR 20
// ===========================================================================

describe("butir 20 - penarikan e-Court", () => {
  /**
   * Diukur dari log penarikan 23 September 2026: 145 dari 168 galat berbunyi
   * 'Gagal unduh pdf "KTP": HTTP 404', dan jarak permintaannya 10-12 detik
   * nyaris rata - sebab PAGE_DELAY_MS bernilai TETAP.
   */
  it("jedanya tidak pernah sama - aturan tetap pengguna", () => {
    expect(tarik).toContain("function jedaManusiawi(");
    expect(tarik, "jeda tetap tidak boleh dipakai lagi").not.toContain("await sleep(PAGE_DELAY_MS);");
  });

  it("jedanya condong ke pendek, kadang berhenti lama, dan melambat saat ditolak", () => {
    const i = tarik.indexOf("function jedaManusiawi(");
    const blok = tarik.slice(i, tarik.indexOf("\n}", tarik.indexOf("return sleep(", i)));
    expect(blok).toContain("Math.random() * Math.random()");
    expect(blok).toContain("if (Math.random() < 0.05)");
    expect(blok).toContain("gagalBeruntun");
  });

  it("404 diperlakukan sebagai jawaban tetap, bukan kegagalan yang diulang", () => {
    expect(tarik).toContain("tidak tersedia di e-Court (404) - tidak diulang");
    expect(tarik).toContain("ringkasan.tidakTersedia");
  });

  it("dan tidak ikut dihitung sebagai galat penarikan", () => {
    const i = tarik.indexOf("const tetap = ");
    const blok = tarik.slice(i, i + 500);
    // Di dalam cabang 404 tidak boleh ada penambahan jumlahGalat.
    const cabang = blok.slice(blok.indexOf("if (tetap) {"), blok.indexOf("continue;"));
    expect(cabang).not.toContain("ringkasan.jumlahGalat += 1");
  });

  it("200 perkara terbaru didahulukan, giliran tetap berlaku di dalamnya", () => {
    expect(tarik).toContain("const BATAS_TERBARU =");
    expect(tarik).toContain("perluDiperiksa.sort((a, b) => lapis(a) - lapis(b) || kapan(a) - kapan(b));");
  });

  it("sesi yang habis TIDAK dicoba lagi - itulah yang membuat akun ditandai", () => {
    expect(tarik).toContain('ringkasan.status = "sesi_habis"');
    expect(tarik).toContain("Penjadwal berhenti, tidak mencoba lagi");
  });
});
