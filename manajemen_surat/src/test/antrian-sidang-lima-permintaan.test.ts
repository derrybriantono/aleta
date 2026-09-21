import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Lima permintaan atas layar Antrian Sidang - dijaga pada BENTUKNYA, bukan
 * pada kehadirannya.
 *
 * ============================================================================
 * MENGAPA PENJAGA DI SINI MENUNTUT LETAK, BUKAN SEKADAR "ADA"
 * ============================================================================
 *
 * Empat dari lima permintaan ini tentang LETAK dan KEADAAN, bukan tentang
 * adanya kode:
 *
 *   1  tombol Perkara saya pindah ke sudut kanan atas  -> letak
 *   2  saklar nyala/mati, kecuali yang mendesak        -> keadaan
 *   3  tag belum minutasi dari dua sumber              -> aturan
 *   4  sebab minutasi tertahan di rincian              -> letak + aturan
 *
 * Penjaga yang hanya menanyakan "apakah tombolnya ada" akan tetap hijau
 * sesudah seseorang memindahkannya kembali ke atas tabel - dan perubahan yang
 * diminta pengguna diam-diam dibatalkan tanpa satu pun uji merah.
 */

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");

describe("butir 1 - tombol Perkara saya di sudut kanan atas", () => {
  const iKepalaBuka = layar.indexOf("<CardHeader");
  const iKepalaTutup = layar.indexOf("</CardHeader>");
  const iIsi = layar.indexOf("<CardContent");

  it("kepalanya memang ada dan berada sebelum isinya", () => {
    expect(iKepalaBuka).toBeGreaterThan(-1);
    expect(iKepalaTutup).toBeGreaterThan(iKepalaBuka);
    expect(iIsi).toBeGreaterThan(iKepalaTutup);
  });

  it("tombolnya duduk DI DALAM kepala, bukan di badan", () => {
    const iTombol = layar.indexOf("setHanyaMilikSaya((x) => !x)");
    expect(iTombol).toBeGreaterThan(iKepalaBuka);
    expect(iTombol).toBeLessThan(iKepalaTutup);
  });

  it("hanya ADA SATU tombolnya - yang lama tidak tertinggal", () => {
    // Dua tombol yang membalik penanda yang sama akan saling menyangkal di
    // layar: yang satu menyala, yang lain tidak, dan keduanya benar.
    const cocok = layar.match(/setHanyaMilikSaya\(\(x\) => !x\)/g) ?? [];
    expect(cocok).toHaveLength(1);
  });

  it("barisnya sendiri di atas tabel sudah hilang", () => {
    // Kalimat ini hanya ada di baris lama. Selama ia masih ada, barisnya
    // masih memakan satu baris penuh - persis yang dikeluhkan pengguna.
    expect(layar).not.toContain("Tampilkan semua perkara");
    expect(layar).not.toContain("Seluruh perkara satker.");
  });

  it("peringatan nama tidak ketemu TIDAK ikut pindah menjadi title", () => {
    // Title tidak terlihat tanpa disentuh. Peringatan yang tidak terlihat
    // membuat daftar penuh terbaca sebagai daftar yang sudah disaring.
    const iPeringatan = layar.indexOf("tidak tercatat sebagai majelis");
    expect(iPeringatan).toBeGreaterThan(iIsi);
  });
});

describe("butir 2 - panel saklar tampilan", () => {
  it("tombolnya di kepala, panelnya di badan", () => {
    const iKepalaTutup = layar.indexOf("</CardHeader>");
    const iTombol = layar.indexOf("setPanelTampilan((n) => !n)");
    const iPanel = layar.indexOf("Apa yang digambar di layar ini");
    expect(iTombol).toBeGreaterThan(-1);
    expect(iTombol).toBeLessThan(iKepalaTutup);
    expect(iPanel).toBeGreaterThan(iKepalaTutup);
  });

  it("memberi tahu BERAPA yang sedang dimatikan", () => {
    // Tanpa angka ini, layar yang penandanya sudah dipadamkan berbulan lalu
    // terbaca sebagai layar yang memang tidak punya penanda - dan yang
    // membacanya akan menyimpulkan perkaranya bersih.
    expect(layar).toContain("dimatikan > 0");
    expect(layar).toContain("jumlahDimatikan");
  });

  it("pilihannya tersimpan, bukan hilang tiap layar dibuka", () => {
    expect(layar).toContain("KUNCI_SIMPANAN_TAMPILAN");
    expect(layar).toContain("bacaTampilan");
  });

  it("menyimpan lewat try/catch - peramban yang memblokir simpanan tetap jalan", () => {
    const i = layar.indexOf("const ubahSaklar");
    const blok = layar.slice(i, i + 700);
    expect(blok).toContain("try {");
    expect(blok).toContain("catch");
  });
});

describe("butir 3 - tag belum minutasi dan belum unggah putusan", () => {
  /**
   * Isi satu entri KEADAAN_DASAR, dibaca dari sumbernya.
   *
   * Daftarnya tidak diekspor, dan mengekspornya HANYA untuk uji berarti
   * menambah pintu keluar pada berkas 300 kB yang seluruh isinya milik satu
   * layar. Membacanya dari sumber menjawab pertanyaan yang sama - dan
   * kebetulan menjawab satu pertanyaan tambahan yang impor tidak dapat:
   * apakah alasannya TERTULIS di sebelahnya.
   */
  const entri = (kunci: string) => {
    const i = layar.indexOf(`kunci: "${kunci}"`);
    expect(i, `kotak keadaan ${kunci} tidak ada`).toBeGreaterThan(-1);
    const akhir = layar.indexOf("\n  },", i);
    expect(akhir).toBeGreaterThan(i);
    return layar.slice(i, akhir);
  };

  it("keduanya terdaftar sebagai kotak keadaan", () => {
    expect(entri("belum-minutasi").length).toBeGreaterThan(50);
    expect(entri("belum-unggah-putusan").length).toBeGreaterThan(50);
  });

  it("keduanya duduk di kelompok putusan", () => {
    for (const k of ["belum-minutasi", "belum-unggah-putusan"]) {
      expect(entri(k)).toContain('kelompok: "putusan"');
    }
  });

  it("keduanya merah - mereka menuntut tindakan, bukan menerangkan", () => {
    // Merah memasukkannya ke kotak gabungan "Perlu diperiksa" - lihat
    // NADA_PERLU_DIPERIKSA. Kuning tidak, dan tunggakan minutasi yang tidak
    // pernah masuk ke sana hanya terlihat oleh yang sudah mencarinya.
    for (const k of ["belum-minutasi", "belum-unggah-putusan"]) {
      expect(entri(k)).toContain('nada: "bahaya"');
    }
  });

  it("keduanya punya judul yang menerangkan, bukan mengulang labelnya", () => {
    for (const k of ["belum-minutasi", "belum-unggah-putusan"]) {
      const judul = entri(k).match(/judul:\s*\n?\s*"([^"]+)"/);
      expect(judul, `kotak ${k} tanpa judul`).toBeTruthy();
      expect(judul?.[1].length ?? 0).toBeGreaterThan(60);
    }
  });

  it("belum-minutasi membaca DUA sumber, bukan hanya perkara_putusan", () => {
    // Terukur: dari 9.993 baris perkara_putusan di SIPP setempat, NOL yang
    // tanggal_minutasi-nya kosong. Kotak yang hanya membaca tabel itu tidak
    // akan pernah menyala satu kali pun - dan terbaca sebagai "tidak ada
    // tunggakan". Tunggakannya justru pada 12 perkara yang barisnya belum ada.
    const i = layar.indexOf('kunci: "belum-minutasi"');
    const blok = layar.slice(i, layar.indexOf("},", i));
    expect(blok).toContain("sudahPutus");
    expect(blok).toContain("sudahPutusHariIni");
    expect(blok).toContain("sudahDiminutasi");
  });

  it("belum-unggah-putusan hanya menuduh yang barisnya SUDAH ada", () => {
    // Perkara yang baris putusannya belum dibuat tidak dapat dituduh "belum
    // mengunggah" - yang tertinggal pencatatannya.
    const i = layar.indexOf('kunci: "belum-unggah-putusan"');
    const blok = layar.slice(i, layar.indexOf("},", i));
    expect(blok).toContain("x.sudahPutus");
    expect(blok).toContain("adaBerkasPutusan");
    expect(blok).not.toContain("sudahPutusHariIni");
  });

  it("sebabnya yang terukur TERTULIS, supaya tidak dibuang saat merapikan", () => {
    const i = layar.indexOf('kunci: "belum-minutasi"');
    const catatan = layar.slice(Math.max(0, i - 2600), i);
    expect(catatan).toContain("9.993");
    expect(catatan).toContain("12");
  });
});

describe("butir 4 - sebab minutasi tertahan di rincian perkara", () => {
  it("dipanggil di panel rincian, dengan jadwal SELURUH perkara", () => {
    const i = layar.indexOf("sebabMinutasiTertahan({");
    expect(i).toBeGreaterThan(-1);
    // Jendelanya diambil sampai kurung tutup pemanggilannya, bukan sekian
    // ratus huruf: komentar di dalam pemanggilan tumbuh, dan jendela bernomor
    // tetap akan memotong ruas yang justru sedang dijaga.
    const blok = layar.slice(i, layar.indexOf("});", i));
    // jadwalPerkara, bukan baris.adaBas: baris hanya tahu BAS sidangnya
    // sendiri, dan menghitung kelengkapan dari satu sidang akan menyebut BAS
    // lengkap pada perkara yang sidang lainnya belum ada BAS-nya.
    expect(blok).toContain("jadwalPerkara");
    expect(blok).toContain("adaBerkasPutusan");
    expect(blok).toContain("adaBerkasAnonim");
  });

  it("MENGIRIM tanggalPutusan - tanpa itu tuduhan BAS-nya palsu seluruhnya", () => {
    // Terukur pada perkara putus 2026 di SIPP setempat: BAS kurang pada
    // sidang sampai tanggal putusan NOL, pada sidang sesudahnya TUJUH. Tanpa
    // batas ini ketujuhnya dituduhkan, dan ketujuhnya salah - sidang ikrar
    // talak yang dijadwalkan berbulan sesudah putusan dan memang belum
    // terjadi. Penjaga ini menahan batas itu agar tidak hilang saat
    // seseorang merapikan pemanggilannya.
    const i = layar.indexOf("sebabMinutasiTertahan({");
    const blok = layar.slice(i, layar.indexOf("});", i));
    expect(blok).toContain("tanggalPutusan");
  });

  it("membedakan 'berkasnya lengkap' dari 'ada yang kurang'", () => {
    // Keduanya sama-sama belum diminutasi, tetapi pekerjaan yang menunggu
    // berbeda sama sekali - dan yang satu tidak menuntut membuka SIPP.
    expect(layar).toContain("Berkasnya sudah lengkap");
  });

  it("membedakan yang MENAHAN dari yang sekadar tertunggak", () => {
    const i = layar.indexOf("sebabMinutasiTertahan({");
    const blok = layar.slice(i, i + 2000);
    expect(blok).toContain('"penghalang"');
  });

  it("lencana di baris daftar menunjuk tempat daftar lengkapnya", () => {
    expect(layar).toContain("Buka rincian perkara untuk daftar lengkap");
  });

  it("tanggal nol SIPP tidak dibaca sebagai 'sudah diminutasi'", () => {
    expect(layar).toContain("!sudahDiminutasi(baris.tanggalMinutasi)");
  });
});

describe("butir 5 - peta perkara tetap terjaga", () => {
  const css = baca("manajemen_surat/src/app/globals.css");

  it("pengecualian kanvas masih terpasang", () => {
    // Penjaga rinci ada di peta-kanvas-lebar.test.ts. Yang diperiksa di sini
    // hanya bahwa lima permintaan ini tidak menyenggolnya.
    expect(css).toContain(".leaflet-pane > canvas");
    expect(css).toContain("max-width: none");
  });
});
