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

/** Nama halaman pada audit - persis yang ditulis SIPP sendiri. */
const NAMA_HALAMAN = "PENUNDAAN JADWAL SIDANG";

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
            p.nomor_perkara AS nomorPerkara,
            p.alur_perkara_id AS alurPerkaraId,
            p.jenis_perkara_id AS jenisPerkaraId,
            p.jenis_perkara_text AS jenisPerkara
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
  if (bersih(keadaan.ditunda) === "Y") return { ok: false, alasan: "sidang_sudah_ditunda" };

  // ==========================================================================
  // AKUNNYA DITURUNKAN DARI PERKARA, TIDAK LAGI DIKETIK
  // ==========================================================================
  //
  // Sebelumnya username-nya disebut pemanggil dan borangnya menanyakannya.
  // Aplikasi antrian sidang satker tidak pernah bertanya - ia membaca panitera
  // pengganti perkara itu dari perkara_panitera_pn. Bertanya membuka pintu
  // menulis atas nama orang lain, dan audit trail SIPP hanya mencatat nama
  // yang diberikan kepadanya: tidak ada satu pun pemeriksaan yang akan
  // menangkapnya.
  //
  // Username yang disebut pemanggil masih diterima sebagai CADANGAN - hanya
  // untuk perkara yang panitera penggantinya belum tercatat.
  const dariPerkara = await akunPerkara(keadaan.perkaraId);
  const akun = dariPerkara.panitera || (await akunSipp(minta.olehUsername));
  if (!akun) return { ok: false, alasan: "panitera_sidang_tidak_ketemu" };

  const alasanTunda = bersih(minta.alasanTunda);
  if (!alasanTunda) return { ok: false, alasan: "alasan_tunda_kosong" };

  const tanggalBerikut = bersih(minta.tanggalBerikut);
  if (!tanggalSah(tanggalBerikut)) return { ok: false, alasan: "tanggal_berikut_tidak_sah" };

  const jamBerikut = bersih(minta.jamBerikut) || bersih(keadaan.jamSidang);
  if (!jamSah(jamBerikut)) return { ok: false, alasan: "jam_berikut_tidak_sah" };

  const agendaBerikut = bersih(minta.agendaBerikut);
  if (!agendaBerikut) return { ok: false, alasan: "agenda_berikut_kosong" };

  // ==========================================================================
  // TANGGALNYA DIPERIKSA DI SINI, BUKAN SESUDAH BARISNYA LAHIR
  // ==========================================================================
  const tanggalSekarang = (await penetapan.waktuBasisData()).slice(0, 10);
  if (tanggalBerikut <= tanggalSekarang) {
    return { ok: false, alasan: "tanggal_berikut_tidak_maju", diminta: tanggalBerikut };
  }

  const andaian = [];
  // hariLibur() memulangkan keterangan hari liburnya, atau null bila hari itu
  // hari kerja biasa. Tahun yang daftarnya belum dimuat juga memulangkan
  // null - karena itu ketersediaan tahunnya diperiksa TERPISAH, supaya
  // "belum ada daftarnya" tidak terbaca sebagai "bukan hari libur".
  const tahunBerikut = Number(tanggalBerikut.slice(0, 4));
  if (!hariLiburService.tahunTersedia(tahunBerikut)) {
    andaian.push(
      `Daftar hari libur tahun ${tahunBerikut} belum ada, jadi tanggal sidang berikutnya belum diperiksa terhadap hari libur.`
    );
  } else {
    const libur = hariLiburService.hariLibur(tanggalBerikut);
    if (libur) {
      return {
        ok: false,
        alasan: "tanggal_berikut_hari_libur",
        keterangan: typeof libur === "string" ? libur : String(libur.keterangan || ""),
      };
    }
  }

  const jenisPengadilan = Number(minta.jenisPengadilan) || 0;
  const { prosesId, perbaruiRiwayat } = prosesUntukTunda(keadaan, jenisPengadilan);

  const saat = await penetapan.waktuBasisData();
  // Butir 14: alamat yang tidak diteruskan DIKOSONGKAN, tidak dikarang "127.0.0.1".
  const ip = bersih(minta.ip) || "";
  const langkah = [];

  // ---- 1. Baris sidang hari ini: ditunda ----------------------------------
  const nilaiUbah = {
    jam_sidang: bersih(minta.jamSekarang) || bersih(keadaan.jamSidang),
    // Jam selesainya sidang. Kosong bukan pilihan: "" masuk ke kolom TIME
    // sebagai 00:00:00 tanpa satu pun galat - lihat jamDariCap.
    sampai_jam: bersih(minta.sampaiJamSekarang) || bersih(keadaan.sampaiJam) || jamDariCap(saat),
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
    dihadiri_oleh: Number(minta.dihadiriOleh) || Number(keadaan.dihadiriOleh) || 4,
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
  const nilaiBaru = {
    perkara_id: keadaan.perkaraId,
    tanggal_sidang: tanggalBerikut,
    jam_sidang: jamBerikut,
    agenda: agendaBerikut,
    ruangan_id: Number(minta.ruanganIdBerikut) || Number(keadaan.ruanganId) || null,
    ruangan: bersih(minta.ruanganBerikut) || bersih(keadaan.ruangan),
    sidang_keliling: bersih(keadaan.sidangKeliling) === "Y" ? "Y" : "T",
    verzet: bersih(keadaan.verzet) === "Y" ? "Y" : null,
    keberatan: bersih(keadaan.keberatan) === "Y" ? "Y" : null,
    ikrar_talak: bersih(keadaan.ikrarTalak) === "Y" ? "Y" : null,
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
        `Alur perkara ini tidak punya proses ${prosesId}, jadi riwayat perkaranya tidak diperbarui.`
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
    atasNama: { username: akun.username, namaLengkap: akun.fullname },
    operator: bersih(minta.operator),
    saat,
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
 * SIDANGNYA di perkara_jadwal_sidang (beserta baris audit jadwal itu).
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

  const akun = await akunPerkara(keadaan.perkaraId);
  if (!akun.panitera) return { ok: false, alasan: "panitera_sidang_tidak_ketemu" };
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
  const dihadiri = Number(minta.dihadiriOleh);
  const saat = await penetapan.waktuBasisData();
  // Butir 14: alamat yang tidak diteruskan DIKOSONGKAN, tidak dikarang "127.0.0.1".
  const ip = bersih(minta.ip) || "";
  const andaian = [];
  if (!akun.hakim && tulisPutusan) {
    andaian.push(
      "Hakim perkara ini tidak ketemu di SIPP, jadi putusannya dicatat atas nama panitera sidang. " +
        "Pada aplikasi antrian ia dicatat atas nama hakim."
    );
  }

  const langkah = [];

  // ---- 1. Sidang hari ini: SELESAI, bukan ditunda ------------------------
  const nilaiJadwal = {
    // Jam saja - kolomnya TIME. Cap waktu utuh "2026-09-18 05:15:21" dibaca
    // MySQL sebagai bentuk 'D HH:MM:SS' dan hasilnya bukan jam yang dimaksud.
    sampai_jam: jamDariCap(saat),
    alasan_ditunda: `putus ${namaStatus}${verstek === "Y" ? " (verstek)" : ""}`,
    jam_sidang: bersih(minta.jamSekarang) || bersih(keadaan.jamSidang),
    ditunda: "T",
    diperbaharui_oleh: akun.panitera.username,
    diperbaharui_tanggal: saat,
  };
  // Hanya 1..4 yang punya arti - lihat daftarnya pada susunRencanaTunda. Di
  // luar itu kolomnya TIDAK disentuh sama sekali: menuliskan angka yang tidak
  // ada artinya lebih buruk daripada membiarkan yang sudah ada.
  const adaDihadiri = Number.isInteger(dihadiri) && dihadiri >= 1 && dihadiri <= 4;
  langkah.push({
    tabel: "perkara_jadwal_sidang",
    aksi: "UPDATE",
    keterangan: `sidang ${penetapan.tanggalIso(keadaan.tanggalSidang)} selesai - ${nilaiJadwal.alasan_ditunda}`,
    sql:
      `UPDATE perkara_jadwal_sidang
          SET sampai_jam = ?, alasan_ditunda = ?, jam_sidang = ?, ditunda = ?,
              ${adaDihadiri ? "dihadiri_oleh = ?, " : ""}diperbaharui_oleh = ?, diperbaharui_tanggal = ?
        WHERE id = ?`,
    params: adaDihadiri
      ? [
          nilaiJadwal.sampai_jam,
          nilaiJadwal.alasan_ditunda,
          nilaiJadwal.jam_sidang,
          nilaiJadwal.ditunda,
          dihadiri,
          nilaiJadwal.diperbaharui_oleh,
          nilaiJadwal.diperbaharui_tanggal,
          keadaan.jadwalId,
        ]
      : [
          nilaiJadwal.sampai_jam,
          nilaiJadwal.alasan_ditunda,
          nilaiJadwal.jam_sidang,
          nilaiJadwal.ditunda,
          nilaiJadwal.diperbaharui_oleh,
          nilaiJadwal.diperbaharui_tanggal,
          keadaan.jadwalId,
        ],
  });
  langkah.push(
    penetapan.barisAudit({
      username: akun.panitera.username,
      tabel: "perkara_jadwal_sidang",
      formulir: NAMA_HALAMAN,
      aksi: "UPDATE",
      nilai: nilaiJadwal,
      kunciSendiri: `id=${keadaan.jadwalId}`,
      ip,
      saat,
    })
  );

  if (!tulisPutusan) {
    andaian.push(
      "Hanya hasil sidang di jadwal sidang yang dicatat. Putusan akhir (perkara_putusan), audit putusannya, " +
        "dan tahapan perkara tidak ditulis dari tombol ini - diinput lewat SIPP / putusan otomatis."
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
    perkara: { perkaraId: keadaan.perkaraId, nomorPerkara: keadaan.nomorPerkara },
    atasNama: {
      username: akun.panitera.username,
      namaLengkap: akun.panitera.fullname,
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
  PROSES_PERSIDANGAN,
  PROSES_VERZET,
  PROSES_VERZET_JENIS3,
  PROSES_IKRAR_TALAK,
  ANTRIAN_MENUNGGU,
  ANTRIAN_SKORS,
  ANTRIAN_SELESAI,
  keadaanJadwal,
  riwayatSidangPerkara,
  akunPerkara,
  jamMenurutAgenda,
  tanggalDuaPekan,
  prosesUntukTunda,
  susunRencanaTunda,
  susunRencanaPutus,
  AMAR_BELUM,
  SUMBER_HUKUM_TETAP,
  setelAntrian,
  // Rencana dijalankan oleh mesin yang sama dengan penetapan - satu penjalan,
  // satu daftar putih tabel, satu cara mengisi kunci utama pada judul audit.
  jalankanRencana: penetapan.jalankanRencana,
};
