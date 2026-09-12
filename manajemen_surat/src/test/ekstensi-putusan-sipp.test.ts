// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * DUA FITUR PUTUSAN PADA EKSTENSI - DIJAGA DARI SUMBERNYA
 * ============================================================================
 *
 * Skrip ekstensi berjalan di halaman SIPP dan ABT, di peramban petugas. Tidak
 * ada satu pun uji yang dapat menjalankannya di sini: tanpa halaman SIPP,
 * tanpa CKEditor, tanpa sesi. Yang DAPAT dijaga adalah janji-janji yang bila
 * dilanggar berakibat pada dokumen resmi - dan ketiga janji di bawah ini
 * pernah hampir dilanggar justru ketika kodenya dirapikan.
 *
 * Uji semacam ini menjaga KALIMAT di dalam kode, jadi ia ikut menua bersama
 * kodenya. Itu diterima dengan sadar: harga yang dibayar kecil dibandingkan
 * satu putusan yang tersimpan tanpa dibaca.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (nama: string) => readFileSync(path.join(akar, "ekstensi-sipp", nama), "utf8");

describe("usulan ABT dapat disunting sebelum dimasukkan", () => {
  const abt = baca("abt.js");

  it("yang disimpan ke ABT adalah nilai yang terbaca saat Terapkan, bukan usulan semula", () => {
    // Kalau baris ini kembali memakai x.usulan.nilai, suntingan petugas
    // hilang tanpa satu pun tanda - dan yang masuk blangko adalah kalimat
    // mesin yang justru sudah ia perbaiki.
    expect(abt).toContain("const nilaiDipakai = x.nilai();");
    expect(abt).toContain("simpanVariabel(x.usulan.kode, nilaiDipakai, jatiDiri)");
  });

  it("penyaring centang memakai isi terkini, sehingga usulan kosong yang diisi sendiri ikut terpakai", () => {
    expect(abt).toContain("pilih.filter((x) => x.centang.checked && x.nilai())");
  });

  it("riwayat membedakan yang disunting petugas dari usulan mesin", () => {
    // Tanpa pembedaan ini, kalimat yang ditulis petugas tercatat seolah-olah
    // usulan mesin, dan yang membacanya kelak tidak dapat membedakan mana
    // yang diperiksa manusia.
    expect(abt).toContain("disunting petugas sebelum disimpan");
    expect(abt).toContain("diketik petugas di panel ALETA");
  });

  it("kotak suntingnya dapat dibatalkan dan dapat dicapai tanpa tetikus", () => {
    expect(abt).toContain('peristiwa.key === "Escape"');
    expect(abt).toMatch(/isi\.tabIndex = 0/);
    expect(abt).toContain('isi.setAttribute("role", "button")');
  });

  it("centang mengikuti ada-tidaknya isi, bukan usulan semula", () => {
    expect(abt).toContain("centang.disabled = !nilaiTerkini;");
  });

  it("gaya penanda suntingnya ada, sehingga kemampuan itu terlihat", () => {
    // Teks yang dapat diklik tanpa penanda apa pun bukan kemampuan,
    // melainkan rahasia.
    const css = baca("panel.css");
    expect(css).toContain(".aleta-abt-isi-sunting");
    expect(css).toContain(".aleta-abt-sunting-kotak");
  });
});

describe("mengisi borang putusan SIPP", () => {
  const konten = baca("konten.js");

  it("menekan Simpan HANYA bila seluruh isian masuk", () => {
    // ========================================================================
    // ATURANNYA BERUBAH DI 1.124.0 - DAN PENJAGANYA IKUT BERUBAH, BUKAN HILANG
    // ========================================================================
    //
    // Sampai 1.123.0 ALETA tidak pernah menekan Simpan di sini: yang tersimpan
    // menjadi putusan resmi, dan satu-satunya tempat manusia masih membacanya
    // adalah sebelum Simpan ditekan. Pagar itu dibuka atas permintaan
    // pengadilan, dan yang menggantikannya harus setara kuatnya.
    //
    // Penggantinya dua, dan keduanya dijaga di sini:
    //
    //   1. Borang yang belum utuh TIDAK PERNAH disimpan. Satu isian gagal
    //      berarti Simpan tidak ditekan sama sekali - putusan yang tersimpan
    //      setengah jadi jauh lebih buruk daripada borang yang menunggu.
    //   2. Tersimpannya DIBUKTIKAN dari SIPP, bukan diakui dari tombol yang
    //      berhasil ditekan.
    const bagian = konten.slice(
      konten.indexOf("function bagianIsiPutusan("),
      konten.indexOf("function bagianBacaBorang(")
    );
    expect(bagian.length).toBeGreaterThan(500);
    expect(bagian).toContain("Simpan TIDAK ditekan selama masih ada yang gagal.");
    expect(bagian).toContain("if (gagal.length > 0) {");
    expect(bagian).toContain("await simpanPutusanLaluBuka(nomorPerkara, hasilTerap)");
    // Tombolnya tidak ditekan langsung dari sini - ia lewat satu pintu yang
    // membuktikan hasilnya lebih dulu.
    expect(bagian).not.toContain('jenis: "tekan"');
  });

  it("mengisi ketiga editor lewat jembatan dengan jenis medan kaya", () => {
    // CKEditor menyimpan nilainya di obyek JavaScript, bukan di DOM.
    // Menyetel value pada textarea aslinya membuat tampilannya berubah tanpa
    // nilainya ikut - dan yang tersimpan kemudian bukan yang terlihat.
    expect(konten).toContain('jenisMedan: "kaya"');
    expect(konten).toContain('"#perhum"');
    expect(konten).toContain('"#amar"');
    expect(konten).toContain('"#amar_anonim"');
  });

  it("hanya digambar di halaman yang benar-benar memuat borang putusan", () => {
    expect(konten).toContain('document.querySelector("#frm_putusan")');
  });

  it("medan pilihan ditanyakan ke halaman, bukan dihafal aturannya", () => {
    // Faktor perceraian hanya muncul pada perkara cerai yang dikabulkan,
    // alasan dispensasi hanya pada dispensasi kawin, keadaan istri pada
    // keadaan tertentu lagi. Aturan itu milik SIPP; menyalinnya ke ekstensi
    // berarti menyimpang diam-diam pada hari SIPP mengubahnya.
    expect(konten).toContain('jenis: "pilihan"');
    expect(konten).toContain("jawabPilihan.tampak");
    expect(konten).toContain('select[name="faktor_cerai"]');
    expect(konten).toContain('select[name="alasan_dispen"]');
    expect(konten).toContain('select[name="keadaan_istri"]');
  });

  it("medannya ditunjuk lewat NAMA, bukan id - sebab id di borang itu kembar", () => {
    // Pada borang Putusan Akhir SIPP, select "status_reskom" memakai
    // id="faktor_cerai" - sama dengan select faktor perceraian.
    // querySelector("#faktor_cerai") memulangkan yang mana pun yang lebih dulu
    // di dokumen, dan pada hari urutannya berubah, faktor perceraian terisi
    // hasil reskom tanpa satu pun tanda.
    // Dipotong dari dalam bagianIsiPutusan lebih dulu. Nama seperti
    // "medanTampak" dipakai juga oleh bagian alasan Data Umum yang duduk lebih
    // atas di berkas ini; mencarinya di seluruh berkas memulangkan potongan
    // kosong, dan penjaga yang memeriksa potongan kosong selalu lulus.
    const seluruhPutusan = konten.slice(
      konten.indexOf("function bagianIsiPutusan("),
      konten.indexOf("function bagianBacaBorang(")
    );
    // Daftarnya kini berdiri di lingkup fungsi sebagai CALON_MEDAN_PANEL -
    // dibaca dua pihak: penyusun usulan dan penghitung medan tampak.
    const bagian = seluruhPutusan.slice(
      seluruhPutusan.indexOf("const CALON_MEDAN_PANEL"),
      seluruhPutusan.indexOf("async function bacaMedanTampak")
    );
    expect(bagian.length).toBeGreaterThan(200);
    expect(bagian).not.toMatch(/penunjuk:\s*"#/);
    expect(bagian).toContain('select[name="status_reskom"]');
  });

  it("radio nusyuz ikut ditawarkan, dan jembatan dapat mencentangnya", () => {
    // Radio tidak diisi dengan menyetel value - itu hanya mengubah nilai yang
    // dikirimkan kotaknya. Tanpa cabang khusus, nusyuz tampak terisi
    // sementara yang tersimpan tetap kosong.
    expect(konten).toContain('input[name="status_nusyuz"]');
    const jembatan = baca("jembatan.js");
    expect(jembatan).toContain('elemen.type === "radio"');
    expect(jembatan).toContain("cocok.checked = true");
  });

  it("usulan yang berselisih tidak dicentang sendiri", () => {
    expect(konten).toContain('usul.keyakinan !== "bentrok"');
  });

  it("medan pilihan diisi LEBIH DULU daripada teks panjang", () => {
    // Sebagian pilihan mengubah tampilan borang - qobla menentukan
    // muncul-tidaknya keadaan istri. Mengisinya belakangan berarti perubahan
    // itu terjadi ketika petugas sudah berhenti memperhatikan.
    const seluruhPutusan = konten.slice(
      konten.indexOf("function bagianIsiPutusan("),
      konten.indexOf("function bagianBacaBorang(")
    );
    const bagian = seluruhPutusan.slice(seluruhPutusan.indexOf("terap.addEventListener"));
    expect(bagian.length).toBeGreaterThan(200);
    const pilihanDulu = bagian.indexOf('jenisMedan: "pilih"');
    const teksKemudian = bagian.indexOf('jenisMedan: "kaya"');
    expect(pilihanDulu).toBeGreaterThan(-1);
    expect(teksKemudian).toBeGreaterThan(-1);
    expect(pilihanDulu).toBeLessThan(teksKemudian);
  });

  it("jembatan dapat membaca pilihan beserta tampak-tidaknya medan", () => {
    const jembatan = baca("jembatan.js");
    expect(jembatan).toContain("function bacaPilihan(");
    expect(jembatan).toContain('pesan.jenis === "pilihan"');
    expect(jembatan).toContain("offsetParent");
  });

  it("status putusan, verstek, dan sumber hukum diusulkan - tidak pernah dipatok", () => {
    // ========================================================================
    // DULU KETIGANYA TIDAK DISENTUH SAMA SEKALI - DAN ITU TERLALU LUAS
    // ========================================================================
    //
    // Sebabnya benar: pilihan pada ketiga medan itu sudah disaring SIPP
    // menurut jenis dan alur perkara, dan salah pilih di situ mengubah jenis
    // putusannya - bukan sekadar salah ketik.
    //
    // Tetapi menghindarinya seluruhnya memindahkan pekerjaan itu ke tangan,
    // tiap perkara, termasuk pada perkara yang naskahnya menyebut jawabannya
    // dengan terang. Status Putusan lebih buruk lagi: sebelum ia dipilih,
    // SIPP MENYEMBUNYIKAN faktor perceraian, nusyuz, qobla, dan keadaan istri
    // - sehingga menghindarinya ikut memutus jalan ke lima medan berikutnya.
    //
    // Yang dijaga sekarang bukan lagi "jangan disentuh", melainkan CARA
    // menyentuhnya - dan empat sifat di bawah inilah yang membuatnya aman.
    const bagian = konten.slice(
      konten.indexOf("function bagianIsiPutusan("),
      konten.indexOf("function bagianBacaBorang(")
    );

    // 1. Ketiganya ditawarkan.
    expect(bagian).toContain('select[name="status_putusan"]');
    expect(bagian).toContain('select[name="verstek"]');
    expect(bagian).toContain('input[name="sumber_hukum[]"]');

    // 2. Tidak satu pun NOMOR pilihan SIPP dihafal ekstensi. Yang dikirim ke
    //    portal adalah daftar pilihan yang benar-benar ada di borang yang
    //    sedang terbuka; SIPP tetap yang menyaringnya.
    expect(bagian).toContain("pilihan: x.pilihan");
    expect(bagian).not.toMatch(/nilai:\s*"\d+"/);

    // 3. template_amar TIDAK ditawarkan - ia menimpa Amar yang baru diisikan.
    //    Yang dilarang penunjuknya, bukan namanya: catatan di atas daftar
    //    memang menyebutnya, dan justru catatan itu yang menerangkan sebabnya.
    expect(bagian).not.toContain('name="template_amar"');

    // 4. Yang berselisih tidak pernah tercentang sendiri, dan Simpan tidak
    //    pernah ditekan dari sini.
    expect(bagian).toContain('usul.keyakinan !== "bentrok"');
    expect(bagian).not.toContain('jenis: "tekan"');
  });

  it("sumber hukum dicentang seluruhnya, bukan satu yang menang", () => {
    // Pada kotak centang, dua pilihan yang sama kuat bukan perselisihan
    // melainkan dua-duanya benar: putusan cerai yang khas menyebut
    // Undang-Undang, Kompilasi Hukum Islam, dan hukum syar'i sekaligus.
    const bagian = konten.slice(
      konten.indexOf("function bagianIsiPutusan("),
      konten.indexOf("function bagianBacaBorang(")
    );
    expect(bagian).toContain("banyak: true");
    expect(bagian).toContain("usul.nilaiBanyak");
    expect(bagian).toContain("const nilaiDipakai = satu.nilaiSemua || [];");
    expect(bagian).toContain("for (const nilai of nilaiDipakai)");
  });

  it("medan yang baru muncul sesudah Status Putusan ikut terkejar", () => {
    // Memilih "Dikabulkan" membuat SIPP memunculkan lima medan yang beberapa
    // detik sebelumnya belum ada di halaman. Tanpa pembacaan ulang, otomisasi
    // berhenti tepat di tempat yang paling banyak isiannya.
    const bagian = konten.slice(
      konten.indexOf("function bagianIsiPutusan("),
      konten.indexOf("function bagianBacaBorang(")
    );
    expect(bagian).toContain("async function hitungMedanTampak()");
    // Hanya bila BERTAMBAH - tanpa syarat itu, tiap pengisian memanggil
    // pembacaan berikutnya tanpa akhir.
    expect(bagian).toContain("if (tampakSesudah > medanTampak.length)");
  });

  it("bagian yang kosong pada draf disebut, bukan diisikan", () => {
    expect(konten).toContain("Belum terisi pada draf");
    expect(konten).toContain("Bagian itu tidak akan diisikan");
  });

  it("memakai rute portal yang memang ada", () => {
    expect(konten).toContain('const ALETA_API_ISIAN_PUTUSAN = "/aleta/api/aleta-ecourt/putusan/isian-sipp"');
    // Dan rutenya benar-benar ada di portal - alamat yang salah ketik hanya
    // terlihat ketika petugas menekan tombolnya.
    const rute = path.resolve(
      process.cwd(),
      "src/app/api/aleta-ecourt/putusan/isian-sipp/route.ts"
    );
    expect(readFileSync(rute, "utf8")).toContain("export async function GET");
  });
});
