"use strict";

/**
 * ============================================================================
 * BEBAN KINERJA KONSEPTOR PUTUSAN
 * ============================================================================
 *
 * Menghitung banyaknya putusan saja tidak menjawab apa pun. Dua orang yang
 * sama-sama menyelesaikan dua puluh putusan dapat mengerjakan dua hal yang
 * jauh berbeda beratnya: dua puluh istbat nikah yang tidak berlawan, atau dua
 * puluh perkara harta bersama dengan sembilan kali sidang dan naskah tujuh
 * ribu aksara.
 *
 * Tiap putusan karena itu diberi BOBOT, dan tiap komponen bobotnya DIUKUR di
 * salinan satker sebelum boleh masuk rumus - sebab kolom yang ADA belum tentu
 * kolom yang TERISI, dan skor yang disusun dari kolom kosong bukan penilaian
 * yang rendah melainkan penilaian yang salah.
 *
 * ============================================================================
 * INI MENILAI ORANG YANG NAMANYA TERSEBUT
 * ============================================================================
 *
 * Empat hal yang dipegang berkas ini, dan keempatnya disengaja:
 *
 *   1. ANGKA MENTAHNYA SELALU IKUT - jumlah putusan tidak pernah digantikan
 *      oleh skornya.
 *   2. TIAP PERKARA DAPAT DIBUKA RINCIANNYA. Peringkat yang tidak dapat
 *      dibantah bukan penilaian, melainkan tuduhan.
 *   3. BOBOTNYA DAPAT DISUNTING, dan dapat pula DITURUNKAN DARI DATA satker
 *      sendiri - lihat usulBobotDariData() di bawah.
 *   4. TIGA SUMBU, BUKAN SATU ANGKA. Satu angka menyembunyikan pertukarannya,
 *      dan angka tunggal itulah yang paling gampang dipakai untuk hal-hal yang
 *      bukan maksudnya.
 *
 * ============================================================================
 * KOMPONEN YANG DIPAKAI - SELURUHNYA DIUKUR LEBIH DAHULU
 * ============================================================================
 *
 * Pengukuran atas 683 putusan 2026 dan 9.993 putusan seluruhnya di
 * `sipp_donggala`:
 *
 *   HIDUP
 *     putusan_verstek           365 Y : 318 T
 *     status_putusan_id         Dikabulkan 573, Dicabut 58, Tidak Dapat
 *                               Diterima 16, Digugurkan 15, Gugur 14,
 *                               Ditolak 7
 *     pertimbangan_hukum        rata 6.486 - 15.999 aksara antarorang
 *     perkara_pihak5 (saksi)    599 dari 683 punya barisnya
 *     perkara_jadwal_sidang     rata 1,1 - 3,3 kali antarorang
 *     jumlah pihak              rata 2,12; TERTINGGI 32; 23 dari 683 di atas 2
 *     perkara_mediasi           47 dari 683
 *     jenis perkara             Harta Bersama 9,7 sidang & 7.592 aksara lawan
 *                               Cerai Gugat 2,3 sidang & 2.244 aksara;
 *                               Pdt.G 2,7 sidang lawan Pdt.P 1,1 sidang
 *
 *   HIDUP TETAPI JARANG - tetap dihitung, sebab beratnya sungguhan
 *     rekonvensi                31 dari 9.993 (lihat bagian berikutnya)
 *     perkara_putusan_sela      34 baris pada seluruh basis data
 *
 *   MATI ATAU KOSONG - dihitung, TETAPI otomatis tidak dinilai
 *     tanggal_minutasi          = tanggal_putusan pada 683 dari 683
 *     pihak_pengacara           menyentuh 4 dari 9.993 perkara. Komponennya
 *                               tetap ditulis dan tetap berbobot, tetapi
 *                               padam sendiri selama sumbernya kosong - supaya
 *                               ia menyala begitu satker mulai mengisinya,
 *                               tanpa kode diubah lagi.
 *     status_putusan_nama       NULL pada 683 dari 683
 *     status_putusan_text       kosong pada 683 dari 683 - namanya karena itu
 *                               diambil dari tabel `status_putusan` lewat id-nya
 *
 *   TIDAK ADA SUMBERNYA SAMA SEKALI
 *     eksepsi                   tidak ada tabelnya, DAN "Dalam Eksepsi" nol
 *                               dari 2.228 naskah pertimbangan. Majelis di
 *                               sini menulis kepala eksepsi dengan kalimat
 *                               lain, dan kalimat itu belum diketahui.
 *     kumulasi                  tidak bertanda tersendiri
 *
 *   SENGAJA TIDAK DINILAI - beralasan, bukan terlewat
 *     ketepatan waktu           rata daftar->putus 37 hari, dan hanya 1 dari
 *                               683 melewati 150 hari. Komponen yang hampir
 *                               selalu bernilai sama tidak membedakan siapa
 *                               pun; ia cuma menambah angka yang kelihatan
 *                               penting.
 *     banding / kasasi          11 banding dan 2 kasasi pada 9.993 putusan;
 *                               1 dari 683 putusan 2026. Terlalu sedikit untuk
 *                               apa pun, dan berbahaya sebagai penilaian:
 *                               putusan yang dibanding bukan putusan yang
 *                               salah. DITAMPILKAN sebagai keterangan, tidak
 *                               pernah masuk skor.
 *
 * ============================================================================
 * REKONVENSI DIBACA DARI NASKAHNYA, BUKAN HANYA DARI TABELNYA
 * ============================================================================
 *
 * Tabel `perkara_rekonvensi` mencatat 10 perkara pada seluruh basis data.
 * Naskah pertimbangan yang memuat kepala "Dalam Rekonvensi" atau "Dalam
 * Konvensi" mencatat 22. Gabungan keduanya: 31.
 *
 * Tabelnya sendiri karena itu melewatkan dua pertiga - petugas menulis
 * rekonvensinya di dalam naskah tanpa mengisi tabel terpisahnya. Membaca
 * keduanya bukan kemewahan, melainkan satu-satunya cara angkanya benar.
 *
 * ============================================================================
 * SIAPA YANG DISEBUT KONSEPTOR
 * ============================================================================
 *
 * SIPP tidak punya kolom "konseptor". Empat calon, dan keempatnya berarti hal
 * yang berbeda:
 *
 *   konseptor       yang MENGUNGGAH putusan pada tahapan putusan
 *                   (perkara_proses, tahapan 210). BAWAAN.
 *   ketua-majelis   hakim ketua perkara itu. 13 orang atas 683 putusan.
 *   penginput       perkara_putusan.diinput_oleh - yang MENGETIK. Hanya 8 akun,
 *                   satu bernama "Waka062024".
 *   panitera        panitera pengganti perkara itu. 12 orang.
 *
 * ============================================================================
 * KENAPA KETUA MAJELIS BUKAN LAGI BAWAANNYA
 * ============================================================================
 *
 * Ketua majelis adalah yang BERTANGGUNG JAWAB atas konsepnya, bukan yang
 * mengerjakannya. Pada satker ini konsep putusan dikerjakan anggota majelis
 * bergantian, lalu diunggah oleh yang mengerjakannya - dan menghitung seluruh
 * bebannya atas nama ketua membuat layar ini menjawab pertanyaan yang tidak
 * pernah ditanyakan orang. Yang ditanyakan "siapa yang menulis putusan ini",
 * dan jawabannya sudah ada di layar Status Perkara.
 *
 * Sumbernya dibuat SAMA PERSIS dengan layar itu - perkara_proses pada tahapan
 * putusan, pencatat yang paling awal - sebab dua layar yang menyebut angka
 * berbeda untuk satu perkara yang sama tidak dibaca sebagai dua ukuran,
 * melainkan sebagai satu yang keliru.
 *
 * Bedanya dengan `penginput`, yang sekilas mirip: `penginput` membaca
 * perkara_putusan.diinput_oleh - akun yang mengetikkan BARIS PUTUSANNYA,
 * terukur hanya 8 akun dan salah satunya akun jabatan. Yang dibaca di sini
 * tahapan putusannya, dan itulah yang ditunjuk satker sebagai konseptor.
 *
 * Putusan yang tahapan putusannya tidak pernah tercatat tidak dikarang
 * pemiliknya: ia jatuh ke "(tidak tercatat)" dan tetap terlihat di layar.
 * Menyebar sisa itu ke ketua majelis akan membuat angka yang salah tampak
 * lengkap - dan yang lengkap tidak pernah diperiksa lagi.
 */

const db = require("../db_config");
const sippSkemaService = require("./sippSkemaService");
const sippTahapanService = require("./sippTahapanService");

/** Periode yang dapat dipilih - "rentang" memakai tanggal yang disebut sendiri. */
const PERIODE = ["minggu", "bulan", "triwulan", "semester", "tahun", "total", "rentang"];

/** Dasar penyebutan konseptor. Yang pertama menjadi bawaannya. */
const DASAR = ["konseptor", "ketua-majelis", "penginput", "panitera"];

/**
 * Jenis perkara KEBENDAAN - di luar hubungan perkawinan.
 *
 * Diturunkan dari daftar jenis perkara yang sungguh diputus satker ini, bukan
 * dari daftar umum. Beratnya terukur: Harta Bersama 9,7 sidang dan 7.592
 * aksara, Kewarisan 6,6 sidang - lawan Cerai Gugat 2,3 sidang.
 *
 * P3HP/Penetapan Ahli Waris ikut di sini meski nomornya Pdt.P: yang dibagi
 * harta, dan itulah pengecualian yang disebut satker - "kecuali terkait
 * kebendaan atau di luar perkawinan".
 */
const JENIS_KEBENDAAN = [
  "harta bersama",
  "kewarisan",
  "ekonomi syariah",
  "wasiat",
  "ahli waris",
  "p3hp",
  "hibah",
  "wakaf",
];

/**
 * Bobot AWAL - masuk akal, bukan mutlak.
 *
 * Titik tolaknya satu gagasan: putusan verstek tanpa saksi, dua pihak, tiga
 * kali sidang, naskah pendek = 1,0. Segala yang menambah pekerjaan menambah
 * angkanya dari situ.
 *
 * Dan bobot ini BUKAN satu-satunya jawaban - usulBobotDariData() menurunkan
 * bobot tandingannya dari riwayat satker sendiri.
 */
const BOBOT_AWAL = {
  dasar: 1.0,
  /** Contradictoir menuntut jawaban, replik, duplik - verstek tidak. */
  contradictoir: 0.8,
  /** Gugatan balik: satu naskah yang memutus dua perkara. */
  rekonvensi: 1.0,
  /** Putusan sela adalah naskah utuh tersendiri. */
  putusanSela: 0.8,
  /** Tiap saksi menambah pemeriksaan dan satu alinea pertimbangan. */
  perSaksi: 0.2,
  /** Tiap pihak di atas dua - penggugat dan tergugat adalah bentuk dasarnya. */
  perPihakLebih: 0.1,
  /** Sidang di atas tiga - tiga sidang adalah perkara paling sederhana. */
  perSidangLebih: 0.1,
  /** Tiap seribu aksara pertimbangan di atas tiga ribu. */
  perSeribuAksara: 0.15,
  /**
   * Perkara yang melewati mediasi lalu tetap disidangkan.
   *
   * Mediasinya sendiri pekerjaan mediator, bukan konseptor - yang dihargai di
   * sini bahwa perkaranya berjalan penuh, tidak putus di awal.
   */
  mediasi: 0.2,
  /**
   * Ada kuasa hukum beracara - lawan yang profesional menaikkan tuntutan atas
   * naskahnya.
   *
   * PADAM SENDIRI selama sumbernya kosong: `pihak_pengacara` hanya menyentuh
   * 4 dari 9.993 perkara. Bobotnya tetap berdiri supaya ia menyala begitu
   * satker mulai mengisinya.
   */
  kuasaHukum: 0.3,
  /**
   * Status yang meringankan - DIKALIKAN, bukan dikurangi. Perkara yang dicabut
   * sebelum pemeriksaan tidak "berkurang" bebannya; ia memang tidak pernah
   * memikul beban itu.
   *
   * Mana yang berhak atas pengganda ini DIUKUR. Rata sidang dan aksara:
   *
   *     Dikabulkan            573 perkara   2,4 sidang   12.122 aksara
   *     Dicabut                58 perkara   1,8 sidang    2.499 aksara
   *     Tidak Dapat Diterima   16 perkara   4,9 sidang    6.715 aksara
   *     Digugurkan             15 perkara   2,1 sidang    1.097 aksara
   *     Gugur                  14 perkara   1,7 sidang    1.219 aksara
   *     Ditolak                 7 perkara   5,1 sidang   15.277 aksara
   *
   * Hanya tiga yang benar-benar berhenti lebih awal; dari 87 perkara berstatus
   * itu, cuma DUA yang sidangnya lima kali atau lebih.
   *
   * "Ditolak" dan "Tidak Dapat Diterima" TIDAK diberi pengganda meski satker
   * memintanya, dan sebabnya dua. Pertama, beratnya sudah tertangkap komponen
   * sidang dan aksara - menambah pengganda berarti membayarnya dua kali.
   * Kedua, memberi angka lebih rendah kepada hakim yang menolak gugatan
   * berarti membangun alat yang mengganjar mengabulkan, dan itu bukan
   * kekeliruan menghitung melainkan kekeliruan yang menyentuh kemerdekaan
   * mengadili.
   */
  penggandaStatus: {
    gugur: 0.35,
    dicabut: 0.3,
  },
  /**
   * Pengganda menurut jenis dan ragam perkaranya.
   *
   * Sengaja KECIL, dan sebabnya penting: jumlah sidang dan panjang naskah
   * SUDAH menangkap sebagian besar beratnya. Harta bersama yang 9,7 kali
   * sidang sudah memperoleh +0,67 dari komponen sidang dan +0,69 dari
   * aksaranya. Yang belum terhitung hanya kesulitan hukumnya sendiri -
   * membagi objek, menentukan bagian, sita jaminan.
   *
   * Pengganda besar di sini akan menghitung berat yang sama dua kali.
   *
   *     kebendaan    1,30   Harta Bersama 9,7 sidang, Kewarisan 6,6 sidang
   *     gugatan      1,00   Pdt.G 2,7 sidang, 2.235 aksara - bentuk dasarnya
   *     permohonan   0,85   Pdt.P 1,1 sidang, 1.265 aksara, verstek 1%
   *
   * Kebendaan MENANG atas permohonan: P3HP bernomor Pdt.P tetapi naskahnya
   * 3.049 aksara, di atas rata-rata Pdt.G.
   */
  penggandaJenis: {
    kebendaan: 1.3,
    gugatan: 1.0,
    permohonan: 0.85,
  },
};

const BATAS_SIDANG_DASAR = 3;
const BATAS_AKSARA_DASAR = 3000;
const BATAS_PIHAK_DASAR = 2;

/**
 * Di atas sekian putusan, daftar rincian per perkara dimatikan sendiri.
 *
 * Bukan demi kecepatan kueri - melainkan demi yang membacanya: rentang seluruh
 * basis data berisi 9.993 perkara, dan sembilan ribu baris rincian bukan
 * sesuatu yang dibuka siapa pun.
 */
const BATAS_RINCIAN = 1000;

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

const dua = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;

/**
 * Tanggal kolom DATE menjadi teks ISO.
 *
 * Penggerak MySQL memulangkan kolom DATE sebagai obyek Date, dan
 * `String(date).slice(0, 10)` menghasilkan "Wed Sep 08" - bukan tanggal, dan
 * cocok-pola tanggalnya gagal diam-diam. Akibatnya rentang bulan aktif tiap
 * konseptor terbaca NOL, dan seluruh angka per-bulan ikut nol tanpa satu pun
 * galat berbunyi. Terjadi sekali, ketahuan hanya karena angkanya dilihat.
 */
function tanggalIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    return Number.isNaN(nilai.getTime()) ? "" : iso(nilai);
  }
  const teks = String(nilai);
  return /^\d{4}-\d{2}-\d{2}/.test(teks) ? teks.slice(0, 10) : "";
}
const bulat = (n) => Math.round(n * 100) / 100;
const HARI_SEBULAN = 30.44;

/**
 * Rentang tanggal satu periode.
 *
 * Acuannya tanggal yang disebut pemanggil, bukan hari ini - supaya laporan
 * bulan lalu tetap dapat disusun bulan ini.
 */
function rentangPeriode(periode, acuanIso, dari, sampai) {
  if (periode === "rentang") {
    return { dari: String(dari || ""), sampai: String(sampai || "") };
  }
  const acuan = /^\d{4}-\d{2}-\d{2}$/.test(String(acuanIso || "")) ? new Date(`${acuanIso}T00:00:00`) : new Date();
  const tahun = acuan.getFullYear();

  if (periode === "total") return { dari: "1900-01-01", sampai: "2999-12-31" };
  if (periode === "tahun") return { dari: `${tahun}-01-01`, sampai: `${tahun}-12-31` };
  if (periode === "semester") {
    const awal = acuan.getMonth() < 6 ? 1 : 7;
    return { dari: `${tahun}-${dua(awal)}-01`, sampai: awal === 1 ? `${tahun}-06-30` : `${tahun}-12-31` };
  }
  if (periode === "triwulan") {
    const awal = Math.floor(acuan.getMonth() / 3) * 3 + 1;
    return { dari: `${tahun}-${dua(awal)}-01`, sampai: iso(new Date(tahun, awal + 2, 0)) };
  }
  if (periode === "bulan") {
    const bulan = acuan.getMonth() + 1;
    return { dari: `${tahun}-${dua(bulan)}-01`, sampai: iso(new Date(tahun, bulan, 0)) };
  }
  // minggu - Senin sampai Minggu, sebagaimana pekan kerja dibaca orang.
  const hari = acuan.getDay() === 0 ? 7 : acuan.getDay();
  const senin = new Date(acuan);
  senin.setDate(acuan.getDate() - (hari - 1));
  const minggu = new Date(senin);
  minggu.setDate(senin.getDate() + 6);
  return { dari: iso(senin), sampai: iso(minggu) };
}

const petaAngka = (baris) => {
  const peta = new Map();
  for (const b of baris) peta.set(String(b.perkara_id), Number(b.n) || 0);
  return peta;
};
const petaNama = (baris) => {
  const peta = new Map();
  for (const b of baris) peta.set(String(b.perkara_id), String(b.nama || ""));
  return peta;
};

/**
 * Menjalankan kueri satu per satu, BUKAN berbarengan.
 *
 * Diukur atas rentang seluruh basis data (9.993 putusan):
 *
 *      berbarengan (Promise.all)   7.428 ms   inti sendiri melar 2.390 -> 7.426
 *      berurutan                   5,4 detik
 *
 * Kueri yang saling berebut satu MySQL membuat masing-masing lebih lambat
 * daripada kalau mengantre. Dan ada sebab kedua yang lebih penting daripada
 * kecepatan: yang dibaca ini basis data SIPP yang SEDANG DIPAKAI petugas.
 */
async function berurutan(daftarThunk) {
  const hasil = [];
  for (const thunk of daftarThunk) hasil.push(await thunk());
  return hasil;
}

async function fakta(dari, sampai, dasar) {
  const saring = "pp.tanggal_putusan BETWEEN ? AND ?";
  const p = [dari, sampai];

  const inti = () =>
    kueri(
      `SELECT p.perkara_id                AS perkaraId,
              p.nomor_perkara             AS nomorPerkara,
              p.jenis_perkara_text        AS jenisPerkara,
              pp.tanggal_putusan          AS tanggalPutusan,
              pp.tanggal_minutasi         AS tanggalMinutasi,
              pp.putusan_verstek          AS verstek,
              pp.diinput_oleh             AS penginput,
              COALESCE(NULLIF(pp.status_putusan_nama, ''),
                       NULLIF(pp.status_putusan_text, ''),
                       sp.nama)           AS statusPutusan
         FROM perkara p
         JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
         LEFT JOIN status_putusan sp ON sp.id = pp.status_putusan_id
        WHERE pp.tanggal_putusan IS NOT NULL AND ${saring}`,
      p
    );

  // MIN() menjaga dari perkara yang punya DUA baris hakim urutan 1 aktif -
  // terukur ada, dan satu JOIN biasa akan melipatgandakan putusannya.
  const hakim = () =>
    kueri(
      `SELECT hk.perkara_id, MIN(hk.hakim_nama) AS nama
         FROM perkara_hakim_pn hk
         JOIN perkara_putusan pp ON pp.perkara_id = hk.perkara_id
        WHERE hk.aktif = 'Y' AND hk.urutan = 1 AND ${saring}
        GROUP BY hk.perkara_id`,
      p
    );
  const panitera = () =>
    kueri(
      `SELECT pen.perkara_id, MIN(pen.panitera_pengganti_text) AS nama
         FROM perkara_penetapan pen
         JOIN perkara_putusan pp ON pp.perkara_id = pen.perkara_id
        WHERE ${saring}
        GROUP BY pen.perkara_id`,
      p
    );

  /**
   * Konseptor sungguhan: yang mengunggah putusan pada tahapan putusan.
   *
   * Nama kolomnya TIDAK ditulis tetap. Versi SIPP berbeda menamai kolom
   * perkara_proses dengan cara yang berbeda, dan skema itu sudah dikenali
   * sippSkemaService - menuliskannya tetap di sini berarti kueri yang gagal
   * diam-diam pada satker yang versinya lain, dan kegagalan yang ditelan
   * `catch` akan tampak sebagai seluruh putusan tanpa konseptor.
   *
   * Seluruh barisnya diambil, bukan hanya yang terawal lewat SQL: satu perkara
   * dapat punya beberapa baris tahapan putusan, dan pemilihan yang terawal
   * dikerjakan di JS supaya tidak bergantung pada fungsi jendela yang belum
   * ada pada MySQL 5.7.
   */
  const konseptor = async () => {
    if (!(await sippSkemaService.tabelAda("perkara_proses").catch(() => false))) return [];
    const kol = await sippSkemaService.kolomTerpilih().catch(() => ({}));
    if (!kol.prosesTahapanId || !kol.prosesDiinputOleh) return [];
    const pilih = ["pr.perkara_id", `pr.${kol.prosesDiinputOleh} AS pengguna`];
    if (kol.prosesTanggal) pilih.push(`pr.${kol.prosesTanggal} AS tanggal`);
    return kueri(
      `SELECT ${pilih.join(", ")}
         FROM perkara_proses pr
         JOIN perkara_putusan pp ON pp.perkara_id = pr.perkara_id
        WHERE pr.${kol.prosesTahapanId} = ? AND ${saring}`,
      [sippTahapanService.TAHAPAN_PUTUSAN, ...p]
    ).catch(() => []);
  };
  // Panjang naskah DAN penanda rekonvensi di dalamnya dibaca SEKALI.
  //
  // Keduanya membaca tabel yang sama dan sama-sama harus membuka longtext-nya.
  // Sebagai dua kueri terpisah, yang kedua diukur 1.588 ms atas rentang seluruh
  // basis data - satu setengah detik untuk membaca ulang naskah yang barusan
  // dibaca. Digabung, ongkosnya nyaris nol.
  const aksara = () =>
    kueri(
      `SELECT ph.perkara_id,
              MAX(CHAR_LENGTH(ph.pertimbangan_hukum)) AS n,
              MAX(ph.pertimbangan_hukum LIKE '%Dalam Rekonvensi%'
               OR ph.pertimbangan_hukum LIKE '%Dalam Konvensi%') AS adaRekonvensi
         FROM perkara_pertimbangan_hukum ph
         JOIN perkara_putusan pp ON pp.perkara_id = ph.perkara_id
        WHERE ${saring}
        GROUP BY ph.perkara_id`,
      p
    );
  const saksi = () =>
    kueri(
      `SELECT s5.perkara_id, COUNT(*) AS n
         FROM perkara_pihak5 s5
         JOIN perkara_putusan pp ON pp.perkara_id = s5.perkara_id
        WHERE ${saring}
        GROUP BY s5.perkara_id`,
      p
    );
  const sidang = () =>
    kueri(
      `SELECT j.perkara_id, COUNT(*) AS n
         FROM perkara_jadwal_sidang j
         JOIN perkara_putusan pp ON pp.perkara_id = j.perkara_id
        WHERE ${saring}
        GROUP BY j.perkara_id`,
      p
    );

  // Pihak: penggugat, tergugat, turut tergugat. perkara_pihak3 kosong
  // seluruhnya (0 baris) dan perkara_pihak5 adalah SAKSI, bukan pihak.
  const pihak = () =>
    kueri(
      `SELECT z.perkara_id, SUM(z.n) AS n FROM (
         SELECT x.perkara_id, COUNT(*) AS n FROM perkara_pihak1 x
           JOIN perkara_putusan pp ON pp.perkara_id = x.perkara_id
          WHERE ${saring} GROUP BY x.perkara_id
         UNION ALL
         SELECT x.perkara_id, COUNT(*) AS n FROM perkara_pihak2 x
           JOIN perkara_putusan pp ON pp.perkara_id = x.perkara_id
          WHERE ${saring} GROUP BY x.perkara_id
         UNION ALL
         SELECT x.perkara_id, COUNT(*) AS n FROM perkara_pihak4 x
           JOIN perkara_putusan pp ON pp.perkara_id = x.perkara_id
          WHERE ${saring} GROUP BY x.perkara_id
       ) z GROUP BY z.perkara_id`,
      [...p, ...p, ...p]
    );

  // Rekonvensi DUA sumber - tabelnya dan naskahnya. Tabel sendirian
  // melewatkan dua pertiganya: 10 di tabel, 22 di naskah, 31 gabungan. Yang
  // dari naskah ikut bersama kueri aksara di atas; di sini hanya tabelnya.
  const rekonvensi = () =>
    kueri(
      `SELECT r.perkara_id, COUNT(*) AS n
         FROM perkara_rekonvensi r
         JOIN perkara_putusan pp ON pp.perkara_id = r.perkara_id
        WHERE ${saring}
        GROUP BY r.perkara_id`,
      p
    );

  const sela = () =>
    kueri(
      `SELECT s.perkara_id, COUNT(*) AS n
         FROM perkara_putusan_sela s
         JOIN perkara_putusan pp ON pp.perkara_id = s.perkara_id
        WHERE ${saring}
        GROUP BY s.perkara_id`,
      p
    );
  const anonim = () =>
    kueri(
      `SELECT a.perkara_id, COUNT(*) AS n
         FROM perkara_putusan_anonim a
         JOIN perkara_putusan pp ON pp.perkara_id = a.perkara_id
        WHERE ${saring}
        GROUP BY a.perkara_id`,
      p
    );
  const mediasi = () =>
    kueri(
      `SELECT m.perkara_id, COUNT(*) AS n
         FROM perkara_mediasi m
         JOIN perkara_putusan pp ON pp.perkara_id = m.perkara_id
        WHERE ${saring}
        GROUP BY m.perkara_id`,
      p
    );
  const kuasa = () =>
    kueri(
      `SELECT z.perkara_id, SUM(z.n) AS n FROM (
         SELECT y.perkara_id, COUNT(*) AS n FROM perkara_pihak1 y
           JOIN pihak_pengacara x ON x.pihak_id = y.pihak_id
           JOIN perkara_putusan pp ON pp.perkara_id = y.perkara_id
          WHERE ${saring} GROUP BY y.perkara_id
         UNION ALL
         SELECT y.perkara_id, COUNT(*) AS n FROM perkara_pihak2 y
           JOIN pihak_pengacara x ON x.pihak_id = y.pihak_id
           JOIN perkara_putusan pp ON pp.perkara_id = y.perkara_id
          WHERE ${saring} GROUP BY y.perkara_id
       ) z GROUP BY z.perkara_id`,
      [...p, ...p]
    );

  // Banding dan kasasi DIBACA tetapi tidak pernah masuk skor - keterangan
  // belaka. 11 banding dan 2 kasasi pada 9.993 putusan, dan putusan yang
  // dibanding bukan putusan yang salah.
  const banding = () =>
    kueri(
      `SELECT z.perkara_id, SUM(z.n) AS n FROM (
         SELECT b.perkara_id, 1 AS n FROM perkara_banding b
           JOIN perkara_putusan pp ON pp.perkara_id = b.perkara_id WHERE ${saring}
         UNION ALL
         SELECT k.perkara_id, 1 AS n FROM perkara_kasasi k
           JOIN perkara_putusan pp ON pp.perkara_id = k.perkara_id WHERE ${saring}
       ) z GROUP BY z.perkara_id`,
      [...p, ...p]
    );

  // ==========================================================================
  // HANYA DASAR YANG DIPILIH YANG DIBACA
  // ==========================================================================
  //
  // Nama ketua majelis dan nama panitera pengganti dahulu dibaca keduanya pada
  // tiap permintaan, padahal hanya satu yang dipakai - yang lain dibuang
  // seutuhnya. Ongkosnya terukur: kueri hakim 1.182 ms dan panitera 377 ms
  // atas rentang seluruh basis data. Membaca yang tidak akan dipakai adalah
  // satu setengah detik yang diminta dari MySQL satker tanpa sebab.
  //
  // `penginput` tidak menuntut kueri sama sekali - ia sudah ada pada kueri
  // inti.
  const kosong = () => Promise.resolve([]);
  const [b, kn, h, pn, ak, sk, sd, ph, rk, sl, an, md, ku, bd] = await berurutan([
    inti,
    dasar === "konseptor" ? konseptor : kosong,
    dasar === "ketua-majelis" ? hakim : kosong,
    dasar === "panitera" ? panitera : kosong,
    aksara,
    saksi,
    sidang,
    pihak,
    rekonvensi,
    sela,
    anonim,
    mediasi,
    kuasa,
    banding,
  ]);

  const namaHakim = petaNama(h);
  const namaPanitera = petaNama(pn);
  const petaKonseptor = await petaKonseptorPutusan(kn);
  const petaAksara = petaAngka(ak);
  const petaRekonvensiNaskah = new Map();
  for (const b of ak) petaRekonvensiNaskah.set(String(b.perkara_id), Number(b.adaRekonvensi) > 0 ? 1 : 0);
  const petaSaksi = petaAngka(sk);
  const petaSidang = petaAngka(sd);
  const petaPihak = petaAngka(ph);
  const petaRekonvensi = petaAngka(rk);
  const petaSela = petaAngka(sl);
  const petaAnonim = petaAngka(an);
  const petaMediasi = petaAngka(md);
  const petaKuasa = petaAngka(ku);
  const petaBanding = petaAngka(bd);

  return b.map((satu) => {
    const id = String(satu.perkaraId);
    return {
      ...satu,
      konseptor: petaKonseptor.get(id) || "",
      ketuaMajelis: namaHakim.get(id) || "",
      panitera: namaPanitera.get(id) || "",
      panjangPertimbangan: petaAksara.get(id) || 0,
      saksi: petaSaksi.get(id) || 0,
      sidang: petaSidang.get(id) || 0,
      pihak: petaPihak.get(id) || 0,
      rekonvensi: (petaRekonvensi.get(id) || 0) + (petaRekonvensiNaskah.get(id) || 0),
      putusanSela: petaSela.get(id) || 0,
      anonim: petaAnonim.get(id) || 0,
      mediasi: petaMediasi.get(id) || 0,
      kuasa: petaKuasa.get(id) || 0,
      banding: petaBanding.get(id) || 0,
    };
  });
}

/**
 * Perkara -> nama konseptornya, dari baris tahapan putusan.
 *
 * Dua hal dikerjakan di sini, dan keduanya tidak dapat dikerjakan SQL dengan
 * murah:
 *
 * Pertama, memilih baris yang PALING AWAL bila satu perkara punya beberapa
 * baris tahapan putusan - putusan yang diperbaiki lalu diunggah ulang punya
 * dua, dan yang mengerjakannya adalah yang pertama. Ini aturan yang sama
 * dengan layar Status Perkara, yang mengurutkan tanggal menaik lalu mengambil
 * yang pertama.
 *
 * Kedua, menerjemahkan nama pengguna menjadi nama lengkap. Tanpa itu layarnya
 * memeringkat "hakim01" dan "dbriantono", dan peringkat yang tidak menyebut
 * nama orang tidak dapat ditunjukkan kepada orangnya.
 *
 * Diterjemahkan BERKELOMPOK lima puluh, sebab namaPengguna membatasi diri
 * lima puluh nama per kueri - satker dengan konseptor lebih banyak dari itu
 * akan kehilangan sisanya tanpa satu pun galat.
 */
async function petaKonseptorPutusan(baris) {
  const hasil = new Map();
  if (!Array.isArray(baris) || baris.length === 0) return hasil;

  const terawal = new Map();
  for (const row of baris) {
    const id = String(row.perkara_id);
    const pengguna = String(row.pengguna || "").trim();
    if (!pengguna) continue;
    // Tanpa kolom tanggal seluruhnya bernilai 0, dan yang bertahan adalah
    // baris pertama yang datang - urutan SIPP sendiri.
    const waktu = row.tanggal ? new Date(row.tanggal).getTime() : 0;
    const lama = terawal.get(id);
    if (!lama || (Number.isFinite(waktu) && waktu < lama.waktu)) {
      terawal.set(id, { pengguna, waktu: Number.isFinite(waktu) ? waktu : 0 });
    }
  }

  const pengguna = [...new Set([...terawal.values()].map((x) => x.pengguna))];
  const nama = {};
  for (let i = 0; i < pengguna.length; i += 50) {
    const sepotong = await sippTahapanService
      .namaPengguna(pengguna.slice(i, i + 50))
      .catch(() => ({}));
    Object.assign(nama, sepotong);
  }

  // Nama lengkap bila terbaca; nama penggunanya bila tidak - bukan kosong.
  // Kosong akan melebur ke "(tidak tercatat)" bersama putusan yang memang
  // tidak punya tahapan putusan, dan dua hal berbeda itu tidak boleh dihitung
  // sebagai satu.
  for (const [id, x] of terawal) hasil.set(id, nama[x.pengguna] || x.pengguna);
  return hasil;
}

/** Nama konseptor satu baris, menurut dasar yang dipilih. */
function sebutKonseptor(baris, dasar) {
  if (dasar === "ketua-majelis") return String(baris.ketuaMajelis || "").trim();
  if (dasar === "penginput") return String(baris.penginput || "").trim();
  if (dasar === "panitera") return String(baris.panitera || "").trim();
  return String(baris.konseptor || "").trim();
}

/** Kebendaan, gugatan, atau permohonan - dari jenis perkara dan nomornya. */
function ragamPerkara(baris) {
  const jenis = String(baris.jenisPerkara || "").toLowerCase();
  if (JENIS_KEBENDAAN.some((k) => jenis.includes(k))) return "kebendaan";
  // Pdt.G gugatan (ada lawan), Pdt.P permohonan (tidak ada lawan). Terukur:
  // Pdt.G 2,7 sidang dan verstek 73%; Pdt.P 1,1 sidang dan verstek 1%.
  return /pdt\.?g/i.test(String(baris.nomorPerkara || "")) ? "gugatan" : "permohonan";
}

/**
 * Skor satu putusan beserta rincian yang menyusunnya.
 *
 * @param {object} padam komponen yang sumbernya kosong pada rentang ini -
 *                       bobotnya diabaikan, dan itu dicatat, bukan dibisukan.
 */
function skorSatu(baris, bobot, padam = {}) {
  const rincian = [];
  let skor = bobot.dasar;
  rincian.push({ sebab: "putusan", tambah: bulat(bobot.dasar) });

  if (String(baris.verstek || "").toUpperCase() !== "Y") {
    skor += bobot.contradictoir;
    rincian.push({ sebab: "contradictoir", tambah: bulat(bobot.contradictoir) });
  }
  if (Number(baris.rekonvensi) > 0) {
    skor += bobot.rekonvensi;
    rincian.push({ sebab: "rekonvensi", tambah: bulat(bobot.rekonvensi) });
  }
  const sela = Number(baris.putusanSela) || 0;
  if (sela > 0) {
    const tambah = bobot.putusanSela * sela;
    skor += tambah;
    rincian.push({ sebab: `putusan sela ${sela}`, tambah: bulat(tambah) });
  }
  const saksi = Number(baris.saksi) || 0;
  if (saksi > 0) {
    const tambah = bobot.perSaksi * saksi;
    skor += tambah;
    rincian.push({ sebab: `${saksi} saksi`, tambah: bulat(tambah) });
  }
  const pihak = Number(baris.pihak) || 0;
  if (pihak > BATAS_PIHAK_DASAR) {
    const tambah = bobot.perPihakLebih * (pihak - BATAS_PIHAK_DASAR);
    skor += tambah;
    rincian.push({ sebab: `${pihak} pihak`, tambah: bulat(tambah) });
  }
  const sidang = Number(baris.sidang) || 0;
  if (sidang > BATAS_SIDANG_DASAR) {
    const tambah = bobot.perSidangLebih * (sidang - BATAS_SIDANG_DASAR);
    skor += tambah;
    rincian.push({ sebab: `${sidang} kali sidang`, tambah: bulat(tambah) });
  }
  const aksara = Number(baris.panjangPertimbangan) || 0;
  if (aksara > BATAS_AKSARA_DASAR) {
    const tambah = (bobot.perSeribuAksara * (aksara - BATAS_AKSARA_DASAR)) / 1000;
    skor += tambah;
    rincian.push({ sebab: `pertimbangan ${aksara.toLocaleString("id-ID")} aksara`, tambah: bulat(tambah) });
  }
  if (!padam.mediasi && Number(baris.mediasi) > 0) {
    skor += bobot.mediasi;
    rincian.push({ sebab: "melewati mediasi", tambah: bulat(bobot.mediasi) });
  }
  if (!padam.kuasaHukum && Number(baris.kuasa) > 0) {
    skor += bobot.kuasaHukum;
    rincian.push({ sebab: "ada kuasa hukum", tambah: bulat(bobot.kuasaHukum) });
  }

  const status = String(baris.statusPutusan || "").toLowerCase();
  let pengganda = 1;
  for (const [kata, nilai] of Object.entries(bobot.penggandaStatus)) {
    if (status.includes(kata)) {
      pengganda = nilai;
      break;
    }
  }
  if (pengganda !== 1) rincian.push({ sebab: `status "${baris.statusPutusan}"`, kali: pengganda });

  const ragam = ragamPerkara(baris);
  const penggandaJenis = Number(bobot.penggandaJenis[ragam]) || 1;
  if (penggandaJenis !== 1) rincian.push({ sebab: ragam, kali: penggandaJenis });

  return { skor: bulat(skor * pengganda * penggandaJenis), rincian, pengganda, ragam };
}

/** Jeda hari antara dua tanggal - null bila salah satunya tidak ada. */
function jedaHari(awal, akhir) {
  const a = awal instanceof Date ? awal : new Date(String(awal || ""));
  const b = akhir instanceof Date ? akhir : new Date(String(akhir || ""));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const tengah = (deret) =>
  deret.length > 0 ? [...deret].sort((a, b) => a - b)[Math.floor(deret.length / 2)] : null;

/**
 * ============================================================================
 * BOBOT YANG DITURUNKAN DARI RIWAYAT SATKER, BUKAN DIKARANG
 * ============================================================================
 *
 * Kelemahan terbesar bobot di atas: ia karangan yang masuk akal, bukan
 * kenyataan. Fungsi ini menawarkan tandingannya.
 *
 * Gagasannya sederhana. Ada dua hal yang TIDAK perlu ditebak beratnya karena
 * memang terukur langsung - berapa kali disidangkan, dan berapa panjang
 * naskahnya. Keduanya dipakai sebagai "berat teramati":
 *
 *     berat = sidang/rata-sidang + aksara/rata-aksara
 *
 * Lalu dicari bobot komponen LAIN - contradictoir, rekonvensi, saksi, pihak,
 * mediasi, kebendaan, permohonan - yang paling mendekati berat itu, dengan
 * kuadrat terkecil. Hasilnya diskalakan supaya perkara dasarnya = 1,0, sama
 * seperti bobot karangan, jadi keduanya dapat dibandingkan berdampingan.
 *
 * DUA PERINGATAN, dan keduanya harus ikut terbaca pengguna:
 *
 *   1. Sidang dan aksara TIDAK ikut sebagai penduga - keduanya adalah
 *      sasarannya. Memasukkannya berarti menduga sesuatu dengan dirinya
 *      sendiri, dan angkanya akan tampak sempurna tanpa berarti apa pun.
 *   2. Ini USUL, bukan kebenaran. Ia hanya berkata "di satker ini, perkara
 *      berekonvensi rata-rata sekian kali lebih berat daripada yang tidak" -
 *      dan sejarah satker memuat kebiasaannya sendiri, termasuk kebiasaan
 *      yang justru ingin diperbaiki.
 */
function usulBobotDariData(baris) {
  const cukup = baris.filter((b) => Number(b.sidang) > 0 || Number(b.panjangPertimbangan) > 0);
  if (cukup.length < 30) {
    return { ok: false, alasan: "data_terlalu_sedikit", perkara: cukup.length, minimum: 30 };
  }

  const rataSidang = cukup.reduce((n, b) => n + (Number(b.sidang) || 0), 0) / cukup.length;
  const rataAksara = cukup.reduce((n, b) => n + (Number(b.panjangPertimbangan) || 0), 0) / cukup.length;
  if (rataSidang <= 0 && rataAksara <= 0) {
    return { ok: false, alasan: "berat_teramati_kosong" };
  }

  const NAMA = [
    "contradictoir",
    "rekonvensi",
    "putusanSela",
    "perSaksi",
    "perPihakLebih",
    "mediasi",
    "kebendaan",
    "permohonan",
  ];
  const penduga = (b) => [
    1, // tetapan - inilah "perkara dasar"
    String(b.verstek || "").toUpperCase() !== "Y" ? 1 : 0,
    Number(b.rekonvensi) > 0 ? 1 : 0,
    Number(b.putusanSela) || 0,
    Number(b.saksi) || 0,
    Math.max(0, (Number(b.pihak) || 0) - BATAS_PIHAK_DASAR),
    Number(b.mediasi) > 0 ? 1 : 0,
    ragamPerkara(b) === "kebendaan" ? 1 : 0,
    ragamPerkara(b) === "permohonan" ? 1 : 0,
  ];
  const sasaran = (b) =>
    (rataSidang > 0 ? (Number(b.sidang) || 0) / rataSidang : 0) +
    (rataAksara > 0 ? (Number(b.panjangPertimbangan) || 0) / rataAksara : 0);

  const k = NAMA.length + 1;
  // Persamaan normal X'X w = X'y, diselesaikan dengan eliminasi Gauss beserta
  // pemilihan tumpu - tanpa satu pun pustaka tambahan.
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (const b of cukup) {
    const x = penduga(b);
    const y = sasaran(b);
    for (let i = 0; i < k; i += 1) {
      for (let j = 0; j < k; j += 1) A[i][j] += x[i] * x[j];
      A[i][k] += x[i] * y;
    }
  }
  for (let i = 0; i < k; i += 1) {
    let tumpu = i;
    for (let r = i + 1; r < k; r += 1) if (Math.abs(A[r][i]) > Math.abs(A[tumpu][i])) tumpu = r;
    if (Math.abs(A[tumpu][i]) < 1e-10) {
      // Kolom yang seluruhnya nol - komponen yang tidak pernah muncul pada
      // rentang ini. Dibiarkan nol, bukan dipaksa.
      continue;
    }
    [A[i], A[tumpu]] = [A[tumpu], A[i]];
    for (let r = 0; r < k; r += 1) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c <= k; c += 1) A[r][c] -= f * A[i][c];
    }
  }
  const w = new Array(k).fill(0);
  for (let i = 0; i < k; i += 1) w[i] = Math.abs(A[i][i]) < 1e-10 ? 0 : A[i][k] / A[i][i];

  const tetapan = w[0];
  if (!Number.isFinite(tetapan) || Math.abs(tetapan) < 1e-6) {
    return { ok: false, alasan: "perkara_dasar_tidak_terbentuk" };
  }

  // Berapa kali tiap komponen sungguh MUNCUL pada rentang ini. Bobot yang
  // diturunkan dari tiga perkara bukan bobot, melainkan kebetulan - dan
  // pembacanya berhak tahu bersandar pada berapa banyak.
  const teramati = {};
  NAMA.forEach((nama, i) => {
    teramati[nama] = cukup.reduce((n, b) => n + (penduga(b)[i + 1] > 0 ? 1 : 0), 0);
  });

  // ==========================================================================
  // BOBOT NEGATIF DIJADIKAN NOL, DAN ITU DIKATAKAN
  // ==========================================================================
  //
  // Kuadrat terkecil boleh saja memulangkan angka negatif - terukur:
  // contradictoir -0,14 pada rentang 2026. Dibaca apa adanya, ia berarti
  // "perkara contradictoir lebih RINGAN daripada verstek", dan alat yang
  // berkata begitu akan memberi angka lebih tinggi kepada perkara yang
  // tergugatnya tidak pernah datang.
  //
  // Yang sebenarnya dikatakan angka itu bukan "lebih ringan", melainkan
  // "komponen ini tidak menerangkan beratnya pada data ini" - sebab beratnya
  // sudah habis diterangkan komponen lain yang berjalan seiring dengannya.
  // Karena itu dijadikan NOL, bukan dipakai negatif, dan daftarnya
  // dipulangkan supaya tidak hilang diam-diam.
  const usul = { dasar: 1.0 };
  const dinolkan = [];
  NAMA.forEach((nama, i) => {
    const nilai = w[i + 1] / tetapan;
    const sah = Number.isFinite(nilai) ? bulat(nilai) : 0;
    if (sah < 0) dinolkan.push({ nama, nilaiAsli: sah });
    usul[nama] = Math.max(0, sah);
  });

  // Seberapa dekat dugaannya - supaya pengguna tahu usul ini bersandar pada
  // apa. R kuadrat rendah berarti komponen-komponen itu memang tidak
  // menerangkan beratnya, dan usulnya harus dibaca sebagai demikian.
  let ssRes = 0;
  let ssTot = 0;
  const rataSasaran = cukup.reduce((n, b) => n + sasaran(b), 0) / cukup.length;
  for (const b of cukup) {
    const x = penduga(b);
    const duga = x.reduce((n, xi, i) => n + xi * w[i], 0);
    ssRes += (sasaran(b) - duga) ** 2;
    ssTot += (sasaran(b) - rataSasaran) ** 2;
  }
  const rKuadrat = ssTot > 0 ? bulat(1 - ssRes / ssTot) : 0;

  return {
    ok: true,
    perkara: cukup.length,
    rKuadrat,
    teramati,
    dinolkan,
    // Pengganda jenis dipisahkan supaya bentuknya sama dengan BOBOT_AWAL.
    usul: {
      dasar: 1.0,
      contradictoir: usul.contradictoir,
      rekonvensi: usul.rekonvensi,
      putusanSela: usul.putusanSela,
      perSaksi: usul.perSaksi,
      perPihakLebih: usul.perPihakLebih,
      mediasi: usul.mediasi,
    },
    usulPenggandaJenis: {
      kebendaan: bulat(1 + usul.kebendaan),
      gugatan: 1,
      permohonan: bulat(1 + usul.permohonan),
    },
    keterangan:
      `Diturunkan dari ${cukup.length} putusan satker sendiri, dengan sidang dan panjang naskah ` +
      `sebagai berat teramati. R kuadrat ${rKuadrat} - makin dekat ke 1, makin baik komponen ini ` +
      `menerangkan beratnya. Ini USUL, bukan kebenaran: sejarah satker memuat kebiasaannya sendiri, ` +
      `termasuk kebiasaan yang justru ingin diperbaiki.` +
      (Object.entries(teramati).filter(([, n]) => n > 0 && n < 30).length > 0
        ? ` Bersandar pada sedikit perkara: ` +
          Object.entries(teramati)
            .filter(([, n]) => n > 0 && n < 30)
            .map(([nama, n]) => `${nama} ${n}`)
            .join(", ") +
          ` - bobot yang diturunkan dari belasan perkara adalah kebetulan, bukan kebiasaan.`
        : "") +
      (dinolkan.length > 0
        ? ` ${dinolkan.length} bobot keluar negatif dan dijadikan nol ` +
          `(${dinolkan.map((x) => `${x.nama} ${x.nilaiAsli}`).join(", ")}) - artinya komponen itu tidak ` +
          `menerangkan beratnya pada data ini, bukan bahwa ia meringankan perkaranya.`
        : ""),
  };
}

/**
 * Bacaan atas angkanya - bukan penghakiman, melainkan hal-hal yang MEMANG
 * terbaca dari sebarannya, masing-masing menyebut angka penopangnya.
 *
 * Tiap kalimat di sini harus dapat dibantah dengan menunjuk angka. Kalimat
 * yang tidak menyebut angka tidak boleh ada di sini.
 */

/**
 * Menyebut beberapa nama lalu menghitung sisanya.
 *
 * Lima puluh dua nama dalam satu kalimat bukan kalimat - dan yang dibutuhkan
 * pembacanya memang bukan daftarnya, melainkan besarnya.
 */
function sebutBeberapa(nama, batas = 4) {
  if (nama.length <= batas) return nama.join(", ");
  return `${nama.slice(0, batas).join(", ")}, dan ${nama.length - batas} lainnya`;
}

function bacaan(daftar, ringkas, kolomMinutasiMati, padam, banding) {
  const catatan = [];
  if (daftar.length === 0) return catatan;

  // Nama terpecah disebut PALING DAHULU: ia mengubah cara membaca setiap
  // kalimat sesudahnya. Peringkat yang disusun atas nama yang terbelah dua
  // membandingkan separuh orang dengan seluruh orang lain.
  const kepala = new Map();
  for (const o of daftar) {
    const kunci = String(o.nama).split(",")[0].trim().toLowerCase();
    if (!kunci || kunci === "(tidak tercatat)") continue;
    if (!kepala.has(kunci)) kepala.set(kunci, []);
    kepala.get(kunci).push(o.nama);
  }
  const terpecah = [...kepala.values()].filter((v) => v.length > 1);
  if (terpecah.length > 0) {
    catatan.push({
      nada: "perhatian",
      teks:
        `${terpecah.length} nama tertulis lebih dari satu cara di SIPP dan karena itu terhitung ` +
        `sebagai orang yang berbeda - ${sebutBeberapa(terpecah.map((v) => v.join(" / ")))}. ` +
        `ALETA tidak menggabungkannya sendiri; penggabungan nama adalah tebakan.`,
      nama: terpecah.map((v) => v.join(" / ")),
    });
  }

  const skor = daftar.map((o) => o.skor);
  const tertinggi = daftar[0];
  const terendah = daftar[daftar.length - 1];

  // Perbandingan tertinggi lawan terendah menyesatkan bila yang terendah hanya
  // memutus satu perkara - jumlah putusan keduanya karena itu IKUT disebut.
  if (daftar.length > 1 && terendah.skor > 0) {
    const banding2 = bulat(tertinggi.skor / terendah.skor);
    catatan.push({
      nada: banding2 >= 3 ? "perhatian" : "biasa",
      teks:
        `Beban tertinggi ${tertinggi.nama}: skor ${tertinggi.skor} atas ${tertinggi.putusan} putusan, ` +
        `${banding2}x beban terendah ${terendah.nama} (skor ${terendah.skor} atas ${terendah.putusan} ` +
        `putusan).`,
    });
  }

  // Beban per bulan aktif - inilah yang membuat orang yang cuti dua bulan
  // tidak terbaca ringan.
  const perBulan = [...daftar].filter((o) => o.bulanAktif >= 1).sort((a, b) => b.skorPerBulan - a.skorPerBulan);
  if (perBulan.length > 1 && perBulan[0].nama !== tertinggi.nama) {
    catatan.push({
      nada: "perhatian",
      teks:
        `Diukur per bulan aktif, yang terberat justru ${perBulan[0].nama}: ${perBulan[0].skorPerBulan} ` +
        `per bulan atas ${perBulan[0].bulanAktif} bulan - sementara ${tertinggi.nama} ` +
        `${tertinggi.skorPerBulan} per bulan atas ${tertinggi.bulanAktif} bulan. Total yang besar ` +
        `dapat berarti rentang kerja yang panjang, bukan beban yang berat.`,
    });
  }

  // Banyak putusan belum tentu berat - inilah yang paling sering salah dibaca
  // ketika hanya jumlahnya yang ditampilkan.
  const terbanyak = [...daftar].sort((a, b) => b.putusan - a.putusan)[0];
  if (terbanyak && terbanyak.nama !== tertinggi.nama) {
    catatan.push({
      nada: "perhatian",
      teks:
        `Putusan terbanyak pada ${terbanyak.nama} (${terbanyak.putusan}), tetapi beban tertinggi pada ` +
        `${tertinggi.nama} (${tertinggi.putusan} putusan, skor ${tertinggi.skor}) - perkaranya lebih ` +
        `berat, bukan lebih banyak.`,
    });
  }

  // Median berdampingan dengan rata-rata: satu perkara 51.226 aksara menarik
  // rata-rata seseorang naik sendirian.
  const jauh = daftar.filter((o) => o.tengahSkor !== null && o.rataSkor > o.tengahSkor * 1.5);
  if (jauh.length > 0) {
    catatan.push({
      nada: "biasa",
      teks:
        `${jauh.length} konseptor yang rata-ratanya jauh di atas mediannya - ` +
        `${sebutBeberapa(jauh.map((o) => `${o.nama} (rata ${o.rataSkor}, median ${o.tengahSkor})`))}. ` +
        `Beberapa perkara berat menarik rata-ratanya; mediannya memperlihatkan perkara khasnya.`,
    });
  }

  const tanpaAksara = daftar.filter((o) => o.rataAksara === 0);
  if (tanpaAksara.length > 0) {
    const bagian = daftar.length > 0 ? Math.round((tanpaAksara.length / daftar.length) * 100) : 0;
    catatan.push({
      nada: "perhatian",
      teks:
        `${tanpaAksara.length} dari ${daftar.length} konseptor (${bagian}%) tanpa satu pun naskah ` +
        `pertimbangan tercatat - ${sebutBeberapa(tanpaAksara.map((o) => o.nama))}. Skornya karena itu ` +
        `lebih rendah daripada pekerjaannya, bukan karena pekerjaannya lebih ringan.`,
      nama: tanpaAksara.map((o) => o.nama),
    });
  }

  if (daftar.length >= 3) {
    catatan.push({
      nada: "biasa",
      teks:
        `${daftar.length} konseptor, ${ringkas.putusan} putusan, sebaran skor ` +
        `${bulat(Math.min(...skor))} - ${bulat(Math.max(...skor))}.`,
    });
  }

  if (banding > 0) {
    catatan.push({
      nada: "biasa",
      teks:
        `${banding} dari ${ringkas.putusan} putusan berlanjut ke banding atau kasasi. Angka ini ` +
        `TIDAK masuk skor: putusan yang dibanding bukan putusan yang salah.`,
    });
  }

  if (kolomMinutasiMati) {
    catatan.push({
      nada: "tidak-terpakai",
      teks:
        `Ketepatan minutasi TIDAK dinilai: tanggal_minutasi sama dengan tanggal_putusan pada seluruh ` +
        `${ringkas.putusan} putusan. Jeda nol di sini berarti kolomnya terisi sendiri, bukan minutasi ` +
        `seketika.`,
    });
  }
  for (const [nama, sebab] of Object.entries(padam)) {
    if (sebab) catatan.push({ nada: "tidak-terpakai", teks: sebab, komponen: nama });
  }

  return catatan;
}

/**
 * Beban konseptor pada satu periode.
 *
 * @param {object} minta { periode, acuan, dari, sampai, dasar, bobot, rinci, usulBobot }
 */
async function hitung(minta = {}) {
  const periode = PERIODE.includes(String(minta.periode)) ? String(minta.periode) : "bulan";
  const dasar = DASAR.includes(String(minta.dasar)) ? String(minta.dasar) : DASAR[0];
  const bobot = { ...BOBOT_AWAL, ...(minta.bobot || {}) };
  bobot.penggandaStatus = { ...BOBOT_AWAL.penggandaStatus, ...((minta.bobot || {}).penggandaStatus || {}) };
  bobot.penggandaJenis = { ...BOBOT_AWAL.penggandaJenis, ...((minta.bobot || {}).penggandaJenis || {}) };
  const rinci = minta.rinci !== false;

  const { dari, sampai } = rentangPeriode(periode, minta.acuan, minta.dari, minta.sampai);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dari) || !/^\d{4}-\d{2}-\d{2}$/.test(sampai)) {
    return { ok: false, alasan: "rentang_tanggal_tidak_sah" };
  }
  if (dari > sampai) return { ok: false, alasan: "tanggal_awal_melewati_akhir" };

  let baris = [];
  try {
    baris = await fakta(dari, sampai, dasar);
  } catch (e) {
    return { ok: false, alasan: "gagal_membaca_sipp", pesan: String((e && e.message) || e) };
  }

  // Diputuskan SESUDAH tahu berapa barisnya, bukan ditebak dari nama
  // periodenya: rentang bebas yang dipilih sendiri bisa lebih lebar daripada
  // setahun.
  const rincianDimatikan = rinci && baris.length > BATAS_RINCIAN;
  const rinciPakai = rinci && !rincianDimatikan;

  // ==========================================================================
  // KOMPONEN YANG SUMBERNYA KOSONG PADAM SENDIRI
  // ==========================================================================
  //
  // Komponen yang tidak pernah menyala lebih buruk daripada komponen yang
  // tidak ada: ia TERLIHAT bekerja. Yang dikerjakan di sini memadamkannya dan
  // MENGATAKANNYA - supaya ia hidup sendiri begitu satker mulai mengisi
  // sumbernya, tanpa kode disentuh lagi.
  const adaKuasa = baris.some((b) => Number(b.kuasa) > 0);
  const adaMediasi = baris.some((b) => Number(b.mediasi) > 0);
  const padam = {
    kuasaHukum: adaKuasa
      ? ""
      : "Kuasa hukum TIDAK dinilai pada rentang ini: tidak satu pun perkaranya punya pengacara tercatat. " +
        "Komponennya tetap berdiri dan akan menyala sendiri begitu `pihak_pengacara` mulai terisi.",
    mediasi: adaMediasi
      ? ""
      : "Mediasi TIDAK dinilai pada rentang ini: tidak satu pun perkaranya melewati mediasi tercatat.",
  };

  const orang = new Map();
  let jedaNol = 0;
  let jedaAda = 0;
  let jumlahBanding = 0;

  for (const satu of baris) {
    const nama = sebutKonseptor(satu, dasar) || "(tidak tercatat)";
    if (!orang.has(nama)) {
      orang.set(nama, {
        nama,
        putusan: 0,
        skorMentah: 0,
        skorTiap: [],
        verstek: 0,
        contradictoir: 0,
        rekonvensi: 0,
        putusanSela: 0,
        saksi: 0,
        pihak: 0,
        sidang: 0,
        aksara: 0,
        mediasi: 0,
        kuasa: 0,
        banding: 0,
        anonimLengkap: 0,
        lengkapBerkas: 0,
        jedaMinutasi: [],
        tanggal: [],
        status: {},
        jenis: {},
        ragam: {},
        perkara: [],
      });
    }
    const o = orang.get(nama);
    const { skor, rincian, ragam } = skorSatu(satu, bobot, {
      kuasaHukum: !adaKuasa,
      mediasi: !adaMediasi,
    });

    o.putusan += 1;
    o.skorMentah += skor;
    o.skorTiap.push(skor);
    if (String(satu.verstek || "").toUpperCase() === "Y") o.verstek += 1;
    else o.contradictoir += 1;
    if (Number(satu.rekonvensi) > 0) o.rekonvensi += 1;
    if (Number(satu.putusanSela) > 0) o.putusanSela += 1;
    if (Number(satu.mediasi) > 0) o.mediasi += 1;
    if (Number(satu.kuasa) > 0) o.kuasa += 1;
    if (Number(satu.banding) > 0) {
      o.banding += 1;
      jumlahBanding += 1;
    }
    o.saksi += Number(satu.saksi) || 0;
    o.pihak += Number(satu.pihak) || 0;
    o.sidang += Number(satu.sidang) || 0;
    o.aksara += Number(satu.panjangPertimbangan) || 0;
    if (Number(satu.anonim) > 0) o.anonimLengkap += 1;
    // Sumbu kelengkapan: naskah pertimbangan tersimpan DAN amarnya
    // teranonimisasi - dua hal yang memang kewajiban, dan keduanya terbaca.
    if (Number(satu.panjangPertimbangan) > 0 && Number(satu.anonim) > 0) o.lengkapBerkas += 1;

    const tgl = tanggalIso(satu.tanggalPutusan);
    if (tgl) o.tanggal.push(tgl);

    const jeda = jedaHari(satu.tanggalPutusan, satu.tanggalMinutasi);
    if (jeda !== null && jeda >= 0) {
      o.jedaMinutasi.push(jeda);
      jedaAda += 1;
      if (jeda === 0) jedaNol += 1;
    }

    const status = String(satu.statusPutusan || "").trim() || "(tanpa status)";
    o.status[status] = (o.status[status] || 0) + 1;
    const jenis = String(satu.jenisPerkara || "").trim() || "(tanpa jenis)";
    o.jenis[jenis] = (o.jenis[jenis] || 0) + 1;
    o.ragam[ragam] = (o.ragam[ragam] || 0) + 1;

    if (rinciPakai) {
      o.perkara.push({
        nomorPerkara: String(satu.nomorPerkara || ""),
        jenisPerkara: jenis,
        ragam,
        tanggalPutusan: tgl,
        statusPutusan: status,
        verstek: String(satu.verstek || "").toUpperCase() === "Y",
        saksi: Number(satu.saksi) || 0,
        pihak: Number(satu.pihak) || 0,
        sidang: Number(satu.sidang) || 0,
        aksara: Number(satu.panjangPertimbangan) || 0,
        banding: Number(satu.banding) > 0,
        skor,
        rincian,
      });
    }
  }

  // Kolom minutasi dinyatakan mati hanya bila SELURUH jedanya nol - satu saja
  // yang bukan nol berarti kolomnya sungguh dipakai.
  const kolomMinutasiMati = jedaAda > 0 && jedaNol === jedaAda;

  // Median satker dipakai sebagai batas "perkara berat" pada sumbu keragaman.
  const semuaSkor = [...orang.values()].flatMap((o) => o.skorTiap);
  const medianSatker = tengah(semuaSkor) ?? 0;

  const daftar = [...orang.values()]
    .map((o) => {
      // Bulan aktif dari putusan pertama sampai terakhir pada rentang ini.
      // Konseptor yang cuti dua bulan tidak boleh terbaca ringan hanya karena
      // ia tidak ada di tempat.
      const urut = [...o.tanggal].sort();
      const bulanAktif =
        urut.length > 0
          ? Math.max(1, bulat((jedaHari(urut[0], urut[urut.length - 1]) + 1) / HARI_SEBULAN))
          : 0;
      const berat = o.skorTiap.filter((s) => s >= medianSatker).length;
      return {
        nama: o.nama,
        putusan: o.putusan,
        skor: bulat(o.skorMentah),
        rataSkor: o.putusan > 0 ? bulat(o.skorMentah / o.putusan) : 0,
        tengahSkor: tengah(o.skorTiap),
        bulanAktif,
        aktifDari: urut[0] || "",
        aktifSampai: urut[urut.length - 1] || "",
        skorPerBulan: bulanAktif > 0 ? bulat(o.skorMentah / bulanAktif) : 0,
        putusanPerBulan: bulanAktif > 0 ? bulat(o.putusan / bulanAktif) : 0,
        // ------------------------------------------------------------------
        // TIGA SUMBU - satu angka menyembunyikan pertukarannya.
        // ------------------------------------------------------------------
        sumbu: {
          // Berapa berat yang dipikul.
          beban: bulat(o.skorMentah),
          // Berapa bagian berkasnya lengkap - naskah tersimpan dan amar
          // teranonimisasi. Kewajiban, bukan prestasi; karena itu dibaca
          // sebagai persentase, bukan sebagai skor yang dapat dikumpulkan.
          kelengkapan: o.putusan > 0 ? Math.round((o.lengkapBerkas / o.putusan) * 100) : 0,
          // Berapa bagian perkaranya lebih berat daripada median satker.
          // Membedakan dua ratus perkara ringan dari lima puluh perkara
          // campuran.
          keragaman: o.putusan > 0 ? Math.round((berat / o.putusan) * 100) : 0,
        },
        verstek: o.verstek,
        contradictoir: o.contradictoir,
        rekonvensi: o.rekonvensi,
        putusanSela: o.putusanSela,
        saksi: o.saksi,
        pihak: o.pihak,
        sidang: o.sidang,
        aksara: o.aksara,
        mediasi: o.mediasi,
        kuasa: o.kuasa,
        banding: o.banding,
        rataAksara: o.putusan > 0 ? Math.round(o.aksara / o.putusan) : 0,
        rataSidang: o.putusan > 0 ? Math.round((o.sidang / o.putusan) * 10) / 10 : 0,
        rataPihak: o.putusan > 0 ? Math.round((o.pihak / o.putusan) * 10) / 10 : 0,
        anonimLengkap: o.anonimLengkap,
        tengahJedaMinutasi: kolomMinutasiMati ? null : tengah(o.jedaMinutasi),
        status: o.status,
        jenis: o.jenis,
        ragam: o.ragam,
        // Perkara diurut dari yang terberat - itulah yang pertama ditanyakan
        // ketika angkanya dipersoalkan.
        perkara: o.perkara.sort((a, b) => b.skor - a.skor),
      };
    })
    .sort((a, b) => b.skor - a.skor);

  const jumlahPutusan = daftar.reduce((n, o) => n + o.putusan, 0);
  const jumlahSkor = bulat(daftar.reduce((n, o) => n + o.skor, 0));
  const ringkas = {
    konseptor: daftar.length,
    putusan: jumlahPutusan,
    skor: jumlahSkor,
    rataSkorPerPutusan: jumlahPutusan > 0 ? bulat(jumlahSkor / jumlahPutusan) : 0,
    medianSkorPerPutusan: bulat(medianSatker),
    banding: jumlahBanding,
  };

  return {
    ok: true,
    periode,
    dasar,
    rentang: { dari, sampai },
    bobot,
    kolomMinutasiMati,
    padam,
    rincianDimatikan,
    batasRincian: BATAS_RINCIAN,
    ringkas,
    bacaan: bacaan(daftar, ringkas, kolomMinutasiMati, padam, jumlahBanding),
    // Usul bobot dari data satker sendiri - hanya bila diminta, sebab ia
    // menghitung ulang seluruh baris.
    usulBobot: minta.usulBobot ? usulBobotDariData(baris) : undefined,
    daftar,
  };
}

module.exports = {
  PERIODE,
  DASAR,
  BOBOT_AWAL,
  JENIS_KEBENDAAN,
  BATAS_SIDANG_DASAR,
  BATAS_AKSARA_DASAR,
  BATAS_PIHAK_DASAR,
  BATAS_RINCIAN,
  rentangPeriode,
  sebutKonseptor,
  ragamPerkara,
  skorSatu,
  usulBobotDariData,
  hitung,
};
