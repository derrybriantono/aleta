"use strict";

/**
 * Konteks ALETA untuk satu perkara, disajikan ke tampilan SIPP.
 *
 * ============================================================================
 * HANYA MEMBACA, DAN TIDAK MENYENTUH SIPP SAMA SEKALI
 * ============================================================================
 *
 * Layanan ini melayani ekstensi peramban yang menempelkan keterangan ALETA ke
 * halaman SIPP. Tidak ada satu pun berkas SIPP yang diubah, tidak ada satu pun
 * tabel SIPP yang ditulis. Yang berubah hanya APA YANG DILIHAT petugas.
 *
 * Konsekuensinya perlu disadari: dua petugas membuka perkara yang sama dapat
 * melihat isi berbeda, tergantung ekstensinya terpasang atau tidak. Itu wajar
 * untuk lapisan bantu, tetapi harus disepakati supaya tidak membingungkan.
 *
 * ============================================================================
 * DIAM KETIKA TIDAK TAHU
 * ============================================================================
 *
 * Bila sebuah keterangan tidak dapat dipastikan - tabelnya belum terbentuk,
 * SIPP tidak terbaca, rekonsiliasi gagal - bagian itu dikembalikan KOSONG,
 * bukan ditebak. Ekstensi lalu tidak menampilkan apa pun untuk bagian itu.
 *
 * Keterangan yang salah di layar SIPP lebih berbahaya daripada tidak ada
 * keterangan: petugas mempercayai apa yang tampil di aplikasi resminya.
 */

const fs = require("fs");

const botDb = require("./botDbService");
const ecourtDocumentService = require("./ecourtDocumentService");
const { normalizeCaseNumber, cleanText } = require("./ecourtTextService");
const ecourtStoreService = require("./ecourtStoreService");
const ecourtReconciliationService = require("./ecourtReconciliationService");
const nomorVerificationService = require("./nomorVerificationService");
const paniteraDashboardService = require("./paniteraDashboardService");
const sippTahapanService = require("./sippTahapanService");
const penandaSippService = require("./penandaSippService");
const sippDb = require("../db_config");
const sippSkemaService = require("./sippSkemaService");

/**
 * Kueri ke SIPP - baca saja.
 *
 * Berkas ini selama ini hanya menyentuh basis data bot; satu-satunya yang
 * dibutuhkan dari SIPP adalah perkara_id, dan itu tidak dibawa layanan mana
 * pun yang sudah dipanggil di sini.
 */
function runQuerySipp(sql, params = []) {
  return new Promise((resolve, reject) => {
    sippDb.query(sql, params, (galat, hasil) => {
      if (galat) reject(galat);
      else resolve(hasil);
    });
  });
}
const sippIdentitasPerkaraService = require("./sippIdentitasPerkaraService");
const { fetchCaseParties } = require("./ecourtNotificationWorker");
const ecourtVerificationService = require("./ecourtVerificationService");

/** Menjalankan fn, mengembalikan nilai bawaan bila gagal. Tidak pernah melempar. */
async function aman(fn, bawaan) {
  try {
    return await fn();
  } catch {
    return bawaan;
  }
}

function sisaHari(nilai) {
  const waktu = botDb.fromMysqlDate(nilai);
  if (!waktu) return null;
  return Math.ceil((waktu.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Dokumen e-Court pada perkara ini, beserta tenggat dan status pemberitahuannya.
 *
 * Inilah keterangan yang paling tidak dimiliki SIPP: batas waktu unggah ada di
 * e-Court, dan SIPP tidak menampilkannya sama sekali - padahal itu yang
 * menentukan pihak kehilangan kesempatan menanggapi atau tidak.
 */
async function dokumenPerkara(nomorPerkara) {
  const rows = await botDb.query(
    `SELECT document_key, judul_dokumen, jenis_dokumen, peran_pengunggah,
            status_verifikasi, diunggah_pada, agenda,
            nomor_register, registrasi_ecourt,
            tanggal_sidang,
            batas_unggah, batas_unggah_teks,
            berkas_pdf, berkas_word,
            diberitahukan_pada, alasan_tidak_diberitahukan
       FROM aleta_bot_ecourt_documents
      WHERE nomor_perkara = ?
      ORDER BY diunggah_pada ASC`,
    [nomorPerkara]
  );

  return (Array.isArray(rows) ? rows : []).map((row) => ({
    documentKey: row.document_key,
    judulDokumen: row.judul_dokumen,
    nomorRegister: cleanText(row.nomor_register || row.registrasi_ecourt),
    jenisDokumen: row.jenis_dokumen,
    peranPengunggah: row.peran_pengunggah,
    statusVerifikasi: row.status_verifikasi,
    agenda: row.agenda,
    // Tanggal sidang adalah kunci pencocokan yang ANDAL ke baris Jadwal
    // Sidang di SIPP. Agenda berupa teks bebas - "Jawaban Tergugat" di
    // e-Court dapat tertulis "Penyampaian Jawaban" di SIPP - dan dokumen
    // yang muncul di baris agenda yang keliru berarti hakim mengunduh
    // berkas perkara yang salah tanpa ada yang menyadarinya.
    tanggalSidang: botDb.fromMysqlDate(row.tanggal_sidang),
    diunggahPada: row.diunggah_pada,
    batasUnggahTeks: row.batas_unggah_teks || "",
    sisaHari: sisaHari(row.batas_unggah),
    adaPdf: Boolean(row.berkas_pdf),
    adaWord: Boolean(row.berkas_word),
    sudahDiberitahukan: Boolean(row.diberitahukan_pada),
    // Kapan pihak diberi tahu, bukan sekadar sudah atau belum. Inilah yang
    // ditanyakan pihak lewat telepon - "saya belum menerima apa pun" - dan
    // jawabannya selama ini harus dicari di dashboard ALETA.
    diberitahukanPada: botDb.fromMysqlDate(row.diberitahukan_pada),

    alasanTidakDiberitahukan: row.alasan_tidak_diberitahukan || "",
  }));
}

/**
 * Keadaan nomor tiap pihak pada perkara ini.
 *
 * Menjawab pertanyaan yang tiap hari ditanyakan di meja PTSP - "pihaknya sudah
 * diberi tahu belum?" - tanpa petugas berpindah aplikasi.
 */
async function nomorPihak(nomorPerkara) {
  const pihak = await fetchCaseParties(nomorPerkara);
  if (!Array.isArray(pihak) || pihak.length === 0) return [];

  const hasil = [];
  const terlihat = new Set();

  for (const orang of pihak) {
    const nama = cleanText(orang.nama);
    const telepon = cleanText(orang.telepon);
    if (!nama) continue;

    const kunci = `${nama}|${telepon}`;
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);

    const catatan = telepon
      ? await aman(() => nomorVerificationService.getStatus(telepon, nama), null)
      : null;

    hasil.push({
      nama,
      pihakKe: Number(orang.pihak_ke) || null,
      jenis: orang.jenis || "",
      adaNomor: Boolean(telepon),
      // Nomor sengaja TIDAK dikirim utuh. Layar SIPP dapat terlihat orang lain,
      // dan nomor pihak berperkara bukan keterangan yang perlu dipajang.
      nomorSamar: telepon ? `${telepon.slice(0, 4)}****${telepon.slice(-3)}` : "",
      statusVerifikasi: catatan ? catatan.status : "belum_pernah_ditanya",
    });
  }

  return hasil;
}

/** Selisih antara catatan ALETA dan status sesungguhnya di e-Court. */
async function selisihPerkara(nomorPerkara) {
  const laporan = await ecourtReconciliationService.periksa({ limit: 500 });
  if (!laporan || !Array.isArray(laporan.selisih)) return [];
  return laporan.selisih
    .filter((item) => normalizeCaseNumber(item.nomorPerkara) === nomorPerkara)
    .map((item) => ({
      judulDokumen: item.judulDokumen,
      jenis: item.jenis,
      kegentingan: item.kegentingan,
      penjelasan: item.penjelasan,
      statusAleta: item.statusAleta,
      statusEcourt: item.statusEcourt,
    }));
}

/**
 * Apakah pembuka halaman ini hakim pada majelis perkara tersebut?
 *
 * GAGAL-TERTUTUP, sama seperti seluruh jalur verifikasi lain: nama kosong,
 * bukan hakim terdaftar, SIPP tidak terbaca, atau bukan anggota majelis -
 * semuanya berakhir dengan TIDAK BOLEH.
 *
 * Jawaban ini hanya menentukan tombolnya tampil atau tidak. Keputusan yang
 * dikirim tetap diperiksa ulang dari awal saat disimpan, sehingga tombol yang
 * dipaksa muncul pun tidak menghasilkan apa-apa.
 */
async function periksaHakim(nomorPerkara, namaPembuka) {
  const nama = cleanText(namaPembuka);
  if (!nama) return { bolehVerifikasi: false, alasan: "nama_pembuka_kosong" };

  const hakim = ecourtVerificationService.identifyJudgeByName(nama);
  if (!hakim) return { bolehVerifikasi: false, alasan: "bukan_hakim_terdaftar" };

  const panel = await ecourtVerificationService.isOnPanel(nomorPerkara, hakim.namaPencarian);
  if (!panel.anggota) return { bolehVerifikasi: false, alasan: panel.alasan || "bukan_anggota_majelis" };

  return { bolehVerifikasi: true, alasan: "", nama: hakim.nama };
}


/**
 * Ringkasan singkat untuk BANYAK perkara sekaligus.
 *
 * ============================================================================
 * SATU PERMINTAAN, BUKAN LIMA PULUH
 * ============================================================================
 *
 * Halaman Daftar Perkara memuat sampai 50 baris. Menandai tiap baris dengan
 * memanggil getKonteks satu per satu berarti 50 permintaan sekaligus dari satu
 * halaman - dan tiap getKonteks membaca dokumen, nomor pihak, selisih, serta
 * memeriksa keanggotaan majelis. Itu membebani bot dan SIPP tanpa alasan.
 *
 * Fungsi ini hanya mengembalikan yang dibutuhkan penanda baris: berapa dokumen,
 * berapa yang menunggu majelis, berapa tenggat mendesak dan lewat. Tidak ada
 * nomor pihak, tidak ada isi dokumen, tidak ada pemeriksaan majelis.
 *
 * YANG SENGAJA TIDAK DIKEMBALIKAN
 *
 * Nomor telepon tidak ikut, walau halaman daftar juga memuat nama pihak.
 * Menandai lima puluh baris sekaligus dengan nomor telepon berarti memajang
 * data pribadi puluhan orang di satu layar yang terlihat siapa saja.
 */
async function ringkasanMassal(daftarNomor, { batas = 60 } = {}) {
  const nomorBersih = [];
  const terlihat = new Set();

  for (const item of Array.isArray(daftarNomor) ? daftarNomor : []) {
    const nomor = normalizeCaseNumber(item);
    if (!nomor || terlihat.has(nomor)) continue;
    terlihat.add(nomor);
    nomorBersih.push(nomor);
    if (nomorBersih.length >= batas) break;
  }

  if (nomorBersih.length === 0) return { diperiksaPada: new Date().toISOString(), perkara: {} };

  await aman(() => ecourtStoreService.ensureSchema(), false);

  const ambang = await aman(async () => paniteraDashboardService.ambangMendesakHari(), 3);
  const tanda = nomorBersih.map(() => "?").join(", ");

  const rows = await aman(
    () =>
      botDb.query(
        `SELECT nomor_perkara AS nomorPerkara,
                COUNT(*) AS dokumen,
                SUM(CASE WHEN status_verifikasi = 'belum' THEN 1 ELSE 0 END) AS menungguVerifikasi,
                SUM(
                  CASE WHEN batas_unggah IS NOT NULL
                        AND batas_unggah < UTC_TIMESTAMP()
                       THEN 1 ELSE 0 END
                ) AS tenggatLewat,
                SUM(
                  CASE WHEN batas_unggah IS NOT NULL
                        AND batas_unggah >= UTC_TIMESTAMP()
                        AND batas_unggah <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY)
                       THEN 1 ELSE 0 END
                ) AS tenggatMendesak,
                MAX(terakhir_terlihat) AS terakhirTerlihat
           FROM aleta_bot_ecourt_documents
          WHERE nomor_perkara IN (${tanda})
          GROUP BY nomor_perkara`,
        [ambang, ...nomorBersih]
      ),
    []
  );

  const hasil = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const nomor = cleanText(row.nomorPerkara);
    if (!nomor) continue;
    hasil[nomor] = {
      dokumen: Number(row.dokumen) || 0,
      menungguVerifikasi: Number(row.menungguVerifikasi) || 0,
      tenggatMendesak: Number(row.tenggatMendesak) || 0,
      tenggatLewat: Number(row.tenggatLewat) || 0,
      terakhirTerlihat: botDb.fromMysqlDate(row.terakhirTerlihat),
    };
  }

  // Perkara yang diminta tetapi tidak punya catatan dikembalikan sebagai null,
  // bukan dihilangkan. Tidak adanya catatan adalah keterangan tersendiri -
  // artinya ALETA belum pernah menarik perkara itu - dan penanda barisnya perlu
  // membedakannya dari perkara yang memang tidak punya dokumen.
  for (const nomor of nomorBersih) {
    if (!(nomor in hasil)) hasil[nomor] = null;
  }

  // ==========================================================================
  // IDENTITAS PERKARA UNTUK HALAMAN DAFTAR
  // ==========================================================================
  //
  // Halaman daftar memuat lima puluh perkara sekaligus, dan di situlah penanda
  // paling berharga: pada halaman detail, panel ALETA sudah terbuka di
  // sebelahnya, sedangkan di halaman daftar petugas memindai lima puluh baris
  // dan tidak punya cara apa pun mengetahui mana yang perlu perhatian.
  //
  // Kelimanya dibaca SEKALI untuk seluruh baris - satu kueri per jenis, bukan
  // satu kueri per perkara. Lima puluh perkara kali lima kueri adalah dua ratus
  // lima puluh perjalanan ke SIPP untuk satu halaman.
  const identitasHasil = await aman(() => identitasMassal(nomorBersih), { perkara: {}, gagal: [] });

  return {
    diperiksaPada: new Date().toISOString(),
    ambangMendesakHari: ambang,
    perkara: hasil,
    identitas: identitasHasil.perkara || {},
    // Kosong berarti seluruh pembacaannya berhasil. Berisi berarti ada tabel
    // atau kolom yang tidak dikenali - dan penandanya diam BUKAN karena
    // perkaranya bersih.
    identitasGagal: identitasHasil.gagal || [],
  };
}

/**
 * Prodeo, ghaib, kuasa, PNS/TNI/Polri, dan verzet untuk sekumpulan perkara.
 *
 * ============================================================================
 * LIMA KUERI, BUKAN LIMA PULUH
 * ============================================================================
 *
 * Tiap keadaan dibaca dengan satu kueri yang menyaring seluruh perkara
 * sekaligus lewat IN (...). Menanyakannya per perkara akan membebani SIPP
 * dengan ratusan perjalanan untuk satu halaman yang dibuka sekali.
 *
 * ============================================================================
 * YANG GAGAL DIBACA TIDAK MENJADI "TIDAK ADA"
 * ============================================================================
 *
 * Tiap kueri dibungkus sendiri. Yang gagal memulangkan himpunan kosong,
 * sehingga penandanya sekadar tidak muncul - bukan berubah menjadi pernyataan
 * bahwa perkaranya tidak prodeo, tidak ghaib, dan tidak berkuasa hukum. Pada
 * halaman daftar, penanda yang keliru jauh lebih merugikan daripada penanda
 * yang absen: petugas melewati baris yang sebenarnya perlu dibuka.
 */
async function identitasMassal(nomorBersih) {
  if (!Array.isArray(nomorBersih) || nomorBersih.length === 0) return {};

  const isian = nomorBersih.map(() => "?").join(", ");

  // Peta nomor perkara -> perkara_id. Kelima kueri di bawah menyaring dengan
  // id, bukan dengan nomor: nomor perkara tersimpan dengan ejaan yang tidak
  // selalu sama antar tabel, sedangkan id-nya tunggal.
  const barisId = await aman(
    () =>
      runQuerySipp(
        `SELECT p.perkara_id AS id, p.nomor_perkara AS nomor, p.prodeo AS prodeo
           FROM perkara p WHERE p.nomor_perkara IN (${isian})`,
        nomorBersih
      ),
    []
  );

  const petaId = new Map();
  const hasil = {};
  for (const baris of Array.isArray(barisId) ? barisId : []) {
    const id = Number(baris.id) || 0;
    const nomor = cleanText(baris.nomor);
    if (!id || !nomor) continue;
    petaId.set(id, nomor);
    hasil[nomor] = {
      prodeo: String(baris.prodeo || "").trim() === "1",
      ghaib: false,
      kuasa: false,
      izinAtasan: false,
      verzet: false,
      // Keempat penetapan awal, apa adanya dari perkara_dokumen_penetapan.
      // Dipakai panel penetapan massal untuk menawarkan HANYA langkah yang
      // memang belum dikerjakan - lihat kueri penetapan di bawah.
      penetapan: { pmh: false, ppp: false, pjs: false, phs: false },
    };
  }

  const daftarId = [...petaId.keys()];
  if (daftarId.length === 0) return hasil;
  const isianId = daftarId.map(() => "?").join(", ");

  // ==========================================================================
  // KEGAGALAN SKEMA TIDAK BOLEH BERSEMBUNYI LAGI
  // ==========================================================================
  //
  // Tiga kali dalam satu hari, dengan bentuk yang persis sama:
  //
  //   identitas.perkaraId          medan yang tidak ada  -> seluruh penanda mati
  //   v_pihak_perkara.pekerjaan    kolom yang tidak ada  -> PNS/TNI/Polri mati
  //   perkara_kuasa                tabel yang tidak ada  -> penanda kuasa mati
  //
  // Ketiganya lolos karena pembungkus aman() menelan galat skema, sehingga
  // "salah nama tabel" tidak dapat dibedakan dari "memang tidak ada datanya".
  // Ketiganya hanya ketahuan karena dibandingkan dengan sumber lain - bukan
  // karena ada yang berbunyi.
  //
  // Pembungkus di bawah tetap gagal-terbuka - penandanya sekadar tidak muncul,
  // sebab penanda yang keliru di halaman SIPP lebih merugikan daripada penanda
  // yang absen. Yang berubah: galatnya DICATAT dan ikut dipulangkan pada
  // `gagal`, sehingga kegagalan skema berikutnya dapat dilihat tanpa menebak.
  const gagal = [];
  const amanSkema = async (nama, fn) => {
    try {
      return await fn();
    } catch (galat) {
      gagal.push(`${nama}: ${String(galat.message || galat).slice(0, 120)}`);
      return [];
    }
  };

  const tandai = (baris, medan) => {
    for (const satu of Array.isArray(baris) ? baris : []) {
      const nomor = petaId.get(Number(satu.id));
      if (nomor && hasil[nomor]) hasil[nomor][medan] = true;
    }
  };

  const kolom = await aman(() => sippSkemaService.kolomTerpilih(), {});

  // ======================================================================
  // TABEL KUASA HANYA SATU - perkara_pengacara
  // ======================================================================
  //
  // Percobaan pertama menanyakan perkara_kuasa juga, dan tabel itu TIDAK ADA
  // di SIPP ini. Kuerinya gagal, tertelan pembungkus aman(), dan penandanya
  // diam-diam tidak pernah menyala. Ini kegagalan ketiga dengan bentuk yang
  // persis sama dalam satu hari - sesudah v_pihak_perkara.pekerjaan dan
  // identitas.perkaraId - dan ketiganya punya ciri yang sama: pembungkus
  // aman() menelan galat skema, sehingga salah nama tabel atau kolom tidak
  // dapat dibedakan dari "memang tidak ada datanya".
  //
  // Karena itu kegagalannya kini DILAPORKAN - lihat `gagal` pada hasilnya.
  const [ghaib, pengacara, instansi, lawan] = await Promise.all([
    kolom.pihakGhaib
      ? amanSkema("ghaib", 
          () =>
            runQuerySipp(
              `SELECT DISTINCT p.perkara_id AS id FROM perkara_pihak2 p
                WHERE p.perkara_id IN (${isianId}) AND p.${kolom.pihakGhaib} = 1`,
              daftarId
            ),
          []
        )
      : [],
    amanSkema("kuasa", 
      () =>
        runQuerySipp(
          `SELECT DISTINCT a.perkara_id AS id FROM perkara_pengacara a
            WHERE a.perkara_id IN (${isianId})`,
          daftarId
        ),
      []
    ),
    // ======================================================================
    // PEKERJAAN ADA DI TABEL `pihak`, BUKAN DI v_pihak_perkara
    // ======================================================================
    //
    // Percobaan pertama membacanya dari v_pihak_perkara - tampilan yang sudah
    // dipakai di tempat lain dan memuat nama, alamat, serta pihak_ke. Kolom
    // `pekerjaan` TIDAK ADA di sana, sehingga kuerinya gagal, tertelan
    // pembungkus aman(), dan penandanya diam-diam tidak pernah menyala.
    //
    // Ketahuan karena dibandingkan dengan halaman detail: 399/Pdt.G/2026
    // menyala "izin atasan" di sana tetapi bersih di sini. Dua jalur yang
    // membaca hal yang sama TIDAK BOLEH berselisih - kalau berselisih, salah
    // satunya pasti salah, dan yang membacanya tidak punya cara tahu mana.
    //
    // Nama kolomnya dicari lewat layanan skema, sama seperti halaman detail,
    // supaya keduanya benar-benar membaca kolom yang sama.
    kolom.pihakPekerjaan
      ? amanSkema("izinAtasan", 
          () =>
            runQuerySipp(
              `SELECT DISTINCT v.perkara_id AS id
                 FROM v_pihak_perkara v
                 JOIN pihak p ON p.id = v.pihak_id
                WHERE v.perkara_id IN (${isianId})
                  AND p.${kolom.pihakPekerjaan} REGEXP '(pns|asn|pegawai negeri|aparatur sipil|tni|polri|kepolisian)'`,
              daftarId
            ),
          []
        )
      : [],
    amanSkema("verzet", 
      () =>
        runQuerySipp(
          `SELECT DISTINCT v.perkara_id AS id FROM perkara_verzet v
            WHERE v.perkara_id IN (${isianId})`,
          daftarId
        ),
      []
    ),
  ]);

  // ==========================================================================
  // PENETAPAN YANG SUDAH ADA
  // ==========================================================================
  //
  // jenis_dokumen_id pada perkara_dokumen_penetapan: 1 PMH, 2 PPP, 3 PJS,
  // 4 PHS. Nomornya milik SIPP dan tidak pernah berubah - ia dipakai seluruh
  // laporan yang menghitung penetapan.
  //
  // Dibaca sebagai ADA-TIDAKNYA baris, bukan sebagai tahapan perkara. Tahapan
  // dapat maju karena sebab lain, sedangkan yang ditanyakan panel penetapan
  // massal tepat satu hal: sudahkah dokumen penetapan ini pernah dibuat.
  const JENIS_PENETAPAN = { 1: "pmh", 2: "ppp", 3: "pjs", 4: "phs" };
  const barisPenetapan = await amanSkema("penetapan", () =>
    runQuerySipp(
      `SELECT DISTINCT perkara_id AS id, jenis_dokumen_id AS jenis
         FROM perkara_dokumen_penetapan
        WHERE perkara_id IN (${isianId}) AND jenis_dokumen_id IN (1, 2, 3, 4)`,
      daftarId
    )
  );
  for (const satu of Array.isArray(barisPenetapan) ? barisPenetapan : []) {
    const nomor = petaId.get(Number(satu.id));
    const jenis = JENIS_PENETAPAN[Number(satu.jenis)];
    if (nomor && jenis && hasil[nomor]) hasil[nomor].penetapan[jenis] = true;
  }

  tandai(ghaib, "ghaib");
  tandai(pengacara, "kuasa");
  tandai(instansi, "izinAtasan");
  tandai(lawan, "verzet");

  return { perkara: hasil, gagal };
}

/**
 * Seluruh konteks untuk satu perkara.
 *
 * @param {string} nomor Nomor perkara sebagaimana tampil di SIPP.
 */
async function getKonteks(nomor, { namaPembuka = "" } = {}) {
  const nomorPerkara = normalizeCaseNumber(nomor);
  if (!nomorPerkara) {
    return { ok: false, alasan: "nomor_perkara_kosong", nomorPerkara: "" };
  }

  await aman(() => ecourtStoreService.ensureSchema(), false);
  await aman(() => nomorVerificationService.ensureSchema(), false);

  // Tiap bagian dibungkus sendiri: satu bagian yang gagal tidak boleh
  // menghilangkan bagian lain yang sebenarnya sudah benar.
  const [dokumen, nomorNya, selisih, ambang, hakim, identitas] = await Promise.all([
    aman(() => dokumenPerkara(nomorPerkara), []),
    aman(() => nomorPihak(nomorPerkara), []),
    aman(() => selisihPerkara(nomorPerkara), []),
    aman(async () => paniteraDashboardService.ambangMendesakHari(), 3),
    // Apakah yang membuka halaman ini hakim pada majelis perkara INI?
    //
    // Diperiksa di sisi bot, bukan dipercayakan pada ekstensi. Ekstensi hanya
    // menampilkan tombol berdasarkan jawaban ini - dan sekalipun tombolnya
    // dipaksa muncul, keputusannya tetap diperiksa ulang saat disimpan.
    aman(() => periksaHakim(nomorPerkara, namaPembuka), { bolehVerifikasi: false, alasan: "" }),
    // Jenis perkara, kumulasi, dan kuasa hukum. Gagal-terbuka: keterangan ini
    // menerangkan perkara, tidak menjaga apa pun. Kehilangannya tidak boleh
    // menghilangkan dokumen dan tenggat yang justru dicari petugas.
    aman(() => sippIdentitasPerkaraService.identitasPerkara(nomorPerkara), null),
  ]);

  // ==========================================================================
  // PENANDA YANG TIDAK ADA DI HALAMAN SIPP
  // ==========================================================================
  //
  // penandaPerkara() sudah lama dipakai layar Status Perkara di portal, tetapi
  // tidak pernah sampai ke ekstensi - padahal justru di halaman SIPP-lah
  // keterangan ini paling dibutuhkan: petugas yang sedang menetapkan hari
  // sidang perkara ghaib tidak dapat mengetahuinya dari halaman yang sedang ia
  // buka. SIPP menyimpan ghaib di perkara_pihak2, dan tidak menampilkannya.
  //
  // Perlu perkara_id, dan itu hanya ada bila identitasnya terbaca. Gagal-
  // terbuka: penanda adalah tambahan, dan kehilangannya tidak boleh
  // menghilangkan dokumen serta tenggat yang justru dicari petugas.
  // ==========================================================================
  // perkara_id DICARI SENDIRI - identitasPerkara TIDAK MEMBAWANYA
  // ==========================================================================
  //
  // Percobaan pertama mengambilnya dari identitas.perkaraId. Medan itu TIDAK
  // ADA: identitasPerkara memulangkan nomor perkara, jenis, kumulasi, dan
  // kuasa - tanpa id-nya. Akibatnya penjaganya selalu salah, kedua penanda
  // selalu dilewati, dan tidak ada satu pun galat yang muncul. Panel tampak
  // baik-baik saja dengan seluruh penanda mati.
  //
  // Persis jenis kegagalan yang penanda ini ada untuk mencegahnya, dan ia
  // hampir lolos - tertangkap karena diperiksa di server sesudah dipasang,
  // bukan karena ada yang berbunyi.
  const perkaraId = await aman(async () => {
    const rows = await runQuerySipp(
      "SELECT p.perkara_id AS id FROM perkara p WHERE p.nomor_perkara = ? LIMIT 1",
      [nomorPerkara]
    );
    const satu = (Array.isArray(rows) && rows[0]) || null;
    return satu ? Number(satu.id) || 0 : 0;
  }, 0);

  const [penanda, penandaLain] = perkaraId
    ? await Promise.all([
        aman(() => sippTahapanService.penandaPerkara(perkaraId), null),
        aman(() => penandaSippService.penandaTambahan(perkaraId), {}),
      ])
    : [null, {}];

  return {
    ok: true,
    alasan: "",
    nomorPerkara,
    // Nomor register e-Court - kunci untuk mencari perkara ini di
    // e-Court secara manual. SIPP tidak menampilkannya di mana pun,
    // sehingga petugas selama ini mencarinya lewat database.
    nomorRegister: (dokumen.find((d) => d.nomorRegister) || {}).nomorRegister || "",
    diperiksaPada: new Date().toISOString(),
    ambangMendesakHari: ambang,
    dokumen,
    nomorPihak: nomorNya,
    selisih,
    hakim,
    identitas,
    penanda,
    penandaLain,
    ringkasan: {
      dokumen: dokumen.length,
      menungguVerifikasi: dokumen.filter((d) => d.statusVerifikasi === "belum").length,
      tenggatMendesak: dokumen.filter((d) => d.sisaHari !== null && d.sisaHari >= 0 && d.sisaHari <= ambang).length,
      tenggatLewat: dokumen.filter((d) => d.sisaHari !== null && d.sisaHari < 0).length,
      nomorBermasalah: nomorNya.filter(
        (n) => !n.adaNomor || n.statusVerifikasi === "ditolak" || n.statusVerifikasi === "menunggu"
      ).length,
      selisihGenting: selisih.filter((s) => s.kegentingan === "tinggi").length,
    },
  };
}

/**
 * Mengambil satu berkas dokumen untuk diunduh.
 *
 * ============================================================================
 * JALUR BERKAS TIDAK PERNAH DIPERCAYA APA ADANYA
 * ============================================================================
 *
 * Jalur yang tersimpan di database dipakai untuk membaca berkas dari disk.
 * Bila baris database sempat berubah - karena kekeliruan, atau karena sesuatu
 * yang lebih buruk - jalur seperti "../../etc/passwd" akan membuat layanan ini
 * menyerahkan berkas apa pun di server.
 *
 * Karena itu jalurnya SELALU diperiksa berada di dalam folder arsip, dan
 * pemeriksaan itu dilakukan tepat sebelum berkasnya dibaca.
 *
 * @returns {Promise<{ ok: boolean, alasan: string, isi?: Buffer, namaBerkas?: string, tipeIsi?: string }>}
 */
async function getBerkas(documentKey, format = "pdf") {
  const kunci = String(documentKey || "").trim();
  if (!kunci) return { ok: false, alasan: "document_key_kosong" };

  const jenis = String(format) === "word" ? "word" : "pdf";
  const kolom = jenis === "word" ? "berkas_word" : "berkas_pdf";
  const rows = await botDb.query(
    `SELECT nomor_perkara, judul_dokumen, ${kolom} AS jalur
       FROM aleta_bot_ecourt_documents
      WHERE document_key = ? LIMIT 1`,
    [kunci]
  );

  const baris = Array.isArray(rows) ? rows[0] : null;
  if (!baris) return { ok: false, alasan: "dokumen_tidak_ditemukan" };

  /**
   * ==========================================================================
   * CATATAN BERKAS YANG SEBENARNYA ADA DI aleta_bot_ecourt_files
   * ==========================================================================
   *
   * `berkas_pdf` dan `berkas_word` pada tabel dokumen hanya CERMIN - diisi
   * saat unduhan berhasil, lalu ditimpa ulang oleh penyelarasan berikutnya.
   * Diukur pada basis data yang berjalan: dari 394 dokumen, cerminnya terisi
   * pada 23 (pdf) dan 8 (word) saja, sementara `aleta_bot_ecourt_files`
   * mencatat seluruh 400 berkas.
   *
   * Membaca cerminnya membuat unduhan menjawab "berkas_belum_tersimpan"
   * untuk berkas yang sebenarnya tercatat - dan karena tombol unduhnya pun
   * disembunyikan atas dasar yang sama, tidak ada yang pernah melihat
   * kesalahannya.
   *
   * Jadi tabel berkas dibaca lebih dulu, cerminnya jadi cadangan.
   */
  const barisBerkas = await botDb
    .query(
      `SELECT jalur_berkas AS jalur
         FROM aleta_bot_ecourt_files
        WHERE document_key = ? AND format = ? AND dihapus_retensi IS NULL
        ORDER BY diunduh_pada DESC
        LIMIT 1`,
      [kunci, jenis]
    )
    .catch(() => []);

  const jalur = (Array.isArray(barisBerkas) && barisBerkas[0] && barisBerkas[0].jalur) || baris.jalur;
  if (!jalur) return { ok: false, alasan: "berkas_belum_tersimpan" };

  const hasil = ecourtDocumentService.describeEcourtDocument(jalur);
  if (!hasil.ok) return { ok: false, alasan: hasil.reason };

  let isi;
  try {
    isi = fs.readFileSync(hasil.absolutePath);
  } catch (error) {
    return { ok: false, alasan: `berkas_tidak_terbaca: ${error.message}` };
  }

  return {
    ok: true,
    alasan: "",
    isi,
    namaBerkas: hasil.fileName,
    tipeIsi: format === "word" ? "application/octet-stream" : "application/pdf",
    nomorPerkara: baris.nomor_perkara,
    judulDokumen: baris.judul_dokumen,
  };
}

module.exports = { dokumenPerkara, getBerkas, getKonteks, ringkasanMassal, nomorPihak, selisihPerkara };
