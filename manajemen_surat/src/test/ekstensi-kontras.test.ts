import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * KONTRAS WARNA DIUKUR, BUKAN DINILAI DENGAN MATA
 * ============================================================================
 *
 * Sesi pengembangan yang memperbaiki tema gelap ABT menghitung kontras ini
 * TIGA KALI dengan skrip sekali pakai, lalu membuang skripnya. Angkanya
 * meyakinkan pada saat itu dan tidak menjaga apa pun sesudahnya: palet dapat
 * digeser satu warna, dan tidak ada yang memberi tahu sampai ada yang
 * mengeluh matanya sakit.
 *
 * Yang diukur di sini pasangan yang BENAR-BENAR bertemu di layar - tulisan di
 * atas latarnya - bukan seluruh kemungkinan gabungan. Nilainya diambil dari
 * panel.css apa adanya, sehingga menggeser palet tanpa menghitung ulang akan
 * menggagalkan uji ini lebih dulu.
 *
 * ============================================================================
 * KEADAAN SEBELUMNYA, DISIMPAN SEBAGAI PEMBANDING
 * ============================================================================
 *
 * Sebelum peta warna ABT dibuat, tulisan ABT asli berdiri di atas latar gelap
 * ALETA dan hasilnya diukur begini:
 *
 *   nama variabel  green   #008000  3,61:1  gagal
 *   isi variabel   blue    #0000ff  2,16:1  gagal
 *   judul                  #262c38  1,32:1  gagal - praktis tidak terlihat
 *
 * Ketiganya disimpan sebagai uji tersendiri di bawah: bukan untuk menjaga
 * keadaan lama, melainkan supaya angka yang menjadi sebab perbaikan ini tidak
 * hilang dari catatan. Yang membaca kode ini setahun lagi perlu tahu bahwa
 * ambangnya bukan selera.
 */

/** Ambang WCAG untuk teks biasa. */
const AA = 4.5;
const AAA = 7;

function luminansi(heks: string): number {
  const n = heks.replace("#", "");
  const ruas = [0, 2, 4]
    .map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * ruas[0] + 0.7152 * ruas[1] + 0.0722 * ruas[2];
}

function rasio(depan: string, belakang: string): number {
  const a = luminansi(depan);
  const b = luminansi(belakang);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const gaya = readFileSync(
  path.resolve(process.cwd(), "..", "ekstensi-sipp", "panel.css"),
  "utf8"
);

/**
 * Nilai satu peubah warna, DIBACA dari panel.css.
 *
 * Dibaca dan bukan ditulis ulang di sini: peubah yang disalin ke dalam uji
 * berhenti menjaga apa pun begitu palet di berkas gayanya digeser. Yang dicari
 * kemunculan di dalam blok tema gelap SIPP.
 */
function peubah(nama: string): string {
  const pola = new RegExp(`${nama}:\\s*(#[0-9a-fA-F]{6})`);
  const cocok = gaya.match(pola);
  expect(cocok, `peubah ${nama} tidak ditemukan di panel.css`).not.toBeNull();
  return (cocok as RegExpMatchArray)[1];
}

/**
 * Nilai satu peubah pada palet TERTENTU - kosong berarti palet dasar.
 *
 * Sejak 1.127.0 super admin dapat memilih enam palet gelap, dan tiap palet
 * menimpa tokennya sendiri. Kontras yang hanya diukur pada palet dasar
 * berhenti menjaga apa pun begitu palet lain dipilih - dan palet neon serta
 * pastel justru yang paling mudah jatuh di bawah AAA.
 */
function peubahPalet(nama: string, palet: string): string {
  const jangkar = palet
    ? `html[data-aleta-warna="${palet}"][data-aleta-tema-sipp="gelap"] {`
    : 'html[data-aleta-tema-sipp="gelap"] {';
  const i = gaya.indexOf(jangkar);
  expect(i, `palet ${palet || "dasar"} tidak ada di panel.css`).toBeGreaterThan(-1);
  const blok = gaya.slice(i, gaya.indexOf("\n}", i));
  const cocok = blok.match(new RegExp(`${nama}:\\s*(#[0-9a-fA-F]{6})`));
  // Palet yang tidak menimpanya mewarisi nilai dasar - itu memang cara kerja
  // token, bukan kekurangan.
  return cocok ? cocok[1] : peubah(nama);
}

/**
 * Warna yang berlaku pada satu aturan: angka apa adanya, atau nilai TOKENNYA.
 *
 * Sejak 1.127.0 peta gelap tidak lagi menulis angka - seluruhnya var(--s-*),
 * supaya palet yang dipilih berlaku menyeluruh. Pembaca yang hanya mengenali
 * angka karena itu berhenti menemukan apa pun, dan uji kontras yang tidak
 * menemukan warnanya bukan lulus - ia berhenti mengukur.
 */
function warnaAturan(pemilih: string, sifat: string, palet = ""): string {
  const i = gaya.indexOf(pemilih);
  expect(i, `pemilih ${pemilih} tidak ada di panel.css`).toBeGreaterThan(-1);
  const blok = gaya.slice(i, gaya.indexOf("}", i));
  const angka = blok.match(new RegExp(`${sifat}:\\s*(#[0-9a-fA-F]{6})`));
  if (angka) return angka[1];
  const token = blok.match(new RegExp(`${sifat}:\\s*var\\((--[a-z0-9-]+)`));
  expect(token, `${sifat} tidak ada di ${pemilih}`).not.toBeNull();
  return peubahPalet((token as RegExpMatchArray)[1], palet);
}

describe("tema gelap ABT terbaca, dan itu diukur", () => {
  const latar = () => peubah("--s-latar");
  const permukaan = () => peubah("--s-permukaan");
  const permukaan2 = () => peubah("--s-permukaan-2");
  const hijauTua = () => peubah("--s-hijau-tua");
  const tulisan = () => peubah("--s-tulisan");

  it("nama variabel, isi, dan isi kosong seluruhnya di atas AAA", () => {
    // Ketiganya tulisan yang ditulis INLINE oleh views/abt/view.php, dan
    // ketiganya berdiri di atas permukaan tabel.
    const pasangan: Array<[string, string]> = [
      ["nama variabel (hijau)", warnaAturan('[style*="color:green"]', "color")],
      ["isi variabel (biru)", warnaAturan('[style*="color:blue"]', "color")],
      ["isi kosong (merah)", warnaAturan('[style*="color:red"]', "color")],
    ];
    for (const [nama, depan] of pasangan) {
      expect(rasio(depan, permukaan()), `${nama} di atas permukaan tabel`).toBeGreaterThanOrEqual(
        AAA
      );
      expect(rasio(depan, permukaan2()), `${nama} di baris selang-seling`).toBeGreaterThanOrEqual(
        AAA
      );
    }
  });

  it("judul jenis perkara dan nomornya terbaca di atas ground", () => {
    // "Cerai Gugat" praktis tidak terlihat sebelum peta warnanya ada: 1,32:1.
    expect(rasio(tulisan(), latar())).toBeGreaterThanOrEqual(AAA);
    expect(
      rasio(warnaAturan(".w3l_header span", "color"), latar()),
      "nomor perkara"
    ).toBeGreaterThanOrEqual(AAA);
  });

  it("kepala tabel terbaca di atas hijau tua", () => {
    expect(rasio("#dff0e6", hijauTua())).toBeGreaterThanOrEqual(AAA);
  });

  it("blok kuning penyalur 4020 tidak menyilaukan dan tetap terbaca", () => {
    // <mark> bawaan peramban berlatar kuning terang - satu-satunya benda yang
    // menyilaukan di halaman gelap.
    const i = gaya.indexOf('data-aleta-tema-sipp="gelap"] mark');
    expect(i, "aturan mark tidak ada").toBeGreaterThan(-1);
    const blok = gaya.slice(i, gaya.indexOf("}", i));
    const latarMark = blok.match(/background:\s*(#[0-9a-fA-F]{6})/)?.[1] as string;
    const tulisanMark = blok.match(/color:\s*(#[0-9a-fA-F]{6})/)?.[1] as string;
    expect(rasio(tulisanMark, latarMark)).toBeGreaterThanOrEqual(AAA);
    // Latarnya harus GELAP - itu inti keluhannya, bukan kontrasnya saja.
    expect(luminansi(latarMark)).toBeLessThan(0.2);
  });

  it("ketiga tombol ABT tetap terbaca sesudah diredupkan", () => {
    for (const [pemilih, ambang] of [
      [".sembilan", AAA],
      [".delapan", AAA],
      [":is(.button_one, a.button_one)", AAA],
    ] as Array<[string, number]>) {
      const i = gaya.indexOf(pemilih);
      expect(i, `${pemilih} tidak ada`).toBeGreaterThan(-1);
      const blok = gaya.slice(i, gaya.indexOf("}", i));
      const bg = blok.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{6})/)?.[1] as string;
      const fg = blok.match(/(?<!background-)color:\s*(#[0-9a-fA-F]{6})/)?.[1] as string;
      expect(rasio(fg, bg), pemilih).toBeGreaterThanOrEqual(ambang);
    }
  });
});

describe("keadaan sebelum peta warna ABT ada - angka yang menjadi sebabnya", () => {
  // Bukan untuk menjaga keadaan lama. Disimpan supaya ambang di atas tidak
  // terbaca sebagai selera: inilah yang dilaporkan sebagai "garis dan
  // tulisannya tidak nampak", dan inilah angkanya.
  const LATAR_GELAP = "#0d1512";

  it("hijau tua ABT di atas latar gelap GAGAL AA", () => {
    expect(rasio("#008000", LATAR_GELAP)).toBeLessThan(AA);
  });

  it("biru ABT di atas latar gelap GAGAL AA - yang terburuk dari ketiganya", () => {
    expect(rasio("#0000ff", LATAR_GELAP)).toBeLessThan(3);
  });

  it("judul ABT di atas latar gelap praktis tidak terlihat", () => {
    expect(rasio("#262c38", LATAR_GELAP)).toBeLessThan(1.5);
  });
});

/**
 * ============================================================================
 * KEENAM PALET SUPER ADMIN DIUKUR, BUKAN DIPERCAYA
 * ============================================================================
 *
 * Paletnya diambil dari artikel dark-mode yang menyusunnya untuk laman
 * PEMASARAN - tulisan putih murni, aksen neon, pastel di atas kelabu terang.
 * Yang enak dipandang di laman promosi belum tentu terbaca pada panel yang
 * memuat nomor perkara dan nama pihak selama berjam-jam.
 *
 * Karena itu tiap palet diukur di sini, bukan dipercaya. Nilainya dibaca dari
 * panel.css sendiri: palet yang kelak digeser warnanya akan gagal di sini
 * lebih dulu, sebelum ada yang membacanya di layar.
 */
describe("enam palet gelap super admin terbaca, dan itu diukur", () => {
  const PALET = ["", "arang", "neon", "hangat", "pastel", "permata", "vibran"];

  for (const palet of PALET) {
    const nama = palet || "dasar (hijau SIPP)";

    it(`${nama}: tulisan badan di atas latar dan permukaan memenuhi AAA`, () => {
      const tulisan = peubahPalet("--s-tulisan", palet);
      for (const [labelLatar, warna] of [
        ["latar", peubahPalet("--s-latar", palet)],
        ["permukaan", peubahPalet("--s-permukaan", palet)],
        ["permukaan-3", peubahPalet("--s-permukaan-3", palet)],
      ] as const) {
        expect(rasio(tulisan, warna), `${nama}: tulisan di atas ${labelLatar}`).toBeGreaterThanOrEqual(AAA);
      }
    });

    it(`${nama}: tulisan lembut tetap memenuhi AA`, () => {
      // Lembut memang lebih redup - ia keterangan, bukan isi. AA batas
      // terendah yang masih dapat dibaca orang yang matanya lelah.
      const lembut = peubahPalet("--s-tulisan-lembut", palet);
      expect(rasio(lembut, peubahPalet("--s-latar", palet)), nama).toBeGreaterThanOrEqual(AA);
      expect(rasio(lembut, peubahPalet("--s-permukaan", palet)), nama).toBeGreaterThanOrEqual(AA);
    });

    it(`${nama}: tulisan di atas permukaan merek memenuhi AAA`, () => {
      // Kepala tabel, tombol, bilah - tulisan putih-gading di atas hijau tua
      // palet itu. Pasangan inilah yang paling mudah jatuh ketika paletnya
      // diganti, sebab keduanya berubah sekaligus.
      const atas = peubahPalet("--s-tulisan-atas", palet);
      expect(rasio(atas, peubahPalet("--s-hijau-tua", palet)), `${nama}: di atas hijau-tua`).toBeGreaterThanOrEqual(AAA);
      expect(rasio(atas, peubahPalet("--s-hijau", palet)), `${nama}: di atas hijau`).toBeGreaterThanOrEqual(AA);
      expect(rasio(atas, peubahPalet("--s-sorot-kuat", palet)), `${nama}: di atas sorot`).toBeGreaterThanOrEqual(AA);
    });

    it(`${nama}: aksennya terbaca, dan tulisannya tidak putih murni`, () => {
      const aksen = peubahPalet("--s-hijau-terang", palet);
      expect(rasio(aksen, peubahPalet("--s-permukaan", palet)), `${nama}: aksen`).toBeGreaterThanOrEqual(AA);
      // Putih murni di atas gelap menyilaukan pada layar yang dipandang lama;
      // seluruh palet memakai putih-gading.
      expect(peubahPalet("--s-tulisan", palet).toLowerCase()).not.toBe("#ffffff");
    });
  }
});

describe("palet terang panel tetap terbaca", () => {
  it("hijau merek yang digelapkan memenuhi AA di atas putih", () => {
    // Catatan di panel.css menyebut hijau merek dipucatkan pada tema gelap dan
    // digelapkan menjadi #1f7a4d pada tema terang. Yang dijaga di sini
    // alasannya, bukan angkanya: kontras dijaga pada KEDUA tema.
    expect(rasio("#1f7a4d", "#ffffff")).toBeGreaterThanOrEqual(AA);
  });

  it("tulisan panel terang di atas latar terangnya memenuhi AAA", () => {
    expect(rasio("#2b2721", "#ece9e3")).toBeGreaterThanOrEqual(AAA);
  });
});
