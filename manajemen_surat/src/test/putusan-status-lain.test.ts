// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { nilaiPraperiksa, type FaktaPraperiksa } from "@/lib/praperiksa-putusan";

/**
 * ============================================================================
 * PUTUSAN BERSTATUS SELAIN DIKABULKAN
 * ============================================================================
 *
 * Diminta pengguna 22 September 2026: "tambahkan fitur upload putusan dengan
 * status putusan lain seperti contoh putusan cabut, gugur, tidak diterima,
 * digugurkan, tolak" - beserta tangkapan layar halaman putusan CABUT dan satu
 * kalimat yang menyebut sebabnya: "disitu dicermati banyak tab yang tidak
 * ada".
 *
 * ============================================================================
 * APA YANG SEBENARNYA RUSAK
 * ============================================================================
 *
 * SIPP menyusun halaman Putusan Akhir BERBEDA menurut statusnya. Perkara yang
 * dicabut tidak punya Pertimbangan Hukum maupun Amar Anonim di halamannya.
 *
 * Ekstensi menggambar ketiganya apa pun statusnya, lalu mencoba mengisi yang
 * tidak ada. Jembatan menjawab "medan_tidak_ketemu", panel menghitungnya
 * sebagai GAGAL, dan pagar "selama masih ada yang gagal, Simpan tidak
 * ditekan" menghentikan seluruh pengisian - pada justru jenis perkara yang
 * paling sederhana dan paling banyak jumlahnya.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const konten = baca("ekstensi-sipp/konten.js");

/** Fakta SIPP paling sederhana yang membuat pemeriksaan berjalan. */
function faktaDasar(): FaktaPraperiksa {
  return {
    nomorPerkara: "100/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    petitum: "",
    pihak: [],
    anak: [],
    majelis: [],
    jadwal: [],
    putusan: { ada: false, tanggalPutusan: "", statusPutusan: "", verstek: "" },
    ecourt: { terdaftar: null, pihak: [] },
    libur: null,
    hariIni: "2026-09-22",
  };
}

const jalankan = (statusPutusan: string, amar: string) =>
  nilaiPraperiksa(faktaDasar(), {
    nomorPerkara: "100/Pdt.G/2026/PA.Dgl",
    tanggalPutusan: "",
    statusPutusan,
    verstek: "",
    amar,
  });

const kode = (hasil: ReturnType<typeof nilaiPraperiksa>) =>
  hasil.temuan.map((t) => `${t.kode}:${t.tingkat}`);

describe("kelima status yang disebut pengguna dikenali agen", () => {
  // Status yang TIDAK dikenali membuat pemeriksaan padanan amar dilewati
  // diam-diam. Yang terbaca petugas hanya "tidak dikenali" - kalimat yang
  // mudah dilewati - dan amar yang tertukar lolos tanpa ditahan.
  const COCOK: Array<[string, string]> = [
    ["Dicabut", "Menyatakan perkara Nomor 100 dicabut."],
    ["Gugur", "Menyatakan gugatan Penggugat gugur."],
    ["Digugurkan", "Menggugurkan gugatan Penggugat."],
    ["Tidak Dapat Diterima", "Menyatakan gugatan Penggugat tidak dapat diterima."],
    ["Tidak Diterima", "Menyatakan gugatan Penggugat tidak diterima."],
    ["Ditolak", "Menolak gugatan Penggugat seluruhnya."],
  ];

  for (const [status, amar] of COCOK) {
    it(`"${status}" dikenali, dan amarnya yang benar TIDAK ditahan`, () => {
      const hasil = jalankan(status, amar);
      expect(kode(hasil), `status ${status} tidak dikenali`).not.toContain(
        "status-tidak-dikenali:catatan"
      );
      expect(hasil.hentikan, `status ${status} ditahan padahal amarnya cocok`).toBe(false);
    });
  }

  it("status yang tertukar dengan amarnya TETAP ditahan", () => {
    // Pagar ini yang tidak boleh ikut longgar saat status lain ditambahkan:
    // kalau semuanya lolos, agennya berhenti berguna.
    const hasil = jalankan("Dicabut", "Mengabulkan gugatan Penggugat seluruhnya.");
    expect(hasil.hentikan).toBe(true);
    expect(kode(hasil)).toContain("status-vs-amar:hentikan");
  });
});

describe("aduan amar-petitum tidak dipaksakan pada status yang bukan dikabulkan", () => {
  it("cabut, gugur, tidak diterima, tolak - aduannya dilewati dengan sebab tertulis", () => {
    // Mengadu petitum talak dengan amar pencabutan menghasilkan "seluruh
    // petitum belum terjawab": benar secara hitungan, kosong secara makna -
    // dan perhatian yang selalu muncul berhenti dibaca.
    for (const [status, amar] of [
      ["Dicabut", "Menyatakan perkara dicabut."],
      ["Gugur", "Menyatakan gugatan gugur."],
      ["Tidak Diterima", "Menyatakan gugatan tidak diterima."],
      ["Ditolak", "Menolak gugatan Penggugat."],
    ] as Array<[string, string]>) {
      const hasil = jalankan(status, amar);
      expect(kode(hasil), `aduan tidak dilewati untuk ${status}`).toContain(
        "aduan-tidak-berlaku:catatan"
      );
    }
  });
});

/**
 * ============================================================================
 * KETIGA BAGIAN NASKAH DIGAMBAR APA PUN STATUSNYA
 * ============================================================================
 *
 * Versi 1.162.0 menyelidiki lebih dulu apakah #perhum, #amar, dan
 * #amar_anonim ada di halaman, lalu hanya menggambar yang ada. Premisnya
 * SALAH dan dicabut pada 1.163.0. Dua bukti, keduanya dapat diperiksa:
 *
 *   1. Koreksi pengguna: pada status Dicabut borangnya TETAP punya keenam
 *      medan itu; yang hilang justru medan PILIHAN.
 *
 *   2. Sumber SIPP-nya (edit_putusan_akhir.php): medan yang hilang itu
 *      disembunyikan dengan jQuery .hide() - elemennya tetap di DOM. Jadi
 *      penyelidikan keberadaan tidak pernah dapat menyaringnya, dan
 *      kalimat yang ditulisnya tidak pernah diperiksa.
 *
 * Penjaga ini memastikan penyelidikan itu tidak kembali diam-diam.
 */
describe("ekstensi: ketiga bagian naskah, apa pun statusnya", () => {
  it("digambar dari daftar TETAP - tidak ada penyelidikan keberadaan", () => {
    const i = konten.indexOf("const daftar = [\n      barisIsian(\"Pertimbangan Hukum\"");
    expect(i, "daftar naskah tetap tidak ditemukan").toBeGreaterThan(-1);
    const blok = konten.slice(i, konten.indexOf("for (const satu of daftar)", i));
    expect(blok).toContain('barisIsian("Amar Putusan", "#amar"');
    expect(blok).toContain('barisIsian(\n        "Amar Anonim",\n        "#amar_anonim"');
    // Nama-nama peninggalan penyelidikan yang dicabut tidak boleh kembali.
    expect(konten, "penyelidikan keberadaan kembali").not.toContain("const adaDiBorang = []");
    expect(konten).not.toContain("tidakAdaDiBorang");
    expect(konten).not.toContain("hilangBerisi");
  });

  it("sebab pencabutannya TERTULIS, supaya tidak dicoba ulang", () => {
    expect(konten).toContain("Premisnya\n    // SALAH");
    expect(konten).toContain("jQuery .hide()");
  });

  it("penyaring medan pilihan TETAP memeriksa `tampak`", () => {
    // Inilah penyaring yang memang bekerja: `tampak` dihitung dari
    // offsetParent, yang justru mengenali .hide() milik SIPP.
    const i = konten.indexOf("async function bacaMedanTampak()");
    expect(i).toBeGreaterThan(-1);
    const blok = konten.slice(i, i + 900);
    expect(blok).toContain("!jawabPilihan.tampak");
  });

  it("pagar 'ada yang gagal = Simpan tidak ditekan' TIDAK dilonggarkan", () => {
    expect(konten).toContain("Simpan TIDAK ditekan selama masih ada yang gagal.");
    expect(konten).toContain("Simpan tidak ditekan");
  });
});

/**
 * ============================================================================
 * YANG SESUNGGUHNYA MERUSAK PERKARA CABUT
 * ============================================================================
 *
 * Panel menuliskan Status Putusan usulan ALETA ke borang tanpa melihat apa
 * yang sudah ada di sana. Petugas yang sudah memilih "Dicabut" mendapati
 * pilihannya berganti sendiri menjadi usulan ALETA - yang pada sebagian besar
 * perkara berbunyi "Dikabulkan".
 *
 * Akibatnya bukan tampilan: status putusan yang keliru tersimpan ke perkara
 * orang, lalu mengalir ke laporan dan ke Direktori Putusan. Dan praperiksa
 * sudah dijalankan SEBELUMNYA, atas status yang lama - jadi status baru itu
 * tidak pernah diadu dengan amar drafnya oleh siapa pun.
 */
describe("ekstensi: pintu yang sudah dipilih petugas tidak ditimpa", () => {
  const blokPintu = () => {
    const i = konten.indexOf("PINTU YANG SUDAH DIPILIH PETUGAS TIDAK PERNAH DITIMPA");
    expect(i, "blok pintu tidak ditemukan").toBeGreaterThan(-1);
    return konten.slice(i, konten.indexOf("if (!adaYangDibuka) break;", i));
  };

  it("nilai yang sedang ada di borang DIBACA sebelum menulis", () => {
    const blok = blokPintu();
    expect(blok).toContain("nilaiSekarang");
    expect(blok).toContain("const sudahDipilihOrang =");
  });

  it('"-1" dan kosong sama-sama dianggap BELUM dipilih', () => {
    // "-1" adalah "Pilih Status Putusan" milik SIPP. Menganggapnya pilihan
    // membuat pintunya tidak pernah dibuka, dan medan di baliknya tidak
    // pernah terbaca - kebalikan cacatnya, sama-sama diam.
    const blok = blokPintu();
    expect(blok).toContain('nilaiSekarang !== ""');
    expect(blok).toContain('nilaiSekarang !== "-1"');
  });

  it("yang sudah dipilih dilewati, bukan ditulis", () => {
    const blok = blokPintu();
    const i = blok.indexOf("if (sudahDipilihOrang) {");
    expect(i, "cabang lewati tidak ada").toBeGreaterThan(-1);
    const cabang = blok.slice(i, blok.indexOf("continue;", i));
    expect(cabang, "masih menulis ke borang").not.toContain('jenis: "isi"');
  });

  it("selisih pendapatnya DISEBUTKAN, tidak didiamkan", () => {
    expect(konten).toContain("const bedaPintu = []");
    expect(konten).toContain("ALETA membacanya lain");
    // Dan disebut bahwa praperiksa berpegang pada pilihan yang sekarang -
    // tanpa itu, yang membacanya mengira rapornya menilai usulan ALETA.
    expect(konten).toContain("Praperiksa di atas dijalankan atas pilihan yang SEKARANG");
  });

  it("kalimat lama yang mengaku sudah memilihkan TIDAK kembali", () => {
    expect(konten).not.toContain("Status Putusan sudah dipilihkan lebih dulu");
    expect(konten).toContain("yang sudah Anda pilih TIDAK disentuh");
  });
});
