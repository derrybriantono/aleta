"use strict";

/**
 * Berapa perkara yang berkasnya BELUM ada - dihitung sebelum satu halaman pun
 * dibuka.
 *
 * ============================================================================
 * TIDAK MENYENTUH e-COURT SAMA SEKALI
 * ============================================================================
 *
 * Satu penarikan mengunci seluruh jalur penarikan lain (keadaan.sedangJalan
 * ditambah berkas kunci) dan dapat berjam-jam. Menekannya tanpa tahu berapa
 * sasarannya berarti menahan pekerjaan orang lain untuk hasil yang tidak
 * diketahui - dan sampai 25 Sep 2026 itulah yang terjadi: layar Penarikan
 * tidak menampilkan satu angka sasaran pun sebelum tombolnya ditekan.
 *
 * Hitungan ini hanya membaca SIPP (SELECT) dan basis data bot. Tidak ada
 * peramban yang dibuka, tidak ada sesi yang dipakai, tidak ada permintaan ke
 * server Mahkamah Agung - jadi ia boleh ditekan sesering apa pun, termasuk
 * ketika sesi e-Court sedang habis.
 *
 * ============================================================================
 * YANG TIDAK DAPAT DIJAWABNYA
 * ============================================================================
 *
 * Apakah perkaranya benar-benar ada di halaman e-Court. Itu baru ketahuan saat
 * daftarnya disapu, dan selisihnya dilaporkan ringkasan penarikan. Angka di
 * sini karena itu batas ATAS sasaran, bukan janji.
 *
 * ============================================================================
 * KETIGA GOLONGANNYA HARUS BERJUMLAH PERSIS TOTAL
 * ============================================================================
 *
 * belumPernahDitarik + berkasKurang + lengkap = totalEcourtSipp. Bila tidak,
 * ada perkara yang jatuh di luar ketiga golongan dan itu cacat - bukan angka
 * yang perlu ditafsirkan. Selisihnya ikut dipulangkan sebagai `selisihGolongan`
 * supaya layar dapat mengatakannya alih-alih menampilkan angka yang salah
 * dengan wajah meyakinkan.
 */

const sippReadOnlyBridgeService = require("./sippReadOnlyBridgeService");
const ecourtStoreService = require("./ecourtStoreService");
const ecourtKunjunganService = require("./ecourtKunjunganService");
const { normalizeCaseNumber } = require("./ecourtTextService");

/**
 * Taksiran kasar waktu satu perkara: membuka halaman detail ditambah jeda
 * manusiawi. Kasar DENGAN SENGAJA - jeda penarikannya memang tidak pernah sama,
 * dan angka yang tampak tepat di layar akan dipercaya lebih daripada haknya.
 */
const DETIK_PER_PERKARA = Number(process.env.ALETA_BOT_ECOURT_TAKSIR_PERKARA_DETIK || 8);
const DETIK_PER_BERKAS = Number(process.env.ALETA_BOT_ECOURT_TAKSIR_BERKAS_DETIK || 4);

/**
 * Tiap berapa perkara penariknya beristirahat, dan berapa lama.
 *
 * ============================================================================
 * ISTIRAHATNYA IKUT DIHITUNG - DULU TIDAK
 * ============================================================================
 *
 * Sampai 25 Sep 2026 rumusnya hanya (perkara x 8 + berkas x 4) / 60, tanpa satu
 * suku pun untuk istirahat, padahal run.js beristirahat tiap 40 perkara pada
 * mode yang sama (ALETA_ECOURT_ISTIRAHAT_TIAP). Terukur pada sipp_donggala
 * 25 Sep 2026: 2.527 perkara e-Court dan aleta_bot_ecourt_documents 0 baris,
 * jadi seluruh 2.527 masuk belum_pernah_ditarik, layar menulis
 * ceil(2527 x 8 / 60) = 337 menit, sementara istirahatnya sendiri
 * floor(2527/40) = 63 kali x 1-3 menit = 63-189 menit (sejak 26 Sep 2026
 * istirahatnya tetap 2 menit = 126 menit). Angka yang dipakai
 * memutuskan boleh-tidaknya menahan jalur penarikan orang lain karena itu
 * meleset 16-36% dari yang sebenarnya, ke arah yang paling merugikan.
 *
 * NAMA ENV-nya SENGAJA SAMA dengan yang dibaca run.js. Bila nilainya diubah di
 * peladen, taksiran dan perilaku berubah bersama; bila tidak disetel, keduanya
 * jatuh ke 40 - dan bawaan itu harus tetap sama dengan
 * ISTIRAHAT_TIAP_PERKARA di aleta_bot/tools/ecourt-bridge/run.js.
 */
const ISTIRAHAT_TIAP_PERKARA = Number(process.env.ALETA_ECOURT_ISTIRAHAT_TIAP || 40);
// Sejak 26 September 2026 istirahatnya TETAP 2 menit (run.js: sleep(120000))
// - gunanya membatasi beban peladen e-Court, bukan meniru kerja manusia.
// Min dan maks dipertahankan sebagai dua ruas supaya bentuk jawaban tidak
// berubah bagi pembacanya; keduanya kini sama.
const ISTIRAHAT_MENIT_MIN = 2;
const ISTIRAHAT_MENIT_MAKS = 2;

/**
 * Berapa dokumen ditaksir dimiliki perkara yang BELUM PERNAH ditarik.
 *
 * Golongan belum_pernah_ditarik dulu diberi kurang: 0, sehingga DETIK_PER_BERKAS
 * tidak berlaku bagi perkara yang justru SELURUH berkasnya harus diunduh - dan
 * pada keadaan terukur di atas itu berarti 2.527 dari 2.527 perkara ditaksir
 * tanpa satu berkas pun.
 *
 * Yang dipakai bukan angka karangan: rata-rata dokumen per perkara dihitung
 * dari perkara yang SUDAH punya baris dokumen. Angka di bawah hanya cadangan
 * untuk keadaan yang tidak dapat diukur sama sekali - nol baris dokumen, persis
 * keadaan laptop 25 Sep 2026 - dan layar menyebutkannya sebagai cadangan
 * alih-alih menampilkannya sebagai hasil ukur.
 */
const DOKUMEN_PER_PERKARA_CADANGAN = Number(
  process.env.ALETA_BOT_ECOURT_TAKSIR_DOKUMEN_BARU || 6
);

/**
 * Jatah satu penekanan tombol.
 *
 * Yang MENJALANKAN batas ini adalah ecourtSchedulerService.MAKS_BELUM_ADA;
 * angka ini dipulangkan supaya layar tidak perlu menulisnya keras sendiri.
 * Sampai 25 Sep 2026 layar mengirim 120 yang ditulis keras di TSX, sehingga
 * menaikkan ALETA_BOT_ECOURT_MAKS_BELUM_ADA di peladen tidak mengubah apa pun
 * dari jalur portal.
 *
 * Nama env dan bawaannya HARUS sama dengan MAKS_BELUM_ADA di
 * ecourtSchedulerService.js - dijaga penjaga uji, sebab dua tempat yang
 * menyimpan satu bilangan akan berselisih cepat atau lambat.
 */
const MAKS_SEKALI_TARIK = Number(process.env.ALETA_BOT_ECOURT_MAKS_BELUM_ADA || 120);

async function hitungSasaran({ contoh = 20 } = {}) {
  // Acuan selebar-lebarnya: inilah satu-satunya tempat yang boleh menjawab
  // "berapa perkara e-Court yang ADA", dan menjawabnya dari jendela 365 hari
  // berarti menyembunyikan 1.539 dari 2.527 perkara (terukur pada
  // sipp_donggala, 24 Sep 2026).
  const acuan = await sippReadOnlyBridgeService.safeHandleBridgeOperation("ecourt.caseList", {
    limit: 5000,
    sejakHari: 3650,
  });
  if (!acuan.ok || !acuan.data) {
    return { ok: false, alasan: String(acuan.error || "acuan_sipp_tidak_terbaca") };
  }

  const perkara = Array.isArray(acuan.data.perkara) ? acuan.data.perkara : [];
  const keadaan = await ecourtStoreService.ringkasKekuranganBerkas(
    perkara.map((p) => p.nomorPerkara)
  );

  // Gagal-terbuka: catatan kunjungan hanya menambah keterangan. Tanpanya
  // hitungannya kembali seperti sebelum 25 Sep 2026, bukan gagal.
  let kunjungan = new Map();
  try {
    kunjungan = await ecourtKunjunganService.kunjunganTerakhir();
  } catch {
    /* tabel kunjungan belum ada atau basis data bot tidak terjangkau */
  }

  const sasaran = [];
  let belumPernahDitarik = 0;
  let berkasKurang = 0;
  let lengkap = 0;
  let dokumenKurang = 0;
  let dokumenTidakTersedia = 0;
  // Sudah pernah DIBUKA, dan yang terbaca memang nol dokumen. Bagian dari
  // belumPernahDitarik - bukan golongan keempat - supaya selisihGolongan tetap
  // nol, tetapi disebut sendiri sebab inilah sisa yang tidak akan berkurang
  // berapa kali pun tombolnya ditekan.
  let dikunjungiTetapiKosong = 0;
  // Bahan penghitung rata-rata dokumen per perkara, dari perkara yang memang
  // punya baris. Dipakai menaksir perkara yang belum pernah ditarik.
  let dokumenTercatat = 0;
  let perkaraTercatat = 0;

  for (const p of perkara) {
    const nomor = normalizeCaseNumber(p.nomorPerkara);
    const k = keadaan.get(nomor);

    // Tidak punya baris sama sekali: ALETA tidak tahu apa pun tentang perkara
    // ini - bukan kurang satu berkas, melainkan tidak tahu berapa dokumennya.
    if (!k || k.dokumen === 0) {
      belumPernahDitarik += 1;
      const jejak = kunjungan.get(nomor);
      const pernahDibukaKosong = Boolean(jejak) && Number(jejak.dokumenTerlihat) === 0;
      if (pernahDibukaKosong) dikunjungiTetapiKosong += 1;
      sasaran.push({
        nomorPerkara: p.nomorPerkara,
        sebab: pernahDibukaKosong ? "dibuka_tetapi_kosong" : "belum_pernah_ditarik",
        kurang: 0,
      });
      continue;
    }

    dokumenTidakTersedia += k.tidakTersedia;
    dokumenTercatat += k.dokumen;
    perkaraTercatat += 1;

    if (k.tanpaBerkas > 0) {
      berkasKurang += 1;
      dokumenKurang += k.tanpaBerkas;
      sasaran.push({ nomorPerkara: p.nomorPerkara, sebab: "berkas_belum_ada", kurang: k.tanpaBerkas });
      continue;
    }

    // Dokumen yang masih menunggu verifikasi majelis TIDAK membuat perkaranya
    // jadi sasaran. Itu pertanyaan tentang verifikasi, bukan tentang berkas,
    // dan membukanya kembali tidak akan memberi satu byte pun.
    lengkap += 1;
  }

  const jumlahSasaran = sasaran.length;

  // ==========================================================================
  // TAKSIRAN WAKTU: PERKARA + BERKAS + ISTIRAHAT, DAN BERUPA RENTANG
  // ==========================================================================
  //
  // Dulu berupa rentang karena istirahatnya acak 1-3 menit. Sejak 26 Sep 2026
  // istirahatnya tetap 2 menit, jadi min dan maks sama; ruasnya tetap ada.
  const rerataDokumenTerukur = perkaraTercatat > 0 ? dokumenTercatat / perkaraTercatat : 0;
  const rerataDokumenDipakai =
    perkaraTercatat > 0 ? rerataDokumenTerukur : DOKUMEN_PER_PERKARA_CADANGAN;
  // Perkara yang belum pernah ditarik harus mengunduh SELURUH berkasnya, jadi
  // ia tidak boleh masuk taksiran dengan nol dokumen.
  const dokumenDitaksir = dokumenKurang + Math.round(belumPernahDitarik * rerataDokumenDipakai);
  const detikHalaman = jumlahSasaran * DETIK_PER_PERKARA;
  const detikBerkas = dokumenDitaksir * DETIK_PER_BERKAS;
  const jumlahIstirahat =
    ISTIRAHAT_TIAP_PERKARA > 0 ? Math.floor(jumlahSasaran / ISTIRAHAT_TIAP_PERKARA) : 0;
  const menitKerja = Math.ceil((detikHalaman + detikBerkas) / 60);

  return {
    ok: true,
    diperiksaPada: new Date().toISOString(),
    totalEcourtSipp: perkara.length,
    belumPernahDitarik,
    // Bagian dari belumPernahDitarik yang halamannya SUDAH pernah dibuka dan
    // ternyata memang nol dokumen. Tidak akan berkurang dengan menekan tombol.
    dikunjungiTetapiKosong,
    berkasKurang,
    lengkap,
    dokumenKurang,
    // Tidak ikut ditarik - e-Court sendiri tidak menyediakannya. Disebut supaya
    // jumlah yang "belum ada" tidak terbaca sebagai pekerjaan tertunda yang
    // tidak pernah berkurang.
    dokumenTidakTersedia,
    jumlahSasaran,
    // Nol berarti tiap perkara masuk tepat satu golongan. Selain nol berarti
    // ada yang luput, dan itu harus terlihat.
    selisihGolongan: perkara.length - (belumPernahDitarik + berkasKurang + lengkap),
    // Batas bawah rentang. Nama lamanya dipertahankan supaya pembaca lain tidak
    // patah, tetapi artinya kini TEGAS: istirahat dihitung pada panjang
    // yang tetap (2 menit), bukan tidak dihitung.
    perkiraanMenit: menitKerja + jumlahIstirahat * ISTIRAHAT_MENIT_MIN,
    perkiraanMenitMin: menitKerja + jumlahIstirahat * ISTIRAHAT_MENIT_MIN,
    perkiraanMenitMaks: menitKerja + jumlahIstirahat * ISTIRAHAT_MENIT_MAKS,
    // Bahan taksirannya ikut dipulangkan supaya angkanya dapat diperiksa, bukan
    // dipercaya. Tanpa ini "337 menit" hanyalah bilangan tanpa asal.
    taksiran: {
      menitKerja,
      // Dua bagiannya dibulatkan SENDIRI-SENDIRI, jadi jumlahnya boleh berbeda
      // satu menit dari menitKerja. Keduanya ada supaya terlihat berapa bagian
      // taksiran yang berasal dari membuka halaman dan berapa dari mengunduh
      // berkas - bagian kedua itulah yang bergantung rata-rata dokumen.
      menitHalaman: Math.ceil(detikHalaman / 60),
      menitBerkas: Math.ceil(detikBerkas / 60),
      jumlahIstirahat,
      istirahatMenitMin: ISTIRAHAT_MENIT_MIN,
      istirahatMenitMaks: ISTIRAHAT_MENIT_MAKS,
      istirahatTiapPerkara: ISTIRAHAT_TIAP_PERKARA,
      dokumenDitaksir,
      rerataDokumenPerPerkara: Number(rerataDokumenDipakai.toFixed(2)),
      // Benar berarti rata-ratanya DIUKUR dari baris dokumen yang ada. Salah
      // berarti tidak ada satu baris pun untuk diukur dan angka cadangan yang
      // dipakai - layar wajib mengatakannya.
      rerataTerukur: perkaraTercatat > 0,
      perkaraTerukur: perkaraTercatat,
    },
    // Jatah satu penekanan, dibaca di tempat env-nya memang hidup: proses bot.
    maksSekaliTarik: MAKS_SEKALI_TARIK,
    contoh: sasaran.slice(0, Math.max(0, Number(contoh) || 0)),
  };
}

module.exports = { hitungSasaran, MAKS_SEKALI_TARIK };
