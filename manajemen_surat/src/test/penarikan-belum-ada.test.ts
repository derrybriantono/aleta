// @vitest-environment node
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * "TARIK YANG BELUM ADA SAJA" - BUTIR 5, 25 SEPTEMBER 2026
 * ============================================================================
 *
 * Yang diminta pengguna: "ketika diklik, data yang belum ada menjadi fokus
 * ditarik, bukan data yang sudah ada".
 *
 * Tombolnya sebenarnya sudah ada sejak lama, dan penyaring "sudah lengkap" pun
 * sudah ada. Yang salah bukan ketiadaan tombolnya melainkan DEFINISI "sudah
 * ada"-nya, dan tiga sebab terukur membuat penarikan tetap membuka perkara yang
 * berkasnya utuh:
 *
 *   C1  syarat "menunggu verifikasi majelis" ikut membatalkan status lengkap,
 *       padahal needsRecheck menolak mengunduh apa pun dari kunjungan itu;
 *   C2  dokumen yang e-Court jawab 404 tidak pernah punya baris berkas,
 *       sehingga perkaranya tidak pernah lengkap - selamanya. Diukur 23 Sep
 *       2026: 145 dari 168 galat penarikan berbunyi HTTP 404;
 *   C3  acuan SIPP terkunci 200 perkara setahun terakhir, sehingga 2.327 dari
 *       2.527 perkara e-Court (92%) tidak pernah masuk daftar sama sekali.
 *
 * ============================================================================
 * BASIS DATA BOT ADA DI LAPTOP - KOMENTAR LAMA DI SINI SALAH
 * ============================================================================
 *
 * Sampai 25 Sep 2026 berkas ini berbunyi "MySQL bot tidak ada di laptop", dan
 * itu menutup jalan yang sebenarnya terbuka: skema `aleta_bot` ADA di XAMPP
 * MySQL setempat dengan seluruh tabel aleta_bot_ecourt_* berdiri - hanya
 * ISINYA nol baris (diukur 25 Sep 2026: aleta_bot_ecourt_documents 0 baris,
 * aleta_bot_ecourt_files 0 baris). Karena itu uji perilaku tingkat baris
 * menyemai barisnya sendiri lalu menghapusnya kembali, dan hanya dilewati bila
 * MySQL-nya benar-benar tidak menjawab.
 *
 * Yang di bawah karena itu dibagi tegas: penyisiran TEKS MENTAH untuk keputusan
 * yang memang hanya ada di teks (nama env, kalimat di layar), dan uji PERILAKU
 * yang MENJALANKAN kodenya untuk semua yang dapat dijalankan.
 */

const require_ = createRequire(import.meta.url);
const akar = path.resolve(process.cwd(), "..");
const baca = (...bagian: string[]) => readFileSync(path.join(akar, ...bagian), "utf8");
const jalurBot = (...bagian: string[]) => path.join(akar, "aleta_bot", ...bagian);

const run = baca("aleta_bot", "tools", "ecourt-bridge", "run.js");
const toko = baca("aleta_bot", "services", "ecourtStoreService.js");
const penjadwal = baca("aleta_bot", "services", "ecourtSchedulerService.js");
const sasaranJs = baca("aleta_bot", "services", "ecourtSasaranService.js");
const gerbangBot = baca("aleta_bot", "routes", "internalGatewayRoutes.js");
const layar = baca("manajemen_surat", "src", "components", "portal", "aleta-ecourt-penarikan.tsx");
const rute = baca("manajemen_surat", "src", "app", "api", "aleta-ecourt", "penarikan", "route.ts");

describe("C3 - acuan SIPP tidak lagi terkunci 200 perkara", () => {
  it("acuan dipisahkan dari jatah putaran", () => {
    expect(run).not.toContain("limit: Math.max(Number(maksPerkara)");
    expect(run).toContain("limit: seluruhArsip ? 5000 :");
    expect(run).toContain("sejakHari: seluruhArsip ? 3650 : undefined");
  });

  it("batas atas listEcourtCases menampung seluruh arsip", () => {
    const jembatan = baca("aleta_bot", "services", "sippReadOnlyBridgeService.js");
    expect(jembatan).toContain("Math.min(Math.max(Number(params.limit) || 200, 1), 5000)");
  });

  it("ukurannya ikut ditulis supaya yang menurunkannya lagi tahu apa yang hilang", () => {
    expect(run).toContain("2.527 perkara e-Court");
  });

  it("'Tarik perkara ini' untuk perkara lama akhirnya punya acuannya", () => {
    // Daftar SIPP terurut dari yang terbaru, sehingga perkara lama yang justru
    // punya dokumen persidangan selalu di luar jendela pendek - dan tombolnya
    // selalu menjawab "perkara yang diminta tidak ada di acuan SIPP".
    expect(run).toContain("seluruhArsip: args.hanyaBelumAda || Boolean(args.perkara)");
  });
});

describe("C1 - verifikasi majelis tidak lagi menahan perkara yang berkasnya utuh", () => {
  it("dua ukuran lengkap, dan yang dipakai bergantung pertanyaannya", () => {
    const i = run.indexOf("const lengkap = args.hanyaBelumAda");
    expect(i).toBeGreaterThan(-1);
    const blok = run.slice(i, i + 220);
    expect(blok).toContain("k.tanpaBerkas === 0");
    expect(blok).toContain("k.tanpaBerkas === 0 && k.menunggu === 0");
  });

  it("satu kueri untuk seluruh daftar, bukan satu kueri per perkara", () => {
    // Pada acuan penuh 2.527 perkara, satu kueri per tautan berarti 2.527 kueri
    // berurutan sebelum satu halaman pun dibuka.
    expect(run).toContain("ecourtStoreService.ringkasKekuranganBerkas(nomorSemua)");
    const awal = run.indexOf("const perluDiperiksa = [];");
    const gelung = run.slice(awal, run.indexOf("tautan = perluDiperiksa;"));
    expect(gelung.length).toBeGreaterThan(200);
    expect(gelung).not.toContain("await ecourtStoreService.perkaraSudahLengkap(");
  });
});

describe("C2 - 404 ditandai di basis data, bukan hanya di log", () => {
  it("kolom dan fungsinya ada", () => {
    expect(toko).toContain('"tidak_tersedia_pada"');
    expect(toko).toContain("async function tandaiTidakTersedia(");
    expect(toko).toContain("async function lupakanTidakTersedia(");
  });

  it("penandanya tidak berlaku selamanya", () => {
    // e-Court dapat mengunggah berkasnya kapan saja tanpa memberi tahu siapa
    // pun, dan berkas yang dibutuhkan hakim tidak boleh menjadi berkas yang
    // tidak pernah ditanyakan lagi.
    expect(toko).toContain("TIDAK_TERSEDIA_JEDA_HARI");
    expect(toko).toContain("DATE_SUB(NOW(), INTERVAL ? DAY)");
  });

  it("tidak menandai dokumen yang gagal karena sebab lain", () => {
    const i = run.indexOf("if (adaYangBerhasil) {");
    const tutup = run.slice(i, i + 1200);
    expect(tutup).toContain("tidakTersediaPadaDokumen && !adaGagalLain");
    expect(tutup).toContain("lupakanTidakTersedia({ documentKey })");
  });

  it("petugas dapat meminta ditanyakan sekali lagi", () => {
    expect(gerbangBot).toContain('/ecourt/penarikan/coba-tidak-tersedia"');
    expect(rute).toContain('tindakan === "coba-tidak-tersedia"');
    expect(layar).toContain('kirim("coba-tidak-tersedia")');
  });
});

describe("uji kering: sasaran dihitung tanpa menyentuh e-Court", () => {
  it("layanannya tidak membuka peramban sama sekali", () => {
    expect(sasaranJs).not.toContain("puppeteer");
    expect(sasaranJs).not.toContain("ecourtLoginService");
    expect(sasaranJs).toContain('safeHandleBridgeOperation("ecourt.caseList"');
  });

  it("layar tidak menawarkan tombol jalankan sebelum sasarannya dihitung", () => {
    // Satu penarikan mengunci seluruh jalur penarikan lain dan dapat berjam-jam.
    // Menekannya tanpa tahu berapa sasarannya berarti menahan pekerjaan orang
    // lain untuk hasil yang tidak diketahui.
    expect(layar).toContain("sasaran && sasaran.jumlahSasaran > 0 ?");
    expect(layar).toContain('kirim("belum-ada"');
    // Dan rute pratinjaunya tidak memulai apa pun - ia GET, bukan POST.
    expect(rute).toContain('=== "sasaran"');
  });

  it("layar memperingatkan bila di luar jam kerja, tetapi tidak melarang", () => {
    // jalankanSatuPutaran tidak memeriksa jam kerja - hanya detak() penjadwal
    // yang memeriksanya. Ada keadaan yang menuntut penarikan malam hari, jadi
    // tidak dilarang; tetapi tidak pula didiamkan.
    expect(layar).toContain("diLuarJamKerja");
    expect(layar).toContain("Di luar jam kerja penjadwal");
  });

  /**
   * ==========================================================================
   * PENGGOLONGAN, DIJALANKAN DENGAN TIRUAN
   * ==========================================================================
   *
   * Yang diuji penggolongannya - dan yang paling penting adalah baris ketiga:
   * perkara yang berkasnya utuh tetapi majelisnya belum memverifikasi TIDAK
   * boleh menjadi sasaran. Itulah inti butir 5, dan itulah yang paling mudah
   * keliru ditulis.
   *
   * Ketiga kebergantungannya ditiru - termasuk catatan kunjungan - supaya uji
   * ini tidak pernah bergantung pada isi basis data setempat.
   */
  it("hitungSasaran menggolongkan dengan benar", async () => {
    const hasil = await jalankanHitungSasaran({
      perkara: [
        "1/Pdt.G/2026/PA.Dgl",
        "2/Pdt.G/2026/PA.Dgl",
        "3/Pdt.G/2026/PA.Dgl",
        "4/Pdt.G/2026/PA.Dgl",
      ],
      keadaan: new Map([
        // 1 tidak ada di peta sama sekali -> belum pernah ditarik.
        ["2/Pdt.G/2026/PA.Dgl", { dokumen: 5, tanpaBerkas: 3, menunggu: 0, tidakTersedia: 0 }],
        // Berkasnya utuh tetapi majelisnya belum memeriksa -> BUKAN sasaran.
        ["3/Pdt.G/2026/PA.Dgl", { dokumen: 4, tanpaBerkas: 0, menunggu: 5, tidakTersedia: 0 }],
        // Utuh, dengan dua dokumen yang e-Court sendiri tidak sediakan.
        ["4/Pdt.G/2026/PA.Dgl", { dokumen: 6, tanpaBerkas: 0, menunggu: 0, tidakTersedia: 2 }],
      ]),
      kunjungan: new Map(),
    });

    expect(hasil.ok).toBe(true);
    expect(hasil.totalEcourtSipp).toBe(4);
    expect(hasil.belumPernahDitarik).toBe(1);
    expect(hasil.berkasKurang).toBe(1);
    expect(hasil.dokumenKurang).toBe(3);
    expect(hasil.lengkap).toBe(2);
    expect(hasil.jumlahSasaran).toBe(2);
    expect(hasil.dokumenTidakTersedia).toBe(2);
    // Ketiga golongan harus berjumlah persis total; selain nol berarti ada
    // perkara yang luput, dan itu cacat - bukan angka yang perlu ditafsirkan.
    expect(hasil.selisihGolongan).toBe(0);

    const contoh = hasil.contoh as Array<{ nomorPerkara: string; sebab: string }>;
    expect(contoh.map((x) => x.sebab)).toEqual(["belum_pernah_ditarik", "berkas_belum_ada"]);
    // Perkara 3 yang menunggu majelis TIDAK boleh muncul sebagai sasaran.
    expect(contoh.map((x) => x.nomorPerkara)).not.toContain("3/Pdt.G/2026/PA.Dgl");
  });
});

/**
 * ============================================================================
 * CACAT 25 SEP 2026: LAPIS 0 TIDAK DAPAT PENSIUN
 * ============================================================================
 *
 * belumPernah() menjawab dari ringkasKekuranganBerkas, yang hanya membaca
 * aleta_bot_ecourt_documents. Satu-satunya penulis baris di tabel itu adalah
 * recordDocument, dan recordDocument hanya dipanggil DI DALAM gelung dokumen -
 * perkara yang halamannya TERBUKA tetapi tidak menghasilkan satu dokumen pun
 * tidak meninggalkan jejak apa pun. terakhirDiperiksaPerkara membaca
 * MAX(terakhir_terlihat) dari tabel yang sama, jadi kapan() memulangkan 0 untuk
 * semuanya, dan sort JavaScript yang stabil memulangkan urutan sapuan yang sama
 * tiap kali.
 *
 * AKIBAT TERUKUR (di bawah): tanpa catatan kunjungan, dua penekanan berturut-
 * turut membuka 120 perkara yang SAMA - tumpang tindih 120 dari 120. Dengan
 * catatan kunjungan, tumpang tindihnya 0 dan tiga penekanan menyentuh 300
 * perkara berbeda.
 *
 * Uji ini MENJALANKAN susunGiliran yang dipakai run.js, bukan menyisir teksnya:
 * cacatnya hanya muncul pada penekanan KEDUA, dan tidak ada penyisiran teks
 * yang dapat melihatnya.
 */
describe("giliran: penekanan kedua tidak membuka perkara yang sama", () => {
  const { susunGiliran } = require_(
    jalurBot("tools", "ecourt-bridge", "run.js")
  ) as {
    susunGiliran: (
      daftar: string[],
      opsi: Record<string, unknown>
    ) => string[];
  };

  const JUMLAH = 300;
  const JATAH = 120;

  function siapkan() {
    const petaNomor = new Map<string, string>();
    const tautan: string[] = [];
    for (let i = 1; i <= JUMLAH; i += 1) {
      const url = `https://ecourt.example/perkara/${i}`;
      tautan.push(url);
      petaNomor.set(url, `${i}/Pdt.G/2026/PA.Dgl`);
    }
    return { petaNomor, tautan };
  }

  function tekan(
    tautan: string[],
    petaNomor: Map<string, string>,
    kunjungan: Map<string, { waktu: number; dokumenTerlihat: number }>,
    jam: number
  ) {
    const urut = susunGiliran([...tautan], {
      petaNomor,
      // Kosong: tidak ada satu baris dokumen pun, persis keadaan terukur
      // 25 Sep 2026 - dan persis keadaan yang membuat seluruh perkara jatuh ke
      // lapis 0.
      keadaanBerkas: new Map(),
      terakhirDokumen: new Map(),
      kunjungan,
      hanyaBelumAda: true,
    });
    const jatah = urut.slice(0, JATAH);
    // Yang dikerjakan run.js sesudah tiap halaman terbaca: mencatat
    // kunjungannya, termasuk ketika dokumennya nol.
    for (const url of jatah) {
      kunjungan.set(String(petaNomor.get(url)), { waktu: jam, dokumenTerlihat: 0 });
    }
    return jatah;
  }

  it("tanpa catatan kunjungan, dua penekanan membuka 120 perkara yang sama", () => {
    const { petaNomor, tautan } = siapkan();
    const opsi = {
      petaNomor,
      keadaanBerkas: new Map(),
      terakhirDokumen: new Map(),
      kunjungan: new Map(),
      hanyaBelumAda: true,
    };
    const pertama = susunGiliran([...tautan], opsi).slice(0, JATAH);
    const kedua = susunGiliran([...tautan], opsi).slice(0, JATAH);
    const kumpulan = new Set(pertama);
    // Inilah cacatnya, dipaku sebagai angka: 120 dari 120.
    expect(kedua.filter((url) => kumpulan.has(url)).length).toBe(JATAH);
  });

  it("dengan catatan kunjungan, tiga penekanan menyentuh 300 perkara berbeda", () => {
    const { petaNomor, tautan } = siapkan();
    const kunjungan = new Map<string, { waktu: number; dokumenTerlihat: number }>();

    const pertama = tekan(tautan, petaNomor, kunjungan, 1_000);
    const kedua = tekan(tautan, petaNomor, kunjungan, 2_000);
    const ketiga = tekan(tautan, petaNomor, kunjungan, 3_000);

    const kumpulanPertama = new Set(pertama);
    expect(kedua.filter((url) => kumpulanPertama.has(url)).length).toBe(0);
    expect(new Set([...pertama, ...kedua, ...ketiga]).size).toBe(JUMLAH);
    // 300 perkara, jatah 120: penekanan ketiga menyelesaikan sisanya lalu
    // memulai putaran berikutnya dari yang paling lama tidak dibuka.
    expect(kunjungan.size).toBe(JUMLAH);
  });

  it("perkara yang belum pernah dibuka tetap mendahului yang sudah pernah dibuka", () => {
    const { petaNomor, tautan } = siapkan();
    const kunjungan = new Map<string, { waktu: number; dokumenTerlihat: number }>();
    // Sepuluh perkara PERTAMA menurut urutan SIPP sudah pernah dibuka dan
    // kosong; sisanya belum pernah sama sekali.
    for (let i = 0; i < 10; i += 1) {
      kunjungan.set(String(petaNomor.get(tautan[i])), { waktu: 5_000, dokumenTerlihat: 0 });
    }
    const urut = susunGiliran([...tautan], {
      petaNomor,
      keadaanBerkas: new Map(),
      terakhirDokumen: new Map(),
      kunjungan,
      hanyaBelumAda: true,
    });
    const sepuluhPertama = new Set(tautan.slice(0, 10));
    expect(urut.slice(0, JATAH).filter((url) => sepuluhPertama.has(url)).length).toBe(0);
    expect(urut.slice(-10).every((url) => sepuluhPertama.has(url))).toBe(true);
  });

  it("di luar mode belum-ada, 200 terbaru tetap lapis pertama", () => {
    // Aturan 23 Sep 2026 tidak boleh ikut tercabut oleh perbaikan ini.
    const { petaNomor, tautan } = siapkan();
    const terakhirDokumen = new Map<string, number>();
    // Perkara terbaru (urutan awal 0) justru yang paling baru dibuka, jadi
    // urutan giliran sendirian akan menaruhnya paling belakang.
    terakhirDokumen.set(String(petaNomor.get(tautan[0])), 9_000);
    const urut = susunGiliran([...tautan], {
      petaNomor,
      keadaanBerkas: new Map(),
      terakhirDokumen,
      kunjungan: new Map(),
      hanyaBelumAda: false,
      batasTerbaru: 200,
    });
    // Ia tetap di lapis 1 (200 terbaru), jadi tidak boleh terlempar ke bawah
    // 200 perkara yang urutan awalnya >= 200.
    expect(urut.indexOf(tautan[0])).toBeLessThan(200);
  });
});

/**
 * ============================================================================
 * TAKSIRAN WAKTU: ISTIRAHAT DAN BERKAS PERKARA BARU IKUT DIHITUNG
 * ============================================================================
 *
 * Rumus lama (perkara x 8 + dokumenKurang x 4) / 60 tidak punya satu suku pun
 * untuk istirahat, padahal run.js tidur 1-3 menit tiap 40 perkara pada mode
 * yang sama; dan golongan belum_pernah_ditarik diberi kurang: 0, sehingga
 * perkara yang justru SELURUH berkasnya harus diunduh ditaksir tanpa satu
 * berkas pun.
 *
 * Diukur 25 Sep 2026 pada sipp_donggala: 2.527 perkara e-Court dan
 * aleta_bot_ecourt_documents 0 baris, jadi rumus lama menulis
 * ceil(2527 x 8 / 60) = 337 menit sementara istirahatnya sendiri
 * floor(2527/40) = 63 kali x 1-3 menit = 63-189 menit.
 */
describe("taksiran waktu penarikan", () => {
  it("istirahat ikut dihitung - tetap 2 menit sejak 26 Sep 2026", async () => {
    // 80 perkara belum pernah ditarik: tepat dua kali istirahat menurut
    // ISTIRAHAT_TIAP_PERKARA = 40.
    const perkara = Array.from({ length: 80 }, (_, i) => `${i + 1}/Pdt.G/2026/PA.Dgl`);
    const hasil = await jalankanHitungSasaran({
      perkara,
      keadaan: new Map(),
      kunjungan: new Map(),
    });

    const taksiran = hasil.taksiran as Record<string, number | boolean>;
    expect(hasil.jumlahSasaran).toBe(80);
    expect(taksiran.jumlahIstirahat).toBe(2);
    // Rumus lama: ceil(80 x 8 / 60) = 11 menit, tanpa istirahat dan tanpa satu
    // berkas pun. Yang baru harus lebih besar dari itu, bukan sama.
    expect(Number(hasil.perkiraanMenitMin)).toBeGreaterThan(11);
    // Istirahat tetap: min = maks, dan istirahatnya tepat 2 x 2 menit.
    expect(Number(hasil.perkiraanMenitMaks)).toBe(Number(hasil.perkiraanMenitMin));
    expect(taksiran.istirahatMenitMin).toBe(2);
    expect(taksiran.istirahatMenitMaks).toBe(2);
    // perkiraanMenit lama tetap ada, dan artinya batas bawah rentang.
    expect(hasil.perkiraanMenit).toBe(hasil.perkiraanMenitMin);
  });

  it("perkara yang belum pernah ditarik tidak lagi ditaksir tanpa berkas", async () => {
    const hasil = await jalankanHitungSasaran({
      perkara: ["1/Pdt.G/2026/PA.Dgl", "2/Pdt.G/2026/PA.Dgl"],
      keadaan: new Map(),
      kunjungan: new Map(),
    });
    const taksiran = hasil.taksiran as Record<string, number | boolean>;
    expect(hasil.belumPernahDitarik).toBe(2);
    expect(hasil.dokumenKurang).toBe(0);
    // Dua perkara kosong tidak boleh menghasilkan nol dokumen ditaksir.
    expect(Number(taksiran.dokumenDitaksir)).toBeGreaterThan(0);
    expect(Number(taksiran.menitBerkas)).toBeGreaterThan(0);
    // Dan layar wajib tahu bahwa rata-ratanya BUKAN hasil ukur.
    expect(taksiran.rerataTerukur).toBe(false);
    expect(taksiran.perkaraTerukur).toBe(0);
  });

  it("rata-rata dokumen diukur dari data sendiri begitu datanya ada", async () => {
    const hasil = await jalankanHitungSasaran({
      perkara: ["1/Pdt.G/2026/PA.Dgl", "2/Pdt.G/2026/PA.Dgl", "3/Pdt.G/2026/PA.Dgl"],
      keadaan: new Map([
        // Dua perkara tercatat dengan 10 dan 20 dokumen -> rata-rata 15.
        ["2/Pdt.G/2026/PA.Dgl", { dokumen: 10, tanpaBerkas: 0, menunggu: 0, tidakTersedia: 0 }],
        ["3/Pdt.G/2026/PA.Dgl", { dokumen: 20, tanpaBerkas: 0, menunggu: 0, tidakTersedia: 0 }],
      ]),
      kunjungan: new Map(),
    });
    const taksiran = hasil.taksiran as Record<string, number | boolean>;
    expect(taksiran.rerataTerukur).toBe(true);
    expect(taksiran.perkaraTerukur).toBe(2);
    expect(taksiran.rerataDokumenPerPerkara).toBe(15);
    // Satu perkara belum pernah ditarik x 15 dokumen.
    expect(taksiran.dokumenDitaksir).toBe(15);
  });

  it("jeda istirahat yang ditaksir sama dengan yang benar-benar dijalankan run.js", async () => {
    // Dua tempat yang menyimpan satu bilangan akan berselisih cepat atau
    // lambat, dan yang berselisih di sini adalah angka yang dipakai memutuskan
    // boleh-tidaknya mengunci jalur penarikan orang lain. Dibandingkan dengan
    // MENJALANKAN keduanya, bukan dengan menyisir teksnya.
    const { ISTIRAHAT_TIAP_PERKARA } = require_(
      jalurBot("tools", "ecourt-bridge", "run.js")
    ) as { ISTIRAHAT_TIAP_PERKARA: number };
    const hasil = await jalankanHitungSasaran({
      perkara: ["1/Pdt.G/2026/PA.Dgl"],
      keadaan: new Map(),
      kunjungan: new Map(),
    });
    const taksiran = hasil.taksiran as Record<string, number>;
    expect(taksiran.istirahatTiapPerkara).toBe(ISTIRAHAT_TIAP_PERKARA);
  });
});

/**
 * ============================================================================
 * KENOP ALETA_BOT_ECOURT_MAKS_BELUM_ADA HARUS HIDUP DARI JALUR PORTAL
 * ============================================================================
 *
 * Layar dulu selalu mengirim 120 yang ditulis keras di TSX, sehingga nilai
 * bawaan MAKS_BELUM_ADA di bot tidak pernah terpakai dan menaikkan env di
 * peladen tidak mengubah apa pun.
 */
describe("jatah satu penekanan dibaca di tempat env-nya hidup", () => {
  it("angka yang dipulangkan layanan sama dengan yang dijalankan penjadwal", () => {
    const layanan = require_(jalurBot("services", "ecourtSasaranService.js")) as {
      MAKS_SEKALI_TARIK: number;
    };
    const penjadwalModul = require_(jalurBot("services", "ecourtSchedulerService.js")) as {
      MAKS_BELUM_ADA: number;
    };
    expect(layanan.MAKS_SEKALI_TARIK).toBe(penjadwalModul.MAKS_BELUM_ADA);
  });

  it("layar memakai angka dari bot, dan 120 hanya cadangannya", () => {
    // Nilai yang dipaku BERUBAH dari "const MAKS_SEKALI_TARIK = 120;" menjadi
    // cadangan bernama, sebab perilakunya memang berubah: yang dikirim ke bot
    // sekarang sasaran.maksSekaliTarik. Ketatnya tidak dikurangi - justru
    // ditambah satu syarat.
    expect(layar).toContain("const MAKS_SEKALI_TARIK_CADANGAN = 120;");
    expect(layar).toContain("Number(sasaran?.maksSekaliTarik) || MAKS_SEKALI_TARIK_CADANGAN");
    expect(layar).toContain("maksPerkara: jatahSekaliTarik");
    // Env-nya tetap satu nama di kedua sisi bot.
    expect(sasaranJs).toContain("ALETA_BOT_ECOURT_MAKS_BELUM_ADA");
    expect(penjadwal).toContain("ALETA_BOT_ECOURT_MAKS_BELUM_ADA");
  });
});

/**
 * ============================================================================
 * KENDALI, BUKAN TOMBOL
 * ============================================================================
 *
 * hitungSasaran memulangkan 20 nomor perkara beserta sebabnya sejak awal,
 * tetapi tidak ada satu baris JSX pun yang membacanya. Yang membedakan kendali
 * dari tombol adalah dapat melihat apa yang akan dikerjakan.
 */
describe("layar menggambar apa yang akan dikerjakan, dan menyebut batasnya", () => {
  it("daftar contoh perkara benar-benar digambar", () => {
    expect(layar).toContain("sasaran.contoh.map(");
    expect(layar).toContain("SEBAB_SASARAN");
    expect(layar).toContain("contoh perkara yang akan dibuka");
  });

  it("layar menyebut bahwa jumlah sasaran adalah batas ATAS", () => {
    expect(layar).toContain("batas <strong>atas</strong>");
    expect(layar).toContain("muncul pada daftar e-Court tidak akan pernah terbuka");
  });

  it("layar menyebut bahwa 'utuh' berarti utuh menurut catatan, bukan cakram", () => {
    // Pengguna menulis "yang belum ada datanya ATAU FILENYA", dan seluruh arsip
    // pernah lenyap karena volume Docker belum di-mount - jadi ini bukan
    // kemungkinan teoretis.
    expect(layar).toContain("utuh menurut CATATAN, bukan menurut cakram");
    expect(layar).toContain("hilang dari disk tidak akan masuk sasaran");
  });

  it("sisa yang mustahil berkurang disebut dengan angkanya", () => {
    expect(layar).toContain("sasaran.dikunjungiTetapiKosong");
    expect(sasaranJs).toContain("dikunjungiTetapiKosong");
  });
});

/**
 * ============================================================================
 * UJI TINGKAT BARIS - MENYEMAI KE MySQL SETEMPAT LALU MENGHAPUSNYA
 * ============================================================================
 *
 * Basis data `aleta_bot` ADA di XAMPP MySQL setempat; yang kosong adalah
 * isinya. Barisnya karena itu disemai di sini lalu dihapus kembali, dan yang
 * diuji adalah SQL-nya sendiri - termasuk ON DUPLICATE KEY yang menjadi satu-
 * satunya alasan tabel ini ada.
 *
 * Dilewati HANYA bila MySQL-nya tidak menjawab sama sekali, dan alasannya
 * dicetak - bukan dilewati diam-diam.
 */
const mysqlBotHidup = await (async () => {
  try {
    const botDb = require_(jalurBot("services", "botDbService.js")) as {
      query: (sql: string, params?: unknown[]) => Promise<unknown>;
    };
    await botDb.query("SELECT 1");
    return true;
  } catch (kesalahan) {
    console.warn(
      `[penarikan-belum-ada] uji tingkat baris dilewati: MySQL bot tidak menjawab (${
        kesalahan instanceof Error ? kesalahan.message : String(kesalahan)
      }).`
    );
    return false;
  }
})();

describe.skipIf(!mysqlBotHidup)("catatan kunjungan, langsung ke MySQL bot", () => {
  const NOMOR_UJI = "999901/Pdt.Uji/2026/PA.Dgl";
  const NOMOR_UJI_2 = "999902/Pdt.Uji/2026/PA.Dgl";

  const kunjunganModul = require_(jalurBot("services", "ecourtKunjunganService.js")) as {
    catatKunjungan: (
      nomor: string,
      opsi?: { dokumenTerlihat?: number; sumberUrl?: string }
    ) => Promise<{ ok: boolean }>;
    kunjunganTerakhir: () => Promise<
      Map<string, { waktu: number; dokumenTerlihat: number; jumlahKunjungan: number }>
    >;
    hapusKunjungan: (nomor: string) => Promise<number>;
  };

  it("kunjungan kosong tersimpan, terbarui, lalu terhapus", async () => {
    try {
      await kunjunganModul.catatKunjungan(NOMOR_UJI, { dokumenTerlihat: 0, sumberUrl: "uji-1" });
      await kunjunganModul.catatKunjungan(NOMOR_UJI_2, { dokumenTerlihat: 3, sumberUrl: "uji-2" });

      let peta = await kunjunganModul.kunjunganTerakhir();
      expect(peta.get(NOMOR_UJI)?.dokumenTerlihat).toBe(0);
      expect(peta.get(NOMOR_UJI)?.jumlahKunjungan).toBe(1);
      expect(peta.get(NOMOR_UJI_2)?.dokumenTerlihat).toBe(3);

      // Kunjungan kedua atas perkara yang sama TIDAK boleh menambah baris; ia
      // memperbarui yang ada. Tanpa ini tabelnya tumbuh satu baris per putaran
      // per perkara, dan pada 2.527 perkara itu puluhan ribu baris sebulan.
      await kunjunganModul.catatKunjungan(NOMOR_UJI, { dokumenTerlihat: 2, sumberUrl: "uji-1b" });
      peta = await kunjunganModul.kunjunganTerakhir();
      expect(peta.get(NOMOR_UJI)?.jumlahKunjungan).toBe(2);
      // Perkara yang tadinya kosong lalu berisi terbarui sendiri - tidak ada
      // baris basi yang perlu dihapus tangan.
      expect(peta.get(NOMOR_UJI)?.dokumenTerlihat).toBe(2);
    } finally {
      // Dihapus kembali apa pun yang terjadi: basis data setempat dipakai
      // bersama pekerjaan lain.
      await kunjunganModul.hapusKunjungan(NOMOR_UJI);
      await kunjunganModul.hapusKunjungan(NOMOR_UJI_2);
    }

    const sisa = await kunjunganModul.kunjunganTerakhir();
    expect(sisa.has(NOMOR_UJI)).toBe(false);
    expect(sisa.has(NOMOR_UJI_2)).toBe(false);
  });

  it("hitungSasaran benar-benar membaca barisnya dari MySQL", async () => {
    // Uji ini TIDAK meniru catatan kunjungan: yang diuji justru sambungannya
    // dari tabel ke angka di layar.
    try {
      await kunjunganModul.catatKunjungan(NOMOR_UJI, { dokumenTerlihat: 0 });
      const hasil = await jalankanHitungSasaran({
        perkara: [NOMOR_UJI, NOMOR_UJI_2],
        keadaan: new Map(),
        // kunjungan: null -> modulnya TIDAK ditiru, jadi barisnya dibaca dari
        // MySQL setempat.
        kunjungan: null,
      });
      expect(hasil.belumPernahDitarik).toBe(2);
      expect(hasil.dikunjungiTetapiKosong).toBe(1);
      const contoh = hasil.contoh as Array<{ nomorPerkara: string; sebab: string }>;
      expect(contoh.find((x) => x.nomorPerkara === NOMOR_UJI)?.sebab).toBe("dibuka_tetapi_kosong");
      expect(contoh.find((x) => x.nomorPerkara === NOMOR_UJI_2)?.sebab).toBe(
        "belum_pernah_ditarik"
      );
    } finally {
      await kunjunganModul.hapusKunjungan(NOMOR_UJI);
    }
  });
});

describe("sopan santun: jeda manusiawi tidak dihapus", () => {
  it("istirahat berkala hanya pada mode belum-ada", () => {
    // Daftar sasaran yang padat berarti hampir tiap perkara di dalamnya
    // benar-benar dibuka, tidak seperti daftar lama yang sebagian besar
    // dilewati murah. Jumlah permintaan per jam naik walau jedanya tidak
    // berubah satu milidetik pun.
    expect(run).toContain("const ISTIRAHAT_TIAP_PERKARA =");
    expect(run).toContain("args.hanyaBelumAda &&");
    expect(run).toContain("ringkasan.perkaraDiperiksa % ISTIRAHAT_TIAP_PERKARA === 0");
  });

  it("istirahatnya tetap 2 menit (beban peladen, bukan tiruan manusia), jeda lama tidak disentuh", () => {
    expect(run).toContain("await sleep(120000);");
    expect(run, "istirahat acak tiruan manusia tidak boleh kembali").not.toContain("1 + Math.random() * 2");
    expect(run).toContain("const condong = Math.random() * Math.random();");
    expect(run, "jeda tetap tidak boleh kembali").not.toContain("await sleep(PAGE_DELAY_MS);");
  });

  it("satu penekanan berbatas, dan batasnya di bawah batas putaran", () => {
    // BATAS_PUTARAN_MS 2 jam akan MEMBUNUH putaran di tengah jalan bila
    // jatahnya 200 perkara; datanya tidak hilang, tetapi catatannya berbunyi
    // "Dihentikan paksa" tiap kali dan itu membingungkan.
    expect(penjadwal).toContain("const MAKS_BELUM_ADA =");
    expect(penjadwal).toContain("function mulaiPenarikanBelumAda(");
    expect(penjadwal).toContain('argumen.push("--hanya-belum-ada")');
  });

  it("tombol lama berhenti menjanjikan 'semua'", () => {
    expect(layar).not.toContain("Unduh semua berkas belum lengkap");
    expect(layar).toContain("acuan setahun terakhir");
  });

  it("kunjungan dicatat untuk setiap halaman yang terbaca", () => {
    // Bukan hanya yang kosong: dokumenTerlihat yang ikut tersimpan membuat
    // "dibuka dan memang kosong" dapat dibedakan dari "belum pernah dibuka".
    expect(run).toContain("ecourtKunjunganService");
    expect(run).toContain("dokumenTerlihat: semua.length");
  });
});

/**
 * Menjalankan hitungSasaran dengan kebergantungan yang ditiru.
 *
 * kunjungan = null berarti modul kunjungan TIDAK ditiru - barisnya dibaca dari
 * MySQL setempat, dan itu dipakai uji tingkat baris di atas.
 */
async function jalankanHitungSasaran({
  perkara,
  keadaan,
  kunjungan,
}: {
  perkara: string[];
  keadaan: Map<string, Record<string, number>>;
  kunjungan: Map<string, { waktu: number; dokumenTerlihat: number }> | null;
}): Promise<Record<string, unknown>> {
  const jalurSipp = require_.resolve(jalurBot("services", "sippReadOnlyBridgeService.js"));
  const jalurToko = require_.resolve(jalurBot("services", "ecourtStoreService.js"));
  const jalurKunjungan = require_.resolve(jalurBot("services", "ecourtKunjunganService.js"));
  const jalurSasaran = require_.resolve(jalurBot("services", "ecourtSasaranService.js"));

  const cache = require_.cache as Record<string, { exports: unknown } | undefined>;
  const simpanSipp = cache[jalurSipp];
  const simpanToko = cache[jalurToko];
  const simpanKunjungan = cache[jalurKunjungan];
  const simpanSasaran = cache[jalurSasaran];

  cache[jalurSipp] = {
    exports: {
      safeHandleBridgeOperation: async () => ({
        ok: true,
        data: { perkara: perkara.map((nomorPerkara) => ({ nomorPerkara })) },
      }),
    },
  };
  cache[jalurToko] = { exports: { ringkasKekuranganBerkas: async () => keadaan } };
  if (kunjungan) {
    cache[jalurKunjungan] = { exports: { kunjunganTerakhir: async () => kunjungan } };
  }
  delete cache[jalurSasaran];

  try {
    const { hitungSasaran } = require_(jalurSasaran) as {
      hitungSasaran: (arg?: { contoh?: number }) => Promise<Record<string, unknown>>;
    };
    return await hitungSasaran({ contoh: 50 });
  } finally {
    delete cache[jalurSasaran];
    if (simpanSipp) cache[jalurSipp] = simpanSipp;
    else delete cache[jalurSipp];
    if (simpanToko) cache[jalurToko] = simpanToko;
    else delete cache[jalurToko];
    if (simpanKunjungan) cache[jalurKunjungan] = simpanKunjungan;
    else delete cache[jalurKunjungan];
    if (simpanSasaran) cache[jalurSasaran] = simpanSasaran;
  }
}
