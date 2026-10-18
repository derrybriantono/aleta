"use strict";

/**
 * ============================================================================
 * HASIL SIDANG - MENUNDA SIDANG DAN MENGGERAKKAN ANTRIANNYA
 * ============================================================================
 *
 * Sampai sekarang yang ditulis ALETA ke SIPP hanya PENETAPAN. Berkas ini
 * menambah satu hal yang lain sifatnya: HASIL SIDANG. Penetapan dapat
 * dibongkar tanpa bekas; penundaan melahirkan BARIS SIDANG BARU, dan baris
 * sidang yang salah tanggal berarti pihak dipanggil untuk hari yang salah.
 *
 * ============================================================================
 * BENTUKNYA DISALIN DARI SIPP, DAN DIHITUNG DARI DATANYA
 * ============================================================================
 *
 * Dibaca dari kode SIPP sendiri - bukan ditebak:
 *
 *   controllers/jadwal_sidang_c.php   validateTunda()
 *   models/jadwalsidang/jadwal_sidang_m.php   tunda_sidang()
 *   models/riwayatperkara/riwayat_perkara_m.php   updateproses()
 *   controllers/manageAntrian.php     panggil/tunda/selesai_antrian()
 *
 * Satu penundaan menyentuh tiga tempat:
 *
 *   1. perkara_jadwal_sidang  UPDATE  baris sidang hari ini - ditunda='Y',
 *      alasan, agenda, dihadiri_oleh, sifat_sidang, ruangan;
 *   2. perkara_jadwal_sidang  INSERT  baris sidang BERIKUTNYA - id MAX+1,
 *      urutan MAX+1, membawa bendera verzet/keberatan/ikrar_talak/keliling;
 *   3. perkara + perkara_proses  lewat prosedur perkara_proses_update, lalu
 *      perkara.tahapan_terakhir_* disetel dari baris proses terbaru.
 *
 * Dihitung pada basis data satker - 4.242 penundaan yang sungguh ada:
 *
 *     4242  UPDATE  perkara_jadwal_sidang    halaman PENUNDAAN JADWAL SIDANG
 *     4242  INSERT  perkara_jadwal_sidang
 *     4173  UPDATE  perkara
 *
 * Selisih 69 pada baris ketiga BUKAN kebocoran: itulah penundaan sidang ikrar
 * talak, yang menurut kodenya memang tidak memperbarui riwayat
 * (updateProses = FALSE). Angka datanya cocok dengan kodenya, dan itulah yang
 * membuat bentuk ini dapat dipercaya.
 *
 * ============================================================================
 * TANGGAL DIPERIKSA SEBELUM SATU BARIS PUN DITULIS
 * ============================================================================
 *
 * Yang dilahirkan penundaan adalah JADWAL. Karena itu tanggal sidang
 * berikutnya diperiksa lebih dahulu - bukan sesudahnya: tidak boleh mundur,
 * tidak boleh hari libur, dan diperingatkan bila bukan hari sidang majelisnya.
 * Yang tidak lolos tidak ditulis; yang patut diragukan tetap ditulis tetapi
 * andaiannya disebut, supaya petugas melihat apa yang sedang ia setujui.
 */

const db = require("../db_config");
const penetapan = require("./penetapanTulisService");
const hariLiburService = require("./hariLiburService");
const { menyebutAleta } = require("./tandaAletaService");
const ikrar = require("./ikrarTalakService");
const externalDbService = require("./externalDbService");
const { keadaanDisidang, ruangDisidang } = require("./antrianDisidang");

/** Nama halaman pada audit - persis yang ditulis SIPP sendiri. */
const NAMA_HALAMAN = "PENUNDAAN JADWAL SIDANG";

/**
 * ============================================================================
 * PUTUS DICATAT SEPERTI BORANG "EDIT JADWAL SIDANG", BUKAN "PENUNDAAN"
 * ============================================================================
 *
 * Audit pola 18 Okt 2026 atas sipp_donggala (sidang 1 Jan - 9 Okt 2026,
 * baris ditunda='T' yang diperbarui pada hari sidangnya, 804 baris petugas):
 *
 *   borang EDIT JADWAL SIDANG (validateEdit)     278   jadwal UPDATE + perkara UPDATE
 *   aplikasi antrian (tanpa sys_audittrail)     ~520
 *   borang PENUNDAAN JADWAL SIDANG                 5   (0,6%)
 *
 * Tombol Putus dahulu menulis satu baris audit "PENUNDAAN JADWAL SIDANG" -
 * bentuk yang hampir tidak pernah dipakai petugas untuk menutup sidang. Kini
 * baris audit jadwalnya memakai nama halaman borang Edit.
 *
 * BELUM ditiru (keputusan pengguna 30 Sep butir 12: tombol Putus tidak
 * menulis tahapan perkara): validateEdit SIPP sesudahnya memanggil
 * riwayat_perkara_m::updateproses(200, tanggal sidang) - riwayat Persidangan
 * + perkara UPDATE beserta auditnya (854 lawan 854 di 2026). Diajukan sebagai
 * keputusan K7 di docs/audit/AUDIT-POLA-SIPP-18okt.md.
 */
const NAMA_HALAMAN_EDIT = "EDIT JADWAL SIDANG";

/**
 * ============================================================================
 * JAM BORANG SIPP: JAM DAN MENIT SAJA, DETIK 00
 * ============================================================================
 *
 * Borang tunda dan edit SIPP hanya menerima "HH:mm" (exact_length[5] pada
 * jammulaisblm/jamselesaisblm/jammulai/jamselesai). Terukur 18 Okt 2026: 255
 * dari 277 tundaan lewat borang (92%) berdetik 00 pada jam_sidang DAN
 * sampai_jam. Yang berdetik lain (856 baris) seluruhnya tulisan aplikasi
 * antrian, yang TIDAK menulis sys_audittrail dan yang sampai_jam-nya persis
 * sama dengan diperbaharui_tanggal.
 *
 * ALETA menulis baris audit borang, jadi jamnya harus berbentuk jam borang.
 * Dahulu jam masuk ruang antrian (detik nyata) dan NOW() setempat (WITA)
 * dibawa apa adanya - satu-satunya bentuk yang tidak dibuat siapa pun: detik
 * bukan 00 tetapi sampai_jam selalu tepat satu jam di depan
 * diperbaharui_tanggal (WIB).
 */
function jamBorang(jam) {
  const m = String(jam || "").match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}:00` : "";
}

/**
 * Jam selesai borang - validateTunda/validateEdit menolak jam selesai yang
 * tidak lebih dari jam mulai (getSelisihJam < 1). Ditekan pada menit yang
 * sama dengan jam masuk ruang, jam selesainya menjadi menit berikutnya.
 */
function jamSelesaiBorang(mulai, selesai) {
  const a = jamBorang(mulai);
  const b = jamBorang(selesai);
  if (!a || !b) return b;
  const menit = (j) => Number(j.slice(0, 2)) * 60 + Number(j.slice(3, 5));
  if (menit(b) > menit(a)) return b;
  const n = Math.min(menit(a) + 1, 23 * 60 + 59);
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}:00`;
}

/**
 * Proses yang dicatat riwayat perkara pada penundaan.
 *
 * Diambil dari validateTunda(): 200 pada keadaan biasa; 261 bila sidangnya
 * verzet (116 pada peradilan jenis 3); 294 bila ikrar talak - dan pada ikrar
 * talak riwayatnya TIDAK diperbarui sama sekali.
 */
const PROSES_PERSIDANGAN = 200;
const PROSES_VERZET = 261;
const PROSES_VERZET_JENIS3 = 116;
const PROSES_IKRAR_TALAK = 294;

/** Keadaan antrian menurut manageAntrian.php. */
const ANTRIAN_MENUNGGU = 0;
const ANTRIAN_SKORS = 1;
const ANTRIAN_SELESAI = 2;

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function tanggalSah(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(bersih(iso));
}

function jamSah(jam) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(bersih(jam));
}

/**
 * ============================================================================
 * RUANG SIDANG + SIDANG KELILING DARI BLANGKO (5 Okt 2026, butir 25)
 * ============================================================================
 *
 * Meniru blangko tunda SIPP (jadwal_sidang_c.php): ruangan_id + ruangan
 * (nama dari ruangan_sidang) dan sidang_keliling 'Y'/'T'. Ruangannya DIBACA
 * dari ruangan_sidang yang aktif - id yang tidak dikenal ditolak, namanya
 * tidak pernah diambil dari pemanggil.
 *
 * Tanpa pilihan (bot dipanggil portal lama): nilai yang tercatat di sidang ini,
 * persis seperti semula. `berubah` = ada kolom yang berbeda dari yang tercatat.
 *
 * @param {{ruanganId?: unknown, sidangKeliling?: unknown}} pilihan
 * @param {{ruanganId?: unknown, ruangan?: unknown, sidangKeliling?: unknown}} keadaan
 */
async function ruangDipilih(pilihan, keadaan) {
  const sekarang = {
    ruangan_id: Number(keadaan.ruanganId) || null,
    ruangan: bersih(keadaan.ruangan),
    sidang_keliling: bersih(keadaan.sidangKeliling) === "Y" ? "Y" : "T",
  };
  const adaRuang = bersih(pilihan.ruanganId) !== "";
  const adaKeliling = typeof pilihan.sidangKeliling === "boolean";
  if (!adaRuang && !adaKeliling) return { ok: true, nilai: sekarang, berubah: false };

  const nilai = { ...sekarang };
  if (adaRuang) {
    const ruangan = await penetapan.ruanganUntuk(pilihan.ruanganId).catch(() => null);
    if (!ruangan) return { ok: false, alasan: "ruangan_sidang_tidak_dikenal" };
    nilai.ruangan_id = ruangan.id;
    // varchar(50) di perkara_jadwal_sidang.
    nilai.ruangan = bersih(ruangan.nama).slice(0, 50);
  }
  if (adaKeliling) nilai.sidang_keliling = pilihan.sidangKeliling ? "Y" : "T";
  const berubah =
    nilai.ruangan_id !== sekarang.ruangan_id ||
    nilai.ruangan !== sekarang.ruangan ||
    nilai.sidang_keliling !== sekarang.sidang_keliling;
  return { ok: true, nilai, berubah };
}

/**
 * ============================================================================
 * `sampai_jam` ADALAH KOLOM TIME, DAN HANYA MENERIMA JAM
 * ============================================================================
 *
 * Aplikasi antrian menuliskannya `sampai_jam = NOW()`. MySQL memotong sendiri
 * bagian tanggalnya ketika NOW() masuk ke kolom TIME - tetapi hanya karena
 * NOW() memang nilai waktu, bukan tulisan.
 *
 * Yang dikirim ALETA adalah TULISAN "2026-09-18 05:15:21". Ke kolom TIME,
 * tulisan itu dibaca sebagai bentuk 'D HH:MM:SS' dan hasilnya bukan jam yang
 * dimaksud; pada pengaturan ketat ia ditolak sama sekali. Sama buruknya:
 * tulisan kosong "" masuk sebagai 00:00:00 tanpa satu pun galat.
 *
 * Karena itu jam dipisahkan dari cap waktunya, satu tempat, dan dipakai
 * kedua-duanya - penundaan maupun putusan.
 */
function jamDariCap(cap) {
  const cocok = String(cap || "").match(/(\d{2}):(\d{2}):(\d{2})/);
  return cocok ? `${cocok[1]}:${cocok[2]}:${cocok[3]}` : "";
}

/**
 * ============================================================================
 * BENDERA BARIS SIDANG BERIKUTNYA: 'Y' ATAU 'T', TIDAK PERNAH NULL
 * ============================================================================
 *
 * Kasus 273/Pdt.G/2026/PA.Dgl, 7 Okt 2026 13:34: tombol TUNDA menulis baris
 * sidang hari ini (ditunda='Y', alasan) lalu GAGAL menyisipkan sidang
 * berikutnya - "Column 'verzet' cannot be null" (ER_BAD_NULL_ERROR 1048).
 * `perkara_jadwal_sidang.verzet` NOT NULL DEFAULT 'T'; ALETA mengirim NULL
 * tegas untuk sidang yang bukan verzet, dan MariaDB menolak NULL tegas pada
 * INSERT satu baris walau sql_mode tidak ketat. Diulang di basis data uji
 * lokal: bentuk lama -> 1048, bentuk ini -> tersimpan.
 *
 * SIPP sendiri (jadwal_sidang_c.php::validateTunda) tidak menyebut kolomnya
 * kecuali perkaranya verzet/keberatan/ikrar - jadi barisnya berisi bawaan
 * 'T'. Aplikasi antrian (scriptTunda) menulis 'T' tegas. Di sini 'T' tegas.
 */
function bendera(nilai) {
  return bersih(nilai).toUpperCase() === "Y" ? "Y" : "T";
}

/** Sabtu/Minggu - ditolak SIPP ("Tidak Dapat Memilih Tanggal Sidang Pada Hari Libur, Sabtu dan Minggu"). */
function akhirPekan(iso) {
  if (!tanggalSah(iso)) return false;
  const hari = new Date(`${bersih(iso)}T00:00:00`).getDay();
  return hari === 0 || hari === 6;
}

/**
 * ============================================================================
 * ANTRIAN SIDANG - SUMBER JAM MULAI, RUANG, DAN KEHADIRAN SIDANG HARI INI
 * ============================================================================
 *
 * Aplikasi antrian satker (/var/www/html/antrian/php/_fungsi.php, dibaca
 * 7 Okt 2026) mengisi baris sidang yang ditunda/diputus dari barisnya di
 * sipp_turunan_antrian.antrian_sidang:
 *
 *   jam_sidang     = antrian_sidang.jam_sidang (jam masuk ruang, ditulis
 *                    tombol PROSES), BUKAN jam jadwal 09:00;
 *   dihadiri_oleh  = data.skrg.php: pihak_1 & pihak_2 terisi -> 1, hanya
 *                    pihak_1 -> 2, hanya pihak_2 -> 3, keduanya kosong -> 4;
 *   ruangan        = ruang sidang tempat perkaranya disidangkan.
 *
 * Perkara 273 hari itu: antrian jam_sidang 13:12:50, pihak_1 11:12:07,
 * pihak_2 kosong. ALETA menulis jam 09:00:00 dan dihadiri 1 ("semua hadir");
 * yang ditulis PP lewat SIPP sesudahnya: 13:12:50 dan 2 ("pihak pertama
 * saja") - persis yang tercatat di antrian.
 *
 * Kehadiran KOSONG-KOSONG sengaja dibaca "tidak diketahui" (null), bukan 4:
 * perkara yang tidak mengambil nomor antrian juga kosong-kosong, dan
 * menuliskan "para pihak tidak hadir" untuknya adalah pernyataan fakta
 * persidangan yang tidak pernah diamati.
 *
 * Hanya SELECT; gagal membaca = null, dan rencananya kembali ke nilai SIPP.
 */
function ringkasAntrian(baris) {
  if (!baris || typeof baris !== "object") return null;
  const ada = (v) => v !== null && v !== undefined && bersih(v) !== "" && !/^0000-00-00/.test(bersih(v));
  const hadir1 = ada(baris.pihak_1);
  const hadir2 = ada(baris.pihak_2);
  const keadaan = keadaanDisidang(baris.disidang);
  const ruangSedang = ruangDisidang(baris.disidang);
  const ruanganId = ruangSedang || Number(baris.ruangan_id) || null;
  // Jam masuk ruang hanya berarti bila perkaranya pernah diproses masuk ruang
  // (disidang terisi). Selain itu kolomnya jam jadwal atau kosong.
  const jamMasuk = keadaan === "disidang" || keadaan === "selesai" ? jamDariCap(`x ${bersih(baris.jam_sidang)}`) : "";
  let dihadiriOleh = null;
  if (hadir1 && hadir2) dihadiriOleh = 1;
  else if (hadir1) dihadiriOleh = 2;
  else if (hadir2) dihadiriOleh = 3;
  return {
    jadwalId: Number(baris.id) || null,
    ruanganId,
    keadaan,
    jamMasuk,
    hadirPihak1: hadir1,
    hadirPihak2: hadir2,
    dihadiriOleh,
  };
}

async function antrianSidangUntuk(keadaan) {
  if (!keadaan) return null;
  const tanggal = penetapan.tanggalIso(keadaan.tanggalSidang);
  if (!tanggalSah(tanggal)) return null;
  const baris = await externalDbService
    .query(
      "antrian_sidang",
      `SELECT id, perkara_id, tanggal_sidang, ruangan_id, disidang,
              TIME_FORMAT(jam_sidang, '%H:%i:%s') AS jam_sidang, pihak_1, pihak_2
         FROM sipp_turunan_antrian.antrian_sidang
        WHERE perkara_id = ? AND tanggal_sidang = ?
        LIMIT 5`,
      [Number(keadaan.perkaraId) || 0, tanggal]
    )
    .catch(() => null);
  if (!Array.isArray(baris) || baris.length === 0) return null;
  const tepat = baris.find((b) => Number(b.id) === Number(keadaan.jadwalId)) || baris[0];
  return ringkasAntrian(tepat);
}

/**
 * ============================================================================
 * PENGINPUT DI SIPP = PANITERA SIDANG (PP) PERKARA ITU - KEPUTUSAN 7 OKT 2026
 * ============================================================================
 *
 * Keputusan pengguna (dikonfirmasi lewat orkestrator, 7 Okt 2026): siapa pun
 * yang menekan TUNDA atau PUTUSAN di Jadwal Sidang ALETA, yang tercatat di
 * SIPP (diperbaharui_oleh / diinput_oleh / sys_audittrail.username) adalah
 * PANITERA SIDANG perkara itu - sama dengan aplikasi antrian satker
 * (`$data_pp`: perkara_panitera_pn aktif='Y' JOIN v_users block=0). Penekan
 * sebenarnya hanya di jejak ALETA (aleta_bot_jejak_penetapan.operator).
 *
 * TIDAK MENEBAK: aplikasi antrian mengambil LIMIT 1. Di sini PP aktif yang
 * lebih dari satu (14 perkara satker, 7 Okt 2026), PP tanpa akun SIPP, akun
 * yang diblokir, atau satu PP berakun ganda DITOLAK dengan sebab yang jelas -
 * tidak jatuh diam-diam ke akun lain (cadangan olehUsername dibuang).
 *
 * "Aktif pada hari sidang": bila ada lebih dari satu PP aktif, yang
 * penetapannya sesudah hari sidang disisihkan lebih dulu.
 *
 * @param {Array<object>} baris  perkara_panitera_pn aktif LEFT JOIN v_users
 * @param {string} tanggalSidang ISO
 */
function pilihPaniteraSidang(baris, tanggalSidang) {
  const semua = Array.isArray(baris) ? baris : [];
  if (semua.length === 0) return { ok: false, alasan: "panitera_sidang_tidak_ketemu" };
  const tgl = penetapan.tanggalIso(tanggalSidang);
  const idPanitera = (b) => String(b.panitera_id ?? "");
  let calon = semua;
  const kelompok = new Set(semua.map(idPanitera));
  if (kelompok.size > 1 && tanggalSah(tgl)) {
    const sebelum = semua.filter((b) => {
      const t = penetapan.tanggalIso(b.tanggal_penetapan);
      return !tanggalSah(t) || t <= tgl;
    });
    if (sebelum.length > 0) calon = sebelum;
  }
  const pp = [...new Set(calon.map(idPanitera))];
  if (pp.length > 1) {
    const nama = [...new Set(calon.map((b) => bersih(b.panitera_nama || b.fullname)).filter(Boolean))];
    return { ok: false, alasan: "panitera_sidang_ganda", nama };
  }
  const milik = calon.filter((b) => bersih(b.username));
  // block 1 = diblokir; kosong dibaca tidak diblokir (v_users.block bawaan 0).
  const aktif = milik.filter((b) => Number(b.block || 0) === 0);
  const namaPp = bersih(calon[0].panitera_nama) || bersih(calon[0].fullname);
  if (aktif.length === 0) {
    return {
      ok: false,
      alasan: milik.length > 0 ? "akun_sipp_pp_diblokir" : "akun_sipp_pp_tidak_ada",
      nama: namaPp ? [namaPp] : [],
    };
  }
  const akun = [...new Set(aktif.map((b) => bersih(b.username)))];
  if (akun.length > 1) return { ok: false, alasan: "akun_sipp_pp_ganda", nama: namaPp ? [namaPp] : [], akun };
  const satu = aktif[0];
  return {
    ok: true,
    akun: {
      username: bersih(satu.username),
      fullname: bersih(satu.fullname) || namaPp,
      paniteraId: Number(satu.panitera_id) || null,
    },
  };
}

async function paniteraSidang(perkaraId, tanggalSidang) {
  const id = Number(perkaraId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, alasan: "panitera_sidang_tidak_ketemu" };
  const baris = await kueri(
    `SELECT c.panitera_id, c.panitera_nama, c.tanggal_penetapan,
            d.username, d.fullname, d.block
       FROM perkara_panitera_pn c
       LEFT JOIN v_users d ON d.panitera_id = c.panitera_id
      WHERE c.aktif = 'Y' AND c.perkara_id = ?`,
    [id]
  ).catch(() => null);
  if (!Array.isArray(baris)) return { ok: false, alasan: "panitera_sidang_tidak_terbaca" };
  return pilihPaniteraSidang(baris, tanggalSidang);
}

/**
 * Sidang yang SUDAH ditunda: utuh (ada sidang sesudahnya) atau setengah jadi
 * (ditunda='Y' tetapi sidang berikutnya tidak pernah lahir - keadaan 273).
 * null = tidak terbaca.
 */
async function adaSidangSesudah(keadaan) {
  const baris = await kueri(
    `SELECT COUNT(*) AS n FROM perkara_jadwal_sidang
      WHERE perkara_id = ? AND id <> ? AND (urutan > ? OR tanggal_sidang > ?)`,
    [
      Number(keadaan.perkaraId) || 0,
      Number(keadaan.jadwalId) || 0,
      Number(keadaan.urutan) || 0,
      penetapan.tanggalIso(keadaan.tanggalSidang),
    ]
  ).catch(() => null);
  if (!Array.isArray(baris) || !baris[0]) return null;
  return Number(baris[0].n) > 0;
}

/**
 * ============================================================================
 * MENJALANKAN RENCANA HASIL SIDANG SECARA UTUH - SATU TRANSAKSI
 * ============================================================================
 *
 * Sampai 1.187.1 tiap langkah ditulis sendiri-sendiri lewat kolam sambungan.
 * Pada 273, langkah 1-2 (sidang hari ini ditunda + auditnya) tertulis, langkah
 * 3 (sidang berikutnya) ditolak, dan sisanya tidak pernah jalan: sidang
 * tercatat "ditunda" tanpa sidang berikutnya, dan tombolnya menolak dicoba
 * lagi ("sidang_sudah_ditunda").
 *
 * Kini seluruh langkah memakai SATU sambungan dalam satu transaksi (keempat
 * tabelnya InnoDB; prosedur perkara_proses_update tidak ber-COMMIT): gagal di
 * langkah mana pun -> ROLLBACK, tidak ada yang tertinggal. `dipulihkan`
 * menyebut apakah pembatalannya sendiri berhasil.
 */
function ambilSambungan() {
  return new Promise((selesai, gagal) => {
    if (typeof db.getConnection !== "function") {
      gagal(new Error("kolam sambungan SIPP tidak mendukung transaksi"));
      return;
    }
    db.getConnection((galat, sambungan) => (galat ? gagal(galat) : selesai(sambungan)));
  });
}

function pesanTeknis(galat) {
  const kode = galat && galat.code ? `${galat.code}: ` : "";
  return `${kode}${String((galat && (galat.sqlMessage || galat.message)) || galat)}`.slice(0, 300);
}

async function jalankanRencanaUtuh(rencana, opsi = {}) {
  const kering = opsi.kering !== false;
  if (kering || !rencana || rencana.ok !== true) return penetapan.jalankanRencana(rencana, { kering });

  let sambungan;
  try {
    sambungan = await ambilSambungan();
  } catch (galat) {
    return {
      ok: false,
      kering: false,
      alasan: "server_sipp_tidak_terhubung",
      pesan: pesanTeknis(galat),
      selesai: [],
      dipulihkan: true,
    };
  }
  const lewat = (sql, params = []) =>
    new Promise((selesai, gagal) => {
      sambungan.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
    });
  const batalkan = () => lewat("ROLLBACK").then(
    () => true,
    () => false
  );

  try {
    await lewat("START TRANSACTION");
    const hasil = await penetapan.jalankanRencana(rencana, { kering: false, kueri: lewat });
    if (!hasil.ok) {
      const dipulihkan = await batalkan();
      return { ...hasil, dipulihkan, dibatalkan: hasil.selesai || [], selesai: dipulihkan ? [] : hasil.selesai || [] };
    }
    try {
      await lewat("COMMIT");
    } catch (galat) {
      const dipulihkan = await batalkan();
      return {
        ok: false,
        kering: false,
        alasan: "gagal_menyimpan",
        pesan: pesanTeknis(galat),
        dipulihkan,
        dibatalkan: hasil.selesai || [],
        selesai: [],
      };
    }
    return { ...hasil, utuh: true };
  } catch (galat) {
    const dipulihkan = await batalkan();
    return {
      ok: false,
      kering: false,
      alasan: "gagal_menulis",
      pesan: pesanTeknis(galat),
      dipulihkan,
      selesai: [],
    };
  } finally {
    try {
      sambungan.release();
    } catch {
      // Sambungan yang sudah putus tidak perlu dilepas.
    }
  }
}

/**
 * Keadaan satu baris jadwal sidang beserta perkaranya.
 *
 * Dibaca SEBELUM apa pun ditulis, dan dari satu kueri: baris jadwal yang
 * dibaca terpisah dari perkaranya membuka jendela bagi perkara yang berpindah
 * tahapan di antara kedua pembacaan.
 *
 * `alasan_ditunda` ikut dibaca, dan bukan sebagai keterangan tambahan: sidang
 * yang BELUM dicatat dan sidang yang sudah DIPUTUS sama-sama berbendera
 * `ditunda = 'T'`. Yang memisahkan keduanya hanya isi kolom ini - "putus
 * DIKABULKAN" pada yang sudah, angka "0" bawaan pada yang belum. Tanpa
 * kolomnya, layar hasil sidang menutup borangnya bagi setiap sidang yang belum
 * disentuh sama sekali.
 */
async function keadaanJadwal(jadwalId) {
  const id = Number(jadwalId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const baris = await kueri(
    `SELECT j.id            AS jadwalId,
            j.perkara_id    AS perkaraId,
            j.tanggal_sidang AS tanggalSidang,
            j.jam_sidang    AS jamSidang,
            j.sampai_jam    AS sampaiJam,
            j.agenda        AS agenda,
            j.agenda_id     AS agendaId,
            j.urutan        AS urutan,
            j.ditunda       AS ditunda,
            j.alasan_ditunda AS alasanDitunda,
            j.ruangan_id    AS ruanganId,
            j.ruangan       AS ruangan,
            j.sidang_keliling AS sidangKeliling,
            j.sifat_sidang  AS sifatSidang,
            j.dihadiri_oleh AS dihadiriOleh,
            j.verzet        AS verzet,
            j.keberatan     AS keberatan,
            j.ikrar_talak   AS ikrarTalak,
            j.keterangan    AS keterangan,
            p.nomor_perkara AS nomorPerkara,
            p.alur_perkara_id AS alurPerkaraId,
            p.jenis_perkara_id AS jenisPerkaraId,
            p.jenis_perkara_text AS jenisPerkara,
            (SELECT pu.tanggal_putusan FROM perkara_putusan pu WHERE pu.perkara_id = j.perkara_id LIMIT 1) AS tanggalPutusan,
            (SELECT pu.tanggal_bht FROM perkara_putusan pu WHERE pu.perkara_id = j.perkara_id LIMIT 1) AS tanggalBht,
            (SELECT it.tanggal_penetapan_sidang_ikrar FROM perkara_ikrar_talak it WHERE it.perkara_id = j.perkara_id LIMIT 1) AS tanggalPenetapanSidangIkrar
       FROM perkara_jadwal_sidang j
       JOIN perkara p ON p.perkara_id = j.perkara_id
      WHERE j.id = ? LIMIT 1`,
    [id]
  ).catch(() => []);
  const satu = (Array.isArray(baris) && baris[0]) || null;
  if (!satu) return null;

  // ------------------------------------------------------------------------
  // TANGGALNYA DIPULANGKAN SEBAGAI TULISAN, BUKAN SEBAGAI OBYEK Date
  // ------------------------------------------------------------------------
  //
  // Penggerak MySQL memulangkan kolom DATE sebagai obyek Date beralamat waktu
  // setempat. Keadaan ini dikirim ke portal sebagai JSON, dan JSON.stringify
  // menuliskan Date dalam UTC:
  //
  //     sidang 2026-09-18 00:00 WITA  ->  "2026-09-17T16:00:00.000Z"
  //
  // Layar yang mengambil sepuluh huruf pertamanya - cara yang paling wajar -
  // membaca sidangnya SEHARI LEBIH AWAL, dan dari situ menghitung usulan
  // tanggal sidang berikutnya yang juga sehari lebih awal. Tidak ada galat
  // yang berbunyi: tanggalnya ada, hanya salah satu hari.
  //
  // Diubah di sini, satu kali, bukan di tiap pembacanya: pembaca berikutnya
  // tidak akan tahu ada yang perlu diwaspadai.
  satu.tanggalSidang = penetapan.tanggalIso(satu.tanggalSidang);
  // Bahan sidang ikrar talak (tombol tunda/putus ikrar, 18 Okt 2026) - juga tanggal.
  satu.tanggalPutusan = penetapan.tanggalIso(satu.tanggalPutusan);
  satu.tanggalBht = penetapan.tanggalIso(satu.tanggalBht);
  satu.tanggalPenetapanSidangIkrar = penetapan.tanggalIso(satu.tanggalPenetapanSidangIkrar);
  return satu;
}

/**
 * ============================================================================
 * RIWAYAT SIDANG DAN MEDIASI SATU PERKARA - BAHAN BAWAAN ISIAN TUNDA
 * ============================================================================
 *
 * Perbaikan 30 September 2026 (butir 14). Borang tunda di portal menyimpulkan
 * alasan, agenda berikutnya, tanggal, dan kehadiran dari sidang-sidang
 * sebelumnya (src/lib/bawaan-tunda.ts di portal - aturannya di sana, satu
 * tempat, diuji dan diukur atas sipp_donggala). Di sini hanya DIBACA: seluruh
 * baris jadwal perkaranya, dan baris mediasi terakhirnya.
 *
 * Hanya SELECT. Gagal membaca memulangkan null - borangnya lalu jatuh ke
 * bawaan lama, bukan menolak dibuka.
 */
async function riwayatSidangPerkara(perkaraId, tanggalSidang) {
  const id = Number(perkaraId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const sidang = await kueri(
    `SELECT id AS jadwalId, tanggal_sidang AS tanggal, agenda, ditunda,
            alasan_ditunda AS alasan, dihadiri_oleh AS dihadiriOleh, ikrar_talak AS ikrar
       FROM perkara_jadwal_sidang
      WHERE perkara_id = ?
      ORDER BY tanggal_sidang ASC, id ASC`,
    [id]
  ).catch(() => null);
  if (!Array.isArray(sidang)) return null;

  const med = await kueri(
    `SELECT penetapan_penunjukan_mediator AS tunjuk, dimulai_mediasi AS mulai,
            keputusan_mediasi AS putus, hasil_mediasi AS hasil, mediasi_berhasil AS berhasil
       FROM perkara_mediasi
      WHERE perkara_id = ?
      ORDER BY mediasi_id DESC
      LIMIT 1`,
    [id]
  ).catch(() => []);

  const tgl = penetapan.tanggalIso(tanggalSidang);
  let mediasi = null;
  const m = Array.isArray(med) && med[0];
  if (m) {
    const tunjuk = penetapan.tanggalIso(m.tunjuk) || penetapan.tanggalIso(m.mulai);
    const putus = penetapan.tanggalIso(m.putus);
    mediasi = {
      ada: !tunjuk || !tgl || tunjuk <= tgl,
      selesai: Boolean(putus) && (!tgl || putus <= tgl),
      berhasil: /^Y/i.test(bersih(m.hasil)) || Boolean(penetapan.tanggalIso(m.berhasil)),
    };
  }

  return {
    sidang: sidang.map((r) => ({
      jadwalId: Number(r.jadwalId),
      tanggal: penetapan.tanggalIso(r.tanggal),
      agenda: bersih(r.agenda),
      ditunda: bersih(r.ditunda).toUpperCase() === "Y",
      alasan: bersih(r.alasan),
      dihadiriOleh: r.dihadiriOleh === null || r.dihadiriOleh === undefined ? null : Number(r.dihadiriOleh),
      ikrar: bersih(r.ikrar).toUpperCase() === "Y",
    })),
    mediasi,
  };
}

/**
 * ============================================================================
 * COURT CALENDAR PERKARA - RENCANA MAJELIS, BAHAN TANGGAL SIDANG BERIKUTNYA
 * ============================================================================
 *
 * Perbaikan 2 Oktober 2026 malam (butir 1). Bila KEDUA pihak pernah hadir,
 * tanggal sidang berikutnya di borang tunda mengikuti rencana majelis di
 * perkara_court_calendar (aturannya di portal, src/lib/bawaan-tunda.ts - satu
 * tempat untuk Jadwal Sidang dan Hasil Sidang). Di sini hanya DIBACA: satu
 * SELECT, dibatasi 100 baris, terpisah dari riwayatSidangPerkara supaya bacaan
 * riwayat tetap dua kueri.
 *
 * Mengembalikan:
 *   null   tidak terbaca (tabel tak terjangkau / galat) - portal jatuh ke dua pekan
 *   []     terbaca dan memang tidak ada rencana (53% perkara 2026 - lazim, bukan cacat)
 *   [{tanggal, jam, agenda, keterangan}]  urut tanggal
 *
 * Tabel perkara_court_calendar terdaftar di sippSkemaService (const TABEL).
 */
async function kalenderPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const baris = await kueri(
    `SELECT DATE_FORMAT(rencana_tanggal, '%Y-%m-%d') AS tanggal,
            TIME_FORMAT(rencana_jam, '%H:%i') AS jam,
            rencana_agenda AS agenda, keterangan
       FROM perkara_court_calendar
      WHERE perkara_id = ? AND rencana_tanggal IS NOT NULL
      ORDER BY rencana_tanggal ASC, rencana_jam ASC, id ASC
      LIMIT 100`,
    [id]
  ).catch(() => null);
  if (!Array.isArray(baris)) return null;
  return baris.map((r) => ({
    tanggal: bersih(r.tanggal),
    jam: bersih(r.jam),
    agenda: bersih(r.agenda).slice(0, 500),
    keterangan: bersih(r.keterangan).slice(0, 500),
  }));
}

/** Akun pejabat yang dipakai menulis - harus benar-benar ada di SIPP. */
async function akunSipp(username) {
  const nama = bersih(username);
  if (!nama) return null;
  const baris = await kueri(
    `SELECT username, fullname FROM sys_users WHERE username = ? LIMIT 1`,
    [nama]
  ).catch(() => []);
  return (Array.isArray(baris) && baris[0]) || null;
}

/** Tahapan dan proses menurut alur perkaranya - sumber yang sama dengan SIPP. */
/**
 * ============================================================================
 * AKUN DITURUNKAN DARI PERKARANYA, TIDAK PERNAH DIKETIK
 * ============================================================================
 *
 * Aplikasi antrian sidang satker mengambilnya begini - dibaca langsung dari
 * `antrian/php/_fungsi.php` di peladen:
 *
 *     SELECT d.username FROM perkara_panitera_pn c
 *       JOIN v_users d ON c.panitera_id = d.panitera_id
 *      WHERE d.block = 0 AND c.aktif = 'Y' AND c.perkara_id = ?
 *
 * dan hakimnya dari perkara_hakim_pn dengan bentuk yang sama.
 *
 * Penundaan ditulis atas nama PANITERA PENGGANTI perkara itu; putusannya atas
 * nama HAKIM-nya. Keduanya sudah melekat pada perkaranya sejak penetapan.
 *
 * Borang yang menyuruh mengetik username membuka pintu menulis atas nama orang
 * lain, dan tidak ada satu pun pemeriksaan yang akan menangkapnya - audit
 * trail SIPP hanya mencatat nama yang diberikan kepadanya. Isian itu karena
 * itu dibuang, bukan sekadar diisi otomatis.
 */
async function akunPerkara(perkaraId) {
  const id = Number(perkaraId);
  if (!Number.isInteger(id) || id <= 0) return { panitera: null, hakim: null };

  const [pp, hk] = [
    await kueri(
      `SELECT d.username, d.fullname
         FROM perkara_panitera_pn c
         JOIN v_users d ON d.panitera_id = c.panitera_id
        WHERE d.block = 0 AND c.aktif = 'Y' AND c.perkara_id = ?
        LIMIT 1`,
      [id]
    ).catch(() => []),
    await kueri(
      `SELECT b.username, b.fullname
         FROM perkara_hakim_pn a
         JOIN v_users b ON b.hakim_id = a.hakim_id
        WHERE b.block = 0 AND a.aktif = 'Y' AND a.perkara_id = ?
        ORDER BY a.urutan
        LIMIT 1`,
      [id]
    ).catch(() => []),
  ];

  return {
    panitera: (Array.isArray(pp) && pp[0]) || null,
    hakim: (Array.isArray(hk) && hk[0]) || null,
  };
}

/**
 * Jam sidang berikutnya menurut agendanya.
 *
 * Aplikasi antrian menetapkan 09:00 untuk semua - `scriptTunda(..., '09:00:00',
 * ...)`. Satker menambahkan satu pengecualian: agenda jawab-menjawab dan
 * kesimpulan disidangkan sore, pukul 15:00.
 *
 * Sebabnya praktis, dan itulah kenapa ia ditulis di sini alih-alih dihafal:
 * agenda itu tidak menuntut kehadiran saksi, jadi ia dapat ditaruh sesudah
 * sidang-sidang yang menuntutnya - dan para pihak tidak perlu menunggu
 * sepanjang pagi untuk sepuluh menit pertukaran berkas.
 */
const AGENDA_SORE = ["jawaban", "replik", "duplik", "kesimpulan", "jawab"];

function jamMenurutAgenda(agenda) {
  const teks = String(agenda || "").toLowerCase();
  return AGENDA_SORE.some((k) => teks.includes(k)) ? "15:00" : "09:00";
}

/**
 * Tanggal sidang berikutnya - dua pekan sesudah sidang ini.
 *
 * Bukan aturan aplikasi antrian, melainkan kebiasaan satker: dua pekan adalah
 * jarak yang cukup bagi panggilan sampai ke para pihak tanpa membuat perkara
 * berjalan lebih lama daripada perlu.
 *
 * Yang dipulangkan USULAN, bukan keputusan - panitera sidang tetap dapat
 * menggantinya, dan hari liburnya tetap diperiksa penyusun rencana.
 */
function tanggalDuaPekan(tanggalSidang) {
  // tanggalIso, bukan String().slice(0,10): kolom DATE dipulangkan penggerak
  // MySQL sebagai obyek Date, dan String(date) berbunyi "Fri Sep 18 2026 ..."
  // - sepuluh huruf pertamanya "Fri Sep 18", yang gagal cocok-pola di bawah
  // dan membuat fungsi ini memulangkan kosong pada tanggal yang sebenarnya ada.
  // Terjadi, dan ketahuan hanya karena dijalankan atas jadwal sungguhan.
  const iso = penetapan.tanggalIso(tanggalSidang);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 14);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function prosesAlur(alurPerkaraId, prosesId) {
  const baris = await kueri(
    `SELECT tahapan_id AS tahapanId, tahapan_nama AS tahapanNama,
            proses_id AS prosesId, proses_nama AS prosesNama
       FROM proses_alur_perkara
      WHERE alur_perkara_id = ? AND proses_id = ? LIMIT 1`,
    [Number(alurPerkaraId) || 0, Number(prosesId) || 0]
  ).catch(() => []);
  return (Array.isArray(baris) && baris[0]) || null;
}

/**
 * Proses mana yang dicatat riwayat - beserta jawabannya apakah riwayat
 * DIPERBARUI sama sekali.
 */
function prosesUntukTunda(keadaan, jenisPengadilan) {
  if (bersih(keadaan.ikrarTalak) === "Y") {
    return { prosesId: PROSES_IKRAR_TALAK, perbaruiRiwayat: false };
  }
  if (bersih(keadaan.verzet) === "Y") {
    return {
      prosesId: Number(jenisPengadilan) === 3 ? PROSES_VERZET_JENIS3 : PROSES_VERZET,
      perbaruiRiwayat: true,
    };
  }
  return { prosesId: PROSES_PERSIDANGAN, perbaruiRiwayat: true };
}

/**
 * Menyusun rencana penundaan - TIDAK menulis apa pun.
 *
 * @returns {Promise<object>} { ok, jenis, perkara, atasNama, langkah, andaian }
 */
async function susunRencanaTunda(minta = {}) {
  const keadaan = await keadaanJadwal(minta.jadwalId);
  if (!keadaan) return { ok: false, alasan: "jadwal_tidak_ketemu" };
  if (bersih(keadaan.ditunda) === "Y") {
    // Ditunda tetapi sidang berikutnya tidak pernah lahir = penundaan yang
    // setengah jadi (keadaan 273 sebelum 7 Okt 2026). Disebut dengan namanya
    // sendiri supaya petugas tahu apa yang harus dibereskan di SIPP.
    const utuh = await adaSidangSesudah(keadaan);
    return {
      ok: false,
      alasan: utuh === false ? "tunda_belum_utuh" : "sidang_sudah_ditunda",
      alasanTercatat: bersih(keadaan.alasanDitunda),
    };
  }

  // ==========================================================================
  // AKUNNYA DITURUNKAN DARI PERKARANYA: PANITERA SIDANG (PP) - TIDAK DIKETIK
  // ==========================================================================
  //
  // Keputusan 7 Okt 2026 (lihat pilihPaniteraSidang): penginput di SIPP = PP
  // perkara itu, siapa pun yang menekan tombolnya. Username yang dikirim
  // pemanggil TIDAK lagi dipakai sebagai cadangan - PP yang tidak tercatat
  // ditolak dengan sebabnya, bukan diganti akun lain.
  const pp = await paniteraSidang(keadaan.perkaraId, keadaan.tanggalSidang);
  if (!pp.ok) return { ok: false, alasan: pp.alasan, nama: pp.nama || [] };
  const akun = pp.akun;

  const antrian = await antrianSidangUntuk(keadaan);

  const alasanTunda = bersih(minta.alasanTunda);
  if (!alasanTunda) return { ok: false, alasan: "alasan_tunda_kosong" };

  const tanggalBerikut = bersih(minta.tanggalBerikut);
  if (!tanggalSah(tanggalBerikut)) return { ok: false, alasan: "tanggal_berikut_tidak_sah" };

  const jamBerikut = bersih(minta.jamBerikut) || bersih(keadaan.jamSidang);
  if (!jamSah(jamBerikut)) return { ok: false, alasan: "jam_berikut_tidak_sah" };

  const agendaBerikut = bersih(minta.agendaBerikut);
  if (!agendaBerikut) return { ok: false, alasan: "agenda_berikut_kosong" };
  // Butir 45 (17 Okt 2026): tidak ada kata ALETA di database SIPP - termasuk dari
  // isian bebas (alasan_ditunda, agenda). Sama dengan penetapanKembaliService.
  if (menyebutAleta(alasanTunda) || menyebutAleta(agendaBerikut)) return { ok: false, alasan: "teks_menyebut_aleta" };

  // ==========================================================================
  // TANGGALNYA DIPERIKSA DI SINI, BUKAN SESUDAH BARISNYA LAHIR
  // ==========================================================================
  const tanggalSekarang = (await penetapan.waktuBasisData()).slice(0, 10);
  if (tanggalBerikut <= tanggalSekarang) {
    return { ok: false, alasan: "tanggal_berikut_tidak_maju", diminta: tanggalBerikut };
  }

  if (akhirPekan(tanggalBerikut)) {
    return { ok: false, alasan: "tanggal_berikut_akhir_pekan", diminta: tanggalBerikut };
  }

  const andaian = [];
  // Sidang ikrar talak: batas 6 bulan (Pasal 70 ayat (6) UU 7/1989) dihitung
  // SEJAK PENETAPAN HARI SIDANG IKRAR, bukan BHT (keputusan pengguna no. 91,
  // 18 Okt 2026). Sidang ikrar sesudah batas itu tidak ada gunanya - kekuatan
  // penetapannya sudah gugur (blangko [91]) - jadi tundaan yang melewatinya
  // DITOLAK, bukan sekadar diperingatkan. Tanpa penetapan hari sidang ikrar
  // tenggatnya belum berjalan dan itu dikatakan.
  if (bersih(keadaan.ikrarTalak) === "Y") {
    const batas = ikrar.batasEnamBulanIkrar({
      tanggalPenetapanSidangIkrar: keadaan.tanggalPenetapanSidangIkrar,
    });
    if (batas && tanggalBerikut > batas) {
      return {
        ok: false,
        alasan: "tanggal_ikrar_melewati_batas_6_bulan",
        diminta: tanggalBerikut,
        batas,
        keterangan: `Tanggal sidang ikrar berikutnya ${tanggalBerikut} melewati batas 6 bulan ikrar (${batas}), dihitung sejak penetapan hari sidang ikrar ${keadaan.tanggalPenetapanSidangIkrar} - Pasal 70 ayat (6) UU 7/1989.`,
      };
    }
    if (!batas) {
      andaian.push("Hari sidang ikrar belum ditetapkan di SIPP - tenggat 6 bulan ikrar belum berjalan.");
    }
  }
  // hariLibur() memulangkan keterangan hari liburnya, atau null bila hari itu
  // hari kerja biasa. Tahun yang daftarnya belum dimuat juga memulangkan
  // null - karena itu ketersediaan tahunnya diperiksa TERPISAH, supaya
  // "belum ada daftarnya" tidak terbaca sebagai "bukan hari libur".
  const tahunBerikut = Number(tanggalBerikut.slice(0, 4));
  // tahunTersedia() memulangkan DAFTAR tahun (dahulu dipanggil seolah
  // predikat, sehingga selalu benar). Tahun tanpa SKB tetap diperiksa terhadap
  // libur tambahan Pengaturan, dan keterangannya ikut disebut.
  if (!hariLiburService.tahunTersedia().includes(tahunBerikut)) {
    andaian.push(
      `Daftar hari libur SKB tahun ${tahunBerikut} belum ada, jadi tanggal sidang berikutnya hanya diperiksa terhadap Sabtu, Minggu, dan libur tambahan Pengaturan.`
    );
  }
  {
    const libur = hariLiburService.hariLibur(tanggalBerikut);
    if (libur) {
      return {
        ok: false,
        alasan: "tanggal_berikut_hari_libur",
        keterangan: typeof libur === "string" ? libur : String(libur.nama || libur.keterangan || ""),
      };
    }
  }

  const jenisPengadilan = Number(minta.jenisPengadilan) || 0;
  const { prosesId, perbaruiRiwayat } = prosesUntukTunda(keadaan, jenisPengadilan);

  // Jam SIPP (WIB) - SIPP menulis jamnya dengan PHP Asia/Jakarta, NOW() basis
  // data WITA (13 Okt 2026). Lihat waktuSipp di penetapanTulisService.
  const saat = await penetapan.waktuSipp();
  // sampai_jam = jam sidang SETEMPAT (WITA), sama dengan NOW() aplikasi antrian
  // dan jam_sidang yang diketik petugas - bukan jam cap SIPP.
  const saatSetempat = await penetapan.waktuBasisData();
  // Butir 14: alamat yang tidak diteruskan DIKOSONGKAN, tidak dikarang "127.0.0.1".
  const ip = bersih(minta.ip) || "";
  const langkah = [];

  // ---- 1. Baris sidang hari ini: ditunda ----------------------------------
  // Jam mulai sidang: jam masuk ruang di antrian sidang (seperti aplikasi
  // antrian), baru jam yang dikirim layar / jam jadwal bila antrian tidak
  // mencatatnya. Kehadiran: pilihan blangko, lalu antrian, lalu yang tercatat.
  const jamMulai = jamBorang((antrian && antrian.jamMasuk) || bersih(minta.jamSekarang) || bersih(keadaan.jamSidang));
  if (antrian && antrian.jamMasuk) {
    andaian.push(`Jam mulai sidang ${antrian.jamMasuk.slice(0, 5)} diambil dari antrian sidang (jam masuk ruang).`);
  }
  const nilaiUbah = {
    jam_sidang: jamMulai,
    // Jam selesainya sidang. Kosong bukan pilihan: "" masuk ke kolom TIME
    // sebagai 00:00:00 tanpa satu pun galat - lihat jamDariCap.
    // Jam borang (HH:mm, detik 00) - lihat jamBorang.
    sampai_jam: jamSelesaiBorang(
      jamMulai,
      bersih(minta.sampaiJamSekarang) || bersih(keadaan.sampaiJam) || jamDariCap(saatSetempat)
    ),
    agenda: bersih(minta.agendaSekarang) || bersih(keadaan.agenda),
    // ------------------------------------------------------------------
    // KEHADIRAN PIHAK - ANGKANYA MILIK SIPP, DAN BUKAN 0..3
    // ------------------------------------------------------------------
    //
    // Dibaca langsung dari `antrian/php/menu.sidang.php` di peladen:
    //
    //     1  SEMUA HADIR          2  PIHAK PERTAMA SAJA
    //     3  PIHAK KEDUA SAJA     4  PIHAK TIDAK HADIR
    //
    // Terukur pada 20.171 baris `perkara_jadwal_sidang` satker:
    // 2 -> 10.061, 1 -> 7.503, kosong -> 1.373, 4 -> 1.061, 3 -> 169.
    //
    // Cadangannya 4, bukan 1. Aplikasi antrian menaruh "PIHAK TIDAK HADIR"
    // sebagai pilihan pertama, sehingga baris yang belum pernah diisi
    // terkirim sebagai 4. Cadangan 1 menuliskan "semua hadir" pada sidang
    // yang mungkin tidak dihadiri siapa pun - dan itu pernyataan yang
    // terbaca sebagai fakta persidangan, bukan sekadar nilai bawaan.
    dihadiri_oleh:
      Number(minta.dihadiriOleh) ||
      (antrian && antrian.dihadiriOleh) ||
      Number(keadaan.dihadiriOleh) ||
      4,
    ditunda: "Y",
    alasan_ditunda: alasanTunda,
    sifat_sidang: bersih(minta.sifatSidang) || bersih(keadaan.sifatSidang),
    keterangan: bersih(minta.keterangan),
    diperbaharui_oleh: akun.username,
    diperbaharui_tanggal: saat,
  };

  langkah.push({
    tabel: "perkara_jadwal_sidang",
    aksi: "UPDATE",
    sql: `UPDATE perkara_jadwal_sidang
             SET jam_sidang = ?, sampai_jam = ?, agenda = ?, dihadiri_oleh = ?,
                 ditunda = ?, alasan_ditunda = ?, sifat_sidang = ?, keterangan = ?,
                 diperbaharui_oleh = ?, diperbaharui_tanggal = ?
           WHERE id = ?`,
    params: [
      nilaiUbah.jam_sidang,
      nilaiUbah.sampai_jam,
      nilaiUbah.agenda,
      nilaiUbah.dihadiri_oleh,
      nilaiUbah.ditunda,
      nilaiUbah.alasan_ditunda,
      nilaiUbah.sifat_sidang,
      nilaiUbah.keterangan,
      nilaiUbah.diperbaharui_oleh,
      nilaiUbah.diperbaharui_tanggal,
      keadaan.jadwalId,
    ],
    // Tanggalnya dilewatkan tanggalIso lebih dahulu: penggerak MySQL
    // memulangkan kolom DATE sebagai obyek Date, dan menyisipkannya apa adanya
    // ke dalam teks menghasilkan "Tue Mar 09 2027 00:00:00 GMT+0800 (Central
    // Indonesia Time)" - bahasa Inggris, di layar berbahasa Indonesia yang
    // dibaca panitera sidang sebelum ia menekan tombol tulis.
    keterangan: `menunda sidang ${penetapan.tanggalIso(keadaan.tanggalSidang)} - ${alasanTunda}`,
  });

  langkah.push(
    penetapan.barisAudit({
      username: akun.username,
      tabel: "perkara_jadwal_sidang",
      formulir: NAMA_HALAMAN,
      aksi: "UPDATE",
      nilai: nilaiUbah,
      kunciSendiri: `id=${keadaan.jadwalId}`,
      ip,
      saat,
    })
  );

  // ---- 2. Baris sidang berikutnya -----------------------------------------
  // Butir 25 (5 Okt 2026): ruang sidang + sidang keliling DIPILIH di blangko,
  // seperti blangko tunda SIPP (ruangansidkel/ruangan + sidang_keliling).
  // Tanpa pilihan: disalin dari sidang ini, seperti semula.
  // Tanpa pilihan blangko: ruang tempat perkaranya disidangkan hari ini menurut
  // antrian (aplikasi antrian memakai ruang itu), lalu yang tercatat di SIPP.
  const pilihRuangBerikut =
    bersih(minta.ruanganIdBerikut) !== ""
      ? minta.ruanganIdBerikut
      : antrian && antrian.ruanganId && Number(antrian.ruanganId) !== Number(keadaan.ruanganId)
        ? antrian.ruanganId
        : undefined;
  const ruangBerikut = await ruangDipilih(
    { ruanganId: pilihRuangBerikut, sidangKeliling: minta.sidangKelilingBerikut },
    keadaan
  );
  if (!ruangBerikut.ok) return { ok: false, alasan: ruangBerikut.alasan };
  const nilaiBaru = {
    perkara_id: keadaan.perkaraId,
    tanggal_sidang: tanggalBerikut,
    jam_sidang: jamBerikut,
    agenda: agendaBerikut,
    ruangan_id: ruangBerikut.nilai.ruangan_id,
    ruangan: ruangBerikut.nilai.ruangan,
    sidang_keliling: ruangBerikut.nilai.sidang_keliling,
    // 'Y'/'T', TIDAK PERNAH NULL - lihat bendera(). Kasus 273.
    verzet: bendera(keadaan.verzet),
    keberatan: bendera(keadaan.keberatan),
    ikrar_talak: bendera(keadaan.ikrarTalak),
    diinput_oleh: akun.username,
    diinput_tanggal: saat,
  };

  langkah.push({
    tabel: "perkara_jadwal_sidang",
    aksi: "INSERT",
    // id DIHITUNG saat penulisan, bukan saat rencana disusun - perkara_jadwal_sidang
    // tidak ber-auto_increment, dan jeda antara membaca MAX(id) dan memakainya
    // cukup untuk melahirkan dua baris berid sama bila dua petugas menekan
    // Simpan bersamaan. Urutannya pun dihitung di sana.
    sql: `INSERT INTO perkara_jadwal_sidang
            (id, perkara_id, tanggal_sidang, jam_sidang, agenda, ruangan_id, ruangan,
             sidang_keliling, verzet, keberatan, ikrar_talak, urutan, diinput_oleh, diinput_tanggal)
          VALUES (?,?,?,?,?,?,?,?,?,?,?, (SELECT urutan FROM (
                    SELECT IFNULL(MAX(urutan),0) + 1 AS urutan
                      FROM perkara_jadwal_sidang WHERE perkara_id = ?) u), ?, ?)`,
    params: [
      0,
      nilaiBaru.perkara_id,
      nilaiBaru.tanggal_sidang,
      nilaiBaru.jam_sidang,
      nilaiBaru.agenda,
      nilaiBaru.ruangan_id,
      nilaiBaru.ruangan,
      nilaiBaru.sidang_keliling,
      nilaiBaru.verzet,
      nilaiBaru.keberatan,
      nilaiBaru.ikrar_talak,
      nilaiBaru.perkara_id,
      nilaiBaru.diinput_oleh,
      nilaiBaru.diinput_tanggal,
    ],
    idDihitung: { tabel: "perkara_jadwal_sidang", posisiParam: 0 },
    keterangan: `sidang berikutnya ${tanggalBerikut} ${jamBerikut} - ${agendaBerikut}`,
  });

  langkah.push(
    penetapan.barisAudit({
      username: akun.username,
      tabel: "perkara_jadwal_sidang",
      formulir: NAMA_HALAMAN,
      aksi: "INSERT",
      nilai: nilaiBaru,
      // Kunci utamanya id baris yang baru saja lahir. Penandanya diisi
      // penjalan sesudah barisnya benar-benar ada - lihat kunciDariLangkah
      // pada jalankanRencana.
      kunciSendiri: "id=#ID#",
      kunciDariLangkah: { "#ID#": langkah.length - 1 },
      ip,
      saat,
    })
  );

  // ---- 3. Riwayat perkara -------------------------------------------------
  if (perbaruiRiwayat) {
    const alur = await prosesAlur(keadaan.alurPerkaraId, prosesId);
    if (!alur) {
      andaian.push(
        "Alur perkara ini tidak punya tahap riwayat yang dimaksud, jadi riwayat perkaranya tidak diperbarui."
      );
    } else {
      langkah.push({
        tabel: "perkara_proses",
        aksi: "CALL",
        // Prosedur yang SAMA dengan yang dipanggil SIPP - bukan tiruannya.
        // Ia sudah ada di basis data satker; menuliskan ulang isinya berarti
        // menyimpan salinan kedua yang perlahan menyimpang dari aslinya.
        sql: `CALL perkara_proses_update(?,?,?,?,?,?,?,?,?)`,
        params: [
          String(keadaan.perkaraId),
          String(alur.tahapanId),
          alur.tahapanNama,
          String(alur.prosesId),
          alur.prosesNama,
          tanggalBerikut,
          "",
          akun.username,
          saat,
        ],
        keterangan: `riwayat perkara: ${alur.tahapanNama} - ${alur.prosesNama}`,
      });

      const nilaiTahapan = {
        tahapan_terakhir_id: alur.tahapanId,
        tahapan_terakhir_text: alur.tahapanNama,
        proses_terakhir_id: alur.prosesId,
        proses_terakhir_text: alur.prosesNama,
        diperbaharui_oleh: akun.username,
        diperbaharui_tanggal: saat,
      };

      langkah.push({
        tabel: "perkara",
        aksi: "UPDATE",
        // Nilainya diambil dari baris proses TERBARU, urut persis seperti
        // riwayat_perkara_m::updateproses membacanya - bukan dari nilai yang
        // kita kira baru saja ditulis. Perkara yang sementara itu bergerak ke
        // tahapan lain karena itu tidak ditarik mundur.
        sql: `UPDATE perkara p
                JOIN (SELECT tahapan_id, tahapan_nama, proses_id, proses_nama
                        FROM perkara_proses
                       WHERE perkara_id = ?
                       ORDER BY tahapan_id DESC, proses_id DESC, tanggal DESC, urutan DESC,
                                IFNULL(diperbaharui_tanggal, diinput_tanggal) DESC
                       LIMIT 1) x
                 SET p.tahapan_terakhir_id = x.tahapan_id,
                     p.tahapan_terakhir_text = x.tahapan_nama,
                     p.proses_terakhir_id = x.proses_id,
                     p.proses_terakhir_text = x.proses_nama,
                     p.diperbaharui_oleh = ?, p.diperbaharui_tanggal = ?
               WHERE p.perkara_id = ?`,
        params: [keadaan.perkaraId, akun.username, saat, keadaan.perkaraId],
        keterangan: `tahapan terakhir: ${alur.tahapanNama}`,
      });

      langkah.push(
        penetapan.barisAudit({
          username: akun.username,
          tabel: "perkara",
          formulir: NAMA_HALAMAN,
          aksi: "UPDATE",
          nilai: nilaiTahapan,
          perkaraId: keadaan.perkaraId,
          ip,
          saat,
        })
      );
    }
  } else {
    andaian.push(
      "Sidang ikrar talak: riwayat perkaranya sengaja TIDAK diperbarui, sama seperti yang dikerjakan SIPP sendiri."
    );
  }

  return {
    ok: true,
    jenis: "tunda",
    perkara: { perkaraId: keadaan.perkaraId, nomorPerkara: keadaan.nomorPerkara },
    atasNama: { username: akun.username, namaLengkap: akun.fullname, peran: "panitera sidang" },
    operator: bersih(minta.operator),
    saat,
    antrian,
    sidangSekarang: { jadwalId: keadaan.jadwalId, tanggal: keadaan.tanggalSidang },
    sidangBerikutnya: { tanggal: tanggalBerikut, jam: jamBerikut, agenda: agendaBerikut },
    langkah,
    andaian,
  };
}

/**
 * ============================================================================
 * AMAR PUTUSAN DIISI "BELUM DIINPUT", DAN ITU BUKAN KEKURANGAN
 * ============================================================================
 *
 * Dibaca dari aplikasi antrian sidang satker sendiri:
 *
 *     $amar_put = "<b> B E L U M  &nbsp; D I I N P U T</b>";
 *
 * Panitera sidang TIDAK menulis amar, TIDAK menulis pertimbangan hukum, dan
 * TIDAK memilih sumber hukum - sumber_hukum_id selalu '8,11', tetap. Yang ia
 * catat hanya bahwa hari ini perkaranya diputus dan jenis putusannya apa.
 *
 * Amar dan pertimbangannya pekerjaan HAKIM, lewat layar SIPP-nya sendiri, dan
 * biasanya beberapa hari kemudian. Borang panitera sidang yang menuntut amar
 * akan menahan pencatatan sampai naskahnya jadi - padahal yang dibutuhkan
 * papan antrian, laporan harian, dan akta cerai adalah FAKTA bahwa perkaranya
 * sudah diputus, hari ini.
 *
 * Inilah sebabnya berkas ini tidak memakai putusanTulisService: yang itu
 * borang HAKIM - ia menuntut amar dan pertimbangan, dan memang seharusnya.
 * Keduanya menulis ke tabel yang sama pada saat yang berbeda, dan `ON
 * DUPLICATE KEY UPDATE` di bawah itulah yang membuat keduanya dapat hidup
 * berdampingan.
 */
const AMAR_BELUM = "<b> B E L U M  &nbsp; D I I N P U T</b>";

/** Sumber hukum tetap - aplikasi antrian tidak menanyakannya. */
const SUMBER_HUKUM_TETAP = "8,11";

/** Status yang mengisi tanggal tersendiri di luar tanggal putusan. */
const STATUS_DIGUGURKAN = 65;
const STATUS_DICABUT = 67;

/** Tahapan dan proses sesudah perkara diputus. */
const TAHAPAN_PUTUSAN = 15;
const PROSES_PUTUSAN = 210;

/**
 * Menyusun rencana MEMUTUS satu sidang - TIDAK menulis apa pun.
 *
 * Bentuknya meniru aplikasi antrian sidang baris demi baris, dan tiga hal di
 * dalamnya mudah terlewat kalau ditebak:
 *
 *   1. `ditunda` diisi 'T', bukan 'Y'. Sidang yang diputus bukan sidang yang
 *      ditunda - dan papan antrian membaca kolom itu untuk tahu mana yang
 *      masih berjalan.
 *   2. `alasan_ditunda` DIPAKAI ULANG memuat "putus DIKABULKAN (verstek)".
 *      Kolomnya bernama alasan ditunda, isinya hasil sidang; begitulah SIPP
 *      menyimpannya, dan menaruhnya di tempat lain membuat layar SIPP kosong.
 *   3. Tidak ada baris jadwal BARU. Perkara yang diputus tidak bersidang lagi.
 *
 * ============================================================================
 * BAWAANNYA HANYA JADWAL SIDANG (perbaikan 30 Sep 2026, butir 12)
 * ============================================================================
 *
 * Tombol PUTUS di Jadwal Sidang / antrian sidang cukup mencatat HASIL
 * SIDANGNYA di perkara_jadwal_sidang (beserta baris audit jadwal itu, dengan
 * nama halaman borang EDIT JADWAL SIDANG - audit pola 18 Okt 2026, lihat
 * NAMA_HALAMAN_EDIT).
 * perkara_putusan, baris audit perkara_putusan, dan tahapan perkara TIDAK
 * ditulis dari sini - pengguna melihat rencana "perkara_putusan INSERT ...
 * atas nama Himawan, perkara UPDATE tahapan terakhir menjadi Putusan" dan
 * menolaknya: putusan akhir diinput hakim/petugas lewat SIPP (atau lewat
 * jalur putusan otomatis), bukan tercipta dari tombol antrian.
 *
 * Penulisan putusan lengkapnya TIDAK dihapus: `minta.tulisPutusan === true`
 * masih menyusun ketiga langkah itu seperti sebelumnya. Tidak ada tombol
 * jadwal sidang yang mengirimnya.
 */
async function susunRencanaPutus(minta = {}) {
  const tulisPutusan = minta.tulisPutusan === true;
  const keadaan = await keadaanJadwal(minta.jadwalId);
  if (!keadaan) return { ok: false, alasan: "jadwal_tidak_ketemu" };

  // Sidang yang sudah ditunda DAN punya sidang sesudahnya tidak diputus dari
  // sini: menimpa ditunda='T' membuat sidang berikutnya yatim - keadaan
  // setengah jadi yang sama dengan 273, dari arah sebaliknya. Penundaan yang
  // setengah jadi (tanpa sidang berikutnya) tetap boleh diputus.
  if (bersih(keadaan.ditunda) === "Y") {
    const utuh = await adaSidangSesudah(keadaan);
    if (utuh !== false) return { ok: false, alasan: "sidang_ditunda_tidak_dapat_diputus" };
  }

  // Penginput di SIPP = panitera sidang (PP) perkara itu - keputusan 7 Okt
  // 2026, lihat pilihPaniteraSidang. Hakim hanya untuk jalur tulisPutusan.
  const pp = await paniteraSidang(keadaan.perkaraId, keadaan.tanggalSidang);
  if (!pp.ok) return { ok: false, alasan: pp.alasan, nama: pp.nama || [] };
  const akun = { panitera: pp.akun, hakim: tulisPutusan ? (await akunPerkara(keadaan.perkaraId)).hakim : null };
  const antrian = await antrianSidangUntuk(keadaan);
  // Hakimnya boleh tidak ketemu - putusannya lalu dicatat atas nama panitera
  // sidang, dan itu disebutkan pada andaian, bukan dibiarkan senyap.
  const penulisPutusan = akun.hakim || akun.panitera;

  const statusId = Number(minta.statusPutusanId);
  if (!Number.isInteger(statusId) || statusId <= 0) {
    return { ok: false, alasan: "status_putusan_belum_dipilih" };
  }
  const status = await kueri(`SELECT id, nama FROM status_putusan WHERE id = ? LIMIT 1`, [statusId]).catch(
    () => []
  );
  if (!Array.isArray(status) || status.length === 0) {
    return { ok: false, alasan: "status_putusan_tidak_dikenal" };
  }
  const namaStatus = String(status[0].nama || "");

  // tanggalIso, bukan slice: penggerak MySQL memulangkan kolom DATE sebagai
  // obyek Date, dan String(date).slice(0,10) menghasilkan "Tue Mar 09" -
  // cocok-pola tanggalnya gagal, dan putusannya ditolak dengan alasan
  // "tanggal tidak sah" atas tanggal yang sebenarnya ada.
  const tanggalPutus = bersih(minta.tanggalPutus) || penetapan.tanggalIso(keadaan.tanggalSidang);
  if (!tanggalSah(tanggalPutus)) return { ok: false, alasan: "tanggal_putus_tidak_sah" };

  const verstek = bersih(minta.verstek).toUpperCase() === "Y" ? "Y" : "T";
  // Pilihan blangko, lalu kehadiran yang tercatat di antrian sidang.
  const dihadiri = Number(minta.dihadiriOleh) || Number((antrian && antrian.dihadiriOleh) || 0);
  // Jam SIPP (WIB) - SIPP menulis jamnya dengan PHP Asia/Jakarta, NOW() basis
  // data WITA (13 Okt 2026). Lihat waktuSipp di penetapanTulisService.
  const saat = await penetapan.waktuSipp();
  // sampai_jam = jam sidang SETEMPAT (WITA), sama dengan NOW() aplikasi antrian
  // dan jam_sidang yang diketik petugas - bukan jam cap SIPP.
  const saatSetempat = await penetapan.waktuBasisData();
  // Butir 14: alamat yang tidak diteruskan DIKOSONGKAN, tidak dikarang "127.0.0.1".
  const ip = bersih(minta.ip) || "";
  const andaian = [];
  if (!akun.hakim && tulisPutusan) {
    andaian.push(
      "Hakim perkara ini tidak ketemu di SIPP, jadi putusannya dicatat atas nama panitera sidang. " +
        "Pada aplikasi antrian ia dicatat atas nama hakim."
    );
  }
  if (antrian && antrian.jamMasuk) {
    andaian.push(`Jam mulai sidang ${antrian.jamMasuk.slice(0, 5)} diambil dari antrian sidang (jam masuk ruang).`);
  }

  const langkah = [];

  // ---- 1. Sidang hari ini: SELESAI, bukan ditunda ------------------------
  const nilaiJadwal = {
    // Jam saja - kolomnya TIME. Cap waktu utuh "2026-09-18 05:15:21" dibaca
    // MySQL sebagai bentuk 'D HH:MM:SS' dan hasilnya bukan jam yang dimaksud.
    // Jam borang (HH:mm, detik 00) - lihat jamBorang.
    sampai_jam: jamSelesaiBorang(
      (antrian && antrian.jamMasuk) || bersih(minta.jamSekarang) || bersih(keadaan.jamSidang),
      jamDariCap(saatSetempat)
    ),
    alasan_ditunda: `putus ${namaStatus}${verstek === "Y" ? " (verstek)" : ""}`,
    // Jam masuk ruang di antrian sidang, dalam bentuk jam borang.
    jam_sidang: jamBorang((antrian && antrian.jamMasuk) || bersih(minta.jamSekarang) || bersih(keadaan.jamSidang)),
    ditunda: "T",
    diperbaharui_oleh: akun.panitera.username,
    diperbaharui_tanggal: saat,
  };
  // Hanya 1..4 yang punya arti - lihat daftarnya pada susunRencanaTunda. Di
  // luar itu kolomnya TIDAK disentuh sama sekali: menuliskan angka yang tidak
  // ada artinya lebih buruk daripada membiarkan yang sudah ada.
  const adaDihadiri = Number.isInteger(dihadiri) && dihadiri >= 1 && dihadiri <= 4;
  // Butir 25 (5 Okt 2026): ruang sidang + sidang keliling sidang INI dari
  // blangko - ditulis HANYA bila berbeda dari yang tercatat (kolom lain tidak
  // disentuh, dan tanpa pilihan tidak ada yang berubah sama sekali).
  const ruangSidang = await ruangDipilih(
    {
      // Tanpa pilihan blangko: ruang tempat perkaranya disidangkan menurut antrian.
      ruanganId:
        bersih(minta.ruanganIdSidang) !== ""
          ? minta.ruanganIdSidang
          : antrian && antrian.ruanganId && Number(antrian.ruanganId) !== Number(keadaan.ruanganId)
            ? antrian.ruanganId
            : undefined,
      sidangKeliling: minta.sidangKelilingSidang,
    },
    keadaan
  );
  if (!ruangSidang.ok) return { ok: false, alasan: ruangSidang.alasan };
  const ubahRuang = ruangSidang.berubah;
  if (ubahRuang) {
    nilaiJadwal.ruangan_id = ruangSidang.nilai.ruangan_id;
    nilaiJadwal.ruangan = ruangSidang.nilai.ruangan;
    nilaiJadwal.sidang_keliling = ruangSidang.nilai.sidang_keliling;
  }
  const kolomRuang = ubahRuang ? "ruangan_id = ?, ruangan = ?, sidang_keliling = ?, " : "";
  const nilaiRuang = ubahRuang
    ? [ruangSidang.nilai.ruangan_id, ruangSidang.nilai.ruangan, ruangSidang.nilai.sidang_keliling]
    : [];
  langkah.push({
    tabel: "perkara_jadwal_sidang",
    aksi: "UPDATE",
    keterangan: `sidang ${penetapan.tanggalIso(keadaan.tanggalSidang)} selesai - ${nilaiJadwal.alasan_ditunda}${
      ubahRuang ? ` (${ruangSidang.nilai.ruangan || "ruang sidang"}${ruangSidang.nilai.sidang_keliling === "Y" ? ", sidang keliling" : ""})` : ""
    }`,
    sql:
      `UPDATE perkara_jadwal_sidang
          SET sampai_jam = ?, alasan_ditunda = ?, jam_sidang = ?, ditunda = ?,
              ${adaDihadiri ? "dihadiri_oleh = ?, " : ""}${kolomRuang}diperbaharui_oleh = ?, diperbaharui_tanggal = ?
        WHERE id = ?`,
    params: [
      nilaiJadwal.sampai_jam,
      nilaiJadwal.alasan_ditunda,
      nilaiJadwal.jam_sidang,
      nilaiJadwal.ditunda,
      ...(adaDihadiri ? [dihadiri] : []),
      ...nilaiRuang,
      nilaiJadwal.diperbaharui_oleh,
      nilaiJadwal.diperbaharui_tanggal,
      keadaan.jadwalId,
    ],
  });
  langkah.push(
    penetapan.barisAudit({
      username: akun.panitera.username,
      tabel: "perkara_jadwal_sidang",
      formulir: NAMA_HALAMAN_EDIT,
      aksi: "UPDATE",
      nilai: nilaiJadwal,
      kunciSendiri: `id=${keadaan.jadwalId}`,
      ip,
      saat,
    })
  );

  if (!tulisPutusan) {
    andaian.push(
      "Hanya hasil sidang di jadwal sidang yang dicatat. Putusan akhir dan tahapan perkara " +
        "tidak ditulis dari tombol ini - diinput lewat SIPP / putusan otomatis."
    );
  }

  // ---- 2. Putusannya (hanya bila diminta tegas) ---------------------------
  if (tulisPutusan) {
    const nilaiPutusan = {
      perkara_id: keadaan.perkaraId,
      tanggal_putusan: tanggalPutus,
      putusan_verstek: verstek,
      sumber_hukum_id: SUMBER_HUKUM_TETAP,
      status_putusan_id: statusId,
      tanggal_cabut: statusId === STATUS_DICABUT ? tanggalPutus : null,
      tanggal_gugur: statusId === STATUS_DIGUGURKAN ? tanggalPutus : null,
      amar_putusan: AMAR_BELUM,
      diinput_oleh: penulisPutusan.username,
      diinput_tanggal: saat,
    };
    langkah.push({
      tabel: "perkara_putusan",
      aksi: "INSERT",
      keterangan: `putusan ${keadaan.nomorPerkara} - ${namaStatus}${verstek === "Y" ? " (verstek)" : ""}`,
      // ON DUPLICATE KEY UPDATE, sama seperti aplikasi antrian: memutus ulang
      // memperbarui barisnya, bukan gagal. Perkara yang jenis putusannya
      // dikoreksi sesudah sidang bukan hal aneh.
      sql:
        `INSERT INTO perkara_putusan
           (perkara_id, tanggal_putusan, putusan_verstek, sumber_hukum_id, status_putusan_id,
            tanggal_cabut, tanggal_gugur, amar_putusan, diinput_oleh, diinput_tanggal)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           tanggal_putusan = VALUES(tanggal_putusan),
           putusan_verstek = VALUES(putusan_verstek),
           sumber_hukum_id = VALUES(sumber_hukum_id),
           status_putusan_id = VALUES(status_putusan_id),
           tanggal_cabut = VALUES(tanggal_cabut),
           tanggal_gugur = VALUES(tanggal_gugur)`,
      params: [
        nilaiPutusan.perkara_id,
        nilaiPutusan.tanggal_putusan,
        nilaiPutusan.putusan_verstek,
        nilaiPutusan.sumber_hukum_id,
        nilaiPutusan.status_putusan_id,
        nilaiPutusan.tanggal_cabut,
        nilaiPutusan.tanggal_gugur,
        nilaiPutusan.amar_putusan,
        nilaiPutusan.diinput_oleh,
        nilaiPutusan.diinput_tanggal,
      ],
    });
    langkah.push(
      penetapan.barisAudit({
        username: penulisPutusan.username,
        tabel: "perkara_putusan",
        formulir: "TAMBAH DATA PUTUSAN AKHIR",
        aksi: "tambah",
        nilai: nilaiPutusan,
        perkaraId: keadaan.perkaraId,
        ip,
        saat,
        // Modul putusan SIPP memakai judul yang berbeda dari modul lain.
        judulSendiri: `tambah Data Putusan Akhir <br />dengan perkara_id [id=${keadaan.perkaraId}]`,
      })
    );

    // ---- 3. Tahapan terakhir menjadi Putusan --------------------------------
    const alur = await prosesAlur(keadaan.alurPerkaraId, PROSES_PUTUSAN);
    langkah.push({
      tabel: "perkara",
      aksi: "UPDATE",
      keterangan: `tahapan terakhir ${keadaan.nomorPerkara} menjadi Putusan`,
      sql:
        `UPDATE perkara
            SET tahapan_terakhir_id = ?, tahapan_terakhir_text = ?,
                proses_terakhir_id = ?, proses_terakhir_text = ?
          WHERE perkara_id = ?`,
      params: [
        TAHAPAN_PUTUSAN,
        (alur && alur.tahapanNama) || "Putusan",
        PROSES_PUTUSAN,
        (alur && alur.prosesNama) || "Putusan",
        keadaan.perkaraId,
      ],
    });
  }

  return {
    ok: true,
    jenis: "putus",
    hanyaJadwal: !tulisPutusan,
    antrian,
    perkara: { perkaraId: keadaan.perkaraId, nomorPerkara: keadaan.nomorPerkara },
    // Sidang yang diputus - antrian sidang dikunci pada TANGGAL SIDANG ini,
    // bukan pada tanggal putusan yang diketik (uji rilis 9 Okt 2026).
    sidangSekarang: { jadwalId: keadaan.jadwalId, tanggal: penetapan.tanggalIso(keadaan.tanggalSidang) },
    atasNama: {
      username: akun.panitera.username,
      namaLengkap: akun.panitera.fullname,
      peran: "panitera sidang",
      putusanAtasNama: tulisPutusan ? penulisPutusan.username : undefined,
    },
    operator: bersih(minta.operator),
    saat,
    putusan: {
      tanggalPutus,
      status: namaStatus,
      statusPutusanId: statusId,
      verstek: verstek === "Y",
      // Disebut TEGAS supaya layar tidak perlu menerangkannya sendiri, dan
      // supaya tidak ada yang mengira amarnya hilang.
      amar: "Diisi \"BELUM DIINPUT\" - amar dan pertimbangan hukumnya ditulis hakim lewat SIPP.",
    },
    langkah,
    andaian,
  };
}

/**
 * ============================================================================
 * PUTUS SIDANG IKRAR TALAK: "IKRAR DILAKSANAKAN" (permintaan 18 Okt 2026)
 * ============================================================================
 *
 * Sidang ikrar tidak memutus perkara (putusannya dijatuhkan jauh sebelumnya) -
 * yang dicatat adalah IKRAR TERLAKSANA. Tombol PUTUS pada sidang ikrar karena
 * itu tidak menanyakan jenis putusan; petugas hanya mengonfirmasi "ikrar
 * dilaksanakan". Yang ditulis:
 *
 *   1. perkara_jadwal_sidang: ditunda = 'T', alasan_ditunda (kolom hasil sidang)
 *      "telah ikrar talak" - EJAAN SIPP SENDIRI (446 sidang ikrar di satker),
 *      dan keterangan "Ikrar Telah Dilaksanakan" (diisi bila kosong; bila sudah
 *      ada isi petugas, ditambahkan di belakang - tidak ditimpa). Atas nama PP
 *      perkara (keputusan 7 Okt 2026), seperti tombol putus biasa.
 *   2. Form "Penetapan Ikrar Talak" (ikrarTalakService), atas nama KETUA MAJELIS
 *      ikrar. Bila form belum dapat diisi (mis. penetapan majelis ikrar belum
 *      ada), hasil sidangnya tetap dicatat dan sebabnya dilaporkan di andaian.
 *
 * Semuanya dalam SATU transaksi (jalankanRencanaUtuh).
 */
async function susunRencanaPutusIkrar(minta = {}) {
  const keadaan = await keadaanJadwal(minta.jadwalId);
  if (!keadaan) return { ok: false, alasan: "jadwal_tidak_ketemu" };
  if (bersih(keadaan.ikrarTalak) !== "Y") return { ok: false, alasan: "bukan_sidang_ikrar" };
  if (minta.ikrarDilaksanakan !== true) return { ok: false, alasan: "ikrar_belum_dikonfirmasi" };
  if (bersih(keadaan.ditunda) === "Y") {
    const utuh = await adaSidangSesudah(keadaan);
    if (utuh !== false) return { ok: false, alasan: "sidang_ditunda_tidak_dapat_diputus" };
  }

  const pp = await paniteraSidang(keadaan.perkaraId, keadaan.tanggalSidang);
  if (!pp.ok) return { ok: false, alasan: pp.alasan, nama: pp.nama || [] };
  const akun = pp.akun;
  const antrian = await antrianSidangUntuk(keadaan);

  const saat = await penetapan.waktuSipp();
  const saatSetempat = await penetapan.waktuBasisData();
  const ip = bersih(minta.ip) || "";
  const dihadiri = Number(minta.dihadiriOleh) || Number((antrian && antrian.dihadiriOleh) || 0);
  const adaDihadiri = Number.isInteger(dihadiri) && dihadiri >= 1 && dihadiri <= 4;
  const andaian = [];
  if (antrian && antrian.jamMasuk) {
    andaian.push(`Jam mulai sidang ${antrian.jamMasuk.slice(0, 5)} diambil dari antrian sidang (jam masuk ruang).`);
  }

  // Keterangan: tidak menimpa tulisan petugas.
  const ada = bersih(keadaan.keterangan);
  const keterangan = !ada
    ? ikrar.KETERANGAN_IKRAR
    : ada.toLowerCase().includes(ikrar.KETERANGAN_IKRAR.toLowerCase())
      ? ada
      : `${ada}; ${ikrar.KETERANGAN_IKRAR}`.slice(0, 500);

  const nilaiJadwal = {
    sampai_jam: jamSelesaiBorang(
      (antrian && antrian.jamMasuk) || bersih(minta.jamSekarang) || bersih(keadaan.jamSidang),
      jamDariCap(saatSetempat)
    ),
    alasan_ditunda: ikrar.HASIL_SIDANG_IKRAR,
    keterangan,
    jam_sidang: jamBorang((antrian && antrian.jamMasuk) || bersih(minta.jamSekarang) || bersih(keadaan.jamSidang)),
    ditunda: "T",
    ...(adaDihadiri ? { dihadiri_oleh: dihadiri } : {}),
    diperbaharui_oleh: akun.username,
    diperbaharui_tanggal: saat,
  };
  const langkah = [];
  langkah.push({
    tabel: "perkara_jadwal_sidang",
    aksi: "UPDATE",
    keterangan: `sidang ikrar ${penetapan.tanggalIso(keadaan.tanggalSidang)} selesai - ikrar telah dilaksanakan`,
    sql:
      `UPDATE perkara_jadwal_sidang
          SET sampai_jam = ?, alasan_ditunda = ?, keterangan = ?, jam_sidang = ?, ditunda = ?,
              ${adaDihadiri ? "dihadiri_oleh = ?, " : ""}diperbaharui_oleh = ?, diperbaharui_tanggal = ?
        WHERE id = ?`,
    params: [
      nilaiJadwal.sampai_jam,
      nilaiJadwal.alasan_ditunda,
      nilaiJadwal.keterangan,
      nilaiJadwal.jam_sidang,
      nilaiJadwal.ditunda,
      ...(adaDihadiri ? [dihadiri] : []),
      nilaiJadwal.diperbaharui_oleh,
      nilaiJadwal.diperbaharui_tanggal,
      keadaan.jadwalId,
    ],
  });
  langkah.push(
    penetapan.barisAudit({
      username: akun.username,
      tabel: "perkara_jadwal_sidang",
      formulir: NAMA_HALAMAN_EDIT,
      aksi: "UPDATE",
      nilai: nilaiJadwal,
      kunciSendiri: `id=${keadaan.jadwalId}`,
      ip,
      saat,
    })
  );

  // Form ikrar - atas nama ketua majelis ikrar. Gagal menyusun = andaian, bukan penolakan.
  const form = await ikrar.susunRencanaIsiIkrar({ jadwalId: keadaan.jadwalId, ip, sudahPutus: true });
  let formIkrar = { ok: false, alasan: form.alasan };
  if (form.ok) {
    langkah.push(...form.langkah);
    andaian.push(...(form.andaian || []));
    formIkrar = { ok: true, atasNama: form.atasNama, tanggalIkrar: form.tanggalIkrar };
  } else {
    andaian.push(
      `Hasil sidang dicatat, tetapi form ikrar talak di SIPP BELUM terisi (${form.alasan}). Isi lewat tombol Isi form ikrar setelah sebabnya dibereskan.`
    );
  }

  return {
    ok: true,
    jenis: "putus-ikrar",
    hanyaJadwal: !form.ok,
    antrian,
    perkara: { perkaraId: keadaan.perkaraId, nomorPerkara: keadaan.nomorPerkara },
    sidangSekarang: { jadwalId: keadaan.jadwalId, tanggal: penetapan.tanggalIso(keadaan.tanggalSidang) },
    atasNama: { username: akun.username, namaLengkap: akun.fullname, peran: "panitera sidang" },
    formIkrar,
    operator: bersih(minta.operator),
    saat,
    langkah,
    andaian,
  };
}

/**
 * Menggerakkan antrian sidang - dipanggil, diskors, atau selesai.
 *
 * Terpisah dari penundaannya dan disengaja: antrian bergerak beberapa kali
 * dalam satu sidang, sedangkan hasil sidang ditulis sekali. Menyatukan
 * keduanya berarti tombol "panggil" ikut menyeret rencana penundaan.
 */
async function setelAntrian({ perkaraId, tanggalSidang, ruangId, keadaan, kering = true }) {
  const id = Number(perkaraId);
  const status = Number(keadaan);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, alasan: "perkara_tidak_sah" };
  if (![ANTRIAN_MENUNGGU, ANTRIAN_SKORS, ANTRIAN_SELESAI].includes(status)) {
    return { ok: false, alasan: "keadaan_antrian_tidak_dikenal" };
  }
  if (!tanggalSah(tanggalSidang)) return { ok: false, alasan: "tanggal_tidak_sah" };

  if (kering) {
    return { ok: true, kering: true, akanDisetel: { perkaraId: id, status } };
  }

  const hasil = await kueri(
    `UPDATE antrian SET status = ?
      WHERE perkara_id = ? AND tanggal_sidang = ?${ruangId ? " AND ruang_id = ?" : ""}`,
    ruangId ? [status, id, tanggalSidang, Number(ruangId)] : [status, id, tanggalSidang]
  ).catch((galat) => ({ galat: String((galat && galat.message) || galat).slice(0, 160) }));

  if (hasil && hasil.galat) return { ok: false, alasan: hasil.galat };
  const berubah = Number((hasil && hasil.affectedRows) || 0);
  // Nol baris BUKAN error: tidak semua perkara mengambil nomor antrian.
  return { ok: true, kering: false, baris: berubah };
}

module.exports = {
  NAMA_HALAMAN,
  NAMA_HALAMAN_EDIT,
  jamBorang,
  jamSelesaiBorang,
  PROSES_PERSIDANGAN,
  PROSES_VERZET,
  PROSES_VERZET_JENIS3,
  PROSES_IKRAR_TALAK,
  ANTRIAN_MENUNGGU,
  ANTRIAN_SKORS,
  ANTRIAN_SELESAI,
  keadaanJadwal,
  riwayatSidangPerkara,
  kalenderPerkara,
  akunPerkara,
  jamMenurutAgenda,
  tanggalDuaPekan,
  prosesUntukTunda,
  ruangDipilih,
  susunRencanaTunda,
  susunRencanaPutus,
  susunRencanaPutusIkrar,
  AMAR_BELUM,
  SUMBER_HUKUM_TETAP,
  setelAntrian,
  bendera,
  akhirPekan,
  ringkasAntrian,
  antrianSidangUntuk,
  pilihPaniteraSidang,
  paniteraSidang,
  adaSidangSesudah,
  // Rencana dijalankan oleh mesin yang sama dengan penetapan - satu penjalan,
  // satu daftar putih tabel, satu cara mengisi kunci utama pada judul audit -
  // tetapi sejak 7 Okt 2026 (kasus 273) di dalam SATU transaksi: gagal di
  // tengah = seluruhnya dibatalkan. Nama lamanya dipertahankan untuk pemanggil.
  jalankanRencanaUtuh,
  jalankanRencana: jalankanRencanaUtuh,
};
