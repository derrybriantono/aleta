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

  // Sejak 27 September 2026 lencana "+X"/"→Y" diganti tiga jarak bernama
  // (TigaJarakSidang). Janji butir ini TETAP: tetangganya disebut - kini
  // nomor antrian DAN nomor perkaranya - di title tiap angka. Perilakunya
  // (title yang sungguh tergambar) dijaga tiga-jarak-sidang.test.ts; di sini
  // hanya bahwa layar menyambungkan penyebutnya.
  it("layar menyebut nomor antrian tetangganya", () => {
    expect(layar).toContain("sebutTetangga={(tetangga) => sebutTetangga(tetangga, baris.tanggalSidang)}");
    expect(layar).toContain("`antrian ${tetangga.nomorAntrian}`");
  });

  it("tetangga yang TIDAK tampil dikatakan, bukan didiamkan", () => {
    // Justru keadaan itulah yang membuat dua angka yang benar terbaca
    // sebagai bertengkar.
    expect(layar).toContain("(perkara yang tidak tampil pada daftar ini)");
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

  it("dan tidak ikut dihitung sebagai error penarikan", () => {
    // ======================================================================
    // JENDELA TETAP 500 HURUF PERNAH MENELAN SELURUH CABANGNYA
    // ======================================================================
    //
    // Bentuk lama memotong 500 huruf dari "const tetap = " lalu mencari
    // "continue;" DI DALAM potongan itu. Begitu satu komentar ditambahkan ke
    // dalam cabang 404 - 25 Sep 2026, saat penandanya mulai ditulis ke basis
    // data - "continue;" jatuh di luar jendela, indexOf memulangkan -1, cabang
    // menjadi teks KOSONG, dan expect("").not.toContain(...) tetap hijau.
    // Penjaganya berhenti menjaga tanpa satu pun tanda.
    //
    // Penggantinya lebih ketat, bukan lebih longgar: batasnya dicari dari
    // seluruh berkas (bukan dari jendela), panjangnya ditagih supaya cabang
    // kosong menggagalkan uji, dan satu tuntutan baru ditambahkan.
    const mulai = tarik.indexOf("if (tetap) {");
    expect(mulai).toBeGreaterThan(-1);
    const cabang = tarik.slice(mulai, tarik.indexOf("continue;", mulai));
    expect(cabang.length).toBeGreaterThan(40);
    expect(cabang).not.toContain("ringkasan.jumlahGalat += 1");
    // "tidak diulang" harus tertulis di basis data, bukan hanya di log: tanpa
    // penanda, dokumennya tetap tanpa berkas, perkaranya tidak pernah terhitung
    // lengkap, dan halamannya dibuka ulang tiap putaran selamanya.
    expect(cabang).toContain("tidakTersediaPadaDokumen = true");
  });

  it("penandanya hanya dipasang bila TIDAK ada kegagalan sebab lain", () => {
    // "404 pada PDF, jaringan putus pada Word" tidak boleh ditandai tidak
    // tersedia - yang Word masih mungkin berhasil besok.
    const mulai = tarik.indexOf("if (adaYangBerhasil) {");
    expect(mulai).toBeGreaterThan(-1);
    const tutup = tarik.slice(mulai, mulai + 1200);
    expect(tutup).toContain("tidakTersediaPadaDokumen && !adaGagalLain");
    expect(tutup).toContain("lupakanTidakTersedia({ documentKey })");
  });

  /**
   * ==========================================================================
   * TEKS YANG DIPAKU BERGESER 25 SEP 2026 - BUKAN DILONGGARKAN
   * ==========================================================================
   *
   * Pengurutan giliran dipindahkan dari dalam utama() ke fungsi susunGiliran()
   * yang diekspor run.js, sebab cacat "lapis 0 tidak dapat pensiun" hanya
   * muncul pada penekanan KEDUA dan tidak ada penyisiran teks yang dapat
   * melihatnya. Akibat pemindahan itu `args.hanyaBelumAda` menjadi parameter
   * `hanyaBelumAda`, BATAS_TERBARU menjadi parameter `batasTerbaru` yang
   * bawaannya BATAS_TERBARU, dan daftarnya bernama `daftar`.
   *
   * Perilaku yang dijaga di sini TIDAK berubah, dan kini dijaga pula oleh uji
   * yang MENJALANKAN susunGiliran di penarikan-belum-ada.test.ts.
   */
  it("200 perkara terbaru didahulukan, giliran tetap berlaku di dalamnya", () => {
    expect(tarik).toContain("const BATAS_TERBARU =");
    expect(tarik).toContain("daftar.sort((a, b) => lapis(a) - lapis(b) || kapan(a) - kapan(b));");
  });

  it("lapis 0 hanya hidup pada mode belum-ada - aturan 200 terbaru tidak dicabut", () => {
    expect(tarik).toContain("hanyaBelumAda && belumPernah(url)");
    // Putaran terjadwal tetap memulai dari lapis 200-terbaru.
    const i = tarik.indexOf("const lapis = (url) =>");
    expect(i).toBeGreaterThan(-1);
    expect(tarik.slice(i, i + 320)).toContain("< batasTerbaru");
    // Dan bawaan parameternya tetap BATAS_TERBARU, bukan angka lepas.
    expect(tarik).toContain("batasTerbaru = BATAS_TERBARU");
  });

  it("sesi yang habis TIDAK dicoba lagi - itulah yang membuat akun ditandai", () => {
    expect(tarik).toContain('ringkasan.status = "sesi_habis"');
    expect(tarik).toContain("Penjadwal berhenti, tidak mencoba lagi");
  });
});
